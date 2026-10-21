import React, { useState, useEffect } from 'react';
import { getCourseFullName, getCourseShortName, computeOneYearEndDate, computeOneMonthAfterDate } from '../utils/courseManager';
import { getCertificateConfig } from '../utils/certificateConfigManager';
import { resolveBranchAddressSync, resolveBranchAddressAsync, isDetailedCenterAddress } from '../utils/branchManager';

const DOC_W = 794;  // A4 width in px at 96 dpi (210mm)
const DOC_H = 1123; // A4 height in px at 96 dpi (297mm)
const SCALE = 0.72;

export default function CertificateTemplate({ initialData, customConfig, showControls = true, isUnlocked = true }) {
  const [data, setData] = useState(() => {
    const syncAddr = resolveBranchAddressSync(initialData);
    const resolvedBranchAddr = isDetailedCenterAddress(syncAddr, initialData)
      ? syncAddr
      : (isDetailedCenterAddress(initialData?.branchAddress, initialData) ? initialData.branchAddress : (syncAddr || initialData?.branchAddress || 'VISHRAMBAG SANGLI'));

    return {
      admNo: initialData?.admNo !== undefined ? initialData.admNo : (initialData?.admissionNo || '202638283'),
      htNo: initialData?.htNo !== undefined ? initialData.htNo : (initialData?.rollNo || 'SLE2026-ALL-8283'),
      candidateName: initialData?.candidateName !== undefined ? initialData.candidateName : (initialData?.studentName || 'TEST04'),
      fatherName: initialData?.fatherName !== undefined ? initialData.fatherName : (initialData?.parentName || 'TEST04'),
      courseCode: initialData?.courseCode !== undefined ? initialData.courseCode : (initialData?.course || 'C++'),
      startDate: initialData?.startDate || '2026-09-03',
      endDate: initialData?.endDate || '2027-09-06',
      division: initialData?.division !== undefined ? initialData.division : 'FIRST',
      courseTitle: initialData?.courseTitle !== undefined ? initialData.courseTitle : (initialData?.courseName || 'C++ PROGRAMMING LANGUAGE'),
      issueDate: initialData?.issueDate || '2027-10-06',
      trainingCenter: initialData?.trainingCenter !== undefined ? initialData.trainingCenter : (initialData?.examCenter || 'MYSORE'),
      branchAddress: resolvedBranchAddr,
      photoUrl: initialData?.photoUrl || ''
    };
  });

  const [config, setConfig] = useState(() => customConfig || getCertificateConfig());
  const [scale, setScale] = useState(SCALE);

  useEffect(() => {
    const updateScale = () => {
      const screenW = window.innerWidth;
      if (screenW < 640) {
        const availW = Math.max(280, screenW - 48);
        const dynamicScale = Math.min(SCALE, availW / DOC_W);
        setScale(dynamicScale);
      } else if (screenW < 1024) {
        const availW = Math.max(340, screenW - 80);
        const dynamicScale = Math.min(SCALE, availW / DOC_W);
        setScale(dynamicScale);
      } else {
        setScale(SCALE);
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  useEffect(() => {
    if (customConfig) {
      setConfig(customConfig);
    } else {
      const handleUpdate = () => setConfig(getCertificateConfig());
      window.addEventListener('sle_certificate_config_updated', handleUpdate);
      return () => window.removeEventListener('sle_certificate_config_updated', handleUpdate);
    }
  }, [customConfig]);

  const shortCourseCode = getCourseShortName(data.courseCode || data.course || data.courseTitle || '');
  const fullCourseTitle = getCourseFullName(data.courseTitle || data.courseCode || data.course || '');

  const resolvedStartDate = data.startDate || '2026-08-06';
  const exactOneYear = (() => {
    try {
      const p = resolvedStartDate.split('-');
      return `${parseInt(p[0], 10) + 1}-${p[1]}-${p[2]}`;
    } catch (_) { return ''; }
  })();

  const resolvedEndDate = (data.endDate && data.endDate > resolvedStartDate && data.endDate !== '2026-01-01')
    ? data.endDate
    : computeOneYearEndDate(resolvedStartDate, 3);

  const resolvedIssueDate = (data.issueDate && data.issueDate > resolvedEndDate)
    ? data.issueDate
    : computeOneMonthAfterDate(resolvedEndDate);

  useEffect(() => {
    let isMounted = true;
    if (initialData) {
      const sDate = initialData.startDate || initialData.admissionDate || '2026-09-03';

      const eDate = (initialData.endDate && initialData.endDate > sDate && initialData.endDate !== '2026-01-01')
        ? initialData.endDate
        : (initialData.completionDate && initialData.completionDate > sDate && initialData.completionDate !== '2026-01-01')
          ? initialData.completionDate
          : computeOneYearEndDate(sDate, 3);

      const iDate = (initialData.issueDate && initialData.issueDate > eDate)
        ? initialData.issueDate
        : computeOneMonthAfterDate(eDate);

      const syncAddr = resolveBranchAddressSync(initialData);
      const resolvedBranchAddr = isDetailedCenterAddress(syncAddr, initialData)
        ? syncAddr
        : (isDetailedCenterAddress(initialData.branchAddress, initialData) ? initialData.branchAddress : (syncAddr || initialData.branchAddress || prev.branchAddress || 'VISHRAMBAG SANGLI'));

      setData(prev => ({
        ...prev,
        admNo: initialData.admNo !== undefined ? initialData.admNo : (initialData.admissionNo || '202638283'),
        htNo: initialData.htNo !== undefined ? initialData.htNo : (initialData.rollNo || 'SLE2026-ALL-8283'),
        candidateName: initialData.candidateName !== undefined ? initialData.candidateName : (initialData.studentName || initialData.fullName || 'TEST04'),
        fatherName: initialData.fatherName !== undefined ? initialData.fatherName : (initialData.parentName || 'TEST04'),
        courseCode: initialData.courseCode !== undefined ? initialData.courseCode : (initialData.course || initialData.courseName || initialData.selectedClass || 'C++'),
        startDate: sDate,
        endDate: eDate,
        division: initialData.division !== undefined ? initialData.division : 'FIRST',
        courseTitle: initialData.courseTitle !== undefined ? initialData.courseTitle : (initialData.courseName || initialData.course || 'C++ PROGRAMMING LANGUAGE'),
        issueDate: iDate,
        trainingCenter: initialData.trainingCenter !== undefined ? initialData.trainingCenter : (initialData.examCenter || initialData.trustBranch || initialData.place || 'MYSORE'),
        branchAddress: resolvedBranchAddr,
        photoUrl: initialData.photoUrl || ''
      }));

      if (!isDetailedCenterAddress(resolvedBranchAddr, initialData)) {
        resolveBranchAddressAsync(initialData).then(liveAddr => {
          if (isMounted && liveAddr) {
            setData(prev => ({ ...prev, branchAddress: liveAddr }));
          }
        });
      }
    } else {
      resolveBranchAddressAsync({ trustBranch: 'MYSORE', trainingCenter: 'MYSORE' }).then(liveAddr => {
        if (isMounted && liveAddr) {
          setData(prev => ({ ...prev, branchAddress: liveAddr }));
        }
      });
    }
    return () => { isMounted = false; };
  }, [initialData]);

  const cfg = config || getCertificateConfig();
  const cleanSocietyName = (cfg.societyName || 'Soft Line Educational Society').replace(/®/g, '').trim();

  return (
    <div className="space-y-6 max-w-4xl mx-auto flex flex-col items-center w-full">
      {showControls && (
        <div className="flex items-center justify-between w-full max-w-2xl px-2 py-1 print:hidden">
          <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
            Certificate Actions
          </div>
          <button
            type="button"
            disabled={!isUnlocked}
            onClick={() => isUnlocked && window.print()}
            className={`px-4 py-2 rounded-xl font-extrabold text-xs shadow-md flex items-center gap-2 transition-all ${isUnlocked
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-500/25 cursor-pointer active:scale-95'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-700'
              }`}
            title={isUnlocked ? 'Print or Save Certificate PDF' : 'Pay fee via Razorpay Gateway to unlock certificate printing'}
          >
            {isUnlocked ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>Print / Save Certificate PDF</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Print Locked (Payment Required)</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Screen Preview Wrapper (Dynamic A4 Scaling for Mobile & Desktop) */}
      <div
        className="certificate-scaling-wrapper relative transition-all duration-300 max-w-full"
        style={{
          width: `${DOC_W * scale}px`,
          height: `${DOC_H * scale}px`,
          overflow: 'hidden',
          margin: '0 auto',
          boxShadow: '0 16px 40px rgba(0,0,0,0.22)',
          borderRadius: '4px',
          backgroundColor: '#ffffff'
        }}
      >

        <div
          id="official-certificate-document"
          style={{
            width: `${DOC_W}px`,
            height: `${DOC_H}px`,
            transform: `scale(${scale})`,
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

          {/* Watermark Overlay */}
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
                  <span key={colIndex}>{cleanSocietyName}</span>
                ))}
              </div>
            ))}
          </div>

          {/* Inner Accent Frame */}
          <div
            className="cert-inner-frame"
            style={{
              border: '2.5px solid rgba(234, 88, 12, 0.85)',
              padding: '12px 16px',
              position: 'relative',
              zIndex: 10,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxSizing: 'border-box'
            }}
          >

            {/* TOP HEADER SECTION */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>

              {/* Row 1: Top Bar (Adm No, NITI Aayog Logo, HT No) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '4px' }}>
                <div style={{ width: '25%', textAlign: 'left' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'sans-serif', color: '#0f172a' }}>Registration No:</div>
                  <div style={{ fontSize: '14px', fontWeight: 900, fontFamily: 'monospace', color: '#881337' }}>{data.admNo}</div>
                </div>

                <div style={{ width: '50%', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img
                    src={cfg.emblemUrl && cfg.emblemUrl !== '/ashok-chakra.png' ? cfg.emblemUrl : "/niti-aayog-grey.png"}
                    alt="NITI Aayog"
                    style={{ height: '70px', maxWidth: '250px', objectFit: 'contain' }}
                  />
                </div>

                <div style={{ width: '25%', textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'sans-serif', color: '#0f172a' }}>Exam No:</div>
                  <div style={{ fontSize: '14px', fontWeight: 900, fontFamily: 'monospace', color: '#881337' }}>{data.htNo}</div>
                </div>
              </div>

              {/* Row 2: Main Org Title (Full Width: 'COMPUTER SAKSHARATA ABHIYAN' on 1 line with clean border spacing) */}
              <div style={{ textAlign: 'center', width: '100%', paddingTop: '1px', paddingBottom: '2px', boxSizing: 'border-box', paddingLeft: '16px', paddingRight: '16px' }}>
                <div style={{ fontSize: '30px', fontWeight: 900, color: '#881337', textTransform: 'uppercase', letterSpacing: '2.5px', lineHeight: 1.1, paddingBottom: '2px' }}>
                  {cfg.orgTitleLine1 === 'S.L.E.S' || cfg.orgTitleLine1 === 'SLES' ? 'S.L.E.' : (cfg.orgTitleLine1 || 'S.L.E.')}
                </div>
                <h1 style={{ fontSize: '30px', fontWeight: 900, color: '#881337', textTransform: 'uppercase', letterSpacing: '0.4px', margin: 0, padding: '1px 0 2px 0', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                  {cfg.orgTitleLine2}
                </h1>
              </div>

              {/* Row 3: SLES Logo, Subtitles & Affiliations, Student Profile Photo (Logo & Photo kept a bit down) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', paddingTop: '2px' }}>
                {/* Left side single logo - kept bit down */}
                <div style={{ width: '110px', height: '105px', marginLeft: '4px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={cfg.leftLogoUrl || "/logo-2.png"} alt="SLES Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>

                <div style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#991b1b', padding: '1px 0 2px 0', lineHeight: 1.2 }}>
                    {cfg.instituteSub}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '2px 0', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>
                      {cleanSocietyName}®
                    </span>
                    <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
                      ({cfg.societyReg ? cfg.societyReg.replace(/^\(|\)$/g, '') : 'Regd By Karnataka Societies Act 17 of 1960'})
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#166534', padding: '2px 0', lineHeight: 1.2 }}>
                    {cfg.nitiAayogTag}
                  </div>
                  {cfg.llpTag ? (
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155', padding: '2px 0', lineHeight: 1.2 }}>
                      {cfg.llpTag}
                    </div>
                  ) : null}
                  <div style={{ fontSize: '12.5px', fontWeight: 900, color: '#1d4ed8', padding: '2px 0 1px 0', textTransform: 'uppercase', letterSpacing: '0.6px', lineHeight: 1.2 }}>
                    {cfg.certifiedTag}
                  </div>
                  <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#15803d', padding: '2px 0', lineHeight: 1.2 }}>
                    {(cfg.govtRecognized || 'Recognized by Govt of India').replace(/\bindia\b/g, 'India')}
                  </div>
                </div>

                {/* Right side Student Profile Photo or SLE Logo */}
                <div style={{ width: '92px', height: '112px', backgroundColor: '#ffffff', border: '3px solid #b91c1c', borderRadius: '3px', padding: '2px', flexShrink: 0, overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {data.photoUrl ? (
                    <img
                      src={data.photoUrl}
                      alt={data.candidateName || 'Candidate'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '1px' }}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = cfg.rightLogoUrl || '/logo.png';
                        e.target.style.objectFit = 'contain';
                      }}
                    />
                  ) : (
                    <img
                      src={cfg.rightLogoUrl || "/logo.png"}
                      alt="SLE Logo"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  )}
                </div>
              </div>

              {/* Row 3: Certificate Title Centered */}
              <div style={{ textAlign: 'center', padding: '6px 0 2px 0' }}>
                <h2 style={{ fontSize: '76px', fontWeight: 900, fontStyle: 'italic', color: '#1e3a8a', fontFamily: 'Georgia, serif', margin: 0, letterSpacing: '1.5px', lineHeight: 1 }}>
                  Certificate
                </h2>
              </div>

            </div>

            {/* CERTIFICATE STATEMENT BODY (EXACTLY 9 LINES TO MATCH REFERENCE PDF) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '8px 0', padding: '4px 0' }}>

              {/* Line 1: Candidate Name */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', width: '100%' }}>
                <span style={{ fontSize: '16px', fontStyle: 'italic', color: '#1e293b', whiteSpace: 'nowrap' }}>This is to certify that Mr. / Mrs.</span>
                <span style={{
                  flex: 1,
                  borderBottom: '2px solid #0f172a',
                  fontWeight: 900,
                  color: '#0f172a',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  fontSize: (data.candidateName || '').length > 40 ? '11px' : (data.candidateName || '').length > 30 ? '13px' : (data.candidateName || '').length > 22 ? '15px' : '18px',
                  letterSpacing: (data.candidateName || '').length > 25 ? '0px' : '0.5px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden'
                }}>
                  {data.candidateName}
                </span>
              </div>

              {/* Line 2: Father Name */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', width: '100%' }}>
                <span style={{ fontSize: '16px', fontStyle: 'italic', color: '#1e293b', whiteSpace: 'nowrap' }}>Son / Daughter / Wife of</span>
                <span style={{
                  flex: 1,
                  borderBottom: '2px solid #0f172a',
                  fontWeight: 900,
                  color: '#0f172a',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  fontSize: (data.fatherName || '').length > 40 ? '11px' : (data.fatherName || '').length > 30 ? '13px' : (data.fatherName || '').length > 22 ? '15px' : '18px',
                  letterSpacing: (data.fatherName || '').length > 25 ? '0px' : '0.5px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden'
                }}>
                  {data.fatherName}
                </span>
              </div>

              {/* Line 3: Course Short Form */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', width: '100%' }}>
                <span style={{ fontSize: '15px', fontStyle: 'italic', color: '#1e293b', whiteSpace: 'nowrap' }}>has successfully Completed the Training in</span>
                <span style={{
                  flex: 1,
                  borderBottom: '2px solid #0f172a',
                  fontWeight: 900,
                  color: '#0f172a',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  fontSize: shortCourseCode.length > 25 ? '13px' : '16px',
                  letterSpacing: '0.8px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {shortCourseCode}
                </span>
              </div>

              {/* Line 4: Dates */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', width: '100%' }}>
                <span style={{ fontSize: '15px', fontStyle: 'italic', color: '#1e293b', whiteSpace: 'nowrap' }}>Program has from</span>
                <span style={{ width: '160px', borderBottom: '2px solid #0f172a', fontWeight: 900, color: '#0f172a', textAlign: 'center', fontSize: '15px', fontFamily: 'monospace' }}>
                  {resolvedStartDate}
                </span>
                <span style={{ fontSize: '15px', fontStyle: 'italic', color: '#1e293b', whiteSpace: 'nowrap' }}>To</span>
                <span style={{ width: '160px', borderBottom: '2px solid #0f172a', fontWeight: 900, color: '#0f172a', textAlign: 'center', fontSize: '15px', fontFamily: 'monospace' }}>
                  {resolvedEndDate}
                </span>
              </div>

              {/* Line 5: Conducted By */}
              <div style={{ width: '100%', textAlign: 'left' }}>
                <span style={{ fontSize: '15px', fontStyle: 'italic', color: '#1e293b' }}>
                  Conducted by, {cleanSocietyName} a division of SLES Group, and has obtained
                </span>
              </div>

              {/* Line 6: Division & Branch */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', width: '100%' }}>
                <span style={{ fontSize: '15px', fontStyle: 'italic', color: '#1e293b', whiteSpace: 'nowrap' }}>the</span>
                <span style={{ width: '180px', borderBottom: '2px solid #0f172a', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', textAlign: 'center', fontSize: '17px' }}>
                  {data.division || 'FIRST'}
                </span>
                <span style={{ fontSize: '15px', fontStyle: 'italic', color: '#1e293b', whiteSpace: 'nowrap' }}>grade</span>
                <span style={{ fontSize: '15px', fontStyle: 'italic', color: '#1e293b', whiteSpace: 'nowrap', marginLeft: '12px' }}>Branch</span>
                <span style={{ flex: 1, borderBottom: '2px solid #0f172a', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', textAlign: 'center', fontSize: '17px' }}>
                  {data.trainingCenter || 'MYSORE'}
                </span>
              </div>

              {/* Line 7: Course Title Award */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', width: '100%' }}>
                <span style={{ fontSize: '15px', fontStyle: 'italic', color: '#1e293b', whiteSpace: 'nowrap' }}>The award of the</span>
                <span style={{
                  flex: 1,
                  borderBottom: '2px solid #0f172a',
                  fontWeight: 900,
                  color: '#0f172a',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  fontSize: fullCourseTitle.length > 50 ? '9.5px' : fullCourseTitle.length > 38 ? '11px' : fullCourseTitle.length > 25 ? '13px' : '15px',
                  letterSpacing: fullCourseTitle.length > 38 ? '-0.3px' : '0px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {fullCourseTitle}
                </span>
              </div>

              {/* Line 8: Issue Date */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', width: '100%' }}>
                <span style={{ fontSize: '16px', fontStyle: 'italic', color: '#1e293b', whiteSpace: 'nowrap' }}>Certificate is given on date</span>
                <span style={{ width: '220px', borderBottom: '2px solid #0f172a', fontWeight: 900, color: '#0f172a', textAlign: 'center', fontSize: '16px', fontFamily: 'monospace' }}>
                  {resolvedIssueDate}
                </span>
              </div>

              {/* Line 9: Branch Address */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', width: '100%' }}>
                <span style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap' }}>Branch Address:</span>
                <span style={{
                  flex: 1,
                  borderBottom: '2px solid #0f172a',
                  fontWeight: 900,
                  color: '#0f172a',
                  textTransform: 'uppercase',
                  textAlign: 'left',
                  paddingLeft: '8px',
                  fontSize: ((data.branchAddress || data.trainingCenter || '').length > 55) ? '9.5px' : ((data.branchAddress || data.trainingCenter || '').length > 42) ? '11px' : ((data.branchAddress || data.trainingCenter || '').length > 28) ? '13px' : '15px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {data.branchAddress || data.trainingCenter || 'MYSORE'}
                </span>
              </div>

            </div>

            {/* BOTTOM SIGNATURE SECTION */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', paddingTop: '10px', marginBottom: '8px' }}>
              <div style={{ width: '220px', textAlign: 'center' }}>
                <div style={{ height: '85px' }}></div>
                <div style={{ borderBottom: '2px solid rgba(15,23,42,0.7)', marginBottom: '6px' }}></div>
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#1e1b4b', fontFamily: 'Georgia, serif' }}>{cfg.signatoryBranchHead || 'Branch Head'}</div>
              </div>

              {/* Center QR Code for Verification */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: '2px' }}>
                <div style={{ padding: '2px', background: '#ffffff', border: '1.5px solid #881337', borderRadius: '4px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://sleinstitutions.com/student/${data.admNo}`)}`}
                    alt="Scan QR Code"
                    style={{ width: '64px', height: '64px', display: 'block' }}
                  />
                </div>
              </div>

              <div style={{ width: '250px', textAlign: 'center' }}>
                <div style={{ height: '85px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <img
                    src="/sign.png"
                    alt="Authorized Sign & Stamp"
                    style={{ height: '135px', maxWidth: '250px', objectFit: 'contain', marginBottom: '-10px' }}
                  />
                </div>
                <div style={{ borderBottom: '2px solid rgba(15,23,42,0.7)', marginBottom: '6px' }}></div>
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#1e1b4b', fontFamily: 'Georgia, serif' }}>{cfg.signatoryMD || 'Managing Director'}</div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#334155', marginTop: '2px' }}>{cfg.signatoryMDSub || 'S.L.E.S. Institution'}</div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Standalone Print CSS - 100% Perfect Edge-to-Edge A4 Sheet */}
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
          /* Neutralize stacking contexts and animations on ancestors in print */
          body, main, div, section, article {
            transform: none !important;
            filter: none !important;
            animation: none !important;
          }
          .certificate-scaling-wrapper,
          #certificate-preview-wrapper {
            overflow: visible !important;
            width: 0 !important;
            height: 0 !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            position: static !important;
            background: transparent !important;
          }
          ${isUnlocked ? `
          #official-certificate-document,
          #official-certificate-document * {
            visibility: visible !important;
          }
          #official-certificate-document {
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
            padding: 14px !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            z-index: 99999999 !important;
            background-color: #fffdf5 !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
          }
          ` : `
          #cert-print-locked-screen,
          #cert-print-locked-screen * {
            visibility: visible !important;
          }
          #cert-print-locked-screen {
            position: fixed !important;
            inset: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-family: sans-serif !important;
            text-align: center !important;
            padding: 40px !important;
            background: #ffffff !important;
            z-index: 9999999 !important;
          }
          `}
          .print\\:hidden, .no-print, button, header, nav, aside {
            display: none !important;
          }
        }
      `}</style>

      {/* Screen reader / print locked notice when unpaid */}
      {!isUnlocked && (
        <div id="cert-print-locked-screen" style={{ display: 'none' }}>
          <div>
            <h1 style={{ fontSize: '28px', color: '#dc2626', fontWeight: 'bold' }}>
              🔒 OFFICIAL CERTIFICATE LOCKED
            </h1>
            <p style={{ fontSize: '16px', color: '#475569', marginTop: '12px' }}>
              Payment is required via Razorpay Live Gateway before this certificate can be printed or saved as PDF.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
