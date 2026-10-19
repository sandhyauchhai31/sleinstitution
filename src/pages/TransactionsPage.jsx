import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  Search,
  RefreshCw,
  Download,
  CreditCard,
  Building,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Eye,
  Calendar,
  DollarSign,
  Users,
  ShieldCheck,
  ArrowUpDown,
  Filter,
  ChevronLeft,
  ChevronRight,
  IndianRupee
} from 'lucide-react';
import { fetchTransactions, exportTransactionsToCSV, getTxnTimestamp } from '../utils/transactionManager';
import { canFranchiseeAccessStudent, getLoggedInFranchiseeProfile, isUserAdmin } from '../utils/franchiseeFilter';
import PaymentReceiptModal from '../components/PaymentReceiptModal';
import DateRangePicker from '../components/DateRangePicker';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('sle_transactions_cache') || '[]');
      if (Array.isArray(cached) && cached.length > 0) {
        return cached.sort((a, b) => getTxnTimestamp(b) - getTxnTimestamp(a));
      }
    } catch (e) { }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('sle_transactions_cache') || '[]');
      return !Array.isArray(cached) || cached.length === 0;
    } catch (e) {
      return true;
    }
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'student_admission' | 'franchisee_onboarding'
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [toastMessage, setToastMessage] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);

  // Reset pagination on filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter, searchQuery, dateRange]);

  // Get logged in Franchisee Portal user context
  const [franchiseeInfo, setFranchiseeInfo] = useState(() => {
    return getLoggedInFranchiseeProfile() || {};
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Load transactions on mount and sync with Firestore
  const loadData = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const data = await fetchTransactions({ isManual });
      setTransactions(data);
      if (isManual) {
        showToast('Transactions synchronized with Firestore!');
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Real-time synchronization
  useEffect(() => {
    loadData(false);

    // 1. In-app custom event listener for instant local recording
    const handleTxnUpdate = (e) => {
      const newTxn = e.detail;
      if (newTxn && newTxn.id) {
        setTransactions(prev => {
          const key = String(newTxn.paymentId || newTxn.transactionId || newTxn.id).toLowerCase();
          const filtered = prev.filter(t => String(t.paymentId || t.transactionId || t.id).toLowerCase() !== key);
          return [newTxn, ...filtered].sort((a, b) => getTxnTimestamp(b) - getTxnTimestamp(a));
        });
      } else {
        loadData(false);
      }
    };

    // 2. Storage event listener for multi-tab sync
    const handleStorage = (e) => {
      if (e.key === 'sle_transactions_cache' || e.key === 'sle_portal_user_data') {
        loadData(false);
        setFranchiseeInfo(getLoggedInFranchiseeProfile() || {});
      }
    };

    window.addEventListener('sle_transactions_updated', handleTxnUpdate);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('sle_transactions_updated', handleTxnUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const handleCopy = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter transactions strictly for this Franchisee branch
  const scopedTransactions = useMemo(() => {
    // Admin sees all transactions across all branches
    if (isUserAdmin()) {
      return transactions;
    }

    const profile = getLoggedInFranchiseeProfile() || franchiseeInfo || {};
    const fidLower = String(profile.id || profile.franchiseeId || profile.environmentId || profile.code || '').trim().toLowerCase();
    const userEmailLower = String(profile.email || '').trim().toLowerCase();
    const userInstCode = String(profile.instituteCode || profile.code || profile.id || '').trim().toLowerCase();
    const ownerNameLower = String(profile.fullName || profile.ownerName || profile.franchiseName || '').trim().toLowerCase();
    const paymentIds = [profile.renewalPaymentId, profile.razorpayPaymentId, profile.paymentId].filter(Boolean).map(x => String(x).toLowerCase().trim());

    return transactions.filter(t => {
      if (!t) return false;

      // 1. Franchisee Onboarding & Renewal: ONLY show this franchisee's own payments
      if (t.type === 'franchisee_onboarding' || t.type === 'franchisee_renewal' || t.type?.startsWith('franchisee_')) {
        const tFid = String(t.franchiseeId || '').trim().toLowerCase();
        const tEmail = String(t.payerEmail || '').trim().toLowerCase();
        const tReg = String(t.registrationNo || '').trim().toLowerCase();
        const tPayer = String(t.payerName || '').trim().toLowerCase();
        const tPid = String(t.paymentId || t.transactionId || t.id || '').trim().toLowerCase();

        // Check Franchisee ID
        if (fidLower && tFid && (fidLower === tFid || tFid.includes(fidLower) || fidLower.includes(tFid))) {
          return true;
        }

        // Check Email
        if (userEmailLower && tEmail && userEmailLower === tEmail) {
          return true;
        }

        // Check Payment ID on profile
        if (paymentIds.length > 0 && tPid && paymentIds.includes(tPid)) {
          return true;
        }

        // Check Reg / Institute Code + Payer Name
        if (userInstCode && tReg && userInstCode === tReg && ownerNameLower && tPayer && (ownerNameLower === tPayer || tPayer.includes(ownerNameLower) || ownerNameLower.includes(tPayer))) {
          return true;
        }

        // Never match other franchisees' fees
        return false;
      }

      // 2. Student Admissions & Certificate Admissions: MUST strictly belong to this franchisee's branch
      const studentAdapter = {
        id: t.registrationNo || t.appNumber || t.id,
        rollNo: t.registrationNo,
        enrollmentNo: t.registrationNo,
        appNumber: t.appNumber,
        registrationNo: t.registrationNo,
        franchiseeId: t.franchiseeId,
        franchiseId: t.franchiseeId,
        franchiseCode: t.franchiseeId,
        trustBranch: t.branch,
        branchName: t.branch,
        trainingCenter: t.branch,
        place: t.branch,
        location: t.branch,
        city: t.branch,
        franchiseName: t.franchiseName || t.branch,
        email: t.payerEmail,
        createdBy: t.payerEmail,
        createdById: t.franchiseeId
      };

      return canFranchiseeAccessStudent(studentAdapter, profile);
    });
  }, [transactions, franchiseeInfo]);

  // Apply Search, Date Range, and Branch filtering (independent of category tab selection)
  const dateAndSearchScoped = useMemo(() => {
    return scopedTransactions.filter(t => {
      // Date Range filter
      if (dateRange.startDate || dateRange.endDate) {
        const ts = getTxnTimestamp(t);
        if (ts > 0) {
          const tDate = new Date(ts).toISOString().split('T')[0];
          if (dateRange.startDate && tDate < dateRange.startDate) {
            return false;
          }
          if (dateRange.endDate && tDate > dateRange.endDate) {
            return false;
          }
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const searchPool = [
          t.transactionId,
          t.paymentId,
          t.orderId,
          t.payerName,
          t.registrationNo,
          t.course,
          t.planName,
          t.branch,
          t.franchiseName,
          t.status
        ].map(val => String(val || '').toLowerCase());

        return searchPool.some(field => field.includes(q));
      }

      return true;
    });
  }, [scopedTransactions, searchQuery, dateRange]);

  // Helper classifiers
  const isRegularStudentTxn = (t) => t.type === 'student_admission' && !t.isCertificateStudent && !t.certRegNo && !(t.description && String(t.description).toLowerCase().includes('cert'));
  const isCertTxn = (t) => t.type === 'certificate_admission' || t.isCertificateStudent || Boolean(t.certRegNo) || (t.typeLabel && String(t.typeLabel).toLowerCase().includes('cert')) || (t.description && String(t.description).toLowerCase().includes('cert'));
  const isStudentTxn = (t) => isRegularStudentTxn(t) || isCertTxn(t) || t.type?.includes('admission') || t.type?.includes('student');
  const isFranchiseeTxn = (t) => t.type === 'franchisee_onboarding' || t.type === 'franchisee_renewal' || t.type?.startsWith('franchisee_');

  // KPI Calculations (computed from dateAndSearchScoped so tab switching never drops other metrics to 0!)
  const stats = useMemo(() => {
    const totalRevenue = dateAndSearchScoped.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const regularTxns = dateAndSearchScoped.filter(isRegularStudentTxn);
    const regularTotal = regularTxns.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const certTxns = dateAndSearchScoped.filter(isCertTxn);
    const certTotal = certTxns.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const allStudentTxns = dateAndSearchScoped.filter(isStudentTxn);
    const allStudentTotal = allStudentTxns.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const franchiseeTxns = dateAndSearchScoped.filter(isFranchiseeTxn);
    const franchiseeTotal = franchiseeTxns.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    return {
      totalRevenue,
      totalCount: dateAndSearchScoped.length,
      regularStudentCount: regularTxns.length,
      regularStudentTotal: regularTotal,
      certCount: certTxns.length,
      certTotal: certTotal,
      studentCount: allStudentTxns.length,
      studentTotal: allStudentTotal,
      franchiseeCount: franchiseeTxns.length,
      franchiseeTotal
    };
  }, [dateAndSearchScoped]);

  // Table rows filtered additionally by category tab (strictly sorted descending)
  const filteredTransactions = useMemo(() => {
    let list;
    if (typeFilter === 'all') {
      list = dateAndSearchScoped;
    } else if (typeFilter === 'franchisee_onboarding') {
      list = dateAndSearchScoped.filter(isFranchiseeTxn);
    } else if (typeFilter === 'student_admission') {
      list = dateAndSearchScoped.filter(isRegularStudentTxn);
    } else if (typeFilter === 'certificate_admission') {
      list = dateAndSearchScoped.filter(isCertTxn);
    } else {
      list = dateAndSearchScoped.filter(t => t.type === typeFilter);
    }
    return list.slice().sort((a, b) => getTxnTimestamp(b) - getTxnTimestamp(a));
  }, [dateAndSearchScoped, typeFilter]);

  // Table pagination calculations
  const totalEntries = filteredTransactions.length;
  const totalPages = Math.ceil(totalEntries / entriesPerPage) || 1;
  const startIndex = (currentPage - 1) * entriesPerPage;
  const paginatedTransactions = useMemo(() => {
    return filteredTransactions.slice(startIndex, startIndex + entriesPerPage);
  }, [filteredTransactions, startIndex, entriesPerPage]);

  const handleExportCSV = () => {
    const filename = `${(franchiseeInfo.location || 'franchisee').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_transactions_${new Date().toISOString().split('T')[0]}.csv`;
    exportTransactionsToCSV(filteredTransactions, filename);
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slate-50 py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed top-18 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Top Header Banner */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/90 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-40 h-40 bg-gradient-to-br from-rose-500/10 via-indigo-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200/80 text-rose-700 text-xs font-bold mb-3">
                <Receipt className="w-3.5 h-3.5" />
                <span>Franchisee Payment Gateway Ledger</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Payment Transactions & Fee Receipts
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                <span className="flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  Branch Center: <strong className="text-slate-800 font-bold">{franchiseeInfo.location || franchiseeInfo.place || franchiseeInfo.franchiseName || 'Athani Center'}</strong>
                </span>
                <span className="text-slate-300">•</span>
                <span>
                  Portal ID: <strong className="font-mono text-rose-600">{franchiseeInfo.id || franchiseeInfo.franchiseCode || 'SLE-FR-101'}</strong>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center">
              <button
                type="button"
                onClick={() => loadData(true)}
                disabled={isRefreshing}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 transition shadow-xs cursor-pointer disabled:opacity-60"
                title="Sync Latest Transactions from Firestore"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-rose-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Syncing...' : 'Sync Firestore'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition shadow-sm cursor-pointer"
                title="Export Transactions to CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Deduction</span>
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                <IndianRupee className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                ₹{stats.totalRevenue.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Student Admissions</span>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                ₹{stats.studentTotal.toLocaleString('en-IN')}
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {stats.regularStudentCount} general + {stats.certCount} cert admissions
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Franchisee Plan</span>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-lg font-black text-indigo-900 truncate block">
                {franchiseeInfo.planName || '1-Year Onboarding'}
              </span>
              <p className="text-[11px] text-emerald-600 font-bold mt-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Active • ₹{stats.franchiseeTotal.toLocaleString('en-IN')} Paid
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Gateway</span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-lg font-black text-slate-900">
                {import.meta.env.VITE_RAZORPAY_MODE === 'live' ? 'Razorpay Live' : 'Razorpay Test'}
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                Direct Instant Settlement
              </p>
            </div>
          </div>
        </div>

        {/* Filter and Search Controls */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">

            {/* Category Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl overflow-x-auto text-xs font-bold">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 ${typeFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                All ({stats.totalCount})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('student_admission')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 ${typeFilter === 'student_admission'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Student Admissions ({stats.regularStudentCount})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('certificate_admission')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 ${typeFilter === 'certificate_admission'
                  ? 'bg-amber-50 text-amber-900 border border-amber-300 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Certificate Admissions ({stats.certCount})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('franchisee_onboarding')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 ${typeFilter === 'franchisee_onboarding'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Franchisee Fee ({stats.franchiseeCount})
              </button>
            </div>

            {/* Right: Date Range Picker & Search Bar */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Date Range Picker */}
              <DateRangePicker
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
                onChange={setDateRange}
              />

              {/* Search Bar */}
              <div className="relative min-w-[220px] sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search candidate, Reg No..."
                  className="w-full pl-9 pr-7 py-2 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-800 transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Transactions Table Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-slate-500 space-y-3">
              <RefreshCw className="w-8 h-8 mx-auto text-rose-500 animate-spin" />
              <p className="text-xs font-semibold">Loading transaction records...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="py-16 px-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Transactions Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery
                  ? `No payment records matched "${searchQuery}". Try clearing search keywords.`
                  : 'No payment transactions recorded for this branch yet. When students complete admission fees, their transaction details will appear here automatically.'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Payment & Order ID</th>
                      <th className="py-3 px-4">Candidate / Payer</th>
                      <th className="py-3 px-4">Description / Course</th>
                      <th className="py-3 px-4 text-right">Amount (₹)</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {paginatedTransactions.map((t, idx) => {
                      const isCopied = copiedId === t.id;
                      return (
                        <tr key={t.id || idx} className="hover:bg-slate-50/60 transition-colors">
                          {/* Date & Time */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 font-bold text-slate-900">
                              <span>{t.date}</span>
                              {(() => {
                                const now = new Date();
                                const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                                const isToday = String(t.date || '').startsWith(todayStr) || (t.createdAt && new Date(t.createdAt).toLocaleDateString('en-CA') === todayStr);
                                if (!isToday) return null;
                                return (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-700 border border-emerald-300 uppercase tracking-wider">
                                    Today
                                  </span>
                                );
                              })()}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">{t.dateTime ? (t.dateTime.includes(',') ? t.dateTime.split(',')[1] : t.dateTime) : ''}</div>
                          </td>

                          {/* Payment & Order ID */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                                {t.paymentId || t.transactionId}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(t.paymentId || t.transactionId, t.id)}
                                className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition cursor-pointer"
                                title="Copy Payment ID"
                              >
                                {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                            {t.orderId && (
                              <div className="text-[10px] font-mono text-slate-400 mt-0.5 truncate max-w-[180px]">
                                Order: {t.orderId}
                              </div>
                            )}
                          </td>

                          {/* Candidate / Payer */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{t.payerName}</div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                              {t.registrationNo && (
                                <span className="font-mono font-bold text-rose-600">Reg: {t.registrationNo}</span>
                              )}
                              {t.payerPhone && <span>{t.payerPhone}</span>}
                            </div>
                          </td>

                          {/* Description / Course */}
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${isCertTxn(t)
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : isFranchiseeTxn(t)
                                ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}>
                              {t.typeLabel || (isCertTxn(t) ? 'Certificate Admission Fee' : 'Student Admission Fee')}
                            </span>
                            <div className="text-xs font-semibold text-slate-800 mt-1 truncate max-w-[200px]">
                              {t.course || t.planName || t.description || 'Institutional Fee'}
                            </div>
                          </td>

                          {/* Amount */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <span className="text-sm font-black text-slate-900">
                              ₹{Number(t.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                            <div className="text-[10px] text-slate-400 font-medium">via {t.gateway || (import.meta.env.VITE_RAZORPAY_MODE === 'live' ? 'Razorpay Live' : 'Razorpay Test')}</div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              {t.status || 'Paid'}
                            </span>
                          </td>

                          {/* Action: View Receipt */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedTxn(t)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer"
                              title="View Official Receipt"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Receipt</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              {totalEntries > 0 && (
                <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-600">
                  <div>
                    Showing {startIndex + 1} to {Math.min(startIndex + entriesPerPage, totalEntries)} of {totalEntries} transactions
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 mr-3">
                      <span>Show</span>
                      <select
                        value={entriesPerPage}
                        onChange={(e) => { setEntriesPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        className="px-2.5 py-1 rounded-lg border border-slate-300 bg-slate-100 text-slate-800 text-xs font-bold transition cursor-pointer"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                      <span>per page</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                        currentPage === 1 
                          ? 'opacity-40 cursor-not-allowed border-transparent' 
                          : 'hover:bg-slate-100 text-slate-800 border-slate-200'
                      }`}
                      title="Previous Page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <span className="font-bold px-2 whitespace-nowrap text-slate-900">
                      Page {currentPage} of {totalPages}
                    </span>

                    <button
                      type="button"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                        currentPage === totalPages 
                          ? 'opacity-40 cursor-not-allowed border-transparent' 
                          : 'hover:bg-slate-100 text-slate-800 border-slate-200'
                      }`}
                      title="Next Page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

      </div>

      {/* Official Printable Payment Receipt Modal */}
      {selectedTxn && (
        <PaymentReceiptModal
          transaction={selectedTxn}
          onClose={() => setSelectedTxn(null)}
        />
      )}
    </div>
  );
}
