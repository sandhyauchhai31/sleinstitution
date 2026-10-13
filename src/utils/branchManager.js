import { db, collection, doc, getDoc, setDoc, deleteDoc, getDocs } from '../firebase';
import { transferShurapurToShahapur } from './studentTransfer';
import { getShahapurStudentsFull } from './shahapurStudentsData';

// 42 Core Default Operational Branches Preserved As-Is
export const DEFAULT_BRANCHES = [
  'Athani',
  'Aigali',
  'Alamel',
  'Badami',
  'Banahatti',
  'Bailhongal',
  'Bellary',
  'Bidar',
  'Chikkodi',
  'Gadag',
  'Gangavati',
  'Ganagapur',
  'Gulbarga',
  'Gokak',
  'Harugeri',
  'Hukkeri',
  'Hubali',
  'H.Hipparagi',
  'Jewaragi',
  'Kakamari',
  'Kanakagiri',
  'Karawar',
  'Koppal',
  'Mugalkod',
  'Mudalgi',
  'Mudhol',
  'Muddebihal',
  'Ranibennur',
  'Ron',
  'Rayadurg',
  'Raichur',
  'Raibag',
  'Savalagi',
  'Shindhanoor',
  'Shahapur',
  'Talikote',
  'Telasang',
  'Terdal',
  'Vijayapur',
  'Yadagiri',
  'Kannur',
  'Ainapur',
  'Mysore'
];

const LOCAL_STORAGE_KEY = 'sle_branches_cache';
const DELETED_DEFAULT_KEY = 'sle_deleted_default_branches';
const BRANCH_EVENT_NAME = 'sle_branches_updated';

// Helper to normalize branch name (Trimmed and Capitalized first letter of words)
export const formatBranchName = (str) => {
  if (!str) return '';
  return str
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Generate deterministic ID from branch name
export const getBranchDocId = (name) => {
  return 'branch_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_');
};

/**
 * Retrieve cached branches from localStorage or default list
 */
export const getStoredBranches = () => {
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure Shahapur & Mysore are preserved in the active branches list
        let updated = false;
        const hasShahapur = parsed.some(b => (typeof b === 'string' ? b : b.name).toLowerCase() === 'shahapur');
        if (!hasShahapur) {
          parsed.push({
            id: 'branch_shahapur',
            name: 'Shahapur',
            isDefault: true,
            createdAt: Date.now()
          });
          updated = true;
        }
        const hasMysore = parsed.some(b => (typeof b === 'string' ? b : b.name).toLowerCase() === 'mysore');
        if (!hasMysore) {
          parsed.push({
            id: 'branch_mysore',
            name: 'Mysore',
            isDefault: true,
            createdAt: Date.now()
          });
          updated = true;
        }
        if (updated) {
          parsed.sort((a, b) => (typeof a === 'string' ? a : a.name || '').localeCompare(typeof b === 'string' ? b : b.name || ''));
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed));
          } catch (e) {}
        }
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading branches from localStorage:', e);
  }

  // Fallback to default list formatted as branch objects
  return DEFAULT_BRANCHES.map(name => ({
    id: getBranchDocId(name),
    name: name,
    isDefault: true,
    createdAt: Date.now()
  }));
};

/**
 * Save branches to localStorage and dispatch update event across tabs/components
 */
export const saveStoredBranches = (branches) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(branches));
    window.dispatchEvent(new CustomEvent(BRANCH_EVENT_NAME, { detail: branches }));
  } catch (e) {
    console.error('Error saving branches to localStorage:', e);
  }
};

let branchesFetchPromise = null;

/**
 * Fetch latest branches from Firestore once and update local cache
 */
