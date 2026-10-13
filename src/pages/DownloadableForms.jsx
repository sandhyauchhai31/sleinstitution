import React from 'react';
import { FileText, Download, FileCheck } from 'lucide-react';

export default function DownloadableForms() {
  const forms = [
    {
      title: 'S.L.E. Admission Application Form 2026-27 (Offline Format)',
      code: 'FORM-OFFLINE-01',
      fileSize: '1.2 MB PDF',
      description: 'Printable offline admission application form for parents who wish to apply directly at trust campus.'
    },
    {
      title: 'Navodaya Entrance Coaching Prospectus & Fee Structure',
      code: 'PROSPECTUS-2026',
      fileSize: '3.4 MB PDF',
      description: 'Complete brochure detailing curriculum, hostel rules, class timings, and installment details.'
    },
    {
      title: 'Morarji Desai Entrance Certificate & Medical Declaration',
      code: 'MED-DEC-02',
      fileSize: '480 KB PDF',
      description: 'Mandatory medical fitness & guardian undertaking form required during offline document verification.'
    },
    {
      title: 'Hostel Accommodation & Dining Rules Form',
      code: 'HOSTEL-ADM-04',
      fileSize: '850 KB PDF',
      description: 'Hostel admission guidelines, rules, clothing inventory list, and visiting hours for parents.'
    }
  ];

  return (
    <div className="py-10 px-4 sm:px-6 max-w-5xl mx-auto space-y-8">
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
          <FileText className="w-4 h-4 text-rose-600" /> Download Center
        </div>
        <h2 className="text-3xl font-black text-slate-900">Official Downloadable Application Forms</h2>
        <p className="text-slate-600 text-sm">Download printable PDF forms, prospectus brochures, and institute guidelines.</p>
      </div>

      <div className="space-y-4">
        {forms.map((item, index) => (
          <div 
            key={index}
            className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md hover:shadow-lg hover:border-rose-200 transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <FileCheck className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold bg-slate-100 text-rose-700 px-2 py-0.5 rounded border border-slate-200">
                    {item.code}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">{item.fileSize}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                <p className="text-xs text-slate-600">{item.description}</p>
              </div>
            </div>

            <button 
              onClick={() => alert(`Downloading ${item.title}...`)}
              className="w-full sm:w-auto shrink-0 bg-slate-900 hover:bg-rose-600 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow border border-slate-800 hover:border-rose-500"
            >
              <Download className="w-4 h-4" /> Download PDF
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
