import { db, collection, doc, setDoc, getDocs, deleteDoc, onSnapshot } from '../firebase';

const CERT_HISTORY_STORAGE_KEY = 'sle_certificate_history';
const CERT_HISTORY_COLLECTION = 'certificate_history';

export function normalizeCertificateHistoryItem(item) {
  if (!item) return item;
  const rawStatus = String(item.paymentStatus || '').trim().toLowerCase();
  let paymentStatus = 'Pending Payment';
  let isPaid = false;

  if (
    rawStatus === 'successful payment' ||
    rawStatus === 'successful' ||
    (rawStatus.includes('success') && !rawStatus.includes('fail') && !rawStatus.includes('pending'))
  ) {
    paymentStatus = 'Successful Payment';
    isPaid = true;
  } else if (rawStatus.includes('fail') || item.paymentFailed) {
    paymentStatus = 'Failed Payment';
    isPaid = false;
  } else if (rawStatus.includes('pending')) {
    paymentStatus = 'Pending Payment';
    isPaid = false;
  } else if (item.isPaid === true && !rawStatus) {
    paymentStatus = 'Successful Payment';
    isPaid = true;
  } else {
    paymentStatus = 'Pending Payment';
    isPaid = false;
  }

  return {
    ...item,
    paymentStatus,
    isPaid,
    isCertPaid: isPaid
  };
}

/**
 * Get cached certificate history from localStorage synchronously.
 */
export function getStoredCertificateHistory() {
  try {
    const raw = localStorage.getItem(CERT_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeCertificateHistoryItem);
  } catch (err) {
    console.error('Error reading certificate history from localStorage:', err);
    return [];
  }
}

/**
 * Save cached certificate history array to localStorage.
 */
