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
  Filter,
  ArrowUpDown,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  IndianRupee,
  Trash2
} from 'lucide-react';
import { fetchTransactions, exportTransactionsToCSV, deleteTransaction, getTxnTimestamp } from '../utils/transactionManager';
import { db, collection, onSnapshot } from '../firebase';
import PaymentReceiptModal from './PaymentReceiptModal';
import DateRangePicker from './DateRangePicker';

export default function AdminPaymentTransactions({ isDarkMode, showToast, branches = [] }) {
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
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'student_admission' | 'franchisee_onboarding'
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);

  // Reset pagination to page 1 on filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedBranch, typeFilter, searchQuery, dateRange]);

  const loadData = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const data = await fetchTransactions({ isManual });
      if (Array.isArray(data) && data.length > 0) {
        setTransactions(data.sort((a, b) => getTxnTimestamp(b) - getTxnTimestamp(a)));
      }
      if (isManual && showToast) {
        showToast('Transactions synchronized with Firestore!', 'success');
      }
    } catch (err) {
      console.error('Failed to load transactions in admin:', err);
      if (showToast) showToast('Failed to load transactions', 'error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // 1. Fetch latest data from Firestore
    loadData(false);

    // 2. Real-time Firestore onSnapshot listener for online transaction records
    let unsubscribe = null;
    if (db) {
      try {
        unsubscribe = onSnapshot(collection(db, 'transactions'), (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' || change.type === 'modified') {
              const liveTxn = { id: change.doc.id, ...change.doc.data(), _isRecorded: true };
              setTransactions(prev => {
                const key = String(liveTxn.paymentId || liveTxn.transactionId || liveTxn.id).toLowerCase();
                const exists = prev.some(t => String(t.paymentId || t.transactionId || t.id).toLowerCase() === key);
                const updated = exists 
                  ? prev.map(t => String(t.paymentId || t.transactionId || t.id).toLowerCase() === key ? { ...t, ...liveTxn } : t)
                  : [liveTxn, ...prev];
                return updated.sort((a, b) => getTxnTimestamp(b) - getTxnTimestamp(a));
              });
            }
          });
        }, (err) => {
          console.warn('Real-time transactions listener notice:', err);
        });
      } catch (e) { }
    }

    // 3. Listen to local custom event from admissions in same window
    const handleTxnUpdate = (e) => {
      const newTxn = e.detail;
      if (newTxn) {
        setTransactions(prev => {
          const key = String(newTxn.paymentId || newTxn.transactionId || newTxn.id).toLowerCase();
          const exists = prev.some(t => String(t.paymentId || t.transactionId || t.id).toLowerCase() === key);
          const updated = exists 
            ? prev.map(t => String(t.paymentId || t.transactionId || t.id).toLowerCase() === key ? { ...t, ...newTxn } : t)
            : [newTxn, ...prev];
          return updated.sort((a, b) => getTxnTimestamp(b) - getTxnTimestamp(a));
        });
      }
    };
    window.addEventListener('sle_transactions_updated', handleTxnUpdate);

    return () => {
      if (unsubscribe) unsubscribe();
      window.removeEventListener('sle_transactions_updated', handleTxnUpdate);
    };
  }, []);

  const handleCopy = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteTransaction = async (txn) => {
    const txnLabel = txn.paymentId || txn.transactionId || txn.id;
    if (!window.confirm(`Are you sure you want to remove this transaction record?\n\nID: ${txnLabel}\nPayer: ${txn.payerName || 'N/A'}\nAmount: ₹${txn.amount}`)) {
      return;
    }
    try {
      await deleteTransaction(txn.id, txn);
      setTransactions(prev => prev.filter(t => t.id !== txn.id && t.paymentId !== txn.paymentId && t.transactionId !== txn.transactionId));
      if (showToast) showToast(`Transaction ${txnLabel} removed successfully`, 'success');
    } catch (err) {
      console.error('Failed to remove transaction:', err);
      if (showToast) showToast('Failed to remove transaction', 'error');
    }
  };

  // Get unique branch names from transactions and props
  const allBranchNames = useMemo(() => {
    const set = new Set();
    branches.forEach(b => {
      const name = typeof b === 'string' ? b : (b.name || b.location || b.branch);
      if (name) set.add(name.trim());
    });
    transactions.forEach(t => {
      if (t.branch) set.add(t.branch.trim());
      if (t.franchiseName) set.add(t.franchiseName.trim());
    });
    return Array.from(set).sort();
  }, [branches, transactions]);

  // Transactions filtered by selected Branch, Date Range, and Search Query (independent of typeFilter tab)
  const scopedTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Branch filter
      if (selectedBranch !== 'ALL') {
        const branchLower = selectedBranch.toLowerCase();
        const tBranch = (t.branch || '').toLowerCase();
        const tFranchise = (t.franchiseName || '').toLowerCase();
        if (!tBranch.includes(branchLower) && !tFranchise.includes(branchLower)) {
          return false;
        }
      }

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
          t.payerEmail,
          t.payerPhone,
          t.status
        ].map(val => String(val || '').toLowerCase());

        return searchPool.some(field => field.includes(q));
      }

      return true;
    });
  }, [transactions, selectedBranch, searchQuery, dateRange]);

  // Overall KPI Stats (computed from scopedTransactions, so switching category tabs NEVER drops other cards to 0!)
  const stats = useMemo(() => {
    const totalRevenue = scopedTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const studentTxns = scopedTransactions.filter(t => t.type === 'student_admission');
    const studentTotal = studentTxns.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const franchiseeTxns = scopedTransactions.filter(t => t.type === 'franchisee_onboarding' || t.type === 'franchisee_renewal' || t.type?.startsWith('franchisee_'));
    const franchiseeTotal = franchiseeTxns.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    return {
      totalRevenue,
      totalCount: scopedTransactions.length,
      studentCount: studentTxns.length,
      studentTotal,
      franchiseeCount: franchiseeTxns.length,
      franchiseeTotal
    };
  }, [scopedTransactions]);

  // Filtered transactions for the table (applies the active category tab and sorts strictly descending)
  const filteredTransactions = useMemo(() => {
    let list;
    if (typeFilter === 'all') {
      list = scopedTransactions;
    } else if (typeFilter === 'franchisee_onboarding') {
      list = scopedTransactions.filter(t => t.type === 'franchisee_onboarding' || t.type === 'franchisee_renewal' || t.type?.startsWith('franchisee_'));
    } else {
      list = scopedTransactions.filter(t => t.type === typeFilter);
    }
    return list.slice().sort((a, b) => getTxnTimestamp(b) - getTxnTimestamp(a));
  }, [scopedTransactions, typeFilter]);

  // Table pagination calculations
  const totalEntries = filteredTransactions.length;
  const totalPages = Math.ceil(totalEntries / entriesPerPage) || 1;
  const startIndex = (currentPage - 1) * entriesPerPage;
  const paginatedTransactions = useMemo(() => {
    return filteredTransactions.slice(startIndex, startIndex + entriesPerPage);
  }, [filteredTransactions, startIndex, entriesPerPage]);

  const handleExportCSV = () => {
    const filename = `sle_all_payment_transactions_${new Date().toISOString().split('T')[0]}.csv`;
    exportTransactionsToCSV(filteredTransactions, filename);
  };

  return (
    <div className="space-y-6">

      {/* Header Banner */}
      <div className={`p-6 sm:p-8 rounded-3xl border ${
        isDarkMode
          ? 'bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-slate-800'
          : 'bg-gradient-to-r from-indigo-50/80 via-purple-50/40 to-white border-indigo-100'
      } shadow-sm relative overflow-hidden`}>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
                <IndianRupee className="w-6 h-6" />
              </span>
              <h2 className="text-2xl font-black tracking-tight">Payment Transactions & Audit Ledger</h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap self-start md:self-center">
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-60 ${
                isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300'
              }`}
              title="Sync Latest Transactions from Firestore"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-rose-600 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync Firestore'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-2 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-md cursor-pointer transition active:scale-95"
              title="Export Transactions to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Overall Revenue */}
        <div className={`p-5 rounded-2xl border ${
          isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
        } shadow-sm space-y-2`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black">
            ₹{stats.totalRevenue.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500">
            Across {stats.totalCount} completed transactions
          </p>
        </div>

        {/* Student Admission Fees */}
        <div className={`p-5 rounded-2xl border ${
          isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
        } shadow-sm space-y-2`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Student Admissions</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black">
            ₹{stats.studentTotal.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500">
            {stats.studentCount} student admission fees
          </p>
        </div>

        {/* Franchisee Onboarding Fees */}
        <div className={`p-5 rounded-2xl border ${
          isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
        } shadow-sm space-y-2`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Franchisee Fees</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black">
            ₹{stats.franchiseeTotal.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500">
            {stats.franchiseeCount} franchisee onboarding payments
          </p>
        </div>

        {/* Gateway & Verified Stats */}
        <div className={`p-5 rounded-2xl border ${
          isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
        } shadow-sm space-y-2`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Razorpay Live</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-500 flex items-center gap-2">
            <span>{stats.totalCount}</span>
            <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              100% Live
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Direct Instant Gateway Settlements
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className={`p-4 sm:p-5 rounded-2xl border ${
        isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
      } shadow-xs space-y-3`}>
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">

          {/* Left: Category Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto text-xs font-bold">
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 ${typeFilter === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
            >
              All ({stats.totalCount})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('student_admission')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 ${typeFilter === 'student_admission'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
            >
              Student Admissions ({stats.studentCount})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('franchisee_onboarding')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 ${typeFilter === 'franchisee_onboarding'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
            >
              Franchisee Fees ({stats.franchiseeCount})
            </button>
          </div>

          {/* Right: Date Range Picker, Branch Selector & Search Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Date Range Picker Component */}
            <DateRangePicker
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              onChange={setDateRange}
              isDarkMode={isDarkMode}
            />

            {/* Branch Filter Dropdown */}
            <div className="relative">
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className={`w-full sm:w-48 text-xs font-semibold px-3 py-2 rounded-xl border focus:outline-none transition ${
                  isDarkMode
                    ? 'bg-slate-800 border-slate-700 text-slate-200'
                    : 'bg-slate-50 border-slate-300 text-slate-700'
                }`}
              >
                <option value="ALL">All Branches ({allBranchNames.length})</option>
                {allBranchNames.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Keyword Search */}
            <div className="relative min-w-[240px] sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search candidate, Reg No, Payment ID..."
                className={`w-full pl-9 pr-7 py-2 text-xs rounded-xl border focus:outline-none transition ${
                  isDarkMode
                    ? 'bg-slate-800 border-slate-700 text-slate-200 focus:border-rose-500'
                    : 'bg-slate-50 border-slate-300 text-slate-800 focus:border-rose-500'
                }`}
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

      {/* Transactions Data Table */}
      <div className={`rounded-2xl border ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      } shadow-xs overflow-hidden`}>
        {loading ? (
          <div className="py-20 text-center text-slate-500 space-y-3">
            <RefreshCw className="w-8 h-8 mx-auto text-rose-500 animate-spin" />
            <p className="text-xs font-semibold">Loading master transaction records...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="py-16 px-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Receipt className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold">No Transactions Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || selectedBranch !== 'ALL' || typeFilter !== 'all'
                ? 'No transactions matched the selected filters or search terms.'
                : 'No payment transaction records found in Firestore.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
              <thead className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                isDarkMode ? 'bg-slate-800/80 border-slate-800 text-slate-400' : 'bg-slate-50/80 border-slate-200 text-slate-500'
              }`}>
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Payment & Order ID</th>
                  <th className="py-3 px-4">Payer / Candidate</th>
                  <th className="py-3 px-4">Branch / Center</th>
                  <th className="py-3 px-4">Category / Plan</th>
                  <th className="py-3 px-4 text-right">Amount (₹)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${
                isDarkMode ? 'divide-slate-800 text-slate-300' : 'divide-slate-100 text-slate-700'
              }`}>
                {paginatedTransactions.map((t, idx) => {
                  const isCopied = copiedId === t.id;
                  return (
                    <tr key={t.id || idx} className={isDarkMode ? 'hover:bg-slate-800/50 transition' : 'hover:bg-slate-50/60 transition'}>
                      {/* Date & Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold">{t.date}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{t.dateTime ? t.dateTime.split(',')[1] : ''}</div>
                      </td>

                      {/* Payment & Order ID */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] border ${
                            isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-900'
                          }`}>
                            {t.paymentId || t.transactionId || 'N/A'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(t.paymentId || t.transactionId, t.id)}
                            className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
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

                      {/* Payer / Candidate */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold">{t.payerName}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          {t.registrationNo && (
                            <span className="font-mono font-bold text-rose-600">ID: {t.registrationNo}</span>
                          )}
                          {t.payerPhone && <span>{t.payerPhone}</span>}
                        </div>
                      </td>

                      {/* Branch / Center */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-rose-600">{t.branch || t.franchiseName || 'Athani'}</div>
                        {t.franchiseeId && (
                          <div className="text-[10px] font-mono text-slate-400">{t.franchiseeId}</div>
                        )}
                      </td>

                      {/* Category / Plan */}
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          (t.type === 'franchisee_onboarding' || t.type === 'franchisee_renewal' || t.type?.startsWith('franchisee_'))
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {t.typeLabel || 'Fee'}
                        </span>
                        <div className="text-xs font-semibold mt-1 truncate max-w-[200px]">
                          {t.course || t.planName || t.description || 'Institutional Fee'}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="text-sm font-black">
                          ₹{Number(t.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <div className="text-[10px] text-slate-400 font-medium">via Razorpay Live</div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          {t.status || 'Paid'}
                        </span>
                      </td>

                      {/* Actions: View Receipt & Delete */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedTxn(t)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer"
                            title="View & Print Official Receipt"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Receipt</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTransaction(t)}
                            className="inline-flex items-center justify-center p-1.5 rounded-xl text-xs font-bold bg-slate-50 hover:bg-rose-100 hover:text-rose-700 text-slate-400 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:text-rose-400 transition cursor-pointer"
                            title="Delete Transaction Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalEntries > 0 && (
            <div className={`p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold ${
              isDarkMode ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-600'
            }`}>
              <div>
                Showing {startIndex + 1} to {Math.min(startIndex + entriesPerPage, totalEntries)} of {totalEntries} transactions
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 mr-3">
                  <span>Show</span>
                  <select
                    value={entriesPerPage}
                    onChange={(e) => { setEntriesPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition cursor-pointer ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-300 text-slate-800'
                    }`}
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
                      : isDarkMode 
                      ? 'hover:bg-slate-800 text-white border-slate-700' 
                      : 'hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="font-bold px-2 whitespace-nowrap">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                    currentPage === totalPages 
                      ? 'opacity-40 cursor-not-allowed border-transparent' 
                      : isDarkMode 
                      ? 'hover:bg-slate-800 text-white border-slate-700' 
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

      {/* Official Printable Receipt Modal */}
      {selectedTxn && (
        <PaymentReceiptModal
          transaction={selectedTxn}
          onClose={() => setSelectedTxn(null)}
        />
      )}
    </div>
  );
}
