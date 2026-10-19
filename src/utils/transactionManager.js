import { db, collection, getDocs, doc, setDoc, deleteDoc } from '../firebase';

const CACHE_KEY = 'sle_transactions_cache';
const DEFAULT_GATEWAY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_RAZORPAY_MODE === 'live') ? 'Razorpay Live' : 'Razorpay Test';

/**
 * Helper to safely parse any date/time format (ISO, DD/MM/YYYY, MM/DD/YYYY, timestamp, etc.) into numeric milliseconds
 */
export function parseDateToTimestamp(val) {
  if (!val) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'object') {
    if (typeof val.toMillis === 'function') return val.toMillis();
    if (typeof val.toDate === 'function') return val.toDate().getTime();
    if (typeof val.seconds === 'number') return val.seconds * 1000;
  }
  const str = String(val).trim();
  if (!str) return 0;

  // Check if pure numeric timestamp string
  const asNum = Number(str);
  if (!isNaN(asNum) && asNum > 100000000000) return asNum;

  // ISO YYYY-MM-DD or ISO timestamp
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const t = new Date(str).getTime();
    if (!isNaN(t)) return t;
  }

  // Handle DD/MM/YYYY or DD-MM-YYYY or MM/DD/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[,\s]+(.*))?$/i);
  if (dmyMatch) {
    let [, part1, part2, year, timePart] = dmyMatch;
    let day = parseInt(part1, 10);
    let month = parseInt(part2, 10);
    if (month > 12 && day <= 12) {
      const tmp = day; day = month; month = tmp;
    }
    let hours = 10, minutes = 0, seconds = 0;
    if (timePart) {
      const timeMatch = timePart.trim().match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        minutes = parseInt(timeMatch[2], 10);
        seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
        const ampm = timeMatch[4] ? timeMatch[4].toLowerCase() : null;
        if (ampm === 'pm' && hours < 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;
      }
    }
    const d = new Date(parseInt(year, 10), month - 1, day, hours, minutes, seconds);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  const nativeParsed = new Date(str).getTime();
  return isNaN(nativeParsed) ? 0 : nativeParsed;
}

/**
 * Normalizes a student record into a transaction object
 */
export function normalizeStudentTransaction(s) {
  const paymentId = s.razorpayPaymentId || s.paymentId || (s.paymentStatus === 'Paid' ? `pay_std_${s.appNumber || s.registrationNo || s.certRegNo || s.id}` : '');
  const orderId = s.razorpayOrderId || s.orderId || '';
  const amount = Number(s.feeAmount || s.amount || 496);
  const now = new Date();
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const date = s.createdDate || s.admissionDate || (s.submittedAt ? String(s.submittedAt).split(',')[0] : localToday);
  const dateTime = s.submittedAt || (s.createdAt ? new Date(s.createdAt).toLocaleString() : `${date} 10:00:00 AM`);
  const branchName = (s.trustBranch || s.place || s.location || s.branch || s.branchName || s.franchiseName || 'Main Branch').trim();
  const franchiseeId = s.franchiseeId || s.environmentId || (branchName ? `FR-${branchName.toUpperCase()}` : '');

  const isCert = s.type === 'certificate_admission' || s.isCertificateStudent || Boolean(s.certRegNo) || (s.course && String(s.course).toLowerCase().includes('cert'));

  const parsedCreatedAt = parseDateToTimestamp(s.createdAt) || 
                         parseDateToTimestamp(s.submittedAt) || 
                         parseDateToTimestamp(s.createdDate) || 
                         parseDateToTimestamp(s.admissionDate) || 
                         0;

  return {
    id: paymentId || `txn_std_${s.appNumber || s.registrationNo || s.certRegNo || s.id}`,
    transactionId: paymentId || `TXN-SLE-${s.registrationNo || s.certRegNo || s.appNumber || Date.now()}`,
    paymentId: paymentId,
    orderId: orderId,
    type: isCert ? 'certificate_admission' : 'student_admission',
    typeLabel: isCert ? 'Certificate Admission Fee' : 'Student Admission Fee',
    title: isCert ? `Cert Admission Fee - ${s.fullName || 'Student'}` : `Admission Fee - ${s.fullName || 'Student'}`,
    description: isCert ? `Certificate Admission Fee for ${s.course || 'Certificate Course'}` : `Admission & Registration Fee for ${s.course || 'Certificate Course'}`,
    payerName: s.fullName || 'Registered Student',
    payerEmail: s.email || '',
    payerPhone: s.contactNo || s.phone || '',
    registrationNo: s.certRegNo || s.registrationNo || s.regNo || '',
    appNumber: s.appNumber || '',
    course: s.course || s.certificateCourse || '',
    branch: branchName,
    franchiseeId: franchiseeId,
    franchiseName: s.franchiseName || branchName,
    amount: amount,
    currency: 'INR',
    paymentMethod: s.paymentMethod || 'Razorpay',
    gateway: s.gateway || DEFAULT_GATEWAY,
    status: s.paymentStatus === 'Paid' || paymentId ? 'Paid' : (s.paymentStatus || 'Pending'),
    date: date,
    dateTime: dateTime,
    createdAt: parsedCreatedAt || Date.now()
  };
}

