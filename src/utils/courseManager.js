import { db, collection, doc, setDoc, deleteDoc, getDocs } from '../firebase';

// 20 Core Default Courses Preserved Exactly As Is
export const DEFAULT_COURSES = [
  'DCTTC',
  'PGDCA',
  'PGDFA',
  'DOA',
  'DAP',
  'BCC',
  'PGDIT',
  'ADIT',
  'ADFA',
  'ADCA PRO',
  'DTP',
  'DCA',
  'ERPQ',
  'C',
  'C++',
  'C, C++ Programming',
  'DISM',
  'Tally',
  'TALLY PRIME with GST',
  'GST',
  'DCAAC'
];

const LOCAL_STORAGE_KEY = 'sle_courses_cache';
const DELETED_DEFAULT_KEY = 'sle_deleted_default_courses';
const COURSE_EVENT_NAME = 'sle_courses_updated';

// Helper to normalize course name (Trimmed)
export const formatCourseName = (str) => {
  if (!str) return '';
  return str.trim();
};

export const COURSE_FULL_NAMES = {
  'DCTTC': 'Diploma in Computer Teacher Training Course',
  'PGDCA': 'Post Graduate Diploma in Computer Applications',
  'PGDFA': 'Post Graduate Diploma in Financial Accounting',
  'DOA': 'Diploma in Office Automation',
  'DAP': 'Diploma in Accounting & Taxation',
  'BCC': 'Basic Computer Course',
  'PGDIT': 'Post Graduate Diploma in Information Technology',
  'ADIT': 'Advanced Diploma in Information Technology',
  'ADFA': 'Advanced Diploma in Financial Accounting',
  'ADCA': 'Advanced Diploma in Computer Applications',
  'ADCA PRO': 'Advanced Diploma in Computer Applications',
  'ADCA 2.0': 'Advanced Diploma in Computer Applications',
  'DTP': 'Diploma in Desktop Publishing',
  'DCA': 'Diploma in Computer Applications',
  'ERPQ': 'Enterprise Resource Planning',
  'SAP FICO': 'Financial Accounting & Controlling',
  'C': 'C Programming Language',
  'C++': 'C++ Programming Language',
  'C, C++': 'C, C++ Programming Languages',
  'C, C++ Programming': 'C, C++ Programming Languages',
  'DISM': 'Diploma in Information Systems Management',
  'Tally': 'Tally Financial Accounting',
  'Tally ERP9': 'Tally ERP 9 Accounting',
  'TALLY PRIME with GST': 'TALLY PRIME with GST Professional',
  'GST': 'Goods & Services Tax',
  'DCAAC': 'Diploma in Computer Applications & Accounting'
};

export const getCourseDisplayLabel = (c) => {
  if (!c) return '';
  let name = typeof c === 'object' ? (c.name || '') : String(c).trim();
  let title = typeof c === 'object' ? (c.title || '') : '';
  
  if (title && title.trim() && title.trim() !== name) {
    return title.trim();
  }
  const fullName = COURSE_FULL_NAMES[name] || COURSE_FULL_NAMES[name.trim()];
  if (fullName) {
    return `${name} — ${fullName}`;
  }
  return name;
};

export const getCourseFullName = (str) => {
  if (!str) return '';
  let trimmed = String(str).trim();

  // Specific handling for GST: "GST (Goods & Services Tax)", "GST (GOODS & SERVICES TAX)", "GST"
  if (/^GST\s*\((.+)\)$/i.test(trimmed)) {
    const m = trimmed.match(/^GST\s*\((.+)\)$/i);
    if (m && m[1]) return m[1].trim();
  }
  if (/^GST$/i.test(trimmed)) {
    return 'Goods & Services Tax';
  }
  if (/^GST\s*[-—]\s*(.+)$/i.test(trimmed)) {
    const m = trimmed.match(/^GST\s*[-—]\s*(.+)$/i);
    if (m && m[1]) return m[1].trim();
  }

  // Generic pattern: "CODE (Full Form)" e.g. "DCA (Diploma in Computer Applications)"
  const parenMatch = trimmed.match(/^([A-Za-z0-9+,\.\s]+?)\s*\((.+)\)$/);
  if (parenMatch && parenMatch[2]) {
    return parenMatch[2].trim();
  }

  if (COURSE_FULL_NAMES[trimmed]) {
    return COURSE_FULL_NAMES[trimmed];
  }
  if (trimmed.includes('—')) {
    const parts = trimmed.split('—');
    return parts[parts.length - 1].trim();
  }
  if (trimmed.includes(' - ') && trimmed.length > 12) {
    const parts = trimmed.split(' - ');
    return parts[parts.length - 1].trim();
  }

  // Case-insensitive match in COURSE_FULL_NAMES
  const upper = trimmed.toUpperCase();
  for (const [code, full] of Object.entries(COURSE_FULL_NAMES)) {
    if (code.toUpperCase() === upper) {
      return full;
    }
  }

  return trimmed;
};

