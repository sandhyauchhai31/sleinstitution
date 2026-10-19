import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Users,
  Calendar,
  MapPin,
  Mail,
  Phone,
  CreditCard,
  FileCheck,
  GraduationCap,
  BookOpen,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Printer,
  Sparkles,
  X,
  Building2,
  Check,
  ShieldAlert,
  ArrowRight,
  Camera,
  CameraOff,
  RefreshCw,
  FileText,
  Crop,
  Eye
} from 'lucide-react';
import { db, doc, setDoc, deleteDoc, collection, getDocs, getDoc } from '../firebase';
import { uploadToCloudinary, compressImage } from '../utils/cloudinary';
import { subscribeToBranches, DEFAULT_BRANCHES } from '../utils/branchManager';
import { subscribeToCourses, DEFAULT_COURSES, getCourseDisplayLabel } from '../utils/courseManager';
import { allocateNextRegistrationNo, peekNextRegistrationNo, getBaseRegNo, BASE_REG_NO } from '../utils/registrationManager';
import { recordTransaction } from '../utils/transactionManager';
import ImageCropperModal from '../components/ImageCropperModal';

export default function ApplicationForm() {
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
    registrationNo: String(getBaseRegNo(today)),
    admissionDate: today,
    selectedClass: '10th',
    trainingPlan: 'Regular'
  });

  // Photo State
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const fileInputRef = useRef(null);

  // Aadhar Card Document State (Supports PDF & Images, Max 2MB, compressed to 200KB)
  const [aadharFile, setAadharFile] = useState(null);
  const [aadharPreview, setAadharPreview] = useState(null);
  const [aadharFileType, setAadharFileType] = useState('');
  const [aadharFileName, setAadharFileName] = useState('');
  const [aadharFileSize, setAadharFileSize] = useState(0);
  const [aadharError, setAadharError] = useState('');
  const [isCompressingAadhar, setIsCompressingAadhar] = useState(false);
  const aadharInputRef = useRef(null);

  // Marksheet Document State (Supports PDF & Images, Max 2MB, compressed to 200KB)
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
        e.returnValue = 'Application submission is in progress. Please do not close or refresh this page!';
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

  // Dynamic Franchisee Fee State
  const [firstTimeFee, setFirstTimeFee] = useState(20000);
  const [standardFee, setStandardFee] = useState(() => Number(localStorage.getItem('sle_standard_fee')) || 500);
  const [applicableFee, setApplicableFee] = useState(() => Number(localStorage.getItem('sle_standard_fee')) || 500);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);
  const [checkingPaymentHistory, setCheckingPaymentHistory] = useState(false);

  // Load Pricing Settings from Firestore & Local Storage (One-time fetch)
  useEffect(() => {
    const storedFirstTime = Number(localStorage.getItem('sle_first_time_fee'));
    const storedStandard = Number(localStorage.getItem('sle_standard_fee'));
    if (storedFirstTime) setFirstTimeFee(storedFirstTime);
    if (storedStandard) {
      setStandardFee(storedStandard);
      setApplicableFee(storedStandard);
    }

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
            setApplicableFee(data.standardFee);
            localStorage.setItem('sle_standard_fee', String(data.standardFee));
          }
        }
      } catch (e) {
        console.log('Pricing load notice in application form:', e);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Verify Payment & Calculate Student Application Charges
  const checkUserPaymentHistory = async (userEmail, userPhone) => {
    setCheckingPaymentHistory(true);
    const activeStdFee = Number(localStorage.getItem('sle_standard_fee')) || standardFee || 500;
    setApplicableFee(activeStdFee);
    setCheckingPaymentHistory(false);
    return activeStdFee;
  };

  // Generate Year options starting from 1980
  const currentYear = new Date().getFullYear();
  const startYear = 1980;
  const years = Array.from({ length: currentYear - startYear + 1 }, (_, i) => 1980 + i);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const [coursesList, setCoursesList] = useState(DEFAULT_COURSES);

  // Dynamic Real-time Courses Subscription from Admin Panel / Firestore
  useEffect(() => {
    const unsub = subscribeToCourses((coursesData) => {
      if (Array.isArray(coursesData) && coursesData.length > 0) {
        const names = coursesData.map(c => (typeof c === 'string' ? c : c.name)).filter(Boolean);
        setCoursesList(names);
      }
    });
    return () => unsub && unsub();
  }, []);

  const categories = ['General (GM)', 'OBC (Category-1/2A/2B/3A/3B)', 'SC (Scheduled Caste)', 'ST (Scheduled Tribe)', 'EWS'];

  const [placesList, setPlacesList] = useState(DEFAULT_BRANCHES);

  // Dynamic Real-time Branches Subscription from Admin Panel / Firestore
  useEffect(() => {
    // If a franchisee portal user is logged in, automatically pre-fill their branch
    try {
      const portalUser = JSON.parse(localStorage.getItem('sle_portal_user_data') || '{}');
      const userBranch = portalUser.location || portalUser.trustBranch || portalUser.city || '';
      if (userBranch) {
        setFormData(prev => ({
          ...prev,
          trustBranch: prev.trustBranch || userBranch
        }));
      }
    } catch (e) { }

    const unsub = subscribeToBranches((branchesData) => {
      if (Array.isArray(branchesData) && branchesData.length > 0) {
        let names = branchesData.map(b => (typeof b === 'string' ? b : b.name)).filter(Boolean);
        try {
          const portalUser = JSON.parse(localStorage.getItem('sle_portal_user_data') || '{}');
          const userBranch = portalUser.location || portalUser.trustBranch || '';
          if (userBranch && !names.includes(userBranch)) {
            names.push(userBranch);
          }
        } catch (e) { }
        if (!names.includes('Mysore')) names.push('Mysore');
        setPlacesList(Array.from(new Set(names)).sort());
      }
    });
    return () => unsub && unsub();
  }, []);

  // Fetch next expected registration number for preview display based on admission year (non-mutating)
  const fetchNextRegistrationNo = async (targetDate) => {
    const dateToUse = targetDate || formData.admissionDate || today;
    try {
      const nextReg = await peekNextRegistrationNo(db, dateToUse);
      setFormData(prev => ({ ...prev, registrationNo: nextReg }));
      return nextReg;
    } catch (err) {
      console.warn('Error peeking next registration number:', err);
      return String(getBaseRegNo(dateToUse));
    }
  };

  useEffect(() => {
    fetchNextRegistrationNo(formData.admissionDate);
  }, [formData.admissionDate]);

  // Handle Input Changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let finalVal = type === 'checkbox' ? checked : value;

    if (name === 'contactNo') {
      finalVal = value.replace(/\D/g, '').slice(0, 10);
    } else if (name === 'aadharNo') {
      finalVal = value.replace(/\D/g, '').slice(0, 12);
    }

    setFormData(prev => ({
      ...prev,
      [name]: finalVal
    }));

    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Handle Photo Selection (From File Browser / Drag & Drop / Camera / Cropper Modal)
  const handlePhotoSelect = async (fileOrDataUrl) => {
    setPhotoError('');
    if (!fileOrDataUrl) return;

    // Case 1: Result from ImageCropperModal (Base64 Data URL or string)
    if (typeof fileOrDataUrl === 'string') {
      setPhoto(fileOrDataUrl);
      setPhotoPreview(fileOrDataUrl);
      return;
    }

    // Case 2: File object from File Input / Drag & Drop
    const file = fileOrDataUrl;
    if (file.type && !file.type.startsWith('image/')) {
      setPhotoError('Please upload a valid image file (JPG, JPEG, PNG).');
      return;
    }

    if (file.size && file.size > 5 * 1024 * 1024) {
      setPhotoError(`File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of 5 MB.`);
      return;
    }

    // Automatically open ImageCropperModal so candidate photo is always cropped/adjusted first
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

  // Canvas Image Compression Helper (Compresses images to under 200 KB)
  const compressImageFile = (file, maxKB = 200) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          const MAX_DIM = 1200;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          let quality = 0.85;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);

          while (dataUrl.length * 0.75 > maxKB * 1024 && quality > 0.15) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          resolve(dataUrl);
        };
        img.onerror = (err) => reject(err);
        img.src = event.target.result;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // Handle Aadhar Card Document Selection (Supports PDF & Images, Max 2MB -> Compress to ~200KB)
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

    // Check size limit: max 5 MB = 5 * 1024 * 1024 bytes
    if (file.size > 5 * 1024 * 1024) {
      setAadharError(`File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of 5 MB.`);
      return;
    }

    setIsCompressingAadhar(true);

    try {
      // Compress both image and PDF documents to under 200 KB
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

  // Handle Marksheet Document Selection (Supports PDF & Images, Max 5MB -> Compress to ~200KB)
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

    // Check size limit: max 5 MB = 5 * 1024 * 1024 bytes
    if (file.size > 5 * 1024 * 1024) {
      setMarksheetError(`File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of 5 MB.`);
      return;
    }

    setIsCompressingMarksheet(true);

    try {
      // Compress both image and PDF documents to under 200 KB
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

    // Immediately open Image Cropper Modal after snapping photo
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

  // Validate Phone Number (Strict 10-digit Indian Mobile & Fake Pattern Check)
  const validatePhoneNumber = (phone) => {
    const cleanPhone = (phone || '').trim().replace(/\D/g, '');

    if (!cleanPhone) {
      return 'Mobile Contact Number is required';
    }

    if (cleanPhone.length !== 10) {
      return 'Mobile number must be exactly 10 digits';
    }

    if (!/^[6-9]/.test(cleanPhone)) {
      return 'Please enter a valid Indian mobile number starting with 6, 7, 8, or 9';
    }

    // Reject all identical digits (0000000000, 1111111111, 9999999999, etc.)
    if (/^(\d)\1{9}$/.test(cleanPhone)) {
      return 'Invalid / Fake mobile number (repeated digits not allowed)';
    }

    // Reject common fake/dummy numbers
    const fakePhoneList = [
      '1234567890', '0123456789', '9876543210', '9876543211', '1234512345',
      '9999999999', '8888888888', '7777777777', '6666666666', '9000000000',
      '8000000000', '7000000000', '6000000000', '9123456789', '9898989898'
    ];
    if (fakePhoneList.includes(cleanPhone)) {
      return 'Invalid / Fake mobile number. Please enter a valid 10-digit mobile number';
    }

    return null;
  };

  // Validate Email Address (Strict Email Regex & Fake Pattern Check)
  const validateEmailAddress = (email) => {
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail) {
      return 'Email ID is required';
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(cleanEmail)) {
      return 'Please enter a valid Email ID (e.g. student@gmail.com)';
    }

    const [username, domain] = cleanEmail.split('@');

    if (!username || username.length < 3) {
      return 'Email username is too short or invalid';
    }

    if (!domain || !domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
      return 'Please enter a valid email domain (e.g. @gmail.com)';
    }

    const fakeEmailList = [
      'test@test.com', 'test@gmail.com', 'abc@gmail.com', 'xyz@gmail.com',
      'fake@gmail.com', 'admin@gmail.com', 'noemail@gmail.com', 'user@gmail.com',
      'asdf@gmail.com', '123@gmail.com', 'sample@gmail.com', 'demo@gmail.com',
      'temp@gmail.com', 'mail@gmail.com', 'none@gmail.com', 'null@gmail.com',
      'a@gmail.com', 'ab@gmail.com'
    ];

    if (fakeEmailList.includes(cleanEmail)) {
      return 'Invalid / Fake Email ID. Please enter your real Email ID';
    }

    if (/^(abc|xyz|test|fake|admin|asdf|1234|qwer|demo|sample|temp)$/i.test(username)) {
      return 'Invalid / Fake Email username. Please enter a valid Email ID';
    }

    return null;
  };

  // Comprehensive Duplicate Student Admission Check
  // Prevents a student from submitting an admission form 2 times
  const checkDuplicateStudent = async (data) => {
    const cleanPhone = (data.contactNo || '').trim();
    const cleanEmail = (data.email || '').trim().toLowerCase();
    const cleanAadhar = (data.aadharNo || '').replace(/\D/g, '');
    const cleanName = (data.fullName || '').trim().toLowerCase();
    const cleanFather = (data.fatherName || '').trim().toLowerCase();

    // Helper to test if a record matches current student credentials
    const matchesRecord = (r) => {
      // 1. Phone match
      if (cleanPhone && r.contactNo && String(r.contactNo).trim() === cleanPhone) {
        return { isDuplicate: true, field: 'contactNo', message: 'This mobile number is already registered for an admission application.' };
      }
      // 2. Email match
      if (cleanEmail && r.email && String(r.email).trim().toLowerCase() === cleanEmail) {
        return { isDuplicate: true, field: 'email', message: 'This Email ID is already registered for a student admission.' };
      }
      // 3. Aadhar Card Number match (if provided)
      if (cleanAadhar && cleanAadhar.length >= 10 && r.aadharNo && String(r.aadharNo).replace(/\D/g, '') === cleanAadhar) {
        return { isDuplicate: true, field: 'aadharNo', message: 'This Aadhar card number is already registered for a student admission.' };
      }

      return null;
    };

    // 1. Check LocalStorage cache
    try {
      const cached = JSON.parse(localStorage.getItem('sle_students_cache') || '[]');
      for (const item of cached) {
        const result = matchesRecord(item);
        if (result) return result;
      }
    } catch (e) { }

    // 2. Check Firestore collections (students & applications)
    try {
      if (db) {
        const studSnap = await getDocs(collection(db, 'students'));
        for (const doc of studSnap.docs) {
          const result = matchesRecord(doc.data());
          if (result) return result;
        }

        const appSnap = await getDocs(collection(db, 'applications'));
        for (const doc of appSnap.docs) {
          const result = matchesRecord(doc.data());
          if (result) return result;
        }
      }
    } catch (e) {
      console.log('Duplicate student check notice:', e);
    }

    return null;
  };

  // Validation
  const validate = () => {
    const errors = {};
    if (!formData.fullName.trim()) errors.fullName = 'Full Student Name is required';
    if (!formData.fatherName.trim()) errors.fatherName = "Father's Name is required";
    if (!formData.dobDay || !formData.dobMonth || !formData.dobYear) errors.dob = 'Complete Date of Birth is required';
    if (!formData.casteCategory) errors.casteCategory = 'Caste / Category selection is required';
    if (!formData.address.trim()) errors.address = 'Full Postal Address is required';
    if (!formData.course) errors.course = 'Please select a Course';
    if (!formData.trustBranch) errors.trustBranch = 'Please select a Branch';
    if (!formData.declared) errors.declared = 'You must accept the declaration to proceed';
    if (!photo) errors.photo = 'Passport photo upload is required';

    // Validate Phone Number
    const phoneErr = validatePhoneNumber(formData.contactNo);
    if (phoneErr) errors.contactNo = phoneErr;

    // Validate Email Address
    const emailErr = validateEmailAddress(formData.email);
    if (emailErr) errors.email = emailErr;

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Helper to safely save or update pre-payment draft in 'pending_payments'
  const savePendingPaymentDraft = async (overrideAppNumber = null, extraData = {}) => {
    const appNumber = overrideAppNumber || currentDraftAppNumber || ('SLE-2026-' + Math.floor(100000 + Math.random() * 900000));
    if (!currentDraftAppNumber) {
      setCurrentDraftAppNumber(appNumber);
    }

    // Resolve Franchisee information
    let currentFranchiseeId = 'FR-DEFAULT';
    let currentFranchiseeName = formData.trustBranch || 'Athani';
    let currentFranchiseeRegDate = '2026-08-20';
    try {
      const portalUser = JSON.parse(localStorage.getItem('sle_portal_user_data') || '{}');
      if (portalUser && (portalUser.id || portalUser.environmentId)) {
        currentFranchiseeId = portalUser.id || portalUser.environmentId;
        currentFranchiseeName = portalUser.franchiseName || portalUser.location || portalUser.fullName || currentFranchiseeName;
        currentFranchiseeRegDate = portalUser.registrationDate || portalUser.createdDate || portalUser.purchaseDate || currentFranchiseeRegDate;
      } else {
        const cachedFranchisees = JSON.parse(localStorage.getItem('sle_franchisees_cache') || '[]');
        const branchLower = (formData.trustBranch || '').trim().toLowerCase();
        const match = cachedFranchisees.find(f =>
          (f.location && f.location.toLowerCase() === branchLower) ||
          (f.franchiseName && f.franchiseName.toLowerCase().includes(branchLower))
        );
        if (match) {
          currentFranchiseeId = match.id;
          currentFranchiseeName = match.franchiseName || match.location || currentFranchiseeName;
          currentFranchiseeRegDate = match.registrationDate || match.createdDate || match.purchaseDate || currentFranchiseeRegDate;
        } else if (formData.trustBranch && formData.trustBranch.trim()) {
          currentFranchiseeId = `FR-${formData.trustBranch.trim().toUpperCase()}`;
        }
      }
    } catch (e) { }

    // Compress photo/docs if oversized to keep draft document safely within Firestore's 1MB limit
    let safePhoto = photoPreview || '';
    let safeAadhar = aadharPreview || '';
    let safeMarksheet = marksheetPreview || '';

    if (typeof safePhoto === 'string' && safePhoto.length > 400000) {
      try { safePhoto = await compressImage(safePhoto, 120); } catch (e) {}
    }
    if (typeof safeAadhar === 'string' && safeAadhar.length > 400000) {
      try { safeAadhar = await compressImage(safeAadhar, 120); } catch (e) {}
    }
    if (typeof safeMarksheet === 'string' && safeMarksheet.length > 400000) {
      try { safeMarksheet = await compressImage(safeMarksheet, 120); } catch (e) {}
    }

    const prePaymentDraft = {
      ...formData,
      id: appNumber,
      appNumber: appNumber,
      name: formData.fullName ? formData.fullName.trim() : '',
      fullName: formData.fullName ? formData.fullName.trim() : '',
      fatherName: formData.fatherName ? formData.fatherName.trim() : '',
      contactNo: formData.contactNo ? formData.contactNo.trim() : '',
      mobileNo: formData.contactNo ? formData.contactNo.trim() : '',
      course: formData.course || '',
      place: formData.trustBranch || currentFranchiseeName,
      trustBranch: formData.trustBranch || currentFranchiseeName,
      franchiseeId: currentFranchiseeId,
      franchiseName: currentFranchiseeName,
      franchiseeRegDate: currentFranchiseeRegDate,
      environmentId: currentFranchiseeId,
      environmentName: currentFranchiseeName,
      admissionDate: formData.admissionDate || new Date().toISOString().split('T')[0],
      selectedClass: formData.selectedClass || '10th',
      trainingPlan: 'Regular',
      feeAmount: applicableFee,
      isFirstTimeFranchisee: isFirstTimeUser,
      photoPreview: safePhoto || '',
      photoUrl: safePhoto || '',
      aadharPreview: safeAadhar || '',
      aadharUrl: safeAadhar || '',
      aadharFileType: aadharFileType || '',
      aadharFileName: aadharFileName || '',
      aadharFileSize: aadharFileSize || 0,
      marksheetPreview: safeMarksheet || '',
      marksheetUrl: safeMarksheet || '',
      marksheetFileType: marksheetFileType || '',
      marksheetFileName: marksheetFileName || '',
      marksheetFileSize: marksheetFileSize || 0,
      paymentStatus: 'Pending Payment',
      status: 'Draft',
      paymentMethod: 'Razorpay',
      gateway: 'Razorpay Test',
      createdDate: new Date().toISOString().split('T')[0],
      createdAt: Date.now(),
      draftSavedAt: new Date().toLocaleString(),
      hasHallTicket: false,
      hallTicketGenerated: false,
      ...extraData
    };

    // Remove any undefined keys so Firestore doesn't throw unsupported field error
    Object.keys(prePaymentDraft).forEach(k => {
      if (prePaymentDraft[k] === undefined) {
        prePaymentDraft[k] = '';
      }
    });

    if (db) {
      try {
        await Promise.race([
          setDoc(doc(db, 'pending_payments', appNumber), prePaymentDraft, { merge: true }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Draft write timeout')), 2500))
        ]);
        console.log('[PrePaymentDraft] Draft saved to pending_payments collection:', appNumber);
      } catch (draftErr) {
        console.warn('[PrePaymentDraft] Notice saving to pending_payments:', draftErr?.message || draftErr);
      }
    }

    try {
      localStorage.setItem('sle_active_payment_draft', JSON.stringify(prePaymentDraft));
      const existing = JSON.parse(localStorage.getItem('sle_pending_payments_cache') || '[]');
      const filtered = existing.filter(x => x && x.id !== appNumber);
      filtered.unshift(prePaymentDraft);
      localStorage.setItem('sle_pending_payments_cache', JSON.stringify(filtered));
      window.dispatchEvent(new CustomEvent('sle_pending_payments_updated', { detail: filtered }));
    } catch (e) { }

    return appNumber;
  };

  const handleCancelPaymentModal = async () => {
    setShowPaymentModal(false);
    if (currentDraftAppNumber) {
      try {
        const existing = JSON.parse(localStorage.getItem('sle_pending_payments_cache') || '[]');
        const updated = existing.map(item => item && item.id === currentDraftAppNumber ? {
          ...item,
          paymentStatus: 'Pending Payment',
          lastAction: 'Payment Cancelled / Returned to Form',
          cancelledAt: new Date().toLocaleString(),
          updatedAt: Date.now()
        } : item);
        localStorage.setItem('sle_pending_payments_cache', JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('sle_pending_payments_updated', { detail: updated }));
      } catch (e) {}

      if (db) {
        try {
          await Promise.race([
            setDoc(doc(db, 'pending_payments', currentDraftAppNumber), {
              paymentStatus: 'Pending Payment',
              lastAction: 'Payment Cancelled / Returned to Form',
              cancelledAt: new Date().toLocaleString(),
              updatedAt: Date.now()
            }, { merge: true }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
          ]);
        } catch (e) {}
      }
    }
  };

  // Form Submission Trigger (Checks Duplicate Student -> Checks Payment History -> Opens Payment Modal)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      window.scrollTo({ top: 300, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);

    // Duplicate Student Admission Check (Prevents submitting form 2 times for same student)
    const dupResult = await checkDuplicateStudent(formData);
    if (dupResult) {
      setFormErrors(prev => ({
        ...prev,
        [dupResult.field]: dupResult.message
      }));
      setIsSubmitting(false);
      window.scrollTo({ top: 300, behavior: 'smooth' });
      return;
    }

    // Check if user is first-time franchisee or returning user
    await checkUserPaymentHistory(formData.email.trim(), formData.contactNo.trim());

    try {
      // Generate or reuse App Number and save draft to pending_payments right away
      const assignedAppNumber = currentDraftAppNumber || ('SLE-2026-' + Math.floor(100000 + Math.random() * 900000));
      setCurrentDraftAppNumber(assignedAppNumber);
      await savePendingPaymentDraft(assignedAppNumber);
    } catch (draftErr) {
      console.warn('Draft save notice:', draftErr);
    } finally {
      setIsSubmitting(false);
      setShowPaymentModal(true);
    }
  };

  // Dynamic Razorpay Script Loader
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

  // Finalize Submission after successful payment with Real State-Driven Progress
  const finalizeApplicationSubmission = async (appNumber, paymentId = '', orderId = '') => {
    pendingSubmissionRef.current = { appNumber, paymentId, orderId };
    const activePaymentId = paymentId || `pay_sim_${Date.now()}`;
    const activeOrderId = orderId || `order_sim_${Date.now()}`;

    setShowPaymentModal(false);
    setIsProcessingPayment(false);
    setIsSubmitting(true);
    setSubmissionError('');

    try {
      // ─────────────────────────────────────────────────────────────
      // Step 1: "Compressing & Uploading Student Photo..." ⏳
      // ─────────────────────────────────────────────────────────────
      setSubmissionStatus('step1');

      let cloudinaryPhotoUrl = photoPreview || '';
      let cloudinaryAadharUrl = aadharPreview || '';
      let cloudinaryMarksheetUrl = marksheetPreview || '';

      if (photo || photoPreview) {
        try {
          const pUrl = await uploadToCloudinary(photo || photoPreview, 'sle_student_photos');
          if (pUrl) cloudinaryPhotoUrl = pUrl;
        } catch (err) {
          console.warn('Photo upload warning:', err);
        }
      }

      if (aadharFile || aadharPreview) {
        try {
          const aUrl = await uploadToCloudinary(aadharFile || aadharPreview, 'sle_aadhar_documents');
          if (aUrl) cloudinaryAadharUrl = aUrl;
        } catch (err) {
          console.warn('Aadhar upload warning:', err);
        }
      }

      if (marksheetFile || marksheetPreview) {
        try {
          const mUrl = await uploadToCloudinary(marksheetFile || marksheetPreview, 'sle_marksheet_documents');
          if (mUrl) cloudinaryMarksheetUrl = mUrl;
        } catch (err) {
          console.warn('Marksheet upload warning:', err);
        }
      }

      // ─────────────────────────────────────────────────────────────
      // Step 2: "Securing Registration & Saving to Database..." ⏳
      // ─────────────────────────────────────────────────────────────
      setSubmissionStatus('step2');

      // Get current logged in Franchisee Portal user details or map selected branch to Franchisee ID
      let currentFranchiseeId = 'FR-DEFAULT';
      let currentFranchiseeName = formData.trustBranch || 'Athani';
      let currentFranchiseeRegDate = '2026-08-20';
      try {
        const portalUser = JSON.parse(localStorage.getItem('sle_portal_user_data') || '{}');
        if (portalUser && (portalUser.id || portalUser.environmentId)) {
          currentFranchiseeId = portalUser.id || portalUser.environmentId;
          currentFranchiseeName = portalUser.franchiseName || portalUser.location || portalUser.fullName || currentFranchiseeName;
          currentFranchiseeRegDate = portalUser.registrationDate || portalUser.createdDate || portalUser.purchaseDate || currentFranchiseeRegDate;
        } else {
          const cachedFranchisees = JSON.parse(localStorage.getItem('sle_franchisees_cache') || '[]');
          const branchLower = (formData.trustBranch || '').trim().toLowerCase();
          const match = cachedFranchisees.find(f =>
            (f.location && f.location.toLowerCase() === branchLower) ||
            (f.franchiseName && f.franchiseName.toLowerCase().includes(branchLower))
          );
          if (match) {
            currentFranchiseeId = match.id;
            currentFranchiseeName = match.franchiseName || match.location || currentFranchiseeName;
            currentFranchiseeRegDate = match.registrationDate || match.createdDate || match.purchaseDate || currentFranchiseeRegDate;
          } else if (formData.trustBranch.trim()) {
            currentFranchiseeId = `FR-${formData.trustBranch.trim().toUpperCase()}`;
          }
        }
      } catch (e) { }

      // Atomically allocate the next globally unique registration number in Firestore transaction based on admission year
      const finalRegNo = await allocateNextRegistrationNo(db, formData.admissionDate || today);
      setFormData(prev => ({ ...prev, registrationNo: String(finalRegNo) }));

      const studentRecord = {
        ...formData,
        id: appNumber,
        appNumber,
        registrationNo: String(finalRegNo),
        regNo: String(finalRegNo),
        franchiseeId: currentFranchiseeId,
        franchiseName: currentFranchiseeName,
        franchiseeRegDate: currentFranchiseeRegDate,
        environmentId: currentFranchiseeId,
        environmentName: currentFranchiseeName,
        admissionDate: formData.admissionDate || new Date().toISOString().split('T')[0],
        selectedClass: formData.selectedClass || '10th',
        trainingPlan: 'Regular',
        name: formData.fullName ? formData.fullName.trim() : '',
        fullName: formData.fullName ? formData.fullName.trim() : '',
        fatherName: formData.fatherName ? formData.fatherName.trim() : '',
        contactNo: formData.contactNo ? formData.contactNo.trim() : '',
        mobileNo: formData.contactNo ? formData.contactNo.trim() : '',
        place: formData.trustBranch || currentFranchiseeName,
        trustBranch: formData.trustBranch || currentFranchiseeName,
        photoPreview: cloudinaryPhotoUrl || photoPreview || '',
        photoUrl: cloudinaryPhotoUrl || photoPreview || '',
        aadharPreview: cloudinaryAadharUrl || aadharPreview || '',
        aadharUrl: cloudinaryAadharUrl || aadharPreview || '',
        aadharFileType: aadharFileType || '',
        aadharFileName: aadharFileName || '',
        aadharFileSize: aadharFileSize || 0,
        marksheetPreview: cloudinaryMarksheetUrl || marksheetPreview || '',
        marksheetUrl: cloudinaryMarksheetUrl || marksheetPreview || '',
        marksheetFileType: marksheetFileType || '',
        marksheetFileName: marksheetFileName || '',
        marksheetFileSize: marksheetFileSize || 0,
        submittedAt: new Date().toLocaleString(),
        createdDate: new Date().toISOString().split('T')[0],
        createdAt: Date.now(),
        feeAmount: applicableFee,
        isFirstTimeFranchisee: isFirstTimeUser,
        paymentStatus: 'Paid',
        paymentMethod: 'Razorpay',
        razorpayPaymentId: activePaymentId,
        razorpayOrderId: activeOrderId,
        status: 'Submitted',
        hasHallTicket: false,
        hallTicketGenerated: false
      };

      // Save to Firestore 'students', 'applications', and 'coaching_students' collections if db is available
      if (db) {
        try {
          await Promise.race([
            Promise.all([
              setDoc(doc(db, 'students', appNumber), studentRecord, { merge: true }),
              setDoc(doc(db, 'applications', appNumber), studentRecord, { merge: true }),
              setDoc(doc(db, 'coaching_students', appNumber), studentRecord, { merge: true })
            ]),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore write timeout')), 4000))
          ]);
          console.log('Saved student application to Firestore with Reg No:', finalRegNo);
        } catch (dbErr) {
          console.warn('Firestore write notice (saved to local cache):', dbErr?.message || dbErr);
        }
      }

      // Clean up the pending_payments draft now that payment is confirmed and real record is saved
      try {
        if (db) {
          await Promise.race([
            deleteDoc(doc(db, 'pending_payments', appNumber)),
            new Promise((_, reject) => setTimeout(() => reject(new Error('delete timeout')), 1500))
          ]);
        }
        localStorage.removeItem('sle_active_payment_draft');
        try {
          const pending = JSON.parse(localStorage.getItem('sle_pending_payments_cache') || '[]');
          const filtered = pending.filter(p => p && p.id !== appNumber && p.appNumber !== appNumber);
          localStorage.setItem('sle_pending_payments_cache', JSON.stringify(filtered));
          window.dispatchEvent(new CustomEvent('sle_pending_payments_updated', { detail: filtered }));
        } catch (e) {}
      } catch (e) { }

      // Record transaction to Firestore 'transactions' and update cache
      try {
        await recordTransaction({
          transactionId: activePaymentId,
          paymentId: activePaymentId,
          orderId: activeOrderId,
          type: 'student_admission',
          typeLabel: 'Student Admission Fee',
          title: `Admission Fee - ${formData.fullName.trim()}`,
          description: `Admission fee for ${formData.course || 'Certificate Course'}`,
          payerName: formData.fullName.trim(),
          payerEmail: formData.email.trim(),
          payerPhone: formData.contactNo.trim(),
          registrationNo: String(finalRegNo),
          appNumber: appNumber,
          course: formData.course || '',
          branch: formData.trustBranch || currentFranchiseeName,
          franchiseeId: currentFranchiseeId,
          franchiseName: currentFranchiseeName,
          amount: applicableFee,
          status: 'Paid',
          paymentMethod: 'Razorpay',
          gateway: 'Razorpay Test',
          date: formData.admissionDate || new Date().toISOString().split('T')[0],
          dateTime: new Date().toLocaleString(),
          createdAt: Date.now()
        });
      } catch (txnErr) {
        console.warn('Failed to record student transaction:', txnErr);
      }

      // Save last reg number to local storage for instant increment
      try {
        const activeEnvId = activeEnvironment?.environmentId || 'default_env';
        if (activeEnvId) {
          localStorage.setItem(`sle_last_reg_no_${activeEnvId}`, String(finalRegNo));
        }
        localStorage.setItem('sle_last_reg_no', String(finalRegNo));
      } catch (e) { }

      // ─────────────────────────────────────────────────────────────
      // Step 3: "Generating Admission Confirmation..." ⏳
      // ─────────────────────────────────────────────────────────────
      setSubmissionStatus('step3');

      // Save to local cache for instant display on List pages
      try {
        const storedStudents = JSON.parse(localStorage.getItem('sle_students_cache') || '[]');
        const updatedStudents = [studentRecord, ...storedStudents.filter(s => (s.appNumber !== appNumber && s.registrationNo !== finalRegNo))];
        localStorage.setItem('sle_students_cache', JSON.stringify(updatedStudents));
        localStorage.setItem('sle_coaching_students_cache', JSON.stringify(updatedStudents));
        localStorage.setItem('sle_applications_cache', JSON.stringify(updatedStudents));
      } catch (e) { }

      // Brief pause to allow Step 3 visual confirmation
      await new Promise(r => setTimeout(r, 600));

      // ─────────────────────────────────────────────────────────────
      // Success: "All Done! Redirecting..." ✅
      // ─────────────────────────────────────────────────────────────
      setSubmissionStatus('success');

      // Allow user to clearly see the success state
      await new Promise(r => setTimeout(r, 800));

      setIsSubmitting(false);
      setSubmittedData(studentRecord);
      resetFormFields();
      setSubmissionStatus(null);
    } catch (err) {
      console.error('Application submission error:', err);
      setIsSubmitting(false);
      setSubmissionStatus('error');
      setSubmissionError('Upload failed: Please check your internet connection and Try Again');
    }
  };

  const retryLastSubmission = () => {
    const { appNumber, paymentId, orderId } = pendingSubmissionRef.current;
    if (appNumber) {
      finalizeApplicationSubmission(appNumber, paymentId, orderId);
    } else {
      setSubmissionStatus(null);
    }
  };

  // Execute Payment via PHP Backend & Razorpay Checkout Modal
  const handleExecutePayment = async () => {
    setIsProcessingPayment(true);

    const appNumber = currentDraftAppNumber || ('SLE-2026-' + Math.floor(100000 + Math.random() * 900000));
    setCurrentDraftAppNumber(appNumber);
    const isLiveMode = (import.meta.env.VITE_RAZORPAY_MODE || 'test').toLowerCase() === 'live';
    const activeRazorpayKey = (
      import.meta.env.VITE_RAZORPAY_KEY_ID ||
      (isLiveMode ? (import.meta.env.VITE_RAZORPAY_LIVE_KEY_ID || 'rzp_live_TSInBiL96HvXCm') : (import.meta.env.VITE_RAZORPAY_TEST_KEY_ID || 'rzp_test_SPs6AqG8E3r2Cp'))
    );
    const backendUrl = import.meta.env.VITE_BACKEND_URL || '/backend';

    // 1. Create Live Order via PHP backend endpoint for applicableFee
    let orderData = null;
    const fetchEndpoints = ['/backend', backendUrl, 'http://localhost/slesinstitution/backend'].filter((v, i, a) => v && a.indexOf(v) === i);
    for (const ep of fetchEndpoints) {
      if (orderData) break;
      try {
        const orderRes = await fetch(`${ep}/create-order.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: applicableFee,
            currency: 'INR',
            planId: isFirstTimeUser ? 'first-time-franchisee-fee' : 'student-app-fee',
            customerName: formData.fullName.trim(),
            customerEmail: formData.email.trim() || 'student@sle-institution.org',
            customerPhone: formData.contactNo.trim(),
            appNumber: appNumber,
            course: formData.course || '',
            branch: formData.trustBranch || 'Athani',
            franchiseeId: 'FR-DEFAULT'
          })
        });

        if (orderRes.ok) {
          orderData = await orderRes.json();
        }
      } catch (err) {
        // Continue to fallback endpoint if CORS or network error
      }
    }

    if (!orderData) {
      orderData = {
        success: true,
        key_id: activeRazorpayKey,
        amount: applicableFee * 100,
        currency: 'INR'
      };
    }

    // Save/update pre-payment draft with razorpay order ID and active status
    await savePendingPaymentDraft(appNumber, {
      razorpayOrderId: orderData?.order_id || '',
      lastAction: 'Payment Checkout Initiated'
    });

    // 2. Load Razorpay SDK and Trigger Payment Modal
    const isScriptLoaded = await loadRazorpayScript();

    const resolvedKey = (orderData?.key_id || activeRazorpayKey).trim();
    const genuineOrderId = (orderData?.order_id && !orderData.order_id.startsWith('order_dev_') && !orderData.is_mock) ? orderData.order_id : undefined;

    if (isScriptLoaded && window.Razorpay) {
      const options = {
        key: resolvedKey,
        amount: orderData?.amount || (applicableFee * 100), // Fee in paise
        currency: orderData?.currency || 'INR',
        name: 'SLE Institution',
        description: isFirstTimeUser
          ? `First-Time Franchisee Registration Fee (₹${applicableFee.toLocaleString()})`
          : `Student Admission Fee (₹${applicableFee.toLocaleString()})`,
        image: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
        order_id: genuineOrderId,
        prefill: {
          name: formData.fullName.trim(),
          email: formData.email.trim() || 'student@sle-institution.org',
          contact: formData.contactNo.trim()
        },
        theme: {
          color: '#DC2626'
        },
        handler: async function (response) {
          console.log('Student Fee Payment Success:', response);

          // Verify signature via PHP backend
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
          } catch (vErr) { }

          await finalizeApplicationSubmission(appNumber, response.razorpay_payment_id, response.razorpay_order_id || orderData?.order_id || '');
        },
        modal: {
          ondismiss: async function () {
            setIsProcessingPayment(false);
            await savePendingPaymentDraft(currentDraftAppNumber || appNumber, {
              paymentStatus: 'Pending Payment',
              lastAction: 'Payment Cancelled / Dismissed by User',
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
            failureReason: resp.error?.description || 'Transaction declined',
            failedAt: new Date().toLocaleString()
          });
          alert(`Payment failed: ${resp.error?.description || 'Transaction declined'}`);
        });
        rzp.open();
        return;
      } catch (err) {
        console.log('Razorpay popup error:', err);
        setIsProcessingPayment(false);
        alert('Could not open payment window. Your application has been saved to Pending Payments.');
        return;
      }
    }

    setIsProcessingPayment(false);
    alert('Unable to load payment gateway. Your application is saved in Pending Payments. Please check your internet connection or contact admin.');
  };

  const resetFormFields = () => {
    setCurrentDraftAppNumber('');
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
      registrationNo: String(getBaseRegNo(today)),
      admissionDate: today,
      selectedClass: '10th',
      trainingPlan: 'Regular'
    });
    setPhoto(null);
    setPhotoPreview(null);
    setPhotoError('');
    removeAadhar();
    removeMarksheet();
    setFormErrors({});
    fetchNextRegistrationNo();
  };

  const resetForm = () => {
    setSubmittedData(null);
    resetFormFields();
  };

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">

      {/* Banner */}
      <div className="gradient-banner rounded-2xl py-6 px-8 shadow-xl border border-rose-800/40 relative overflow-hidden mb-8 text-center">
        <div className="relative z-10">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-widest uppercase">
            ADMISSION FORM
          </h2>
        </div>
      </div>

      {/* Main Centered White Card Form Container */}
      <div className="glass-card bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-w-4xl mx-auto">




        <form onSubmit={handleSubmit} className="p-6 sm:p-10 space-y-10">

          {/* Top Card: Registration No, Admission Date, Class, Training Plan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50/80 p-5 rounded-2xl border border-slate-200/90 shadow-sm">
            {/* Registration No (Auto-Incrementing Starting from 202638001) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                REGISTRATION NO:
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="registrationNo"
                  value={formData.registrationNo || '202638001'}
                  readOnly
                  disabled
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-900 font-bold text-sm cursor-not-allowed select-none tracking-wider"
                />
                <span className="absolute right-3 top-3 text-[10px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                  Auto
                </span>
              </div>
            </div>

            {/* Admission Date (Default Today - Uneditable) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                ADMISSION DATE:
              </label>
              <input
                type="date"
                name="admissionDate"
                value={formData.admissionDate}
                readOnly
                disabled
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-900 font-bold text-sm cursor-not-allowed select-none"
              />
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold text-sm focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 cursor-pointer"
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

            {/* Training Plan (Label: TRAINING PLAN, Default: Regular, NOT EDITABLE) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                TRAINING PLAN:
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="trainingPlan"
                  value="Regular"
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
                  Full Student Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="Enter Student's Full Name (as per SSLC / School Certificate)"
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
                  Father's / Guardian Name <span className="text-rose-500">*</span>
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

              {/* Date of Birth (3 Select Dropdowns) */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Date of Birth <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {/* Day */}
                  <select
                    name="dobDay"
                    value={formData.dobDay}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-sm focus:outline-none focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20"
                  >
                    <option value="">Day</option>
                    {days.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>

                  {/* Month */}
                  <select
                    name="dobMonth"
                    value={formData.dobMonth}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-sm focus:outline-none focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20"
                  >
                    <option value="">Month</option>
                    {months.map((m, idx) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>

                  {/* Year */}
                  <select
                    name="dobYear"
                    value={formData.dobYear}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-sm focus:outline-none focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20"
                  >
                    <option value="">Year</option>
                    {years.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                {formErrors.dob && <p className="text-xs text-rose-600 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" />{formErrors.dob}</p>}
              </div>

              {/* Caste / Category */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Caste / Reservation Category <span className="text-rose-500">*</span>
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
                  Full Permanent Address <span className="text-rose-500">*</span>
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
                  Email ID <span className="text-rose-500">*</span>
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
                  Contact Mobile No <span className="text-rose-500">*</span>
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
                  Aadhar Card Number
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

              {/* SSLC / UC Marks Card / Roll No */}
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
                  Current Qualification / Standard
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
                  Course Applied For <span className="text-rose-500">*</span>
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
                    const label = getCourseDisplayLabel(c);
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
                  Candidate Photo <span className="text-rose-500">*</span>
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
                  Upload Aadhar Card
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
                  Upload Marksheet
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
              className="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-semibold transition"
            >
              Reset Form
            </button>

            <button
              type="submit"
              disabled={isSubmitting || Boolean(submissionStatus)}
              className="w-full sm:w-auto gradient-button text-white px-10 py-3.5 rounded-xl font-bold text-sm shadow-xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:pointer-events-none cursor-pointer"
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
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></span>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Admission Form Generated & Fee Paid</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 sm:flex-initial bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Admission Form</span>
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 sm:flex-initial bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow transition cursor-pointer"
                >
                  <span>Submit Another Application</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSubmittedData(null)}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition"
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
                {/* Top Left Logo (public/logo-1.jpg) */}
                <div className="w-14 h-14 sm:w-20 sm:h-20 flex-shrink-0">
                  <img src="/logo-1.jpg" alt="SLE Institutions Logo" className="w-full h-full object-contain" />
                </div>

                {/* Center Title & Subheaders */}
                <div className="text-center flex-1 px-2">
                  <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
                    SLE INSTITUTIONS
                  </h1>
                  <p className="text-[9px] sm:text-xs font-semibold text-slate-700 mt-0.5 leading-tight max-w-2xl mx-auto">
                    (Sharing Computer Literacy Movement with Govt. of India) Recognized by Govt. Of INDIA. ISO 21001:2025 Certified Institute.
                  </p>
                  <p className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-widest mt-1">
                    Admission Form
                  </p>
                </div>

                {/* Right Spacer to balance the left logo and keep header centered */}
                <div className="w-14 sm:w-20 flex-shrink-0" />
              </div>

              {/* Main Border Boxed Form Details */}
              <div className="border border-slate-800 p-4 sm:p-8 relative min-h-[460px] text-xs sm:text-sm font-mono text-slate-900 bg-white">

                {/* Responsive Layout: Photo + Fields */}
                <div className="flex flex-col-reverse sm:flex-row justify-between items-start gap-6">

                  {/* Fields Table Grid */}
                  <div className="w-full sm:max-w-[calc(100%-140px)] space-y-3 pt-1">

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">REGISTRATION NO:</span>
                      <span className="font-bold text-slate-900 text-sm tracking-wider break-all">{submittedData.registrationNo || '202638001'}</span>
                    </div>

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">ADMISSION DATE:</span>
                      <span className="font-semibold text-slate-900 break-all">{submittedData.admissionDate || new Date().toISOString().split('T')[0]}</span>
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

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">FRANCHISEE ID:</span>
                      <span className="font-bold text-indigo-600 break-all">{submittedData.franchiseeId || submittedData.environmentId || 'FR-DEFAULT'}</span>
                    </div>

                  </div>

                  {/* Candidate Photo (Centered on Mobile, Top Right on Desktop) */}
                  <div className="self-center sm:self-start flex-shrink-0 w-28 sm:w-32 h-36 sm:h-40 border border-slate-800 bg-slate-100 flex items-center justify-center overflow-hidden shadow-sm">
                    {submittedData.photoPreview || submittedData.photoUrl ? (
                      <img
                        src={submittedData.photoPreview || submittedData.photoUrl}
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

      {/* REAL STATE-DRIVEN SUBMISSION OVERLAY (No Guesswork Timer) */}
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
                {/* Avatar initials */}
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
                
                {/* Step 1: Compressing & Uploading Student Photo... */}
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

                {/* Step 2: Securing Registration & Saving to Database... */}
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

                {/* Step 3: Generating Admission Confirmation... */}
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

                {/* Success Banner */}
                {submissionStatus === 'success' && (
                  <div className="pt-2 border-t border-slate-200/80 text-center font-bold text-emerald-600 text-xs flex items-center justify-center gap-1.5 animate-in fade-in">
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    <span>All Done! Redirecting...</span>
                  </div>
                )}

              </div>
            )}

            {/* Error Message & Retry Action */}
            {submissionStatus === 'error' && (
              <div className="space-y-4">
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 font-medium leading-relaxed">
                  {submissionError || 'Upload failed: Please check your internet connection and Try Again'}
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSubmissionStatus(null)}
                    className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Back to Form
                  </button>
                  <button
                    type="button"
                    onClick={() => retryLastSubmission()}
                    className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Try Again</span>
                  </button>
                </div>
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
              onClick={handleCancelPaymentModal}
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
                  Student Application Charges
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
                <span>Student Application Charges: ₹{applicableFee.toLocaleString()}</span>
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
                <span className="text-slate-500 font-semibold">Registration Charge:</span>
                <span className="font-extrabold text-slate-900">₹{applicableFee.toLocaleString()}.00</span>
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
                onClick={handleCancelPaymentModal}
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
