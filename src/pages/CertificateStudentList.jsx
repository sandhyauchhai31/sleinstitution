import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  Eye,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  GraduationCap,
  Phone,
  MapPin,
  Calendar,
  User,
  Award,
  Building2,
  Mail,
  CreditCard,
  FileCheck,
  Printer,
  ZoomIn,
  FileText,
  Download,
  ExternalLink
} from 'lucide-react';
import { db, collection, getDocs } from '../firebase';
import { filterStudentsForFranchisee, normalizeBranch } from '../utils/franchiseeFilter';
import { getStudentYear, getAvailableYears } from '../utils/studentYearHelper';

export default function CertificateStudentList() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [viewDocument, setViewDocument] = useState(null);
  const [sortField, setSortField] = useState('registrationNo');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedYear, setSelectedYear] = useState('ALL');

  const fetchStudents = async () => {
    setLoading(true);
    try {
      let fList = [];
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
      } catch (e) {}

      const allCertStudents = [];
      const seen = new Set();

      // 1. Read from local certificate students cache ONLY
      const rawCertCache = localStorage.getItem('sle_cert_students_cache');
      if (rawCertCache) {
        try {
          const cached = JSON.parse(rawCertCache);
          cached.forEach(s => {
            if (s.isRestored && !s.isCertificateStudent && s.type !== 'certificate_admission') return;
            const reg = String(s.certRegNo || s.registrationNo || s.regNo || s.id || '');
            if (reg.startsWith('202638') && !s.isCertificateStudent && s.type !== 'certificate_admission' && !s.certRegNo) return;
            const key = s.certRegNo || s.registrationNo || s.appNumber || s.id;
            if (key && !seen.has(key)) {
              seen.add(key);
              allCertStudents.push(s);
            }
          });
        } catch (e) {}
      }

      // 2. Fetch from Firestore 'cert_students' collection ONLY
      if (db) {
        try {
          const certSnap = await getDocs(collection(db, 'cert_students'));
          certSnap.docs.forEach(d => {
            const s = { id: d.id, ...d.data() };
            if (s.isRestored && !s.isCertificateStudent && s.type !== 'certificate_admission') return;
            const reg = String(s.certRegNo || s.registrationNo || s.regNo || s.id || '');
            if (reg.startsWith('202638') && !s.isCertificateStudent && s.type !== 'certificate_admission' && !s.certRegNo) return;
            const key = s.certRegNo || s.registrationNo || s.appNumber || s.id;
            if (key && !seen.has(key)) {
              seen.add(key);
              allCertStudents.push(s);
            }
          });
        } catch (e) {
          console.warn('Firestore cert_students fetch notice:', e);
        }
      }

      // 3. Normalize records with franchisee resolution
      const normalized = allCertStudents.map((s, idx) => {
        let resolvedBranch = s.trustBranch || s.place || s.city || '';
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
        if (!resolvedBranch) resolvedBranch = 'Mysore';

        if (!match || !resolvedFranId || resolvedFranId === 'default_env' || resolvedFranId === 'FR-DEFAULT') {
          const normBranch = normalizeBranch(resolvedBranch);
          const branchMatch = fList.find(f => {
            const normFLoc = normalizeBranch(f.location);
            const normFName = normalizeBranch(f.franchiseName);
            return (normFLoc && (normFLoc === normBranch || normFLoc.includes(normBranch) || normBranch.includes(normFLoc))) ||
                   (normFName && (normFName === normBranch || normFName.includes(normBranch) || normBranch.includes(normFName)));
          });
          if (branchMatch) {
            resolvedFranId = branchMatch.id;
          } else if (!resolvedFranId) {
            resolvedFranId = `FR-${resolvedBranch.toUpperCase()}`;
          }
        }

        return {
          ...s,
          id: s.id || `CERT-${idx}`,
          franchiseeId: resolvedFranId,
          environmentId: resolvedFranId,
          registrationNo: s.certRegNo || s.registrationNo || s.admNo || `SLE-${202638001 + idx}`,
          name: s.fullName || s.name || 'Candidate',
          fullName: s.fullName || s.name || 'Candidate',
          fatherName: s.fatherName || 'N/A',
          dob: s.dob || '',
          dobDay: s.dobDay || '',
          dobMonth: s.dobMonth || '',
          dobYear: s.dobYear || '',
          casteCategory: s.casteCategory || s.caste || 'N/A',
          caste: s.caste || s.casteCategory || 'N/A',
          address: s.address || 'N/A',
          email: s.email || 'N/A',
          contactNo: s.contactNo || s.mobileNo || s.phone || 'N/A',
          mobileNo: s.mobileNo || s.contactNo || s.phone || 'N/A',
          qualification: s.qualification || 'N/A',
          course: s.course || s.courseName || s.courseTitle || 'Certificate Course',
          selectedClass: s.selectedClass || s.course || 'Certificate Course',
          place: resolvedBranch,
          trustBranch: resolvedBranch,
          admissionDate: s.admissionDate || s.createdDate || s.submittedAt || '—',
          createdDate: s.createdDate || s.admissionDate || '',
          status: s.status || 'Submitted',
          photoPreview: s.photoPreview || s.photoUrl || s.photo || s.photoPath || '',
          photoUrl: s.photoUrl || s.photoPreview || s.photo || s.photoPath || '',
          aadharPreview: s.aadharPreview || s.aadharUrl || s.aadharCard || '',
          aadharFileType: s.aadharFileType || (s.aadharPreview?.startsWith('data:application/pdf') ? 'pdf' : 'image'),
          aadharFileName: s.aadharFileName || 'AadharCard',
          marksheetPreview: s.marksheetPreview || s.marksheetUrl || s.marksheet || '',
          marksheetFileType: s.marksheetFileType || (s.marksheetPreview?.startsWith('data:application/pdf') ? 'pdf' : 'image'),
          marksheetFileName: s.marksheetFileName || 'Marksheet'
        };
      });

      const franchiseeFiltered = filterStudentsForFranchisee(normalized);
      setStudents(franchiseeFiltered);
    } catch (e) {
      console.error('Error fetching certificate students:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const availableYears = useMemo(() => {
    return getAvailableYears(students);
  }, [students]);

  const filteredStudents = useMemo(() => {
    let list = [...students];
    if (selectedYear !== 'ALL') {
      list = list.filter(s => getStudentYear(s) === selectedYear);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(s =>
        (s.name || s.fullName || '').toLowerCase().includes(q) ||
        (s.registrationNo || s.certRegNo || '').toLowerCase().includes(q) ||
        (s.contactNo || s.mobileNo || '').includes(q) ||
        (s.course || '').toLowerCase().includes(q) ||
        (s.place || s.trustBranch || '').toLowerCase().includes(q) ||
        (s.franchiseeId || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [students, searchTerm, sortField, sortOrder, selectedYear]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / entriesPerPage));
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = Math.min(startIndex + entriesPerPage, filteredStudents.length);
  const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

  return (
    <div className="py-5 sm:py-8 px-3 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-6 w-full max-w-[100vw] overflow-x-hidden min-w-0">

      {/* CRIMSON BANNER LIKE IMAGE 2 */}
      <div className="gradient-banner rounded-2xl sm:rounded-3xl py-4 sm:py-5 px-3 sm:px-8 shadow-xl border border-rose-800/40 relative overflow-hidden text-center flex items-center justify-center gap-2 sm:gap-3 w-full max-w-full min-w-0">
        <h2 className="text-base sm:text-xl md:text-2xl font-black text-white tracking-widest uppercase font-serif break-words line-clamp-2">
          STUDENTS
        </h2>
        <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-rose-500 text-white font-black text-xs sm:text-sm flex items-center justify-center shadow-inner shrink-0">
          {filteredStudents.length}
        </span>
      </div>

      {/* MAIN CONTAINER CARD */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-6 lg:p-8 shadow-xl border border-slate-200 space-y-6 w-full max-w-full min-w-0">

        {/* TOP CONTROLS BAR (Show Entries & Search) */}
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
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={fetchStudents}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition shrink-0 cursor-pointer"
              title="Refresh List"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-rose-600' : ''}`} />
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
                    <span>REGISTRATION NO</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th onClick={() => handleSort('franchiseeId')} className="p-3.5 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>FRANCHISEE ID</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th onClick={() => handleSort('name')} className="p-3.5 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>NAME</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th onClick={() => handleSort('contactNo')} className="p-3.5 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>MOBILE NO</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th onClick={() => handleSort('place')} className="p-3.5 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>PLACE</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th onClick={() => handleSort('course')} className="p-3.5 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>COURSE</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th onClick={() => handleSort('admissionDate')} className="p-3.5 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>DATE</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-3.5 text-center whitespace-nowrap">
                  <span>VIEW DETAILS</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs sm:text-sm font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin text-rose-600 mx-auto mb-2" />
                    <span>Loading certificate students...</span>
                  </td>
                </tr>
              ) : paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-500">
                    <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-sm text-slate-700">No certificate students found</p>
                    <p className="text-xs text-slate-400 mt-1">Students enrolled through Certificate Admission Form will appear here.</p>
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((s, idx) => (
                  <tr key={s.id || idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-bold font-mono text-slate-900 whitespace-nowrap">
                      {s.registrationNo}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                        {s.franchiseeId || 'FR-MYSORE'}
                      </span>
                    </td>
                    <td className="p-3.5 font-bold text-slate-900 uppercase whitespace-nowrap">
                      {s.fullName || s.name}
                    </td>
                    <td className="p-3.5 whitespace-nowrap text-slate-600 font-mono">
                      {s.mobileNo || s.contactNo || '—'}
                    </td>
                    <td className="p-3.5 whitespace-nowrap text-slate-700 font-medium">
                      {s.place || s.trustBranch || '—'}
                    </td>
                    <td className="p-3.5 whitespace-nowrap text-slate-700 font-medium">
                      {s.course || '—'}
                    </td>
                    <td className="p-3.5 whitespace-nowrap text-slate-600">
                      {s.admissionDate || s.createdDate || '—'}
                    </td>
                    <td className="p-3.5 text-center whitespace-nowrap">
                      <button
                        onClick={() => setSelectedStudent(s)}
                        className="bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-rose-600/20 transition active:scale-95 whitespace-nowrap mx-auto cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>VIEW DETAILS</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {filteredStudents.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 px-1 border-t border-slate-200">
            <div className="text-xs text-slate-500 font-semibold text-center sm:text-left">
              Showing <span className="font-extrabold text-slate-800">{filteredStudents.length > 0 ? startIndex + 1 : 0}</span> to <span className="font-extrabold text-slate-800">{endIndex}</span> of <span className="font-extrabold text-slate-800">{filteredStudents.length}</span> students
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition shadow-xs cursor-pointer"
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
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition shadow-xs cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* STUDENT FULL DETAILS / ADMISSION FORM MODAL */}
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
                      <span className="font-semibold text-slate-900 break-all text-[11px] sm:text-xs">{selectedStudent.admissionDate || selectedStudent.createdDate || 'N/A'}</span>
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
                          ? `${selectedStudent.dobYear} ${selectedStudent.dobMonth || ''}${selectedStudent.dobDay ? `, ${selectedStudent.dobDay}` : ''}` 
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
                    {selectedStudent.photoPreview || selectedStudent.photoUrl || selectedStudent.photo ? (
                      <img
                        src={selectedStudent.photoPreview || selectedStudent.photoUrl || selectedStudent.photo}
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
                  {selectedStudent.aadharPreview || selectedStudent.aadharUrl ? (
                    <div
                      onClick={() => setViewDocument({
                        title: `Aadhar Card - ${selectedStudent.fullName || selectedStudent.name}`,
                        preview: selectedStudent.aadharPreview || selectedStudent.aadharUrl,
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
                          <img src={selectedStudent.aadharPreview || selectedStudent.aadharUrl} alt="Aadhar" className="w-full h-28 object-cover rounded-lg mx-auto" />
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
                  {selectedStudent.marksheetPreview || selectedStudent.marksheetUrl ? (
                    <div
                      onClick={() => setViewDocument({
                        title: `Marksheet - ${selectedStudent.fullName || selectedStudent.name}`,
                        preview: selectedStudent.marksheetPreview || selectedStudent.marksheetUrl,
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
                          <img src={selectedStudent.marksheetPreview || selectedStudent.marksheetUrl} alt="Marksheet" className="w-full h-28 object-cover rounded-lg mx-auto" />
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
                              : `<img src="${viewDocument.preview}" style="max-width:100%; max-height:100vh; object-fit:contain; box-shadow:0 10px 30px rgba(0,0,0,0.5);" />`
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
                  className="max-h-[620px] w-auto object-contain rounded-xl shadow-md border border-slate-200"
                />
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
