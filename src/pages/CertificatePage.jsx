import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  Search,
  RefreshCw,
  Eye,
  User,
  Phone,
  MapPin,
  Calendar,
  GraduationCap,
  Loader2,
  X,
  Printer,
  ChevronLeft,
  ChevronRight,
  FileText,
  CheckCircle2,
  Sparkles,
  Users,
  Edit3,
  Upload,
  Send
} from 'lucide-react';
import { db, collection, getDocs, doc, setDoc, getDoc } from '../firebase';
import { subscribeToCourses, DEFAULT_COURSES, getCourseFullName, getCourseShortName, computeOneYearEndDate, computeOneMonthAfterDate } from '../utils/courseManager';
import { resolveBranchAddressSync, isDetailedCenterAddress } from '../utils/branchManager';
import { generateRollNo } from '../utils/examAuthManager';
import { filterStudentsForFranchisee } from '../utils/franchiseeFilter';
import { transferShurapurToShahapur } from '../utils/studentTransfer';
import { getStudentYear, getAvailableYears } from '../utils/studentYearHelper';
import CertificateTemplate from '../components/CertificateTemplate';

export default function CertificatePage() {
  const navigate = useNavigate();

  // --- Course-wise Students List State ---
  const [coursesList, setCoursesList] = useState(DEFAULT_COURSES);
  const [bulkCourse, setBulkCourse] = useState('ALL');
  const [bulkStudents, setBulkStudents] = useState([]);
  const [isBulkSearching, setIsBulkSearching] = useState(false);
  const [bulkSearched, setBulkSearched] = useState(false);
  const [studentSearchFilter, setStudentSearchFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedYear, setSelectedYear] = useState('ALL');

  // --- Certificate Application Form Modal State ---
  const emptyCertFormState = {
    admNo: '',
    htNo: '',
    candidateName: '',
    fatherName: '',
    courseCode: '',
    courseTitle: '',
    startDate: '',
    endDate: '',
    division: 'FIRST CLASS',
    issueDate: '',
    trainingCenter: '',
    branchAddress: '',
    photoUrl: ''
  };

  const formatToIsoDate = (dateStr) => {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    const s = String(dateStr).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
      const [d, m, y] = s.split('-');
      return `${y}-${m}-${d}`;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [d, m, y] = s.split('/');
      return `${y}-${m}-${d}`;
    }
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  };

  const [certFormData, setCertFormData] = useState(emptyCertFormState);
  const [certSubmitted, setCertSubmitted] = useState(false);
  const [isSavingCert, setIsSavingCert] = useState(false);
  const [certFetchStatus, setCertFetchStatus] = useState(''); // 'found' | 'notfound' | 'searching' | ''
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);

  // --- Printing / Previewing State ---
  const [printingCertData, setPrintingCertData] = useState(null);
  const certPrintRef = useRef(null);

  // Subscribe to dynamic courses and initial load
  useEffect(() => {
    const unsub = subscribeToCourses((loadedCourses) => {
      if (Array.isArray(loadedCourses) && loadedCourses.length > 0) {
        setCoursesList(loadedCourses.map(c => (typeof c === 'string' ? c : c.name)).filter(Boolean));
      }
    });
    handleBulkSearch('ALL');
    return () => unsub && unsub();
  }, []);

  const handleBulkSearch = async (overrideCourse) => {
    setIsBulkSearching(true);
    setBulkSearched(false);
    setBulkStudents([]);

    try {
      await transferShurapurToShahapur();
    } catch (_) {}

    const targetCourse = (overrideCourse !== undefined ? overrideCourse : bulkCourse).trim();

    const isCourseMatch = (r) => {
      if (!targetCourse || targetCourse === 'ALL' || targetCourse.toLowerCase().includes('all courses')) return true;
      const val = (r.course || r.courseName || r.courseTitle || r.courseCode || r.coachingPlan || r.program || r.selectedClass || r.selectedCourse || '').toLowerCase().trim();
      const targetLower = targetCourse.toLowerCase();
      if (!val) return false;
      if (val === targetLower) return true;
      if (val.includes(targetLower) || targetLower.includes(val)) return true;

      const cleanTarget = targetLower.replace(/[^a-z0-9]/g, '');
      const cleanVal = val.replace(/[^a-z0-9]/g, '');
      if (cleanVal.includes(cleanTarget) || cleanTarget.includes(cleanVal)) return true;

      if (targetLower === 'gst') {
        return val.includes('gst') || val.includes('goods') || val.includes('tax');
      }
      if (targetLower === 'pgdca') {
        return val.includes('pgdca') || val.includes('post graduate diploma');
      }
      if (targetLower === 'dca') {
        return val.includes('dca') || val.includes('diploma in computer');
      }

      return false;
    };

    const found = [];
    const seen = new Set();
    const storedCerts = JSON.parse(localStorage.getItem('sle_registered_certificates') || '{}');

    // 1. Read from local certificate students cache first (fastest)
    const rawCertCache = localStorage.getItem('sle_cert_students_cache');
    if (rawCertCache) {
      try {
        const recs = JSON.parse(rawCertCache);
        recs.forEach(r => {
          if (!isCourseMatch(r)) return;
          const uid = r.certRegNo || r.registrationNo || r.admissionNo || r.admNo || r.appNumber || r.id;
          if (!uid || seen.has(uid)) return;
          seen.add(uid);

          const hasCert = !!(storedCerts[uid] || storedCerts[r.rollNo] || storedCerts[r.htNo]);

          found.push({
            ...r,
            uid,
            admNo: uid,
            admissionNo: uid,
            htNo: r.rollNo || r.htNo || generateRollNo('2026', bulkCourse, uid),
            candidateName: r.fullName || r.name || r.studentName || r.candidateName || 'Candidate',
            fatherName: r.fatherName || r.parentName || '—',
            course: r.course || r.courseName || r.courseTitle || r.courseCode || bulkCourse,
            courseCode: r.course || r.courseName || r.courseTitle || r.courseCode || bulkCourse,
            startDate: r.startDate || r.admissionDate || r.createdDate || '2025-01-01',
            endDate: r.endDate || r.completionDate || '2026-01-01',
            trainingCenter: r.trustBranch || r.trainingCenter || r.franchiseName || r.branchName || r.place || 'SLES Center',
            photoUrl: r.photoUrl || r.photo || r.photoPreview || '',
            hasCustomCert: hasCert
          });
        });
      } catch (_) {}
    }

    // 2. Fetch live from Firestore 'cert_students' collection ONLY
    if (db) {
      try {
        const snap = await getDocs(collection(db, 'cert_students'));
        snap.forEach(docSnap => {
          const r = { id: docSnap.id, ...docSnap.data() };
          if (!isCourseMatch(r)) return;
          const docKey = r.certRegNo || r.appNumber || r.id || r.registrationNo;
          if (!docKey || seen.has(docKey)) return;
          seen.add(docKey);
          const uid = r.certRegNo || r.registrationNo || r.admissionNo || r.admNo || docKey;

          const hasCert = !!(storedCerts[uid] || storedCerts[r.rollNo] || storedCerts[r.htNo]);

          found.push({
            ...r,
            uid,
            admNo: uid,
            admissionNo: uid,
            htNo: r.rollNo || r.htNo || generateRollNo('2026', bulkCourse, uid),
            candidateName: r.fullName || r.name || r.studentName || r.candidateName || 'Candidate',
            fatherName: r.fatherName || r.parentName || '—',
            course: r.course || r.courseName || r.courseTitle || r.courseCode || bulkCourse,
            courseCode: r.course || r.courseName || r.courseTitle || r.courseCode || bulkCourse,
            startDate: r.startDate || r.admissionDate || r.createdDate || '2025-01-01',
            endDate: r.endDate || r.completionDate || '2026-01-01',
            trainingCenter: r.trustBranch || r.trainingCenter || r.franchiseName || r.branchName || r.place || 'SLES Center',
            photoUrl: r.photoUrl || r.photo || r.photoPreview || '',
            hasCustomCert: hasCert
          });
        });
      } catch (err) {
        console.warn('Firestore live cert_students search notice:', err);
      }
    }

    const franchiseeFiltered = filterStudentsForFranchisee(found);
    setBulkStudents(franchiseeFiltered);
    setIsBulkSearching(false);
    setBulkSearched(true);
  };

  const availableYears = useMemo(() => {
    return getAvailableYears(bulkStudents);
  }, [bulkStudents]);

  const filteredBulkStudents = useMemo(() => {
    let list = bulkStudents;
    if (selectedYear !== 'ALL') {
      list = list.filter(s => getStudentYear(s) === selectedYear);
    }
    if (!studentSearchFilter.trim()) return list;
    const q = studentSearchFilter.toLowerCase().trim();
    return list.filter(s =>
      (s.candidateName || '').toLowerCase().includes(q) ||
      (s.admNo || '').toLowerCase().includes(q) ||
      (s.htNo || '').toLowerCase().includes(q) ||
      (s.fatherName || '').toLowerCase().includes(q)
    );
  }, [bulkStudents, studentSearchFilter, selectedYear]);

  const totalPages = Math.max(1, Math.ceil(filteredBulkStudents.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredBulkStudents.length);
  const paginatedStudents = useMemo(() => {
    return filteredBulkStudents.slice(startIndex, endIndex);
  }, [filteredBulkStudents, startIndex, endIndex]);

  const handleSelectStudentForCertForm = (student) => {
    const adm = student.admNo || student.admissionNo || student.registrationNo || student.certRegNo || student.id || '';
    const stdCourse = student.courseCode || student.course || student.courseName || bulkCourse || '';
    const rollNo = student.htNo || student.rollNo || adm;

    const storedCerts = JSON.parse(localStorage.getItem('sle_registered_certificates') || '{}');
    const existingCert = storedCerts[adm] || (rollNo ? storedCerts[rollNo] : null);

    const safeName = student.candidateName || student.fullName || student.name || 'Candidate';
    const safeFather = student.fatherName || student.parentName || '—';

    const sDate = formatToIsoDate(existingCert?.startDate || student.startDate || student.admissionDate || student.createdDate || new Date());
    const rawEnd = existingCert?.endDate || student.endDate || student.completionDate;
    const eDate = (rawEnd && rawEnd > sDate && rawEnd !== '2026-01-01')
      ? formatToIsoDate(rawEnd)
      : computeOneYearEndDate(sDate, 3);
    const rawIssue = existingCert?.issueDate || student.issueDate;
    const iDate = (rawIssue && rawIssue > eDate)
      ? formatToIsoDate(rawIssue)
      : computeOneMonthAfterDate(eDate);

    const rawCourse = student.course || student.courseName || student.courseCode || '';
    const courseShort = getCourseShortName(existingCert?.courseCode || student.courseCode || rawCourse || '') || 'TALLY';
    const courseFull = existingCert?.courseTitle ? getCourseFullName(existingCert.courseTitle) : (getCourseFullName(rawCourse || courseShort) || 'TALLY FINANCIAL ACCOUNTING');

    const syncAddr = resolveBranchAddressSync(student);
    const branchAddr = isDetailedCenterAddress(syncAddr, student)
      ? syncAddr
      : (isDetailedCenterAddress(existingCert?.branchAddress, student) ? existingCert.branchAddress : (syncAddr || existingCert?.branchAddress || student.branchAddress || student.trainingCenter || student.branchName || student.trustBranch || student.place || student.location || 'DHARWAD'));
    const branchName = existingCert?.trainingCenter || student.trainingCenter || student.branchName || student.trustBranch || 'MYSORE';

    setCertFormData({
      admNo: existingCert?.admNo || adm,
      htNo: existingCert?.htNo || rollNo || adm,
      candidateName: existingCert?.candidateName || safeName,
      fatherName: existingCert?.fatherName || safeFather,
      courseCode: courseShort,
      courseTitle: courseFull,
      startDate: sDate,
      endDate: eDate,
      division: existingCert?.division || student.division || 'FIRST CLASS',
      issueDate: iDate,
      trainingCenter: branchName,
      branchAddress: branchAddr,
      photoUrl: existingCert?.photoUrl || student.photoUrl || student.photo || ''
    });

    setCertFetchStatus('found');
    setCertSubmitted(false);
    setIsCertModalOpen(true);
  };

  const handleCertFormChange = (field, value) => {
    setCertFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'startDate' && value) {
        const computedEnd = computeOneYearEndDate(value, 3);
        updated.endDate = computedEnd;
        updated.issueDate = computeOneMonthAfterDate(computedEnd);
      } else if (field === 'endDate' && value) {
        updated.issueDate = computeOneMonthAfterDate(value);
      } else if (field === 'courseCode' && value) {
        const full = getCourseFullName(value);
        if (full) updated.courseTitle = full;
      }
      return updated;
    });
  };

  // Auto-fetch student details by Admission / Registration Number
  const fetchStudentByAdmNo = async (admNo) => {
    if (!admNo || !String(admNo).trim()) return;
    setCertFetchStatus('searching');

    const searchKey = String(admNo).trim().toLowerCase();

    const matchesKey = (r) => {
      const fields = [
        r.certRegNo, r.registrationNo, r.appNumber, r.admissionNo,
        r.admNo, r.studentId, r.rollNo, r.htNo, r.id
      ];
      return fields.some(f => f && String(f).toLowerCase() === searchKey);
    };

    let found = null;

    // 1. Search localStorage caches
    const cacheKeys = ['sle_cert_students_cache', 'sle_students_cache', 'sle_coaching_students_cache', 'sle_applications_cache'];
    for (const key of cacheKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const records = JSON.parse(raw);
        const match = records.find(matchesKey);
        if (match) { found = match; break; }
      } catch (_) {}
    }

    // 2. Search Firestore
    if (!found && db) {
      try {
        const collections = ['cert_students', 'students', 'applications', 'coaching_students'];
        for (const colName of collections) {
          const snap = await getDocs(collection(db, colName));
          snap.forEach(d => {
            if (found) return;
            const data = { id: d.id, ...d.data() };
            if (matchesKey(data)) found = data;
          });
          if (found) break;
        }
      } catch (e) {
        console.log('Firestore student fetch notice:', e);
      }
    }

    if (found) {
      const fAdm = found.certRegNo || found.registrationNo || found.admissionNo || found.admNo || found.appNumber || found.id || admNo;
      const fName = found.fullName || found.name || found.studentName || found.candidateName || 'Candidate';
      const fFather = found.fatherName || found.parentName || found.guardianName || '—';
      const fCourse = found.course || found.courseName || found.courseTitle || found.courseCode || found.coachingPlan || found.program || '';
      const fCenter = found.trustBranch || found.examCenter || found.trainingCenter || found.branchName || found.franchiseName || found.place || 'MYSORE';
      const fPhoto = found.photoUrl || found.photoPreview || found.photo || found.candidatePhoto || '';

      setCertFormData(prev => ({
        ...prev,
        admNo: fAdm,
        htNo: found.rollNo || found.htNo || prev.htNo || fAdm,
        candidateName: fName,
        fatherName: fFather,
        courseTitle: fCourse || prev.courseTitle,
        startDate: formatToIsoDate(found.startDate || found.joiningDate || found.admissionDate || found.createdDate || prev.startDate),
        endDate: formatToIsoDate(found.endDate || found.completionDate || prev.endDate),
        trainingCenter: fCenter,
        photoUrl: fPhoto || prev.photoUrl
      }));
      setCertFetchStatus('found');
    } else {
      setCertFetchStatus('notfound');
    }
  };

  const handleCertFormSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    try {
      setIsSavingCert(true);
      const safeAdmNo = (certFormData.admNo || '').trim();
      const safeHtNo = (certFormData.htNo || safeAdmNo).trim();
      const safeName = (certFormData.candidateName || '').trim();

      if (!safeAdmNo) {
        alert('Please enter or select a Registration Number.');
        setIsSavingCert(false);
        return;
      }
      if (!safeName) {
        alert('Please enter Candidate Name.');
        setIsSavingCert(false);
        return;
      }

      const cleanCertData = {
        admNo: safeAdmNo,
        htNo: safeHtNo || safeAdmNo,
        candidateName: safeName,
        fatherName: (certFormData.fatherName || '').trim() || '—',
        courseCode: (certFormData.courseCode || '').trim() || 'TALLY',
        courseTitle: (certFormData.courseTitle || '').trim() || 'Certificate Course',
        startDate: formatToIsoDate(certFormData.startDate),
        endDate: formatToIsoDate(certFormData.endDate),
        division: certFormData.division || 'FIRST CLASS',
        issueDate: formatToIsoDate(certFormData.issueDate),
        trainingCenter: (certFormData.trainingCenter || '').trim() || 'MYSORE',
        branchAddress: (certFormData.branchAddress || '').trim() || 'KARNATAKA',
        photoUrl: certFormData.photoUrl || ''
      };

      // 1. Save certificate data to localStorage
      const storedCertificates = JSON.parse(localStorage.getItem('sle_registered_certificates') || '{}');
      storedCertificates[safeAdmNo] = cleanCertData;
      if (safeHtNo) {
        storedCertificates[safeHtNo] = cleanCertData;
      }
      localStorage.setItem('sle_registered_certificates', JSON.stringify(storedCertificates));

      // 2. Also save to Firestore if connected
      if (db) {
        try {
          const docId = safeAdmNo.replace(/\//g, '_');
          await setDoc(doc(db, 'certificates', docId), cleanCertData, { merge: true });
        } catch (err) {
          console.warn('Firestore certificate save notice:', err);
        }
      }

      // 3. Update local bulkStudents status
      setBulkStudents(prev => prev.map(s => {
        if (s.admNo === safeAdmNo || s.htNo === safeHtNo || s.uid === safeAdmNo) {
          return { ...s, ...cleanCertData, hasCustomCert: true };
        }
        return s;
      }));

      setCertFormData(cleanCertData);
      setCertSubmitted(true);
    } catch (err) {
      console.error('Error submitting certificate form:', err);
      alert('Error saving certificate form: ' + (err.message || 'Please try again.'));
    } finally {
      setIsSavingCert(false);
    }
  };

  const handlePrintStudentCertificate = (student) => {
    const adm = student.admNo || student.admissionNo || student.registrationNo || student.certRegNo;
    const storedCerts = JSON.parse(localStorage.getItem('sle_registered_certificates') || '{}');
    const existing = storedCerts[adm] || storedCerts[student.htNo] || {
      admNo: adm,
      htNo: student.htNo,
      candidateName: student.candidateName || student.fullName || student.name,
      fatherName: student.fatherName,
      courseTitle: student.course || student.courseName,
      startDate: student.startDate || student.admissionDate,
      endDate: student.endDate || student.completionDate,
      division: 'FIRST CLASS',
      issueDate: new Date().toISOString().split('T')[0],
      trainingCenter: student.trainingCenter || student.trustBranch || 'MYSORE',
      branchAddress: resolveBranchAddressSync(student) || student.branchAddress || student.place || student.location || 'KARNATAKA',
      photoUrl: student.photoUrl
    };

    setPrintingCertData(existing);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const handlePrintActiveCertificate = () => {
    setPrintingCertData(certFormData);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  return (
    <div className="py-5 sm:py-8 px-3 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-200 w-full max-w-[100vw] overflow-x-hidden">

      {/* Crimson Banner matching SLE Color Theme */}
      <div className="gradient-banner rounded-3xl py-6 px-4 sm:py-8 sm:px-8 shadow-xl border border-rose-800/40 text-center text-white relative overflow-hidden w-full max-w-[calc(100vw-1.5rem)] sm:max-w-full mx-auto min-w-0">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 space-y-1">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-black tracking-wide sm:tracking-widest uppercase font-serif drop-shadow-md break-words">
            CERTIFICATE FORM
          </h2>
          <p className="text-rose-100 font-medium text-xs sm:text-sm max-w-xl mx-auto">
            Course Completion & Merit Certificate Application
          </p>
        </div>
      </div>

      <div className="w-full max-w-4xl mx-auto space-y-6 min-w-0 max-w-[calc(100vw-1.5rem)] sm:max-w-4xl">

        {/* ── COURSE-WISE STUDENTS LIST & SELECTION ── */}
        <div className="bg-white rounded-3xl shadow-xl border border-rose-200 overflow-hidden animate-in fade-in duration-300 w-full min-w-0 max-w-full">
          {/* Course Selector Banner */}
          <div className="gradient-banner border-b border-rose-800/30 px-4 py-5 sm:px-6 sm:py-6 text-white space-y-4 w-full min-w-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base sm:text-lg font-black tracking-wide flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-300" />
                  <span>Select Course to Load Students</span>
                </h3>
                <p className="text-xs text-rose-100/90 mt-0.5">
                  Choose a course to list all enrolled students and customize their certificate details.
                </p>
              </div>

              {/* Course Dropdown */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
                <select
                  value={bulkCourse}
                  onChange={e => {
                    const sel = e.target.value;
                    setBulkCourse(sel);
                    setBulkSearched(false);
                    setBulkStudents([]);
                    setCurrentPage(1);
                    handleBulkSearch(sel);
                  }}
                  className="w-full sm:w-72 md:w-80 max-w-full min-w-0 px-3.5 sm:px-4 py-2.5 rounded-2xl border-2 border-rose-300 bg-white text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-400/20 shadow-md transition truncate"
                >
                  <option value="ALL">ALL COURSES (All Registered Students)</option>
                  {coursesList.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleBulkSearch()}
                  disabled={isBulkSearching}
                  className="w-full sm:w-auto px-4 sm:px-6 py-2.5 bg-white hover:bg-rose-50 disabled:opacity-50 text-rose-700 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition shadow-md shrink-0 border border-rose-200 cursor-pointer active:scale-95 whitespace-nowrap"
                  title="Load Students"
                >
                  {isBulkSearching ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-rose-600 shrink-0" />
                      <span>Finding...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Load Students</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Results Body */}
          {bulkSearched && (
            <div className="p-3 sm:p-6 space-y-4 w-full max-w-full overflow-hidden">
              {bulkStudents.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <Users className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-slate-700 font-bold text-sm">
                    No students found for course <span className="text-rose-600">"{bulkCourse}"</span>
                  </p>
                  <p className="text-slate-400 text-xs">
                    Make sure students are registered through the admission form.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                      <div className="relative flex-1 w-full sm:max-w-xs">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={studentSearchFilter}
                          onChange={e => {
                            setStudentSearchFilter(e.target.value);
                            setCurrentPage(1);
                          }}
                          placeholder="Filter by Student Name or Adm No..."
                          className="w-full pl-10 pr-4 py-2 rounded-xl text-xs border border-slate-300 bg-white focus:outline-none focus:border-rose-500"
                        />
                      </div>
                      {/* Year Filter Dropdown */}
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 shadow-xs">
                        <Calendar className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>Year:</span>
                        <select
                          value={selectedYear}
                          onChange={e => {
                            setSelectedYear(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="bg-transparent text-slate-900 font-bold text-xs focus:outline-none cursor-pointer"
                        >
                          <option value="ALL">All Years</option>
                          {availableYears.map(yr => (
                            <option key={yr} value={yr}>{yr}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-slate-600 whitespace-nowrap">
                      Showing {filteredBulkStudents.length} Students
                    </div>
                  </div>

                  {/* Students Table Container */}
                  <div className="rounded-2xl border border-rose-100 overflow-hidden shadow-sm w-full max-w-full">
                    <div className="overflow-x-auto w-full max-w-full">
                      <table className="w-full text-xs font-sans min-w-[550px]">
                        <thead className="bg-rose-50 text-rose-950">
                          <tr>
                            <th className="px-3 py-3 text-left font-extrabold whitespace-nowrap">#</th>
                            <th className="px-3 py-3 text-left font-extrabold whitespace-nowrap">Adm. No</th>
                            <th className="px-3 py-3 text-left font-extrabold whitespace-nowrap">Student Name</th>
                            <th className="px-3 py-3 text-left font-extrabold whitespace-nowrap">Father Name</th>
                            <th className="px-3 py-3 text-left font-extrabold whitespace-nowrap">Center / Branch</th>
                            <th className="px-3 py-3 text-center font-extrabold whitespace-nowrap">Certificate Status</th>
                            <th className="px-3 py-3 text-center font-extrabold whitespace-nowrap">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-rose-50">
                          {paginatedStudents.map((s, i) => (
                            <tr key={s.uid || i} className="bg-white hover:bg-slate-50 transition-colors">
                              <td className="px-3 py-3 text-slate-400 font-semibold">{startIndex + i + 1}</td>
                              <td className="px-3 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                                {s.admNo}
                              </td>
                              <td className="px-3 py-3 font-extrabold text-slate-900 uppercase whitespace-nowrap">{s.candidateName}</td>
                              <td className="px-3 py-3 text-slate-600 uppercase whitespace-nowrap">{s.fatherName}</td>
                              <td className="px-3 py-3 text-slate-700 whitespace-nowrap">{s.trainingCenter}</td>
                              <td className="px-3 py-3 text-center whitespace-nowrap">
                                {s.hasCustomCert ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>Certificate Saved</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    <span>⏳ Pending Entry</span>
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleSelectStudentForCertForm(s)}
                                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-extrabold text-[11px] shadow-xs hover:shadow-md transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Fill / Edit Certificate</span>
                                  </button>
                                  {s.hasCustomCert && (
                                    <button
                                      type="button"
                                      onClick={() => handlePrintStudentCertificate(s)}
                                      className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 transition cursor-pointer"
                                      title="Print / Download Certificate"
                                    >
                                      <Printer className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Pagination Controls */}
                  {filteredBulkStudents.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 px-1 border-t border-rose-100">
                      <div className="text-xs text-slate-500 font-semibold text-center sm:text-left">
                        Showing <span className="font-extrabold text-slate-800">{filteredBulkStudents.length > 0 ? startIndex + 1 : 0}</span> to <span className="font-extrabold text-slate-800">{endIndex}</span> of <span className="font-extrabold text-slate-800">{filteredBulkStudents.length}</span> students
                      </div>

                      <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end w-full sm:w-auto">
                        <div className="flex items-center gap-1 text-xs text-slate-500 font-medium mr-2">
                          <span>Rows:</span>
                          <select
                            value={pageSize}
                            onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                            className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:border-rose-500 cursor-pointer"
                          >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 text-slate-700 font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition shadow-xs cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4 text-slate-600" />
                          <span>Prev</span>
                        </button>

                        <span className="text-xs font-extrabold text-rose-900 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl">
                          Page {currentPage} of {totalPages}
                        </span>

                        <button
                          type="button"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage >= totalPages}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 text-slate-700 font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition shadow-xs cursor-pointer"
                        >
                          <span>Next</span>
                          <ChevronRight className="w-4 h-4 text-slate-600" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── CERTIFICATE ENTRY FORM POPUP MODAL (LIKE 3RD IMAGE) ── */}
      {isCertModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-rose-200 relative overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
            
            {/* Fixed Modal Header */}
            <div className="flex items-center justify-between border-b border-rose-100 px-6 py-4 sm:px-8 sm:py-5 bg-white shrink-0">
              <div>
                <h3 className="text-xs sm:text-sm font-black text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4.5 h-4.5 text-rose-600" /> CUSTOMIZE CERTIFICATE FIELDS
                </h3>
                <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Official Application Form</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCertModalOpen(false)}
                className="p-2 rounded-2xl bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-700 transition cursor-pointer shrink-0"
                title="Close Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-5 sm:p-8 overflow-y-auto flex-1">
              {certSubmitted && (
                <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm font-semibold animate-in slide-in-from-top duration-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>Certificate Saved Successfully! Ready for download.</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handlePrintActiveCertificate}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shrink-0 flex items-center gap-1 transition shadow-sm cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print Certificate
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCertModalOpen(false)}
                      className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleCertFormSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Registration No:
                      <span className="ml-1 text-[10px] font-normal text-rose-500">(Auto-fetch)</span>
                    </label>
                    <div className="relative flex gap-2">
                      <input
                        type="text"
                        required
                        value={certFormData.admNo}
                        onChange={(e) => {
                          handleCertFormChange('admNo', e.target.value);
                          setCertFetchStatus('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            fetchStudentByAdmNo(certFormData.admNo);
                          }
                        }}
                        placeholder="e.g. SLE-202638001"
                        className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => fetchStudentByAdmNo(certFormData.admNo)}
                        title="Fetch student details"
                        className="px-3 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition shrink-0 cursor-pointer"
                      >
                        {certFetchStatus === 'searching' ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Search className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    {certFetchStatus === 'found' && (
                      <p className="mt-1 text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Details fetched successfully!
                      </p>
                    )}
                    {certFetchStatus === 'notfound' && (
                      <p className="mt-1 text-[11px] text-rose-500 font-semibold">
                        ⚠ No student found. Please fill manually.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Candidate Name: <span className="text-rose-600">*</span></label>
                    <input
                      type="text"
                      required
                      value={certFormData.candidateName}
                      onChange={(e) => handleCertFormChange('candidateName', e.target.value)}
                      placeholder="e.g. TEST01"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 uppercase placeholder:text-slate-400 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Son / Daughter / Wife of:</label>
                    <input
                      type="text"
                      value={certFormData.fatherName}
                      onChange={(e) => handleCertFormChange('fatherName', e.target.value)}
                      placeholder="e.g. Parent Name"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 uppercase placeholder:text-slate-400 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Hall Ticket No: <span className="text-[10px] text-slate-400 font-normal">(Optional)</span></label>
                    <input
                      type="text"
                      value={certFormData.htNo}
                      onChange={(e) => handleCertFormChange('htNo', e.target.value)}
                      placeholder={certFormData.admNo || "e.g. SLE2026-ALL-8352"}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Completed Training in (Course):</label>
                    <input
                      type="text"
                      value={certFormData.courseCode || ''}
                      onChange={(e) => handleCertFormChange('courseCode', e.target.value)}
                      placeholder="e.g. TALLY"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 uppercase placeholder:text-slate-400 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">The award of the: (full form of course)</label>
                    <input
                      type="text"
                      value={certFormData.courseTitle || ''}
                      onChange={(e) => handleCertFormChange('courseTitle', e.target.value)}
                      placeholder="e.g. TALLY FINANCIAL ACCOUNTING"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 uppercase placeholder:text-slate-400 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Program Start Date:</label>
                    <input
                      type="date"
                      value={certFormData.startDate}
                      onChange={(e) => handleCertFormChange('startDate', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Program End Date:</label>
                    <input
                      type="date"
                      value={certFormData.endDate}
                      onChange={(e) => handleCertFormChange('endDate', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Grade Obtained:</label>
                    <input
                      type="text"
                      value={certFormData.division}
                      onChange={(e) => handleCertFormChange('division', e.target.value)}
                      placeholder="e.g. FIRST CLASS"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 uppercase placeholder:text-slate-400 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Issue Date:</label>
                    <input
                      type="date"
                      value={certFormData.issueDate}
                      onChange={(e) => handleCertFormChange('issueDate', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Branch Name:</label>
                    <input
                      type="text"
                      value={certFormData.trainingCenter}
                      onChange={(e) => handleCertFormChange('trainingCenter', e.target.value)}
                      placeholder="e.g. MYSORE"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 uppercase placeholder:text-slate-400 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Branch Address:</label>
                    <input
                      type="text"
                      value={certFormData.branchAddress}
                      onChange={(e) => handleCertFormChange('branchAddress', e.target.value)}
                      placeholder="e.g. KARNATAKA"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 uppercase placeholder:text-slate-400 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>

                  {/* Candidate Photo */}
                  <div className="sm:col-span-2 md:col-span-3 border-t border-rose-100 pt-4 mt-2">
                    <label className="block font-bold text-slate-800 mb-2 flex items-center gap-1.5 text-xs">
                      <User className="w-4 h-4 text-rose-600" /> Candidate Photo:
                    </label>
                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <div className="w-20 h-24 bg-white border-2 border-slate-300 rounded-xl overflow-hidden shadow-md shrink-0 flex items-center justify-center relative group">
                        {certFormData.photoUrl ? (
                          <img
                            src={certFormData.photoUrl}
                            alt="Candidate Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-8 h-8 text-slate-400" />
                        )}
                      </div>

                      <div className="space-y-2 flex-1 text-center sm:text-left">
                        <input
                          type="file"
                          accept="image/*"
                          id="cert-page-candidate-photo-input"
                          onChange={(e) => {
                            const file = e.target.files && e.target.files[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                handleCertFormChange('photoUrl', reader.result);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="hidden"
                        />
                        <label
                          htmlFor="cert-page-candidate-photo-input"
                          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-rose-50 text-rose-900 border border-rose-300 hover:border-rose-500 rounded-xl text-xs font-bold shadow-sm cursor-pointer transition"
                        >
                          <Upload className="w-4 h-4 text-rose-600" /> Choose Candidate Image
                        </label>
                        <p className="text-[11px] text-slate-500 font-medium">
                          Select candidate photograph (JPG, PNG, WEBP). This image will appear on the official certificate.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-3 pt-4 border-t border-rose-100">
                  <button
                    type="button"
                    onClick={() => setIsCertModalOpen(false)}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-full font-bold text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer text-center"
                  >
                    Cancel
                  </button>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    {certSubmitted && (
                      <span className="text-emerald-600 text-xs font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Saved!
                      </span>
                    )}
                    <button
                      type="submit"
                      disabled={isSavingCert}
                      onClick={handleCertFormSubmit}
                      className="w-full sm:w-auto bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white px-6 sm:px-8 py-3 rounded-full font-bold text-xs sm:text-sm shadow-lg hover:shadow-xl active:scale-95 transition-all inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSavingCert ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving Certificate...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Save &amp; Submit Certificate Form</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Certificate Print Container for direct printing */}
      {printingCertData && (
        <div className="hidden print:block fixed inset-0 bg-white z-[9999]" ref={certPrintRef}>
          <CertificateTemplate
            initialData={{
              admNo: printingCertData.admNo,
              htNo: printingCertData.htNo,
              candidateName: printingCertData.candidateName,
              fatherName: printingCertData.fatherName,
              course: printingCertData.courseTitle || printingCertData.course,
              courseCode: printingCertData.courseTitle || printingCertData.course,
              courseTitle: printingCertData.courseTitle,
              startDate: printingCertData.startDate,
              endDate: printingCertData.endDate,
              division: printingCertData.division,
              issueDate: printingCertData.issueDate,
              trainingCenter: printingCertData.trainingCenter,
              photoUrl: printingCertData.photoUrl
            }}
            showControls={false}
            isUnlocked={true}
          />
        </div>
      )}
    </div>
  );
}
