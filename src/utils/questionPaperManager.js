import { db, collection, doc, setDoc, deleteDoc, getDocs, getDoc, updateDoc } from '../firebase';
import { getStoredSubjectsForCourse } from './subjectManager';

const LOCAL_STORAGE_KEY = 'sle_composite_exams_cache';
const EXAM_EVENT_NAME = 'sle_composite_exams_updated';

// Generate deterministic document ID for Year & Course
export const getExamDocId = (year, courseName) => {
  const yKey = (String(year) || '2026').trim().replace(/[^0-9a-zA-Z]/g, '');
  const cKey = (courseName || 'default_course').trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `exam_${yKey}_${cKey}`;
};

/**
 * Generate blank question slots for a specific subject (2 Marks each)
 */
export const generateQuestionsForSubject = (subjectName, count = 25, startingQNo = 1, defaultMarks = 2) => {
  const questions = [];
  for (let i = 0; i < count; i++) {
    const qNo = startingQNo + i;
    questions.push({
      id: `q_${subjectName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${qNo}_${Date.now()}_${i}`,
      qNo: qNo,
      subjectId: subjectName,
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 'A',
      marks: defaultMarks,
      negativeMarks: 0
    });
  }
  return questions;
};

/**
 * Generate a composite question paper template distributed across subjects
 */
export const generateCompositeTemplate = (year = '2026', courseName = 'BCA', subjects = []) => {
  const docId = getExamDocId(year, courseName);
  const subjectList = Array.isArray(subjects) ? subjects.filter(s => s && s.trim()) : [];

  if (subjectList.length === 0) {
    return {
      id: docId,
      year: String(year),
      course: courseName,
      courseName: courseName,
      examTitle: `${year} - ${courseName} Examination`,
      duration: 120,
      durationMinutes: 120,
      totalQuestions: 0,
      totalMarks: 0,
      passingPercentage: 40,
      subjectDistribution: {},
      instructions: '1. All questions are compulsory.\n2. Read each question carefully and select the single correct option.\n3. Subject-wise performance will be evaluated.',
      questions: [],
      status: 'inactive',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  const perSubjectCount = Math.floor(100 / subjectList.length) || 25;
  const questions = [];
  const subjectDistribution = {};

  let currentQNo = 1;
  subjectList.forEach((subj, idx) => {
    // For the last subject, allocate remaining questions to ensure exact 100 total
    const count = (idx === subjectList.length - 1) 
      ? (100 - questions.length) 
      : perSubjectCount;
    
    subjectDistribution[subj] = count;
    const subjQuestions = generateQuestionsForSubject(subj, count, currentQNo, 2);
    questions.push(...subjQuestions);
    currentQNo += count;
  });

  return {
    id: docId,
    year: String(year),
    course: courseName,
    courseName: courseName,
    examTitle: `${year} - ${courseName} Composite Examination`,
    duration: 120, // in minutes (2 hours)
    durationMinutes: 120,
    totalQuestions: questions.length,
    totalMarks: questions.reduce((acc, q) => acc + (q.marks || 2), 0), // 200 Marks
    passingPercentage: 40,
    subjectDistribution,
    instructions: '1. All 100 questions are compulsory.\n2. Each question carries 2 marks (Total: 200 Marks).\n3. Read each question carefully and select the single correct option.\n4. Subject-wise performance will be evaluated.',
    questions,
    status: 'inactive',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
};

/**
 * Retrieve all cached composite exams map
 */
export const getAllStoredExams = () => {
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading composite exams from localStorage:', e);
  }
  return {};
};

/**
 * Retrieve all saved composite exams as an array
 */
export const getAllStoredExamsList = () => {
  const map = getAllStoredExams();
  return Object.values(map || {});
};

/**
 * Get or initialize a composite exam for Year & Course
 */
export const getStoredExam = (year = '2026', courseName = 'BCA', subjects = []) => {
  if (!year || !courseName) return null;
  const all = getAllStoredExams();
  const docId = getExamDocId(year, courseName);

  if (all[docId]) {
    return all[docId];
  }

  // Generate a clean default template based only on actual configured subjects
  return generateCompositeTemplate(year, courseName, subjects);
};

/**
 * Fetch a single exam by ID (for student exam link)
 * Performs 1 Firestore read and caches locally
 */
export const getExamById = async (examId) => {
  if (!examId) return null;
  
  // Check local cache first
  const all = getAllStoredExams();
  if (all[examId]) {
    return all[examId];
  }

  // Fetch from Firestore
  if (db) {
    try {
      const docSnap = await getDoc(doc(db, 'exams', examId));
      if (docSnap.exists()) {
        const data = docSnap.data();
        all[examId] = data;
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
        } catch (e) {}
        return data;
      }
    } catch (err) {
      console.warn('Error fetching exam from Firestore:', err);
    }
  }

  return null;
};

/**
 * Save Composite Question Paper to LocalStorage and Firestore
 * (Zero intermediate writes; writes once when admin clicks Create/Save)
 */
export const saveCompositeExam = async (examData) => {
  if (!examData || !examData.year || !examData.course) {
    return { success: false, error: 'Year and Course name are required.' };
  }

  const docId = examData.id || getExamDocId(examData.year, examData.course);

  // Normalize questions & recalculate subject distribution
  const subjectDistribution = {};
  const normalizedQuestions = (examData.questions || []).map((q, idx) => {
    const subj = (q.subjectId || 'General').trim();
    subjectDistribution[subj] = (subjectDistribution[subj] || 0) + 1;

    return {
      id: q.id || `q_${idx + 1}_${Date.now()}`,
      qNo: idx + 1,
      subjectId: subj,
      question: (q.question || '').trim(),
      options: Array.isArray(q.options) && q.options.length >= 4 
        ? [(q.options[0] || '').trim(), (q.options[1] || '').trim(), (q.options[2] || '').trim(), (q.options[3] || '').trim()]
        : ['', '', '', ''],
      correctAnswer: q.correctAnswer || 'A',
      marks: Number(q.marks) || 2,
      negativeMarks: Number(q.negativeMarks) || 0
    };
  });

  const totalQuestions = normalizedQuestions.length;
  const totalMarks = normalizedQuestions.reduce((acc, q) => acc + (Number(q.marks) || 2), 0);

  const examRecord = {
    ...examData,
    id: docId,
    year: String(examData.year),
    course: examData.course,
    courseName: examData.course,
    totalQuestions,
    totalMarks,
    subjectDistribution,
    questions: normalizedQuestions,
    examLink: `/exam/${docId}`,
    status: examData.status || 'inactive',
    updatedAt: Date.now()
  };

  const all = getAllStoredExams();
  all[docId] = examRecord;

  // Save to local cache
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent(EXAM_EVENT_NAME, { detail: all }));
  } catch (e) {
    console.error('Error saving exam to localStorage:', e);
  }

  // Save to Firestore in 1 single clean write
  if (db) {
    try {
      await setDoc(doc(db, 'exams', docId), examRecord, { merge: true });
    } catch (err) {
      console.warn('Firestore exam save warning:', err);
    }
  }

  return { success: true, exam: examRecord };
};