export const refreshBranches = async (callback) => {
  if (!db) return getStoredBranches();
  try {
    const snapshot = await getDocs(collection(db, 'branches'));
    if (snapshot.empty) {
      DEFAULT_BRANCHES.forEach(async (bName) => {
        try {
          const docId = getBranchDocId(bName);
          await setDoc(doc(db, 'branches', docId), {
            id: docId,
            name: bName,
            isDefault: true,
            createdAt: Date.now()
          }, { merge: true });
        } catch (err) {}
      });
    } else {
      const firestoreBranches = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      // Always ensure Shahapur is restored in Firestore list
      const hasShahapur = firestoreBranches.some(b => (b.name || '').toLowerCase() === 'shahapur');
      if (!hasShahapur) {
        const shBranch = {
          id: 'branch_shahapur',
          name: 'Shahapur',
          isDefault: true,
          createdAt: Date.now()
        };
        firestoreBranches.push(shBranch);
        try {
          setDoc(doc(db, 'branches', 'branch_shahapur'), shBranch, { merge: true });
        } catch (e) {}
      }

      firestoreBranches.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      saveStoredBranches(firestoreBranches);
      if (callback) callback(firestoreBranches);
      return firestoreBranches;
    }
  } catch (error) {
    console.warn('Firestore branches fetch warning:', error?.message);
  }
  return getStoredBranches();
};

/**
 * Subscribe to branches updates with LocalStorage cache + one-time Firestore fetch
 */
export const subscribeToBranches = (callback) => {
  // Immediately call with current local cached branches
  const initial = getStoredBranches();
  callback(initial);

  // Listen for local custom events (for immediate UI updates across components)
  const handleLocalUpdate = (event) => {
    if (event.detail && Array.isArray(event.detail)) {
      callback(event.detail);
    }
  };
  window.addEventListener(BRANCH_EVENT_NAME, handleLocalUpdate);

  // Also listen for storage event from other browser tabs
  const handleStorageEvent = (e) => {
    if (e.key === LOCAL_STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed)) callback(parsed);
      } catch (err) {}
    }
  };
  window.addEventListener('storage', handleStorageEvent);

  // Perform single fetch on startup if db is available
  if (db) {
    if (!branchesFetchPromise) {
      branchesFetchPromise = refreshBranches(callback);
    } else {
      branchesFetchPromise.then(res => {
        if (Array.isArray(res) && res.length > 0) callback(res);
      });
    }
  }

  return () => {
    window.removeEventListener(BRANCH_EVENT_NAME, handleLocalUpdate);
    window.removeEventListener('storage', handleStorageEvent);
  };
};

/**
 * Add a new dynamic branch
 */
export const addBranch = async (branchName) => {
  const trimmed = branchName ? branchName.trim() : '';
  if (!trimmed) {
    return { success: false, error: 'Branch name cannot be empty.' };
  }

  const currentBranches = getStoredBranches();
  const lowerName = trimmed.toLowerCase();

  // Check for duplicate branch name (case-insensitive)
  const isDuplicate = currentBranches.some(b => b.name.toLowerCase() === lowerName);
  if (isDuplicate) {
    return { success: false, error: `Branch "${trimmed}" already exists.` };
  }

  const docId = getBranchDocId(trimmed);
  const isDefault = DEFAULT_BRANCHES.some(d => d.toLowerCase() === lowerName);

  const newBranch = {
    id: docId,
    name: trimmed,
    isDefault: isDefault,
    createdAt: Date.now()
  };

  const updatedBranches = [...currentBranches, newBranch].sort((a, b) => 
    (a.name || '').localeCompare(b.name || '')
  );

  // Update local cache immediately
  saveStoredBranches(updatedBranches);

  // Update Firestore if online
  try {
    if (db) {
      await setDoc(doc(db, 'branches', docId), newBranch, { merge: true });
    }
  } catch (err) {
    console.warn('Firestore branch add notice:', err);
  }

  return { success: true, branch: newBranch };
};

/**
 * Update / Edit an existing branch name
 */