export const getCourseShortName = (str) => {
  if (!str) return '';
  let trimmed = String(str).trim();

  // Specific handling for GST: "GST", "GST (Goods & Services Tax)", "GST (GOODS & SERVICES TAX)", etc.
  if (/^GST\b/i.test(trimmed)) {
    return 'GST';
  }

  // Generic pattern: "CODE (Full Form)"
  const parenMatch = trimmed.match(/^([A-Za-z0-9+,\.\s]+?)\s*\((.+)\)$/);
  if (parenMatch) {
    const candidateCode = parenMatch[1].trim();
    if (COURSE_FULL_NAMES[candidateCode] || candidateCode.length <= 15) {
      return candidateCode;
    }
  }

  if (trimmed.includes('—')) {
    const parts = trimmed.split('—');
    return parts[0].trim();
  }
  if (trimmed.includes(' - ') && trimmed.length > 8) {
    const parts = trimmed.split(' - ');
    if (parts[0].length <= 15) return parts[0].trim();
  }
  // If it's already one of the known short codes
  if (COURSE_FULL_NAMES[trimmed]) {
    return trimmed;
  }
  // Reverse lookup: if trimmed matches full name
  const lower = trimmed.toLowerCase();
  for (const [code, full] of Object.entries(COURSE_FULL_NAMES)) {
    if (full.toLowerCase() === lower) {
      return code;
    }
  }

  // Case-insensitive match in COURSE_FULL_NAMES
  const upper = trimmed.toUpperCase();
  for (const code of Object.keys(COURSE_FULL_NAMES)) {
    if (code.toUpperCase() === upper) {
      return code;
    }
  }

  return trimmed;
};

export const computeOneYearEndDate = (startDateStr, extraDays = 3) => {
  if (!startDateStr) return '';
  const trimmed = String(startDateStr).trim();
  try {
    const parts = trimmed.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        const dateObj = new Date(y + 1, m, d + extraDays);
        const resY = dateObj.getFullYear();
        const resM = String(dateObj.getMonth() + 1).padStart(2, '0');
        const resD = String(dateObj.getDate()).padStart(2, '0');
        return `${resY}-${resM}-${resD}`;
      }
    }
    const d = new Date(startDateStr);
    if (!isNaN(d.getTime())) {
      d.setFullYear(d.getFullYear() + 1);
      d.setDate(d.getDate() + extraDays);
      return d.toISOString().split('T')[0];
    }
  } catch (err) {}
  return '';
};

export const computeOneMonthAfterDate = (dateStr) => {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  try {
    const parts = trimmed.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        const dateObj = new Date(y, m + 1, d);
        const resY = dateObj.getFullYear();
        const resM = String(dateObj.getMonth() + 1).padStart(2, '0');
        const resD = String(dateObj.getDate()).padStart(2, '0');
        return `${resY}-${resM}-${resD}`;
      }
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      d.setMonth(d.getMonth() + 1);
      return d.toISOString().split('T')[0];
    }
  } catch (err) {}
  return '';
};

// Generate deterministic ID from course name
export const getCourseDocId = (name) => {
  return 'course_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_');
};

/**
 * Retrieve cached courses from localStorage or default list
 */
