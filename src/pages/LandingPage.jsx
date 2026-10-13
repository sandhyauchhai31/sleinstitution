import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  GraduationCap, 
  Award, 
  Users, 
  CheckCircle2, 
  Phone, 
  Mail, 
  MapPin, 
  Sparkles, 
  ArrowRight, 
  Send, 
  Clock, 
  ShieldCheck, 
  ChevronRight, 
  LogIn, 
  FileText,
  Star,
  ExternalLink,
  Laptop,
  Code,
  Layers,
  Check,
  RefreshCw,
  Menu,
  X,
  Building2
} from 'lucide-react';
import { db, collection, addDoc, getDocs } from '../firebase';
import { getStoredCourses } from '../utils/courseManager';
import { getStoredDirectors, subscribeToDirectors } from '../utils/directorManager';
import PublicNavbar from '../components/PublicNavbar';

const COURSE_FULL_NAMES = {
  'DCTTC': 'DCTTC — Diploma in Computer Teacher Training Course',
  'PGDCA': 'PGDCA — Post Graduate Diploma in Computer Applications',
  'PGDFA': 'PGDFA — Post Graduate Diploma in Financial Accounting',
  'DOA': 'DOA — Diploma in Office Automation',
  'DAP': 'DAP — Diploma in Accounting & Taxation',
  'BCC': 'BCC — Basic Computer Course',
  'PGDIT': 'PGDIT — Post Graduate Diploma in Information Technology',
  'ADIT': 'ADIT — Advanced Diploma in Information Technology',
  'ADFA': 'ADFA — Advanced Diploma in Financial Accounting',
  'ADCA PRO': 'ADCA PRO — Advanced Diploma in Computer Applications',
  'ADCA 2.0': 'ADCA 2.0 — Advanced Diploma in Computer Applications',
  'DTP': 'DTP — Diploma in Desktop Publishing',
  'DCA': 'DCA — Diploma in Computer Applications',
  'ERPQ': 'ERPQ — Enterprise Resource Planning',
  'SAP FICO': 'SAP FICO — Financial Accounting & Controlling',
  'C': 'C — C Programming Language',
  'C++': 'C++ — C++ Programming Language',
  'C, C++': 'C, C++ Programming Languages',
  'C, C++ Programming': 'C, C++ Programming Languages',
  'DISM': 'DISM — Diploma in Information Systems Management',
  'Tally': 'Tally — Tally Financial Accounting',
  'Tally ERP9': 'Tally ERP9 — Tally ERP 9 Accounting',
  'TALLY PRIME with GST': 'TALLY PRIME with GST Professional',
  'GST': 'GST — Goods & Services Tax Accounting',
  'DCAAC': 'DCAAC — Diploma in Computer Applications & Accounting'
};