/**
 * Helper to get normalized numeric timestamp for strict descending sorting
 */
export function getTxnTimestamp(t) {
  if (!t) return 0;
  if (t.createdAt) {
    const ts = parseDateToTimestamp(t.createdAt);
    if (ts > 0) return ts;
  }
  if (t.dateTime) {
    const ts = parseDateToTimestamp(t.dateTime);
    if (ts > 0) return ts;
  }
  if (t.date) {
    const ts = parseDateToTimestamp(t.date);
    if (ts > 0) return ts;
  }
  if (t.submittedAt) {
    const ts = parseDateToTimestamp(t.submittedAt);
    if (ts > 0) return ts;
  }
  if (t.admissionDate) {
    const ts = parseDateToTimestamp(t.admissionDate);
    if (ts > 0) return ts;
  }
  return 0;
}

/**
 * Normalizes a franchisee onboarding record into a transaction object
 */
export function normalizeFranchiseeTransaction(f) {
  const isRenewal = (f.planId && f.planId.toLowerCase().includes('renew')) || 
                    (f.planName && f.planName.toLowerCase().includes('renew')) ||
                    (f.plan && f.plan.toLowerCase().includes('renew')) ||
                    Boolean(f.lastRenewalDate && f.lastRenewalDate !== f.createdDate);
  const paymentId = f.razorpayPaymentId || f.renewalPaymentId || f.paymentId || (f.paymentStatus === 'Paid' ? `pay_fr_${f.id}` : '');
  const orderId = f.razorpayOrderId || f.renewalOrderId || f.orderId || '';
  const amount = Number(f.feeAmount || f.amount || (isRenewal ? 2000 : 20000));
  
  // Use today's local date YYYY-MM-DD if no date exists
  const now = new Date();
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const date = (isRenewal && f.lastRenewalDate)
    ? f.lastRenewalDate
    : (f.createdDate || f.purchaseDate || localToday);
  const dateTime = f.dateTime || (f.updatedAt ? new Date(f.updatedAt).toLocaleString() : (f.createdAt ? new Date(f.createdAt).toLocaleString() : `${date} 10:00:00 AM`));
  const branchName = (f.place || f.location || f.franchiseName || 'Main Branch').trim();

  const parsedCreatedAt = parseDateToTimestamp(f.createdAt) || 
                         parseDateToTimestamp(f.createdDate) || 
                         parseDateToTimestamp(f.purchaseDate) || 
                         parseDateToTimestamp(date) || 
                         0;

  return {
    id: paymentId || `txn_fr_${f.id}`,
    transactionId: paymentId || `TXN-FR-${f.id || Date.now()}`,
    paymentId: paymentId,
    orderId: orderId,
    type: isRenewal ? 'franchisee_renewal' : 'franchisee_onboarding',
    typeLabel: isRenewal ? 'Franchisee Plan Renewal' : 'Franchisee Onboarding Fee',
    title: isRenewal ? `Franchisee Plan Renewal - ${f.franchiseName || f.centerName || branchName}` : `Franchisee Portal Onboarding - ${f.franchiseName || f.centerName || branchName}`,
    description: f.planName ? `${f.planName}` : (isRenewal ? 'Franchisee Subscription Renewal' : '1-Year First-Time Franchisee Onboarding'),
    payerName: f.ownerName || f.fullName || f.franchiseName || 'Franchisee Owner',
    payerEmail: f.email || '',
    payerPhone: f.phone || f.contactNumber || '',
    registrationNo: f.instituteCode || f.id || '',
    franchiseeId: f.id || `FR-${branchName.toUpperCase()}`,
    franchiseName: f.franchiseName || f.centerName || branchName,
    branch: branchName,
    planName: f.planName || (isRenewal ? 'Renewal Plan' : 'First-Time Franchisee Onboarding'),
    amount: amount,
    currency: 'INR',
    paymentMethod: f.paymentMethod || 'Razorpay',
    gateway: f.gateway || DEFAULT_GATEWAY,
    status: f.paymentStatus === 'Paid' || paymentId ? 'Paid' : (f.status === 'Active' ? 'Paid' : (f.paymentStatus || 'Pending')),
    date: date,
    dateTime: dateTime,
    createdAt: (isRenewal && f.updatedAt) ? (parseDateToTimestamp(f.updatedAt) || parsedCreatedAt) : (parsedCreatedAt || 0)
  };
}

