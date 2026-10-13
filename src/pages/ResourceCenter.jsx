import React from 'react';
import { BookOpen, Download, FileText, Sparkles } from 'lucide-react';

export default function ResourceCenter() {
  const resources = [
    {
      category: 'Navodaya (JNVST) Previous Question Papers',
      items: [
        { name: 'JNVST 2025 Solved Question Paper with Answer Key', size: '2.4 MB PDF' },
        { name: 'JNVST 2024 Question Paper (Kannada & English Medium)', size: '2.1 MB PDF' },
        { name: 'JNVST Mental Ability Model Test Series (Set A to E)', size: '4.5 MB PDF' },
      ]
    },
    {
      category: 'Morarji Desai Residential Exam Syllabus & Papers',
      items: [
        { name: 'Morarji Desai Entrance Exam 2025 Complete Solved Paper', size: '1.8 MB PDF' },
        { name: 'Class 5th Environmental Studies & General Science Notes', size: '3.2 MB PDF' },
        { name: 'Kannada Grammar & Vocabulary Practice Sheet', size: '1.1 MB PDF' },
      ]
    },
    {
      category: 'Sainik School (AISSEE) Model Practice Sets',
      items: [
        { name: 'AISSEE Class 6 Mathematics Formula Book & Shortcuts', size: '3.9 MB PDF' },
        { name: 'AISSEE Intelligence & Reasoning 500 Practice Questions', size: '5.2 MB PDF' },
      ]
    }
  ];

  return (
    <div className="py-10 px-4 sm:px-6 max-w-6xl mx-auto space-y-10">
      <div className="text-center space-y-2 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
          <BookOpen className="w-4 h-4 text-rose-600" /> Free Student Resources
        </div>
        <h2 className="text-3xl font-black text-slate-900">Model Papers & Study Material Center</h2>
        <p className="text-slate-600 text-sm">Access official syllabus copies, previous year entrance exam papers, and answer keys.</p>
      </div>

      <div className="space-y-8">
        {resources.map((sec, idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-md">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Sparkles className="w-4 h-4 text-amber-500" /> {sec.category}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sec.items.map((item, i) => (
                <div key={i} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3 hover:bg-rose-50/40 hover:border-rose-200 transition-all">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <FileText className="w-5 h-5 text-rose-600" />
                      <span className="text-[10px] text-slate-500 font-mono font-medium">{item.size}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 line-clamp-2">{item.name}</p>
                  </div>
                  <button 
                    onClick={() => alert(`Downloading: ${item.name}`)}
                    className="w-full bg-white hover:bg-rose-600 text-slate-800 hover:text-white py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 border border-slate-200 hover:border-rose-600 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Paper
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
