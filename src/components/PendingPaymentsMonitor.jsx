import React, { useState, useEffect } from 'react';
import {
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  User,
  Phone,
  Mail,
  BookOpen,
  MapPin,
  Calendar,
  IndianRupee,
  X,
  Eye,
  FileText,
  Download,
  ExternalLink,
  ZoomIn,
  GraduationCap,
  Building,
  CreditCard,
  ShieldCheck,
  CheckSquare,
  FileCheck
} from 'lucide-react';
import { collection, getDocs, doc, setDoc, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';
import { allocateNextRegistrationNo } from '../utils/registrationManager';
import { allocateNextCertRegistrationNo } from '../utils/certRegistrationManager';
import { recordTransaction } from '../utils/transactionManager';

export default function PendingPaymentsMonitor({ isDarkMode = false, showToast = () => {}, db }) {
  const [pendingList, setPendingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activatingId, setActivatingId] = useState(null);
  const [dismissingId, setDismissingId] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [viewDocument, setViewDocument] = useState(null);

  // Merge pending_payments + webhook_activations + local cache into one unified list
  // webhook_activations = payment confirmed by Razorpay server but browser was closed
  // pending_payments    = payment initiated but not yet confirmed
  const mergeAllSources = (pendingList = [], webhookList = []) => {
    try {
      const localList = JSON.parse(localStorage.getItem('sle_pending_payments_cache') || '[]');
      const map = new Map();

      // 1. Local cache (lowest priority)
      localList.forEach(item => {
        if (item && item.id) map.set(item.id, { ...item, _source: item._source || 'local' });
      });

      // 2. pending_payments from Firestore
      pendingList.forEach(item => {
        if (item && item.id) {
          map.set(item.id, { ...(map.get(item.id) || {}), ...item, _source: 'pending_payments' });
        }
      });

      // 3. webhook_activations — payment captured by Razorpay (highest priority; always overwrite)
      webhookList.forEach(item => {
        if (item && item.id) {
          // Merge with existing data (webhook record may have less form data)
          const existing = map.get(item.id) || {};
          map.set(item.id, {
            ...existing,
            ...item,
            // Preserve rich form data from pending_payments if available
            fullName: item.customerName || existing.fullName || item.fullName || 'Unknown',
            email: item.customerEmail || existing.email || item.email || '',
            contactNo: item.customerPhone || existing.contactNo || item.contactNo || '',
            course: item.course || existing.course || '',
            trustBranch: item.branch || existing.trustBranch || item.trustBranch || '',
            feeAmount: item.amountRs || existing.feeAmount || 0,
            razorpayPaymentId: item.paymentId || existing.razorpayPaymentId || '',
            razorpayOrderId: item.orderId || existing.razorpayOrderId || '',
            paymentStatus: 'Captured',
            _source: 'webhook_activations'
          });
        }
      });

      // Filter out records already activated (moved to students collection)
      const combined = Array.from(map.values()).filter(item =>
        item.status !== 'Submitted' && item.paymentStatus !== 'Dismissed'
      );
      combined.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return combined;
    } catch (e) {
      return pendingList;
    }
  };

  // Keep backward compat reference
  const mergeWithLocalCache = (firestoreList = []) => mergeAllSources(firestoreList, []);

  const loadPendingPayments = async () => {
    setLoading(true);
    try {
      const [pendingSnap, webhookSnap] = await Promise.all([
        getDocs(collection(db, 'pending_payments')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'webhook_activations')).catch(() => ({ docs: [] }))
      ]);
      const pendingList = pendingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const webhookList = webhookSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPendingList(mergeAllSources(pendingList, webhookList));
    } catch (err) {
      console.warn('Error loading pending payments (using local cache):', err?.message || err);
      setPendingList(mergeWithLocalCache([]));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Show cached records immediately
    const cached = mergeWithLocalCache([]);
    if (cached.length > 0) {
      setPendingList(cached);
      setLoading(false);
    }

    const handleLocalUpdate = (e) => {
      setPendingList(prev => mergeWithLocalCache(prev));
    };
    window.addEventListener('sle_pending_payments_updated', handleLocalUpdate);

    if (!db) {
      return () => window.removeEventListener('sle_pending_payments_updated', handleLocalUpdate);
    }

    setLoading(true);

    // Real-time listeners on BOTH pending_payments AND webhook_activations
    let pendingDocs = [];
    let webhookDocs = [];
    let unsubPending, unsubWebhook;

    const refresh = () => setPendingList(mergeAllSources(pendingDocs, webhookDocs));

    unsubPending = onSnapshot(collection(db, 'pending_payments'), (snap) => {
      pendingDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      refresh();
      setLoading(false);
    }, (err) => {
      console.warn('pending_payments listener notice:', err?.message || err);
      setLoading(false);
    });

    unsubWebhook = onSnapshot(collection(db, 'webhook_activations'), (snap) => {
      webhookDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      refresh();
      setLoading(false);
    }, (err) => {
      console.warn('webhook_activations listener notice:', err?.message || err);
    });

    return () => {
      window.removeEventListener('sle_pending_payments_updated', handleLocalUpdate);
      unsubPending && unsubPending();
      unsubWebhook && unsubWebhook();
    };
  }, [db]);

  // Manually activate a pending student — allocates reg no and moves to real collections
  const handleActivate = async (student) => {
    setActivatingId(student.id);
    try {
      const isCert = student.type === 'certificate_admission' || student.isCertificateStudent;
      const targetDate = student.admissionDate || student.createdDate || new Date();
      const finalRegNo = isCert
        ? await allocateNextCertRegistrationNo(db, targetDate)
        : await allocateNextRegistrationNo(db, targetDate);
      const now = new Date();
      const activatedRecord = {
        ...student,
        registrationNo: String(finalRegNo),
        regNo: String(finalRegNo),
        paymentStatus: 'Paid',
        status: 'Submitted',
        submittedAt: now.toLocaleString(),
        activatedByAdmin: true,
        activatedAt: now.toISOString(),
        // Normalize fields that may come from webhook_activations
        fullName: student.fullName || student.customerName || 'Unknown',
        name: student.fullName || student.customerName || 'Unknown',
        email: student.email || student.customerEmail || '',
        contactNo: student.contactNo || student.customerPhone || '',
        mobileNo: student.contactNo || student.customerPhone || '',
        trustBranch: student.trustBranch || student.branch || '',
        place: student.trustBranch || student.branch || '',
        feeAmount: student.feeAmount || student.amountRs || 0,
        razorpayPaymentId: student.razorpayPaymentId || student.paymentId || '',
        razorpayOrderId: student.razorpayOrderId || student.orderId || '',
      };
      // Remove internal tracking fields before saving
      delete activatedRecord.draftSavedAt;
      delete activatedRecord._source;

      await Promise.all([
        setDoc(doc(db, 'students', student.id), activatedRecord, { merge: true }),
        setDoc(doc(db, 'applications', student.id), activatedRecord, { merge: true }),
        setDoc(doc(db, 'coaching_students', student.id), activatedRecord, { merge: true })
      ]);

      // Record the transaction
      try {
        await recordTransaction({
          transactionId: activatedRecord.razorpayPaymentId || `pay_manual_${student.id}`,
          paymentId: activatedRecord.razorpayPaymentId || `pay_manual_${student.id}`,
          orderId: activatedRecord.razorpayOrderId || '',
          type: 'student_admission',
          typeLabel: 'Student Admission Fee',
          title: `Admission Fee - ${activatedRecord.fullName}`,
          description: `Admission fee for ${activatedRecord.course || 'Certificate Course'} (Activated from ${student._source || 'pending'})`,
          payerName: activatedRecord.fullName,
          payerEmail: activatedRecord.email || '',
          payerPhone: activatedRecord.contactNo || '',
          registrationNo: String(finalRegNo),
          appNumber: student.id,
          course: activatedRecord.course || '',
          branch: activatedRecord.trustBranch || '',
          franchiseeId: activatedRecord.franchiseeId || '',
          franchiseName: activatedRecord.franchiseName || '',
          amount: activatedRecord.feeAmount || 0,
          status: 'Paid',
          paymentMethod: 'Razorpay',
          gateway: student._source === 'webhook_activations' ? 'Razorpay (Webhook Captured)' : 'Razorpay',
          date: now.toISOString().split('T')[0],
          dateTime: now.toLocaleString(),
          createdAt: Date.now()
        });
      } catch (txnErr) {
        console.warn('Transaction record warning:', txnErr);
      }

      // Remove from BOTH pending_payments AND webhook_activations
      try { await deleteDoc(doc(db, 'pending_payments', student.id)); } catch (e) {}
      try { await deleteDoc(doc(db, 'webhook_activations', student.id)); } catch (e) {}
      try {
        const existing = JSON.parse(localStorage.getItem('sle_pending_payments_cache') || '[]');
        const filtered = existing.filter(p => p && p.id !== student.id);
        localStorage.setItem('sle_pending_payments_cache', JSON.stringify(filtered));
        window.dispatchEvent(new CustomEvent('sle_pending_payments_updated', { detail: filtered }));
      } catch (e) {}

      showToast(`✅ ${activatedRecord.fullName} activated! Registration No: ${finalRegNo}`, 'success');
      setPendingList(prev => prev.filter(p => p.id !== student.id));
      if (selectedStudent?.id === student.id) setSelectedStudent(null);
    } catch (err) {
      console.error('Error activating student:', err);
      showToast(`Error activating student. Please try again.`, 'error');
    } finally {
      setActivatingId(null);
    }
  };

  // Dismiss/discard a pending payment (student abandoned or failed)
  const handleDismiss = async (student) => {
    if (!window.confirm(`Dismiss "${student.fullName || student.customerName}"? This will remove their pending record permanently.`)) return;
    setDismissingId(student.id);
    try {
      // Remove from BOTH collections
      try { await deleteDoc(doc(db, 'pending_payments', student.id)); } catch (e) {}
      try { await deleteDoc(doc(db, 'webhook_activations', student.id)); } catch (e) {}
      try {
        const existing = JSON.parse(localStorage.getItem('sle_pending_payments_cache') || '[]');
        const filtered = existing.filter(p => p && p.id !== student.id);
        localStorage.setItem('sle_pending_payments_cache', JSON.stringify(filtered));
        window.dispatchEvent(new CustomEvent('sle_pending_payments_updated', { detail: filtered }));
      } catch (e) {}
      showToast(`Dismissed pending record for ${student.fullName || student.customerName}`, 'info');
      setPendingList(prev => prev.filter(p => p.id !== student.id));
      if (selectedStudent?.id === student.id) setSelectedStudent(null);
    } catch (err) {
      showToast('Error dismissing record. Please try again.', 'error');
    } finally {
      setDismissingId(null);
    }
  };

  const isPdf = (url, fileType, fileName) => {
    if (fileType === 'pdf') return true;
    if (typeof fileName === 'string' && fileName.toLowerCase().endsWith('.pdf')) return true;
    if (typeof url === 'string') {
      if (url.startsWith('data:application/pdf')) return true;
      if (url.toLowerCase().includes('.pdf')) return true;
    }
    return false;
  };

  const formatDob = (s) => {
    if (s.dateOfBirth) return s.dateOfBirth;
    if (s.dobDay && s.dobMonth && s.dobYear) {
      return `${s.dobDay}/${s.dobMonth}/${s.dobYear}`;
    }
    return '—';
  };

  const bg = isDarkMode ? 'bg-slate-900' : 'bg-slate-50';
  const card = isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const text = isDarkMode ? 'text-white' : 'text-slate-900';
  const subtext = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="w-full max-w-full space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-950/60 rounded-xl shrink-0">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h1 className={`text-xl sm:text-2xl font-black ${text} tracking-tight`}>
              Pending Payments Monitor
            </h1>
          </div>
        </div>
        <button
          onClick={loadPendingPayments}
          disabled={loading}
          className="self-start sm:self-auto flex items-center justify-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl font-bold text-xs sm:text-sm transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-500/20 shrink-0 active:scale-95"
        >
          <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Info Banner */}
      <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-indigo-50/80 via-purple-50/40 to-white dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-slate-900 border border-indigo-200/80 dark:border-indigo-800/50 rounded-2xl flex items-start gap-2.5 sm:gap-3">
        <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
        <div className="text-xs sm:text-sm">
          <p className="font-bold text-indigo-950 dark:text-indigo-200">What are Pending Payments?</p>
          <p className="text-indigo-900/80 dark:text-indigo-300 mt-0.5 text-[11px] sm:text-xs leading-relaxed">
            These students filled the form and <strong>payment may have been captured by Razorpay</strong>, but their browser
            closed or disconnected before the system saved them to the main student list.
            Before activating, verify on{' '}
            <a href="https://dashboard.razorpay.com" target="_blank" rel="noopener noreferrer" className="underline font-bold text-indigo-900 dark:text-indigo-200 hover:text-indigo-600">
              Razorpay Dashboard
            </a>{' '}
            that payment was truly captured.
          </p>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <span className={`ml-3 text-lg ${subtext}`}>Loading pending payments...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && pendingList.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="p-6 bg-green-50 rounded-3xl mb-4">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          </div>
          <h3 className={`text-xl font-bold ${text} mb-2`}>All Clear!</h3>
          <p className={`text-sm ${subtext}`}>No pending payments found. All student admissions are properly recorded.</p>
        </div>
      )}

      {/* Pending Payment Cards */}
      {!loading && pendingList.length > 0 && (
        <div className="space-y-3 sm:space-y-4">
          <p className={`text-xs sm:text-sm font-bold ${subtext} px-1`}>
            {pendingList.length} pending record{pendingList.length > 1 ? 's' : ''} found
          </p>
          {pendingList.map(student => (
            <div key={student.id} className={`${card} border rounded-2xl p-3.5 sm:p-5 shadow-sm hover:shadow-md transition-shadow overflow-hidden`}>
              <div className={`flex flex-col md:flex-row md:items-start md:justify-between gap-3 sm:gap-4 relative ${(student._source === 'webhook_activations' || student.paymentStatus === 'Captured') ? 'after:absolute after:left-0 after:top-0 after:bottom-0 after:w-1 after:bg-emerald-500 after:rounded-l-full' : ''}`}>
                {/* Student Info with Avatar Thumbnail */}
                <div className="flex-1 space-y-2.5 min-w-0">
                  <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                    {student.photoPreview || student.photoUrl ? (
                      <img
                        src={student.photoPreview || student.photoUrl}
                        alt={student.fullName}
                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover border border-indigo-200 dark:border-indigo-800 shadow-sm shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 sm:w-12 sm:h-12 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 dark:text-indigo-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <p className={`font-bold text-sm sm:text-base ${text} truncate max-w-[150px] xs:max-w-none`}>
                          {student.fullName || student.name || 'Unknown'}
                        </p>
                        {student._source === 'webhook_activations' || student.paymentStatus === 'Captured' ? (
                          <span className="px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-700/60 text-[10px] sm:text-xs font-bold rounded-full shrink-0 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Payment Captured
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/60 text-[10px] sm:text-xs font-bold rounded-full shrink-0">
                            Pending Payment
                          </span>
                        )}
                      </div>
                      <p className={`text-[11px] sm:text-xs ${subtext} break-all mt-0.5`}>
                        App No: <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{student.id}</span>
                      </p>
                    </div>
                  </div>

                  {/* Student Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 sm:gap-x-6 sm:gap-y-1.5 text-xs sm:text-sm pl-0 sm:pl-14">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 min-w-0">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <a href={`tel:${student.contactNo || student.mobileNo}`} className="font-medium text-slate-800 dark:text-slate-200 hover:text-indigo-600 truncate">
                        {student.contactNo || student.mobileNo || '—'}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 min-w-0">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate text-slate-700 dark:text-slate-300" title={student.email}>
                        {student.email || '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 min-w-0">
                      <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={student.course}>
                        {student.course || '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 min-w-0">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate text-slate-700 dark:text-slate-300">
                        {student.trustBranch || student.place || '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 min-w-0">
                      <IndianRupee className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        Rs {student.feeAmount || 496}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 min-w-0">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                        {student.draftSavedAt || student.createdDate || '—'}
                      </span>
                    </div>
                  </div>

                  {student.razorpayOrderId && (
                    <div className="pl-0 sm:pl-14">
                      <div className="bg-slate-50 dark:bg-slate-800/80 rounded-lg px-2.5 py-1 text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700 inline-flex flex-wrap items-center gap-1 max-w-full">
                        <span className="text-slate-500 shrink-0 font-medium">Razorpay Order:</span>
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 break-all select-all">
                          {student.razorpayOrderId}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions: Responsive Grid on Mobile, Row on Tablet, Col on Desktop */}
                <div className="grid grid-cols-2 sm:flex sm:items-center md:flex-col md:items-end gap-2 w-full md:w-auto pt-3 md:pt-0 border-t border-slate-100 dark:border-slate-800 md:border-t-0 shrink-0">
                  <button
                    onClick={() => setSelectedStudent(student)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600 dark:text-slate-300" />
                    <span>View Details</span>
                  </button>
                  <button
                    onClick={() => handleDismiss(student)}
                    disabled={dismissingId === student.id}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    {dismissingId === student.id ? (
                      <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    )}
                    <span>Dismiss</span>
                  </button>
                  <button
                    onClick={() => handleActivate(student)}
                    disabled={activatingId === student.id}
                    className="col-span-2 sm:col-span-1 w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors disabled:opacity-60 cursor-pointer shadow-sm"
                  >
                    {activatingId === student.id ? (
                      <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    )}
                    <span>{activatingId === student.id ? 'Activating...' : 'Activate'}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* COMPREHENSIVE APPLICATION DETAIL MODAL */}
      {selectedStudent && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setSelectedStudent(null)}
        >
          <div
            className="bg-white rounded-2xl sm:rounded-3xl max-w-4xl w-full p-4 sm:p-8 shadow-2xl border border-slate-200 my-4 sm:my-8 space-y-4 sm:space-y-6 max-h-[94vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-3 sm:pb-4 gap-2">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-700 shadow-sm shrink-0">
                  <FileCheck className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <h3 className="text-base sm:text-xl font-black text-slate-900 truncate max-w-[200px] sm:max-w-none">
                      {selectedStudent.fullName || selectedStudent.name}
                    </h3>
                    <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-800 border border-indigo-200/80 text-[10px] sm:text-xs font-bold rounded-full shrink-0">
                      Pending Draft
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-mono mt-0.5 truncate">App No: {selectedStudent.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="p-1.5 sm:p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Applicant Summary Banner with Photo */}
            <div className="bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20 rounded-2xl p-3.5 sm:p-5 border border-indigo-100 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 sm:gap-5">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4 text-center sm:text-left w-full sm:w-auto">
                {/* Photo Display */}
                <div className="relative group shrink-0">
                  <div className="w-20 h-28 sm:w-28 sm:h-36 rounded-xl border-2 border-slate-800 bg-white overflow-hidden shadow-md flex items-center justify-center">
                    {selectedStudent.photoPreview || selectedStudent.photoUrl ? (
                      <img
                        src={selectedStudent.photoPreview || selectedStudent.photoUrl}
                        alt="Student"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 p-2">
                        <User className="w-8 h-8 sm:w-10 sm:h-10 mb-1" />
                        <span className="text-[10px] font-bold">No Photo</span>
                      </div>
                    )}
                  </div>
                  {(selectedStudent.photoPreview || selectedStudent.photoUrl) && (
                    <button
                      type="button"
                      onClick={() => setViewDocument({
                        title: `Student Photo - ${selectedStudent.fullName}`,
                        preview: selectedStudent.photoPreview || selectedStudent.photoUrl,
                        fileType: 'image',
                        fileName: 'student_photo.jpg'
                      })}
                      className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex flex-col items-center justify-center text-white gap-1 cursor-pointer"
                    >
                      <ZoomIn className="w-5 h-5 text-indigo-300" />
                      <span className="text-[10px] font-bold">Enlarge</span>
                    </button>
                  )}
                </div>

                {/* Candidate Overview */}
                <div className="space-y-1 sm:space-y-1.5 w-full">
                  <h4 className="text-base sm:text-lg font-bold text-slate-900">{selectedStudent.fullName || 'Student'}</h4>
                  <p className="text-xs font-semibold text-slate-600 flex items-center justify-center sm:justify-start gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Course: <strong className="text-slate-900">{selectedStudent.course || '—'}</strong></span>
                  </p>
                  <p className="text-xs font-semibold text-slate-600 flex items-center justify-center sm:justify-start gap-1">
                    <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Branch: <strong className="text-slate-900">{selectedStudent.trustBranch || selectedStudent.place || '—'}</strong></span>
                  </p>
                  <p className="text-xs font-semibold text-slate-600 flex items-center justify-center sm:justify-start gap-1">
                    <Building className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Franchisee: <strong className="text-slate-900">{selectedStudent.franchiseName || '—'}</strong> ({selectedStudent.franchiseeId || '—'})</span>
                  </p>
                  <div className="pt-1 flex items-center gap-1.5 sm:gap-2 justify-center sm:justify-start flex-wrap">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] sm:text-xs font-bold rounded-lg flex items-center gap-1">
                      <IndianRupee className="w-3 h-3" /> Fee: Rs {selectedStudent.feeAmount || 496}
                    </span>
                    <span className="px-2 py-0.5 bg-sky-100 text-sky-800 text-[11px] sm:text-xs font-bold rounded-lg">
                      Class: {selectedStudent.selectedClass || '10th'}
                    </span>
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[11px] sm:text-xs font-bold rounded-lg">
                      Plan: {selectedStudent.trainingPlan || 'Regular'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Badge & Timestamp */}
              <div className="text-center sm:text-right shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                <span className="inline-block px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-[10px] sm:text-xs font-extrabold rounded-xl shadow-sm uppercase tracking-wider mb-1.5">
                  Draft Saved
                </span>
                <p className="text-[11px] sm:text-xs text-slate-500">Draft Timestamp:</p>
                <p className="text-[11px] sm:text-xs font-bold text-slate-800 font-mono">{selectedStudent.draftSavedAt || selectedStudent.createdDate || '—'}</p>
                {selectedStudent.razorpayOrderId && (
                  <p className="text-[10px] sm:text-[11px] text-slate-500 font-mono mt-1 break-all">Order: {selectedStudent.razorpayOrderId}</p>
                )}
              </div>
            </div>

            {/* Application Form Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              
              {/* Section 1: Personal & Identification Details */}
              <div className="bg-slate-50 rounded-2xl p-3.5 sm:p-4 border border-slate-200 space-y-2.5 sm:space-y-3">
                <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
                  <User className="w-4 h-4 text-indigo-600" /> Personal & Identification
                </h5>
                <div className="space-y-1.5 sm:space-y-2 text-xs">
                  <div className="flex flex-col xs:flex-row xs:justify-between py-1 border-b border-slate-100 gap-0.5 xs:gap-2">
                    <span className="font-semibold text-slate-500">Full Name</span>
                    <span className="font-bold text-slate-900 xs:text-right">{selectedStudent.fullName || selectedStudent.name || '—'}</span>
                  </div>
                  <div className="flex flex-col xs:flex-row xs:justify-between py-1 border-b border-slate-100 gap-0.5 xs:gap-2">
                    <span className="font-semibold text-slate-500">Father's / Guardian Name</span>
                    <span className="font-bold text-slate-900 xs:text-right">{selectedStudent.fatherName || '—'}</span>
                  </div>
                  <div className="flex flex-col xs:flex-row xs:justify-between py-1 border-b border-slate-100 gap-0.5 xs:gap-2">
                    <span className="font-semibold text-slate-500">Date of Birth</span>
                    <span className="font-bold text-slate-900 xs:text-right">{formatDob(selectedStudent)}</span>
                  </div>
                  <div className="flex flex-col xs:flex-row xs:justify-between py-1 border-b border-slate-100 gap-0.5 xs:gap-2">
                    <span className="font-semibold text-slate-500">Gender</span>
                    <span className="font-bold text-slate-900 xs:text-right">{selectedStudent.gender || '—'}</span>
                  </div>
                  <div className="flex flex-col xs:flex-row xs:justify-between py-1 border-b border-slate-100 gap-0.5 xs:gap-2">
                    <span className="font-semibold text-slate-500">Caste Category</span>
                    <span className="font-bold text-slate-900 xs:text-right">{selectedStudent.casteCategory || '—'}</span>
                  </div>
                  <div className="flex flex-col xs:flex-row xs:justify-between py-1 border-b border-slate-100 gap-0.5 xs:gap-2">
                    <span className="font-semibold text-slate-500">Aadhar Number</span>
                    <span className="font-mono font-bold text-slate-900 xs:text-right">{selectedStudent.aadharNo || '—'}</span>
                  </div>
                  <div className="flex flex-col xs:flex-row xs:justify-between py-1 gap-0.5 xs:gap-2">
                    <span className="font-semibold text-slate-500">Address</span>
                    <span className="font-bold text-slate-900 xs:text-right max-w-full xs:max-w-[200px] break-words">{selectedStudent.address || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Section 2: Contact, Academic & Course Info */}
              <div className="bg-slate-50 rounded-2xl p-3.5 sm:p-4 border border-slate-200 space-y-2.5 sm:space-y-3">
                <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
                  <GraduationCap className="w-4 h-4 text-indigo-600" /> Academic, Contact & Admission
                </h5>
                <div className="space-y-1.5 sm:space-y-2 text-xs">
                  <div className="flex flex-col xs:flex-row xs:justify-between py-1 border-b border-slate-100 gap-0.5 xs:gap-2">
                    <span className="font-semibold text-slate-500">Mobile / Contact</span>
                    <span className="font-bold text-slate-900 font-mono xs:text-right">{selectedStudent.contactNo || selectedStudent.mobileNo || '—'}</span>
                  </div>
                  <div className="flex flex-col xs:flex-row xs:justify-between py-1 border-b border-slate-100 gap-0.5 xs:gap-2">
                    <span className="font-semibold text-slate-500">Email Address</span>
                    <span className="font-bold text-slate-900 xs:text-right max-w-full xs:max-w-[180px] truncate">{selectedStudent.email || '—'}</span>
                  </div>
                  <div className="flex flex-col xs:flex-row xs:justify-between py-1 border-b border-slate-100 gap-0.5 xs:gap-2">
                    <span className="font-semibold text-slate-500">Course Applied</span>
                    <span className="font-bold text-sky-700 xs:text-right">{selectedStudent.course || '—'}</span>
                  </div>
                  <div className="flex flex-col xs:flex-row xs:justify-between py-1 border-b border-slate-100 gap-0.5 xs:gap-2">
                    <span className="font-semibold text-slate-500">Qualification</span>
                    <span className="font-bold text-slate-900 xs:text-right">{selectedStudent.qualification || '—'}</span>
                  </div>
                  <div className="flex flex-col xs:flex-row xs:justify-between py-1 border-b border-slate-100 gap-0.5 xs:gap-2">
                    <span className="font-semibold text-slate-500">SSLC / Marks Card No</span>
                    <span className="font-mono font-bold text-slate-900 xs:text-right">{selectedStudent.sslcMarksNo || '—'}</span>
                  </div>
                  <div className="flex flex-col xs:flex-row xs:justify-between py-1 border-b border-slate-100 gap-0.5 xs:gap-2">
                    <span className="font-semibold text-slate-500">Admission Date</span>
                    <span className="font-bold text-slate-900 xs:text-right">{selectedStudent.admissionDate || '—'}</span>
                  </div>
                  <div className="flex flex-col xs:flex-row xs:justify-between py-1 gap-0.5 xs:gap-2">
                    <span className="font-semibold text-slate-500">Branch & Franchisee ID</span>
                    <span className="font-mono font-bold text-slate-900 xs:text-right">{selectedStudent.trustBranch || '—'} ({selectedStudent.franchiseeId || '—'})</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Section 3: Uploaded Documents & Photos Section */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                Uploaded Documents & Photos (Click to Enlarge / Download)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                
                {/* 1. Student Passport Photo Card */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-center relative group">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase">Student Photo</span>
                    {selectedStudent.photoPreview || selectedStudent.photoUrl ? (
                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded">Ready</span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Not Uploaded</span>
                    )}
                  </div>
                  {selectedStudent.photoPreview || selectedStudent.photoUrl ? (
                    <div
                      onClick={() => setViewDocument({
                        title: `Student Passport Photo - ${selectedStudent.fullName}`,
                        preview: selectedStudent.photoPreview || selectedStudent.photoUrl,
                        fileType: 'image',
                        fileName: 'student_photo.jpg'
                      })}
                      className="cursor-pointer group/doc relative rounded-xl overflow-hidden border border-slate-300 hover:border-indigo-500 transition-all shadow-sm hover:shadow-md bg-white"
                    >
                      <div className="relative">
                        <img
                          src={selectedStudent.photoPreview || selectedStudent.photoUrl}
                          alt="Student"
                          className="w-full h-32 object-cover rounded-xl mx-auto"
                        />
                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover/doc:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1 p-2">
                          <ZoomIn className="w-5 h-5 text-indigo-300" />
                          <span className="text-[11px] font-bold">Click to View</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-[11px] flex items-center justify-center gap-1 border-t border-slate-200 transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Photo
                      </button>
                    </div>
                  ) : (
                    <div className="py-8 bg-white rounded-xl border border-dashed border-slate-200 text-center">
                      <User className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                      <span className="text-xs text-slate-400 font-medium">No photo uploaded</span>
                    </div>
                  )}
                </div>

                {/* 2. Aadhar Card Document Card */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-center relative group">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase">Aadhar Card</span>
                    {selectedStudent.aadharPreview || selectedStudent.aadharUrl ? (
                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded">
                        {isPdf(selectedStudent.aadharPreview || selectedStudent.aadharUrl, selectedStudent.aadharFileType, selectedStudent.aadharFileName) ? 'PDF' : 'IMAGE'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Not Uploaded</span>
                    )}
                  </div>
                  {selectedStudent.aadharPreview || selectedStudent.aadharUrl ? (
                    <div
                      onClick={() => setViewDocument({
                        title: `Aadhar Card - ${selectedStudent.fullName}`,
                        preview: selectedStudent.aadharPreview || selectedStudent.aadharUrl,
                        fileType: isPdf(selectedStudent.aadharPreview || selectedStudent.aadharUrl, selectedStudent.aadharFileType, selectedStudent.aadharFileName) ? 'pdf' : 'image',
                        fileName: selectedStudent.aadharFileName || 'AadharCard'
                      })}
                      className="cursor-pointer group/doc relative rounded-xl overflow-hidden border border-slate-300 hover:border-indigo-500 transition-all shadow-sm hover:shadow-md bg-white"
                    >
                      {isPdf(selectedStudent.aadharPreview || selectedStudent.aadharUrl, selectedStudent.aadharFileType, selectedStudent.aadharFileName) ? (
                        <div className="p-6 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex flex-col items-center justify-center gap-2 h-32">
                          <FileText className="w-8 h-8 text-rose-600" />
                          <span>PDF Document</span>
                          <span className="text-[10px] text-rose-500 font-mono truncate max-w-[160px]">{selectedStudent.aadharFileName || 'aadhar.pdf'}</span>
                        </div>
                      ) : (
                        <div className="relative">
                          <img
                            src={selectedStudent.aadharPreview || selectedStudent.aadharUrl}
                            alt="Aadhar"
                            className="w-full h-32 object-cover rounded-xl mx-auto"
                          />
                          <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover/doc:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1 p-2">
                            <ZoomIn className="w-5 h-5 text-indigo-300" />
                            <span className="text-[11px] font-bold">Click to View</span>
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        className="w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-[11px] flex items-center justify-center gap-1 border-t border-slate-200 transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Aadhar Card
                      </button>
                    </div>
                  ) : (
                    <div className="py-8 bg-white rounded-xl border border-dashed border-slate-200 text-center">
                      <FileText className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                      <span className="text-xs text-slate-400 font-medium">No Aadhar uploaded</span>
                    </div>
                  )}
                </div>

                {/* 3. Marksheet Document Card */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-center relative group">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase">Marksheet</span>
                    {selectedStudent.marksheetPreview || selectedStudent.marksheetUrl ? (
                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded">
                        {isPdf(selectedStudent.marksheetPreview || selectedStudent.marksheetUrl, selectedStudent.marksheetFileType, selectedStudent.marksheetFileName) ? 'PDF' : 'IMAGE'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Not Uploaded</span>
                    )}
                  </div>
                  {selectedStudent.marksheetPreview || selectedStudent.marksheetUrl ? (
                    <div
                      onClick={() => setViewDocument({
                        title: `Marksheet - ${selectedStudent.fullName}`,
                        preview: selectedStudent.marksheetPreview || selectedStudent.marksheetUrl,
                        fileType: isPdf(selectedStudent.marksheetPreview || selectedStudent.marksheetUrl, selectedStudent.marksheetFileType, selectedStudent.marksheetFileName) ? 'pdf' : 'image',
                        fileName: selectedStudent.marksheetFileName || 'Marksheet'
                      })}
                      className="cursor-pointer group/doc relative rounded-xl overflow-hidden border border-slate-300 hover:border-indigo-500 transition-all shadow-sm hover:shadow-md bg-white"
                    >
                      {isPdf(selectedStudent.marksheetPreview || selectedStudent.marksheetUrl, selectedStudent.marksheetFileType, selectedStudent.marksheetFileName) ? (
                        <div className="p-6 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold flex flex-col items-center justify-center gap-2 h-32">
                          <FileText className="w-8 h-8 text-blue-600" />
                          <span>PDF Document</span>
                          <span className="text-[10px] text-blue-500 font-mono truncate max-w-[160px]">{selectedStudent.marksheetFileName || 'marksheet.pdf'}</span>
                        </div>
                      ) : (
                        <div className="relative">
                          <img
                            src={selectedStudent.marksheetPreview || selectedStudent.marksheetUrl}
                            alt="Marksheet"
                            className="w-full h-32 object-cover rounded-xl mx-auto"
                          />
                          <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover/doc:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1 p-2">
                            <ZoomIn className="w-5 h-5 text-indigo-300" />
                            <span className="text-[11px] font-bold">Click to View</span>
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        className="w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-[11px] flex items-center justify-center gap-1 border-t border-slate-200 transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Marksheet
                      </button>
                    </div>
                  ) : (
                    <div className="py-8 bg-white rounded-xl border border-dashed border-slate-200 text-center">
                      <GraduationCap className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                      <span className="text-xs text-slate-400 font-medium">No marksheet uploaded</span>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="pt-3 sm:pt-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
              <button
                onClick={() => handleDismiss(selectedStudent)}
                disabled={dismissingId === selectedStudent.id}
                className="w-full sm:w-auto px-4 py-2.5 border border-red-200 hover:bg-red-50 text-red-600 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Dismiss Application
              </button>

              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 border border-slate-300 hover:bg-slate-100 rounded-xl text-slate-700 font-bold text-xs transition-colors cursor-pointer text-center"
                >
                  Close
                </button>
                <button
                  onClick={() => handleActivate(selectedStudent)}
                  disabled={activatingId === selectedStudent.id}
                  className="flex-2 sm:flex-none px-4 sm:px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer disabled:opacity-60"
                >
                  {activatingId === selectedStudent.id ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Activating...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Activate Admission</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* FULL SCREEN DOCUMENT / PHOTO LIGHTBOX VIEWER */}
      {viewDocument && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-5 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-3 sm:space-y-4 relative max-h-[96vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex flex-col xs:flex-row xs:items-center justify-between border-b border-slate-200 pb-3 gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">{viewDocument.title}</h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-mono truncate">{viewDocument.fileName || 'Document'}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 self-end xs:self-auto shrink-0">
                {/* Download / Save Button */}
                <a
                  href={viewDocument.preview}
                  download={viewDocument.fileName || 'document'}
                  className="px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-indigo-50 text-indigo-800 hover:bg-indigo-100 text-xs font-bold border border-indigo-200 flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Download</span>
                </a>

                {/* Open in Full Window Button */}
                <button
                  type="button"
                  onClick={() => {
                    const win = window.open();
                    if (win) {
                      win.document.write(`
                        <html>
                          <head><title>${viewDocument.title}</title></head>
                          <body style="margin:0; background:#0f172a; display:flex; justify-content:center; align-items:center; min-height:100vh;">
                            ${viewDocument.fileType === 'pdf' 
                              ? `<iframe src="${viewDocument.preview}" style="width:100%; height:100vh; border:none;"></iframe>` 
                              : `<img src="${viewDocument.preview}" style="max-width:100%; max-height:100vh; object-fit:contain; box-shadow:0 10px 30px rgba(0,0,0,0.5);" />`
                            }
                          </body>
                        </html>
                      `);
                    }
                  }}
                  className="px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Full Window</span>
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setViewDocument(null)}
                  className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Body View */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-2 sm:p-3 bg-slate-900 rounded-2xl min-h-[260px] max-h-[70vh]">
              {viewDocument.fileType === 'pdf' ? (
                <iframe
                  src={viewDocument.preview}
                  title={viewDocument.title}
                  className="w-full h-full min-h-[400px] sm:min-h-[500px] rounded-xl border-0"
                />
              ) : (
                <img
                  src={viewDocument.preview}
                  alt={viewDocument.title}
                  className="max-w-full max-h-[60vh] sm:max-h-[65vh] object-contain rounded-xl shadow-2xl"
                />
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setViewDocument(null)}
                className="w-full sm:w-auto px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
              >
                Close Viewer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* FULL SCREEN DOCUMENT / PHOTO LIGHTBOX VIEWER */}
      {viewDocument && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 relative max-h-[95vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">{viewDocument.title}</h3>
                  <p className="text-xs text-slate-500 font-mono">{viewDocument.fileName || 'Document'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Download / Save Button */}
                <a
                  href={viewDocument.preview}
                  download={viewDocument.fileName || 'document'}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-bold border border-amber-200 flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>

                {/* Open in Full Window Button */}
                <button
                  type="button"
                  onClick={() => {
                    const win = window.open();
                    if (win) {
                      win.document.write(`
                        <html>
                          <head><title>${viewDocument.title}</title></head>
                          <body style="margin:0; background:#0f172a; display:flex; justify-content:center; align-items:center; min-height:100vh;">
                            ${viewDocument.fileType === 'pdf' 
                              ? `<iframe src="${viewDocument.preview}" style="width:100%; height:100vh; border:none;"></iframe>` 
                              : `<img src="${viewDocument.preview}" style="max-width:100%; max-height:100vh; object-fit:contain; box-shadow:0 10px 30px rgba(0,0,0,0.5);" />`
                            }
                          </body>
                        </html>
                      `);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Full Window</span>
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setViewDocument(null)}
                  className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Body View */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-3 bg-slate-900 rounded-2xl min-h-[300px] max-h-[70vh]">
              {viewDocument.fileType === 'pdf' ? (
                <iframe
                  src={viewDocument.preview}
                  title={viewDocument.title}
                  className="w-full h-full min-h-[500px] rounded-xl border-0"
                />
              ) : (
                <img
                  src={viewDocument.preview}
                  alt={viewDocument.title}
                  className="max-w-full max-h-[65vh] object-contain rounded-xl shadow-2xl"
                />
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setViewDocument(null)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
              >
                Close Viewer
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
