/**
 * examAuthManager.js
 * Handles all student exam authentication:
 *  - PIN generation at hall ticket print time
 *  - Saving credentials to Firestore (1 write per student)
 *  - Validating login (1 read per login)
 *  - Session management (sessionStorage — tab-scoped, auto-clears)
 */

import { db, doc, setDoc, getDoc, updateDoc, collection, getDocs } from '../firebase';

const SESSION_KEY = 'sle_student_exam_session';

// ── Generate a cryptographically-safe 6-digit PIN ──────────────────
export const generatePin = () => {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
};

// ── Generate Roll No from course + student reg no ──────────────────
export const generateRollNo = (year, course, regNo) => {
  const yStr = String(year || new Date().getFullYear());
  const cStr = (course || 'GEN').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  const rStr = String(regNo || Math.floor(1000 + Math.random() * 9000)).replace(/[^0-9]/g, '').slice(-4);
  return `SLE${yStr}-${cStr}-${rStr}`;
};

// ── Save hall ticket credentials to Firestore (1 write) ────────────
/**
 * Called when admin prints a hall ticket.
 * Writes to hall_tickets/{rollNo}:
 *   { rollNo, examPin, examId, studentName, course, year, examAttempted: false }
 */
export const saveHallTicketCredentials = async ({
  rollNo,
  examPin,
  examId,
  studentName,
  course,
  year,
  admissionNo = '',
  centerName = '',
  examDate = '',
  examTime = '',
}) => {
  if (!rollNo || !examPin || !examId) {
    return { success: false, error: 'rollNo, examPin, and examId are required.' };
  }

  const record = {
    rollNo,
    examPin,
    examId,
    studentName: studentName || '',
    course: course || '',
    year: String(year || ''),
    admissionNo,
    centerName,
    examDate: examDate || '2026 Feb, 8',
    examTime: examTime || '10:00 AM to 1:00 PM',
    examAttempted: false,
    assignedAt: Date.now(),
  };

  // Save to Firestore
  if (db) {
    try {
      await setDoc(doc(db, 'hall_tickets', rollNo), record, { merge: true });
    } catch (err) {
      console.warn('Firestore hall_ticket save warning:', err);
      return { success: false, error: 'Failed to save credentials to Firestore.' };
    }
  }

  // Also cache locally so admin can re-print without re-fetching
  try {
    const cached = JSON.parse(localStorage.getItem('sle_hall_tickets_cache') || '{}');
    cached[rollNo] = record;
    if (admissionNo) cached[admissionNo] = record;
    localStorage.setItem('sle_hall_tickets_cache', JSON.stringify(cached));

    const regHt = JSON.parse(localStorage.getItem('sle_registered_halltickets') || '{}');
    if (rollNo) regHt[rollNo] = record;
    if (admissionNo) regHt[admissionNo] = record;
    localStorage.setItem('sle_registered_halltickets', JSON.stringify(regHt));

    // Update student status to Approved in sle_students_cache
    const cacheStudents = JSON.parse(localStorage.getItem('sle_students_cache') || '[]');
    const updatedCache = cacheStudents.map(s => {
      const sReg = String(s.registrationNo || s.regNo || '').trim();
      const sAdm = String(s.appNumber || s.id || '').trim();
      if (sReg === rollNo || sReg === admissionNo || sAdm === admissionNo) {
        return {
          ...s,
          status: 'Approved',
          hasHallTicket: true,
          hallTicketGenerated: true,
          examPin,
          rollNo
        };
      }
      return s;
    });
    localStorage.setItem('sle_students_cache', JSON.stringify(updatedCache));
    localStorage.setItem('sle_coaching_students_cache', JSON.stringify(updatedCache));

    const targetDocId = admissionNo || rollNo;
    if (db && targetDocId) {
      setDoc(doc(db, 'students', targetDocId), { status: 'Approved', hasHallTicket: true, hallTicketGenerated: true, examPin, rollNo }, { merge: true }).catch(() => {});
      setDoc(doc(db, 'applications', targetDocId), { status: 'Approved', hasHallTicket: true, hallTicketGenerated: true, examPin, rollNo }, { merge: true }).catch(() => {});
    }
  } catch (e) {}

  return { success: true, record };
};