export const updateBranch = async (branchId, newBranchName) => {
  const trimmed = newBranchName ? newBranchName.trim() : '';
  if (!trimmed) {
    return { success: false, error: 'Branch name cannot be empty.' };
  }

  const currentBranches = getStoredBranches();
  const targetIndex = currentBranches.findIndex(b => b.id === branchId || b.name.toLowerCase() === String(branchId).toLowerCase());

  if (targetIndex === -1) {
    return { success: false, error: 'Branch not found.' };
  }

  const lowerNew = trimmed.toLowerCase();
  const target = currentBranches[targetIndex];

  // Check if another branch already has this name
  const isDuplicate = currentBranches.some((b, idx) => idx !== targetIndex && b.name.toLowerCase() === lowerNew);
  if (isDuplicate) {
    return { success: false, error: `Another branch with name "${trimmed}" already exists.` };
  }

  const oldDocId = target.id;
  const updatedBranch = {
    ...target,
    name: trimmed,
    updatedAt: Date.now()
  };

  const updatedBranches = [...currentBranches];
  updatedBranches[targetIndex] = updatedBranch;
  updatedBranches.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // Update local cache
  saveStoredBranches(updatedBranches);

  // Update Firestore
  try {
    if (db) {
      await setDoc(doc(db, 'branches', oldDocId), updatedBranch, { merge: true });
    }
  } catch (err) {
    console.warn('Firestore branch update notice:', err);
  }

  return { success: true, branch: updatedBranch };
};

/**
 * Delete a branch by ID or Name
 */
export const deleteBranch = async (branchIdOrName) => {
  if (!branchIdOrName) {
    return { success: false, error: 'Invalid branch identifier.' };
  }

  const currentBranches = getStoredBranches();
  const target = currentBranches.find(
    b => b.id === branchIdOrName || b.name.toLowerCase() === String(branchIdOrName).toLowerCase()
  );

  if (!target) {
    return { success: false, error: 'Branch not found.' };
  }

  const updatedBranches = currentBranches.filter(b => b.id !== target.id && b.name.toLowerCase() !== target.name.toLowerCase());
  
  // Save locally
  saveStoredBranches(updatedBranches);

  // Record deleted default to avoid re-seeding
  if (target.isDefault) {
    try {
      const deletedDefaults = JSON.parse(localStorage.getItem(DELETED_DEFAULT_KEY) || '[]');
      if (!deletedDefaults.includes(target.name)) {
        deletedDefaults.push(target.name);
        localStorage.setItem(DELETED_DEFAULT_KEY, JSON.stringify(deletedDefaults));
      }
    } catch (e) {}
  }

  // Delete from Firestore
  try {
    if (db) {
      await deleteDoc(doc(db, 'branches', target.id));
    }
  } catch (err) {
    console.warn('Firestore branch delete notice:', err);
  }

  return { success: true, deletedBranch: target };
};

/**
 * Reset all branches back to the original default 42 branches
 */
export const resetBranchesToDefault = async () => {
  localStorage.removeItem(DELETED_DEFAULT_KEY);

  const defaultList = DEFAULT_BRANCHES.map(name => ({
    id: getBranchDocId(name),
    name: name,
    isDefault: true,
    createdAt: Date.now()
  }));

  saveStoredBranches(defaultList);

  if (db) {
    try {
      // Clear current collection and re-seed defaults
      const snapshot = await getDocs(collection(db, 'branches'));
      for (const d of snapshot.docs) {
        await deleteDoc(d.ref);
      }
      for (const b of defaultList) {
        await setDoc(doc(db, 'branches', b.id), b);
      }
    } catch (err) {
      console.warn('Reset branches Firestore error:', err);
    }
  }

  return { success: true, branches: defaultList };
};

/**
 * Restore Shahapur branch, its default franchisee, and associated student records
 */
