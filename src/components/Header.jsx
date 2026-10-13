import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  FileEdit,
  GraduationCap,
  FileText,
  Download,
  Users,
  LogOut,
  LogIn,
  Menu,
  X,
  BookOpen,
  ChevronDown,
  ShieldCheck,
  Building,
  Building2,
  User,
  MapPin,
  Mail,
  Phone,
  Sparkles,
  Camera,
  Loader2,
  Award,
  ExternalLink,
  Eye,
  Maximize2,
  Minimize2,
  Receipt,
  IndianRupee
} from 'lucide-react';
import ImageCropperModal from './ImageCropperModal';
import { db, doc, setDoc, getDoc } from '../firebase';
import { getStudentSession } from '../utils/examAuthManager';
import { validateFranchiseePlanStatus, checkFranchiseePlanAtLogout } from '../utils/planValidator';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [appDropdownOpen, setAppDropdownOpen] = useState(false);
  const [formsDropdownOpen, setFormsDropdownOpen] = useState(false);
  const [downloadDropdownOpen, setDownloadDropdownOpen] = useState(false);
  const [listDropdownOpen, setListDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [certDropdownOpen, setCertDropdownOpen] = useState(false);

  // Profile Picture Upload & Cropper State
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperSrc, setCropperSrc] = useState(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  const [mobileAppOpen, setMobileAppOpen] = useState(false);
  const [mobileFormsOpen, setMobileFormsOpen] = useState(false);
  const [mobileDownloadOpen, setMobileDownloadOpen] = useState(false);
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [mobileCertOpen, setMobileCertOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const [studentSession, setStudentSession] = useState(() => getStudentSession());

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('sle_portal_user') === 'true' || localStorage.getItem('sle_admin_demo') === 'true';
  });

  const [profileData, setProfileData] = useState(() => {
    try {
      const data = JSON.parse(localStorage.getItem('sle_portal_user_data') || '{}');
      return data && Object.keys(data).length > 0 ? data : {
        fullName: 'Franchisee Partner',
        franchiseName: 'SLES Training Center',
        location: 'Athani Branch',
        email: 'franchisee@slefoundation.org',
        phone: '+91 98765 43210',
        planName: 'Active Plan',
        status: 'Active',
        id: 'SLE-FR-101'
      };
    } catch (e) {
      return {
        fullName: 'Franchisee Partner',
        franchiseName: 'SLES Training Center',
        location: 'Athani Branch',
        email: 'franchisee@slefoundation.org',
        phone: '+91 98765 43210',
        planName: 'Active Plan',
        status: 'Active',
        id: 'SLE-FR-101'
      };
    }
  });

  // Franchisee Certificate Viewing State
  const [viewingFranchiseCert, setViewingFranchiseCert] = useState(false);
  const [certFullscreen, setCertFullscreen] = useState(false);
  const [pdfFitMode, setPdfFitMode] = useState('Fit'); // 'Fit' (Fit whole page) or 'FitH' (Fit page width)

  // Handle ESC key and lock body scroll when certificate lightbox is open
  useEffect(() => {
    if (!viewingFranchiseCert) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setViewingFranchiseCert(false);
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [viewingFranchiseCert]);

  // Open Certificate in New Tab using safe Blob URL for Data URLs
  const handleOpenCertInNewTab = () => {
    if (!profileData?.franchiseCertificateUrl) return;
    const url = profileData.franchiseCertificateUrl;
    if (url.startsWith('data:')) {
      try {
        const parts = url.split(';base64,');
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
          window.open(blobUrl, '_blank');
          return;
        }
      } catch (e) {
        console.warn('Blob conversion error:', e);
      }
    }
    window.open(url, '_blank');
  };

  // One-time Firestore sync for Franchisee Profile & Certificate on mount
  useEffect(() => {
    // Only check if an actual franchisee portal session is active
    const isPortalUser = localStorage.getItem('sle_portal_user') === 'true';
    const userRole = localStorage.getItem('sle_user_role');
    const isAdmin = userRole === 'admin' || localStorage.getItem('sle_admin_demo') === 'true';
    if (!isPortalUser || isAdmin) return;

    // Never execute or redirect on auth or admin pages
    const path = (location.pathname || '').toLowerCase();
    if (path === '/login' || path === '/admin' || path.startsWith('/login') || path.startsWith('/admin')) return;

    const fid = profileData?.id || profileData?.franchiseCode;
    if (!fid || fid === 'SLE-FR-101' || !db) return;

    let isMounted = true;
    (async () => {
      try {
        const docSnap = await getDoc(doc(db, 'franchisees', fid));
        if (isMounted && docSnap && docSnap.exists()) {
          const freshData = { id: docSnap.id, ...docSnap.data() };
          const merged = { ...profileData, ...freshData };
          
          setProfileData(merged);
          try {
            localStorage.setItem('sle_portal_user_data', JSON.stringify(merged));
          } catch (e) {}

          // Plan Expiry Check for active session
          const planCheck = await validateFranchiseePlanStatus(merged);
          if (!planCheck.valid && isMounted) {
            localStorage.removeItem('sle_portal_user');
            navigate('/login?plan=expired');
          }
        }
      } catch (err) {
        console.log('Franchisee cert sync notice:', err?.message);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [profileData?.id, profileData?.franchiseCode, location.pathname]);


  // Franchisee Certificate Download Handler
  const handleDownloadCertificate = () => {
    if (!profileData?.franchiseCertificateUrl) return;
    try {
      const certUrl = profileData.franchiseCertificateUrl;
      const partnerCode = profileData.id || profileData.franchiseCode || 'FR';
      const isPdf = profileData.franchiseCertificateType === 'pdf' || certUrl.startsWith('data:application/pdf') || certUrl.toLowerCase().endsWith('.pdf');
      const ext = isPdf ? '.pdf' : (certUrl.startsWith('data:image/png') ? '.png' : '.jpg');
      const finalName = `Franchisee_Certificate_${partnerCode}${ext}`;

      // If data URL or Blob URL, trigger direct browser download
      const link = document.createElement('a');
      link.href = certUrl;
      link.download = finalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Certificate download error:', e);
      window.open(profileData.franchiseCertificateUrl, '_blank');
    }
  };

  // Triple Click Logo Handler (Click 3 times on Header Logo to open Admin Panel)
  const logoClickCountRef = useRef(0);
  const logoClickTimerRef = useRef(null);

  const handleLogoTripleClick = (e) => {
    logoClickCountRef.current += 1;

    if (logoClickCountRef.current >= 3) {
      if (e) e.preventDefault();
      if (logoClickTimerRef.current) clearTimeout(logoClickTimerRef.current);
      logoClickCountRef.current = 0;

      navigate('/login?mode=admin');
    } else {
      if (logoClickTimerRef.current) clearTimeout(logoClickTimerRef.current);
      logoClickTimerRef.current = setTimeout(() => {
        logoClickCountRef.current = 0;
      }, 1200);
    }
  };

  useEffect(() => {
    const checkAuth = () => {
      const authState = localStorage.getItem('sle_portal_user') === 'true' || localStorage.getItem('sle_admin_demo') === 'true';
      setIsLoggedIn(authState);
      setStudentSession(getStudentSession());
      try {
        const data = JSON.parse(localStorage.getItem('sle_portal_user_data') || '{}');
        if (data && Object.keys(data).length > 0) {
          setProfileData(data);
        }
      } catch (e) {}
    };
    checkAuth();
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, [location.pathname]);

  const appDropdownRef = useRef(null);
  const formsDropdownRef = useRef(null);
  const downloadDropdownRef = useRef(null);
  const listDropdownRef = useRef(null);
  const profileDropdownRef = useRef(null);
  const certDropdownRef = useRef(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (appDropdownRef.current && !appDropdownRef.current.contains(event.target)) {
        setAppDropdownOpen(false);
      }
      if (formsDropdownRef.current && !formsDropdownRef.current.contains(event.target)) {
        setFormsDropdownOpen(false);
      }
      if (downloadDropdownRef.current && !downloadDropdownRef.current.contains(event.target)) {
        setDownloadDropdownOpen(false);
      }
      if (listDropdownRef.current && !listDropdownRef.current.contains(event.target)) {
        setListDropdownOpen(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
      if (certDropdownRef.current && !certDropdownRef.current.contains(event.target)) {
        setCertDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Dropdown toggle handlers (Open strictly on click)
  const toggleAppDropdown = () => {
    setAppDropdownOpen(prev => !prev);
    setFormsDropdownOpen(false);
    setDownloadDropdownOpen(false);
    setListDropdownOpen(false);
    setProfileDropdownOpen(false);
    setCertDropdownOpen(false);
  };

  const toggleFormsDropdown = () => {
    setFormsDropdownOpen(prev => !prev);
    setAppDropdownOpen(false);
    setDownloadDropdownOpen(false);
    setListDropdownOpen(false);
    setProfileDropdownOpen(false);
    setCertDropdownOpen(false);
  };

  const toggleDownloadDropdown = () => {
    setDownloadDropdownOpen(prev => !prev);
    setAppDropdownOpen(false);
    setFormsDropdownOpen(false);
    setListDropdownOpen(false);
    setProfileDropdownOpen(false);
    setCertDropdownOpen(false);
  };

  const toggleListDropdown = () => {
    setListDropdownOpen(prev => !prev);
    setAppDropdownOpen(false);
    setFormsDropdownOpen(false);
    setDownloadDropdownOpen(false);
    setProfileDropdownOpen(false);
    setCertDropdownOpen(false);
  };

  const toggleCertDropdown = () => {
    setCertDropdownOpen(prev => !prev);
    setAppDropdownOpen(false);
    setFormsDropdownOpen(false);
    setDownloadDropdownOpen(false);
    setListDropdownOpen(false);
    setProfileDropdownOpen(false);
  };

  // Mobile Accordion Toggle Handlers (Strictly One Dropdown Open At A Time)
  const toggleMobileAppDropdown = () => {
    setMobileAppOpen(prev => {
      const nextState = !prev;
      if (nextState) {
        setMobileFormsOpen(false);
        setMobileDownloadOpen(false);
        setMobileListOpen(false);
      }
      return nextState;
    });
  };

  const toggleMobileFormsDropdown = () => {
    setMobileFormsOpen(prev => {
      const nextState = !prev;
      if (nextState) {
        setMobileAppOpen(false);
        setMobileDownloadOpen(false);
        setMobileListOpen(false);
      }
      return nextState;
    });
  };

  const toggleMobileDownloadDropdown = () => {
    setMobileDownloadOpen(prev => {
      const nextState = !prev;
      if (nextState) {
        setMobileAppOpen(false);
        setMobileFormsOpen(false);
        setMobileListOpen(false);
      }
      return nextState;
    });
  };

  const toggleMobileListDropdown = () => {
    setMobileListOpen(prev => {
      const nextState = !prev;
      if (nextState) {
        setMobileAppOpen(false);
        setMobileFormsOpen(false);
        setMobileDownloadOpen(false);
        setMobileCertOpen(false);
      }
      return nextState;
    });
  };

  const toggleMobileCertDropdown = () => {
    setMobileCertOpen(prev => {
      const nextState = !prev;
      if (nextState) {
        setMobileAppOpen(false);
        setMobileFormsOpen(false);
        setMobileDownloadOpen(false);
        setMobileListOpen(false);
      }
      return nextState;
    });
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(prev => {
      const nextState = !prev;
      if (nextState) {
        if (isFormsActive) {
          setMobileFormsOpen(true);
          setMobileAppOpen(false);
          setMobileDownloadOpen(false);
          setMobileListOpen(false);
        } else if (isDownloadActive) {
          setMobileDownloadOpen(true);
          setMobileAppOpen(false);
          setMobileFormsOpen(false);
          setMobileListOpen(false);
        } else if (isListActive) {
          setMobileListOpen(true);
          setMobileAppOpen(false);
          setMobileFormsOpen(false);
          setMobileDownloadOpen(false);
        } else if (['/', '/application-form', '/coaching/admission-form'].includes(location.pathname)) {
          setMobileAppOpen(true);
          setMobileFormsOpen(false);
          setMobileDownloadOpen(false);
          setMobileListOpen(false);
        } else {
          setMobileAppOpen(false);
          setMobileFormsOpen(false);
          setMobileDownloadOpen(false);
          setMobileListOpen(false);
        }
      }
      return nextState;
    });
  };

  // Profile Picture Handlers
  const handleProfilePicSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropperSrc(reader.result);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropComplete = async (croppedBlob, croppedDataUrl) => {
    setCropperOpen(false);
    setIsUploadingPhoto(true);

    let finalPhotoUrl = croppedDataUrl;
    try {
      const uploadedUrl = await uploadToCloudinary(croppedBlob, 'profile');
      if (uploadedUrl) {
        finalPhotoUrl = uploadedUrl;
      }
    } catch (err) {
      console.warn('Cloudinary upload notice, fallback to local dataURL:', err);
    }

    const updatedProfile = {
      ...profileData,
      photoUrl: finalPhotoUrl,
      avatar: finalPhotoUrl,
      photo: finalPhotoUrl
    };

    setProfileData(updatedProfile);
    localStorage.setItem('sle_portal_user_data', JSON.stringify(updatedProfile));

    if (db && updatedProfile.id) {
      try {
        await setDoc(doc(db, 'franchisees', String(updatedProfile.id)), {
          photoUrl: finalPhotoUrl,
          avatar: finalPhotoUrl
        }, { merge: true });
      } catch (err) {
        console.warn('Firestore profile pic update notice:', err);
      }
    }

    try {
      const cached = JSON.parse(localStorage.getItem('sle_franchisees_cache') || '[]');
      const updatedList = cached.map(f => f.id === updatedProfile.id ? { ...f, photoUrl: finalPhotoUrl, avatar: finalPhotoUrl } : f);
      localStorage.setItem('sle_franchisees_cache', JSON.stringify(updatedList));
    } catch (e) {}

    window.dispatchEvent(new Event('storage'));
    setIsUploadingPhoto(false);
  };

  // Active state indicators
  const isFormsActive = ['/forms', '/forms/exam', '/forms/certificate', '/forms/marksheet'].includes(location.pathname);
  const isDownloadActive = ['/downloads', '/downloads/hall-ticket', '/downloads/certificate', '/downloads/marksheet'].includes(location.pathname);
  const isListActive = location.pathname.startsWith('/list');
  const isCertActive = location.pathname.startsWith('/certificate');

  // Do not render main website navbar on /admin or /login page
  if (['/admin', '/login'].includes(location.pathname.toLowerCase())) {
    return null;
  }

  const handleAuthAction = async () => {
    if (isLoggedIn) {
      try {
        const stored = localStorage.getItem('sle_portal_user_data');
        const parsed = stored ? JSON.parse(stored) : profileData;
        await checkFranchiseePlanAtLogout(parsed);
      } catch (logoutCheckErr) {
        console.warn('Franchisee logout plan check error:', logoutCheckErr);
      }
      setIsLoggedIn(false);
      localStorage.removeItem('sle_portal_user');
      localStorage.removeItem('sle_admin_demo');
      localStorage.removeItem('sle_user_role');
      localStorage.removeItem('sle_portal_user_data');
      navigate('/login');
    } else {
      navigate('/login');
    }
  };

  const currentPhoto = profileData.photoUrl || profileData.avatar || profileData.photo;

  // When on an exam page or student login screen, do not render Header
  // Placed after all React hooks have executed to comply with Rules of Hooks
  const isStudentScreen = location.pathname === '/' ||
    location.pathname === '/about' ||
    location.pathname === '/about-us' ||
    location.pathname.startsWith('/exam') || 
    location.pathname === '/student-login' || 
    location.pathname.startsWith('/student') ||
    location.pathname.startsWith('/verify') ||
    new URLSearchParams(location.search).get('mode') === 'student';

  if (isStudentScreen) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
      {/* Hidden File Input for Profile Picture Upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleProfilePicSelect}
      />

      {/* Top Main Branding Header - Deep Executive Crimson */}
      <div className="bg-gradient-to-r from-rose-900 via-rose-950 to-slate-900 py-3 px-4 sm:px-6 text-white border-b border-rose-800/40">
        <div className="max-w-7xl mx-auto flex flex-row items-center justify-between gap-3">

          {/* Logo & Institute Branding */}
          <Link to={isLoggedIn ? "/application-form" : "/login"} onClick={handleLogoTripleClick} className="flex items-center gap-2 sm:gap-3 group min-w-0">
            <img
              src="/logo-2.png"
              alt="S.L.E. Institutions Logo"
              className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 object-contain shrink-0 group-hover:scale-105 transition-transform duration-300 pointer-events-none drop-shadow-md"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-2xl font-black tracking-tight text-white group-hover:text-rose-200 transition-colors truncate">
                  S L E INSTITUTIONS
                </h1>
              </div>
              <p className="text-[11px] sm:text-sm font-medium text-rose-100/90 flex items-center gap-1 sm:gap-1.5 truncate">
                <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-300 inline shrink-0" />
                <span className="truncate">Professional &amp; Industrial Training</span>
              </p>
            </div>
          </Link>

          {/* Franchisee Profile Widget (Top Right) */}
          <div className="relative" ref={profileDropdownRef}>
            {isLoggedIn ? (
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(prev => !prev)}
                className="flex items-center gap-2 sm:gap-3 px-3 py-1.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/30 backdrop-blur-md text-white transition-all cursor-pointer shadow-sm group"
                title="View Franchisee Profile"
              >
                {/* Avatar with Status Indicator */}
                <div className="relative shrink-0">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-amber-400 via-rose-500 to-rose-700 text-white font-black text-xs sm:text-sm flex items-center justify-center shadow-md uppercase border border-white/30 overflow-hidden">
                    {isUploadingPhoto ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : currentPhoto ? (
                      <img src={currentPhoto} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      (profileData.franchiseName || profileData.fullName || 'F')[0]
                    )}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-rose-950" />
                </div>

                {/* Profile Text */}
                <div className="text-left hidden sm:block leading-tight">
                  <span className="text-xs sm:text-sm font-bold text-white group-hover:text-rose-200 transition-colors max-w-[150px] truncate block">
                    {profileData.franchiseName || profileData.fullName || 'Franchisee Center'}
                  </span>
                  <span className="text-[10px] text-rose-200/80 font-medium truncate block max-w-[140px]">
                    {profileData.location || profileData.centerCity || 'Franchisee Profile'}
                  </span>
                </div>

                <ChevronDown className={`w-3.5 h-3.5 text-rose-200 transition-transform duration-200 ${profileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            ) : studentSession ? (
              <Link
                to={`/exam/${studentSession.examId}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition shadow-sm"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Resume Exam ({studentSession.rollNo})</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/25 text-white text-xs font-bold transition shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Franchisee Login</span>
              </Link>
            )}

            {/* Profile Dropdown Popup Card */}
            {profileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 py-3 z-50 text-slate-800 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Header Profile Info */}
                <div className="px-4 pb-3 border-b border-slate-100 flex items-center gap-3">
                  <div className="relative group/avatar shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-600 via-rose-700 to-slate-900 text-white font-extrabold text-base flex items-center justify-center shadow-md uppercase overflow-hidden border border-slate-200">
                      {isUploadingPhoto ? (
                        <Loader2 className="w-5 h-5 animate-spin text-white" />
                      ) : currentPhoto ? (
                        <img src={currentPhoto} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        (profileData.franchiseName || profileData.fullName || 'F')[0]
                      )}
                    </div>
                    {/* Quick Camera Overlay button on Avatar */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-slate-900/60 rounded-2xl flex flex-col items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer text-white text-[9px] font-bold"
                      title="Change Profile Photo"
                    >
                      <Camera className="w-4 h-4 text-white" />
                      <span>Edit</span>
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-sm font-black text-slate-900 truncate">
                        {profileData.franchiseName || profileData.fullName || 'Franchisee Partner'}
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700 shrink-0">
                        {profileData.status || 'Active'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate font-medium">
                      {profileData.fullName ? `Head: ${profileData.fullName}` : 'Franchisee Account'}
                    </p>
                    <span className="text-[11px] font-mono font-bold text-rose-600">
                      ID: {profileData.id || profileData.franchiseCode || 'SLE-FR-101'}
                    </span>
                  </div>
                </div>

                {/* Details List */}
                <div className="px-4 py-2.5 space-y-2 text-xs text-slate-600">
                  {profileData.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span className="truncate">{profileData.location}</span>
                    </div>
                  )}
                  {profileData.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="truncate">{profileData.email}</span>
                    </div>
                  )}
                  {(profileData.phone || profileData.contactNumber) && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>{profileData.phone || profileData.contactNumber}</span>
                    </div>
                  )}
                  <div className="pt-1 flex items-center justify-between border-t border-slate-100 text-[11px]">
                    <span className="text-slate-400 font-semibold">Current Plan:</span>
                    <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                      {profileData.planName || 'Standard Franchisee Plan'}
                    </span>
                  </div>
                </div>

                {/* Franchisee Certificate Section */}
                <div className="mx-3 my-2 p-2.5 rounded-xl border bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-indigo-500/10 border-amber-200/80">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="text-[11px] font-black uppercase tracking-wider text-amber-900">
                        Franchisee Certificate
                      </span>
                    </div>
                    {profileData.franchiseCertificateUrl ? (
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                        Issued
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                        Pending
                      </span>
                    )}
                  </div>

                  {profileData.franchiseCertificateUrl ? (
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          setViewingFranchiseCert(true);
                        }}
                        className="flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadCertificate}
                        className="flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                      >
                        <Download className="w-3 h-3 text-amber-600" />
                        <span>Download</span>
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Certificate will be issued by Head Office Admin once verification is complete.
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-2 px-3 border-t border-slate-100 space-y-1">
                  {/* Payment & Fee Transactions */}
                  <Link
                    to="/transactions"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
                  >
                    <IndianRupee className="w-3.5 h-3.5 text-rose-600" />
                    <span>Payment Transactions</span>
                  </Link>

                  {/* Edit Profile Picture Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-rose-600" />
                    <span>Edit Profile Picture</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      handleAuthAction();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Image Cropper Modal for Profile Picture */}
      {cropperOpen && cropperSrc && (
        <ImageCropperModal
          imageSrc={cropperSrc}
          title="Crop & Set Profile Picture"
          targetType="profile"
          onCropComplete={handleCropComplete}
          onCancel={() => setCropperOpen(false)}
          onRetake={() => {
            setCropperOpen(false);
            fileInputRef.current?.click();
          }}
        />
      )}

      {/* Main Clean Light Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">

          {/* Left Side: Mobile Menu Trigger (Visible ONLY on mobile screens < lg) */}
          <button
            type="button"
            onClick={toggleMobileMenu}
            className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-sm transition cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-rose-600" /> : <Menu className="w-5 h-5 text-slate-800" />}
          </button>

          {/* Desktop Nav Items */}
          <nav className="hidden lg:flex items-center gap-1">

              {/* Admission Form Dropdown Menu (Strictly On Click) */}
              <div
                ref={appDropdownRef}
                className="relative"
              >
                <button
                  type="button"
                  onClick={toggleAppDropdown}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${appDropdownOpen || ['/', '/application-form', '/coaching/admission-form'].includes(location.pathname)
                    ? 'bg-rose-50 text-rose-700 border border-rose-200/80 shadow-sm'
                    : 'text-slate-700 hover:text-rose-600 hover:bg-slate-100/70 border border-transparent'
                    }`}
                >
                  <FileEdit className="w-4 h-4 text-rose-600" />
                  <span>Admission Form</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${appDropdownOpen ? 'rotate-180 text-rose-600' : 'text-slate-400'}`} />
                </button>

                {/* Admission Form Dropdown Popup Card */}
                {appDropdownOpen && (
                  <div className="absolute left-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <Link
                      to="/application-form"
                      onClick={() => setAppDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 hover:text-rose-600 hover:bg-rose-50/70 transition-colors border-b border-slate-100"
                    >
                      <FileEdit className="w-4 h-4 text-rose-500" />
                      <span>Admission Form</span>
                    </Link>
                    <Link
                      to="/list"
                      onClick={() => setAppDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 hover:text-rose-600 hover:bg-rose-50/70 transition-colors"
                    >
                      <Users className="w-4 h-4 text-rose-500" />
                      <span>List</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* Forms Dropdown Menu (Strictly On Click) */}
              <div
                ref={formsDropdownRef}
                className="relative"
              >
                <button
                  type="button"
                  onClick={toggleFormsDropdown}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${formsDropdownOpen || isFormsActive
                    ? 'bg-rose-50 text-rose-700 border border-rose-200/80 shadow-sm'
                    : 'text-slate-700 hover:text-rose-600 hover:bg-slate-100/70 border border-transparent'
                    }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Forms</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${formsDropdownOpen ? 'rotate-180 text-rose-600' : 'text-slate-400'}`} />
                </button>

                {/* Forms Dropdown Card */}
                {formsDropdownOpen && (
                  <div className="absolute left-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">

                    {/* Certificate Form hidden from menu
                    <Link
                      to="/forms/certificate"
                      onClick={() => setFormsDropdownOpen(false)}
                      className="block px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 hover:text-rose-600 hover:bg-rose-50/70 transition-colors border-b border-slate-100"
                    >
                      Certificate Form
                    </Link>
                    */}
                    <Link
                      to="/forms/marksheet"
                      onClick={() => setFormsDropdownOpen(false)}
                      className="block px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 hover:text-rose-600 hover:bg-rose-50/70 transition-colors"
                    >
                      Marksheet Form
                    </Link>
                  </div>
                )}
              </div>

              {/* Download Dropdown Menu (Strictly On Click) */}
              <div
                ref={downloadDropdownRef}
                className="relative"
              >
                <button
                  type="button"
                  onClick={toggleDownloadDropdown}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${downloadDropdownOpen || isDownloadActive
                    ? 'bg-rose-50 text-rose-700 border border-rose-200/80 shadow-sm'
                    : 'text-slate-700 hover:text-rose-600 hover:bg-slate-100/70 border border-transparent'
                    }`}
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${downloadDropdownOpen ? 'rotate-180 text-rose-600' : 'text-slate-400'}`} />
                </button>

                {/* Download Dropdown Card */}
                {downloadDropdownOpen && (
                  <div className="absolute left-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <Link
                      to="/downloads/hall-ticket"
                      onClick={() => setDownloadDropdownOpen(false)}
                      className="block px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 hover:text-rose-600 hover:bg-rose-50/70 transition-colors border-b border-slate-100"
                    >
                      Hall Ticket
                    </Link>
                    <Link
                      to="/downloads/certificate"
                      onClick={() => setDownloadDropdownOpen(false)}
                      className="block px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 hover:text-rose-600 hover:bg-rose-50/70 transition-colors border-b border-slate-100"
                    >
                      Certificate
                    </Link>
                    <Link
                      to="/downloads/marksheet"
                      onClick={() => setDownloadDropdownOpen(false)}
                      className="block px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 hover:text-rose-600 hover:bg-rose-50/70 transition-colors"
                    >
                      Marksheet
                    </Link>
                  </div>
                )}
              </div>

              {/* List Dropdown Menu (Strictly On Click) */}
              <div
                ref={listDropdownRef}
                className="relative"
              >
                <button
                  type="button"
                  onClick={toggleListDropdown}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${listDropdownOpen || isListActive
                    ? 'bg-rose-50 text-rose-700 border border-rose-200/80 shadow-sm'
                    : 'text-slate-700 hover:text-rose-600 hover:bg-slate-100/70 border border-transparent'
                    }`}
                >
                  <Users className="w-4 h-4" />
                  <span>List</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${listDropdownOpen ? 'rotate-180 text-rose-600' : 'text-slate-400'}`} />
                </button>

                {/* List Dropdown Card */}
                {listDropdownOpen && (
                  <div className="absolute left-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <Link
                      to="/list/students"
                      onClick={() => setListDropdownOpen(false)}
                      className="block px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 hover:text-rose-600 hover:bg-rose-50/70 transition-colors border-b border-slate-100"
                    >
                      Students
                    </Link>
                    <Link
                      to="/list/approved"
                      onClick={() => setListDropdownOpen(false)}
                      className="block px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 hover:text-rose-600 hover:bg-rose-50/70 transition-colors border-b border-slate-100"
                    >
                      Approved Students
                    </Link>
                    <Link
                      to="/list/passed"
                      onClick={() => setListDropdownOpen(false)}
                      className="block px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 hover:text-rose-600 hover:bg-rose-50/70 transition-colors"
                    >
                      Passed Students
                    </Link>
                  </div>
                )}
              </div>


              {/* Transactions Menu Link */}
              <NavLink
                to="/transactions"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${isActive || location.pathname === '/payment-history'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200/80 shadow-sm'
                    : 'text-slate-700 hover:text-rose-600 hover:bg-slate-100/70 border border-transparent'
                  }`
                }
              >
                <IndianRupee className="w-4 h-4 text-rose-600" />
                <span>Transactions</span>
              </NavLink>

              {/* ✨ Certificate Menu — Golden Badge Dropdown (Strictly On Click) */}
              <div
                ref={certDropdownRef}
                className="relative"
              >
                <button
                  type="button"
                  onClick={toggleCertDropdown}
                  className={`paid-cert-glowing-btn relative overflow-hidden flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer border select-none ${certDropdownOpen || isCertActive
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white border-amber-500 shadow-md'
                    : 'bg-gradient-to-r from-amber-50 via-yellow-100/60 to-amber-100/90 text-amber-900 border-amber-300 hover:from-amber-100 hover:to-amber-200 hover:border-amber-400'
                  }`}
                >
                  <Award className="w-4 h-4 relative z-10" />
                  <span className="font-bold relative z-10">Paid Certificate</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 relative z-10 ${certDropdownOpen ? 'rotate-180' : ''}`} />
                  {/* Golden Badge Dot */}
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 border-2 border-white shadow-sm animate-pulse z-20" />
                </button>

                {/* Certificate Dropdown Popup */}
                {certDropdownOpen && (
                  <div className="absolute left-0 mt-1 w-52 bg-white rounded-xl shadow-2xl border border-amber-100 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <Link
                      to="/certificate/admission-form"
                      onClick={() => setCertDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 hover:text-amber-700 hover:bg-amber-50/70 transition-colors border-b border-slate-50"
                    >
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>Admission Form</span>
                    </Link>
                    <Link
                      to="/certificate"
                      onClick={() => setCertDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 hover:text-amber-700 hover:bg-amber-50/70 transition-colors border-b border-slate-50"
                    >
                      <Award className="w-4 h-4 text-amber-500" />
                      <span>Certificate</span>
                    </Link>
                    <Link
                      to="/certificate/student-list"
                      onClick={() => setCertDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 hover:text-amber-700 hover:bg-amber-50/70 transition-colors"
                    >
                      <Users className="w-4 h-4 text-amber-500" />
                      <span>Student List</span>
                    </Link>
                  </div>
                )}
              </div>

            </nav>


          {/* Right Portal Auth & Admin Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">


            {!isLoggedIn && !studentSession && (
              <button
                onClick={handleAuthAction}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 shadow-sm cursor-pointer"
                title="Login to Portal"
              >
                <LogIn className="w-3.5 h-3.5 text-emerald-600" />
                <span>Portal Login</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-4 space-y-2 shadow-xl animate-in slide-in-from-top duration-200">
          {/* Mobile Logged-in Franchisee Profile & Certificate Banner */}
          {isLoggedIn && (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 to-slate-900 text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                  {currentPhoto ? (
                    <img src={currentPhoto} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    (profileData.franchiseName || profileData.fullName || 'F')[0]
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 truncate">
                      {profileData.franchiseName || profileData.fullName || 'Franchisee Partner'}
                    </h4>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      {profileData.status || 'Active'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 truncate">
                    ID: {profileData.id || profileData.franchiseCode || 'SLE-FR-101'}
                  </p>
                </div>
              </div>

              {/* Franchisee Certificate Widget in Mobile Menu */}
              <div className="p-2.5 rounded-xl border bg-amber-50/60 border-amber-200">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="text-[11px] font-black uppercase text-amber-900">Certificate</span>
                  </div>
                  {profileData.franchiseCertificateUrl ? (
                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      Issued
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600">
                      Pending
                    </span>
                  )}
                </div>

                {profileData.franchiseCertificateUrl ? (
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setViewingFranchiseCert(true);
                      }}
                      className="flex-1 py-1 px-2 rounded-lg text-[10px] font-bold bg-amber-600 text-white flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadCertificate}
                      className="flex-1 py-1 px-2 rounded-lg text-[10px] font-bold bg-white text-slate-800 border border-slate-300 flex items-center justify-center gap-1"
                    >
                      <Download className="w-3 h-3 text-amber-600" />
                      <span>Download</span>
                    </button>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-500">
                    Certificate will be issued by Head Office Admin.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Mobile Admission Form Collapsible */}
          <div>
            <button
              onClick={toggleMobileAppDropdown}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              <div className="flex items-center gap-3">
                <FileEdit className="w-4 h-4 text-rose-600" />
                <span>Admission Form</span>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${mobileAppOpen ? 'rotate-180' : ''}`} />
            </button>
            {mobileAppOpen && (
              <div className="pl-8 pr-2 py-1 space-y-1 bg-slate-50 rounded-xl my-1 border border-slate-200/60">
                <Link
                  to="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-xs font-medium text-slate-700 hover:text-rose-600"
                >
                  Admission Form
                </Link>
                <Link
                  to="/list"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-xs font-medium text-slate-700 hover:text-rose-600"
                >
                  List
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Forms Collapsible */}
          <div>
            <button
              onClick={toggleMobileFormsDropdown}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-rose-600" />
                <span>Forms</span>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${mobileFormsOpen ? 'rotate-180' : ''}`} />
            </button>
            {mobileFormsOpen && (
              <div className="pl-8 pr-2 py-1 space-y-1 bg-slate-50 rounded-xl my-1 border border-slate-200/60">

                {/* Certificate Form hidden from menu
                <Link
                  to="/forms/certificate"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-xs font-medium text-slate-700 hover:text-rose-600"
                >
                  Certificate Form
                </Link>
                */}
                <Link
                  to="/forms/marksheet"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-xs font-medium text-slate-700 hover:text-rose-600"
                >
                  Marksheet Form
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Download Collapsible */}
          <div>
            <button
              onClick={toggleMobileDownloadDropdown}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              <div className="flex items-center gap-3">
                <Download className="w-4 h-4 text-rose-600" />
                <span>Download</span>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${mobileDownloadOpen ? 'rotate-180' : ''}`} />
            </button>
            {mobileDownloadOpen && (
              <div className="pl-8 pr-2 py-1 space-y-1 bg-slate-50 rounded-xl my-1 border border-slate-200/60">
                <Link
                  to="/downloads/hall-ticket"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-xs font-medium text-slate-700 hover:text-rose-600"
                >
                  Hall Ticket
                </Link>
                <Link
                  to="/downloads/certificate"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-xs font-medium text-slate-700 hover:text-rose-600"
                >
                  Certificate
                </Link>
                <Link
                  to="/downloads/marksheet"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-xs font-medium text-slate-700 hover:text-rose-600"
                >
                  Marksheet
                </Link>
              </div>
            )}
          </div>

          {/* Mobile List Collapsible */}
          <div>
            <button
              onClick={toggleMobileListDropdown}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-rose-600" />
                <span>List</span>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${mobileListOpen ? 'rotate-180' : ''}`} />
            </button>
            {mobileListOpen && (
              <div className="pl-8 pr-2 py-1 space-y-1 bg-slate-50 rounded-xl my-1 border border-slate-200/60">
                <Link
                  to="/list/students"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-xs font-medium text-slate-700 hover:text-rose-600"
                >
                  Students
                </Link>
                <Link
                  to="/list/approved"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-xs font-medium text-slate-700 hover:text-rose-600"
                >
                  Approved Students
                </Link>
                <Link
                  to="/list/passed"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-xs font-medium text-slate-700 hover:text-rose-600"
                >
                  Passed Students
                </Link>

              </div>
            )}
          </div>


          {/* Mobile Transactions Menu Link */}
          <Link
            to="/transactions"
            onClick={() => setMobileMenuOpen(false)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            <IndianRupee className="w-4 h-4 text-rose-600" />
            <span>Transactions</span>
          </Link>

          {/* Mobile Certificate Collapsible — Golden Badge */}
          <div>
            <button
              onClick={toggleMobileCertDropdown}
              className="paid-cert-glowing-btn overflow-hidden w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 text-amber-700 hover:from-amber-100 hover:to-yellow-100 relative select-none"
            >
              <div className="flex items-center gap-3 relative z-10">
                <Award className="w-4 h-4 text-amber-600" />
                <span>Paid Certificate</span>
              </div>
              <div className="flex items-center gap-1.5 relative z-10">
                <span className="w-2 h-2 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 animate-pulse" />
                <ChevronDown className={`w-4 h-4 transition-transform ${mobileCertOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>
            {mobileCertOpen && (
              <div className="pl-8 pr-2 py-1 space-y-1 bg-amber-50/60 rounded-xl my-1 border border-amber-200/60">
                <Link to="/certificate/admission-form" onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-amber-800 hover:text-amber-600">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Admission Form</span>
                </Link>
                <Link to="/certificate" onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-amber-800 hover:text-amber-600">
                  <Award className="w-3.5 h-3.5" />
                  <span>Certificate</span>
                </Link>
                <Link to="/certificate/student-list" onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-amber-800 hover:text-amber-600">
                  <Users className="w-3.5 h-3.5" />
                  <span>Student List</span>
                </Link>
              </div>
            )}
          </div>

          {isLoggedIn && (
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                handleAuthAction();
              }}
              className="w-full flex items-center justify-center gap-2 mt-4 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          )}

        </div>
      )}

      {/* FRANCHISEE CERTIFICATE LIGHTBOX MODAL */}
      {viewingFranchiseCert && profileData?.franchiseCertificateUrl && typeof document !== 'undefined' && createPortal((() => {
        const certUrl = profileData.franchiseCertificateUrl;
        const isPdf = 
          profileData.franchiseCertificateType === 'pdf' ||
          certUrl.startsWith('data:application/pdf') ||
          certUrl.toLowerCase().includes('.pdf');
        const pdfViewerUrl = isPdf 
          ? (certUrl.includes('#') ? certUrl : `${certUrl}#view=${pdfFitMode}&toolbar=1`)
          : certUrl;

        return (
          <div 
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md overflow-hidden animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setViewingFranchiseCert(false);
              }
            }}
          >
            <div 
              className={`w-full ${certFullscreen ? 'h-[98vh] max-w-[98vw] rounded-2xl' : 'h-[92vh] max-h-[92vh] max-w-5xl xl:max-w-6xl rounded-2xl sm:rounded-3xl'} flex flex-col bg-white border border-slate-200 shadow-2xl overflow-hidden transition-all duration-200 my-auto`}
              onClick={(e) => e.stopPropagation()}
            >
              
              {/* Modal Header */}
              <div className="flex items-center justify-between px-4 py-3 sm:px-5 border-b border-slate-200 bg-gradient-to-r from-amber-50 via-rose-50/40 to-white shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
                    <Award className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">
                      Franchisee Authorization Certificate
                    </h3>
                    <p className="text-[11px] text-slate-500 truncate">
                      Issued to {profileData.franchiseName || profileData.fullName || 'Franchisee'} • Partner ID: <strong className="font-mono text-amber-700">{profileData.id || profileData.franchiseCode || 'SLE-FR'}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Toggle Fit Mode for PDF */}
                  {isPdf && (
                    <button
                      type="button"
                      onClick={() => setPdfFitMode(prev => prev === 'Fit' ? 'FitH' : 'Fit')}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-amber-800 hover:bg-amber-100/60 border border-slate-200 transition flex items-center gap-1 cursor-pointer"
                      title={pdfFitMode === 'Fit' ? 'Switch to Fit Width (Enlarge)' : 'Switch to Fit Entire Page'}
                    >
                      <span>{pdfFitMode === 'Fit' ? '🔍 Fit Width' : '📄 Fit Page'}</span>
                    </button>
                  )}

                  {/* Fullscreen Toggle */}
                  <button
                    type="button"
                    onClick={() => setCertFullscreen(!certFullscreen)}
                    className="p-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                    title={certFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
                  >
                    {certFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>

                  {/* Download Certificate */}
                  <button
                    type="button"
                    onClick={handleDownloadCertificate}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                    title="Download Certificate File"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Download</span>
                  </button>

                  {/* Open in New Tab */}
                  <button
                    type="button"
                    onClick={handleOpenCertInNewTab}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-amber-700 hover:bg-amber-50 border border-slate-200 transition flex items-center gap-1.5 cursor-pointer"
                    title="Open certificate in browser new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">New Tab</span>
                  </button>

                  {/* Close Button */}
                  <button
                    type="button"
                    onClick={() => setViewingFranchiseCert(false)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer ml-1"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body Viewer - Flexbox strictly constrained */}
              <div className="flex-1 min-h-0 w-full relative bg-slate-900/5 overflow-hidden flex items-center justify-center p-2 sm:p-4">
                {isPdf ? (
                  <iframe
                    key={pdfViewerUrl}
                    src={pdfViewerUrl}
                    title="Franchisee Certificate"
                    className="w-full h-full border-0 bg-white rounded-xl shadow-xs"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-2 sm:p-4 overflow-auto">
                    <img
                      src={certUrl}
                      alt="Franchisee Certificate"
                      className="max-w-full max-h-full w-auto h-auto object-contain rounded-xl shadow-lg border border-slate-200 bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-4 py-2.5 sm:py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
                <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Official Franchisee Authorization Certificate
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenCertInNewTab}
                    className="hidden sm:inline-flex px-3 py-1 rounded-lg text-xs font-bold text-amber-700 hover:bg-amber-100/60 transition cursor-pointer"
                  >
                    Open Full Size
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingFranchiseCert(false)}
                    className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 transition cursor-pointer shadow-xs"
                  >
                    Close Preview
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })(), document.body)}
    </header>
  );
}
