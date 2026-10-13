import { db, doc, getDoc, setDoc, runTransaction } from '../firebase';

/**
 * Extracts a 4-digit enrollment year from a Date object, date string ("YYYY-MM-DD", "DD-MM-YYYY"), or number.
 * Defaults to current year (e.g. 2026, 2027).
 */
export function getEnrollmentYear(dateOrYear) {
  if (!dateOrYear) return new Date().getFullYear();
  if (typeof dateOrYear === 'number' && dateOrYear >= 2000 && dateOrYear <= 2100) {
    return dateOrYear;
  }
  const str = String(dateOrYear).trim();
  if (/^\d{4}$/.test(str)) {
    return parseInt(str, 10);
  }
  if (/^(\d{4})-\d{2}-\d{2}/.test(str)) {
    const y = parseInt(str.slice(0, 4), 10);
    if (!isNaN(y)) return y;
  }
  if (/^\d{1,2}[-/]\d{1,2}[-/](\d{4})/.test(str)) {
    const parts = str.split(/[-/]/);
    const y = parseInt(parts[2], 10);
    if (!isNaN(y)) return y;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getFullYear())) {
    return parsed.getFullYear();
  }
  return new Date().getFullYear();
}

/**
 * Generates starting base registration number for any given year:
 * e.g. 2026 -> 202638001
 *      2027 -> 202738001
 */
export function getBaseRegNo(dateOrYear) {
  const year = getEnrollmentYear(dateOrYear);
  return parseInt(`${year}38001`, 10);
}

export const BASE_REG_NO = 202638001; // Backward compatibility
export const COUNTER_COL = 'system_counters';
export const COUNTER_DOC = 'student_registration';

export function getStudentCounterDocName(year) {
  return `student_registration_${year}`;
}

/**
 * Reads highest known student registration number for a specific enrollment year from local caches.
 */
export function getLocalMaxRegistrationNo(dateOrYear) {
  const year = getEnrollmentYear(dateOrYear);
  const baseRegNo = getBaseRegNo(year);
  let maxReg = baseRegNo - 1;
  const yearPrefix = String(year);

  try {
    // 1. Year-scoped last allocated
    const yearLastAlloc = localStorage.getItem(`sle_last_allocated_reg_no_${year}`);
    if (yearLastAlloc) {
      const val = parseInt(yearLastAlloc.replace(/[^0-9]/g, ''), 10);
      if (String(val).startsWith(yearPrefix) && val > maxReg) maxReg = val;
    }

    // 2. Legacy global last allocated (if matching this year)
    const lastAllocated = localStorage.getItem('sle_last_allocated_reg_no');
    if (lastAllocated) {
      const val = parseInt(lastAllocated.replace(/[^0-9]/g, ''), 10);
      if (String(val).startsWith(yearPrefix) && val > maxReg) maxReg = val;
    }

    const lastReg = localStorage.getItem('sle_last_reg_no');
    if (lastReg) {
      const val = parseInt(lastReg.replace(/[^0-9]/g, ''), 10);
      if (String(val).startsWith(yearPrefix) && val > maxReg) maxReg = val;
    }

    // 3. Scan cached students registered in this year
    const students = JSON.parse(localStorage.getItem('sle_students_cache') || '[]');
    students.forEach(s => {
      if (s) {
        const raw = String(s.registrationNo || s.regNo || s.admNo || '').replace(/[^0-9]/g, '');
        if (raw.startsWith(yearPrefix)) {
          const val = parseInt(raw, 10);
          if (!isNaN(val) && val > maxReg) maxReg = val;
        }
      }
    });

    const applications = JSON.parse(localStorage.getItem('sle_applications_cache') || '[]');
    applications.forEach(a => {
      if (a) {
        const raw = String(a.registrationNo || a.regNo || a.admNo || '').replace(/[^0-9]/g, '');
        if (raw.startsWith(yearPrefix)) {
          const val = parseInt(raw, 10);
          if (!isNaN(val) && val > maxReg) maxReg = val;
        }
      }
    });
  } catch (e) {}

  return maxReg;
}

/**
 * Peeks next student registration number for a given year without mutating counter.
 */
