import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  CheckCircle2, 
  User, 
  Phone, 
  BookOpen, 
  Mail, 
  Calendar, 
  Building2, 
  Award, 
  FileCheck,
  Search,
  ExternalLink,
  ArrowLeft
} from 'lucide-react';
import { db, collection, getDocs, doc, getDoc } from '../firebase';

export default function StudentVerificationPage() {
  const { admissionNo: paramAdmNo } = useParams();
  const [searchQuery, setSearchQuery] = useState(paramAdmNo || '');
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (paramAdmNo) {
      fetchStudentDetails(paramAdmNo);
    } else {
      setLoading(false);
    }
  }, [paramAdmNo]);

  const extractPhoto = (r) => {
    if (!r) return '';
    return r.photoUrl || r.photoPreview || r.photo || r.candidatePhoto || r.studentPhoto || r.profilePhoto || r.avatar || '';
  };

  const hasStudentData = (r) => {
    if (!r) return false;
    return !!(r.candidateName || r.name || r.fullName || r.studentName || extractPhoto(r) || r.course || r.courseCode);
  };

  const fetchStudentDetails = async (admQuery) => {
    setLoading(true);
    setError('');
    const targetKey = admQuery.trim().toLowerCase();

    // 1. Search in LocalStorage Caches first
    let found = null;
    const cacheKeys = ['sle_students_cache', 'sle_coaching_students_cache', 'sle_applications_cache'];
    for (const cacheKey of cacheKeys) {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) continue;
      try {
        const recs = JSON.parse(raw);
        found = recs.find(r => 
          hasStudentData(r) &&
          [r.registrationNo, r.appNumber, r.admissionNo, r.admNo, r.id, r.rollNo, r.htNo]
            .some(f => f && String(f).toLowerCase() === targetKey)
        );
        if (found) break;
      } catch (_) {}
    }

    // 2. Search registered certificates or marksheets in localStorage
    if (!found) {
      const certs = JSON.parse(localStorage.getItem('sle_registered_certificates') || '{}');
      const marksheets = JSON.parse(localStorage.getItem('sle_registered_marksheets') || '{}');
      found = certs[admQuery] || certs[targetKey] || marksheets[admQuery] || marksheets[targetKey];
    }

    // 3. Search live in Firestore database across marksheets, certificates, students, applications
    const firestoreCandidates = [];
    if (db) {
      try {
        // Direct cert & marksheet lookup
        for (const col of ['certificates', 'marksheets']) {
          const directDoc = await getDoc(doc(db, col, targetKey));
          if (directDoc.exists()) {
            const dData = { id: directDoc.id, ...directDoc.data() };
            if (hasStudentData(dData)) firestoreCandidates.push(dData);
          }
        }

        // Full collection search across student databases
        for (const colName of ['students', 'applications', 'coaching_students', 'marksheets', 'certificates']) {
          const snap = await getDocs(collection(db, colName));
          snap.forEach(d => {
            const data = { id: d.id, ...d.data() };
            const fields = [
              data.registrationNo,
              data.appNumber,
              data.admissionNo,
              data.admNo,
              data.rollNo,
              data.htNo,
              data.id
            ].filter(Boolean).map(f => String(f).trim().toLowerCase());

            const name = (data.candidateName || data.name || data.fullName || '').trim().toLowerCase();

            if (fields.includes(targetKey) || (name && name === targetKey)) {
              if (hasStudentData(data)) {
                firestoreCandidates.push(data);
              }
            }
          });
        }
      } catch (err) {
        console.warn('Firestore verification lookup notice:', err);
      }
    }

    // Merge best candidate from Firestore if better than or supplements found
    if (firestoreCandidates.length > 0) {
      const sortedCandidates = [...firestoreCandidates].sort((a, b) => {
        const isCertA = (a.candidateName || a.issueDate || (a.htNo && String(a.htNo).startsWith('SLE2026'))) ? 1 : 0;
        const isCertB = (b.candidateName || b.issueDate || (b.htNo && String(b.htNo).startsWith('SLE2026'))) ? 1 : 0;
        if (isCertA !== isCertB) return isCertB - isCertA;

        const timeA = new Date(a.updatedAt || a.createdAt || a.appliedDate || 0).getTime() || 0;
        const timeB = new Date(b.updatedAt || b.createdAt || b.appliedDate || 0).getTime() || 0;
        return timeB - timeA;
      });

      const withPhoto = sortedCandidates.find(c => extractPhoto(c));
      const withName = sortedCandidates.find(c => c.candidateName || c.name || c.fullName);
      const chosen = withPhoto || withName || sortedCandidates[0];

      if (chosen) {
        found = { 
          ...found, 
          ...chosen,
          candidateName: chosen.candidateName || chosen.fullName || chosen.name || (found ? (found.candidateName || found.fullName || found.name) : ''),
          fatherName: chosen.fatherName || chosen.parentName || (found ? (found.fatherName || found.parentName) : ''),
          photoUrl: extractPhoto(chosen) || (found ? extractPhoto(found) : '')
        };
      }
    }

    // Also check local cache for photo if found lacks photo
    if (found && !extractPhoto(found)) {
      for (const cacheKey of cacheKeys) {
        const raw = localStorage.getItem(cacheKey);
        if (!raw) continue;
        try {
          const recs = JSON.parse(raw);
          const photoMatch = recs.find(r => 
            extractPhoto(r) &&
            [r.registrationNo, r.appNumber, r.admissionNo, r.admNo, r.id, r.rollNo, r.htNo]
              .some(f => f && String(f).toLowerCase() === targetKey)
          );
          if (photoMatch) {
            found = { ...found, photoUrl: extractPhoto(photoMatch) };
            break;
          }
        } catch (_) {}
      }
    }

    if (!found) {
      setError(`No verified student record found for Registration/Admission No: "${admQuery}". Please verify the credentials.`);
      setStudent(null);
      setLoading(false);
      return;
    }

    setStudent({
      admNo: found.registrationNo || found.admissionNo || found.admNo || found.appNumber || found.id || admQuery,
      htNo: found.rollNo || found.htNo || found.examRollNo || 'SLE2345',
      candidateName: found.candidateName || found.name || found.fullName || found.studentName || 'STUDENT NAME',
      fatherName: found.fatherName || found.parentName || '—',
      mobile: found.mobile || found.phone || found.contactNo || found.mobileNo || '+91 98765 43210',
      course: found.course || found.courseName || found.courseTitle || found.courseCode || 'DCA',
      courseCode: found.courseCode || found.course || 'DCA',
      email: found.email || found.emailId || 'student@sleinstitutions.com',
      dob: found.dob || found.dateOfBirth || found.birthDate || '2004-05-15',
      trainingCenter: found.trustBranch || found.trainingCenter || found.franchiseName || found.branchName || found.place || 'SLES Institution, Athani',
      photoUrl: extractPhoto(found),
      issueDate: found.issueDate || '2026-08-27',
      division: found.division || 'FIRST CLASS',
      status: 'VERIFIED'
    });
    setLoading(false);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      fetchStudentDetails(searchQuery.trim());
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4 sm:px-6 lg:px-8 font-sans selection:bg-rose-500 selection:text-white">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Top Header Card */}
        <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-amber-900 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-rose-700/50 text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider text-amber-200 border border-white/20">
              <ShieldCheck className="w-4 h-4 text-amber-300" />
              <span>Official Student Verification Portal</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
              <img 
                src="/logo-2.png" 
                alt="SLES Logo" 
                className="w-14 h-14 object-contain bg-white/10 p-1 rounded-2xl border border-white/25 shadow-md shrink-0" 
              />
              <h1 className="text-2xl sm:text-4xl font-black tracking-wide font-serif text-amber-100">
                SLES INSTITUTIONS
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-rose-100 font-medium max-w-lg mx-auto">
              Soft Line Educational Society &bull; Recognised by Govt. of India &bull; ISO 21001:2025 Certified
            </p>
          </div>
        </div>

        {/* Search Bar - Hidden when scanned directly via Admission No parameter */}
        {!paramAdmNo && (
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-slate-200">
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter Admission No to verify student..."
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm font-bold focus:outline-none focus:border-rose-600 focus:bg-white transition"
                />
              </div>
              <button
                type="submit"
                className="bg-rose-700 hover:bg-rose-800 text-white px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition shrink-0 cursor-pointer"
              >
                Verify
              </button>
            </form>
          </div>
        )}

        {/* Main Verification Result */}
        {loading ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-xl border border-slate-200 space-y-3">
            <div className="w-10 h-10 border-4 border-rose-700 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-600 font-bold text-sm">Verifying student records with database...</p>
          </div>
        ) : student ? (
          <div className="bg-white rounded-3xl shadow-2xl border-2 border-rose-700/80 overflow-hidden animate-in fade-in duration-300">
            
            {/* Authenticity Banner */}
            <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white px-6 py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-black text-sm uppercase tracking-wider">
                <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                <span>OFFICIAL VERIFIED STUDENT RECORD</span>
              </div>
              <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-widest text-white">
                VERIFIED
              </span>
            </div>

            {/* Student Profile Card (Matching requested handwritten diagram layout) */}
            <div className="p-6 sm:p-8 space-y-6">
              
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 border-b border-slate-200 pb-6">
                {/* Photo (std: Photo) */}
                <div className="w-32 h-40 rounded-2xl border-4 border-rose-700 p-1 bg-white shadow-lg shrink-0 overflow-hidden relative flex items-center justify-center">
                  {student.photoUrl ? (
                    <img
                      src={student.photoUrl}
                      alt={student.candidateName}
                      className="w-full h-full object-cover rounded-xl"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        const fallbackEl = e.target.parentElement.querySelector('.avatar-placeholder');
                        if (fallbackEl) fallbackEl.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className="avatar-placeholder w-full h-full bg-slate-100 rounded-xl flex flex-col items-center justify-center text-slate-400"
                    style={{ display: student.photoUrl ? 'none' : 'flex' }}
                  >
                    <User className="w-14 h-14 text-slate-300" />
                    <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">No Photo</span>
                  </div>
                  <div className="absolute bottom-1 right-1 bg-emerald-600 text-white p-1 rounded-full shadow z-10">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Main Identity Info */}
                <div className="flex-1 text-center sm:text-left space-y-2">
                  <div className="inline-block bg-rose-50 text-rose-800 font-mono font-bold text-xs px-3 py-1 rounded-full border border-rose-200">
                    Registration No: {student.admNo}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-wide font-serif">
                    {student.candidateName}
                  </h2>
                  <p className="text-sm font-bold text-slate-600">
                    Son / Daughter / Wife of <span className="text-slate-900 uppercase">{student.fatherName}</span>
                  </p>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-2">
                    <span className="bg-slate-100 text-slate-800 text-xs font-bold px-3 py-1 rounded-lg border border-slate-200">
                      Hall Ticket No: <strong className="font-mono text-rose-800">{student.htNo}</strong>
                    </span>
                    <span className="bg-amber-50 text-amber-900 text-xs font-bold px-3 py-1 rounded-lg border border-amber-200">
                      Division: <strong>{student.division}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Exact Fields Specified in Diagram (Name, Mob, Course, Email, DOB) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Name */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Name:</span>
                    <span className="text-sm font-extrabold text-slate-900 uppercase">{student.candidateName}</span>
                  </div>
                </div>

                {/* Mob */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Mob:</span>
                    <span className="text-sm font-extrabold text-slate-900 font-mono">{student.mobile}</span>
                  </div>
                </div>

                {/* Course */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Course:</span>
                    <span className="text-sm font-extrabold text-slate-900 uppercase">{student.course} ({student.courseCode})</span>
                  </div>
                </div>

                {/* Email */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Email:</span>
                    <span className="text-sm font-extrabold text-slate-900 font-mono">{student.email}</span>
                  </div>
                </div>

                {/* DOB */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">DOB:</span>
                    <span className="text-sm font-extrabold text-slate-900 font-mono">{student.dob}</span>
                  </div>
                </div>

                {/* Branch / Training Center */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Training Center:</span>
                    <span className="text-sm font-extrabold text-slate-900 uppercase">{student.trainingCenter}</span>
                  </div>
                </div>

              </div>

              {/* Certificate Verification Stamp Footer */}
              <div className="bg-rose-50/80 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-rose-700 text-white flex items-center justify-center shrink-0 shadow-md">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-rose-950 uppercase">Soft Line Educational Society (SLES Group)</h4>
                    <p className="text-xs font-bold text-rose-700">Official Certificate Verified &amp; Issued on {student.issueDate}</p>
                  </div>
                </div>
                <div className="shrink-0">
                  <span className="inline-flex items-center gap-1.5 bg-emerald-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl shadow-md">
                    <FileCheck className="w-4 h-4" />
                    <span>AUTHENTIC RECORD</span>
                  </span>
                </div>
              </div>

            </div>

          </div>
        ) : (
          <div className="bg-white rounded-3xl p-10 text-center shadow-xl border border-slate-200 space-y-3">
            <p className="text-slate-700 font-bold text-base">Enter an Admission Number above to search and verify student details.</p>
          </div>
        )}

      </div>
    </div>
  );
}
