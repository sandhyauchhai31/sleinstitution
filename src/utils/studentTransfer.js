import { db, collection, doc, getDocs, updateDoc, setDoc } from '../firebase';

/**
 * Normalizes branch name strings for flexible, resilient matching (e.g. "Jewaragi" vs "Jewargi", "Surapur" vs "Shurapur")
 */
export const normalizeBranchName = (val) => {
  if (!val || typeof val !== 'string') return '';
  const norm = val.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (norm === 'jewargi' || norm === 'jewaragi') return 'jewaragi';
  if (norm.includes('shurapur') || norm.includes('shorapur') || norm.includes('surapur')) return 'surapur';
  return norm;
};

/**
 * Checks if a candidate field value matches the target branch name
 */
export const isBranchMatch = (fieldVal, targetBranch) => {
  if (!fieldVal || !targetBranch || typeof fieldVal !== 'string' || typeof targetBranch !== 'string') return false;
  const nVal = normalizeBranchName(fieldVal);
  const nTarget = normalizeBranchName(targetBranch);
  if (!nVal || !nTarget) return false;
  return nVal === nTarget || nVal.includes(nTarget) || nTarget.includes(nVal);
};

/**
 * Utility to transfer all students registered under Shurapur / Shorapur / Surapur 
 * to Shahapur, both in local storage caches and in live Firestore collections.
 */
export async function transferShurapurToShahapur() {
  const targetOld = ['shurapur', 'shorapur', 'surapur'];

  const isMatch = (str) => {
    if (!str || typeof str !== 'string') return false;
    const lower = str.trim().toLowerCase();
    return targetOld.some(old => lower.includes(old));
  };

  let localUpdated = false;

  // 1. Update Local Storage Caches
  const cacheKeys = [
    'sle_students_cache',
    'sle_coaching_students_cache',
    'sle_applications_cache',
    'sle_registered_halltickets',
    'sle_franchisees_cache'
  ];

  const branchFields = [
    'trainingCenter',
    'trustBranch',
    'branchName',
    'franchiseName',
    'place',
    'city',
    'location',
    'centerName',
    'center',
    'examCenter',
    'name'
  ];

  for (const key of cacheKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      let parsed = JSON.parse(raw);
      let keyChanged = false;

      if (Array.isArray(parsed)) {
        parsed = parsed.map(item => {
          if (!item || typeof item !== 'object') return item;
          let itemMod = false;
          const updated = { ...item };

          for (const field of branchFields) {
            if (isMatch(updated[field])) {
              updated[field] = 'Shahapur';
              itemMod = true;
            }
          }

          if (itemMod) keyChanged = true;
          return updated;
        });

        if (keyChanged) {
          localStorage.setItem(key, JSON.stringify(parsed));
          localUpdated = true;
        }
      }
    } catch (err) {
      console.warn(`Error updating local cache key ${key}:`, err);
    }
  }

  // 2. Update Live Firestore Database Collections
  if (db) {
    const collectionsToMigrate = ['students', 'applications', 'coaching_students', 'franchisees', 'branches'];
    for (const colName of collectionsToMigrate) {
      try {
        const snap = await getDocs(collection(db, colName));
        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          if (!data) continue;

          const updates = {};
          let needsUpdate = false;

          for (const field of branchFields) {
            if (isMatch(data[field])) {
              updates[field] = 'Shahapur';
              needsUpdate = true;
            }
          }

          if (needsUpdate) {
            try {
              await setDoc(doc(db, colName, docSnap.id), updates, { merge: true });
              console.log(`[Transfer Success] Migrated document ${docSnap.id} in collection ${colName} to Shahapur`);
            } catch (uErr) {
              console.warn(`Error updating Firestore doc ${docSnap.id} in ${colName}:`, uErr);
            }
          }
        }
      } catch (colErr) {
        console.warn(`Error scanning collection ${colName} for Shurapur transfer:`, colErr);
      }
    }
  }

  return localUpdated;
}

/**
 * Branch fields that store branch/location information on student/application records
 */
export const STUDENT_BRANCH_FIELDS = [
  'trainingCenter',
  'trustBranch',
  'branchName',
  'franchiseName',
  'place',
  'city',
  'location',
  'centerName',
  'center',
  'examCenter',
];

/**
 * Collections that contain student/application records
 */