/**
 * Fetches all transactions using cache-first pattern with instant background Firestore merge
 */
export async function fetchTransactions({ isManual = false } = {}) {
  const transactionMap = new Map();

  // Helper to add or merge a transaction
  const addTxn = (txn) => {
    if (!txn || !txn.id) return;
    const key = String(txn.paymentId || txn.transactionId || txn.id).toLowerCase();
    if (!transactionMap.has(key)) {
      transactionMap.set(key, txn);
    } else {
      const existing = transactionMap.get(key);
      // Prioritize explicitly recorded transactions over synthetic generated objects
      if (existing._isRecorded && !txn._isRecorded) {
        transactionMap.set(key, { ...txn, ...existing });
      } else {
        transactionMap.set(key, { ...existing, ...txn });
      }
    }
  };

  const isStubTarget = (id, pid) => {
    const sId = String(id || '');
    const sPid = String(pid || '');
    return sId.includes('202638042') || sId.includes('202638043') ||
           sPid.includes('pay_TczRsFdXX') || sPid.includes('pay_TZtldVsh') || sPid.includes('pay_TZt1dvsh');
  };

  // Step 1: Load Local Caches First
  try {
    const cachedTxns = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
    cachedTxns.forEach(addTxn);

    // Also parse cached students, cert students, and franchisees
    const cachedStudents = JSON.parse(localStorage.getItem('sle_students_cache') || '[]');
    const cachedCertStudents = JSON.parse(localStorage.getItem('sle_cert_students_cache') || '[]');
    const cachedCoaching = JSON.parse(localStorage.getItem('sle_coaching_students_cache') || '[]');
    const cachedApps = JSON.parse(localStorage.getItem('sle_applications_cache') || '[]');
    const cachedFranchisees = JSON.parse(localStorage.getItem('sle_franchisees_cache') || '[]');

    [...cachedStudents, ...cachedCertStudents, ...cachedCoaching, ...cachedApps].forEach(s => {
      if (s && (s.paymentStatus === 'Paid' || s.razorpayPaymentId || s.feeAmount)) {
        if (isStubTarget(s.id || s.registrationNo || s.certRegNo || s.appNumber, s.razorpayPaymentId || s.paymentId)) return;
        const name = (s.fullName || s.name || s.studentName || '').trim();
        if (name && name.toLowerCase() !== 'registered student') {
          addTxn(normalizeStudentTransaction(s));
        }
      }
    });

    cachedFranchisees.forEach(f => {
      if (f && (f.paymentStatus === 'Paid' || f.razorpayPaymentId || f.feeAmount || f.status === 'Active')) {
        addTxn(normalizeFranchiseeTransaction(f));
        if (f.renewalPaymentId && f.renewalPaymentId !== f.razorpayPaymentId) {
          const now = new Date();
          const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const rDate = f.lastRenewalDate || localToday;
          addTxn({
            id: f.renewalPaymentId,
            transactionId: f.renewalPaymentId,
            paymentId: f.renewalPaymentId,
            orderId: f.renewalOrderId || '',
            type: 'franchisee_renewal',
            typeLabel: 'Franchisee Plan Renewal',
            title: `Franchisee Plan Renewal - ${f.franchiseName || f.centerName || f.place || 'Franchisee'}`,
            description: f.planName ? `${f.planName} (Valid till ${f.endDate})` : 'Portal Renewal Subscription',
            payerName: f.ownerName || f.fullName || f.franchiseName || 'Franchisee Owner',
            payerEmail: f.email || '',
            payerPhone: f.phone || f.contactNumber || '',
            registrationNo: f.instituteCode || f.id || '',
            franchiseeId: f.id,
            franchiseName: f.franchiseName || f.centerName || f.place,
            branch: (f.place || f.location || f.franchiseName || 'Main Branch').trim(),
            planName: f.planName || 'Renewal Plan',
            amount: Number(f.feeAmount || 1000),
            currency: 'INR',
            paymentMethod: 'Razorpay',
            gateway: DEFAULT_GATEWAY,
            status: 'Paid',
            date: rDate,
            dateTime: `${rDate} 10:00:00 AM`,
            createdAt: parseDateToTimestamp(f.updatedAt) || parseDateToTimestamp(rDate) || Date.now()
          });
        }
      }
    });
  } catch (err) {
    console.warn('Local transactions cache read notice:', err);
  }

  // Step 2: Fetch directly from Firestore without short timeouts
  if (db) {
    let hasRemoteUpdate = false;
    try {
      // 2a. Fetch dedicated 'transactions' collection (PRIMARY: fast and contains all online gateway payments)
      try {
        const txnSnap = await getDocs(collection(db, 'transactions'));
        txnSnap.forEach(d => {
          const data = d.data();
          if (!isStubTarget(d.id, data.paymentId || data.transactionId)) {
            addTxn({ id: d.id, ...data, _isRecorded: true });
          }
        });
        hasRemoteUpdate = true;
      } catch (txnErr) {
        console.warn('Firestore transactions collection fetch notice:', txnErr);
      }

      // 2b. Fetch 'students', 'cert_students', 'applications', 'franchisees' to merge all student admission payments
      try {
        const [studentsSnap, certSnap, appsSnap, franchiseesSnap] = await Promise.allSettled([
          getDocs(collection(db, 'students')),
          getDocs(collection(db, 'cert_students')),
          getDocs(collection(db, 'applications')),
          getDocs(collection(db, 'franchisees'))
        ]);

        if (studentsSnap.status === 'fulfilled') {
          studentsSnap.value.forEach(d => {
            const s = d.data();
            if (s && (s.paymentStatus === 'Paid' || s.razorpayPaymentId || s.feeAmount)) {
              if (isStubTarget(d.id || s.registrationNo || s.certRegNo || s.appNumber, s.razorpayPaymentId || s.paymentId)) return;
              const name = (s.fullName || s.name || s.studentName || '').trim();
              if (name && name.toLowerCase() !== 'registered student') {
                addTxn(normalizeStudentTransaction({ id: d.id, ...s }));
              }
            }
          });
          hasRemoteUpdate = true;
        }

        if (certSnap.status === 'fulfilled') {
          certSnap.value.forEach(d => {
            const s = d.data();
            if (s && (s.paymentStatus === 'Paid' || s.razorpayPaymentId || s.feeAmount)) {
              if (isStubTarget(d.id || s.registrationNo || s.certRegNo || s.appNumber, s.razorpayPaymentId || s.paymentId)) return;
              const name = (s.fullName || s.name || s.studentName || '').trim();
              if (name && name.toLowerCase() !== 'registered student') {
                addTxn(normalizeStudentTransaction({ id: d.id, ...s, type: 'certificate_admission' }));
              }
            }
          });
          hasRemoteUpdate = true;
        }

        if (appsSnap.status === 'fulfilled') {
          appsSnap.value.forEach(d => {
            const a = d.data();
            if (a && (a.paymentStatus === 'Paid' || a.razorpayPaymentId || a.feeAmount)) {
              if (isStubTarget(d.id || a.registrationNo || a.certRegNo || a.appNumber, a.razorpayPaymentId || a.paymentId)) return;
              const name = (a.fullName || a.name || a.studentName || '').trim();
              if (name && name.toLowerCase() !== 'registered student') {
                addTxn(normalizeStudentTransaction({ id: d.id, ...a }));
              }
            }
          });
          hasRemoteUpdate = true;
        }

        if (franchiseesSnap.status === 'fulfilled') {
          franchiseesSnap.value.forEach(d => {
            const f = d.data();
            if (f && (f.paymentStatus === 'Paid' || f.razorpayPaymentId || f.feeAmount || f.status === 'Active')) {
              addTxn(normalizeFranchiseeTransaction({ id: d.id, ...f }));
            }
          });
          hasRemoteUpdate = true;
        }
      } catch (fetchErr) {
        console.warn('Firestore collections sync notice:', fetchErr?.message || fetchErr);
      }

      // Save merged transactions back to cache when Firestore query succeeds
      const finalArr = Array.from(transactionMap.values()).sort((a, b) => getTxnTimestamp(b) - getTxnTimestamp(a));
      if (hasRemoteUpdate) {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(finalArr));
          localStorage.setItem('sle_transactions_last_fetch', String(Date.now()));
        } catch (e) { }
      }

      return finalArr;
    } catch (err) {
      console.error('Failed to fetch transactions from Firestore:', err);
    }
  }

  return Array.from(transactionMap.values()).sort((a, b) => getTxnTimestamp(b) - getTxnTimestamp(a));
}