export const getStoredCourses = () => {
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(c => ({
          ...c,
          title: c.title && c.title !== c.name ? c.title : getCourseDisplayLabel(c.name)
        }));
      }
    }
  } catch (e) {
    console.warn('Error reading courses from localStorage:', e);
  }

  // Fallback to default list formatted as course objects
  return DEFAULT_COURSES.map((name, index) => ({
    id: getCourseDocId(name),
    name: name,
    title: getCourseDisplayLabel(name),
    isDefault: true,
    order: index + 1,
    createdAt: Date.now()
  }));
};

/**
 * Save courses to localStorage and dispatch update event across tabs/components
 */
export const saveStoredCourses = (courses) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(courses));
    window.dispatchEvent(new CustomEvent(COURSE_EVENT_NAME, { detail: courses }));
  } catch (e) {
    console.error('Error saving courses to localStorage:', e);
  }
};

let coursesFetchPromise = null;

/**
 * Fetch latest courses from Firestore once and update local cache
 */
export const refreshCourses = async (callback) => {
  if (!db) return getStoredCourses();
  try {
    const snapshot = await getDocs(collection(db, 'courses'));
    if (snapshot.empty) {
      DEFAULT_COURSES.forEach(async (cName, idx) => {
        try {
          const docId = getCourseDocId(cName);
          await setDoc(doc(db, 'courses', docId), {
            id: docId,
            name: cName,
            isDefault: true,
            order: idx + 1,
            createdAt: Date.now()
          }, { merge: true });
        } catch (err) {}
      });
    } else {
      const firestoreCourses = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      firestoreCourses.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        return (a.name || '').localeCompare(b.name || '');
      });

      saveStoredCourses(firestoreCourses);
      if (callback) callback(firestoreCourses);
      return firestoreCourses;
    }
  } catch (error) {
    console.warn('Firestore courses fetch warning:', error?.message);
  }
  return getStoredCourses();
};

/**
 * Subscribe to courses updates with LocalStorage cache + one-time Firestore fetch
 */
export const subscribeToCourses = (callback) => {
  // Immediately call with current local cached courses
  const initial = getStoredCourses();
  callback(initial);

  // Listen for local custom events (for immediate UI updates across components)
  const handleLocalUpdate = (event) => {
    if (event.detail && Array.isArray(event.detail)) {
      callback(event.detail);
    }
  };
  window.addEventListener(COURSE_EVENT_NAME, handleLocalUpdate);

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
    if (!coursesFetchPromise) {
      coursesFetchPromise = refreshCourses(callback);
    } else {
      coursesFetchPromise.then(res => {
        if (Array.isArray(res) && res.length > 0) callback(res);
      });
    }
  }

  return () => {
    window.removeEventListener(COURSE_EVENT_NAME, handleLocalUpdate);
    window.removeEventListener('storage', handleStorageEvent);
  };
};

/**
 * Add a new dynamic course card
 */
export const addCourse = async (courseDataOrName) => {
  const isObj = typeof courseDataOrName === 'object' && courseDataOrName !== null;
  const rawName = isObj ? (courseDataOrName.name || courseDataOrName.title) : courseDataOrName;
  const trimmed = rawName ? String(rawName).trim() : '';

  if (!trimmed) {
    return { success: false, error: 'Course name/title cannot be empty.' };
  }

  const currentCourses = getStoredCourses();
  const lowerName = trimmed.toLowerCase();

  // Check for duplicate course name (case-insensitive)
  const isDuplicate = currentCourses.some(c => (c.name || '').toLowerCase() === lowerName);
  if (isDuplicate) {
    return { success: false, error: `Course "${trimmed}" already exists.` };
  }

  const docId = getCourseDocId(trimmed);
  const isDefault = DEFAULT_COURSES.some(d => (typeof d === 'string' ? d : d.name).toLowerCase() === lowerName);

  const newCourse = {
    id: docId,
    name: trimmed,
    title: isObj && courseDataOrName.title ? courseDataOrName.title.trim() : trimmed,
    badge: isObj && courseDataOrName.badge ? courseDataOrName.badge.trim() : 'Professional',
    category: isObj && courseDataOrName.category ? courseDataOrName.category.trim() : 'Diploma',
    duration: isObj && courseDataOrName.duration ? courseDataOrName.duration.trim() : '6 Months',
    description: isObj && courseDataOrName.description ? courseDataOrName.description.trim() : `${trimmed} course covering practical skills, industry projects, and government recognized certification.`,
    image: isObj && courseDataOrName.image ? courseDataOrName.image.trim() : 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=600',
    isDefault: isDefault,
    order: currentCourses.length + 1,
    createdAt: Date.now()
  };

  const updatedCourses = [...currentCourses, newCourse];

  // Update local cache immediately
  saveStoredCourses(updatedCourses);

  // Update Firestore if online
  try {
    if (db) {
      await setDoc(doc(db, 'courses', docId), newCourse, { merge: true });
    }
  } catch (err) {
    console.warn('Firestore course add notice:', err);
  }

  return { success: true, course: newCourse };
};