export const STUDENT_COLLECTIONS = ['students', 'applications', 'coaching_students'];
export const ALL_TRANSFER_COLLECTIONS = ['students', 'applications', 'coaching_students', 'certificates', 'marksheets'];

/**
 * Cache keys used to store student/application data in localStorage
 */
export const STUDENT_CACHE_KEYS = [
  'sle_students_cache',
  'sle_coaching_students_cache',
  'sle_applications_cache',
  'sle_registered_halltickets',
];

/**
 * Search for students in a given branch (from Firestore + localStorage caches)
 * @param {string} branchName - The branch name to search for
 * @returns {Promise<{students: Array, total: number}>}
 */
export async function fetchStudentsInBranch(branchName) {
  if (!branchName) return { students: [], total: 0 };
  const students = [];
  const seenCanonicalKeys = new Set();

  const getBranchValue = (data) => {
    for (const field of STUDENT_BRANCH_FIELDS) {
      if (data[field] && typeof data[field] === 'string' && data[field].trim()) {
        return data[field];
      }
    }
    return null;
  };

  // 1. Firestore collections
  if (db) {
    for (const colName of STUDENT_COLLECTIONS) {
      try {
        const snap = await getDocs(collection(db, colName));
        snap.forEach(docSnap => {
          const data = docSnap.data();
          if (!data) return;
          const matchesAnyField = STUDENT_BRANCH_FIELDS.some(f => isBranchMatch(data[f], branchName));
          if (!matchesAnyField) return;

          const reg = (data.registrationNo || data.regNo || data.admissionNo || data.admNo || '').trim();
          const app = (data.appNumber || data.appRefNo || data.applicationNo || '').trim();
          const canonicalKey = (reg || app || docSnap.id).toLowerCase();

          if (seenCanonicalKeys.has(canonicalKey)) return;
          seenCanonicalKeys.add(canonicalKey);
          if (docSnap.id) seenCanonicalKeys.add(docSnap.id.trim().toLowerCase());
          if (reg) seenCanonicalKeys.add(reg.toLowerCase());
          if (app) seenCanonicalKeys.add(app.toLowerCase());

          students.push({
            ...data,
            id: docSnap.id, // Primary doc ID for selection
            docId: docSnap.id,
            registrationNo: reg || data.registrationNo || docSnap.id,
            regNo: reg || data.regNo || docSnap.id,
            appNumber: app || data.appNumber || '',
            studentId: data.id || docSnap.id,
            _collection: colName,
            _source: 'firestore',
            currentBranch: getBranchValue(data) || branchName,
          });
        });
      } catch (e) {
        console.warn(`[fetchStudentsInBranch] Error scanning ${colName}:`, e);
      }
    }
  }

  // 2. LocalStorage caches (fallback / supplement)
  for (const key of STUDENT_CACHE_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      parsed.forEach((item, idx) => {
        if (!item || typeof item !== 'object') return;
        const matchesAnyField = STUDENT_BRANCH_FIELDS.some(f => isBranchMatch(item[f], branchName));
        if (!matchesAnyField) return;

        const reg = (item.registrationNo || item.regNo || item.admissionNo || item.admNo || '').trim();
        const app = (item.appNumber || item.appRefNo || item.applicationNo || '').trim();
        const itemId = item.id || reg || app || `local_${idx}`;
        const canonicalKey = (reg || app || itemId).toLowerCase();

        if (seenCanonicalKeys.has(canonicalKey)) return;
        seenCanonicalKeys.add(canonicalKey);
        if (itemId) seenCanonicalKeys.add(String(itemId).trim().toLowerCase());
        if (reg) seenCanonicalKeys.add(reg.toLowerCase());
        if (app) seenCanonicalKeys.add(app.toLowerCase());

        students.push({
          ...item,
          id: itemId,
          docId: itemId,
          registrationNo: reg || item.registrationNo || itemId,
          regNo: reg || item.regNo || itemId,
          appNumber: app || item.appNumber || '',
          studentId: item.id || itemId,
          _collection: key,
          _source: 'localStorage',
          currentBranch: getBranchValue(item) || branchName,
        });
      });
    } catch (e) {
      console.warn(`[fetchStudentsInBranch] Error reading cache ${key}:`, e);
    }
  }

  return { students, total: students.length };
}

/**
 * Transfer students from one branch to another
 * @param {string[]} studentIds - Array of student IDs to transfer (or [] for ALL)
 * @param {string} fromBranch - Source branch name
 * @param {string} toBranch - Destination branch name
 * @param {string[]} [collections] - Firestore collections to update
 * @returns {Promise<{success: boolean, transferred: number, errors: string[], log: string[]}>}
 */
