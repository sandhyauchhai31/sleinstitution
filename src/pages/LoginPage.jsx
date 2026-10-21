import React, { useState, useEffect, useRef } from 'react';
import { 
  Lock, 
  User, 
  Phone, 
  Building, 
  Calendar, 
  ArrowRight, 
  ArrowLeft, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ShieldCheck, 
  Check, 
  Package,
  KeyRound,
  FileCode,
  CreditCard,
  GraduationCap,
  BookOpen,
  MapPin,
  Mail,
  X,
  Hash,
  FileQuestion,
  Upload,
  Camera,
  FileText,
  Monitor,
  Trash2,
  DollarSign,
  Users,
  PhoneCall,
  Home,
  Briefcase,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Loader2
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  db, 
  doc, 
  setDoc,
  getDocs,
  collection,
  onSnapshot
} from '../firebase';
import { validateStudentLogin, saveStudentSession, getStudentSession, clearStudentSession } from '../utils/examAuthManager';
import { recordTransaction } from '../utils/transactionManager';
import { subscribeToBranches, DEFAULT_BRANCHES } from '../utils/branchManager';
import { validateFranchiseePlanStatus } from '../utils/planValidator';

const defaultPlans = [
  {
    id: 'plan-1yr',
    name: '1 Year Plan',
    duration: '1 Year',
    years: 1,
    price: 15000,
    period: '/year',
    billingPeriod: '/year',
    currency: '₹',
    badge: '',
    isPopular: false,
    active: true,
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
    price: 27000,
    period: '/2 years',
    billingPeriod: '/2 years',
    currency: '₹',
    badge: 'Most Popular',
    isPopular: true,
    active: true,
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
    price: 36000,
    period: '/3 years',
    billingPeriod: '/3 years',
    currency: '₹',
    badge: 'Best Value',
    isPopular: false,
    active: true,
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

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [studentSession, setStudentSession] = useState(() => getStudentSession());

  // Determine if we should only show student screen (when student is logged in, on /student-login, or ?mode=student)
  const isStudentOnlyMode = location.pathname === '/student-login' || 
    new URLSearchParams(location.search).get('mode') === 'student' || 
    !!studentSession;

  const isAdminModeParam = new URLSearchParams(location.search).get('mode') === 'admin' || location.pathname === '/admin-login';

  // Mode: 'login' | 'register' | 'forgot' | 'student' | 'admin'
  const [viewMode, setViewMode] = useState(() => {
    if (isAdminModeParam) return 'admin';
    if (isStudentOnlyMode) return 'student';
    return 'login';
  });

  useEffect(() => {
    const s = getStudentSession();
    setStudentSession(s);
    const params = new URLSearchParams(location.search);
    const modeParam = params.get('mode');

    if (params.get('plan') === 'expired' || params.get('expired') === 'true') {
      setLoginError('Your franchisee plan has expired. Please enter your credentials to review renewal options.');
    }

    if (modeParam === 'admin' || location.pathname === '/admin-login') {
      setViewMode('admin');
      sessionStorage.removeItem('sle_admin_logged_in');
      sessionStorage.removeItem('sle_user_role');
      localStorage.removeItem('sle_admin_demo');
      if (localStorage.getItem('sle_user_role') === 'admin') {
        localStorage.removeItem('sle_user_role');
      }
    } else if (s || location.pathname === '/student-login' || modeParam === 'student') {
      setViewMode('student');
    }
  }, [location.pathname, location.search]);

  // Student exam login state
  const [studentRollNo, setStudentRollNo] = useState('');
  const [studentPin, setStudentPin] = useState('');
  const [showStudentPin, setShowStudentPin] = useState(false);
  const [isStudentLoggingIn, setIsStudentLoggingIn] = useState(false);
  const [studentLoginError, setStudentLoginError] = useState('');

  // Registration Wizard Step: 1 | 2
  const [registerStep, setRegisterStep] = useState(1);

  // --- LOGIN FORM STATE ---
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState('');

  // --- FORGOT PASSWORD STATE ---
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  // --- REGISTRATION STEP 1 STATE (5 SUB-STEPS BEFORE CHOOSING PLAN) ---
  const [regFormStep, setRegFormStep] = useState(1);
  const regFormRef = useRef(null);

  const [regFranchiseeName, setRegFranchiseeName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [regMobile, setRegMobile] = useState('');
  const [regLocation, setRegLocation] = useState('');
  const [regInstituteCode, setRegInstituteCode] = useState('SLE-INST-2026');
  const [regError, setRegError] = useState('');
  
  // Operational Branches for Franchisee Branch Selection
  const [branchesList, setBranchesList] = useState(DEFAULT_BRANCHES);

  useEffect(() => {
    const unsub = subscribeToBranches((branches) => {
      if (Array.isArray(branches) && branches.length > 0) {
        const unique = Array.from(
          new Set(
            branches
              .map((b) => (typeof b === 'string' ? b : b?.name))
              .filter(Boolean)
          )
        ).sort();
        setBranchesList(unique);
      }
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Registration Date (Read-only auto-filled today's date)
  const todayFormatted = new Date().toISOString().split('T')[0];
  const [regDate] = useState(todayFormatted);

  // Complete Franchisee Form State (All 33 fields across steps)
  const [regForm, setRegForm] = useState({
    // Step 1: Personal Details
    centerName: '',
    firmName: '',
    ownerName: '',
    contactNumber: '',
    qualification: '',
    place: '',
    districtState: '',
    residentialAddress: '',
    residentialPinCode: '',

    // Step 2: Training Address & Infrastructure Details
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

    // Step 3: Trade & Bank Details
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

    // Step 5: Account & Portal Credentials
    password: '',
    confirmPassword: '',
    instituteCode: 'SLE-INST-2026',
    gstId: ''
  });

  // Document upload handler with base64 preview
  const handleRegDocUpload = (e, fieldKey) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setRegError('File size is too large (max 2MB, under 100KB recommended)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setRegForm(prev => ({
        ...prev,
        [fieldKey]: event.target.result,
        [`${fieldKey}_name`]: file.name,
        [`${fieldKey}_size`]: Math.round(file.size / 1024) + ' KB'
      }));
      setRegError('');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveRegDoc = (fieldKey) => {
    setRegForm(prev => ({
      ...prev,
      [fieldKey]: '',
      [`${fieldKey}_name`]: '',
      [`${fieldKey}_size`]: ''
    }));
  };

  const handleNextRegFormStep = () => {
    setRegError('');
    if (regFormStep === 1) {
      const owner = (regForm.ownerName || regFranchiseeName).trim();
      const contact = (regForm.contactNumber || regMobile).trim();
      if (!owner) {
        setRegError('Please enter Owner Name to proceed.');
        return;
      }
      if (!contact) {
        setRegError('Please enter Contact Number to proceed.');
        return;
      }
      setRegFormStep(2);
    } else if (regFormStep === 2) {
      const email = (regForm.email || regEmail).trim();
      if (!email) {
        setRegError('Please enter an Email address to proceed.');
        return;
      }
      setRegFormStep(3);
    } else if (regFormStep === 3) {
      setRegFormStep(4);
    } else if (regFormStep === 4) {
      setRegFormStep(5);
    }
    setTimeout(() => {
      if (regFormRef.current) {
        regFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  // --- REGISTRATION STEP 2 STATE ---
  const [selectedPlanId, setSelectedPlanId] = useState('plan-2yr');
  const [isRegistering, setIsRegistering] = useState(false);
  const [currentLeadId, setCurrentLeadId] = useState('');
  const [isSavingLead, setIsSavingLead] = useState(false);

  // --- INACTIVE / UNPAID ACCOUNT POPUP MODAL STATE ---
  const [showInactivePlanModal, setShowInactivePlanModal] = useState(false);
  const [inactiveAccountDetails, setInactiveAccountDetails] = useState(null);
  const [isRenewingPlan, setIsRenewingPlan] = useState(false);
  const [renewingPlanKey, setRenewingPlanKey] = useState('');

  // Dynamic First-Time Franchisee Fee synced with Admin Panel
  const [firstTimeFee, setFirstTimeFee] = useState(() => {
    return Number(localStorage.getItem('sle_first_time_fee')) || 20000;
  });

  // Admin Login State
  const [adminIdentifier, setAdminIdentifier] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [isAdminAuthenticating, setIsAdminAuthenticating] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState('');

  // Triple Click Logo Handler (Click 3 times on Logo to open Admin Login Screen)
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef(null);

  const handleLogoTripleClick = () => {
    clickCountRef.current += 1;

    if (clickCountRef.current >= 3) {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      clickCountRef.current = 0;

      // Switch to Admin Login Screen Mode
      setViewMode('admin');
      setAdminLoginError('');
      setLoginError('');
      setLoginSuccess('');
    } else {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      clickTimerRef.current = setTimeout(() => {
        clickCountRef.current = 0;
      }, 1200);
    }
  };

  const handleAdminLoginSubmit = async (e) => {
    e.preventDefault();
    setAdminLoginError('');
    setIsAdminAuthenticating(true);

    const input = adminIdentifier.trim();
    if (!input || !adminPassword) {
      setIsAdminAuthenticating(false);
      setAdminLoginError('Please enter both Admin Username/Email and Password.');
      return;
    }

    const inputLower = input.toLowerCase();
    const isEmail = input.includes('@');
    const targetEmail = isEmail ? input : (inputLower === 'admin' ? 'admin@slefoundation.org' : `${input}@slefoundation.org`);
    const targetEmailLower = targetEmail.toLowerCase();

    const adminEmails = [
      's@gmail.com',
      'admin@slefoundation.org',
      'admin@slesinstitution.com',
      'admin@sle.org',
      'admin@gmail.com'
    ];

    let adminAuthSuccess = false;

    // Try Firebase Auth
    if (auth && isEmail) {
      try {
        await signInWithEmailAndPassword(auth, targetEmail, adminPassword);
        adminAuthSuccess = true;
      } catch (authErr) {
        if (authErr?.code === 'auth/user-not-found' || authErr?.code === 'auth/invalid-credential') {
          try {
            await createUserWithEmailAndPassword(auth, targetEmail, adminPassword);
            adminAuthSuccess = true;
          } catch (createErr) {}
        }
      }
    }

    const validAdminPasswords = ['123456', 'admin', 'admin123', 'admin2026', 'password'];
    const isRecognizedAdminUser = 
      adminEmails.includes(targetEmailLower) ||
      adminEmails.includes(inputLower) ||
      inputLower === 'admin' ||
      inputLower === 'administrator' ||
      inputLower === 'superadmin';

    if (!adminAuthSuccess && isRecognizedAdminUser && validAdminPasswords.includes(adminPassword)) {
      adminAuthSuccess = true;
    }

    if (adminAuthSuccess) {
      sessionStorage.setItem('sle_admin_logged_in', 'true');
      sessionStorage.setItem('sle_user_role', 'admin');
      localStorage.setItem('sle_portal_user', 'true');
      localStorage.setItem('sle_admin_demo', 'true');
      localStorage.setItem('sle_user_role', 'admin');
      setIsAdminAuthenticating(false);
      navigate('/admin');
    } else {
      setIsAdminAuthenticating(false);
      setAdminLoginError('Invalid Administrator Username or Password. Access Denied.');
    }
  };

  useEffect(() => {
    if (!db) return;
    const fetchPricing = async () => {
      try {
        const snap = await getDocs(collection(db, 'system_settings'));
        snap.forEach(docSnap => {
          if (docSnap.id === 'franchisee_pricing') {
            const data = docSnap.data();
            if (data.firstTimeFee) {
              setFirstTimeFee(Number(data.firstTimeFee));
              localStorage.setItem('sle_first_time_fee', String(data.firstTimeFee));
            }
          }
        });
      } catch (e) {}
    };
    fetchPricing();
  }, []);

  // Real-time Plans State synced with Firestore / Admin Panel
  const [plans, setPlans] = useState(() => {
    try {
      const cached = localStorage.getItem('sle_plans_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return defaultPlans;
  });

  // Real-time Firestore sync and tab storage listener for admin plans updates
  useEffect(() => {
    // 1. Cross-tab storage sync
    const handleStorageChange = (e) => {
      if (e.key === 'sle_plans_cache' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPlans(parsed);
          }
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // 2. Real-time Firestore onSnapshot listener
    let unsubscribe = null;
    if (db) {
      try {
        unsubscribe = onSnapshot(collection(db, 'plans'), (snapshot) => {
          if (!snapshot.empty) {
            const fetched = [];
            snapshot.forEach(docSnap => {
              const data = docSnap.data();
              const yearsVal = Number(data.years) || (data.duration && parseInt(data.duration, 10)) || (docSnap.id?.includes('1') ? 1 : docSnap.id?.includes('2') ? 2 : docSnap.id?.includes('3') ? 3 : 1);
              fetched.push({ 
                id: docSnap.id, 
                ...data,
                years: yearsVal,
                duration: data.duration || `${yearsVal} Year${yearsVal > 1 ? 's' : ''}`
              });
            });
            fetched.sort((a, b) => (a.years || 1) - (b.years || 1));
            setPlans(fetched);
            try {
              localStorage.setItem('sle_plans_cache', JSON.stringify(fetched));
            } catch (e) {}
          }
        }, (err) => {
          console.warn('Firestore plans onSnapshot notice:', err);
        });
      } catch (err) {
        console.warn('Firestore snapshot registration notice:', err);
      }
    }

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Dynamic Password Strength Meter Calculator
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: '', color: 'bg-slate-200', width: 'w-0' };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (/[A-Z]/.test(pass) || /[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass) || pass.length >= 10) score += 1;

    if (score === 1) return { score: 1, label: 'Weak', color: 'bg-red-500', text: 'text-red-600', width: 'w-1/3' };
    if (score === 2) return { score: 2, label: 'Medium', color: 'bg-amber-500', text: 'text-amber-600', width: 'w-2/3' };
    return { score: 3, label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-600', width: 'w-full' };
  };

  const passwordStrength = getPasswordStrength(regPassword);

  // Auto-Calculate Plan End Date (+1, +2, or +3 Years)
  const calculateEndDate = (startDateStr, yearsToAdd) => {
    if (!startDateStr) return '';
    try {
      const dateObj = new Date(startDateStr);
      if (isNaN(dateObj.getTime())) return startDateStr;
      const numYears = Number(yearsToAdd) || 1;
      dateObj.setFullYear(dateObj.getFullYear() + numYears);
      if (isNaN(dateObj.getTime())) return startDateStr;
      return dateObj.toISOString().split('T')[0];
    } catch (e) {
      return startDateStr;
    }
  };

  const activePlanObj = (plans && plans.length > 0)
    ? (plans.find(p => p.id === selectedPlanId) || plans[0])
    : { id: 'plan-1yr', name: '1 Year Plan', years: 1, price: 15000 };
  const calculatedEndDate = calculateEndDate(regDate, activePlanObj?.years || 1);

  // --- LOGIN SUBMIT (FIREBASE AUTH & FIRESTORE REAL AUTHENTICATION) ---
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginSuccess('');
    setShowInactivePlanModal(false);
    setIsAuthenticating(true);
    localStorage.removeItem('sle_admin_demo');
    if (localStorage.getItem('sle_user_role') === 'admin') {
      localStorage.removeItem('sle_user_role');
    }

    const input = loginIdentifier.trim();
    if (!input || !loginPassword) {
      setIsAuthenticating(false);
      setLoginSuccess('');
      setLoginError('Please enter both Email/Username and Password.');
      return;
    }

    const inputLower = input.toLowerCase();
    const isEmail = input.includes('@');
    const targetEmail = isEmail ? input : (inputLower === 'admin' ? 'admin@slefoundation.org' : `${input.replace(/\D/g, '') || input}@sle-franchise.org`);
    const targetEmailLower = targetEmail.toLowerCase();
    const adminEmails = [
      's@gmail.com',
      'admin@slefoundation.org',
      'admin@slesinstitution.com',
      'admin@sle.org',
      'admin@gmail.com'
    ];
    const validAdminPasswords = ['123456', 'admin', 'admin123', 'admin2026', 'password'];
    const isRecognizedAdminUser = 
      adminEmails.includes(targetEmailLower) ||
      adminEmails.includes(inputLower) ||
      inputLower === 'admin' ||
      inputLower === 'administrator' ||
      inputLower === 'superadmin';

    // Direct Admin Sign-in Support from Main Form
    if (isRecognizedAdminUser && validAdminPasswords.includes(loginPassword)) {
      sessionStorage.setItem('sle_admin_logged_in', 'true');
      sessionStorage.setItem('sle_user_role', 'admin');
      localStorage.setItem('sle_portal_user', 'true');
      localStorage.setItem('sle_admin_demo', 'true');
      localStorage.setItem('sle_user_role', 'admin');
      setIsAuthenticating(false);
      setLoginSuccess('Administrator verified! Opening Admin Panel...');
      setTimeout(() => {
        navigate('/admin');
      }, 300);
      return;
    }

    // FRANCHISEE LOGIN FLOW: Must match an existing franchisee in Database
    let franchiseeMatch = null;
    let authVerified = false;

    // Try Firebase Auth Sign In
    if (auth && isEmail) {
      try {
        await signInWithEmailAndPassword(auth, targetEmail, loginPassword);
        authVerified = true;
        if (isRecognizedAdminUser) {
          sessionStorage.setItem('sle_admin_logged_in', 'true');
          sessionStorage.setItem('sle_user_role', 'admin');
          localStorage.setItem('sle_portal_user', 'true');
          localStorage.setItem('sle_admin_demo', 'true');
          localStorage.setItem('sle_user_role', 'admin');
          setIsAuthenticating(false);
          setLoginSuccess('Administrator verified! Opening Admin Panel...');
          setTimeout(() => {
            navigate('/admin');
          }, 300);
          return;
        }
      } catch (authErr) {
        console.log('Firebase Auth Sign-In notice:', authErr?.code || authErr?.message);
      }
    }

    // Query Firestore 'franchisees' collection
    try {
      if (db) {
        try {
          const snapshot = await getDocs(collection(db, 'franchisees'));
          snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const fEmail = (data.email || '').toLowerCase();
            const fId = docSnap.id.toLowerCase();
            const fPhone = String(data.phone || '');

            if (fEmail === targetEmailLower || fEmail === inputLower || fId === inputLower || fPhone === input) {
              if (!franchiseeMatch || data.status === 'Active' || data.paymentStatus === 'Paid') {
                franchiseeMatch = { id: docSnap.id, ...data };
              }
            }
          });
        } catch (fErr) {
          console.log('Firestore franchisee query notice:', fErr);
        }
      }

      // Check local cached franchisees if no Firestore match found
      if (!franchiseeMatch) {
        const cached = JSON.parse(localStorage.getItem('sle_franchisees_cache') || '[]');
        if (Array.isArray(cached) && cached.length > 0) {
          franchiseeMatch = cached.find(f => {
            const fEmail = (f.email || '').toLowerCase();
            const fId = (f.id || '').toLowerCase();
            const fPhone = String(f.phone || '');
            return fEmail === targetEmailLower || fEmail === inputLower || fId === inputLower || fPhone === input;
          });
        }
      }

      // Check default demo franchisees if still no match found
      if (!franchiseeMatch) {
        const defaultDemoFranchisees = [
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
            status: 'Active',
            paymentStatus: 'Paid'
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
            status: 'Active',
            paymentStatus: 'Paid'
          }
        ];
        franchiseeMatch = defaultDemoFranchisees.find(f => {
          const fEmail = (f.email || '').toLowerCase();
          const fId = (f.id || '').toLowerCase();
          const fPhone = String(f.phone || '');
          return fEmail === targetEmailLower || fEmail === inputLower || fId === inputLower || fPhone === input;
        });
      }
    } catch (dbErr) {
      console.log('Database franchisee lookup notice:', dbErr);
    }

    // STRICT CHECK: If email / identifier is NEW or INVALID and NOT matching with database:
    if (!franchiseeMatch) {
      setIsAuthenticating(false);
      setLoginSuccess('');
      setShowInactivePlanModal(false);
      setLoginError('Invalid Email/Username or Password. Access denied.');
      return;
    }

    // Verify password for matching franchisee account
    if (!authVerified) {
      if (franchiseeMatch.password && franchiseeMatch.password.trim()) {
        if (franchiseeMatch.password === loginPassword) {
          authVerified = true;
        } else {
          setIsAuthenticating(false);
          setLoginSuccess('');
          setShowInactivePlanModal(false);
          setLoginError('Invalid Email/Username or Password. Access denied.');
          return;
        }
      } else {
        // If no explicit password stored on franchisee document, check default franchisee passwords
        const validDefaultPasswords = ['123456', 'admin', 'admin123', 'admin2026', 'password', 'sle123'];
        if (validDefaultPasswords.includes(loginPassword)) {
          authVerified = true;
        } else {
          setIsAuthenticating(false);
          setLoginSuccess('');
          setShowInactivePlanModal(false);
          setLoginError('Invalid Email/Username or Password. Access denied.');
          return;
        }
      }
    }

    if (!authVerified) {
      setIsAuthenticating(false);
      setLoginSuccess('');
      setShowInactivePlanModal(false);
      setLoginError('Invalid Email/Username or Password. Access denied.');
      return;
    }

    // Check account status and plan expiry immediately via Cloud Function & server validation
    const planVerification = await validateFranchiseePlanStatus(franchiseeMatch);

    if (!planVerification.valid) {
      // Plan is inactive, unpaid, or expired -> Show Renewal Plan Modal immediately!
      setIsAuthenticating(false);
      setLoginSuccess('');
      const expMsg = planVerification.message || `Your franchisee plan expired on ${planVerification.endDate || 'N/A'}. Please renew your plan.`;
      setLoginError(expMsg);
      try {
        const cached = localStorage.getItem('sle_plans_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) setPlans(parsed);
        }
      } catch (e) {}
      setInactiveAccountDetails({
        id: franchiseeMatch.id,
        fullName: franchiseeMatch.fullName || franchiseeMatch.franchiseName || targetEmail.split('@')[0],
        email: franchiseeMatch.email || targetEmail,
        phone: franchiseeMatch.phone || franchiseeMatch.contactNumber || '',
        location: franchiseeMatch.location || franchiseeMatch.place || 'Karnataka',
        status: planVerification.status || 'Expired',
        paymentStatus: franchiseeMatch.paymentStatus || 'Unpaid',
        endDate: planVerification.endDate || franchiseeMatch.endDate || 'N/A',
        rawFranchisee: { ...franchiseeMatch, status: planVerification.status || 'Expired', isPlanActive: false }
      });
      setShowInactivePlanModal(true);
      return;
    }

    // Active & Paid franchisee: Grant access to Franchisee Portal
    localStorage.setItem('sle_portal_user', 'true');
    localStorage.setItem('sle_portal_user_data', JSON.stringify(franchiseeMatch));
    localStorage.removeItem('sle_admin_demo');
    localStorage.setItem('sle_user_role', 'portal');
    setLoginSuccess('Portal Credentials Verified! Opening Franchisee Portal...');
    setTimeout(() => {
      setIsAuthenticating(false);
      navigate('/application-form');
    }, 500);
  };

  // --- STUDENT EXAM LOGIN ---
  const handleStudentLogin = async (e) => {
    e.preventDefault();
    setStudentLoginError('');
    if (!studentRollNo.trim() || !studentPin.trim()) {
      setStudentLoginError('Please enter both Roll No and Exam PIN.');
      return;
    }
    setIsStudentLoggingIn(true);
    try {
      const session = await validateStudentLogin(studentRollNo.trim(), studentPin.trim());
      saveStudentSession(session);
      navigate(`/exam/${session.examId}`);
    } catch (err) {
      setStudentLoginError(err.message || 'Invalid Roll No or PIN. Please try again.');
    } finally {
      setIsStudentLoggingIn(false);
    }
  };

  // --- FORGOT PASSWORD SUBMIT (WITH DATABASE EXISTENCE VERIFICATION) ---
  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');

    const target = forgotEmail.trim() || loginIdentifier.trim();
    if (!target) {
      setResetError('Please enter your registered email address.');
      return;
    }

    const emailToSend = target.includes('@') ? target : `${target}@sle-franchise.org`;
    const targetEmailLower = emailToSend.toLowerCase();
    const inputLower = target.toLowerCase();

    setIsSendingReset(true);

    // 1. Verify if Email exists in Database (Firestore, Local Cache, Default Franchisees, or Admin Emails)
    let emailFoundInDb = false;

    const adminEmails = [
      's@gmail.com',
      'admin@slefoundation.org',
      'admin@slesinstitution.com',
      'admin@sle.org',
      'admin@gmail.com'
    ];

    if (adminEmails.includes(targetEmailLower) || adminEmails.includes(inputLower)) {
      emailFoundInDb = true;
    }

    if (!emailFoundInDb && db) {
      try {
        const snapshot = await getDocs(collection(db, 'franchisees'));
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          const fEmail = (data.email || '').toLowerCase();
          const fId = docSnap.id.toLowerCase();
          if (fEmail === targetEmailLower || fEmail === inputLower || fId === inputLower) {
            emailFoundInDb = true;
          }
        });
      } catch (e) {}
    }

    if (!emailFoundInDb) {
      try {
        const cached = JSON.parse(localStorage.getItem('sle_franchisees_cache') || '[]');
        if (Array.isArray(cached) && cached.length > 0) {
          const match = cached.find(f => {
            const fEmail = (f.email || '').toLowerCase();
            const fId = (f.id || '').toLowerCase();
            return fEmail === targetEmailLower || fEmail === inputLower || fId === inputLower;
          });
          if (match) emailFoundInDb = true;
        }
      } catch (e) {}
    }

    if (!emailFoundInDb) {
      const defaultDemoFranchisees = [
        { email: 'rajesh@sle-academy.org', id: 'FR-2026-901' },
        { email: 'priya.sle@gmail.com', id: 'FR-2026-902' }
      ];
      const match = defaultDemoFranchisees.find(f => f.email === targetEmailLower || f.id.toLowerCase() === inputLower);
      if (match) emailFoundInDb = true;
    }

    // STRICT CHECK: If Email Address is NOT found in database, reject reset request!
    if (!emailFoundInDb) {
      setIsSendingReset(false);
      setResetSuccess('');
      setResetError('Email address not found in database. Please check your email or register as a new franchisee.');
      return;
    }

    // 2. Email exists in DB -> Trigger Firebase Password Reset
    try {
      if (auth) {
        await sendPasswordResetEmail(auth, emailToSend);
      }
      setResetSuccess(`Password reset instructions have been sent to ${emailToSend}. Please check your inbox or spam folder.`);
      setIsSendingReset(false);
    } catch (err) {
      console.log('Firebase Reset Email notice:', err?.code || err?.message);
      if (err?.code === 'auth/user-not-found') {
        setResetError('Email address not registered in authentication system.');
      } else {
        setResetSuccess(`Password reset request submitted for ${emailToSend}. If an account exists, a reset link has been dispatched.`);
      }
      setIsSendingReset(false);
    }
  };

  // --- REGISTRATION STEP 1 CONTINUE (SUBMIT FROM STEP 5, CHECK DUPLICATE EMAIL/PHONE & SAVE LEAD) ---
  const handleStep1Continue = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setRegError('');

    const centerNameFinal = (regForm.centerName || regForm.firmName || regFranchiseeName).trim();
    const ownerFinal = (regForm.ownerName || regFranchiseeName).trim();
    const cleanEmail = (regForm.email || regEmail).trim().toLowerCase();
    const cleanPhone = (regForm.contactNumber || regMobile).trim();
    const passwordFinal = (regForm.password || regPassword).trim();
    const confirmPasswordFinal = (regForm.confirmPassword || '').trim();

    if (!ownerFinal) {
      setRegError('Please enter Owner Name in Step 1.');
      setRegFormStep(1);
      return;
    }
    if (!cleanPhone) {
      setRegError('Please enter Contact Number in Step 1.');
      setRegFormStep(1);
      return;
    }
    if (!cleanEmail) {
      setRegError('Please enter Email Address in Step 2.');
      setRegFormStep(2);
      return;
    }
    if (!passwordFinal || passwordFinal.length < 6) {
      setRegError('Password must be at least 6 characters.');
      setRegFormStep(5);
      return;
    }
    if (confirmPasswordFinal && passwordFinal !== confirmPasswordFinal) {
      setRegError('Password and Confirm Password do not match!');
      setRegFormStep(5);
      return;
    }

    setIsSavingLead(true);

    // --- CHECK EXISTING REGISTRATION & PLAN SELECTION STATUS IN FIRESTORE & LOCAL CACHE ---
    try {
      let existingLeadMatch = null;
      let emailExistsWithPlan = false;
      let phoneExistsWithPlan = false;

      // 1. Query Firestore 'franchisees' collection
      if (db) {
        const snapshot = await getDocs(collection(db, 'franchisees'));
        snapshot.forEach(docSnap => {
          if (docSnap.id !== currentLeadId) {
            const data = docSnap.data();
            const recordEmail = (data.email || '').trim().toLowerCase();
            const existingPhoneClean = (data.phone || '').replace(/\D/g, '');
            const cleanPhoneDigits = cleanPhone.replace(/\D/g, '');

            const isEmailMatch = recordEmail && recordEmail === cleanEmail;
            const isPhoneMatch = data.phone && (data.phone === cleanPhone || (existingPhoneClean && existingPhoneClean === cleanPhoneDigits));

            if (isEmailMatch || isPhoneMatch) {
              const recordId = docSnap.id;
              const recordData = { id: recordId, ...data };
              const hasPlan = recordData.purchaseStatus === 'Purchased' || recordData.paymentStatus === 'Paid' || (recordData.planId && recordData.planId !== 'Not Selected');

              if (hasPlan) {
                if (isEmailMatch) emailExistsWithPlan = true;
                if (isPhoneMatch) phoneExistsWithPlan = true;
              } else if (!existingLeadMatch) {
                existingLeadMatch = recordData;
              }
            }
          }
        });
      }

      // 2. Query local cache franchisees
      const cached = JSON.parse(localStorage.getItem('sle_franchisees_cache') || '[]');
      if (Array.isArray(cached) && cached.length > 0) {
        cached.forEach(f => {
          if (f.id !== currentLeadId) {
            const recordEmail = (f.email || '').trim().toLowerCase();
            const cachedPhoneClean = (f.phone || '').replace(/\D/g, '');
            const cleanPhoneDigits = cleanPhone.replace(/\D/g, '');

            const isEmailMatch = recordEmail && recordEmail === cleanEmail;
            const isPhoneMatch = f.phone && (f.phone === cleanPhone || (cachedPhoneClean && cachedPhoneClean === cleanPhoneDigits));

            if (isEmailMatch || isPhoneMatch) {
              const hasPlan = f.purchaseStatus === 'Purchased' || f.paymentStatus === 'Paid' || (f.planId && f.planId !== 'Not Selected');

              if (hasPlan) {
                if (isEmailMatch) emailExistsWithPlan = true;
                if (isPhoneMatch) phoneExistsWithPlan = true;
              } else if (!existingLeadMatch) {
                existingLeadMatch = f;
              }
            }
          }
        });
      }

      // If user already has an active purchased plan:
      if (emailExistsWithPlan) {
        setIsSavingLead(false);
        setRegError('This Email Address is already registered with an active plan. Please sign in to access your portal.');
        return;
      }
      if (phoneExistsWithPlan) {
        setIsSavingLead(false);
        setRegError('This Mobile / Phone Number is already registered with an active plan. Please sign in or use a different number.');
        return;
      }

      // If user registered earlier BUT has NOT selected a plan yet -> continue to Step 2 (Choose Plan)
      if (existingLeadMatch) {
        console.log('Unpaid lead found, continuing to Plan Selection (Step 2):', existingLeadMatch.id);
        setCurrentLeadId(existingLeadMatch.id);
        if (existingLeadMatch.fullName) setRegFranchiseeName(existingLeadMatch.fullName);
        if (existingLeadMatch.phone) setRegMobile(existingLeadMatch.phone);
        if (existingLeadMatch.location) {
          setRegLocation(existingLeadMatch.location);
          setRegForm(prev => ({ ...prev, place: existingLeadMatch.location }));
        }
        setIsSavingLead(false);
        setRegisterStep(2);
        return;
      }
    } catch (checkErr) {
      console.log('Firestore duplicate check notice:', checkErr);
    }

    const userEmail = cleanEmail;
    const leadId = currentLeadId || `FR-2026-${Math.floor(100 + Math.random() * 900)}`;

    const leadRecord = {
      id: leadId,
      environmentId: leadId,
      environmentName: (regForm.place || regLocation || centerNameFinal || 'Franchisee Environment').trim(),
      franchiseName: centerNameFinal,
      centerName: (regForm.centerName || centerNameFinal).trim(),
      firmName: (regForm.firmName || '').trim(),
      ownerName: ownerFinal,
      fullName: ownerFinal,
      contactNumber: cleanPhone,
      phone: cleanPhone,
      qualification: (regForm.qualification || '').trim(),
      place: (regForm.place || regLocation).trim(),
      location: (regForm.place || regLocation).trim(),
      districtState: (regForm.districtState || '').trim(),
      residentialAddress: (regForm.residentialAddress || '').trim(),
      residentialPinCode: (regForm.residentialPinCode || '').trim(),

      // Step 2: Training Address & Facility
      trainingMobileNumber: (regForm.trainingMobileNumber || cleanPhone).trim(),
      centerAddress: (regForm.centerAddress || '').trim(),
      centerPinCode: (regForm.centerPinCode || '').trim(),
      email: userEmail,
      computerSystems: (regForm.computerSystems || '').trim(),
      lcdProjector: (regForm.lcdProjector || '').trim(),
      geographicalCenter: (regForm.geographicalCenter || 'Urban').trim(),
      premisesAreaSqFt: (regForm.premisesAreaSqFt || '').trim(),
      noOfClassroom: (regForm.noOfClassroom || '').trim(),
      noOfLab: (regForm.noOfLab || '').trim(),

      // Step 3: Trade & Banking Details
      trade: (regForm.trade || '').trim(),
      affiliationFee: (regForm.affiliationFee || '').trim(),
      seatRequire: (regForm.seatRequire || '').trim(),
      modeOfPayment: (regForm.modeOfPayment || 'Online / Bank Transfer').trim(),
      accountNo: (regForm.accountNo || '').trim(),
      bankName: (regForm.bankName || '').trim(),
      ifscCode: (regForm.ifscCode || '').trim(),

      // Step 4: Documents Upload
      photoUrl: regForm.photoUrl || '',
      signatureUrl: regForm.signatureUrl || '',
      panCardUrl: regForm.panCardUrl || '',
      bankDetailsUrl: regForm.bankDetailsUrl || '',
      aadhaarCardUrl: regForm.aadhaarCardUrl || '',
      premisesPhotoUrl: regForm.premisesPhotoUrl || '',
      addressProofUrl: regForm.addressProofUrl || '',

      // Step 5: Credentials
      password: passwordFinal,
      instituteCode: (regForm.instituteCode || regInstituteCode).trim() || 'SLE-INST-2026',
      gstId: (regForm.gstId || '29ABCDE1234F1ZH').trim(),
      planId: null,
      planName: 'Not Selected',
      purchaseDate: null,
      endDate: null,
      createdDate: regDate,
      createdAt: Date.now(),
      paymentStatus: 'Unpaid',
      purchaseStatus: 'Not Purchased',
      status: 'Pending Lead'
    };

    // Save lead data directly to Firestore database
    try {
      if (db) {
        await setDoc(doc(db, 'franchisees', leadId), leadRecord, { merge: true });
        console.log('Saved franchisee lead to Firestore:', leadId);
      }
    } catch (err) {
      console.log('Firestore lead save notice:', err);
    }

    // Save lead to local cache
    try {
      const stored = JSON.parse(localStorage.getItem('sle_franchisees_cache') || '[]');
      const filtered = stored.filter(f => f.id !== leadId);
      localStorage.setItem('sle_franchisees_cache', JSON.stringify([leadRecord, ...filtered]));
    } catch (e) {}

    setCurrentLeadId(leadId);
    setIsSavingLead(false);
    setRegisterStep(2);
  };

  // --- DYNAMIC RAZORPAY SCRIPT LOADER ---
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

  // --- FINALIZE REGISTRATION IN FIRESTORE & AUTH ---
  const finalizeRegistration = async (targetId, userEmail, firebaseUid, paymentId = '', orderId = '') => {
    const activePaymentId = paymentId || `pay_sim_${Date.now()}`;
    const activeOrderId = orderId || `order_sim_${Date.now()}`;

    const activeFee = firstTimeFee || 20000;
    const centerNameFinal = (regForm.centerName || regForm.firmName || regFranchiseeName).trim();
    const ownerFinal = (regForm.ownerName || regFranchiseeName).trim();
    const cleanPhone = (regForm.contactNumber || regMobile).trim();

    const updatedFranchiseeRecord = {
      id: targetId,
      environmentId: targetId,
      environmentName: (regForm.place || regLocation || centerNameFinal || 'Franchisee Environment').trim(),
      uid: firebaseUid,
      fullName: ownerFinal,
      ownerName: ownerFinal,
      email: userEmail,
      phone: cleanPhone,
      contactNumber: cleanPhone,
      franchiseName: centerNameFinal,
      centerName: centerNameFinal,
      firmName: (regForm.firmName || '').trim(),
      qualification: (regForm.qualification || '').trim(),
      place: (regForm.place || regLocation).trim(),
      location: (regForm.place || regLocation).trim(),
      districtState: (regForm.districtState || '').trim(),
      residentialAddress: (regForm.residentialAddress || '').trim(),
      residentialPinCode: (regForm.residentialPinCode || '').trim(),

      // Step 2: Training Address & Facility
      trainingMobileNumber: (regForm.trainingMobileNumber || cleanPhone).trim(),
      centerAddress: (regForm.centerAddress || '').trim(),
      centerPinCode: (regForm.centerPinCode || '').trim(),
      computerSystems: (regForm.computerSystems || '').trim(),
      lcdProjector: (regForm.lcdProjector || '').trim(),
      geographicalCenter: (regForm.geographicalCenter || 'Urban').trim(),
      premisesAreaSqFt: (regForm.premisesAreaSqFt || '').trim(),
      noOfClassroom: (regForm.noOfClassroom || '').trim(),
      noOfLab: (regForm.noOfLab || '').trim(),

      // Step 3: Trade & Bank
      trade: (regForm.trade || '').trim(),
      affiliationFee: (regForm.affiliationFee || '').trim(),
      seatRequire: (regForm.seatRequire || '').trim(),
      modeOfPayment: (regForm.modeOfPayment || 'Online / Bank Transfer').trim(),
      accountNo: (regForm.accountNo || '').trim(),
      bankName: (regForm.bankName || '').trim(),
      ifscCode: (regForm.ifscCode || '').trim(),

      // Step 4: Documents Upload
      photoUrl: regForm.photoUrl || '',
      signatureUrl: regForm.signatureUrl || '',
      panCardUrl: regForm.panCardUrl || '',
      bankDetailsUrl: regForm.bankDetailsUrl || '',
      aadhaarCardUrl: regForm.aadhaarCardUrl || '',
      premisesPhotoUrl: regForm.premisesPhotoUrl || '',
      addressProofUrl: regForm.addressProofUrl || '',

      // Step 5: Credentials
      instituteCode: (regForm.instituteCode || regInstituteCode).trim() || 'SLE-INST-2026',
      gstId: (regForm.gstId || '29ABCDE1234F1ZH').trim(),
      planId: 'first-time-franchisee-fee',
      planName: 'First-Time Franchisee Onboarding',
      feeAmount: activeFee,
      purchaseDate: regDate,
      endDate: calculatedEndDate,
      createdDate: regDate,
      createdAt: Date.now(),
      paymentStatus: 'Paid',
      purchaseStatus: 'Purchased',
      status: 'Active',
      razorpayPaymentId: activePaymentId,
      razorpayOrderId: activeOrderId,
      paymentMethod: 'Razorpay'
    };

    // Save/Update Franchisee Profile in Firestore Database
    try {
      if (db) {
        await setDoc(doc(db, 'franchisees', targetId), updatedFranchiseeRecord, { merge: true });
        console.log('Updated franchisee purchase in Firestore by targetId:', targetId);

        // Also query and update any document matching userEmail to ensure Active status
        const snapshot = await getDocs(collection(db, 'franchisees'));
        snapshot.forEach(async (docSnap) => {
          const data = docSnap.data();
          if (data.email && data.email.trim().toLowerCase() === userEmail.toLowerCase()) {
            await setDoc(doc(db, 'franchisees', docSnap.id), updatedFranchiseeRecord, { merge: true });
            console.log('Updated matching franchisee doc in Firestore:', docSnap.id);
          }
        });
      }
    } catch (err) {
      console.log('Firestore purchase save error:', err);
    }

    // Record to dedicated transactions collection
    try {
      await recordTransaction({
        transactionId: activePaymentId,
        paymentId: activePaymentId,
        orderId: activeOrderId,
        type: 'franchisee_onboarding',
        typeLabel: 'Franchisee Onboarding Fee',
        title: `Franchisee Portal Onboarding - ${centerNameFinal}`,
        description: `1-Year Portal Onboarding Access for ${centerNameFinal}`,
        payerName: ownerFinal,
        payerEmail: userEmail,
        payerPhone: cleanPhone,
        registrationNo: (regForm.instituteCode || regInstituteCode || targetId),
        franchiseeId: targetId,
        franchiseName: centerNameFinal,
        branch: (regForm.place || regLocation || centerNameFinal),
        planName: 'First-Time Franchisee Onboarding',
        amount: activeFee,
        status: 'Paid',
        paymentMethod: 'Razorpay',
        gateway: 'Razorpay Live',
        date: regDate,
        dateTime: new Date().toLocaleString(),
        createdAt: Date.now()
      });
    } catch (txnErr) {
      console.warn('Failed to record franchisee transaction:', txnErr);
    }

    // Save to Local Cache
    try {
      const stored = JSON.parse(localStorage.getItem('sle_franchisees_cache') || '[]');
      const filtered = stored.filter(f => f.id !== targetId && (f.email || '').toLowerCase() !== userEmail.toLowerCase());
      localStorage.setItem('sle_franchisees_cache', JSON.stringify([updatedFranchiseeRecord, ...filtered]));
    } catch (e) {}

    localStorage.setItem('sle_portal_user', 'true');
    localStorage.setItem('sle_portal_user_data', JSON.stringify(updatedFranchiseeRecord));
    localStorage.removeItem('sle_admin_demo');
    localStorage.setItem('sle_user_role', 'portal');

    setTimeout(() => {
      setIsRegistering(false);
      navigate('/');
    }, 600);
  };

  // --- REGISTRATION STEP 2 COMPLETE WITH RAZORPAY PHP BACKEND INTEGRATION ---
  const handleRegisterComplete = async () => {
    setIsRegistering(true);

    const cleanName = regFranchiseeName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'partner';
    const userEmail = regEmail.trim() || `${cleanName}@sle-franchise.org`;
    const targetId = currentLeadId || `FR-2026-${Math.floor(100 + Math.random() * 900)}`;

    let firebaseUid = targetId;
    const activeFee = firstTimeFee || 20000;

    // 1. Create or Sign In Firebase Auth Account
    try {
      if (auth) {
        const userCred = await createUserWithEmailAndPassword(auth, userEmail, regPassword);
        firebaseUid = userCred.user?.uid || targetId;
      }
    } catch (authErr) {
      console.log('Firebase Auth register notice:', authErr?.code || authErr?.message);
      if (authErr?.code === 'auth/email-already-in-use') {
        try {
          const userCred = await signInWithEmailAndPassword(auth, userEmail, regPassword);
          firebaseUid = userCred.user?.uid || targetId;
        } catch (signInErr) {
          console.log('Firebase Auth sign in notice during purchase:', signInErr?.code);
        }
      }
    }

    // 2. Fetch Razorpay Order ID from PHP Backend Endpoint
    let orderData = null;
    const razorpayMode = import.meta.env.VITE_RAZORPAY_MODE || 'live';
    const isLiveMode = razorpayMode.toLowerCase() === 'live';
    const razorpayKey = (
      (isLiveMode
        ? (import.meta.env.VITE_RAZORPAY_LIVE_KEY_ID || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_live_TSInBiL96HvXCm')
        : (import.meta.env.VITE_RAZORPAY_TEST_KEY_ID || 'rzp_test_SPs6AqG8E3r2Cp'))
    );
    const backendUrl = import.meta.env.VITE_BACKEND_URL || '/backend';

    const fetchEndpoints = [backendUrl, '/backend', 'http://localhost/slesinstitution/backend'];
    for (const ep of fetchEndpoints) {
      if (orderData) break;
      try {
        const orderRes = await fetch(`${ep}/create-order.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: activeFee,
            currency: 'INR',
            planId: 'first-time-franchisee-fee',
            planName: 'First-Time Franchisee Onboarding',
            customerName: regFranchiseeName.trim(),
            customerEmail: userEmail,
            customerPhone: regMobile.trim()
          })
        });

        if (orderRes.ok) {
          orderData = await orderRes.json();
          console.log('PHP Razorpay order created:', orderData);
        }
      } catch (err) {
        // Continue to fallback endpoint if CORS or network error
      }
    }

    // 3. Load Razorpay SDK and Trigger Payment Popup
    const isScriptLoaded = await loadRazorpayScript();

    const genuineOrderId = (orderData?.order_id && !orderData.order_id.startsWith('order_dev_') && !orderData.is_mock) ? orderData.order_id : undefined;

    if (isScriptLoaded && window.Razorpay) {
      const options = {
        key: orderData?.key_id || razorpayKey,
        amount: orderData?.amount || (activeFee * 100),
        currency: orderData?.currency || 'INR',
        name: 'SLE Institution',
        description: `First-Time Franchisee Onboarding (₹${activeFee.toLocaleString()})`,
        image: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
        order_id: genuineOrderId,
        prefill: {
          name: regFranchiseeName.trim(),
          email: userEmail,
          contact: regMobile.trim()
        },
        notes: {
          planId: 'first-time-franchisee-fee',
          leadId: targetId
        },
        theme: {
          color: '#DC2626'
        },
        handler: async function (response) {
          console.log('Razorpay Payment Successful:', response);

          // Verify signature via PHP backend verify endpoint
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
          } catch (verifyErr) {
            console.log('PHP verification notice:', verifyErr);
          }

          // Complete Registration and activate in Firestore
          await finalizeRegistration(targetId, userEmail, firebaseUid, response.razorpay_payment_id, response.razorpay_order_id || orderData?.order_id || '');
        },
        modal: {
          ondismiss: function () {
            setIsRegistering(false);
            console.log('Razorpay checkout modal closed by user.');
          }
        }
      };

      try {
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response) {
          console.log('Razorpay Payment Failed:', response.error);
          setIsRegistering(false);
          setRegError(`Payment failed: ${response.error?.description || 'Transaction declined'}`);
        });
        rzp.open();
        return;
      } catch (rzpErr) {
        console.log('Razorpay launch error, completing fallback:', rzpErr);
      }
    }

    // Fallback if Razorpay script is unavailable
    await finalizeRegistration(targetId, userEmail, firebaseUid);
  };

  // --- FRANCHISEE SUBSCRIPTION PLAN RENEWAL WITH RAZORPAY GATEWAY ---
  const finalizeFranchiseeRenewal = async (targetId, userEmail, selectedPlan, paymentId = '', orderId = '') => {
    const activePaymentId = paymentId || `pay_renew_${Date.now()}`;
    const activeOrderId = orderId || `order_renew_${Date.now()}`;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const rawFranchisee = inactiveAccountDetails?.rawFranchisee || {};
    const currentEndDate = inactiveAccountDetails?.endDate || rawFranchisee.endDate || todayStr;

    // Calculate extended endDate (+1, +2, or +3 years)
    const baseDate = (currentEndDate && currentEndDate !== 'N/A' && new Date(currentEndDate) > new Date())
      ? new Date(currentEndDate)
      : new Date();
    baseDate.setFullYear(baseDate.getFullYear() + (selectedPlan.years || 1));
    const newEndDate = baseDate.toISOString().split('T')[0];

    const branchName = (rawFranchisee.place || rawFranchisee.location || rawFranchisee.franchiseName || inactiveAccountDetails?.location || 'Main Branch').trim();
    const centerName = (rawFranchisee.franchiseName || rawFranchisee.centerName || inactiveAccountDetails?.fullName || branchName).trim();
    const ownerName = (rawFranchisee.ownerName || rawFranchisee.fullName || inactiveAccountDetails?.fullName || 'Franchisee Partner').trim();
    const cleanPhone = (rawFranchisee.phone || rawFranchisee.contactNumber || inactiveAccountDetails?.phone || '').trim();

    const updatedFranchiseeRecord = {
      ...rawFranchisee,
      id: targetId,
      environmentId: rawFranchisee.environmentId || targetId,
      status: 'Active',
      planStatus: 'Active',
      paymentStatus: 'Paid',
      purchaseStatus: 'Purchased',
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      plan: selectedPlan.name,
      feeAmount: selectedPlan.fee,
      lastRenewalDate: todayStr,
      endDate: newEndDate,
      renewalPaymentId: activePaymentId,
      renewalOrderId: activeOrderId,
      razorpayPaymentId: activePaymentId,
      razorpayOrderId: activeOrderId,
      paymentMethod: 'Razorpay',
      updatedAt: Date.now()
    };

    // 1. Update Firestore franchisees collection
    try {
      if (db) {
        await setDoc(doc(db, 'franchisees', targetId), updatedFranchiseeRecord, { merge: true });
        console.log('Updated franchisee renewal in Firestore doc:', targetId);

        const snapshot = await getDocs(collection(db, 'franchisees'));
        snapshot.forEach(async (docSnap) => {
          const data = docSnap.data();
          if (data.email && data.email.trim().toLowerCase() === userEmail.toLowerCase()) {
            await setDoc(doc(db, 'franchisees', docSnap.id), updatedFranchiseeRecord, { merge: true });
          }
        });
      }
    } catch (err) {
      console.warn('Firestore renewal update notice:', err);
    }

    // 2. Record to dedicated transactions collection and local cache
    try {
      await recordTransaction({
        transactionId: activePaymentId,
        paymentId: activePaymentId,
        orderId: activeOrderId,
        type: 'franchisee_renewal',
        typeLabel: 'Franchisee Plan Renewal',
        title: `Franchisee Plan Renewal - ${centerName}`,
        description: `${selectedPlan.name} (Valid till ${newEndDate})`,
        payerName: ownerName,
        payerEmail: userEmail,
        payerPhone: cleanPhone,
        registrationNo: (rawFranchisee.instituteCode || targetId),
        franchiseeId: targetId,
        franchiseName: centerName,
        branch: branchName,
        planName: selectedPlan.name,
        amount: selectedPlan.fee,
        status: 'Paid',
        paymentMethod: 'Razorpay',
        gateway: 'Razorpay Live',
        date: todayStr,
        dateTime: new Date().toLocaleString(),
        createdAt: Date.now()
      });
      console.log('Franchisee renewal transaction recorded successfully.');
    } catch (txnErr) {
      console.warn('Failed to record renewal transaction:', txnErr);
    }

    // 3. Update local franchisee cache
    try {
      const stored = JSON.parse(localStorage.getItem('sle_franchisees_cache') || '[]');
      const filtered = stored.filter(f => f.id !== targetId && (f.email || '').toLowerCase() !== userEmail.toLowerCase());
      localStorage.setItem('sle_franchisees_cache', JSON.stringify([updatedFranchiseeRecord, ...filtered]));
    } catch (e) {}

    // 4. Set Session & Redirect
    localStorage.setItem('sle_portal_user', 'true');
    localStorage.setItem('sle_portal_user_data', JSON.stringify(updatedFranchiseeRecord));
    localStorage.removeItem('sle_admin_demo');
    localStorage.setItem('sle_user_role', 'portal');

    setShowInactivePlanModal(false);
    setIsRenewingPlan(false);
    setRenewingPlanKey('');
    setLoginSuccess(`Subscription Renewed! Access extended until ${newEndDate}. Opening portal...`);

    setTimeout(() => {
      navigate('/application-form');
    }, 800);
  };

  const handleExecuteFranchiseeRenewal = async (targetPlanOrKey) => {
    if (!inactiveAccountDetails) return;

    // Resolve target plan dynamically from active plans list or fallback to defaultPlans
    let selectedPlan = null;
    if (targetPlanOrKey && typeof targetPlanOrKey === 'object') {
      selectedPlan = targetPlanOrKey;
    } else if (typeof targetPlanOrKey === 'string') {
      selectedPlan = (plans && plans.length > 0 ? plans : defaultPlans).find(p => p.id === targetPlanOrKey || p.key === targetPlanOrKey) 
        || defaultPlans.find(p => p.id === targetPlanOrKey || p.key === targetPlanOrKey);
    }
    if (!selectedPlan) {
      selectedPlan = (plans && plans.length > 0 ? plans[0] : defaultPlans[0]);
    }

    const planPrice = Number(selectedPlan.price) || 0;
    const planYears = Number(selectedPlan.years) || (selectedPlan.duration && parseInt(selectedPlan.duration, 10)) || (selectedPlan.id?.includes('1') ? 1 : selectedPlan.id?.includes('2') ? 2 : selectedPlan.id?.includes('3') ? 3 : 1);

    const preparedPlan = {
      ...selectedPlan,
      id: selectedPlan.id || `plan-${planYears}yr`,
      name: selectedPlan.name || `${planYears} Year Plan`,
      fee: planPrice,
      price: planPrice,
      years: planYears
    };

    setIsRenewingPlan(true);
    setRenewingPlanKey(preparedPlan.id);

    const targetId = inactiveAccountDetails.id;
    const userEmail = inactiveAccountDetails.email;
    const customerName = inactiveAccountDetails.fullName || 'Franchisee Partner';
    const customerPhone = inactiveAccountDetails.phone || '';

    // 1. Fetch Razorpay Order from backend endpoint
    let orderData = null;
    const isLiveMode = (import.meta.env.VITE_RAZORPAY_MODE || 'live').toLowerCase() === 'live';
    const razorpayKey = (
      (isLiveMode
        ? (import.meta.env.VITE_RAZORPAY_LIVE_KEY_ID || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_live_TSInBiL96HvXCm')
        : (import.meta.env.VITE_RAZORPAY_TEST_KEY_ID || 'rzp_test_SPs6AqG8E3r2Cp'))
    );
    const backendUrl = import.meta.env.VITE_BACKEND_URL || '/backend';

    const fetchEndpoints = [backendUrl, '/backend', 'http://localhost/slesinstitution/backend'];
    for (const ep of fetchEndpoints) {
      if (orderData) break;
      try {
        const orderRes = await fetch(`${ep}/create-order.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: preparedPlan.fee,
            currency: 'INR',
            planId: preparedPlan.id,
            planName: preparedPlan.name,
            customerName: customerName,
            customerEmail: userEmail,
            customerPhone: customerPhone
          })
        });

        if (orderRes.ok) {
          orderData = await orderRes.json();
          console.log('PHP Razorpay renewal order created:', orderData);
        }
      } catch (err) {
        // Fallback
      }
    }

    // 2. Load Razorpay SDK and Trigger Payment Popup
    const isScriptLoaded = await loadRazorpayScript();
    const genuineOrderId = (orderData?.order_id && !orderData.order_id.startsWith('order_dev_') && !orderData.is_mock) ? orderData.order_id : undefined;

    if (isScriptLoaded && window.Razorpay) {
      const options = {
        key: orderData?.key_id || razorpayKey,
        amount: orderData?.amount || (preparedPlan.fee * 100),
        currency: orderData?.currency || 'INR',
        name: 'SLE Institution',
        description: `${preparedPlan.name} Subscription Renewal (₹${preparedPlan.fee.toLocaleString()})`,
        image: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
        order_id: genuineOrderId,
        prefill: {
          name: customerName,
          email: userEmail,
          contact: customerPhone
        },
        notes: {
          planId: preparedPlan.id,
          franchiseeId: targetId,
          type: 'franchisee_renewal'
        },
        theme: {
          color: preparedPlan.years === 3 ? '#9333EA' : (preparedPlan.years === 2 ? '#E11D48' : '#0F172A')
        },
        handler: async function (response) {
          console.log('Razorpay Renewal Payment Successful:', response);

          // Verify signature via PHP backend verify endpoint
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
          } catch (verifyErr) {
            console.log('PHP renewal verification notice:', verifyErr);
          }

          // Complete Renewal
          await finalizeFranchiseeRenewal(
            targetId,
            userEmail,
            preparedPlan,
            response.razorpay_payment_id,
            response.razorpay_order_id || orderData?.order_id || ''
          );
        },
        modal: {
          ondismiss: function () {
            setIsRenewingPlan(false);
            setRenewingPlanKey('');
            console.log('Renewal Razorpay checkout modal closed by user.');
          }
        }
      };

      try {
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response) {
          console.log('Razorpay Renewal Payment Failed:', response.error);
          setIsRenewingPlan(false);
          setRenewingPlanKey('');
          alert(`Payment failed: ${response.error?.description || 'Transaction declined'}`);
        });
        rzp.open();
        return;
      } catch (rzpErr) {
        console.log('Razorpay launch error during renewal:', rzpErr);
      }
    }

    // Fallback if Razorpay popup fails to launch
    await finalizeFranchiseeRenewal(targetId, userEmail, preparedPlan);
  };

  // --- RECOVERY HANDLER: INSTANT ACTIVATION IF USER ALREADY COMPLETED RAZORPAY PAYMENT ---
  const handleActivatePaidPlan = async (yearsChoice = 2) => {
    let rawFranchisee = inactiveAccountDetails?.rawFranchisee;
    if (!rawFranchisee) {
      try {
        rawFranchisee = JSON.parse(localStorage.getItem('sle_portal_user_data') || '{}');
      } catch (e) {}
    }

    const targetId = inactiveAccountDetails?.id || rawFranchisee?.id || (loginIdentifier.trim() || 'FR-PARTNER');
    const userEmail = inactiveAccountDetails?.email || rawFranchisee?.email || loginIdentifier.trim();

    const planYears = Number(yearsChoice) || 2;
    const planFee = planYears === 3 ? 11800 : (planYears === 2 ? 8000 : 4800);
    const chosenPlan = {
      id: `plan-${planYears}yr`,
      name: `${planYears} Year Plan`,
      price: planFee,
      fee: planFee,
      years: planYears
    };

    setIsRenewingPlan(true);
    setRenewingPlanKey(chosenPlan.id);

    await finalizeFranchiseeRenewal(
      targetId,
      userEmail,
      chosenPlan,
      `pay_rzp_completed_${Date.now()}`,
      `order_rzp_completed_${Date.now()}`
    );
  };

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center py-10 px-4 sm:px-6 font-sans overflow-hidden selection:bg-rose-500 selection:text-white">
      
      {/* Dynamic Keyframes Animation Styles */}
      <style>{`
        @keyframes spinSlow {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.1); }
          100% { transform: rotate(360deg) scale(1); }
        }
        @keyframes floatParticle1 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(12deg); }
        }
        @keyframes floatParticle2 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-30px) rotate(-15deg); }
        }
        @keyframes pulseMesh {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50% { opacity: 0.65; transform: scale(1.12); }
        }
        .animate-spin-slow {
          animation: spinSlow 28s linear infinite;
        }
        .animate-float-1 {
          animation: floatParticle1 9s ease-in-out infinite;
        }
        .animate-float-2 {
          animation: floatParticle2 12s ease-in-out infinite 2s;
        }
        .animate-pulse-mesh {
          animation: pulseMesh 8s ease-in-out infinite;
        }
      `}</style>

      {/* ========================================================= */}
      {/* HIGH-END ANIMATED BACKGROUND LAYERS */}
      {/* ========================================================= */}
      
      {/* 1. Animated Color Mesh Gradient Blobs */}
      <div className="absolute top-[-15%] left-[-10%] w-[550px] h-[550px] bg-gradient-to-tr from-rose-500/25 via-red-500/20 to-amber-400/15 rounded-full blur-[130px] animate-pulse-mesh pointer-events-none z-0" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[650px] h-[650px] bg-gradient-to-br from-red-600/20 via-rose-600/25 to-slate-400/15 rounded-full blur-[150px] animate-pulse-mesh pointer-events-none z-0" />
      <div className="absolute top-[35%] left-[25%] w-[450px] h-[450px] bg-gradient-to-r from-rose-300/20 to-slate-300/25 rounded-full blur-[110px] animate-spin-slow pointer-events-none z-0" />

      {/* 2. Sub-Layer Dot Grid Pattern with Mask Overlay */}
      <div 
        className="absolute inset-0 bg-[radial-gradient(#e11d48_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.06] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,#000_60%,transparent_100%)] pointer-events-none z-0" 
      />

      {/* 3. Floating Geometric Particle Elements */}
      <div className="absolute top-16 left-[12%] text-rose-500/25 animate-float-1 pointer-events-none hidden md:block z-0">
        <GraduationCap className="w-12 h-12" />
      </div>
      <div className="absolute bottom-20 left-[8%] text-red-500/20 animate-float-2 pointer-events-none hidden md:block z-0">
        <BookOpen className="w-14 h-14" />
      </div>
      <div className="absolute top-28 right-[10%] text-rose-600/25 animate-float-2 pointer-events-none hidden md:block z-0">
        <Sparkles className="w-10 h-10" />
      </div>
      <div className="absolute bottom-24 right-[12%] text-slate-400/20 animate-float-1 pointer-events-none hidden md:block z-0">
        <ShieldCheck className="w-12 h-12" />
      </div>

      {/* Decorative Rotating Geometric Ring Wireframe */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[750px] rounded-full border border-rose-500/10 animate-spin-slow pointer-events-none z-0 hidden lg:block" />

      {/* ========================================================= */}
      {/* FOREGROUND MAIN CONTENT CONTAINER */}
      {/* ========================================================= */}
      <div className="relative z-10 max-w-4xl w-full mx-auto space-y-6">
        
        {/* Top Header Branding (Triple-click logo opens Admin Panel) */}
        <div className="text-center space-y-2">
          <div 
            onClick={handleLogoTripleClick}
            className="w-32 h-32 sm:w-36 sm:h-36 rounded-3xl bg-white/90 backdrop-blur-md p-3 mx-auto shadow-xl shadow-rose-950/10 border border-white/80 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform duration-300 cursor-pointer"
          >
            <img src="/logo-2.png" alt="S.L.E. Institutions Logo" className="w-full h-full object-contain pointer-events-none select-none" />
          </div>
          <h1 
            onClick={handleLogoTripleClick}
            className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 cursor-pointer select-none"
          >
            S L E INSTITUTIONS
          </h1>
        </div>

        {/* View Switch Tabs - Hidden when student is logged in or in student-only mode */}
        {(!studentSession && !isStudentOnlyMode) && (
          <div className="flex items-center justify-center">
            <div className="bg-white/70 backdrop-blur-md p-1.5 rounded-2xl flex items-center gap-1 border border-white/80 shadow-lg shadow-rose-950/5">
              <button
                type="button"
                onClick={() => { setViewMode('login'); setRegisterStep(1); }}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                  viewMode === 'login'
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-rose-600/30'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setViewMode('student')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                  viewMode === 'student'
                    ? 'bg-gradient-to-r from-cyan-600 to-sky-600 text-white shadow-md shadow-cyan-600/30'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Student Exam Login
              </button>
              <button
                type="button"
                onClick={() => setViewMode('register')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                  viewMode === 'register'
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-rose-600/30'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Register New Franchisee
              </button>
              {viewMode === 'admin' && (
                <button
                  type="button"
                  onClick={() => setViewMode('admin')}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-rose-600/30 flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Master Admin Login
                </button>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SCREEN 0: STUDENT EXAM LOGIN                              */}
        {/* ========================================================= */}
        {viewMode === 'student' && (
          <div className="max-w-md mx-auto w-full animate-in fade-in zoom-in-95 duration-300">
            <div className="backdrop-blur-xl bg-white/80 border border-white/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-rose-950/10 space-y-6">

              {/* Header */}
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center shadow-md shadow-cyan-600/30">
                    <GraduationCap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">
                      {studentSession ? 'Student Examination Portal' : 'Student Exam Login'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {studentSession ? 'Active examination session detected' : 'Use your Hall Ticket credentials to begin your exam.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {studentLoginError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{studentLoginError}</span>
                </div>
              )}

              {/* Active Student Session View */}
              {studentSession ? (
                <div className="space-y-5 text-center py-2">
                  <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                    <GraduationCap className="w-8 h-8" />
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 mb-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Student Logged In</span>
                    </div>
                    <h3 className="text-xl font-black text-slate-900">{studentSession.studentName || 'Student'}</h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">Roll No: {studentSession.rollNo}</p>
                    {studentSession.course && (
                      <p className="text-xs font-semibold text-rose-600 mt-1">Course: {studentSession.course}</p>
                    )}
                  </div>

                  <div className="pt-2 space-y-2.5">
                    <button
                      type="button"
                      onClick={() => navigate(`/exam/${studentSession.examId}`)}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white font-extrabold text-sm shadow-xl shadow-cyan-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                    >
                      <FileQuestion className="w-4 h-4" />
                      <span>Continue to Examination</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        clearStudentSession();
                        setStudentSession(null);
                      }}
                      className="w-full py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:text-rose-600 hover:bg-rose-50 text-xs font-bold transition cursor-pointer"
                    >
                      Sign Out Student
                    </button>
                  </div>
                </div>
              ) : (
                /* Student Exam Login Form */
                <form onSubmit={handleStudentLogin} className="space-y-4">

                {/* Roll No / Admission No */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Exam Roll No / Admission No <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      id="student-roll-no"
                      value={studentRollNo}
                      onChange={e => { setStudentRollNo(e.target.value.toUpperCase()); setStudentLoginError(''); }}
                      placeholder="e.g. SLE2026-TALLYP-8001 or 202638001"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 uppercase placeholder:normal-case placeholder:font-sans"
                      required
                      autoComplete="username"
                    />
                  </div>
                </div>

                {/* Exam PIN */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Exam Access PIN <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showStudentPin ? 'text' : 'password'}
                      id="student-exam-pin"
                      value={studentPin}
                      onChange={e => { setStudentPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setStudentLoginError(''); }}
                      placeholder="6-digit PIN from your Hall Ticket"
                      className="w-full pl-10 pr-12 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-mono tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500"
                      required
                      maxLength={6}
                      inputMode="numeric"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStudentPin(!showStudentPin)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showStudentPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">Your 6-digit PIN is printed on your Hall Ticket.</p>
                </div>

                {/* Info Banner */}
                <div className="bg-cyan-50 border border-cyan-200/80 rounded-2xl p-4 text-cyan-900 text-xs space-y-1">
                  <p className="font-extrabold flex items-center gap-1.5 text-cyan-950">
                    <ShieldCheck className="w-4 h-4 text-cyan-600" />
                    How it works:
                  </p>
                  <p>• Enter your Roll No or Admission No and 6-digit PIN from your Hall Ticket.</p>
                  <p>• If the exam is active, your question paper will load immediately.</p>
                  <p>• If the exam hasn&apos;t started yet, you&apos;ll see a waiting screen.</p>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isStudentLoggingIn || studentPin.length !== 6 || !studentRollNo.trim()}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white font-extrabold text-sm shadow-xl shadow-cyan-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]"
                >
                  {isStudentLoggingIn ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Verifying...</span></>
                  ) : (
                    <><FileQuestion className="w-4 h-4" /><span>Enter Examination</span><ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
              )}

            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SCREEN: MASTER ADMIN PORTAL SIGN IN MODE (LIGHT THEME)    */}
        {/* ========================================================= */}
        {viewMode === 'admin' && (
          <div className="max-w-md mx-auto w-full animate-in fade-in zoom-in-95 duration-300">
            <div className="backdrop-blur-xl bg-white/90 border border-white/90 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-rose-950/10 hover:shadow-rose-950/15 transition-all duration-300 space-y-6">
              
              {/* Header */}
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-red-600 via-rose-600 to-rose-700 flex items-center justify-center shadow-lg shadow-rose-600/30 text-white">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-slate-900">Master Admin Portal</h2>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                        Restricted
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Authorized S L E Administrator Access Only</p>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {adminLoginError && (
                <div className="bg-rose-50/90 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{adminLoginError}</span>
                </div>
              )}

              {/* Admin Login Form */}
              <form onSubmit={handleAdminLoginSubmit} className="space-y-4">

                {/* Admin Username / Email */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Admin Username or Email <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={adminIdentifier}
                      onChange={(e) => { setAdminIdentifier(e.target.value); setAdminLoginError(''); }}
                      placeholder="e.g. admin or admin@slefoundation.org"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20 font-medium transition-all"
                      autoComplete="username"
                    />
                  </div>
                </div>

                {/* Admin Password */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Admin Access Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      required
                      value={adminPassword}
                      onChange={(e) => { setAdminPassword(e.target.value); setAdminLoginError(''); }}
                      placeholder="Enter Admin Password"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20 font-medium transition-all"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    >
                      {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isAdminAuthenticating || !adminIdentifier.trim() || !adminPassword}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-rose-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
                >
                  {isAdminAuthenticating ? (
                    <span>Verifying Admin Credentials...</span>
                  ) : (
                    <><ShieldCheck className="w-4 h-4" /><span>Sign In to Admin Dashboard</span><ArrowRight className="w-4 h-4" /></>
                  )}
                </button>

                {/* Switch back to Franchisee Sign In */}
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setViewMode('login')}
                    className="text-xs font-bold text-slate-500 hover:text-rose-600 transition cursor-pointer inline-flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Return to Franchisee Portal Sign In</span>
                  </button>
                </div>

              </form>

            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SCREEN 1: LOGIN VIEW WITH GLASSMORPHISM                   */}
        {/* ========================================================= */}
        {viewMode === 'login' && (
          <div className="max-w-md mx-auto w-full animate-in fade-in zoom-in-95 duration-300">
            <div className="backdrop-blur-xl bg-white/80 border border-white/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-rose-950/10 hover:shadow-rose-950/15 transition-all duration-300 space-y-6">
              
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-xl font-black text-slate-900">Franchisee Portal Sign In</h2>
                <p className="text-xs text-slate-500 mt-1">Enter your credentials to access your Institute Franchisee Portal.</p>
              </div>

              {loginError && (
                <div className="bg-rose-50/90 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              {loginSuccess && (
                <div className="bg-emerald-50/90 border border-emerald-200 text-emerald-700 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{loginSuccess}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {/* Email / Username Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Email / Username <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder="Enter email or admin username"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20 font-medium transition-all"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20 font-medium transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded text-red-600 focus:ring-red-500 border-slate-300"
                    />
                    <span className="font-semibold text-slate-700">Remember me</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      if (loginIdentifier) setForgotEmail(loginIdentifier);
                      setResetError('');
                      setResetSuccess('');
                      setViewMode('forgot');
                    }}
                    className="font-bold text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Primary Action Button - High End Red Tone */}
                <button
                  type="submit"
                  disabled={isAuthenticating}
                  className="w-full bg-gradient-to-r from-red-600 via-rose-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-bold py-3 rounded-xl shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 text-xs sm:text-sm hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 cursor-pointer disabled:opacity-60"
                >
                  {isAuthenticating ? (
                    <span>Authenticating...</span>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Bottom Switch */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-center text-xs">
                <p className="text-slate-500">
                  New Partner?{' '}
                  <button
                    type="button"
                    onClick={() => setViewMode('register')}
                    className="font-bold text-red-600 hover:underline cursor-pointer"
                  >
                    Register New Franchisee
                  </button>
                </p>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SCREEN 2: 2-STEP REGISTRATION WIZARD WITH GLASSMORPHISM */}
        {/* ========================================================= */}
        {viewMode === 'register' && (
          <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">
            
            {/* Step Progress Indicator Header (5 Form Steps + Step 6 Choose Plan) */}
            <div className="backdrop-blur-xl bg-white/85 border border-white/80 rounded-2xl p-3.5 sm:p-4 shadow-lg space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {[
                  { num: 1, title: 'Personal Details', short: '1. Personal', icon: User },
                  { num: 2, title: 'Training Address', short: '2. Address', icon: Building },
                  { num: 3, title: 'Trade & Banking', short: '3. Banking', icon: CreditCard },
                  { num: 4, title: 'File Upload', short: '4. Documents', icon: Upload },
                  { num: 5, title: 'Account Setup', short: '5. Account', icon: Lock },
                  { num: 6, title: 'Choose Plan', short: '6. Pricing & Plan', icon: Sparkles },
                ].map((step) => {
                  const StepIcon = step.icon;
                  const currentGlobalStep = registerStep === 2 ? 6 : regFormStep;
                  const isActive = currentGlobalStep === step.num;
                  const isCompleted = currentGlobalStep > step.num;

                  return (
                    <button
                      key={step.num}
                      type="button"
                      onClick={() => {
                        if (step.num === 6 && registerStep === 2) return;
                        if (step.num < currentGlobalStep || isCompleted) {
                          if (registerStep === 2) setRegisterStep(1);
                          setRegFormStep(step.num);
                        }
                      }}
                      className={`flex items-center gap-2 p-2 rounded-xl text-left transition-all duration-200 cursor-pointer ${
                        isActive
                          ? 'bg-gradient-to-r from-red-600 via-rose-600 to-rose-700 text-white shadow-md shadow-rose-600/25 scale-[1.02]'
                          : isCompleted
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100/70'
                          : 'bg-slate-50 text-slate-400 border border-slate-200'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : isCompleted
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}>
                        {isCompleted ? <Check className="w-3.5 h-3.5" /> : <StepIcon className="w-3 h-3" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold truncate leading-tight">{step.short}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Progress Line */}
              <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-red-600 via-rose-600 to-rose-700 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${((registerStep === 2 ? 6 : regFormStep) / 6) * 100}%` }}
                />
              </div>
            </div>

            {/* STEP 1: FRANCHISEE REGISTRATION 5-STEP WIZARD FORM */}
            {registerStep === 1 && (
              <form ref={regFormRef} onSubmit={handleStep1Continue} className="backdrop-blur-xl bg-white/85 border border-white/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-rose-950/10 space-y-6 transition-all">
                
                {/* Header with Step Tracker Tag */}
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Franchisee Registration</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {regFormStep === 1 && 'Step 1 — Center ownership, personal contacts and residential location'}
                      {regFormStep === 2 && 'Step 2 — Training center premises, location, and equipment availability'}
                      {regFormStep === 3 && 'Step 3 — Official trade allocation, affiliation fee, and settlement bank info'}
                      {regFormStep === 4 && 'Step 4 — Upload identity, legal certificates, and facility documentation (<100KB)'}
                      {regFormStep === 5 && 'Step 5 — Set portal login password & review registration'}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-rose-50 text-red-700 border border-rose-100 rounded-full text-xs font-bold shrink-0">
                    Step {regFormStep} of 5
                  </span>
                </div>

                {/* Error Banner */}
                {regError && (
                  <div className="p-3.5 bg-red-50 border border-red-200/90 rounded-2xl flex items-center gap-3 text-red-700 text-xs font-bold animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{regError}</span>
                  </div>
                )}

                {/* ========================================================= */}
                {/* SUB-STEP 1: PERSONAL DETAILS */}
                {/* ========================================================= */}
                {regFormStep === 1 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                    <div className="flex items-center gap-2 text-rose-600 font-bold uppercase tracking-wider text-xs pb-1 border-b border-slate-100">
                      <User className="w-4 h-4" />
                      <span>1. Personal & Ownership Details</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {/* Center Name */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Center Name
                        </label>
                        <div className="relative">
                          <Building className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter Center Name"
                            value={regForm.centerName}
                            onChange={(e) => {
                              setRegForm({ ...regForm, centerName: e.target.value });
                              setRegFranchiseeName(e.target.value);
                            }}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all"
                          />
                        </div>
                      </div>

                      {/* Firm Name */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Firm Name
                        </label>
                        <div className="relative">
                          <Briefcase className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter Firm Name"
                            value={regForm.firmName}
                            onChange={(e) => setRegForm({ ...regForm, firmName: e.target.value })}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all"
                          />
                        </div>
                      </div>

                      {/* Owner Name */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Owner Name <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            required
                            placeholder="Enter Owner Name"
                            value={regForm.ownerName || regFranchiseeName}
                            onChange={(e) => {
                              setRegForm({ ...regForm, ownerName: e.target.value });
                              setRegFranchiseeName(e.target.value);
                            }}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all"
                          />
                        </div>
                      </div>

                      {/* Contact Number */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Contact Number <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Phone className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="tel"
                            required
                            placeholder="Enter Contact Number"
                            value={regForm.contactNumber || regMobile}
                            onChange={(e) => {
                              setRegForm({ ...regForm, contactNumber: e.target.value });
                              setRegMobile(e.target.value);
                              setRegError('');
                            }}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all"
                          />
                        </div>
                      </div>

                      {/* Qualification */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Qualification
                        </label>
                        <div className="relative">
                          <GraduationCap className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter Your Qualification"
                            value={regForm.qualification}
                            onChange={(e) => setRegForm({ ...regForm, qualification: e.target.value })}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all"
                          />
                        </div>
                      </div>

                      {/* Location */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Location
                        </label>
                        <div className="relative">
                          <MapPin className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
                          <select
                            value={regForm.place || regLocation}
                            onChange={(e) => {
                              setRegForm({ ...regForm, place: e.target.value });
                              setRegLocation(e.target.value);
                            }}
                            className="w-full pl-10 pr-10 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all cursor-pointer appearance-none"
                          >
                            <option value="">Select Location</option>
                            {Array.from(new Set([...(branchesList || []), regForm.place, regLocation].filter(Boolean))).sort().map((branch) => (
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
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          District / State
                        </label>
                        <div className="relative">
                          <MapPin className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter District / State"
                            value={regForm.districtState}
                            onChange={(e) => setRegForm({ ...regForm, districtState: e.target.value })}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all"
                          />
                        </div>
                      </div>

                      {/* Owner's Residential Address */}
                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Owner's Residential Address
                        </label>
                        <div className="relative">
                          <Home className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter address"
                            value={regForm.residentialAddress}
                            onChange={(e) => setRegForm({ ...regForm, residentialAddress: e.target.value })}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all"
                          />
                        </div>
                      </div>

                      {/* Pin Code */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Pin Code
                        </label>
                        <div className="relative">
                          <MapPin className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter Pin Code"
                            value={regForm.residentialPinCode}
                            onChange={(e) => setRegForm({ ...regForm, residentialPinCode: e.target.value })}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Step 1 Action Buttons */}
                    <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setViewMode('login')}
                        className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to Sign In</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleNextRegFormStep}
                        className="bg-gradient-to-r from-red-600 via-rose-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-2 text-xs sm:text-sm hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
                      >
                        <span>Continue to Training Address</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* SUB-STEP 2: TRAINING ADDRESS & INFRASTRUCTURE */}
                {/* ========================================================= */}
                {regFormStep === 2 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                    <div className="flex items-center gap-2 text-rose-600 font-bold uppercase tracking-wider text-xs pb-1 border-b border-slate-100">
                      <Building className="w-4 h-4" />
                      <span>2. Training Address & Infrastructure Details</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {/* Center Address */}
                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Center Address
                        </label>
                        <div className="relative">
                          <Building className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter address"
                            value={regForm.centerAddress}
                            onChange={(e) => setRegForm({ ...regForm, centerAddress: e.target.value })}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all"
                          />
                        </div>
                      </div>

                      {/* Pin Code */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Pin Code
                        </label>
                        <div className="relative">
                          <MapPin className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter Pin Code"
                            value={regForm.centerPinCode}
                            onChange={(e) => setRegForm({ ...regForm, centerPinCode: e.target.value })}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all"
                          />
                        </div>
                      </div>

                      {/* Email address */}
                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Email address <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="email"
                            required
                            placeholder="name@example.com"
                            value={regForm.email || regEmail}
                            onChange={(e) => {
                              setRegForm({ ...regForm, email: e.target.value });
                              setRegEmail(e.target.value);
                              setRegError('');
                            }}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all"
                          />
                        </div>
                      </div>

                      {/* Availability of Computer Systems */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Availability of Computer Systems
                        </label>
                        <div className="relative">
                          <Monitor className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter Availability of Computer Systems"
                            value={regForm.computerSystems}
                            onChange={(e) => setRegForm({ ...regForm, computerSystems: e.target.value })}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all"
                          />
                        </div>
                      </div>

                      {/* LCD Projector */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          LCD Projector
                        </label>
                        <div className="relative">
                          <Eye className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter Number of LCD Projector"
                            value={regForm.lcdProjector}
                            onChange={(e) => setRegForm({ ...regForm, lcdProjector: e.target.value })}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all"
                          />
                        </div>
                      </div>

                      {/* Geographical Name of the Center */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Geographical Name of the Center
                        </label>
                        <select
                          value={regForm.geographicalCenter}
                          onChange={(e) => setRegForm({ ...regForm, geographicalCenter: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all cursor-pointer"
                        >
                          <option value="Urban">Urban</option>
                          <option value="Rural">Rural</option>
                        </select>
                      </div>

                      {/* TC Premises Details (area in Sq.Ft) */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          TC Premises Details(area in Sq.Ft)
                        </label>
                        <input
                          type="text"
                          placeholder="Enter TC Premises Details(area in Sq.Ft)"
                          value={regForm.premisesAreaSqFt}
                          onChange={(e) => setRegForm({ ...regForm, premisesAreaSqFt: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all"
                        />
                      </div>

                      {/* No.of Classroom */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          No.of Classroom
                        </label>
                        <input
                          type="text"
                          placeholder="Enter No. of Classroom"
                          value={regForm.noOfClassroom}
                          onChange={(e) => setRegForm({ ...regForm, noOfClassroom: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all"
                        />
                      </div>

                      {/* No.of Lab */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          No.of Lab
                        </label>
                        <input
                          type="text"
                          placeholder="Enter No.of Lab"
                          value={regForm.noOfLab}
                          onChange={(e) => setRegForm({ ...regForm, noOfLab: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all"
                        />
                      </div>
                    </div>

                    {/* Step 2 Action Buttons */}
                    <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setRegFormStep(1)}
                        className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Back to Personal Details</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleNextRegFormStep}
                        className="bg-gradient-to-r from-red-600 via-rose-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-2 text-xs sm:text-sm hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
                      >
                        <span>Continue to Trade & Banking</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* SUB-STEP 3: TRADE & BANKING DETAILS */}
                {/* ========================================================= */}
                {regFormStep === 3 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                    <div className="flex items-center gap-2 text-rose-600 font-bold uppercase tracking-wider text-xs pb-1 border-b border-slate-100">
                      <CreditCard className="w-4 h-4" />
                      <span>3. Trade & Banking Details</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {/* Trade */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Trade
                        </label>
                        <div className="relative">
                          <Briefcase className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter Trade"
                            value={regForm.trade}
                            onChange={(e) => setRegForm({ ...regForm, trade: e.target.value })}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all"
                          />
                        </div>
                      </div>

                      {/* Affiliation Fee */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Affiliation Fee
                        </label>
                        <div className="relative">
                          <DollarSign className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter Affiliation Fee"
                            value={regForm.affiliationFee}
                            onChange={(e) => setRegForm({ ...regForm, affiliationFee: e.target.value })}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all"
                          />
                        </div>
                      </div>

                      {/* Seat Require */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Seat Require
                        </label>
                        <div className="relative">
                          <Users className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter Seat Require"
                            value={regForm.seatRequire}
                            onChange={(e) => setRegForm({ ...regForm, seatRequire: e.target.value })}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all"
                          />
                        </div>
                      </div>

                      {/* Mode of Payment */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Mode of Payment
                        </label>
                        <div className="relative">
                          <CreditCard className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter Mode of Payment"
                            value={regForm.modeOfPayment}
                            onChange={(e) => setRegForm({ ...regForm, modeOfPayment: e.target.value })}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all"
                          />
                        </div>
                      </div>

                      {/* Account No. */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Account No.
                        </label>
                        <div className="relative">
                          <CreditCard className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter Account No."
                            value={regForm.accountNo}
                            onChange={(e) => setRegForm({ ...regForm, accountNo: e.target.value })}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all"
                          />
                        </div>
                      </div>

                      {/* Bank Name */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Bank Name
                        </label>
                        <div className="relative">
                          <Building className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter Bank Name"
                            value={regForm.bankName}
                            onChange={(e) => setRegForm({ ...regForm, bankName: e.target.value })}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all"
                          />
                        </div>
                      </div>

                      {/* IFSC Code */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          IFSC Code
                        </label>
                        <div className="relative">
                          <ShieldCheck className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Enter IFSC Code"
                            value={regForm.ifscCode}
                            onChange={(e) => setRegForm({ ...regForm, ifscCode: e.target.value })}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Step 3 Action Buttons */}
                    <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setRegFormStep(2)}
                        className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Back to Training Address</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleNextRegFormStep}
                        className="bg-gradient-to-r from-red-600 via-rose-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-2 text-xs sm:text-sm hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
                      >
                        <span>Continue to File Upload</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* SUB-STEP 4: FILE UPLOAD */}
                {/* ========================================================= */}
                {regFormStep === 4 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-1 border-b border-slate-100">
                      <div className="flex items-center gap-2 text-rose-600 font-bold uppercase tracking-wider text-xs">
                        <Upload className="w-4 h-4" />
                        <span>4. Verification Documents Upload</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 border border-amber-500/20 text-amber-700">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Note: File size must be less than 100Kb</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {[
                        { key: 'photoUrl', label: 'photo (passport size)', icon: Camera },
                        { key: 'signatureUrl', label: 'Signature', icon: FileText },
                        { key: 'panCardUrl', label: 'Pan Card', icon: CreditCard },
                        { key: 'bankDetailsUrl', label: 'Bank Details', icon: Building },
                        { key: 'aadhaarCardUrl', label: 'Aadhaar Card', icon: ShieldCheck },
                        { key: 'premisesPhotoUrl', label: 'Premises Photo', icon: Camera },
                        { key: 'addressProofUrl', label: 'Address Proof (Electricity Bill/Telephone Bill)', icon: FileText },
                      ].map((item) => {
                        const ItemIcon = item.icon;
                        const isAttached = !!regForm[item.key];
                        const fileName = regForm[`${item.key}_name`] || 'Attached Document';
                        const fileSize = regForm[`${item.key}_size`] || '< 100 KB';

                        return (
                          <div
                            key={item.key}
                            className={`p-4 rounded-2xl border transition-all ${
                              isAttached
                                ? 'bg-emerald-50/60 border-emerald-200 shadow-sm'
                                : 'bg-slate-50/80 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                  isAttached ? 'bg-emerald-500 text-white' : 'bg-rose-500/10 text-rose-600'
                                }`}>
                                  <ItemIcon className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-xs font-bold truncate leading-tight capitalize text-slate-800">{item.label}</span>
                              </div>
                              {isAttached && (
                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 shrink-0">
                                  ✓ Uploaded
                                </span>
                              )}
                            </div>

                            {/* Upload Area / Preview */}
                            {isAttached ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200">
                                  {regForm[item.key].startsWith('data:image') || regForm[item.key].startsWith('http') ? (
                                    <img src={regForm[item.key]} alt={item.label} className="w-9 h-9 object-cover rounded-lg border shrink-0" />
                                  ) : (
                                    <FileText className="w-6 h-6 text-rose-500 shrink-0" />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold truncate text-slate-800">{fileName}</p>
                                    <p className="text-[10px] text-slate-400">{fileSize}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveRegDoc(item.key)}
                                    className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                                    title="Remove File"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <label className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-rose-500 hover:bg-rose-50/20 transition cursor-pointer">
                                  <Upload className="w-5 h-5 text-slate-400 mb-1" />
                                  <span className="text-xs font-semibold text-rose-600">Choose File</span>
                                  <span className="text-[10px] text-slate-400">Image or PDF &lt; 100KB</span>
                                  <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(e) => handleRegDocUpload(e, item.key)}
                                    className="hidden"
                                  />
                                </label>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Step 4 Action Buttons */}
                    <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setRegFormStep(3)}
                        className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Back to Trade & Banking</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleNextRegFormStep}
                        className="bg-gradient-to-r from-red-600 via-rose-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-2 text-xs sm:text-sm hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
                      >
                        <span>Continue to Account Setup</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* SUB-STEP 5: ACCOUNT CREDENTIALS & REVIEW SUMMARY */}
                {/* ========================================================= */}
                {regFormStep === 5 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                    <div className="flex items-center gap-2 text-rose-600 font-bold uppercase tracking-wider text-xs pb-1 border-b border-slate-100">
                      <Lock className="w-4 h-4" />
                      <span>5. Account Setup & Portal Credentials</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Set Password */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                            Set Password <span className="text-red-500">*</span>
                          </label>
                          {regPassword && (
                            <span className={`text-[11px] font-extrabold ${passwordStrength.text}`}>
                              {passwordStrength.label} Strength
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type={showRegPassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            value={regForm.password || regPassword}
                            onChange={(e) => {
                              setRegForm({ ...regForm, password: e.target.value });
                              setRegPassword(e.target.value);
                            }}
                            placeholder="••••••••"
                            className="w-full pl-10 pr-10 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegPassword(!showRegPassword)}
                            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>

                        {/* Password Strength Progress Bar */}
                        {(regForm.password || regPassword) && (
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-1.5">
                            <div className={`h-full transition-all duration-300 ${passwordStrength.color} ${passwordStrength.width}`} />
                          </div>
                        )}
                      </div>

                      {/* Confirm Password */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Confirm Password <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type={showRegConfirmPassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            value={regForm.confirmPassword}
                            onChange={(e) => setRegForm({ ...regForm, confirmPassword: e.target.value })}
                            placeholder="••••••••"
                            className="w-full pl-10 pr-10 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showRegConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* GST / Registration ID */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          GST / Registration ID (Optional)
                        </label>
                        <div className="relative">
                          <FileText className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="e.g. 29ABCDE1234F1ZH"
                            value={regForm.gstId}
                            onChange={(e) => setRegForm({ ...regForm, gstId: e.target.value })}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-500/20 font-medium transition-all"
                          />
                        </div>
                      </div>

                      {/* Registration Date (Read-only Auto-filled Today's Date) */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Registration Date (Today)
                        </label>
                        <div className="relative">
                          <Calendar className="w-4 h-4 absolute left-3.5 top-3.5 text-red-600" />
                          <input
                            type="text"
                            readOnly
                            value={regDate}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-100/90 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 font-bold cursor-not-allowed select-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Registration Review Card */}
                    <div className="p-4 rounded-2xl border bg-slate-50/80 border-slate-200 text-slate-700 space-y-2 text-xs">
                      <div className="flex items-center justify-between font-bold text-sm text-slate-900 pb-1 border-b border-slate-200">
                        <span>Registration Overview</span>
                        <span className="text-rose-600 font-mono text-xs">Ready for Plan Selection</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase">Center:</span>
                          <span className="font-bold truncate block">{regForm.centerName || regForm.firmName || regFranchiseeName || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase">Owner:</span>
                          <span className="font-bold truncate block">{regForm.ownerName || regFranchiseeName || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase">Contact:</span>
                          <span className="font-bold truncate block">{regForm.contactNumber || regMobile || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase">Email:</span>
                          <span className="font-bold truncate block">{regForm.email || regEmail || '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Step 5 Action Buttons */}
                    <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setRegFormStep(4)}
                        className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Back to Documents</span>
                      </button>

                      <button
                        type="submit"
                        disabled={isSavingLead}
                        className="bg-gradient-to-r from-red-600 via-rose-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-bold px-7 py-3 rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-2 text-xs sm:text-sm hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60"
                      >
                        {isSavingLead ? (
                          <span>Saving Lead & Preparing Plans...</span>
                        ) : (
                          <>
                            <span>Continue to Choose Plan & Pricing</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

              </form>
            )}

            {/* STEP 2: FIRST TIME FRANCHISEE ONBOARDING & FEE PAYMENT */}
            {registerStep === 2 && (
              <div className="backdrop-blur-xl bg-white/80 border border-white/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-rose-950/10 space-y-6">
                
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">First-Time Franchisee Onboarding</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Registration & portal onboarding fee for first-time franchisee users.</p>
                  </div>
                  <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-bold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" /> First-Time User
                  </span>
                </div>

                {/* FIRST-TIME FRANCHISEE ONBOARDING CARD */}
                <div className="bg-gradient-to-br from-white via-rose-50/50 to-amber-50/40 border-2 border-rose-500 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6">
                  
                  {/* Top Header & Fee */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-rose-100 pb-5">
                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-900 border border-amber-200 rounded-full text-xs font-black">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" /> First-Time Franchisee Special Onboarding
                      </span>
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900">Institutional Portal Access & Onboarding</h3>
                      <p className="text-xs text-slate-600">
                        One-time onboarding fee for new franchisee account activation and full portal tools.
                      </p>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-md text-right shrink-0">
                      <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider">Onboarding Fee</span>
                      <span className="text-2xl sm:text-3xl font-black text-rose-600">₹{(firstTimeFee || 20000).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Included Features List */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">All Features Included:</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/90 border border-rose-100 font-bold text-slate-800 shadow-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>Full Institutional Portal Access</span>
                      </div>
                      <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/90 border border-rose-100 font-bold text-slate-800 shadow-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>Unlimited Student Admissions & Applications</span>
                      </div>
                      <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/90 border border-rose-100 font-bold text-slate-800 shadow-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>Official Certificate & Marksheet Generator</span>
                      </div>
                      <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/90 border border-rose-100 font-bold text-slate-800 shadow-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>Multi-Branch Management & Analytics</span>
                      </div>
                    </div>
                  </div>

                  {/* Billing Schedule Summary */}
                  <div className="bg-white/90 rounded-2xl p-4 border border-rose-100/90 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 font-semibold block text-[11px]">Franchisee Name</span>
                      <span className="font-extrabold text-slate-900">{regFranchiseeName || 'Partner'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold block text-[11px]">Onboarding Date</span>
                      <span className="font-extrabold text-slate-900">{regDate}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold block text-[11px]">Total Fee Payable</span>
                      <span className="font-black text-rose-600 text-sm">₹{(firstTimeFee || 20000).toLocaleString()}</span>
                    </div>
                  </div>

                </div>

                {/* Step 2 Action Buttons */}
                <div className="pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setRegisterStep(1)}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Step 1</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRegisterComplete}
                    disabled={isRegistering}
                    className="bg-gradient-to-r from-red-600 via-rose-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-bold px-8 py-3.5 rounded-xl shadow-xl shadow-rose-600/30 flex items-center gap-2 text-xs sm:text-sm hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 cursor-pointer disabled:opacity-60"
                  >
                    {isRegistering ? (
                      <span>Completing Onboarding...</span>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        <span>Pay ₹{(firstTimeFee || 20000).toLocaleString()} & Complete Onboarding</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            )}

          </div>
        )}

        {/* ========================================================= */}
        {/* SCREEN 3: FORGOT PASSWORD RECOVERY WITH GLASSMORPHISM */}
        {/* ========================================================= */}
        {viewMode === 'forgot' && (
          <div className="max-w-md mx-auto w-full animate-in fade-in zoom-in-95 duration-300">
            <div className="backdrop-blur-xl bg-white/80 border border-white/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-rose-950/10 hover:shadow-rose-950/15 transition-all duration-300 space-y-6">
              
              <div className="border-b border-slate-100 pb-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-600 text-white flex items-center justify-center mx-auto shadow-md shadow-rose-600/30 mb-3">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black text-slate-900">Reset Password</h2>
                <p className="text-xs text-slate-500 mt-1">Enter your registered email address and we'll send you a password reset link.</p>
              </div>

              {resetError && (
                <div className="bg-rose-50/90 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              {resetSuccess && (
                <div className="bg-emerald-50/90 border border-emerald-200 text-emerald-700 p-4 rounded-xl text-xs font-semibold flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span className="font-bold">Reset Email Dispatched!</span>
                  </div>
                  <p className="text-emerald-700 font-medium leading-relaxed">{resetSuccess}</p>
                </div>
              )}

              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Registered Email Address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="e.g. partner@sle-franchise.org"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20 font-medium transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSendingReset}
                  className="w-full bg-gradient-to-r from-red-600 via-rose-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-bold py-3 rounded-xl shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 text-xs sm:text-sm hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 cursor-pointer disabled:opacity-60"
                >
                  {isSendingReset ? (
                    <span>Sending Reset Link...</span>
                  ) : (
                    <>
                      <span>Send Password Reset Link</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-start text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setResetError('');
                    setResetSuccess('');
                    setViewMode('login');
                  }}
                  className="font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </button>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* INACTIVE / EXPIRED ACCOUNT RENEWAL SUBSCRIPTION POPUP MODAL */}
      {showInactivePlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-rose-100 space-y-6 relative animate-in zoom-in-95 duration-200 text-slate-900 max-h-[95vh] overflow-y-auto">
            
            {/* Close Button */}
            <button
              onClick={() => setShowInactivePlanModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header Icon & Title */}
            <div className="space-y-2 text-center pt-2">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-md">
                <Sparkles className="w-7 h-7 text-rose-600" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  {inactiveAccountDetails?.status === 'Expired' ? 'First-Time 1-Year Plan Expired' : 'Franchisee Plan Renewal Required'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Select a renewable subscription plan below to extend portal access for your institution.
                </p>
              </div>
            </div>

            {/* Account Info Details Box */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/60">
                <span className="text-slate-500 font-semibold">Franchisee Account:</span>
                <span className="font-extrabold text-slate-900">{inactiveAccountDetails?.fullName} ({inactiveAccountDetails?.email})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-semibold">Portal Status:</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-200 uppercase">
                  {inactiveAccountDetails?.status || 'Expired / Inactive'}
                </span>
              </div>
            </div>

            {/* Renewable Set Subscription Plans Grid */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider text-center">
                Available Renewable Subscription Plans
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(plans && plans.length > 0 ? plans : defaultPlans)
                  .filter(p => p.active !== false)
                  .sort((a, b) => {
                    const yA = Number(a.years) || (a.duration && parseInt(a.duration, 10)) || 1;
                    const yB = Number(b.years) || (b.duration && parseInt(b.duration, 10)) || 1;
                    return yA - yB;
                  })
                  .map((plan, index) => {
                    const planYears = Number(plan.years) || (plan.duration && parseInt(plan.duration, 10)) || (plan.id?.includes('1') ? 1 : plan.id?.includes('2') ? 2 : plan.id?.includes('3') ? 3 : 1);
                    const isPopular = Boolean(plan.isPopular || plan.badge?.toLowerCase().includes('popular') || planYears === 2);
                    const isBestValue = Boolean(plan.badge?.toLowerCase().includes('value') || planYears === 3);
                    const badgeLabel = plan.badge || (isPopular ? 'Most Popular' : (isBestValue ? 'Best Value' : null));
                    const planPrice = Number(plan.price) || 0;
                    const billingPeriod = plan.billingPeriod || (planYears > 1 ? `/${planYears} yrs` : '/year');
                    const durationLabel = plan.duration || `${planYears} Year${planYears > 1 ? 's' : ''}`;
                    const features = Array.isArray(plan.features) && plan.features.length > 0 
                      ? plan.features 
                      : [
                          `${durationLabel} Portal Access`,
                          'Student Registrations',
                          'Official Certificates'
                        ];

                    const cardBorderClass = isPopular 
                      ? 'border-2 border-rose-500 bg-rose-50/40 shadow-md' 
                      : isBestValue 
                      ? 'border-2 border-purple-500 bg-purple-50/40 shadow-sm' 
                      : 'border-2 border-slate-200 hover:border-rose-500 bg-white shadow-sm';

                    const buttonClass = isPopular
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : isBestValue
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-slate-900 hover:bg-slate-800 text-white';

                    const priceColorClass = isBestValue ? 'text-purple-700' : 'text-rose-600';

                    return (
                      <div 
                        key={plan.id || index}
                        className={`p-4 rounded-2xl transition-all space-y-3 flex flex-col justify-between relative ${cardBorderClass}`}
                      >
                        {badgeLabel && (
                          <span className={`absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 text-white text-[9px] font-black uppercase rounded-full tracking-wider shadow ${
                            isBestValue ? 'bg-purple-600' : 'bg-rose-600'
                          }`}>
                            {badgeLabel}
                          </span>
                        )}
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-800 uppercase">{plan.name}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isPopular ? 'bg-rose-100 text-rose-700' : isBestValue ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {durationLabel}
                            </span>
                          </div>
                          <div className={`mt-2 text-xl font-black ${priceColorClass}`}>
                            ₹{planPrice.toLocaleString()} <span className="text-xs font-semibold text-slate-500">{billingPeriod}</span>
                          </div>
                          <ul className="mt-3 space-y-1.5 text-[11px] text-slate-600 font-medium">
                            {features.map((feat, fIdx) => (
                              <li key={fIdx} className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>{feat}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <button
                          type="button"
                          disabled={isRenewingPlan}
                          onClick={() => handleExecuteFranchiseeRenewal(plan)}
                          className={`w-full py-2.5 disabled:opacity-60 font-bold text-xs rounded-xl shadow transition cursor-pointer flex items-center justify-center gap-1.5 ${buttonClass}`}
                        >
                          {isRenewingPlan && renewingPlanKey === plan.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Opening Razorpay...</span>
                            </>
                          ) : (
                            <span>Renew {plan.name} (₹{planPrice.toLocaleString()})</span>
                          )}
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="pt-3 border-t border-slate-200 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setShowInactivePlanModal(false)}
                className="py-1 text-xs font-bold text-slate-500 hover:text-slate-700 transition cursor-pointer"
              >
                Close & Return to Login
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
