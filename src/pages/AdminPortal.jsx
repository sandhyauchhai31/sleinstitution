import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  User,
  Mail,
  Phone,
  PhoneCall,
  Building,
  MapPin,
  Receipt,
  IndianRupee,
  CreditCard,
  ExternalLink,
  Check,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Moon,
  Sun,
  LogOut,
  Sparkles,
  ShieldCheck,
  Layers,
  Search,
  CheckCircle2,
  AlertCircle,
  Database,
  Settings,
  Home,
  Briefcase,
  Package,
  PlusCircle,
  TrendingUp,
  Loader2,
  Trash2,
  DollarSign,
  Edit,
  Power,
  ToggleLeft,
  ToggleRight,
  Users,
  GraduationCap,
  BookOpen,
  BookmarkCheck,
  FileQuestion,
  HelpCircle,
  Printer,
  Eye,
  EyeOff,
  GripVertical,
  FileSpreadsheet,
  Copy,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  ListOrdered,
  Menu,
  Lock,
  RefreshCw,
  Download,
  Upload,
  Calendar,
  Award,
  Palette,
  UserCheck,
  ArrowLeftRight,
  CheckSquare,
  Square,
  FileText,
  Camera,
  Monitor,
  Clock,
  AlertTriangle,
  History
} from 'lucide-react';
import { recordCertificateHistory, deleteCertificateHistory, subscribeToCertificateHistory, updateCertificatePaymentStatus } from '../utils/certificateHistoryManager';
import CertificateTemplate from '../components/CertificateTemplate';
import { getCertificateConfig, saveCertificateConfig, fetchCertificateConfigFromFirestore, DEFAULT_CERTIFICATE_CONFIG } from '../utils/certificateConfigManager';
import { uploadToCloudinary } from '../utils/cloudinary';
import BranchwiseStudents from '../components/BranchwiseStudents';
import PendingPaymentsMonitor from '../components/PendingPaymentsMonitor';
import AdminPaymentTransactions from '../components/AdminPaymentTransactions';
import ImportExportData from './ImportExportData';
import { subscribeToBranches, addBranch, updateBranch, deleteBranch, DEFAULT_BRANCHES, resolveBranchAddressSync } from '../utils/branchManager';
import { fetchStudentsInBranch, transferStudentsBranch } from '../utils/studentTransfer';
import { subscribeToCourses, addCourse, updateCourse, deleteCourse, resetCoursesToDefault, DEFAULT_COURSES, getCourseDisplayLabel, getCourseFullName, getCourseShortName, computeOneYearEndDate, computeOneMonthAfterDate } from '../utils/courseManager';
import { subscribeToDirectors, addDirector, updateDirector, deleteDirector, resetDirectorsToDefault, DEFAULT_DIRECTORS } from '../utils/directorManager';
import { subscribeToCourseSubjects, getStoredSubjectsForCourse, saveCourseSubjects, DEFAULT_COURSE_SUBJECTS } from '../utils/subjectManager';
import {
  getStoredExam,
  saveCompositeExam,
  deleteCompositeExam,
  subscribeToExams,
  generateCompositeTemplate,
  generateQuestionsForSubject,
  getExamDocId,
  getStoredPaper,
  saveQuestionPaper,
  getQuestionPaperSubjectMarks,
  deleteQuestionPaper,
  subscribeToQuestionPapers,
  generateDefault100Questions,
  updateExamStatus,
  downloadExamResultsAsCSV
} from '../utils/questionPaperManager';
import {
  auth,
  db,
  signOut,
  onAuthStateChanged,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  getDoc
} from '../firebase';

export default function AdminPortal() {
  const navigate = useNavigate();

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Sidebar collapse state — start collapsed on smaller screens (< 1024px) for mobile responsiveness
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);

  // Mobile sidebar drawer open/close state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Active Menu: 'add-franchisee' | 'set-plans' | 'certificate-designer'
  const [activeMenu, setActiveMenu] = useState('add-franchisee');

  // Certificate Designer State
  const [certConfig, setCertConfig] = useState(() => getCertificateConfig());
  const [isSavingCertConfig, setIsSavingCertConfig] = useState(false);
  const [certViewMode, setCertViewMode] = useState('split'); // 'split' | 'editor' | 'preview'

  useEffect(() => {
    fetchCertificateConfigFromFirestore().then((cfg) => {
      if (cfg) setCertConfig(cfg);
    });
  }, []);

  // Candidate Certificate Student Data Form State — initialized to default student matching Image 2
  const [certStudentData, setCertStudentData] = useState({
    admNo: '202638283',
    htNo: 'SLE2026-ALL-8283',
    candidateName: 'TEST04',
    fatherName: 'TEST04',
    courseTitle: 'C++ PROGRAMMING LANGUAGE',
    courseCode: 'C++',
    startDate: '2026-09-03',
    endDate: '2027-09-06',
    division: 'FIRST',
    issueDate: '2027-10-06',
    trainingCenter: 'MYSORE',
    branchAddress: 'VISHRAMBAG SANGLI',
    photoUrl: '',
    paymentStatus: 'Successful Payment',
    isCertPaid: true,
    isPaid: true,
    razorpayPaymentId: 'ADMIN_INIT'
  });
  const [fetchStatus, setFetchStatus] = useState(null);
  const [isFetchingStudent, setIsFetchingStudent] = useState(false);

  // Clear any legacy demo payment cache on mount
  useEffect(() => {
    try {
      localStorage.removeItem('sle_paid_cert_live_202638042');
    } catch (e) { }
  }, []);

  // Certificate History State & Handlers
  const [certHistoryList, setCertHistoryList] = useState([]);
  const [certHistorySearch, setCertHistorySearch] = useState('');
  const [isSavingCertToHistory, setIsSavingCertToHistory] = useState(false);
  const [historyPrintItem, setHistoryPrintItem] = useState(null);

  useEffect(() => {
    const unsub = subscribeToCertificateHistory((list) => {
      setCertHistoryList(list);
    }, db);
    return () => unsub && unsub();
  }, []);

  const handleSaveCurrentCertificateToHistory = async () => {
    const safeAdmNo = (certStudentData?.admNo || '').trim();
    if (!safeAdmNo) {
      showToast('Please enter a Registration Number.', 'error');
      return;
    }
    setIsSavingCertToHistory(true);
    try {
      const feeAmount = Number(certConfig.certificateFee ?? 500);
      const isPaid = Boolean(isCertPrintUnlocked);
      const paymentStatus = isPaid ? 'Successful Payment' : 'Pending Payment';
      const record = {
        ...certStudentData,
        admNo: safeAdmNo,
        certificateFee: feeAmount,
        feeAmount: feeAmount,
        paymentStatus,
        isPaid,
        paymentMode: isPaid ? 'live' : 'unpaid',
        razorpayPaymentId: certStudentData.razorpayPaymentId || (isPaid ? 'ADMIN_VERIFIED' : ''),
        savedBy: currentUser?.displayName || 'Admin'
      };
      await recordCertificateHistory(record, db);
      showToast(`Certificate recorded with status: ${paymentStatus}!`, 'success');
    } catch (err) {
      console.error('Error saving certificate history:', err);
      showToast('Failed to save certificate history: ' + (err.message || 'Error'), 'error');
    } finally {
      setIsSavingCertToHistory(false);
    }
  };

  const handlePrintHistoryCertificate = (item) => {
    const isSuccess = item.paymentStatus === 'Successful Payment' || (!item.paymentStatus && item.isPaid === true);

    setCertStudentData({
      admNo: item.admNo,
      htNo: item.htNo || '',
      candidateName: item.candidateName || '',
      fatherName: item.fatherName || '',
      courseTitle: item.courseTitle || '',
      courseCode: item.courseCode || '',
      startDate: item.startDate || '',
      endDate: item.endDate || '',
      division: item.division || 'FIRST CLASS',
      issueDate: item.issueDate || '',
      trainingCenter: item.trainingCenter || item.branchAddress || '',
      branchAddress: item.branchAddress || item.trainingCenter || '',
      photoUrl: item.photoUrl || '',
      paymentStatus: item.paymentStatus || (isSuccess ? 'Successful Payment' : 'Pending Payment'),
      isCertPaid: isSuccess,
      isPaid: isSuccess,
      razorpayPaymentId: isSuccess ? (item.razorpayPaymentId || 'SAVED_HISTORY') : ''
    });

    setAdminPayStudentAdmNo(item.admNo);
    setAdminPayCandidateName(item.candidateName);
    if (item.certificateFee || item.feeAmount) {
      setCertConfig(prev => ({ ...prev, certificateFee: Number(item.certificateFee || item.feeAmount) }));
    }

    if (!isSuccess) {
      // Payment is pending or failed — strictly keep certificate locked
      try {
        localStorage.removeItem(`sle_paid_cert_live_${item.admNo}`);
      } catch (e) { }
      setLastAdminPayment(null);
      setShowPaymentLockModal(true);
      showToast(`Certificate is locked (${item.paymentStatus || 'Pending Payment'}). Complete fee payment to unlock.`, 'warning');
      return;
    }

    // Payment is successful — open printable certificate modal
    setHistoryPrintItem(item);
  };

  const handleLockedHistoryClick = (item) => {
    const fee = Number(item.certificateFee ?? item.feeAmount ?? certConfig.certificateFee ?? 500);
    setCertStudentData({
      admNo: item.admNo,
      htNo: item.htNo || '',
      candidateName: item.candidateName || '',
      fatherName: item.fatherName || '',
      courseTitle: item.courseTitle || '',
      courseCode: item.courseCode || '',
      startDate: item.startDate || '',
      endDate: item.endDate || '',
      division: item.division || 'FIRST CLASS',
      issueDate: item.issueDate || '',
      trainingCenter: item.trainingCenter || item.branchAddress || '',
      branchAddress: item.branchAddress || item.trainingCenter || '',
      photoUrl: item.photoUrl || '',
      paymentStatus: item.paymentStatus || 'Pending Payment',
      isCertPaid: false,
      isPaid: false,
      razorpayPaymentId: ''
    });

    setAdminPayStudentAdmNo(item.admNo);
    setAdminPayCandidateName(item.candidateName || '');
    setCertConfig(prev => ({ ...prev, certificateFee: fee }));
    try {
      localStorage.removeItem(`sle_paid_cert_live_${item.admNo}`);
    } catch (e) { }
    setLastAdminPayment(null);
    setShowPaymentLockModal(true);
    showToast(`Certificate printing locked. Complete ₹${fee} payment via Razorpay to unlock.`, 'warning');
  };

  const handleLoadHistoryToDesigner = (item) => {
    const isSuccess = item.paymentStatus === 'Successful Payment' || (!item.paymentStatus && item.isPaid === true);

    if (!isSuccess) {
      try {
        localStorage.removeItem(`sle_paid_cert_live_${item.admNo}`);
      } catch (e) { }
      setLastAdminPayment(null);
    }

    setCertStudentData({
      admNo: item.admNo,
      htNo: item.htNo || '',
      candidateName: item.candidateName || '',
      fatherName: item.fatherName || '',
      courseTitle: item.courseTitle || '',
      courseCode: item.courseCode || '',
      startDate: item.startDate || '',
      endDate: item.endDate || '',
      division: item.division || 'FIRST CLASS',
      issueDate: item.issueDate || '',
      trainingCenter: item.trainingCenter || item.branchAddress || '',
      branchAddress: item.branchAddress || item.trainingCenter || '',
      photoUrl: item.photoUrl || '',
      paymentStatus: item.paymentStatus || (isSuccess ? 'Successful Payment' : 'Pending Payment'),
      isCertPaid: isSuccess,
      isPaid: isSuccess,
      razorpayPaymentId: isSuccess ? (item.razorpayPaymentId || '') : ''
    });
    setAdminPayStudentAdmNo(item.admNo);
    setAdminPayCandidateName(item.candidateName);
    if (item.certificateFee || item.feeAmount) {
      setCertConfig(prev => ({ ...prev, certificateFee: Number(item.certificateFee || item.feeAmount) }));
    }
    showToast(`Loaded ${item.candidateName || item.admNo} into Certificate Designer!`, 'info');
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const handleDeleteHistoryItem = async (item) => {
    if (!window.confirm(`Delete certificate history record for ${item.candidateName || item.admNo}?`)) {
      return;
    }
    try {
      await deleteCertificateHistory(item.id, db);
      showToast('Certificate removed from history', 'info');
    } catch (err) {
      showToast('Error removing certificate: ' + err.message, 'error');
    }
  };

  const getSafeStringUrl = (val) => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      if (typeof val.url === 'string') return val.url;
      if (typeof val.src === 'string') return val.src;
    }
    return String(val);
  };

  const handleFetchStudentByAdmNo = async (searchNo) => {
    const rawQuery = (searchNo || certStudentData.admNo || '').trim();
    if (!rawQuery) {
      showToast('Please enter Registration / Admission No. to search', 'error');
      return;
    }
    setIsFetchingStudent(true);
    setFetchStatus(null);

    const queryLower = rawQuery.toLowerCase();

    try {
      let foundStudent = null;

      const isMatch = (data, docId) => {
        if (!data) return false;
        const fieldsToTest = [
          docId,
          data.registrationNo,
          data.admissionNo,
          data.admNo,
          data.regNo,
          data.appNumber,
          data.rollNo,
          data.htNo,
          data.id,
          data.sslcMarksNo,
          data.aadharNo
        ];
        return fieldsToTest.some(f => f && String(f).trim().toLowerCase() === queryLower);
      };

      // 1. Search in Firestore collections if db available
      const matchingDocs = [];
      if (db) {
        for (const colName of ['applications', 'coaching_students', 'students', 'certificates']) {
          try {
            const snapshot = await getDocs(collection(db, colName));
            snapshot.forEach(docSnap => {
              const data = docSnap.data();
              if (isMatch(data, docSnap.id)) {
                matchingDocs.push({ id: docSnap.id, colName, ...data });
              }
            });
          } catch (e) {
            console.warn('Firestore fetch error for', colName, e);
          }
        }
      }

      // Also search in localStorage caches
      for (const cacheKey of ['sle_students_cache', 'sle_coaching_students_cache', 'sle_applications_cache']) {
        try {
          const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
          if (Array.isArray(cached)) {
            cached.forEach(s => {
              if (isMatch(s, s.id || s.registrationNo || s.admissionNo)) {
                matchingDocs.push(s);
              }
            });
          }
        } catch (e) { }
      }

      if (matchingDocs.length > 0) {
        // Sort matching documents so the most recently edited/updated record takes highest priority
        matchingDocs.sort((a, b) => {
          const timeA = new Date(a.updatedAt || a.submittedAt || a.createdAt || a.admissionDate || 0).getTime() || 0;
          const timeB = new Date(b.updatedAt || b.submittedAt || b.createdAt || b.admissionDate || 0).getTime() || 0;
          return timeB - timeA;
        });

        // Authoritative record is the latest one
        foundStudent = { ...matchingDocs[0] };

        // Fill in any missing secondary properties from other matching docs
        for (let i = 1; i < matchingDocs.length; i++) {
          const other = matchingDocs[i];
          for (const key of Object.keys(other)) {
            if (foundStudent[key] === undefined || foundStudent[key] === '' || foundStudent[key] === null) {
              foundStudent[key] = other[key];
            }
          }
        }

        // Synchronize across matching doc keys in Firestore so all copies remain consistent
        if (db) {
          const allDocKeys = Array.from(new Set(matchingDocs.map(m => m.id).concat([
            foundStudent.registrationNo,
            foundStudent.admissionNo,
            foundStudent.admNo,
            foundStudent.appNumber,
            rawQuery
          ]).filter(Boolean)));

          const syncPayload = {
            name: foundStudent.name || foundStudent.fullName || foundStudent.candidateName || '',
            fullName: foundStudent.fullName || foundStudent.name || foundStudent.candidateName || '',
            candidateName: foundStudent.candidateName || foundStudent.fullName || foundStudent.name || '',
            fatherName: foundStudent.fatherName || foundStudent.parentName || '',
            course: foundStudent.course || foundStudent.courseTitle || foundStudent.courseCode || '',
            courseCode: foundStudent.courseCode || foundStudent.course || '',
            courseTitle: foundStudent.courseTitle || foundStudent.course || '',
            trustBranch: foundStudent.trustBranch || foundStudent.trainingCenter || foundStudent.branchName || '',
            trainingCenter: foundStudent.trainingCenter || foundStudent.trustBranch || foundStudent.branchName || '',
            startDate: foundStudent.startDate || foundStudent.admissionDate || '',
            admissionDate: foundStudent.admissionDate || foundStudent.startDate || '',
            endDate: foundStudent.endDate || '',
            updatedAt: foundStudent.updatedAt || new Date().toISOString()
          };

          for (const colName of ['students', 'applications', 'coaching_students']) {
            for (const dKey of allDocKeys) {
              try {
                setDoc(doc(db, colName, dKey), syncPayload, { merge: true }).catch(() => {});
              } catch (_) {}
            }
          }
        }
      }

      if (foundStudent) {
        const rawCourse = foundStudent.courseTitle || foundStudent.courseName || foundStudent.course || foundStudent.selectedClass || foundStudent.courseCode || '';
        const resolvedCourseTitle = getCourseFullName(rawCourse) || rawCourse || 'GOODS & SERVICES TAX ACCOUNTING';

        const admNoVal = foundStudent.registrationNo || foundStudent.admissionNo || foundStudent.admNo || foundStudent.regNo || foundStudent.appNumber || foundStudent.id || rawQuery;
        const nameVal = foundStudent.fullName || foundStudent.candidateName || foundStudent.studentName || foundStudent.name || '';
        const fatherVal = foundStudent.fatherName || foundStudent.parentName || foundStudent.father_name || foundStudent.guardianName || '';
        const centerVal = foundStudent.trustBranch || foundStudent.trainingCenter || foundStudent.branchName || foundStudent.franchiseName || foundStudent.place || foundStudent.location || 'DHARWAD';
        const photoVal = getSafeStringUrl(foundStudent.photoPreview || foundStudent.photoUrl || foundStudent.photo || foundStudent.candidatePhoto);

        const sDate = foundStudent.startDate || foundStudent.admissionDate || '2026-09-03';
        const rawEnd = foundStudent.endDate;
        const eDate = (rawEnd && rawEnd > sDate && rawEnd !== '2026-01-01')
          ? rawEnd
          : computeOneYearEndDate(sDate, 3);
        const rawIssue = foundStudent.issueDate;
        const iDate = (rawIssue && rawIssue > eDate)
          ? rawIssue
          : computeOneMonthAfterDate(eDate);

        const branchAddr = resolveBranchAddressSync(foundStudent) || foundStudent.branchAddress || centerVal || 'DHARWAD';
        const rawCourseCode = getCourseShortName(rawCourse || foundStudent.courseCode || '') || 'GST';
        const fullCourse = getCourseFullName(resolvedCourseTitle || rawCourse || rawCourseCode) || 'GOODS & SERVICES TAX';

        const updated = {
          admNo: admNoVal,
          htNo: foundStudent.rollNo || foundStudent.htNo || foundStudent.hallTicketNo || `SLE2026-${(rawCourseCode || 'ALL').toUpperCase()}-${admNoVal.slice(-4)}`,
          candidateName: nameVal,
          fatherName: fatherVal,
          courseTitle: fullCourse,
          courseCode: rawCourseCode,
          startDate: sDate,
          endDate: eDate,
          division: foundStudent.division || foundStudent.grade || 'FIRST CLASS',
          issueDate: iDate,
          trainingCenter: centerVal,
          branchAddress: branchAddr,
          photoUrl: photoVal,
          isPaid: Boolean(
            (foundStudent.isCertPaid === true || foundStudent.isPaid === true) &&
            foundStudent.razorpayPaymentId &&
            !String(foundStudent.razorpayPaymentId).includes('test')
          ),
          isCertPaid: Boolean(
            (foundStudent.isCertPaid === true || foundStudent.isPaid === true) &&
            foundStudent.razorpayPaymentId &&
            !String(foundStudent.razorpayPaymentId).includes('test')
          ),
          paymentStatus: Boolean(
            (foundStudent.isCertPaid === true || foundStudent.isPaid === true) &&
            foundStudent.razorpayPaymentId &&
            !String(foundStudent.razorpayPaymentId).includes('test')
          ) ? 'Successful Payment' : 'Pending Payment',
          razorpayPaymentId: foundStudent.razorpayPaymentId || ''
        };

        setCertStudentData(updated);
        setAdminPayStudentAdmNo(updated.admNo);
        setAdminPayCandidateName(updated.candidateName);

        if (nameVal) {
          setFetchStatus({ type: 'success', message: `Student details fetched successfully for ${nameVal}!` });
          showToast(`Fetched details for ${nameVal}`, 'success');
        } else {
          setFetchStatus({ type: 'warning', message: `Record found for "${rawQuery}", but candidate name is blank. Please enter details.` });
        }
      } else {
        setFetchStatus({ type: 'error', message: `No student record found for Registration No: "${rawQuery}". Enter details manually below.` });
        showToast(`No student record found for "${rawQuery}"`, 'info');
      }
    } catch (err) {
      console.error('Fetch student error:', err);
      setFetchStatus({ type: 'error', message: 'Error fetching student details. Enter details manually.' });
    } finally {
      setIsFetchingStudent(false);
    }
  };

  // Razorpay Admin Payment State (Strict Live Mode Only)
  const [adminPayStudentAdmNo, setAdminPayStudentAdmNo] = useState('');
  const [adminPayCandidateName, setAdminPayCandidateName] = useState('');
  const [isRazorpayProcessing, setIsRazorpayProcessing] = useState(false);
  const [lastAdminPayment, setLastAdminPayment] = useState(null);
  const [showPaymentLockModal, setShowPaymentLockModal] = useState(false);

  const currentStudentAdmNo = (certStudentData?.admNo || adminPayStudentAdmNo || '').trim();

  // Strict live payment verification: only unlock if verified live Razorpay payment exists
  const isCurrentStudentPaid = Boolean(
    currentStudentAdmNo &&
    certStudentData?.admNo &&
    certStudentData?.paymentStatus !== 'Pending Payment' &&
    certStudentData?.paymentStatus !== 'Failed Payment' &&
    certStudentData?.isCertPaid !== false &&
    certStudentData?.isPaid !== false &&
    (
      (lastAdminPayment &&
        String(lastAdminPayment.admNo).trim() === currentStudentAdmNo &&
        lastAdminPayment.paymentId) ||
      (() => {
        try {
          if (currentStudentAdmNo === '202638042') return false; // Prevent mock student from bypassing lock
          const stored = localStorage.getItem(`sle_paid_cert_live_${currentStudentAdmNo}`);
          if (!stored) return false;
          const parsed = JSON.parse(stored);
          return Boolean(parsed && parsed.paymentId && !String(parsed.paymentId).startsWith('pay_test'));
        } catch (e) {
          return false;
        }
      })() ||
      (certStudentData?.isCertPaid === true &&
        certStudentData?.razorpayPaymentId)
    )
  );

  const isCertPrintUnlocked = isCurrentStudentPaid;

  const isLiveMode = (import.meta.env.VITE_RAZORPAY_MODE || 'live').toLowerCase() === 'live';
  const liveRazorpayKey = (
    (isLiveMode
      ? (import.meta.env.VITE_RAZORPAY_LIVE_KEY_ID || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_live_TSInBiL96HvXCm')
      : (import.meta.env.VITE_RAZORPAY_TEST_KEY_ID || 'rzp_test_SPs6AqG8E3r2Cp'))
  );

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleInitiateRazorpayAdminPayment = async () => {
    setIsRazorpayProcessing(true);
    const loaded = await loadRazorpayScript();
    if (!loaded) {
      showToast('Failed to load Razorpay SDK. Please check internet connection.', 'error');
      setIsRazorpayProcessing(false);
      return;
    }

    const feeAmount = certConfig.certificateFee || 500;
    const targetAdmNo = (certStudentData?.admNo || adminPayStudentAdmNo || '202638042').trim();
    const targetName = (certStudentData?.candidateName || adminPayCandidateName || 'TEST07 CANDIDATE').trim();

    const options = {
      key: liveRazorpayKey,
      amount: feeAmount * 100,
      currency: 'INR',
      name: 'S.L.E.S. Institution',
      description: `Official Certificate Generation Fee (LIVE) for ${targetName} (${targetAdmNo})`,
      image: '/logo-2.png',
      handler: async function (response) {
        const paymentId = response.razorpay_payment_id;
        if (!paymentId) {
          showToast('Payment verification failed: no payment ID received.', 'error');
          setIsRazorpayProcessing(false);
          return;
        }

        const paymentRecord = {
          paymentId,
          amount: feeAmount,
          date: new Date().toLocaleString(),
          admNo: targetAdmNo,
          candidateName: targetName,
          mode: 'live'
        };

        localStorage.setItem(`sle_paid_cert_live_${targetAdmNo}`, JSON.stringify(paymentRecord));
        if (db) {
          try {
            await setDoc(doc(db, 'students', targetAdmNo), {
              isPaid: true,
              isCertPaid: true,
              certPaidAt: new Date().toISOString(),
              razorpayPaymentId: paymentId,
              paidAmount: feeAmount,
              paymentMode: 'live'
            }, { merge: true });
          } catch (e) {
            console.warn('Firestore update error:', e);
          }
        }

        setLastAdminPayment(paymentRecord);
        setCertStudentData(prev => ({
          ...prev,
          isPaid: true,
          isCertPaid: true,
          razorpayPaymentId: paymentId
        }));
        setShowPaymentLockModal(false);

        // Auto-record to persistent certificate history with exact fee and payment details
        try {
          await recordCertificateHistory({
            ...certStudentData,
            admNo: targetAdmNo,
            candidateName: targetName,
            certificateFee: feeAmount,
            feeAmount: feeAmount,
            isPaid: true,
            paymentMode: 'live',
            razorpayPaymentId: paymentId,
            savedBy: currentUser?.displayName || 'Admin'
          }, db);
        } catch (histErr) {
          console.warn('Auto record cert history error:', histErr);
        }

        showToast(`Razorpay Payment Successful! ID: ${paymentId}. Certificate Unlocked!`, 'success');
        setIsRazorpayProcessing(false);
      },
      prefill: {
        name: targetName,
        email: 'admin@slefoundation.org',
        contact: '9999999999'
      },
      theme: {
        color: '#059669'
      },
      modal: {
        ondismiss: function () {
          setIsRazorpayProcessing(false);
        }
      }
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', async function (response) {
        console.error('Razorpay payment failed:', response.error);
        setIsRazorpayProcessing(false);
        showToast(`Payment Failed: ${response.error?.description || 'Transaction declined'}`, 'error');

        // Automatically record Failed Payment status in Certificate History
        try {
          await recordCertificateHistory({
            ...certStudentData,
            admNo: targetAdmNo,
            candidateName: targetName,
            certificateFee: feeAmount,
            feeAmount: feeAmount,
            paymentStatus: 'Failed Payment',
            isPaid: false,
            paymentMode: 'live',
            savedBy: currentUser?.displayName || 'Admin'
          }, db);
        } catch (e) {
          console.warn('Failed payment history log error:', e);
        }
      });
      rzp.open();
    } catch (err) {
      console.error('Razorpay Modal error:', err);
      showToast('Error launching Razorpay window.', 'error');
      setIsRazorpayProcessing(false);
    }
  };

  const handleCertificatePrintClick = () => {
    if (!isCertPrintUnlocked) {
      setShowPaymentLockModal(true);
      return;
    }
    window.print();
  };

  const franchiseeFormRef = useRef(null);

  // Firebase / Current user state
  const [currentUser, setCurrentUser] = useState({
    email: 'admin@slefoundation.org',
    displayName: 'Master Administrator',
    isDemo: true
  });

  // Firebase sync status
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(true);

  // Toast feedback notification state
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const isAdminSession = sessionStorage.getItem('sle_admin_logged_in') === 'true';
    const userRole = sessionStorage.getItem('sle_user_role') || localStorage.getItem('sle_user_role');
    if (!isAdminSession || userRole !== 'admin') {
      sessionStorage.removeItem('sle_admin_logged_in');
      sessionStorage.removeItem('sle_user_role');
      localStorage.removeItem('sle_admin_demo');
      if (localStorage.getItem('sle_user_role') === 'admin') {
        localStorage.removeItem('sle_user_role');
      }
      navigate('/login?mode=admin', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.log('Firebase SignOut error', e);
    }
    sessionStorage.removeItem('sle_admin_logged_in');
    sessionStorage.removeItem('sle_user_role');
    localStorage.removeItem('sle_admin_demo');
    localStorage.removeItem('sle_portal_user');
    localStorage.removeItem('sle_user_role');
    navigate('/login?mode=admin', { replace: true });
  };

  // Default Plans Blueprint
  const defaultPlans = [
    {
      id: 'plan-1yr',
      name: '1 Year Plan',
      duration: '1 Year',
      years: 1,
      badge: '',
      isPopular: false,
      price: 15000,
      currency: '₹',
      billingPeriod: '/year',
      active: true,
      updating: false,
      features: [
        'Full Institutional Portal Access',
        'Up to 250 Student Registrations',
        'Standard Email & SMS Notifications',
        'Official Certificate Generation',
        'Standard Support (24-48 hrs)'
      ]
    },
    {
      id: 'plan-2yr',
      name: '2 Year Plan',
      duration: '2 Years',
      years: 2,
      badge: 'Most Popular',
      isPopular: true,
      price: 27000,
      currency: '₹',
      billingPeriod: '/2 years',
      active: true,
      updating: false,
      features: [
        'All 1-Year Features Included',
        'Unlimited Student Registrations',
        'Priority Phone & WhatsApp Support',
        'Custom Institution Branding & Seal',
        'Advanced Candidate Analytics Dashboard',
        'Free Hall Ticket Printing Tools'
      ]
    },
    {
      id: 'plan-3yr',
      name: '3 Year Plan',
      duration: '3 Years',
      years: 3,
      badge: 'Best Value',
      isPopular: false,
      price: 36000,
      currency: '₹',
      billingPeriod: '/3 years',
      active: true,
      updating: false,
      features: [
        'All 2-Year Features Included',
        'Dedicated Account & Technical Manager',
        'API & Custom Database Integrations',
        'Multi-Branch Management Suite',
        'Lifetime Fee Lock Guarantee',
        'Priority Official Forms Processing'
      ]
    }
  ];

  // Helper to ensure clean Firestore serialization (no undefined values)
  const sanitizePlanForFirestore = (plan) => {
    const yearsVal = Number(plan.years) || (plan.duration && parseInt(plan.duration, 10)) || (plan.id?.includes('1') ? 1 : plan.id?.includes('2') ? 2 : plan.id?.includes('3') ? 3 : 1);
    return {
      id: String(plan.id),
      name: String(plan.name || ''),
      duration: String(plan.duration || `${yearsVal} Year${yearsVal > 1 ? 's' : ''}`),
      years: yearsVal,
      badge: String(plan.badge || ''),
      isPopular: Boolean(plan.isPopular),
      price: Number(plan.price) || 0,
      currency: String(plan.currency || '₹'),
      billingPeriod: String(plan.billingPeriod || (yearsVal > 1 ? `/${yearsVal} years` : '/year')),
      active: Boolean(plan.active),
      features: Array.isArray(plan.features) ? plan.features.map(f => String(f)) : []
    };
  };

  // Default Franchisee Blueprint
  const defaultFranchisees = [
    {
      id: 'FR-2026-901',
      fullName: 'Rajesh Sharma',
      email: 'rajesh@sle-academy.org',
      phone: '9845012345',
      franchiseName: 'SLE Academy Belagavi',
      location: 'Belagavi',
      gstId: '29ABCDE1234F1ZH',
      planId: 'plan-2yr',
      planName: '2 Year Plan',
      createdDate: '2026-08-20',
      status: 'Active'
    },
    {
      id: 'FR-2026-902',
      fullName: 'Priya Deshmukh',
      email: 'priya.sle@gmail.com',
      phone: '9766304411',
      franchiseName: 'Navodaya Coaching Hub Hubballi',
      location: 'Hubballi',
      gstId: '29XYZWV9876G2ZK',
      planId: 'plan-1yr',
      planName: '1 Year Plan',
      createdDate: '2026-08-21',
      status: 'Active'
    }
  ];

  // --- PLANS STATE ---
  const [plans, setPlans] = useState(defaultPlans);

  // --- FRANCHISEE STATE ---
  const [franchisees, setFranchisees] = useState(() => {
    try {
      const cached = localStorage.getItem('sle_franchisees_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) { }
    return defaultFranchisees;
  });

  // --- PRICING SETTINGS STATE ---
  const [firstTimeFee, setFirstTimeFee] = useState(() => {
    return Number(localStorage.getItem('sle_first_time_fee')) || 20000;
  });
  const [standardFee, setStandardFee] = useState(() => {
    return Number(localStorage.getItem('sle_standard_fee')) || 500;
  });
  const [certStandardFee, setCertStandardFee] = useState(() => {
    return Number(localStorage.getItem('sle_cert_standard_fee')) || 500;
  });
  const [isSavingPricing, setIsSavingPricing] = useState(false);
  const [isSavingCertPricing, setIsSavingCertPricing] = useState(false);

  // Temporary new feature input buffer for each plan
  const [newFeatureText, setNewFeatureText] = useState({
    'plan-1yr': '',
    'plan-2yr': '',
    'plan-3yr': ''
  });

  // Franchisee Search Term
  const [franchiseeSearch, setFranchiseeSearch] = useState('');

  // Franchisee Form Initial State (All 33 fields across 5 steps)
  const initialFranchiseeForm = {
    // Step 1: Personal Details
    centerName: '',
    firmName: '',
    ownerName: '',
    fullName: '',
    contactNumber: '',
    phone: '',
    qualification: '',
    place: '',
    location: '',
    districtState: '',
    residentialAddress: '',
    residentialPinCode: '',

    // Step 2: Training Address Details
    trainingMobileNumber: '',
    centerAddress: '',
    centerPinCode: '',
    email: '',
    computerSystems: '',
    lcdProjector: '',
    geographicalCenter: 'Urban',
    premisesAreaSqFt: '',
    noOfClassroom: '',
    noOfLab: '',

    // Step 3: Trade & Banking Details
    trade: '',
    affiliationFee: '',
    seatRequire: '',
    modeOfPayment: 'Online / Bank Transfer',
    accountNo: '',
    bankName: '',
    ifscCode: '',

    // Step 4: Documents Upload
    photoUrl: '',
    signatureUrl: '',
    panCardUrl: '',
    bankDetailsUrl: '',
    aadhaarCardUrl: '',
    premisesPhotoUrl: '',
    addressProofUrl: '',

    // Step 5: Portal Credentials & Plan Allocation
    password: '',
    confirmPassword: '',
    gstId: '',
    planId: 'first-time-franchisee-fee'
  };

  const [franchiseeForm, setFranchiseeForm] = useState(initialFranchiseeForm);
  const [franchiseeStep, setFranchiseeStep] = useState(1);

  // Document upload handler with base64 preview
  const handleFranchiseeDocUpload = (e, fieldKey) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('File size is too large (max 2MB)', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setFranchiseeForm(prev => ({
        ...prev,
        [fieldKey]: event.target.result,
        [`${fieldKey}_name`]: file.name,
        [`${fieldKey}_size`]: Math.round(file.size / 1024) + ' KB'
      }));
      showToast(`${file.name} uploaded!`, 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFranchiseeDoc = (fieldKey) => {
    setFranchiseeForm(prev => ({
      ...prev,
      [fieldKey]: '',
      [`${fieldKey}_name`]: '',
      [`${fieldKey}_size`]: ''
    }));
  };

  const handleNextFranchiseeStep = () => {
    if (franchiseeStep === 1) {
      const owner = (franchiseeForm.ownerName || franchiseeForm.fullName || '').trim();
      const contact = (franchiseeForm.contactNumber || franchiseeForm.phone || '').trim();
      if (!owner) {
        showToast('Please enter Owner Name to proceed.', 'error');
        return;
      }
      if (!contact) {
        showToast('Please enter Contact Number to proceed.', 'error');
        return;
      }
      setFranchiseeStep(2);
    } else if (franchiseeStep === 2) {
      if (!franchiseeForm.email.trim()) {
        showToast('Please enter an Email address to proceed.', 'error');
        return;
      }
      setFranchiseeStep(3);
    } else if (franchiseeStep === 3) {
      setFranchiseeStep(4);
    } else if (franchiseeStep === 4) {
      setFranchiseeStep(5);
    }
    setTimeout(() => {
      if (franchiseeFormRef.current) {
        franchiseeFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const [isSavingFranchisee, setIsSavingFranchisee] = useState(false);
  const [showFranchiseePassword, setShowFranchiseePassword] = useState(false);
  const [editingFranchiseeId, setEditingFranchiseeId] = useState(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);
  const [viewingFranchiseeDetails, setViewingFranchiseeDetails] = useState(null);
  const [viewingDocument, setViewingDocument] = useState(null);

  // Franchisee Certificate Upload State
  const [certModalTarget, setCertModalTarget] = useState(null);
  const [isUploadingFranchiseCert, setIsUploadingFranchiseCert] = useState(false);
  const [certSearchQuery, setCertSearchQuery] = useState('');
  const [certFilterStatus, setCertFilterStatus] = useState('all'); // 'all' | 'pending' | 'issued'
  const certFileInputRef = useRef(null);

  const handleOpenDocument = (docUrl, docTitle = 'Document Preview') => {
    if (!docUrl) {
      showToast('No document attached', 'info');
      return;
    }
    setViewingDocument({
      url: docUrl,
      title: docTitle
    });
  };

  const handleDownloadDoc = (docUrl, fileName = 'verification_document') => {
    if (!docUrl) return;
    try {
      const link = document.createElement('a');
      link.href = docUrl;
      const cleanName = fileName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const ext = docUrl.startsWith('data:image/png') ? '.png' : docUrl.startsWith('data:image/jpeg') ? '.jpg' : docUrl.startsWith('data:application/pdf') ? '.pdf' : '';
      link.download = cleanName + (ext && !cleanName.endsWith(ext) ? ext : '');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Document downloaded!', 'success');
    } catch (err) {
      console.error('Download error:', err);
      showToast('Could not download file', 'error');
    }
  };

  const handleOpenInNewWindow = (docUrl, docTitle = 'Document Preview') => {
    if (!docUrl) return;
    if (docUrl.startsWith('data:')) {
      try {
        const parts = docUrl.split(';base64,');
        if (parts.length === 2) {
          const contentType = parts[0].replace('data:', '');
          const byteCharacters = atob(parts[1]);
          const byteArrays = [];
          for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
              byteNumbers[i] = slice.charCodeAt(i);
            }
            byteArrays.push(new Uint8Array(byteNumbers));
          }
          const blob = new Blob(byteArrays, { type: contentType });
          const blobUrl = URL.createObjectURL(blob);
          const newWin = window.open(blobUrl, '_blank');
          if (newWin) return;
        }
      } catch (e) {
        console.warn('Blob conversion fallback:', e);
      }
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`<!DOCTYPE html><html><head><title>${docTitle}</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0f172a;}</style></head><body><img src="${docUrl}" style="max-width:100%;max-height:100vh;object-fit:contain;box-shadow:0 10px 25px rgba(0,0,0,0.5);border-radius:8px;" /></body></html>`);
        win.document.close();
      }
    } else {
      window.open(docUrl, '_blank');
    }
  };

  // Franchisee Certificate Upload Handler (Supports Image & PDF)
  const handleUploadFranchiseCertificate = async (file, targetFranchisee) => {
    if (!file || !targetFranchisee) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Certificate file size must be less than 5MB', 'error');
      return;
    }

    setIsUploadingFranchiseCert(true);
    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      let finalUrl = '';

      // 1. Try Cloudinary upload
      try {
        finalUrl = await uploadToCloudinary(file, 'sle_franchisee_certificates', 800);
      } catch (err) {
        console.warn('Cloudinary upload warning:', err);
      }

      // 2. Fallback to base64 Data URL
      if (!finalUrl || (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://'))) {
        finalUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      const certPayload = {
        franchiseCertificateUrl: finalUrl,
        franchiseCertificateName: file.name,
        franchiseCertificateType: isPdf ? 'pdf' : 'image',
        franchiseCertificateIssuedAt: new Date().toISOString().split('T')[0],
        franchiseCertificateSize: Math.round(file.size / 1024) + ' KB'
      };

      // Save to Firebase Firestore
      if (db && targetFranchisee.id) {
        await setDoc(doc(db, 'franchisees', targetFranchisee.id), certPayload, { merge: true });
      }

      // Update in local cache
      try {
        const cached = JSON.parse(localStorage.getItem('sle_franchisees_cache') || '[]');
        const updatedCache = cached.map(item => item.id === targetFranchisee.id ? { ...item, ...certPayload } : item);
        localStorage.setItem('sle_franchisees_cache', JSON.stringify(updatedCache));
      } catch (e) { }

      // Update in current state
      setFranchisees(prev => prev.map(item => item.id === targetFranchisee.id ? { ...item, ...certPayload } : item));
      if (viewingFranchiseeDetails?.id === targetFranchisee.id) {
        setViewingFranchiseeDetails(prev => ({ ...prev, ...certPayload }));
      }
      if (certModalTarget?.id === targetFranchisee.id) {
        setCertModalTarget(prev => ({ ...prev, ...certPayload }));
      }

      showToast(`Franchisee certificate uploaded for ${targetFranchisee.franchiseName || targetFranchisee.fullName || targetFranchisee.id}!`, 'success');
    } catch (err) {
      console.error('Franchisee cert upload error:', err);
      showToast('Failed to upload certificate. Please try again.', 'error');
    } finally {
      setIsUploadingFranchiseCert(false);
    }
  };

  // Remove Franchisee Certificate Handler
  const handleRemoveFranchiseCertificate = async (targetFranchisee) => {
    if (!targetFranchisee?.id) return;
    try {
      const certPayload = {
        franchiseCertificateUrl: '',
        franchiseCertificateName: '',
        franchiseCertificateType: '',
        franchiseCertificateIssuedAt: '',
        franchiseCertificateSize: ''
      };

      if (db) {
        await setDoc(doc(db, 'franchisees', targetFranchisee.id), certPayload, { merge: true });
      }

      try {
        const cached = JSON.parse(localStorage.getItem('sle_franchisees_cache') || '[]');
        const updatedCache = cached.map(item => item.id === targetFranchisee.id ? { ...item, ...certPayload } : item);
        localStorage.setItem('sle_franchisees_cache', JSON.stringify(updatedCache));
      } catch (e) { }

      setFranchisees(prev => prev.map(item => item.id === targetFranchisee.id ? { ...item, ...certPayload } : item));
      if (viewingFranchiseeDetails?.id === targetFranchisee.id) {
        setViewingFranchiseeDetails(prev => ({ ...prev, ...certPayload }));
      }
      if (certModalTarget?.id === targetFranchisee.id) {
        setCertModalTarget(prev => ({ ...prev, ...certPayload }));
      }

      showToast('Franchisee certificate removed.', 'info');
    } catch (err) {
      console.error('Franchisee cert remove error:', err);
      showToast('Failed to remove certificate', 'error');
    }
  };

  // --- DYNAMIC BRANCHES STATE ---
  const [branches, setBranches] = useState([]);
  const [newBranchName, setNewBranchName] = useState('');
  const [isAddingBranch, setIsAddingBranch] = useState(false);
  const [branchSearch, setBranchSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all'); // 'all' | 'default' | 'custom'
  const [branchDeleteTarget, setBranchDeleteTarget] = useState(null);
  const [isDeletingBranch, setIsDeletingBranch] = useState(false);
  const [branchEditTarget, setBranchEditTarget] = useState(null);
  const [editBranchName, setEditBranchName] = useState('');
  const [isUpdatingBranch, setIsUpdatingBranch] = useState(false);

  // --- INQUIRIES STATE ---
  const [inquiriesSearch, setInquiriesSearch] = useState('');
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState('All');

  // --- STUDENT BRANCH TRANSFER STATE ---
  const [transferFromBranch, setTransferFromBranch] = useState('');
  const [transferToBranch, setTransferToBranch] = useState('');
  const [transferStudentsList, setTransferStudentsList] = useState([]);
  const [transferSelectedIds, setTransferSelectedIds] = useState([]);
  const [transferSearchQuery, setTransferSearchQuery] = useState('');
  const [isLoadingTransferStudents, setIsLoadingTransferStudents] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferResult, setTransferResult] = useState(null);
  const [showTransferConfirmModal, setShowTransferConfirmModal] = useState(false);
  const [transferLoadError, setTransferLoadError] = useState('');

  const handleFetchTransferStudents = async () => {
    if (!transferFromBranch) {
      showToast('Please select a source branch first.', 'error');
      return;
    }
    setIsLoadingTransferStudents(true);
    setTransferLoadError('');
    setTransferStudentsList([]);
    setTransferSelectedIds([]);
    setTransferResult(null);
    try {
      const { students } = await fetchStudentsInBranch(transferFromBranch);
      setTransferStudentsList(students);
      if (students.length === 0) {
        setTransferLoadError(`No students found in branch "${transferFromBranch}".`);
      } else {
        showToast(`Found ${students.length} student(s) in "${transferFromBranch}"`);
      }
    } catch (err) {
      setTransferLoadError('Error fetching students. Please try again.');
      showToast('Error fetching students.', 'error');
    } finally {
      setIsLoadingTransferStudents(false);
    }
  };

  const handleConfirmTransfer = async () => {
    if (!transferToBranch) {
      showToast('Please select the destination branch.', 'error');
      return;
    }
    setShowTransferConfirmModal(false);
    setIsTransferring(true);
    setTransferResult(null);
    try {
      let idsToTransfer = [];
      if (transferSelectedIds.length > 0) {
        const selectedStudents = transferStudentsList.filter(s =>
          transferSelectedIds.includes(s.id) ||
          (s.docId && transferSelectedIds.includes(s.docId)) ||
          (s.registrationNo && transferSelectedIds.includes(s.registrationNo)) ||
          (s.appNumber && transferSelectedIds.includes(s.appNumber))
        );
        const idSet = new Set();
        transferSelectedIds.forEach(id => id && idSet.add(String(id).trim()));
        selectedStudents.forEach(s => {
          [s.id, s.docId, s.registrationNo, s.regNo, s.admissionNo, s.admNo, s.appNumber, s.appRefNo, s.studentId]
            .filter(Boolean)
            .forEach(k => idSet.add(String(k).trim()));
        });
        idsToTransfer = Array.from(idSet);
      }
      const result = await transferStudentsBranch(idsToTransfer, transferFromBranch, transferToBranch);
      setTransferResult(result);
      if (result.transferred > 0) {
        showToast(`Successfully transferred ${result.transferred} student(s) to "${transferToBranch}"!`, 'success');
        // Refresh the student list
        const { students } = await fetchStudentsInBranch(transferFromBranch);
        setTransferStudentsList(students);
        setTransferSelectedIds([]);
      } else {
        showToast(result.errors[0] || 'No students were transferred.', 'error');
      }
    } catch (err) {
      showToast('Transfer failed. Please try again.', 'error');
    } finally {
      setIsTransferring(false);
    }
  };

  const filteredTransferStudents = transferStudentsList.filter(s => {
    if (!transferSearchQuery.trim()) return true;
    const q = transferSearchQuery.toLowerCase();
    const name = (s.fullName || s.studentName || s.candidateName || s.name || '').toLowerCase();
    const reg = (s.registrationNo || s.regNo || s.admissionNo || s.admNo || '').toLowerCase();
    const id = (s.id || s.appNumber || s.appRefNo || '').toLowerCase();
    const course = (s.courseTitle || s.courseName || s.course || s.selectedClass || '').toLowerCase();
    return name.includes(q) || reg.includes(q) || id.includes(q) || course.includes(q);
  });

  useEffect(() => {
    const unsub = subscribeToBranches((loadedBranches) => {
      setBranches(loadedBranches);
    });
    return () => unsub && unsub();
  }, []);

  const handleAddBranch = async (e) => {
    e.preventDefault();
    if (!newBranchName.trim()) {
      showToast('Please enter a branch name.', 'error');
      return;
    }
    setIsAddingBranch(true);
    const res = await addBranch(newBranchName);
    setIsAddingBranch(false);
    if (res.success) {
      showToast(`Branch "${res.branch.name}" successfully added!`);
      setNewBranchName('');
    } else {
      showToast(res.error || 'Failed to add branch', 'error');
    }
  };

  const handleStartEditBranch = (branch) => {
    setBranchEditTarget(branch);
    setEditBranchName(branch.name);
  };

  const handleSaveEditBranch = async (e) => {
    e.preventDefault();
    if (!editBranchName.trim()) {
      showToast('Please enter a branch name.', 'error');
      return;
    }
    setIsUpdatingBranch(true);
    const res = await updateBranch(branchEditTarget.id, editBranchName.trim());
    setIsUpdatingBranch(false);
    if (res.success) {
      showToast(`Branch renamed to "${res.branch.name}" successfully!`);
      setBranchEditTarget(null);
      setEditBranchName('');
    } else {
      showToast(res.error || 'Failed to update branch', 'error');
    }
  };

  const handleConfirmDeleteBranch = async () => {
    if (!branchDeleteTarget) return;
    setIsDeletingBranch(true);
    const res = await deleteBranch(branchDeleteTarget.id);
    setIsDeletingBranch(false);
    if (res.success) {
      showToast(`Branch "${branchDeleteTarget.name}" deleted successfully.`);
      setBranchDeleteTarget(null);
    } else {
      showToast(res.error || 'Failed to delete branch.', 'error');
    }
  };

  const filteredBranches = branches.filter(b => {
    const name = (b.name || '').toLowerCase();
    const q = branchSearch.trim().toLowerCase();
    if (q && !name.includes(q)) return false;
    if (branchFilter === 'default' && !b.isDefault) return false;
    if (branchFilter === 'custom' && b.isDefault) return false;
    return true;
  });

  // --- DYNAMIC COURSES STATE ---
  const [courses, setCourses] = useState([]);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseForm, setNewCourseForm] = useState({
    name: '',
    title: '',
    badge: 'Job Ready',
    description: '',
    image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=600'
  });
  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('all'); // 'all' | 'default' | 'custom'
  const [courseDeleteTarget, setCourseDeleteTarget] = useState(null);
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);
  const [courseEditTarget, setCourseEditTarget] = useState(null);
  const [editCourseName, setEditCourseName] = useState('');
  const [editCourseForm, setEditCourseForm] = useState({
    name: '',
    title: '',
    badge: '',
    description: '',
    image: ''
  });
  const [isUpdatingCourse, setIsUpdatingCourse] = useState(false);
  const [isUploadingNewCourseImage, setIsUploadingNewCourseImage] = useState(false);
  const [isUploadingEditCourseImage, setIsUploadingEditCourseImage] = useState(false);
  const newCourseImageFileRef = useRef(null);
  const editCourseImageFileRef = useRef(null);

  const handleUploadCourseImage = async (file, isEditMode = false) => {
    if (!file) return;
    if (isEditMode) {
      setIsUploadingEditCourseImage(true);
    } else {
      setIsUploadingNewCourseImage(true);
    }

    try {
      const uploadedUrl = await uploadToCloudinary(file, 'sle_course_thumbnails', 300);
      if (uploadedUrl) {
        if (isEditMode) {
          setEditCourseForm(prev => ({ ...prev, image: uploadedUrl }));
        } else {
          setNewCourseForm(prev => ({ ...prev, image: uploadedUrl }));
        }
        showToast('Course thumbnail image uploaded successfully!');
      } else {
        showToast('Failed to upload image. Please try again or paste a URL.', 'error');
      }
    } catch (err) {
      console.error('Image upload error:', err);
      showToast('Error uploading image file.', 'error');
    } finally {
      if (isEditMode) {
        setIsUploadingEditCourseImage(false);
      } else {
        setIsUploadingNewCourseImage(false);
      }
    }
  };

  useEffect(() => {
    const unsub = subscribeToCourses((loadedCourses) => {
      setCourses(loadedCourses);
    });
    return () => unsub && unsub();
  }, []);

  const handleAddCourse = async (e) => {
    e.preventDefault();
    const courseCode = newCourseForm.name.trim() || newCourseName.trim() || newCourseForm.title.trim();
    if (!courseCode) {
      showToast('Please enter a course code/name.', 'error');
      return;
    }
    setIsAddingCourse(true);
    const payload = {
      name: courseCode,
      title: newCourseForm.title.trim() || courseCode,
      badge: newCourseForm.badge.trim() || 'Professional',
      description: newCourseForm.description.trim() || `${courseCode} course covering practical skills, industry projects, and government recognized certification.`,
      image: newCourseForm.image.trim() || 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=600'
    };

    const res = await addCourse(payload);
    setIsAddingCourse(false);
    if (res.success) {
      showToast(`Course card "${res.course.name}" successfully added to Website & Admin Portal!`);
      setNewCourseName('');
      setNewCourseForm({
        name: '',
        title: '',
        badge: 'Job Ready',
        description: '',
        image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=600'
      });
    } else {
      showToast(res.error || 'Failed to add course card', 'error');
    }
  };

  const handleStartEditCourse = (course) => {
    setCourseEditTarget(course);
    setEditCourseName(course.name || '');

    const displayLabel = getCourseDisplayLabel(course);
    const hasMeaningfulTitle = course.title && course.title.trim() && course.title.trim() !== (course.name || '').trim();
    const resolvedTitle = hasMeaningfulTitle ? course.title.trim() : displayLabel;

    setEditCourseForm({
      name: course.name || '',
      title: resolvedTitle || course.title || course.name || '',
      badge: course.badge || 'Professional',
      description: course.description || '',
      image: course.image || 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=600'
    });
  };

  const handleSaveEditCourse = async (e) => {
    e.preventDefault();
    const finalName = editCourseForm.name.trim() || editCourseName.trim() || editCourseForm.title.trim();
    if (!finalName) {
      showToast('Please enter a course code/name.', 'error');
      return;
    }
    setIsUpdatingCourse(true);
    const finalTitle = editCourseForm.title.trim() || getCourseDisplayLabel({ name: finalName }) || finalName;
    const payload = {
      name: finalName,
      title: finalTitle,
      badge: editCourseForm.badge.trim() || 'Professional',
      description: editCourseForm.description.trim() || '',
      image: editCourseForm.image.trim() || 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=600'
    };

    const res = await updateCourse(courseEditTarget.id, payload);
    setIsUpdatingCourse(false);
    if (res.success) {
      showToast(`Course card "${res.course.name}" updated successfully!`);
      setCourseEditTarget(null);
    } else {
      showToast(res.error || 'Failed to update course card', 'error');
    }
  };

  const handleConfirmDeleteCourse = async () => {
    if (!courseDeleteTarget) return;
    setIsDeletingCourse(true);
    const res = await deleteCourse(courseDeleteTarget.id);
    setIsDeletingCourse(false);
    if (res.success) {
      showToast(`Course "${courseDeleteTarget.name}" deleted successfully.`);
      setCourseDeleteTarget(null);
    } else {
      showToast(res.error || 'Failed to delete course.', 'error');
    }
  };

  const filteredCourses = courses.filter(c => {
    const name = (c.name || '').toLowerCase();
    const q = courseSearch.trim().toLowerCase();
    if (q && !name.includes(q)) return false;
    if (courseFilter === 'default' && !c.isDefault) return false;
    if (courseFilter === 'custom' && c.isDefault) return false;
    return true;
  });

  // --- DYNAMIC DIRECTORS STATE ---
  const [directors, setDirectors] = useState([]);
  const [newDirectorForm, setNewDirectorForm] = useState({
    name: '',
    role: 'Managing Director / Chairman',
    email: '',
    image: '',
    order: ''
  });
  const [isAddingDirector, setIsAddingDirector] = useState(false);
  const [directorSearch, setDirectorSearch] = useState('');
  const [directorFilter, setDirectorFilter] = useState('all'); // 'all' | 'default' | 'custom'
  const [directorDeleteTarget, setDirectorDeleteTarget] = useState(null);
  const [isDeletingDirector, setIsDeletingDirector] = useState(false);
  const [directorEditTarget, setDirectorEditTarget] = useState(null);
  const [editDirectorForm, setEditDirectorForm] = useState({
    name: '',
    role: '',
    email: '',
    image: '',
    order: 1
  });
  const [isUpdatingDirector, setIsUpdatingDirector] = useState(false);
  const [isUploadingNewDirectorImage, setIsUploadingNewDirectorImage] = useState(false);
  const [isUploadingEditDirectorImage, setIsUploadingEditDirectorImage] = useState(false);
  const newDirectorImageFileRef = useRef(null);
  const editDirectorImageFileRef = useRef(null);

  useEffect(() => {
    const unsub = subscribeToDirectors((loadedDirectors) => {
      setDirectors(loadedDirectors);
    });
    return () => unsub && unsub();
  }, []);

  const handleUploadDirectorImage = async (file, isEditMode = false) => {
    if (!file) return;
    if (isEditMode) {
      setIsUploadingEditDirectorImage(true);
    } else {
      setIsUploadingNewDirectorImage(true);
    }

    try {
      const uploadedUrl = await uploadToCloudinary(file, 'sle_directors', 400);
      if (uploadedUrl) {
        if (isEditMode) {
          setEditDirectorForm(prev => ({ ...prev, image: uploadedUrl }));
        } else {
          setNewDirectorForm(prev => ({ ...prev, image: uploadedUrl }));
        }
        showToast('Director photo uploaded successfully!');
      } else {
        showToast('Failed to upload photo. Please try again or enter a URL.', 'error');
      }
    } catch (err) {
      console.error('Director photo upload error:', err);
      showToast('Error uploading photo.', 'error');
    } finally {
      if (isEditMode) {
        setIsUploadingEditDirectorImage(false);
      } else {
        setIsUploadingNewDirectorImage(false);
      }
    }
  };

  const handleAddDirector = async (e) => {
    e.preventDefault();
    if (!newDirectorForm.name.trim()) {
      showToast('Please enter Director Full Name.', 'error');
      return;
    }
    setIsAddingDirector(true);
    const res = await addDirector({
      name: newDirectorForm.name.trim(),
      role: newDirectorForm.role.trim() || 'Director',
      email: newDirectorForm.email.trim() || 'sleinstitutions.com',
      image: newDirectorForm.image.trim() || '/directors/chairman.png',
      order: Number(newDirectorForm.order) || (directors.length + 1)
    });
    setIsAddingDirector(false);
    if (res.success) {
      showToast(`Director "${res.director.name}" successfully added!`);
      setNewDirectorForm({
        name: '',
        role: 'Director',
        email: '',
        image: '',
        order: ''
      });
      if (newDirectorImageFileRef.current) newDirectorImageFileRef.current.value = '';
    } else {
      showToast(res.error || 'Failed to add director', 'error');
    }
  };

  const handleStartEditDirector = (director) => {
    setDirectorEditTarget(director);
    setEditDirectorForm({
      name: director.name || '',
      role: director.role || 'Director',
      email: director.email || '',
      image: director.image || '',
      order: director.order || 1
    });
  };

  const handleSaveEditDirector = async (e) => {
    e.preventDefault();
    if (!editDirectorForm.name.trim()) {
      showToast('Please enter Director Full Name.', 'error');
      return;
    }
    setIsUpdatingDirector(true);
    const res = await updateDirector(directorEditTarget.id, {
      name: editDirectorForm.name.trim(),
      role: editDirectorForm.role.trim() || 'Director',
      email: editDirectorForm.email.trim(),
      image: editDirectorForm.image.trim(),
      order: Number(editDirectorForm.order) || 1
    });
    setIsUpdatingDirector(false);
    if (res.success) {
      showToast(`Director "${res.director.name}" updated successfully!`);
      setDirectorEditTarget(null);
      if (editDirectorImageFileRef.current) editDirectorImageFileRef.current.value = '';
    } else {
      showToast(res.error || 'Failed to update director', 'error');
    }
  };

  const handleConfirmDeleteDirector = async () => {
    if (!directorDeleteTarget) return;
    setIsDeletingDirector(true);
    const res = await deleteDirector(directorDeleteTarget.id);
    setIsDeletingDirector(false);
    if (res.success) {
      showToast(`Director "${directorDeleteTarget.name}" deleted successfully.`);
      setDirectorDeleteTarget(null);
    } else {
      showToast(res.error || 'Failed to delete director.', 'error');
    }
  };

  const handleResetDirectors = async () => {
    if (window.confirm('Reset all directors back to default 3 leaders (Mr. B. Sunil, Mr. I. H. Pathan, Mr. D. C. Kasar)?')) {
      const res = await resetDirectorsToDefault();
      if (res.success) {
        showToast('Directors reset to defaults successfully!');
      } else {
        showToast('Failed to reset directors.', 'error');
      }
    }
  };

  const filteredDirectors = directors.filter(d => {
    const name = (d.name || '').toLowerCase();
    const role = (d.role || '').toLowerCase();
    const email = (d.email || '').toLowerCase();
    const q = directorSearch.trim().toLowerCase();
    if (q && !name.includes(q) && !role.includes(q) && !email.includes(q)) return false;
    if (directorFilter === 'default' && !d.isDefault) return false;
    if (directorFilter === 'custom' && d.isDefault) return false;
    return true;
  });

  // --- DYNAMIC COURSE SUBJECTS STATE ---
  const [selectedSubjectCourse, setSelectedSubjectCourse] = useState('PGDCA');
  const [courseSubjectsMap, setCourseSubjectsMap] = useState(DEFAULT_COURSE_SUBJECTS);
  const [currentSubjects, setCurrentSubjects] = useState([]);
  const [isSavingSubjects, setIsSavingSubjects] = useState(false);
  const [draggedSubjectIdx, setDraggedSubjectIdx] = useState(null);
  const [dragOverSubjectIdx, setDragOverSubjectIdx] = useState(null);

  // Subscribe to real-time course subjects
  useEffect(() => {
    const unsub = subscribeToCourseSubjects((allMap) => {
      setCourseSubjectsMap(allMap);
    });
    return () => unsub && unsub();
  }, []);

  // When selected course or map changes, load that course's subjects
  useEffect(() => {
    if (selectedSubjectCourse) {
      const list = getStoredSubjectsForCourse(selectedSubjectCourse);
      setCurrentSubjects(JSON.parse(JSON.stringify(list || [])));
    }
  }, [selectedSubjectCourse, courseSubjectsMap]);

  // Subject array operations
  const handleAddSubjectRow = () => {
    const newRow = {
      id: `subj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: '',
      intMax: 40,
      extMax: 60,
      minMarks: 35,
      order: currentSubjects.length + 1
    };
    setCurrentSubjects([...currentSubjects, newRow]);
  };

  const handleSubjectFieldChange = (index, field, value) => {
    const updated = [...currentSubjects];
    updated[index] = { ...updated[index], [field]: value };
    setCurrentSubjects(updated);
  };

  const handleDeleteSubjectRow = (index) => {
    const updated = currentSubjects.filter((_, idx) => idx !== index);
    setCurrentSubjects(updated);
  };

  const handleDuplicateSubjectRow = (index) => {
    const target = currentSubjects[index];
    if (!target) return;
    const duplicated = {
      ...target,
      id: `subj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: target.name ? `${target.name} (Copy)` : '',
      intMax: target.intMax !== undefined ? target.intMax : 40,
      extMax: target.extMax !== undefined ? target.extMax : 60,
      minMarks: target.minMarks !== undefined ? target.minMarks : 35,
      order: currentSubjects.length + 1
    };
    const updated = [...currentSubjects];
    updated.splice(index + 1, 0, duplicated);
    setCurrentSubjects(updated);
  };

  const handleMoveSubjectRow = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= currentSubjects.length) return;
    const updated = [...currentSubjects];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);
    setCurrentSubjects(updated);
  };

  // Drag and drop handlers
  const handleDragStartSubject = (e, index) => {
    setDraggedSubjectIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOverSubject = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSubjectIdx !== index) {
      setDragOverSubjectIdx(index);
    }
  };

  const handleDropSubject = (e, index) => {
    e.preventDefault();
    if (draggedSubjectIdx === null || draggedSubjectIdx === index) {
      setDraggedSubjectIdx(null);
      setDragOverSubjectIdx(null);
      return;
    }
    const updated = [...currentSubjects];
    const [draggedItem] = updated.splice(draggedSubjectIdx, 1);
    updated.splice(index, 0, draggedItem);
    setCurrentSubjects(updated);
    setDraggedSubjectIdx(null);
    setDragOverSubjectIdx(null);
  };

  const handleDragEndSubject = () => {
    setDraggedSubjectIdx(null);
    setDragOverSubjectIdx(null);
  };

  const handleResetCourseSubjects = async () => {
    setCurrentSubjects([]);
    await saveCourseSubjects(selectedSubjectCourse, []);
    showToast(`Cleared subjects for ${selectedSubjectCourse}.`);
  };

  const handleFetchExternalMarksFromQP = () => {
    if (!selectedSubjectCourse) return;
    let countUpdated = 0;
    const updated = currentSubjects.map(subj => {
      if (!subj.name) return subj;
      const qpMarks = getQuestionPaperSubjectMarks(selectedSubjectCourse, subj.name);
      if (qpMarks !== null && qpMarks > 0) {
        countUpdated++;
        return { ...subj, extMax: qpMarks };
      }
      return subj;
    });

    setCurrentSubjects(updated);
    if (countUpdated > 0) {
      showToast(`Fetched external marks from Question Paper for ${countUpdated} subject(s)!`);
    } else {
      showToast(`No Question Paper allocation found for ${selectedSubjectCourse}.`, 'info');
    }
  };

  const handleSaveCourseSubjects = async () => {
    if (!selectedSubjectCourse) {
      showToast('Please select a course first.', 'error');
      return;
    }
    if (currentSubjects.length === 0) {
      showToast('Please add at least one subject.', 'error');
      return;
    }
    const hasEmptyName = currentSubjects.some(s => !s.name || !s.name.trim());
    if (hasEmptyName) {
      showToast('Please fill in all subject names before saving.', 'error');
      return;
    }

    setIsSavingSubjects(true);
    const res = await saveCourseSubjects(selectedSubjectCourse, currentSubjects);
    setIsSavingSubjects(false);
    if (res.success) {
      showToast(`Subjects for "${selectedSubjectCourse}" saved successfully!`);
    } else {
      showToast(res.error || 'Failed to save subjects', 'error');
    }
  };

  // --- COMPOSITE QUESTION PAPER & EXAMINATION STATE (Year -> Course -> Subject Structure) ---
  const [questionPaperActiveTab, setQuestionPaperActiveTab] = useState('editor'); // 'editor' | 'directory'
  const [selectedPaperYear, setSelectedPaperYear] = useState('2026');
  const [selectedPaperCourse, setSelectedPaperCourse] = useState('DCA');
  const [selectedPaperExamTitle, setSelectedPaperExamTitle] = useState('2026 - DCA Composite Examination');
  const [selectedPaperExamDate, setSelectedPaperExamDate] = useState('2026 Feb, 8');
  const [selectedPaperExamTime, setSelectedPaperExamTime] = useState('10:00 AM to 1:00 PM');
  const [selectedPaperExamDuration, setSelectedPaperExamDuration] = useState(120);
  const [selectedPaperSubject, setSelectedPaperSubject] = useState('');
  const [filterEditorSubject, setFilterEditorSubject] = useState('ALL'); // 'ALL' or specific subject
  const [paperData, setPaperData] = useState(null);
  const [paperQuestions, setPaperQuestions] = useState([]);
  const [currentQuestionPage, setCurrentQuestionPage] = useState(1);
  const [questionsPerPageMode, setQuestionsPerPageMode] = useState(10);
  const [isSavingPaper, setIsSavingPaper] = useState(false);
  const [isPreviewPaperOpen, setIsPreviewPaperOpen] = useState(false);
  const [previewTargetPaper, setPreviewTargetPaper] = useState(null);
  const [questionSearchQuery, setQuestionSearchQuery] = useState('');
  const [questionPapersMap, setQuestionPapersMap] = useState({});
  const [paperDirectorySearch, setPaperDirectorySearch] = useState('');
  const [generatedExamModal, setGeneratedExamModal] = useState({ open: false, url: '', examId: '', title: '' });

  // Available subjects for selected paper course
  // Available subjects for the currently selected paper course (Only real, user-added subjects)
  const availablePaperSubjects = useMemo(() => {
    const list = getStoredSubjectsForCourse(selectedPaperCourse);
    return list || [];
  }, [selectedPaperCourse, courseSubjectsMap]);

  // Set default subject when course changes or available subjects update
  useEffect(() => {
    if (availablePaperSubjects.length > 0) {
      if (!selectedPaperSubject || !availablePaperSubjects.some(s => s.name === selectedPaperSubject)) {
        setSelectedPaperSubject(availablePaperSubjects[0].name);
      }
    } else {
      setSelectedPaperSubject('');
    }
  }, [selectedPaperCourse, availablePaperSubjects]);

  // Load composite exam when year or course changes (Maintained in React State, 0 writes while drafting)
  useEffect(() => {
    if (selectedPaperYear && selectedPaperCourse) {
      const subjectNames = availablePaperSubjects.map(s => s.name);
      const exam = getStoredExam(selectedPaperYear, selectedPaperCourse, subjectNames);
      if (exam && exam.questions && exam.questions.length > 0) {
        setPaperData(exam);
        setPaperQuestions(JSON.parse(JSON.stringify(exam.questions || [])));
        if (exam.examTitle) setSelectedPaperExamTitle(exam.examTitle);
        else setSelectedPaperExamTitle(`${selectedPaperYear} - ${selectedPaperCourse} Composite Examination`);
        if (exam.examDate) setSelectedPaperExamDate(exam.examDate);
        if (exam.examTime) setSelectedPaperExamTime(exam.examTime);
        if (exam.duration || exam.durationMinutes) setSelectedPaperExamDuration(Number(exam.duration || exam.durationMinutes) || 120);
        setCurrentQuestionPage(1);
      } else if (subjectNames.length > 0) {
        const fresh = generateCompositeTemplate(selectedPaperYear, selectedPaperCourse, subjectNames);
        setPaperData(fresh);
        setPaperQuestions(fresh.questions || []);
        setSelectedPaperExamTitle(`${selectedPaperYear} - ${selectedPaperCourse} Composite Examination`);
        setCurrentQuestionPage(1);
      } else {
        setPaperData(null);
        setPaperQuestions([]);
        setSelectedPaperExamTitle(`${selectedPaperYear} - ${selectedPaperCourse} Composite Examination`);
        setCurrentQuestionPage(1);
      }
    }
  }, [selectedPaperYear, selectedPaperCourse, availablePaperSubjects]);

  // Subscribe to real-time composite exams
  useEffect(() => {
    const unsub = subscribeToExams((allMap) => {
      setQuestionPapersMap(allMap || {});
    });
    return () => unsub && unsub();
  }, []);

  // List of all saved exams
  const allSavedPapersList = useMemo(() => {
    return Object.values(questionPapersMap || {});
  }, [questionPapersMap]);

  const filteredSavedPapers = useMemo(() => {
    if (!paperDirectorySearch.trim()) return allSavedPapersList;
    const q = paperDirectorySearch.toLowerCase().trim();
    return allSavedPapersList.filter(p =>
      (p.course || p.courseName || '').toLowerCase().includes(q) ||
      (p.year || '').toLowerCase().includes(q) ||
      (p.examTitle || p.title || '').toLowerCase().includes(q)
    );
  }, [allSavedPapersList, paperDirectorySearch]);

  // Real-time Subject Questions & Marks Distribution (Calculated live ONLY for actual configured subjects)
  const subjectDistributionStats = useMemo(() => {
    const stats = {};
    availablePaperSubjects.forEach(s => {
      stats[s.name] = { count: 0, totalMarks: 0, marksPerQ: 2 };
    });

    paperQuestions.forEach(q => {
      const subj = q.subjectId;
      if (subj && stats[subj]) {
        stats[subj].count += 1;
        const qMarks = Number(q.marks) || 2;
        stats[subj].totalMarks += qMarks;
        stats[subj].marksPerQ = qMarks;
      }
    });

    return stats;
  }, [availablePaperSubjects, paperQuestions]);

  const handleOpenPaperFromDirectory = (paper) => {
    if (paper.year) setSelectedPaperYear(paper.year);
    if (paper.course || paper.courseName) setSelectedPaperCourse(paper.course || paper.courseName);
    if (paper.examTitle) setSelectedPaperExamTitle(paper.examTitle);
    if (paper.examDate) setSelectedPaperExamDate(paper.examDate);
    if (paper.examTime) setSelectedPaperExamTime(paper.examTime);
    if (paper.duration || paper.durationMinutes) setSelectedPaperExamDuration(Number(paper.duration || paper.durationMinutes) || 120);
    setPaperData(paper);
    setPaperQuestions(JSON.parse(JSON.stringify(paper.questions || [])));
    setCurrentQuestionPage(1);
    setQuestionPaperActiveTab('editor');
    showToast(`Loaded "${paper.examTitle || paper.course || paper.courseName}" exam.`);
  };

  const handleDeletePaperFromDirectory = async (paper) => {
    const y = paper.year || '2026';
    const c = paper.course || paper.courseName;
    const res = await deleteCompositeExam(y, c);
    if (res.success) {
      showToast(`Deleted examination paper for "${y} - ${c}".`);
    }
  };

  const handlePreviewSpecificPaper = (paper) => {
    setPreviewTargetPaper(paper);
    setIsPreviewPaperOpen(true);
  };

  // Robust Standalone Print Function for Question Papers (Zero blank pages, crisp A4 layout)
  const printQuestionPaperDirectly = (paper) => {
    if (!paper) return;
    const course = paper.courseName || selectedPaperCourse || 'Course';
    const subject = paper.subjectName || selectedPaperSubject || 'Subject';
    const questions = paper.questions && paper.questions.length > 0 ? paper.questions : paperQuestions;
    const totalMarks = paper.totalMarks || questions.reduce((acc, q) => acc + (Number(q.marks) || 2), 0);
    const totalQ = questions.length;

    const questionsHTML = questions.map((q, idx) => `
      <div class="q-item">
        <div class="q-header">
          <span class="q-title"><strong>Q${idx + 1}.</strong> ${q.question ? q.question.replace(/</g, '&lt;').replace(/>/g, '&gt;') : `[Question ${idx + 1}]`}</span>
          <span class="q-marks">[${q.marks || 2} Marks]</span>
        </div>
        <div class="options-grid">
          <div class="opt"><strong>(A)</strong> ${(q.options?.[0] || '—').replace(/</g, '&lt;')}</div>
          <div class="opt"><strong>(B)</strong> ${(q.options?.[1] || '—').replace(/</g, '&lt;')}</div>
          <div class="opt"><strong>(C)</strong> ${(q.options?.[2] || '—').replace(/</g, '&lt;')}</div>
          <div class="opt"><strong>(D)</strong> ${(q.options?.[3] || '—').replace(/</g, '&lt;')}</div>
        </div>
      </div>
    `).join('');

    const printWindow = window.open('', '_blank', 'width=950,height=800');
    if (!printWindow) {
      alert('Please allow pop-ups in your browser to print the question paper.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${course} - ${subject} Examination Paper</title>
          <meta charset="utf-8" />
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              color: #0f172a;
              background: #ffffff;
              padding: 24px;
              font-size: 12px;
              line-height: 1.4;
            }
            @page {
              size: A4 portrait;
              margin: 14mm 12mm 14mm 12mm;
            }
            @media print {
              body { padding: 0; }
              .no-print { display: none !important; }
            }
            .paper-container {
              border: 2px solid #0f172a;
              padding: 20px;
              border-radius: 8px;
              background: #ffffff;
            }
            .header-box {
              text-align: center;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 10px;
              margin-bottom: 12px;
            }
            .inst-name {
              font-size: 16px;
              font-weight: 900;
              letter-spacing: 0.5px;
              text-transform: uppercase;
              color: #0f172a;
            }
            .inst-sub {
              font-size: 10px;
              font-weight: 700;
              color: #475569;
              margin-top: 2px;
            }
            .meta-bar {
              display: flex;
              justify-content: space-between;
              flex-wrap: wrap;
              border-top: 1px solid #cbd5e1;
              margin-top: 8px;
              padding-top: 6px;
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
            }
            .instructions-box {
              background: #f8fafc;
              border: 1px solid #cbd5e1;
              padding: 8px 12px;
              border-radius: 6px;
              margin-bottom: 14px;
              font-size: 11px;
            }
            .instructions-title {
              font-weight: 800;
              text-transform: uppercase;
              margin-bottom: 3px;
              color: #0f172a;
            }
            .instructions-list {
              padding-left: 18px;
              color: #334155;
            }
            .instructions-list li {
              margin-bottom: 2px;
            }
            .candidate-bar {
              display: flex;
              justify-content: space-between;
              border: 1px dashed #94a3b8;
              padding: 6px 10px;
              border-radius: 6px;
              margin-bottom: 14px;
              font-size: 11px;
              font-weight: 600;
            }
            .questions-list {
              display: flex;
              flex-direction: column;
              gap: 10px;
            }
            .q-item {
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 8px;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .q-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 5px;
            }
            .q-title {
              font-size: 11.5px;
              font-weight: 700;
              color: #0f172a;
            }
            .q-marks {
              font-size: 10px;
              font-weight: 700;
              color: #64748b;
              margin-left: 8px;
              white-space: nowrap;
            }
            .options-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 4px 14px;
              padding-left: 14px;
              font-size: 11px;
              color: #334155;
            }
            .opt {
              word-break: break-word;
            }
            .btn-print {
              position: fixed;
              top: 15px;
              right: 15px;
              background: #0284c7;
              color: white;
              padding: 9px 18px;
              font-size: 12px;
              font-weight: bold;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              box-shadow: 0 4px 12px rgba(2,132,199,0.35);
              z-index: 9999;
            }
            .btn-print:hover {
              background: #0369a1;
            }
          </style>
        </head>
        <body>
          <button class="btn-print no-print" onclick="window.print()">🖨️ Print Question Paper</button>
          <div class="paper-container">
            <div class="header-box">
              <div class="inst-name">SHREE LAXMI EDUCATION SOCIETY (R.)</div>
              <div class="inst-sub">NATIONAL COUNCIL OF VOCATIONAL TRAINING & COMPUTER EDUCATION</div>
              <div class="meta-bar">
                <div>Course: <strong>${course}</strong></div>
                <div>Subject: <strong>${subject}</strong></div>
                <div>Max Marks: <strong>${totalMarks}</strong></div>
                <div>Time: <strong>3 Hours (180 Mins)</strong></div>
              </div>
            </div>

            <div class="candidate-bar">
              <div>Roll No: ____________________</div>
              <div>Student Name: ____________________________________</div>
              <div>Signature: ________________</div>
            </div>

            <div class="instructions-box">
              <div class="instructions-title">General Instructions:</div>
              <ol class="instructions-list">
                <li>This examination paper consists of <strong>${totalQ} Multiple Choice Questions (MCQs)</strong>.</li>
                <li>Each question carries <strong>2 Marks</strong> (Total = ${totalMarks} Marks).</li>
                <li>Darken the correct circle (A, B, C, or D) on the OMR answer sheet.</li>
                <li>Passing marks for this examination is <strong>70 Marks (35%)</strong>.</li>
              </ol>
            </div>

            <div class="questions-list">
              ${questionsHTML}
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); }, 250);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Question array operations
  const handleAddQuestion = () => {
    const newQ = {
      id: `q_${paperQuestions.length + 1}_${Date.now()}`,
      qNo: paperQuestions.length + 1,
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 'A',
      marks: 2,
      negativeMarks: 0
    };
    const updated = [...paperQuestions, newQ];
    setPaperQuestions(updated);
    setCurrentQuestionPage(updated.length);
    showToast(`Added Question #${updated.length}`);
  };

  const handleUpdateQuestion = (index, updatedFields) => {
    const updated = [...paperQuestions];
    updated[index] = { ...updated[index], ...updatedFields };
    setPaperQuestions(updated);
  };

  const handleUpdateQuestionOption = (qIndex, optIndex, val) => {
    const updated = [...paperQuestions];
    const opts = [...(updated[qIndex].options || ['', '', '', ''])];
    opts[optIndex] = val;
    updated[qIndex].options = opts;
    setPaperQuestions(updated);
  };

  const handleClearCurrentQuestion = (index) => {
    const updated = [...paperQuestions];
    if (updated[index]) {
      updated[index] = {
        ...updated[index],
        question: '',
        options: ['', '', '', ''],
        correctAnswer: 'A'
      };
      setPaperQuestions(updated);
      showToast(`Cleared Question #${index + 1}`);
    }
  };

  const handleDeleteQuestion = (index) => {
    if (paperQuestions.length <= 1) {
      showToast('A question paper must have at least 1 question.', 'error');
      return;
    }
    const updated = paperQuestions.filter((_, idx) => idx !== index).map((q, idx) => ({
      ...q,
      qNo: idx + 1
    }));
    setPaperQuestions(updated);
    if (currentQuestionPage > updated.length) {
      setCurrentQuestionPage(updated.length);
    }
    showToast(`Deleted question #${index + 1}. Total: ${updated.length}`);
  };

  const handleDuplicateQuestion = (index) => {
    const target = paperQuestions[index];
    if (!target) return;
    const dup = {
      ...target,
      id: `q_${Date.now()}_dup`,
      question: target.question ? `${target.question} (Copy)` : '',
      options: [...(target.options || ['', '', '', ''])]
    };
    const updated = [...paperQuestions];
    updated.splice(index + 1, 0, dup);
    const renumbered = updated.map((q, idx) => ({ ...q, qNo: idx + 1 }));
    setPaperQuestions(renumbered);
    setCurrentQuestionPage(index + 2);
    showToast(`Duplicated question #${index + 1}`);
  };

  const handleAdd25QuestionsForSubject = (subjName) => {
    const targetSubj = subjName || selectedPaperSubject || availablePaperSubjects[0]?.name || '';
    if (!targetSubj) {
      showToast(`Please configure subjects for ${selectedPaperCourse} first in the "Add Subject" tab.`, 'warning');
      return;
    }
    const fresh25 = generateQuestionsForSubject(targetSubj, 25, paperQuestions.length + 1, 2);
    const updated = [...paperQuestions, ...fresh25];
    setPaperQuestions(updated);
    showToast(`Added 25 questions (50 Marks) for "${targetSubj}". Total: ${updated.length} questions`);
  };

  const handleAddSingleQuestion = () => {
    const targetSubj = selectedPaperSubject || availablePaperSubjects[0]?.name || '';
    if (!targetSubj) {
      showToast(`Please configure subjects for ${selectedPaperCourse} first in the "Add Subject" tab.`, 'warning');
      return;
    }
    const newQ = {
      id: `q_${Date.now()}_${paperQuestions.length + 1}`,
      qNo: paperQuestions.length + 1,
      subjectId: targetSubj,
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 'A',
      marks: 2,
      negativeMarks: 0
    };
    const updated = [...paperQuestions, newQ];
    setPaperQuestions(updated);
    setCurrentQuestionPage(updated.length);
    showToast(`Added Question #${updated.length} (2 Marks, ${targetSubj})`);
  };

  const handleAdd10Questions = () => {
    const targetSubj = selectedPaperSubject || availablePaperSubjects[0]?.name || 'General';
    const newSlots = generateQuestionsForSubject(targetSubj, 10, paperQuestions.length + 1, 2);
    const updated = [...paperQuestions, ...newSlots];
    setPaperQuestions(updated);
    setCurrentQuestionPage(updated.length - 9);
    showToast(`Added 10 New Question Slots (#${paperQuestions.length - 9} to #${updated.length})`);
  };

  // Set exact question count for a subject (e.g. 25, 20, 30)
  const handleSetSubjectQuestionCount = (subjName, targetCount) => {
    const count = Math.max(0, parseInt(targetCount, 10) || 0);
    const existing = paperQuestions.filter(q => (q.subjectId || 'General') === subjName);
    const currentCount = existing.length;

    if (count === currentCount) return;

    let updatedQuestions = [...paperQuestions];
    const currentMarksPerQ = existing[0]?.marks || 2;

    if (count > currentCount) {
      // Add (count - currentCount) new questions for this subject
      const diff = count - currentCount;
      const newSlots = generateQuestionsForSubject(subjName, diff, paperQuestions.length + 1, currentMarksPerQ);
      updatedQuestions = [...updatedQuestions, ...newSlots];
    } else {
      // Remove (currentCount - count) questions of this subject from the end
      let toRemove = currentCount - count;
      const reversed = [];
      for (let i = updatedQuestions.length - 1; i >= 0; i--) {
        const q = updatedQuestions[i];
        if ((q.subjectId || 'General') === subjName && toRemove > 0) {
          toRemove--;
        } else {
          reversed.unshift(q);
        }
      }
      updatedQuestions = reversed;
    }

    // Renumber all questions
    const renumbered = updatedQuestions.map((q, idx) => ({ ...q, qNo: idx + 1 }));
    setPaperQuestions(renumbered);
    if (currentQuestionPage > renumbered.length) {
      setCurrentQuestionPage(Math.max(1, renumbered.length));
    }
    showToast(`Updated "${subjName}" to ${count} Questions.`);
  };

  // Set marks per question for all questions belonging to a subject
  const handleSetSubjectMarksPerQuestion = (subjName, newMarks) => {
    const marksVal = Math.max(1, parseInt(newMarks, 10) || 1);
    const updated = paperQuestions.map(q => {
      if ((q.subjectId || 'General') === subjName) {
        return { ...q, marks: marksVal };
      }
      return q;
    });
    setPaperQuestions(updated);
    showToast(`Set weightage for all "${subjName}" questions to ${marksVal} Marks.`);
  };

  const handleReset100Questions = () => {
    const subjectNames = availablePaperSubjects.map(s => s.name);
    if (subjectNames.length === 0) {
      showToast(`Please configure subjects for ${selectedPaperCourse} first in the "Add Subject" tab.`, 'warning');
      return;
    }

    const template = generateCompositeTemplate(selectedPaperYear, selectedPaperCourse, subjectNames);
    setPaperQuestions(template.questions || []);
    setCurrentQuestionPage(1);
    showToast(`Generated 100 questions (200 Marks) distributed across ${subjectNames.length} subjects.`);
  };

  const handleSaveCompositeExam = async () => {
    if (!selectedPaperYear || !selectedPaperCourse) {
      showToast('Please select both Year and Course.', 'error');
      return;
    }
    if (paperQuestions.length === 0) {
      showToast('Please add at least one question to the exam paper.', 'error');
      return;
    }

    setIsSavingPaper(true);
    const docId = getExamDocId(selectedPaperYear, selectedPaperCourse);
    const res = await saveCompositeExam({
      id: docId,
      year: String(selectedPaperYear),
      course: selectedPaperCourse,
      courseName: selectedPaperCourse,
      examTitle: selectedPaperExamTitle.trim() || `${selectedPaperYear} - ${selectedPaperCourse} Composite Examination`,
      examDate: selectedPaperExamDate,
      examTime: selectedPaperExamTime,
      duration: Number(selectedPaperExamDuration) || 120,
      durationMinutes: Number(selectedPaperExamDuration) || 120,
      passingPercentage: 40,
      questions: paperQuestions,
      status: paperData?.status || 'inactive'
    });
    setIsSavingPaper(false);

    if (res.success) {
      const fullLink = `${window.location.origin}/exam/${docId}`;
      setGeneratedExamModal({
        open: true,
        url: fullLink,
        examId: docId,
        title: `${selectedPaperYear} - ${selectedPaperCourse} Exam`
      });
      showToast(`Composite Examination (${paperQuestions.length} Questions) created and Exam Link generated!`);
    } else {
      showToast(res.error || 'Failed to save examination paper', 'error');
    }
  };

  // Active single question per page
  const totalPaperQuestionsCount = paperQuestions.length || 1;
  const activeQuestionIndex = Math.min(Math.max(currentQuestionPage - 1, 0), Math.max(paperQuestions.length - 1, 0));
  const currentSingleQuestion = paperQuestions[activeQuestionIndex] || {
    id: `q_${currentQuestionPage}`,
    qNo: currentQuestionPage,
    question: '',
    correctAnswer: 'A',
    marks: 2
  };

  // Load Pricing Settings from Firestore (One-time fetch)
  useEffect(() => {
    if (!db) return;
    let isMounted = true;
    (async () => {
      try {
        const docSnap = await getDoc(doc(db, 'system_settings', 'franchisee_pricing'));
        if (isMounted && docSnap && docSnap.exists()) {
          const data = docSnap.data();
          if (data.firstTimeFee) {
            setFirstTimeFee(data.firstTimeFee);
            localStorage.setItem('sle_first_time_fee', String(data.firstTimeFee));
          }
          if (data.standardFee) {
            setStandardFee(data.standardFee);
            localStorage.setItem('sle_standard_fee', String(data.standardFee));
          }
          if (data.certStandardFee) {
            setCertStandardFee(data.certStandardFee);
            localStorage.setItem('sle_cert_standard_fee', String(data.certStandardFee));
          }
        }
      } catch (e) {
        console.log('Pricing load notice:', e);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // Save Pricing Settings Handler (General Admission)
  const handleSavePricing = async (e) => {
    e.preventDefault();
    setIsSavingPricing(true);
    const payload = {
      firstTimeFee: Number(firstTimeFee) || 20000,
      standardFee: Number(standardFee) || 500,
      updatedAt: Date.now(),
      updatedBy: currentUser?.email || 'admin'
    };

    try {
      if (db) {
        await Promise.all([
          setDoc(doc(db, 'system_settings', 'franchisee_pricing'), payload, { merge: true }),
          setDoc(doc(db, 'system_settings', 'pricing'), payload, { merge: true })
        ]);
      }
      localStorage.setItem('sle_first_time_fee', String(payload.firstTimeFee));
      localStorage.setItem('sle_standard_fee', String(payload.standardFee));
      showToast('Student Admission Fee updated successfully!', 'success');
    } catch (err) {
      console.error('Pricing save error:', err);
      localStorage.setItem('sle_first_time_fee', String(payload.firstTimeFee));
      localStorage.setItem('sle_standard_fee', String(payload.standardFee));
      showToast('Settings saved locally!');
    }
    setIsSavingPricing(false);
  };

  // Save Certificate Admission Fee Handler
  const handleSaveCertPricing = async (e) => {
    e.preventDefault();
    setIsSavingCertPricing(true);
    const feeVal = Number(certStandardFee) || 500;
    const payload = {
      certStandardFee: feeVal,
      updatedAt: Date.now(),
      updatedBy: currentUser?.email || 'admin'
    };

    try {
      if (db) {
        await Promise.all([
          setDoc(doc(db, 'system_settings', 'franchisee_pricing'), payload, { merge: true }),
          setDoc(doc(db, 'system_settings', 'pricing'), payload, { merge: true })
        ]);
      }
      localStorage.setItem('sle_cert_standard_fee', String(feeVal));
      showToast('Certificate Admission Fee updated successfully!', 'success');
    } catch (err) {
      console.error('Cert pricing save error:', err);
      localStorage.setItem('sle_cert_standard_fee', String(feeVal));
      showToast('Certificate Admission Fee saved locally!');
    }
    setIsSavingCertPricing(false);
  };

  // ONE-TIME FIRESTORE DATA FETCH & MANUAL REFRESH (Saves DB Reads)
  const [isRefreshingFranchisees, setIsRefreshingFranchisees] = useState(false);

  // 1. Fetch Plans (One-time on mount)
  const fetchPlansFromFirestore = async () => {
    if (!db) return;
    try {
      const snapshot = await getDocs(collection(db, 'plans'));
      if (snapshot.empty) {
        defaultPlans.forEach(async (plan) => {
          try {
            const sanitized = sanitizePlanForFirestore(plan);
            await setDoc(doc(db, 'plans', plan.id), sanitized);
          } catch (err) { }
        });
      } else {
        const loadedPlans = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const existingIds = loadedPlans.map(p => p.id);
        defaultPlans.forEach(async (plan) => {
          if (!existingIds.includes(plan.id)) {
            try {
              const sanitized = sanitizePlanForFirestore(plan);
              await setDoc(doc(db, 'plans', plan.id), sanitized);
            } catch (err) { }
          }
        });
        const sorted = [...loadedPlans].sort((a, b) => (a.years || 1) - (b.years || 1));
        setPlans(sorted);
      }
    } catch (err) {
      console.warn('Firestore plans fetch error:', err?.message);
    }
  };

  // 2. Fetch Franchisees (One-time on mount or on-demand manual refresh)
  const fetchFranchiseesFromFirestore = async (isManual = false) => {
    if (!db) return;
    if (isManual) setIsRefreshingFranchisees(true);
    try {
      const snapshot = await getDocs(collection(db, 'franchisees'));
      if (snapshot.empty) {
        setFranchisees([]);
      } else {
        const loadedFranchisees = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const sortedOnTop = loadedFranchisees.sort((a, b) => {
          const timeA = a.createdAt || (a.createdDate ? new Date(a.createdDate).getTime() : 0);
          const timeB = b.createdAt || (b.createdDate ? new Date(b.createdDate).getTime() : 0);
          if (timeA !== timeB) return timeB - timeA;
          return b.id.localeCompare(a.id);
        });
        setFranchisees(sortedOnTop);
        try {
          localStorage.setItem('sle_franchisees_cache', JSON.stringify(sortedOnTop));
        } catch (e) { }
        if (isManual) {
          showToast(`Franchisees synced! Total: ${sortedOnTop.length}`, 'success');
        }
      }
    } catch (err) {
      console.warn('Firestore franchisees fetch error:', err?.message);
      if (isManual) {
        showToast('Sync completed with local records.', 'info');
      }
    }
    if (isManual) setIsRefreshingFranchisees(false);
  };

  useEffect(() => {
    fetchPlansFromFirestore();
    fetchFranchiseesFromFirestore(false);
  }, []);

  // Helper to reliably format / deduce Franchisee Registration Date
  const getFranchiseeRegDate = (f) => {
    if (!f) return '—';
    const raw = f.registrationDate || f.createdDate || f.purchaseDate || f.appliedDate || f.regDate || f.date;
    if (raw) {
      if (typeof raw === 'number') {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      }
      if (typeof raw === 'string' && raw.trim() && raw.trim() !== '—') {
        const str = raw.trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
        const parsed = new Date(str);
        if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
        return str;
      }
    }
    if (f.createdAt) {
      const d = new Date(f.createdAt);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    const endStr = f.endDate || f.expiryDate;
    if (endStr && typeof endStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(endStr.trim())) {
      const d = new Date(endStr.trim().substring(0, 10));
      if (!isNaN(d.getTime())) {
        const pName = (f.planName || '').toLowerCase();
        const years = pName.includes('3 year') ? 3 : (pName.includes('2 year') ? 2 : 1);
        d.setFullYear(d.getFullYear() - years);
        return d.toISOString().split('T')[0];
      }
    }
    return '2026-08-20';
  };

  // Helper to reliably format / deduce Franchisee Valid Till Date matching Plan duration
  const getFranchiseeValidTillDate = (f) => {
    if (!f) return '—';
    const planName = (f.planName || '').toLowerCase();
    const planId = (f.planId || '').toLowerCase();
    const planYears = (planId.includes('3') || planName.includes('3 year')) ? 3 
      : (planId.includes('2') || planName.includes('2 year')) ? 2 
      : 1;

    const rawEnd = f.endDate || f.expiryDate;
    const regDateStr = getFranchiseeRegDate(f);

    if (rawEnd && typeof rawEnd === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawEnd.trim())) {
      const cleanRaw = rawEnd.trim().substring(0, 10);
      if (regDateStr && /^\d{4}-\d{2}-\d{2}/.test(regDateStr)) {
        const startYear = parseInt(regDateStr.substring(0, 4), 10);
        const endYear = parseInt(cleanRaw.substring(0, 4), 10);
        if (endYear - startYear >= planYears) {
          return cleanRaw;
        }
        const targetYear = startYear + planYears;
        return `${targetYear}${regDateStr.substring(4, 10)}`;
      }
      return cleanRaw;
    }

    if (regDateStr && /^\d{4}-\d{2}-\d{2}/.test(regDateStr)) {
      const startYear = parseInt(regDateStr.substring(0, 4), 10);
      return `${startYear + planYears}${regDateStr.substring(4, 10)}`;
    }

    return rawEnd || '—';
  };

  // Complete Plans List (Includes First-Time Franchisee Plan + Renewal Plans)
  const firstTimePlanObj = {
    id: 'first-time-franchisee-fee',
    name: 'First-Time Franchisee Plan',
    duration: '1 Year',
    years: 1,
    badge: 'First-Time Onboarding',
    isPopular: false,
    price: Number(firstTimeFee) || 20000,
    currency: '₹',
    billingPeriod: '/1 year',
    active: true,
    features: [
      '1 Year Full Institutional Portal Access',
      'Dedicated Center Environment & Code',
      'Student Registrations & Certificates',
      'Complete Onboarding Package'
    ]
  };

  const allPlansList = [firstTimePlanObj, ...plans];
  const activePlansList = allPlansList.filter(p => p.active);

  // Franchisee Form Submit Handler
  const handleSaveFranchisee = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const owner = (franchiseeForm.ownerName || franchiseeForm.fullName || '').trim();
    const email = (franchiseeForm.email || '').trim();
    const phone = (franchiseeForm.contactNumber || franchiseeForm.phone || '').trim();

    if (!owner) {
      showToast('Please enter Owner Name.', 'error');
      setFranchiseeStep(1);
      return;
    }
    if (!phone) {
      showToast('Please enter Contact Number.', 'error');
      setFranchiseeStep(1);
      return;
    }
    if (!email) {
      showToast('Please enter Email Address.', 'error');
      setFranchiseeStep(2);
      return;
    }

    if (editingFranchiseeId) {
      if (franchiseeForm.password && franchiseeForm.confirmPassword && franchiseeForm.password !== franchiseeForm.confirmPassword) {
        showToast('Password and Confirm Password do not match!', 'error');
        setFranchiseeStep(5);
        return;
      }
    } else {
      if (franchiseeForm.password || franchiseeForm.confirmPassword) {
        if (franchiseeForm.password !== franchiseeForm.confirmPassword) {
          showToast('Password and Confirm Password do not match!', 'error');
          setFranchiseeStep(5);
          return;
        }
      }
    }

    setIsSavingFranchisee(true);

    const selectedPlanObj = allPlansList.find(p => p.id === franchiseeForm.planId);
    const planYears = Number(selectedPlanObj?.years) || (franchiseeForm.planId?.includes('3') ? 3 : franchiseeForm.planId?.includes('2') ? 2 : 1);
    const targetId = editingFranchiseeId || `FR-2026-${Math.floor(100 + Math.random() * 900)}`;

    const existingFranchisee = editingFranchiseeId ? franchisees.find(f => f.id === editingFranchiseeId) : null;
    const effectiveStartDate = (existingFranchisee ? getFranchiseeRegDate(existingFranchisee) : '') || franchiseeForm.purchaseDate || franchiseeForm.createdDate || new Date().toISOString().split('T')[0];

    // Compute endDate to be EXACTLY 1 year (or planYears) from registration/start date, never exceeding by any month
    let endDateStr = '';
    const dateMatch = String(effectiveStartDate).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      const year = parseInt(dateMatch[1], 10) + planYears;
      const month = dateMatch[2];
      const day = dateMatch[3];
      endDateStr = `${year}-${month}-${day}`;
    } else {
      const expDate = new Date(effectiveStartDate);
      expDate.setFullYear(expDate.getFullYear() + planYears);
      endDateStr = expDate.toISOString().split('T')[0];
    }

    const centerNameFinal = (franchiseeForm.centerName || franchiseeForm.firmName || franchiseeForm.franchiseName || owner).trim();
    const locationFinal = (franchiseeForm.place || franchiseeForm.location || franchiseeForm.districtState || 'N/A').trim();

    const franchiseePayload = {
      id: targetId,
      environmentId: targetId,
      environmentName: centerNameFinal,
      franchiseName: centerNameFinal,
      centerName: (franchiseeForm.centerName || '').trim(),
      firmName: (franchiseeForm.firmName || '').trim(),
      ownerName: owner,
      fullName: owner,
      contactNumber: phone,
      phone: phone,
      mobile: phone,
      contact: phone,
      qualification: (franchiseeForm.qualification || '').trim(),
      place: locationFinal,
      location: locationFinal,
      districtState: (franchiseeForm.districtState || '').trim(),
      residentialAddress: (franchiseeForm.residentialAddress || '').trim(),
      residentialPinCode: (franchiseeForm.residentialPinCode || '').trim(),

      // Step 2: Training Address & Facility
      trainingMobileNumber: (franchiseeForm.trainingMobileNumber || phone).trim(),
      centerAddress: (franchiseeForm.centerAddress || '').trim(),
      centerPinCode: (franchiseeForm.centerPinCode || '').trim(),
      email: email,
      computerSystems: (franchiseeForm.computerSystems || '').trim(),
      lcdProjector: (franchiseeForm.lcdProjector || '').trim(),
      geographicalCenter: (franchiseeForm.geographicalCenter || 'Urban').trim(),
      premisesAreaSqFt: (franchiseeForm.premisesAreaSqFt || '').trim(),
      noOfClassroom: (franchiseeForm.noOfClassroom || '').trim(),
      noOfLab: (franchiseeForm.noOfLab || '').trim(),

      // Step 3: Trade & Banking Details
      trade: (franchiseeForm.trade || '').trim(),
      affiliationFee: (franchiseeForm.affiliationFee || '').trim(),
      seatRequire: (franchiseeForm.seatRequire || '').trim(),
      modeOfPayment: (franchiseeForm.modeOfPayment || 'Online / Bank Transfer').trim(),
      accountNo: (franchiseeForm.accountNo || '').trim(),
      bankName: (franchiseeForm.bankName || '').trim(),
      ifscCode: (franchiseeForm.ifscCode || '').trim(),

      // Step 4: Documents Upload
      photoUrl: franchiseeForm.photoUrl || '',
      signatureUrl: franchiseeForm.signatureUrl || '',
      panCardUrl: franchiseeForm.panCardUrl || '',
      bankDetailsUrl: franchiseeForm.bankDetailsUrl || '',
      aadhaarCardUrl: franchiseeForm.aadhaarCardUrl || '',
      premisesPhotoUrl: franchiseeForm.premisesPhotoUrl || '',
      addressProofUrl: franchiseeForm.addressProofUrl || '',

      // Step 5: Portal Account & Plan
      ...(franchiseeForm.password && franchiseeForm.password.trim() ? { password: franchiseeForm.password.trim() } : (!editingFranchiseeId ? { password: '123456' } : {})),
      gstId: (franchiseeForm.gstId || 'N/A').trim(),
      planId: franchiseeForm.planId || 'plan-2yr',
      planName: selectedPlanObj ? selectedPlanObj.name : (franchiseeForm.planId?.includes('3') ? '3 Year Plan' : franchiseeForm.planId?.includes('2') ? '2 Year Plan' : '1 Year Plan'),
      purchaseDate: effectiveStartDate,
      registrationDate: effectiveStartDate,
      endDate: endDateStr,
      expiryDate: endDateStr,
      status: 'Active',
      paymentStatus: 'Paid',
      purchaseStatus: 'Purchased',
      ...(editingFranchiseeId ? {} : {
        createdDate: effectiveStartDate,
        createdAt: Date.now()
      })
    };

    // Purge any undefined keys so Firestore never rejects the write payload
    Object.keys(franchiseePayload).forEach(key => {
      if (franchiseePayload[key] === undefined) {
        delete franchiseePayload[key];
      }
    });

    try {
      await setDoc(doc(db, 'franchisees', targetId), franchiseePayload, { merge: true });
      if (editingFranchiseeId) {
        setFranchisees(prev => prev.map(item => item.id === targetId ? { ...item, ...franchiseePayload } : item));
      } else {
        setFranchisees(prev => [franchiseePayload, ...prev]);
      }
      showToast(editingFranchiseeId ? 'Franchisee updated successfully!' : 'Franchisee registered successfully!');
    } catch (err) {
      console.error('Firebase save error:', err);
      if (editingFranchiseeId) {
        setFranchisees(prev => prev.map(item => item.id === targetId ? { ...item, ...franchiseePayload } : item));
      } else {
        setFranchisees(prev => [franchiseePayload, ...prev]);
      }
      showToast('Saved locally!');
    }

    // Sync Active & Paid Franchisee payload to local storage cache
    try {
      const cached = JSON.parse(localStorage.getItem('sle_franchisees_cache') || '[]');
      const updatedCache = [franchiseePayload, ...cached.filter(f => f.id !== targetId && (f.email || '').toLowerCase() !== (franchiseePayload.email || '').toLowerCase())];
      localStorage.setItem('sle_franchisees_cache', JSON.stringify(updatedCache));

      // Also update sle_portal_user_data if current user is this franchisee
      const portalUser = JSON.parse(localStorage.getItem('sle_portal_user_data') || 'null');
      if (portalUser && (portalUser.id === targetId || portalUser.franchiseCode === targetId)) {
        localStorage.setItem('sle_portal_user_data', JSON.stringify({ ...portalUser, ...franchiseePayload }));
      }
    } catch (cacheErr) { }

    setIsSavingFranchisee(false);
    setEditingFranchiseeId(null);
    setFranchiseeStep(1);
    setFranchiseeForm(initialFranchiseeForm);
  };

  // Populate Franchisee Form for Editing & Scroll to Top Form
  const handleEditFranchisee = (f) => {
    setActiveMenu('add-franchisee');
    setEditingFranchiseeId(f.id);
    setFranchiseeStep(1);
    setFranchiseeForm({
      centerName: f.centerName || f.franchiseName || '',
      firmName: f.firmName || '',
      ownerName: f.ownerName || f.fullName || '',
      fullName: f.fullName || f.ownerName || '',
      contactNumber: f.contactNumber || f.phone || f.mobile || f.contact || '',
      phone: f.phone || f.contactNumber || f.mobile || f.contact || '',
      qualification: f.qualification || '',
      place: f.place || f.location || '',
      location: f.location || f.place || '',
      districtState: f.districtState || '',
      residentialAddress: f.residentialAddress || '',
      residentialPinCode: f.residentialPinCode || '',

      trainingMobileNumber: f.trainingMobileNumber || f.phone || f.mobile || f.contact || '',
      centerAddress: f.centerAddress || '',
      centerPinCode: f.centerPinCode || '',
      email: f.email || '',
      computerSystems: f.computerSystems || '',
      lcdProjector: f.lcdProjector || '',
      geographicalCenter: f.geographicalCenter || 'Urban',
      premisesAreaSqFt: f.premisesAreaSqFt || '',
      noOfClassroom: f.noOfClassroom || '',
      noOfLab: f.noOfLab || '',

      trade: f.trade || '',
      affiliationFee: f.affiliationFee || '',
      seatRequire: f.seatRequire || '',
      modeOfPayment: f.modeOfPayment || 'Online / Bank Transfer',
      accountNo: f.accountNo || '',
      bankName: f.bankName || '',
      ifscCode: f.ifscCode || '',

      photoUrl: f.photoUrl || '',
      signatureUrl: f.signatureUrl || '',
      panCardUrl: f.panCardUrl || '',
      bankDetailsUrl: f.bankDetailsUrl || '',
      aadhaarCardUrl: f.aadhaarCardUrl || '',
      premisesPhotoUrl: f.premisesPhotoUrl || '',
      addressProofUrl: f.addressProofUrl || '',

      password: f.password || '',
      confirmPassword: f.password || '',
      gstId: f.gstId || '',
      planId: f.planId || (f.planName?.toLowerCase().includes('first') ? 'first-time-franchisee-fee' : f.planName?.toLowerCase().includes('3') ? 'plan-3yr' : f.planName?.toLowerCase().includes('2') ? 'plan-2yr' : f.planName?.toLowerCase().includes('1') ? 'first-time-franchisee-fee' : plans.find(p => p.active)?.id || 'first-time-franchisee-fee'),
      purchaseDate: f.purchaseDate || f.createdDate || '',
      createdDate: f.createdDate || f.purchaseDate || ''
    });

    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (franchiseeFormRef.current) {
        franchiseeFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const handleCancelEdit = () => {
    setEditingFranchiseeId(null);
    setFranchiseeStep(1);
    setFranchiseeForm(initialFranchiseeForm);
  };

  // Toggle Active / Inactive Status
  const handleToggleFranchiseeStatus = async (f) => {
    const isActivating = f.status === 'Inactive' || f.status === 'Pending Lead' || !f.status;
    const nextStatus = isActivating ? 'Active' : 'Inactive';
    const updatePayload = {
      status: nextStatus,
      ...(isActivating ? { paymentStatus: 'Paid', purchaseStatus: 'Purchased' } : {})
    };

    // Optimistic UI update
    setFranchisees(franchisees.map(item => item.id === f.id ? { ...item, ...updatePayload } : item));

    try {
      await setDoc(doc(db, 'franchisees', f.id), updatePayload, { merge: true });
      showToast(`Status updated to ${nextStatus}!`);
    } catch (err) {
      console.error('Error toggling status:', err);
      showToast(`Status updated to ${nextStatus}!`);
    }
  };

  // Request Delete Confirmation Modal (Disabled when Active)
  const onRequestDeleteFranchisee = (f) => {
    if (!f || !f.id) return;
    if (f.status === 'Active') {
      showToast('Active franchisees cannot be deleted. Toggle status to Inactive first.', 'info');
      return;
    }
    setDeleteConfirmTarget(f);
  };

  // Perform Delete after Modal Confirmation
  const confirmDeleteFranchisee = async () => {
    if (!deleteConfirmTarget || !deleteConfirmTarget.id) return;
    const f = deleteConfirmTarget;
    setDeleteConfirmTarget(null);

    // 1. Immediate UI update
    setFranchisees(prev => prev.filter(item => item.id !== f.id));

    // 2. Remove from local cache
    try {
      const cached = JSON.parse(localStorage.getItem('sle_franchisees_cache') || '[]');
      const filtered = cached.filter(item => item.id !== f.id);
      localStorage.setItem('sle_franchisees_cache', JSON.stringify(filtered));
    } catch (e) { }

    // 3. Delete document from Firebase Firestore
    try {
      if (db) {
        await deleteDoc(doc(db, 'franchisees', f.id));
      }
      showToast(`Deleted ${f.fullName || f.id}!`);
    } catch (err) {
      console.error('Error deleting franchisee doc:', err);
      showToast('Deleted from records!');
    }
  };

  // Update Plan Price locally
  const handleUpdatePlanPrice = (planId, price) => {
    const val = parseInt(price, 10);
    const updated = plans.map(plan =>
      plan.id === planId ? { ...plan, price: isNaN(val) ? 0 : val } : plan
    );
    setPlans(updated);
    try {
      localStorage.setItem('sle_plans_cache', JSON.stringify(updated));
    } catch (e) { }
  };

  // Toggle Plan Active State and update Firestore instantly
  const handleTogglePlanActive = async (planId) => {
    const targetPlan = plans.find(p => p.id === planId);
    if (!targetPlan) return;

    const nextActive = !targetPlan.active;

    // Optimistic local state update
    const updated = plans.map(plan =>
      plan.id === planId ? { ...plan, active: nextActive } : plan
    );
    setPlans(updated);
    try {
      localStorage.setItem('sle_plans_cache', JSON.stringify(updated));
    } catch (e) { }

    try {
      await setDoc(doc(db, 'plans', planId), { active: nextActive }, { merge: true });
      showToast('Saved!');
    } catch (err) {
      console.error('Firebase plan active update error:', err);
    }
  };

  // Feature Add & Remove Handlers
  const handleAddFeature = (planId) => {
    const text = (newFeatureText[planId] || '').trim();
    if (!text) return;

    const updated = plans.map(plan => {
      if (plan.id === planId) {
        return { ...plan, features: [...plan.features, text] };
      }
      return plan;
    });
    setPlans(updated);
    try {
      localStorage.setItem('sle_plans_cache', JSON.stringify(updated));
    } catch (e) { }

    setNewFeatureText({ ...newFeatureText, [planId]: '' });
  };

  const handleRemoveFeature = (planId, featureIdx) => {
    const updated = plans.map(plan => {
      if (plan.id === planId) {
        return {
          ...plan,
          features: plan.features.filter((_, idx) => idx !== featureIdx)
        };
      }
      return plan;
    });
    setPlans(updated);
    try {
      localStorage.setItem('sle_plans_cache', JSON.stringify(updated));
    } catch (e) { }
  };

  // Save Plan Details to Firebase Firestore with localStorage fallback
  const handleSavePlanDetails = async (planId) => {
    const targetPlan = plans.find(p => p.id === planId);
    if (!targetPlan) return;

    setPlans(plans.map(p => p.id === planId ? { ...p, updating: true } : p));

    const planPayload = sanitizePlanForFirestore(targetPlan);

    // Save to local storage as fallback
    try {
      const updatedPlans = plans.map(p => p.id === planId ? { ...p, ...planPayload, updating: false } : p);
      localStorage.setItem('sle_plans_cache', JSON.stringify(updatedPlans));
    } catch (e) { }

    try {
      await setDoc(doc(db, 'plans', planId), planPayload, { merge: true });
      showToast('Plan Details Updated Successfully!', 'success');
    } catch (err) {
      console.error('Firebase plan save error:', err);
      showToast('Plan Saved Locally!');
    } finally {
      setPlans(plans.map(p => p.id === planId ? { ...p, updating: false } : p));
    }
  };

  // Filtered franchisees (Always sorted with newest entry ON TOP)
  const filteredFranchisees = [...franchisees]
    .sort((a, b) => {
      const timeA = a.createdAt || (a.createdDate ? new Date(a.createdDate).getTime() : 0);
      const timeB = b.createdAt || (b.createdDate ? new Date(b.createdDate).getTime() : 0);
      if (timeA !== timeB) return timeB - timeA;
      return (b.id || '').localeCompare(a.id || '');
    })
    .filter(f =>
      (f.fullName || '').toLowerCase().includes(franchiseeSearch.toLowerCase()) ||
      (f.franchiseName || '').toLowerCase().includes(franchiseeSearch.toLowerCase()) ||
      (f.location || '').toLowerCase().includes(franchiseeSearch.toLowerCase()) ||
      (f.email || '').toLowerCase().includes(franchiseeSearch.toLowerCase()) ||
      (f.id || '').toLowerCase().includes(franchiseeSearch.toLowerCase())
    );

  // Filtered franchisees for Certificate Management Screen
  const filteredCertFranchisees = [...franchisees]
    .sort((a, b) => {
      const timeA = a.createdAt || (a.createdDate ? new Date(a.createdDate).getTime() : 0);
      const timeB = b.createdAt || (b.createdDate ? new Date(b.createdDate).getTime() : 0);
      if (timeA !== timeB) return timeB - timeA;
      return (b.id || '').localeCompare(a.id || '');
    })
    .filter(f => {
      const q = certSearchQuery.toLowerCase().trim();
      const matches = !q || (
        (f.fullName || '').toLowerCase().includes(q) ||
        (f.ownerName || '').toLowerCase().includes(q) ||
        (f.franchiseName || '').toLowerCase().includes(q) ||
        (f.centerName || '').toLowerCase().includes(q) ||
        (f.location || '').toLowerCase().includes(q) ||
        (f.place || '').toLowerCase().includes(q) ||
        (f.email || '').toLowerCase().includes(q) ||
        (f.id || '').toLowerCase().includes(q)
      );
      const hasCert = Boolean(f.franchiseCertificateUrl);
      if (certFilterStatus === 'issued') return matches && hasCert;
      if (certFilterStatus === 'pending') return matches && !hasCert;
      return matches;
    });

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden ${isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} font-sans transition-colors duration-300`}>

      {/* Toast Notification Container */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-md ${toast.type === 'error'
            ? 'bg-rose-500/90 text-white border-rose-400'
            : toast.type === 'info'
              ? 'bg-amber-500/90 text-white border-amber-400'
              : 'bg-emerald-600/90 text-white border-emerald-400'
            }`}>
            {toast.type === 'error' ? (
              <AlertCircle className="w-5 h-5 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            )}
            <span className="text-sm font-semibold">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 text-white/80 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* TOP NAVIGATION BAR */}
      <header className={`shrink-0 z-40 backdrop-blur-md ${isDarkMode
        ? 'bg-slate-900/80 border-slate-800 text-white'
        : 'bg-white/80 border-slate-200 text-slate-800'
        } border-b px-3 sm:px-6 py-3 transition-colors duration-300`}>
        <div className="flex items-center justify-between gap-4 w-full">

          {/* Left: Brand & Sidebar Toggles */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Sidebar Toggle — always visible */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={`p-2 rounded-xl transition-all duration-200 ${isDarkMode
                ? 'hover:bg-slate-800 text-slate-300'
                : 'hover:bg-slate-100 text-slate-600'
                }`}
              title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {isSidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>

            <Link to="/" className="flex items-center gap-2.5 sm:gap-3 group">
              <div className="w-9 h-9 rounded-xl bg-white p-0.5 shadow-md flex items-center justify-center shrink-0 border border-slate-200/80 overflow-hidden">
                <img
                  src="/logo-2.png"
                  alt="S.L.E. Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="block">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm sm:text-base tracking-tight bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                    S.L.E.
                  </span>
                  <span className={`text-[9px] sm:text-[10px] uppercase font-black px-1.5 py-0.5 rounded-full ${isDarkMode ? 'bg-indigo-950 text-indigo-400 border border-indigo-800' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    }`}>
                    Admin
                  </span>
                </div>
                <p className={`text-[10px] sm:text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Control Center</p>
              </div>
            </Link>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white border border-rose-500/20 transition-all duration-200 shadow-sm cursor-pointer"
              title="Logout of Admin Panel"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* DASHBOARD BODY: sidebar + main content side by side */}
      <div className="flex flex-1 overflow-hidden">

        {/* DESKTOP SIDEBAR — always visible as flex item in the row */}
        <aside
          style={{
            width: isSidebarCollapsed ? '72px' : '264px',
            minWidth: isSidebarCollapsed ? '72px' : '264px',
            transition: 'width 0.25s ease, min-width 0.25s ease',
            height: '100%',
          }}
          className={`flex flex-col shrink-0 border-r overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
        >

          {/* Scrollable nav list */}
          <div className="flex flex-col" style={{ height: '100%', overflow: 'hidden', padding: '12px', gap: '8px' }}>
            <p className={`text-[10px] font-black uppercase tracking-wider shrink-0 px-2 mb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} ${isSidebarCollapsed ? 'hidden' : 'block'}`}>
              Management Modules
            </p>

            <nav className="flex-1 overflow-y-auto space-y-1 pr-1">
              {/* 1. Add Franchisee Menu */}
              <button
                onClick={() => { setActiveMenu('add-franchisee'); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeMenu === 'add-franchisee'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25 scale-[1.02]'
                  : isDarkMode
                    ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600'
                  } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                title="Add Franchisee"
              >
                <PlusCircle className={`w-5 h-5 shrink-0 ${activeMenu === 'add-franchisee' ? 'text-white' : 'text-indigo-500'}`} />
                <span className={`truncate ${isSidebarCollapsed ? 'hidden' : 'block'}`}>Add Franchisee</span>
              </button>

              {/* Franchisee Certificate Menu */}
              <button
                onClick={() => { setActiveMenu('franchisee-certificate'); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeMenu === 'franchisee-certificate'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25 scale-[1.02]'
                  : isDarkMode
                    ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600'
                  } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                title="Franchisee Certificate Upload & Management"
              >
                <Award className={`w-5 h-5 shrink-0 ${activeMenu === 'franchisee-certificate' ? 'text-white' : 'text-indigo-500'}`} />
                <span className={`truncate ${isSidebarCollapsed ? 'hidden' : 'block'}`}>Franchisee Certificate</span>
              </button>

              {/* 2. Set Plans Menu */}
              <button
                onClick={() => { setActiveMenu('set-plans'); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeMenu === 'set-plans'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25 scale-[1.02]'
                  : isDarkMode
                    ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600'
                  } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                title="Set Plans"
              >
                <Package className={`w-5 h-5 shrink-0 ${activeMenu === 'set-plans' ? 'text-white' : 'text-purple-500'}`} />
                <span className={`truncate ${isSidebarCollapsed ? 'hidden' : 'block'}`}>Set Plans</span>
              </button>

              {/* 3. Student Application Charges Menu */}
              <button
                onClick={() => { setActiveMenu('student-application-charges'); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeMenu === 'student-application-charges'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25 scale-[1.02]'
                  : isDarkMode
                    ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600'
                  } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                title="Student Application Fee"
              >
                <CreditCard className={`w-5 h-5 shrink-0 ${activeMenu === 'student-application-charges' ? 'text-white' : 'text-indigo-500'}`} />
                <span className={`truncate ${isSidebarCollapsed ? 'hidden' : 'block'}`}>Student Application Fee</span>
              </button>

              {/* 4. Franchisee Fee & Pricing Settings Menu */}
              <button
                onClick={() => { setActiveMenu('pricing-settings'); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeMenu === 'pricing-settings'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25 scale-[1.02]'
                  : isDarkMode
                    ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600'
                  } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                title="Franchisee Fee Settings"
              >
                <DollarSign className={`w-5 h-5 shrink-0 ${activeMenu === 'pricing-settings' ? 'text-white' : 'text-emerald-500'}`} />
                <span className={`truncate ${isSidebarCollapsed ? 'hidden' : 'block'}`}>Franchisee Fee Settings</span>
              </button>

              {/* Payment Transactions Audit Ledger Menu */}
              <button
                onClick={() => { setActiveMenu('payment-transactions'); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeMenu === 'payment-transactions'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25 scale-[1.02]'
                  : isDarkMode
                    ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600'
                  } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                title="Payment Transactions"
              >
                <IndianRupee className={`w-5 h-5 shrink-0 ${activeMenu === 'payment-transactions' ? 'text-white' : 'text-indigo-500'}`} />
                <span className={`truncate ${isSidebarCollapsed ? 'hidden' : 'block'}`}>Payment Transactions</span>
              </button>
              {/* Pending Payments Monitor Menu */}
              <button
                onClick={() => { setActiveMenu('pending-payments'); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeMenu === 'pending-payments'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25 scale-[1.02]'
                  : isDarkMode
                    ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600'
                  } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                title="Pending Payments"
              >
                <Clock className={`w-5 h-5 shrink-0 ${activeMenu === 'pending-payments' ? 'text-white' : 'text-indigo-500'}`} />
                <span className={`truncate ${isSidebarCollapsed ? 'hidden' : 'block'}`}>Pending Payments</span>
              </button>

              <button
                onClick={() => { setActiveMenu('branchwise-students'); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeMenu === 'branchwise-students'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25 scale-[1.02]'
                  : isDarkMode
                    ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600'
                  } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                title="Branchwise Students"
              >
                <Users className={`w-5 h-5 shrink-0 ${activeMenu === 'branchwise-students' ? 'text-white' : 'text-sky-500'}`} />
                <span className={`truncate ${isSidebarCollapsed ? 'hidden' : 'block'}`}>Branchwise Students</span>
              </button>

              {/* Certificate Students Menu */}
              <button
                onClick={() => { setActiveMenu('certificate-students'); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeMenu === 'certificate-students'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25 scale-[1.02]'
                  : isDarkMode
                    ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600'
                  } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                title="Certificate Students"
              >
                <Award className={`w-5 h-5 shrink-0 ${activeMenu === 'certificate-students' ? 'text-white' : 'text-indigo-500'}`} />
                <span className={`truncate ${isSidebarCollapsed ? 'hidden' : 'block'}`}>Certificate Students</span>
              </button>

              {/* 6. Manage Branches Menu */}
              <button
                onClick={() => { setActiveMenu('manage-branches'); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeMenu === 'manage-branches'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25 scale-[1.02]'
                  : isDarkMode
                    ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600'
                  } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                title="Manage Branches"
              >
                <MapPin className={`w-5 h-5 shrink-0 ${activeMenu === 'manage-branches' ? 'text-white' : 'text-rose-500'}`} />
                <span className={`truncate ${isSidebarCollapsed ? 'hidden' : 'block'}`}>Manage Branches</span>
              </button>

              {/* 7. Manage Courses Menu */}
              <button
                onClick={() => { setActiveMenu('manage-courses'); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeMenu === 'manage-courses'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25 scale-[1.02]'
                  : isDarkMode
                    ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600'
                  } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                title="Manage Courses"
              >
                <BookOpen className={`w-5 h-5 shrink-0 ${activeMenu === 'manage-courses' ? 'text-white' : 'text-amber-500'}`} />
                <span className={`truncate ${isSidebarCollapsed ? 'hidden' : 'block'}`}>Manage Courses</span>
              </button>

              {/* 8. Add Subject Menu */}
              <button
                onClick={() => { setActiveMenu('add-subject'); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeMenu === 'add-subject'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25 scale-[1.02]'
                  : isDarkMode
                    ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600'
                  } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                title="Add Subject"
              >
                <BookmarkCheck className={`w-5 h-5 shrink-0 ${activeMenu === 'add-subject' ? 'text-white' : 'text-emerald-500'}`} />
                <span className={`truncate ${isSidebarCollapsed ? 'hidden' : 'block'}`}>Add Subject</span>
              </button>

              {/* 9. Add Question Paper Menu */}
              <button
                onClick={() => { setActiveMenu('add-question-paper'); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeMenu === 'add-question-paper'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25 scale-[1.02]'
                  : isDarkMode
                    ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600'
                  } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                title="Add Question Paper"
              >
                <FileQuestion className={`w-5 h-5 shrink-0 ${activeMenu === 'add-question-paper' ? 'text-white' : 'text-cyan-500'}`} />
                <span className={`truncate ${isSidebarCollapsed ? 'hidden' : 'block'}`}>Add Question Paper</span>
              </button>

              {/* 10. Student Inquiries Menu */}
              <button
                onClick={() => { setActiveMenu('inquiries'); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeMenu === 'inquiries'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25 scale-[1.02]'
                  : isDarkMode
                    ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600'
                  } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                title="Student Inquiries"
              >
                <Mail className={`w-5 h-5 shrink-0 ${activeMenu === 'inquiries' ? 'text-white' : 'text-amber-500'}`} />
                <span className={`truncate ${isSidebarCollapsed ? 'hidden' : 'block'}`}>Landing Inquiries</span>
              </button>

              {/* 11. Certificate Designer Menu */}
              <button
                onClick={() => { setActiveMenu('certificate-designer'); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeMenu === 'certificate-designer'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25 scale-[1.02]'
                  : isDarkMode
                    ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600'
                  } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                title="Certificate Designer"
              >
                <Award className={`w-5 h-5 shrink-0 ${activeMenu === 'certificate-designer' ? 'text-white' : 'text-indigo-500'}`} />
                <span className={`truncate ${isSidebarCollapsed ? 'hidden' : 'block'}`}>Certificate Designer</span>
              </button>

              {/* 12. Manage Directors Menu */}
              <button
                onClick={() => { setActiveMenu('manage-directors'); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeMenu === 'manage-directors'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25 scale-[1.02]'
                  : isDarkMode
                    ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600'
                  } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                title="Manage Directors"
              >
                <UserCheck className={`w-5 h-5 shrink-0 ${activeMenu === 'manage-directors' ? 'text-white' : 'text-blue-500'}`} />
                <span className={`truncate ${isSidebarCollapsed ? 'hidden' : 'block'}`}>Manage Directors</span>
              </button>

              {/* 13. Student Branch Transfer Menu */}
              <button
                onClick={() => { setActiveMenu('student-transfer'); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeMenu === 'student-transfer'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25 scale-[1.02]'
                  : isDarkMode
                    ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600'
                  } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                title="Student Branch Transfer"
              >
                <ArrowLeftRight className={`w-5 h-5 shrink-0 ${activeMenu === 'student-transfer' ? 'text-white' : 'text-emerald-500'}`} />
                <span className={`truncate ${isSidebarCollapsed ? 'hidden' : 'block'}`}>Student Transfer</span>
              </button>

              {/* 14. Data Import / Export Menu */}
              <button
                onClick={() => { setActiveMenu('data-import-export'); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeMenu === 'data-import-export'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25 scale-[1.02]'
                  : isDarkMode
                    ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600'
                  } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                title="Data Import / Export"
              >
                <Database className={`w-5 h-5 shrink-0 ${activeMenu === 'data-import-export' ? 'text-white' : 'text-cyan-500'}`} />
                <span className={`truncate ${isSidebarCollapsed ? 'hidden' : 'block'}`}>Data Import / Export</span>
              </button>
            </nav>
          </div>
        </aside>

        {/* MOBILE DRAWER SIDEBAR — fixed overlay, only on small screens */}
        {isMobileSidebarOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
            <aside className={`fixed inset-y-0 left-0 z-50 w-72 flex flex-col border-r shadow-2xl overflow-hidden
              ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}
            `}>
              <div className="flex flex-col h-full p-3 gap-2">
                <div className="flex items-center justify-between px-2 shrink-0">
                  <p className={`text-[10px] font-black uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Management Modules
                  </p>
                  <button onClick={() => setIsMobileSidebarOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <nav className="flex-1 overflow-y-auto space-y-1 pr-1">
                  {[
                    { id: 'add-franchisee', label: 'Add Franchisee', icon: <PlusCircle className="w-5 h-5 shrink-0" />, color: 'text-indigo-500' },
                    { id: 'franchisee-certificate', label: 'Franchisee Certificate', icon: <Award className="w-5 h-5 shrink-0" />, color: 'text-indigo-500' },
                    { id: 'set-plans', label: 'Set Plans', icon: <Package className="w-5 h-5 shrink-0" />, color: 'text-purple-500' },
                    { id: 'student-application-charges', label: 'Student Application Fee', icon: <CreditCard className="w-5 h-5 shrink-0" />, color: 'text-indigo-500' },
                    { id: 'pricing-settings', label: 'Franchisee Fee Settings', icon: <DollarSign className="w-5 h-5 shrink-0" />, color: 'text-emerald-500' },
                    { id: 'payment-transactions', label: 'Payment Transactions', icon: <IndianRupee className="w-5 h-5 shrink-0" />, color: 'text-indigo-500' },
                    { id: 'pending-payments', label: 'Pending Payments', icon: <Clock className="w-5 h-5 shrink-0" />, color: 'text-indigo-500' },
                    { id: 'branchwise-students', label: 'Branchwise Students', icon: <Users className="w-5 h-5 shrink-0" />, color: 'text-sky-500' },
                    { id: 'certificate-students', label: 'Certificate Students', icon: <Award className="w-5 h-5 shrink-0" />, color: 'text-indigo-500' },
                    { id: 'manage-branches', label: 'Manage Branches', icon: <MapPin className="w-5 h-5 shrink-0" />, color: 'text-rose-500' },
                    { id: 'manage-courses', label: 'Manage Courses', icon: <BookOpen className="w-5 h-5 shrink-0" />, color: 'text-amber-500' },
                    { id: 'add-subject', label: 'Add Subject', icon: <BookmarkCheck className="w-5 h-5 shrink-0" />, color: 'text-emerald-500' },
                    { id: 'add-question-paper', label: 'Add Question Paper', icon: <FileQuestion className="w-5 h-5 shrink-0" />, color: 'text-cyan-500' },
                    { id: 'inquiries', label: 'Landing Inquiries', icon: <Mail className="w-5 h-5 shrink-0" />, color: 'text-amber-500' },
                    { id: 'certificate-designer', label: 'Certificate Designer', icon: <Award className="w-5 h-5 shrink-0" />, color: 'text-indigo-500' },
                    { id: 'manage-directors', label: 'Manage Directors', icon: <UserCheck className="w-5 h-5 shrink-0" />, color: 'text-blue-500' },
                    { id: 'student-transfer', label: 'Student Transfer', icon: <ArrowLeftRight className="w-5 h-5 shrink-0" />, color: 'text-emerald-500' },
                    { id: 'data-import-export', label: 'Data Import / Export', icon: <Database className="w-5 h-5 shrink-0" />, color: 'text-cyan-500' },
                  ].map(item => (
                    <button
                      key={item.id}
                      onClick={() => { setActiveMenu(item.id); setIsMobileSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeMenu === item.id
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                        : isDarkMode ? 'text-slate-300 hover:bg-slate-800 hover:text-white' : 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600'
                        }`}
                    >
                      <span className={activeMenu === item.id ? 'text-white' : item.color}>{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </nav>
              </div>
            </aside>
          </>
        )}

        {/* MAIN CONTENT — scrollable */}
        <main className="flex-1 min-w-0 overflow-y-auto p-2.5 sm:p-6">

          {/* ========================================================= */}
          {/* SCREEN 1: ADD FRANCHISEE */}
          {/* ========================================================= */}
          {activeMenu === 'add-franchisee' && (
            <div className="space-y-8 animate-in fade-in duration-300">

              {/* Header Info Banner */}
              <div className={`p-6 rounded-3xl border ${isDarkMode
                ? 'bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-slate-800'
                : 'bg-gradient-to-r from-indigo-50 via-purple-50 to-white border-indigo-100'
                } shadow-sm relative overflow-hidden`}>
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">Onboard New Franchisee</h2>
                    <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Register a new institute partner, assign custom plans, and configure business details.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 px-3.5 py-2 rounded-2xl text-xs font-bold">
                      <Sparkles className="w-4 h-4" />
                      <span>Instant Portal Activation</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Multi-Step Add / Register Franchisee Wizard */}
              <form ref={franchiseeFormRef} onSubmit={handleSaveFranchisee} className={`p-6 sm:p-8 rounded-3xl border shadow-xl backdrop-blur-md ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
                } space-y-8 transition-all`}>

                {/* ========================================================= */}
                {/* STEP WIZARD PROGRESS TRACKER */}
                {/* ========================================================= */}
                <div className="space-y-3 pb-2 border-b border-slate-200 dark:border-slate-800">
                  {/* Step Pills on Desktop / Responsive */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {[
                      { num: 1, title: 'Personal Details', short: '1. Personal', icon: User },
                      { num: 2, title: 'Training Address', short: '2. Address', icon: Building },
                      { num: 3, title: 'Trade & Banking', short: '3. Banking', icon: CreditCard },
                      { num: 4, title: 'File Upload', short: '4. Documents', icon: Upload },
                      { num: 5, title: 'Plan & Account', short: '5. Plan & Access', icon: Sparkles },
                    ].map((step) => {
                      const StepIcon = step.icon;
                      const isActive = franchiseeStep === step.num;
                      const isCompleted = franchiseeStep > step.num;

                      return (
                        <button
                          key={step.num}
                          type="button"
                          onClick={() => {
                            if (isCompleted || step.num < franchiseeStep) {
                              setFranchiseeStep(step.num);
                            }
                          }}
                          className={`flex items-center gap-2 p-2.5 rounded-2xl text-left transition-all duration-200 cursor-pointer ${isActive
                            ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25 scale-[1.02]'
                            : isCompleted
                              ? isDarkMode
                                ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/50 hover:bg-emerald-900/40'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100/70'
                              : isDarkMode
                                ? 'bg-slate-950/40 text-slate-500 border border-slate-800/60'
                                : 'bg-slate-50 text-slate-400 border border-slate-200'
                            }`}
                        >
                          <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${isActive
                            ? 'bg-white/20 text-white'
                            : isCompleted
                              ? 'bg-emerald-500 text-white'
                              : isDarkMode
                                ? 'bg-slate-800 text-slate-400'
                                : 'bg-slate-200 text-slate-600'
                            }`}>
                            {isCompleted ? <Check className="w-4 h-4" /> : <StepIcon className="w-3.5 h-3.5" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate leading-tight">{step.short}</p>
                            <p className={`text-[10px] truncate hidden sm:block ${isActive ? 'text-indigo-100' : isCompleted ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-600') : 'text-slate-400'
                              }`}>
                              {isActive ? 'Current' : isCompleted ? 'Completed' : 'Upcoming'}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Progress Line */}
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-500 via-purple-500 to-purple-600 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${(franchiseeStep / 5) * 100}%` }}
                    />
                  </div>
                </div>

                {/* ========================================================= */}
                {/* STEP 1: PERSONAL DETAILS */}
                {/* ========================================================= */}
                {franchiseeStep === 1 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                    <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200 dark:border-slate-800">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold">Step 1 — Personal Details</h3>
                        <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Center ownership, personal contacts and residential location</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {/* Center Name */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Center Name
                        </label>
                        <div className="relative">
                          <Building className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter Center Name"
                            value={franchiseeForm.centerName}
                            onChange={e => setFranchiseeForm({ ...franchiseeForm, centerName: e.target.value, franchiseName: e.target.value })}
                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                              }`}
                          />
                        </div>
                      </div>

                      {/* Firm Name */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Firm Name
                        </label>
                        <div className="relative">
                          <Briefcase className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter Firm Name"
                            value={franchiseeForm.firmName}
                            onChange={e => setFranchiseeForm({ ...franchiseeForm, firmName: e.target.value })}
                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                              }`}
                          />
                        </div>
                      </div>

                      {/* Owner Name */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Owner Name <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            required
                            placeholder="Enter Owner Name"
                            value={franchiseeForm.ownerName || franchiseeForm.fullName}
                            onChange={e => setFranchiseeForm({ ...franchiseeForm, ownerName: e.target.value, fullName: e.target.value })}
                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                              }`}
                          />
                        </div>
                      </div>

                      {/* Contact Number */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Contact Number <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <Phone className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="tel"
                            required
                            placeholder="Enter Contact Number"
                            value={franchiseeForm.contactNumber || franchiseeForm.phone}
                            onChange={e => setFranchiseeForm({ ...franchiseeForm, contactNumber: e.target.value, phone: e.target.value })}
                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                              }`}
                          />
                        </div>
                      </div>

                      {/* Qualification */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Qualification
                        </label>
                        <div className="relative">
                          <GraduationCap className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter Your Qualification"
                            value={franchiseeForm.qualification}
                            onChange={e => setFranchiseeForm({ ...franchiseeForm, qualification: e.target.value })}
                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                              }`}
                          />
                        </div>
                      </div>

                      {/* Location */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Location
                        </label>
                        <div className="relative">
                          <MapPin className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
                          <select
                            value={franchiseeForm.place || franchiseeForm.location || ''}
                            onChange={e => setFranchiseeForm({ ...franchiseeForm, place: e.target.value, location: e.target.value })}
                            className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-500'
                              }`}
                          >
                            <option value="">Select Location</option>
                            {Array.from(new Set([
                              ...(DEFAULT_BRANCHES || []),
                              ...(branches || []).map(b => (typeof b === 'string' ? b : b?.name)),
                              franchiseeForm.place,
                              franchiseeForm.location
                            ].filter(Boolean))).sort().map(branch => (
                              <option key={branch} value={branch}>
                                {branch}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400 pointer-events-none" />
                        </div>
                      </div>

                      {/* District / State */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          District / State
                        </label>
                        <div className="relative">
                          <MapPin className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter District / State"
                            value={franchiseeForm.districtState}
                            onChange={e => setFranchiseeForm({ ...franchiseeForm, districtState: e.target.value })}
                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                              }`}
                          />
                        </div>
                      </div>

                      {/* Owner's Residential Address */}
                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Owner's Residential Address
                        </label>
                        <div className="relative">
                          <Home className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter address"
                            value={franchiseeForm.residentialAddress}
                            onChange={e => setFranchiseeForm({ ...franchiseeForm, residentialAddress: e.target.value })}
                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                              }`}
                          />
                        </div>
                      </div>

                      {/* Pin Code */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Pin Code
                        </label>
                        <div className="relative">
                          <MapPin className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter Pin Code"
                            value={franchiseeForm.residentialPinCode}
                            onChange={e => setFranchiseeForm({ ...franchiseeForm, residentialPinCode: e.target.value })}
                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                              }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Step 1 Navigation */}
                    <div className="pt-4 flex items-center justify-end border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={handleNextFranchiseeStep}
                        className="px-6 py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-md shadow-indigo-500/25 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                      >
                        <span>Continue to Training Address</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* STEP 2: TRAINING ADDRESS & INFRASTRUCTURE */}
                {/* ========================================================= */}
                {franchiseeStep === 2 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                    <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200 dark:border-slate-800">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold">
                        <Building className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold">Step 2 — Training Address Details</h3>
                        <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Training center premises, location, and classroom equipment</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {/* Center Address */}
                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Center Address
                        </label>
                        <div className="relative">
                          <Building className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter address"
                            value={franchiseeForm.centerAddress}
                            onChange={e => setFranchiseeForm({ ...franchiseeForm, centerAddress: e.target.value })}
                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                              }`}
                          />
                        </div>
                      </div>

                      {/* Pin Code */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Pin Code
                        </label>
                        <div className="relative">
                          <MapPin className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter Pin Code"
                            value={franchiseeForm.centerPinCode}
                            onChange={e => setFranchiseeForm({ ...franchiseeForm, centerPinCode: e.target.value })}
                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                              }`}
                          />
                        </div>
                      </div>

                      {/* Email address */}
                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Email address <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="email"
                            required
                            placeholder="name@example.com"
                            value={franchiseeForm.email}
                            onChange={e => setFranchiseeForm({ ...franchiseeForm, email: e.target.value })}
                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                              }`}
                          />
                        </div>
                      </div>

                      {/* Availability of Computer Systems */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Availability of Computer Systems
                        </label>
                        <div className="relative">
                          <Monitor className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter Availability of Computer Systems"
                            value={franchiseeForm.computerSystems}
                            onChange={e => setFranchiseeForm({ ...franchiseeForm, computerSystems: e.target.value })}
                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                              }`}
                          />
                        </div>
                      </div>

                      {/* LCD Projector */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          LCD Projector
                        </label>
                        <div className="relative">
                          <Eye className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter Number of LCD Projector"
                            value={franchiseeForm.lcdProjector}
                            onChange={e => setFranchiseeForm({ ...franchiseeForm, lcdProjector: e.target.value })}
                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                              }`}
                          />
                        </div>
                      </div>

                      {/* Geographical Name of the Center */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Geographical Name of the Center
                        </label>
                        <select
                          value={franchiseeForm.geographicalCenter}
                          onChange={e => setFranchiseeForm({ ...franchiseeForm, geographicalCenter: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 shadow-xs transition-all focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                        >
                          <option value="Urban">Urban</option>
                          <option value="Rural">Rural</option>
                        </select>
                      </div>

                      {/* TC Premises Details (area in Sq.Ft) */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          TC Premises Details(area in Sq.Ft)
                        </label>
                        <input
                          type="text"
                          placeholder="Enter TC Premises Details(area in Sq.Ft)"
                          value={franchiseeForm.premisesAreaSqFt}
                          onChange={e => setFranchiseeForm({ ...franchiseeForm, premisesAreaSqFt: e.target.value })}
                          className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                            }`}
                        />
                      </div>

                      {/* No.of Classroom */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          No.of Classroom
                        </label>
                        <input
                          type="text"
                          placeholder="Enter No. of Classroom"
                          value={franchiseeForm.noOfClassroom}
                          onChange={e => setFranchiseeForm({ ...franchiseeForm, noOfClassroom: e.target.value })}
                          className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                            }`}
                        />
                      </div>

                      {/* No.of Lab */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          No.of Lab
                        </label>
                        <input
                          type="text"
                          placeholder="Enter No.of Lab"
                          value={franchiseeForm.noOfLab}
                          onChange={e => setFranchiseeForm({ ...franchiseeForm, noOfLab: e.target.value })}
                          className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                            }`}
                        />
                      </div>
                    </div>

                    {/* Step 2 Navigation */}
                    <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setFranchiseeStep(1)}
                        className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Back</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleNextFranchiseeStep}
                        className="px-6 py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-md shadow-indigo-500/25 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                      >
                        <span>Continue to Trade & Banking</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* STEP 3: TRADE & BANKING DETAILS */}
                {/* ========================================================= */}
                {franchiseeStep === 3 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                    <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200 dark:border-slate-800">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold">Step 3 — Trade & Bank Details</h3>
                        <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Official trade allocation, affiliation fee, and settlement bank info</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {/* Trade */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Trade
                        </label>
                        <div className="relative">
                          <Briefcase className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter Trade"
                            value={franchiseeForm.trade}
                            onChange={e => setFranchiseeForm({ ...franchiseeForm, trade: e.target.value })}
                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                              }`}
                          />
                        </div>
                      </div>

                      {/* Affiliation Fee */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Affiliation Fee
                        </label>
                        <div className="relative">
                          <DollarSign className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter Affiliation Fee"
                            value={franchiseeForm.affiliationFee}
                            onChange={e => setFranchiseeForm({ ...franchiseeForm, affiliationFee: e.target.value })}
                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                              }`}
                          />
                        </div>
                      </div>

                      {/* Seat Require */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Seat Require
                        </label>
                        <div className="relative">
                          <Users className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter Seat Require"
                            value={franchiseeForm.seatRequire}
                            onChange={e => setFranchiseeForm({ ...franchiseeForm, seatRequire: e.target.value })}
                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                              }`}
                          />
                        </div>
                      </div>

                      {/* Mode of Payment */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Mode of Payment
                        </label>
                        <div className="relative">
                          <CreditCard className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter Mode of Payment"
                            value={franchiseeForm.modeOfPayment}
                            onChange={e => setFranchiseeForm({ ...franchiseeForm, modeOfPayment: e.target.value })}
                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                              }`}
                          />
                        </div>
                      </div>

                      {/* Account No. */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Account No.
                        </label>
                        <div className="relative">
                          <CreditCard className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter Account No."
                            value={franchiseeForm.accountNo}
                            onChange={e => setFranchiseeForm({ ...franchiseeForm, accountNo: e.target.value })}
                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                              }`}
                          />
                        </div>
                      </div>

                      {/* Bank Name */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Bank Name
                        </label>
                        <div className="relative">
                          <Building className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter Bank Name"
                            value={franchiseeForm.bankName}
                            onChange={e => setFranchiseeForm({ ...franchiseeForm, bankName: e.target.value })}
                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                              }`}
                          />
                        </div>
                      </div>

                      {/* IFSC Code */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          IFSC Code
                        </label>
                        <div className="relative">
                          <ShieldCheck className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter IFSC Code"
                            value={franchiseeForm.ifscCode}
                            onChange={e => setFranchiseeForm({ ...franchiseeForm, ifscCode: e.target.value })}
                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                              }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Step 3 Navigation */}
                    <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setFranchiseeStep(2)}
                        className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Back</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleNextFranchiseeStep}
                        className="px-6 py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-md shadow-indigo-500/25 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                      >
                        <span>Continue to File Upload</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* STEP 4: FILE UPLOAD */}
                {/* ========================================================= */}
                {franchiseeStep === 4 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                          <Upload className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold">Step 4 — File Upload</h3>
                          <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Upload identity, legal certificates, and center facility documentation</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Note: File size must be less than 100Kb</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {[
                        { key: 'photoUrl', label: 'photo (passport size)', icon: Camera },
                        { key: 'signatureUrl', label: 'Signature', icon: Edit },
                        { key: 'panCardUrl', label: 'Pan Card', icon: CreditCard },
                        { key: 'bankDetailsUrl', label: 'Bank Details', icon: Building },
                        { key: 'aadhaarCardUrl', label: 'Aadhaar Card', icon: ShieldCheck },
                        { key: 'premisesPhotoUrl', label: 'Premises Photo', icon: Camera },
                        { key: 'addressProofUrl', label: 'Address Proof (Electricity Bill/Telephone Bill)', icon: FileText },
                      ].map((item) => {
                        const ItemIcon = item.icon;
                        const isAttached = !!franchiseeForm[item.key];
                        const fileName = franchiseeForm[`${item.key}_name`] || 'Attached Document';
                        const fileSize = franchiseeForm[`${item.key}_size`] || '< 100 KB';

                        return (
                          <div
                            key={item.key}
                            className={`p-4 rounded-2xl border transition-all ${isAttached
                              ? isDarkMode ? 'bg-emerald-950/20 border-emerald-800/60' : 'bg-emerald-50/50 border-emerald-200'
                              : isDarkMode ? 'bg-slate-950/50 border-slate-800 hover:border-slate-700' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                              }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isAttached ? 'bg-emerald-500 text-white' : 'bg-indigo-500/10 text-indigo-500'
                                  }`}>
                                  <ItemIcon className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-xs font-bold truncate leading-tight capitalize">{item.label}</span>
                              </div>
                              {isAttached && (
                                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 shrink-0">
                                  ✓ Uploaded
                                </span>
                              )}
                            </div>

                            {/* Upload Area / Preview */}
                            {isAttached ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                  {franchiseeForm[item.key].startsWith('data:image') || franchiseeForm[item.key].startsWith('http') ? (
                                    <img src={franchiseeForm[item.key]} alt={item.label} className="w-9 h-9 object-cover rounded-lg border shrink-0" />
                                  ) : (
                                    <FileText className="w-6 h-6 text-indigo-500 shrink-0" />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold truncate">{fileName}</p>
                                    <p className="text-[10px] text-slate-400">{fileSize}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFranchiseeDoc(item.key)}
                                    className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                                    title="Remove File"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <label className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 transition cursor-pointer">
                                  <Upload className="w-5 h-5 text-slate-400 mb-1" />
                                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Choose File</span>
                                  <span className="text-[10px] text-slate-400">Image or PDF &lt; 100KB</span>
                                  <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(e) => handleFranchiseeDocUpload(e, item.key)}
                                    className="hidden"
                                  />
                                </label>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Step 4 Navigation */}
                    <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setFranchiseeStep(3)}
                        className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Back</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleNextFranchiseeStep}
                        className="px-6 py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-md shadow-indigo-500/25 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                      >
                        <span>Continue to Plan & Account</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* STEP 5: PLAN ALLOCATION & PORTAL ACCOUNT CREDENTIALS */}
                {/* ========================================================= */}
                {franchiseeStep === 5 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                    <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200 dark:border-slate-800">
                      <div className="w-8 h-8 rounded-xl bg-pink-500/10 text-pink-500 flex items-center justify-center font-bold">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold">Step 5 — Plan Allocation & Portal Credentials</h3>
                        <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Assign subscription package, set partner login password, and review registration summary</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Subscription Plan Picker */}
                      <div className="space-y-3">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                          Select Subscription Plan <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <select
                            value={franchiseeForm.planId}
                            onChange={e => setFranchiseeForm({ ...franchiseeForm, planId: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 shadow-xs transition-all appearance-none cursor-pointer focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                          >
                            {activePlansList.map(plan => (
                              <option key={plan.id} value={plan.id}>
                                {plan.name} — {plan.currency}{plan.price.toLocaleString()} {plan.billingPeriod} {plan.badge ? `(${plan.badge})` : ''}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute right-4 top-3.5 text-slate-400">▼</div>
                        </div>

                        {/* Plan Summary Card */}
                        {(() => {
                          const p = allPlansList.find(item => item.id === franchiseeForm.planId);
                          if (!p) return null;
                          return (
                            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-indigo-950/20 border-indigo-900/60' : 'bg-indigo-50/60 border-indigo-100'
                              } flex items-center justify-between`}>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-sm">{p.name}</span>
                                  {p.badge && (
                                    <span className="bg-indigo-500 text-white text-[10px] uppercase font-black px-2 py-0.5 rounded-full">
                                      {p.badge}
                                    </span>
                                  )}
                                </div>
                                <p className={`text-xs mt-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>
                                  Package Value: <strong className="text-base font-black">{p.currency}{p.price.toLocaleString()}</strong> {p.billingPeriod}
                                </p>
                              </div>
                              <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 font-bold">
                                Instant Activation
                              </span>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Portal Credentials */}
                      <div className="space-y-4 p-5 rounded-2xl border bg-slate-50/80 border-slate-200/90 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                          <Lock className="w-4 h-4 text-indigo-600" />
                          <span>Partner Portal Access Credentials</span>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                            Login Password <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type={showFranchiseePassword ? "text" : "password"}
                              required={!editingFranchiseeId}
                              placeholder="••••••••"
                              value={franchiseeForm.password}
                              onChange={e => setFranchiseeForm({ ...franchiseeForm, password: e.target.value })}
                              className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 shadow-xs transition-all focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                            />
                            <button
                              type="button"
                              onClick={() => setShowFranchiseePassword(!showFranchiseePassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                              title={showFranchiseePassword ? "Hide password" : "Show password"}
                            >
                              {showFranchiseePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                            Confirm Password <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type={showFranchiseePassword ? "text" : "password"}
                              required={!editingFranchiseeId}
                              placeholder="••••••••"
                              value={franchiseeForm.confirmPassword}
                              onChange={e => setFranchiseeForm({ ...franchiseeForm, confirmPassword: e.target.value })}
                              className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 shadow-xs transition-all focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                            />
                            <button
                              type="button"
                              onClick={() => setShowFranchiseePassword(!showFranchiseePassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                              title={showFranchiseePassword ? "Hide password" : "Show password"}
                            >
                              {showFranchiseePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                            GST / Registration ID (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 29XYZWV9876G2ZK"
                            value={franchiseeForm.gstId}
                            onChange={e => setFranchiseeForm({ ...franchiseeForm, gstId: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 shadow-xs transition-all focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Summary Overview Card */}
                    <div className="p-4 rounded-2xl border bg-slate-50/80 border-slate-200/90 text-slate-700 space-y-2 text-xs shadow-xs">
                      <div className="flex items-center justify-between font-bold text-sm text-slate-900 pb-1 border-b border-slate-200">
                        <span>Registration Overview</span>
                        <span className="text-indigo-600 font-mono text-xs">Ready to Commit</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Center Name:</span>
                          <span className="font-bold text-slate-900 truncate block">{franchiseeForm.centerName || franchiseeForm.firmName || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Owner:</span>
                          <span className="font-bold text-slate-900 truncate block">{franchiseeForm.ownerName || franchiseeForm.fullName || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Contact:</span>
                          <span className="font-bold text-slate-900 truncate block">{franchiseeForm.contactNumber || franchiseeForm.phone || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Email:</span>
                          <span className="font-bold text-slate-900 truncate block">{franchiseeForm.email || '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Step 5 Navigation & Form Actions */}
                    <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setFranchiseeStep(4)}
                        className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Back to Documents</span>
                      </button>

                      <div className="flex items-center gap-3">
                        {editingFranchiseeId && (
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all cursor-pointer"
                          >
                            Cancel Edit
                          </button>
                        )}

                        <button
                          type="submit"
                          onClick={handleSaveFranchisee}
                          disabled={isSavingFranchisee || activePlansList.length === 0}
                          className="px-8 py-3.5 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 hover:from-indigo-600 hover:to-purple-700 active:scale-95 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300 flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer"
                        >
                          {isSavingFranchisee ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>{editingFranchiseeId ? 'Updating Franchisee...' : 'Registering Franchisee...'}</span>
                            </>
                          ) : (
                            <>
                              {editingFranchiseeId ? <Edit className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}
                              <span>{editingFranchiseeId ? 'Update Franchisee Record' : 'Complete Registration & Onboard'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </form>

              {/* FRANCHISEES REGISTRY TABLE */}
              <div className={`p-6 rounded-3xl border backdrop-blur-md shadow-lg ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
                } space-y-4`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
                  <div>
                    <h3 className="text-lg font-extrabold tracking-tight">Active Franchisee Registry</h3>
                    <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Total registered institute partners: {franchisees.length}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {/* Manual Refresh / Sync Button */}
                    <button
                      type="button"
                      onClick={() => fetchFranchiseesFromFirestore(true)}
                      disabled={isRefreshingFranchisees}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${isDarkMode
                        ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm'
                        } ${isRefreshingFranchisees ? 'opacity-50 cursor-not-allowed' : 'active:scale-95 cursor-pointer'}`}
                      title="Sync franchisees with Firestore"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingFranchisees ? 'animate-spin text-rose-500' : 'text-slate-500'}`} />
                      <span>{isRefreshingFranchisees ? 'Syncing...' : 'Sync'}</span>
                    </button>

                    {/* Table Search */}
                    <div className="relative w-full sm:w-64">
                      <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search franchisee..."
                        value={franchiseeSearch}
                        onChange={e => setFranchiseeSearch(e.target.value)}
                        className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs border transition-all ${isDarkMode
                          ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600'
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                          }`}
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className={`uppercase font-bold tracking-wider ${isDarkMode ? 'bg-slate-950 text-slate-400 border-b border-slate-800' : 'bg-slate-100 text-slate-600 border-b border-slate-200'
                      }`}>
                      <tr>
                        <th className="px-4 py-3">ID & Partner</th>
                        <th className="px-4 py-3">Franchise & Location</th>
                        <th className="px-4 py-3">Contact</th>
                        <th className="px-4 py-3">Allocated Plan</th>
                        <th className="px-4 py-3 text-center">Payment</th>
                        <th className="px-4 py-3 text-center">Purchase</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filteredFranchisees.map(f => {
                        const isPaid = f.paymentStatus === 'Paid' || f.status === 'Active';
                        const isPurchased = f.purchaseStatus === 'Purchased' || f.status === 'Active';

                        return (
                          <tr key={f.id} className={`transition-colors ${isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'
                            }`}>
                            <td className="px-4 py-3">
                              <span className="font-mono font-bold text-indigo-500 block text-[11px]">{f.id}</span>
                              <span className="font-bold block">{f.fullName || f.ownerName}</span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block mt-0.5">
                                Reg: {getFranchiseeRegDate(f)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-semibold block">{f.franchiseName || f.centerName || f.firmName}</span>
                              <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{f.location || f.place || f.districtState || '—'}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="block">{f.email}</span>
                              <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{f.phone || f.contactNumber}</span>
                            </td>
                            <td className="px-4 py-3 font-semibold">
                              <span className={`px-2.5 py-1 rounded-lg font-bold inline-block border ${f.planId ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' : 'bg-slate-500/10 text-slate-500 border-slate-300'
                                }`}>
                                {f.planName || 'Not Selected'}
                              </span>
                            </td>
                            {/* Payment Status Column (Paid / Unpaid) */}
                            <td className="px-4 py-3 text-center font-bold">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-extrabold border ${isPaid
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                }`}>
                                {isPaid ? 'Paid' : 'Unpaid'}
                              </span>
                            </td>
                            {/* Purchase Status Column (Purchased / Not Purchased) */}
                            <td className="px-4 py-3 text-center font-bold">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-extrabold border ${isPurchased
                                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                }`}>
                                {isPurchased ? 'Purchased' : 'Not Purchased'}
                              </span>
                            </td>
                            {/* Status Badge (Clickable to Toggle Active / Inactive) */}
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleFranchiseeStatus(f)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border inline-flex items-center gap-1.5 cursor-pointer transition-all hover:scale-105 active:scale-95 ${f.status === 'Active'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                  : f.status === 'Inactive'
                                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                                  }`}
                                title="Click to toggle Active / Inactive status"
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${f.status === 'Active' ? 'bg-emerald-500 animate-pulse' : f.status === 'Inactive' ? 'bg-rose-500' : 'bg-amber-500'
                                  }`} />
                                <span>{f.status || 'Active'}</span>
                              </button>
                            </td>
                            {/* Actions Column (View, Status, Edit & Delete) */}
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {/* View Full Details Modal Button */}
                                <button
                                  type="button"
                                  onClick={() => setViewingFranchiseeDetails(f)}
                                  className="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500 text-sky-600 hover:text-white border border-sky-500/20 transition-all cursor-pointer shadow-sm"
                                  title="View Full Profile & Submitted Documents"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                {/* Status Toggle Power Button */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleFranchiseeStatus(f)}
                                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${f.status === 'Active'
                                    ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/30'
                                    : 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border-rose-500/30'
                                    }`}
                                  title={f.status === 'Active' ? "Click to set Inactive" : "Click to set Active"}
                                >
                                  <Power className="w-3.5 h-3.5" />
                                </button>

                                {/* Edit Button */}
                                <button
                                  type="button"
                                  onClick={() => handleEditFranchisee(f)}
                                  className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500 text-indigo-600 hover:text-white border border-indigo-500/20 transition-all cursor-pointer shadow-sm"
                                  title="Edit Franchisee Details"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>


                                {/* Delete Button (Disabled when Active) */}
                                <button
                                  type="button"
                                  disabled={f.status === 'Active'}
                                  onClick={() => onRequestDeleteFranchisee(f)}
                                  className={`p-1.5 rounded-lg border transition-all ${f.status === 'Active'
                                    ? 'opacity-30 bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700 cursor-not-allowed'
                                    : 'bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white border border-rose-500/30 cursor-pointer shadow-sm'
                                    }`}
                                  title={f.status === 'Active' ? "Delete disabled for Active franchisees. Toggle status to Inactive first." : "Delete Franchisee Record"}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {filteredFranchisees.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                            No franchisee records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* SCREEN: FRANCHISEE CERTIFICATE MANAGEMENT & UPLOAD */}
          {/* ========================================================= */}
          {activeMenu === 'franchisee-certificate' && (
            <div className="space-y-6 animate-in fade-in duration-300">

              {/* Header Info Banner - Pure Light Theme */}
              <div className="p-6 sm:p-7 rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-purple-50/30 to-white shadow-xs relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center border border-indigo-200">
                        <Award className="w-4 h-4 text-indigo-600" />
                      </div>
                      <span className="text-xs font-black uppercase tracking-wider text-indigo-800">
                        Authorization &amp; Accreditation
                      </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                      Franchisee Certificate Management
                    </h2>
                  </div>

                  {/* Summary Stats Badges - Light Theme */}
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <div className="px-4 py-2 rounded-2xl bg-white border border-slate-200 shadow-xs text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">Total Centers</span>
                      <span className="text-lg font-black text-slate-900">{franchisees.length}</span>
                    </div>
                    <div className="px-4 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                      <span className="text-[10px] uppercase font-bold text-emerald-700 block tracking-wider">Issued</span>
                      <span className="text-lg font-black text-emerald-700">
                        {franchisees.filter(f => f.franchiseCertificateUrl).length}
                      </span>
                    </div>
                    <div className="px-4 py-2 rounded-2xl bg-slate-100 border border-slate-200 text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-600 block tracking-wider">Pending Upload</span>
                      <span className="text-lg font-black text-slate-800">
                        {franchisees.filter(f => !f.franchiseCertificateUrl).length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Search and Filters Bar - Pure Light Theme */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={certSearchQuery}
                    onChange={(e) => setCertSearchQuery(e.target.value)}
                    placeholder="Search center, owner, city, or ID..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl text-xs sm:text-sm border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 transition focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  />
                  {certSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setCertSearchQuery('')}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                  {[
                    { id: 'all', label: `All (${franchisees.length})` },
                    { id: 'pending', label: `Pending Upload (${franchisees.filter(f => !f.franchiseCertificateUrl).length})` },
                    { id: 'issued', label: `Certificate Issued (${franchisees.filter(f => f.franchiseCertificateUrl).length})` },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setCertFilterStatus(tab.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${certFilterStatus === tab.id
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Franchisee Cards Grid - Pure Crisp Light Theme */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCertFranchisees.map(f => {
                  const hasCert = Boolean(f.franchiseCertificateUrl);
                  return (
                    <div
                      key={f.id}
                      className={`p-5 rounded-3xl border transition-all flex flex-col justify-between bg-white ${hasCert
                        ? 'border-emerald-200 shadow-xs hover:shadow-md'
                        : 'border-slate-200 shadow-xs hover:border-indigo-300 hover:shadow-md'
                        }`}
                    >
                      <div>
                        {/* Top Meta Bar */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-extrabold text-sm text-white shrink-0 shadow-xs ${hasCert ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600'
                              }`}>
                              {(f.franchiseName || f.centerName || f.fullName || 'F')[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-black text-slate-900 truncate">
                                {f.franchiseName || f.centerName || f.firmName || 'Training Center'}
                              </h4>
                              <p className="text-[11px] text-slate-500 truncate font-medium">
                                Owner: {f.ownerName || f.fullName || '—'}
                              </p>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase shrink-0 border ${hasCert
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border-amber-200'
                            }`}>
                            {hasCert ? 'Certificate Issued' : 'Pending Upload'}
                          </span>
                        </div>

                        {/* Location & ID Info - Clean Light Theme */}
                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 text-xs space-y-1.5 mb-3.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-semibold">Partner ID:</span>
                            <span className="font-mono font-bold text-indigo-600">{f.id}</span>
                          </div>
                          {(f.location || f.place) && (
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-500 font-semibold">Location:</span>
                              <span className="font-bold text-slate-800 truncate max-w-[150px]">{f.location || f.place}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-semibold">Allocated Plan:</span>
                            <span className="font-bold text-indigo-700 truncate max-w-[150px]">{f.planName || 'Standard Plan'}</span>
                          </div>
                        </div>

                        {/* Certificate Info / Upload Dropzone */}
                        {hasCert ? (
                          <div className="p-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 mb-3 space-y-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                onClick={() => handleOpenDocument(f.franchiseCertificateUrl, `Franchisee Certificate - ${f.franchiseName || f.centerName || f.fullName}`)}
                                className="w-12 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 cursor-pointer shadow-xs hover:scale-105 transition-transform"
                                title="Click to preview certificate"
                              >
                                {f.franchiseCertificateType === 'pdf' || f.franchiseCertificateUrl.startsWith('data:application/pdf') || f.franchiseCertificateUrl.toLowerCase().endsWith('.pdf') ? (
                                  <FileText className="w-6 h-6 text-indigo-600" />
                                ) : (
                                  <img src={f.franchiseCertificateUrl} alt="Cert" className="w-full h-full object-cover" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="text-xs font-bold text-slate-900 block truncate">
                                  {f.franchiseCertificateName || 'Official Franchisee Certificate'}
                                </span>
                                <span className="text-[10px] text-slate-500 block font-medium">
                                  Issued: {f.franchiseCertificateIssuedAt || 'Today'} {f.franchiseCertificateSize ? `• ${f.franchiseCertificateSize}` : ''}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 rounded-2xl border-2 border-dashed border-indigo-200/80 bg-indigo-50/30 mb-3 text-center space-y-1">
                            <Award className="w-6 h-6 text-indigo-600 mx-auto" />
                            <p className="text-xs font-bold text-slate-800">No Certificate Uploaded</p>
                            <p className="text-[10px] text-slate-500 font-medium">Upload PDF or Image to issue certificate to this partner</p>
                          </div>
                        )}
                      </div>

                      {/* Bottom Actions Bar */}
                      <div>
                        {hasCert ? (
                          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => handleOpenDocument(f.franchiseCertificateUrl, `Franchisee Certificate - ${f.franchiseName || f.centerName || f.fullName}`)}
                              className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDownloadDoc(f.franchiseCertificateUrl, `Franchisee_Certificate_${f.id}`)}
                              className="py-2 px-3 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                              title="Download certificate"
                            >
                              <Download className="w-3.5 h-3.5 text-slate-600" />
                              <span className="hidden sm:inline">Download</span>
                            </button>

                            {/* Replace File */}
                            <label className="p-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition flex items-center justify-center cursor-pointer" title="Replace certificate with new file">
                              <Upload className="w-3.5 h-3.5" />
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                disabled={isUploadingFranchiseCert}
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleUploadFranchiseCertificate(file, f);
                                }}
                              />
                            </label>

                            {/* Remove File */}
                            <button
                              type="button"
                              onClick={() => handleRemoveFranchiseCertificate(f)}
                              className="p-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-transparent transition cursor-pointer"
                              title="Remove Certificate"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-slate-100">
                            <label className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20 active:scale-95">
                              {isUploadingFranchiseCert ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>Uploading...</span>
                                </>
                              ) : (
                                <>
                                  <Upload className="w-4 h-4" />
                                  <span>Upload Certificate (PDF / Image)</span>
                                </>
                              )}
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                disabled={isUploadingFranchiseCert}
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleUploadFranchiseCertificate(file, f);
                                }}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {filteredCertFranchisees.length === 0 && (
                  <div className="col-span-full p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-xs">
                    <Award className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h4 className="text-base font-bold text-slate-800">No Franchisees Found</h4>
                    <p className="text-xs text-slate-500 mt-1">Try changing your search query or filter selection.</p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* SCREEN 2: SET PLANS */}
          {/* ========================================================= */}
          {activeMenu === 'set-plans' && (
            <div className="space-y-8 animate-in fade-in duration-300">

              {/* Header Banner */}
              <div className={`p-6 rounded-3xl border ${isDarkMode
                ? 'bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 border-slate-800'
                : 'bg-gradient-to-r from-purple-50 via-indigo-50 to-white border-purple-100'
                } shadow-sm`}>
                <h2 className="text-2xl font-black tracking-tight">Set Subscription Plans</h2>
                <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Customize tier pricing, features list, and toggle active/inactive states for franchisee allocations.
                </p>
              </div>

              {/* 3 PRICING CARDS IN RESPONSIVE GRID */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                {plans.map((plan) => {
                  const isPopular = plan.isPopular;

                  return (
                    <div
                      key={plan.id}
                      className={`relative rounded-3xl transition-all duration-300 flex flex-col justify-between p-6 ${isPopular
                        ? isDarkMode
                          ? 'bg-slate-900 border-2 border-indigo-500 shadow-2xl shadow-indigo-500/20 md:-translate-y-2'
                          : 'bg-white border-2 border-indigo-500 shadow-2xl shadow-indigo-500/15 md:-translate-y-2'
                        : isDarkMode
                          ? 'bg-slate-900/80 border border-slate-800 hover:border-slate-700 shadow-lg'
                          : 'bg-white border border-slate-200 hover:border-slate-300 shadow-md'
                        } ${!plan.active ? 'opacity-60 grayscale-[40%]' : ''}`}
                    >
                      {/* Popular Glowing Badge */}
                      {plan.badge && (
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 text-white font-extrabold text-[11px] uppercase tracking-wider px-3.5 py-1 rounded-full shadow-lg shadow-indigo-500/30 animate-pulse">
                          {plan.badge}
                        </div>
                      )}

                      <div className="space-y-6">

                        {/* Top Card Header & Active Toggle */}
                        <div className="flex items-start justify-between gap-3 pt-2">
                          <div>
                            <h3 className="text-xl font-black tracking-tight">{plan.name}</h3>
                            <span className={`text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              Duration: {plan.duration}
                            </span>
                          </div>

                          {/* Modern Ultra-Attractive Active / Inactive Toggle Button */}
                          <button
                            type="button"
                            onClick={() => handleTogglePlanActive(plan.id)}
                            className={`group relative flex items-center gap-2.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-300 cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 border ${plan.active
                              ? 'bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-400/40 shadow-emerald-500/10'
                              : 'bg-gradient-to-r from-rose-500/15 via-pink-500/10 to-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-400/40 shadow-rose-500/10'
                              }`}
                            title={`Click to switch plan state to ${plan.active ? 'Inactive' : 'Active'}`}
                          >
                            {/* Glowing Status Pulse Dot */}
                            <span className="relative flex h-2.5 w-2.5">
                              {plan.active && (
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              )}
                              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${plan.active ? 'bg-emerald-500' : 'bg-rose-500'
                                }`} />
                            </span>

                            {/* Label */}
                            <span className="uppercase text-[11px] font-extrabold tracking-wider">
                              {plan.active ? 'Active' : 'Inactive'}
                            </span>

                            {/* Smooth iOS Track & Sliding Pill */}
                            <div className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 flex items-center shadow-inner ${plan.active
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                              : 'bg-gradient-to-r from-slate-400 to-slate-500 dark:from-slate-700 dark:to-slate-800'
                              }`}>
                              <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-300 ${plan.active ? 'translate-x-4' : 'translate-x-0'
                                }`} />
                            </div>
                          </button>
                        </div>

                        {/* Customizable Price Section */}
                        <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                          } space-y-2`}>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Customizable Price ({plan.currency})
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-black text-indigo-500">{plan.currency}</span>
                            <input
                              type="number"
                              value={plan.price}
                              onChange={(e) => handleUpdatePlanPrice(plan.id, e.target.value)}
                              className={`w-full text-2xl font-black bg-transparent border-b-2 border-indigo-500/40 focus:border-indigo-500 focus:outline-none py-1 transition-all ${isDarkMode ? 'text-white' : 'text-slate-900'
                                }`}
                            />
                            <span className="text-xs font-semibold text-slate-400 self-end pb-1.5">
                              {plan.billingPeriod}
                            </span>
                          </div>
                        </div>

                        {/* Customizable Features Checkboxes / List */}
                        <div className="space-y-3">
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Included Features
                          </label>

                          <ul className="space-y-2 text-xs">
                            {plan.features.map((feature, fIdx) => (
                              <li
                                key={fIdx}
                                className={`flex items-start justify-between gap-2 p-2 rounded-xl border transition-colors ${isDarkMode ? 'bg-slate-950/60 border-slate-800/80' : 'bg-slate-50/80 border-slate-200/60'
                                  }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                                    <Check className="w-3 h-3" />
                                  </div>
                                  <span className="font-medium">{feature}</span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveFeature(plan.id, fIdx)}
                                  className="text-slate-400 hover:text-rose-500 transition-colors p-0.5"
                                  title="Remove feature tag"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </li>
                            ))}
                          </ul>

                          {/* Add New Feature Input */}
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="text"
                              placeholder="Add feature tag..."
                              value={newFeatureText[plan.id] || ''}
                              onChange={(e) => setNewFeatureText({ ...newFeatureText, [plan.id]: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddFeature(plan.id);
                                }
                              }}
                              className={`flex-1 px-3 py-1.5 rounded-xl text-xs border transition-all ${isDarkMode
                                ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500'
                                : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                                }`}
                            />
                            <button
                              type="button"
                              onClick={() => handleAddFeature(plan.id)}
                              className="px-3 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:bg-indigo-500 hover:text-white transition-all"
                            >
                              Add
                            </button>
                          </div>
                        </div>

                      </div>

                      {/* Card Footer Action Button */}
                      <div className="pt-6">
                        <button
                          onClick={() => handleSavePlanDetails(plan.id)}
                          disabled={plan.updating}
                          className={`w-full py-3 rounded-2xl text-xs font-extrabold transition-all duration-300 shadow-md flex items-center justify-center gap-2 active:scale-95 cursor-pointer ${isPopular
                            ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-indigo-500/25'
                            : isDarkMode
                              ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                              : 'bg-slate-900 hover:bg-slate-800 text-white'
                            }`}
                        >
                          {plan.updating ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Saving Details...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Update Plan Details</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* SCREEN 3: DEDICATED STUDENT APPLICATION CHARGES SCREEN */}
          {/* ========================================================= */}
          {activeMenu === 'student-application-charges' && (
            <div className="space-y-8 animate-in fade-in duration-300 max-w-4xl mx-auto">

              {/* Info Header Banner */}
              <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl relative overflow-hidden ${isDarkMode
                ? 'bg-gradient-to-r from-rose-950 via-slate-900 to-purple-950 border-rose-800/40 text-white'
                : 'bg-gradient-to-r from-rose-900 via-red-900 to-slate-900 border-rose-800 text-white'
                }`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      <CreditCard className="w-3.5 h-3.5" /> Dynamic Student Fee Control
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Student Application Charges Control</h2>
                    <p className="text-xs sm:text-sm text-rose-100/80">
                      Set the dynamic fee charged on the official Student Admission Application & Registration Fee modal.
                    </p>
                  </div>
                </div>
              </div>

              {/* 2-Column Side-by-Side Fee Configuration Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Column 1: General Student Registration Fee Configuration */}
                <form onSubmit={handleSavePricing} className={`p-6 sm:p-8 rounded-3xl border shadow-lg space-y-6 flex flex-col justify-between ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b pb-4 dark:border-slate-800 border-slate-200">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-rose-500" />
                        Student Registration Fee Configuration
                      </h3>
                      <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800">
                        General Form
                      </span>
                    </div>

                    <div className={`p-4 rounded-2xl border text-xs space-y-2 ${isDarkMode ? 'bg-slate-950/60 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}>
                      <p className="font-extrabold text-rose-500 flex items-center gap-1.5 text-sm">
                        <Sparkles className="w-4 h-4" /> Live Application Form Integration:
                      </p>
                      <p className="leading-relaxed">
                        Updating this value dynamically changes the fee displayed on the Student Application Form modal (<code className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono text-[11px]">/application-form</code>), registration receipt calculation, and Razorpay payment gateway amount in real-time.
                      </p>
                    </div>

                    {/* Student Application Fee Input */}
                    <div className="space-y-2 pt-2">
                      <label className={`block text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'
                        }`}>
                        Student Application Fee / Registration Charge (₹):
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-3.5 text-slate-400 font-bold text-base">₹</span>
                        <input
                          type="number"
                          min="0"
                          value={standardFee}
                          onChange={(e) => setStandardFee(e.target.value)}
                          required
                          className={`w-full pl-9 pr-4 py-3.5 rounded-2xl border font-black text-xl focus:outline-none focus:ring-2 focus:ring-rose-500/30 transition-all ${isDarkMode
                            ? 'bg-slate-950 border-slate-800 text-rose-400 focus:border-rose-500'
                            : 'bg-slate-50 border-slate-300 text-rose-600 focus:border-rose-500'
                            }`}
                        />
                      </div>
                      <p className="text-xs text-slate-500">Default standard charge is ₹500.</p>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="pt-6">
                    <button
                      type="submit"
                      disabled={isSavingPricing}
                      className="w-full py-4 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 shadow-xl shadow-rose-600/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                      {isSavingPricing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Save</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Column 2: Certificate Student Registration Fee Configuration */}
                <form onSubmit={handleSaveCertPricing} className={`p-6 sm:p-8 rounded-3xl border shadow-lg space-y-6 flex flex-col justify-between ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b pb-4 dark:border-slate-800 border-slate-200">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <Award className="w-5 h-5 text-amber-500" />
                        Certificate Student Registration Fee Configuration
                      </h3>
                      <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                        Certificate Form
                      </span>
                    </div>

                    <div className={`p-4 rounded-2xl border text-xs space-y-2 ${isDarkMode ? 'bg-slate-950/60 border-slate-800 text-slate-300' : 'bg-amber-50/60 border-amber-200 text-slate-700'
                      }`}>
                      <p className="font-extrabold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 text-sm">
                        <Sparkles className="w-4 h-4" /> Live Certificate Form Integration:
                      </p>
                      <p className="leading-relaxed">
                        Updating this value dynamically changes the fee displayed on the Certificate Admission Form (<code className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono text-[11px]">/certificate/admission-form</code>), payment checkout modal, and Razorpay gateway in real-time.
                      </p>
                    </div>

                    {/* Certificate Application Fee Input */}
                    <div className="space-y-2 pt-2">
                      <label className={`block text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'
                        }`}>
                        Certificate Student Admission Fee / Registration Charge (₹):
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-3.5 text-slate-400 font-bold text-base">₹</span>
                        <input
                          type="number"
                          min="0"
                          value={certStandardFee}
                          onChange={(e) => setCertStandardFee(e.target.value)}
                          required
                          className={`w-full pl-9 pr-4 py-3.5 rounded-2xl border font-black text-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all ${isDarkMode
                            ? 'bg-slate-950 border-slate-800 text-amber-400 focus:border-amber-500'
                            : 'bg-slate-50 border-slate-300 text-amber-700 focus:border-amber-500'
                            }`}
                        />
                      </div>
                      <p className="text-xs text-slate-500">Configures the official registration fee for students enrolling in Certificate Courses.</p>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="pt-6">
                    <button
                      type="submit"
                      disabled={isSavingCertPricing}
                      className="w-full py-4 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-amber-600 via-rose-600 to-rose-700 hover:from-amber-700 hover:to-rose-800 shadow-xl shadow-amber-600/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                      {isSavingCertPricing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Save</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* SCREEN 4: FRANCHISEE FEE & PRICING SETTINGS */}
          {/* ========================================================= */}
          {activeMenu === 'pricing-settings' && (
            <div className="space-y-8 animate-in fade-in duration-300 max-w-4xl mx-auto">

              {/* Info Header Banner */}
              <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl relative overflow-hidden ${isDarkMode
                ? 'bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border-emerald-800/40 text-white'
                : 'bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 border-emerald-800 text-white'
                }`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <DollarSign className="w-3.5 h-3.5" /> Franchisee Pricing Control
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Franchisee Onboarding Fee Settings</h2>
                    <p className="text-xs sm:text-sm text-emerald-100/80">
                      Control the initial onboarding fee for first-time franchisees dynamically.
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Card */}
              <form onSubmit={handleSavePricing} className={`p-6 sm:p-8 rounded-3xl border shadow-lg space-y-6 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                }`}>

                <h3 className="text-lg font-bold flex items-center gap-2 border-b pb-4 dark:border-slate-800 border-slate-200">
                  <Settings className="w-5 h-5 text-indigo-500" />
                  Franchisee Fee Configuration
                </h3>

                {/* Explanation Alert Card */}
                <div className={`p-4 rounded-2xl border text-xs space-y-2 ${isDarkMode ? 'bg-slate-950/60 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}>
                  <p className="font-extrabold text-emerald-500 flex items-center gap-1.5 text-sm">
                    <Sparkles className="w-4 h-4" /> First-Time Franchisee 1-Year Subscription Policy:
                  </p>
                  <p className="leading-relaxed">
                    First-Time Franchisee onboarding fee includes 1 Year (365 Days) full portal access. Once the 1-year plan ends, franchisees renew their subscription using the customizable renewable Subscription Plans.
                  </p>
                </div>

                <div className="pt-2">

                  {/* First-Time Franchisee Fee Input */}
                  <div className="space-y-2 max-w-md">
                    <label className={`block text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'
                      }`}>
                      First-Time Franchisee Onboarding Fee (₹):
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-3 text-slate-400 font-bold text-sm">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={firstTimeFee}
                        onChange={(e) => setFirstTimeFee(e.target.value)}
                        required
                        className={`w-full pl-8 pr-4 py-3 rounded-2xl border font-black text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all ${isDarkMode
                          ? 'bg-slate-950 border-slate-800 text-emerald-400 focus:border-emerald-500'
                          : 'bg-slate-50 border-slate-300 text-emerald-600 focus:border-emerald-500'
                          }`}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">Default: ₹20,000 for first-time franchisee 1-year onboarding.</p>
                  </div>

                </div>

                {/* Save Pricing Button */}
                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingPricing}
                    className="px-8 py-3.5 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-xl shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-70"
                  >
                    {isSavingPricing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Updating Pricing...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Save Franchisee Fee Settings</span>
                      </>
                    )}
                  </button>
                </div>

              </form>
            </div>
          )}

          {/* ========================================================= */}
          {/* SCREEN 4: BRANCHWISE STUDENTS ANALYTICS & REGISTRY */}
          {/* ========================================================= */}
          {activeMenu === 'branchwise-students' && (
            <div className="animate-in fade-in duration-300">
              <BranchwiseStudents isDarkMode={isDarkMode} showToast={showToast} />
            </div>
          )}

          {/* ========================================================= */}
          {/* SCREEN: CERTIFICATE STUDENTS REGISTRY */}
          {/* ========================================================= */}
          {activeMenu === 'certificate-students' && (
            <div className="animate-in fade-in duration-300">
              <BranchwiseStudents isDarkMode={isDarkMode} showToast={showToast} defaultCertMode={true} />
            </div>
          )}

          {/* ========================================================= */}
          {/* SCREEN: PAYMENT TRANSACTIONS & AUDIT LEDGER */}
          {/* ========================================================= */}
          {activeMenu === 'payment-transactions' && (
            <div className="animate-in fade-in duration-300">
              <AdminPaymentTransactions isDarkMode={isDarkMode} showToast={showToast} branches={branches} />
            </div>
          )}

          {/* ========================================================= */}
          {/* SCREEN: PENDING PAYMENTS MONITOR */}
          {/* Shows students who started filling the form, paid on Razorpay, */}
          {/* but whose browser closed before finalization — data is safe here. */}
          {/* Admin can manually activate or dismiss these records. */}
          {/* ========================================================= */}
          {activeMenu === 'pending-payments' && (
            <PendingPaymentsMonitor isDarkMode={isDarkMode} showToast={showToast} db={db} />
          )}

          {/* ========================================================= */}
          {/* SCREEN 5: MANAGE BRANCHES (DYNAMIC ADD / DELETE) */}
          {/* ========================================================= */}
          {activeMenu === 'manage-branches' && (
            <div className="space-y-8 animate-in fade-in duration-300">

              {/* Header Banner */}
              <div className={`p-6 sm:p-8 rounded-3xl border ${isDarkMode
                ? 'bg-gradient-to-r from-slate-900 via-rose-950/40 to-slate-900 border-slate-800'
                : 'bg-gradient-to-r from-rose-50 via-pink-50 to-white border-rose-100'
                } shadow-sm relative overflow-hidden`}>
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
                        <Building className="w-6 h-6" />
                      </span>
                      <h2 className="text-2xl font-black tracking-tight">Branch Management & Directory</h2>
                    </div>
                    <p className={`text-sm mt-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Dynamically add new branches or delete existing locations. All changes update the admission form and branch analytics in real time.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-500 px-3.5 py-1.5 rounded-full text-xs font-bold">
                    <Sparkles className="w-4 h-4" />
                    <span>Live Sync Active</span>
                  </div>
                </div>
              </div>

              {/* Quick Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Total Branches */}
                <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
                  } shadow-sm backdrop-blur-md space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Branches</span>
                    <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                      <MapPin className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black">{branches.length}</div>
                  <p className="text-[11px] text-slate-500">Active across admission forms</p>
                </div>

                {/* 2. Core Default Branches */}
                <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
                  } shadow-sm backdrop-blur-md space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Core Defaults</span>
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                      <Building className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black">{branches.filter(b => b.isDefault).length}</div>
                  <p className="text-[11px] text-slate-500">Preserved original branches</p>
                </div>

                {/* 3. Custom Dynamic Branches */}
                <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
                  } shadow-sm backdrop-blur-md space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Custom Added</span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                      <PlusCircle className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black">{branches.filter(b => !b.isDefault).length}</div>
                  <p className="text-[11px] text-slate-500">Added dynamically by Admin</p>
                </div>
              </div>

              {/* Add New Branch Interactive Card */}
              <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl backdrop-blur-md ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
                } space-y-6 transition-all`}>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold">
                      <Plus className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">Add New Branch Location</h3>
                      <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Enter the city, town, or center name to dynamically make it available in the admission portal.
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleAddBranch} className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <MapPin className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. Mudhol Center, Bangalore South, Jamakhandi..."
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-rose-500/50 ${isDarkMode
                        ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-rose-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-rose-500'
                        }`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isAddingBranch || !newBranchName.trim()}
                    className="px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 shadow-lg shadow-rose-600/30 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {isAddingBranch ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Adding...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Add Branch</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Branches Directory Listing Card */}
              <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl backdrop-blur-md ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
                } space-y-6 transition-all`}>

                {/* Search & Filter Toolbar */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold">
                      <Layers className="w-4 h-4" />
                    </div>
                    <h3 className="text-lg font-bold">
                      Active Branches Directory ({filteredBranches.length})
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Search Input */}
                    <div className="relative flex-1 md:w-64">
                      <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search branches..."
                        value={branchSearch}
                        onChange={(e) => setBranchSearch(e.target.value)}
                        className={`w-full pl-10 pr-4 py-2 rounded-xl text-xs border transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode
                          ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500'
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                          }`}
                      />
                    </div>

                    {/* Filter Pills */}
                    <div className={`flex items-center p-1 rounded-xl border ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
                      }`}>
                      <button
                        type="button"
                        onClick={() => setBranchFilter('all')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${branchFilter === 'all'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        All ({branches.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setBranchFilter('default')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${branchFilter === 'default'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        Defaults ({branches.filter(b => b.isDefault).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setBranchFilter('custom')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${branchFilter === 'custom'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        Custom ({branches.filter(b => !b.isDefault).length})
                      </button>
                    </div>
                  </div>
                </div>

                {/* Branches Grid */}
                {filteredBranches.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-500/10 text-slate-400 mx-auto flex items-center justify-center">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-500">No branches match your search or filter.</p>
                    {branchSearch && (
                      <button
                        type="button"
                        onClick={() => setBranchSearch('')}
                        className="text-xs text-rose-500 font-bold hover:underline cursor-pointer"
                      >
                        Clear Search
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                    {filteredBranches.map((b) => (
                      <div
                        key={b.id || b.name}
                        className={`group p-4 rounded-2xl border transition-all duration-200 relative ${isDarkMode
                          ? 'bg-slate-950/60 border-slate-800/80 hover:border-rose-500/50 hover:bg-slate-900'
                          : 'bg-slate-50/80 border-slate-200/80 hover:border-rose-400 hover:bg-white hover:shadow-md'
                          }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                              <MapPin className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold truncate" title={b.name}>
                                {b.name}
                              </h4>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.isDefault
                                  ? isDarkMode
                                    ? 'bg-slate-800 text-slate-300 border border-slate-700'
                                    : 'bg-slate-200 text-slate-700'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                  }`}>
                                  {b.isDefault ? 'Core Default' : 'Custom Added'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons: Edit & Delete */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditBranch(b)}
                              className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                              title={`Edit ${b.name} branch`}
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setBranchDeleteTarget(b)}
                              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title={`Delete ${b.name} branch`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* SCREEN 6: MANAGE COURSES (DYNAMIC ADD / EDIT / DELETE) */}
          {/* ========================================================= */}
          {activeMenu === 'manage-courses' && (
            <div className="space-y-8 animate-in fade-in duration-300">

              {/* Header Banner */}
              <div className={`p-6 sm:p-8 rounded-3xl border ${isDarkMode
                ? 'bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border-slate-800'
                : 'bg-gradient-to-r from-amber-50 via-orange-50 to-white border-amber-100'
                } shadow-sm relative overflow-hidden`}>
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                        <BookOpen className="w-6 h-6" />
                      </span>
                      <h2 className="text-2xl font-black tracking-tight">Course Management & Directory</h2>
                    </div>
                    <p className={`text-sm mt-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Dynamically add new courses, update names, or delete existing courses. All changes update student application forms across the entire portal in real time.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 px-3.5 py-1.5 rounded-full text-xs font-bold">
                    <Sparkles className="w-4 h-4" />
                    <span>Live Sync Active</span>
                  </div>
                </div>
              </div>

              {/* Quick Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Total Courses */}
                <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
                  } shadow-sm backdrop-blur-md space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Courses</span>
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                      <BookOpen className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black">{courses.length}</div>
                  <p className="text-[11px] text-slate-500">Active in admission forms</p>
                </div>

                {/* 2. Core Default Courses */}
                <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
                  } shadow-sm backdrop-blur-md space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Core Defaults</span>
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black">{courses.filter(c => c.isDefault).length}</div>
                  <p className="text-[11px] text-slate-500">Preserved initial courses</p>
                </div>

                {/* 3. Custom Dynamic Courses */}
                <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
                  } shadow-sm backdrop-blur-md space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Custom Added</span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                      <PlusCircle className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black">{courses.filter(c => !c.isDefault).length}</div>
                  <p className="text-[11px] text-slate-500">Added dynamically by Admin</p>
                </div>
              </div>

              {/* Add New Dynamic Course Card Form */}
              <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl backdrop-blur-md ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
                } space-y-6 transition-all`}>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center font-bold shadow-md shadow-amber-500/20">
                      <Plus className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black tracking-tight">Add New Dynamic Course Card</h3>
                      <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Create a full course card with title, badge, description, and thumbnail image. It will immediately publish to the Website Landing Page and Admission Forms.
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleAddCourse} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                    {/* 1. Short Code / Course Name */}
                    <div className="space-y-1">
                      <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Course Code / Short Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. DCTTC, PGDCA, PYTHON..."
                        value={newCourseForm.name}
                        onChange={(e) => {
                          const newCode = e.target.value;
                          const oldAuto = getCourseDisplayLabel({ name: newCourseForm.name });
                          const isUnsetOrShort = !newCourseForm.title || newCourseForm.title === newCourseForm.name || newCourseForm.title === oldAuto;
                          setNewCourseForm({
                            ...newCourseForm,
                            name: newCode,
                            title: isUnsetOrShort ? (getCourseDisplayLabel({ name: newCode }) || newCode) : newCourseForm.title
                          });
                        }}
                        className={`w-full px-4 py-2.5 rounded-xl border text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${isDarkMode
                          ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-amber-500'
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500'
                          }`}
                      />
                    </div>

                    {/* 2. Full Course Title */}
                    <div className="space-y-1 md:col-span-2">
                      <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Full Course Title (Website Card Title) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. DCTTC — Diploma in Computer Teacher Training Course"
                        value={newCourseForm.title}
                        onChange={(e) => setNewCourseForm({ ...newCourseForm, title: e.target.value })}
                        className={`w-full px-4 py-2.5 rounded-xl border text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${isDarkMode
                          ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-amber-500'
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500'
                          }`}
                      />
                    </div>

                    {/* 3. Badge Tag */}
                    <div className="space-y-1 md:col-span-3">
                      <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Badge / Tag Label
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Job Ready, Teacher Special, Advanced..."
                        value={newCourseForm.badge}
                        onChange={(e) => setNewCourseForm({ ...newCourseForm, badge: e.target.value })}
                        className={`w-full px-4 py-2.5 rounded-xl border text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${isDarkMode
                          ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-amber-500'
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500'
                          }`}
                      />
                    </div>

                  </div>

                  {/* 6. Course Description */}
                  <div className="space-y-1">
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Course Overview Description (Displayed on Website Card)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Enter detailed description of syllabus, practical lab training, and outcomes..."
                      value={newCourseForm.description}
                      onChange={(e) => setNewCourseForm({ ...newCourseForm, description: e.target.value })}
                      className={`w-full px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none ${isDarkMode
                        ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-amber-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500'
                        }`}
                    />
                  </div>

                  {/* 7. Image URL & Upload */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Course Thumbnail Image
                      </label>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                        Upload Image File or Paste URL
                      </span>
                    </div>

                    <input
                      type="file"
                      ref={newCourseImageFileRef}
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadCourseImage(file, false);
                      }}
                      className="hidden"
                    />

                    <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                      {/* Upload Image Button */}
                      <button
                        type="button"
                        disabled={isUploadingNewCourseImage}
                        onClick={() => newCourseImageFileRef.current?.click()}
                        className="px-4 py-2.5 rounded-xl border text-xs font-extrabold bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700 transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer shrink-0 active:scale-95 disabled:opacity-50"
                      >
                        {isUploadingNewCourseImage ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Uploading Image...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            <span>Upload Image</span>
                          </>
                        )}
                      </button>

                      {/* Image URL Input */}
                      <input
                        type="url"
                        placeholder="https://images.unsplash.com/photo-..."
                        value={newCourseForm.image}
                        onChange={(e) => setNewCourseForm({ ...newCourseForm, image: e.target.value })}
                        className={`flex-1 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${isDarkMode
                          ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-amber-500'
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500'
                          }`}
                      />

                      {/* Image Preview */}
                      {newCourseForm.image && (
                        <div className="w-16 h-10 rounded-xl overflow-hidden border border-amber-400 dark:border-slate-700 shrink-0 bg-slate-100 shadow-sm">
                          <img src={newCourseForm.image} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                    {/* Quick Image Presets */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase">Quick Image Presets:</span>
                      <button
                        type="button"
                        onClick={() => setNewCourseForm({ ...newCourseForm, image: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=600' })}
                        className="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-500 hover:text-white transition"
                      >
                        🎓 Classroom
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewCourseForm({ ...newCourseForm, image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=600' })}
                        className="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-500 hover:text-white transition"
                      >
                        💻 Laptop & IT
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewCourseForm({ ...newCourseForm, image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=600' })}
                        className="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-500 hover:text-white transition"
                      >
                        📊 Finance & Tally
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewCourseForm({ ...newCourseForm, image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&q=80&w=600' })}
                        className="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-500 hover:text-white transition"
                      >
                        ⚡ Coding
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewCourseForm({ ...newCourseForm, image: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&q=80&w=600' })}
                        className="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-500 hover:text-white transition"
                      >
                        🎨 DTP & Graphic
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={isAddingCourse || (!newCourseForm.name.trim() && !newCourseForm.title.trim())}
                      className="px-6 py-3 rounded-xl text-xs font-black text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-lg shadow-amber-500/30 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {isAddingCourse ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Publishing Course Card...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Publish Course Card</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Courses Directory Listing Card */}
              <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl backdrop-blur-md ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
                } space-y-6 transition-all`}>

                {/* Search & Filter Toolbar */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                      <Layers className="w-4 h-4" />
                    </div>
                    <h3 className="text-lg font-bold">
                      Active Website Course Cards ({filteredCourses.length})
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Search Input */}
                    <div className="relative flex-1 md:w-64">
                      <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search courses..."
                        value={courseSearch}
                        onChange={(e) => setCourseSearch(e.target.value)}
                        className={`w-full pl-10 pr-4 py-2 rounded-xl text-xs border transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${isDarkMode
                          ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-amber-500'
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500'
                          }`}
                      />
                    </div>

                    {/* Filter Pills */}
                    <div className={`flex items-center p-1 rounded-xl border ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
                      }`}>
                      <button
                        type="button"
                        onClick={() => setCourseFilter('all')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${courseFilter === 'all'
                          ? 'bg-amber-500 text-white shadow-sm'
                          : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        All ({courses.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCourseFilter('default')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${courseFilter === 'default'
                          ? 'bg-amber-500 text-white shadow-sm'
                          : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        Defaults ({courses.filter(c => c.isDefault).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCourseFilter('custom')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${courseFilter === 'custom'
                          ? 'bg-amber-500 text-white shadow-sm'
                          : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        Custom ({courses.filter(c => !c.isDefault).length})
                      </button>
                    </div>
                  </div>
                </div>

                {/* Courses Cards Grid */}
                {filteredCourses.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-500/10 text-slate-400 mx-auto flex items-center justify-center">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-500">No courses match your search or filter.</p>
                    {courseSearch && (
                      <button
                        type="button"
                        onClick={() => setCourseSearch('')}
                        className="text-xs text-amber-500 font-bold hover:underline cursor-pointer"
                      >
                        Clear Search
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredCourses.map((c) => {
                      const displayTitle = getCourseDisplayLabel(c);
                      const displayBadge = c.badge || 'Professional';
                      const displayImg = c.image || 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=600';

                      return (
                        <div
                          key={c.id || c.name}
                          className="group rounded-2xl border border-slate-200/90 bg-white hover:border-amber-400 hover:shadow-xl shadow-md transition-all duration-300 overflow-hidden flex flex-col justify-between"
                        >
                          <div>
                            {/* Card Image Header */}
                            <div className="relative w-full h-36 bg-slate-100 overflow-hidden">
                              <img src={displayImg} alt={displayTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
                              <span className="absolute top-2.5 left-2.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-600 text-white shadow-md">
                                {displayBadge}
                              </span>
                            </div>

                            {/* Card Body */}
                            <div className="p-4 space-y-2.5 bg-white">
                              <h4 className="text-sm font-black text-slate-900 leading-snug line-clamp-2 min-h-[2.5rem]" title={displayTitle}>
                                {displayTitle}
                              </h4>
                              {c.description && (
                                <p className="text-xs text-slate-600 font-medium line-clamp-2 leading-relaxed">
                                  {c.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Card Footer Actions */}
                          <div className="p-3 border-t border-slate-200/90 flex items-center justify-between bg-slate-50">
                            <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border ${c.isDefault
                              ? 'bg-slate-100 text-slate-700 border-slate-300/80'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-300/80'
                              }`}>
                              {c.isDefault ? 'Core Default' : 'Custom Added'}
                            </span>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleStartEditCourse(c)}
                                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-300/80 hover:bg-amber-500 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                                title={`Edit ${c.name} course card`}
                              >
                                <Edit className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setCourseDeleteTarget(c)}
                                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-300/80 hover:bg-rose-600 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                                title={`Delete ${c.name} course card`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}

              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* SCREEN 7: ADD SUBJECT & MARKS (ARRAY FORMAT + DRAG & DROP) */}
          {/* ========================================================= */}
          {activeMenu === 'add-subject' && (
            <div className="space-y-8 animate-in fade-in duration-300">

              {/* Header Banner */}
              <div className={`p-6 sm:p-8 rounded-3xl border ${isDarkMode
                ? 'bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border-slate-800'
                : 'bg-gradient-to-r from-emerald-50 via-teal-50 to-white border-emerald-100'
                } shadow-sm relative overflow-hidden`}>
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                        <BookmarkCheck className="w-6 h-6" />
                      </span>
                      <h2 className="text-2xl font-black tracking-tight">Course Subjects & Marks Configuration</h2>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-3.5 py-1.5 rounded-full text-xs font-bold">
                    <Sparkles className="w-4 h-4" />
                    <span>Real-time Marksheet Sync</span>
                  </div>
                </div>
              </div>

              {/* Submenu: Course Selector Card */}
              <div className={`p-6 rounded-3xl border shadow-xl backdrop-blur-md ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
                } space-y-4`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold">Select Course / Program</h3>
                      <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Choose which course curriculum you want to customize.
                      </p>
                    </div>
                  </div>

                  <div className="w-full sm:w-72">
                    <select
                      value={selectedSubjectCourse}
                      onChange={(e) => setSelectedSubjectCourse(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer ${isDarkMode
                        ? 'bg-slate-950 border-slate-700 text-white focus:border-emerald-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500 focus:bg-white'
                        }`}
                    >
                      {(courses.length > 0 ? courses.map(c => c.name) : DEFAULT_COURSES).map(cName => (
                        <option key={cName} value={cName}>{getCourseDisplayLabel(cName)}</option>
                      ))}
                    </select>
                  </div>
                </div>

              </div>

              {/* Interactive Array Format Subjects List (with Drag and Drop Reordering) */}
              <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl backdrop-blur-md ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
                } space-y-6 transition-all`}>

                {/* Header & Controls Toolbar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                      <ListOrdered className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black tracking-tight flex items-center gap-1.5">
                        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{selectedSubjectCourse}</span>
                      </h3>
                      <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Drag rows up or down to reorder the sequence on marksheets.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleFetchExternalMarksFromQP}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold border border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-500/20 transition cursor-pointer flex items-center gap-1.5"
                      title="Auto-fetch external marks from Add Question Paper allocation"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Fetch Ext Marks from Question Paper</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResetCourseSubjects}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5"
                      title="Clear all subjects for this course"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Clear All</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleAddSubjectRow}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-600/25 active:scale-95 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Subject Row</span>
                    </button>
                  </div>
                </div>

                {/* Array Rows Listing */}
                {currentSubjects.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-500/10 text-slate-400 mx-auto flex items-center justify-center">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-500">No subjects added for this course yet.</p>
                    <button
                      type="button"
                      onClick={handleAddSubjectRow}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add First Subject</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Header labels */}
                    <div className="hidden sm:grid sm:grid-cols-12 gap-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <div className="col-span-1 text-center">Seq / Drag</div>
                      <div className="col-span-6">Subject Name / Paper Title</div>
                      <div className="col-span-2 text-center">Internal Marks</div>
                      <div className="col-span-2 text-center">External Marks</div>
                      <div className="col-span-1 text-center">Actions</div>
                    </div>

                    {/* Draggable Rows */}
                    {currentSubjects.map((subj, index) => {
                      const isDragged = draggedSubjectIdx === index;
                      const isDragOver = dragOverSubjectIdx === index;

                      return (
                        <div
                          key={subj.id || index}
                          draggable
                          onDragStart={(e) => handleDragStartSubject(e, index)}
                          onDragOver={(e) => handleDragOverSubject(e, index)}
                          onDrop={(e) => handleDropSubject(e, index)}
                          onDragEnd={handleDragEndSubject}
                          className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-150 relative flex flex-col sm:grid sm:grid-cols-12 gap-3 items-center ${isDragged
                            ? 'opacity-40 scale-95 border-dashed border-emerald-500'
                            : isDragOver
                              ? 'border-emerald-500 bg-emerald-500/10 shadow-lg scale-[1.01]'
                              : isDarkMode
                                ? 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                                : 'bg-slate-50/80 border-slate-200 hover:border-slate-300'
                            }`}
                        >
                          {/* Column 1: Drag Handle & Sequence Badge */}
                          <div className="col-span-1 w-full sm:w-auto flex items-center justify-between sm:justify-center gap-2">
                            <div
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 cursor-grab active:cursor-grabbing transition"
                              title="Drag to reorder sequence"
                            >
                              <GripVertical className="w-4 h-4" />
                            </div>
                            <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-xs flex items-center justify-center">
                              {index + 1}
                            </span>
                          </div>

                          {/* Column 2: Subject Name Input */}
                          <div className="col-span-6 w-full">
                            <input
                              type="text"
                              required
                              value={subj.name}
                              onChange={(e) => handleSubjectFieldChange(index, 'name', e.target.value)}
                              placeholder={`e.g. Subject ${index + 1} Title`}
                              className={`w-full px-3.5 py-2 rounded-xl text-xs font-semibold border transition focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${isDarkMode
                                ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-600 focus:border-emerald-500'
                                : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-emerald-500'
                                }`}
                            />
                          </div>

                          {/* Column 3: Internal Marks */}
                          <div className="col-span-2 w-full sm:w-auto">
                            <div className="flex items-center gap-1.5">
                              <span className="sm:hidden text-xs text-slate-400 font-bold">Int:</span>
                              <input
                                type="number"
                                min="0"
                                max="1000"
                                value={subj.intMax !== undefined ? subj.intMax : 40}
                                onChange={(e) => handleSubjectFieldChange(index, 'intMax', e.target.value)}
                                placeholder="Int (40)"
                                className={`w-full px-3 py-2 text-center rounded-xl text-xs font-mono font-bold border transition focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${isDarkMode
                                  ? 'bg-slate-900 border-slate-700 text-amber-400 focus:border-amber-500'
                                  : 'bg-white border-slate-300 text-amber-700 focus:border-amber-500'
                                  }`}
                                title="Internal Marks (default 40)"
                              />
                            </div>
                          </div>

                          {/* Column 4: External Marks */}
                          <div className="col-span-2 w-full sm:w-auto">
                            <div className="flex items-center gap-1.5">
                              <span className="sm:hidden text-xs text-slate-400 font-bold">Ext:</span>
                              <input
                                type="number"
                                min="0"
                                max="1000"
                                value={subj.extMax !== undefined ? subj.extMax : 60}
                                onChange={(e) => handleSubjectFieldChange(index, 'extMax', e.target.value)}
                                placeholder="Ext (60)"
                                className={`w-full px-3 py-2 text-center rounded-xl text-xs font-mono font-bold border transition focus:outline-none focus:ring-2 focus:ring-sky-500/40 ${isDarkMode
                                  ? 'bg-slate-900 border-slate-700 text-sky-400 focus:border-sky-500'
                                  : 'bg-white border-slate-300 text-sky-700 focus:border-sky-500'
                                  }`}
                                title="External Marks (default 60)"
                              />
                            </div>
                          </div>

                          {/* Column 5: Action Buttons (Move Up/Down, Duplicate, Delete) */}
                          <div className="col-span-1 w-full sm:w-auto flex items-center justify-end sm:justify-center gap-1">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => handleMoveSubjectRow(index, -1)}
                              className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-500/10 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={index === currentSubjects.length - 1}
                              onClick={() => handleMoveSubjectRow(index, 1)}
                              className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-500/10 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateSubjectRow(index)}
                              className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-500/10 transition cursor-pointer"
                              title="Duplicate Subject"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSubjectRow(index)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition cursor-pointer"
                              title="Delete Subject"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Bottom Actions & Save Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={handleAddSubjectRow}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Another Subject</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSavingSubjects || currentSubjects.length === 0}
                    onClick={handleSaveCourseSubjects}
                    className="w-full sm:w-auto px-7 py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 shadow-lg shadow-emerald-600/30 active:scale-95 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSavingSubjects ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving Configuration...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Save Subjects Configuration</span>
                      </>
                    )}
                  </button>
                </div>

              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* SCREEN 8: COMPOSITE QUESTION PAPER & EXAM CREATOR (Year -> Course -> Subject) */}
          {/* ========================================================================= */}
          {activeMenu === 'add-question-paper' && (
            <div className="space-y-8 animate-in fade-in duration-300">

              {/* Header Banner */}
              <div className={`p-4 sm:p-6 lg:p-8 rounded-3xl border ${isDarkMode
                ? 'bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border-slate-800'
                : 'bg-gradient-to-r from-cyan-50/80 via-sky-50 to-indigo-50/50 border-cyan-200/90 shadow-xs'
                } relative overflow-hidden`}>
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 w-full min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
                      <span className="p-2.5 sm:p-3 rounded-2xl bg-cyan-600 text-white shadow-md shadow-cyan-600/30 shrink-0 mt-0.5 sm:mt-0">
                        <FileQuestion className="w-5 h-5 sm:w-6 sm:h-6" />
                      </span>
                      <div className="min-w-0">
                        <h2 className={`text-lg sm:text-2xl font-black tracking-tight leading-snug ${isDarkMode ? 'text-white' : 'text-slate-950'
                          }`}>
                          Composite Question Paper & Exam Creator
                        </h2>
                        <p className={`text-xs font-bold mt-1 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'
                          }`}>
                          Set exam date, time slot, subject weightages, and auto-allocate marks smoothly.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewTargetPaper({
                          year: selectedPaperYear,
                          courseName: selectedPaperCourse,
                          examTitle: `${selectedPaperYear} - ${selectedPaperCourse} Examination`,
                          questions: paperQuestions,
                          totalMarks: paperQuestions.reduce((acc, q) => acc + (Number(q.marks) || 1), 0),
                          totalQuestions: paperQuestions.length
                        });
                        setIsPreviewPaperOpen(true);
                      }}
                      className="w-full sm:w-auto justify-center px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-black shadow-md shadow-indigo-600/25 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      <Printer className="w-4 h-4 text-white shrink-0" />
                      <span>Print / Preview Paper</span>
                    </button>
                    <div className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold shadow-xs w-full sm:w-auto ${isDarkMode
                      ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400'
                      : 'bg-cyan-100/90 border border-cyan-300/90 text-cyan-950'
                      }`}>
                      <Sparkles className={`w-4 h-4 shrink-0 ${isDarkMode ? 'text-cyan-400' : 'text-cyan-700'}`} />
                      <span>{paperQuestions.length} Questions • 1 Single Write</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* View Switcher Tabs: Creator vs Saved Exams Directory */}
              <div className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 p-1.5 rounded-2xl sm:rounded-full border w-full sm:w-auto max-w-full min-w-0 transition-all ${isDarkMode
                ? 'bg-slate-900 border-slate-800'
                : 'bg-slate-200/70 border-slate-300/80 shadow-inner'
                }`}>
                <button
                  type="button"
                  onClick={() => setQuestionPaperActiveTab('editor')}
                  className={`w-full sm:w-auto justify-center px-3.5 sm:px-5 py-2.5 rounded-xl sm:rounded-full text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${questionPaperActiveTab === 'editor'
                    ? isDarkMode
                      ? 'bg-gradient-to-r from-cyan-600 to-sky-600 text-white shadow-md'
                      : 'bg-white text-cyan-900 shadow-sm border border-slate-300/80 font-extrabold'
                    : isDarkMode
                      ? 'text-slate-400 hover:text-white'
                      : 'text-slate-700 hover:text-slate-950 font-bold'
                    }`}
                >
                  <FileQuestion className="w-4 h-4 text-cyan-600 shrink-0" />
                  <span>Question Paper Builder</span>
                </button>

                <button
                  type="button"
                  onClick={() => setQuestionPaperActiveTab('directory')}
                  className={`w-full sm:w-auto justify-center px-3.5 sm:px-5 py-2.5 rounded-xl sm:rounded-full text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${questionPaperActiveTab === 'directory'
                    ? isDarkMode
                      ? 'bg-gradient-to-r from-cyan-600 to-sky-600 text-white shadow-md'
                      : 'bg-white text-cyan-900 shadow-sm border border-slate-300/80 font-extrabold'
                    : isDarkMode
                      ? 'text-slate-400 hover:text-white'
                      : 'text-slate-700 hover:text-slate-950 font-bold'
                    }`}
                >
                  <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>All Published Exams ({allSavedPapersList.length})</span>
                </button>
              </div>

              {/* ========================================================================= */}
              {/* TAB 1: QUESTION PAPER BUILDER VIEW                                        */}
              {/* ========================================================================= */}
              {questionPaperActiveTab === 'editor' && (
                <div className="space-y-6">
                  {/* Step 1 & 2 & 3: Year, Course, and Subject Selectors Card */}
                  <div className={`p-4 sm:p-6 rounded-3xl border shadow-sm backdrop-blur-md ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
                    } space-y-5`}>

                    {/* Official Exam Title Field */}
                    <div className="space-y-1.5 pb-2 border-b border-slate-200/80 dark:border-slate-800">
                      <label className={`block text-xs font-black uppercase tracking-wider flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                        <span className="flex items-center gap-1.5 leading-tight">
                          <Edit className="w-4 h-4 text-cyan-600 shrink-0" />
                          <span>Official Exam Title (Shown on Hall Tickets & Published Exam Cards)</span>
                        </span>
                        <span className="text-[10px] font-extrabold text-cyan-700 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-500/10 px-2.5 py-0.5 rounded-md border border-cyan-200 dark:border-cyan-500/20 shrink-0">
                          Editable Title
                        </span>
                      </label>
                      <input
                        type="text"
                        value={selectedPaperExamTitle}
                        onChange={(e) => setSelectedPaperExamTitle(e.target.value)}
                        placeholder="e.g. 2026 - DCA Composite Examination"
                        className={`w-full px-4 py-2.5 rounded-xl border text-sm font-black transition focus:outline-none focus:ring-2 focus:ring-cyan-500/30 ${isDarkMode
                          ? 'bg-slate-950 border-slate-700 text-white focus:border-cyan-500'
                          : 'bg-slate-50/80 border-slate-300 text-slate-900 focus:border-cyan-500 focus:bg-white shadow-xs'
                          }`}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* 1. Select / Enter Academic Year */}
                      <div className="space-y-1.5">
                        <label className={`block text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                          <span className="w-5 h-5 rounded-full bg-cyan-600 text-white text-[10px] font-black flex items-center justify-center">1</span>
                          <span>Academic Year</span>
                        </label>
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            list="academic-year-suggestions"
                            value={selectedPaperYear}
                            onChange={(e) => setSelectedPaperYear(e.target.value)}
                            placeholder="e.g. 2026 or 2026-2027"
                            className={`w-full px-4 py-2.5 rounded-xl border text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-cyan-500/30 ${isDarkMode
                              ? 'bg-slate-950 border-slate-700 text-white focus:border-cyan-500'
                              : 'bg-slate-50/80 border-slate-300 text-slate-900 focus:border-cyan-500 focus:bg-white shadow-xs'
                              }`}
                          />
                          <datalist id="academic-year-suggestions">
                            <option value="2024" />
                            <option value="2025" />
                            <option value="2026" />
                            <option value="2027" />
                            <option value="2028" />
                            <option value="2029" />
                            <option value="2025-2026" />
                            <option value="2026-2027" />
                          </datalist>
                        </div>
                      </div>

                      {/* 2. Select Course */}
                      <div className="space-y-1.5">
                        <label className={`block text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                          <span className="w-5 h-5 rounded-full bg-cyan-600 text-white text-[10px] font-black flex items-center justify-center">2</span>
                          <span>Select Course / Program</span>
                        </label>
                        <select
                          value={selectedPaperCourse}
                          onChange={(e) => setSelectedPaperCourse(e.target.value)}
                          className={`w-full px-4 py-2.5 rounded-xl border text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-cyan-500/30 cursor-pointer ${isDarkMode
                            ? 'bg-slate-950 border-slate-700 text-white focus:border-cyan-500'
                            : 'bg-slate-50/80 border-slate-300 text-slate-900 focus:border-cyan-500 focus:bg-white shadow-xs'
                            }`}
                        >
                          {(courses.length > 0 ? courses.map(c => c.name) : DEFAULT_COURSES).map(cName => (
                            <option key={cName} value={cName}>{getCourseDisplayLabel(cName)}</option>
                          ))}
                        </select>
                      </div>

                      {/* 3. Select Subject for Adding Questions */}
                      <div className="space-y-1.5">
                        <label className={`block text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                          <span className="w-5 h-5 rounded-full bg-cyan-600 text-white text-[10px] font-black flex items-center justify-center">3</span>
                          <span>Current Target Subject</span>
                        </label>
                        <select
                          value={selectedPaperSubject}
                          onChange={(e) => setSelectedPaperSubject(e.target.value)}
                          className={`w-full px-4 py-2.5 rounded-xl border text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-cyan-500/30 cursor-pointer ${isDarkMode
                            ? 'bg-slate-950 border-slate-700 text-white focus:border-cyan-500'
                            : 'bg-slate-50/80 border-slate-300 text-slate-900 focus:border-cyan-500 focus:bg-white shadow-xs'
                            }`}
                        >
                          {availablePaperSubjects.length > 0 ? (
                            availablePaperSubjects.map((subj, idx) => (
                              <option key={subj.id || idx} value={subj.name}>
                                {idx + 1}. {subj.name}
                              </option>
                            ))
                          ) : (
                            <option value="">-- No subjects found for this course --</option>
                          )}
                        </select>
                      </div>
                    </div>

                    {/* 4. Exam Scheduled Date, Time, and Duration Controls (Managed by Admin) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-200/80 dark:border-slate-800">
                      {/* Date with Calendar & Presets */}
                      <div className={`space-y-3 p-4 rounded-2xl border ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-cyan-100 bg-gradient-to-br from-cyan-50/60 to-white shadow-xs'
                        }`}>
                        <div className="flex items-center justify-between">
                          <label className={`block text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                            <span>📅 Exam Scheduled Date:</span>
                          </label>
                          <span className="text-[10px] font-extrabold text-cyan-700 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-500/10 px-2.5 py-0.5 rounded-md border border-cyan-200 dark:border-cyan-500/20">
                            Hall Ticket Date
                          </span>
                        </div>

                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="text"
                            value={selectedPaperExamDate}
                            onChange={(e) => setSelectedPaperExamDate(e.target.value)}
                            placeholder="e.g. 2026 Feb, 8"
                            className={`flex-1 min-w-0 px-3 py-2 rounded-xl border text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-cyan-500/30 ${isDarkMode
                              ? 'bg-slate-950 border-slate-700 text-white focus:border-cyan-500'
                              : 'bg-white border-slate-300 text-slate-900 focus:border-cyan-500 shadow-xs'
                              }`}
                          />
                          <input
                            type="date"
                            onChange={(e) => {
                              if (e.target.value) {
                                const parts = e.target.value.split('-');
                                if (parts.length === 3) {
                                  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                  const mName = months[parseInt(parts[1], 10) - 1] || parts[1];
                                  setSelectedPaperExamDate(`${parts[0]} ${mName}, ${parseInt(parts[2], 10)}`);
                                }
                              }
                            }}
                            className={`shrink-0 max-w-[125px] sm:max-w-none px-2 py-2 rounded-xl border text-xs font-bold cursor-pointer transition ${isDarkMode ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-300 bg-white text-slate-800 shadow-xs hover:border-cyan-500'
                              }`}
                            title="Pick Date from Calendar"
                          />
                        </div>

                        {/* Quick Date Presets */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-200/60 dark:border-slate-800">
                          <span className={`text-[10px] font-black uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>Quick:</span>
                          {[
                            { label: 'Today', offset: 0 },
                            { label: 'Tomorrow', offset: 1 },
                            { label: 'Sunday', offset: ((7 - new Date().getDay()) % 7 || 7) },
                          ].map((preset, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                const d = new Date();
                                d.setDate(d.getDate() + preset.offset);
                                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                setSelectedPaperExamDate(`${d.getFullYear()} ${months[d.getMonth()]}, ${d.getDate()}`);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer active:scale-95 border ${isDarkMode
                                ? 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border-cyan-500/20'
                                : 'bg-white hover:bg-cyan-50 text-cyan-800 border-cyan-200 shadow-xs'
                                }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Time with Slot Presets */}
                      <div className={`space-y-3 p-4 rounded-2xl border ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-indigo-100 bg-gradient-to-br from-indigo-50/40 to-white shadow-xs'
                        }`}>
                        <div className="flex items-center justify-between">
                          <label className={`block text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                            <span>⏰ Exam Scheduled Time:</span>
                          </label>
                          <select
                            value={selectedPaperExamTime}
                            onChange={(e) => {
                              if (e.target.value) setSelectedPaperExamTime(e.target.value);
                            }}
                            className="text-xs font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1 rounded-xl border border-indigo-200 dark:border-indigo-500/20 focus:outline-none cursor-pointer max-w-[150px] truncate shadow-xs"
                          >
                            <option value="">⚡ Time Slots</option>
                            {[
                              '10:00 AM to 1:00 PM',
                              '10:00 AM to 12:00 PM',
                              '11:00 AM to 1:00 PM',
                              '02:00 PM to 5:00 PM',
                              '02:00 PM to 4:00 PM',
                              '09:00 AM to 12:00 PM',
                              '03:00 PM to 5:00 PM',
                            ].map((slot, sIdx) => (
                              <option key={sIdx} value={slot}>{slot}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={selectedPaperExamTime}
                            onChange={(e) => setSelectedPaperExamTime(e.target.value)}
                            placeholder="e.g. 10:00 AM to 1:00 PM or 11:00 AM - 1:00 PM"
                            className={`w-full px-3.5 py-2 rounded-xl border text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${isDarkMode
                              ? 'bg-slate-950 border-slate-700 text-white focus:border-indigo-500'
                              : 'bg-white border-slate-300 text-slate-900 focus:border-indigo-500 shadow-xs'
                              }`}
                          />
                        </div>

                        {/* Quick Time Slot Pills */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-200/60 dark:border-slate-800">
                          <span className={`text-[10px] font-black uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>Slots:</span>
                          {[
                            '10:00 AM to 1:00 PM',
                            '10:00 AM to 12:00 PM',
                            '02:00 PM to 5:00 PM',
                            '02:00 PM to 4:00 PM',
                          ].map((slot, sIdx) => (
                            <button
                              key={sIdx}
                              type="button"
                              onClick={() => setSelectedPaperExamTime(slot)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer active:scale-95 border ${selectedPaperExamTime === slot
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs font-black'
                                : isDarkMode
                                  ? 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border-indigo-500/20'
                                  : 'bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border-slate-200 shadow-xs'
                                }`}
                            >
                              {slot.replace(' to ', ' - ').replace(':00', '').replace(':00', '')}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 3. Allowed Exam Duration Card (Minutes) */}
                      <div className={`space-y-3 p-4 rounded-2xl border ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-emerald-100 bg-gradient-to-br from-emerald-50/40 to-white shadow-xs'
                        }`}>
                        <div className="flex items-center justify-between">
                          <label className={`block text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                            <span>⏱️ Allowed Exam Duration:</span>
                          </label>
                          <span className="text-[10px] font-extrabold text-emerald-800 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20">
                            Test Timer
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="15"
                            max="300"
                            value={selectedPaperExamDuration}
                            onChange={(e) => setSelectedPaperExamDuration(Math.max(1, parseInt(e.target.value, 10) || 120))}
                            className={`flex-1 px-3.5 py-2 rounded-xl border text-xs font-black transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${isDarkMode
                              ? 'bg-slate-950 border-slate-700 text-white focus:border-emerald-500'
                              : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500 shadow-xs'
                              }`}
                          />
                          <span className={`text-xs font-extrabold shrink-0 ${isDarkMode ? 'text-slate-400' : 'text-slate-800'}`}>Mins</span>
                        </div>

                        {/* Quick Duration Presets */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-200/60 dark:border-slate-800">
                          <span className={`text-[10px] font-black uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>Presets:</span>
                          {[
                            { label: '60 Min', mins: 60 },
                            { label: '90 Min', mins: 90 },
                            { label: '120 Min', mins: 120 },
                            { label: '180 Min', mins: 180 },
                          ].map((dPreset, dIdx) => (
                            <button
                              key={dIdx}
                              type="button"
                              onClick={() => setSelectedPaperExamDuration(dPreset.mins)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer active:scale-95 border ${selectedPaperExamDuration === dPreset.mins
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs font-black'
                                : isDarkMode
                                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                                  : 'bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border-slate-200 shadow-xs'
                                }`}
                            >
                              {dPreset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* LIVE SUBJECT QUESTIONS & MARKS ALLOCATION MATRIX */}
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400">
                              <Sparkles className="w-4 h-4" />
                            </span>
                            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-cyan-400">
                              Subject-Wise Question & Marks Allocation (Editable):
                            </h3>
                          </div>
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                            Edit question count and marks per question for each subject. Paper totals update instantly.
                          </p>
                        </div>
                        {availablePaperSubjects.length > 0 && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleReset100Questions}
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white text-xs font-black shadow-md shadow-cyan-600/25 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Reset 100 Qs / 200 Marks Balanced</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {Object.keys(subjectDistributionStats).length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {Object.entries(subjectDistributionStats).map(([subjName, stat], idx) => {
                            const isCurrent = selectedPaperSubject === subjName;
                            const THEMES = [
                              { gradient: 'from-cyan-600 to-sky-600', activeRing: 'ring-cyan-500/30' },
                              { gradient: 'from-blue-600 to-indigo-600', activeRing: 'ring-indigo-500/30' },
                              { gradient: 'from-purple-600 to-violet-600', activeRing: 'ring-purple-500/30' },
                              { gradient: 'from-emerald-600 to-teal-600', activeRing: 'ring-emerald-500/30' },
                              { gradient: 'from-amber-500 to-orange-500', activeRing: 'ring-amber-500/30' },
                              { gradient: 'from-rose-500 to-pink-600', activeRing: 'ring-rose-500/30' }
                            ];
                            const theme = THEMES[idx % THEMES.length];

                            return (
                              <div
                                key={idx}
                                onClick={() => setSelectedPaperSubject(subjName)}
                                className={`p-4 rounded-3xl border-2 transition-all duration-200 cursor-pointer space-y-3.5 ${isCurrent
                                  ? `border-cyan-500 ring-4 ${theme.activeRing} bg-white dark:from-cyan-950/30 dark:to-slate-900 shadow-md scale-[1.01]`
                                  : isDarkMode
                                    ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                                    : 'bg-white border-slate-200 hover:border-cyan-300 shadow-xs'
                                  }`}
                              >
                                {/* Gradient Header */}
                                <div className={`px-3.5 py-2.5 rounded-2xl bg-gradient-to-r ${theme.gradient} text-white flex items-center justify-between gap-1 shadow-sm`}>
                                  <span className="text-xs font-black uppercase tracking-wider truncate text-white" title={subjName}>
                                    {subjName}
                                  </span>
                                  {isCurrent ? (
                                    <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-white text-cyan-800 shadow-xs shrink-0 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 animate-pulse"></span>
                                      Active
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-white/90 shrink-0 bg-white/20 px-2 py-0.5 rounded-md">
                                      Select
                                    </span>
                                  )}
                                </div>

                                {/* Editable Question Count Stepper */}
                                <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Questions Count:
                                  </label>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleSetSubjectQuestionCount(subjName, Math.max(0, stat.count - 1))}
                                      className="w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-cyan-600 hover:text-white font-black text-sm flex items-center justify-center transition cursor-pointer shadow-xs active:scale-95"
                                      title="Decrease Question Count by 1"
                                    >
                                      -
                                    </button>

                                    <input
                                      type="number"
                                      min="0"
                                      max="200"
                                      value={stat.count}
                                      onChange={(e) => handleSetSubjectQuestionCount(subjName, e.target.value)}
                                      className={`w-full py-1.5 text-center font-black text-sm rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-cyan-500/30 ${isDarkMode
                                        ? 'bg-slate-950 border-slate-700 text-white'
                                        : 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white shadow-inner'
                                        }`}
                                    />

                                    <button
                                      type="button"
                                      onClick={() => handleSetSubjectQuestionCount(subjName, stat.count + 1)}
                                      className="w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-cyan-600 hover:text-white font-black text-sm flex items-center justify-center transition cursor-pointer shadow-xs active:scale-95"
                                      title="Increase Question Count by 1"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>

                                {/* Editable Marks Per Question Input & Subtotal */}
                                <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
                                  <div>
                                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                      Marks / Q:
                                    </label>
                                    <input
                                      type="number"
                                      min="1"
                                      max="50"
                                      value={stat.marksPerQ}
                                      onChange={(e) => handleSetSubjectMarksPerQuestion(subjName, e.target.value)}
                                      className={`w-full py-1.5 text-center font-black text-xs rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-cyan-500/30 ${isDarkMode
                                        ? 'bg-slate-950 border-slate-700 text-cyan-400'
                                        : 'bg-slate-50 border-slate-300 text-cyan-800 font-black focus:bg-white shadow-inner'
                                        }`}
                                    />
                                  </div>

                                  <div className="flex flex-col justify-end text-right">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subtotal:</span>
                                    <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 inline-block shadow-xs">
                                      {stat.totalMarks} Marks
                                    </span>
                                  </div>
                                </div>

                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className={`p-8 rounded-3xl border-2 border-dashed text-center space-y-3 ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-cyan-200 bg-cyan-50/40'
                          }`}>
                          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mx-auto">
                            <BookOpen className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">
                              No subjects configured for "{selectedPaperCourse}"
                            </h4>
                            <p className="text-xs font-bold text-slate-500 mt-1 max-w-md mx-auto">
                              Please add the curriculum subjects for this course under the <strong>"Add Subject"</strong> tab so questions can be mapped properly.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSubjectCourse(selectedPaperCourse);
                              setActiveMenu('add-subject');
                            }}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white text-xs font-bold shadow-md shadow-cyan-600/25 cursor-pointer inline-flex items-center gap-2 transition-all active:scale-95"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Go to Add Subject Module</span>
                          </button>
                        </div>
                      )}

                      {/* Total Allocation Progress Bar */}
                      <div className="pt-2">
                        <div className="flex flex-wrap items-center justify-between text-xs font-bold mb-1.5 gap-2">
                          <span className="text-slate-600 dark:text-slate-400 font-extrabold">Overall Paper Summary:</span>
                          <span className={`${paperQuestions.length === 100 ? 'text-emerald-600 font-black' : 'text-cyan-700 dark:text-cyan-400 font-black'}`}>
                            {paperQuestions.length} Questions ({paperQuestions.reduce((acc, q) => acc + (Number(q.marks) || 2), 0)} Total Marks)
                          </span>
                        </div>
                        <div className="w-full h-3 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden shadow-inner">
                          <div
                            className={`h-full transition-all duration-300 ${paperQuestions.length === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500'
                              }`}
                            style={{ width: `${Math.min(100, Math.round((paperQuestions.length / 100) * 100))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Main Questions Management Workspace */}
                  <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl backdrop-blur-md ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
                    } space-y-6`}>

                    {/* Header with Subject Filter & Quick Action Buttons */}
                    {(() => {
                      const batchSize = questionsPerPageMode === 10 ? 10 : 1;
                      const currentBatchPage = Math.ceil(currentQuestionPage / batchSize) || 1;
                      const totalBatchPages = Math.max(1, Math.ceil(paperQuestions.length / batchSize));
                      const batchStartIdx = (currentBatchPage - 1) * batchSize;
                      const batchEndIdx = Math.min(batchStartIdx + batchSize, paperQuestions.length);
                      const visibleQuestions = paperQuestions.slice(batchStartIdx, batchEndIdx);

                      return (
                        <>
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                              <span className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-mono font-black text-xs flex items-center justify-center border border-cyan-500/20 shadow-sm">
                                {questionsPerPageMode === 10 ? `Q${batchStartIdx + 1}-${batchEndIdx}` : `#${currentQuestionPage}`}
                              </span>
                              <div>
                                <h3 className="text-lg font-black tracking-tight flex items-center gap-2 flex-wrap">
                                  <span>
                                    {questionsPerPageMode === 10
                                      ? `Batch ${currentBatchPage}: Questions ${batchStartIdx + 1} to ${batchEndIdx} of ${paperQuestions.length || 1}`
                                      : `Question ${currentQuestionPage} of ${paperQuestions.length || 1}`}
                                  </span>
                                </h3>
                                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                  Type statement, fill 4 options, and click letter A/B/C/D to mark the correct answer key.
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
                              {/* View Mode Toggle: 10 Questions vs Single Question */}
                              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                                <button
                                  type="button"
                                  onClick={() => setQuestionsPerPageMode(10)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${questionsPerPageMode === 10
                                    ? 'bg-cyan-600 text-white shadow-sm'
                                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                                    }`}
                                >
                                  Fill 10 at a Time
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setQuestionsPerPageMode(1)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${questionsPerPageMode === 1
                                    ? 'bg-cyan-600 text-white shadow-sm'
                                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                                    }`}
                                >
                                  Single
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={handleAdd10Questions}
                                className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-600/25 active:scale-95 transition cursor-pointer flex items-center gap-1.5"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>+ Add 10 Slots</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleAddSingleQuestion}
                                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 transition cursor-pointer flex items-center gap-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>+ Slot</span>
                              </button>
                            </div>
                          </div>

                          {/* QUESTIONS EDITOR CARDS (10 Questions or Single) */}
                          {paperQuestions.length > 0 ? (
                            <div className="space-y-6">
                              {visibleQuestions.map((q, localIdx) => {
                                const globalIdx = batchStartIdx + localIdx;
                                const qNum = globalIdx + 1;
                                const isCorrectOpt = q.correctAnswer || 'A';

                                return (
                                  <div
                                    key={q.id || globalIdx}
                                    id={`question_card_${qNum}`}
                                    className={`p-5 sm:p-6 rounded-2xl border ${isDarkMode
                                      ? 'bg-slate-950/80 border-slate-800'
                                      : 'bg-slate-50/90 border-slate-200'
                                      } shadow-sm space-y-4 transition-all`}
                                  >
                                    {/* Question Card Header */}
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                                      <div className="flex items-center gap-2.5 flex-wrap">
                                        <span className="w-7 h-7 rounded-xl bg-cyan-600 text-white font-mono font-black text-xs flex items-center justify-center shadow-sm">
                                          #{qNum}
                                        </span>
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Subject:</span>
                                        <select
                                          value={q.subjectId || selectedPaperSubject}
                                          onChange={(e) => handleUpdateQuestion(globalIdx, { subjectId: e.target.value })}
                                          className={`px-2.5 py-1 rounded-xl text-xs font-bold border cursor-pointer ${isDarkMode ? 'bg-slate-900 border-slate-700 text-cyan-400' : 'bg-white border-slate-300 text-cyan-700 shadow-sm'
                                            }`}
                                        >
                                          {(availablePaperSubjects.length > 0 ? availablePaperSubjects.map(s => s.name) : (q.subjectId ? [q.subjectId] : [])).map(s => (
                                            <option key={s} value={s}>{s}</option>
                                          ))}
                                        </select>

                                        {/* Weightage */}
                                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-bold">
                                          <span>Marks:</span>
                                          <input
                                            type="number"
                                            min="1"
                                            max="50"
                                            value={q.marks || 2}
                                            onChange={(e) => handleUpdateQuestion(globalIdx, { marks: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                                            className={`w-10 py-0.5 text-center font-black rounded-lg border text-xs ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                                              }`}
                                          />
                                        </div>

                                        <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs border border-emerald-500/20">
                                          Key: Option ({isCorrectOpt})
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-1 self-end sm:self-auto">
                                        <button
                                          type="button"
                                          onClick={() => handleDuplicateQuestion(globalIdx)}
                                          className="px-2 py-1 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-cyan-500/10 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                          title="Duplicate question"
                                        >
                                          <Copy className="w-3.5 h-3.5" />
                                          <span>Duplicate</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleClearCurrentQuestion(globalIdx)}
                                          className="px-2 py-1 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-500/10 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                          title="Clear text"
                                        >
                                          <RotateCcw className="w-3.5 h-3.5" />
                                          <span>Clear</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteQuestion(globalIdx)}
                                          className="px-2 py-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                          title="Delete question slot"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                          <span>Delete</span>
                                        </button>
                                      </div>
                                    </div>

                                    {/* Question Textarea */}
                                    <div className="space-y-1.5">
                                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                        Question #{qNum} Statement / Prompt <span className="text-rose-500">*</span>
                                      </label>
                                      <textarea
                                        rows={2}
                                        value={q.question || ''}
                                        onChange={(e) => handleUpdateQuestion(globalIdx, { question: e.target.value })}
                                        placeholder={`Enter Question #${qNum} statement text here...`}
                                        className={`w-full p-3.5 rounded-xl text-xs sm:text-sm font-semibold border transition focus:outline-none focus:ring-2 focus:ring-cyan-500/40 leading-relaxed ${isDarkMode
                                          ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-600 focus:border-cyan-500'
                                          : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-cyan-500 shadow-sm'
                                          }`}
                                      />
                                    </div>

                                    {/* Answer Options Grid */}
                                    <div className="space-y-2">
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
                                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-tight">
                                          Answer Options (Click Letter to Set Correct Answer)
                                        </label>
                                        <span className="text-[11px] text-emerald-500 font-bold shrink-0">● Green button = Correct Answer</span>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {['A', 'B', 'C', 'D'].map((letter, optIdx) => {
                                          const optVal = (q.options && q.options[optIdx]) || '';
                                          const isCorrect = isCorrectOpt === letter;

                                          return (
                                            <div
                                              key={letter}
                                              className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${isCorrect
                                                ? 'bg-emerald-500/10 border-emerald-500/60 shadow-md ring-2 ring-emerald-500/20'
                                                : isDarkMode
                                                  ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                                                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                                                }`}
                                            >
                                              <button
                                                type="button"
                                                onClick={() => handleUpdateQuestion(globalIdx, { correctAnswer: letter })}
                                                className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 cursor-pointer transition ${isCorrect
                                                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 scale-105'
                                                  : isDarkMode
                                                    ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                  }`}
                                                title={`Set Option ${letter} as Correct Answer`}
                                              >
                                                {letter}
                                              </button>
                                              <input
                                                type="text"
                                                value={optVal}
                                                onChange={(e) => handleUpdateQuestionOption(globalIdx, optIdx, e.target.value)}
                                                placeholder={`Option ${letter} text...`}
                                                className={`w-full px-2.5 py-1 rounded-lg text-xs font-semibold border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-cyan-500/40 ${isDarkMode ? 'text-white placeholder-slate-600' : 'text-slate-900 placeholder-slate-400'
                                                  }`}
                                              />
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="p-12 text-center text-slate-400">
                              No questions in this examination paper yet. Click "Auto-Generate 100 Balanced Slots" or "+25 Questions" above.
                            </div>
                          )}

                          {/* PREVIOUS / NEXT BATCH NAVIGATION BAR */}
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 w-full min-w-0">

                            <button
                              type="button"
                              disabled={currentBatchPage <= 1}
                              onClick={() => {
                                const prevQPage = Math.max(1, (currentBatchPage - 2) * batchSize + 1);
                                setCurrentQuestionPage(prevQPage);
                              }}
                              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shadow-sm shrink-0"
                            >
                              <ChevronLeft className="w-4 h-4" />
                              <span>{questionsPerPageMode === 10 ? 'Previous 10 Questions' : 'Previous Question'}</span>
                            </button>

                            {/* JUMP TO BATCH / QUESTION SELECTOR */}
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 w-full sm:w-auto min-w-0">
                              <span className="text-xs font-bold text-slate-500 shrink-0 whitespace-nowrap">{questionsPerPageMode === 10 ? 'Batch Page:' : 'Jump to:'}</span>
                              {questionsPerPageMode === 10 ? (
                                <select
                                  value={currentBatchPage}
                                  onChange={(e) => {
                                    const bNum = Number(e.target.value);
                                    setCurrentQuestionPage((bNum - 1) * 10 + 1);
                                  }}
                                  className={`w-full sm:w-auto max-w-full min-w-0 truncate px-2.5 sm:px-4 py-2 rounded-xl border text-xs font-bold font-mono cursor-pointer ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800 shadow-sm'
                                    }`}
                                >
                                  {Array.from({ length: totalBatchPages }, (_, i) => i + 1).map((bNum) => {
                                    const bStart = (bNum - 1) * 10 + 1;
                                    const bEnd = Math.min(bNum * 10, paperQuestions.length);
                                    const bSlice = paperQuestions.slice(bStart - 1, bEnd);
                                    const filledCount = bSlice.filter(q => q.question && q.question.trim()).length;
                                    return (
                                      <option key={bNum} value={bNum}>
                                        Batch #{bNum}: Q{bStart} - Q{bEnd} ({filledCount}/{bSlice.length} filled)
                                      </option>
                                    );
                                  })}
                                </select>
                              ) : (
                                <select
                                  value={currentQuestionPage}
                                  onChange={(e) => setCurrentQuestionPage(Number(e.target.value))}
                                  className={`w-full sm:w-auto max-w-full min-w-0 truncate px-2.5 sm:px-4 py-2 rounded-xl border text-xs font-bold font-mono cursor-pointer ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800 shadow-sm'
                                    }`}
                                >
                                  {Array.from({ length: paperQuestions.length || 1 }, (_, i) => i + 1).map((num) => (
                                    <option key={num} value={num}>
                                      Question #{num} ({paperQuestions[num - 1]?.subjectId || 'Q'}) {paperQuestions[num - 1]?.question ? '✓' : '(empty)'}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>

                            <button
                              type="button"
                              disabled={currentBatchPage >= totalBatchPages}
                              onClick={() => {
                                const nextQPage = Math.min(paperQuestions.length, currentBatchPage * batchSize + 1);
                                setCurrentQuestionPage(nextQPage);
                              }}
                              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shadow-sm shrink-0"
                            >
                              <span>{questionsPerPageMode === 10 ? 'Next 10 Questions' : 'Next Question'}</span>
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </>
                      );
                    })()}

                    {/* 1 TO 100 QUESTION PALETTE JUMP GRID */}
                    <div className="space-y-2 pt-2">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 text-xs">
                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">
                          Quick Question Navigator (1 to {paperQuestions.length}):
                        </span>
                        <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-400">
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Filled</span>
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700"></span> Blank</span>
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span> Active</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 max-h-48 overflow-y-auto grid grid-cols-5 sm:grid-cols-10 md:grid-cols-20 gap-1.5 text-center">
                        {Array.from({ length: paperQuestions.length }, (_, i) => i + 1).map((qNum) => {
                          const isCurrent = currentQuestionPage === qNum;
                          const hasText = paperQuestions[qNum - 1]?.question?.trim();

                          return (
                            <button
                              key={qNum}
                              type="button"
                              onClick={() => setCurrentQuestionPage(qNum)}
                              className={`w-7 h-7 rounded-lg text-[11px] font-mono font-bold transition flex items-center justify-center cursor-pointer ${isCurrent
                                ? 'bg-cyan-600 text-white ring-2 ring-cyan-400 shadow-sm scale-110 z-10'
                                : hasText
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                                  : isDarkMode
                                    ? 'bg-slate-800/80 text-slate-400 hover:bg-slate-700'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              title={`Question #${qNum} [${paperQuestions[qNum - 1]?.subjectId || 'Subj'}] ${hasText ? '(Filled)' : '(Blank)'}`}
                            >
                              {qNum}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Final Create Question Paper & Generate Link Bar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                      <p className="text-xs text-slate-500">
                        Total Questions: <strong className="text-cyan-500 font-bold">{paperQuestions.length} Questions</strong> • <strong className="text-indigo-500 font-bold">{paperQuestions.reduce((acc, q) => acc + (Number(q.marks) || 2), 0)} / 200 Marks</strong>
                      </p>

                      <button
                        type="button"
                        disabled={isSavingPaper || paperQuestions.length === 0}
                        onClick={handleSaveCompositeExam}
                        className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 shadow-lg shadow-emerald-600/30 active:scale-95 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isSavingPaper ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Creating Question Paper & Saving to Database...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Create Question Paper & Generate Exam Link (200 Marks)</span>
                          </>
                        )}
                      </button>
                    </div>

                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* TAB 2: ALL SAVED COMPOSITE EXAMS DIRECTORY VIEW                           */}
              {/* ========================================================================= */}
              {questionPaperActiveTab === 'directory' && (
                <div className="space-y-6">
                  {/* Search Toolbar */}
                  <div className={`p-6 rounded-3xl border shadow-xl backdrop-blur-md ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
                    } flex flex-col sm:flex-row items-center justify-between gap-4`}>
                    <div className="relative w-full sm:w-80">
                      <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={paperDirectorySearch}
                        onChange={(e) => setPaperDirectorySearch(e.target.value)}
                        placeholder="Search published exams by year or course..."
                        className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-semibold border transition focus:outline-none focus:ring-2 focus:ring-cyan-500/40 ${isDarkMode
                          ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-600 focus:border-cyan-500'
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-cyan-500'
                          }`}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setQuestionPaperActiveTab('editor')}
                      className="px-5 py-2.5 rounded-xl bg-cyan-600 text-white text-xs font-bold hover:bg-cyan-700 transition flex items-center gap-2 cursor-pointer shadow-md shadow-cyan-600/20 shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create New Examination</span>
                    </button>
                  </div>

                  {/* Saved Exams Grid */}
                  {filteredSavedPapers.length === 0 ? (
                    <div className={`p-12 text-center rounded-3xl border ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
                      } space-y-4`}>
                      <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 text-cyan-500 mx-auto flex items-center justify-center">
                        <FileQuestion className="w-8 h-8" />
                      </div>
                      <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                        {allSavedPapersList.length === 0 ? 'No Published Examinations Yet' : 'No Examinations Found'}
                      </h4>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        {allSavedPapersList.length === 0
                          ? 'Select Year and Course in the Builder, add questions across subjects, and click "Create Question Paper & Generate Exam Link".'
                          : 'Try changing your search terms.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setQuestionPaperActiveTab('editor')}
                        className="px-5 py-2.5 rounded-xl bg-cyan-600 text-white text-xs font-bold hover:bg-cyan-700 transition cursor-pointer inline-flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Open Builder</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {filteredSavedPapers.map((p) => {
                        const totalQuestions = p.questions?.length || p.totalQuestions || 100;
                        const totalMarks = p.totalMarks || totalQuestions;
                        const yr = p.year || '2026';
                        const crs = p.course || p.courseName || 'Course';
                        const examLinkUrl = `${window.location.origin}/exam/${p.id || getExamDocId(yr, crs)}`;

                        return (
                          <div
                            key={p.id || `${yr}_${crs}`}
                            className={`p-6 rounded-3xl border transition-all duration-200 space-y-5 ${isDarkMode
                              ? 'bg-slate-900/90 border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900'
                              : 'bg-white border-slate-200/90 hover:border-cyan-400 shadow-sm hover:shadow-xl'
                              }`}
                          >
                            {/* Card Header */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <span className={`px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${isDarkMode
                                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                    : 'bg-cyan-100 text-cyan-900 border border-cyan-200'
                                    }`}>
                                    Year {yr}
                                  </span>
                                  <span className={`px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${isDarkMode
                                    ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                    : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                                    }`}>
                                    {crs}
                                  </span>
                                </div>
                                <h4 className={`text-base font-extrabold pt-1 line-clamp-1 ${isDarkMode ? 'text-white' : 'text-slate-900'
                                  }`} title={p.examTitle || `${yr} - ${crs} Exam`}>
                                  {p.examTitle || `${yr} - ${crs} Composite Exam`}
                                </h4>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleDeletePaperFromDirectory(p)}
                                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition cursor-pointer"
                                title="Delete Question Paper"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Paper Info & Scheduled Date/Time Bar */}
                            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                              <div className="flex items-center justify-between text-xs font-black">
                                <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>
                                  {totalQuestions} Questions • {totalMarks} Marks
                                </span>
                                <span className="text-cyan-700 dark:text-cyan-400 font-mono font-black">{p.duration || 120} Mins</span>
                              </div>

                              <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-bold ${isDarkMode
                                ? 'bg-slate-800/60 border-slate-700/60 text-slate-300'
                                : 'bg-gradient-to-r from-slate-50 via-sky-50/50 to-indigo-50/50 border-slate-200/80 text-slate-800 shadow-xs'
                                }`}>
                                <span className="flex items-center gap-1.5">
                                  <span>📅</span>
                                  <span>{p.examDate || '2026 Feb, 8'}</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span>⏰</span>
                                  <span>{p.examTime || '10:00 AM to 1:00 PM'}</span>
                                </span>
                              </div>
                            </div>

                            {/* Live Status + Activate/Deactivate Toggle Row */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                              <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${p.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                <span className={`text-[11px] font-black uppercase tracking-wider ${p.status === 'active' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'
                                  }`}>
                                  {p.status === 'active' ? 'LIVE' : 'INACTIVE'}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={async () => {
                                  const targetId = p.id || getExamDocId(yr, crs);
                                  const newStatus = p.status === 'active' ? 'inactive' : 'active';
                                  await updateExamStatus(targetId, newStatus);
                                  setQuestionPapersMap(prev => ({
                                    ...prev,
                                    [targetId]: { ...prev[targetId], status: newStatus }
                                  }));
                                  showToast(newStatus === 'active' ? '✅ Exam activated! Students can now enter.' : '🔒 Exam deactivated.');
                                }}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer active:scale-95 ${p.status === 'active'
                                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/20'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20'
                                  }`}
                                title={p.status === 'active' ? 'Deactivate exam' : 'Activate exam for students'}
                              >
                                {p.status === 'active' ? (
                                  <><Lock className="w-3.5 h-3.5" /><span>Deactivate</span></>
                                ) : (
                                  <><Power className="w-3.5 h-3.5" /><span>Go Live</span></>
                                )}
                              </button>
                            </div>

                            {/* Action Buttons with High Contrast */}
                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                              {/* Prominent High-Contrast Copy Link Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(examLinkUrl);
                                  showToast('Exam Link copied to clipboard!');
                                }}
                                className="px-2.5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95"
                                title="Copy Student Exam Link"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Link</span>
                              </button>

                              {/* Edit Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenPaperFromDirectory(p)}
                                className="px-2.5 py-2.5 rounded-xl text-xs font-black bg-cyan-600 hover:bg-cyan-700 text-white shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>

                              {/* High-Contrast Print Button */}
                              <button
                                type="button"
                                onClick={() => handlePreviewSpecificPaper(p)}
                                className="px-2.5 py-2.5 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-700 text-white shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95"
                              >
                                <Printer className="w-3.5 h-3.5 text-white" />
                                <span>Print</span>
                              </button>
                            </div>

                            {/* Download Results (full-width, admin-only) */}
                            <button
                              type="button"
                              className="w-full mt-2 px-3 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-purple-700 text-white shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95"
                              onClick={async () => {
                                showToast('Fetching student results...');
                                const examIdForDl = p.id || getExamDocId(yr, crs);
                                const { csv, count } = await downloadExamResultsAsCSV(examIdForDl);
                                if (count === 0) { showToast('No results found for this exam yet.'); return; }
                                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `exam_results_${examIdForDl}_${new Date().toISOString().split('T')[0]}.csv`;
                                a.click();
                                URL.revokeObjectURL(url);
                                showToast(`✅ Downloaded ${count} student result(s) as CSV!`);
                              }}
                            >
                              <Download className="w-3.5 h-3.5 text-indigo-200" />
                              <span>Download Results</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>

                  )}
                </div>
              )}

              {/* GENERATED EXAM SHARE MODAL */}
              {generatedExamModal.open && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className={`w-full max-w-lg p-6 sm:p-7 rounded-3xl border shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                    } space-y-5 animate-in zoom-in-95`}>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20">
                          <Check className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-base font-extrabold">Examination Created Successfully!</h3>
                          <p className="text-xs text-slate-500">1 single write saved to Firebase Firestore</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setGeneratedExamModal({ open: false, url: '', examId: '', title: '' })}
                        className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-500">
                        Direct Student Exam Link:
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={generatedExamModal.url}
                          className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-mono border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-cyan-400' : 'bg-slate-50 border-slate-300 text-slate-800'
                            }`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedExamModal.url);
                            showToast('Exam Link copied to clipboard!');
                          }}
                          className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shrink-0 transition cursor-pointer"
                        >
                          Copy Link
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <a
                        href={generatedExamModal.url}
                        target="_blank"
                        rel="noreferrer"
                        className="py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs text-center transition flex items-center justify-center gap-1.5"
                      >
                        <span>Open Student Portal</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => setGeneratedExamModal({ open: false, url: '', examId: '', title: '' })}
                        className="py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ========================================================= */}
          {/* SCREEN 10: LANDING PAGE INQUIRIES */}
          {/* ========================================================= */}
          {activeMenu === 'inquiries' && (() => {
            const cachedInquiries = JSON.parse(localStorage.getItem('sle_inquiries_cache') || '[]');

            const handleSeedDemoInquiries = () => {
              const demoList = [
                {
                  id: `INQ-${Date.now()}-1`,
                  name: 'Ramesh Kumar',
                  phone: '98765 43210',
                  email: 'ramesh.k@gmail.com',
                  course: 'DCA — Diploma in Computer Applications',
                  city: 'Athani Main Branch',
                  message: 'Looking for morning batch timings and fee structure for 6-month DCA course.',
                  dateStr: '05 Sep 2026',
                  createdAt: new Date().toISOString(),
                  status: 'New'
                },
                {
                  id: `INQ-${Date.now()}-2`,
                  name: 'Priya Sharma',
                  phone: '91234 56789',
                  email: 'priya.sharma@yahoo.com',
                  course: 'TALLY PRIME with GST Professional',
                  city: 'Satti Road Branch',
                  message: 'Interested in GST E-filing and Tally certification module for accounting job placement.',
                  dateStr: '05 Sep 2026',
                  createdAt: new Date().toISOString(),
                  status: 'New'
                },
                {
                  id: `INQ-${Date.now()}-3`,
                  name: 'Amit Patil',
                  phone: '99887 76655',
                  email: 'amit.patil@outlook.com',
                  course: 'PGDCA — Post Graduate Diploma in Computer Applications',
                  city: 'Athani Center',
                  message: 'Want to inquire about 1-year PGDCA syllabus, practical lab access and government certification details.',
                  dateStr: '04 Sep 2026',
                  createdAt: new Date().toISOString(),
                  status: 'Reviewed'
                }
              ];
              localStorage.setItem('sle_inquiries_cache', JSON.stringify(demoList));
              window.dispatchEvent(new Event('storage'));
              setFormSuccess('Demo inquiries created successfully!');
              setTimeout(() => setFormSuccess(''), 4000);
            };

            const handleClearInquiries = () => {
              if (window.confirm('Are you sure you want to clear all landing page inquiries from local storage?')) {
                localStorage.removeItem('sle_inquiries_cache');
                window.dispatchEvent(new Event('storage'));
              }
            };

            const handleDeleteSingleInquiry = (inqId) => {
              const updated = cachedInquiries.filter(i => (i.id || i.phone) !== inqId);
              localStorage.setItem('sle_inquiries_cache', JSON.stringify(updated));
              window.dispatchEvent(new Event('storage'));
              showToast('Inquiry record deleted successfully!');
            };

            // Search & Filtered List
            const filteredInquiries = cachedInquiries.filter(inq => {
              const searchLower = inquiriesSearch.toLowerCase();
              const matchesSearch = !inquiriesSearch.trim() ||
                (inq.name && inq.name.toLowerCase().includes(searchLower)) ||
                (inq.phone && inq.phone.includes(searchLower)) ||
                (inq.email && inq.email.toLowerCase().includes(searchLower)) ||
                (inq.course && inq.course.toLowerCase().includes(searchLower)) ||
                (inq.city && inq.city.toLowerCase().includes(searchLower)) ||
                (inq.message && inq.message.toLowerCase().includes(searchLower));

              const matchesStatus = inquiryStatusFilter === 'All' || inq.status === inquiryStatusFilter;
              return matchesSearch && matchesStatus;
            });

            return (
              <div className="space-y-6 animate-in fade-in duration-300">

                {/* Card 1: Top Hero Banner (Emerald & Teal Vibrant Light Gradient Banner) */}
                <div className="p-4 sm:p-6 lg:p-8 rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 text-white shadow-xl relative overflow-hidden">
                  <div className="absolute -right-10 -top-10 w-80 h-80 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 w-full min-w-0">
                    <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/20 backdrop-blur-md text-white flex items-center justify-center shadow-lg shrink-0 border border-white/30 mt-0.5 sm:mt-0">
                        <Mail className="w-6 h-6 sm:w-7 sm:h-7" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                          <h2 className="text-xl sm:text-3xl font-black tracking-tight text-white drop-shadow-sm leading-snug">Landing Page Student Inquiries</h2>
                          <span className="px-3 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider bg-white/20 backdrop-blur-md text-white border border-white/30 shrink-0 max-w-fit">
                            Live Sync
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-emerald-100 font-medium pt-1 leading-relaxed">
                          All student &amp; franchisee inquiries submitted directly through the public website landing page
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 w-full md:w-auto mt-2 md:mt-0">
                      <div className="text-xs font-black px-4 py-2.5 rounded-2xl bg-white text-emerald-900 border border-white/80 shadow-md flex items-center justify-center gap-2 w-full md:w-auto">
                        <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{cachedInquiries.length} Total Received</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2: Control Toolbar (Pure White Card, Light Theme Buttons & Search) */}
                <div className="p-4 sm:p-6 rounded-3xl bg-white border border-slate-200/90 shadow-md flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 w-full min-w-0">

                  {/* Left: Search & Filter Tabs */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 min-w-0">
                    <div className="relative flex-1 min-w-0">
                      <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={inquiriesSearch}
                        onChange={(e) => setInquiriesSearch(e.target.value)}
                        placeholder="Search student, course, phone or city..."
                        className="w-full pl-10 pr-8 py-2.5 rounded-2xl text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 transition focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white"
                      />
                      {inquiriesSearch && (
                        <button
                          onClick={() => setInquiriesSearch('')}
                          className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 text-xs font-bold p-0.5 cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Status Filter Tabs */}
                    <div className="flex items-center justify-between sm:justify-start p-1 rounded-2xl bg-slate-100 border border-slate-200 text-xs font-bold shrink-0">
                      {['All', 'New', 'Reviewed'].map(st => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setInquiryStatusFilter(st)}
                          className={`flex-1 sm:flex-none px-3.5 sm:px-4 py-2 rounded-xl transition cursor-pointer text-center ${inquiryStatusFilter === st
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md font-black'
                            : 'text-slate-600 hover:text-slate-900 font-bold'
                            }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right: Quick Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
                    <a
                      href="/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      <span>View Public Website</span>
                    </a>

                    {cachedInquiries.length === 0 ? (
                      <button
                        type="button"
                        onClick={handleSeedDemoInquiries}
                        className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        <span>Load Demo Data</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleClearInquiries}
                        className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1 cursor-pointer border border-rose-200"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Clear All</span>
                      </button>
                    )}
                  </div>

                </div>

                {/* Card 3: Data Table Card (Clean Light Theme Table) */}
                <div className="p-4 sm:p-6 lg:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-xl space-y-6 w-full max-w-full min-w-0">

                  {/* Section Title Bar */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold shadow-xs shrink-0">
                        <ListOrdered className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-900 flex flex-wrap items-center gap-2">
                          <span>Received Inquiries Directory</span>
                          <span className="text-xs px-3 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-black border border-emerald-200 shadow-xs">
                            {filteredInquiries.length} {filteredInquiries.length === 1 ? 'Entry' : 'Entries'}
                          </span>
                        </h3>
                        <p className="text-xs text-slate-500 font-medium pt-0.5">
                          Click student phone number to initiate a direct call.
                        </p>
                      </div>
                    </div>
                  </div>

                  {filteredInquiries.length === 0 ? (
                    <div className="text-center py-16 px-6 space-y-5">
                      <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200 shadow-inner">
                        <Mail className="w-8 h-8" />
                      </div>

                      <div className="space-y-1.5 max-w-md mx-auto">
                        <h4 className="text-base font-extrabold text-slate-900">
                          {cachedInquiries.length === 0 ? 'No Public Inquiries Submitted Yet' : 'No Matching Inquiries Found'}
                        </h4>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                          {cachedInquiries.length === 0
                            ? 'When prospective students submit the inquiry form on your website landing page (`sle-institutions.in`), their contact details and questions will sync here automatically.'
                            : 'Try adjusting your search query or status filter.'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                        <a
                          href="/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md transition inline-flex items-center gap-2"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Open Website &amp; Test Inquiry Form</span>
                        </a>

                        <button
                          type="button"
                          onClick={handleSeedDemoInquiries}
                          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition inline-flex items-center gap-2 cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>Load Sample Demo Data</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full max-w-full overflow-x-auto rounded-2xl border border-slate-200 shadow-sm min-w-0">
                      <table className="w-full text-xs font-sans border-collapse min-w-[700px]">
                        <thead className="bg-slate-100 text-slate-900 font-black uppercase tracking-wider text-[11px] border-b-2 border-slate-200 whitespace-nowrap">
                          <tr>
                            <th className="px-4 py-3.5 text-center w-12 whitespace-nowrap">#</th>
                            <th className="px-4 py-3.5 text-left whitespace-nowrap">Student Name</th>
                            <th className="px-4 py-3.5 text-left whitespace-nowrap">Contact Info</th>
                            <th className="px-4 py-3.5 text-left whitespace-nowrap">Interested Course</th>
                            <th className="px-4 py-3.5 text-left whitespace-nowrap">City / Branch</th>
                            <th className="px-4 py-3.5 text-left max-w-xs whitespace-nowrap">Message / Query</th>
                            <th className="px-4 py-3.5 text-center whitespace-nowrap">Date</th>
                            <th className="px-4 py-3.5 text-center whitespace-nowrap">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {filteredInquiries.map((inq, idx) => (
                            <tr key={inq.id || idx} className="hover:bg-emerald-50/40 transition-colors">
                              {/* Row Index Badge */}
                              <td className="px-4 py-4 text-center whitespace-nowrap">
                                <span className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-800 font-black text-xs flex items-center justify-center border border-emerald-200 mx-auto">
                                  {idx + 1}
                                </span>
                              </td>

                              {/* Student Name */}
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="font-black text-slate-900 text-xs uppercase tracking-tight">
                                  {inq.name || '—'}
                                </div>
                                {inq.status && (
                                  <span className={`inline-block mt-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${inq.status === 'New'
                                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                                    }`}>
                                    ● {inq.status}
                                  </span>
                                )}
                              </td>

                              {/* Contact Info (Phone + Email) */}
                              <td className="px-4 py-4 whitespace-nowrap">
                                <a
                                  href={`tel:${inq.phone}`}
                                  className="font-mono font-black text-emerald-700 hover:text-emerald-900 flex items-center gap-1.5 text-xs transition"
                                  title="Click to call student"
                                >
                                  <PhoneCall className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>{inq.phone}</span>
                                </a>
                                {inq.email && (
                                  <div className="text-[11px] text-slate-600 font-semibold pt-0.5">
                                    {inq.email}
                                  </div>
                                )}
                              </td>

                              {/* Interested Course */}
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className="inline-block px-3 py-1.5 rounded-xl bg-rose-50 text-rose-800 font-black text-xs border border-rose-200/80 shadow-2xs">
                                  {inq.course || 'General Inquiry'}
                                </span>
                              </td>

                              {/* City / Branch */}
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-1.5 text-slate-800 font-extrabold text-xs">
                                  <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                  <span>{inq.city || 'Athani Main'}</span>
                                </div>
                              </td>

                              {/* Message / Query Statement */}
                              <td className="px-4 py-4 max-w-sm">
                                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold leading-relaxed">
                                  {inq.message || 'No additional message provided.'}
                                </div>
                              </td>

                              {/* Date */}
                              <td className="px-4 py-4 text-center whitespace-nowrap">
                                <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-800 font-mono font-black text-[11px] border border-slate-200">
                                  {inq.dateStr || 'Today'}
                                </span>
                              </td>

                              {/* Row Delete Action */}
                              <td className="px-4 py-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSingleInquiry(inq.id || inq.phone)}
                                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                  title="Delete Inquiry Record"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>
            );
          })()}

          {/* ========================================================= */}
          {/* SCREEN 11: DYNAMIC CERTIFICATE DESIGNER & PAYMENT SETTINGS */}
          {/* ========================================================= */}
          {activeMenu === 'certificate-designer' && (
            <div className="space-y-6 animate-in fade-in duration-300">

              {/* TOP HEADER & ACTION BAR */}
              <div className={`p-4 sm:p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                } flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4`}>
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                    <Award className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black tracking-tight flex flex-wrap items-center gap-2">
                      <span>Dynamic Certificate Designer</span>
                      <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800 uppercase tracking-wide border border-indigo-200 shrink-0">
                        Live Preview Engine
                      </span>
                    </h2>
                    <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} font-medium mt-0.5`}>
                      Customize headers, logos, seal titles &amp; configure certificate generation fee requirements.
                    </p>
                  </div>
                </div>

                {/* VIEW MODE TOGGLE & SAVE BUTTON */}
                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full lg:w-auto justify-end">
                  {/* View Mode Buttons */}
                  <div className={`p-1 rounded-2xl border grid grid-cols-3 sm:flex items-center gap-1 w-full sm:w-auto ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
                    }`}>
                    <button
                      type="button"
                      onClick={() => setCertViewMode('split')}
                      className={`px-2 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${certViewMode === 'split'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Split</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCertViewMode('editor')}
                      className={`px-2 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${certViewMode === 'editor'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Editor</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCertViewMode('preview')}
                      className={`px-2 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${certViewMode === 'preview'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </button>
                  </div>

                  {/* Reset & Save Buttons */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Reset certificate template settings to default SLE layout?')) {
                          setCertConfig(DEFAULT_CERTIFICATE_CONFIG);
                          saveCertificateConfig(DEFAULT_CERTIFICATE_CONFIG);
                          showToast('Reset to default certificate layout', 'info');
                        }
                      }}
                      className={`flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl text-xs font-extrabold border transition flex items-center justify-center gap-1.5 ${isDarkMode ? 'border-slate-800 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSavingCertToHistory}
                      onClick={handleSaveCurrentCertificateToHistory}
                      className="flex-1 sm:flex-initial bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-4 sm:px-5 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
                      title="Save this student's certificate record to history"
                    >
                      {isSavingCertToHistory ? (
                        <><RefreshCw className="w-4 h-4 animate-spin" /><span>Saving...</span></>
                      ) : (
                        <><Award className="w-4 h-4" /><span>Save to History</span></>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        setIsSavingCertConfig(true);
                        await saveCertificateConfig(certConfig);
                        setIsSavingCertConfig(false);
                        showToast('Certificate design & payment settings saved!', 'success');
                      }}
                      disabled={isSavingCertConfig}
                      className="flex-1 sm:flex-initial bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-4 sm:px-5 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
                    >
                      {isSavingCertConfig ? (
                        <><RefreshCw className="w-4 h-4 animate-spin" /><span>Saving...</span></>
                      ) : (
                        <><Check className="w-4 h-4" /><span>Save Settings</span></>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* MAIN CONTENT AREA: EDITOR AND PREVIEW */}
              <div className={`grid gap-6 ${certViewMode === 'split' ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'
                }`}>

                {/* LEFT COLUMN: EDITING CONTROLS */}
                {(certViewMode === 'split' || certViewMode === 'editor') && (
                  <div className={`space-y-6 ${certViewMode === 'split' ? 'lg:col-span-6 xl:col-span-5' : 'w-full'}`}>

                    {/* SECTION 1: ADMIN PANEL CERTIFICATE FEE & PAYMENT OPTION */}
                    <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                      } space-y-4`}>
                      <div className="flex items-center gap-2.5 border-b pb-3 border-slate-200/60 dark:border-slate-800">
                        <CreditCard className="w-5 h-5 text-emerald-600" />
                        <h3 className="text-sm font-black uppercase tracking-wider">Admin Certificate Fee &amp; Payment Options</h3>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                            Certificate Fee Amount (₹)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-2.5 text-xs font-black text-slate-400">₹</span>
                            <input
                              type="number"
                              min="0"
                              value={certConfig.certificateFee ?? 500}
                              onChange={(e) => setCertConfig(prev => ({ ...prev, certificateFee: Number(e.target.value) || 0 }))}
                              className={`w-full pl-8 pr-4 py-2 rounded-xl text-xs font-black border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                                } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                              placeholder="500"
                            />
                          </div>
                          <p className="text-[11px] text-slate-500">Official fee amount recorded per certificate generation in Admin records.</p>
                        </div>

                        {/* Razorpay Pay Action Button / Status */}
                        {isCertPrintUnlocked ? (
                          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2 text-xs font-black">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span>Fee Paid (₹{certConfig.certificateFee ?? 500}) — Certificate Unlocked</span>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <button
                                type="button"
                                onClick={() => {
                                  if (currentStudentAdmNo) {
                                    try {
                                      localStorage.removeItem(`sle_paid_cert_live_${currentStudentAdmNo}`);
                                    } catch (e) { }
                                  }
                                  setLastAdminPayment(null);
                                  setCertStudentData(prev => ({
                                    ...prev,
                                    isPaid: false,
                                    isCertPaid: false,
                                    paymentStatus: 'Pending Payment',
                                    razorpayPaymentId: ''
                                  }));
                                  showToast('Certificate has been locked. Payment is required to print.', 'info');
                                }}
                                className="px-2.5 py-1 rounded-lg text-xs font-black text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-300 transition flex items-center gap-1 cursor-pointer"
                                title="Lock certificate and require fee payment"
                              >
                                <Lock className="w-3 h-3" />
                                <span>Lock</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleInitiateRazorpayAdminPayment}
                                className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 underline hover:no-underline cursor-pointer"
                              >
                                Pay Again
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 flex items-center justify-between text-xs font-bold">
                              <div className="flex items-center gap-2">
                                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                                <span>Certificate Locked — Fee Required</span>
                              </div>
                              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100">
                                Locked
                              </span>
                            </div>
                            <button
                              type="button"
                              disabled={isRazorpayProcessing}
                              onClick={handleInitiateRazorpayAdminPayment}
                              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-black text-xs shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                            >
                              {isRazorpayProcessing ? (
                                <><RefreshCw className="w-4 h-4 animate-spin" /><span>Opening Razorpay Checkout...</span></>
                              ) : (
                                <><CreditCard className="w-4 h-4 text-sky-300" /><span>Pay ₹{certConfig.certificateFee ?? 500} via Razorpay (Unlock)</span></>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SECTION 0: CUSTOMIZE CERTIFICATE FIELDS (OFFICIAL APPLICATION FORM) */}
                    <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                      } space-y-5`}>
                      <div className="border-b pb-3 border-slate-200/60 dark:border-slate-800">
                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                          <Sparkles className="w-5 h-5" />
                          <h3 className="text-sm font-black uppercase tracking-wider">Customize Certificate Fields</h3>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          Official Application Form — Fill student details or enter Registration No. to auto-fetch
                        </p>
                      </div>

                      {/* Registration No. with Search/Auto-fetch button */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Registration No: <span className="text-indigo-500 font-normal text-[11px]">(Enter to auto-fetch details)</span>
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={certStudentData.admNo}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCertStudentData(prev => ({
                                ...prev,
                                admNo: val,
                                isPaid: false,
                                isCertPaid: false,
                                paymentStatus: 'Pending Payment',
                                razorpayPaymentId: ''
                              }));
                              setAdminPayStudentAdmNo(val);
                              setFetchStatus(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleFetchStudentByAdmNo(certStudentData.admNo);
                              }
                            }}
                            placeholder="202638039"
                            className={`flex-1 px-3.5 py-2.5 rounded-xl text-xs font-bold font-mono border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                              }`}
                          />
                          <button
                            type="button"
                            disabled={isFetchingStudent}
                            onClick={() => handleFetchStudentByAdmNo(certStudentData.admNo)}
                            className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 active:scale-95 transition-all shrink-0 cursor-pointer disabled:opacity-50"
                            title="Fetch Student Details"
                          >
                            {isFetchingStudent ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                          </button>
                        </div>

                        {/* Fetch status message */}
                        {fetchStatus && (
                          <div className={`text-[11px] font-semibold flex items-center gap-1.5 pt-0.5 ${fetchStatus.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                            }`}>
                            {fetchStatus.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                            <span>{fetchStatus.message}</span>
                          </div>
                        )}
                      </div>

                      {/* Form Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Hall Ticket No:</label>
                          <input
                            type="text"
                            value={certStudentData.htNo}
                            onChange={(e) => setCertStudentData(prev => ({ ...prev, htNo: e.target.value }))}
                            className={`w-full px-3 py-2 mt-1 rounded-xl text-xs font-semibold border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                              }`}
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Candidate Name:</label>
                          <input
                            type="text"
                            value={certStudentData.candidateName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCertStudentData(prev => ({ ...prev, candidateName: val }));
                              setAdminPayCandidateName(val);
                            }}
                            className={`w-full px-3 py-2 mt-1 rounded-xl text-xs font-bold border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                              }`}
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Son / Daughter / Wife of:</label>
                          <input
                            type="text"
                            value={certStudentData.fatherName}
                            onChange={(e) => setCertStudentData(prev => ({ ...prev, fatherName: e.target.value }))}
                            className={`w-full px-3 py-2 mt-1 rounded-xl text-xs border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                              }`}
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Completed Training in (Course):</label>
                          <input
                            type="text"
                            value={certStudentData.courseCode || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const full = getCourseFullName(val) || certStudentData.courseTitle;
                              setCertStudentData(prev => ({ ...prev, courseCode: val, courseTitle: full }));
                            }}
                            placeholder="e.g. GST"
                            className={`w-full px-3 py-2 mt-1 rounded-xl text-xs font-semibold uppercase border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                              }`}
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">The award of the: (full form of course)</label>
                          <input
                            type="text"
                            value={certStudentData.courseTitle || ''}
                            onChange={(e) => setCertStudentData(prev => ({ ...prev, courseTitle: e.target.value }))}
                            placeholder="e.g. GOODS & SERVICES TAX ACCOUNTING"
                            className={`w-full px-3 py-2 mt-1 rounded-xl text-xs font-semibold uppercase border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                              }`}
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Program Start Date:</label>
                          <input
                            type="date"
                            value={certStudentData.startDate}
                            onChange={(e) => {
                              const s = e.target.value;
                              const eDate = computeOneYearEndDate(s, 3);
                              const iDate = computeOneMonthAfterDate(eDate);
                              setCertStudentData(prev => ({
                                ...prev,
                                startDate: s,
                                ...(eDate ? { endDate: eDate } : {}),
                                ...(iDate ? { issueDate: iDate } : {})
                              }));
                            }}
                            className={`w-full px-3 py-2 mt-1 rounded-xl text-xs border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                              }`}
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Program End Date:</label>
                          <input
                            type="date"
                            value={certStudentData.endDate}
                            onChange={(e) => {
                              const endD = e.target.value;
                              const iDate = computeOneMonthAfterDate(endD);
                              setCertStudentData(prev => ({
                                ...prev,
                                endDate: endD,
                                ...(iDate ? { issueDate: iDate } : {})
                              }));
                            }}
                            className={`w-full px-3 py-2 mt-1 rounded-xl text-xs border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                              }`}
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Grade Obtained:</label>
                          <input
                            type="text"
                            value={certStudentData.division}
                            onChange={(e) => setCertStudentData(prev => ({ ...prev, division: e.target.value }))}
                            className={`w-full px-3 py-2 mt-1 rounded-xl text-xs border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                              }`}
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Issue Date:</label>
                          <input
                            type="date"
                            value={certStudentData.issueDate}
                            onChange={(e) => setCertStudentData(prev => ({ ...prev, issueDate: e.target.value }))}
                            className={`w-full px-3 py-2 mt-1 rounded-xl text-xs border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                              }`}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Branch Name:</label>
                          <input
                            type="text"
                            value={certStudentData.trainingCenter || ''}
                            onChange={(e) => setCertStudentData(prev => ({ ...prev, trainingCenter: e.target.value }))}
                            placeholder="e.g. DHARWAD"
                            className={`w-full px-3 py-2 mt-1 rounded-xl text-xs font-semibold uppercase border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                              }`}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Branch Address:</label>
                          <input
                            type="text"
                            value={certStudentData.branchAddress ?? certStudentData.trainingCenter}
                            onChange={(e) => setCertStudentData(prev => ({ ...prev, branchAddress: e.target.value }))}
                            placeholder="e.g. DHARWAD"
                            className={`w-full px-3 py-2 mt-1 rounded-xl text-xs font-semibold uppercase border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                              }`}
                          />
                        </div>
                      </div>

                      {/* Candidate Photo */}
                      <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                          <User className="w-4 h-4 text-indigo-500" />
                          <span>Candidate Photo:</span>
                        </div>
                        <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                          } flex items-center gap-4`}>
                          <div className="w-16 h-20 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white overflow-hidden shrink-0 shadow-sm flex items-center justify-center">
                            {certStudentData.photoUrl ? (
                              <img src={certStudentData.photoUrl} alt="Candidate" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-8 h-8 text-slate-300" />
                            )}
                          </div>
                          <div className="space-y-1.5 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-xs cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95 transition-all">
                                <Upload className="w-4 h-4" />
                                <span>Choose Candidate Image</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    try {
                                      showToast('Uploading candidate photo...', 'info');
                                      const url = await uploadToCloudinary(file);
                                      setCertStudentData(prev => ({ ...prev, photoUrl: url }));
                                      showToast('Candidate photo uploaded!', 'success');
                                    } catch (err) {
                                      showToast('Photo upload failed', 'error');
                                    }
                                  }}
                                />
                              </label>
                              {certStudentData.photoUrl && (
                                <button
                                  type="button"
                                  onClick={() => setCertStudentData(prev => ({ ...prev, photoUrl: '' }))}
                                  className="px-3 py-2 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                                  title="Remove custom photo and use SLE logo"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Use SLE Logo</span>
                                </button>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500">
                              Upload candidate photo, or leave blank to display the official SLE Logo (matching standard certificate design).
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 2: TOP HEADER & ORGANIZATIONAL TITLES */}
                    <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                      } space-y-4`}>
                      <div className="flex items-center gap-2.5 border-b pb-3 border-slate-200/60 dark:border-slate-800">
                        <Building className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-sm font-black uppercase tracking-wider">Header &amp; Org Titles</h3>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Top Header Tag (NITI Aayog, etc.)</label>
                          <input
                            type="text"
                            value={certConfig.headerTopText || ''}
                            onChange={(e) => setCertConfig(prev => ({ ...prev, headerTopText: e.target.value }))}
                            className={`w-full px-3.5 py-2 mt-1 rounded-xl text-xs font-semibold border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                              }`}
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Main Title Line 1 (S.L.E.)</label>
                          <input
                            type="text"
                            value={certConfig.orgTitleLine1 || ''}
                            onChange={(e) => setCertConfig(prev => ({ ...prev, orgTitleLine1: e.target.value }))}
                            className={`w-full px-3.5 py-2 mt-1 rounded-xl text-xs font-bold border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                              }`}
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Main Title Line 2 (COMPUTER SAKSHARATA ABHIYAN)</label>
                          <input
                            type="text"
                            value={certConfig.orgTitleLine2 || ''}
                            onChange={(e) => setCertConfig(prev => ({ ...prev, orgTitleLine2: e.target.value }))}
                            className={`w-full px-3.5 py-2 mt-1 rounded-xl text-xs font-bold border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                              }`}
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Institute Subtitle</label>
                          <input
                            type="text"
                            value={certConfig.instituteSub || ''}
                            onChange={(e) => setCertConfig(prev => ({ ...prev, instituteSub: e.target.value }))}
                            className={`w-full px-3.5 py-2 mt-1 rounded-xl text-xs font-semibold border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                              }`}
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Society Name</label>
                          <input
                            type="text"
                            value={certConfig.societyName || ''}
                            onChange={(e) => setCertConfig(prev => ({ ...prev, societyName: e.target.value }))}
                            className={`w-full px-3.5 py-2 mt-1 rounded-xl text-xs font-bold border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                              }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* SECTION 3: ACCREDITATION & REGISTRATION TAGS */}
                    <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                      } space-y-4`}>
                      <div className="flex items-center gap-2.5 border-b pb-3 border-slate-200/60 dark:border-slate-800">
                        <ShieldCheck className="w-5 h-5 text-amber-600" />
                        <h3 className="text-sm font-black uppercase tracking-wider">Accreditation &amp; Reg Tags</h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Society Registration</label>
                          <input
                            type="text"
                            value={certConfig.societyReg || ''}
                            onChange={(e) => setCertConfig(prev => ({ ...prev, societyReg: e.target.value }))}
                            className={`w-full px-3 py-2 mt-1 rounded-xl text-xs border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                              }`}
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Govt Recognition Tag</label>
                          <input
                            type="text"
                            value={certConfig.govtRecognized || ''}
                            onChange={(e) => setCertConfig(prev => ({ ...prev, govtRecognized: e.target.value }))}
                            placeholder="Recognized by Govt of India"
                            className={`w-full px-3 py-2 mt-1 rounded-xl text-xs border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                              }`}
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">NITI Aayog Tag</label>
                          <input
                            type="text"
                            value={certConfig.nitiAayogTag || ''}
                            onChange={(e) => setCertConfig(prev => ({ ...prev, nitiAayogTag: e.target.value }))}
                            placeholder="National Institute of Transforming India and LLP"
                            className={`w-full px-3 py-2 mt-1 rounded-xl text-xs border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                              }`}
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">LLP Status Tag (Optional)</label>
                          <input
                            type="text"
                            value={certConfig.llpTag || ''}
                            onChange={(e) => setCertConfig(prev => ({ ...prev, llpTag: e.target.value }))}
                            placeholder="Leave blank if included above"
                            className={`w-full px-3 py-2 mt-1 rounded-xl text-xs border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                              }`}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">ISO Certification Tag (Highlighted in Blue)</label>
                        <input
                          type="text"
                          value={certConfig.certifiedTag || ''}
                          onChange={(e) => setCertConfig(prev => ({ ...prev, certifiedTag: e.target.value }))}
                          className={`w-full px-3.5 py-2 mt-1 rounded-xl text-xs font-bold border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                            }`}
                        />
                      </div>
                    </div>

                    {/* SECTION 4: LOGOS & EMBLEMS */}
                    <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                      } space-y-4`}>
                      <div className="flex items-center gap-2.5 border-b pb-3 border-slate-200/60 dark:border-slate-800">
                        <Sparkles className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-sm font-black uppercase tracking-wider">Logos &amp; Emblems</h3>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Left Main Logo URL</label>
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="text"
                              value={certConfig.leftLogoUrl || ''}
                              onChange={(e) => setCertConfig(prev => ({ ...prev, leftLogoUrl: e.target.value }))}
                              className={`flex-1 px-3.5 py-2 rounded-xl text-xs border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                                }`}
                              placeholder="/logo-2.png"
                            />
                            <label className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs cursor-pointer flex items-center gap-1.5 shrink-0">
                              <Upload className="w-3.5 h-3.5" />
                              <span>Upload</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  try {
                                    showToast('Uploading left logo to Cloudinary...', 'info');
                                    const url = await uploadToCloudinary(file);
                                    setCertConfig(prev => ({ ...prev, leftLogoUrl: url }));
                                    showToast('Left logo uploaded successfully!', 'success');
                                  } catch (err) {
                                    showToast('Logo upload failed', 'error');
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Center Logo (NITI Aayog) URL</label>
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="text"
                              value={certConfig.emblemUrl || ''}
                              onChange={(e) => setCertConfig(prev => ({ ...prev, emblemUrl: e.target.value }))}
                              className={`flex-1 px-3.5 py-2 rounded-xl text-xs border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                                }`}
                              placeholder="/niti-aayog-grey.png"
                            />
                            <label className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs cursor-pointer flex items-center gap-1.5 shrink-0">
                              <Upload className="w-3.5 h-3.5" />
                              <span>Upload</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  try {
                                    showToast('Uploading emblem to Cloudinary...', 'info');
                                    const url = await uploadToCloudinary(file);
                                    setCertConfig(prev => ({ ...prev, emblemUrl: url }));
                                    showToast('Emblem uploaded successfully!', 'success');
                                  } catch (err) {
                                    showToast('Emblem upload failed', 'error');
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Right Logo (SLE Logo / Default when no candidate photo) URL</label>
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="text"
                              value={certConfig.rightLogoUrl || ''}
                              onChange={(e) => setCertConfig(prev => ({ ...prev, rightLogoUrl: e.target.value }))}
                              className={`flex-1 px-3.5 py-2 rounded-xl text-xs border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                                }`}
                              placeholder="/logo.png"
                            />
                            <label className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs cursor-pointer flex items-center gap-1.5 shrink-0">
                              <Upload className="w-3.5 h-3.5" />
                              <span>Upload</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  try {
                                    showToast('Uploading right logo to Cloudinary...', 'info');
                                    const url = await uploadToCloudinary(file);
                                    setCertConfig(prev => ({ ...prev, rightLogoUrl: url }));
                                    showToast('Right logo uploaded successfully!', 'success');
                                  } catch (err) {
                                    showToast('Logo upload failed', 'error');
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 5: AUTHORIZED SIGNATORIES */}
                    <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                      } space-y-4`}>
                      <div className="flex items-center gap-2.5 border-b pb-3 border-slate-200/60 dark:border-slate-800">
                        <UserCheck className="w-5 h-5 text-purple-600" />
                        <h3 className="text-sm font-black uppercase tracking-wider">Authorized Signatories</h3>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Left Signatory Title</label>
                          <input
                            type="text"
                            value={certConfig.signatoryBranchHead || ''}
                            onChange={(e) => setCertConfig(prev => ({ ...prev, signatoryBranchHead: e.target.value }))}
                            className={`w-full px-3.5 py-2 mt-1 rounded-xl text-xs border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                              }`}
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Right Signatory Title (MD)</label>
                          <input
                            type="text"
                            value={certConfig.signatoryMD || ''}
                            onChange={(e) => setCertConfig(prev => ({ ...prev, signatoryMD: e.target.value }))}
                            className={`w-full px-3.5 py-2 mt-1 rounded-xl text-xs border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                              }`}
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Right Signatory Subtitle</label>
                          <input
                            type="text"
                            value={certConfig.signatoryMDSub || ''}
                            onChange={(e) => setCertConfig(prev => ({ ...prev, signatoryMDSub: e.target.value }))}
                            className={`w-full px-3.5 py-2 mt-1 rounded-xl text-xs border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                              }`}
                          />
                        </div>
                      </div>
                    </div>

                  </div>
                )}

                {/* RIGHT COLUMN: LIVE REAL-TIME PREVIEW */}
                {(certViewMode === 'split' || certViewMode === 'preview') && (
                  <div className={`space-y-4 ${certViewMode === 'split' ? 'lg:col-span-6 xl:col-span-7' : 'w-full'
                    }`}>
                    <div className={`p-4 sm:p-6 rounded-3xl border shadow-md ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                      }`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 mb-4 sm:mb-6 border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping shrink-0" />
                          <div>
                            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                              Live Certificate Preview
                            </h3>
                            <p className="text-[11px] text-slate-500 font-medium">
                              Updates in real-time as you type in the editor
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                          <button
                            type="button"
                            onClick={handleCertificatePrintClick}
                            className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all ${isCertPrintUnlocked
                              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-500/25 cursor-pointer active:scale-95'
                              : 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/25 cursor-pointer active:scale-95'
                              }`}
                            title={isCertPrintUnlocked ? 'Print or Save Certificate as PDF' : 'Certificate locked. Click to pay fee via Razorpay and unlock'}
                          >
                            {isCertPrintUnlocked ? (
                              <><Printer className="w-4 h-4 shrink-0" /><span className="truncate">Print / Save PDF</span></>
                            ) : (
                              <><Lock className="w-4 h-4 shrink-0 animate-pulse" /><span className="truncate font-bold">🔒 Locked — Pay ₹{certConfig.certificateFee ?? 500} to Print</span></>
                            )}
                          </button>

                          <span className="text-[10px] sm:text-[11px] font-extrabold px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
                            A4 Format
                          </span>
                        </div>
                      </div>

                      {/* PAYMENT PENDING WARNING BANNER */}
                      {!isCertPrintUnlocked && (
                        <div className="mb-4 p-3.5 rounded-2xl bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-amber-950 dark:text-amber-100 font-extrabold shadow-sm animate-in fade-in">
                          <div className="flex items-center gap-2">
                            <Lock className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                            <span className="leading-snug">Certificate Printing &amp; PDF Download is locked until ₹{certConfig.certificateFee ?? 500} payment is made via Razorpay Live Gateway.</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowPaymentLockModal(true)}
                            className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] uppercase font-black tracking-wider shrink-0 shadow-sm cursor-pointer transition flex items-center gap-1.5"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Pay ₹{certConfig.certificateFee ?? 500} Now</span>
                          </button>
                        </div>
                      )}

                      {/* LIVE CERTIFICATE COMPONENT */}
                      <div className="overflow-x-auto pb-4 flex justify-center bg-slate-50 dark:bg-slate-950 p-2 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <CertificateTemplate
                          customConfig={certConfig}
                          showControls={false}
                          isUnlocked={isCertPrintUnlocked}
                          initialData={certStudentData}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* CERTIFICATE PAYMENT LOCK MODAL */}
                {showPaymentLockModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={`w-full max-w-md p-6 sm:p-7 rounded-3xl border shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                      } space-y-5 animate-in zoom-in-95 duration-200`}>

                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                            <Lock className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-base font-black">Certificate Printing Locked</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Official Fee Payment Required</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowPaymentLockModal(false)}
                          className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500 dark:text-slate-400">Candidate Name:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{certStudentData.candidateName || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 dark:text-slate-400">Registration No:</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{certStudentData.admNo || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 font-black text-sm">
                          <span>Certificate Fee:</span>
                          <span className="text-emerald-600 dark:text-emerald-400">₹{certConfig.certificateFee ?? 500}</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>Payment Gateway:</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">Razorpay Live API</span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Certificate printing and PDF download are locked until the fee of <strong>₹{certConfig.certificateFee ?? 500}</strong> is completed. Once paid via Razorpay Live Gateway, printing will be instantly unlocked.
                      </p>

                      <div className="flex items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowPaymentLockModal(false)}
                          className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isRazorpayProcessing}
                          onClick={() => {
                            setShowPaymentLockModal(false);
                            handleInitiateRazorpayAdminPayment();
                          }}
                          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                        >
                          <CreditCard className="w-4 h-4" />
                          <span>Pay ₹{certConfig.certificateFee ?? 500} via Razorpay</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* ========================================================= */}
              {/* SECTION: CERTIFICATE GENERATION HISTORY & AUDIT LOG */}
              {/* ========================================================= */}
              <div className={`p-6 sm:p-7 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                } space-y-6 mt-8`}>

                {/* Header & Stats Banner */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-5 border-b border-slate-200/60 dark:border-slate-800">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
                      <History className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                          Certificate Generation History &amp; Audit Log
                        </h3>
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                          {certHistoryList.length} Recorded
                        </span>
                      </div>
                      <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} font-medium mt-0.5`}>
                        Complete chronological audit record of issued certificates with student details, fee amounts, and instant re-printing.
                      </p>
                    </div>
                  </div>

                  {/* Summary Metric Badges */}
                  <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                    <div className={`px-3.5 py-2 rounded-2xl border text-xs font-bold flex items-center gap-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}>
                      <Award className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span>Total Issued: <strong className="text-slate-900 dark:text-white font-black">{certHistoryList.length}</strong></span>
                    </div>

                    <div className="px-3.5 py-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                      <IndianRupee className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Total Fees Recorded: <strong className="font-black">₹{certHistoryList.reduce((sum, item) => sum + (Number(item.certificateFee ?? item.feeAmount ?? 500)), 0).toLocaleString()}</strong></span>
                    </div>

                    <button
                      type="button"
                      disabled={isSavingCertToHistory}
                      onClick={handleSaveCurrentCertificateToHistory}
                      className="px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer active:scale-95 transition disabled:opacity-50"
                      title="Save the certificate currently in designer to history"
                    >
                      {isSavingCertToHistory ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      <span>Save Current to History</span>
                    </button>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={certHistorySearch}
                      onChange={(e) => setCertHistorySearch(e.target.value)}
                      placeholder="Search by candidate name, reg no, course..."
                      className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs font-semibold border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                        } focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                    />
                    {certHistorySearch && (
                      <button
                        type="button"
                        onClick={() => setCertHistorySearch('')}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* History Table */}
                {certHistoryList.length === 0 ? (
                  <div className={`p-12 text-center rounded-2xl border border-dashed ${isDarkMode ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
                    } space-y-3`}>
                    <Award className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 animate-pulse" />
                    <p className="text-sm font-bold">No certificate history records found yet.</p>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Whenever you generate, customize, or pay for a student's certificate, click <strong>"Save to History"</strong> to keep a permanent audit record and enable one-click re-printing anytime!
                    </p>
                    <button
                      type="button"
                      disabled={isSavingCertToHistory}
                      onClick={handleSaveCurrentCertificateToHistory}
                      className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Save Current Certificate (Reg No: {certStudentData.admNo})</span>
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className={`border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px] font-black ${isDarkMode ? 'bg-slate-950/80 text-slate-400' : 'bg-slate-50 text-slate-600'
                          }`}>
                          <th className="py-3 px-4"># / Recorded</th>
                          <th className="py-3 px-4">Candidate &amp; Reg No</th>
                          <th className="py-3 px-4">Course &amp; Dates</th>
                          <th className="py-3 px-4 text-right">Certificate Fee</th>
                          <th className="py-3 px-4 text-center">Payment Status</th>
                          <th className="py-3 px-4 text-center">Print / Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                        {certHistoryList
                          .filter(item => {
                            if (!certHistorySearch.trim()) return true;
                            const q = certHistorySearch.toLowerCase();
                            return (
                              (item.candidateName || '').toLowerCase().includes(q) ||
                              (item.admNo || '').toLowerCase().includes(q) ||
                              (item.htNo || '').toLowerCase().includes(q) ||
                              (item.courseTitle || '').toLowerCase().includes(q) ||
                              (item.trainingCenter || '').toLowerCase().includes(q) ||
                              (item.issueDate || '').toLowerCase().includes(q) ||
                              (item.paymentStatus || (item.isPaid ? 'Successful Payment' : 'Pending Payment')).toLowerCase().includes(q)
                            );
                          })
                          .map((item, idx) => (
                            <tr
                              key={item.id || idx}
                              className={`transition-colors ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-emerald-50/40'
                                }`}
                            >
                              {/* Index & Recorded Date */}
                              <td className="py-3.5 px-4 font-mono font-bold text-slate-500 dark:text-slate-400">
                                <div>#{idx + 1}</div>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-sans mt-0.5">
                                  {item.issuedAt || (item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A')}
                                </div>
                              </td>

                              {/* Candidate & Reg No */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                                    {item.photoUrl ? (
                                      <img src={item.photoUrl} alt={item.candidateName} className="w-full h-full object-cover" />
                                    ) : (
                                      <User className="w-5 h-5 text-slate-400" />
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-black text-slate-900 dark:text-white text-xs">
                                      {item.candidateName || 'N/A'}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                                        {item.admNo}
                                      </span>
                                      {item.htNo && (
                                        <span className="text-[10px] text-slate-400 font-mono">
                                          HT: {item.htNo}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Course & Dates */}
                              <td className="py-3.5 px-4">
                                <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                                  {item.courseTitle || 'Certificate Course'}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                                  <span>Issue: <strong>{item.issueDate || 'N/A'}</strong></span>
                                  {item.division && (
                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                                      {item.division}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Certificate Fee Amount */}
                              <td className="py-3.5 px-4 text-right">
                                <span className="inline-flex items-center gap-1 font-black px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs">
                                  <span>₹{Number(item.certificateFee ?? item.feeAmount ?? 500).toLocaleString()}</span>
                                </span>
                              </td>

                              {/* Payment Status (Set automatically by payment process: Successful, Failed, or Pending) */}
                              <td className="py-3.5 px-4 text-center">
                                {(() => {
                                  const isSuccess = item.paymentStatus === 'Successful Payment' || (!item.paymentStatus && item.isPaid === true);
                                  const isFailed = item.paymentStatus === 'Failed Payment';

                                  if (isSuccess) {
                                    return (
                                      <div className="inline-flex flex-col items-center">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 text-[10px] font-black uppercase tracking-wider shadow-sm select-none">
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                          <span>Successful Payment</span>
                                        </span>
                                        {item.razorpayPaymentId && (
                                          <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 mt-0.5" title={item.razorpayPaymentId}>
                                            {item.razorpayPaymentId.slice(0, 14)}...
                                          </span>
                                        )}
                                      </div>
                                    );
                                  }

                                  if (isFailed) {
                                    return (
                                      <div className="inline-flex flex-col items-center">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-700/60 text-[10px] font-black uppercase tracking-wider shadow-sm select-none">
                                          <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                                          <span>Failed Payment</span>
                                        </span>
                                      </div>
                                    );
                                  }

                                  // Default: Pending Payment
                                  return (
                                    <div className="inline-flex flex-col items-center">
                                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 text-[10px] font-black uppercase tracking-wider shadow-sm select-none">
                                        <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                        <span>Pending Payment</span>
                                      </span>
                                    </div>
                                  );
                                })()}
                              </td>

                              {/* Print & Action Buttons */}
                              <td className="py-3.5 px-4 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  {/* Print / Locked Option */}
                                  {(() => {
                                    const isItemPaid = item.paymentStatus === 'Successful Payment' || (!item.paymentStatus && item.isPaid === true);
                                    if (isItemPaid) {
                                      return (
                                        <button
                                          type="button"
                                          onClick={() => handlePrintHistoryCertificate(item)}
                                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
                                          title="Print this official Certificate"
                                        >
                                          <Printer className="w-3.5 h-3.5" />
                                          <span>Print</span>
                                        </button>
                                      );
                                    }
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => handleLockedHistoryClick(item)}
                                        className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
                                        title={`Certificate locked. Fee payment of ₹${item.certificateFee ?? item.feeAmount ?? 500} is required to unlock printing.`}
                                      >
                                        <Lock className="w-3.5 h-3.5" />
                                        <span>🔒 Locked</span>
                                      </button>
                                    );
                                  })()}

                                  {/* Load into Designer */}
                                  <button
                                    type="button"
                                    onClick={() => handleLoadHistoryToDesigner(item)}
                                    className={`p-1.5 rounded-xl border transition cursor-pointer ${isDarkMode ? 'border-slate-800 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                                      }`}
                                    title="Load student data into Designer"
                                  >
                                    <Edit className="w-3.5 h-3.5 text-indigo-500" />
                                  </button>

                                  {/* Delete */}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteHistoryItem(item)}
                                    className="p-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                    title="Delete from history"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ========================================================= */}
              {/* MODAL: PRINT CERTIFICATE FROM HISTORY */}
              {/* ========================================================= */}
              {historyPrintItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
                  <div className={`w-full max-w-5xl max-h-[96vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                    }`}>
                    {/* Modal Top Bar */}
                    <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-slate-50 dark:bg-slate-950/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                          <Printer className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                              Official Certificate Print Preview
                            </h3>
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              {historyPrintItem.admNo}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {historyPrintItem.candidateName} — {historyPrintItem.courseTitle} (Fee: ₹{historyPrintItem.certificateFee ?? historyPrintItem.feeAmount ?? 500})
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Direct Print / Locked Button */}
                        {historyPrintItem.paymentStatus === 'Successful Payment' || (!historyPrintItem.paymentStatus && historyPrintItem.isPaid === true) ? (
                          <button
                            type="button"
                            onClick={() => window.print()}
                            className="px-4 sm:px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-md shadow-emerald-500/25 flex items-center gap-2 cursor-pointer active:scale-95 transition"
                          >
                            <Printer className="w-4 h-4" />
                            <span>Print Now (A4 Format)</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setShowPaymentLockModal(true);
                            }}
                            className="px-4 sm:px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shadow-md shadow-amber-500/25 flex items-center gap-2 cursor-pointer active:scale-95 transition"
                          >
                            <Lock className="w-4 h-4 animate-pulse" />
                            <span>🔒 Locked — Pay ₹{historyPrintItem.certificateFee ?? historyPrintItem.feeAmount ?? 500} to Print</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setHistoryPrintItem(null)}
                          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Modal Body: Certificate Document */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-950 flex justify-center items-start">
                      <div className="w-full max-w-full overflow-x-auto flex justify-center pb-6">
                        <CertificateTemplate
                          customConfig={certConfig}
                          showControls={false}
                          isUnlocked={historyPrintItem.paymentStatus === 'Successful Payment' || (!historyPrintItem.paymentStatus && historyPrintItem.isPaid === true)}
                          initialData={historyPrintItem}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ========================================================= */}
          {/* SCREEN: MANAGE DIRECTORS (DYNAMIC ADD / EDIT / DELETE) */}
          {/* ========================================================= */}
          {activeMenu === 'manage-directors' && (
            <div className="space-y-8 animate-in fade-in duration-300">

              {/* Header Banner */}
              <div className={`p-6 sm:p-8 rounded-3xl border ${isDarkMode
                ? 'bg-gradient-to-r from-slate-900 via-blue-950/40 to-slate-900 border-slate-800'
                : 'bg-gradient-to-r from-blue-50 via-indigo-50 to-white border-blue-100'
                } shadow-sm relative overflow-hidden`}>
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                        <Users className="w-6 h-6" />
                      </span>
                      <h2 className="text-2xl font-black tracking-tight">Directors & Leadership Management</h2>
                    </div>
                    <p className={`text-sm mt-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Dynamically add, edit, or delete directors and organizational leaders shown on the public landing page. Live synced across the portal.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-600 px-3.5 py-1.5 rounded-full text-xs font-bold">
                    <Sparkles className="w-4 h-4" />
                    <span>Public Website Synced</span>
                  </div>
                </div>
              </div>

              {/* Quick Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Total Directors */}
                <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
                  } shadow-sm backdrop-blur-md space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Directors</span>
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black">{directors.length}</div>
                  <p className="text-[11px] text-slate-500">Active leaders on landing page</p>
                </div>

                {/* 2. Core Defaults */}
                <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
                  } shadow-sm backdrop-blur-md space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Core Defaults</span>
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                      <Award className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black">{directors.filter(d => d.isDefault).length}</div>
                  <p className="text-[11px] text-slate-500">Founding executive leaders</p>
                </div>

                {/* 3. Custom Added */}
                <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
                  } shadow-sm backdrop-blur-md space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Custom Added</span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                      <PlusCircle className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black">{directors.filter(d => !d.isDefault).length}</div>
                  <p className="text-[11px] text-slate-500">Added dynamically by Admin</p>
                </div>
              </div>

              {/* Add New Director Interactive Card */}
              <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl backdrop-blur-md ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
                } space-y-6 transition-all`}>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                      <Plus className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">Add New Director / Leader</h3>
                      <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Enter director profile details and upload a photo to display them in the Directors section.
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleAddDirector} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Full Name */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                        <input
                          type="text"
                          required
                          placeholder="e.g. Mr. B. Sunil"
                          value={newDirectorForm.name}
                          onChange={(e) => setNewDirectorForm({ ...newDirectorForm, name: e.target.value })}
                          className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${isDarkMode
                            ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-blue-500'
                            : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                            }`}
                        />
                      </div>
                    </div>

                    {/* Role / Designation */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Designation / Role <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Award className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                        <input
                          type="text"
                          required
                          placeholder="e.g. Managing Director / Chairman"
                          value={newDirectorForm.role}
                          onChange={(e) => setNewDirectorForm({ ...newDirectorForm, role: e.target.value })}
                          className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${isDarkMode
                            ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-blue-500'
                            : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                            }`}
                        />
                      </div>
                    </div>

                    {/* Email / Website */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Email / Contact Info
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="e.g. Founder@sleinstitutions.com"
                          value={newDirectorForm.email}
                          onChange={(e) => setNewDirectorForm({ ...newDirectorForm, email: e.target.value })}
                          className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${isDarkMode
                            ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-blue-500'
                            : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                            }`}
                        />
                      </div>
                    </div>

                    {/* Display Order */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Display Order
                      </label>
                      <div className="relative">
                        <ListOrdered className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                        <input
                          type="number"
                          min="1"
                          placeholder={String(directors.length + 1)}
                          value={newDirectorForm.order}
                          onChange={(e) => setNewDirectorForm({ ...newDirectorForm, order: e.target.value })}
                          className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${isDarkMode
                            ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-blue-500'
                            : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                            }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Photo Upload & Preview */}
                  <div className="space-y-2 pt-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Director Photo (Upload file or enter URL)
                    </label>

                    <input
                      type="file"
                      ref={newDirectorImageFileRef}
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadDirectorImage(file, false);
                      }}
                      className="hidden"
                    />

                    <div className="flex flex-col sm:flex-row gap-3 items-center">
                      <button
                        type="button"
                        disabled={isUploadingNewDirectorImage}
                        onClick={() => newDirectorImageFileRef.current?.click()}
                        className="px-4 py-2.5 rounded-xl border text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer shrink-0 active:scale-95 disabled:opacity-50"
                      >
                        {isUploadingNewDirectorImage ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Uploading Photo...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            <span>Upload Photo from Device</span>
                          </>
                        )}
                      </button>

                      <div className="relative flex-1 w-full">
                        <ExternalLink className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Or paste image URL (e.g. /directors/chairman.png or https://...)"
                          value={newDirectorForm.image}
                          onChange={(e) => setNewDirectorForm({ ...newDirectorForm, image: e.target.value })}
                          className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${isDarkMode
                            ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-blue-500'
                            : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                            }`}
                        />
                      </div>

                      {/* Photo Live Preview Thumbnail */}
                      {newDirectorForm.image && (
                        <div className="w-12 h-9 rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                          <img
                            src={newDirectorForm.image}
                            alt="Preview"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              e.target.src = "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400";
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isAddingDirector || !newDirectorForm.name.trim()}
                      className="px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-600/30 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {isAddingDirector ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Adding Director...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Add Director</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Directors Directory Listing Card */}
              <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl backdrop-blur-md ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
                } space-y-6 transition-all`}>

                {/* Search & Filter Toolbar */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                      <Layers className="w-4 h-4" />
                    </div>
                    <h3 className="text-lg font-bold">
                      Active Leadership Directory ({filteredDirectors.length})
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Search Input */}
                    <div className="relative flex-1 md:w-64">
                      <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search directors..."
                        value={directorSearch}
                        onChange={(e) => setDirectorSearch(e.target.value)}
                        className={`w-full pl-10 pr-4 py-2 rounded-xl text-xs border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${isDarkMode
                          ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-blue-500'
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                          }`}
                      />
                    </div>

                    {/* Filter Pills */}
                    <div className={`flex items-center p-1 rounded-xl border ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
                      }`}>
                      <button
                        type="button"
                        onClick={() => setDirectorFilter('all')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${directorFilter === 'all'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        All ({directors.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setDirectorFilter('default')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${directorFilter === 'default'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        Defaults ({directors.filter(d => d.isDefault).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setDirectorFilter('custom')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${directorFilter === 'custom'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        Custom ({directors.filter(d => !d.isDefault).length})
                      </button>
                    </div>

                    {/* Reset to Defaults button */}
                    <button
                      type="button"
                      onClick={handleResetDirectors}
                      className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5 cursor-pointer"
                      title="Reset directors to 3 original defaults"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Defaults</span>
                    </button>
                  </div>
                </div>

                {/* Directors Cards Grid */}
                {filteredDirectors.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-500/10 text-slate-400 mx-auto flex items-center justify-center">
                      <Users className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-500">No directors match your search or filter.</p>
                    {directorSearch && (
                      <button
                        type="button"
                        onClick={() => setDirectorSearch('')}
                        className="text-xs text-blue-500 font-bold hover:underline cursor-pointer"
                      >
                        Clear Search
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredDirectors.map((d) => (
                      <div
                        key={d.id || d.name}
                        className={`group rounded-2xl border overflow-hidden transition-all duration-200 flex flex-col ${isDarkMode
                          ? 'bg-slate-950/60 border-slate-800/80 hover:border-blue-500/50 hover:bg-slate-900'
                          : 'bg-white border-slate-200/90 hover:border-blue-400 hover:shadow-lg'
                          }`}
                      >
                        {/* 4:3 Image Container Matching Landing Page */}
                        <div className="w-full aspect-[4/3] bg-slate-100 dark:bg-slate-800 relative overflow-hidden flex items-center justify-center border-b border-slate-200 dark:border-slate-800">
                          <img
                            src={d.image || '/directors/chairman.png'}
                            alt={d.name}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              e.target.src = d.fallbackImage || "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400";
                            }}
                          />
                          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-slate-900/75 backdrop-blur-sm text-white text-[10px] font-mono font-bold">
                              #{d.order || 1}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold backdrop-blur-sm ${d.isDefault
                              ? 'bg-indigo-600/80 text-white'
                              : 'bg-emerald-600/80 text-white'
                              }`}>
                              {d.isDefault ? 'Core Default' : 'Custom'}
                            </span>
                          </div>
                        </div>

                        {/* Card Info */}
                        <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                          <div className="space-y-1">
                            <h4 className="text-base font-extrabold truncate" title={d.name}>
                              {d.name}
                            </h4>
                            <p className="text-xs font-bold text-blue-600 dark:text-blue-400">
                              {d.role}
                            </p>
                            {d.email && (
                              <p className={`text-xs truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} title={d.email}>
                                {d.email}
                              </p>
                            )}
                          </div>

                          {/* Action Buttons: Edit & Delete */}
                          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                            <button
                              type="button"
                              onClick={() => handleStartEditDirector(d)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 transition flex items-center gap-1.5 cursor-pointer"
                              title={`Edit ${d.name}`}
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDirectorDeleteTarget(d)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 transition flex items-center gap-1.5 cursor-pointer"
                              title={`Delete ${d.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* SCREEN 13: STUDENT BRANCH TRANSFER */}
          {/* ========================================================= */}
          {activeMenu === 'student-transfer' && (
            <div className="space-y-6 animate-in fade-in duration-300">

              {/* Header */}
              <div className={`p-6 rounded-3xl border ${isDarkMode
                ? 'bg-gradient-to-r from-slate-900 via-emerald-950/30 to-slate-900 border-slate-800'
                : 'bg-gradient-to-r from-emerald-50 via-teal-50 to-white border-emerald-100'
                } shadow-sm relative overflow-hidden`}>
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center border border-emerald-500/20">
                        <ArrowLeftRight className="w-5 h-5" />
                      </div>
                      <h2 className="text-2xl font-black tracking-tight">Student Branch Transfer</h2>
                    </div>
                    <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Move students from one branch centre to another. Updates Firestore database and local storage caches.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 px-3.5 py-1.5 rounded-full text-xs font-bold">
                    <Users className="w-4 h-4" />
                    <span>{transferStudentsList.length > 0 ? `${transferStudentsList.length} Students Loaded` : 'Select Branches'}</span>
                  </div>
                </div>
              </div>

              {/* Branch Selection Panel */}
              <div className={`p-6 rounded-3xl border shadow-lg ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
                }`}>
                <h3 className="text-base font-bold mb-5 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <Building className="w-4 h-4" />
                  </div>
                  Step 1 — Select Source &amp; Destination Branch
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* From Branch */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Transfer FROM Branch <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Building className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                      <select
                        value={transferFromBranch}
                        onChange={e => { setTransferFromBranch(e.target.value); setTransferStudentsList([]); setTransferSelectedIds([]); setTransferResult(null); setTransferLoadError(''); }}
                        className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none cursor-pointer ${isDarkMode
                          ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500'
                          : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                          }`}
                      >
                        <option value="">— Select source branch —</option>
                        {branches.map(b => (
                          <option key={b.id} value={b.name}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* To Branch */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Transfer TO Branch <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                      <select
                        value={transferToBranch}
                        onChange={e => setTransferToBranch(e.target.value)}
                        className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none cursor-pointer ${isDarkMode
                          ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500'
                          : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                          }`}
                      >
                        <option value="">— Select destination branch —</option>
                        {branches.filter(b => b.name !== transferFromBranch).map(b => (
                          <option key={b.id} value={b.name}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Transfer direction indicator */}
                {transferFromBranch && transferToBranch && (
                  <div className={`mt-4 p-4 rounded-2xl border flex items-center justify-center gap-3 text-sm font-semibold ${isDarkMode ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    }`}>
                    <span className="px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-xs">{transferFromBranch}</span>
                    <ArrowLeftRight className="w-5 h-5 text-emerald-500" />
                    <span className="px-3 py-1 rounded-lg bg-teal-500/15 text-teal-700 dark:text-teal-300 font-bold text-xs">{transferToBranch}</span>
                  </div>
                )}

                {/* Load Students Button */}
                <div className="mt-5">
                  <button
                    type="button"
                    disabled={!transferFromBranch || isLoadingTransferStudents}
                    onClick={handleFetchTransferStudents}
                    className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isLoadingTransferStudents ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /><span>Loading Students...</span></>
                    ) : (
                      <><Search className="w-4 h-4" /><span>Load Students from "{transferFromBranch || 'Source Branch'}"</span></>
                    )}
                  </button>
                </div>
              </div>

              {/* Error State */}
              {transferLoadError && (
                <div className={`p-4 rounded-2xl border flex items-center gap-3 ${isDarkMode ? 'bg-rose-950/30 border-rose-800/40 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700'
                  }`}>
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-semibold">{transferLoadError}</span>
                </div>
              )}

              {/* Student List Panel */}
              {transferStudentsList.length > 0 && (
                <div className={`rounded-3xl border shadow-lg overflow-hidden ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
                  }`}>
                  {/* Panel Header */}
                  <div className={`p-5 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${isDarkMode ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-slate-50/80'
                    }`}>
                    <div>
                      <h3 className="text-base font-bold flex items-center gap-2">
                        <Users className="w-5 h-5 text-emerald-500" />
                        Step 2 — Select Students to Transfer
                      </h3>
                      <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {transferSelectedIds.length > 0
                          ? `${transferSelectedIds.length} of ${filteredTransferStudents.length} selected`
                          : `${filteredTransferStudents.length} student(s) in "${transferFromBranch}" — leave unselected to transfer ALL`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Select All */}
                      <button
                        type="button"
                        onClick={() => {
                          const allIds = filteredTransferStudents.map(s => s.id);
                          setTransferSelectedIds(
                            transferSelectedIds.length === filteredTransferStudents.length ? [] : allIds
                          );
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${transferSelectedIds.length === filteredTransferStudents.length && filteredTransferStudents.length > 0
                          ? isDarkMode ? 'bg-emerald-800/40 border-emerald-700 text-emerald-300' : 'bg-emerald-100 border-emerald-300 text-emerald-700'
                          : isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                          }`}
                      >
                        {transferSelectedIds.length === filteredTransferStudents.length && filteredTransferStudents.length > 0
                          ? <><CheckSquare className="w-3.5 h-3.5" /><span>Deselect All</span></>
                          : <><Square className="w-3.5 h-3.5" /><span>Select All</span></>
                        }
                      </button>
                    </div>
                  </div>

                  {/* Search */}
                  <div className={`px-5 py-3 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search by name, Reg. No, ID, or course..."
                        value={transferSearchQuery}
                        onChange={e => setTransferSearchQuery(e.target.value)}
                        className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${isDarkMode
                          ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-emerald-500'
                          : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500'
                          }`}
                      />
                    </div>
                  </div>

                  {/* Student List */}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[420px] overflow-y-auto">
                    {filteredTransferStudents.length === 0 && (
                      <div className="py-8 text-center text-sm text-slate-400">
                        No students match your search query.
                      </div>
                    )}
                    {filteredTransferStudents.map((student, idx) => {
                      const name = student.fullName || student.studentName || student.candidateName || student.name || 'Unknown Student';
                      const regNo = student.registrationNo || student.regNo || student.admissionNo || student.admNo || student.appNumber || student.id || '—';
                      const appNumber = student.appNumber || student.appRefNo || (student.id !== regNo ? student.id : '');
                      const course = student.courseTitle || student.courseName || student.course || student.selectedClass || '—';
                      const isSelected = transferSelectedIds.includes(student.id);
                      return (
                        <label
                          key={student.id || idx}
                          className={`flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-all ${isSelected
                            ? isDarkMode ? 'bg-emerald-950/30' : 'bg-emerald-50'
                            : isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setTransferSelectedIds(prev =>
                                isSelected ? prev.filter(id => id !== student.id) : [...prev, student.id]
                              );
                            }}
                            className="w-4 h-4 rounded accent-emerald-500 cursor-pointer shrink-0"
                          />
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center text-sm font-black shrink-0">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{name}</p>
                            <p className={`text-xs truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                Reg. No: {regNo}
                              </span>
                              <span className="mx-1.5">&bull;</span>
                              <span>{course}</span>
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {/* Transfer Action Footer */}
                  <div className={`p-5 border-t ${isDarkMode ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-slate-50/80'} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}>
                    <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      {transferSelectedIds.length > 0
                        ? <span>Will transfer <strong className="text-emerald-600 dark:text-emerald-400">{transferSelectedIds.length} selected student(s)</strong> to <strong className="text-teal-600 dark:text-teal-400">{transferToBranch || '...'}</strong></span>
                        : <span>Will transfer <strong className="text-emerald-600 dark:text-emerald-400">ALL {transferStudentsList.length} students</strong> from <strong>{transferFromBranch}</strong> to <strong className="text-teal-600 dark:text-teal-400">{transferToBranch || '...'}</strong></span>
                      }
                    </div>
                    <button
                      type="button"
                      disabled={!transferToBranch || isTransferring}
                      onClick={() => setShowTransferConfirmModal(true)}
                      className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isTransferring ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /><span>Transferring...</span></>
                      ) : (
                        <><ArrowLeftRight className="w-4 h-4" /><span>Execute Transfer</span></>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Transfer Result */}
              {transferResult && (
                <div className={`p-6 rounded-3xl border shadow-md ${transferResult.success && transferResult.transferred > 0
                  ? isDarkMode ? 'bg-emerald-950/30 border-emerald-800/40' : 'bg-emerald-50 border-emerald-200'
                  : isDarkMode ? 'bg-rose-950/30 border-rose-800/40' : 'bg-rose-50 border-rose-200'
                  }`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${transferResult.transferred > 0 ? 'bg-emerald-500/15 text-emerald-600' : 'bg-rose-500/15 text-rose-600'
                      }`}>
                      {transferResult.transferred > 0 ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="text-base font-bold">
                        {transferResult.transferred > 0
                          ? `✅ Transfer Complete — ${transferResult.transferred} student(s) moved`
                          : '❌ Transfer Failed'}
                      </h4>
                      {transferResult.errors.length > 0 && (
                        <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">{transferResult.errors.length} error(s) occurred</p>
                      )}
                    </div>
                  </div>
                  {/* Log */}
                  {transferResult.log && transferResult.log.length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs font-bold cursor-pointer text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">View Transfer Log ({transferResult.log.length} entries)</summary>
                      <div className={`mt-2 p-3 rounded-xl font-mono text-xs space-y-0.5 max-h-48 overflow-y-auto ${isDarkMode ? 'bg-slate-950 text-slate-300' : 'bg-white text-slate-700'
                        }`}>
                        {transferResult.log.map((entry, i) => (
                          <div key={i} className={entry.startsWith('Error') || entry.startsWith('Failed') ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}>{entry}</div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}

            </div>
          )}

          {/* ========================================================= */}
          {/* SCREEN 14: DATA IMPORT / EXPORT */}
          {/* ========================================================= */}
          {activeMenu === 'data-import-export' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <ImportExportData isDarkMode={isDarkMode} />
            </div>
          )}

        </main>
      </div>

      {/* COMPLETE FRANCHISEE DETAILS & DOCUMENTS VIEW MODAL */}
      {viewingFranchiseeDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className={`w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            } animate-in zoom-in-95 duration-200`}>

            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-black text-base shadow-md shadow-indigo-500/25 shrink-0">
                  {(viewingFranchiseeDetails.ownerName || viewingFranchiseeDetails.fullName || 'F')[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-black tracking-tight">
                      {viewingFranchiseeDetails.centerName || viewingFranchiseeDetails.franchiseName || viewingFranchiseeDetails.firmName || 'Franchisee Profile'}
                    </h3>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-500 border border-indigo-500/20">
                      {viewingFranchiseeDetails.id}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${viewingFranchiseeDetails.status === 'Active'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/15 text-rose-500'
                      }`}>
                      {viewingFranchiseeDetails.status || 'Active'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 font-mono">
                      <Calendar className="w-3 h-3 text-indigo-500 shrink-0" />
                      Reg: {getFranchiseeRegDate(viewingFranchiseeDetails)}
                    </span>
                  </div>
                  <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Owner: <strong>{viewingFranchiseeDetails.ownerName || viewingFranchiseeDetails.fullName || '—'}</strong> • {viewingFranchiseeDetails.email || '—'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const f = viewingFranchiseeDetails;
                    setViewingFranchiseeDetails(null);
                    handleEditFranchisee(f);
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-500 hover:bg-indigo-600 text-white flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingFranchiseeDetails(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs">

              {/* SECTION 1: PERSONAL & CENTER DETAILS */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-indigo-600 font-bold uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200">
                  <User className="w-3.5 h-3.5" />
                  <span>1. Personal & Ownership Details</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">Center Name</span>
                    <span className="font-bold text-slate-900">{viewingFranchiseeDetails.centerName || viewingFranchiseeDetails.franchiseName || '—'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">Firm Name</span>
                    <span className="font-bold text-slate-900">{viewingFranchiseeDetails.firmName || '—'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">Owner Name</span>
                    <span className="font-bold text-slate-900">{viewingFranchiseeDetails.ownerName || viewingFranchiseeDetails.fullName || '—'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">Contact Number</span>
                    <span className="font-bold text-slate-900">{viewingFranchiseeDetails.contactNumber || viewingFranchiseeDetails.phone || '—'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">Qualification</span>
                    <span className="font-bold text-slate-900">{viewingFranchiseeDetails.qualification || '—'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">Location</span>
                    <span className="font-bold text-slate-900">{viewingFranchiseeDetails.place || viewingFranchiseeDetails.location || '—'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">District / State</span>
                    <span className="font-bold text-slate-900">{viewingFranchiseeDetails.districtState || '—'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">Pin Code</span>
                    <span className="font-bold text-slate-900">{viewingFranchiseeDetails.residentialPinCode || '—'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90 sm:col-span-2 md:col-span-4">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">Residential Address</span>
                    <span className="font-bold text-slate-900">{viewingFranchiseeDetails.residentialAddress || '—'}</span>
                  </div>
                </div>
              </div>

              {/* SECTION 2: TRAINING ADDRESS & INFRASTRUCTURE */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-purple-600 font-bold uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200">
                  <Building className="w-3.5 h-3.5" />
                  <span>2. Training Address & Infrastructure Details</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">Email Address</span>
                    <span className="font-bold text-slate-900 truncate block">{viewingFranchiseeDetails.email || '—'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">Geographical Area</span>
                    <span className="font-bold text-slate-900">{viewingFranchiseeDetails.geographicalCenter || 'Urban'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">Center Pin Code</span>
                    <span className="font-bold text-slate-900">{viewingFranchiseeDetails.centerPinCode || '—'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">Premises Area (Sq.Ft)</span>
                    <span className="font-bold text-slate-900">{viewingFranchiseeDetails.premisesAreaSqFt || '—'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">Computer Systems</span>
                    <span className="font-bold text-slate-900">{viewingFranchiseeDetails.computerSystems || '—'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">LCD Projector</span>
                    <span className="font-bold text-slate-900">{viewingFranchiseeDetails.lcdProjector || '—'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">Classrooms & Labs</span>
                    <span className="font-bold text-slate-900">{viewingFranchiseeDetails.noOfClassroom || 0} Class / {viewingFranchiseeDetails.noOfLab || 0} Labs</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90 sm:col-span-2 md:col-span-4">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">Center Address</span>
                    <span className="font-bold text-slate-900">{viewingFranchiseeDetails.centerAddress || '—'}</span>
                  </div>
                </div>
              </div>

              {/* SECTION 3: TRADE & BANKING DETAILS */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-600 font-bold uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>3. Trade & Banking Details</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">Trade</span>
                    <span className="font-bold text-slate-900">{viewingFranchiseeDetails.trade || '—'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">Affiliation Fee</span>
                    <span className="font-bold text-slate-900">{viewingFranchiseeDetails.affiliationFee || '—'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">Seat Require</span>
                    <span className="font-bold text-slate-900">{viewingFranchiseeDetails.seatRequire || '—'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">Mode of Payment</span>
                    <span className="font-bold text-slate-900">{viewingFranchiseeDetails.modeOfPayment || '—'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">Bank Name</span>
                    <span className="font-bold text-slate-900">{viewingFranchiseeDetails.bankName || '—'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">Account No.</span>
                    <span className="font-bold text-slate-900 font-mono">{viewingFranchiseeDetails.accountNo || '—'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90 sm:col-span-2">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">IFSC Code</span>
                    <span className="font-bold text-slate-900 font-mono">{viewingFranchiseeDetails.ifscCode || '—'}</span>
                  </div>
                </div>
              </div>

              {/* SECTION 4: SUBMITTED DOCUMENTS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <div className="flex items-center gap-2 text-amber-600 font-bold uppercase tracking-wider text-[11px]">
                    <Upload className="w-3.5 h-3.5" />
                    <span>4. Submitted Verification Documents</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">File size &lt; 100KB</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {[
                    { key: 'photoUrl', label: 'Photo (Passport)', icon: Camera },
                    { key: 'signatureUrl', label: 'Signature', icon: Edit },
                    { key: 'panCardUrl', label: 'Pan Card', icon: CreditCard },
                    { key: 'bankDetailsUrl', label: 'Bank Details', icon: Building },
                    { key: 'aadhaarCardUrl', label: 'Aadhaar Card', icon: ShieldCheck },
                    { key: 'premisesPhotoUrl', label: 'Premises Photo', icon: Camera },
                    { key: 'addressProofUrl', label: 'Address Proof', icon: FileText },
                  ].map((docItem) => {
                    const DocIcon = docItem.icon;
                    const docValue = viewingFranchiseeDetails[docItem.key];
                    const hasDoc = !!docValue;

                    return (
                      <div
                        key={docItem.key}
                        className={`p-3 rounded-2xl border flex flex-col justify-between ${hasDoc
                          ? 'bg-emerald-50/50 border-emerald-200 shadow-2xs'
                          : 'bg-slate-50/90 border-slate-200 text-slate-400'
                          }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <DocIcon className="w-3.5 h-3.5 shrink-0 text-slate-600" />
                            <span className="font-bold text-[11px] truncate text-slate-700">{docItem.label}</span>
                          </div>
                          {hasDoc ? (
                            <div
                              onClick={() => handleOpenDocument(docValue, `${docItem.label} - ${viewingFranchiseeDetails.centerName || viewingFranchiseeDetails.franchiseName || viewingFranchiseeDetails.fullName || 'Franchisee'}`)}
                              className="rounded-xl overflow-hidden border border-slate-200 bg-white h-24 flex items-center justify-center mb-2 shadow-inner cursor-pointer group relative"
                              title="Click to view full document"
                            >
                              {docValue.startsWith('data:image') || docValue.startsWith('http') ? (
                                <img src={docValue} alt={docItem.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                              ) : (
                                <FileText className="w-8 h-8 text-indigo-500" />
                              )}
                              <div className="absolute inset-0 bg-indigo-900/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="bg-white/95 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                                  <Eye className="w-3 h-3 text-indigo-600" /> Preview
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-slate-300 h-24 flex flex-col items-center justify-center text-center p-2 mb-2 text-slate-400 bg-white/60">
                              <span className="text-[10px]">Not uploaded</span>
                            </div>
                          )}
                        </div>

                        {hasDoc && (
                          <div className="flex items-center gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => handleOpenDocument(docValue, `${docItem.label} - ${viewingFranchiseeDetails.centerName || viewingFranchiseeDetails.franchiseName || viewingFranchiseeDetails.fullName || 'Franchisee'}`)}
                              className="flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white border border-indigo-200/80 transition flex items-center justify-center gap-1 cursor-pointer"
                              title="View document in full size"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View Document</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadDoc(docValue, `${docItem.label.replace(/\s+/g, '_')}_${viewingFranchiseeDetails.id || 'doc'}`)}
                              className="p-1.5 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer border border-slate-200/60"
                              title="Download document file"
                            >
                              <Download className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 5: PLAN & SUBSCRIPTION */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-pink-600 font-bold uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>5. Allocated Plan & Subscription Account</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">Registration Date</span>
                    <span className="font-bold text-indigo-600 flex items-center gap-1 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      {getFranchiseeRegDate(viewingFranchiseeDetails)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">Active Plan</span>
                    <span className="font-bold text-slate-900">{viewingFranchiseeDetails.planName || 'First-Time Onboarding'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">Valid Till</span>
                    <span className="font-bold text-slate-900">{getFranchiseeValidTillDate(viewingFranchiseeDetails)}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">Portal Password</span>
                    <span className="font-bold text-indigo-600 font-mono">{viewingFranchiseeDetails.password || '123456'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">Payment Status</span>
                    <span className="font-bold text-emerald-600">{viewingFranchiseeDetails.paymentStatus || 'Paid'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold tracking-wider mb-0.5">GST / Registration ID</span>
                    <span className="font-bold text-slate-900">{viewingFranchiseeDetails.gstId || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* SECTION 6: OFFICIAL FRANCHISEE CERTIFICATE */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <div className="flex items-center gap-2 text-indigo-600 font-bold uppercase tracking-wider text-[11px]">
                    <Award className="w-3.5 h-3.5" />
                    <span>6. Official Franchisee Certificate</span>
                  </div>
                  {viewingFranchiseeDetails.franchiseCertificateUrl ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                      Certificate Issued
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-slate-500">
                      Supports PNG, JPG, WEBP, PDF (Max 5MB)
                    </span>
                  )}
                </div>

                {viewingFranchiseeDetails.franchiseCertificateUrl ? (
                  <div className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        onClick={() => handleOpenDocument(viewingFranchiseeDetails.franchiseCertificateUrl, `Franchisee Certificate - ${viewingFranchiseeDetails.franchiseName || viewingFranchiseeDetails.fullName || 'Center'}`)}
                        className="w-16 h-16 rounded-xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center shrink-0 cursor-pointer shadow-xs hover:scale-105 transition-transform"
                        title="Click to preview certificate"
                      >
                        {viewingFranchiseeDetails.franchiseCertificateType === 'pdf' || viewingFranchiseeDetails.franchiseCertificateUrl.startsWith('data:application/pdf') || viewingFranchiseeDetails.franchiseCertificateUrl.toLowerCase().endsWith('.pdf') ? (
                          <FileText className="w-8 h-8 text-indigo-600" />
                        ) : (
                          <img src={viewingFranchiseeDetails.franchiseCertificateUrl} alt="Certificate" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {viewingFranchiseeDetails.franchiseCertificateName || 'Official Franchisee Certificate'}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                          <span>Issued: {viewingFranchiseeDetails.franchiseCertificateIssuedAt || 'Today'}</span>
                          {viewingFranchiseeDetails.franchiseCertificateSize && (
                            <span>• {viewingFranchiseeDetails.franchiseCertificateSize}</span>
                          )}
                          <span className="uppercase text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                            {viewingFranchiseeDetails.franchiseCertificateType || 'Doc'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleOpenDocument(viewingFranchiseeDetails.franchiseCertificateUrl, `Franchisee Certificate - ${viewingFranchiseeDetails.franchiseName || viewingFranchiseeDetails.fullName || 'Center'}`)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadDoc(viewingFranchiseeDetails.franchiseCertificateUrl, `Franchisee_Certificate_${viewingFranchiseeDetails.id || 'Center'}`)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>

                      {/* Replace Certificate file upload */}
                      <label className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition flex items-center gap-1.5 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isUploadingFranchiseCert ? 'Uploading...' : 'Replace'}</span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          disabled={isUploadingFranchiseCert}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadFranchiseCertificate(file, viewingFranchiseeDetails);
                          }}
                        />
                      </label>

                      {/* Remove Certificate */}
                      <button
                        type="button"
                        onClick={() => handleRemoveFranchiseCertificate(viewingFranchiseeDetails)}
                        className="p-1.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                        title="Remove Certificate"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl border-2 border-dashed border-indigo-200/80 bg-indigo-50/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-600 flex items-center justify-center shrink-0">
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">No Certificate Issued Yet</h4>
                        <p className="text-[11px] text-slate-500">
                          Upload image (PNG/JPG) or PDF to grant official certificate to this franchisee partner.
                        </p>
                      </div>
                    </div>

                    <label className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20 active:scale-95 shrink-0">
                      {isUploadingFranchiseCert ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Certificate (Image/PDF)</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        disabled={isUploadingFranchiseCert}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadFranchiseCertificate(file, viewingFranchiseeDetails);
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setViewingFranchiseeDetails(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM DELETE CONFIRMATION MODAL OVERLAY */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-md p-6 sm:p-7 rounded-3xl border shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            } space-y-5 animate-in zoom-in-95 duration-200`}>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0 border border-rose-500/20">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold tracking-tight">Confirm Deletion</h3>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Partner ID: <strong className="font-mono text-indigo-500">{deleteConfirmTarget.id}</strong>
                </p>
              </div>
            </div>

            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
              } space-y-1.5 text-xs`}>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Are you sure you want to delete <span className="font-bold text-rose-600 dark:text-rose-400">{deleteConfirmTarget.fullName}</span>?
              </p>
              <p className={`text-[11px] leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                This will permanently remove the franchisee partner, contact info, and allocated subscription plan from Firebase Firestore.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDeleteFranchisee}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-lg shadow-rose-600/30 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Yes, Delete Record</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BRANCH DELETE CONFIRMATION MODAL */}
      {branchDeleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-md p-6 sm:p-7 rounded-3xl border shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            } space-y-5 animate-in zoom-in-95 duration-200`}>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0 border border-rose-500/20">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold tracking-tight">Delete Branch Location</h3>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Branch: <strong className="font-semibold text-rose-500">{branchDeleteTarget.name}</strong>
                </p>
              </div>
            </div>

            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
              } space-y-1.5 text-xs`}>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Are you sure you want to delete branch <span className="font-bold text-rose-600 dark:text-rose-400">"{branchDeleteTarget.name}"</span>?
              </p>
              <p className={`text-[11px] leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                This will remove the branch from the admission portal dropdown and analytics directory in real time.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingBranch}
                onClick={() => setBranchDeleteTarget(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isDeletingBranch}
                onClick={handleConfirmDeleteBranch}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-lg shadow-rose-600/30 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeletingBranch ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Yes, Delete Branch</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BRANCH EDIT MODAL */}
      {branchEditTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-md p-6 sm:p-7 rounded-3xl border shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            } space-y-5 animate-in zoom-in-95 duration-200`}>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-500/20">
                  <Edit className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold tracking-tight">Edit Branch Name</h3>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Current: <strong className="font-semibold text-indigo-500">{branchEditTarget.name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setBranchEditTarget(null); setEditBranchName(''); }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditBranch} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Branch / Location Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={editBranchName}
                    onChange={(e) => setEditBranchName(e.target.value)}
                    placeholder="Enter updated branch name..."
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode
                      ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                      }`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isUpdatingBranch}
                  onClick={() => { setBranchEditTarget(null); setEditBranchName(''); }}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isUpdatingBranch || !editBranchName.trim()}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-600/30 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isUpdatingBranch ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* COURSE DELETE CONFIRMATION MODAL */}
      {courseDeleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-md p-6 sm:p-7 rounded-3xl border shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            } space-y-5 animate-in zoom-in-95 duration-200`}>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0 border border-rose-500/20">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold tracking-tight">Delete Course</h3>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Course: <strong className="font-semibold text-rose-500">{courseDeleteTarget.name}</strong>
                </p>
              </div>
            </div>

            <div className={`p-4 rounded-2xl border ${isDarkMode
              ? 'bg-rose-950/30 border-rose-900/50 text-rose-100'
              : 'bg-rose-50/90 border-rose-200/90 text-slate-900'
              } space-y-2 text-xs`}>
              <p className={`font-black text-sm leading-snug ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Are you sure you want to delete course <span className="font-black text-rose-600 dark:text-rose-400 underline underline-offset-2">"{courseDeleteTarget.name}"</span>?
              </p>
              <p className={`text-xs font-medium leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                This will remove the course option from all student application forms in real time.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingCourse}
                onClick={() => setCourseDeleteTarget(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isDeletingCourse}
                onClick={handleConfirmDeleteCourse}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-lg shadow-rose-600/30 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeletingCourse ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Yes, Delete Course</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COURSE EDIT MODAL */}
      {courseEditTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-xl p-6 sm:p-7 rounded-3xl border shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            } space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto`}>

            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 border border-amber-500/20">
                  <Edit className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold tracking-tight">Edit Course Card</h3>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Modifying: <strong className="font-semibold text-amber-500">{courseEditTarget.name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCourseEditTarget(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditCourse} className="space-y-4">

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Short Code */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Course Code / Short Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editCourseForm.name}
                    onChange={(e) => {
                      const newCode = e.target.value;
                      const oldAuto = getCourseDisplayLabel({ name: editCourseForm.name });
                      const isUnsetOrShort = !editCourseForm.title || editCourseForm.title === editCourseForm.name || editCourseForm.title === oldAuto;
                      setEditCourseForm({
                        ...editCourseForm,
                        name: newCode,
                        title: isUnsetOrShort ? (getCourseDisplayLabel({ name: newCode }) || newCode) : editCourseForm.title
                      });
                    }}
                    placeholder="e.g. DCTTC, PGDCA..."
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${isDarkMode
                      ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-amber-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500'
                      }`}
                  />
                </div>

                {/* 2. Badge Tag */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Badge / Tag Label
                  </label>
                  <input
                    type="text"
                    value={editCourseForm.badge}
                    onChange={(e) => setEditCourseForm({ ...editCourseForm, badge: e.target.value })}
                    placeholder="e.g. Teacher Special, Advanced..."
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${isDarkMode
                      ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-amber-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500'
                      }`}
                  />
                </div>
              </div>

              {/* 3. Full Title */}
              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Full Course Title (Website Card Header) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editCourseForm.title}
                  onChange={(e) => setEditCourseForm({ ...editCourseForm, title: e.target.value })}
                  placeholder="e.g. DCTTC — Diploma in Computer Teacher Training Course"
                  className={`w-full px-3.5 py-2 rounded-xl border text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${isDarkMode
                    ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-amber-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500'
                    }`}
                />
              </div>

              {/* 6. Description */}
              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Course Overview Description
                </label>
                <textarea
                  rows={3}
                  value={editCourseForm.description}
                  onChange={(e) => setEditCourseForm({ ...editCourseForm, description: e.target.value })}
                  placeholder="Enter course description for landing page card..."
                  className={`w-full px-3.5 py-2 rounded-xl border text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none ${isDarkMode
                    ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-amber-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500'
                    }`}
                />
              </div>

              {/* 7. Image URL & File Upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Thumbnail Image
                  </label>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                    Upload File or Paste URL
                  </span>
                </div>

                <input
                  type="file"
                  ref={editCourseImageFileRef}
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadCourseImage(file, true);
                  }}
                  className="hidden"
                />

                <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                  <button
                    type="button"
                    disabled={isUploadingEditCourseImage}
                    onClick={() => editCourseImageFileRef.current?.click()}
                    className="px-3.5 py-2 rounded-xl border text-xs font-extrabold bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700 transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 cursor-pointer shrink-0 active:scale-95 disabled:opacity-50"
                  >
                    {isUploadingEditCourseImage ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Image</span>
                      </>
                    )}
                  </button>

                  <input
                    type="url"
                    value={editCourseForm.image}
                    onChange={(e) => setEditCourseForm({ ...editCourseForm, image: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className={`flex-1 px-3.5 py-2 rounded-xl border text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${isDarkMode
                      ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-amber-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500'
                      }`}
                  />
                  {editCourseForm.image && (
                    <div className="w-14 h-9 rounded-lg overflow-hidden border border-amber-400 dark:border-slate-700 shrink-0 bg-slate-100 shadow-sm">
                      <img src={editCourseForm.image} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] font-extrabold text-slate-400">Presets:</span>
                  <button
                    type="button"
                    onClick={() => setEditCourseForm({ ...editCourseForm, image: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=600' })}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-500 hover:text-white transition"
                  >
                    🎓 Classroom
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditCourseForm({ ...editCourseForm, image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=600' })}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-500 hover:text-white transition"
                  >
                    💻 IT
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditCourseForm({ ...editCourseForm, image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=600' })}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-500 hover:text-white transition"
                  >
                    📊 Finance
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditCourseForm({ ...editCourseForm, image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&q=80&w=600' })}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-500 hover:text-white transition"
                  >
                    ⚡ Coding
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isUpdatingCourse}
                  onClick={() => setCourseEditTarget(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isUpdatingCourse || (!editCourseForm.name.trim() && !editCourseForm.title.trim())}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-lg shadow-amber-500/30 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isUpdatingCourse ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* STUDENT TRANSFER CONFIRMATION MODAL */}
      {showTransferConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className={`w-full max-w-md p-6 sm:p-7 rounded-3xl border shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            } space-y-5 animate-in zoom-in-95 duration-200`}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-500/20">
                <ArrowLeftRight className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold tracking-tight">Confirm Branch Transfer</h3>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  This action will update student records in Firestore and local cache.
                </p>
              </div>
            </div>

            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
              } space-y-2 text-sm`}>
              <div className="flex justify-between">
                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Students to Transfer:</span>
                <span className="font-bold text-emerald-600">
                  {transferSelectedIds.length > 0 ? `${transferSelectedIds.length} selected` : `ALL ${transferStudentsList.length}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>From Branch:</span>
                <span className="font-bold text-rose-500">{transferFromBranch}</span>
              </div>
              <div className="flex justify-between">
                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>To Branch:</span>
                <span className="font-bold text-teal-600">{transferToBranch}</span>
              </div>

              {transferSelectedIds.length > 0 && transferSelectedIds.length <= 6 && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-xs font-semibold text-slate-500">Selected Students:</span>
                  <div className="space-y-1 text-xs">
                    {transferStudentsList
                      .filter(s => transferSelectedIds.includes(s.id))
                      .map(s => (
                        <div key={s.id} className="text-slate-700 dark:text-slate-300 truncate flex items-center justify-between">
                          <span className="truncate">{s.fullName || s.studentName || s.name}</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0 ml-2">
                            Reg. No: {s.registrationNo || s.regNo || s.id}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              All selected student records will have their branch/centre updated to <strong className="text-teal-600">"{transferToBranch}"</strong>. This will be reflected across all related Firestore collections and local caches.
            </p>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowTransferConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmTransfer}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/30 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>Yes, Transfer Students</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIRECTOR DELETE CONFIRMATION MODAL */}
      {directorDeleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-md p-6 sm:p-7 rounded-3xl border shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            } space-y-5 animate-in zoom-in-95 duration-200`}>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0 border border-rose-500/20">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold tracking-tight">Delete Director</h3>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Director: <strong className="font-semibold text-rose-500">{directorDeleteTarget.name}</strong>
                </p>
              </div>
            </div>

            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
              } space-y-1.5 text-xs`}>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Are you sure you want to delete <span className="font-bold text-rose-600 dark:text-rose-400">"{directorDeleteTarget.name}"</span> ({directorDeleteTarget.role})?
              </p>
              <p className={`text-[11px] leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                This will remove the director profile from the public landing page in real time.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingDirector}
                onClick={() => setDirectorDeleteTarget(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isDeletingDirector}
                onClick={handleConfirmDeleteDirector}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-lg shadow-rose-600/30 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeletingDirector ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Yes, Delete Director</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIRECTOR EDIT MODAL */}
      {directorEditTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-lg p-6 sm:p-7 rounded-3xl border shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            } space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto`}>

            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 border border-blue-500/20">
                  <Edit className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold tracking-tight">Edit Director Profile</h3>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Editing: <strong className="font-semibold text-blue-500">{directorEditTarget.name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDirectorEditTarget(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditDirector} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Director Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editDirectorForm.name}
                  onChange={(e) => setEditDirectorForm({ ...editDirectorForm, name: e.target.value })}
                  placeholder="e.g. Mr. B. Sunil"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${isDarkMode
                    ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-blue-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                    }`}
                />
              </div>

              {/* Designation / Role */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Designation / Role <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editDirectorForm.role}
                  onChange={(e) => setEditDirectorForm({ ...editDirectorForm, role: e.target.value })}
                  placeholder="e.g. Managing Director / Chairman"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${isDarkMode
                    ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-blue-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                    }`}
                />
              </div>

              {/* Email / Website */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Email / Contact Info
                </label>
                <input
                  type="text"
                  value={editDirectorForm.email}
                  onChange={(e) => setEditDirectorForm({ ...editDirectorForm, email: e.target.value })}
                  placeholder="e.g. Founder@sleinstitutions.com"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${isDarkMode
                    ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-blue-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                    }`}
                />
              </div>

              {/* Display Order */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Display Order
                </label>
                <input
                  type="number"
                  min="1"
                  value={editDirectorForm.order}
                  onChange={(e) => setEditDirectorForm({ ...editDirectorForm, order: e.target.value })}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${isDarkMode
                    ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-blue-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                    }`}
                />
              </div>

              {/* Photo Upload & Preview */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Photo (Upload file or enter URL)
                </label>

                <input
                  type="file"
                  ref={editDirectorImageFileRef}
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadDirectorImage(file, true);
                  }}
                  className="hidden"
                />

                <div className="flex flex-col sm:flex-row gap-3 items-center">
                  <button
                    type="button"
                    disabled={isUploadingEditDirectorImage}
                    onClick={() => editDirectorImageFileRef.current?.click()}
                    className="px-4 py-2.5 rounded-xl border text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer shrink-0 active:scale-95 disabled:opacity-50"
                  >
                    {isUploadingEditDirectorImage ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>Upload Photo</span>
                      </>
                    )}
                  </button>

                  <input
                    type="text"
                    value={editDirectorForm.image}
                    onChange={(e) => setEditDirectorForm({ ...editDirectorForm, image: e.target.value })}
                    placeholder="Photo URL..."
                    className={`flex-1 w-full px-3.5 py-2.5 rounded-xl border text-xs transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${isDarkMode
                      ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-blue-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                      }`}
                  />

                  {editDirectorForm.image && (
                    <div className="w-12 h-9 rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                      <img
                        src={editDirectorForm.image}
                        alt="Preview"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.target.src = "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400";
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isUpdatingDirector}
                  onClick={() => setDirectorEditTarget(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isUpdatingDirector || !editDirectorForm.name.trim()}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-600/30 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isUpdatingDirector ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXAM QUESTION PAPER PRINT / PREVIEW MODAL */}
      {isPreviewPaperOpen && (() => {
        const targetP = previewTargetPaper || {
          courseName: selectedPaperCourse,
          subjectName: selectedPaperSubject,
          questions: paperQuestions,
          totalMarks: paperQuestions.reduce((acc, q) => acc + (Number(q.marks) || 2), 0),
          totalQuestions: paperQuestions.length
        };
        const activeQuestions = targetP.questions || [];

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="w-full max-w-4xl max-h-[90vh] bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 overflow-y-auto space-y-6 flex flex-col">

              {/* Modal Header */}
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-600 flex items-center justify-center font-bold">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Official Examination Paper Preview</h3>
                    <p className="text-xs text-slate-500">{targetP.courseName} • {targetP.subjectName} ({targetP.totalMarks || 200} Total Marks)</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => printQuestionPaperDirectly(targetP)}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-600/25 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Paper (A4)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsPreviewPaperOpen(false); setPreviewTargetPaper(null); }}
                    className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Official Formatted Examination Paper Layout */}
              <div className="p-8 border-2 border-slate-900 rounded-2xl bg-white space-y-6 shadow-sm font-sans text-xs">

                {/* Paper Header */}
                <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
                  <h2 className="text-base sm:text-lg font-black tracking-wide uppercase">
                    SHREE LAXMI EDUCATION SOCIETY (R.)
                  </h2>
                  <p className="text-[11px] font-bold text-slate-700">
                    NATIONAL COUNCIL OF VOCATIONAL TRAINING & COMPUTER EDUCATION
                  </p>
                  <div className="pt-2 flex flex-wrap items-center justify-between text-[11px] font-bold uppercase border-t border-slate-300 mt-2">
                    <span>Course: <strong>{targetP.courseName}</strong></span>
                    <span>Subject: <strong>{targetP.subjectName}</strong></span>
                    <span>Max Marks: <strong>{targetP.totalMarks || 200}</strong></span>
                    <span>Time: <strong>3 Hours (180 Mins)</strong></span>
                  </div>
                </div>

                {/* Instructions */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-300 text-[11px] space-y-1">
                  <strong className="block font-black uppercase text-slate-800">General Instructions:</strong>
                  <ol className="list-decimal list-inside space-y-0.5 text-slate-600">
                    <li>This examination paper consists of <strong>{activeQuestions.length} Multiple Choice Questions (MCQs)</strong>.</li>
                    <li>Each question carries <strong>2 Marks</strong> (Total = {targetP.totalMarks || 200} Marks).</li>
                    <li>Darken the correct circle (A, B, C, or D) on the OMR answer sheet.</li>
                    <li>Passing marks for this examination is <strong>70 Marks (35%)</strong>.</li>
                  </ol>
                </div>

                {/* Questions list */}
                <div className="space-y-4 pt-2">
                  {activeQuestions.map((q, idx) => (
                    <div key={q.id || idx} className="border-b border-slate-200 pb-3 space-y-1.5 break-inside-avoid">
                      <div className="flex items-start justify-between font-bold text-slate-900 text-xs">
                        <span>Q{idx + 1}. {q.question || `[Question #${idx + 1}]`}</span>
                        <span className="text-[10px] text-slate-500 shrink-0 ml-2 font-mono">[{q.marks || 2} Marks]</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pl-3 text-slate-700">
                        <div><strong>(A)</strong> {q.options?.[0] || '—'}</div>
                        <div><strong>(B)</strong> {q.options?.[1] || '—'}</div>
                        <div><strong>(C)</strong> {q.options?.[2] || '—'}</div>
                        <div><strong>(D)</strong> {q.options?.[3] || '—'}</div>
                      </div>
                    </div>
                  ))}
                </div>

              </div>

            </div>
          </div>
        );
      })()}

      {/* LIGHTBOX DOCUMENT VIEWER MODAL */}
      {viewingDocument && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md overflow-hidden animate-in fade-in duration-200">
          <div className="w-full max-w-5xl xl:max-w-6xl h-[92vh] max-h-[92vh] flex flex-col bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200">

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 sm:px-5 border-b border-slate-200 bg-slate-50/90 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                    {viewingDocument.title || 'Document Preview'}
                  </h3>
                  <p className="text-[11px] text-slate-500">Official Verification Attachment</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Open in new tab via Blob or HTML wrapper */}
                <button
                  type="button"
                  onClick={() => handleOpenInNewWindow(viewingDocument.url, viewingDocument.title)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition flex items-center gap-1.5 cursor-pointer"
                  title="Open in new window"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">New Tab</span>
                </button>

                {/* Download button */}
                <button
                  type="button"
                  onClick={() => handleDownloadDoc(viewingDocument.url, `${(viewingDocument.title || 'document').toLowerCase().replace(/[^a-z0-9]/g, '_')}`)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Download document file"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </button>

                {/* Close button */}
                <button
                  type="button"
                  onClick={() => setViewingDocument(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body Viewer */}
            <div className="flex-1 min-h-0 w-full relative bg-slate-900/5 overflow-hidden flex items-center justify-center p-1 sm:p-2">
              {viewingDocument.url.startsWith('data:application/pdf') || viewingDocument.url.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={`${viewingDocument.url}${viewingDocument.url.includes('#') ? '' : '#view=Fit&toolbar=1'}`}
                  title={viewingDocument.title}
                  className="w-full h-full border-0 bg-white rounded-xl shadow-xs"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-2 sm:p-4 overflow-auto">
                  <img
                    src={viewingDocument.url}
                    alt={viewingDocument.title}
                    className="max-w-full max-h-full w-auto h-auto object-contain rounded-xl shadow-lg border border-slate-200 bg-white"
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50/90 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <span className="text-[11px] truncate">Use controls above to download or open full size in new tab</span>
              <button
                type="button"
                onClick={() => setViewingDocument(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                Close Preview
              </button>
            </div>

          </div>
        </div>
      )}

      {/* QUICK FRANCHISEE CERTIFICATE MODAL */}
      {certModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-gradient-to-r from-amber-50 to-white">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0 border border-amber-500/20">
                  <Award className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-black tracking-tight truncate">
                    Franchisee Certificate
                  </h3>
                  <p className="text-xs text-slate-500 truncate">
                    {certModalTarget.franchiseName || certModalTarget.centerName || certModalTarget.fullName} • ID: <span className="font-mono font-bold text-amber-700">{certModalTarget.id}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCertModalTarget(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {certModalTarget.franchiseCertificateUrl ? (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl border border-indigo-100 bg-indigo-50/30 flex items-center gap-3">
                    <div
                      onClick={() => handleOpenDocument(certModalTarget.franchiseCertificateUrl, `Franchisee Certificate - ${certModalTarget.franchiseName || certModalTarget.fullName || 'Center'}`)}
                      className="w-16 h-16 rounded-xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center shrink-0 cursor-pointer shadow-xs hover:scale-105 transition-transform"
                      title="Click to preview certificate"
                    >
                      {certModalTarget.franchiseCertificateType === 'pdf' || certModalTarget.franchiseCertificateUrl.startsWith('data:application/pdf') || certModalTarget.franchiseCertificateUrl.toLowerCase().endsWith('.pdf') ? (
                        <FileText className="w-8 h-8 text-indigo-600" />
                      ) : (
                        <img src={certModalTarget.franchiseCertificateUrl} alt="Certificate" className="w-full h-full object-cover" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate block">
                          {certModalTarget.franchiseCertificateName || 'Franchisee Certificate'}
                        </span>
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">
                          Active
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Issued: {certModalTarget.franchiseCertificateIssuedAt || 'Today'} {certModalTarget.franchiseCertificateSize ? `• ${certModalTarget.franchiseCertificateSize}` : ''}
                      </p>
                      <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                        ✓ Visible on franchisee portal profile for view & download
                      </p>
                    </div>
                  </div>

                  {/* Actions for existing cert */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenDocument(certModalTarget.franchiseCertificateUrl, `Franchisee Certificate - ${certModalTarget.franchiseName || certModalTarget.fullName || 'Center'}`)}
                      className="py-2 px-3 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview Certificate</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadDoc(certModalTarget.franchiseCertificateUrl, `Franchisee_Certificate_${certModalTarget.id}`)}
                      className="py-2 px-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download File</span>
                    </button>
                  </div>

                  {/* Replace Dropzone */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <label className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 cursor-pointer py-1">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingFranchiseCert ? 'Uploading new file...' : 'Upload Replacement Certificate'}</span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        disabled={isUploadingFranchiseCert}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadFranchiseCertificate(file, certModalTarget);
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => handleRemoveFranchiseCertificate(certModalTarget)}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer py-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* No certificate: Upload interface */
                <div className="space-y-4">
                  <div className="p-6 rounded-2xl border-2 border-dashed border-indigo-200/80 bg-indigo-50/20 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900">Upload Official Franchisee Certificate</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-xs">
                        Upload an official Certificate as an <strong>Image (PNG/JPG)</strong> or <strong>PDF file</strong>.
                      </p>
                    </div>

                    <label className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition shadow-md shadow-indigo-600/20 active:scale-95 cursor-pointer flex items-center gap-2">
                      {isUploadingFranchiseCert ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Uploading & Issuing...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>Select Image or PDF</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        disabled={isUploadingFranchiseCert}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadFranchiseCertificate(file, certModalTarget);
                        }}
                      />
                    </label>

                    <span className="text-[10px] text-slate-400">Supported: PDF, PNG, JPG, JPEG, WEBP (Up to 5MB)</span>
                  </div>

                  <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                    Once uploaded, the certificate will be immediately available in the franchisee portal profile section for this partner to view and download.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setCertModalTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
