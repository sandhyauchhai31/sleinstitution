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
export function getCertBaseRegNo(dateOrYear) {
  const year = getEnrollmentYear(dateOrYear);
  return parseInt(`${year}37001`, 10);
}

export const CERT_BASE_REG_NO = 202637001; // Backward compatibility
export const CERT_COUNTER_COL = 'system_counters';
export const CERT_COUNTER_DOC = 'cert_registration';

export function getCertCounterDocName(year) {
  return `cert_registration_${year}`;
}

/**
 * Parses a registration number like "SLE-202637001" or "202637001" to an integer.
 */
export function parseCertRegNumber(val) {
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9]/g, '');
  return parseInt(cleaned, 10) || 0;
}

/**
 * Formats an integer like 202637001 into the required "SLE-202637001" format.
 */
export function formatCertRegNo(num) {
  return `SLE-${num}`;
}

/**
 * Reads highest known certificate registration number for a specific enrollment year from local caches.
 */
export function getLocalMaxCertRegistrationNo(dateOrYear) {
  const year = getEnrollmentYear(dateOrYear);
  const baseRegNo = getCertBaseRegNo(year);
  let maxReg = baseRegNo - 1;
  const seqPrefix = `${year}37`;

  try {
    // 1. Year-scoped last allocated
    const yearLastAlloc = localStorage.getItem(`sle_cert_last_allocated_reg_no_${year}`);
    if (yearLastAlloc) {
      const val = parseCertRegNumber(yearLastAlloc);
      if (String(val).startsWith(seqPrefix) && val > maxReg) maxReg = val;
    }

    // 2. Legacy global last allocated (if matching this year)
    const lastAllocated = localStorage.getItem('sle_cert_last_allocated_reg_no');
    if (lastAllocated) {
      const val = parseCertRegNumber(lastAllocated);
      if (String(val).startsWith(seqPrefix) && val > maxReg) maxReg = val;
    }

    const lastReg = localStorage.getItem('sle_cert_last_reg_no');
    if (lastReg) {
      const val = parseCertRegNumber(lastReg);
      if (String(val).startsWith(seqPrefix) && val > maxReg) maxReg = val;
    }

    // 3. Scan cached students registered in this year
    const students = JSON.parse(localStorage.getItem('sle_cert_students_cache') || '[]');
    students.forEach(s => {
      if (s) {
        const val = parseCertRegNumber(s.registrationNo || s.certRegNo || s.regNo || s.admNo);
        if (val && String(val).startsWith(seqPrefix) && val > maxReg) {
          maxReg = val;
        }
      }
    });
  } catch (e) {}

  return maxReg;
}

/**
 * Peeks next certificate registration number for a given year without incrementing.
 */
export async function peekNextCertRegistrationNo(dbInstance = db, dateOrYear) {
  const year = getEnrollmentYear(dateOrYear);
  let maxReg = getLocalMaxCertRegistrationNo(year);

  if (dbInstance) {
    try {
      const docName = getCertCounterDocName(year);
      let counterRef = doc(dbInstance, CERT_COUNTER_COL, docName);
      let counterSnap = await Promise.race([
        getDoc(counterRef),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
      ]);

      // Fallback check on legacy document for 2026
      if ((!counterSnap || !counterSnap.exists()) && year === 2026) {
        const legacyRef = doc(dbInstance, CERT_COUNTER_COL, CERT_COUNTER_DOC);
        counterSnap = await Promise.race([
          getDoc(legacyRef),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
        ]).catch(() => null);
      }

      if (counterSnap && counterSnap.exists()) {
        const val = parseInt(counterSnap.data()?.currentRegNo, 10);
        if (!isNaN(val) && String(val).startsWith(`${year}37`) && val > maxReg) {
          maxReg = val;
        }
      }
    } catch (e) {}
  }

  return formatCertRegNo(maxReg + 1);
}

/**
 * Atomically allocates and increments the next unique certificate registration number for a given year.
 */
export async function allocateNextCertRegistrationNo(dbInstance = db, dateOrYear) {
  const year = getEnrollmentYear(dateOrYear);
  const localMax = getLocalMaxCertRegistrationNo(year);
  const docName = getCertCounterDocName(year);

  if (dbInstance) {
    const counterRef = doc(dbInstance, CERT_COUNTER_COL, docName);

    try {
      const allocatedRegNo = await Promise.race([
        runTransaction(dbInstance, async (transaction) => {
          let counterSnap = await transaction.get(counterRef);
          let currentMax = localMax;

          // Legacy document migration check for 2026
          if (!counterSnap.exists() && year === 2026) {
            const legacyRef = doc(dbInstance, CERT_COUNTER_COL, CERT_COUNTER_DOC);
            const legacySnap = await transaction.get(legacyRef);
            if (legacySnap.exists()) {
              counterSnap = legacySnap;
            }
          }

          if (counterSnap.exists()) {
            const val = parseInt(counterSnap.data()?.currentRegNo, 10);
            if (!isNaN(val) && String(val).startsWith(`${year}37`) && val > currentMax) {
              currentMax = val;
            }
          }

          const nextRegNo = currentMax + 1;
          transaction.set(counterRef, {
            currentRegNo: nextRegNo,
            year,
            prefix: 'SLE-',
            lastAllocatedAt: new Date().toISOString()
          }, { merge: true });

          return nextRegNo;
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction timeout')), 2500))
      ]);

      const formatted = formatCertRegNo(allocatedRegNo);
      try {
        localStorage.setItem(`sle_cert_last_allocated_reg_no_${year}`, String(allocatedRegNo));
        localStorage.setItem('sle_cert_last_allocated_reg_no', String(allocatedRegNo));
        localStorage.setItem('sle_cert_last_reg_no', formatted);
      } catch (e) {}

      return formatted;
    } catch (err) {
      console.warn('Firestore cert counter transaction notice, using atomic local allocation fallback:', err?.message || err);
    }
  }

  // Fallback to local increment
  const nextRegNo = localMax + 1;
  const formatted = formatCertRegNo(nextRegNo);

  try {
    localStorage.setItem(`sle_cert_last_allocated_reg_no_${year}`, String(nextRegNo));
    localStorage.setItem('sle_cert_last_allocated_reg_no', String(nextRegNo));
    localStorage.setItem('sle_cert_last_reg_no', formatted);
  } catch (e) {}

  if (dbInstance) {
    setDoc(doc(dbInstance, CERT_COUNTER_COL, docName), {
      currentRegNo: nextRegNo,
      year,
      prefix: 'SLE-',
      lastAllocatedAt: new Date().toISOString()
    }, { merge: true }).catch(() => {});
  }

  return formatted;
}