export function saveStoredCertificateHistory(list) {
  try {
    localStorage.setItem(CERT_HISTORY_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Error saving certificate history to localStorage:', err);
  }
}

/**
 * Save or record a certificate entry into history (both localStorage & Firestore).
 */
export async function recordCertificateHistory(record, dbInstance = db) {
  const safeAdmNo = String(record.admNo || record.registrationNo || 'UNKNOWN').trim();
  const safeHtNo = String(record.htNo || '').trim();
  const timestamp = Date.now();
  const id = record.id || `cert_${safeAdmNo.replace(/[^a-zA-Z0-9_-]/g, '_')}_${timestamp}`;

  const feeAmount = Number(record.certificateFee ?? record.feeAmount ?? 500);

  const rawStatus = String(record.paymentStatus || '').trim().toLowerCase();
  let paymentStatus = 'Pending Payment';
  if (
    rawStatus === 'successful payment' ||
    rawStatus === 'successful' ||
    (rawStatus.includes('success') && !rawStatus.includes('fail') && !rawStatus.includes('pending'))
  ) {
    paymentStatus = 'Successful Payment';
  } else if (rawStatus.includes('fail') || record.paymentFailed) {
    paymentStatus = 'Failed Payment';
  } else if (rawStatus.includes('pending')) {
    paymentStatus = 'Pending Payment';
  } else if (record.isPaid) {
    paymentStatus = 'Successful Payment';
  } else {
    paymentStatus = 'Pending Payment';
  }

  const isPaid = paymentStatus === 'Successful Payment';

  const cleanRecord = {
    id,
    admNo: safeAdmNo,
    registrationNo: safeAdmNo,
    htNo: safeHtNo,
    candidateName: (record.candidateName || '').trim(),
    fatherName: (record.fatherName || '').trim(),
    courseTitle: (record.courseTitle || '').trim(),
    courseCode: (record.courseCode || '').trim(),
    startDate: record.startDate || '',
    endDate: record.endDate || '',
    division: record.division || 'FIRST CLASS',
    issueDate: record.issueDate || new Date().toISOString().split('T')[0],
    branchAddress: (record.branchAddress || record.trainingCenter || '').trim(),
    trainingCenter: (record.trainingCenter || record.branchAddress || '').trim(),
    photoUrl: record.photoUrl || '',
    certificateFee: feeAmount,
    feeAmount: feeAmount,
    paymentStatus,
    isPaid,
    isCertPaid: isPaid,
    paymentMode: record.paymentMode || 'live',
    razorpayPaymentId: record.razorpayPaymentId || '',
    createdAt: record.createdAt || timestamp,
    issuedAt: record.issuedAt || new Date().toLocaleString(),
    savedBy: record.savedBy || 'Admin'
  };

  // 1. Update localStorage cache
  try {
    const existing = getStoredCertificateHistory();
    // Replace if same ID exists, or prepend
    const index = existing.findIndex(item => item.id === id || (item.admNo === safeAdmNo && item.admNo !== 'UNKNOWN'));
    let updated;
    if (index >= 0) {
      updated = [...existing];
      updated[index] = { ...updated[index], ...cleanRecord };
    } else {
      updated = [cleanRecord, ...existing];
    }
    saveStoredCertificateHistory(updated);
  } catch (err) {
    console.warn('Could not cache cert history locally:', err);
  }

  // 2. Also register in sle_registered_certificates for compatibility with CertificatePage
  try {
    const storedCertificates = JSON.parse(localStorage.getItem('sle_registered_certificates') || '{}');
    storedCertificates[safeAdmNo] = cleanRecord;
    if (safeHtNo) storedCertificates[safeHtNo] = cleanRecord;
    localStorage.setItem('sle_registered_certificates', JSON.stringify(storedCertificates));
  } catch (e) {
    console.warn('Error updating sle_registered_certificates:', e);
  }

  // 3. Save to Firestore collection `certificate_history`
  if (dbInstance) {
    try {
      const docRef = doc(dbInstance, CERT_HISTORY_COLLECTION, id);
      await setDoc(docRef, cleanRecord, { merge: true });

      // Also merge into `certificates` doc for the student
      try {
        const studentCertRef = doc(dbInstance, 'certificates', safeAdmNo.replace(/\//g, '_'));
        await setDoc(studentCertRef, cleanRecord, { merge: true });
      } catch (innerErr) {
        console.warn('Could not update individual certificates doc:', innerErr);
      }
    } catch (firestoreErr) {
      console.error('Error writing certificate history to Firestore:', firestoreErr);
    }
  }

  return cleanRecord;
}

/**
 * Delete a certificate history entry from localStorage & Firestore.
 */
export async function deleteCertificateHistory(id, dbInstance = db) {
  // 1. Remove from localStorage
  try {
    const existing = getStoredCertificateHistory();
    const filtered = existing.filter(item => item.id !== id);
    saveStoredCertificateHistory(filtered);
  } catch (err) {
    console.warn('Error deleting certificate from local storage:', err);
  }

  // 2. Remove from Firestore
  if (dbInstance && id) {
    try {
      await deleteDoc(doc(dbInstance, CERT_HISTORY_COLLECTION, id));
    } catch (err) {
      console.error('Error deleting certificate from Firestore:', err);
    }
  }
}

/**
 * Update the payment status of a certificate history record.
 * Allowed statuses: 'Pending Payment' | 'Successful Payment' | 'Failed Payment'
 */
export async function updateCertificatePaymentStatus(id, newStatus, dbInstance = db) {
  const allowed = ['Pending Payment', 'Successful Payment', 'Failed Payment'];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}`);
  }

  const isPaid = newStatus === 'Successful Payment';

  // 1. Update localStorage cache
  try {
    const existing = getStoredCertificateHistory();
    const index = existing.findIndex(item => item.id === id);
    if (index >= 0) {
      const updated = [...existing];
      updated[index] = {
        ...updated[index],
        paymentStatus: newStatus,
        isPaid,
        isCertPaid: isPaid
      };
      saveStoredCertificateHistory(updated);
    }
  } catch (err) {
    console.warn('Error updating status in local storage:', err);
  }

  // 2. Update Firestore
  if (dbInstance && id) {
    try {
      const docRef = doc(dbInstance, CERT_HISTORY_COLLECTION, id);
      await setDoc(docRef, {
        paymentStatus: newStatus,
        isPaid,
        isCertPaid: isPaid
      }, { merge: true });
    } catch (err) {
      console.error('Error updating status in Firestore:', err);
    }
  }
}

/**
 * Real-time listener for Certificate History.
 * Returns unsubscribe function.
 */
export function subscribeToCertificateHistory(callback, dbInstance = db) {
  // Immediately dispatch stored cache for zero-lag initial render
  const localData = getStoredCertificateHistory();
  callback(localData);

  if (!dbInstance) {
    return () => {};
  }

  try {
    const historyCol = collection(dbInstance, CERT_HISTORY_COLLECTION);
    const unsubscribe = onSnapshot(
      historyCol,
      (snapshot) => {
        const items = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Sort latest first (by createdAt desc or issueDate desc)
        items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        // Merge with local cache so newly created local records don't vanish if sync is pending
        const localItems = getStoredCertificateHistory();
        const mergedMap = new Map();
        
        // Put Firestore items first
        items.forEach(it => mergedMap.set(it.id || it.admNo, it));
        // Add any local items not yet in Firestore
        localItems.forEach(it => {
          const key = it.id || it.admNo;
          if (!mergedMap.has(key)) {
            mergedMap.set(key, it);
          }
        });

        const mergedList = Array.from(mergedMap.values()).map(normalizeCertificateHistoryItem);
        mergedList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        saveStoredCertificateHistory(mergedList);
        callback(mergedList);
      },
      (error) => {
        console.warn('Firestore certificate history snapshot listener warning:', error);
        callback(getStoredCertificateHistory());
      }
    );

    return unsubscribe;
  } catch (err) {
    console.error('Error setting up certificate history snapshot:', err);
    return () => {};
  }
}