export async function transferStudentsBranch(studentIds, fromBranch, toBranch, collections = ALL_TRANSFER_COLLECTIONS) {
  if (!fromBranch || !toBranch) {
    return { success: false, transferred: 0, errors: ['Source and destination branch are required.'], log: [] };
  }
  if (normalizeBranchName(fromBranch) === normalizeBranchName(toBranch)) {
    return { success: false, transferred: 0, errors: ['Source and destination branch cannot be the same.'], log: [] };
  }

  const log = [];
  const errors = [];
  const isTransferAll = !studentIds || studentIds.length === 0;

  // Build target identifiers set from provided studentIds
  const targetIdSet = new Set();
  if (!isTransferAll) {
    studentIds.forEach(id => {
      if (id) targetIdSet.add(String(id).trim().toLowerCase());
    });
  }

  // Pre-expand targetIdSet across all collections so ANY alias (regNo, appNumber, STUD-xxx, docId) is automatically matched
  if (!isTransferAll && targetIdSet.size > 0 && db) {
    for (const colName of collections) {
      try {
        const snap = await getDocs(collection(db, colName));
        snap.docs.forEach(docSnap => {
          const d = docSnap.data() || {};
          const keys = [
            docSnap.id,
            d.id,
            d.registrationNo,
            d.regNo,
            d.admissionNo,
            d.admNo,
            d.appNumber,
            d.appRefNo,
            d.studentId,
            d.applicationNo,
            d.rollNo,
          ].filter(Boolean).map(k => String(k).trim().toLowerCase());

          if (keys.some(k => targetIdSet.has(k))) {
            keys.forEach(k => targetIdSet.add(k));
          }
        });
      } catch (e) {
        console.warn(`[transferStudentsBranch] Error during identifier pre-expansion in ${colName}:`, e);
      }
    }
  }

  // 0. Resolve target franchisee ID and Name for destination branch
  let targetFranId = `FR-${toBranch.toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
  let targetFranName = `${toBranch} Center`;
  try {
    let fList = [];
    if (typeof localStorage !== 'undefined') {
      const rawF = localStorage.getItem('sle_franchisees_cache');
      if (rawF) fList = JSON.parse(rawF);
    }
    if ((!fList || fList.length === 0) && db) {
      const fSnap = await getDocs(collection(db, 'franchisees'));
      fList = fSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    const toNorm = normalizeBranchName(toBranch);
    const matchedFran = fList.find(f => {
      const locNorm = normalizeBranchName(f.location || f.trustBranch || '');
      const nameNorm = normalizeBranchName(f.franchiseName || f.centerName || '');
      const fId = String(f.id || '').toUpperCase();
      return locNorm === toNorm || 
             (locNorm && locNorm.includes(toNorm)) ||
             nameNorm === toNorm ||
             (nameNorm && nameNorm.includes(toNorm)) ||
             fId.includes(toNorm.toUpperCase()) ||
             (toNorm === 'shahapur' && (f.id === 'FR-SHAHAPUR' || f.environmentId === 'FR-SHAHAPUR'));
    });
    if (matchedFran) {
      targetFranId = matchedFran.id || matchedFran.environmentId || targetFranId;
      targetFranName = matchedFran.franchiseName || matchedFran.environmentName || matchedFran.centerName || targetFranName;
    }
  } catch (e) {
    console.warn('Error resolving destination franchisee:', e);
  }

  const buildUpdate = (data) => {
    const updates = {
      transferredAt: new Date().toISOString(),
      transferredFrom: fromBranch,
      transferredTo: toBranch,
      trustBranch: toBranch,
      branchName: toBranch,
      place: toBranch,
      location: toBranch,
      city: toBranch,
      trainingCenter: toBranch,
      franchiseeId: targetFranId,
      environmentId: targetFranId,
      franchiseName: targetFranName,
      environmentName: targetFranName,
      center: toBranch,
      centerName: targetFranName,
    };
    STUDENT_BRANCH_FIELDS.forEach(f => {
      if (data[f] && typeof data[f] === 'string' && isBranchMatch(data[f], fromBranch)) {
        updates[f] = toBranch;
      }
    });
    return updates;
  };

  const isTargetStudent = (docId, data = {}) => {
    if (isTransferAll) return true; // Transfer ALL
    const keys = [
      docId,
      data.id,
      data.registrationNo,
      data.regNo,
      data.admissionNo,
      data.admNo,
      data.appNumber,
      data.appRefNo,
      data.studentId,
      data.applicationNo,
      data.rollNo,
    ].filter(Boolean).map(k => String(k).trim().toLowerCase());

    return keys.some(k => targetIdSet.has(k));
  };

  const shouldTransfer = (data = {}) => {
    // If specific students were selected and matched, transfer them unconditionally
    if (!isTransferAll) return true;
    // If transferring ALL students, verify that this record belongs to fromBranch
    return STUDENT_BRANCH_FIELDS.some(f => {
      if (!data[f] || typeof data[f] !== 'string') return false;
      return isBranchMatch(data[f], fromBranch);
    });
  };

  const transferredStudentsSet = new Set();
  let transferredDocs = 0;

  // 1. Update Firestore collections
  if (db) {
    for (const colName of collections) {
      try {
        const snap = await getDocs(collection(db, colName));
        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          if (!data) continue;
          if (!isTargetStudent(docSnap.id, data)) continue;
          if (!shouldTransfer(data)) continue;

          try {
            const updates = buildUpdate(data);
            await setDoc(doc(db, colName, docSnap.id), updates, { merge: true });
            const name = data.fullName || data.studentName || data.candidateName || data.name || docSnap.id;
            const reg = data.registrationNo || data.regNo || data.admissionNo || docSnap.id;
            const canonical = (reg || docSnap.id).trim().toLowerCase();
            transferredStudentsSet.add(canonical);
            transferredDocs++;
            log.push(`Transferred: ${name} (${reg}) in [${colName}/${docSnap.id}]`);
          } catch (uErr) {
            const errMsg = `Error updating ${docSnap.id} in ${colName}: ${uErr?.message || 'update failed'}`;
            errors.push(errMsg);
            log.push(errMsg);
          }
        }
      } catch (colErr) {
        const errMsg = `Failed to scan collection "${colName}": ${colErr?.message || 'unknown error'}`;
        errors.push(errMsg);
        log.push(errMsg);
      }
    }
  }

  // 2. Update localStorage caches
  for (const key of STUDENT_CACHE_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      let parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      let changed = false;

      parsed = parsed.map(item => {
        if (!item || typeof item !== 'object') return item;
        const itemId = item.id || item.registrationNo || item.admissionNo || item.admNo || item.appNumber;
        if (!isTargetStudent(itemId, item)) return item;
        if (!shouldTransfer(item)) return item;
        const updates = buildUpdate(item);
        changed = true;
        const reg = item.registrationNo || item.regNo || item.admissionNo || itemId;
        transferredStudentsSet.add(String(reg).trim().toLowerCase());
        return { ...item, ...updates };
      });

      if (changed) {
        localStorage.setItem(key, JSON.stringify(parsed));
        log.push(`Updated localStorage cache: ${key}`);
      }
    } catch (e) {
      const errMsg = `Failed to update localStorage key "${key}": ${e?.message}`;
      errors.push(errMsg);
      log.push(errMsg);
    }
  }

  // 3. Update localStorage registered certificates map
  try {
    const rawCert = localStorage.getItem('sle_registered_certificates');
    if (rawCert) {
      let certMap = JSON.parse(rawCert);
      if (certMap && typeof certMap === 'object' && !Array.isArray(certMap)) {
        let certModified = false;
        Object.keys(certMap).forEach(k => {
          const certItem = certMap[k];
          if (!certItem || typeof certItem !== 'object') return;
          if (isTargetStudent(k, certItem) && shouldTransfer(certItem)) {
            const updates = buildUpdate(certItem);
            certMap[k] = { ...certItem, ...updates };
            certModified = true;
          }
        });
        if (certModified) {
          localStorage.setItem('sle_registered_certificates', JSON.stringify(certMap));
          log.push('Updated localStorage cache: sle_registered_certificates');
        }
      }
    }
  } catch (e) {
    console.warn('Error updating sle_registered_certificates cache:', e);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('storage'));
  }

  const finalTransferredCount = transferredStudentsSet.size > 0 ? transferredStudentsSet.size : transferredDocs;

  return {
    success: errors.length === 0 || finalTransferredCount > 0,
    transferred: finalTransferredCount,
    errors,
    log,
  };
}