export default function LandingPage() {
  const navigate = useNavigate();

  // Inquiry Form State
  const [inquiryForm, setInquiryForm] = useState({
    name: '',
    phone: '',
    email: '',
    course: 'DCA — Diploma in Computer Applications',
    city: '',
    message: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Dynamic Courses list synced with Institution Course Manager
  const [storedCourses, setStoredCourses] = useState(() => getStoredCourses());

  // Dynamic Directors list synced with Institution Director Manager
  const [directors, setDirectors] = useState(() => getStoredDirectors());

  useEffect(() => {
    const unsub = subscribeToDirectors((loadedDirectors) => {
      if (Array.isArray(loadedDirectors) && loadedDirectors.length > 0) {
        setDirectors(loadedDirectors);
      }
    });
    return () => unsub && unsub();
  }, []);

  useEffect(() => {
    const handleCoursesUpdate = () => {
      setStoredCourses(getStoredCourses());
    };
    window.addEventListener('sle_courses_updated', handleCoursesUpdate);
    return () => window.removeEventListener('sle_courses_updated', handleCoursesUpdate);
  }, []);

  // Smooth scroll to hash anchor on page load or navigation from other routes
  useEffect(() => {
    const scrollToHash = () => {
      if (window.location.hash) {
        const id = window.location.hash.replace('#', '');
        const el = document.getElementById(id);
        if (el) {
          setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100);
        } else {
          const timer = setTimeout(() => {
            const retryEl = document.getElementById(id);
            if (retryEl) retryEl.scrollIntoView({ behavior: 'smooth' });
          }, 300);
          return () => clearTimeout(timer);
        }
      }
    };

    scrollToHash();
    window.addEventListener('hashchange', scrollToHash);
    return () => window.removeEventListener('hashchange', scrollToHash);
  }, []);

  // Hero Background Carousel Images & Auto-Play State
  const heroCarouselImages = [
    'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=1600',
    'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=1600',
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=1600'
  ];
  const [currentHeroSlide, setCurrentHeroSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHeroSlide((prev) => (prev + 1) % heroCarouselImages.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [heroCarouselImages.length]);

  // Comprehensive Card Metadata for all institute courses
  const COURSE_CARD_METADATA = {
    'DCTTC': {
      title: 'DCTTC — Diploma in Computer Teacher Training Course',
      badge: 'Teacher Special',
      category: 'Diploma',
      duration: '1 Year',
      description: 'Computer teaching methodology, pedagogy, advanced office tools, operating systems, school lab management & presentation skills.',
      icon: GraduationCap,
      color: 'from-rose-600 to-rose-800',
      image: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=600'
    },
    'PGDCA': {
      title: 'PGDCA — Post Graduate Diploma in Computer Applications',
      badge: 'Advanced',
      category: 'PG Diploma',
      duration: '1 Year',
      description: 'Advanced IT concepts, Database Management Systems (SQL), C/C++ Programming, Web Fundamentals & Office Automation.',
      icon: Code,
      color: 'from-purple-600 to-indigo-800',
      image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=600'
    },
    'PGDFA': {
      title: 'PGDFA — Post Graduate Diploma in Financial Accounting',
      badge: 'Finance PG',
      category: 'PG Diploma',
      duration: '1 Year',
      description: 'Advanced corporate financial accounting, taxation (GST & IT), Tally Prime, e-filing, financial modeling & auditing principles.',
      icon: Award,
      color: 'from-emerald-600 to-teal-800',
      image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=600'
    },
    'ADCA PRO': {
      title: 'ADCA PRO — Advanced Diploma in Computer Applications',
      badge: 'Job Ready',
      category: 'Advanced Diploma',
      duration: '1 Year',
      description: 'Complete IT & Office Suite, Financial Accounting with Tally Prime, Graphic DTP Basics, Web Design & Hardware Fundamentals.',
      icon: Laptop,
      color: 'from-blue-600 to-indigo-800',
      image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=80&w=600'
    },
    'ADCA 2.0': {
      title: 'ADCA 2.0 — Advanced Diploma in Computer Applications',
      badge: 'Job Ready',
      category: 'Advanced Diploma',
      duration: '1 Year',
      description: 'Complete IT & Office Suite, Financial Accounting with Tally Prime, Graphic DTP Basics, Web Design & Hardware Fundamentals.',
      icon: Laptop,
      color: 'from-blue-600 to-indigo-800',
      image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=80&w=600'
    },
    'DCA': {
      title: 'DCA — Diploma in Computer Applications',
      badge: 'Most Popular',
      category: 'Diploma',
      duration: '6 Months',
      description: 'Comprehensive computer fundamentals, MS Office 2021, Internet Applications, Windows OS & Basic Graphic Tools.',
      icon: Laptop,
      color: 'from-rose-600 to-red-700',
      image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=600'
    },
    'TALLY PRIME with GST': {
      title: 'TALLY PRIME with GST Professional',
      badge: 'Accounting',
      category: 'Accounting',
      duration: '3 Months',
      description: 'Complete Financial Accounting, GST E-Filing, Inventory Management, Payroll, TDS & E-Way Bill generation.',
      icon: FileText,
      color: 'from-emerald-600 to-teal-800',
      image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=600'
    },
    'Tally': {
      title: 'Tally — Tally Financial Accounting',
      badge: 'Accounting',
      category: 'Accounting',
      duration: '3 Months',
      description: 'Core financial accounting principles, voucher entry, ledger management, balance sheets & inventory tracking.',
      icon: FileText,
      color: 'from-emerald-600 to-teal-700',
      image: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&q=80&w=600'
    },
    'Tally ERP9': {
      title: 'Tally ERP9 — Tally ERP 9 Accounting',
      badge: 'Accounting',
      category: 'Accounting',
      duration: '3 Months',
      description: 'Practical hands-on training in Tally ERP 9, taxation setup, sales/purchase registers & financial reporting.',
      icon: FileText,
      color: 'from-emerald-700 to-teal-900',
      image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=600'
    },
    'GST': {
      title: 'GST — Goods & Services Tax Accounting',
      badge: 'Tax Special',
      category: 'Taxation',
      duration: '2 Months',
      description: 'Comprehensive GST registration, GSTR-1 & GSTR-3B return filing, input tax credit (ITC) & compliance.',
      icon: Award,
      color: 'from-teal-600 to-emerald-800',
      image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=600'
    },
    'DTP': {
      title: 'DTP — Diploma in Desktop Publishing',
      badge: 'Creative',
      category: 'Design',
      duration: '3 Months',
      description: 'CorelDraw, Photoshop, PageMaker, Typography, Layout publishing, Logo design, Branding & Print media production.',
      icon: Sparkles,
      color: 'from-pink-600 to-rose-700',
      image: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&q=80&w=600'
    },
    'DOA': {
      title: 'DOA — Diploma in Office Automation',
      badge: 'Professional',
      category: 'Office Tools',
      duration: '6 Months',
      description: 'Master MS Word, Excel, PowerPoint, Access Database, Internet Communication, Email Management & Data Entry operations.',
      icon: Layers,
      color: 'from-amber-600 to-orange-800',
      image: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80&w=600'
    },
    'DAP': {
      title: 'DAP — Diploma in Accounting & Taxation',
      badge: 'Accounting',
      category: 'Accounting',
      duration: '6 Months',
      description: 'Practical computerized accounting, banking processes, payroll computation, corporate GST e-filing & financial analysis.',
      icon: Award,
      color: 'from-amber-600 to-yellow-800',
      image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=600'
    },
    'ADFA': {
      title: 'ADFA — Advanced Diploma in Financial Accounting',
      badge: 'Financial',
      category: 'Accounting',
      duration: '6 Months',
      description: 'Advanced corporate accounting concepts, Tally ERP/Prime, Taxation, Banking operations & Financial auditing.',
      icon: Award,
      color: 'from-teal-600 to-cyan-800',
      image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=600'
    },
    'BCC': {
      title: 'BCC — Basic Computer Course',
      badge: 'Beginner',
      category: 'Certificate',
      duration: '2 Months',
      description: 'Foundational computer literacy, typing skills, basic operating system operations, web browsing & email communications.',
      icon: Laptop,
      color: 'from-sky-600 to-blue-700',
      image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=600'
    },
    'PGDIT': {
      title: 'PGDIT — Post Graduate Diploma in Information Technology',
      badge: 'IT Master',
      category: 'PG Diploma',
      duration: '1 Year',
      description: 'Advanced software development, database architecture, cloud computing fundamentals, system administration & IT security.',
      icon: Code,
      color: 'from-purple-700 to-indigo-900',
      image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=600'
    },
    'ADIT': {
      title: 'ADIT — Advanced Diploma in Information Technology',
      badge: 'IT Special',
      category: 'Advanced Diploma',
      duration: '1 Year',
      description: 'Full stack web development basics, database systems, networking fundamentals, object-oriented coding & IT troubleshooting.',
      icon: Code,
      color: 'from-blue-700 to-cyan-900',
      image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=80&w=600'
    },
    'SAP FICO': {
      title: 'SAP FICO — Financial Accounting & Controlling',
      badge: 'Enterprise',
      category: 'ERP Special',
      duration: '3 Months',
      description: 'SAP ERP Financial Accounting (FI) and Controlling (CO) module configuration, general ledger, accounts payable & financial reporting.',
      icon: Layers,
      color: 'from-indigo-600 to-purple-800',
      image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=600'
    },
    'ERPQ': {
      title: 'ERPQ — Enterprise Resource Planning',
      badge: 'ERP Special',
      category: 'ERP Special',
      duration: '3 Months',
      description: 'Enterprise resource planning concepts, supply chain fundamentals, inventory control & business automation systems.',
      icon: Layers,
      color: 'from-indigo-700 to-violet-900',
      image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=600'
    },
    'C': {
      title: 'C — C Programming Language',
      badge: 'Coding Core',
      category: 'Programming',
      duration: '2 Months',
      description: 'Procedural programming logic, memory pointers, structures, file handling, algorithms & problem solving.',
      icon: Code,
      color: 'from-cyan-600 to-blue-800',
      image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&q=80&w=600'
    },
    'C++': {
      title: 'C++ — C++ Programming Language',
      badge: 'Coding Core',
      category: 'Programming',
      duration: '2 Months',
      description: 'Object-Oriented Programming (OOP) concepts, classes, inheritance, polymorphism, templates & Standard Template Library (STL).',
      icon: Code,
      color: 'from-cyan-600 to-blue-800',
      image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&q=80&w=600'
    },
    'C, C++': {
      title: 'C, C++ Programming Languages',
      badge: 'Coding Core',
      category: 'Programming',
      duration: '3 Months',
      description: 'Algorithm logic development, Data structures, Object-Oriented Programming (OOP), memory management & system programming.',
      icon: Code,
      color: 'from-cyan-600 to-blue-800',
      image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&q=80&w=600'
    },
    'C, C++ Programming': {
      title: 'C, C++ Programming Languages',
      badge: 'Coding Core',
      category: 'Programming',
      duration: '3 Months',
      description: 'Algorithm logic development, Data structures, Object-Oriented Programming (OOP), memory management & system programming.',
      icon: Code,
      color: 'from-cyan-600 to-blue-800',
      image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&q=80&w=600'
    },
    'DISM': {
      title: 'DISM — Diploma in Information Systems Management',
      badge: 'Systems',
      category: 'Management',
      duration: '6 Months',
      description: 'Information systems design, business analytics basics, IT project management, database management & network operations.',
      icon: Laptop,
      color: 'from-slate-700 to-slate-900',
      image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=80&w=600'
    },
    'DCAAC': {
      title: 'DCAAC — Diploma in Computer Applications & Accounting',
      badge: 'Dual Special',
      category: 'Diploma',
      duration: '6 Months',
      description: 'Combined syllabus of computer applications (MS Office & DTP) alongside practical computerized accounting with Tally.',
      icon: Laptop,
      color: 'from-purple-600 to-rose-700',
      image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=600'
    }
  };

  // Official Course List Data dynamically mapped from stored courses
  const coursesList = useMemo(() => {
    return storedCourses.map((c, index) => {
      const courseName = typeof c === 'string' ? c : (c.name || c.code || '');
      const meta = COURSE_CARD_METADATA[courseName] || {};
      const fallbackTitle = COURSE_FULL_NAMES[courseName] || `${courseName} — ${c.description || courseName}`;

      return {
        id: c.id || `course_${index}_${courseName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        title: c.title || meta.title || fallbackTitle,
        code: courseName,
        duration: c.duration || meta.duration || '3 to 6 Months',
        badge: c.badge || meta.badge || 'Professional',
        category: c.category || meta.category || 'Diploma',
        description: c.description || meta.description || `${courseName} course covering practical skills, industry projects, and government recognized certification.`,
        icon: meta.icon || BookOpen,
        color: meta.color || 'from-rose-600 to-red-700',
        image: c.image || meta.image || 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=600'
      };
    });
  }, [storedCourses]);

  // Inquiry Form Submit Handler
  const handleInquirySubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!inquiryForm.name.trim() || !inquiryForm.phone.trim()) {
      setSubmitError('Please fill in your Name and Mobile Number.');
      return;
    }

    setIsSubmitting(true);

    const inquiryPayload = {
      ...inquiryForm,
      id: `INQ-${Date.now()}`,
      createdAt: new Date().toISOString(),
      dateStr: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      status: 'New'
    };

    // 1. Save to LocalStorage cache
    try {
      const existingInquiries = JSON.parse(localStorage.getItem('sle_inquiries_cache') || '[]');
      existingInquiries.unshift(inquiryPayload);
      localStorage.setItem('sle_inquiries_cache', JSON.stringify(existingInquiries));
    } catch (err) {
      console.warn('LocalStorage inquiry cache notice:', err);
    }

    // 2. Save to Firestore if available
    if (db) {
      try {
        await addDoc(collection(db, 'inquiries'), inquiryPayload);
      } catch (err) {
        console.warn('Firestore inquiry save notice:', err);
      }
    }

    setIsSubmitting(false);
    setSubmitSuccess(true);
    setInquiryForm({
      name: '',
      phone: '',
      email: '',
      course: 'DCA (Diploma in Computer Applications)',
      city: '',
      message: ''
    });

    setTimeout(() => {
      setSubmitSuccess(false);
    }, 5000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-rose-600 selection:text-white relative overflow-hidden">

      {/* ── STICKY GLASSMORPHIC PUBLIC NAVBAR ── */}
      <PublicNavbar />


      {/* ── HERO SECTION (MODERN RICH DARK GRADIENT BACKDROP) ── */}
      <section id="hero" className="relative min-h-[85vh] sm:min-h-[88vh] flex items-center justify-center py-12 sm:py-16 px-3 sm:px-6 lg:px-8 overflow-hidden bg-gradient-to-br from-slate-950 via-rose-950 to-slate-900">
        
        {/* Sleek Modern Background Accent Lighting & Carousel Images */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          {/* Background Carousel Images with High Visibility & Smooth Zoom Animation */}
          {heroCarouselImages.map((img, idx) => (
            <div
              key={idx}
              className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
                idx === currentHeroSlide ? 'opacity-90 scale-105 pointer-events-none' : 'opacity-0 scale-100 pointer-events-none'
              }`}
            >
              <img
                src={img}
                alt={`Hero background slide ${idx + 1}`}
                className="w-full h-full object-cover object-center"
              />
            </div>
          ))}

          {/* Balanced Dark Overlay Gradient for Strong Contrast & Vivid Image Visibility */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/65 via-rose-950/50 to-slate-900/65 pointer-events-none" />

          {/* Glow Accent Lighting */}
          <div className="absolute -top-32 -left-32 w-[32rem] h-[32rem] bg-rose-600/20 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute top-1/2 right-0 w-[36rem] h-[36rem] bg-amber-500/15 rounded-full blur-[140px] pointer-events-none" />
          <div className="absolute -bottom-32 left-1/3 w-[30rem] h-[30rem] bg-indigo-600/20 rounded-full blur-[130px] pointer-events-none" />

          {/* Grid Overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0f_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0f_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
        </div>

        <div className="max-w-6xl mx-auto relative z-10 text-center space-y-6 sm:space-y-8 py-6 sm:py-10 px-1">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-slate-900/75 backdrop-blur-xl px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest text-amber-300 border border-white/25 shadow-xl animate-in fade-in slide-in-from-top-4 duration-500 max-w-full">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate sm:whitespace-normal">Govt. Registered &amp; ISO 21001:2025 Certified</span>
          </div>

          {/* Headline */}
          <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight sm:leading-tight uppercase font-serif drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)] max-w-4xl mx-auto px-1">
            Empowering Careers Through <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-rose-200 to-white">Advanced Digital &amp; IT Education</span>
          </h1>

          {/* Subheading */}
          <p className="text-xs sm:text-base lg:text-lg text-rose-100 font-bold max-w-2xl mx-auto leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] px-2">
            Step into Smart Digital Classrooms with certified job-oriented programs, hands-on visual training, and industry-recognized certifications for real-world career success.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-2 w-full max-w-xs sm:max-w-none mx-auto">
            <a
              href="#courses"
              className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black rounded-full text-xs sm:text-base shadow-2xl shadow-amber-500/30 hover:scale-105 active:scale-95 transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Explore Programs</span>
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </a>
            <a
              href="#inquiry"
              className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-slate-900/70 hover:bg-slate-900/90 text-white font-black rounded-full text-xs sm:text-base border border-white/30 backdrop-blur-xl hover:scale-105 active:scale-95 transition-all inline-flex items-center justify-center gap-2 cursor-pointer shadow-xl"
            >
              <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" />
              <span>Inquire Now</span>
            </a>
          </div>

          {/* Hero Carousel Navigation Indicators */}
          <div className="flex items-center justify-center gap-2.5 pt-2">
            {heroCarouselImages.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentHeroSlide(idx)}
                aria-label={`Go to background slide ${idx + 1}`}
                className={`h-2 sm:h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                  idx === currentHeroSlide
                    ? 'w-6 sm:w-8 bg-amber-400 shadow-md shadow-amber-400/50'
                    : 'w-2 sm:w-2.5 bg-white/40 hover:bg-white/70'
                }`}
              />
            ))}
          </div>

          {/* 3D Floating Stats Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 pt-6 sm:pt-10 max-w-5xl mx-auto">
            
            <div className="bg-slate-900/70 backdrop-blur-xl border border-white/20 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 text-white shadow-2xl hover:-translate-y-2 transition-all duration-300 group">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-400/20 text-amber-300 flex items-center justify-center mx-auto mb-2 sm:mb-3 border border-amber-300/30 group-hover:scale-110 transition-transform">
                <Laptop className="w-4 h-4 sm:w-6 sm:h-6" />
              </div>
              <div className="text-sm sm:text-xl md:text-2xl font-black text-white leading-tight">100% Practical</div>
              <div className="text-[10px] sm:text-xs text-rose-200 font-semibold mt-1 leading-tight">Hands-on Lab Training</div>
            </div>

            <div className="bg-slate-900/70 backdrop-blur-xl border border-white/20 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 text-white shadow-2xl hover:-translate-y-2 transition-all duration-300 group">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-400/20 text-emerald-300 flex items-center justify-center mx-auto mb-2 sm:mb-3 border border-emerald-300/30 group-hover:scale-110 transition-transform">
                <Users className="w-4 h-4 sm:w-6 sm:h-6" />
              </div>
              <div className="text-sm sm:text-xl md:text-2xl font-black text-white leading-tight">10,000+ Alumni</div>
              <div className="text-[10px] sm:text-xs text-rose-200 font-semibold mt-1 leading-tight">Successfully Placed</div>
            </div>

            <div className="bg-slate-900/70 backdrop-blur-xl border border-white/20 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 text-white shadow-2xl hover:-translate-y-2 transition-all duration-300 group">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-purple-400/20 text-purple-300 flex items-center justify-center mx-auto mb-2 sm:mb-3 border border-purple-300/30 group-hover:scale-110 transition-transform">
                <Award className="w-4 h-4 sm:w-6 sm:h-6" />
              </div>
              <div className="text-sm sm:text-xl md:text-2xl font-black text-white leading-tight">Govt. Recognized</div>
              <div className="text-[10px] sm:text-xs text-rose-200 font-semibold mt-1 leading-tight">Valid Nationwide</div>
            </div>

            <div className="bg-slate-900/70 backdrop-blur-xl border border-white/20 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 text-white shadow-2xl hover:-translate-y-2 transition-all duration-300 group">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-sky-400/20 text-sky-300 flex items-center justify-center mx-auto mb-2 sm:mb-3 border border-sky-300/30 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-4 h-4 sm:w-6 sm:h-6" />
              </div>
              <div className="text-sm sm:text-xl md:text-2xl font-black text-white leading-tight">ISO 21001:2025</div>
              <div className="text-[10px] sm:text-xs text-rose-200 font-semibold mt-1 leading-tight">Quality Certified</div>
            </div>

          </div>

        </div>
      </section>


      {/* ── COURSES OFFERED SECTION ── */}
      <section id="courses" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12">
        
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-rose-100 text-rose-800 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider">
            <BookOpen className="w-4 h-4 text-rose-700" />
            <span>Job-Oriented Training Programs</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 font-serif uppercase">
            Featured Career Courses
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm max-w-xl mx-auto font-medium">
            Designed to bridge the skill gap and empower students with high-demand digital skills for modern corporate and government careers.
          </p>
        </div>

        {/* Courses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {coursesList.map((c) => {
            const IconComp = c.icon;
            return (
              <div 
                key={c.id} 
                className="bg-white rounded-3xl overflow-hidden shadow-xl border border-slate-200/90 hover:shadow-2xl hover:border-rose-300 transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  {/* Top Image Banner */}
                  <div className="relative w-full h-44 bg-slate-100 overflow-hidden">
                    <img 
                      src={c.image} 
                      alt={c.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-900/20 to-transparent" />
                    
                    {/* Badge */}
                    <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-md">
                      {c.badge}
                    </span>
                  </div>

                  {/* Card Body */}
                  <div className="p-6 space-y-4">
                    {/* Icon & Title */}
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.color} text-white flex items-center justify-center shadow-md shrink-0`}>
                        <IconComp className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900 group-hover:text-rose-700 transition-colors leading-tight">
                          {c.title}
                        </h3>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      {c.description}
                    </p>
                  </div>
                </div>

                {/* Footer Action Button */}
                <div className="px-6 pb-6 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    ✓ Certificate Included
                  </span>
                  <a
                    href="#inquiry"
                    onClick={() => {
                      setInquiryForm(prev => ({ ...prev, course: c.title }));
                    }}
                    className="gradient-button text-white px-4 py-2 rounded-xl font-extrabold text-xs shadow-md hover:scale-105 active:scale-95 transition inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Inquire Course</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </a>
                </div>

              </div>
            );
          })}
        </div>

      </section>


      {/* ── DIRECTORS SECTION (DYNAMIC FROM DIRECTOR MANAGER) ── */}
      <section id="directors" className="py-20 bg-slate-100/80 border-y border-slate-200 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-12">
          
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 font-sans">
              Directors
            </h2>
          </div>

          {/* Directors Dynamic Cards Grid - Fixed 4/3 Height with Full Uncropped Images */}
          <div className={`grid gap-8 justify-center ${
            directors.length === 1 
              ? 'grid-cols-1 max-w-md mx-auto' 
              : directors.length === 2 
              ? 'grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto' 
              : 'grid-cols-1 md:grid-cols-3'
          }`}>
            {directors.map((dir) => (
              <div 
                key={dir.id || dir.name} 
                className="bg-white rounded-none shadow-sm overflow-hidden flex flex-col items-center text-center transition-all hover:shadow-md"
              >
                <div className="w-full aspect-[4/3] bg-slate-200/60 overflow-hidden flex items-center justify-center">
                  <img 
                    src={dir.image || '/directors/chairman.png'} 
                    alt={dir.name} 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.target.src = dir.fallbackImage || "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400";
                    }}
                  />
                </div>
                <div className="p-6 space-y-1.5 w-full bg-white">
                  <h3 className="text-xl font-extrabold text-slate-900">
                    {dir.name}
                  </h3>
                  <p className="text-xs font-bold text-slate-700">
                    {dir.role}
                  </p>
                  <p className="text-xs text-slate-500 font-medium">
                    {dir.email}
                  </p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>



      {/* ── CONTACTS SECTION (PREMIUM MODERN DESIGN) ── */}
      <section id="contacts" className="py-24 bg-gradient-to-b from-slate-50 via-rose-50/20 to-slate-100 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        
        {/* Subtle Decorative Background Accents */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-rose-200/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto space-y-14 relative z-10">

          {/* Section Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 bg-rose-100 text-rose-800 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border border-rose-200/80 shadow-sm">
              <MapPin className="w-4 h-4 text-rose-600" />
              <span>Get In Touch</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 font-serif uppercase">
              Head Office & Contact Details
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm max-w-xl mx-auto font-medium">
              Reach out to us for admission details, course guidance, verification support, or institutional queries.
            </p>
          </div>

          {/* Contacts Grid: Two Cards Side by Side with maps for both addresses */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">

            {/* 1. Registered Office Card + Map (Vijayapura) */}
            <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 sm:p-7 shadow-xl border border-slate-200/90 hover:shadow-2xl hover:border-indigo-300 transition-all duration-300 flex flex-col justify-between space-y-6 group">
              
              {/* Header & Details */}
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0 group-hover:scale-105 transition-transform duration-300">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100 inline-block">
                      Registered Office
                    </span>
                    
                    <p className="text-xs sm:text-sm text-slate-700 font-semibold mt-1 leading-relaxed">
                      KHB COLONY SOLAPUR ROAD VIJAYAPURA 586101
                    </p>
                  </div>
                </div>

                {/* Contacts Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <Phone className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div className="overflow-hidden">
                        <span className="text-[10px] uppercase font-extrabold text-slate-500 block">Contact Phone</span>
                        <a href="tel:9482354550" className="font-extrabold text-slate-900 hover:text-indigo-600 transition text-[11px]">
                          9482354550
                        </a>
                      </div>
                    </div>
                    <a
                      href="tel:9482354550"
                      className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-extrabold text-[11px] transition shrink-0"
                    >
                      Call
                    </a>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <Mail className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div className="overflow-hidden">
                        <span className="text-[10px] uppercase font-extrabold text-slate-500 block">Official Email</span>
                        <a href="mailto:slesindia.headoffice@gmail.com" className="font-extrabold text-slate-900 hover:text-indigo-600 transition truncate block text-[11px]">
                          slesindia.headoffice@gmail.com
                        </a>
                      </div>
                    </div>
                    <a
                      href="mailto:slesindia.headoffice@gmail.com"
                      className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-extrabold text-[11px] transition shrink-0"
                    >
                      Mail
                    </a>
                  </div>
                </div>
              </div>

              {/* Map Embed for Vijayapura */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">Regd Office Location Map</h4>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">Vijayapura</span>
                </div>

                <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
                  <iframe
                    title="Registered Office Vijayapura Map"
                    src="https://maps.google.com/maps?q=KHB+Colony+Solapur+Road+Vijayapura+Karnataka+586101&t=&z=14&ie=UTF8&iwloc=&output=embed"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen=""
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="w-full h-full"
                  ></iframe>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between gap-3 border border-slate-200/80">
                  <div>
                    <h5 className="text-xs font-extrabold text-slate-900">S L E Institutions — Regd Office</h5>
                    <p className="text-[11px] font-medium text-slate-500">KHB Colony, Solapur Road, Vijayapura 586101</p>
                  </div>
                  <a
                    href="https://www.google.com/maps/search/?api=1&query=KHB+Colony+Solapur+Road+Vijayapura+586101"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-md transition flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Get Directions</span>
                  </a>
                </div>
              </div>

            </div>

            {/* 2. Administrative Office Card + Map (Athani) */}
            <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 sm:p-7 shadow-xl border border-slate-200/90 hover:shadow-2xl hover:border-rose-300 transition-all duration-300 flex flex-col justify-between space-y-6 group">
              
              {/* Header & Details */}
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-600 to-rose-800 text-white flex items-center justify-center shadow-lg shadow-rose-500/20 shrink-0 group-hover:scale-105 transition-transform duration-300">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-100 inline-block">
                      Administrative Office
                    </span>
                    <p className="text-xs sm:text-sm text-slate-700 font-semibold mt-1 leading-relaxed">
                      Opposite Bus Stand Satti Road Athani Belgaum 591304
                    </p>
                  </div>
                </div>

                {/* Contacts Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <Phone className="w-4 h-4 text-rose-600 shrink-0" />
                      <div className="overflow-hidden">
                        <span className="text-[10px] uppercase font-extrabold text-slate-500 block">Contact Phone</span>
                        <div className="flex items-center gap-1 font-extrabold text-slate-900 text-[11px]">
                          <a href="tel:9611351295" className="hover:text-rose-600 transition">9611351295</a>
                          <span>,</span>
                          <a href="tel:9916563591" className="hover:text-rose-600 transition">9916563591</a>
                        </div>
                      </div>
                    </div>
                    <a
                      href="tel:9611351295"
                      className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white font-extrabold text-[11px] transition shrink-0"
                    >
                      Call
                    </a>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <Mail className="w-4 h-4 text-rose-600 shrink-0" />
                      <div className="overflow-hidden">
                        <span className="text-[10px] uppercase font-extrabold text-slate-500 block">Office Email</span>
                        <a href="mailto:slesinstitute100@gmail.com" className="font-extrabold text-slate-900 hover:text-rose-600 transition truncate block text-[11px]">
                          slesinstitute100@gmail.com
                        </a>
                      </div>
                    </div>
                    <a
                      href="mailto:slesinstitute100@gmail.com"
                      className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white font-extrabold text-[11px] transition shrink-0"
                    >
                      Mail
                    </a>
                  </div>
                </div>
              </div>

              {/* Map Embed for Athani */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">Admin Office Location Map</h4>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">Athani</span>
                </div>

                <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
                  <iframe
                    title="Administrative Office Athani Map"
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3832.2282035987!2d75.0594!3d16.7327!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc76d456789%3A0x123456789!2sS%20L%20E%20PROFESSIONAL%20TRAINING%20INSTITUTE!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen=""
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="w-full h-full"
                  ></iframe>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between gap-3 border border-slate-200/80">
                  <div>
                    <h5 className="text-xs font-extrabold text-slate-900">S L E Professional Training Institute</h5>
                    <p className="text-[11px] font-medium text-slate-500">Opp. Bus Stand, Satti Road, Athani Belgaum 591304</p>
                  </div>
                  <a
                    href="https://maps.app.goo.gl/VA4ksszBnVb4qASC8"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-extrabold shadow-md transition flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Get Directions</span>
                  </a>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>


      {/* ── INQUIRY FORM SECTION (LINKED TO ADMIN PANEL) ── */}
      <section id="inquiry" className="py-20 bg-gradient-to-br from-slate-900 via-rose-950 to-slate-950 text-white px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-600/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-4xl mx-auto relative z-10 space-y-10">
          
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md text-amber-300 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border border-white/20">
              <Send className="w-3.5 h-3.5 text-amber-300" />
              <span>Get In Touch</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white font-serif uppercase">
              Send Us An Inquiry
            </h2>
            <p className="text-rose-100 text-xs sm:text-sm max-w-xl mx-auto font-medium">
              Have questions about student admissions, course syllabus, fee structure, or franchisee partnership? Submit your inquiry below.
            </p>
          </div>

          <div className="bg-white/95 text-slate-900 backdrop-blur-md rounded-3xl p-6 sm:p-10 shadow-2xl border border-white/30 space-y-6">
            
            {submitSuccess && (
              <div className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-2xl flex items-center gap-3 animate-in fade-in duration-300">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="text-sm font-extrabold">Inquiry Sent Successfully!</h4>
                  <p className="text-xs text-emerald-800 font-medium">
                    Thank you for reaching out to S.L.E. Institutions. Our admissions team will get in touch with you shortly.
                  </p>
                </div>
              </div>
            )}

            {submitError && (
              <div className="p-4 bg-rose-100 border border-rose-300 text-rose-900 rounded-2xl flex items-center gap-3 text-xs font-bold">
                <span>⚠️ {submitError}</span>
              </div>
            )}

            <form onSubmit={handleInquirySubmit} className="space-y-5">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                
                {/* Student Full Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    Full Name <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={inquiryForm.name}
                    onChange={e => setInquiryForm({ ...inquiryForm, name: e.target.value })}
                    placeholder="Enter your full name"
                    className="w-full px-4 py-3 rounded-2xl border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>

                {/* Mobile Phone Number */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    Mobile Number <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={inquiryForm.phone}
                    onChange={e => setInquiryForm({ ...inquiryForm, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full px-4 py-3 rounded-2xl border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={inquiryForm.email}
                    onChange={e => setInquiryForm({ ...inquiryForm, email: e.target.value })}
                    placeholder="student@example.com"
                    className="w-full px-4 py-3 rounded-2xl border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>

                {/* Course Selection */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    Course Interested
                  </label>
                  <select
                    value={inquiryForm.course}
                    onChange={e => setInquiryForm({ ...inquiryForm, course: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 cursor-pointer"
                  >
                    {storedCourses.map((c, idx) => {
                      const courseName = typeof c === 'string' ? c : (c.name || c.code || '');
                      const fullTitle = COURSE_FULL_NAMES[courseName] || `${courseName} — ${c.description || courseName}`;
                      return (
                        <option key={c.id || idx} value={fullTitle}>
                          {fullTitle}
                        </option>
                      );
                    })}
                    <option value="Franchisee Partnership Inquiry">Franchisee Partnership Inquiry</option>
                    <option value="Other General Query">Other General Query</option>
                  </select>
                </div>

              </div>

              {/* City / Branch */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  City / Preferred Branch
                </label>
                <input
                  type="text"
                  value={inquiryForm.city}
                  onChange={e => setInquiryForm({ ...inquiryForm, city: e.target.value })}
                  placeholder="e.g. Athani, Mysore, Belagavi, etc."
                  className="w-full px-4 py-3 rounded-2xl border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
                />
              </div>

              {/* Message Details */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  Your Message / Query
                </label>
                <textarea
                  rows={4}
                  value={inquiryForm.message}
                  onChange={e => setInquiryForm({ ...inquiryForm, message: e.target.value })}
                  placeholder="Type any specific questions regarding admission, timing, or fees..."
                  className="w-full px-4 py-3 rounded-2xl border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 resize-none"
                ></textarea>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-700 via-rose-800 to-amber-900 hover:from-rose-800 hover:to-slate-900 text-white font-extrabold text-sm shadow-xl shadow-rose-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.99]"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Submitting Inquiry...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 text-amber-300" />
                    <span>Submit Inquiry</span>
                  </>
                )}
              </button>

            </form>

          </div>

        </div>
      </section>


      {/* ── FOOTER ── */}
      <footer className="bg-slate-950 text-slate-400 py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          
          <div className="flex items-center gap-3">
            <img src="/logo-2.png" alt="S.L.E Logo" className="w-10 h-10 object-contain shrink-0" />
            <div>
              <h4 className="text-sm font-black text-white uppercase font-serif">S L E INSTITUTIONS</h4>
              <p className="text-[11px] text-slate-400">Professional &amp; Industrial Training Institute</p>
            </div>
          </div>

          <div className="text-[11px] space-y-1">
            <p>&copy; {new Date().getFullYear()} S.L.E. Institutions. All Rights Reserved.</p>
            <p className="text-slate-400">ISO 21001:2025 Certified &bull; NCVT Aligned Vocational Education</p>
          </div>

          <div>
            <Link
              to="/login"
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-bold transition inline-flex items-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5 text-rose-500" />
              <span>Franchisee Portal</span>
            </Link>
          </div>

        </div>
      </footer>

    </div>
  );
}