/**
 * Saves a new transaction to Firestore 'transactions' collection and local cache
 */
export async function recordTransaction(txnData) {
  const id = txnData.paymentId || txnData.transactionId || `txn_${Date.now()}`;
  const now = new Date();
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  const completeTxn = {
    ...txnData,
    id,
    transactionId: id,
    status: txnData.status || 'Paid',
    paymentMethod: txnData.paymentMethod || 'Razorpay',
    gateway: txnData.gateway || DEFAULT_GATEWAY,
    currency: txnData.currency || 'INR',
    date: txnData.date || localToday,
    dateTime: txnData.dateTime || now.toLocaleString(),
    createdAt: txnData.createdAt || Date.now(),
    _isRecorded: true
  };

  // Update local cache immediately
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
    const filtered = cached.filter(t => t.id !== id && t.transactionId !== id);
    const updated = [completeTxn, ...filtered];
    localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
  } catch (e) { }

  // Dispatch real-time custom event so all open pages update instantly
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sle_transactions_updated', { detail: completeTxn }));
  }

  // Save to Firestore 'transactions' collection
  if (db) {
    try {
      await setDoc(doc(db, 'transactions', id), completeTxn, { merge: true });
      console.log('Saved transaction to Firestore:', id);
    } catch (err) {
      console.warn('Firestore transaction write notice (saved in local cache):', err?.message || err);
    }
  }

  return completeTxn;
}