/**
 * Delete a composite exam from LocalStorage and Firestore
 */
export const deleteCompositeExam = async (year, courseName) => {
  const docId = getExamDocId(year, courseName);
  const all = getAllStoredExams();
  delete all[docId];

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent(EXAM_EVENT_NAME, { detail: all }));
  } catch (e) {}

  if (db) {
    try {
      await deleteDoc(doc(db, 'exams', docId));
    } catch (err) {
      console.warn('Firestore exam delete notice:', err);
    }
  }

  return { success: true };
};

/**
 * Save Student Exam Result (1 write per submission) & Auto-Sync Marksheet to Firestore
 */
export const saveStudentExamResult = async (resultData) => {
  const resultId = `res_${resultData.examId || 'exam'}_${(resultData.registrationNo || resultData.studentName || 'std').toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
  const record = {
    ...resultData,
    id: resultId,
    submittedAt: Date.now()
  };

  // Cache exam result locally
  try {
    const cached = JSON.parse(localStorage.getItem('sle_exam_results_cache') || '[]');
    cached.unshift(record);
    localStorage.setItem('sle_exam_results_cache', JSON.stringify(cached.slice(0, 500)));
  } catch (e) {}

  // Save to Firestore 'exam_results' collection
  if (db) {
    try {
      await setDoc(doc(db, 'exam_results', resultId), record);
    } catch (err) {
      console.warn('Error saving exam result to Firestore:', err);
    }
  }

  // Auto-generate or update student's Marksheet in Firestore & local storage
  try {
    const regNo = (resultData.registrationNo || resultData.studentRollNo || '').trim();
    const sRoll = (resultData.studentRollNo || resultData.registrationNo || '').trim();
    const stdCourse = resultData.course || '';

    // Prepare curriculum subjects
    const curriculum = getStoredSubjectsForCourse(stdCourse);
    let subjects = curriculum.map(s => ({
      name: s.name,
      intMax: s.intMax !== undefined ? s.intMax : 40,
      intObt: 0,
      extMax: s.extMax !== undefined ? s.extMax : 60,
      extObt: 0
    }));

    // Check existing marksheet from local storage
    const localRegistered = JSON.parse(localStorage.getItem('sle_registered_marksheets') || '{}');
    const existingLocal = localRegistered[regNo] || localRegistered[sRoll];
    if (existingLocal && Array.isArray(existingLocal.subjects) && existingLocal.subjects.length > 0) {
      subjects = existingLocal.subjects;
    }

    // Merge external exam marks
    subjects = mergeExamMarksIntoSubjects(subjects, record);

    const marksheetPayload = {
      ...(existingLocal || {}),
      admNo: existingLocal?.admNo || regNo,
      admissionNo: existingLocal?.admissionNo || regNo,
      htNo: existingLocal?.htNo || sRoll,
      rollNo: existingLocal?.rollNo || sRoll,
      candidateName: resultData.studentName || existingLocal?.candidateName || '',
      course: stdCourse || existingLocal?.course || '',
      courseCode: stdCourse || existingLocal?.courseCode || '',
      trainingCenter: resultData.centerName || existingLocal?.trainingCenter || 'SLES Center',
      subjects: subjects,
      lastUpdated: Date.now(),
      examSubmitted: true
    };

    // Update local storage under both admissionNo and rollNo
    if (regNo) localRegistered[regNo] = marksheetPayload;
    if (sRoll) localRegistered[sRoll] = marksheetPayload;
    localStorage.setItem('sle_registered_marksheets', JSON.stringify(localRegistered));

    // Save marksheet to Firestore 'marksheets' collection for cross-device access
    if (db) {
      if (regNo) {
        await setDoc(doc(db, 'marksheets', regNo.toLowerCase()), marksheetPayload, { merge: true });
      }
      if (sRoll && sRoll.toLowerCase() !== regNo.toLowerCase()) {
        await setDoc(doc(db, 'marksheets', sRoll.toLowerCase()), marksheetPayload, { merge: true });
      }
    }
  } catch (msErr) {
    console.warn('Auto marksheet sync error:', msErr);
  }

  return { success: true, result: record };
};

let examsFetchPromise = null;

/**
 * Fetch latest composite exams from Firestore once and update local cache
 */
export const refreshExams = async (callback) => {
  if (!db) return getAllStoredExams();
  try {
    const snapshot = await getDocs(collection(db, 'exams'));
    if (!snapshot.empty) {
      const currentMap = getAllStoredExams();
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data && data.id) {
          currentMap[data.id] = data;
        }
      });
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentMap));
      } catch (e) {}
      if (callback) callback(currentMap);
      return currentMap;
    }
  } catch (err) {
    console.warn('Firestore exams fetch warning:', err?.message);
  }
  return getAllStoredExams();
};

/**
 * Subscribe to composite exams with LocalStorage cache + one-time Firestore fetch
 */
export const subscribeToExams = (callback) => {
  const initial = getAllStoredExams();
  callback(initial);

  const handleLocalUpdate = (event) => {
    if (event.detail && typeof event.detail === 'object') {
      callback(event.detail);
    }
  };
  window.addEventListener(EXAM_EVENT_NAME, handleLocalUpdate);

  // Perform single fetch on startup if db is available
  if (db) {
    if (!examsFetchPromise) {
      examsFetchPromise = refreshExams(callback);
    } else {
      examsFetchPromise.then(res => {
        if (res && typeof res === 'object') callback(res);
      });
    }
  }

  return () => {
    window.removeEventListener(EXAM_EVENT_NAME, handleLocalUpdate);
  };
};

// Legacy backwards compatibility aliases
export const getPaperDocId = (c, s) => `paper_${c}_${s}`;
export const getStoredPaper = (c, s) => getStoredExam('2026', c, [s]);
export const saveQuestionPaper = (data) => saveCompositeExam(data);
export const deleteQuestionPaper = (c, s) => deleteCompositeExam('2026', c);
export const subscribeToQuestionPapers = subscribeToExams;
export const generateDefault100Questions = () => generateQuestionsForSubject('General', 100, 1, 1);

/**
 * Update Exam Status (Admin live activate / deactivate toggle)
 * Cost: 1 Firestore write
 * @param {string} examId
 * @param {'active'|'inactive'|'completed'} status
 */
export const updateExamStatus = async (examId, status) => {
  if (!examId) return { success: false, error: 'examId required' };

  // Update local cache immediately (optimistic)
  const all = getAllStoredExams();
  const existing = all[examId] || Object.values(all).find(e => e.id === examId) || {};
  all[examId] = { ...existing, id: examId, status, updatedAt: Date.now() };

  // Also update any matching keys in cache
  Object.keys(all).forEach(k => {
    if (all[k]?.id === examId || (all[k]?.course && String(examId).toLowerCase().includes(String(all[k].course).toLowerCase()))) {
      all[k] = { ...all[k], status, updatedAt: Date.now() };
    }
  });

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent(EXAM_EVENT_NAME, { detail: all }));
  } catch (e) {}

  // Write to Firestore
  if (db) {
    try {
      await updateDoc(doc(db, 'exams', examId), { status, updatedAt: Date.now() });
      return { success: true };
    } catch (err) {
      console.warn('updateExamStatus Firestore error:', err);
      try {
        await setDoc(doc(db, 'exams', examId), { status, updatedAt: Date.now() }, { merge: true });
        return { success: true };
      } catch (e2) {
        return { success: false, error: e2.message };
      }
    }
  }

  return { success: true };
};

/**
 * Subscribe to live exam status changes (for student waiting room & active exam pause/resume)
 * Listens via Firestore snapshot, local custom events, storage event (cross-tab), and 1-second fallback poll.
 * @param {string} examId
 * @param {function} callback — called with (newStatus, examData)
 * @returns unsubscribe function
 */
export const getExamLiveStatus = (examId, callback) => {
  if (!examId) return () => {};

  let lastStatus = null;

  const checkLocal = () => {
    try {
      const all = getAllStoredExams();
      const match = all[examId] || Object.values(all).find(e => e.id === examId || (e.course && String(examId).toLowerCase().includes(String(e.course).toLowerCase())));
      if (match && match.status) {
        if (match.status !== lastStatus) {
          lastStatus = match.status;
          callback(match.status, match);
        }
      }
    } catch (e) {}
  };

  // 1. Initial check
  checkLocal();

  // 2. Custom window event (same-window updates)
  const handleCustomEvent = () => checkLocal();
  window.addEventListener(EXAM_EVENT_NAME, handleCustomEvent);

  // 3. Storage event (cross-tab updates)
  const handleStorage = (e) => {
    if (!e.key || e.key === LOCAL_STORAGE_KEY) {
      checkLocal();
    }
  };
  window.addEventListener('storage', handleStorage);

  // 4. Polling fallback (1 second interval)
  const intervalId = setInterval(checkLocal, 1000);

  // 5. One-time Firestore fetch on mount (to save reads)
  if (db) {
    (async () => {
      try {
        const docSnap = await getDoc(doc(db, 'exams', examId));
        if (docSnap && docSnap.exists()) {
          const data = docSnap.data();
          if (data.status) {
            lastStatus = data.status;
            try {
              const all = getAllStoredExams();
              all[examId] = { ...all[examId], ...data };
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
            } catch (e) {}
            callback(data.status, data);
          }
        }
      } catch (err) {
        console.warn('getExamLiveStatus fetch notice:', err);
      }
    })();
  }

  return () => {
    window.removeEventListener(EXAM_EVENT_NAME, handleCustomEvent);
    window.removeEventListener('storage', handleStorage);
    clearInterval(intervalId);
  };
};

/**
 * Download all exam results for a given examId as a CSV string.
 * Admin-only, on-demand read. Returns { csv, count }.
 */
export const downloadExamResultsAsCSV = async (examId) => {
  if (!examId) return { csv: '', count: 0 };

  const results = [];

  if (db) {
    try {
      const snapshot = await getDocs(collection(db, 'exam_results'));
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        if (d.examId === examId) results.push(d);
      });
    } catch (err) {
      console.warn('downloadExamResultsAsCSV Firestore error:', err);
    }
  }

  // Also check local cache
  try {
    const cached = JSON.parse(localStorage.getItem('sle_exam_results_cache') || '[]');
    cached.forEach(r => {
      if (r.examId === examId && !results.find(x => x.id === r.id)) {
        results.push(r);
      }
    });
  } catch (e) {}

  if (results.length === 0) return { csv: '', count: 0 };

  // Build CSV
  const headers = [
    'Roll No', 'Student Name', 'Course', 'Year', 'Center',
    'Total Questions', 'Attempted', 'Correct', 'Wrong',
    'Total Marks', 'Marks Obtained', 'Percentage', 'Grade', 'Status',
    'Submitted At'
  ];

  const rows = results.map(r => {
    const attempted = r.answeredCount || Object.keys(r.answersSummary || {}).length || 0;
    const correct = r.correctCount || r.correct || 0;
    const wrong = attempted - correct;
    const pct = r.overallPercentage || r.percentage || 0;
    const grade = pct >= 85 ? 'A+' : pct >= 75 ? 'A' : pct >= 60 ? 'B' : pct >= 40 ? 'C' : 'F';
    const status = pct >= (r.passingPercentage || 40) ? 'PASS' : 'FAIL';
    const date = r.submittedAt ? new Date(r.submittedAt).toLocaleString('en-IN') : '';

    return [
      r.registrationNo || r.studentRollNo || '',
      r.studentName || '',
      r.course || '',
      r.year || '',
      r.centerName || '',
      r.totalQuestions || 0,
      attempted,
      correct,
      wrong,
      r.totalMaxMarks || r.totalMarks || 0,
      r.totalMarksObtained || r.marksObtained || 0,
      pct + '%',
      grade,
      status,
      date
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });

  const csv = [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');
  return { csv, count: results.length };
};

/**
 * Find exam result for a student by matching admission number, roll number, suffix, or name
 */
export const findStudentExamResult = (cachedResults, adm, roll, name) => {
  if (!Array.isArray(cachedResults) || cachedResults.length === 0) return null;
  const admClean = String(adm || '').trim().toLowerCase();
  const rollClean = String(roll || '').trim().toLowerCase();
  const nameClean = String(name || '').trim().toLowerCase();
  const suffix = admClean.length >= 4 ? admClean.slice(-4) : (rollClean.length >= 4 ? rollClean.slice(-4) : '');

  // 1. Direct match on admissionNo or rollNo
  let match = cachedResults.find(r => {
    const reg = String(r.registrationNo || '').trim().toLowerCase();
    const sRoll = String(r.studentRollNo || '').trim().toLowerCase();
    return (admClean && (reg === admClean || sRoll === admClean)) ||
           (rollClean && (reg === rollClean || sRoll === rollClean));
  });
  if (match) return match;

  // 2. Suffix match (e.g. 8043)
  if (suffix) {
    match = cachedResults.find(r => {
      const reg = String(r.registrationNo || '').trim().toLowerCase();
      const sRoll = String(r.studentRollNo || '').trim().toLowerCase();
      const rName = String(r.studentName || '').trim().toLowerCase();
      const suffixHit = reg.endsWith(suffix) || sRoll.endsWith(suffix) || reg.includes(suffix) || sRoll.includes(suffix);
      if (suffixHit) {
        if (!nameClean || rName.includes(nameClean) || nameClean.includes(rName)) {
          return true;
        }
      }
      return false;
    });
    if (match) return match;
  }

  // 3. Name match
  if (nameClean) {
    match = cachedResults.find(r => {
      const rName = String(r.studentName || '').trim().toLowerCase();
      return rName && (rName === nameClean || rName.includes(nameClean) || nameClean.includes(rName));
    });
    if (match) return match;
  }

  return null;
};

/**
 * Normalize subject name for exact comparisons
 */
export const normalizeSubjectName = (name) => {
  return String(name || '')
    .replace(/^\d+\)\s*/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[-_]/g, ' ');
};

/**
 * Match subject key strictly without false substring collisions (e.g. GST-I matching inside GST-IV)
 */
export const matchSubjectKey = (breakdown, subjectName) => {
  if (!breakdown || typeof breakdown !== 'object') return null;
  const sNorm = normalizeSubjectName(subjectName);
  const keys = Object.keys(breakdown);

  // 1. Exact normalized match
  const exact = keys.find(k => normalizeSubjectName(k) === sNorm);
  if (exact) return exact;

  // 2. Roman numeral vs Number equivalence (e.g. gst i === gst 1, gst iv === gst 4)
  const toArabic = (str) => str
    .replace(/\biv\b/g, '4')
    .replace(/\biii\b/g, '3')
    .replace(/\bii\b/g, '2')
    .replace(/\bi\b/g, '1');

  const sArabic = toArabic(sNorm);
  const romanMatch = keys.find(k => toArabic(normalizeSubjectName(k)) === sArabic);
  if (romanMatch) return romanMatch;

  // 3. Exact word boundary match only
  const wordMatch = keys.find(k => {
    const kNorm = normalizeSubjectName(k);
    if (!kNorm || !sNorm) return false;
    const escaped = sNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      const regex = new RegExp('(^|\\s)' + escaped + '($|\\s)');
      return regex.test(kNorm);
    } catch (_) {
      return kNorm === sNorm || kNorm.includes(sNorm);
    }
  });
  if (wordMatch) return wordMatch;

  return null;
};

/**
 * Merge exam result breakdown into marksheet subjects
 */
export const mergeExamMarksIntoSubjects = (subjects, studentResult) => {
  if (!studentResult || !studentResult.subjectWiseBreakdown || !Array.isArray(subjects) || subjects.length === 0) {
    return subjects;
  }
  const breakdown = studentResult.subjectWiseBreakdown;

  return subjects.map((subj) => {
    const matchedKey = matchSubjectKey(breakdown, subj.name);
    const examStat = matchedKey ? breakdown[matchedKey] : null;
    let extObt = subj.extObt;
    let extMax = subj.extMax || 60;

    if (examStat) {
      const examObt = Number(examStat.marksObtained) || 0;
      const examMax = Number(examStat.maxMarks) || 100;
      const targetExtMax = Number(extMax) || 60;
      
      if (examMax === targetExtMax) {
        extObt = examObt;
      } else if (examMax > 0) {
        extObt = Math.round((examObt / examMax) * targetExtMax);
      } else {
        extObt = examObt;
      }
    } else if (studentResult.overallPercentage !== undefined && (!extObt || extObt === '0' || extObt === 0)) {
      const pct = Number(studentResult.overallPercentage) / 100;
      const targetExtMax = Number(extMax) || 60;
      extObt = Math.round(targetExtMax * pct);
    }

    return {
      ...subj,
      extMax: Number(extMax) || 60,
      extObt: extObt !== undefined && extObt !== '' ? Number(extObt) : 0
    };
  });
};

/**
 * Calculate total external question paper marks allocated for a given course and subject
 */
export const getQuestionPaperSubjectMarks = (courseName, subjectName) => {
  if (!courseName || !subjectName) return null;
  const allExams = getAllStoredExams();
  if (!allExams || typeof allExams !== 'object') return null;

  const docId = getExamDocId('2026', courseName);
  let exam = allExams[docId];

  if (!exam) {
    const list = Object.values(allExams);
    const cLower = courseName.toLowerCase().trim();
    const cleanC = cLower.replace(/[^a-z0-9]/g, '');
    exam = list.find(e => {
      const eCourse = (e.course || e.courseName || '').toLowerCase().trim();
      if (!eCourse) return false;
      if (eCourse === cLower) return true;
      const cleanE = eCourse.replace(/[^a-z0-9]/g, '');
      return cleanE === cleanC || cleanE.includes(cleanC) || cleanC.includes(cleanE);
    });
  }

  if (!exam || !Array.isArray(exam.questions) || exam.questions.length === 0) {
    return null;
  }

  const sNorm = subjectName.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!sNorm) return null;

  // Direct question match by subjectId
  const matchingQs = exam.questions.filter(q => {
    const qSubj = (q.subjectId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!qSubj) return false;
    return qSubj === sNorm || qSubj.includes(sNorm) || sNorm.includes(qSubj);
  });

  if (matchingQs.length > 0) {
    return matchingQs.reduce((sum, q) => sum + (Number(q.marks) || 2), 0);
  }

  return null;
};
