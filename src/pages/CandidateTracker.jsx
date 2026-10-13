import React, { useState } from 'react';
import { Users, Search, CheckCircle2, Filter, RefreshCw } from 'lucide-react';

export default function CandidateTracker() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('All');

  // Sample registered candidates mock dataset
  const candidates = [
    {
      appNo: 'SLE-2026-904123',
      franchiseeId: 'FR-2026-901',
      name: 'Prajwal Kumar M.',
      fatherName: 'Manjunatha K.',
      course: 'Navodaya Entrance Coaching (Class 6th)',
      appliedDate: '2026-08-18',
      branch: 'Main Campus - Mysuru',
      status: 'Verified',
      statusBg: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    },
    {
      appNo: 'SLE-2026-881294',
      franchiseeId: 'FR-2026-903',
      name: 'Ananya Gowda',
      fatherName: 'Nagaraju G.',
      course: 'Morarji Desai Residential School (Class 6th)',
      appliedDate: '2026-08-19',
      branch: 'Mandya Branch',
      status: 'Pending Verification',
      statusBg: 'bg-amber-50 text-amber-700 border-amber-200'
    },
    {
      appNo: 'SLE-2026-773419',
      franchiseeId: 'FR-2026-904',
      name: 'Chetan V. Patil',
      fatherName: 'Veeresh Patil',
      course: 'Sainik School Entrance Exam (Class 6th)',
      appliedDate: '2026-08-15',
      branch: 'Hassan Branch',
      status: 'Seat Allocated',
      statusBg: 'bg-rose-50 text-rose-700 border-rose-200'
    },
    {
      appNo: 'SLE-2026-654921',
      franchiseeId: 'FR-2026-901',
      name: 'Kavya S. R.',
      fatherName: 'Ramesh S.',
      course: 'Kittur Rani Chennamma Residential',
      appliedDate: '2026-08-17',
      branch: 'Main Campus - Mysuru',
      status: 'Verified',
      statusBg: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    },
    {
      appNo: 'SLE-2026-541289',
      franchiseeId: 'FR-2026-905',
      name: 'Darshan B. M.',
      fatherName: 'Mahesh B.',
      course: 'Navodaya Entrance Coaching (Class 6th)',
      appliedDate: '2026-08-20',
      branch: 'Tumakuru Branch',
      status: 'Under Review',
      statusBg: 'bg-blue-50 text-blue-700 border-blue-200'
    }
  ];

  const filteredCandidates = candidates.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.appNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.franchiseeId && c.franchiseeId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      c.fatherName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCourse = selectedCourse === 'All' || c.course.includes(selectedCourse);
    return matchesSearch && matchesCourse;
  });

  return (
    <div className="py-10 px-4 sm:px-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200 mb-2">
            <Users className="w-4 h-4 text-rose-600" /> Live Admission Registry
          </div>
          <h2 className="text-3xl font-black text-slate-900">Candidate Status Tracker</h2>
          <p className="text-slate-600 text-sm">Track real-time admission application status and verification updates.</p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => { setSearchTerm(''); setSelectedCourse('All'); }}
            className="bg-white hover:bg-slate-100 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border border-slate-200 shadow-sm transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Registry
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Search */}
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Student Name, Application No (e.g. SLE-2026), Franchisee ID, or Father's Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 shadow-sm"
          />
        </div>

        {/* Filter Course */}
        <div className="relative">
          <Filter className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 shadow-sm"
          >
            <option value="All">All Courses</option>
            <option value="Navodaya">Navodaya Entrance</option>
            <option value="Morarji">Morarji Desai</option>
            <option value="Sainik">Sainik School</option>
            <option value="Kittur">Kittur Chennamma</option>
          </select>
        </div>
      </div>

      {/* Candidates Table Card */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 text-xs font-bold border-b border-slate-200 uppercase tracking-wider">
                <th className="py-4 px-6">App Ref No</th>
                <th className="py-4 px-6">Franchisee ID</th>
                <th className="py-4 px-6">Student & Father Name</th>
                <th className="py-4 px-6">Course Choice</th>
                <th className="py-4 px-6">Branch</th>
                <th className="py-4 px-6">Applied Date</th>
                <th className="py-4 px-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm text-slate-800">
              {filteredCandidates.length > 0 ? (
                filteredCandidates.map((c) => (
                  <tr key={c.appNo} className="hover:bg-rose-50/30 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-rose-700 text-xs">
                      {c.appNo}
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-sky-50 text-sky-700 border border-sky-200">
                        {c.franchiseeId || 'FR-DEFAULT'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-extrabold text-slate-900">{c.name}</div>
                      <div className="text-xs text-slate-500 font-medium">S/D of {c.fatherName}</div>
                    </td>
                    <td className="py-4 px-6 text-xs font-semibold text-slate-700">
                      {c.course}
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-600 font-medium">
                      {c.branch}
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-500 font-mono">
                      {c.appliedDate}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${c.statusBg}`}>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500 text-sm">
                    No matching candidates found for search term "{searchTerm}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
