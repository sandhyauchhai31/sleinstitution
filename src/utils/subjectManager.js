import { db, collection, doc, setDoc, deleteDoc, getDocs } from '../firebase';
import { getQuestionPaperSubjectMarks } from './questionPaperManager';

// Standard Course Curriculums (Empty by default - no dummy data)
export const DEFAULT_COURSE_SUBJECTS = {};

const LOCAL_STORAGE_KEY = 'sle_course_subjects_clean_v4';
const SUBJECT_EVENT_NAME = 'sle_course_subjects_updated';

// Known legacy dummy subject names list to filter out permanently
export const LEGACY_DUMMY_SUBJECTS = new Set([
  'Knowing Computer & Basics',
  'Word Processing & Spreadsheets',
  'Internet, WWW & Web Browsers',
  'Digital Financial Services',
  'FCC (Fundamentals of Computer Concepts)',
  'Windows Operating System',
  'M. S. Office (Word, Excel, PowerPoint)',
  'C, C++ Programming',
  'VB, HTML & Web Design',
  'Tally ERP9, Nudi & Internet Concepts',
  'Computer Fundamentals & OS',
  'Teaching Methodology & Pedagogy',
  'MS Office & Digital Tools',
  'Desktop Publishing (DTP)',
  'Practical & Teaching Demonstration',
  'Computer Basics & Windows OS',
  'MS Word & Document Automation',
  'MS Excel & Data Analytics',
  'Internet & Email Communication',
  'Financial Accounting Concepts',
  'Tally Prime with GST',
  'Inventory & Payroll Management',
  'Taxation & E-Filing',
  'Fundamentals of Accounting',
  'Tally Core Features & Ledger Setup',
  'GST & Invoice Generation',
  'Banking & Financial Reports',
  'Accounting Principles & Bookkeeping',
  'Tally Prime Navigation & Master Setup',
  'GST / TDS / TCS Statutory Features',
  'Final Accounts & MIS Reporting',
  'Information Technology Fundamentals',
  'Operating System & GUI Operations',
  'Office Automation Package',
  'Database Management Basics',
  'Java',
  'DBMS',
  'Networking',
  'Python',
  'General'
]);

export const isDummySubject = (s) => {
  if (!s || !s.name) return true;
  const trimmed = s.name.trim();
  if (LEGACY_DUMMY_SUBJECTS.has(trimmed)) return true;
  if (trimmed.includes('Module 1') || trimmed.includes('Module 2') || trimmed.includes('Module 3') || trimmed.includes('Practical Lab & Project')) {
    return true;
  }
  return false;
};

// Immediate cleanup of old legacy storage keys on module import
try {
  localStorage.removeItem('sle_course_subjects_cache');
  localStorage.removeItem('sle_course_subjects_v2');
  localStorage.removeItem('sle_course_subjects_clean_v3');
} catch (e) {}

// Helper to normalize course key
export const getCourseKey = (courseName) => {
  if (!courseName) return 'default';
  return courseName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
};

/**
 * Filter out dummy subjects from a subject list
 */
export const sanitizeSubjectList = (list, courseName = '') => {
  if (!Array.isArray(list)) return [];
  return list.filter(s => !isDummySubject(s)).map((s, idx) => {
    let extMaxVal = s.extMax !== undefined && s.extMax !== '' ? Number(s.extMax) : 60;
    if (courseName && s.name) {
      try {
        const qpMarks = getQuestionPaperSubjectMarks(courseName, s.name);
        if (qpMarks !== null && qpMarks > 0) {
          extMaxVal = qpMarks;
        }
      } catch (_) {}
    }
    return {
      id: s.id || `subj_${idx + 1}_${Date.now()}`,
      name: (s.name || '').trim(),
      intMax: s.intMax !== undefined && s.intMax !== '' ? Number(s.intMax) : 40,
      extMax: extMaxVal,
      minMarks: s.minMarks !== undefined && s.minMarks !== '' ? Number(s.minMarks) : 35,
      order: idx + 1
    };
  });
};

/**
 * Get all course subjects map from localStorage or defaults
 */
export const getAllStoredCourseSubjects = () => {
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object') {
        const cleaned = {};
        Object.keys(parsed).forEach(course => {
          const valid = sanitizeSubjectList(parsed[course], course);
          if (valid.length > 0) {
            cleaned[course] = valid;
          }
        });
        return cleaned;
      }
    }
  } catch (e) {
    console.warn('Error reading course subjects from localStorage:', e);
  }
  return {};
};

/**
 * Get subjects array for a specific course
 */
