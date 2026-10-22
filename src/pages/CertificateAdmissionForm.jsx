
import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Users,
  MapPin,
  Mail,
  Phone,
  CreditCard,
  FileCheck,
  BookOpen,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Printer,
  Sparkles,
  X,
  ArrowRight,
  Camera,
  CameraOff,
  RefreshCw,
  FileText,
  Eye,
  Crop,
  Check,
  Award,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { db, doc, setDoc, deleteDoc, collection, getDocs, getDoc } from '../firebase';
import { useLocation } from 'react-router-dom';
import { uploadToCloudinary, compressImage } from '../utils/cloudinary';
import { subscribeToBranches, DEFAULT_BRANCHES } from '../utils/branchManager';
import { subscribeToCourses, DEFAULT_COURSES, getCourseDisplayLabel } from '../utils/courseManager';
import { allocateNextCertRegistrationNo, peekNextCertRegistrationNo, getCertBaseRegNo } from '../utils/certRegistrationManager';
import { recordTransaction } from '../utils/transactionManager';
import ImageCropperModal from '../components/ImageCropperModal';

export default function CertificateAdmissionForm() {
  const location = useLocation();
  const today = new Date().toISOString().split('T')[0];

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    fatherName: '',
    dobDay: '',
    dobMonth: '',
    dobYear: '',
    casteCategory: '',
    address: '',
    email: '',
    contactNo: '',
    aadharNo: '',
    sslcMarksNo: '',
    qualification: '',
    course: '',
    trustBranch: '',
    declared: false,
    registrationNo: `SLE-${getCertBaseRegNo(today)}`,
    admissionDate: today,
    selectedClass: '10th',
    trainingPlan: 'Regular'
  });

  // Photo State
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const fileInputRef = useRef(null);

  // Aadhar Card Document State (Supports PDF & Images, Max 5MB -> Compress to ~200KB)
  const [aadharFile, setAadharFile] = useState(null);
  const [aadharPreview, setAadharPreview] = useState(null);
  const [aadharFileType, setAadharFileType] = useState('');
  const [aadharFileName, setAadharFileName] = useState('');
  const [aadharFileSize, setAadharFileSize] = useState(0);
  const [aadharError, setAadharError] = useState('');
  const [isCompressingAadhar, setIsCompressingAadhar] = useState(false);
  const aadharInputRef = useRef(null);

  // Marksheet Document State (Supports PDF & Images, Max 5MB -> Compress to ~200KB)
  const [marksheetFile, setMarksheetFile] = useState(null);
  const [marksheetPreview, setMarksheetPreview] = useState(null);
  const [marksheetFileType, setMarksheetFileType] = useState('');
  const [marksheetFileName, setMarksheetFileName] = useState('');
  const [marksheetFileSize, setMarksheetFileSize] = useState(0);
  const [marksheetError, setMarksheetError] = useState('');
  const [isCompressingMarksheet, setIsCompressingMarksheet] = useState(false);
  const marksheetInputRef = useRef(null);

  // Live Camera Capture State
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraTarget, setCameraTarget] = useState('photo'); // 'photo' | 'aadhar' | 'marksheet'
  const [facingMode, setFacingMode] = useState('user');
  const [cameraError, setCameraError] = useState('');
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const videoRef = useRef(null);
  const mediaStreamRef = useRef(null);

  // Image Cropper State
  const [cropModalData, setCropModalData] = useState(null);
  // Full Screen Document & Photo Lightbox Preview State
  const [previewLightboxData, setPreviewLightboxData] = useState(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  // Real State-Driven Submission Overlay State
  const [submissionStatus, setSubmissionStatus] = useState(null); // 'step1' | 'step2' | 'step3' | 'success' | 'error'
  const [submissionError, setSubmissionError] = useState('');
  const pendingSubmissionRef = useRef({ appNumber: '', paymentId: '', orderId: '' });

  // Tab Closure & Refresh Guard during active submission
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (submissionStatus && submissionStatus !== 'error') {
        e.preventDefault();
        e.returnValue = 'Admission submission is in progress. Please do not close or refresh this page!';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [submissionStatus]);

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [currentDraftAppNumber, setCurrentDraftAppNumber] = useState('');

  // Fee State (Configured dynamically from Admin Portal: sle_cert_standard_fee)
  const [applicableFee, setApplicableFee] = useState(() => {
    return Number(localStorage.getItem('sle_cert_standard_fee')) || Number(localStorage.getItem('sle_standard_fee')) || 500;
  });

  // Dynamic Courses & Branches
  const [coursesList, setCoursesList] = useState(DEFAULT_COURSES);
  const [placesList, setPlacesList] = useState(DEFAULT_BRANCHES);

  // Fetch Pricing Settings (supports real-time Certificate Fee)
  useEffect(() => {
    const applyStoredFee = () => {
      const storedCert = Number(localStorage.getItem('sle_cert_standard_fee'));
      const storedStandard = Number(localStorage.getItem('sle_standard_fee'));
      if (storedCert) setApplicableFee(storedCert);
      else if (storedStandard) setApplicableFee(storedStandard);
    };

    applyStoredFee();
    window.addEventListener('storage', applyStoredFee);

    if (!db) return;
    let isMounted = true;
    (async () => {
      try {
        let loadedFee = null;
        const snap1 = await getDoc(doc(db, 'system_settings', 'franchisee_pricing'));
        if (snap1 && snap1.exists()) {
          const d1 = snap1.data();
          if (d1?.certStandardFee) loadedFee = Number(d1.certStandardFee);
        }
        if (!loadedFee) {
          const snap2 = await getDoc(doc(db, 'system_settings', 'pricing'));
          if (snap2 && snap2.exists()) {
            const d2 = snap2.data();
            if (d2?.certStandardFee) loadedFee = Number(d2.certStandardFee);
            else if (d2?.standardFee && !localStorage.getItem('sle_cert_standard_fee')) loadedFee = Number(d2.standardFee);
          }
        }

        if (isMounted && loadedFee) {
          setApplicableFee(loadedFee);
          localStorage.setItem('sle_cert_standard_fee', String(loadedFee));
        }
      } catch (e) {}
    })();

    return () => {
      isMounted = false;
      window.removeEventListener('storage', applyStoredFee);
    };
  }, []);

  // Subscribe to Courses
  useEffect(() => {
    const unsubscribe = subscribeToCourses((courses) => {
      if (Array.isArray(courses) && courses.length > 0) {
        setCoursesList(courses.map(c => typeof c === 'string' ? c : c.name).filter(Boolean));
      }
    });
    return () => unsubscribe && unsubscribe();
  }, []);

  // Subscribe to Branches
  useEffect(() => {
    const unsubscribe = subscribeToBranches((branches) => {
      if (Array.isArray(branches) && branches.length > 0) {
        const unique = Array.from(new Set(branches.map(b => typeof b === 'string' ? b : b.name).filter(Boolean))).sort();
        setPlacesList(unique);
      }
    });
    return () => unsubscribe && unsubscribe();
  }, []);

  // Peek next certificate registration number based on admission year
  const fetchNextRegistrationNo = async (targetDate) => {
    const dateToUse = targetDate || formData.admissionDate || today;
    try {
      const nextReg = await peekNextCertRegistrationNo(db, dateToUse);
      setFormData(prev => ({ ...prev, registrationNo: nextReg }));
    } catch (e) {
      setFormData(prev => ({ ...prev, registrationNo: `SLE-${getCertBaseRegNo(dateToUse)}` }));
    }
  };

  useEffect(() => {
    fetchNextRegistrationNo(formData.admissionDate);
  }, [formData.admissionDate]);

  useEffect(() => {
    // Auto-fill branch if logged in franchisee
    try {
      const portalUser = JSON.parse(localStorage.getItem('sle_portal_user_data') || '{}');
      const branchName = portalUser?.location || portalUser?.trustBranch || portalUser?.centerCity || '';
      if (branchName) {
        setFormData(prev => ({ ...prev, trustBranch: prev.trustBranch || branchName }));
      }
    } catch (e) {}
  }, []);

  // DOB helpers
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1980 + 1 }, (_, i) => 1980 + i);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Field change handler
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let finalVal = type === 'checkbox' ? checked : value;

    if (name === 'contactNo') {
      finalVal = value.replace(/\D/g, '').slice(0, 10);
    } else if (name === 'aadharNo') {
      finalVal = value.replace(/\D/g, '').slice(0, 12);
    }

    setFormData(prev => ({ ...prev, [name]: finalVal }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Dedicated state for Date of Birth input display text (allows manual typing & editing)
  const [dobInputDisplay, setDobInputDisplay] = useState('');

  // Helper to parse manual date string (DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, DDMMYYYY, DD Month YYYY)
  const parseDobString = (text) => {
    if (!text) return null;
    const clean = text.trim();

    // 1. DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
    let match = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (match) {
      const d = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const y = match[3];
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return {
          day: String(d),
          month: months[m - 1],
          year: y,
          iso: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        };
      }
    }

    // 2. YYYY-MM-DD
    match = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (match) {
      const y = match[1];
      const m = parseInt(match[2], 10);
      const d = parseInt(match[3], 10);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return {
          day: String(d),
          month: months[m - 1],
          year: y,
          iso: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        };
      }
    }

    // 3. 8 continuous digits: DDMMYYYY
    match = clean.match(/^(\d{2})(\d{2})(\d{4})$/);
    if (match) {
      const d = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const y = match[3];
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return {
          day: String(d),
          month: months[m - 1],
          year: y,
          iso: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        };
      }
    }

    // 4. DD Month YYYY (e.g. "15 August 2005" or "15-Aug-2005")
    match = clean.match(/^(\d{1,2})[\s\-_]+([A-Za-z]+)[\s\-_]+(\d{4})$/);
    if (match) {
      const d = parseInt(match[1], 10);
      const mStr = match[2].toLowerCase();
      const y = match[3];
      const mIdx = months.findIndex(m => m.toLowerCase().startsWith(mStr.slice(0, 3)));
      if (mIdx >= 0 && d >= 1 && d <= 31) {
        return {
          day: String(d),
          month: months[mIdx],
          year: y,
          iso: `${y}-${String(mIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        };
      }
    }

    return null;
  };

  // Helper to format ISO value for calendar picker
  const getDobIsoValue = () => {
    if (formData.dob && /^\d{4}-\d{2}-\d{2}$/.test(formData.dob)) {
      return formData.dob;
    }
    if (formData.dobYear && formData.dobMonth && formData.dobDay) {
      let mIdx = months.indexOf(formData.dobMonth);
      if (mIdx === -1 && !isNaN(formData.dobMonth)) mIdx = parseInt(formData.dobMonth, 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        const mm = String(mIdx + 1).padStart(2, '0');
        const dd = String(parseInt(formData.dobDay, 10)).padStart(2, '0');
        return `${formData.dobYear}-${mm}-${dd}`;
      }
    }
    const parsed = parseDobString(dobInputDisplay);
    if (parsed) return parsed.iso;
    return '';
  };

  // Custom Interactive Calendar State
  const [showCalendarPopover, setShowCalendarPopover] = useState(false);
  const [calendarViewMode, setCalendarViewMode] = useState('days'); // 'days' | 'months' | 'years'
  const [calendarViewDate, setCalendarViewDate] = useState(() => {
    const defYear = Math.max(1980, currentYear - 16);
    return new Date(defYear, 0, 1);
  });
  const calendarPopoverRef = useRef(null);
  const yearsContainerRef = useRef(null);

  // Sync display text if formData.dob changes externally or from draft
  useEffect(() => {
    if (!dobInputDisplay && (formData.dob || (formData.dobDay && formData.dobMonth && formData.dobYear))) {
      if (formData.dob && /^\d{4}-\d{2}-\d{2}$/.test(formData.dob)) {
        const [y, m, d] = formData.dob.split('-');
        setDobInputDisplay(`${d}-${m}-${y}`);
      } else if (formData.dobDay && formData.dobMonth && formData.dobYear) {
        let mIdx = months.indexOf(formData.dobMonth);
        if (mIdx === -1 && !isNaN(formData.dobMonth)) mIdx = parseInt(formData.dobMonth, 10) - 1;
        const mm = mIdx >= 0 ? String(mIdx + 1).padStart(2, '0') : '01';
        setDobInputDisplay(`${String(parseInt(formData.dobDay, 10)).padStart(2, '0')}-${mm}-${formData.dobYear}`);
      }
    }
  }, [formData.dob, formData.dobDay, formData.dobMonth, formData.dobYear]);

  // Outside click & Escape key listener for Custom Calendar Popover
  useEffect(() => {
    if (!showCalendarPopover) return;
    const handleClickOutside = (e) => {
      if (calendarPopoverRef.current && !calendarPopoverRef.current.contains(e.target)) {
        setShowCalendarPopover(false);
        setCalendarViewMode('days');
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowCalendarPopover(false);
        setCalendarViewMode('days');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showCalendarPopover]);

  // Auto-scroll to selected year when Year view mode is activated
  useEffect(() => {
    if (calendarViewMode === 'years' && yearsContainerRef.current) {
      const activeBtn = yearsContainerRef.current.querySelector('[data-selected="true"]');
      if (activeBtn) {
        activeBtn.scrollIntoView({ block: 'center', behavior: 'auto' });
      }
    }
  }, [calendarViewMode]);

  // Toggle Custom Interactive Calendar Popover
  const toggleCalendar = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!showCalendarPopover) {
      const iso = getDobIsoValue();
      if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        const [y, m, d] = iso.split('-').map(Number);
        setCalendarViewDate(new Date(y, m - 1, d || 1));
      } else {
        const defYear = Math.max(1980, currentYear - 16);
        setCalendarViewDate(new Date(defYear, 0, 1));
      }
      setCalendarViewMode('days');
      setShowCalendarPopover(true);
    } else {
      setShowCalendarPopover(false);
      setCalendarViewMode('days');
    }
  };

  // Day selection in Custom Calendar
  const handleSelectCalendarDay = (targetYear, targetMonthIndex, targetDay) => {
    const y = targetYear;
    const m = targetMonthIndex + 1;
    const d = targetDay;
    const isoVal = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const displayStr = `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`;

    setDobInputDisplay(displayStr);
    setFormData(prev => ({
      ...prev,
      dob: isoVal,
      dateOfBirth: isoVal,
      dobDay: String(d),
      dobMonth: months[targetMonthIndex],
      dobYear: String(y)
    }));

    if (formErrors.dob) {
      setFormErrors(prev => ({ ...prev, dob: null }));
    }
    setShowCalendarPopover(false);
    setCalendarViewMode('days');
  };

  // Clear DOB selection
  const handleClearDob = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setDobInputDisplay('');
    setFormData(prev => ({
      ...prev,
      dob: '',
      dateOfBirth: '',
      dobDay: '',
      dobMonth: '',
      dobYear: ''
    }));
    setShowCalendarPopover(false);
  };

  // Select Today
  const handleSelectToday = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const now = new Date();
    handleSelectCalendarDay(now.getFullYear(), now.getMonth(), now.getDate());
  };

  // Manual typing & editing handler
  const handleManualDobChange = (e) => {
    const text = e.target.value;
    setDobInputDisplay(text);

    const parsed = parseDobString(text);
    if (parsed) {
      setFormData(prev => ({
        ...prev,
        dob: parsed.iso,
        dateOfBirth: parsed.iso,
        dobDay: parsed.day,
        dobMonth: parsed.month,
        dobYear: parsed.year
      }));
      const mIdx = months.indexOf(parsed.month);
      if (mIdx >= 0) {
        setCalendarViewDate(new Date(parseInt(parsed.year, 10), mIdx, parseInt(parsed.day, 10)));
      }
      if (formErrors.dob) {
        setFormErrors(prev => ({ ...prev, dob: null }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        dob: text,
        dobDay: '',
        dobMonth: '',
        dobYear: ''
      }));
    }
  };

  // Computed values for interactive calendar popover
  const calendarViewYear = calendarViewDate.getFullYear();
  const calendarViewMonth = calendarViewDate.getMonth(); // 0 to 11

  // First day of current view month (0 = Sun, 1 = Mon, ... 6 = Sat)
  const firstDayOfWeek = new Date(calendarViewYear, calendarViewMonth, 1).getDay();
  // Total days in view month
  const totalDaysInMonth = new Date(calendarViewYear, calendarViewMonth + 1, 0).getDate();
  // Total days in previous month
  const totalDaysInPrevMonth = new Date(calendarViewYear, calendarViewMonth, 0).getDate();

  // Previous month trailing days to show
  const prevMonthDays = Array.from({ length: firstDayOfWeek }, (_, i) => {
    return totalDaysInPrevMonth - firstDayOfWeek + 1 + i;
  });

  // Current month days
  const currentMonthDays = Array.from({ length: totalDaysInMonth }, (_, i) => i + 1);

  // Next month leading days to complete grid (up to 35 or 42 cells)
  const totalCellsSoFar = firstDayOfWeek + totalDaysInMonth;
  const targetTotalGridSlots = totalCellsSoFar > 35 ? 42 : 35;
  const nextMonthDaysCount = targetTotalGridSlots - totalCellsSoFar;
  const nextMonthDays = Array.from({ length: nextMonthDaysCount }, (_, i) => i + 1);

  // Currently selected date breakdown
  const selectedDobIso = getDobIsoValue();
  let selYearNum = null;
  let selMonthNum = null;
  let selDayNum = null;
  if (selectedDobIso && /^\d{4}-\d{2}-\d{2}$/.test(selectedDobIso)) {
    const parts = selectedDobIso.split('-').map(Number);
    selYearNum = parts[0];
    selMonthNum = parts[1] - 1; // 0-indexed month
    selDayNum = parts[2];
  }

  const todayObj = new Date();
  const todayYearNum = todayObj.getFullYear();
  const todayMonthNum = todayObj.getMonth();
  const todayDayNum = todayObj.getDate();

  // Full list of selectable years for Year view (from 1970 to current year)
  const calendarYearsList = Array.from({ length: currentYear - 1970 + 1 }, (_, i) => 1970 + i).reverse();

  // ─────────────────────────────────────────────────────────────
  // Custom Interactive Calendar State & Handlers for Admission Date
  // ─────────────────────────────────────────────────────────────
  const [admissionDateInputDisplay, setAdmissionDateInputDisplay] = useState(() => {
    if (formData.admissionDate && /^\d{4}-\d{2}-\d{2}$/.test(formData.admissionDate)) {
      const [y, m, d] = formData.admissionDate.split('-');
      return `${d}-${m}-${y}`;
    }
    const [y, m, d] = today.split('-');
    return `${d}-${m}-${y}`;
  });

  const [showAdmissionCalPopover, setShowAdmissionCalPopover] = useState(false);
  const [admissionCalViewMode, setAdmissionCalViewMode] = useState('days'); // 'days' | 'months' | 'years'
  const [admissionCalViewDate, setAdmissionCalViewDate] = useState(() => new Date());
  const admissionCalPopoverRef = useRef(null);
  const admissionYearsContainerRef = useRef(null);

  // Sync display text if formData.admissionDate changes
  useEffect(() => {
    if (formData.admissionDate && /^\d{4}-\d{2}-\d{2}$/.test(formData.admissionDate)) {
      const [y, m, d] = formData.admissionDate.split('-');
      setAdmissionDateInputDisplay(`${d}-${m}-${y}`);
    }
  }, [formData.admissionDate]);

  // Outside click & Escape listener for Admission Date popover
  useEffect(() => {
    if (!showAdmissionCalPopover) return;
    const handleClickOutside = (e) => {
      if (admissionCalPopoverRef.current && !admissionCalPopoverRef.current.contains(e.target)) {
        setShowAdmissionCalPopover(false);
        setAdmissionCalViewMode('days');
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowAdmissionCalPopover(false);
        setAdmissionCalViewMode('days');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showAdmissionCalPopover]);

  // Auto-scroll to selected year when Year view mode is activated for Admission Date
  useEffect(() => {
    if (admissionCalViewMode === 'years' && admissionYearsContainerRef.current) {
      const activeBtn = admissionYearsContainerRef.current.querySelector('[data-selected="true"]');
      if (activeBtn) {
        activeBtn.scrollIntoView({ block: 'center', behavior: 'auto' });
      }
    }
  }, [admissionCalViewMode]);

  // Toggle Admission Date Calendar Popover
  const toggleAdmissionCalendar = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!showAdmissionCalPopover) {
      if (formData.admissionDate && /^\d{4}-\d{2}-\d{2}$/.test(formData.admissionDate)) {
        const [y, m, d] = formData.admissionDate.split('-').map(Number);
        setAdmissionCalViewDate(new Date(y, m - 1, d || 1));
      } else {
        setAdmissionCalViewDate(new Date());
      }
      setAdmissionCalViewMode('days');
      setShowAdmissionCalPopover(true);
    } else {
      setShowAdmissionCalPopover(false);
      setAdmissionCalViewMode('days');
    }
  };

  // Day selection in Admission Date Calendar
  const handleSelectAdmissionDay = (targetYear, targetMonthIndex, targetDay) => {
    const y = targetYear;
    const m = targetMonthIndex + 1;
    const d = targetDay;
    const isoVal = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const displayStr = `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`;

    setAdmissionDateInputDisplay(displayStr);
    setFormData(prev => ({
      ...prev,
      admissionDate: isoVal
    }));
    setShowAdmissionCalPopover(false);
    setAdmissionCalViewMode('days');
  };

  // Manual typing for Admission Date
  const handleManualAdmissionDateChange = (e) => {
    const text = e.target.value;
    setAdmissionDateInputDisplay(text);

    const parsed = parseDobString(text);
    if (parsed) {
      setFormData(prev => ({
        ...prev,
        admissionDate: parsed.iso
      }));
      const mIdx = months.indexOf(parsed.month);
      if (mIdx >= 0) {
        setAdmissionCalViewDate(new Date(parseInt(parsed.year, 10), mIdx, parseInt(parsed.day, 10)));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        admissionDate: text
      }));
    }
  };

  // Computed values for Admission Date calendar popover
  const admissionCalViewYear = admissionCalViewDate.getFullYear();
  const admissionCalViewMonth = admissionCalViewDate.getMonth();

  const admFirstDayOfWeek = new Date(admissionCalViewYear, admissionCalViewMonth, 1).getDay();
  const admTotalDaysInMonth = new Date(admissionCalViewYear, admissionCalViewMonth + 1, 0).getDate();
  const admTotalDaysInPrevMonth = new Date(admissionCalViewYear, admissionCalViewMonth, 0).getDate();

  const admPrevMonthDays = Array.from({ length: admFirstDayOfWeek }, (_, i) => {
    return admTotalDaysInPrevMonth - admFirstDayOfWeek + 1 + i;
  });
  const admCurrentMonthDays = Array.from({ length: admTotalDaysInMonth }, (_, i) => i + 1);

  const admTotalCellsSoFar = admFirstDayOfWeek + admTotalDaysInMonth;
  const admTargetTotalGridSlots = admTotalCellsSoFar > 35 ? 42 : 35;
  const admNextMonthDaysCount = admTargetTotalGridSlots - admTotalCellsSoFar;
  const admNextMonthDays = Array.from({ length: admNextMonthDaysCount }, (_, i) => i + 1);

  let admSelYear = null, admSelMonth = null, admSelDay = null;
  if (formData.admissionDate && /^\d{4}-\d{2}-\d{2}$/.test(formData.admissionDate)) {
    const parts = formData.admissionDate.split('-').map(Number);
    admSelYear = parts[0];
    admSelMonth = parts[1] - 1;
    admSelDay = parts[2];
  }

  // Years list for admission date (from 2020 to currentYear + 2)
  const admissionYearsList = Array.from({ length: (currentYear + 2) - 2020 + 1 }, (_, i) => 2020 + i).reverse();

  // Photo handlers
  const handlePhotoSelect = async (fileOrDataUrl) => {
    setPhotoError('');
    if (!fileOrDataUrl) return;

    if (typeof fileOrDataUrl === 'string') {
      setPhoto(fileOrDataUrl);
      setPhotoPreview(fileOrDataUrl);
      return;
    }

    const file = fileOrDataUrl;
    if (file.type && !file.type.startsWith('image/')) {
      setPhotoError('Please upload a valid image file (JPG, JPEG, PNG).');
      return;
    }

    if (file.size && file.size > 5 * 1024 * 1024) {
      setPhotoError(`File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of 5 MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setCropModalData({
          imageSrc: e.target.result,
          target: 'photo'
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handlePhotoSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const removePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    setPhotoError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Aadhar handlers
  const handleAadharSelect = async (fileOrDataUrl) => {
    setAadharError('');
    if (!fileOrDataUrl) return;

    if (typeof fileOrDataUrl === 'string') {
      const approxKB = Math.round((fileOrDataUrl.length * 0.75) / 1024);
      setAadharFile(fileOrDataUrl);
      setAadharPreview(fileOrDataUrl);
      setAadharFileType('image');
      setAadharFileName('aadhar-cropped.jpg');
      setAadharFileSize(approxKB);
      return;
    }

    const file = fileOrDataUrl;
    const isPdf = file.type === 'application/pdf' || (file.name && file.name.toLowerCase().endsWith('.pdf'));
    const isImage = file.type && file.type.startsWith('image/');

    if (!isPdf && !isImage) {
      setAadharError('Please upload a valid document format (JPG, PNG, or PDF).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAadharError(`File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of 5 MB.`);
      return;
    }

    setIsCompressingAadhar(true);

    try {
      const compressedBase64 = await compressImage(file, 200);
      const approxKB = Math.round((compressedBase64.length * 0.75) / 1024);
      setAadharFile(compressedBase64);
      setAadharPreview(compressedBase64);
      setAadharFileType(isPdf ? 'pdf' : 'image');
      setAadharFileName(file.name);
      setAadharFileSize(approxKB);
    } catch (err) {
      console.log('Aadhar processing error:', err);
      setAadharError('Error processing file. Please select another file.');
    } finally {
      setIsCompressingAadhar(false);
    }
  };

  const removeAadhar = () => {
    setAadharFile(null);
    setAadharPreview(null);
    setAadharFileType('');
    setAadharFileName('');
    setAadharFileSize(0);
    setAadharError('');
    if (aadharInputRef.current) {
      aadharInputRef.current.value = '';
    }
  };

  // Marksheet handlers
  const handleMarksheetSelect = async (fileOrDataUrl) => {
    setMarksheetError('');
    if (!fileOrDataUrl) return;

    if (typeof fileOrDataUrl === 'string') {
      const approxKB = Math.round((fileOrDataUrl.length * 0.75) / 1024);
      setMarksheetFile(fileOrDataUrl);
      setMarksheetPreview(fileOrDataUrl);
      setMarksheetFileType('image');
      setMarksheetFileName('marksheet-cropped.jpg');
      setMarksheetFileSize(approxKB);
      return;
    }

    const file = fileOrDataUrl;
    const isPdf = file.type === 'application/pdf' || (file.name && file.name.toLowerCase().endsWith('.pdf'));
    const isImage = file.type && file.type.startsWith('image/');

    if (!isPdf && !isImage) {
      setMarksheetError('Please upload a valid document format (JPG, PNG, or PDF).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMarksheetError(`File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of 5 MB.`);
      return;
    }

    setIsCompressingMarksheet(true);

    try {
      const compressedBase64 = await compressImage(file, 200);
      const approxKB = Math.round((compressedBase64.length * 0.75) / 1024);
      setMarksheetFile(compressedBase64);
      setMarksheetPreview(compressedBase64);
      setMarksheetFileType(isPdf ? 'pdf' : 'image');
      setMarksheetFileName(file.name);
      setMarksheetFileSize(approxKB);
    } catch (err) {
      console.log('Marksheet processing error:', err);
      setMarksheetError('Error processing file. Please select another file.');
    } finally {
      setIsCompressingMarksheet(false);
    }
  };

  const removeMarksheet = () => {
    setMarksheetFile(null);
    setMarksheetPreview(null);
    setMarksheetFileType('');
    setMarksheetFileName('');
    setMarksheetFileSize(0);
    setMarksheetError('');
    if (marksheetInputRef.current) {
      marksheetInputRef.current.value = '';
    }
  };

  // Camera Functions
  const startCamera = async (mode = facingMode) => {
    setCameraError('');
    setIsCameraLoading(true);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    try {
      const constraints = {
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraLoading(false);
    } catch (err) {
      console.error('Camera access error:', err);
      setIsCameraLoading(false);
      setCameraError('Camera access denied or unavailable. Please use file Browse.');
    }
  };

  const openCameraModal = (target = 'photo') => {
    setCameraTarget(target);
    setShowCameraModal(true);
    setTimeout(() => {
      startCamera('user');
    }, 100);
  };

  const stopCameraStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const closeCameraModal = () => {
    stopCameraStream();
    setShowCameraModal(false);
    setCameraError('');
  };

  const captureCameraPhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const target = cameraTarget;
    closeCameraModal();

    setCropModalData({
      imageSrc: dataUrl,
      target: target
    });
  };

  const handleCropComplete = async (blob, croppedDataUrl) => {
    const target = cropModalData?.target || 'photo';
    setCropModalData(null);
    const finalData = croppedDataUrl || blob;
    if (target === 'photo') {
      await handlePhotoSelect(finalData);
    } else if (target === 'aadhar') {
      await handleAadharSelect(finalData);
    } else if (target === 'marksheet') {
      await handleMarksheetSelect(finalData);
    }
  };

  const handleCropRetake = () => {
    const target = cropModalData?.target || 'photo';
    setCropModalData(null);
    openCameraModal(target);
  };

  const toggleFacingMode = () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    startCamera(newMode);
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  // Validation
  const validateForm = () => {
    const errors = {};
    if (!formData.fullName.trim()) errors.fullName = 'Full Student Name is required';
    if (!formData.fatherName.trim()) errors.fatherName = "Father's / Guardian Name is required";
    if (!formData.dobDay || !formData.dobMonth || !formData.dobYear) errors.dob = 'Complete Date of Birth is required';
    if (!formData.casteCategory.trim()) errors.casteCategory = 'Caste / Reservation Category is required';
    if (!formData.address.trim()) errors.address = 'Full Permanent Address is required';
    if (!formData.email.trim()) errors.email = 'Email ID is required';
    if (!formData.contactNo || formData.contactNo.length !== 10) errors.contactNo = 'Valid 10-digit primary mobile number is required';
    if (!formData.course) errors.course = 'Please select a Course';
    if (!formData.trustBranch) errors.trustBranch = 'Please select a Branch';
    if (!formData.declared) errors.declared = 'You must declare and accept the terms';
    if (!photo) errors.photo = 'Candidate photo upload is required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Pre-payment draft save
  const savePendingPaymentDraft = async (appNumber, extra = {}) => {
    try {
      const draft = {
        appNumber,
        ...formData,
        photoPreview: photoPreview || '',
        aadharPreview: aadharPreview || '',
        marksheetPreview: marksheetPreview || '',
        feeAmount: applicableFee,
        type: 'certificate_admission',
        status: 'Pending Payment',
        updatedAt: Date.now(),
        ...extra
      };
      if (db) {
        await setDoc(doc(db, 'pending_payments', appNumber), draft, { merge: true });
      }
      localStorage.setItem('sle_active_payment_draft', JSON.stringify(draft));
    } catch (e) {}
  };

  // Load Razorpay Script dynamically
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

  // Trigger Form Submit -> Open Payment Modal
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const appNumber = 'SLE-CERT-' + Math.floor(100000 + Math.random() * 900000);
    setCurrentDraftAppNumber(appNumber);
    savePendingPaymentDraft(appNumber, { lastAction: 'Opened Payment Modal' });
    setShowPaymentModal(true);
  };

  // Execute Razorpay Payment
  const handleExecutePayment = async () => {
    setIsProcessingPayment(true);
    const appNumber = currentDraftAppNumber || ('SLE-CERT-' + Math.floor(100000 + Math.random() * 900000));
    setCurrentDraftAppNumber(appNumber);

    const isLiveMode = (import.meta.env.VITE_RAZORPAY_MODE || 'live').toLowerCase() === 'live';
    const activeRazorpayKey = (
      (isLiveMode
        ? (import.meta.env.VITE_RAZORPAY_LIVE_KEY_ID || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_live_TSInBiL96HvXCm')
        : (import.meta.env.VITE_RAZORPAY_TEST_KEY_ID || 'rzp_test_SPs6AqG8E3r2Cp'))
    );
    const backendUrl = import.meta.env.VITE_BACKEND_URL || '/backend';

    let orderData = null;
    try {
      const orderRes = await fetch(`${backendUrl}/create-order.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: applicableFee,
          currency: 'INR',
          planId: 'cert-admission-fee',
          customerName: formData.fullName.trim(),
          customerEmail: formData.email.trim() || 'student@sle-institution.org',
          customerPhone: formData.contactNo.trim(),
          appNumber: appNumber,
          course: formData.course || '',
          branch: formData.trustBranch || 'Head Office'
        })
      });
      if (orderRes.ok) orderData = await orderRes.json();
    } catch (e) {}

    if (!orderData) {
      orderData = {
        success: true,
        key_id: activeRazorpayKey,
        amount: applicableFee * 100,
        currency: 'INR'
      };
    }

    await savePendingPaymentDraft(appNumber, {
      razorpayOrderId: orderData?.order_id || '',
      lastAction: 'Payment Checkout Initiated'
    });

    const resolvedKey = (orderData?.key_id || activeRazorpayKey).trim();
    const genuineOrderId = (orderData?.order_id && !orderData.order_id.startsWith('order_dev_') && !orderData.is_mock) ? orderData.order_id : undefined;

    const isScriptLoaded = await loadRazorpayScript();
    if (isScriptLoaded && window.Razorpay) {
      const options = {
        key: resolvedKey,
        amount: orderData?.amount || (applicableFee * 100),
        currency: orderData?.currency || 'INR',
        name: 'SLE Institutions',
        description: `Certificate Course Admission Fee (₹${applicableFee.toLocaleString()})`,
        image: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
        order_id: genuineOrderId,
        prefill: {
          name: formData.fullName.trim(),
          email: formData.email.trim() || 'student@sle-institution.org',
          contact: formData.contactNo.trim()
        },
        theme: {
          color: '#be123c'
        },
        handler: async function (response) {
          try {
            await fetch(`${backendUrl}/verify-payment.php`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
              })
            });
          } catch (vErr) {}

          await finalizeApplicationSubmission(
            appNumber,
            response.razorpay_payment_id,
            response.razorpay_order_id || orderData?.order_id || ''
          );
        },
        modal: {
          ondismiss: async function () {
            setIsProcessingPayment(false);
            await savePendingPaymentDraft(currentDraftAppNumber || appNumber, {
              paymentStatus: 'Pending Payment',
              lastAction: 'Payment Dismissed by User',
              cancelledAt: new Date().toLocaleString()
            });
          }
        }
      };

      try {
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', async function (resp) {
          setIsProcessingPayment(false);
          await savePendingPaymentDraft(currentDraftAppNumber || appNumber, {
            paymentStatus: 'Payment Failed',
            failureReason: resp.error?.description || 'Transaction declined'
          });
          alert(`Payment failed: ${resp.error?.description || 'Transaction declined'}`);
        });
        rzp.open();
        return;
      } catch (err) {
        setIsProcessingPayment(false);
        alert('Could not launch payment gateway. Form saved to pending payments.');
        return;
      }
    }

    setIsProcessingPayment(false);
    alert('Unable to load payment gateway. Please check your internet connection.');
  };

  // Finalize Submission
  const finalizeApplicationSubmission = async (appNumber, activePaymentId, activeOrderId) => {
    setShowPaymentModal(false);
    setIsSubmitting(true);
    setSubmissionStatus('step1');
    pendingSubmissionRef.current = { appNumber, paymentId: activePaymentId, orderId: activeOrderId };

    try {
      // 1. Allocate Registration No based on admission year
      const finalRegNo = await allocateNextCertRegistrationNo(db, formData.admissionDate || today);

      // 2. Upload Documents to Cloudinary
      setSubmissionStatus('step2');
      let cloudinaryPhotoUrl = '';
      let cloudinaryAadharUrl = '';
      let cloudinaryMarksheetUrl = '';

      if (photo) {
        try {
          cloudinaryPhotoUrl = await uploadToCloudinary(photo, 'student_photos');
        } catch (e) {}
      }
      if (aadharFile) {
        try {
          cloudinaryAadharUrl = await uploadToCloudinary(aadharFile, 'student_docs');
        } catch (e) {}
      }
      if (marksheetFile) {
        try {
          cloudinaryMarksheetUrl = await uploadToCloudinary(marksheetFile, 'student_docs');
        } catch (e) {}
      }

      // 3. Assemble Record
      setSubmissionStatus('step3');
      const dob = [formData.dobDay, formData.dobMonth, formData.dobYear].filter(Boolean).join('-');
      
      const portalUser = (() => {
        try {
          return JSON.parse(localStorage.getItem('sle_portal_user_data') || '{}');
        } catch (e) {
          return {};
        }
      })();

      const effectiveBranch = (
        formData.trustBranch ||
        portalUser?.place ||
        portalUser?.location ||
        portalUser?.trustBranch ||
        portalUser?.branchName ||
        'Main Branch'
      ).trim();

      const effectiveFranchiseeId = portalUser?.id || portalUser?.franchiseeId || portalUser?.environmentId || '';
      const effectiveFranchiseName = portalUser?.franchiseName || portalUser?.centerName || effectiveBranch;

      const studentRecord = {
        ...formData,
        appNumber,
        appId: appNumber,
        registrationNo: finalRegNo,
        certRegNo: finalRegNo,
        dob,
        photoUrl: cloudinaryPhotoUrl || photoPreview || '',
        photo: cloudinaryPhotoUrl || photoPreview || '',
        photoPreview: photoPreview || cloudinaryPhotoUrl || '',
        aadharUrl: cloudinaryAadharUrl || aadharPreview || '',
        aadharPreview: cloudinaryAadharUrl || aadharPreview || '',
        aadharFileType,
        aadharFileName,
        marksheetUrl: cloudinaryMarksheetUrl || marksheetPreview || '',
        marksheetPreview: cloudinaryMarksheetUrl || marksheetPreview || '',
        marksheetFileType,
        marksheetFileName,
        type: 'certificate_admission',
        isCertificateStudent: true,
        submittedAt: new Date().toLocaleString(),
        createdDate: formData.admissionDate || today,
        createdAt: Date.now(),
        feeAmount: applicableFee,
        paymentStatus: 'Paid',
        paymentMethod: 'Razorpay',
        razorpayPaymentId: activePaymentId,
        razorpayOrderId: activeOrderId,
        status: 'Submitted',
        hasHallTicket: false,
        hallTicketGenerated: false,
        trustBranch: effectiveBranch,
        branch: effectiveBranch,
        branchName: effectiveBranch,
        trainingCenter: effectiveBranch,
        place: effectiveBranch,
        location: effectiveBranch,
        franchiseeId: effectiveFranchiseeId,
        franchiseName: effectiveFranchiseName
      };

      // Save to Firestore 'cert_students' collection exclusively (keeps general coaching students clean)
      if (db) {
        try {
          await setDoc(doc(db, 'cert_students', appNumber), studentRecord, { merge: true });
        } catch (e) {
          console.warn('Firestore write warning (saving to local cache):', e);
        }
      }

      // Record Transaction
      try {
        await recordTransaction({
          transactionId: activePaymentId,
          paymentId: activePaymentId,
          orderId: activeOrderId,
          type: 'certificate_admission',
          typeLabel: 'Certificate Admission Fee',
          title: `Cert Admission Fee - ${formData.fullName.trim()}`,
          description: `Certificate admission fee for ${formData.course || 'Certificate Course'}`,
          payerName: formData.fullName.trim(),
          payerEmail: formData.email.trim(),
          payerPhone: formData.contactNo.trim(),
          registrationNo: finalRegNo,
          appNumber: appNumber,
          course: formData.course || '',
          branch: effectiveBranch,
          franchiseeId: effectiveFranchiseeId,
          franchiseName: effectiveFranchiseName,
          amount: applicableFee,
          status: 'Paid',
          paymentMethod: 'Razorpay',
          gateway: 'Razorpay Live',
          date: formData.admissionDate || today,
          dateTime: new Date().toLocaleString(),
          createdAt: Date.now()
        });
      } catch (txnErr) {
        console.warn('Transaction record warning:', txnErr);
      }

      // Update local storage caches (stores exclusively in Paid Certificate students cache)
      try {
        const certCache = JSON.parse(localStorage.getItem('sle_cert_students_cache') || '[]');
        certCache.unshift(studentRecord);
        localStorage.setItem('sle_cert_students_cache', JSON.stringify(certCache));

        // Remove draft
        if (db) deleteDoc(doc(db, 'pending_payments', appNumber)).catch(() => {});
        localStorage.removeItem('sle_active_payment_draft');
      } catch (e) {}

      setSubmissionStatus('success');
      await new Promise(r => setTimeout(r, 600));

      setIsSubmitting(false);
      setSubmittedData(studentRecord);
      setSubmissionStatus(null);

      // Immediately clear underlying form inputs so if user closes modal or returns, the form is empty
      setFormData({
        fullName: '',
        fatherName: '',
        dobDay: '',
        dobMonth: '',
        dobYear: '',
        casteCategory: '',
        address: '',
        email: '',
        contactNo: '',
        aadharNo: '',
        sslcMarksNo: '',
        qualification: '',
        course: '',
        trustBranch: '',
        declared: false,
        registrationNo: `SLE-${getCertBaseRegNo(today)}`,
        admissionDate: today,
        selectedClass: '10th',
        trainingPlan: 'Regular'
      });
      setPhoto(null);
      setPhotoPreview(null);
      removeAadhar();
      removeMarksheet();
      setFormErrors({});
      fetchNextRegistrationNo(today);
    } catch (err) {
      console.error('Submission error:', err);
      setIsSubmitting(false);
      setSubmissionStatus('error');
      setSubmissionError('Upload failed: Please check your internet connection and Try Again.');
    }
  };

  // Reset form
  const resetForm = () => {
    setSubmittedData(null);
    setDobInputDisplay('');
    setShowCalendarPopover(false);
    setCalendarViewMode('days');
    setAdmissionDateInputDisplay(today.split('-').reverse().join('-'));
    setShowAdmissionCalPopover(false);
    setAdmissionCalViewMode('days');
    setFormData({
      fullName: '',
      fatherName: '',
      dobDay: '',
      dobMonth: '',
      dobYear: '',
      casteCategory: '',
      address: '',
      email: '',
      contactNo: '',
      aadharNo: '',
      sslcMarksNo: '',
      qualification: '',
      course: '',
      trustBranch: '',
      declared: false,
      registrationNo: `SLE-${getCertBaseRegNo(today)}`,
      admissionDate: today,
      selectedClass: '10th',
      trainingPlan: 'Regular'
    });
    setPhoto(null);
    setPhotoPreview(null);
    removeAadhar();
    removeMarksheet();
    setFormErrors({});
    fetchNextRegistrationNo(today);
  };

  // When navigating back to this route after submission, reset to empty form
  useEffect(() => {
    if (submittedData) {
      resetForm();
    }
  }, [location.pathname, location.key]);

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">

      {/* Top Banner */}
      <div className="gradient-banner rounded-2xl py-6 px-8 shadow-xl border border-rose-800/40 relative overflow-hidden mb-8 text-center">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 px-3.5 py-1.5 rounded-full text-xs font-extrabold tracking-wider mb-2 border border-white/20 text-amber-300">
            <Award className="w-4 h-4" />
            <span>CERTIFICATE PROGRAMME ADMISSION</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-widest uppercase">
            CERTIFICATE ADMISSION FORM
          </h2>
        </div>
      </div>

      {/* Main Centered White Card Form Container */}
      <div className="glass-card bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="p-6 sm:p-10 space-y-10">

          {/* Top Bar: Registration No, Admission Date, Class, Training Plan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50/80 p-5 rounded-2xl border border-slate-200/90 shadow-sm">
            {/* Registration No */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                REGISTRATION NO:
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  name="registrationNo"
                  value={formData.registrationNo || 'SLE-202637001'}
                  readOnly
                  disabled
                  title={formData.registrationNo || 'SLE-202637001'}
                  className="w-full pl-2.5 pr-11 py-2.5 rounded-xl border border-slate-300 bg-slate-100 text-slate-900 font-bold text-xs sm:text-[13px] select-all tracking-tight focus:outline-none"
                />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-200 pointer-events-none select-none">
                  AUTO
                </span>
              </div>
            </div>

            {/* Admission Date (Editable via Manual Typing & Custom Interactive Calendar) */}
            <div className="space-y-1.5 relative">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                ADMISSION DATE:
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  name="admissionDate"
                  placeholder="DD-MM-YYYY"
                  value={admissionDateInputDisplay}
                  onChange={handleManualAdmissionDateChange}
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-sm font-semibold focus:outline-none focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20 transition-all"
                />
                <div className="absolute right-1.5 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={toggleAdmissionCalendar}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      showAdmissionCalPopover
                        ? 'text-rose-600 bg-rose-50 ring-2 ring-rose-500/30 shadow-inner'
                        : 'text-slate-500 hover:text-rose-600 hover:bg-slate-100'
                    }`}
                    title="Open interactive calendar"
                    aria-label="Open interactive calendar"
                  >
                    <Calendar className="w-4 h-4 pointer-events-none" />
                  </button>
                </div>

                {/* Custom Advanced Interactive Calendar Dropdown Popover */}
                {showAdmissionCalPopover && (
                  <div
                    ref={admissionCalPopoverRef}
                    className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 z-50 w-[310px] sm:w-[335px] bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2),0_0_0_1px_rgba(244,63,94,0.12)] border border-rose-100 p-4 transition-all duration-200 select-none animate-in fade-in zoom-in-95"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                      {admissionCalViewMode === 'days' ? (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setAdmissionCalViewDate(new Date(admissionCalViewYear, admissionCalViewMonth - 1, 1));
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition active:scale-90 cursor-pointer"
                            title="Previous Month"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setAdmissionCalViewMode('months');
                              }}
                              className="px-2.5 py-1 text-xs font-bold text-slate-800 bg-slate-100/90 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition flex items-center gap-1 cursor-pointer border border-slate-200/60"
                              title="Click to choose Month"
                            >
                              <span>{months[admissionCalViewMonth]}</span>
                              <ChevronDown className="w-3 h-3 text-slate-400" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setAdmissionCalViewMode('years');
                              }}
                              className="px-2.5 py-1 text-xs font-bold text-slate-800 bg-slate-100/90 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition flex items-center gap-1 cursor-pointer border border-slate-200/60"
                              title="Click to choose Year"
                            >
                              <span>{admissionCalViewYear}</span>
                              <ChevronDown className="w-3 h-3 text-slate-400" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setAdmissionCalViewDate(new Date(admissionCalViewYear, admissionCalViewMonth + 1, 1));
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition active:scale-90 cursor-pointer"
                            title="Next Month"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </>
                      ) : admissionCalViewMode === 'months' ? (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Choose Month</span>
                            <span className="text-xs font-semibold text-rose-600">({admissionCalViewYear})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAdmissionCalViewMode('days')}
                            className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg transition cursor-pointer"
                          >
                            Back
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Choose Year</span>
                            <span className="text-xs font-semibold text-rose-600">({months[admissionCalViewMonth]})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAdmissionCalViewMode('days')}
                            className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg transition cursor-pointer"
                          >
                            Back
                          </button>
                        </>
                      )}
                    </div>

                    {/* Body: Days View */}
                    {admissionCalViewMode === 'days' && (
                      <div>
                        {/* Days of week */}
                        <div className="grid grid-cols-7 gap-1 mb-1.5 text-center">
                          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((dName, i) => (
                            <div
                              key={dName}
                              className={`text-[11px] font-bold tracking-wider py-1 ${
                                i === 0 ? 'text-rose-500' : 'text-slate-400'
                              }`}
                            >
                              {dName}
                            </div>
                          ))}
                        </div>

                        {/* Days Grid */}
                        <div className="grid grid-cols-7 gap-1 text-center">
                          {admPrevMonthDays.map((d) => (
                            <button
                              key={`adm-prev-${d}`}
                              type="button"
                              onClick={() =>
                                handleSelectAdmissionDay(
                                  admissionCalViewMonth === 0 ? admissionCalViewYear - 1 : admissionCalViewYear,
                                  admissionCalViewMonth === 0 ? 11 : admissionCalViewMonth - 1,
                                  d
                                )
                              }
                              className="h-8 w-8 mx-auto flex items-center justify-center text-xs font-medium text-slate-300 hover:text-slate-600 hover:bg-slate-100/70 rounded-xl transition cursor-pointer"
                            >
                              {d}
                            </button>
                          ))}

                          {admCurrentMonthDays.map((d) => {
                            const isSelected = admSelYear === admissionCalViewYear && admSelMonth === admissionCalViewMonth && admSelDay === d;
                            const isToday = todayYearNum === admissionCalViewYear && todayMonthNum === admissionCalViewMonth && todayDayNum === d;

                            return (
                              <button
                                key={`adm-curr-${d}`}
                                type="button"
                                onClick={() => handleSelectAdmissionDay(admissionCalViewYear, admissionCalViewMonth, d)}
                                className={`h-8 w-8 mx-auto flex items-center justify-center text-xs font-semibold rounded-xl transition-all cursor-pointer active:scale-95 ${
                                  isSelected
                                    ? 'bg-gradient-to-r from-red-600 via-rose-600 to-rose-700 text-white font-black shadow-md shadow-rose-500/35 ring-2 ring-rose-200 scale-105'
                                    : isToday
                                    ? 'border-2 border-rose-500 text-rose-600 font-bold bg-rose-50/50 hover:bg-rose-100/70'
                                    : 'text-slate-700 hover:bg-rose-50 hover:text-rose-600'
                                }`}
                              >
                                {d}
                              </button>
                            );
                          })}

                          {admNextMonthDays.map((d) => (
                            <button
                              key={`adm-next-${d}`}
                              type="button"
                              onClick={() =>
                                handleSelectAdmissionDay(
                                  admissionCalViewMonth === 11 ? admissionCalViewYear + 1 : admissionCalViewYear,
                                  admissionCalViewMonth === 11 ? 0 : admissionCalViewMonth + 1,
                                  d
                                )
                              }
                              className="h-8 w-8 mx-auto flex items-center justify-center text-xs font-medium text-slate-300 hover:text-slate-600 hover:bg-slate-100/70 rounded-xl transition cursor-pointer"
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Body: Months View */}
                    {admissionCalViewMode === 'months' && (
                      <div className="grid grid-cols-3 gap-2 py-1">
                        {months.map((m, idx) => {
                          const isSelected = admissionCalViewMonth === idx;
                          return (
                            <button
                              key={`adm-m-${m}`}
                              type="button"
                              onClick={() => {
                                setAdmissionCalViewDate(new Date(admissionCalViewYear, idx, 1));
                                setAdmissionCalViewMode('days');
                              }}
                              className={`py-2.5 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95 ${
                                isSelected
                                  ? 'bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-md shadow-rose-500/30 ring-2 ring-rose-200'
                                  : 'text-slate-700 hover:bg-rose-50 hover:text-rose-600 bg-slate-50 border border-slate-100'
                              }`}
                            >
                              {m.slice(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Body: Years View */}
                    {admissionCalViewMode === 'years' && (
                      <div
                        ref={admissionYearsContainerRef}
                        className="grid grid-cols-4 gap-1.5 max-h-52 overflow-y-auto pr-1 py-1"
                        style={{ scrollbarWidth: 'thin' }}
                      >
                        {admissionYearsList.map((y) => {
                          const isSelected = admissionCalViewYear === y;
                          return (
                            <button
                              key={`adm-y-${y}`}
                              type="button"
                              data-selected={isSelected}
                              onClick={() => {
                                setAdmissionCalViewDate(new Date(y, admissionCalViewMonth, 1));
                                setAdmissionCalViewMode('days');
                              }}
                              className={`py-2 px-1 text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95 ${
                                isSelected
                                  ? 'bg-gradient-to-r from-red-600 to-rose-700 text-white font-black shadow-md shadow-rose-500/30 ring-2 ring-rose-200'
                                  : 'text-slate-700 hover:bg-rose-50 hover:text-rose-600 bg-slate-50 border border-slate-100'
                              }`}
                            >
                              {y}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Footer Action Bar */}
                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const now = new Date();
                            handleSelectAdmissionDay(now.getFullYear(), now.getMonth(), now.getDate());
                          }}
                          className="px-2.5 py-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg font-bold transition cursor-pointer"
                        >
                          Today
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowAdmissionCalPopover(false)}
                        className="px-3.5 py-1 bg-slate-900 text-white hover:bg-slate-800 rounded-lg font-semibold transition shadow-sm active:scale-95 cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Class */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                CLASS:
              </label>
              <select
                name="selectedClass"
                value={formData.selectedClass}
                onChange={handleChange}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold text-sm focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 cursor-pointer"
              >
                <option value="10th">10th</option>
                <option value="11th">11th</option>
                <option value="12th">12th</option>
                <option value="SSLC">SSLC</option>
                <option value="PUC">PUC</option>
                <option value="Diploma">Diploma</option>
                <option value="Degree">Degree</option>
              </select>
            </div>

            {/* Training Plan */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                TRAINING PLAN:
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="trainingPlan"
                  value={formData.trainingPlan || 'Regular'}
                  readOnly
                  disabled
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-700 font-bold text-sm cursor-not-allowed select-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 1: Personal Details */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
              <div>
                <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <User className="w-5 h-5 text-rose-600" /> Personal Details
                </h4>
                <p className="text-xs text-slate-500">Student full name, guardian info, DOB, and category</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Full Name */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  FULL STUDENT NAME <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="Enter Student's Full Name"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${formErrors.fullName
                        ? 'border-rose-500 bg-rose-50/50 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-slate-300 bg-slate-50/50 focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20'
                      }`}
                  />
                </div>
                {formErrors.fullName && <p className="text-xs text-rose-600 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" />{formErrors.fullName}</p>}
              </div>

              {/* Father Name */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  FATHER'S / GUARDIAN NAME <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Users className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    name="fatherName"
                    value={formData.fatherName}
                    onChange={handleChange}
                    placeholder="Enter Father's / Guardian's Full Name"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${formErrors.fatherName
                        ? 'border-rose-500 bg-rose-50/50 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-slate-300 bg-slate-50/50 focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20'
                      }`}
                  />
                </div>
                {formErrors.fatherName && <p className="text-xs text-rose-600 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" />{formErrors.fatherName}</p>}
              </div>

              {/* Date of Birth (Editable Manually and Selectable via Custom Interactive Calendar) */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  DATE OF BIRTH <span className="text-rose-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    name="dob"
                    placeholder="DD-MM-YYYY"
                    value={dobInputDisplay}
                    onChange={handleManualDobChange}
                    className={`w-full pl-4 pr-11 py-2.5 rounded-xl border text-sm font-medium focus:outline-none transition-all ${
                      formErrors.dob
                        ? 'border-rose-500 bg-rose-50/50 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-slate-300 bg-slate-50/50 focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20'
                    }`}
                  />
                  <div className="absolute right-2 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={toggleCalendar}
                      className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                        showCalendarPopover
                          ? 'text-rose-600 bg-rose-50 ring-2 ring-rose-500/30 shadow-inner'
                          : 'text-slate-500 hover:text-rose-600 hover:bg-slate-100'
                      }`}
                      title="Open interactive calendar"
                      aria-label="Open interactive calendar"
                    >
                      <Calendar className="w-5 h-5 pointer-events-none" />
                    </button>
                  </div>

                  {/* Custom Advanced Interactive Calendar Dropdown Popover */}
                  {showCalendarPopover && (
                    <div
                      ref={calendarPopoverRef}
                      className="absolute right-0 top-full mt-2.5 z-50 w-[310px] sm:w-[335px] bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2),0_0_0_1px_rgba(244,63,94,0.12)] border border-rose-100 p-4 transition-all duration-200 select-none animate-in fade-in zoom-in-95"
                    >
                      {/* Popover Header */}
                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                        {calendarViewMode === 'days' ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setCalendarViewDate(new Date(calendarViewYear, calendarViewMonth - 1, 1));
                              }}
                              className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition active:scale-90 cursor-pointer"
                              title="Previous Month"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setCalendarViewMode('months');
                                }}
                                className="px-2.5 py-1 text-xs font-bold text-slate-800 bg-slate-100/90 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition flex items-center gap-1 cursor-pointer border border-slate-200/60"
                                title="Click to choose Month"
                              >
                                <span>{months[calendarViewMonth]}</span>
                                <ChevronDown className="w-3 h-3 text-slate-400" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setCalendarViewMode('years');
                                }}
                                className="px-2.5 py-1 text-xs font-bold text-slate-800 bg-slate-100/90 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition flex items-center gap-1 cursor-pointer border border-slate-200/60"
                                title="Click to choose Year"
                              >
                                <span>{calendarViewYear}</span>
                                <ChevronDown className="w-3 h-3 text-slate-400" />
                              </button>
                            </div>

                            <button
                              type="button"
                              disabled={calendarViewYear === todayYearNum && calendarViewMonth >= todayMonthNum}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setCalendarViewDate(new Date(calendarViewYear, calendarViewMonth + 1, 1));
                              }}
                              className={`w-8 h-8 flex items-center justify-center rounded-xl transition active:scale-90 ${
                                calendarViewYear === todayYearNum && calendarViewMonth >= todayMonthNum
                                  ? 'text-slate-300 cursor-not-allowed'
                                  : 'text-slate-600 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                              }`}
                              title="Next Month"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </>
                        ) : calendarViewMode === 'months' ? (
                          <>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Choose Month</span>
                              <span className="text-xs font-semibold text-rose-600">({calendarViewYear})</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setCalendarViewMode('days')}
                              className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg transition cursor-pointer"
                            >
                              Back
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Choose Year</span>
                              <span className="text-xs font-semibold text-rose-600">({months[calendarViewMonth]})</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setCalendarViewMode('days')}
                              className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg transition cursor-pointer"
                            >
                              Back
                            </button>
                          </>
                        )}
                      </div>

                      {/* Body: Days View */}
                      {calendarViewMode === 'days' && (
                        <div>
                          {/* Days of week */}
                          <div className="grid grid-cols-7 gap-1 mb-1.5 text-center">
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((dName, i) => (
                              <div
                                key={dName}
                                className={`text-[11px] font-bold tracking-wider py-1 ${
                                  i === 0 ? 'text-rose-500' : 'text-slate-400'
                                }`}
                              >
                                {dName}
                              </div>
                            ))}
                          </div>

                          {/* Days Grid */}
                          <div className="grid grid-cols-7 gap-1 text-center">
                            {prevMonthDays.map((d) => (
                              <button
                                key={`prev-${d}`}
                                type="button"
                                onClick={() =>
                                  handleSelectCalendarDay(
                                    calendarViewMonth === 0 ? calendarViewYear - 1 : calendarViewYear,
                                    calendarViewMonth === 0 ? 11 : calendarViewMonth - 1,
                                    d
                                  )
                                }
                                className="h-8 w-8 mx-auto flex items-center justify-center text-xs font-medium text-slate-300 hover:text-slate-600 hover:bg-slate-100/70 rounded-xl transition cursor-pointer"
                              >
                                {d}
                              </button>
                            ))}

                            {currentMonthDays.map((d) => {
                              const isSelected = selYearNum === calendarViewYear && selMonthNum === calendarViewMonth && selDayNum === d;
                              const isToday = todayYearNum === calendarViewYear && todayMonthNum === calendarViewMonth && todayDayNum === d;
                              const isFuture = new Date(calendarViewYear, calendarViewMonth, d) > todayObj;

                              if (isFuture) {
                                return (
                                  <span
                                    key={`curr-${d}`}
                                    className="h-8 w-8 mx-auto flex items-center justify-center text-xs font-medium text-slate-200 cursor-not-allowed select-none"
                                  >
                                    {d}
                                  </span>
                                );
                              }

                              return (
                                <button
                                  key={`curr-${d}`}
                                  type="button"
                                  onClick={() => handleSelectCalendarDay(calendarViewYear, calendarViewMonth, d)}
                                  className={`h-8 w-8 mx-auto flex items-center justify-center text-xs font-semibold rounded-xl transition-all cursor-pointer active:scale-95 ${
                                    isSelected
                                      ? 'bg-gradient-to-r from-red-600 via-rose-600 to-rose-700 text-white font-black shadow-md shadow-rose-500/35 ring-2 ring-rose-200 scale-105'
                                      : isToday
                                      ? 'border-2 border-rose-500 text-rose-600 font-bold bg-rose-50/50 hover:bg-rose-100/70'
                                      : 'text-slate-700 hover:bg-rose-50 hover:text-rose-600'
                                  }`}
                                >
                                  {d}
                                </button>
                              );
                            })}

                            {nextMonthDays.map((d) => {
                              const isFuture =
                                new Date(
                                  calendarViewMonth === 11 ? calendarViewYear + 1 : calendarViewYear,
                                  calendarViewMonth === 11 ? 0 : calendarViewMonth + 1,
                                  d
                                ) > todayObj;

                              if (isFuture) {
                                return (
                                  <span
                                    key={`next-${d}`}
                                    className="h-8 w-8 mx-auto flex items-center justify-center text-xs font-medium text-slate-200 cursor-not-allowed select-none"
                                  >
                                    {d}
                                  </span>
                                );
                              }

                              return (
                                <button
                                  key={`next-${d}`}
                                  type="button"
                                  onClick={() =>
                                    handleSelectCalendarDay(
                                      calendarViewMonth === 11 ? calendarViewYear + 1 : calendarViewYear,
                                      calendarViewMonth === 11 ? 0 : calendarViewMonth + 1,
                                      d
                                    )
                                  }
                                  className="h-8 w-8 mx-auto flex items-center justify-center text-xs font-medium text-slate-300 hover:text-slate-600 hover:bg-slate-100/70 rounded-xl transition cursor-pointer"
                                >
                                  {d}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Body: Months View */}
                      {calendarViewMode === 'months' && (
                        <div className="grid grid-cols-3 gap-2 py-1">
                          {months.map((m, idx) => {
                            const isSelected = calendarViewMonth === idx;
                            return (
                              <button
                                key={m}
                                type="button"
                                onClick={() => {
                                  setCalendarViewDate(new Date(calendarViewYear, idx, 1));
                                  setCalendarViewMode('days');
                                }}
                                className={`py-2.5 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95 ${
                                  isSelected
                                    ? 'bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-md shadow-rose-500/30 ring-2 ring-rose-200'
                                    : 'text-slate-700 hover:bg-rose-50 hover:text-rose-600 bg-slate-50 border border-slate-100'
                                }`}
                              >
                                {m.slice(0, 3)}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Body: Years View */}
                      {calendarViewMode === 'years' && (
                        <div
                          ref={yearsContainerRef}
                          className="grid grid-cols-4 gap-1.5 max-h-52 overflow-y-auto pr-1 py-1"
                          style={{ scrollbarWidth: 'thin' }}
                        >
                          {calendarYearsList.map((y) => {
                            const isSelected = calendarViewYear === y;
                            return (
                              <button
                                key={y}
                                type="button"
                                data-selected={isSelected}
                                onClick={() => {
                                  setCalendarViewDate(new Date(y, calendarViewMonth, 1));
                                  setCalendarViewMode('days');
                                }}
                                className={`py-2 px-1 text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95 ${
                                  isSelected
                                    ? 'bg-gradient-to-r from-red-600 to-rose-700 text-white font-black shadow-md shadow-rose-500/30 ring-2 ring-rose-200'
                                    : 'text-slate-700 hover:bg-rose-50 hover:text-rose-600 bg-slate-50 border border-slate-100'
                                }`}
                              >
                                {y}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Footer Action Bar */}
                      <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleClearDob}
                            className="px-2.5 py-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg font-medium transition cursor-pointer"
                          >
                            Clear
                          </button>
                          <button
                            type="button"
                            onClick={handleSelectToday}
                            className="px-2.5 py-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg font-bold transition cursor-pointer"
                          >
                            Today
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowCalendarPopover(false)}
                          className="px-3.5 py-1 bg-slate-900 text-white hover:bg-slate-800 rounded-lg font-semibold transition shadow-sm active:scale-95 cursor-pointer"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {formErrors.dob && <p className="text-xs text-rose-600 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" />{formErrors.dob}</p>}
              </div>

              {/* Caste / Category */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  CASTE / RESERVATION CATEGORY <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="casteCategory"
                  value={formData.casteCategory}
                  onChange={handleChange}
                  placeholder="Enter Caste / Reservation Category"
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${formErrors.casteCategory
                      ? 'border-rose-500 bg-rose-50/50'
                      : 'border-slate-300 bg-slate-50/50 focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20'
                    }`}
                />
                {formErrors.casteCategory && <p className="text-xs text-rose-600 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" />{formErrors.casteCategory}</p>}
              </div>

              {/* Full Address */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  FULL PERMANENT ADDRESS <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                  <textarea
                    name="address"
                    rows="3"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Enter Door No, Street, Village/Town, Taluk, District & Pincode"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${formErrors.address
                        ? 'border-rose-500 bg-rose-50/50'
                        : 'border-slate-300 bg-slate-50/50 focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20'
                      }`}
                  ></textarea>
                </div>
                {formErrors.address && <p className="text-xs text-rose-600 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" />{formErrors.address}</p>}
              </div>

            </div>
          </div>

          {/* SECTION 2: Contact & Identification */}
          <div className="space-y-6">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Email ID */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  EMAIL ID <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="student/parent@example.com"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${formErrors.email
                        ? 'border-rose-500 bg-rose-50/50'
                        : 'border-slate-300 bg-slate-50/50 focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20'
                      }`}
                  />
                </div>
                {formErrors.email && <p className="text-xs text-rose-600 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" />{formErrors.email}</p>}
              </div>

              {/* Contact No */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  CONTACT MOBILE NO <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="tel"
                    name="contactNo"
                    maxLength="10"
                    value={formData.contactNo}
                    onChange={handleChange}
                    placeholder="10-digit primary mobile number"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${formErrors.contactNo
                        ? 'border-rose-500 bg-rose-50/50'
                        : 'border-slate-300 bg-slate-50/50 focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20'
                      }`}
                  />
                </div>
                {formErrors.contactNo && <p className="text-xs text-rose-600 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" />{formErrors.contactNo}</p>}
              </div>

              {/* Aadhar Card No */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  AADHAR CARD NUMBER
                </label>
                <div className="relative">
                  <CreditCard className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    name="aadharNo"
                    maxLength="12"
                    value={formData.aadharNo}
                    onChange={handleChange}
                    placeholder="12-digit Student Aadhar Number"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${formErrors.aadharNo
                        ? 'border-rose-500 bg-rose-50/50'
                        : 'border-slate-300 bg-slate-50/50 focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20'
                      }`}
                  />
                </div>
                {formErrors.aadharNo && <p className="text-xs text-rose-600 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" />{formErrors.aadharNo}</p>}
              </div>

              {/* SSLC / PUC */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  SSLC/PUC
                </label>
                <div className="relative">
                  <FileCheck className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    name="sslcMarksNo"
                    value={formData.sslcMarksNo}
                    onChange={handleChange}
                    placeholder="Registration / Roll Number"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-sm focus:outline-none focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* SECTION 3: Academic Details */}
          <div className="space-y-6">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Qualification */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  CURRENT QUALIFICATION / STANDARD
                </label>
                <div className="relative">
                  <BookOpen className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    name="qualification"
                    value={formData.qualification}
                    onChange={handleChange}
                    placeholder="e.g. 5th Standard Passed / Studying 10th"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-sm focus:outline-none focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
              </div>

              {/* Course Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  COURSE APPLIED FOR <span className="text-rose-500">*</span>
                </label>
                <select
                  name="course"
                  value={formData.course}
                  onChange={handleChange}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${formErrors.course
                      ? 'border-rose-500 bg-rose-50/50'
                      : 'border-slate-300 bg-slate-50/50 focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20'
                    }`}
                >
                  <option value="">Select Course</option>
                  {coursesList.map(c => {
                    const code = typeof c === 'string' ? c : (c.name || c);
                    const label = getCourseDisplayLabel ? getCourseDisplayLabel(c) : code;
                    return (
                      <option key={code} value={code}>{label}</option>
                    );
                  })}
                </select>
                {formErrors.course && <p className="text-xs text-rose-600 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" />{formErrors.course}</p>}
              </div>

            </div>
          </div>

          {/* SECTION 4: Declaration & Branch Location */}
          <div className="space-y-6 bg-slate-50 p-6 rounded-2xl border border-slate-200">

            <div className="space-y-5">
              {/* Declaration Checkbox */}
              <div>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    name="declared"
                    checked={formData.declared}
                    onChange={handleChange}
                    className="mt-1 w-5 h-5 rounded text-rose-600 focus:ring-rose-500 border-slate-300 cursor-pointer"
                  />
                  <span className="text-xs sm:text-sm text-slate-700 leading-relaxed group-hover:text-slate-900">
                    <strong className="text-slate-900">Declaration:</strong> I hereby declare that all details furnished above are true
                  </span>
                </label>
                {formErrors.declared && (
                  <p className="text-xs text-rose-600 flex items-center gap-1 mt-2 pl-8 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />{formErrors.declared}
                  </p>
                )}
              </div>

              {/* Branch Select (Required) */}
              <div className="space-y-1.5 pt-3 border-t border-slate-200/80">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  BRANCH <span className="text-rose-500">*</span>
                </label>
                <select
                  name="trustBranch"
                  value={formData.trustBranch}
                  onChange={handleChange}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${formErrors.trustBranch
                      ? 'border-rose-500 bg-rose-50/50'
                      : 'border-slate-300 bg-white focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20'
                    }`}
                >
                  <option value="">Select Branch</option>
                  {placesList.map(place => (
                    <option key={place} value={place}>{place}</option>
                  ))}
                </select>
                {formErrors.trustBranch && (
                  <p className="text-xs text-rose-600 flex items-center gap-1 mt-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />{formErrors.trustBranch}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 5: Documents & Candidate Photo Upload */}
          <div className="space-y-4">
            <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
              <Upload className="w-5 h-5 text-rose-600" /> Documents & Photo Upload
            </h4>

            {/* 3-Column Upload Boxes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Box 1: Candidate Photo Upload Box */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  CANDIDATE PHOTO <span className="text-rose-500">*</span>
                </label>
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className={`border-2 border-dashed rounded-2xl p-4 text-center transition-all min-h-[220px] flex flex-col items-center justify-center ${photoError
                      ? 'border-rose-400 bg-rose-50/40'
                      : photoPreview
                        ? 'border-emerald-500 bg-emerald-50/20'
                        : 'border-slate-300 hover:border-rose-500 bg-slate-50/60 hover:bg-rose-50/30'
                    }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files && handlePhotoSelect(e.target.files[0])}
                  />

                  {photoPreview ? (
                    <div className="flex flex-col items-center gap-2.5">
                      <div
                        className="relative group cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewLightboxData({
                            title: 'Candidate Photo Preview',
                            src: photoPreview,
                            type: 'image'
                          });
                        }}
                        title="Click to view full preview"
                      >
                        <img
                          src={photoPreview}
                          alt="Candidate Preview"
                          className="w-24 h-28 object-cover rounded-xl shadow-md border-2 border-emerald-500 hover:opacity-90 transition"
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition rounded-xl flex items-center justify-center text-white">
                          <Eye className="w-5 h-5 drop-shadow-md" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removePhoto();
                          }}
                          className="absolute -top-2 -right-2 bg-rose-600 text-white p-1 rounded-full shadow-md hover:bg-rose-700 transition cursor-pointer z-10"
                          title="Remove Photo"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewLightboxData({
                              title: 'Candidate Photo Preview',
                              src: photoPreview,
                              type: 'image'
                            });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer border border-indigo-200/80 shadow-sm"
                          title="Full Screen Preview"
                        >
                          <Eye className="w-3 h-3 text-indigo-600" />
                          <span>Preview</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCropModalData({ imageSrc: photoPreview, target: 'photo' });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer border border-slate-300 shadow-sm"
                          title="Crop & Adjust Photo"
                        >
                          <Crop className="w-3 h-3 text-rose-600" />
                          <span>Crop Photo</span>
                        </button>
                      </div>
                      <div className="text-xs text-slate-600 text-center">
                        <p className="font-semibold text-emerald-700 flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Photo Ready
                        </p>
                        <p className="text-slate-500 text-[11px] mt-0.5">{photo?.name || 'candidate_photo.jpg'} ({(photo?.size ? (photo.size / 1024).toFixed(1) : '150')} KB)</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-800">
                          Drag & Drop candidate photo, or choose below
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                          Supports JPG, JPEG, PNG • Max size: 5 MB<br />
                          <span className="text-emerald-600 font-semibold">(Auto-compressed to ~200 KB)</span>
                        </p>
                      </div>

                      {/* Browse and Camera Buttons */}
                      <div className="flex items-center justify-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold border border-rose-200/80 flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Browse</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openCameraModal('photo')}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                        >
                          <Camera className="w-3.5 h-3.5 text-rose-400" />
                          <span>Camera</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {photoError && (
                  <p className="text-xs text-rose-600 flex items-center gap-1 font-medium mt-1">
                    <AlertCircle className="w-3.5 h-3.5" />{photoError}
                  </p>
                )}
                {formErrors.photo && (
                  <p className="text-xs text-rose-600 flex items-center gap-1 font-medium mt-1">
                    <AlertCircle className="w-3.5 h-3.5" />{formErrors.photo}
                  </p>
                )}
              </div>

              {/* Box 2: Aadhar Card Upload Box */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  UPLOAD AADHAR CARD
                </label>
                <div
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleAadharSelect(e.dataTransfer.files[0]);
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  className={`border-2 border-dashed rounded-2xl p-4 text-center transition-all min-h-[220px] flex flex-col items-center justify-center ${aadharError
                      ? 'border-rose-400 bg-rose-50/40'
                      : aadharPreview
                        ? 'border-emerald-500 bg-emerald-50/20'
                        : 'border-slate-300 hover:border-rose-500 bg-slate-50/60 hover:bg-rose-50/30'
                    }`}
                >
                  <input
                    ref={aadharInputRef}
                    type="file"
                    accept="image/*,.pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => e.target.files && handleAadharSelect(e.target.files[0])}
                  />

                  {isCompressingAadhar ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 text-rose-600 animate-spin" />
                      <p className="text-xs font-semibold text-slate-700">Compressing & Preparing Document...</p>
                    </div>
                  ) : aadharPreview ? (
                    <div className="flex flex-col items-center gap-2.5 w-full">
                      <div
                        className="relative group cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewLightboxData({
                            title: 'Aadhar Card Document Preview',
                            src: aadharPreview,
                            type: aadharFileType
                          });
                        }}
                        title="Click to view full preview"
                      >
                        {aadharFileType === 'pdf' ? (
                          <div className="w-20 h-24 bg-rose-50 border-2 border-rose-400 rounded-xl flex flex-col items-center justify-center shadow-md p-2 text-rose-700 hover:bg-rose-100 transition">
                            <FileText className="w-8 h-8 text-rose-600 mb-1" />
                            <span className="text-[10px] font-black uppercase tracking-wider">PDF DOC</span>
                          </div>
                        ) : (
                          <img
                            src={aadharPreview}
                            alt="Aadhar Preview"
                            className="w-24 h-24 object-cover rounded-xl shadow-md border-2 border-emerald-500 hover:opacity-90 transition"
                          />
                        )}
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition rounded-xl flex items-center justify-center text-white">
                          <Eye className="w-5 h-5 drop-shadow-md" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeAadhar();
                          }}
                          className="absolute -top-2 -right-2 bg-rose-600 text-white p-1 rounded-full shadow-md hover:bg-rose-700 transition cursor-pointer z-10"
                          title="Remove Document"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewLightboxData({
                              title: 'Aadhar Card Document Preview',
                              src: aadharPreview,
                              type: aadharFileType
                            });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer border border-indigo-200/80 shadow-sm"
                          title="Full Screen Preview"
                        >
                          <Eye className="w-3 h-3 text-indigo-600" />
                          <span>Preview</span>
                        </button>
                        {aadharFileType === 'image' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCropModalData({ imageSrc: aadharPreview, target: 'aadhar' });
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer border border-slate-300 shadow-sm"
                            title="Crop & Adjust Document"
                          >
                            <Crop className="w-3 h-3 text-rose-600" />
                            <span>Crop</span>
                          </button>
                        )}
                      </div>

                      <div className="text-xs text-center px-2">
                        <p className="font-semibold text-emerald-700 flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Document Uploaded & Compressed
                        </p>
                        <p className="text-slate-500 text-[11px] truncate max-w-[220px] mx-auto mt-0.5" title={aadharFileName}>
                          {aadharFileName} ({aadharFileSize} KB)
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-800">
                          Drag & Drop Aadhar card, or choose below
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                          Supports JPG, PNG, PDF • Max size: 5 MB<br />
                          <span className="text-emerald-600 font-semibold">(Auto-compressed to ~200 KB)</span>
                        </p>
                      </div>

                      {/* Browse and Camera Buttons */}
                      <div className="flex items-center justify-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => aadharInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold border border-rose-200/80 flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Browse</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openCameraModal('aadhar')}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                        >
                          <Camera className="w-3.5 h-3.5 text-rose-400" />
                          <span>Camera</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {aadharError && (
                  <p className="text-xs text-rose-600 flex items-center gap-1 font-medium mt-1">
                    <AlertCircle className="w-3.5 h-3.5" />{aadharError}
                  </p>
                )}
              </div>

              {/* Box 3: Marksheet Upload Box */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  UPLOAD MARKSHEET
                </label>
                <div
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleMarksheetSelect(e.dataTransfer.files[0]);
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  className={`border-2 border-dashed rounded-2xl p-4 text-center transition-all min-h-[220px] flex flex-col items-center justify-center ${marksheetError
                      ? 'border-rose-400 bg-rose-50/40'
                      : marksheetPreview
                        ? 'border-emerald-500 bg-emerald-50/20'
                        : 'border-slate-300 hover:border-rose-500 bg-slate-50/60 hover:bg-rose-50/30'
                    }`}
                >
                  <input
                    ref={marksheetInputRef}
                    type="file"
                    accept="image/*,.pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => e.target.files && handleMarksheetSelect(e.target.files[0])}
                  />

                  {isCompressingMarksheet ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 text-rose-600 animate-spin" />
                      <p className="text-xs font-semibold text-slate-700">Compressing & Preparing Document...</p>
                    </div>
                  ) : marksheetPreview ? (
                    <div className="flex flex-col items-center gap-2.5 w-full">
                      <div
                        className="relative group cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewLightboxData({
                            title: 'Marksheet Document Preview',
                            src: marksheetPreview,
                            type: marksheetFileType
                          });
                        }}
                        title="Click to view full preview"
                      >
                        {marksheetFileType === 'pdf' ? (
                          <div className="w-20 h-24 bg-rose-50 border-2 border-rose-400 rounded-xl flex flex-col items-center justify-center shadow-md p-2 text-rose-700 hover:bg-rose-100 transition">
                            <FileText className="w-8 h-8 text-rose-600 mb-1" />
                            <span className="text-[10px] font-black uppercase tracking-wider">PDF DOC</span>
                          </div>
                        ) : (
                          <img
                            src={marksheetPreview}
                            alt="Marksheet Preview"
                            className="w-24 h-24 object-cover rounded-xl shadow-md border-2 border-emerald-500 hover:opacity-90 transition"
                          />
                        )}
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition rounded-xl flex items-center justify-center text-white">
                          <Eye className="w-5 h-5 drop-shadow-md" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeMarksheet();
                          }}
                          className="absolute -top-2 -right-2 bg-rose-600 text-white p-1 rounded-full shadow-md hover:bg-rose-700 transition cursor-pointer z-10"
                          title="Remove Document"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewLightboxData({
                              title: 'Marksheet Document Preview',
                              src: marksheetPreview,
                              type: marksheetFileType
                            });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer border border-indigo-200/80 shadow-sm"
                          title="Full Screen Preview"
                        >
                          <Eye className="w-3 h-3 text-indigo-600" />
                          <span>Preview</span>
                        </button>
                        {marksheetFileType === 'image' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCropModalData({ imageSrc: marksheetPreview, target: 'marksheet' });
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer border border-slate-300 shadow-sm"
                            title="Crop & Adjust Document"
                          >
                            <Crop className="w-3 h-3 text-rose-600" />
                            <span>Crop</span>
                          </button>
                        )}
                      </div>

                      <div className="text-xs text-center px-2">
                        <p className="font-semibold text-emerald-700 flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Document Uploaded & Compressed
                        </p>
                        <p className="text-slate-500 text-[11px] truncate max-w-[220px] mx-auto mt-0.5" title={marksheetFileName}>
                          {marksheetFileName} ({marksheetFileSize} KB)
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-800">
                          Drag & Drop Marksheet, or choose below
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                          Supports JPG, PNG, PDF • Max size: 5 MB<br />
                          <span className="text-emerald-600 font-semibold">(Auto-compressed to ~200 KB)</span>
                        </p>
                      </div>

                      {/* Browse and Camera Buttons */}
                      <div className="flex items-center justify-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => marksheetInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold border border-rose-200/80 flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Browse</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openCameraModal('marksheet')}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                        >
                          <Camera className="w-3.5 h-3.5 text-rose-400" />
                          <span>Camera</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {marksheetError && (
                  <p className="text-xs text-rose-600 flex items-center gap-1 font-medium mt-1">
                    <AlertCircle className="w-3.5 h-3.5" />{marksheetError}
                  </p>
                )}
              </div>

            </div>
          </div>

          {/* SUBMIT ACTION BUTTON */}
          <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              type="button"
              onClick={resetForm}
              className="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-semibold transition cursor-pointer"
            >
              Reset Form
            </button>

            <button
              type="submit"
              disabled={isSubmitting || Boolean(submissionStatus)}
              className="w-full sm:w-auto bg-gradient-to-r from-red-600 via-rose-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white px-10 py-3.5 rounded-xl font-bold text-sm shadow-xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:pointer-events-none cursor-pointer"
            >
              {isSubmitting || Boolean(submissionStatus) ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing Application...</span>
                </>
              ) : (
                <>
                  <span>Submit</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

        </form>
      </div>

      {/* OFFICIAL ADMISSION FORM ACKNOWLEDGMENT VIEW */}
      {submittedData && (
        <div id="printable-admission-modal" className="fixed inset-0 z-50 flex items-center justify-center p-1.5 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto printable-modal">
          <div className="bg-white text-slate-900 rounded-2xl max-w-4xl w-full p-3 sm:p-8 shadow-2xl border border-slate-300 relative max-h-[95vh] overflow-y-auto">

            {/* Action Bar (Hidden when printing) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-6 print-hide print:hidden">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <CheckCircle2 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-slate-900">
                    Certificate Admission Confirmed
                  </h3>
                  <p className="text-xs text-slate-500">
                    Your registration has been successfully recorded. Print this slip for your records.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Slip</span>
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* PRINTABLE OFFICIAL ADMISSION FORM DOCUMENT */}
            <div id="printable-admission-form" className="bg-white text-slate-900 space-y-6 font-sans p-2 sm:p-4 printable-document">

              {/* Header Section */}
              <div className="flex items-start justify-between relative pb-2 border-b border-slate-200">
                <div className="w-14 h-14 sm:w-20 sm:h-20 flex-shrink-0">
                  <img src="/logo-1.jpg" alt="SLE Institutions Logo" className="w-full h-full object-contain" />
                </div>

                <div className="text-center flex-1 px-2">
                  <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
                    SLE INSTITUTIONS
                  </h1>
                  <p className="text-[9px] sm:text-xs font-semibold text-slate-700 mt-0.5 leading-tight max-w-2xl mx-auto">
                    (Sharing Computer Literacy Movement with Govt. of India) Recognized by Govt. Of INDIA. ISO 21001:2025 Certified Institute.
                  </p>
                  <p className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-widest mt-1">
                    Certificate Admission Form
                  </p>
                </div>

                <div className="w-14 sm:w-20 flex-shrink-0" />
              </div>

              {/* Main Border Boxed Form Details */}
              <div className="border border-slate-800 p-4 sm:p-8 relative min-h-[460px] text-xs sm:text-sm font-mono text-slate-900 bg-white">
                <div className="flex flex-col-reverse sm:flex-row justify-between items-start gap-6">

                  {/* Fields Table Grid */}
                  <div className="w-full sm:max-w-[calc(100%-140px)] space-y-3 pt-1">

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">REGISTRATION NO:</span>
                      <span className="font-bold text-slate-900 text-sm tracking-wider break-all">{submittedData.certRegNo || submittedData.registrationNo || 'SLE-202637001'}</span>
                    </div>

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">ADMISSION DATE:</span>
                      <span className="font-semibold text-slate-900 break-all">{submittedData.admissionDate || submittedData.createdDate || today}</span>
                    </div>

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">NAME:</span>
                      <span className="font-semibold text-slate-900 uppercase break-words">{submittedData.fullName}</span>
                    </div>

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">FATHER NAME:</span>
                      <span className="font-semibold text-slate-900 break-words">{submittedData.fatherName}</span>
                    </div>

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">DATE OF BIRTH:</span>
                      <span className="font-semibold text-slate-900 break-words">{submittedData.dobYear} {submittedData.dobMonth}, {submittedData.dobDay}</span>
                    </div>

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">CASTE:</span>
                      <span className="font-semibold text-slate-900 uppercase break-words">{submittedData.casteCategory}</span>
                    </div>

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">ADDRESS:</span>
                      <span className="font-medium text-slate-900 break-words">{submittedData.address}</span>
                    </div>

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">EMAIL ID:</span>
                      <span className="font-medium text-slate-900 lowercase break-all">{submittedData.email || 'N/A'}</span>
                    </div>

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">CONTACT NO:</span>
                      <span className="font-semibold text-slate-900 break-all">{submittedData.contactNo}</span>
                    </div>

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">QUALIFICATION:</span>
                      <span className="font-semibold text-slate-900 uppercase break-words">{submittedData.qualification || 'N/A'}</span>
                    </div>

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">COURSE:</span>
                      <span className="font-bold text-slate-900 uppercase break-words">{submittedData.course}</span>
                    </div>

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">BRANCH:</span>
                      <span className="font-semibold text-slate-900 break-words">{submittedData.trustBranch || 'N/A'}</span>
                    </div>

                  </div>

                  {/* Candidate Photo */}
                  <div className="self-center sm:self-start flex-shrink-0 w-28 sm:w-32 h-36 sm:h-40 border border-slate-800 bg-slate-100 flex items-center justify-center overflow-hidden shadow-sm">
                    {submittedData.photoPreview || submittedData.photoUrl || submittedData.photo ? (
                      <img
                        src={submittedData.photoPreview || submittedData.photoUrl || submittedData.photo}
                        alt="Candidate Photo"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400 font-sans text-center px-2">Photo</span>
                    )}
                  </div>

                </div>

                {/* Bottom Declaration Statement */}
                <div className="pt-8 border-t border-slate-200 mt-6">
                  <p className="font-bold text-slate-900 text-xs tracking-tight">
                    I hereby declare that the details furnished above are true.
                  </p>
                </div>

              </div>

              {/* Bottom Footer Office Address */}
              <div className="text-center pt-3 pb-1 border-t border-slate-200 space-y-0.5">
                <p className="text-[10px] sm:text-xs font-bold text-slate-800 tracking-tight">
                  Regd Office: KHB COLONY SOLAPUR ROAD VIJAYAPURA 586101 &bull; Contact: 9482354550 &bull; Email: slesindia.headoffice@gmail.com
                </p>
                <p className="text-[10px] sm:text-xs font-bold text-slate-800 tracking-tight">
                  Administrative office: Opposite Bus Stand Satti Road Athani Belgaum 591304 &bull; Contact: 9611351295, 9916563591 &bull; Email: slesinstitute100@gmail.com
                </p>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* STATE-DRIVEN SUBMISSION OVERLAY */}
      {submissionStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 text-slate-900 text-center space-y-6 relative animate-in zoom-in-95 duration-200">
            
            {/* Status Icon */}
            <div className="mx-auto w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg transition-all duration-300">
              {submissionStatus === 'error' ? (
                <div className="w-full h-full rounded-3xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 animate-bounce">
                  <AlertCircle className="w-10 h-10" />
                </div>
              ) : submissionStatus === 'success' ? (
                <div className="w-full h-full rounded-3xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 scale-110 transition-transform">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                </div>
              ) : (
                <div className="w-full h-full rounded-3xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                  <Loader2 className="w-10 h-10 animate-spin text-rose-600" />
                </div>
              )}
            </div>

            {/* Title & Subtitle */}
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                {submissionStatus === 'error'
                  ? 'Submission Interrupted'
                  : submissionStatus === 'success'
                  ? 'Admission Confirmed!'
                  : 'Submitting Application'}
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 max-w-xs mx-auto">
                {submissionStatus === 'error'
                  ? 'We encountered an issue during submission.'
                  : submissionStatus === 'success'
                  ? 'All details successfully registered and secured.'
                  : 'Please keep this window open. Do not refresh or close.'}
              </p>
            </div>

            {/* Student Identity Card */}
            {(formData.fullName || formData.email || formData.contactNo) && (
              <div className="flex items-center gap-3 bg-gradient-to-r from-rose-50 to-slate-50 border border-rose-100 rounded-2xl px-4 py-3 text-left">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
                  {formData.fullName
                    ? formData.fullName.trim().split(' ').slice(0, 2).map(n => n[0]?.toUpperCase()).join('')
                    : '?'}
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  {formData.fullName && (
                    <p className="text-[13px] font-black text-slate-900 truncate leading-tight">
                      {formData.fullName.trim()}
                    </p>
                  )}
                  {formData.email && (
                    <p className="text-[11px] text-slate-500 truncate flex items-center gap-1 leading-tight">
                      <span className="text-rose-400">✉</span>
                      {formData.email.trim()}
                    </p>
                  )}
                  {formData.contactNo && (
                    <p className="text-[11px] text-slate-500 truncate flex items-center gap-1 leading-tight">
                      <span className="text-rose-400">📞</span>
                      {formData.contactNo.trim()}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step-by-Step Status Indicators */}
            {submissionStatus !== 'error' && (
              <div className="space-y-3 text-left bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs">
                
                {/* Step 1 */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {['step2', 'step3', 'success'].includes(submissionStatus) ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                    ) : submissionStatus === 'step1' ? (
                      <Loader2 className="w-5 h-5 text-rose-600 animate-spin shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0" />
                    )}
                    <span className={`font-semibold truncate ${['step2', 'step3', 'success'].includes(submissionStatus) ? 'text-emerald-700 font-bold' : submissionStatus === 'step1' ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
                      Compressing & Uploading Student Photo...
                    </span>
                  </div>
                  <span className="text-[11px] font-bold shrink-0">
                    {['step2', 'step3', 'success'].includes(submissionStatus) ? '✅ Done' : submissionStatus === 'step1' ? '⏳ Uploading' : 'Waiting'}
                  </span>
                </div>

                {/* Step 2 */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {['step3', 'success'].includes(submissionStatus) ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                    ) : submissionStatus === 'step2' ? (
                      <Loader2 className="w-5 h-5 text-rose-600 animate-spin shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0" />
                    )}
                    <span className={`font-semibold truncate ${['step3', 'success'].includes(submissionStatus) ? 'text-emerald-700 font-bold' : submissionStatus === 'step2' ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
                      Securing Registration & Saving to Database...
                    </span>
                  </div>
                  <span className="text-[11px] font-bold shrink-0">
                    {['step3', 'success'].includes(submissionStatus) ? '✅ Saved' : submissionStatus === 'step2' ? '⏳ Saving' : 'Waiting'}
                  </span>
                </div>

                {/* Step 3 */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {submissionStatus === 'success' ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                    ) : submissionStatus === 'step3' ? (
                      <Loader2 className="w-5 h-5 text-rose-600 animate-spin shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0" />
                    )}
                    <span className={`font-semibold truncate ${submissionStatus === 'success' ? 'text-emerald-700 font-bold' : submissionStatus === 'step3' ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
                      Generating Admission Confirmation...
                    </span>
                  </div>
                  <span className="text-[11px] font-bold shrink-0">
                    {submissionStatus === 'success' ? '✅ Ready' : submissionStatus === 'step3' ? '⏳ Preparing' : 'Waiting'}
                  </span>
                </div>

                {submissionStatus === 'success' && (
                  <div className="pt-2 border-t border-slate-200/80 text-center font-bold text-emerald-600 text-xs flex items-center justify-center gap-1.5 animate-in fade-in">
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    <span>All Done! Registration Recorded.</span>
                  </div>
                )}

              </div>
            )}

            {/* Error Message */}
            {submissionStatus === 'error' && (
              <div className="space-y-4">
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 font-medium leading-relaxed">
                  {submissionError || 'Upload failed: Please check your internet connection and Try Again'}
                </div>
                <button
                  type="button"
                  onClick={() => setSubmissionStatus(null)}
                  className="w-full py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Back to Form
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* STUDENT FEE PAYMENT POPUP MODAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-rose-100 space-y-6 relative animate-in zoom-in-95 duration-200 text-slate-900">

            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                setShowPaymentModal(false);
                setIsProcessingPayment(false);
              }}
              disabled={isProcessingPayment}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header Icon & Title */}
            <div className="space-y-3 text-center pt-2">
              <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-md">
                <CreditCard className="w-8 h-8 text-rose-600" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  Certificate Admission Charges
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Official Admission Application & Registration Fee (SLE Institution)
                </p>
              </div>
            </div>

            {/* Application Charges Badge */}
            <div className="p-3 rounded-xl border text-xs font-semibold text-center bg-rose-50 text-rose-800 border-rose-200">
              <div className="flex items-center justify-center gap-1.5 font-bold">
                <Sparkles className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Certificate Admission Charges: ₹{applicableFee.toLocaleString()}</span>
              </div>
            </div>

            {/* Summary Details Card */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                <span className="text-slate-500 font-semibold">Applicant Name:</span>
                <span className="font-extrabold text-slate-900">{formData.fullName}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                <span className="text-slate-500 font-semibold">Course Applied:</span>
                <span className="font-extrabold text-rose-600">{formData.course}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                <span className="text-slate-500 font-semibold">Reg. Number:</span>
                <span className="font-mono font-bold text-rose-600">{formData.registrationNo}</span>
              </div>
              <div className="flex justify-between items-center pt-1 text-sm">
                <span className="text-slate-700 font-extrabold">Total Payable:</span>
                <span className="text-base font-black text-rose-600">₹{applicableFee.toLocaleString()}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleExecutePayment}
                disabled={isProcessingPayment}
                className="w-full bg-gradient-to-r from-red-600 via-rose-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 text-xs sm:text-sm hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60"
              >
                {isProcessingPayment ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Payment...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Pay ₹{applicableFee.toLocaleString()} & Complete Submission</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowPaymentModal(false);
                  setIsProcessingPayment(false);
                }}
                disabled={isProcessingPayment}
                className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer text-center"
              >
                Cancel / Edit Application
              </button>
            </div>

          </div>
        </div>
      )}

      {/* LIVE CAMERA CAPTURE MODAL */}
      {showCameraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 relative animate-in zoom-in-95 duration-200 text-slate-900">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-sm">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Capture {cameraTarget === 'photo' ? 'Candidate Photo' : cameraTarget === 'aadhar' ? 'Aadhar Card' : 'Marksheet'}
                  </h3>
                  <p className="text-xs text-slate-500">Center subject in frame & click Snap Photo</p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeCameraModal}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
                title="Close Camera"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Stream Area */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-[4/3] flex items-center justify-center border-2 border-slate-800 shadow-inner">
              {isCameraLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white bg-slate-900/90 z-10">
                  <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
                  <p className="text-xs font-semibold">Starting camera...</p>
                </div>
              )}

              {cameraError ? (
                <div className="p-6 text-center text-rose-400 space-y-3 z-10">
                  <CameraOff className="w-10 h-10 mx-auto text-rose-500" />
                  <p className="text-xs font-semibold leading-relaxed">{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => startCamera(facingMode)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Camera</span>
                  </button>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={toggleFacingMode}
                disabled={!!cameraError || isCameraLoading}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                title="Switch Camera (Front / Rear)"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                <span>Switch Camera</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeCameraModal}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={captureCameraPhoto}
                  disabled={!!cameraError || isCameraLoading}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-rose-600/30 transition disabled:opacity-50 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Snap Photo</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* INTERACTIVE IMAGE CROPPER MODAL */}
      {cropModalData && (
        <ImageCropperModal
          imageSrc={cropModalData.imageSrc}
          targetType={cropModalData.target}
          title={`Crop & Adjust ${cropModalData.target === 'photo' ? 'Candidate Photo' : cropModalData.target === 'aadhar' ? 'Aadhar Card' : 'Marksheet'}`}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropModalData(null)}
          onRetake={handleCropRetake}
        />
      )}

      {/* FULL-SCREEN DOCUMENT & PHOTO PREVIEW LIGHTBOX MODAL */}
      {previewLightboxData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                  <Eye className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                  {previewLightboxData.title || 'Document Preview'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewLightboxData(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition cursor-pointer"
                title="Close Preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Viewer */}
            <div className="p-4 sm:p-6 overflow-auto flex-1 flex items-center justify-center bg-slate-100 min-h-[350px]">
              {previewLightboxData.type === 'pdf' ? (
                <iframe
                  src={previewLightboxData.src}
                  title={previewLightboxData.title}
                  className="w-full h-[70vh] rounded-xl border border-slate-300 shadow-inner"
                />
              ) : (
                <img
                  src={previewLightboxData.src}
                  alt={previewLightboxData.title}
                  className="max-w-full max-h-[70vh] object-contain rounded-2xl shadow-lg border border-slate-200 bg-white"
                />
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-slate-50">
              <span className="text-xs font-semibold text-slate-500">
                Format: <strong className="uppercase text-slate-700">{previewLightboxData.type || 'IMAGE'}</strong>
              </span>
              <button
                type="button"
                onClick={() => setPreviewLightboxData(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
