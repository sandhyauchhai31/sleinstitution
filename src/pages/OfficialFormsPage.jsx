import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db, collection, getDocs, doc, setDoc, getDoc } from '../firebase';
import { subscribeToCourses, DEFAULT_COURSES } from '../utils/courseManager';
import { getStoredSubjectsForCourse } from '../utils/subjectManager';
import { generateRollNo } from '../utils/examAuthManager';
import { mergeExamMarksIntoSubjects } from '../utils/questionPaperManager';
import { filterStudentsForFranchisee } from '../utils/franchiseeFilter';
import { transferShurapurToShahapur } from '../utils/studentTransfer';
import { getStudentYear, getAvailableYears } from '../utils/studentYearHelper';
import { 
  FileText, 
  Award, 
  BookOpen, 
  Search, 
  Printer, 
  ArrowRight, 
  CheckCircle2, 
  User, 
  Calendar, 
  Building2,
  Sparkles,
  RefreshCw,
  FileCheck,
  Send,
  Download,
  Upload,
  Plus,
  Trash2,
  Users,
  Edit3,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function OfficialFormsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname.toLowerCase();

  // Determine form type from route: 'exam' | 'certificate' | 'marksheet'
  let formType = 'certificate';
  if (path.includes('exam')) formType = 'exam';
  else if (path.includes('marksheet')) formType = 'marksheet';

  const formConfigs = {
    exam: {
      title: 'EXAM FORM',
      subtitle: 'Official Examination Registration & Hall Ticket Lookup',
      btnLabel: 'Exam Form',
      placeholder: 'Enter Admission No'
    },
    certificate: {
      title: 'CERTIFICATE FORM',
      subtitle: 'Course Completion & Merit Certificate Application',
      btnLabel: 'Certificate Form',
      placeholder: 'Enter Admission No'
    },
    marksheet: {
      title: 'MARKSHEET FORM',
      subtitle: 'Statement of Marks & Academic Performance Card',
      btnLabel: 'Marksheet Form',
      placeholder: 'Enter Admission No'
    }
  };

  const currentConfig = formConfigs[formType] || formConfigs.exam;

  const [admissionNo, setAdmissionNo] = useState('');
  const [error, setError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [recordData, setRecordData] = useState(null);

  // Certificate Application Form State (Empty by default)
  const emptyCertFormState = {
    admNo: '',
    htNo: '',
    candidateName: '',
    fatherName: '',
    courseTitle: '',
    startDate: '',
    endDate: '',
    division: '',
    issueDate: '',
    trainingCenter: '',
    branchAddress: '',
    photoUrl: ''
  };

  const [certFormData, setCertFormData] = useState(emptyCertFormState);
  const [certSubmitted, setCertSubmitted] = useState(false);
  const [certFetchStatus, setCertFetchStatus] = useState(''); // 'found' | 'notfound' | 'searching' | ''
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);

  // --- Marksheet Form State ---
  // --- Marksheet Form State ---
  const defaultSubjects = [];
  const emptyMarksheetState = {
    admNo: '', htNo: '', candidateName: '', fatherName: '',
    courseCode: '', startDate: '', endDate: '',
    trainingCenter: '', subjects: []
  };
  const [msFormData, setMsFormData] = useState(emptyMarksheetState);
  const [msSubmitted, setMsSubmitted] = useState(false);
  const [msFetchStatus, setMsFetchStatus] = useState('');
  const [isMsModalOpen, setIsMsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const handleMsChange = (field, value) => setMsFormData(prev => ({ ...prev, [field]: value }));
  const handleMsSubjectChange = (idx, field, value) => {
    setMsFormData(prev => {
      const subjects = [...prev.subjects];
      subjects[idx] = { ...subjects[idx], [field]: value };
      return { ...prev, subjects };
    });
  };
  const handleAddSubject = () => {
    setMsFormData(prev => ({
      ...prev,
      subjects: [...prev.subjects, { name: '', intMax: '40', intObt: '', extMax: '60', extObt: '' }]
    }));
  };
  const handleRemoveSubject = (idx) => {
    setMsFormData(prev => ({
      ...prev,
      subjects: prev.subjects.filter((_, i) => i !== idx)
    }));
  };

  const fetchMarksheetByAdmNo = async (admNo) => {
    if (!admNo.trim()) return;
    setMsFetchStatus('searching');
    const searchKey = admNo.trim().toLowerCase();
    const matchesKey = (r) => [r.registrationNo, r.appNumber, r.admissionNo, r.admNo, r.id]
      .some(f => f && String(f).toLowerCase() === searchKey);
    let found = null;
    for (const key of ['sle_students_cache', 'sle_coaching_students_cache', 'sle_applications_cache']) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try { const recs = JSON.parse(raw); const m = recs.find(matchesKey); if (m) { found = m; break; } } catch (_) {}
    }
    if (!found && db) {
      try {
        for (const col of ['students', 'applications', 'coaching_students']) {
          const snap = await getDocs(collection(db, col));
          snap.forEach(d => { if (!found) { const data = { id: d.id, ...d.data() }; if (matchesKey(data)) found = data; } });
          if (found) break;
        }
      } catch (e) {}
    }
    if (found) {
      const stdCourse = found.course || found.courseName || found.courseTitle || found.courseCode || found.coachingPlan || found.program || found.selectedClass || '';
      const adm = found.registrationNo || found.admissionNo || found.admNo || found.appNumber || found.id || admNo;
      const rollNo = found.rollNo || found.htNo || generateRollNo('2026', stdCourse, adm);

      const storedMarksheets = JSON.parse(localStorage.getItem('sle_registered_marksheets') || '{}');
      let existingMs = storedMarksheets[adm] || storedMarksheets[rollNo];

      if (!existingMs && db && (adm || rollNo)) {
        try {
          const msDoc = await getDoc(doc(db, 'marksheets', (adm || '').toLowerCase()));
          if (msDoc.exists()) {
            existingMs = msDoc.data();
          } else if (rollNo) {
            const msRollDoc = await getDoc(doc(db, 'marksheets', rollNo.toLowerCase()));
            if (msRollDoc.exists()) existingMs = msRollDoc.data();
          }
        } catch (e) {}
      }

      let realSubjects = [];
      if (existingMs && Array.isArray(existingMs.subjects) && existingMs.subjects.length > 0) {
        realSubjects = existingMs.subjects;
      } else {
        const configuredSubjects = getStoredSubjectsForCourse(stdCourse);
        if (Array.isArray(configuredSubjects) && configuredSubjects.length > 0) {
          realSubjects = configuredSubjects.map(s => ({
            name: s.name,
            intMax: s.intMax !== undefined ? String(s.intMax) : '40',
            intObt: s.intObt !== undefined ? String(s.intObt) : '',
            extMax: s.extMax !== undefined ? String(s.extMax) : '60',
            extObt: s.extObt !== undefined ? String(s.extObt) : ''
          }));
        }
      }

      const cachedResults = JSON.parse(localStorage.getItem('sle_exam_results_cache') || '[]');
      const studentResult = cachedResults.find(r => 
        r.registrationNo === rollNo || r.registrationNo === adm || r.studentRollNo === rollNo
      );

      if (!existingMs && studentResult && studentResult.subjectWiseBreakdown) {
        if (realSubjects.length > 0) {
          realSubjects = mergeExamMarksIntoSubjects(realSubjects, studentResult);
        } else {
          realSubjects = Object.values(studentResult.subjectWiseBreakdown).map((s) => ({
            name: s.subject,
            intMax: '40',
            intObt: '',
            extMax: String(s.maxMarks || 60),
            extObt: String(s.marksObtained || 0)
          }));
        }
      }

      setMsFormData(prev => ({
        ...prev,
        admNo: adm,
        htNo: rollNo,
        candidateName: found.name || found.fullName || found.studentName || found.candidateName || prev.candidateName,
        fatherName: found.fatherName || found.parentName || prev.fatherName,
        courseCode: stdCourse || prev.courseCode,
        startDate: found.startDate || found.admissionDate || found.createdDate || prev.startDate,
        endDate: found.endDate || found.completionDate || prev.endDate,
        trainingCenter: found.trustBranch || found.trainingCenter || found.franchiseName || found.branchName || found.place || prev.trainingCenter,
        subjects: realSubjects
      }));
      setMsFetchStatus('found');
    } else { setMsFetchStatus('notfound'); }
  };

  // --- Course-wise Students List for Marksheet ---
  const [coursesList, setCoursesList] = useState(DEFAULT_COURSES);
  const [bulkCourse, setBulkCourse] = useState('ALL');
  const [bulkStudents, setBulkStudents] = useState([]);
  const [isBulkSearching, setIsBulkSearching] = useState(false);
  const [bulkSearched, setBulkSearched] = useState(false);
  const [studentSearchFilter, setStudentSearchFilter] = useState('');
  const [selectedYear, setSelectedYear] = useState('ALL');

  useEffect(() => {
    const unsub = subscribeToCourses((loadedCourses) => {
      if (Array.isArray(loadedCourses) && loadedCourses.length > 0) {
        setCoursesList(loadedCourses.map(c => (typeof c === 'string' ? c : c.name)).filter(Boolean));
      }
    });
    handleBulkSearch('ALL');
    return () => unsub && unsub();
  }, [formType]);

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

      // Special alias matching for GST & other popular course abbreviations
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

    // Canonical key helper to unify document IDs across collections and prevent duplicate counts
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
      const name = String(item.name || item.fullName || item.candidateName || item.studentName || '').trim().toLowerCase();
      const phone = String(item.contactNo || item.mobileNo || item.phone || '').trim();
      if (name && phone && phone !== 'n/a') return `contact_${name}_${phone}`;

      if (rawId) return `id_${rawId}`;
      return '';
    };

    const studentMap = new Map();
    const storedMs = JSON.parse(localStorage.getItem('sle_registered_marksheets') || '{}');
    const storedCerts = JSON.parse(localStorage.getItem('sle_registered_certificates') || '{}');

    const processRecord = (r) => {
      if (!r || !isCourseMatch(r)) return;
      const key = getCanonicalKey(r);
      if (!key) return;

      // Clean canonical registration number
      let canonicalReg = r.registrationNo || r.regNo || r.admNo || r.admissionNo;
      if (!canonicalReg) {
        const idMatch = String(r.id || r.appNumber || '').match(/2026[89]?(\d{3,4})$/);
        if (idMatch) {
          canonicalReg = `202638${idMatch[1]}`;
        } else {
          canonicalReg = r.id || r.appNumber || (key.startsWith('reg_') ? key.replace('reg_', '') : key);
        }
      }

      const uid = canonicalReg;
      const hasMarks = !!(storedMs[uid] || storedMs[r.rollNo] || storedMs[r.htNo] || storedMs[r.registrationNo] || storedMs[r.id]);
      const hasCert = !!(storedCerts[uid] || storedCerts[r.rollNo] || storedCerts[r.htNo] || storedCerts[r.registrationNo] || storedCerts[r.id]);

      const studentObj = {
        ...r,
        uid,
        admNo: uid,
        admissionNo: uid,
        registrationNo: canonicalReg,
        htNo: r.rollNo || r.htNo || r.appNumber || generateRollNo('2026', bulkCourse, uid),
        candidateName: r.name || r.fullName || r.studentName || r.candidateName || 'Candidate',
        fatherName: r.fatherName || r.parentName || '—',
        course: r.course || r.courseName || r.courseTitle || r.courseCode || bulkCourse,
        courseCode: r.course || r.courseName || r.courseTitle || r.courseCode || bulkCourse,
        startDate: r.startDate || r.admissionDate || '',
        endDate: r.endDate || r.completionDate || '',
        trainingCenter: r.trustBranch || r.trainingCenter || r.franchiseName || r.branchName || r.place || 'SLES Center',
        hasCustomMarks: hasMarks,
        hasCustomCert: hasCert
      };

      const existing = studentMap.get(key);
      if (existing) {
        studentMap.set(key, {
          ...existing,
          ...studentObj,
          hasCustomMarks: existing.hasCustomMarks || studentObj.hasCustomMarks,
          hasCustomCert: existing.hasCustomCert || studentObj.hasCustomCert,
          photoUrl: studentObj.photoUrl || existing.photoUrl,
          photo: studentObj.photo || existing.photo
        });
      } else {
        studentMap.set(key, studentObj);
      }
    };

    // 1. Read from local caches first (fastest)
    for (const cacheKey of ['sle_students_cache', 'sle_coaching_students_cache', 'sle_applications_cache']) {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) continue;
      try {
        const recs = JSON.parse(raw);
        if (Array.isArray(recs)) {
          recs.forEach(processRecord);
        }
      } catch (_) {}
    }

    // 2. Fetch live from Firestore database collections to guarantee zero missing records
    if (db) {
      try {
        for (const colName of ['students', 'applications', 'coaching_students']) {
          const snap = await getDocs(collection(db, colName));
          snap.forEach(docSnap => {
            processRecord({ id: docSnap.id, ...docSnap.data() });
          });
        }
      } catch (err) {
        console.warn('Firestore live bulk search notice:', err);
      }
    }

    const found = Array.from(studentMap.values());
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

  const handleSelectStudentForForm = async (student) => {
    const adm = student.admNo || student.admissionNo || student.registrationNo || student.id;
    const stdCourse = student.courseCode || student.course || student.courseName || bulkCourse || '';
    const rollNo = student.htNo || student.rollNo || generateRollNo('2026', stdCourse, adm);

    const storedMarksheets = JSON.parse(localStorage.getItem('sle_registered_marksheets') || '{}');
    let existingMs = storedMarksheets[adm] || storedMarksheets[rollNo];

    if (!existingMs && db && (adm || rollNo)) {
      try {
        const msDocRef = doc(db, 'marksheets', (adm || '').toLowerCase());
        const msDoc = await getDoc(msDocRef);
        if (msDoc.exists()) {
          existingMs = msDoc.data();
        } else if (rollNo) {
          const msRollDocRef = doc(db, 'marksheets', rollNo.toLowerCase());
          const msRollDoc = await getDoc(msRollDocRef);
          if (msRollDoc.exists()) {
            existingMs = msRollDoc.data();
          }
        }
      } catch (err) {
        console.warn('Firestore marksheet fetch notice:', err);
      }
    }

    const courseSubjects = getStoredSubjectsForCourse(stdCourse);
    let initialSubjects = [];

    if (existingMs && existingMs.subjects && existingMs.subjects.length > 0) {
      initialSubjects = existingMs.subjects;
    } else if (courseSubjects && courseSubjects.length > 0) {
      initialSubjects = courseSubjects.map((s) => ({
        name: s.name,
        intMax: s.intMax !== undefined ? String(s.intMax) : '40',
        intObt: s.intObt !== undefined ? String(s.intObt) : '',
        extMax: s.extMax !== undefined ? String(s.extMax) : '60',
        extObt: s.extObt !== undefined ? String(s.extObt) : ''
      }));
    }

    const cachedResults = JSON.parse(localStorage.getItem('sle_exam_results_cache') || '[]');
    const studentResult = cachedResults.find(r => 
      r.registrationNo === rollNo || r.registrationNo === adm || r.studentRollNo === rollNo
    );

    if (!existingMs && studentResult && studentResult.subjectWiseBreakdown) {
      if (initialSubjects.length > 0) {
        initialSubjects = mergeExamMarksIntoSubjects(initialSubjects, studentResult);
      } else {
        initialSubjects = Object.values(studentResult.subjectWiseBreakdown).map((s) => ({
          name: s.subject,
          intMax: '40',
          intObt: '',
          extMax: String(s.maxMarks || 60),
          extObt: String(s.marksObtained || 0)
        }));
      }
    }

    setMsFormData({
      admNo: adm,
      htNo: rollNo,
      candidateName: student.candidateName || student.name || student.studentName || '',
      fatherName: student.fatherName || student.parentName || '',
      photoUrl: student.photoUrl || student.photo || student.photoPreview || student.candidatePhoto || '',
      courseCode: stdCourse,
      startDate: student.startDate || student.admissionDate || '2025-01-01',
      endDate: student.endDate || student.completionDate || '2026-01-01',
      trainingCenter: student.trainingCenter || student.branchName || student.trustBranch || 'SLES Center',
      subjects: initialSubjects
    });

    setMsFetchStatus('found');
    setMsSubmitted(false);
    setIsMsModalOpen(true);
  };

  const handleSelectStudentForCertForm = (student) => {
    const adm = student.admNo || student.admissionNo || student.registrationNo || student.id;
    const stdCourse = student.courseCode || student.course || student.courseName || bulkCourse || '';
    const rollNo = student.htNo || student.rollNo || generateRollNo('2026', stdCourse, adm);

    const storedCerts = JSON.parse(localStorage.getItem('sle_registered_certificates') || '{}');
    const existingCert = storedCerts[adm] || storedCerts[rollNo];

    if (existingCert) {
      setCertFormData(existingCert);
    } else {
      setCertFormData({
        admNo: adm,
        htNo: rollNo,
        candidateName: student.candidateName || student.name || student.studentName || '',
        fatherName: student.fatherName || student.parentName || '',
        courseTitle: stdCourse,
        startDate: student.startDate || student.admissionDate || '2025-01-01',
        endDate: student.endDate || student.completionDate || '2026-01-01',
        division: 'FIRST CLASS',
        issueDate: new Date().toISOString().split('T')[0],
        trainingCenter: student.trainingCenter || student.branchName || student.trustBranch || 'MYSORE',
        branchAddress: student.branchAddress || student.place || student.location || 'KARNATAKA',
        photoUrl: student.photoUrl || ''
      });
    }

    setCertFetchStatus('found');
    setCertSubmitted(false);
    setIsCertModalOpen(true);
  };

  const handleMsSubmit = async (e) => {
    e.preventDefault();
    const stored = JSON.parse(localStorage.getItem('sle_registered_marksheets') || '{}');
    const key = msFormData.admNo.trim() || msFormData.htNo.trim();
    if (key) stored[key] = msFormData;
    localStorage.setItem('sle_registered_marksheets', JSON.stringify(stored));
    
    // Save to Firestore 'marksheets' collection for cross-device access
    if (db && key) {
      try {
        await setDoc(doc(db, 'marksheets', key.toLowerCase()), msFormData, { merge: true });
        if (msFormData.htNo && msFormData.htNo.trim().toLowerCase() !== key.toLowerCase()) {
          await setDoc(doc(db, 'marksheets', msFormData.htNo.trim().toLowerCase()), msFormData, { merge: true });
        }
      } catch (err) {
        console.warn('Firestore marksheet save error:', err);
      }
    }

    // Update local bulkStudents status if loaded
    setBulkStudents(prev => prev.map(s => {
      if (s.admNo === msFormData.admNo || s.htNo === msFormData.htNo) {
        return { ...s, hasCustomMarks: true };
      }
      return s;
    }));

    setMsSubmitted(true);
    setMsFetchStatus('');
    setMsFormData(emptyMarksheetState);
  };

  const handleCertFormChange = (field, value) => {
    setCertFormData(prev => ({ ...prev, [field]: value }));
  };

  // Auto-fetch student details from local cache + Firestore by Admission Number
  const fetchStudentByAdmNo = async (admNo) => {
    if (!admNo.trim()) return;
    setCertFetchStatus('searching');

    const searchKey = admNo.trim().toLowerCase();

    // Helper: check if a record matches by any ID field
    const matchesKey = (r) => {
      const fields = [
        r.registrationNo, r.appNumber, r.admissionNo,
        r.admNo, r.studentId, r.rollNo, r.htNo, r.id
      ];
      return fields.some(f => f && String(f).toLowerCase() === searchKey);
    };

    let found = null;

    // 1. Search localStorage caches first (fastest)
    const cacheKeys = ['sle_students_cache', 'sle_coaching_students_cache'];
    for (const key of cacheKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const records = JSON.parse(raw);
        const match = records.find(matchesKey);
        if (match) { found = match; break; }
      } catch (_) {}
    }

    // 2. If not found locally, search Firestore directly
    if (!found && db) {
      try {
        const collections = ['students', 'applications', 'coaching_students'];
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
      setCertFormData(prev => ({
        ...prev,
        admNo: found.registrationNo || found.admissionNo || found.admNo || found.appNumber || found.id || admNo,
        htNo: found.rollNo || found.htNo || found.examRollNo || prev.htNo,
        candidateName: found.name || found.fullName || found.studentName || found.candidateName || prev.candidateName,
        fatherName: found.fatherName || found.parentName || found.guardianName || prev.fatherName,
        courseTitle: found.course || found.courseName || found.courseTitle || found.courseCode || found.coachingPlan || found.program || found.selectedClass || prev.courseTitle,
        startDate: found.startDate || found.joiningDate || found.admissionDate || found.createdDate || prev.startDate,
        endDate: found.endDate || found.completionDate || prev.endDate,
        trainingCenter: found.trustBranch || found.examCenter || found.trainingCenter || found.branchName || found.franchiseName || found.place || found.center || prev.trainingCenter,
        photoUrl: found.photoUrl || found.photoPreview || found.photo || found.candidatePhoto || prev.photoUrl,
      }));
      setCertFetchStatus('found');
    } else {
      setCertFetchStatus('notfound');
    }
  };

  const handleCertFormSubmit = (e) => {
    e.preventDefault();
    // Save certificate data to localStorage so Download -> Certificate can retrieve it
    const storedCertificates = JSON.parse(localStorage.getItem('sle_registered_certificates') || '{}');
    if (certFormData.admNo.trim()) {
      storedCertificates[certFormData.admNo.trim()] = certFormData;
    }
    if (certFormData.htNo.trim()) {
      storedCertificates[certFormData.htNo.trim()] = certFormData;
    }
    localStorage.setItem('sle_registered_certificates', JSON.stringify(storedCertificates));

    // Update local bulkStudents status if loaded
    setBulkStudents(prev => prev.map(s => {
      if (s.admNo === certFormData.admNo || s.htNo === certFormData.htNo) {
        return { ...s, hasCustomCert: true };
      }
      return s;
    }));

    setCertSubmitted(true);
    setCertFetchStatus('');
    setCertFormData(emptyCertFormState); // Reset form to empty after submit
  };

  // Mock lookup database
  const sampleDatabase = {
    '1': {
      admissionNo: '1',
      candidateName: 'Kavita',
      fatherName: 'Anand',
      motherName: 'Gojabai',
      selectedClass: '10th',
      courseName: 'Navodaya / State Board Special Batch',
      examCenter: 'Athani Main Campus - Center #04',
      examSession: 'Annual Board Exam 2026',
      examDate: '15th March 2026 (10:00 AM - 1:00 PM)',
      rollNo: 'EXAM-2026-9041',
      status: 'Admit Card Generated & Verified',
      place: 'Athani'
    },
    'SLE-2026-101': {
      admissionNo: 'SLE-2026-101',
      candidateName: 'Prajwal Kumar M',
      fatherName: 'Manjunatha K',
      motherName: 'Latha M',
      selectedClass: '10th',
      courseName: 'CBSE Secondary Coaching',
      examCenter: 'Mysuru Main Campus - Hall B',
      examSession: 'Mid-Term Assessment 2026',
      examDate: '20th March 2026 (02:00 PM - 5:00 PM)',
      rollNo: 'EXAM-2026-8812',
      status: 'Admit Card Generated & Verified',
      place: 'Mysuru'
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setError('');
    
    if (!admissionNo.trim()) {
      setError('Please enter a valid Admission No (e.g. 1 or SLE-2026-101).');
      return;
    }

    setIsSearching(true);
    setTimeout(() => {
      setIsSearching(false);
      const searchKey = admissionNo.trim();
      const found = sampleDatabase[searchKey] || {
        admissionNo: searchKey,
        candidateName: 'Kavita',
        fatherName: 'Anand',
        motherName: 'Gojabai',
        selectedClass: '10th',
        courseName: 'Coaching Class 10th Standard',
        examCenter: 'Athani Campus Examination Hall',
        examSession: 'Final Term Exam 2026',
        examDate: '15th March 2026',
        rollNo: 'EXAM-2026-' + Math.floor(1000 + Math.random() * 9000),
        status: 'Generated & Active',
        place: 'Athani'
      };
      setRecordData(found);
    }, 600);
  };

  return (
    <div className="py-5 sm:py-8 px-3 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-200 w-full max-w-[100vw] overflow-x-hidden">
      
      {/* Crimson Banner matching SLE Color Theme */}
      <div className="gradient-banner rounded-3xl py-6 px-4 sm:py-8 sm:px-8 shadow-xl border border-rose-800/40 text-center text-white relative overflow-hidden w-full max-w-[calc(100vw-1.5rem)] sm:max-w-full mx-auto min-w-0">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 space-y-1">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-black tracking-wide sm:tracking-widest uppercase font-serif drop-shadow-md break-words">
            {currentConfig.title}
          </h2>
          <p className="text-rose-100 font-medium text-xs sm:text-sm max-w-xl mx-auto">
            {currentConfig.subtitle}
          </p>
        </div>
      </div>

      {/* CERTIFICATE & MARKSHEET FORMS WITH COURSE-WISE STUDENTS LIST */}
      {(formType === 'certificate' || formType === 'marksheet') ? (
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
                    {formType === 'certificate' 
                      ? 'Choose a course to list all enrolled students and customize their certificate details.'
                      : 'Choose a course to list all enrolled students and enter or edit their marksheet marks.'
                    }
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
                      if (sel && sel !== 'ALL') {
                        const realSubs = getStoredSubjectsForCourse(sel);
                        setMsFormData(prev => ({
                          ...prev,
                          courseCode: sel,
                          subjects: realSubs.map(s => ({
                            name: s.name,
                            intMax: s.intMax !== undefined ? String(s.intMax) : '40',
                            intObt: '',
                            extMax: s.extMax !== undefined ? String(s.extMax) : '60',
                            extObt: ''
                          }))
                        }));
                      }
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
                      Make sure students are registered under this course through the admission form.
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
                              <th className="px-3 py-3 text-left font-extrabold whitespace-nowrap">Adm. / Roll No</th>
                              <th className="px-3 py-3 text-left font-extrabold whitespace-nowrap">Student Name</th>
                              <th className="px-3 py-3 text-left font-extrabold whitespace-nowrap">Father Name</th>
                              <th className="px-3 py-3 text-left font-extrabold whitespace-nowrap">Center / Branch</th>
                              <th className="px-3 py-3 text-center font-extrabold whitespace-nowrap">
                                {formType === 'certificate' ? 'Certificate Status' : 'Marks Status'}
                              </th>
                              <th className="px-3 py-3 text-center font-extrabold whitespace-nowrap">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-rose-50">
                            {paginatedStudents.map((s, i) => (
                              <tr key={s.uid} className="bg-white hover:bg-slate-50 transition-colors">
                                <td className="px-3 py-3 text-slate-400 font-semibold">{startIndex + i + 1}</td>
                                <td className="px-3 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                                  <div>{s.admNo}</div>
                                  {s.htNo && s.htNo !== s.admNo && (
                                    <div className="text-[10px] text-rose-600 font-mono">{s.htNo}</div>
                                  )}
                                </td>
                                <td className="px-3 py-3 font-extrabold text-slate-900 uppercase whitespace-nowrap">{s.candidateName}</td>
                                <td className="px-3 py-3 text-slate-600 uppercase whitespace-nowrap">{s.fatherName}</td>
                                <td className="px-3 py-3 text-slate-700 whitespace-nowrap">{s.trainingCenter}</td>
                                <td className="px-3 py-3 text-center whitespace-nowrap">
                                  {formType === 'certificate' ? (
                                    s.hasCustomCert ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        <span>Certificate Saved</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                        <span>⏳ Pending Entry</span>
                                      </span>
                                    )
                                  ) : (
                                    s.hasCustomMarks ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        <span>Marks Saved</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                        <span>⏳ Pending Entry</span>
                                      </span>
                                    )
                                  )}
                                </td>
                                <td className="px-3 py-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (formType === 'certificate') {
                                        handleSelectStudentForCertForm(s);
                                      } else {
                                        handleSelectStudentForForm(s);
                                      }
                                    }}
                                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-extrabold text-[11px] shadow-xs hover:shadow-md transition cursor-pointer flex items-center gap-1.5 mx-auto whitespace-nowrap"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>{formType === 'certificate' ? 'Fill / Edit Certificate' : 'Fill / Edit Marks'}</span>
                                  </button>
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

          {/* ── CERTIFICATE ENTRY FORM POPUP MODAL ── */}
          {isCertModalOpen && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-8 shadow-2xl border border-rose-200 relative overflow-hidden my-auto max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-rose-100 pb-4 mb-6 sticky -top-5 sm:-top-8 bg-white z-10 pt-2">
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

                {certSubmitted && (
                  <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold animate-in slide-in-from-top duration-200">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>Certificate Application Form Submitted Successfully! Ready for download.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate('/downloads/certificate')}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shrink-0 flex items-center gap-1 transition shadow-sm cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> Go to Download
                      </button>
                      <button onClick={() => setIsCertModalOpen(false)} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer">
                        Close
                      </button>
                    </div>
                  </div>
                )}

                <form onSubmit={handleCertFormSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Registration No:
                        <span className="ml-2 text-[10px] font-normal text-rose-500">(Enter to auto-fetch details)</span>
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
                          placeholder="e.g. ARG013023"
                          className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
                        />
                        <button
                          type="button"
                          onClick={() => fetchStudentByAdmNo(certFormData.admNo)}
                          title="Fetch student details"
                          className="px-3 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition shrink-0"
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
                          <CheckCircle2 className="w-3.5 h-3.5" /> Student details fetched successfully!
                        </p>
                      )}
                      {certFetchStatus === 'notfound' && (
                        <p className="mt-1 text-[11px] text-rose-500 font-semibold">
                          ⚠ No student found with this Admission No. Please fill manually.
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Hall Ticket No:</label>
                      <input
                        type="text"
                        required
                        value={certFormData.htNo}
                        onChange={(e) => handleCertFormChange('htNo', e.target.value)}
                        placeholder="e.g. SLE00022"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Candidate Name:</label>
                      <input
                        type="text"
                        required
                        value={certFormData.candidateName}
                        onChange={(e) => handleCertFormChange('candidateName', e.target.value)}
                        placeholder="e.g. SHIVASHANKARAYYA BABALADIMATH"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 uppercase placeholder:text-slate-400 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Son / Daughter / Wife of:</label>
                      <input
                        type="text"
                        required
                        value={certFormData.fatherName}
                        onChange={(e) => handleCertFormChange('fatherName', e.target.value)}
                        placeholder="e.g. KARUMANIDHI"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 uppercase placeholder:text-slate-400 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Full Course Title:</label>
                      <input
                        type="text"
                        required
                        value={certFormData.courseTitle}
                        onChange={(e) => handleCertFormChange('courseTitle', e.target.value)}
                        placeholder="e.g. POST GRADUATE DIPLOMA IN COMPUTER APPLICATION"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 uppercase placeholder:text-slate-400 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Program Start Date:</label>
                      <input
                        type="date"
                        required
                        value={certFormData.startDate}
                        onChange={(e) => handleCertFormChange('startDate', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Program End Date:</label>
                      <input
                        type="date"
                        required
                        value={certFormData.endDate}
                        onChange={(e) => handleCertFormChange('endDate', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Grade Obtained:</label>
                      <input
                        type="text"
                        required
                        value={certFormData.division}
                        onChange={(e) => handleCertFormChange('division', e.target.value)}
                        placeholder="e.g. FIRST CLASS / DISTINCTION"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 uppercase placeholder:text-slate-400 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Issue Date:</label>
                      <input
                        type="date"
                        required
                        value={certFormData.issueDate}
                        onChange={(e) => handleCertFormChange('issueDate', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Branch Name:</label>
                      <input
                        type="text"
                        required
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

                    {/* CHOOSE CANDIDATE IMAGE FIELD */}
                    <div className="sm:col-span-3 border-t border-rose-100 pt-4 mt-2">
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
                            id="candidate-photo-file-input"
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
                            htmlFor="candidate-photo-file-input"
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

                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 pt-4 border-t border-rose-100">
                    <button
                      type="button"
                      onClick={() => setIsCertModalOpen(false)}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-full font-bold text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer text-center"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="w-full sm:w-auto gradient-button text-white px-6 sm:px-8 py-3 rounded-full font-bold text-xs sm:text-sm shadow-lg hover:scale-105 transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Send className="w-4 h-4" /> Save &amp; Submit Certificate Form
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── MARKSHEET ENTRY FORM POPUP MODAL ── */}
          {isMsModalOpen && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
              <div id="marksheet-entry-form-card" className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-8 shadow-2xl border border-rose-200 relative overflow-hidden my-auto max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-rose-100 pb-4 mb-6 sticky -top-5 sm:-top-8 bg-white z-10 pt-2">
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4.5 h-4.5 text-rose-600" /> MARKSHEET FORM — Subject Marks Entry
                    </h3>
                    <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Enter or edit marks for candidate</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMsModalOpen(false)}
                    className="p-2 rounded-2xl bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-700 transition cursor-pointer shrink-0"
                    title="Close Modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {msSubmitted && (
                  <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold animate-in slide-in-from-top duration-200">
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-600" /><span>Marksheet Submitted! Go to Download → Marksheet to print.</span></div>
                    <button onClick={() => navigate('/downloads/marksheet')} className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shrink-0 flex items-center gap-1 transition shadow-sm"><Download className="w-3.5 h-3.5" /> Download</button>
                  </div>
                )}

                <form onSubmit={handleMsSubmit} className="space-y-6">
                  {/* Student Info Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                    {/* Adm No with fetch */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Registration No: <span className="ml-1 text-[10px] font-normal text-rose-500">(Enter to auto-fetch)</span></label>
                      <div className="flex gap-2">
                        <input type="text" required value={msFormData.admNo}
                          onChange={e => { handleMsChange('admNo', e.target.value); setMsFetchStatus(''); }}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); fetchMarksheetByAdmNo(msFormData.admNo); }}}
                          placeholder="e.g. 202638001"
                          className="flex-1 px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-400/20 text-xs" />
                        <button type="button" onClick={() => fetchMarksheetByAdmNo(msFormData.admNo)}
                          className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center transition shrink-0">
                          {msFetchStatus === 'searching' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      {msFetchStatus === 'found' && <p className="mt-1 text-[11px] text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Fetched!</p>}
                      {msFetchStatus === 'notfound' && <p className="mt-1 text-[11px] text-rose-500 font-semibold">⚠ Not found. Fill manually.</p>}
                    </div>
                    <div><label className="block font-bold text-slate-700 mb-1 text-xs">Hall Ticket No:</label>
                      <input type="text" value={msFormData.htNo} onChange={e => handleMsChange('htNo', e.target.value)} placeholder="e.g. SLE00022" className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 text-xs focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-400/20" /></div>
                    <div><label className="block font-bold text-slate-700 mb-1 text-xs">Candidate Name:</label>
                      <input type="text" required value={msFormData.candidateName} onChange={e => handleMsChange('candidateName', e.target.value)} placeholder="Full Name" className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 uppercase text-xs focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-400/20" /></div>
                    <div><label className="block font-bold text-slate-700 mb-1 text-xs">Son / Daughter / Wife of:</label>
                      <input type="text" required value={msFormData.fatherName} onChange={e => handleMsChange('fatherName', e.target.value)} placeholder="Father / Guardian Name" className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 uppercase text-xs focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-400/20" /></div>
                    <div><label className="block font-bold text-slate-700 mb-1 text-xs">Course Code:</label>
                      <input
                        type="text"
                        required
                        value={msFormData.courseCode}
                        onChange={e => {
                          const val = e.target.value;
                          handleMsChange('courseCode', val);
                          if (val.trim()) {
                            const realSubs = getStoredSubjectsForCourse(val);
                            if (realSubs && realSubs.length > 0) {
                              setMsFormData(prev => ({
                                ...prev,
                                courseCode: val,
                                subjects: realSubs.map(s => ({
                                  name: s.name,
                                  intMax: s.intMax !== undefined ? String(s.intMax) : '40',
                                  intObt: '',
                                  extMax: s.extMax !== undefined ? String(s.extMax) : '60',
                                  extObt: ''
                                }))
                              }));
                            }
                          }
                        }}
                        placeholder="e.g. PGDCA"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 uppercase text-xs focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-400/20"
                      />
                    </div>
                    <div><label className="block font-bold text-slate-700 mb-1 text-xs">Training Center:</label>
                      <input type="text" value={msFormData.trainingCenter} onChange={e => handleMsChange('trainingCenter', e.target.value)} placeholder="Center Name" className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 text-xs focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-400/20" /></div>
                    <div><label className="block font-bold text-slate-700 mb-1 text-xs">Program Start Date:</label>
                      <input type="date" value={msFormData.startDate} onChange={e => handleMsChange('startDate', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 text-xs focus:outline-none focus:border-rose-500" /></div>
                    <div><label className="block font-bold text-slate-700 mb-1 text-xs">Program End Date:</label>
                      <input type="date" value={msFormData.endDate} onChange={e => handleMsChange('endDate', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 text-xs focus:outline-none focus:border-rose-500" /></div>
                  </div>

                  {/* Subject Marks Table */}
                  <div className="border-t border-rose-100 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider">Subject-wise Marks</h4>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-rose-200">
                      <table className="w-full text-xs font-sans border-collapse">
                        <thead className="bg-rose-50">
                          <tr>
                            <th className="border border-rose-200 px-2 py-2 text-center font-bold text-slate-500 w-8">#</th>
                            <th className="border border-rose-200 px-3 py-2 text-left font-bold text-slate-700">Subject</th>
                            <th className="border border-rose-200 px-3 py-2 text-center font-bold text-slate-700">Int. Max</th>
                            <th className="border border-rose-200 px-3 py-2 text-center font-bold text-slate-700">Int. Obt.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {msFormData.subjects.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-8 text-center text-slate-400 font-semibold text-xs bg-slate-50/40">
                                Select a course or enter a student's Admission No above to load real course subjects.
                              </td>
                            </tr>
                          ) : (
                            msFormData.subjects.map((row, idx) => (
                              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-rose-50/30'}>
                                <td className="border border-rose-200 px-2 py-2 text-center text-slate-400 font-bold select-none">{idx + 1}</td>
                                <td className="border border-rose-200 px-3 py-2 font-bold text-slate-800">
                                  {row.name}
                                </td>
                                <td className="border border-rose-200 px-2 py-2 text-center font-bold text-slate-700 bg-slate-50/40 select-none">
                                  {row.intMax !== undefined && row.intMax !== '' ? row.intMax : 40}
                                </td>
                                <td className="border border-rose-200 px-2 py-1 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    max={row.intMax || 40}
                                    value={row.intObt}
                                    onChange={e => handleMsSubjectChange(idx, 'intObt', e.target.value)}
                                    placeholder="0"
                                    className="w-20 text-center bg-transparent font-semibold text-slate-800 focus:outline-none focus:bg-rose-50 rounded py-1"
                                  />
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        {/* Grand Total Row */}
                        {msFormData.subjects.length > 0 && (
                          <tfoot className="bg-rose-50">
                            <tr>
                              <td colSpan={2} className="border border-rose-200 px-3 py-2 font-bold text-slate-700 text-right">Grand Total</td>
                              <td className="border border-rose-200 px-2 py-2 text-center font-bold text-slate-700">
                                {msFormData.subjects.reduce((s, r) => s + (Number(r.intMax) || 0), 0)}
                              </td>
                              <td className="border border-rose-200 px-2 py-2 text-center font-bold text-rose-700">
                                {msFormData.subjects.reduce((s, r) => s + (Number(r.intObt) || 0), 0) || ''}
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsMsModalOpen(false)}
                      className="px-5 py-2.5 rounded-full font-bold text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="gradient-button px-8 py-2.5 rounded-full font-bold text-xs text-white shadow-lg transition flex items-center gap-2 cursor-pointer">
                      <FileText className="w-4 h-4" /> Save &amp; Submit Marksheet
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* EXAM FORM / DEFAULT */
        <>
          <div className="max-w-2xl mx-auto">
            <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-10 shadow-2xl border-4 border-slate-900/90 relative overflow-hidden transition-all">
              
              <form onSubmit={handleSearch} className="space-y-6 text-center py-4">
                
                <div className="space-y-2">
                  <label className="block text-sm sm:text-base font-bold text-slate-800">
                    Admission No:
                  </label>
                  <div className="max-w-md mx-auto relative">
                    <input
                      type="text"
                      value={admissionNo}
                      onChange={(e) => setAdmissionNo(e.target.value)}
                      placeholder={currentConfig.placeholder}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 text-center shadow-inner font-medium transition-all"
                    />
                  </div>
                  {error && (
                    <p className="text-xs text-rose-600 font-semibold mt-1">
                      {error}
                    </p>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="gradient-button text-white px-8 py-2.5 rounded-full font-bold text-xs sm:text-sm shadow-lg hover:scale-105 active:scale-95 transition-all inline-flex items-center gap-2 disabled:opacity-60"
                  >
                    {isSearching ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /><span>Searching Record...</span></>
                    ) : (
                      <span>{currentConfig.btnLabel}</span>
                    )}
                  </button>
                </div>

              </form>

            </div>
          </div>

          {/* RESULT CARD */}
          {recordData && (
            <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-6 animate-in slide-in-from-bottom-4 duration-200">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center font-bold">
                    <FileCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">{currentConfig.title} - Candidate Record</h3>
                    <p className="text-xs text-rose-600 font-semibold">Status: {recordData.status}</p>
                  </div>
                </div>
                <button onClick={() => window.print()} className="px-4 py-2 bg-slate-900 hover:bg-rose-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow">
                  <Printer className="w-4 h-4" /> Print Document
                </button>
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-xs sm:text-sm space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><p className="text-slate-400 font-bold uppercase text-[10px]">Admission No</p><p className="font-bold text-slate-900 text-base">{recordData.admissionNo}</p></div>
                  <div><p className="text-slate-400 font-bold uppercase text-[10px]">Candidate Name</p><p className="font-extrabold text-rose-600 text-base">{recordData.candidateName}</p></div>
                  <div><p className="text-slate-400 font-bold uppercase text-[10px]">Father's Name</p><p className="font-semibold text-slate-800">{recordData.fatherName}</p></div>
                  <div><p className="text-slate-400 font-bold uppercase text-[10px]">Class / Program</p><p className="font-semibold text-slate-800">{recordData.selectedClass} ({recordData.courseName})</p></div>
                  <div><p className="text-slate-400 font-bold uppercase text-[10px]">Center / Location</p><p className="font-semibold text-slate-800">{recordData.examCenter}</p></div>
                  <div><p className="text-slate-400 font-bold uppercase text-[10px]">Exam Session / Schedule</p><p className="font-semibold text-slate-800">{recordData.examDate}</p></div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}