/**
 * Exports transactions to CSV file
 */
export function exportTransactionsToCSV(transactions, filename = 'sle_payment_transactions.csv') {
  if (!transactions || transactions.length === 0) {
    alert('No transactions available to export.');
    return;
  }

  const headers = [
    'Transaction / Payment ID',
    'Razorpay Order ID',
    'Date & Time',
    'Payer Name',
    'Category',
    'Reg No / Franchisee ID',
    'Course / Plan',
    'Branch / Center',
    'Amount (INR)',
    'Payment Gateway',
    'Status'
  ];

  const rows = transactions.map(t => [
    `"${t.transactionId || t.paymentId || ''}"`,
    `"${t.orderId || ''}"`,
    `"${t.dateTime || t.date || ''}"`,
    `"${(t.payerName || '').replace(/"/g, '""')}"`,
    `"${t.typeLabel || t.type || ''}"`,
    `"${t.registrationNo || t.appNumber || t.franchiseeId || ''}"`,
    `"${(t.course || t.planName || '').replace(/"/g, '""')}"`,
    `"${(t.branch || t.franchiseName || '').replace(/"/g, '""')}"`,
    t.amount || 0,
    `"${t.gateway || t.paymentMethod || DEFAULT_GATEWAY}"`,
    `"${t.status || 'Paid'}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Permanently removes a transaction from local cache and Firestore
 */
export async function deleteTransaction(txnId, fullTxn = null) {
  if (!txnId) return;

  // 1. Remove from local cache
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
    const filtered = cached.filter(t => t.id !== txnId && t.transactionId !== txnId && t.paymentId !== txnId);
    localStorage.setItem(CACHE_KEY, JSON.stringify(filtered));
  } catch (e) { }

  // 2. Remove from Firestore
  if (db) {
    try {
      await deleteDoc(doc(db, 'transactions', txnId));
    } catch (e) { }

    if (fullTxn) {
      const altId = fullTxn.paymentId || fullTxn.transactionId;
      if (altId && altId !== txnId) {
        try { await deleteDoc(doc(db, 'transactions', altId)); } catch (e) { }
      }
      const regId = fullTxn.registrationNo || fullTxn.appNumber;
      if (regId && (!fullTxn.payerName || fullTxn.payerName === 'Registered Student')) {
        try { await deleteDoc(doc(db, 'students', regId)); } catch (e) { }
        try { await deleteDoc(doc(db, 'applications', regId)); } catch (e) { }
      }
    }
  }
}

