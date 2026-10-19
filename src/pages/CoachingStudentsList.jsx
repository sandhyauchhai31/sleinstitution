import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { filterStudentsForFranchisee, canFranchiseeAccessStudent, normalizeBranch } from '../utils/franchiseeFilter';
import { getShahapurStudentsFull } from '../utils/shahapurStudentsData';
import { getStudentYear, getAvailableYears } from '../utils/studentYearHelper';
import { 
  Users, 
  Search, 
  CheckCircle2, 
  Filter, 
  RefreshCw, 
  Printer, 
  X, 
  User, 
  Phone, 
  MapPin, 
  Calendar, 
  FileText, 
  ArrowUpDown,
  Eye,
  Award,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ZoomIn,
  Download,
  ExternalLink
} from 'lucide-react';
import { db, collection, getDocs } from '../firebase';

export default function CoachingStudentsList() {
  const location = useLocation();
  const path = location.pathname.toLowerCase();

  // State
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [viewDocument, setViewDocument] = useState(null); // Full Document View Modal state ({ title, preview, fileType, fileName })
  const [sortField, setSortField] = useState('registrationNo');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedYear, setSelectedYear] = useState('ALL');

  // Franchisee Environment Isolation State
  const [franchiseesList, setFranchiseesList] = useState([]);
  const [selectedEnvironmentFilter, setSelectedEnvironmentFilter] = useState('ALL');
  const [currentFranchiseeEnv, setCurrentFranchiseeEnv] = useState(() => {
    try {
      const userRole = localStorage.getItem('sle_user_role');
      const portalUser = JSON.parse(localStorage.getItem('sle_portal_user_data') || '{}');
      if (userRole === 'portal' && portalUser) {
        return {
          id: portalUser.environmentId || portalUser.id,
          name: portalUser.environmentName || portalUser.location || portalUser.franchiseName || 'Franchisee Environment',
          branch: portalUser.location || portalUser.franchiseName || 'Athani'
        };
      }
    } catch (e) {}
    return null;
  });

  // Initial Sample / Fallback Dataset
  const defaultSampleStudents = [
    {
      id: 'STUD-2026-001',
      appNumber: 'SLE-2026-9041',
      registrationNo: '1',
      franchiseeId: 'FR-2026-901',
      name: 'Kavita',
      fullName: 'Kavita',
      fatherName: 'Anand',
      motherName: 'Gojabai',
      contactNo: '9766302954',
      mobileNo: '9766302954',
      place: 'Athani',
      trustBranch: 'Athani',
      selectedClass: '9th',
      course: 'Navodaya / State Board Special Batch',
      admissionDate: '2026-08-21',
      createdDate: '2026-08-21',
      address: 'Near Old Bus Stand, Athani, Dist: Belagavi, Karnataka',
      email: 'kavita.anand@example.com',
      paymentStatus: 'Paid',
      status: 'Submitted'
    },
    {
      id: 'STUD-2026-002',
      appNumber: 'SLE-2026-9042',
      registrationNo: '202638001',
      franchiseeId: 'FR-2026-902',
      name: 'Prajwal Kumar M.',
      fullName: 'Prajwal Kumar M.',
      fatherName: 'Manjunatha K.',
      motherName: 'Latha M.',
      contactNo: '9845123456',
      mobileNo: '9845123456',
      place: 'Vijayapur',
      trustBranch: 'Vijayapur',
      selectedClass: '10th',
      course: 'DCTTC (Diploma in Computer Teacher Training)',
      admissionDate: '2026-08-22',
      createdDate: '2026-08-22',
      address: 'Solapur Road, Vijayapur, Karnataka',
      email: 'prajwal.k@gmail.com',
      paymentStatus: 'Paid',
      status: 'Submitted'
    },
    {
      id: 'STUD-2026-003',
      appNumber: 'SLE-2026-9043',
      registrationNo: '202638002',
      franchiseeId: 'FR-2026-903',
      name: 'Ananya Gowda',
      fullName: 'Ananya Gowda',
      fatherName: 'Nagaraju G.',
      motherName: 'Savitha N.',
      contactNo: '9900112233',
      mobileNo: '9900112233',
      place: 'Mandya',
      trustBranch: 'Mandya',
      selectedClass: '9th',
      course: 'PGDCA',
      admissionDate: '2026-08-23',
      createdDate: '2026-08-23',
      address: 'Main Road, Mandya, Karnataka',
      email: 'ananya.gowda@gmail.com',
      paymentStatus: 'Paid',
      status: 'Submitted'
    }
  ];

  // Fetch Students from Local Storage and Firestore
  const fetchStudentsList = async () => {
    setLoading(true);
    let loadedList = [];
    let fList = [];

    // Load registered Franchisee Environments list
    try {
      const cachedFranchisees = JSON.parse(localStorage.getItem('sle_franchisees_cache') || '[]');
      fList = [...cachedFranchisees];

      if (db) {
        const franSnap = await getDocs(collection(db, 'franchisees'));
        franSnap.forEach(docSnap => {
          const d = docSnap.data();
          if (!fList.some(x => x.id === docSnap.id)) {
            fList.push({ id: docSnap.id, ...d });
          }
        });
      }
      setFranchiseesList(fList);
    } catch (e) {}

    // Canonical key helper to unify document IDs across collections
    const getCanonicalKey = (item) => {
      if (!item) return '';
      // 1. Explicit registration / admission / hall ticket number
      const reg = String(item.registrationNo || item.regNo || item.admNo || item.certRegNo || item.admissionNo || '').trim().toLowerCase();
      if (reg) {
        const numMatch = reg.match(/2026[89]?(\d{3,4})$/);
        if (numMatch) return `reg_202638${numMatch[1]}`;
        return `reg_${reg}`;
      }

      // 2. Document ID or Student ID
      const rawId = String(item.id || '').trim().toLowerCase();
      if (/^202638\d+$/.test(rawId)) return `reg_${rawId}`;
      const numMatch = rawId.match(/2026[89]?(\d{3,4})$/);
      if (numMatch) return `reg_202638${numMatch[1]}`;

      // 3. Application number
      const app = String(item.appNumber || '').trim().toLowerCase();
      if (app) {
        const appNumMatch = app.match(/2026[89]?(\d{3,4})$/);
        if (appNumMatch) return `reg_202638${appNumMatch[1]}`;
        return `app_${app}`;
      }

      // 4. Fallback: normalize name + phone
      const name = String(item.name || item.fullName || '').trim().toLowerCase();
      const phone = String(item.contactNo || item.mobileNo || item.phone || '').trim();
      if (name && phone && phone !== 'n/a') return `contact_${name}_${phone}`;

      if (rawId) return `id_${rawId}`;
      return '';
    };

    // 1. Load from LocalStorage Cache first
    try {
      const cacheStudents = JSON.parse(localStorage.getItem('sle_students_cache') || '[]');
      const coachingCache = JSON.parse(localStorage.getItem('sle_coaching_students_cache') || '[]');
      const appsCache = JSON.parse(localStorage.getItem('sle_applications_cache') || '[]');
      
      const mergedMap = new Map();
      [...cacheStudents, ...coachingCache, ...appsCache].forEach(item => {
        if (item.id && String(item.id).startsWith('test_coach_')) return;
        const itemName = String(item.fullName || item.name || '');
        if (/^Student\s+\d+$/i.test(itemName) && !item.course && !item.contactNo && !item.registrationNo) return;
        const key = getCanonicalKey(item);
        if (key) {
          const existing = mergedMap.get(key) || {};
          mergedMap.set(key, { ...existing, ...item });
        }
      });

      loadedList = Array.from(mergedMap.values());
    } catch (e) {
      console.log('LocalStorage student fetch notice:', e);
    }

    // 2. Fetch from Firestore if db is available
    try {
      if (db) {
        const firestoreMap = new Map();
        
        const studSnap = await getDocs(collection(db, 'students'));
        studSnap.forEach(d => {
          const data = d.data();
          const key = getCanonicalKey({ id: d.id, ...data });
          if (key) {
            const existing = firestoreMap.get(key) || {};
            firestoreMap.set(key, { ...existing, id: d.id, ...data });
          }
        });

        const appSnap = await getDocs(collection(db, 'applications'));
        appSnap.forEach(d => {
          const data = d.data();
          const key = getCanonicalKey({ id: d.id, ...data });
          if (key) {
            const existing = firestoreMap.get(key) || {};
            firestoreMap.set(key, { ...existing, id: existing.id || d.id, ...data });
          }
        });

        const coachSnap = await getDocs(collection(db, 'coaching_students'));
        coachSnap.forEach(d => {
          if (d.id && d.id.startsWith('test_coach_')) return;
          const data = d.data();
          const docName = String(data.fullName || data.name || '');
          if (/^Student\s+\d+$/i.test(docName) && !data.course && !data.contactNo && !data.registrationNo) return;
          const key = getCanonicalKey({ id: d.id, ...data });
          if (key) {
            const existing = firestoreMap.get(key) || {};
            firestoreMap.set(key, { ...existing, id: existing.id || d.id, ...data });
          }
        });

        // Merge Firestore records with local cache using canonical keys
        const loadedMap = new Map();
        loadedList.forEach(item => {
          const key = getCanonicalKey(item);
          if (key) loadedMap.set(key, item);
        });
        firestoreMap.forEach((value, key) => {
          const existing = loadedMap.get(key) || {};
          loadedMap.set(key, { ...existing, ...value });
        });
        loadedList = Array.from(loadedMap.values());
      }
    } catch (e) {
      console.log('Firestore fetch notice:', e);
    }

    // Guarantee Shahapur students are available only if fewer than 68 exist (e.g. offline / cleared cache)
    const shahapurInBase = loadedList.filter(s => (s.trustBranch || s.place || s.city || s.branchName || '').toLowerCase().includes('shahapur'));
    if (shahapurInBase.length < 68) {
      const existingKeys = new Set(shahapurInBase.map(s => getCanonicalKey(s)).filter(Boolean));
      const full68 = getShahapurStudentsFull();
      full68.forEach(st => {
        const k = getCanonicalKey(st);
        if (k && !existingKeys.has(k)) {
          loadedList.push(st);
          existingKeys.add(k);
        }
      });
    }

    // If list is completely empty, use default sample students as offline fallback
    if (loadedList.length === 0) {
      loadedList = defaultSampleStudents;
    }

    // Helper to identify Paid Certificate students (who belong in /certificate/student-list)
    const isPaidCertStudent = (s) => {
      if (!s) return false;
      if (s.isCertificateStudent === true) return true;
      if (s.type === 'certificate_admission') return true;
      if (s.certRegNo && String(s.certRegNo).trim()) return true;
      const reg = String(s.registrationNo || s.regNo || s.admNo || '').trim();
      if (reg.startsWith('SLE-202638') || reg.startsWith('SLE-202')) return true;
      const id = String(s.id || s.appNumber || '').trim();
      if (id.startsWith('SLE-202638')) return true;
      return false;
    };

    // Clean up any certificate students mistakenly in general students cache
    try {
      const rawCache = JSON.parse(localStorage.getItem('sle_students_cache') || '[]');
      if (Array.isArray(rawCache) && rawCache.length > 0) {
        const cleaned = rawCache.filter(s => !isPaidCertStudent(s));
        if (cleaned.length !== rawCache.length) {
          localStorage.setItem('sle_students_cache', JSON.stringify(cleaned));
        }
      }
    } catch (e) {}

    // Filter out deleted student IDs and Paid Certificate students
    let deletedIds = [];
    try {
      deletedIds = JSON.parse(localStorage.getItem('sle_deleted_student_ids') || '[]');
    } catch (e) {}

    const filteredList = loadedList.filter(s => {
      const sReg = String(s.registrationNo || s.regNo || '').trim();
      const sId = String(s.id || s.appNumber || '').trim();
      const isDel = deletedIds.some(dId => 
        dId && (dId === sReg || dId === sId || dId.toLowerCase() === sReg.toLowerCase() || dId.toLowerCase() === sId.toLowerCase())
      );
      if (isDel) return false;

      // Exclude Paid Certificate students (managed separately in Paid Certificate > Student List)
      if (isPaidCertStudent(s)) return false;

      return true;
    });

    // Deduplicate by canonical student key across collections and ID aliases
    const seenStudentKeys = new Set();
    const dedupedList = [];
    filteredList.forEach(s => {
      const key = getCanonicalKey(s);
      if (key && !seenStudentKeys.has(key)) {
        seenStudentKeys.add(key);
        dedupedList.push(s);
      } else if (!key) {
        dedupedList.push(s);
      }
    });

    // Normalize student record fields with intelligent Franchisee resolution
    const normalized = dedupedList.map((s, idx) => {
      let resolvedBranch = s.transferredTo || s.trustBranch || s.place || s.city || '';
      let resolvedFranId = s.franchiseeId || s.environmentId;

      let match = fList.find(f => 
        (resolvedFranId && f.id === resolvedFranId) ||
        (f.email && s.email && f.email.toLowerCase() === s.email.toLowerCase()) ||
        (f.franchiseName && s.franchiseName && f.franchiseName.toLowerCase() === s.franchiseName.toLowerCase())
      );

      if (match && match.location) {
        if (!resolvedBranch || resolvedBranch === 'Athani') {
          resolvedBranch = match.location;
        }
      }
      if (!resolvedBranch) resolvedBranch = 'Athani';

      const normBranch = normalizeBranch(resolvedBranch);
      const matchLocNorm = match ? normalizeBranch(match.location || match.trustBranch) : '';
      if (s.transferredTo || !match || (matchLocNorm && normBranch && matchLocNorm !== normBranch) || !resolvedFranId || resolvedFranId === 'default_env' || resolvedFranId === 'FR-DEFAULT' || resolvedFranId.startsWith('FR-2026-92') || resolvedFranId.startsWith('FR-2026-54')) {
        const branchMatch = fList.find(f => {
          const normFLoc = normalizeBranch(f.location || f.trustBranch);
          const normFName = normalizeBranch(f.franchiseName);
          return (normFLoc && (normFLoc === normBranch || normFLoc.includes(normBranch) || normBranch.includes(normFLoc))) ||
                 (normFName && (normFName === normBranch || normFName.includes(normBranch) || normBranch.includes(normFName))) ||
                 (normBranch === 'shahapur' && (f.id === 'FR-SHAHAPUR' || f.environmentId === 'FR-SHAHAPUR'));
        });
        if (branchMatch) {
          resolvedFranId = branchMatch.id;
          match = branchMatch;
        } else if (!resolvedFranId || resolvedFranId === 'default_env' || resolvedFranId === 'FR-DEFAULT') {
          resolvedFranId = `FR-${resolvedBranch.toUpperCase()}`;
        }
      }

      const resolvedFranName = (s.transferredTo && match?.franchiseName) || s.franchiseName || s.environmentName || (
        match?.franchiseName || resolvedBranch
      );

      // Derive clean registration number from id or appNumber if registrationNo is missing
      let resolvedReg = s.registrationNo || s.regNo || s.admNo;
      if (!resolvedReg) {
        const idMatch = String(s.id || s.appNumber || '').match(/2026[89]?(\d{3,4})$/);
        if (idMatch) {
          resolvedReg = `202638${idMatch[1]}`;
        } else {
          resolvedReg = s.id || `STUD-${idx}`;
        }
      }

      return {
        id: s.id || `STUD-${idx}`,
        franchiseeId: resolvedFranId,
        environmentId: resolvedFranId,
        registrationNo: resolvedReg,
        name: s.name || s.fullName || 'Student Name',
        fullName: s.fullName || s.name || 'Student Name',
        fatherName: s.fatherName || 'Father Name',
        motherName: s.motherName || 'N/A',
        contactNo: s.contactNo || s.mobileNo || s.phone || 'N/A',
        mobileNo: s.mobileNo || s.contactNo || s.phone || 'N/A',
        place: resolvedBranch,
        trustBranch: resolvedBranch,
        selectedClass: s.selectedClass || s.class || '10th',
        course: s.course || s.coachingPlan || 'Navodaya / State Board Special Batch',
        admissionDate: s.admissionDate || s.createdDate || new Date().toISOString().split('T')[0],
        createdDate: s.createdDate || s.admissionDate || new Date().toISOString().split('T')[0],
        address: s.address || 'N/A',
        email: s.email || 'N/A',
        casteCategory: s.casteCategory || s.category || 'General',
        photoPreview: s.photoPreview || '',
        aadharPreview: s.aadharPreview || '',
        aadharFileType: s.aadharFileType || '',
        aadharFileName: s.aadharFileName || '',
        marksheetPreview: s.marksheetPreview || '',
        marksheetFileType: s.marksheetFileType || '',
        marksheetFileName: s.marksheetFileName || '',
        paymentStatus: s.paymentStatus || 'Paid',
        status: s.status || 'Submitted'
      };
    });

    const franchiseeFiltered = filterStudentsForFranchisee(normalized);
    setStudents(franchiseeFiltered);
    setLoading(false);
  };

  useEffect(() => {
    fetchStudentsList();
  }, [path]);

  // Page Header Title determination based on active Environment / Branch
  let activeEnvName = '';
  if (currentFranchiseeEnv && currentFranchiseeEnv.name) {
    activeEnvName = currentFranchiseeEnv.name.toUpperCase();
  } else if (selectedEnvironmentFilter !== 'ALL') {
    const matchedFranchisee = franchiseesList.find(f => f.id === selectedEnvironmentFilter || f.environmentId === selectedEnvironmentFilter);
    if (matchedFranchisee) {
      activeEnvName = (matchedFranchisee.environmentName || matchedFranchisee.franchiseName || matchedFranchisee.location || '').toUpperCase();
    }
  }

  const envPrefix = activeEnvName ? `${activeEnvName} ` : '';

  let headerTitle = `${envPrefix}STUDENTS`;
  if (path.includes('/list/approved')) headerTitle = `${envPrefix}APPROVED STUDENTS`;
  else if (path.includes('/list/passed')) headerTitle = `${envPrefix}PASSED STUDENTS`;
  else if (path.includes('/list/certificate-forms')) headerTitle = 'CERTIFICATE FORM STUDENTS';
  else if (path.includes('/list/marksheet-forms')) headerTitle = 'MARKSHEET FORM STUDENTS';
  else if (path.includes('/list/result')) headerTitle = 'RESULT CANDIDATES';

  // Calculate available academic/admission years from student list
  const availableYears = useMemo(() => {
    return getAvailableYears(students);
  }, [students]);

  // Filter & Search Logic (Enforces Franchisee Environment Isolation)
  const filteredStudents = students.filter(s => {
    // 0. Academic / Admission Year Filter
    if (selectedYear !== 'ALL') {
      const studentYear = getStudentYear(s);
      if (studentYear !== selectedYear) return false;
    }
    // 1. Franchisee Environment Isolation Filter
    if (currentFranchiseeEnv) {
      if (!canFranchiseeAccessStudent(s, currentFranchiseeEnv)) return false;
    } else if (selectedEnvironmentFilter !== 'ALL') {
      const targetFranchisee = franchiseesList.find(f => (f.id === selectedEnvironmentFilter || f.environmentId === selectedEnvironmentFilter));
      if (targetFranchisee && !canFranchiseeAccessStudent(s, targetFranchisee)) return false;
    }
    // 1.5 Approved Students Route Filter (ONLY show students who got a Hall Ticket AND exam is NOT taken)
    if (path.includes('/list/approved')) {
      const regNo = String(s.registrationNo || s.regNo || '').trim();
      const appNo = String(s.appNumber || s.id || '').trim();
      const rollNo = String(s.rollNo || '').trim();
      const sName = String(s.name || s.fullName || '').trim().toLowerCase();

      // Constraint 1: Student MUST have gotten a Hall Ticket
      let hasHallTicket = s.hasHallTicket === true || s.hallTicketGenerated === true || !!s.examPin;
      
      try {
        const storedHt = JSON.parse(localStorage.getItem('sle_registered_halltickets') || '{}');
        const htCache = JSON.parse(localStorage.getItem('sle_hall_tickets_cache') || '{}');
        if (
          storedHt[regNo] || storedHt[appNo] || (rollNo && storedHt[rollNo]) ||
          htCache[regNo] || htCache[appNo] || (rollNo && htCache[rollNo]) ||
          Object.values(htCache).some(h => (h.admissionNo && (String(h.admissionNo) === regNo || String(h.admissionNo) === appNo)) || (h.rollNo && (String(h.rollNo) === regNo || String(h.rollNo) === rollNo)) || (h.studentName && h.studentName.toLowerCase() === sName))
        ) {
          hasHallTicket = true;
        }
      } catch (e) {}

      if (!hasHallTicket) return false;

      // Constraint 2: Exam MUST NOT be taken yet
      let isExamTaken = s.examAttempted === true || s.status === 'Passed' || s.status === 'Completed' || s.status === 'Result Published';

      try {
        const submittedExams = JSON.parse(localStorage.getItem('sle_submitted_exams') || '[]');
        const regUpper = regNo.toUpperCase();
        const appUpper = appNo.toUpperCase();
        const rollUpper = rollNo.toUpperCase();

        if (
          submittedExams.some(item => {
            const itemUpper = String(item).trim().toUpperCase();
            return (
              itemUpper === regUpper ||
              itemUpper === appUpper ||
              (rollUpper && itemUpper === rollUpper) ||
              (itemUpper.length >= 4 && (regUpper.endsWith(itemUpper) || appUpper.endsWith(itemUpper)))
            );
          })
        ) {
          isExamTaken = true;
        }
      } catch (e) {}

      if (isExamTaken) return false;
    }

    // 1.6 Passed Students Route Filter (ONLY show students who HAVE TAKEN the exam)
    if (path.includes('/list/passed')) {
      const regNo = String(s.registrationNo || s.regNo || '').trim();
      const appNo = String(s.appNumber || s.id || '').trim();
      const rollNo = String(s.rollNo || '').trim();

      let isExamTaken = s.examAttempted === true || s.status === 'Passed' || s.status === 'Completed' || s.status === 'Result Published';

      try {
        const submittedExams = JSON.parse(localStorage.getItem('sle_submitted_exams') || '[]');
        const regUpper = regNo.toUpperCase();
        const appUpper = appNo.toUpperCase();
        const rollUpper = rollNo.toUpperCase();

        if (
          submittedExams.some(item => {
            const itemUpper = String(item).trim().toUpperCase();
            return (
              itemUpper === regUpper ||
              itemUpper === appUpper ||
              (rollUpper && itemUpper === rollUpper) ||
              (itemUpper.length >= 4 && (regUpper.endsWith(itemUpper) || appUpper.endsWith(itemUpper)))
            );
          })
        ) {
          isExamTaken = true;
        }
      } catch (e) {}

      if (!isExamTaken) return false;
    }

    // 2. Search Filter
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      s.registrationNo.toLowerCase().includes(term) ||
      s.name.toLowerCase().includes(term) ||
      s.contactNo.toLowerCase().includes(term) ||
      s.place.toLowerCase().includes(term) ||
      s.selectedClass.toLowerCase().includes(term) ||
      s.course.toLowerCase().includes(term)
    );
  });

  // Sorting
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    let valA = a[sortField] || '';
    let valB = b[sortField] || '';

    // Handle numeric registration numbers
    if (sortField === 'registrationNo') {
      const numA = parseInt(valA, 10);
      const numB = parseInt(valB, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      }
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Pagination
  const totalEntries = sortedStudents.length;
  const totalPages = Math.ceil(totalEntries / entriesPerPage) || 1;
  const startIndex = (currentPage - 1) * entriesPerPage;
  const paginatedStudents = sortedStudents.slice(startIndex, startIndex + entriesPerPage);

  return (
    <div className="py-5 sm:py-8 px-3 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-6 w-full max-w-[100vw] overflow-x-hidden min-w-0">

      {/* ATHANI / FRANCHISEE COACHING STUDENTS BANNER */}
      <div className="gradient-banner rounded-2xl sm:rounded-3xl py-4 sm:py-5 px-3 sm:px-8 shadow-xl border border-rose-800/40 relative overflow-hidden text-center flex items-center justify-center gap-2 sm:gap-3 w-full max-w-full min-w-0">
        <h2 className="text-base sm:text-xl md:text-2xl font-black text-white tracking-widest uppercase font-serif break-words line-clamp-2">
          {headerTitle}
        </h2>
        <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-rose-500 text-white font-black text-xs sm:text-sm flex items-center justify-center shadow-inner shrink-0">
          {totalEntries}
        </span>
      </div>

      {/* MAIN CONTAINER CARD */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-6 lg:p-8 shadow-xl border border-slate-200 space-y-6 w-full max-w-full min-w-0">

        {/* TOP CONTROLS BAR (Show Entries, Environment Filter & Search) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 w-full min-w-0">
          
          <div className="flex flex-wrap items-center justify-between sm:justify-start gap-4 w-full sm:w-auto">
            {/* Entries Dropdown */}
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-700">
              <span>Show</span>
              <select
                value={entriesPerPage}
                onChange={(e) => {
                  setEntriesPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 font-bold text-xs focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 cursor-pointer shadow-sm"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>entries</span>
            </div>


            {/* Year Filter Dropdown */}
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-700">
              <Calendar className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Year:</span>
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 font-bold text-xs focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 cursor-pointer shadow-sm"
              >
                <option value="ALL">All Years</option>
                {availableYears.map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>

          </div>

          {/* Search Box */}
          <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
            <span className="text-xs sm:text-sm font-bold text-slate-700 shrink-0">Search:</span>
            <div className="relative flex-1 sm:w-64 min-w-0">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search candidates..."
                className="w-full px-4 py-2 rounded-xl border border-slate-300 bg-slate-50 text-xs sm:text-sm focus:outline-none focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20 shadow-sm transition"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            
            <button
              type="button"
              onClick={fetchStudentsList}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition shrink-0"
              title="Refresh List"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

        </div>

        {/* STUDENTS TABLE */}
        <div className="w-full max-w-full overflow-x-auto rounded-xl border border-slate-200 shadow-xs min-w-0">
          <table className="w-full text-left border-collapse min-w-[650px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-extrabold text-slate-800 uppercase tracking-wider select-none whitespace-nowrap">
                
                <th onClick={() => handleSort('registrationNo')} className="p-3.5 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>Registration No</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                <th onClick={() => handleSort('franchiseeId')} className="p-3.5 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>Franchisee ID</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                <th onClick={() => handleSort('name')} className="p-3.5 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>Name</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                <th onClick={() => handleSort('contactNo')} className="p-3.5 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>Mobile No</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                <th onClick={() => handleSort('place')} className="p-3.5 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>Place</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                <th onClick={() => handleSort('selectedClass')} className="p-3.5 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>Class</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                <th onClick={() => handleSort('admissionDate')} className="p-3.5 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>Date</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                <th className="p-3.5 text-center whitespace-nowrap">
                  <span>View Details</span>
                </th>

              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 text-xs sm:text-sm font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin text-rose-600 mx-auto mb-2" />
                    <span>Loading student records...</span>
                  </td>
                </tr>
              ) : paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-500">
                    No student admission records found.
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((student) => (
                  <tr 
                    key={student.id} 
                    className="hover:bg-rose-50/30 transition-colors"
                  >
                    <td className="p-3.5 font-bold text-slate-900 whitespace-nowrap">
                      {student.registrationNo}
                    </td>

                    <td className="p-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-sky-50 text-sky-700 border border-sky-200">
                        {student.franchiseeId || 'FR-DEFAULT'}
                      </span>
                    </td>

                    <td className="p-3.5 font-bold text-slate-900 whitespace-nowrap">
                      {student.name}
                    </td>

                    <td className="p-3.5 font-semibold text-slate-700 whitespace-nowrap">
                      {student.contactNo}
                    </td>

                    <td className="p-3.5 font-semibold text-slate-800 whitespace-nowrap">
                      {student.place}
                    </td>

                    <td className="p-3.5 font-bold text-slate-900 whitespace-nowrap">
                      {student.selectedClass}
                    </td>

                    <td className="p-3.5 text-slate-600 font-mono text-xs whitespace-nowrap">
                      {student.admissionDate}
                    </td>

                    <td className="p-3.5 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedStudent(student)}
                        className="bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-[11px] font-extrabold px-3.5 py-1.5 rounded-full shadow-sm shadow-rose-600/20 uppercase tracking-wider transition-all transform hover:scale-105 cursor-pointer inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>VIEW DETAILS</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* BOTTOM PAGINATION CONTROLS */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 text-xs sm:text-sm text-slate-600 font-medium text-center sm:text-left">
          
          <div>
            Showing {totalEntries > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + entriesPerPage, totalEntries)} of {totalEntries} entries
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition"
            >
              Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition ${
                  currentPage === page
                    ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-md shadow-rose-600/20'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition"
            >
              Next
            </button>
          </div>

        </div>

      </div>

      {/* STUDENT FULL DETAILS MODAL */}
      {selectedStudent && (
        <div id="printable-student-modal" className="fixed inset-0 z-50 flex items-center justify-center p-1.5 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto printable-modal">
          <div className="bg-white text-slate-900 rounded-2xl max-w-4xl w-full p-3 sm:p-8 shadow-2xl border border-slate-300 relative max-h-[95vh] overflow-y-auto">
            
            {/* Action Bar (Hidden when printing) */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 mb-4 sm:mb-6 print-hide print:hidden">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                <span className="text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider">ADMISSION FORM GENERATED &amp; FEE PAID</span>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl flex items-center gap-2 shadow transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Admission Form</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* PRINTABLE OFFICIAL STUDENT ADMISSION FORM DOCUMENT */}
            <div id="printable-admission-form" className="bg-white text-slate-900 space-y-4 sm:space-y-6 font-sans p-1 sm:p-4 printable-document">
              
              {/* Header Section */}
              <div className="flex items-start justify-between relative pb-2 border-b border-slate-200 gap-2">
                {/* Top Left Logo (public/logo-1.jpg) */}
                <div className="w-12 h-12 sm:w-20 sm:h-20 flex-shrink-0">
                  <img src="/logo-1.jpg" alt="SLE Institutions Logo" className="w-full h-full object-contain" />
                </div>

                {/* Center Title & Subheaders */}
                <div className="text-center flex-1 px-1">
                  <h1 className="text-base sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
                    SLE INSTITUTIONS
                  </h1>
                  <p className="text-[9px] sm:text-xs font-semibold text-slate-700 mt-0.5 leading-tight max-w-2xl mx-auto">
                    (Sharing Computer Literacy Movement with Govt. of India) Recognized by Govt. Of INDIA. ISO 21001:2025 Certified Institute.
                  </p>
                  <p className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-widest mt-1">
                    ADMISSION FORM
                  </p>
                </div>

                {/* Right Spacer to balance the left logo and keep header centered */}
                <div className="w-12 sm:w-20 flex-shrink-0" />
              </div>

              {/* Main Border Boxed Form Details */}
              <div className="border border-slate-800 p-3 sm:p-8 relative min-h-[460px] text-xs sm:text-sm font-mono text-slate-900 bg-white">
                
                {/* Responsive Layout: Photo + Fields */}
                <div className="flex flex-col-reverse sm:flex-row justify-between items-start gap-4 sm:gap-6">
                  
                  {/* Fields Table Grid */}
                  <div className="w-full sm:max-w-[calc(100%-140px)] space-y-2.5 sm:space-y-3 pt-1">
                    
                    <div className="grid grid-cols-[115px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-1.5 sm:gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0 text-[10px] sm:text-xs">REGISTRATION NO:</span>
                      <span className="font-bold text-slate-900 text-xs sm:text-sm tracking-wider break-all">{selectedStudent.registrationNo}</span>
                    </div>

                    <div className="grid grid-cols-[115px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-1.5 sm:gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0 text-[10px] sm:text-xs">ADMISSION DATE:</span>
                      <span className="font-semibold text-slate-900 break-all text-[11px] sm:text-xs">{selectedStudent.admissionDate || selectedStudent.createdDate}</span>
                    </div>

                    <div className="grid grid-cols-[115px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-1.5 sm:gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0 text-[10px] sm:text-xs">NAME:</span>
                      <span className="font-semibold text-slate-900 uppercase break-words text-[11px] sm:text-xs">{selectedStudent.fullName || selectedStudent.name}</span>
                    </div>

                    <div className="grid grid-cols-[115px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-1.5 sm:gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0 text-[10px] sm:text-xs">FATHER NAME:</span>
                      <span className="font-semibold text-slate-900 break-words text-[11px] sm:text-xs">{selectedStudent.fatherName || 'N/A'}</span>
                    </div>

                    <div className="grid grid-cols-[115px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-1.5 sm:gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0 text-[10px] sm:text-xs">DATE OF BIRTH:</span>
                      <span className="font-semibold text-slate-900 break-words text-[11px] sm:text-xs">
                        {selectedStudent.dobYear 
                          ? `${selectedStudent.dobYear} ${selectedStudent.dobMonth}, ${selectedStudent.dobDay}` 
                          : selectedStudent.dob || 'N/A'}
                      </span>
                    </div>

                    <div className="grid grid-cols-[115px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-1.5 sm:gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0 text-[10px] sm:text-xs">CASTE:</span>
                      <span className="font-semibold text-slate-900 uppercase break-words text-[11px] sm:text-xs">{selectedStudent.casteCategory || selectedStudent.caste || 'N/A'}</span>
                    </div>

                    <div className="grid grid-cols-[115px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-1.5 sm:gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0 text-[10px] sm:text-xs">ADDRESS:</span>
                      <span className="font-medium text-slate-900 break-words text-[11px] sm:text-xs">{selectedStudent.address || 'N/A'}</span>
                    </div>

                    <div className="grid grid-cols-[115px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-1.5 sm:gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0 text-[10px] sm:text-xs">EMAIL ID:</span>
                      <span className="font-medium text-slate-900 lowercase break-all text-[11px] sm:text-xs">{selectedStudent.email || 'N/A'}</span>
                    </div>

                    <div className="grid grid-cols-[115px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-1.5 sm:gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0 text-[10px] sm:text-xs">CONTACT NO:</span>
                      <span className="font-semibold text-slate-900 break-all text-[11px] sm:text-xs">{selectedStudent.contactNo || selectedStudent.mobileNo || 'N/A'}</span>
                    </div>

                    <div className="grid grid-cols-[115px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-1.5 sm:gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0 text-[10px] sm:text-xs">QUALIFICATION:</span>
                      <span className="font-semibold text-slate-900 uppercase break-words text-[11px] sm:text-xs">{selectedStudent.qualification || 'N/A'}</span>
                    </div>

                    <div className="grid grid-cols-[115px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0 text-[10px] sm:text-xs">COURSE:</span>
                      <span className="font-bold text-slate-900 uppercase break-words text-[11px] sm:text-xs">{selectedStudent.course || selectedStudent.selectedClass || 'N/A'}</span>
                    </div>

                    <div className="grid grid-cols-[115px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-1.5 sm:gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0 text-[10px] sm:text-xs">BRANCH:</span>
                      <span className="font-semibold text-slate-900 break-words text-[11px] sm:text-xs">{selectedStudent.trustBranch || selectedStudent.place || 'N/A'}</span>
                    </div>

                    <div className="grid grid-cols-[115px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-1.5 sm:gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0 text-[10px] sm:text-xs">FRANCHISEE ID:</span>
                      <span className="font-mono font-bold text-sky-700 break-all text-[11px] sm:text-xs">{selectedStudent.franchiseeId || selectedStudent.environmentId || 'N/A'}</span>
                    </div>

                  </div>

                  {/* Candidate Photo (Centered on Mobile, Top Right on Desktop) */}
                  <div className="self-center sm:self-start flex-shrink-0 w-24 h-32 sm:w-32 sm:h-40 border border-slate-800 bg-slate-100 flex items-center justify-center overflow-hidden shadow-sm">
                    {selectedStudent.photoPreview || selectedStudent.photoUrl ? (
                      <img
                        src={selectedStudent.photoPreview || selectedStudent.photoUrl}
                        alt="Candidate Photo"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400 font-sans text-center px-2">Photo</span>
                    )}
                  </div>

                </div>

                {/* Bottom Declaration Statement */}
                <div className="pt-6 sm:pt-10 mt-4 sm:mt-6 border-t border-slate-200 sm:border-t-0">
                  <p className="font-bold text-slate-900 text-[11px] sm:text-xs tracking-tight font-sans">
                    I hereby declare that the details furnished above are true.
                  </p>
                </div>

              </div>

              {/* Bottom Footer Office Address */}
              <div className="text-center pt-3 pb-1 border-t border-slate-200 space-y-0.5">
                <p className="text-[9px] sm:text-xs font-bold text-slate-800 tracking-tight leading-normal">
                  Regd Office: KHB COLONY SOLAPUR ROAD VIJAYAPURA 586101 &bull; Contact: 9482354550 &bull; Email: slesindia.headoffice@gmail.com
                </p>
                <p className="text-[9px] sm:text-xs font-bold text-slate-800 tracking-tight leading-normal">
                  Administrative office: Opposite Bus Stand Satti Road Athani Belgaum 591304 &bull; Contact: 9611351295, 9916563591 &bull; Email: slesinstitute100@gmail.com
                </p>
              </div>

            </div>

            {/* Uploaded Documents Section (Hidden when printing) */}
            <div className="border-t border-slate-200 pt-4 space-y-3 print:hidden print-hide">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-rose-600" /> Uploaded Documents (Click to View Full Size)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                
                {/* Aadhar Card */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-center relative group">
                  <span className="block text-[11px] font-bold text-slate-700 uppercase">Aadhar Card</span>
                  {selectedStudent.aadharPreview ? (
                    <div
                      onClick={() => setViewDocument({
                        title: `Aadhar Card - ${selectedStudent.fullName}`,
                        preview: selectedStudent.aadharPreview,
                        fileType: selectedStudent.aadharFileType,
                        fileName: selectedStudent.aadharFileName || 'AadharCard'
                      })}
                      className="cursor-pointer group/doc relative rounded-lg overflow-hidden border border-slate-300 hover:border-rose-500 transition-all shadow-sm hover:shadow-md bg-white"
                    >
                      {selectedStudent.aadharFileType === 'pdf' ? (
                        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-bold flex items-center justify-center gap-2">
                          <FileText className="w-5 h-5 text-rose-600" />
                          <span>PDF Document (Click to View)</span>
                        </div>
                      ) : (
                        <div className="relative">
                          <img src={selectedStudent.aadharPreview} alt="Aadhar" className="w-full h-28 object-cover rounded-lg mx-auto" />
                          <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover/doc:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1 p-2">
                            <ZoomIn className="w-5 h-5 text-rose-400" />
                            <span className="text-[11px] font-bold">Click to View</span>
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        className="w-full py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] flex items-center justify-center gap-1 border-t border-slate-200 transition"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Aadhar Card
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 block py-4">Not Uploaded</span>
                  )}
                </div>

                {/* Marksheet */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-center relative group">
                  <span className="block text-[11px] font-bold text-slate-700 uppercase">Marksheet</span>
                  {selectedStudent.marksheetPreview ? (
                    <div
                      onClick={() => setViewDocument({
                        title: `Marksheet - ${selectedStudent.fullName}`,
                        preview: selectedStudent.marksheetPreview,
                        fileType: selectedStudent.marksheetFileType,
                        fileName: selectedStudent.marksheetFileName || 'Marksheet'
                      })}
                      className="cursor-pointer group/doc relative rounded-lg overflow-hidden border border-slate-300 hover:border-rose-500 transition-all shadow-sm hover:shadow-md bg-white"
                    >
                      {selectedStudent.marksheetFileType === 'pdf' ? (
                        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-bold flex items-center justify-center gap-2">
                          <FileText className="w-5 h-5 text-rose-600" />
                          <span>PDF Document (Click to View)</span>
                        </div>
                      ) : (
                        <div className="relative">
                          <img src={selectedStudent.marksheetPreview} alt="Marksheet" className="w-full h-28 object-cover rounded-lg mx-auto" />
                          <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover/doc:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1 p-2">
                            <ZoomIn className="w-5 h-5 text-rose-400" />
                            <span className="text-[11px] font-bold">Click to View</span>
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        className="w-full py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] flex items-center justify-center gap-1 border-t border-slate-200 transition"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Marksheet
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 block py-4">Not Uploaded</span>
                  )}
                </div>

              </div>
            </div>

            {/* Modal Footer Actions (Hidden when printing) */}
            <div className="pt-2 flex justify-end print:hidden print-hide border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* FULL DOCUMENT VIEWER MODAL */}
      {viewDocument && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 relative max-h-[95vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">{viewDocument.title}</h3>
                  <p className="text-xs text-slate-500 font-mono">{viewDocument.fileName || 'Uploaded Document'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Download / Save Button */}
                <a
                  href={viewDocument.preview}
                  download={viewDocument.fileName || 'document'}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold border border-rose-200 flex items-center gap-1.5 transition cursor-pointer shadow-sm"
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
                              : `<img src="${viewDocument.preview}" style="max-width:100%; max-height:100vh; object-contain:contain; shadow:0 10px 30px rgba(0,0,0,0.5);" />`
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

                <button
                  type="button"
                  onClick={() => setViewDocument(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Preview Display Area */}
            <div className="flex-1 overflow-auto bg-slate-900/5 rounded-2xl p-4 flex items-center justify-center min-h-[420px]">
              {viewDocument.fileType === 'pdf' ? (
                <iframe
                  src={viewDocument.preview}
                  title={viewDocument.title}
                  className="w-full h-[620px] rounded-xl border border-slate-300 shadow-sm bg-white"
                />
              ) : (
                <img
                  src={viewDocument.preview}
                  alt={viewDocument.title}
                  className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-lg border border-slate-300 bg-white"
                />
              )}
            </div>

            {/* Footer Close Button */}
            <div className="flex justify-end pt-1 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setViewDocument(null)}
                className="px-6 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition cursor-pointer"
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
