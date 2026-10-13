import React from 'react';
import { GraduationCap, Award, CheckCircle, Clock, BookOpen, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CoachingPrograms() {
  const programs = [
    {
      id: 'navodaya',
      title: 'Jawahar Navodaya Vidyalaya (JNVST)',
      target: 'Class 5th Students (Class 6th Entrance)',
      duration: '1 Year Intensive / 6 Months Crash Course',
      highlights: ['Mental Ability Test Mastery', 'Arithmetic & Mathematics Drill', 'Kannada & English Reading Comprehension', 'Weekly Mock Test Series'],
      badge: 'Highest Selection Rate'
    },
    {
      id: 'morarji',
      title: 'Morarji Desai Residential Schools (KREIS)',
      target: 'Class 5th Students (Class 6th Entrance)',
      duration: '10 Months Comprehensive Program',
      highlights: ['Karnataka State Board Syllabus Focus', 'Environmental Science (EVS) Quick Revision', 'State Exam Paper Patterns', 'Individual Doubt Solving'],
      badge: 'State Rankers Batch'
    },
    {
      id: 'sainik',
      title: 'All India Sainik Schools Entrance (AISSEE)',
      target: 'Class 5th & 8th Students',
      duration: '1 Year Residential / Day Scholar',
      highlights: ['Mathematics & Intelligence Test', 'General Knowledge & Current Affairs', 'English & Language Test', 'Physical Fitness Orientation'],
      badge: 'Defense Career Stream'
    },
    {
      id: 'kittur',
      title: 'Kittur Rani Chennamma Residential School',
      target: 'Class 5th Girl Students Entrance',
      duration: '1 Year Dedicated Batch',
      highlights: ['Special Girls Residential Prep', 'Science & Logic Focus', 'Past 10 Years Question Bank', 'Personality & Interview Prep'],
      badge: 'Girls Specialized'
    }
  ];

  return (
    <div className="py-10 px-4 sm:px-6 max-w-7xl mx-auto space-y-10">
      {/* Header Hero */}
      <div className="text-center space-y-3 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
          <GraduationCap className="w-4 h-4 text-rose-600" /> Premier Coaching Programs
        </div>
        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Navodaya, Morarji & Sainik Entrance Batches
        </h2>
        <p className="text-slate-600 text-sm sm:text-base">
          Proven coaching methodologies, expert faculty, and structured test series for residential school entrance examinations in Karnataka.
        </p>
      </div>

      {/* Program Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {programs.map((prog) => (
          <div 
            key={prog.id}
            className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 space-y-6 hover:border-rose-300 hover:shadow-xl transition-all duration-300 shadow-md flex flex-col justify-between group"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  {prog.badge}
                </span>
                <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> {prog.duration}
                </span>
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-rose-600 transition-colors">
                  {prog.title}
                </h3>
                <p className="text-xs font-bold text-rose-600 mt-1">
                  Target: {prog.target}
                </p>
              </div>

              <div className="space-y-2 pt-3 border-t border-slate-100">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Key Features & Syllabus:</p>
                <ul className="space-y-2">
                  {prog.highlights.map((h, i) => (
                    <li key={i} className="text-xs sm:text-sm text-slate-700 flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Admissions Open 2026-27</span>
              <Link
                to="/coaching/admission-form"
                className="inline-flex items-center gap-2 text-xs font-bold text-rose-600 hover:text-rose-700 transition-colors"
              >
                Apply Online Now <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