export const getStoredSubjectsForCourse = (courseName) => {
  if (!courseName) return [];
  const allMap = getAllStoredCourseSubjects();
  
  // 1. Exact match
  if (allMap[courseName] && Array.isArray(allMap[courseName])) {
    return sanitizeSubjectList(allMap[courseName], courseName);
  }

  // 2. Case-insensitive key match
  const lower = courseName.toLowerCase().trim();
  const matchedKey = Object.keys(allMap).find(k => k.toLowerCase().trim() === lower);
  if (matchedKey && Array.isArray(allMap[matchedKey])) {
    return sanitizeSubjectList(allMap[matchedKey], courseName);
  }

  // 3. Smart substring & alias matching (e.g. "GST" matching "Goods and Services Tax", "Tally with GST", etc.)
  const cleanTarget = lower.replace(/[^a-z0-9]/g, '');
  const fuzzyKey = Object.keys(allMap).find(k => {
    const kLower = k.toLowerCase().trim();
    if (kLower.includes(lower) || lower.includes(kLower)) return true;
    const cleanK = kLower.replace(/[^a-z0-9]/g, '');
    if (cleanK.includes(cleanTarget) || cleanTarget.includes(cleanK)) return true;
    if (lower === 'gst' && (kLower.includes('gst') || kLower.includes('goods') || kLower.includes('tax'))) return true;
    if (lower === 'pgdca' && (kLower.includes('pgdca') || kLower.includes('post graduate'))) return true;
    if (lower === 'dca' && (kLower.includes('dca') || kLower.includes('diploma in computer'))) return true;
    return false;
  });

  if (fuzzyKey && Array.isArray(allMap[fuzzyKey])) {
    return sanitizeSubjectList(allMap[fuzzyKey], courseName);
  }

  return [];
};

/**
 * Save all subjects map to local storage and broadcast event
 */
export const saveAllStoredCourseSubjects = (allMap) => {
  try {
    const cleaned = {};
    if (allMap && typeof allMap === 'object') {
      Object.keys(allMap).forEach(course => {
        const valid = sanitizeSubjectList(allMap[course]);
        if (valid.length > 0) {
          cleaned[course] = valid;
        }
      });
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleaned));
    window.dispatchEvent(new CustomEvent(SUBJECT_EVENT_NAME, { detail: cleaned }));
  } catch (e) {
    console.error('Error saving course subjects to localStorage:', e);
  }
};

/**
 * Save subjects array for a specific course to localStorage and Firestore
 */
export const saveCourseSubjects = async (courseName, subjectsList) => {
  if (!courseName) {
    return { success: false, error: 'Course name is required.' };
  }

  const allMap = getAllStoredCourseSubjects();
  const normalizedSubjects = (subjectsList || []).map((s, idx) => ({
    id: s.id || `subj_${idx + 1}_${Date.now()}`,
    name: (s.name || `Subject ${idx + 1}`).trim(),
    intMax: s.intMax !== undefined && s.intMax !== '' ? Number(s.intMax) : 40,
    extMax: s.extMax !== undefined && s.extMax !== '' ? Number(s.extMax) : 60,
    minMarks: s.minMarks !== undefined && s.minMarks !== '' ? Number(s.minMarks) : 35,
    order: idx + 1
  }));

  const docId = getCourseKey(courseName);

  if (normalizedSubjects.length === 0) {
    delete allMap[courseName];
    saveAllStoredCourseSubjects(allMap);

    if (db) {
      try {
        await deleteDoc(doc(db, 'course_subjects', docId));
      } catch (err) {
        console.warn('Firestore course subjects delete notice:', err);
      }
    }
    return { success: true, subjects: [] };
  }

  allMap[courseName] = normalizedSubjects;
  saveAllStoredCourseSubjects(allMap);

  // Sync to Firestore
  if (db) {
    try {
      await setDoc(doc(db, 'course_subjects', docId), {
        courseName: courseName,
        courseKey: docId,
        subjects: normalizedSubjects,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (err) {
      console.warn('Firestore course subjects save notice:', err);
    }
  }

  return { success: true, subjects: normalizedSubjects };
};

/**
 * Clear/delete subjects for a specific course
 */
export const deleteCourseSubjects = async (courseName) => {
  return await saveCourseSubjects(courseName, []);
};

let subjectsFetchPromise = null;

/**
 * Fetch latest course subjects from Firestore once and update local cache
 */
export const refreshCourseSubjects = async (callback) => {
  if (!db) return getAllStoredCourseSubjects();
  try {
    const snapshot = await getDocs(collection(db, 'course_subjects'));
    if (!snapshot.empty) {
      const currentMap = getAllStoredCourseSubjects();
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data && data.courseName && Array.isArray(data.subjects)) {
          const cleaned = sanitizeSubjectList(data.subjects);
          if (cleaned.length > 0) {
            currentMap[data.courseName] = cleaned;
          } else {
            delete currentMap[data.courseName];
            try {
              deleteDoc(doc(db, 'course_subjects', docSnap.id));
            } catch (e) {}
          }
        }
      });
      saveAllStoredCourseSubjects(currentMap);
      if (callback) callback(currentMap);
      return currentMap;
    }
  } catch (err) {
    console.warn('Firestore subjects fetch warning:', err?.message);
  }
  return getAllStoredCourseSubjects();
};

/**
 * Subscribe to all course subjects with LocalStorage cache + one-time Firestore fetch
 */
export const subscribeToCourseSubjects = (callback) => {
  const initial = getAllStoredCourseSubjects();
  callback(initial);

  const handleLocalUpdate = (event) => {
    if (event.detail && typeof event.detail === 'object') {
      callback(event.detail);
    }
  };
  window.addEventListener(SUBJECT_EVENT_NAME, handleLocalUpdate);

  // Perform single fetch on startup if db is available
  if (db) {
    if (!subjectsFetchPromise) {
      subjectsFetchPromise = refreshCourseSubjects(callback);
    } else {
      subjectsFetchPromise.then(res => {
        if (res && typeof res === 'object') callback(res);
      });
    }
  }

  return () => {
    window.removeEventListener(SUBJECT_EVENT_NAME, handleLocalUpdate);
  };
};