export const restoreShahapurBranch = async () => {
  // 1. Remove Shahapur / Shurapur from deleted default branches in localStorage
  try {
    const deletedDefaults = JSON.parse(localStorage.getItem(DELETED_DEFAULT_KEY) || '[]');
    const filtered = deletedDefaults.filter(name => {
      const lower = String(name || '').trim().toLowerCase();
      return lower !== 'shahapur' && lower !== 'shurapur' && lower !== 'shorapur';
    });
    localStorage.setItem(DELETED_DEFAULT_KEY, JSON.stringify(filtered));
  } catch (e) {}

  // 2. Remove Shahapur from deleted students list in localStorage
  try {
    const deletedStudentIds = JSON.parse(localStorage.getItem('sle_deleted_student_ids') || '[]');
    const shahapur68 = getShahapurStudentsFull();
    const shahapurRegs = new Set(shahapur68.map(s => String(s.registrationNo).toLowerCase()));
    const shahapurIds = new Set(shahapur68.map(s => String(s.id).toLowerCase()));
    const filteredIds = deletedStudentIds.filter(id => {
      const lower = String(id || '').trim().toLowerCase();
      return !lower.includes('shahapur') && !shahapurRegs.has(lower) && !shahapurIds.has(lower);
    });
    localStorage.setItem('sle_deleted_student_ids', JSON.stringify(filteredIds));
  } catch (e) {}

  // 3. Re-insert Shahapur into cached branches
  const shahapurBranch = {
    id: 'branch_shahapur',
    name: 'Shahapur',
    isDefault: true,
    createdAt: Date.now()
  };

  const currentBranches = getStoredBranches();
  const exists = currentBranches.some(b => (b.name || '').toLowerCase() === 'shahapur');
  let updatedBranches = exists ? currentBranches : [...currentBranches, shahapurBranch];
  updatedBranches.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  saveStoredBranches(updatedBranches);

  // 4. Save Shahapur to Firestore 'branches' collection
  if (db) {
    try {
      await Promise.race([
        setDoc(doc(db, 'branches', 'branch_shahapur'), shahapurBranch, { merge: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
      ]);
    } catch (err) {
      // Background restore notice suppressed
    }
  }

  // 5. Restore associated 68 Shahapur Student records
  try {
    const allShahapurStudents = getShahapurStudentsFull();
    const cacheKeys = ['sle_students_cache', 'sle_applications_cache'];
    cacheKeys.forEach(k => {
      const items = JSON.parse(localStorage.getItem(k) || '[]');
      const existingRegs = new Set(items.map(s => String(s.registrationNo || s.regNo || s.id)));
      let modified = false;
      allShahapurStudents.forEach(st => {
        if (!existingRegs.has(st.registrationNo) && !existingRegs.has(st.id)) {
          items.push(st);
          existingRegs.add(st.registrationNo);
          existingRegs.add(st.id);
          modified = true;
        }
      });
      if (modified) {
        localStorage.setItem(k, JSON.stringify(items));
      }
    });

    if (db) {
      for (const st of allShahapurStudents) {
        setDoc(doc(db, 'students', st.id), st, { merge: true }).catch(() => {});
        setDoc(doc(db, 'students', st.registrationNo), st, { merge: true }).catch(() => {});
        setDoc(doc(db, 'applications', st.appNumber), st, { merge: true }).catch(() => {});
      }
    }
  } catch (e) {}

  // 7. Migrate any Shurapur / Shorapur records to Shahapur
  try {
    await transferShurapurToShahapur();
  } catch (e) {}

  // 8. Dispatch events across components
  window.dispatchEvent(new CustomEvent(BRANCH_EVENT_NAME, { detail: updatedBranches }));
  window.dispatchEvent(new Event('storage'));

  return { success: true, branch: shahapurBranch };
};

/**
 * Formats a franchisee record's address into a complete, clean address line
 * Uses centerAddress (saved in franchisee reg / onboard wizard Step 2)
 * with residentialAddress, districtState, and pin code as appropriate.
 */
export const formatFranchiseeAddress = (f) => {
  if (!f) return '';
  const data = f.data || f;
  // Direct Center Address from Section 2 Training Address & Infrastructure Details
  const centerAddr = (data.centerAddress || '').trim();
  if (centerAddr) {
    return centerAddr;
  }

  const street = (data.residentialAddress || data.address || '').trim();
  const pin = (data.centerPinCode || data.residentialPinCode || data.pinCode || data.pincode || '').trim();
  const districtState = (data.districtState || data.district || data.state || '').trim();
  const loc = (data.location || data.place || data.city || '').trim();

  let formatted = street;
  if (!formatted) {
    formatted = loc;
  }

  if (districtState && !formatted.toLowerCase().includes(districtState.toLowerCase())) {
    formatted = formatted ? `${formatted}, ${districtState}` : districtState;
  }

  if (pin && !formatted.includes(pin)) {
    formatted = formatted ? `${formatted} - ${pin}` : pin;
  }

  return formatted;
};

/**
 * Matches a student's branch/franchisee info against a list of franchisee objects
 */
export const matchFranchisee = (studentData, franchiseesList = []) => {
  if (!studentData || !franchiseesList || !franchiseesList.length) return null;

  const fId = (studentData.franchiseeId || studentData.franchiseId || '').toString().trim().toLowerCase();
  const branchName = (studentData.trustBranch || studentData.branch || studentData.place || studentData.trainingCenter || '').toString().trim().toLowerCase();

  // 1. Exact ID match (doc id or franchiseeId)
  if (fId) {
    const byId = franchiseesList.find(f => {
      const data = f.data || f;
      const fid = (f.id || data.id || data.franchiseeId || data.environmentId || '').toString().trim().toLowerCase();
      return fid === fId;
    });
    if (byId) return byId;
  }

  // 2. Exact or substring match on branch/location/place/franchiseName
  if (branchName) {
    // Exact match on location or place
    let byLocation = franchiseesList.find(f => {
      const data = f.data || f;
      const loc = (data.location || data.place || data.city || '').toString().trim().toLowerCase();
      return loc === branchName;
    });
    if (byLocation) return byLocation;

    // Substring match on location, place, franchiseName, centerName, id
    byLocation = franchiseesList.find(f => {
      const data = f.data || f;
      const loc = (data.location || data.place || data.city || '').toString().trim().toLowerCase();
      const fn = (data.franchiseName || data.centerName || data.name || '').toString().trim().toLowerCase();
      const fid = (f.id || data.id || '').toString().trim().toLowerCase();
      return (loc && (loc.includes(branchName) || branchName.includes(loc))) ||
             (fn && fn.includes(branchName)) ||
             (fid && fid.includes(branchName));
    });
    if (byLocation) return byLocation;
  }

  return null;
};

/**
 * Synchronous resolver for Branch Address from local cache
 */
export const resolveBranchAddressSync = (studentData) => {
  if (!studentData) return '';
  if (studentData.centerAddress && studentData.centerAddress.trim().length > 3) {
    return studentData.centerAddress.trim();
  }
  if (studentData.branchAddress && studentData.branchAddress.trim().length > 3) {
    return studentData.branchAddress.trim();
  }
  try {
    const cached = JSON.parse(localStorage.getItem('sle_franchisees_cache') || '[]');
    const matched = matchFranchisee(studentData, cached);
    if (matched) {
      const addr = formatFranchiseeAddress(matched);
      if (addr) return addr;
    }
  } catch (_) {}
  return studentData.centerAddress || studentData.trainingCenter || studentData.trustBranch || studentData.place || '';
};

/**
 * Asynchronous resolver that checks local cache and fetches live from Firestore franchisees collection if needed
 */
export const resolveBranchAddressAsync = async (studentData) => {
  const syncAddr = resolveBranchAddressSync(studentData);
  // If we already have a detailed center address with multiple words, return immediately
  if (syncAddr && syncAddr.trim().split(/\s+/).length >= 3) {
    return syncAddr;
  }

  try {
    if (db) {
      const snap = await getDocs(collection(db, 'franchisees'));
      if (!snap.empty) {
        const liveList = [];
        snap.forEach(d => liveList.push({ id: d.id, ...d.data() }));
        try {
          localStorage.setItem('sle_franchisees_cache', JSON.stringify(liveList));
        } catch (_) {}
        const matched = matchFranchisee(studentData, liveList);
        if (matched) {
          const addr = formatFranchiseeAddress(matched);
          if (addr) return addr;
        }
      }
    }
  } catch (err) {
    console.warn('Franchisee address fetch error:', err);
  }

  return syncAddr || studentData.centerAddress || studentData.trainingCenter || studentData.trustBranch || studentData.place || 'MYSORE';
};


