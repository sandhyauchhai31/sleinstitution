import React, { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { getStoredSubjectsForCourse } from '../utils/subjectManager';
import { findStudentExamResult, mergeExamMarksIntoSubjects } from '../utils/questionPaperManager';
import { getCourseFullName } from '../utils/courseManager';
import { db, collection, getDocs } from '../firebase';

// A4-portrait dimensions at 96 dpi
const DOC_W = 794;   // 210 mm
const DOC_H = 1123;  // 297 mm (A4 portrait)
const SCALE = 0.72;
const defaultSubjects = [];

// ── Number to words ──────────────────────────────────────────────
function numberToWords(num) {
  const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
    'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
  if (num === 0) return 'ZERO';
  if (num < 20) return ones[num];
  if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
  if (num < 1000) return ones[Math.floor(num / 100)] + ' HUNDRED' + (num % 100 ? ' ' + numberToWords(num % 100) : '');
  return numberToWords(Math.floor(num / 1000)) + ' THOUSAND' + (num % 1000 ? ' ' + numberToWords(num % 1000) : '');
}

// ── Component ─────────────────────────────────────────────────────
export default function MarksheetTemplate({ initialData, showControls = true }) {

  const build = (d) => {
    const course = d?.course || d?.courseName || d?.courseTitle || d?.courseCode || d?.coachingPlan || d?.program || d?.selectedClass || 'PGDCA';
    let subjects = d?.subjects;
    if (!subjects || !subjects.length) {
      const dynamicList = getStoredSubjectsForCourse(course);
      subjects = dynamicList.map((s) => ({
        name: s.name,
        intMax: Number(s.intMax !== undefined ? s.intMax : 40),
        intObt: Number(s.intObt) || 0,
        extMax: Number(s.extMax !== undefined ? s.extMax : 60),
        extObt: Number(s.extObt) || 0
      }));
    }

    // Check & merge external marks from exam results
    const cachedResults = JSON.parse(localStorage.getItem('sle_exam_results_cache') || '[]');
    const examRes = findStudentExamResult(
      cachedResults,
      d?.admNo || d?.admissionNo || d?.registrationNo,
      d?.htNo || d?.rollNo,
      d?.candidateName || d?.studentName || d?.name
    );

    if (examRes) {
      subjects = mergeExamMarksIntoSubjects(subjects, examRes);
    }

    return {
      admNo: d?.admNo || d?.admissionNo || d?.registrationNo || 'ARG013023',
      htNo: d?.htNo || d?.rollNo || 'SLE00022',
      candidateName: d?.candidateName || d?.name || d?.fullName || d?.studentName || 'SHIVASHANKARAYYA BABALADIMATH',
      fatherName: d?.fatherName || d?.parentName || 'KARUMANIDHI',
      courseCode: course,
      startDate: d?.startDate || d?.admissionDate || '2022-01-01',
      endDate: d?.endDate || d?.completionDate || '2023-01-02',
      trainingCenter: d?.trainingCenter || d?.trustBranch || d?.franchiseName || d?.branchName || d?.place || 'SLES COMPUTERS TRAINING CENTER HIREPADASALAGI.',
      photoUrl: d?.photoUrl || d?.photo || d?.photoPreview || d?.candidatePhoto || '',
      subjects: subjects,
    };
  };

  const [data, setData] = useState(() => build(initialData));

  useEffect(() => {
    if (initialData) {
      setData(build(initialData));
    }
  }, [initialData]);

  // Sync directly from Firestore exam_results to guarantee live external marks load
  useEffect(() => {
    if (!db || !initialData) return;
    const fetchDirectResults = async () => {
      try {
        const snap = await getDocs(collection(db, 'exam_results'));
        if (!snap.empty) {
          const list = [];
          snap.forEach(docSnap => {
            const docData = docSnap.data();
            if (docData) list.push({ id: docSnap.id, ...docData });
          });
          if (list.length > 0) {
            const cached = JSON.parse(localStorage.getItem('sle_exam_results_cache') || '[]');
            const merged = [...list, ...cached];
            const unique = Array.from(new Map(merged.map(item => [item.id || item.submittedAt, item])).values());
            localStorage.setItem('sle_exam_results_cache', JSON.stringify(unique.slice(0, 500)));

            const examRes = findStudentExamResult(
              unique,
              initialData?.admNo || initialData?.admissionNo || initialData?.registrationNo,
              initialData?.htNo || initialData?.rollNo,
              initialData?.candidateName || initialData?.studentName || initialData?.name
            );
            if (examRes) {
              setData(prev => ({
                ...prev,
                subjects: mergeExamMarksIntoSubjects(prev.subjects, examRes)
              }));
            }
          }
        }
      } catch (err) {
        console.warn('Direct Firestore exam_results sync notice:', err);
      }
    };
    fetchDirectResults();
  }, [initialData]);

  const handlePrint = () => {
    const orig = document.body.style.minWidth;
    document.body.style.minWidth = `${DOC_W}px`;
    window.print();
    setTimeout(() => { document.body.style.minWidth = orig; }, 1500);
  };

  // Totals
  const subj = data.subjects || defaultSubjects;
  const totIntMax = subj.reduce((s, r) => s + Number(r.intMax || 0), 0);
  const totIntObt = subj.reduce((s, r) => s + Number(r.intObt || 0), 0);
  const totExtMax = subj.reduce((s, r) => s + Number(r.extMax || 0), 0);
  const totExtObt = subj.reduce((s, r) => s + Number(r.extObt || 0), 0);
  const grand = totIntObt + totExtObt;
  const maxAll = totIntMax + totExtMax;
  const pct = maxAll > 0 ? ((grand / maxAll) * 100).toFixed(0) : 0;
  const grandWords = numberToWords(grand);

  // ── Shared inline style objects (all px-based, designed for 794px wide) ──
  const S = {
    // Borders between table cells
    cellBorder: '1px solid #fb923c',
    cellBorderBold: '1px solid #f97316',
    // Row heights
    rowH: '34px',
  };

  const docContent = (
    <>
      {/* ── Watermark text (10.5px, visible like certificate) ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0.13,
          userSelect: 'none',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '6px',
          fontSize: '10.5px',
          fontFamily: 'sans-serif',
          fontWeight: 600,
          lineHeight: 1.2,
          color: '#451a03'
        }}
      >
        {Array.from({ length: 42 }).map((_, rowIndex) => (
          <div key={rowIndex} style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'nowrap', gap: '8px' }}>
            {Array.from({ length: 5 }).map((_, colIndex) => (
              <span key={colIndex}>Soft Line Educational Society</span>
            ))}
          </div>
        ))}
      </div>

      {/* ── Watermark logo ── */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', pointerEvents: 'none', userSelect: 'none', opacity: 0.06
      }}>
        <img src="/logo-2.png" alt="" style={{ width: '280px', height: '280px', objectFit: 'contain' }} />
      </div>

      {/* Inner orange border frame */}
      <div style={{
        border: '2px solid rgba(234,88,12,0.8)', margin: '3px', position: 'relative',
        zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden'
      }}>

        {/* ── TOP BAR: Adm No | NITI Aayog Logo | HT No ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '8px', padding: '8px 16px 6px'
        }}>
          <div style={{ width: '25%', textAlign: 'left' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#374151', fontFamily: 'sans-serif' }}>Registration No:</div>
            <div style={{ fontSize: '15px', fontWeight: 900, color: '#881337', fontFamily: 'monospace', marginTop: '2px' }}>{data.admNo}</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/niti-aayog-grey.png" alt="NITI Aayog" style={{ height: '62px', maxWidth: '240px', objectFit: 'contain' }} />
          </div>
          <div style={{ width: '25%', textAlign: 'right' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#374151', fontFamily: 'sans-serif' }}>Exam No:</div>
            <div style={{ fontSize: '15px', fontWeight: 900, color: '#881337', fontFamily: 'monospace', marginTop: '2px' }}>{data.htNo}</div>
          </div>
        </div>

        {/* ── MAIN TITLE (Full Width: S.L.E. & COMPUTER SAKSHARATA ABHIYAN in 1 line with clean border spacing) ── */}
        <div style={{ textAlign: 'center', width: '100%', paddingTop: '1px', paddingBottom: '2px', boxSizing: 'border-box', paddingLeft: '16px', paddingRight: '16px' }}>
          <div style={{ fontSize: '30px', fontWeight: 900, color: '#881337', textTransform: 'uppercase', letterSpacing: '2.5px', lineHeight: 1.1, paddingBottom: '2px' }}>
            S.L.E.
          </div>
          <h1 style={{ fontSize: '30px', fontWeight: 900, color: '#ea580c', letterSpacing: '0.4px', textTransform: 'uppercase', fontFamily: 'Georgia, serif', lineHeight: 1.1, margin: 0, padding: '1px 0 2px 0', whiteSpace: 'nowrap' }}>
            COMPUTER SAKSHARATA ABHIYAN
          </h1>
        </div>

        {/* ── LOGO BANNER & SUBTITLES ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 10px 6px',
          borderBottom: '2px solid rgba(234,88,12,0.55)'
        }}>
          <img src="/logo-2.png" alt="SLES Logo" style={{ width: '100px', height: '100px', objectFit: 'contain', flexShrink: 0 }} />
          <div style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#991b1b', padding: '1px 0 2px 0', lineHeight: 1.2 }}>
              Professional & Industrial Training Institute
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '2px 0', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>Soft Line Educational Society®</span>
              <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>(Regd By Karnataka Societies Act 17 of 1960)</span>
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#166534', padding: '2px 0', lineHeight: 1.2 }}>
              National Institute of Transforming India and LLP
            </div>
            <div style={{ fontSize: '12.5px', fontWeight: 900, color: '#1d4ed8', padding: '2px 0 1px 0', textTransform: 'uppercase', letterSpacing: '0.6px', lineHeight: 1.2 }}>
              ISO-21001:2025 Certified Institute
            </div>
            <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#15803d', padding: '2px 0', lineHeight: 1.2 }}>
              Recognized by Govt of India
            </div>
          </div>
          {/* Right Symmetrical Spacer for Perfect Page Centering */}
          <div style={{ width: '100px', height: '100px', flexShrink: 0 }} />
        </div>

        {/* ── TITLE ── */}
        <div style={{
          textAlign: 'center', padding: '8px 0', borderBottom: '2px solid rgba(234,88,12,0.5)',
          backgroundColor: '#fff8ee'
        }}>
          <h2 style={{
            fontSize: '18px', fontWeight: 900, color: '#1a1a6e', textTransform: 'uppercase',
            letterSpacing: '0.08em', fontFamily: 'sans-serif', margin: 0
          }}>
            Marksheet Cum Provisional Pass Certificate
          </h2>
        </div>

        {/* ── BODY TEXT ── */}
        <div style={{ padding: '12px 24px 10px', borderBottom: '1px solid rgba(234,88,12,0.25)' }}>
          {[
            ['This is to certify that Mr. / Mrs.', data.candidateName, true],
            ['Son / Daughter / Wife of', data.fatherName, true],
            ['has successfully Completed the Training in', getCourseFullName(data.courseCode), true],
          ].map(([label, val, upper], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px', fontSize: '15px' }}>
              <span style={{ fontStyle: 'italic', fontFamily: 'Georgia, serif', whiteSpace: 'nowrap', color: '#1e293b', fontSize: '15px' }}>{label}</span>
              <span style={{
                borderBottom: '1.5px solid #64748b', flex: 1, textAlign: 'center', fontWeight: 800,
                color: '#881337', textTransform: upper ? 'uppercase' : 'none', letterSpacing: '0.5px', fontSize: '15px'
              }}>{val}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '15px' }}>
            <span style={{ fontStyle: 'italic', fontFamily: 'Georgia, serif', color: '#1e293b', whiteSpace: 'nowrap', fontSize: '15px' }}>Program has from</span>
            <span style={{ borderBottom: '1.5px solid #64748b', padding: '0 16px', fontWeight: 700, color: '#1e293b', fontFamily: 'monospace', fontSize: '15px' }}>{data.startDate}</span>
            <span style={{ fontStyle: 'italic', fontFamily: 'Georgia, serif', color: '#1e293b', fontSize: '15px' }}>To</span>
            <span style={{ borderBottom: '1.5px solid #64748b', padding: '0 16px', fontWeight: 700, color: '#1e293b', fontFamily: 'monospace', fontSize: '15px' }}>{data.endDate}</span>
          </div>
          <div style={{
            textAlign: 'center', fontWeight: 700, fontSize: '12.5px', color: '#1e293b',
            marginTop: '10px', fontFamily: 'sans-serif', paddingTop: '8px'
          }}>
            The subject in which the candidate was examined and marks obtained are as under
          </div>
        </div>

        {/* ── MARKS TABLE ── */}
        <div style={{ padding: '0 14px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'sans-serif' }}>
            <thead>
              <tr style={{ backgroundColor: '#fef9c3' }}>
                <th rowSpan={2} style={{ border: S.cellBorderBold, padding: '9px 8px', textAlign: 'left', fontWeight: 700, color: '#1e293b', width: '33%', fontSize: '13px' }}>Subject</th>
                <th colSpan={2} style={{ border: S.cellBorderBold, padding: '7px 6px', textAlign: 'center', fontWeight: 700, color: '#1e293b', fontSize: '13px' }}>Internal</th>
                <th colSpan={2} style={{ border: S.cellBorderBold, padding: '7px 6px', textAlign: 'center', fontWeight: 700, color: '#1e293b', fontSize: '13px' }}>External</th>
                <th rowSpan={2} style={{ border: S.cellBorderBold, padding: '9px 6px', textAlign: 'center', fontWeight: 700, color: '#1e293b', fontSize: '13px' }}>Total<br />Marks</th>
              </tr>
              <tr style={{ backgroundColor: '#fefce8' }}>
                {['Maximum\nMarks', 'Marks\nObtained', 'Maximum\nMarks', 'Marks\nObtained'].map((h, i) => (
                  <th key={i} style={{
                    border: S.cellBorder, padding: '6px 4px', textAlign: 'center',
                    fontWeight: 600, color: '#374151', fontSize: '10.5px', whiteSpace: 'pre-line'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subj.map((row, idx) => {
                const tot = Number(row.intObt || 0) + Number(row.extObt || 0);
                return (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : 'rgba(255,237,213,0.25)', height: '34px' }}>
                    <td style={{ border: S.cellBorder, padding: '7px 8px', fontWeight: 600, color: '#1e293b', fontSize: '12px' }}>{row.name}</td>
                    <td style={{ border: S.cellBorder, padding: '7px 6px', textAlign: 'center', color: '#374151', fontSize: '12px' }}>{row.intMax}</td>
                    <td style={{ border: S.cellBorder, padding: '7px 6px', textAlign: 'center', fontWeight: 600, color: '#1e293b', fontSize: '12px' }}>{row.intObt}</td>
                    <td style={{ border: S.cellBorder, padding: '7px 6px', textAlign: 'center', color: '#374151', fontSize: '12px' }}>{row.extMax}</td>
                    <td style={{ border: S.cellBorder, padding: '7px 6px', textAlign: 'center', fontWeight: 600, color: '#1e293b', fontSize: '12px' }}>{row.extObt}</td>
                    <td style={{ border: S.cellBorder, padding: '7px 6px', textAlign: 'center', fontWeight: 700, color: '#881337', fontSize: '12.5px' }}>{tot}</td>
                  </tr>
                );
              })}
              <tr style={{ backgroundColor: '#fef9c3', height: '34px' }}>
                <td style={{ border: S.cellBorderBold, padding: '8px 8px', fontWeight: 700, fontSize: '12.5px' }}>Total</td>
                <td style={{ border: S.cellBorderBold, padding: '8px 6px', textAlign: 'center', fontWeight: 700, fontSize: '12.5px' }}>{totIntMax}</td>
                <td style={{ border: S.cellBorderBold, padding: '8px 6px', textAlign: 'center', fontWeight: 700, fontSize: '12.5px' }}>{totIntObt}</td>
                <td style={{ border: S.cellBorderBold, padding: '8px 6px', textAlign: 'center', fontWeight: 700, fontSize: '12.5px' }}>{totExtMax}</td>
                <td style={{ border: S.cellBorderBold, padding: '8px 6px', textAlign: 'center', fontWeight: 700, fontSize: '12.5px' }}>{totExtObt}</td>
                <td style={{ border: S.cellBorderBold, padding: '8px 6px', textAlign: 'center', fontWeight: 700, color: '#881337', fontSize: '13px' }}>{grand}</td>
              </tr>
              <tr style={{ backgroundColor: '#ffffff', height: '34px' }}>
                <td style={{ border: S.cellBorderBold, padding: '8px 8px', fontWeight: 700, color: '#1e293b', fontSize: '12px' }}>Grand Total In Words</td>
                <td colSpan={3} style={{ border: S.cellBorderBold, padding: '8px 8px', fontWeight: 700, color: '#1e293b', fontSize: '12px' }}>{grandWords}</td>
                <td colSpan={2} style={{ border: S.cellBorderBold, padding: '8px 8px', textAlign: 'right', fontWeight: 700, color: '#881337', fontSize: '12.5px' }}>Percentage: {pct}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Flex spacer pushes signature to bottom ── */}
        <div style={{ flex: 1 }}></div>

        {/* ── SIGNATURE ROW WITH CENTER QR CODE ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          padding: '12px 40px 14px'
        }}>
          <div style={{ textAlign: 'center', width: '150px' }}>
            <div style={{ height: '80px' }}></div>
            <div style={{ width: '130px', borderBottom: '2px solid #475569', margin: '0 auto 4px' }}></div>
            <div style={{
              fontSize: '13.5px', fontWeight: 900, fontStyle: 'italic', color: '#1a1a6e',
              fontFamily: 'Georgia, serif'
            }}>Branch Head</div>
          </div>

          {/* Center QR Code for Verification */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: '2px' }}>
            <div style={{ padding: '2px', background: '#ffffff', border: '1.5px solid #881337', borderRadius: '4px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://sleinstitutions.com/student/${data.admNo}`)}`}
                alt="Scan QR Code"
                style={{ width: '58px', height: '58px', display: 'block' }}
              />
            </div>
          </div>

          <div style={{ textAlign: 'center', width: '180px' }}>
            <div style={{ height: '80px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              <img
                src="/sign.png"
                alt="Authorized Sign & Stamp"
                style={{ height: '95px', maxWidth: '200px', objectFit: 'contain', marginBottom: '-8px' }}
              />
            </div>
            <div style={{ width: '140px', borderBottom: '2px solid #475569', margin: '0 auto 4px' }}></div>
            <div style={{
              fontSize: '13.5px', fontWeight: 900, fontStyle: 'italic', color: '#1a1a6e',
              fontFamily: 'Georgia, serif'
            }}>Managing Director</div>
          </div>
        </div>

      </div>
    </>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto flex flex-col items-center">

      {/* Screen Preview Wrapper (Fixed A4 794px x 1123px scaling) */}
      <div
        className="marksheet-scaling-wrapper"
        style={{
          width: `${DOC_W * SCALE}px`,
          height: `${DOC_H * SCALE}px`,
          overflow: 'hidden',
          margin: '0 auto',
          boxShadow: '0 16px 40px rgba(0,0,0,0.22)',
          borderRadius: '4px',
          backgroundColor: '#ffffff'
        }}
      >
        <div
          id="official-marksheet-document"
          style={{
            width: `${DOC_W}px`,
            height: `${DOC_H}px`,
            transform: `scale(${SCALE})`,
            transformOrigin: 'top left',
            backgroundColor: '#fffdf5',
            border: '10px solid #ea580c',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: 'Georgia, "Times New Roman", serif',
            boxSizing: 'border-box',
            color: '#0f172a'
          }}
        >
          {docContent}
        </div>
      </div>

      {/* ── Standalone Print CSS - 100% Perfect Edge-to-Edge A4 Sheet ── */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait !important;
            margin: 0 !important;
          }
          html {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: #ffffff !important;
          }
          body * {
            visibility: hidden !important;
          }
          body, main, div, section, article {
            transform: none !important;
            filter: none !important;
            animation: none !important;
          }
          .marksheet-scaling-wrapper,
          #marksheet-preview-wrapper {
            overflow: visible !important;
            width: 0 !important;
            height: 0 !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            position: static !important;
            background: transparent !important;
          }
          #official-marksheet-document,
          #official-marksheet-document * {
            visibility: visible !important;
          }
          #official-marksheet-document {
            position: fixed !important;
            left: 3mm !important;
            top: 3mm !important;
            width: calc(210mm - 6mm) !important;
            height: calc(297mm - 6mm) !important;
            max-height: calc(297mm - 6mm) !important;
            transform: none !important;
            transform-origin: unset !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 8px !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            z-index: 99999999 !important;
            background-color: #fffdf5 !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
          }
          .print\\:hidden, .no-print, button, header, nav, aside {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