// ── Validate student login (1 Firestore read) ──────────────────────
/**
 * Validates Roll No + PIN against hall_tickets/{rollNo}.
 * Returns { examId, studentName, course, year } on success.
 * Throws descriptive error string on failure.
 */
export const validateStudentLogin = async (rollNo, pin) => {
  if (!rollNo || !pin) {
    throw new Error('Please enter both Roll No and Exam PIN.');
  }

  const cleanRollNo = rollNo.trim().toUpperCase();
  const cleanPin = pin.trim();
  const strippedInput = cleanRollNo.replace(/[^A-Z0-9]/g, '');

  // 1. Try local cache first (avoids network on retry)
  let record = null;
  try {
    const cached = JSON.parse(localStorage.getItem('sle_hall_tickets_cache') || '{}');
    if (cached[cleanRollNo]) record = cached[cleanRollNo];
    if (!record && strippedInput) {
      const match = Object.values(cached).find(c => {
        const cRoll = (c.rollNo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const cAdm = (c.admissionNo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        return cRoll === strippedInput || cAdm === strippedInput ||
          (strippedInput.length >= 4 && (cRoll.endsWith(strippedInput) || cAdm.endsWith(strippedInput)));
      });
      if (match) record = match;
    }
  } catch (e) {}

  // 2. Fetch from Firestore if not cached
  if (!record && db) {
    try {
      // 2a. Direct get by exact Roll No doc key
      const docSnap = await getDoc(doc(db, 'hall_tickets', cleanRollNo));
      if (docSnap.exists()) {
        record = docSnap.data();
      } else {
        // 2b. Scan collection to support Admission No or stripped alphanumeric match
        const snapshot = await getDocs(collection(db, 'hall_tickets'));
        snapshot.forEach(d => {
          const data = d.data();
          const dRoll = (data.rollNo || d.id || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          const dAdm = (data.admissionNo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (
            dRoll === strippedInput ||
            dAdm === strippedInput ||
            (strippedInput.length >= 4 && (dRoll.endsWith(strippedInput) || dAdm.endsWith(strippedInput)))
          ) {
            record = data;
          }
        });
      }

      // Cache found record
      if (record) {
        try {
          const cached = JSON.parse(localStorage.getItem('sle_hall_tickets_cache') || '{}');
          if (record.rollNo) cached[record.rollNo] = record;
          cached[cleanRollNo] = record;
          localStorage.setItem('sle_hall_tickets_cache', JSON.stringify(cached));
        } catch (e) {}
      }
    } catch (err) {
      console.warn('Firestore hall_ticket fetch error:', err);
      throw new Error('Unable to verify credentials. Please check your connection.');
    }
  }

  if (!record) {
    throw new Error('Roll No or Admission No not found. Please check your Hall Ticket.');
  }

  if (String(record.examPin).trim() !== cleanPin) {
    throw new Error('Invalid PIN. Please check your Hall Ticket.');
  }

  // Enforce one-time exam: prevent re-taking once already attempted or submitted
  let isAttempted = record.examAttempted === true;
  try {
    const submittedList = JSON.parse(localStorage.getItem('sle_submitted_exams') || '[]');
    if (
      submittedList.includes(cleanRollNo) ||
      (record.rollNo && submittedList.includes(String(record.rollNo).toUpperCase())) ||
      (record.admissionNo && submittedList.includes(String(record.admissionNo).toUpperCase()))
    ) {
      isAttempted = true;
    }
  } catch (e) {}

  if (isAttempted) {
    throw new Error('This examination has already been completed and submitted. It is a one-time examination and cannot be taken again.');
  }

  return {
    rollNo: record.rollNo || cleanRollNo,
    examId: record.examId,
    studentName: record.studentName || '',
    course: record.course || '',
    year: record.year || '',
    admissionNo: record.admissionNo || '',
    centerName: record.centerName || '',
    examAttempted: record.examAttempted || false,
  };
};

// ── Check if exam has already been attempted / submitted ───────────
export const isExamAlreadyAttempted = async (rollNoOrAdmNo) => {
  if (!rollNoOrAdmNo) return false;
  const clean = String(rollNoOrAdmNo).trim().toUpperCase();

  try {
    const submittedList = JSON.parse(localStorage.getItem('sle_submitted_exams') || '[]');
    if (submittedList.includes(clean)) return true;
  } catch (e) {}

  if (db) {
    try {
      const snap = await getDoc(doc(db, 'hall_tickets', clean));
      if (snap.exists() && snap.data().examAttempted) {
        return true;
      }
    } catch (e) {}
  }

  return false;
};

// ── Mark exam as attempted (field update — called after submission) ─
export const markExamAttempted = async (rollNo) => {
  if (!rollNo) return;
  const cleanRollNo = rollNo.trim().toUpperCase();

  // 1. Update local cache and submitted list
  try {
    const cached = JSON.parse(localStorage.getItem('sle_hall_tickets_cache') || '{}');
    if (cached[cleanRollNo]) {
      cached[cleanRollNo].examAttempted = true;
      cached[cleanRollNo].attemptedAt = Date.now();
      localStorage.setItem('sle_hall_tickets_cache', JSON.stringify(cached));
    }
    const submittedList = JSON.parse(localStorage.getItem('sle_submitted_exams') || '[]');
    if (!submittedList.includes(cleanRollNo)) {
      submittedList.push(cleanRollNo);
      localStorage.setItem('sle_submitted_exams', JSON.stringify(submittedList));
    }
  } catch (e) {}

  // 2. Mark attempt in Firestore
  if (db) {
    try {
      await updateDoc(doc(db, 'hall_tickets', cleanRollNo), {
        examAttempted: true,
        attemptedAt: Date.now(),
      });
    } catch (err) {
      console.warn('markExamAttempted warning:', err);
    }
  }
};

// ── Session helpers (sessionStorage — tab-scoped) ──────────────────
export const saveStudentSession = (sessionData) => {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  } catch (e) {}
};

export const getStudentSession = () => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
};

export const clearStudentSession = () => {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (e) {}
};

// ── Get existing hall ticket credentials ─────────────────────────
export const getHallTicketCredentials = async (rollNoOrAdmNo) => {
  if (!rollNoOrAdmNo) return null;
  const key = String(rollNoOrAdmNo).trim().toUpperCase();
  const stripped = key.replace(/[^A-Z0-9]/g, '');

  // Check local cache
  try {
    const cached = JSON.parse(localStorage.getItem('sle_hall_tickets_cache') || '{}');
    if (cached[key]) return cached[key];
    const match = Object.values(cached).find(c => {
      const cRoll = (c.rollNo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const cAdm = (c.admissionNo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      return cRoll === stripped || cAdm === stripped;
    });
    if (match) return match;
  } catch (e) {}

  // Check Firestore
  if (db) {
    try {
      const docSnap = await getDoc(doc(db, 'hall_tickets', key));
      if (docSnap.exists()) return docSnap.data();

      // Fallback: search collection by rollNo or admissionNo
      const snap = await getDocs(collection(db, 'hall_tickets'));
      let found = null;
      snap.forEach(d => {
        const data = d.data();
        const dRoll = (data.rollNo || d.id || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const dAdm = (data.admissionNo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (dRoll === stripped || dAdm === stripped) {
          found = data;
        }
      });
      if (found) return found;
    } catch (e) {}
  }
  return null;
};