export async function peekNextRegistrationNo(dbInstance = db, dateOrYear) {
  const year = getEnrollmentYear(dateOrYear);
  let maxReg = getLocalMaxRegistrationNo(year);

  if (dbInstance) {
    try {
      const docName = getStudentCounterDocName(year);
      let counterRef = doc(dbInstance, COUNTER_COL, docName);
      let counterSnap = await Promise.race([
        getDoc(counterRef),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
      ]);

      // Fallback check on legacy document for 2026
      if ((!counterSnap || !counterSnap.exists()) && year === 2026) {
        const legacyRef = doc(dbInstance, COUNTER_COL, COUNTER_DOC);
        counterSnap = await Promise.race([
          getDoc(legacyRef),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
        ]).catch(() => null);
      }

      if (counterSnap && counterSnap.exists()) {
        const val = parseInt(counterSnap.data()?.currentRegNo, 10);
        if (!isNaN(val) && String(val).startsWith(String(year)) && val > maxReg) {
          maxReg = val;
        }
      }
    } catch (e) {}
  }

  return String(maxReg + 1);
}

/**
 * Atomically allocates and increments the next unique student registration number for a given year.
 */
export async function allocateNextRegistrationNo(dbInstance = db, dateOrYear) {
  const year = getEnrollmentYear(dateOrYear);
  const localMax = getLocalMaxRegistrationNo(year);
  const docName = getStudentCounterDocName(year);

  if (dbInstance) {
    const counterRef = doc(dbInstance, COUNTER_COL, docName);

    try {
      const allocatedRegNo = await Promise.race([
        runTransaction(dbInstance, async (transaction) => {
          let counterSnap = await transaction.get(counterRef);
          let currentMax = localMax;

          // Legacy document migration check for 2026
          if (!counterSnap.exists() && year === 2026) {
            const legacyRef = doc(dbInstance, COUNTER_COL, COUNTER_DOC);
            const legacySnap = await transaction.get(legacyRef);
            if (legacySnap.exists()) {
              counterSnap = legacySnap;
            }
          }

          if (counterSnap.exists()) {
            const val = parseInt(counterSnap.data()?.currentRegNo, 10);
            if (!isNaN(val) && String(val).startsWith(String(year)) && val > currentMax) {
              currentMax = val;
            }
          }

          const nextRegNo = currentMax + 1;

          transaction.set(counterRef, {
            currentRegNo: nextRegNo,
            year,
            lastAllocatedAt: new Date().toISOString(),
            updatedAt: Date.now()
          }, { merge: true });

          return String(nextRegNo);
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction timeout / quota exceeded')), 2000))
      ]);

      try {
        localStorage.setItem(`sle_last_allocated_reg_no_${year}`, String(allocatedRegNo));
        localStorage.setItem('sle_last_allocated_reg_no', String(allocatedRegNo));
        localStorage.setItem('sle_last_reg_no', String(allocatedRegNo));
      } catch (e) {}

      console.log('[RegistrationManager] Atomically allocated registration number:', allocatedRegNo);
      return String(allocatedRegNo);
    } catch (error) {
      console.warn('[RegistrationManager] Remote transaction notice (using local sequential counter):', error?.message || error);
    }
  }

  // Resilient fallback allocation (instant, sequential, non-blocking)
  const nextSequential = localMax + 1;
  const finalAllocated = String(nextSequential);

  try {
    localStorage.setItem(`sle_last_allocated_reg_no_${year}`, finalAllocated);
    localStorage.setItem('sle_last_allocated_reg_no', finalAllocated);
    localStorage.setItem('sle_last_reg_no', finalAllocated);
  } catch (e) {}

  if (dbInstance) {
    try {
      const counterRef = doc(dbInstance, COUNTER_COL, docName);
      Promise.race([
        setDoc(counterRef, {
          currentRegNo: nextSequential,
          year,
          lastAllocatedAt: new Date().toISOString(),
          updatedAt: Date.now()
        }, { merge: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000))
      ]).catch(() => {});
    } catch (e) {}
  }

  console.log('[RegistrationManager] Sequential registration number allocated from local store:', finalAllocated);
  return finalAllocated;
}
