import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Building2,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Eye,
  RefreshCw,
  TrendingUp,
  ArrowUpDown,
  FileText,
  X,
  ChevronRight,
  ChevronLeft,
  Calendar,
  GraduationCap,
  CreditCard,
  BadgeCheck,
  Phone,
  Mail,
  MapPin,
  User,
  Check,
  Download,
  Loader2,
  Award,
  Printer,
  Trash2,
  Edit3,
  Save,
  BookOpen,
  FileCheck,
  Upload,
  Crop
} from 'lucide-react';
import { db, collection, getDocs, deleteDoc, doc, setDoc, getDoc } from '../firebase';
import { subscribeToBranches, deleteBranch, DEFAULT_BRANCHES, restoreShahapurBranch } from '../utils/branchManager';
import { subscribeToCourses, DEFAULT_COURSES, getCourseDisplayLabel } from '../utils/courseManager';
import { getShahapurStudentsFull } from '../utils/shahapurStudentsData';
import { normalizeBranch } from '../utils/franchiseeFilter';
import { getStudentYear, getAvailableYears } from '../utils/studentYearHelper';
import ImageCropperModal from './ImageCropperModal';

export default function BranchwiseStudents({ isDarkMode = false, showToast = () => { }, defaultCertMode = false }) {
  // State for raw student list & franchisee list
  const [rawStudents, setRawStudents] = useState([]);
  const [franchisees, setFranchisees] = useState([]);
  const [dynamicBranches, setDynamicBranches] = useState(DEFAULT_BRANCHES);
  const [dynamicCourses, setDynamicCourses] = useState(DEFAULT_COURSES);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Active Registry Mode: 'general' | 'certificate'
  const [activeRegistryMode, setActiveRegistryMode] = useState(defaultCertMode ? 'certificate' : 'general');
  const [certStudents, setCertStudents] = useState([]);
  const [certLoading, setCertLoading] = useState(false);

  // Load Certificate Students
  const fetchCertStudents = async (isManual = false) => {
    setCertLoading(true);
    try {
      const cached = JSON.parse(localStorage.getItem('sle_cert_students_cache') || '[]');
      const cleanedCached = cached.filter(s => {
        if (s.isRestored && !s.isCertificateStudent && s.type !== 'certificate_admission') return false;
        const reg = String(s.certRegNo || s.registrationNo || s.regNo || s.id || '');
        if (reg.startsWith('202638') && !s.isCertificateStudent && s.type !== 'certificate_admission' && !s.certRegNo) return false;
        return true;
      });
      if (cleanedCached.length !== cached.length) {
        try { localStorage.setItem('sle_cert_students_cache', JSON.stringify(cleanedCached)); } catch (e) {}
      }
      setCertStudents(cleanedCached);

      if (db) {
        const snap = await getDocs(collection(db, 'cert_students'));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const validList = list.filter(s => {
          if (s.isRestored && !s.isCertificateStudent && s.type !== 'certificate_admission') {
            deleteDoc(doc(db, 'cert_students', s.id)).catch(() => {});
            return false;
          }
          const reg = String(s.certRegNo || s.registrationNo || s.regNo || s.id || '');
          if (reg.startsWith('202638') && !s.isCertificateStudent && s.type !== 'certificate_admission' && !s.certRegNo) {
            deleteDoc(doc(db, 'cert_students', s.id)).catch(() => {});
            return false;
          }
          return true;
        });
        const sorted = validList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setCertStudents(sorted);
        try { localStorage.setItem('sle_cert_students_cache', JSON.stringify(sorted)); } catch (e) {}
      }
      if (isManual) {
        showToast('Synced certificate admissions!', 'success');
      }
    } catch (e) {
      console.log('Cert students load error:', e);
    } finally {
      setCertLoading(false);
    }
  };

  useEffect(() => {
    fetchCertStudents(false);
  }, []);

  useEffect(() => {
    setActiveRegistryMode(defaultCertMode ? 'certificate' : 'general');
    setSelectedBranch('All');
    setSearchQuery('');
    setSelectedCourse('All');
    setSelectedStatus('All');
    setCurrentPage(1);
  }, [defaultCertMode]);

  // Subscribe to dynamic branches & ensure Shahapur is restored
  useEffect(() => {
    restoreShahapurBranch();
    const unsub = subscribeToBranches((branchesList) => {
      if (Array.isArray(branchesList) && branchesList.length > 0) {
        setDynamicBranches(branchesList.map(b => (typeof b === 'string' ? b : b.name)).filter(Boolean));
      }
    });
    return () => unsub && unsub();
  }, []);

  // Subscribe to dynamic courses
  useEffect(() => {
    const unsub = subscribeToCourses((coursesList) => {
      if (Array.isArray(coursesList) && coursesList.length > 0) {
        setDynamicCourses(coursesList.map(c => (typeof c === 'string' ? c : c.name)).filter(Boolean));
      }
    });
    return () => unsub && unsub();
  }, []);

  // Filters State
  const [selectedBranch, setSelectedBranch] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');

  // Sorting & Pagination State
  const [sortField, setSortField] = useState('admissionDate');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);

  // Student Details Modal/Drawer State
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // DOB Dropdown Option Lists
  const daysList = useMemo(() => Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')), []);
  const monthsList = useMemo(() => [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ], []);
  const yearsList = useMemo(() => Array.from({ length: 45 }, (_, i) => String(2026 - i)), []);

  // Edit Application Form Modal State
  const [editingStudent, setEditingStudent] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [cropModalData, setCropModalData] = useState(null);
  const [editFormData, setEditFormData] = useState({
    registrationNo: '',
    admissionDate: '',
    selectedClass: '10th',
    trainingPlan: 'Regular',
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
    franchiseeId: '',
    photoPreview: '',
    aadharPreview: '',
    marksheetPreview: ''
  });

  const getSafeStringUrl = (val) => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      if (typeof val.url === 'string') return val.url;
      if (typeof val.src === 'string') return val.src;
    }
    return String(val);
  };

  const isPdfDoc = (val) => {
    if (!val || typeof val !== 'string') return false;
    const lower = val.toLowerCase();
    return lower.includes('.pdf') || lower.startsWith('data:application/pdf');
  };

  const handleOpenEditModal = (student) => {
    if (!student) return;
    setEditingStudent(student);

    // Extract DOB parts if available
    let dDay = student.dobDay || '';
    let dMonth = student.dobMonth || '';
    let dYear = student.dobYear || '';
    if ((!dDay || !dMonth || !dYear) && student.dateOfBirth) {
      const parts = String(student.dateOfBirth).split('-');
      if (parts.length === 3) {
        dYear = parts[0];
        dMonth = parts[1];
        dDay = parts[2];
      }
    }

    const rawAdmissionDate = student.admissionDate || student.createdDate || '';
    let formattedAdmissionDate = '';
    if (rawAdmissionDate) {
      const dmyMatch = String(rawAdmissionDate).match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
      if (dmyMatch) {
        formattedAdmissionDate = `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
      } else {
        formattedAdmissionDate = String(rawAdmissionDate).split('T')[0];
      }
    } else {
      formattedAdmissionDate = new Date().toISOString().split('T')[0];
    }

    setEditFormData({
      registrationNo: student.registrationNo || student.admNo || '',
      admissionDate: formattedAdmissionDate,
      selectedClass: student.selectedClass || student.class || '10th',
      trainingPlan: student.trainingPlan || 'Regular',
      fullName: student.fullName || student.name || '',
      fatherName: student.fatherName || '',
      dobDay: dDay,
      dobMonth: dMonth,
      dobYear: dYear,
      casteCategory: student.casteCategory || student.caste || '',
      address: student.address || '',
      email: student.email || '',
      contactNo: student.contactNo || student.mobileNo || student.phone || '',
      aadharNo: student.aadharNo || student.aadharCardNumber || student.aadharNumber || '',
      sslcMarksNo: student.sslcMarksNo || student.sslcRollNo || student.marksheetNo || '',
      qualification: student.qualification || student.standard || '',
      course: student.course || student.selectedClass || 'GST',
      trustBranch: student.trustBranch || student.place || student.location || 'Athani',
      franchiseeId: student.franchiseeId || student.environmentId || student.franchiseId || '',
      photoPreview: getSafeStringUrl(student.photoPreview || student.photoUrl),
      aadharPreview: getSafeStringUrl(student.aadharPreview || student.aadharUrl || student.aadharDoc),
      marksheetPreview: getSafeStringUrl(student.marksheetPreview || student.marksheetUrl || student.marksheetDoc)
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEditedStudent = async (e) => {
    e.preventDefault();
    if (!editingStudent) return;

    if (!editFormData.fullName.trim()) {
      showToast('Student Full Name is required!', 'error');
      return;
    }

    setIsSavingEdit(true);

    try {
      const updatedRecord = {
        ...editingStudent,
        registrationNo: editFormData.registrationNo,
        admissionDate: editFormData.admissionDate,
        createdDate: editFormData.admissionDate,
        selectedClass: editFormData.selectedClass,
        class: editFormData.selectedClass,
        trainingPlan: editFormData.trainingPlan,
        name: editFormData.fullName.trim(),
        fullName: editFormData.fullName.trim(),
        fatherName: editFormData.fatherName.trim(),
        dobDay: editFormData.dobDay,
        dobMonth: editFormData.dobMonth,
        dobYear: editFormData.dobYear,
        dateOfBirth: editFormData.dobYear && editFormData.dobMonth && editFormData.dobDay
          ? `${editFormData.dobYear}-${editFormData.dobMonth}-${editFormData.dobDay}`
          : editingStudent.dateOfBirth || '',
        casteCategory: editFormData.casteCategory.trim(),
        caste: editFormData.casteCategory.trim(),
        address: editFormData.address.trim(),
        email: editFormData.email.trim(),
        contactNo: editFormData.contactNo.trim(),
        mobileNo: editFormData.contactNo.trim(),
        phone: editFormData.contactNo.trim(),
        aadharNo: editFormData.aadharNo.trim(),
        aadharCardNumber: editFormData.aadharNo.trim(),
        sslcMarksNo: editFormData.sslcMarksNo.trim(),
        sslcRollNo: editFormData.sslcMarksNo.trim(),
        qualification: editFormData.qualification.trim(),
        standard: editFormData.qualification.trim(),
        course: editFormData.course.trim(),
        courseCode: editFormData.course.trim(),
        courseTitle: editFormData.course.trim(),
        trustBranch: editFormData.trustBranch.trim(),
        trainingCenter: editFormData.trustBranch.trim(),
        place: editFormData.trustBranch.trim(),
        location: editFormData.trustBranch.trim(),
        franchiseeId: editFormData.franchiseeId,
        photoPreview: editFormData.photoPreview,
        photoUrl: editFormData.photoPreview,
        aadharPreview: editFormData.aadharPreview,
        aadharUrl: editFormData.aadharPreview,
        marksheetPreview: editFormData.marksheetPreview,
        marksheetUrl: editFormData.marksheetPreview,
        updatedAt: new Date().toISOString()
      };

      const isCertStudent = Boolean(
        editingStudent.isCertificateStudent === true ||
        editingStudent.type === 'certificate_admission' ||
        Boolean(editingStudent.certRegNo)
      );

      // 1. Update UI state
      if (isCertStudent) {
        setCertStudents(prev => prev.map(s => (s.id === editingStudent.id || s.appNumber === editingStudent.appNumber || s.certRegNo === editingStudent.registrationNo) ? { ...s, ...updatedRecord } : s));
      } else {
        setRawStudents(prev => prev.map(s => s.id === editingStudent.id ? updatedRecord : s));
        // Explicitly purge from certStudents state if previously present
        setCertStudents(prev => prev.filter(s => s.id !== editingStudent.id && s.registrationNo !== editingStudent.registrationNo && s.certRegNo !== editingStudent.registrationNo));
      }

      // 2. Update local storage caches
      if (isCertStudent) {
        try {
          const cached = JSON.parse(localStorage.getItem('sle_cert_students_cache') || '[]');
          const updatedCache = cached.map(item => (item.id === editingStudent.id || item.certRegNo === editingStudent.registrationNo) ? { ...item, ...updatedRecord } : item);
          localStorage.setItem('sle_cert_students_cache', JSON.stringify(updatedCache));
        } catch (e) {}
      } else {
        const cacheKeys = ['sle_students_cache', 'sle_coaching_students_cache', 'sle_applications_cache'];
        cacheKeys.forEach(key => {
          try {
            const cached = JSON.parse(localStorage.getItem(key) || '[]');
            if (Array.isArray(cached)) {
              const updatedCache = cached.map(item => {
                if (item.id === editingStudent.id || item.registrationNo === editingStudent.registrationNo || item.certRegNo === editingStudent.registrationNo || item.appNumber === editingStudent.registrationNo) {
                  return { ...item, ...updatedRecord };
                }
                return item;
              });
              localStorage.setItem(key, JSON.stringify(updatedCache));
            }
          } catch (err) { }
        });

        // Always purge from cert_students cache when saving a general student
        try {
          const certCache = JSON.parse(localStorage.getItem('sle_cert_students_cache') || '[]');
          const filteredCertCache = certCache.filter(item => item.id !== editingStudent.id && item.registrationNo !== editingStudent.registrationNo && item.certRegNo !== editingStudent.registrationNo);
          localStorage.setItem('sle_cert_students_cache', JSON.stringify(filteredCertCache));
        } catch (e) {}
      }

      // 3. Update Firestore collections
      if (db) {
        if (isCertStudent) {
          try {
            const docRef = doc(db, 'cert_students', editingStudent.id);
            await setDoc(docRef, updatedRecord, { merge: true });
          } catch (fErr) {
            console.warn(`Firestore update notice for cert_students/${editingStudent.id}:`, fErr);
          }
        } else {
          // General student: save to students, applications, coaching_students
          const generalCollections = ['students', 'applications', 'coaching_students'];
          const docKeysToUpdate = Array.from(new Set([editingStudent.id, editingStudent.appNumber, editingStudent.registrationNo].filter(Boolean)));
          for (const colName of generalCollections) {
            for (const dKey of docKeysToUpdate) {
              try {
                const docRef = doc(db, colName, dKey);
                await setDoc(docRef, updatedRecord, { merge: true });
              } catch (fErr) {
                console.warn(`Firestore update notice for ${colName}/${dKey}:`, fErr);
              }
            }
          }

          // And actively guarantee removal from cert_students collection in Firestore
          try {
            await deleteDoc(doc(db, 'cert_students', editingStudent.id));
            if (editingStudent.registrationNo) {
              await deleteDoc(doc(db, 'cert_students', editingStudent.registrationNo));
            }
          } catch (delErr) { }

          // Also synchronize updated student identity fields to certificates & marksheets collections in Firestore
          const certSyncData = {
            candidateName: updatedRecord.fullName,
            name: updatedRecord.fullName,
            fullName: updatedRecord.fullName,
            studentName: updatedRecord.fullName,
            fatherName: updatedRecord.fatherName,
            course: updatedRecord.course,
            courseCode: updatedRecord.courseCode,
            courseTitle: updatedRecord.courseTitle,
            trainingCenter: updatedRecord.trainingCenter,
            trustBranch: updatedRecord.trustBranch,
            branchName: updatedRecord.trustBranch,
            place: updatedRecord.place,
            address: updatedRecord.address,
            photoUrl: updatedRecord.photoUrl || updatedRecord.photoPreview || '',
            photoPreview: updatedRecord.photoPreview || updatedRecord.photoUrl || '',
            updatedAt: updatedRecord.updatedAt
          };

          const certDocKeys = Array.from(new Set([
            editingStudent.registrationNo,
            editingStudent.registrationNo ? String(editingStudent.registrationNo).toLowerCase() : null,
            editingStudent.registrationNo ? String(editingStudent.registrationNo).replace(/\//g, '_') : null,
            editingStudent.appNumber,
            editingStudent.id
          ].filter(Boolean)));

          for (const cKey of certDocKeys) {
            try {
              const cRef = doc(db, 'certificates', cKey);
              await setDoc(cRef, certSyncData, { merge: true });
            } catch (_) { }

            try {
              const mRef = doc(db, 'marksheets', cKey);
              await setDoc(mRef, certSyncData, { merge: true });
            } catch (_) { }
          }

          // Sync local storage certificates & marksheets cache
          try {
            const storedCerts = JSON.parse(localStorage.getItem('sle_registered_certificates') || '{}');
            let certsChanged = false;
            certDocKeys.forEach(k => {
              if (storedCerts[k]) {
                storedCerts[k] = { ...storedCerts[k], ...certSyncData };
                certsChanged = true;
              }
            });
            if (certsChanged) {
              localStorage.setItem('sle_registered_certificates', JSON.stringify(storedCerts));
            }
          } catch (_) { }

          try {
            const storedMs = JSON.parse(localStorage.getItem('sle_registered_marksheets') || '{}');
            let msChanged = false;
            certDocKeys.forEach(k => {
              if (storedMs[k]) {
                storedMs[k] = { ...storedMs[k], ...certSyncData };
                msChanged = true;
              }
            });
            if (msChanged) {
              localStorage.setItem('sle_registered_marksheets', JSON.stringify(storedMs));
            }
          } catch (_) { }
        }
      }

      showToast(`Application Form for "${editFormData.fullName}" updated successfully!`, 'success');
      setIsEditModalOpen(false);
      setEditingStudent(null);
    } catch (err) {
      console.error('Error saving updated student application:', err);
      showToast('Failed to update student application form. Please try again.', 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleEditFileChange = (e, fieldName) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast('Selected file exceeds 10MB limit.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        setEditFormData(prev => ({
          ...prev,
          [fieldName]: reader.result
        }));
        const label = fieldName === 'photoPreview' ? 'Candidate Photo' : fieldName === 'aadharPreview' ? 'Aadhar Card' : 'Marksheet';
        showToast(`Updated ${label}! Click "Save & Update Application" to confirm.`, 'info');
      } else {
        setCropModalData({
          imageSrc: reader.result,
          target: fieldName
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropComplete = (blob, croppedDataUrl) => {
    if (!cropModalData) return;
    const fieldName = cropModalData.target;
    const finalData = (typeof croppedDataUrl === 'string' && croppedDataUrl) || (typeof blob === 'string' && blob) || '';
    setEditFormData(prev => ({
      ...prev,
      [fieldName]: finalData
    }));
    const label = fieldName === 'photoPreview' ? 'Candidate Photo' : fieldName === 'aadharPreview' ? 'Aadhar Card' : 'Marksheet';
    showToast(`Cropped ${label} successfully! Click "Save & Update Application" to confirm.`, 'success');
    setCropModalData(null);
  };

  // Permanent Deleted Student IDs state
  const [deletedStudentIds, setDeletedStudentIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sle_deleted_student_ids') || '[]');
    } catch (e) {
      return [];
    }
  });

  // Auto-purge test entries (e.g. csdcsaassc / FR-CSDCSAASSC / Sandhya Uchhai) from local caches & Firestore
  useEffect(() => {
    const purgeTestEntries = async () => {
      const isTestMatch = (str) => {
        if (!str) return false;
        const lower = String(str).toLowerCase();
        return lower.includes('csdcsaassc') || lower.includes('sandhya uchhai');
      };

      // 1. Clean localStorage caches
      ['sle_students_cache', 'sle_coaching_students_cache', 'sle_applications_cache', 'sle_franchisees_cache'].forEach(key => {
        try {
          const cached = JSON.parse(localStorage.getItem(key) || '[]');
          const filtered = cached.filter(item => {
            const b = item.trustBranch || item.place || item.city || item.location || item.franchiseName || item.fullName || item.name || '';
            const fId = item.franchiseeId || item.environmentId || item.id || '';
            return !isTestMatch(b) && !isTestMatch(fId);
          });
          localStorage.setItem(key, JSON.stringify(filtered));
        } catch (e) { }
      });

      // 2. Clean Firestore collections
      if (db) {
        try {
          const collectionsToCheck = ['students', 'applications', 'coaching_students', 'franchisees'];
          for (const colName of collectionsToCheck) {
            const snap = await getDocs(collection(db, colName));
            snap.forEach(async (docSnap) => {
              const data = docSnap.data();
              const b = data.trustBranch || data.place || data.city || data.location || data.franchiseName || data.fullName || data.name || docSnap.id || '';
              const fId = data.franchiseeId || data.environmentId || docSnap.id || '';
              if (isTestMatch(b) || isTestMatch(fId)) {
                try {
                  await deleteDoc(doc(db, colName, docSnap.id));
                } catch (delErr) { }
              }
            });
          }
        } catch (e) { }
      }
    };

    purgeTestEntries();
  }, []);

  // Delete Branch & associated records handler
  const handleDeleteBranch = async (branchName, e) => {
    if (e) e.stopPropagation();
    if (!branchName) return;

    if (!window.confirm(`Are you sure you want to remove the "${branchName}" branch and clear its records?`)) {
      return;
    }

    const branchLower = branchName.trim().toLowerCase();

    // 1. Immediate UI State Update
    setRawStudents(prev => prev.filter(s => {
      const b = (s.trustBranch || s.place || s.city || '').trim().toLowerCase();
      const fId = (s.franchiseeId || s.environmentId || '').trim().toLowerCase();
      return b !== branchLower && fId !== `fr-${branchLower}`;
    }));

    setFranchisees(prev => prev.filter(f => {
      const loc = (f.location || f.trustBranch || f.franchiseName || '').trim().toLowerCase();
      const fId = (f.id || '').trim().toLowerCase();
      return loc !== branchLower && fId !== `fr-${branchLower}` && !loc.includes(branchLower);
    }));

    // 2. Clean localStorage caches
    try {
      const filterCache = (key) => {
        const cached = JSON.parse(localStorage.getItem(key) || '[]');
        const filtered = cached.filter(s => {
          const b = (s.trustBranch || s.place || s.city || s.location || s.franchiseName || '').trim().toLowerCase();
          const fId = (s.franchiseeId || s.environmentId || s.id || '').trim().toLowerCase();
          return b !== branchLower && fId !== `fr-${branchLower}` && !b.includes(branchLower);
        });
        localStorage.setItem(key, JSON.stringify(filtered));
      };

      filterCache('sle_students_cache');
      filterCache('sle_coaching_students_cache');
      filterCache('sle_applications_cache');
      filterCache('sle_franchisees_cache');
    } catch (err) { }

    // 3. Delete matching docs from Firestore
    if (db) {
      try {
        const collectionsToClean = ['students', 'applications', 'coaching_students', 'franchisees'];
        for (const colName of collectionsToClean) {
          const snap = await getDocs(collection(db, colName));
          snap.forEach(async (docSnap) => {
            const data = docSnap.data();
            const b = (data.trustBranch || data.place || data.city || data.location || data.franchiseName || '').trim().toLowerCase();
            const fId = (data.franchiseeId || data.environmentId || docSnap.id || '').trim().toLowerCase();

            if (b === branchLower || fId === `fr-${branchLower}` || b.includes(branchLower)) {
              try {
                await deleteDoc(doc(db, colName, docSnap.id));
              } catch (delErr) { }
            }
          });
        }
      } catch (e) { }
    }

    if (selectedBranch.toLowerCase() === branchLower) {
      setSelectedBranch('All');
    }

    // Also remove from dynamic branchManager
    try {
      await deleteBranch(branchName);
    } catch (bErr) { }

    showToast(`Removed branch "${branchName}" and associated data.`);
  };

  // Delete Individual Student Record handler
  const handleDeleteStudent = async (studentId, regNo, studentName) => {
    if (!window.confirm(`Delete student record for "${studentName || regNo}"?`)) {
      return;
    }

    const regStr = String(regNo || '').trim();
    const idStr = String(studentId || '').trim();

    // 1. Add to permanent deleted IDs list in state & localStorage
    const newDeleted = Array.from(new Set([...deletedStudentIds, regStr, idStr, regStr.toLowerCase(), idStr.toLowerCase()]));
    setDeletedStudentIds(newDeleted);
    try {
      localStorage.setItem('sle_deleted_student_ids', JSON.stringify(newDeleted));
    } catch (e) { }

    // 2. Immediate UI state update for rawStudents & certStudents
    setRawStudents(prev => prev.filter(s => {
      const sReg = String(s.registrationNo || s.regNo || '').trim();
      const sId = String(s.id || s.appNumber || '').trim();
      return sReg !== regStr && sId !== idStr && sReg.toLowerCase() !== regStr.toLowerCase() && sId.toLowerCase() !== idStr.toLowerCase();
    }));

    setCertStudents(prev => prev.filter(s => {
      const sReg = String(s.certRegNo || s.registrationNo || s.regNo || '').trim();
      const sId = String(s.id || s.appNumber || '').trim();
      return sReg !== regStr && sId !== idStr && sReg.toLowerCase() !== regStr.toLowerCase() && sId.toLowerCase() !== idStr.toLowerCase();
    }));

    // 3. Clear from local storage caches
    try {
      const filterCache = (key) => {
        const cached = JSON.parse(localStorage.getItem(key) || '[]');
        const filtered = cached.filter(s => {
          const sReg = String(s.certRegNo || s.registrationNo || s.regNo || '').trim();
          const sId = String(s.id || s.appNumber || '').trim();
          return sReg !== regStr && sId !== idStr && sReg.toLowerCase() !== regStr.toLowerCase() && sId.toLowerCase() !== idStr.toLowerCase();
        });
        localStorage.setItem(key, JSON.stringify(filtered));
      };

      filterCache('sle_students_cache');
      filterCache('sle_coaching_students_cache');
      filterCache('sle_applications_cache');
      filterCache('sle_cert_students_cache');
    } catch (err) { }

    // 4. Delete from Firestore collections
    if (db) {
      try {
        const collectionsToClean = ['students', 'applications', 'coaching_students', 'cert_students'];
        for (const colName of collectionsToClean) {
          try {
            if (idStr) await deleteDoc(doc(db, colName, idStr));
            if (regStr && regStr !== idStr) await deleteDoc(doc(db, colName, regStr));
          } catch (e) { }
        }
      } catch (e) { }
    }

    showToast(`Deleted student record #${regNo || studentName}!`, 'success');
  };

  // 1. ONE-TIME FETCH ON OPEN & MANUAL REFRESH (Saves DB Reads)
  const fetchBranchwiseData = async (isManual = false) => {
    if (isManual) {
      setIsRefreshing(true);
    }

    const firestoreMap = new Map();

    // Helper to get canonical merge key across IDs (numeric 202638xxx, STUD-2026-xxx, SLE-2026-xxxxx)
    const getStudentMergeKey = (d) => {
      const data = d.data ? d.data() : d;
      const reg = String(data.registrationNo || data.regNo || data.admNo || data.certRegNo || '').trim().toLowerCase();
      if (reg) return `reg_${reg}`;

      const rawId = String(d.id || data.id || '').trim().toLowerCase();
      if (/^202638\d+$/.test(rawId)) return `reg_${rawId}`;

      const numMatch = rawId.match(/2026[89]?(\d{3,4})$/);
      if (numMatch) return `reg_202638${numMatch[1]}`;

      const app = String(data.appNumber || '').trim().toLowerCase();
      if (app) {
        const appNumMatch = app.match(/2026[89]?(\d{3,4})$/);
        if (appNumMatch) return `reg_202638${appNumMatch[1]}`;
        return `app_${app}`;
      }

      if (rawId) return `id_${rawId}`;
      return '';
    };

    // Helper to merge records
    const mergeRecord = (d, type) => {
      const data = d.data ? d.data() : d;
      const id = d.id || data.id || data.appNumber || data.registrationNo;
      if (!id && !data) return;

      const key = getStudentMergeKey(d) || String(data.appNumber || id || '').toLowerCase();
      if (!key) return;

      const existing = firestoreMap.get(key) || {};
      const merged = { ...existing };
      for (const [k, v] of Object.entries(data)) {
        if (v !== undefined && v !== null && v !== '') {
          merged[k] = v;
        } else if (merged[k] === undefined) {
          merged[k] = v;
        }
      }

      firestoreMap.set(key, {
        ...merged,
        id: existing.id || id,
        registrationNo: existing.registrationNo || data.registrationNo || (key.startsWith('reg_') ? key.replace('reg_', '') : ''),
        recordType: type || existing.recordType || 'student'
      });
    };

    // Step A: Load Local Caches First for instant zero-delay render
    try {
      const localStudents = JSON.parse(localStorage.getItem('sle_students_cache') || '[]');
      const localCoaching = JSON.parse(localStorage.getItem('sle_coaching_students_cache') || '[]');
      const localApps = JSON.parse(localStorage.getItem('sle_applications_cache') || '[]');
      const localFranchisees = JSON.parse(localStorage.getItem('sle_franchisees_cache') || '[]');

      localStudents.forEach(s => mergeRecord(s, 'students'));
      localCoaching.forEach(s => mergeRecord(s, 'coaching'));
      localApps.forEach(s => mergeRecord(s, 'application'));

      if (localFranchisees.length > 0) {
        setFranchisees(localFranchisees);
      }

      const initialArr = Array.from(firestoreMap.values());
      if (initialArr.length > 0) {
        setRawStudents(initialArr);
        setLoading(false);
      }
    } catch (e) {
      console.log('Local cache load notice:', e);
    }

    // Step B: One-time Firestore fetch on initial load or manual refresh
    if (db) {
      try {
        const [franSnap, studSnap, appSnap, coachSnap] = await Promise.all([
          getDocs(collection(db, 'franchisees')).catch(err => {
            console.log('Franchisees fetch notice:', err?.message);
            return { docs: [] };
          }),
          getDocs(collection(db, 'students')).catch(err => {
            console.log('Students fetch notice:', err?.message);
            return { docs: [] };
          }),
          getDocs(collection(db, 'applications')).catch(err => {
            console.log('Applications fetch notice:', err?.message);
            return { docs: [] };
          }),
          getDocs(collection(db, 'coaching_students')).catch(err => {
            console.log('Coaching fetch notice:', err?.message);
            return { docs: [] };
          })
        ]);

        if (franSnap?.docs?.length > 0) {
          const list = franSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setFranchisees(list);
          try {
            localStorage.setItem('sle_franchisees_cache', JSON.stringify(list));
          } catch (e) { }
        }

        studSnap?.docs?.forEach(d => {
          mergeRecord(d, 'students');
        });

        appSnap?.docs?.forEach(d => {
          mergeRecord(d, 'applications');
        });

        coachSnap?.docs?.forEach(d => {
          mergeRecord(d, 'coaching_students');
        });

        const arr = Array.from(firestoreMap.values());
        setRawStudents(arr);
        try {
          localStorage.setItem('sle_students_cache', JSON.stringify(arr));
        } catch (e) { }

        if (isManual) {
          showToast(`Synced ${arr.length} students across branches!`, 'success');
        }
      } catch (err) {
        console.log('Firestore one-time fetch notice:', err);
        if (isManual) {
          showToast('Sync completed with cached records.', 'info');
        }
      }
    }

    setLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchBranchwiseData(false);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchBranchwiseData(true),
      fetchCertStudents(false)
    ]);
    setIsRefreshing(false);
  };

  // 2. FALLBACK SAMPLE STUDENTS DATASET (If no Firestore data exists yet)
  const defaultSampleList = [
    {
      id: 'STUD-2026-001',
      appNumber: 'SLE-2026-9041',
      registrationNo: '202638001',
      franchiseeId: 'FR-2026-901',
      franchiseName: 'SLE Academy Belagavi',
      name: 'Kavita Anand',
      fullName: 'Kavita Anand',
      fatherName: 'Anand Kumar',
      motherName: 'Gojabai',
      contactNo: '9766302954',
      email: 'kavita.anand@gmail.com',
      place: 'Athani',
      trustBranch: 'Athani',
      selectedClass: '9th',
      course: 'Navodaya Entrance Coaching',
      admissionDate: '2026-08-21',
      paymentStatus: 'Paid',
      status: 'Approved'
    },
    {
      id: 'STUD-2026-002',
      appNumber: 'SLE-2026-9042',
      registrationNo: '202638002',
      franchiseeId: 'FR-2026-902',
      franchiseName: 'Navodaya Coaching Hub Hubballi',
      name: 'Prajwal Kumar M.',
      fullName: 'Prajwal Kumar M.',
      fatherName: 'Manjunatha K.',
      motherName: 'Latha M.',
      contactNo: '9845123456',
      email: 'prajwal.k@gmail.com',
      place: 'Vijayapur',
      trustBranch: 'Vijayapur',
      selectedClass: '10th',
      course: 'DCTTC (Diploma in Computer Teacher Training)',
      admissionDate: '2026-08-22',
      paymentStatus: 'Paid',
      status: 'Approved'
    },
    {
      id: 'STUD-2026-003',
      appNumber: 'SLE-2026-9043',
      registrationNo: '202638003',
      franchiseeId: 'FR-2026-903',
      franchiseName: 'Mandya Training Center',
      name: 'Ananya Gowda',
      fullName: 'Ananya Gowda',
      fatherName: 'Nagaraju G.',
      motherName: 'Savitha N.',
      contactNo: '9900112233',
      email: 'ananya.gowda@gmail.com',
      place: 'Mandya',
      trustBranch: 'Mandya',
      selectedClass: '9th',
      course: 'PGDCA',
      admissionDate: '2026-08-23',
      paymentStatus: 'Paid',
      status: 'Approved'
    },
    {
      id: 'STUD-2026-004',
      appNumber: 'SLE-2026-9044',
      registrationNo: '202638004',
      franchiseeId: 'FR-2026-901',
      franchiseName: 'SLE Academy Belagavi',
      name: 'Chetan V. Patil',
      fullName: 'Chetan V. Patil',
      fatherName: 'Veeresh Patil',
      motherName: 'Sunanda Patil',
      contactNo: '9844011223',
      email: 'chetan.patil@gmail.com',
      place: 'Belagavi',
      trustBranch: 'Belagavi',
      selectedClass: '6th',
      course: 'Sainik School Entrance Exam',
      admissionDate: '2026-08-19',
      paymentStatus: 'Paid',
      status: 'Approved'
    },
    {
      id: 'STUD-2026-005',
      appNumber: 'SLE-2026-9045',
      registrationNo: '202638005',
      franchiseeId: 'FR-2026-902',
      franchiseName: 'Navodaya Coaching Hub Hubballi',
      name: 'Darshan B. M.',
      fullName: 'Darshan B. M.',
      fatherName: 'Mahesh B.',
      motherName: 'Kavitha B.',
      contactNo: '9741098765',
      email: 'darshan.bm@gmail.com',
      place: 'Hubballi',
      trustBranch: 'Hubballi',
      selectedClass: '8th',
      course: 'Morarji Desai Entrance Coaching',
      admissionDate: '2026-08-20',
      paymentStatus: 'Paid',
      status: 'Submitted'
    },
    ...getShahapurStudentsFull()
  ];

  // Helper to extract clean YYYY-MM-DD standard date from any date string / timestamp
  const extractCleanDate = (val) => {
    if (!val) return null;
    if (typeof val === 'number') {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      return null;
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed || trimmed === 'undefined' || trimmed === 'null' || trimmed === 'N/A') return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
      if (trimmed.includes('T')) {
        const part = trimmed.split('T')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
      }
      const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (dmyMatch) {
        const [_, day, month, year] = dmyMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    }
    return null;
  };

  // Helper to resolve enrollment date according to admission date -> transaction date
  const resolveStudentEnrollDate = (st) => {
    const dayAdmissionTaken = extractCleanDate(st.admissionDate)
      || extractCleanDate(st.appliedDate)
      || extractCleanDate(st.admission_date)
      || extractCleanDate(st.submissionDate);

    if (dayAdmissionTaken) return dayAdmissionTaken;

    const razorpayTxnDate = extractCleanDate(st.paymentDate)
      || extractCleanDate(st.razorpayPaymentDate)
      || extractCleanDate(st.transactionDate)
      || extractCleanDate(st.submittedAt)
      || extractCleanDate(st.createdDate)
      || extractCleanDate(st.createdAt)
      || extractCleanDate(st.date);

    if (razorpayTxnDate) return razorpayTxnDate;

    return '2026-08-28';
  };

  // Canonical branch name resolver that unifies spelling & casing variations (e.g. JEWARGI -> Jewaragi)
  const toCanonicalBranchName = (rawName) => {
    if (!rawName) return 'Athani';
    const norm = normalizeBranch(rawName);
    const match = DEFAULT_BRANCHES.find(b => normalizeBranch(b) === norm);
    if (match) return match;
    return rawName.trim().replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  };

  // 3. NORMALIZED STUDENTS LIST WITH RESOLVED FRANCHISEE IDs & BRANCHES
  const normalizedStudents = useMemo(() => {
    let rawBaseList = rawStudents.length > 0 ? [...rawStudents] : [...defaultSampleList];

    // Guarantee that all 68 Shahapur students are available even if cache was cleared
    const shahapurInBase = rawBaseList.filter(s => (s.trustBranch || s.place || s.city || '').toLowerCase() === 'shahapur');
    if (shahapurInBase.length < 68) {
      const existingRegs = new Set(shahapurInBase.map(s => String(s.registrationNo || s.regNo || s.id)));
      const full68 = getShahapurStudentsFull();
      full68.forEach(st => {
        if (!existingRegs.has(st.registrationNo) && !existingRegs.has(st.id)) {
          rawBaseList.push(st);
          existingRegs.add(st.registrationNo);
          existingRegs.add(st.id);
        }
      });
    }

    // Canonical deduplication to guarantee no double counting across document ID aliases
    const seenStudentKeys = new Set();
    const baseList = [];
    rawBaseList.forEach(s => {
      const reg = String(s.registrationNo || s.regNo || s.admNo || s.certRegNo || '').trim().toLowerCase();
      let key = reg ? `reg_${reg}` : '';
      if (!key) {
        const sid = String(s.id || '').trim().toLowerCase();
        if (/^202638\d+$/.test(sid)) {
          key = `reg_${sid}`;
        } else {
          const m = sid.match(/2026[89]?(\d{3,4})$/);
          if (m) key = `reg_202638${m[1]}`;
          else if (s.appNumber) {
            const appM = String(s.appNumber).match(/2026[89]?(\d{3,4})$/);
            if (appM) key = `reg_202638${appM[1]}`;
            else key = `app_${String(s.appNumber).toLowerCase()}`;
          } else {
            key = `id_${sid}`;
          }
        }
      }

      if (key && !seenStudentKeys.has(key)) {
        seenStudentKeys.add(key);
        baseList.push(s);
      } else if (!key) {
        baseList.push(s);
      }
    });

    const shahapur68 = getShahapurStudentsFull();
    const shahapurRegs = new Set(shahapur68.map(s => String(s.registrationNo).toLowerCase()));
    const shahapurIds = new Set(shahapur68.map(s => String(s.id).toLowerCase()));

    const filteredList = baseList.filter(s => {
      // Filter out empty placeholder or hall ticket records without student identity
      if (!s.fullName && !s.name && !s.studentName && !s.appNumber) {
        return false;
      }

      // Filter out Draft / Pending Payment records — these live in 'pending_payments' collection
      // and are reviewed exclusively through the Admin's Pending Payments Monitor.
      const sPStatus = (s.paymentStatus || '').toLowerCase();
      const sStatus = (s.status || '').toLowerCase();
      if (sPStatus === 'pending payment' || sStatus === 'draft') {
        return false;
      }

      // In General Registry Mode, exclude Paid Certificate students (managed in Certificate Students Registry)
      if (activeRegistryMode === 'general') {
        if (s.isCertificateStudent === true || s.type === 'certificate_admission' || s.certRegNo) {
          return false;
        }
        const reg = String(s.registrationNo || s.regNo || s.admNo || s.id || '').trim();
        if (reg.startsWith('SLE-202638') || reg.startsWith('SLE-202')) {
          return false;
        }
      }

      const sReg = String(s.registrationNo || s.regNo || '').trim().toLowerCase();
      const sId = String(s.id || s.appNumber || '').trim().toLowerCase();

      // Restored Shahapur students must never be blocked by stale deleted IDs
      if (shahapurRegs.has(sReg) || shahapurIds.has(sId)) {
        return true;
      }

      const isDel = deletedStudentIds.some(dId =>
        dId && (dId.toLowerCase() === sReg || dId.toLowerCase() === sId)
      );
      return !isDel;
    });

    return filteredList.map((s, idx) => {
      // Resolve Franchisee from franchisees list
      let resolvedFranId = s.franchiseeId || s.environmentId;
      let matchingFran = franchisees.find(f =>
        (resolvedFranId && f.id === resolvedFranId) ||
        (f.email && s.email && f.email.toLowerCase() === s.email.toLowerCase()) ||
        (f.franchiseName && s.franchiseName && f.franchiseName.toLowerCase() === s.franchiseName.toLowerCase())
      );

      let rawBranch = s.transferredTo || s.trustBranch || s.place || s.city || '';
      if (matchingFran && matchingFran.location) {
        if (!rawBranch || rawBranch === 'Athani' || (resolvedFranId === 'FR-2026-445' && !s.transferredTo && normalizeBranch(rawBranch) === 'mysore')) {
          rawBranch = matchingFran.location;
        }
      }
      const resolvedBranch = toCanonicalBranchName(rawBranch);
      const branchNorm = normalizeBranch(resolvedBranch);

      const franLocNorm = matchingFran ? normalizeBranch(matchingFran.location || matchingFran.trustBranch) : '';
      if (s.transferredTo || !matchingFran || (franLocNorm && branchNorm && franLocNorm !== branchNorm) || !resolvedFranId || resolvedFranId === 'default_env' || resolvedFranId === 'FR-DEFAULT') {
        const match = franchisees.find(f => {
          const fLocNorm = normalizeBranch(f.location || f.trustBranch);
          const fNameLower = (f.franchiseName || '').toLowerCase();
          return (fLocNorm && fLocNorm === branchNorm) || fNameLower.includes(branchNorm) || (branchNorm === 'jewaragi' && f.id === 'FR-2026-101') || (branchNorm === 'shahapur' && (f.id === 'FR-SHAHAPUR' || f.environmentId === 'FR-SHAHAPUR'));
        });
        if (match) {
          resolvedFranId = match.id;
          matchingFran = match;
        } else if (!resolvedFranId || resolvedFranId === 'default_env' || resolvedFranId === 'FR-DEFAULT') {
          resolvedFranId = `FR-${resolvedBranch.toUpperCase()}`;
        }
      }

      const resolvedFranName = s.franchiseName || s.environmentName || (
        matchingFran?.franchiseName || resolvedBranch
      );

      return {
        ...s,
        id: s.id || s.appNumber || `STUD-${s.registrationNo || idx}`,
        appNumber: s.appNumber || s.id || `SLE-2026-${s.registrationNo || idx}`,
        registrationNo: s.registrationNo || s.regNo || s.admNo || '',
        franchiseeId: resolvedFranId,
        franchiseName: resolvedFranName,
        name: s.fullName || s.name || 'Student Name',
        fullName: s.fullName || s.name || 'Student Name',
        fatherName: s.fatherName || 'N/A',
        motherName: s.motherName || 'N/A',
        contactNo: s.contactNo || s.mobileNo || s.phone || 'N/A',
        email: s.email || 'N/A',
        trustBranch: resolvedBranch,
        place: resolvedBranch,
        selectedClass: s.selectedClass || s.class || '10th',
        course: s.course || s.coachingPlan || 'Navodaya Entrance Coaching',
        admissionDate: resolveStudentEnrollDate(s),
        address: s.address || `${resolvedBranch}, Karnataka`,
        casteCategory: s.casteCategory || s.category || 'General',
        gender: s.gender || 'Male',
        dateOfBirth: s.dateOfBirth || `${s.dobYear || '2010'}-${s.dobMonth || '01'}-${s.dobDay || '01'}`,
        photoPreview: s.photoPreview || '',
        aadharPreview: s.aadharPreview || '',
        marksheetPreview: s.marksheetPreview || '',
        paymentStatus: s.paymentStatus || 'Paid',
        status: s.status || 'Approved'
      };
    });
  }, [rawStudents, franchisees, deletedStudentIds]);

  // 4. NORMALIZED CERTIFICATE STUDENTS LIST WITH RESOLVED FRANCHISEE IDs & BRANCHES
  const normalizedCertificateStudents = useMemo(() => {
    const filteredList = certStudents.filter(s => {
      if (!s.fullName && !s.name && !s.studentName && !s.appNumber && !s.certRegNo) {
        return false;
      }
      // Guarantee general Shahapur restored students never leak into certificate list
      if (s.isRestored && !s.isCertificateStudent && s.type !== 'certificate_admission') {
        return false;
      }
      const reg = String(s.registrationNo || s.regNo || s.certRegNo || '');
      if (reg.startsWith('202638') && !s.isCertificateStudent && s.type !== 'certificate_admission' && !s.certRegNo) {
        return false;
      }
      const sReg = String(s.certRegNo || s.registrationNo || s.regNo || '').trim().toLowerCase();
      const sId = String(s.id || s.appNumber || '').trim().toLowerCase();
      const isDel = deletedStudentIds.some(dId =>
        dId && (dId.toLowerCase() === sReg || dId.toLowerCase() === sId)
      );
      return !isDel;
    });

    return filteredList.map((s, idx) => {
      const reg = s.certRegNo || s.registrationNo || (s.id && String(s.id).startsWith('SLE-') ? s.id : `SLE-${202638001 + idx}`);
      let rawBranch = s.trustBranch || s.place || s.city || s.branch || '';
      const resolvedBranch = toCanonicalBranchName(rawBranch);

      let resolvedFranId = s.franchiseeId || s.environmentId;
      let matchingFran = franchisees.find(f =>
        (resolvedFranId && f.id === resolvedFranId) ||
        (f.email && s.email && f.email.toLowerCase() === s.email.toLowerCase()) ||
        (f.franchiseName && s.franchiseName && f.franchiseName.toLowerCase() === s.franchiseName.toLowerCase())
      );

      if (!resolvedFranId || resolvedFranId === 'default_env' || resolvedFranId === 'FR-DEFAULT') {
        const branchNorm = normalizeBranch(resolvedBranch);
        const match = franchisees.find(f => {
          const fLocNorm = normalizeBranch(f.location || f.trustBranch);
          const fNameLower = (f.franchiseName || '').toLowerCase();
          return (fLocNorm && fLocNorm === branchNorm) || fNameLower.includes(branchNorm);
        });
        if (match) {
          resolvedFranId = match.id;
          matchingFran = match;
        } else {
          resolvedFranId = `FR-${resolvedBranch.toUpperCase()}`;
        }
      }

      const resolvedFranName = s.franchiseName || s.environmentName || (
        matchingFran?.franchiseName || resolvedBranch
      );

      return {
        ...s,
        id: s.id || s.appNumber || s.certRegNo || `CERT-${reg}`,
        appNumber: s.appNumber || reg,
        registrationNo: reg,
        certRegNo: reg,
        franchiseeId: resolvedFranId,
        franchiseName: resolvedFranName,
        name: s.fullName || s.name || 'Certificate Student',
        fullName: s.fullName || s.name || 'Certificate Student',
        fatherName: s.fatherName || '—',
        motherName: s.motherName || '—',
        contactNo: s.contactNo || s.mobileNo || s.phone || '—',
        email: s.email || '—',
        trustBranch: resolvedBranch,
        place: resolvedBranch,
        selectedClass: s.selectedClass || s.qualification || 'Certificate Programme',
        course: s.course || 'Certificate Course',
        admissionDate: resolveStudentEnrollDate(s),
        address: s.address || `${resolvedBranch}, Karnataka`,
        casteCategory: s.casteCategory || s.category || 'General',
        gender: s.gender || 'Male',
        dateOfBirth: s.dateOfBirth || `${s.dobYear || '2000'}-${s.dobMonth || '01'}-${s.dobDay || '01'}`,
        photoPreview: getSafeStringUrl(s.photoPreview || s.photoUrl || s.photo),
        aadharPreview: getSafeStringUrl(s.aadharPreview || s.aadharUrl || s.aadharDoc),
        marksheetPreview: getSafeStringUrl(s.marksheetPreview || s.marksheetUrl || s.marksheetDoc),
        paymentStatus: s.paymentStatus || 'Paid',
        status: s.status || 'Approved',
        isCertificateStudent: true
      };
    });
  }, [certStudents, franchisees, deletedStudentIds]);

  // ACTIVE STUDENTS DATASET ACCORDING TO MODE
  const activeStudents = activeRegistryMode === 'certificate' ? normalizedCertificateStudents : normalizedStudents;

  // 5. BRANCH ANALYTICS COMPUTATION (Deduplicated canonically across all branches)
  const branchAnalytics = useMemo(() => {
    const branchSet = new Set();

    // Dynamic branches list (includes all 42 defaults + custom dynamic branches, canonicalized)
    dynamicBranches.forEach(b => branchSet.add(toCanonicalBranchName(b)));

    // Add branches from franchisees collection (canonicalized)
    franchisees.forEach(f => {
      if (f.location && f.location.trim()) branchSet.add(toCanonicalBranchName(f.location));
      if (f.trustBranch && f.trustBranch.trim()) branchSet.add(toCanonicalBranchName(f.trustBranch));
    });

    // Add branches from student records (canonicalized)
    activeStudents.forEach(s => {
      if (s.trustBranch) branchSet.add(toCanonicalBranchName(s.trustBranch));
      else if (s.place) branchSet.add(toCanonicalBranchName(s.place));
    });

    const branchMap = new Map();
    branchSet.forEach(b => branchMap.set(b, 0));

    activeStudents.forEach(s => {
      const b = toCanonicalBranchName(s.trustBranch || s.place);
      if (b && branchMap.has(b)) {
        branchMap.set(b, branchMap.get(b) + 1);
      } else if (b) {
        branchMap.set(b, 1);
      }
    });

    return Array.from(branchMap.entries()).map(([branch, count]) => {
      const branchNorm = normalizeBranch(branch);
      const matchingFran = franchisees.find(f => {
        const fLoc = normalizeBranch(f.location || f.trustBranch);
        const fName = (f.franchiseName || '').toLowerCase();
        return (fLoc && fLoc === branchNorm) || fName.includes(branchNorm) || (branchNorm === 'jewaragi' && f.id === 'FR-2026-101');
      });

      return {
        branch,
        count,
        franchiseeId: matchingFran ? matchingFran.id : `FR-${branch.toUpperCase()}`,
        franchiseName: matchingFran ? (matchingFran.franchiseName || matchingFran.environmentName) : `${branch} Center`,
        growth: `+${Math.floor(Math.random() * 15) + 5}%`
      };
    });
  }, [activeStudents, franchisees, dynamicBranches]);

  // Available Academic / Admission Years
  const availableYears = useMemo(() => {
    return getAvailableYears(activeStudents);
  }, [activeStudents]);

  // 6. FILTERING & SEARCHING LOGIC
  const filteredStudents = useMemo(() => {
    return activeStudents.filter(s => {
      // Search Query Match
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesName = (s.name || '').toLowerCase().includes(q);
        const matchesReg = (s.registrationNo || '').toLowerCase().includes(q);
        const matchesApp = (s.appNumber || '').toLowerCase().includes(q);
        const matchesPhone = (s.contactNo || '').toLowerCase().includes(q);
        const matchesEmail = (s.email || '').toLowerCase().includes(q);
        const matchesFranId = (s.franchiseeId || '').toLowerCase().includes(q);
        const matchesBranch = (s.trustBranch || '').toLowerCase().includes(q);
        const matchesCourse = (s.course || '').toLowerCase().includes(q);

        if (!matchesName && !matchesReg && !matchesApp && !matchesPhone && !matchesEmail && !matchesFranId && !matchesBranch && !matchesCourse) {
          return false;
        }
      }

      // Branch Filter (Normalized matching: handles Jewaragi / JEWARGI, Raichur / RAICHUR, etc.)
      if (selectedBranch !== 'All') {
        const selNorm = normalizeBranch(selectedBranch);
        const sBranchNorm = normalizeBranch(s.trustBranch || s.place);
        const sFranNameNorm = normalizeBranch(s.franchiseName);
        const matchesBranch =
          (sBranchNorm && sBranchNorm === selNorm) ||
          (sFranNameNorm && sFranNameNorm.includes(selNorm)) ||
          (selNorm === 'mysore' && !s.transferredTo && (s.franchiseeId === 'FR-2026-445' || (s.franchiseName && s.franchiseName.toLowerCase() === 'xyz'))) ||
          (selNorm === 'jewaragi' && s.franchiseeId === 'FR-2026-101');
        if (!matchesBranch) {
          return false;
        }
      }

      // Course Filter
      if (selectedCourse !== 'All' && !(s.course || '').toLowerCase().includes(selectedCourse.toLowerCase())) {
        return false;
      }

      // Status Filter
      if (selectedStatus !== 'All' && (s.status || '').toLowerCase() !== selectedStatus.toLowerCase()) {
        return false;
      }

      // Year Filter
      if (selectedYear !== 'All') {
        const studentYear = getStudentYear(s);
        if (studentYear !== selectedYear) return false;
      }

      return true;
    });
  }, [activeStudents, searchQuery, selectedBranch, selectedCourse, selectedStatus, selectedYear]);

  // 7. SORTING LOGIC
  const sortedStudents = useMemo(() => {
    return [...filteredStudents].sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredStudents, sortField, sortDirection]);

  // 8. PAGINATION COMPUTATION
  const totalEntries = sortedStudents.length;
  const totalPages = Math.ceil(totalEntries / entriesPerPage) || 1;
  const startIndex = (currentPage - 1) * entriesPerPage;
  const paginatedStudents = sortedStudents.slice(startIndex, startIndex + entriesPerPage);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleExportBranchCSV = (targetBranch = 'All') => {
    let listToExport = [];
    if (targetBranch === 'All') {
      listToExport = sortedStudents;
    } else {
      const targetNorm = normalizeBranch(targetBranch);
      listToExport = activeStudents.filter(s => {
        const sBranchNorm = normalizeBranch(s.trustBranch || s.place);
        const sFranNameNorm = normalizeBranch(s.franchiseName);
        return (
          (sBranchNorm && sBranchNorm === targetNorm) ||
          (sFranNameNorm && sFranNameNorm.includes(targetNorm)) ||
          (targetNorm === 'mysore' && !s.transferredTo && (s.franchiseeId === 'FR-2026-445' || (s.franchiseName && s.franchiseName.toLowerCase() === 'xyz'))) ||
          (targetNorm === 'jewaragi' && s.franchiseeId === 'FR-2026-101')
        );
      });
    }

    if (listToExport.length === 0) {
      showToast(`No student records found for ${targetBranch === 'All' ? 'all branches' : targetBranch} to export.`, 'info');
      return;
    }

    const rows = [
      ['Registration No', 'Student Name', 'Father Name', 'Branch', 'Franchisee ID', 'Course / Grade', 'Enrollment Date', 'Contact No', 'Status'],
      ...listToExport.map(s => [
        s.registrationNo || s.certRegNo || '',
        s.fullName || s.name || '',
        s.fatherName || '',
        s.trustBranch || s.place || (targetBranch !== 'All' ? targetBranch : ''),
        s.franchiseeId || '',
        s.course || '',
        s.admissionDate || s.createdDate || '',
        s.contactNo || s.mobileNo || s.phone || '',
        s.status || 'Approved'
      ])
    ];

    const csvContent = '\uFEFF' + rows.map(e => e.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeBranchName = targetBranch.replace(/[^a-zA-Z0-9_-]/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `SLES_${safeBranchName}_Students_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exported ${listToExport.length} student records for ${targetBranch}!`, 'success');
  };

  const handleExportCSV = () => {
    handleExportBranchCSV(selectedBranch);
  };

  const handleOpenDrawer = (student) => {
    setSelectedStudent(student);
    setIsDrawerOpen(true);
  };

  return (
    <div className="space-y-6">

      {/* SECTION HEADER & REFRESH BUTTON */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-extrabold border mb-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20">
            {activeRegistryMode === 'certificate' ? (
              <>
                <Award className="w-3.5 h-3.5 text-indigo-500" /> Real-Time Certificate Registry
              </>
            ) : (
              <>
                <Building2 className="w-3.5 h-3.5" /> Real-Time Branchwise Registry
              </>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            {activeRegistryMode === 'certificate' ? 'Certificate Students Analytics' : 'Branchwise Students Analytics'}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
              isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
            title={`Export records to CSV ${selectedBranch !== 'All' ? `(${selectedBranch})` : '(All Branches)'}`}
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>{selectedBranch !== 'All' ? `Export ${selectedBranch} CSV` : 'Export CSV'}</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200'
              } ${isRefreshing ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-95 cursor-pointer'}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-500' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Firestore'}</span>
          </button>
        </div>
      </div>

      {/* TOP ANALYTICS & SUMMARY CARDS BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">

        {/* Card 0: Total Students (All Branches) */}
        <div
          onClick={() => { setSelectedBranch('All'); setCurrentPage(1); }}
          className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer backdrop-blur-md ${selectedBranch === 'All'
              ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white border-indigo-400 shadow-lg shadow-indigo-500/20 scale-[1.03]'
              : isDarkMode
                ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-white'
                : 'bg-white/90 border-slate-200/80 hover:border-indigo-300 text-slate-900 shadow-sm'
            }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-extrabold uppercase tracking-wider ${selectedBranch === 'All' ? 'text-white/90' : 'text-slate-500 dark:text-slate-400'}`}>
              All Branches
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExportBranchCSV('All');
                }}
                className={`p-1 rounded-md transition-all cursor-pointer ${
                  selectedBranch === 'All'
                    ? 'text-white/80 hover:text-white hover:bg-white/20'
                    : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800'
                }`}
                title={`Export CSV for All Branches (${activeStudents.length} students)`}
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              {activeRegistryMode === 'certificate' ? (
                <Award className={`w-4 h-4 ${selectedBranch === 'All' ? 'text-white' : 'text-indigo-500'}`} />
              ) : (
                <Users className={`w-4 h-4 ${selectedBranch === 'All' ? 'text-white' : 'text-indigo-500'}`} />
              )}
            </div>
          </div>
          <div className="text-2xl font-black">{activeStudents.length}</div>
          <div className={`text-[10px] font-bold mt-1 flex items-center gap-1 ${selectedBranch === 'All' ? 'text-white/90' : 'text-emerald-500'}`}>
            <TrendingUp className="w-3 h-3" /> Total {activeRegistryMode === 'certificate' ? 'Certificate' : ''} Admissions
          </div>
        </div>

        {/* Branch Cards for ALL registered & default branches */}
        {branchAnalytics.map((item) => {
          const isSelected = selectedBranch.toLowerCase() === item.branch.toLowerCase();
          const isDefaultBranch = DEFAULT_BRANCHES.includes(item.branch);

          return (
            <div
              key={item.branch}
              onClick={() => { setSelectedBranch(item.branch); setCurrentPage(1); }}
              className={`group relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer backdrop-blur-md ${isSelected
                  ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white border-indigo-400 shadow-lg shadow-indigo-500/20 scale-[1.03]'
                  : isDarkMode
                    ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-white'
                    : 'bg-white/90 border-slate-200/80 hover:border-indigo-300 text-slate-900 shadow-sm'
                }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                  {item.branch}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportBranchCSV(item.branch);
                    }}
                    className={`p-1 rounded-md transition-all cursor-pointer ${
                      isSelected
                        ? 'text-white/80 hover:text-white hover:bg-white/20'
                        : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800'
                    }`}
                    title={`Export CSV for ${item.branch} (${item.count} students)`}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>

                  <Building2 className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-indigo-200' : 'text-purple-500'}`} />
                </div>
              </div>

              <div className="mt-2">
                <div className="text-2xl font-black">{item.count}</div>
              </div>

              <div className={`text-[10px] font-mono mt-1 truncate ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                {item.franchiseeId}
              </div>
            </div>
          );
        })}

      </div>

      {/* ADVANCED SEARCH & FILTERING TOOLBAR */}
      <div className={`p-4 rounded-2xl border backdrop-blur-md transition-colors ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/90 border-slate-200/80 shadow-sm'
        }`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">

          {/* Global Search Bar */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search Name, Reg No, Mobile, Email, Franchisee ID..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-medium border focus:outline-none transition-all ${isDarkMode
                  ? 'bg-slate-800/80 border-slate-700 text-white focus:border-indigo-500'
                  : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500 focus:bg-white'
                }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Branch Dropdown */}
          <div className="relative">
            <Building2 className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <select
              value={selectedBranch}
              onChange={(e) => { setSelectedBranch(e.target.value); setCurrentPage(1); }}
              className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-xs font-semibold border appearance-none focus:outline-none transition-all ${isDarkMode
                  ? 'bg-slate-800/80 border-slate-700 text-white focus:border-indigo-500'
                  : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500 focus:bg-white'
                }`}
            >
              <option value="All">All Branches</option>
              {branchAnalytics.map(b => (
                <option key={b.branch} value={b.branch}>{b.branch} ({b.count})</option>
              ))}
            </select>
          </div>

          {/* Course / Program Filter */}
          <div className="relative">
            <GraduationCap className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <select
              value={selectedCourse}
              onChange={(e) => { setSelectedCourse(e.target.value); setCurrentPage(1); }}
              className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-xs font-semibold border appearance-none focus:outline-none transition-all ${isDarkMode
                  ? 'bg-slate-800/80 border-slate-700 text-white focus:border-indigo-500'
                  : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500 focus:bg-white'
                }`}
            >
              <option value="All">All Courses</option>
              {dynamicCourses.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div className="relative">
            <Calendar className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <select
              value={selectedYear}
              onChange={(e) => { setSelectedYear(e.target.value); setCurrentPage(1); }}
              className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-xs font-semibold border appearance-none focus:outline-none transition-all ${isDarkMode
                  ? 'bg-slate-800/80 border-slate-700 text-white focus:border-indigo-500'
                  : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500 focus:bg-white'
                }`}
            >
              <option value="All">All Years</option>
              {availableYears.map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Filter Summary & Active Reset Bar */}
        {(selectedBranch !== 'All' || searchQuery || selectedCourse !== 'All' || selectedYear !== 'All') && (
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-200/60 dark:border-slate-800 text-xs">
            <span className={`font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Filtered Results: <strong className="text-indigo-500 font-extrabold">{filteredStudents.length}</strong> of {activeStudents.length} {activeRegistryMode === 'certificate' ? 'certificate' : ''} students
            </span>
            <button
              onClick={() => {
                setSelectedBranch('All');
                setSearchQuery('');
                setSelectedCourse('All');
                setSelectedStatus('All');
                setSelectedYear('All');
                setCurrentPage(1);
              }}
              className="text-xs font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* STUDENT DATA TABLE CARD */}
      <div className={`rounded-2xl border overflow-hidden backdrop-blur-md transition-colors shadow-lg ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/90 border-slate-200/80'
        }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className={`border-b text-[11px] font-black uppercase tracking-wider select-none ${isDarkMode ? 'bg-slate-800/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}>

                <th onClick={() => handleSort('registrationNo')} className="p-4 cursor-pointer hover:text-indigo-500 transition">
                  <div className="flex items-center gap-1">
                    <span>Registration No</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>

                <th onClick={() => handleSort('name')} className="p-4 cursor-pointer hover:text-indigo-500 transition">
                  <div className="flex items-center gap-1">
                    <span>Student Name</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>

                <th onClick={() => handleSort('trustBranch')} className="p-4 cursor-pointer hover:text-indigo-500 transition">
                  <div className="flex items-center gap-1">
                    <span>Branch & Franchisee ID</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>

                <th onClick={() => handleSort('course')} className="p-4 cursor-pointer hover:text-indigo-500 transition">
                  <div className="flex items-center gap-1">
                    <span>Course / Grade</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>

                <th onClick={() => handleSort('admissionDate')} className="p-4 cursor-pointer hover:text-indigo-500 transition">
                  <div className="flex items-center gap-1">
                    <span>Enrollment Date</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>

                <th className="p-4 text-center">Action</th>

              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center">
                    <Loader2 className="w-7 h-7 animate-spin text-indigo-500 mx-auto mb-2" />
                    <span className={`text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Loading {activeRegistryMode === 'certificate' ? 'certificate' : 'branchwise'} student registry...</span>
                  </td>
                </tr>
              ) : paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center">
                    <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <div className="font-bold text-slate-700 dark:text-slate-300">No matching {activeRegistryMode === 'certificate' ? 'certificate ' : ''}student records found</div>
                    <p className="text-xs text-slate-500 mt-1">Try adjusting your search keywords or branch filters.</p>
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((s) => (
                  <tr
                    key={s.id}
                    className={`transition-colors duration-150 ${isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-indigo-50/40'
                      }`}
                  >
                    {/* Registration No */}
                    <td className="p-4">
                      <span className={`font-mono font-bold block text-xs ${
                        activeRegistryMode === 'certificate' || s.isCertificateStudent || String(s.registrationNo).startsWith('SLE-')
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-indigo-500'
                      }`}>
                        #{s.registrationNo}
                      </span>
                    </td>

                    {/* Student Name */}
                    <td className="p-4">
                      <div className={`font-black text-sm sm:text-base tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {s.name}
                      </div>
                    </td>

                    {/* Branch & Franchisee ID */}
                    <td className="p-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`font-extrabold text-xs flex items-center gap-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                          <Building2 className="w-3.5 h-3.5 text-purple-500 shrink-0" /> {s.trustBranch}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-extrabold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                          {s.franchiseeId}
                        </span>
                      </div>
                    </td>

                    {/* Course / Grade */}
                    <td className="p-4">
                      <div className={`font-extrabold text-xs sm:text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{s.course}</div>
                      <span className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        Class {s.selectedClass}
                      </span>
                    </td>

                    {/* Enrollment Date */}
                    <td className={`p-4 font-mono text-xs font-extrabold ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                      {s.admissionDate}
                    </td>

                    {/* Action: View Details, Edit Form & Delete Buttons */}
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenDrawer(s)}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-500/10 hover:bg-indigo-600 text-indigo-600 hover:text-white border border-indigo-500/20 transition-all duration-200 shadow-xs flex items-center gap-1 hover:scale-105 active:scale-95 cursor-pointer"
                          title="View Printable Admission Form"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Details</span>
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(s)}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-extrabold bg-purple-500/10 hover:bg-purple-600 text-purple-600 hover:text-white border border-purple-500/20 transition-all duration-200 shadow-xs flex items-center gap-1 hover:scale-105 active:scale-95 cursor-pointer"
                          title="Edit Student Application Form"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit Form</span>
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(s.id, s.registrationNo, s.name)}
                          className="p-1.5 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-500/20 transition-all duration-200 shadow-xs flex items-center gap-1 hover:scale-105 active:scale-95 cursor-pointer"
                          title="Delete Student Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        <div className={`p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold ${isDarkMode ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-600'
          }`}>
          <div>
            Showing {totalEntries > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + entriesPerPage, totalEntries)} of {totalEntries} entries
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 mr-4">
              <span>Show</span>
              <select
                value={entriesPerPage}
                onChange={(e) => { setEntriesPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className={`px-2 py-1 rounded-lg border text-xs font-bold ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-800'
                  }`}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span>per page</span>
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`p-2 rounded-xl border transition-all ${currentPage === 1
                  ? 'opacity-40 cursor-not-allowed'
                  : isDarkMode
                    ? 'hover:bg-slate-800 text-white'
                    : 'hover:bg-slate-100 text-slate-800'
                }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="font-extrabold px-2">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`p-2 rounded-xl border transition-all ${currentPage === totalPages
                  ? 'opacity-40 cursor-not-allowed'
                  : isDarkMode
                    ? 'hover:bg-slate-800 text-white'
                    : 'hover:bg-slate-100 text-slate-800'
                }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* OFFICIAL ADMISSION FORM DETAILS MODAL */}
      {isDrawerOpen && selectedStudent && (
        <div id="printable-admission-modal" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200 printable-modal">

          <div className="bg-white text-slate-900 border border-slate-300 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-8 relative font-sans">

            {/* Top Close Button */}
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer print-hide print:hidden shadow-sm"
              title="Close Details"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Top Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 print:hidden print-hide">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-black text-slate-700 tracking-wide uppercase">
                  ADMISSION FORM GENERATED & FEE PAID
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const std = selectedStudent;
                    setIsDrawerOpen(false);
                    handleOpenEditModal(std);
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-2 cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Edit Application Form</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Admission Form</span>
                </button>
              </div>
            </div>

            <div id="printable-admission-form" className="bg-white text-slate-900 space-y-6 font-sans p-2 sm:p-4 printable-document">

              {/* Header Section */}
              <div className="flex items-start justify-between relative pb-2 border-b border-slate-200">
                {/* Top Left Logo (/logo-1.jpg) */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0">
                  <img src="/logo-1.jpg" alt="SLE Institutions Logo" className="w-full h-full object-contain" />
                </div>

                {/* Center Title & Subheaders */}
                <div className="text-center flex-1 px-2">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
                    SLE INSTITUTIONS
                  </h1>
                  <p className="text-[10px] sm:text-xs font-semibold text-slate-700 mt-0.5 leading-tight max-w-2xl mx-auto">
                    (Sharing Computer Literacy Movement with Govt. of India) Recognized by Govt. Of INDIA. ISO 21001:2025 Certified Institute.
                  </p>
                  <p className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-widest mt-1">
                    ADMISSION FORM
                  </p>
                </div>

                {/* Right Spacer to balance the left logo and keep header centered */}
                <div className="w-16 sm:w-20 flex-shrink-0" />
              </div>

              {/* Main Border Boxed Form Details */}
              <div className="border border-slate-800 p-4 sm:p-8 relative min-h-[460px] text-xs sm:text-sm font-mono text-slate-900 bg-white">

                {/* Responsive Layout: Photo + Fields */}
                <div className="flex flex-col-reverse sm:flex-row justify-between items-start gap-6">

                  {/* Fields Table Grid */}
                  <div className="w-full sm:max-w-[calc(100%-140px)] space-y-3 pt-1">

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">REGISTRATION NO:</span>
                      <span className="font-bold text-slate-900 text-sm tracking-wider break-all">{selectedStudent.registrationNo}</span>
                    </div>

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">ADMISSION DATE:</span>
                      <span className="font-semibold text-slate-900 break-all">{selectedStudent.admissionDate || selectedStudent.createdDate}</span>
                    </div>

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">NAME:</span>
                      <span className="font-semibold text-slate-900 uppercase break-words">{selectedStudent.fullName || selectedStudent.name}</span>
                    </div>

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">FATHER NAME:</span>
                      <span className="font-semibold text-slate-900 break-words">{selectedStudent.fatherName || 'N/A'}</span>
                    </div>

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">DATE OF BIRTH:</span>
                      <span className="font-semibold text-slate-900 break-words">
                        {selectedStudent.dobYear
                          ? `${selectedStudent.dobYear} ${selectedStudent.dobMonth}, ${selectedStudent.dobDay}`
                          : selectedStudent.dateOfBirth || selectedStudent.dob || 'N/A'}
                      </span>
                    </div>

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">CASTE:</span>
                      <span className="font-semibold text-slate-900 uppercase break-words">{selectedStudent.casteCategory || selectedStudent.caste || 'N/A'}</span>
                    </div>

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">ADDRESS:</span>
                      <span className="font-medium text-slate-900 break-words">{selectedStudent.address || 'N/A'}</span>
                    </div>

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">EMAIL ID:</span>
                      <span className="font-medium text-slate-900 lowercase break-all">{selectedStudent.email || 'N/A'}</span>
                    </div>

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">CONTACT NO:</span>
                      <span className="font-semibold text-slate-900 break-all">{selectedStudent.contactNo || selectedStudent.mobileNo || 'N/A'}</span>
                    </div>

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">QUALIFICATION:</span>
                      <span className="font-semibold text-slate-900 uppercase break-words">{selectedStudent.qualification || 'N/A'}</span>
                    </div>

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">COURSE:</span>
                      <span className="font-bold text-slate-900 uppercase break-words">{selectedStudent.course || selectedStudent.selectedClass || 'N/A'}</span>
                    </div>

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">BRANCH:</span>
                      <span className="font-semibold text-slate-900 break-words">{selectedStudent.trustBranch || selectedStudent.place || selectedStudent.location || 'N/A'}</span>
                    </div>

                    <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900 tracking-wide uppercase flex-shrink-0">FRANCHISEE ID:</span>
                      <span className="font-bold text-indigo-600 break-all">{selectedStudent.franchiseeId || selectedStudent.environmentId || selectedStudent.franchiseId || 'FR-2026-876'}</span>
                    </div>

                  </div>

                  {/* Candidate Photo (Centered on Mobile, Top Right on Desktop) */}
                  <div className="self-center sm:self-start flex-shrink-0 w-28 sm:w-32 h-36 sm:h-40 border border-slate-800 bg-slate-100 flex items-center justify-center overflow-hidden shadow-sm">
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
                <div className="pt-8 border-t border-slate-200 mt-6">
                  <p className="text-[10px] sm:text-xs font-sans text-slate-700 leading-relaxed italic">
                    Declaration: I hereby declare that all the information furnished in this application form is true, complete and correct to the best of my knowledge and belief.
                  </p>
                  <div className="flex justify-between items-end pt-12 text-xs font-bold text-slate-900 font-sans">
                    <div>
                      <div className="border-t border-slate-400 pt-1 px-4 text-center">Signature of Candidate</div>
                    </div>
                    <div>
                      <div className="border-t border-slate-400 pt-1 px-4 text-center">Authorized Signatory & Stamp</div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Uploaded Documents Section (Click to View Full Size) */}
              {(() => {
                const aadharLink = selectedStudent.aadharUrl || selectedStudent.aadharPreview || selectedStudent.aadharCardUrl || selectedStudent.aadharDoc || selectedStudent.aadhar;
                const marksheetLink = selectedStudent.marksheetUrl || selectedStudent.marksheetPreview || selectedStudent.marksheetCardUrl || selectedStudent.marksheetDoc || selectedStudent.marksheet;

                const isAadharPdf = aadharLink && (
                  (typeof aadharLink === 'string' && (aadharLink.includes('.pdf') || aadharLink.startsWith('data:application/pdf'))) ||
                  selectedStudent.aadharFileType === 'pdf'
                );

                const isMarksheetPdf = marksheetLink && (
                  (typeof marksheetLink === 'string' && (marksheetLink.includes('.pdf') || marksheetLink.startsWith('data:application/pdf'))) ||
                  selectedStudent.marksheetFileType === 'pdf'
                );

                return (
                  <div className="border-t border-slate-200 pt-5 mt-6 space-y-4 print:hidden print-hide">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <FileText className="w-4 h-4 text-rose-600" /> UPLOADED DOCUMENTS (CLICK TO VIEW FULL SIZE)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                      {/* AADHAR CARD BOX */}
                      <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/80 space-y-3 text-center">
                        <span className="text-xs font-black uppercase text-slate-700 tracking-wider block">
                          AADHAR CARD
                        </span>
                        {aadharLink ? (
                          <div className="space-y-2">
                            {isAadharPdf ? (
                              <a
                                href={aadharLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-4 rounded-2xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100/90 text-rose-700 font-bold text-xs flex flex-col items-center justify-center gap-2 transition cursor-pointer shadow-sm group"
                              >
                                <FileText className="w-6 h-6 text-rose-600 group-hover:scale-110 transition-transform" />
                                <span>📄 PDF Document (Click to View)</span>
                              </a>
                            ) : (
                              <a
                                href={aadharLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block rounded-2xl overflow-hidden border border-slate-200 hover:border-rose-500 transition shadow-sm group"
                              >
                                <img src={aadharLink} alt="Aadhar Card" className="max-h-44 w-full object-contain mx-auto bg-white p-1" />
                              </a>
                            )}
                            <a
                              href={aadharLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-rose-600 hover:text-rose-700 hover:underline pt-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Aadhar Card</span>
                            </a>
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl border border-slate-200 bg-white text-slate-400 text-xs font-medium">
                            No Aadhar Document Uploaded
                          </div>
                        )}
                      </div>

                      {/* MARKSHEET BOX */}
                      <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/80 space-y-3 text-center">
                        <span className="text-xs font-black uppercase text-slate-700 tracking-wider block">
                          MARKSHEET
                        </span>
                        {marksheetLink ? (
                          <div className="space-y-2">
                            {isMarksheetPdf ? (
                              <a
                                href={marksheetLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-4 rounded-2xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100/90 text-rose-700 font-bold text-xs flex flex-col items-center justify-center gap-2 transition cursor-pointer shadow-sm group"
                              >
                                <FileText className="w-6 h-6 text-rose-600 group-hover:scale-110 transition-transform" />
                                <span>📄 PDF Document (Click to View)</span>
                              </a>
                            ) : (
                              <a
                                href={marksheetLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block rounded-2xl overflow-hidden border border-slate-200 hover:border-rose-500 transition shadow-sm group"
                              >
                                <img src={marksheetLink} alt="Marksheet" className="max-h-44 w-full object-contain mx-auto bg-white p-1" />
                              </a>
                            )}
                            <a
                              href={marksheetLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-rose-600 hover:text-rose-700 hover:underline pt-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Marksheet</span>
                            </a>
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl border border-slate-200 bg-white text-slate-400 text-xs font-medium">
                            No Marksheet Document Uploaded
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })()}

              {/* Modal Bottom Close Action */}
              <div className="pt-4 flex justify-end print:hidden print-hide border-t border-slate-200 mt-4">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* EDIT APPLICATION FORM MODAL */}
      {isEditModalOpen && editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className={`w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl border shadow-2xl p-5 sm:p-8 relative ${isDarkMode ? 'bg-slate-900 text-white border-slate-800' : 'bg-white text-slate-900 border-slate-200'
            }`}>

            {/* Top Header Banner */}
            <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-rose-950 text-white rounded-2xl py-4 px-6 text-center shadow-lg mb-6 relative overflow-hidden flex items-center justify-between">
              <div className="w-8" />
              <div>
                <h2 className="text-xl sm:text-2xl font-black tracking-widest uppercase">
                  ADMISSION FORM
                </h2>
                <p className="text-[11px] text-rose-200 font-mono mt-0.5">
                  Registration No: #{editFormData.registrationNo || editingStudent.registrationNo}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                title="Close Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Edit Form Body */}
            <form onSubmit={handleSaveEditedStudent} className="space-y-6">

              {/* TOP CARD: Admission Date (Editable), Class (Editable), Training Plan (Non-Editable) */}
              <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200/90'
                }`}>
                {/* Admission Date (Editable) */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    ADMISSION DATE:
                  </label>
                  <input
                    type="date"
                    name="admissionDate"
                    value={editFormData.admissionDate}
                    onChange={e => setEditFormData(prev => ({ ...prev, admissionDate: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-bold border focus:outline-none transition ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:border-rose-500' : 'bg-white border-slate-300 text-slate-900 focus:border-rose-500'
                      }`}
                  />
                </div>

                {/* Class (Editable) */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    CLASS:
                  </label>
                  <select
                    value={editFormData.selectedClass}
                    onChange={e => setEditFormData(prev => ({ ...prev, selectedClass: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-bold border focus:outline-none transition ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:border-rose-500' : 'bg-white border-slate-300 text-slate-900 focus:border-rose-500'
                      }`}
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

                {/* Training Plan (Non-Editable) */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    TRAINING PLAN:
                  </label>
                  <input
                    type="text"
                    value={editFormData.trainingPlan || 'Regular'}
                    readOnly
                    disabled
                    className={`w-full px-3 py-2 rounded-xl text-xs font-bold border cursor-not-allowed select-none ${isDarkMode ? 'bg-slate-800/80 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                      }`}
                  />
                </div>
              </div>

              {/* SECTION 1: PERSONAL DETAILS */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                  <User className="w-5 h-5 text-rose-600" />
                  <div>
                    <h3 className="text-sm font-black uppercase text-rose-600 tracking-wider">Personal Details</h3>
                    <p className="text-[11px] text-slate-500">Student full name, guardian info, DOB, and category</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Full Student Name */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-700 dark:text-slate-300">
                      Full Student Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={editFormData.fullName}
                        onChange={e => setEditFormData(prev => ({ ...prev, fullName: e.target.value }))}
                        placeholder="Enter Student's Full Name (as per SSLC / School Certificate)"
                        className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-xs font-semibold border focus:outline-none transition ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-rose-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-rose-500 focus:bg-white'
                          }`}
                      />
                    </div>
                  </div>

                  {/* Father / Guardian Name */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-700 dark:text-slate-300">
                      Father's / Guardian Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Users className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        value={editFormData.fatherName}
                        onChange={e => setEditFormData(prev => ({ ...prev, fatherName: e.target.value }))}
                        placeholder="Enter Father's / Guardian's Full Name"
                        className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-xs font-semibold border focus:outline-none transition ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-rose-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-rose-500 focus:bg-white'
                          }`}
                      />
                    </div>
                  </div>

                  {/* Date of Birth (3 Select Dropdowns) */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-700 dark:text-slate-300">
                      Date of Birth <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {/* Day */}
                      <select
                        value={editFormData.dobDay}
                        onChange={e => setEditFormData(prev => ({ ...prev, dobDay: e.target.value }))}
                        className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold border focus:outline-none transition ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-rose-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-rose-500 focus:bg-white'
                          }`}
                      >
                        <option value="">Day</option>
                        {daysList.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>

                      {/* Month */}
                      <select
                        value={editFormData.dobMonth}
                        onChange={e => setEditFormData(prev => ({ ...prev, dobMonth: e.target.value }))}
                        className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold border focus:outline-none transition ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-rose-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-rose-500 focus:bg-white'
                          }`}
                      >
                        <option value="">Month</option>
                        {monthsList.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>

                      {/* Year */}
                      <select
                        value={editFormData.dobYear}
                        onChange={e => setEditFormData(prev => ({ ...prev, dobYear: e.target.value }))}
                        className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold border focus:outline-none transition ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-rose-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-rose-500 focus:bg-white'
                          }`}
                      >
                        <option value="">Year</option>
                        {yearsList.map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Caste / Category */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-700 dark:text-slate-300">
                      Caste / Reservation Category <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editFormData.casteCategory}
                      onChange={e => setEditFormData(prev => ({ ...prev, casteCategory: e.target.value }))}
                      placeholder="Enter Caste / Reservation Category"
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold border focus:outline-none transition ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-rose-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-rose-500 focus:bg-white'
                        }`}
                    />
                  </div>

                  {/* Full Permanent Address */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-700 dark:text-slate-300">
                      Full Permanent Address <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <textarea
                        rows="2"
                        value={editFormData.address}
                        onChange={e => setEditFormData(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Enter Door No, Street, Village/Town, Taluk, District & Pincode"
                        className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-xs font-semibold border focus:outline-none transition ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-rose-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-rose-500 focus:bg-white'
                          }`}
                      />
                    </div>
                  </div>

                </div>
              </div>

              {/* SECTION 2: CONTACT & IDENTIFICATION */}
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* Email ID */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-700 dark:text-slate-300">
                      Email ID <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="email"
                        value={editFormData.email}
                        onChange={e => setEditFormData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="student/parent@example.com"
                        className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-xs font-semibold border focus:outline-none transition ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-rose-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-rose-500 focus:bg-white'
                          }`}
                      />
                    </div>
                  </div>

                  {/* Contact Mobile No */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-700 dark:text-slate-300">
                      Contact Mobile No <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="tel"
                        maxLength="10"
                        value={editFormData.contactNo}
                        onChange={e => setEditFormData(prev => ({ ...prev, contactNo: e.target.value }))}
                        placeholder="10-digit primary mobile number"
                        className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-xs font-semibold border focus:outline-none transition ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-rose-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-rose-500 focus:bg-white'
                          }`}
                      />
                    </div>
                  </div>

                  {/* Aadhar Card Number */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-700 dark:text-slate-300">
                      Aadhar Card Number
                    </label>
                    <div className="relative">
                      <CreditCard className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        maxLength="12"
                        value={editFormData.aadharNo}
                        onChange={e => setEditFormData(prev => ({ ...prev, aadharNo: e.target.value }))}
                        placeholder="12-digit Student Aadhar Number"
                        className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-xs font-semibold border focus:outline-none transition ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-rose-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-rose-500 focus:bg-white'
                          }`}
                      />
                    </div>
                  </div>

                  {/* SSLC / PUC Roll No */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-700 dark:text-slate-300">
                      SSLC/PUC Roll No
                    </label>
                    <div className="relative">
                      <FileCheck className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        value={editFormData.sslcMarksNo}
                        onChange={e => setEditFormData(prev => ({ ...prev, sslcMarksNo: e.target.value }))}
                        placeholder="Registration / Roll Number"
                        className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-xs font-semibold border focus:outline-none transition ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-rose-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-rose-500 focus:bg-white'
                          }`}
                      />
                    </div>
                  </div>

                  {/* Current Qualification / Standard */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-700 dark:text-slate-300">
                      Current Qualification / Standard
                    </label>
                    <div className="relative">
                      <BookOpen className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        value={editFormData.qualification}
                        onChange={e => setEditFormData(prev => ({ ...prev, qualification: e.target.value }))}
                        placeholder="e.g. 5th Standard Passed / Studying 10th"
                        className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-xs font-semibold border focus:outline-none transition ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-rose-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-rose-500 focus:bg-white'
                          }`}
                      />
                    </div>
                  </div>

                  {/* Course Applied For */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-700 dark:text-slate-300">
                      Course Applied For <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={editFormData.course}
                      onChange={e => setEditFormData(prev => ({ ...prev, course: e.target.value }))}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold border focus:outline-none transition ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-rose-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-rose-500 focus:bg-white'
                        }`}
                    >
                      <option value="">Select Course</option>
                      {dynamicCourses.map(c => (
                        <option key={c} value={c}>{getCourseDisplayLabel(c)}</option>
                      ))}
                    </select>
                  </div>

                </div>
              </div>

              {/* SECTION 3: BRANCH SELECTION */}
              <div className={`p-4 rounded-2xl border space-y-2 ${isDarkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50/80 border-slate-200'
                }`}>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  BRANCH <span className="text-rose-500">*</span>
                </label>
                <select
                  value={editFormData.trustBranch}
                  onChange={e => setEditFormData(prev => ({ ...prev, trustBranch: e.target.value }))}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold border focus:outline-none transition ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:border-rose-500' : 'bg-white border-slate-300 text-slate-900 focus:border-rose-500'
                    }`}
                >
                  <option value="">Select Branch</option>
                  {dynamicBranches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* SECTION 4: DOCUMENTS & PHOTO PREVIEWS / EDIT / UPLOAD */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                  <Upload className="w-5 h-5 text-rose-600" />
                  <div>
                    <h3 className="text-sm font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider">Documents & Photo Upload / View</h3>
                    <p className="text-[11px] text-slate-500">View current files or select new files to update student records</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                  {/* CANDIDATE PHOTO BOX */}
                  <div className={`p-4 rounded-2xl border text-center space-y-3 flex flex-col justify-between ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                    }`}>
                    <div className="space-y-2">
                      <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 block tracking-wide">Candidate Photo</span>

                      {/* Photo Thumbnail */}
                      {editFormData.photoPreview ? (
                        <div className="relative group w-24 h-28 mx-auto">
                          <img src={editFormData.photoPreview} alt="Candidate" className="w-full h-full object-cover rounded-xl border border-slate-300 shadow-sm" />
                          <a
                            href={editFormData.photoPreview}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex flex-col items-center justify-center text-white text-[10px] font-bold gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            <span>View Full</span>
                          </a>
                        </div>
                      ) : (
                        <div className="w-24 h-28 mx-auto rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400 font-medium">
                          No Photo
                        </div>
                      )}

                      {/* View, Crop & Upload Links */}
                      <div className="flex items-center justify-center flex-wrap gap-2 pt-0.5">
                        {editFormData.photoPreview && (
                          <>
                            <a
                              href={getSafeStringUrl(editFormData.photoPreview)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Photo</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => setCropModalData({ imageSrc: getSafeStringUrl(editFormData.photoPreview), target: 'photoPreview' })}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer"
                            >
                              <Crop className="w-3.5 h-3.5" />
                              <span>Crop Photo</span>
                            </button>
                          </>
                        )}
                        <label className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload New</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleEditFileChange(e, 'photoPreview')}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Photo Edit Controls */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                      <input
                        type="text"
                        value={getSafeStringUrl(editFormData.photoPreview)}
                        onChange={e => setEditFormData(prev => ({ ...prev, photoPreview: e.target.value }))}
                        placeholder="Or paste Photo URL"
                        className={`w-full px-2.5 py-1.5 rounded-lg text-[11px] font-mono border focus:outline-none ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-300 text-slate-700'
                          }`}
                      />
                    </div>
                  </div>

                  {/* AADHAR CARD BOX */}
                  <div className={`p-4 rounded-2xl border text-center space-y-3 flex flex-col justify-between ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                    }`}>
                    <div className="space-y-2">
                      <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 block tracking-wide">Aadhar Card</span>

                      {/* Aadhar Thumbnail or PDF Badge */}
                      {editFormData.aadharPreview ? (
                        <div className="relative group max-h-28 overflow-hidden rounded-xl border border-slate-300 flex items-center justify-center p-1 bg-white">
                          {isPdfDoc(editFormData.aadharPreview) ? (
                            <a
                              href={getSafeStringUrl(editFormData.aadharPreview)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] flex flex-col items-center gap-1 transition w-full"
                            >
                              <FileText className="w-5 h-5 text-rose-600" />
                              <span>📄 PDF Document</span>
                            </a>
                          ) : (
                            <a
                              href={getSafeStringUrl(editFormData.aadharPreview)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block relative group/img"
                            >
                              <img src={getSafeStringUrl(editFormData.aadharPreview)} alt="Aadhar" className="max-h-24 object-contain mx-auto" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-28 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400 font-medium">
                          No Aadhar
                        </div>
                      )}

                      {/* View, Crop & Upload Links */}
                      <div className="flex items-center justify-center flex-wrap gap-2 pt-0.5">
                        {editFormData.aadharPreview && (
                          <>
                            <a
                              href={getSafeStringUrl(editFormData.aadharPreview)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Aadhar</span>
                            </a>
                            {!isPdfDoc(editFormData.aadharPreview) && (
                              <button
                                type="button"
                                onClick={() => setCropModalData({ imageSrc: getSafeStringUrl(editFormData.aadharPreview), target: 'aadharPreview' })}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer"
                              >
                                <Crop className="w-3.5 h-3.5" />
                                <span>Crop Image</span>
                              </button>
                            )}
                          </>
                        )}
                        <label className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload New</span>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={(e) => handleEditFileChange(e, 'aadharPreview')}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Aadhar Edit Controls */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                      <input
                        type="text"
                        value={getSafeStringUrl(editFormData.aadharPreview)}
                        onChange={e => setEditFormData(prev => ({ ...prev, aadharPreview: e.target.value }))}
                        placeholder="Or paste Aadhar URL"
                        className={`w-full px-2.5 py-1.5 rounded-lg text-[11px] font-mono border focus:outline-none ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-300 text-slate-700'
                          }`}
                      />
                    </div>
                  </div>

                  {/* MARKSHEET BOX */}
                  <div className={`p-4 rounded-2xl border text-center space-y-3 flex flex-col justify-between ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                    }`}>
                    <div className="space-y-2">
                      <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 block tracking-wide">Marksheet</span>

                      {/* Marksheet Thumbnail or PDF Badge */}
                      {editFormData.marksheetPreview ? (
                        <div className="relative group max-h-28 overflow-hidden rounded-xl border border-slate-300 flex items-center justify-center p-1 bg-white">
                          {isPdfDoc(editFormData.marksheetPreview) ? (
                            <a
                              href={getSafeStringUrl(editFormData.marksheetPreview)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] flex flex-col items-center gap-1 transition w-full"
                            >
                              <FileText className="w-5 h-5 text-rose-600" />
                              <span>📄 PDF Document</span>
                            </a>
                          ) : (
                            <a
                              href={getSafeStringUrl(editFormData.marksheetPreview)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block relative group/img"
                            >
                              <img src={getSafeStringUrl(editFormData.marksheetPreview)} alt="Marksheet" className="max-h-24 object-contain mx-auto" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-28 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400 font-medium">
                          No Marksheet
                        </div>
                      )}

                      {/* View, Crop & Upload Links */}
                      <div className="flex items-center justify-center flex-wrap gap-2 pt-0.5">
                        {editFormData.marksheetPreview && (
                          <>
                            <a
                              href={getSafeStringUrl(editFormData.marksheetPreview)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Marksheet</span>
                            </a>
                            {!isPdfDoc(editFormData.marksheetPreview) && (
                              <button
                                type="button"
                                onClick={() => setCropModalData({ imageSrc: getSafeStringUrl(editFormData.marksheetPreview), target: 'marksheetPreview' })}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer"
                              >
                                <Crop className="w-3.5 h-3.5" />
                                <span>Crop Image</span>
                              </button>
                            )}
                          </>
                        )}
                        <label className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload New</span>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={(e) => handleEditFileChange(e, 'marksheetPreview')}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Marksheet Edit Controls */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                      <input
                        type="text"
                        value={getSafeStringUrl(editFormData.marksheetPreview)}
                        onChange={e => setEditFormData(prev => ({ ...prev, marksheetPreview: e.target.value }))}
                        placeholder="Or paste Marksheet URL"
                        className={`w-full px-2.5 py-1.5 rounded-lg text-[11px] font-mono border focus:outline-none ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-300 text-slate-700'
                          }`}
                      />
                    </div>
                  </div>

                </div>
              </div>

              {/* Modal Bottom Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-6 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-rose-700 to-rose-900 hover:from-rose-800 hover:to-rose-950 text-white shadow-md hover:shadow-rose-500/20 transition cursor-pointer flex items-center gap-2"
                >
                  {isSavingEdit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Updating Application...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save & Update Application</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* INTERACTIVE IMAGE CROPPER MODAL FOR EDIT STUDENT FORM */}
      {cropModalData && (
        <ImageCropperModal
          imageSrc={cropModalData.imageSrc}
          targetType={cropModalData.target === 'photoPreview' ? 'photo' : cropModalData.target === 'aadharPreview' ? 'aadhar' : 'marksheet'}
          title={`Crop & Adjust ${cropModalData.target === 'photoPreview' ? 'Candidate Photo' : cropModalData.target === 'aadharPreview' ? 'Aadhar Card' : 'Marksheet'}`}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropModalData(null)}
        />
      )}

    </div>
  );
}