/**
 * Update / Edit an existing course card
 */
export const updateCourse = async (courseId, newCourseDataOrName) => {
  const isObj = typeof newCourseDataOrName === 'object' && newCourseDataOrName !== null;
  const rawName = isObj ? (newCourseDataOrName.name || newCourseDataOrName.title) : newCourseDataOrName;
  const trimmed = rawName ? String(rawName).trim() : '';

  const currentCourses = getStoredCourses();
  const targetIndex = currentCourses.findIndex(c => c.id === courseId || (c.name && c.name.toLowerCase() === String(courseId).toLowerCase()));

  if (targetIndex === -1) {
    return { success: false, error: 'Course not found.' };
  }

  const target = currentCourses[targetIndex];
  const finalName = trimmed || target.name;
  const lowerNew = finalName.toLowerCase();

  // Check if another course already has this name
  const isDuplicate = currentCourses.some((c, idx) => idx !== targetIndex && (c.name || '').toLowerCase() === lowerNew);
  if (isDuplicate) {
    return { success: false, error: `Another course with name "${finalName}" already exists.` };
  }

  const oldDocId = target.id;
  const updatedCourse = {
    ...target,
    ...(isObj ? newCourseDataOrName : { name: finalName }),
    name: finalName,
    updatedAt: Date.now()
  };

  const updatedCourses = [...currentCourses];
  updatedCourses[targetIndex] = updatedCourse;

  // Update local cache
  saveStoredCourses(updatedCourses);

  // Update Firestore
  try {
    if (db) {
      await setDoc(doc(db, 'courses', oldDocId), updatedCourse, { merge: true });
    }
  } catch (err) {
    console.warn('Firestore course update notice:', err);
  }

  return { success: true, course: updatedCourse };
};

/**
 * Delete a course by ID or Name
 */
export const deleteCourse = async (courseIdOrName) => {
  if (!courseIdOrName) {
    return { success: false, error: 'Invalid course identifier.' };
  }

  const currentCourses = getStoredCourses();
  const target = currentCourses.find(
    c => c.id === courseIdOrName || c.name.toLowerCase() === String(courseIdOrName).toLowerCase()
  );

  if (!target) {
    return { success: false, error: 'Course not found.' };
  }

  const updatedCourses = currentCourses.filter(c => c.id !== target.id && c.name.toLowerCase() !== target.name.toLowerCase());
  
  // Save locally
  saveStoredCourses(updatedCourses);

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
      await deleteDoc(doc(db, 'courses', target.id));
    }
  } catch (err) {
    console.warn('Firestore course delete notice:', err);
  }

  return { success: true, deletedCourse: target };
};

/**
 * Reset all courses back to the original default 20 courses
 */
export const resetCoursesToDefault = async () => {
  localStorage.removeItem(DELETED_DEFAULT_KEY);

  const defaultList = DEFAULT_COURSES.map((name, index) => ({
    id: getCourseDocId(name),
    name: name,
    title: getCourseDisplayLabel(name),
    isDefault: true,
    order: index + 1,
    createdAt: Date.now()
  }));

  saveStoredCourses(defaultList);

  if (db) {
    try {
      // Clear current collection and re-seed defaults
      const snapshot = await getDocs(collection(db, 'courses'));
      for (const d of snapshot.docs) {
        await deleteDoc(d.ref);
      }
      for (const c of defaultList) {
        await setDoc(doc(db, 'courses', c.id), c);
      }
    } catch (err) {
      console.warn('Reset courses Firestore error:', err);
    }
  }

  return { success: true, courses: defaultList };
};
