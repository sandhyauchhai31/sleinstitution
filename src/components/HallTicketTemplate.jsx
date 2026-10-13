import React, { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { getCourseShortName } from '../utils/courseManager';

// A5-landscape dimensions at 96 dpi
const DOC_W = 794;   // 210 mm
const DOC_H = 562;   // ~148 mm  (A5 landscape)
const SCALE = 0.72;

export default function HallTicketTemplate({ initialData, showControls = false }) {

  const build = (d) => ({
    admNo:          d?.admNo          || d?.admissionNo    || d?.registrationNo || '',
    htNo:           d?.htNo           || d?.rollNo         || d?.examRollNo     || '',
    candidateName:  d?.candidateName  || d?.name           || d?.fullName       || d?.studentName || '',
    fatherName:     d?.fatherName     || d?.parentName     || d?.guardianName   || '',
    courseCode:     getCourseShortName(d?.courseCode    || d?.course         || d?.courseName     || d?.courseTitle || d?.coachingPlan || d?.program || d?.selectedClass || ''),
    trainingCenter: d?.trainingCenter || d?.trustBranch    || d?.examCenter     || d?.franchiseName || d?.branchName || d?.place || '',
    examDate:       d?.examDate       || d?.date           || '2026 Feb, 8',
    examTime:       d?.examTime       || d?.time           || '10:00 AM to 1:00 PM',
    photoUrl:       d?.photoUrl       || d?.photoPreview   || d?.photo          || d?.candidatePhoto || '',
    examPin:        d?.examPin        || '',
    examId:         d?.examId         || '',
  });

  const [data, setData] = useState(() => build(initialData));
  useEffect(() => { if (initialData) setData(build(initialData)); }, [initialData]);

  const handlePrint = () => {
    const orig = document.body.style.minWidth;
    document.body.style.minWidth = `${DOC_W}px`;
    window.print();
    setTimeout(() => { document.body.style.minWidth = orig; }, 1500);
  };

  const renderTicketInner = () => (
    <div style={{
      border: '3px solid #b91c1c',
      margin: '5px',
      padding: '8px 12px 10px',
      position: 'relative',
      zIndex: 1,
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      overflow: 'hidden',
      borderRadius: '4px',
      boxSizing: 'border-box',
    }}>
      {/* HEADER: Logo + Institution Info + Photo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '4px 10px 8px',
        borderBottom: '1.5px dashed #fca5a5',
      }}>
        {/* SLES Logo */}
        <img
          src="/logo-2.png"
          alt="SLES Logo"
          style={{ width: '108px', height: '108px', objectFit: 'contain', flexShrink: 0 }}
        />

        {/* Institution Name + HALL TICKET badge */}
        <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
          <div style={{
            fontSize: '28px', fontWeight: 900, color: '#7f1d1d',
            letterSpacing: '0.04em', textTransform: 'uppercase',
            fontFamily: 'Georgia, serif', lineHeight: 1.15,
          }}>
            S.L.E.
          </div>
          <div style={{
            fontSize: '21px', fontWeight: 900, color: '#7f1d1d',
            letterSpacing: '0.04em',
            fontFamily: 'Georgia, serif', lineHeight: 1.2, marginTop: '3px',
          }}>
            Computer Saksharata Abhiyan
          </div>
          <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#1f2937', fontFamily: 'sans-serif', marginTop: '4px' }}>
            Regd. Under the govt. of India
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#1f2937', fontFamily: 'sans-serif', marginTop: '2px' }}>
            A Non-Profit Social Service Oriented Society Regd.
          </div>
          <div style={{
            display: 'inline-block',
            marginTop: '8px',
            backgroundColor: '#b91c1c',
            color: '#ffffff',
            fontSize: '14.5px',
            fontWeight: 900,
            letterSpacing: '0.24em',
            padding: '5px 32px',
            borderRadius: '4px',
            fontFamily: 'sans-serif',
            textTransform: 'uppercase',
          }}>
            HALL TICKET
          </div>
        </div>

        {/* Candidate Photo */}
        <div style={{
          width: '88px', height: '108px',
          border: '2px solid #b91c1c',
          borderRadius: '3px',
          overflow: 'hidden',
          flexShrink: 0,
          backgroundColor: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {data.photoUrl ? (
            <img
              src={data.photoUrl}
              alt={data.candidateName}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div style={{
              fontSize: '10px', color: '#94a3b8', textAlign: 'center',
              fontFamily: 'sans-serif', padding: '4px', fontWeight: 700
            }}>
              PHOTO
            </div>
          )}
        </div>
      </div>

      {/* STUDENT INFO GRID */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0',
        padding: '8px 16px 6px',
        borderBottom: '1.5px dashed #fca5a5',
        fontFamily: 'sans-serif',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <InfoRow label="Stud. Name"  value={data.candidateName} bold />
          <InfoRow label="Exam. No"    value={data.htNo} />
          <InfoRow label="Father Name" value={data.fatherName} />
          <InfoRow label="Branch"      value={data.trainingCenter} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', paddingLeft: '20px' }}>
          <InfoRow label="Registration No" value={data.admNo} />
          <InfoRow label="Course"          value={data.courseCode} bold />
          {data.examPin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span style={{ color: '#374151', fontWeight: 700, whiteSpace: 'nowrap', minWidth: '108px', fontSize: '12px', fontFamily: 'sans-serif' }}>Exam PIN:</span>
              <span style={{
                background: '#7f1d1d',
                color: '#fff',
                fontWeight: 900,
                fontFamily: 'monospace',
                fontSize: '12px',
                letterSpacing: '0.22em',
                padding: '2px 8px',
                borderRadius: '4px',
              }}>{data.examPin}</span>
            </div>
          )}
        </div>
      </div>

      {/* EXAM SCHEDULE TABLE */}
      <div style={{ padding: '6px 12px 4px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', fontFamily: 'sans-serif' }}>
          <thead>
            <tr style={{ color: '#991b1b' }}>
              {['Exam / Course', 'Center', 'Date', 'Time'].map((h) => (
                <th key={h} style={{
                  fontWeight: 800, textAlign: 'left', padding: '4px 6px',
                  borderBottom: '1.5px solid #fca5a5',
                  fontSize: '11.5px'
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1.5px dashed #fca5a5' }}>
              <td style={{ padding: '6px 6px', fontWeight: 700, color: '#0f172a', fontSize: '12px' }}>{data.courseCode || '—'}</td>
              <td style={{ padding: '6px 6px', color: '#374151', fontSize: '11.5px', fontWeight: 600 }}>{data.trainingCenter || '—'}</td>
              <td style={{ padding: '6px 6px', color: '#374151', fontSize: '11.5px', fontWeight: 600 }}>{data.examDate || '—'}</td>
              <td style={{ padding: '6px 6px', color: '#374151', fontSize: '11.5px', fontWeight: 600 }}>{data.examTime}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ flex: 1 }} />

      {/* SIGNATURE ROW */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        padding: '6px 36px 8px',
      }}>
        <SigBlock label="Student Sign" />
        <SigBlock label="Center Head Sign" />
        <SigBlock label="Examiner Sign" signImg="/sign.png" />
      </div>

    </div>
  );

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>

      {showControls && (
        <div className="print:hidden flex items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-md mb-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-600 animate-pulse inline-block"></span>
            <span className="text-sm font-bold text-slate-800">Hall Ticket Preview</span>
          </div>
          <button
            onClick={handlePrint}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-700 hover:bg-rose-800 text-white flex items-center gap-2 transition shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Print Hall Ticket
          </button>
        </div>
      )}

      {/* Screen preview wrapper — clipped to scaled visual size */}
      <div
        id="hallticket-preview-wrapper"
        style={{
          width: `${DOC_W * SCALE}px`,
          height: `${DOC_H * SCALE}px`,
          overflow: 'hidden',
          margin: '0 auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          borderRadius: '2px',
        }}
      >
        <div
          id="official-hallticket-document"
          style={{
            width: `${DOC_W}px`,
            height: `${DOC_H}px`,
            transform: `scale(${SCALE})`,
            transformOrigin: 'top left',
            backgroundColor: '#ffffff',
            border: '4px solid #b91c1c',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: 'sans-serif',
            boxSizing: 'border-box',
          }}
        >
          {renderTicketInner()}
        </div>
      </div>

      {/* PRINT SHEET: Single Hall Ticket */}
      <div id="official-hallticket-print-sheet" style={{ display: 'none' }}>
        <div className="hallticket-print-box">
          {renderTicketInner()}
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: A4 portrait !important;
            margin: 0 !important;
          }
          html, body {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide everything on the page */
          body * { visibility: hidden !important; }

          /* Zero-out preview wrapper */
          #hallticket-preview-wrapper,
          #hallticket-preview-wrapper * {
            display: none !important;
            visibility: hidden !important;
            width: 0 !important;
            height: 0 !important;
            overflow: hidden !important;
          }

          /* Show only the single ticket print sheet */
          #official-hallticket-print-sheet,
          #official-hallticket-print-sheet * {
            visibility: visible !important;
          }

          #official-hallticket-print-sheet {
            display: flex !important;
            flex-direction: column !important;
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            padding: 15mm 10mm !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            z-index: 9999999 !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
            page-break-inside: avoid !important;
            overflow: hidden !important;
          }

          .hallticket-print-box {
            width: 100% !important;
            height: 139mm !important;
            max-height: 139mm !important;
            background: #ffffff !important;
            border: 3.5px solid #b91c1c !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
          }

          .print\\:hidden, .no-print, button, header, nav, aside {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function InfoRow({ label, value, bold }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
      <span style={{ color: '#374151', fontWeight: 700, whiteSpace: 'nowrap', minWidth: '108px', fontSize: '12.5px' }}>
        {label}:
      </span>
      <span style={{
        fontWeight: bold ? 900 : 700,
        color: bold ? '#7f1d1d' : '#0f172a',
        textTransform: 'uppercase',
        fontSize: '12.5px',
      }}>
        {value || '\u2014'}
      </span>
    </div>
  );
}

function SigBlock({ label, signImg }) {
  return (
    <div style={{ textAlign: 'center', width: '135px' }}>
      <div style={{ height: '52px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        {signImg && (
          <img
            src={signImg}
            alt="Authorized Sign & Stamp"
            style={{ height: '62px', maxWidth: '135px', objectFit: 'contain', marginBottom: '-6px' }}
          />
        )}
      </div>
      <div style={{ width: '100px', borderBottom: '1.5px solid #334155', margin: '0 auto 4px' }} />
      <div style={{
        fontSize: '12px', fontWeight: 900, fontStyle: 'italic',
        color: '#1a1a6e', fontFamily: 'Georgia, serif',
      }}>{label}</div>
    </div>
  );
}
