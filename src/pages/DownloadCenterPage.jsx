import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import CertificateTemplate from '../components/CertificateTemplate';
import MarksheetTemplate from '../components/MarksheetTemplate';
import HallTicketTemplate from '../components/HallTicketTemplate';
import { subscribeToCourses, DEFAULT_COURSES, getCourseFullName, getCourseShortName, computeOneYearEndDate, computeOneMonthAfterDate } from '../utils/courseManager';
import { getStoredSubjectsForCourse } from '../utils/subjectManager';
import { generatePin, saveHallTicketCredentials, generateRollNo, getHallTicketCredentials } from '../utils/examAuthManager';
import { getAllStoredExamsList, getExamDocId, subscribeToExams, findStudentExamResult, mergeExamMarksIntoSubjects } from '../utils/questionPaperManager';
import { filterStudentsForFranchisee } from '../utils/franchiseeFilter';
import { transferShurapurToShahapur } from '../utils/studentTransfer';
import { getStudentYear, getAvailableYears } from '../utils/studentYearHelper';
import { db, collection, getDocs, doc, getDoc, setDoc } from '../firebase';
import { getCertificateConfig } from '../utils/certificateConfigManager';
import { resolveBranchAddressSync, resolveBranchAddressAsync, isDetailedCenterAddress } from '../utils/branchManager';
import {
  Download,
  FileText,
  Award,
  BookOpen,
  Search,
  Printer,
  CheckCircle2,
  RefreshCw,
  FileCheck,
  ShieldCheck,
  Users,
  GraduationCap,
  CheckSquare,
  Square,
  Layers,
  Copy,
  ExternalLink,
  Sparkles,
  Key,
  Check,
  UserCheck,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Lock,
  QrCode,
  X,
  Smartphone
} from 'lucide-react';

// ── Number to words (for bulk marksheet HTML) ─────────────────────
function numToWords(num) {
  const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
    'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
  if (!num || num === 0) return 'ZERO';
  if (num < 20) return ones[num];
  if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
  if (num < 1000) return ones[Math.floor(num / 100)] + ' HUNDRED' + (num % 100 ? ' ' + numToWords(num % 100) : '');
  return numToWords(Math.floor(num / 1000)) + ' THOUSAND' + (num % 1000 ? ' ' + numToWords(num % 1000) : '');
}

// ── Date & Time Presets & Helpers ───────────────────────────────
export const EXAM_TIME_PRESETS = [
  '10:00 AM to 1:00 PM',
  '10:00 AM to 12:00 PM',
  '11:00 AM to 1:00 PM',
  '02:00 PM to 5:00 PM',
  '02:00 PM to 4:00 PM',
  '09:00 AM to 12:00 PM',
  '09:00 AM to 11:00 AM',
  '03:00 PM to 5:00 PM',
];

export const formatDateForInput = (isoDate) => {
  if (!isoDate) return '';
  try {
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${year} ${months[monthIdx] || parts[1]}, ${day}`;
    }
  } catch (e) { }
  return isoDate;
};

export const getRelativeDatePreset = (daysFromNow) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return formatDateForInput(`${y}-${m}-${day}`);
};

export const getNextDayOfWeekPreset = (targetDayOfWeek) => {
  const d = new Date();
  const currentDay = d.getDay();
  let diff = (targetDayOfWeek - currentDay + 7) % 7;
  if (diff === 0) diff = 7;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return formatDateForInput(`${y}-${m}-${day}`);
};

// ── Generate full A4 Certificate HTML string (for bulk print window) ─
function buildCertificateHTML(d, idx, total) {
  const pageBreak = idx < total - 1 ? 'page-break-after:always;' : '';
  const photoUrl = d.photoUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=300';
  const photoImg = `<img src="${photoUrl}" alt="${d.candidateName || ''}" style="width:100%;height:100%;object-fit:cover;border-radius:1px" onerror="this.src='https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=300'" />`;

  const admNo = d.admNo || d.admissionNo || '';
  const htNo = d.htNo || '';
  const candidateName = d.candidateName || d.studentName || d.fullName || '';
  const fatherName = d.fatherName || d.parentName || '';
  const shortCourseCode = getCourseShortName(d.courseCode || d.course || d.courseTitle || '');
  const startDate = d.startDate || d.admissionDate || '2025-01-01';
  const exactYear = (() => {
    try {
      const p = startDate.split('-');
      return `${parseInt(p[0], 10) + 1}-${p[1]}-${p[2]}`;
    } catch (_) { return ''; }
  })();

  const endDate = (d.endDate && d.endDate > startDate && d.endDate !== '2026-01-01' && d.endDate !== '2026-08-13' && d.endDate !== exactYear)
    ? d.endDate
    : computeOneYearEndDate(startDate, 3);
  const division = d.division || 'FIRST';
  const courseTitle = getCourseFullName(d.courseTitle || d.courseName || d.course || d.courseCode || '');
  const issueDate = (d.issueDate && d.issueDate > endDate && !d.issueDate.startsWith('2026-09-24'))
    ? d.issueDate
    : computeOneMonthAfterDate(endDate);
  const trainingCenter = d.trainingCenter || d.trustBranch || d.branchName || 'SLES Center';
  const syncAddr = resolveBranchAddressSync(d);
  const branchAddress = isDetailedCenterAddress(syncAddr, d)
    ? syncAddr
    : (isDetailedCenterAddress(d.branchAddress, d) ? d.branchAddress : (syncAddr || d.branchAddress || trainingCenter));

  const candidateNameFs = candidateName.length > 40 ? '11px' : candidateName.length > 30 ? '13px' : candidateName.length > 22 ? '15px' : '18px';
  const fatherNameFs = fatherName.length > 40 ? '11px' : fatherName.length > 30 ? '13px' : fatherName.length > 22 ? '15px' : '18px';
  const shortCourseCodeFs = shortCourseCode.length > 25 ? '13px' : '16px';
  const courseTitleFs = courseTitle.length > 50 ? '9px' : courseTitle.length > 38 ? '10.5px' : courseTitle.length > 25 ? '12.5px' : '15px';
  const courseTitleLs = courseTitle.length > 38 ? '-0.3px' : '0px';
  const trainingCenterFs = trainingCenter.length > 45 ? '10px' : trainingCenter.length > 32 ? '12px' : trainingCenter.length > 22 ? '14px' : '16px';
  const branchAddressFs = branchAddress.length > 55 ? '9.5px' : branchAddress.length > 42 ? '11px' : branchAddress.length > 28 ? '13px' : '15px';

  const candidateLetterSpacing = candidateName.length > 25 ? '0px' : '0.5px';
  const fatherLetterSpacing = fatherName.length > 25 ? '0px' : '0.5px';

  let watermarkRows = '';
  for (let r = 0; r < 42; r++) {
    watermarkRows += `<div style="display:flex;justify-content:space-between;white-space:nowrap;gap:8px">`;
    for (let c = 0; c < 5; c++) {
      watermarkRows += `<span>Soft Line Educational Society</span>`;
    }
    watermarkRows += `</div>`;
  }

  return `<div class="cert-print-sheet" style="width:210mm;height:297mm;max-height:297mm;background:#ffffff;padding:3mm;box-sizing:border-box;display:flex;align-items:center;justify-content:center;overflow:hidden;${pageBreak}">
    <div style="width:100%;height:100%;background:#fffdf5;border:10px solid #ea580c;
      padding:12px 14px;display:flex;flex-direction:column;justify-content:space-between;
      position:relative;overflow:hidden;font-family:Georgia,'Times New Roman',serif;
      box-sizing:border-box;color:#0f172a">
      
      <div style="position:absolute;inset:0;pointer-events:none;opacity:0.13;user-select:none;
        overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;
        padding:6px;font-size:10.5px;font-family:sans-serif;font-weight:600;line-height:1.2;color:#451a03">
        ${watermarkRows}
      </div>

      <div style="border:2.5px solid rgba(234,88,12,0.85);padding:10px 14px;position:relative;z-index:10;
        height:100%;display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box">

      <div style="display:flex;flex-direction:column;gap:4px">
        <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:4px">
          <div style="width:25%;text-align:left">
            <div style="font-size:13px;font-weight:700;font-family:sans-serif;color:#0f172a">Registration No:</div>
            <div style="font-size:14px;font-weight:900;font-family:monospace;color:#881337">${admNo}</div>
          </div>
          <div style="width:50%;text-align:center;display:flex;align-items:center;justify-content:center">
            <img src="/niti-aayog-grey.png" alt="NITI Aayog" style="height:70px;max-width:250px;object-fit:contain" />
          </div>
          <div style="width:25%;text-align:right">
            <div style="font-size:13px;font-weight:700;font-family:sans-serif;color:#0f172a">Exam No:</div>
            <div style="font-size:14px;font-weight:900;font-family:monospace;color:#881337">${htNo}</div>
          </div>
        </div>

        <div style="text-align:center;width:100%;padding-top:1px;padding-bottom:2px;box-sizing:border-box;padding-left:16px;padding-right:16px">
          <div style="font-size:30px;font-weight:900;color:#881337;text-transform:uppercase;letter-spacing:2.5px;line-height:1.1;padding-bottom:2px">
            S.L.E.
          </div>
          <h1 style="font-size:30px;font-weight:900;color:#881337;text-transform:uppercase;letter-spacing:0.4px;margin:0;padding:1px 0 2px 0;line-height:1.1;white-space:nowrap">
            COMPUTER SAKSHARATA ABHIYAN
          </h1>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:2px">
          <div style="width:110px;height:105px;margin-left:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center">
            <img src="/logo-2.png" alt="SLES Logo" style="width:100%;height:100%;object-fit:contain" />
          </div>
          <div style="flex:1;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center">
            <div style="font-size:15px;font-weight:800;color:#991b1b;padding:1px 0 2px 0;line-height:1.2">
              Professional & Industrial Training Institute
            </div>
            <div style="display:flex;align-items:center;justify-content:center;gap:5px;padding:2px 0;line-height:1.2;white-space:nowrap">
              <span style="font-size:12.5px;font-weight:800;color:#0f172a;white-space:nowrap">Soft Line Educational Society®</span>
              <span style="font-size:9.5px;font-weight:700;color:#334155;white-space:nowrap">(Regd By Karnataka Societies Act 17 of 1960)</span>
            </div>
            <div style="font-size:12px;font-weight:700;color:#166534;padding:2px 0;line-height:1.2">
              National Institute of Transforming India and LLP
            </div>
            <div style="font-size:12.5px;font-weight:900;color:#1d4ed8;padding:2px 0 1px 0;text-transform:uppercase;letter-spacing:0.6px;line-height:1.2">
              ISO-21001:2025 Certified Institute
            </div>
            <div style="font-size:12.5px;font-weight:800;color:#15803d;padding:2px 0;line-height:1.2">
              Recognized by Govt of India
            </div>
          </div>
          <div style="width:92px;height:112px;background:#ffffff;border:3px solid #b91c1c;border-radius:3px;padding:2px;flex-shrink:0;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.15)">
            ${photoImg}
          </div>
        </div>

        <div style="text-align:center;padding:6px 0 2px 0">
          <h2 style="font-size:76px;font-weight:900;font-style:italic;color:#1e3a8a;font-family:Georgia,serif;margin:0;letter-spacing:1.5px;line-height:1">
            Certificate
          </h2>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px;margin:8px 0;padding:4px 0">
        <div style="display:flex;align-items:baseline;gap:8px;width:100%">
          <span style="font-size:15px;font-style:italic;color:#1e293b;white-space:nowrap">This is to certify that Mr. / Mrs.</span>
          <span style="flex:1;border-bottom:2px solid #0f172a;font-weight:900;color:#0f172a;text-transform:uppercase;text-align:center;font-size:${candidateNameFs};letter-spacing:${candidateLetterSpacing};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${candidateName}
          </span>
        </div>

        <div style="display:flex;align-items:baseline;gap:8px;width:100%">
          <span style="font-size:15px;font-style:italic;color:#1e293b;white-space:nowrap">Son / Daughter / Wife of</span>
          <span style="flex:1;border-bottom:2px solid #0f172a;font-weight:900;color:#0f172a;text-transform:uppercase;text-align:center;font-size:${fatherNameFs};letter-spacing:${fatherLetterSpacing};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${fatherName}
          </span>
        </div>

        <div style="display:flex;align-items:baseline;gap:8px;width:100%">
          <span style="font-size:15px;font-style:italic;color:#1e293b;white-space:nowrap">has successfully Completed the Training in</span>
          <span style="flex:1;border-bottom:2px solid #0f172a;font-weight:900;color:#0f172a;text-transform:uppercase;text-align:center;font-size:${shortCourseCodeFs};letter-spacing:0.8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${shortCourseCode}
          </span>
        </div>

        <div style="display:flex;align-items:baseline;gap:8px;width:100%">
          <span style="font-size:15px;font-style:italic;color:#1e293b;white-space:nowrap">Program has from</span>
          <span style="width:160px;border-bottom:2px solid #0f172a;font-weight:900;color:#0f172a;text-align:center;font-size:15px;font-family:monospace">
            ${startDate}
          </span>
          <span style="font-size:15px;font-style:italic;color:#1e293b;white-space:nowrap">To</span>
          <span style="width:160px;border-bottom:2px solid #0f172a;font-weight:900;color:#0f172a;text-align:center;font-size:15px;font-family:monospace">
            ${endDate}
          </span>
        </div>

        <div style="width:100%;text-align:left">
          <span style="font-size:15px;font-style:italic;color:#1e293b">
            Conducted by, Soft Line Educational Society a division of SLES Group, and has obtained
          </span>
        </div>

        <div style="display:flex;align-items:baseline;gap:8px;width:100%">
          <span style="font-size:15px;font-style:italic;color:#1e293b;white-space:nowrap">the</span>
          <span style="width:180px;border-bottom:2px solid #0f172a;font-weight:900;color:#0f172a;text-transform:uppercase;text-align:center;font-size:17px">
            ${division || 'FIRST'}
          </span>
          <span style="font-size:15px;font-style:italic;color:#1e293b;white-space:nowrap">grade</span>
          <span style="font-size:15px;font-style:italic;color:#1e293b;white-space:nowrap;margin-left:12px">Branch</span>
          <span style="flex:1;border-bottom:2px solid #0f172a;font-weight:900;color:#0f172a;text-transform:uppercase;text-align:center;font-size:17px">
            ${trainingCenter}
          </span>
        </div>

        <div style="display:flex;align-items:baseline;gap:8px;width:100%">
          <span style="font-size:15px;font-style:italic;color:#1e293b;white-space:nowrap">The award of the</span>
          <span style="flex:1;border-bottom:2px solid #0f172a;font-weight:900;color:#0f172a;text-transform:uppercase;text-align:center;font-size:${courseTitleFs};letter-spacing:${courseTitleLs};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${courseTitle}
          </span>
        </div>

        <div style="display:flex;align-items:baseline;gap:8px;width:100%">
          <span style="font-size:16px;font-style:italic;color:#1e293b;white-space:nowrap">Certificate is given on date</span>
          <span style="width:220px;border-bottom:2px solid #0f172a;font-weight:900;color:#0f172a;text-align:center;font-size:16px;font-family:monospace">
            ${issueDate}
          </span>
        </div>

        <div style="display:flex;align-items:baseline;gap:8px;width:100%">
          <span style="font-size:16px;font-weight:900;color:#0f172a;white-space:nowrap">Branch Address:</span>
          <span style="flex:1;border-bottom:2px solid #0f172a;font-weight:900;color:#0f172a;text-transform:uppercase;text-align:left;padding-left:8px;font-size:${branchAddressFs};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${branchAddress}
          </span>
        </div>
      </div>

      <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding-top:10px;margin-bottom:8px">
        <div style="width:220px;text-align:center">
          <div style="height:85px"></div>
          <div style="border-bottom:2px solid rgba(15,23,42,0.7);margin-bottom:6px"></div>
          <div style="font-size:16px;font-weight:900;color:#1e1b4b;font-family:Georgia,serif">Branch Head</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding-bottom:2px">
          <div style="padding:2px;background:#ffffff;border:1.5px solid #881337;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,0.1)">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('https://sleinstitutions.com/student/' + admNo)}" alt="Scan QR Code" style="width:64px;height:64px;display:block" />
          </div>
        </div>
        <div style="width:250px;text-align:center">
          <div style="height:85px;display:flex;align-items:flex-end;justify-content:center">
            <img src="/sign.png" alt="Authorized Sign & Stamp" style="height:135px;max-width:250px;object-fit:contain;margin-bottom:-10px" />
          </div>
          <div style="border-bottom:2px solid rgba(15,23,42,0.7);margin-bottom:6px"></div>
          <div style="font-size:16px;font-weight:900;color:#1e1b4b;font-family:Georgia,serif">Managing Director</div>
          <div style="font-size:12px;font-weight:800;color:#334155;margin-top:2px">S.L.E.S. Institution</div>
        </div>
      </div>

    </div>
  </div>
</div>`;
}

// ── Generate full A4-marksheet HTML string (for bulk print window) ─
function buildMarksheetHTML(d, idx, total) {
  let subj = d.subjects && d.subjects.length ? d.subjects : null;
  if (!subj) {
    const dynamicList = getStoredSubjectsForCourse(d.courseCode || d.course);
    subj = dynamicList.map((s, i) => ({
      name: s.name,
      intMax: Number(s.intMax) || 0,
      intObt: Number(s.intObt) || (Number(s.intMax) ? Math.round(Number(s.intMax) * 0.85) : 0),
      extMax: Number(s.extMax) || 70,
      extObt: Number(s.extObt) || Math.round((Number(s.extMax) || 70) * 0.9)
    }));
  }
  const totIntMax = subj.reduce((s, r) => s + Number(r.intMax || 0), 0);
  const totIntObt = subj.reduce((s, r) => s + Number(r.intObt || 0), 0);
  const totExtMax = subj.reduce((s, r) => s + Number(r.extMax || 0), 0);
  const totExtObt = subj.reduce((s, r) => s + Number(r.extObt || 0), 0);
  const grand = totIntObt + totExtObt;
  const maxAll = totIntMax + totExtMax;
  const pct = maxAll > 0 ? ((grand / maxAll) * 100).toFixed(0) : 0;

  const rows = subj.map((r, i) => {
    const tot = Number(r.intObt || 0) + Number(r.extObt || 0);
    return `<tr style="background:${i % 2 === 0 ? '#fff' : 'rgba(255,237,213,0.25)'};height:34px">
      <td style="border:1px solid #fb923c;padding:7px 8px;font-weight:600;color:#1e293b;font-size:12px">${i + 1}) ${r.name}</td>
      <td style="border:1px solid #fb923c;padding:7px 6px;text-align:center;color:#374151;font-size:12px">${r.intMax}</td>
      <td style="border:1px solid #fb923c;padding:7px 6px;text-align:center;font-weight:600;color:#1e293b;font-size:12px">${r.intObt}</td>
      <td style="border:1px solid #fb923c;padding:7px 6px;text-align:center;color:#374151;font-size:12px">${r.extMax}</td>
      <td style="border:1px solid #fb923c;padding:7px 6px;text-align:center;font-weight:600;color:#1e293b;font-size:12px">${r.extObt}</td>
      <td style="border:1px solid #fb923c;padding:7px 6px;text-align:center;font-weight:700;color:#881337;font-size:12.5px">${tot || ''}</td>
    </tr>`;
  }).join('');

  const pageBreak = idx < total - 1 ? 'page-break-after:always;' : '';

  let watermarkRows = '';
  for (let r = 0; r < 42; r++) {
    watermarkRows += `<div style="display:flex;justify-content:space-between;white-space:nowrap;gap:8px">`;
    for (let c = 0; c < 5; c++) {
      watermarkRows += `<span>Soft Line Educational Society</span>`;
    }
    watermarkRows += `</div>`;
  }

  return `<div class="marksheet-print-sheet" style="width:210mm;height:297mm;max-height:297mm;background:#ffffff;padding:3mm;box-sizing:border-box;display:flex;align-items:center;justify-content:center;overflow:hidden;${pageBreak}">
    <div style="width:100%;height:100%;background:#fffdf5;border:8px solid #ea580c;
      display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden;
      font-family:Georgia,serif;box-sizing:border-box;padding:8px">
      
      <div style="position:absolute;inset:0;pointer-events:none;opacity:0.13;user-select:none;
        overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;
        padding:6px;font-size:10.5px;font-family:sans-serif;font-weight:600;line-height:1.2;color:#451a03">
        ${watermarkRows}
      </div>

      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;user-select:none;opacity:0.06">
        <img src="/logo-2.png" alt="" style="width:280px;height:280px;object-fit:contain" />
      </div>

      <div style="border:2px solid rgba(234,88,12,0.8);margin:2px;position:relative;z-index:1;display:flex;flex-direction:column;flex:1;overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 16px 6px">
        <div style="width:25%;text-align:left">
          <div style="font-size:12px;font-weight:700;color:#374151;font-family:sans-serif">Registration No:</div>
          <div style="font-size:15px;font-weight:900;color:#881337;font-family:monospace;margin-top:2px">${d.admNo || d.admissionNo || ''}</div>
        </div>
        <div style="flex:1;text-align:center;display:flex;align-items:center;justify-content:center">
          <img src="/niti-aayog-grey.png" alt="NITI Aayog" style="height:62px;max-width:240px;object-fit:contain" />
        </div>
        <div style="width:25%;text-align:right">
          <div style="font-size:12px;font-weight:700;color:#374151;font-family:sans-serif">Exam No:</div>
          <div style="font-size:15px;font-weight:900;color:#881337;font-family:monospace;margin-top:2px">${d.htNo || ''}</div>
        </div>
      </div>

      <div style="text-align:center;width:100%;padding-top:1px;padding-bottom:2px;box-sizing:border-box;padding-left:16px;padding-right:16px">
        <div style="font-size:30px;font-weight:900;color:#881337;text-transform:uppercase;letter-spacing:2.5px;line-height:1.1;padding-bottom:2px">
          S.L.E.
        </div>
        <h1 style="font-size:30px;font-weight:900;color:#ea580c;letter-spacing:0.4px;text-transform:uppercase;font-family:Georgia,serif;line-height:1.1;margin:0;padding:1px 0 2px 0;white-space:nowrap">
          COMPUTER SAKSHARATA ABHIYAN
        </h1>
      </div>

      <div style="display:flex;align-items:center;gap:8px;padding:4px 10px 6px;border-bottom:2px solid rgba(234,88,12,0.55)">
        <img src="/logo-2.png" alt="SLES Logo" style="width:100px;height:100px;object-fit:contain;flex-shrink:0" />
        <div style="flex:1;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center">
          <div style="font-size:15px;font-weight:800;color:#991b1b;padding:1px 0 2px 0;line-height:1.2">
            Professional & Industrial Training Institute
          </div>
          <div style="display:flex;align-items:center;justify-content:center;gap:5px;padding:2px 0;line-height:1.2;white-space:nowrap">
            <span style="font-size:12.5px;font-weight:800;color:#0f172a;white-space:nowrap">Soft Line Educational Society®</span>
            <span style="font-size:9.5px;font-weight:700;color:#334155;white-space:nowrap">(Regd By Karnataka Societies Act 17 of 1960)</span>
          </div>
          <div style="font-size:12px;font-weight:700;color:#166534;padding:2px 0;line-height:1.2">
            National Institute of Transforming India and LLP
          </div>
          <div style="font-size:12.5px;font-weight:900;color:#1d4ed8;padding:2px 0 1px 0;text-transform:uppercase;letter-spacing:0.6px;line-height:1.2">
            ISO-21001:2025 Certified Institute
          </div>
          <div style="font-size:12.5px;font-weight:800;color:#15803d;padding:2px 0;line-height:1.2">
            Recognized by Govt of India
          </div>
        </div>
        <div style="width:100px;height:100px;flex-shrink:0"></div>
      </div>
      <div style="text-align:center;padding:8px 0;border-bottom:2px solid rgba(234,88,12,0.5);background:#fff8ee">
        <h2 style="font-size:18px;font-weight:900;color:#1a1a6e;text-transform:uppercase;letter-spacing:0.08em;font-family:sans-serif;margin:0">Marksheet Cum Provisional Pass Certificate</h2>
      </div>
      <div style="padding:12px 24px 10px;border-bottom:1px solid rgba(234,88,12,0.25)">
        ${[['This is to certify that Mr. / Mrs.', d.candidateName || ''],
    ['Son / Daughter / Wife of', d.fatherName || ''],
    ['has successfully Completed the Training in', getCourseFullName(d.courseCode || '')]
    ].map(([l, v]) => `<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px;font-size:15px">
            <span style="font-style:italic;font-family:Georgia,serif;white-space:nowrap;color:#1e293b;font-size:15px">${l}</span>
            <span style="border-bottom:1.5px solid #64748b;flex:1;text-align:center;font-weight:800;color:#881337;text-transform:uppercase;font-size:15px;letter-spacing:0.5px">${v}</span>
          </div>`).join('')}
        <div style="display:flex;align-items:baseline;gap:8px;font-size:15px">
          <span style="font-style:italic;font-family:Georgia,serif;color:#1e293b;white-space:nowrap;font-size:15px">Program has from</span>
          <span style="border-bottom:1.5px solid #64748b;padding:0 16px;font-weight:700;color:#1e293b;font-family:monospace;font-size:15px">${d.startDate || ''}</span>
          <span style="font-style:italic;font-family:Georgia,serif;color:#1e293b;font-size:15px">To</span>
          <span style="border-bottom:1.5px solid #64748b;padding:0 16px;font-weight:700;color:#1e293b;font-family:monospace;font-size:15px">${d.endDate || ''}</span>
        </div>
        <div style="text-align:center;font-weight:700;font-size:12.5px;color:#1e293b;margin-top:10px;font-family:sans-serif;padding-top:8px">
          The subject in which the candidate was examined and marks obtained are as under
        </div>
      </div>
      <div style="padding:0 14px">
        <table style="width:100%;border-collapse:collapse;font-size:12px;font-family:sans-serif">
          <thead>
            <tr style="background:#fef9c3">
              <th rowspan="2" style="border:1px solid #f97316;padding:9px 8px;text-align:left;font-weight:700;color:#1e293b;width:33%;font-size:13px">Subject</th>
              <th colspan="2" style="border:1px solid #f97316;padding:7px 6px;text-align:center;font-weight:700;color:#1e293b;font-size:13px">Internal</th>
              <th colspan="2" style="border:1px solid #f97316;padding:7px 6px;text-align:center;font-weight:700;color:#1e293b;font-size:13px">External</th>
              <th rowspan="2" style="border:1px solid #f97316;padding:9px 6px;text-align:center;font-weight:700;color:#1e293b;font-size:13px">Total Marks</th>
            </tr>
            <tr style="background:#fefce8">
              <th style="border:1px solid #fb923c;padding:6px 4px;text-align:center;font-weight:600;color:#374151;font-size:10.5px">Max</th>
              <th style="border:1px solid #fb923c;padding:6px 4px;text-align:center;font-weight:600;color:#374151;font-size:10.5px">Obtained</th>
              <th style="border:1px solid #fb923c;padding:6px 4px;text-align:center;font-weight:600;color:#374151;font-size:10.5px">Max</th>
              <th style="border:1px solid #fb923c;padding:6px 4px;text-align:center;font-weight:600;color:#374151;font-size:10.5px">Obtained</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr style="background:#fef9c3;height:34px">
              <td style="border:1px solid #f97316;padding:8px 8px;font-weight:700;font-size:12.5px">Total</td>
              <td style="border:1px solid #f97316;padding:8px 6px;text-align:center;font-weight:700;font-size:12.5px">${totIntMax}</td>
              <td style="border:1px solid #f97316;padding:8px 6px;text-align:center;font-weight:700;font-size:12.5px">${totIntObt}</td>
              <td style="border:1px solid #f97316;padding:8px 6px;text-align:center;font-weight:700;font-size:12.5px">${totExtMax}</td>
              <td style="border:1px solid #f97316;padding:8px 6px;text-align:center;font-weight:700;font-size:12.5px">${totExtObt}</td>
              <td style="border:1px solid #f97316;padding:8px 6px;text-align:center;font-weight:700;color:#881337;font-size:13px">${grand}</td>
            </tr>
            <tr style="background:#fff;height:34px">
              <td style="border:1px solid #f97316;padding:8px 8px;font-weight:700;color:#1e293b;font-size:12px">Grand Total In Words</td>
              <td colspan="3" style="border:1px solid #f97316;padding:8px 8px;font-weight:700;color:#1e293b;font-size:12px">${numToWords(grand)}</td>
              <td colspan="2" style="border:1px solid #f97316;padding:8px 8px;text-align:right;font-weight:700;color:#881337;font-size:12.5px">Percentage: ${pct}%</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style="flex:1"></div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;padding:12px 40px 16px">
        <div style="text-align:center;width:150px">
          <div style="height:80px"></div>
          <div style="width:130px;border-bottom:2px solid #475569;margin:0 auto 5px"></div>
          <div style="font-size:14px;font-weight:900;font-style:italic;color:#1a1a6e;font-family:Georgia,serif">Branch Head</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding-bottom:2px">
          <div style="padding:2px;background:#ffffff;border:1.5px solid #881337;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,0.1)">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('https://sleinstitutions.com/student/' + (d.admNo || d.admissionNo || ''))}" alt="Scan QR Code" style="width:58px;height:58px;display:block" />
          </div>
        </div>
        <div style="text-align:center;width:180px">
          <div style="height:80px;display:flex;align-items:flex-end;justify-content:center">
            <img src="/sign.png" alt="Authorized Sign & Stamp" style="height:95px;max-width:200px;object-fit:contain;margin-bottom:-8px" />
          </div>
          <div style="width:140px;border-bottom:2px solid #475569;margin:0 auto 5px"></div>
          <div style="font-size:14px;font-weight:900;font-style:italic;color:#1a1a6e;font-family:Georgia,serif">Managing Director</div>
        </div>
      </div>
    </div>
  </div>
</div>`;
}

// ── Generate single hall ticket card HTML ─
function renderSingleHallTicketBox(d, height = '136mm') {
  const photoImg = d.photoUrl
    ? `<img src="${d.photoUrl}" alt="${d.candidateName || ''}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'" />`
    : `<div style="font-size:10px;color:#94a3b8;text-align:center;font-family:sans-serif;padding:4px;font-weight:700">PHOTO</div>`;

  const examDate = d.examDate || d.date || '2026 Feb, 8';
  const examTime = d.examTime || d.time || '10:00 AM to 1:00 PM';

  return `<div style="width:100%;height:${height};max-height:${height};border:3.5px solid #b91c1c;display:flex;flex-direction:column;position:relative;overflow:hidden;font-family:sans-serif;box-sizing:border-box;background:#ffffff">
    <div style="border:3px solid #b91c1c;margin:5px;padding:8px 12px 10px;position:relative;z-index:1;display:flex;flex-direction:column;flex:1;border-radius:4px;box-sizing:border-box">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:4px 10px 8px;border-bottom:1.5px dashed #fca5a5">
        <img src="/logo-2.png" alt="SLES Logo" style="width:108px;height:108px;object-fit:contain;flex-shrink:0" />
        <div style="flex:1;text-align:center;min-width:0">
          <div style="font-size:28px;font-weight:900;color:#7f1d1d;letter-spacing:0.04em;text-transform:uppercase;font-family:Georgia,serif;line-height:1.15">
            S.L.E.
          </div>
          <div style="font-size:21px;font-weight:900;color:#7f1d1d;letter-spacing:0.04em;font-family:Georgia,serif;line-height:1.2;margin-top:3px">
            Computer Saksharata Abhiyan
          </div>
          <div style="font-size:13.5px;font-weight:700;color:#1f2937;font-family:sans-serif;margin-top:4px">Regd. Under the govt. of India</div>
          <div style="font-size:13px;font-weight:700;color:#1f2937;font-family:sans-serif;margin-top:2px">A Non-Profit Social Service Oriented Society Regd.</div>
          <div style="display:inline-block;margin-top:8px;background-color:#b91c1c;color:#ffffff;font-size:14.5px;font-weight:900;letter-spacing:0.24em;padding:5px 32px;border-radius:4px;text-transform:uppercase">
            HALL TICKET
          </div>
        </div>
        <div style="width:88px;height:108px;border:2px solid #b91c1c;border-radius:3px;overflow:hidden;flex-shrink:0;background:#f8fafc;display:flex;align-items:center;justify-content:center">
          ${photoImg}
        </div>
      </div>

      <!-- Info Grid -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;padding:8px 16px 6px;border-bottom:1.5px dashed #fca5a5;font-size:11.5px">
        <div style="display:flex;flex-direction:column;gap:5px">
          <div><span style="color:#374151;font-weight:700;min-width:105px;display:inline-block">Stud. Name:</span> <strong style="color:#7f1d1d;text-transform:uppercase;font-size:11.5px">${d.candidateName || '—'}</strong></div>
          <div><span style="color:#374151;font-weight:700;min-width:105px;display:inline-block">Exam. No:</span> <strong style="color:#0f172a;font-size:11.5px">${d.htNo || '—'}</strong></div>
          <div><span style="color:#374151;font-weight:700;min-width:105px;display:inline-block">Father Name:</span> <span style="color:#0f172a;text-transform:uppercase;font-weight:700;font-size:11.5px">${d.fatherName || '—'}</span></div>
          <div><span style="color:#374151;font-weight:700;min-width:105px;display:inline-block">Branch:</span> <span style="color:#0f172a;font-weight:700;font-size:11.5px">${d.trainingCenter || '—'}</span></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;padding-left:18px">
          <div><span style="color:#374151;font-weight:700;min-width:105px;display:inline-block">Registration No:</span> <strong style="color:#0f172a;font-size:11.5px">${d.admNo || d.admissionNo || '—'}</strong></div>
          <div><span style="color:#374151;font-weight:700;min-width:105px;display:inline-block">Course:</span> <strong style="color:#7f1d1d;text-transform:uppercase;font-size:11.5px">${getCourseShortName(d.courseCode || d.course || '—')}</strong></div>
          ${d.examPin ? `<div><span style="color:#374151;font-weight:700;min-width:105px;display:inline-block">Exam PIN:</span> <span style="background:#7f1d1d;color:#fff;font-weight:900;font-family:monospace;font-size:12px;letter-spacing:0.22em;padding:2px 8px;border-radius:4px">${d.examPin}</span></div>` : ''}
        </div>
      </div>

      <!-- Exam Schedule Table -->
      <div style="padding:6px 12px 4px">
        <table style="width:100%;border-collapse:collapse;font-size:11.5px">
          <thead>
            <tr style="color:#991b1b">
              <th style="font-weight:800;text-align:left;padding:4px 6px;border-bottom:1.5px solid #fca5a5">Exam / Course</th>
              <th style="font-weight:800;text-align:left;padding:4px 6px;border-bottom:1.5px solid #fca5a5">Center</th>
              <th style="font-weight:800;text-align:left;padding:4px 6px;border-bottom:1.5px solid #fca5a5">Date</th>
              <th style="font-weight:800;text-align:left;padding:4px 6px;border-bottom:1.5px solid #fca5a5">Time</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1.5px dashed #fca5a5">
              <td style="padding:6px 6px;font-weight:700;color:#0f172a;font-size:12px">${getCourseShortName(d.courseCode || d.course || '—')}</td>
              <td style="padding:6px 6px;color:#374151;font-size:11.5px;font-weight:600">${d.trainingCenter || '—'}</td>
              <td style="padding:6px 6px;color:#374151;font-size:11.5px;font-weight:600">${examDate}</td>
              <td style="padding:6px 6px;color:#374151;font-size:11.5px;font-weight:600">${examTime}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="flex:1"></div>

      <!-- Signatures -->
      <div style="display:flex;justify-content:space-between;align-items:flex-end;padding:6px 36px 8px">
        <div style="text-align:center;width:125px">
          <div style="height:48px"></div>
          <div style="width:90px;border-bottom:1.5px solid #334155;margin:0 auto 3px"></div>
          <div style="font-size:11.5px;font-weight:900;font-style:italic;color:#1a1a6e;font-family:Georgia,serif">Student Sign</div>
        </div>
        <div style="text-align:center;width:125px">
          <div style="height:48px"></div>
          <div style="width:90px;border-bottom:1.5px solid #334155;margin:0 auto 3px"></div>
          <div style="font-size:11.5px;font-weight:900;font-style:italic;color:#1a1a6e;font-family:Georgia,serif">Center Head Sign</div>
        </div>
        <div style="text-align:center;width:125px">
          <div style="height:48px;display:flex;align-items:flex-end;justify-content:center">
            <img src="/sign.png" alt="Authorized Sign & Stamp" style="height:58px;max-width:130px;object-fit:contain;margin-bottom:-6px" />
          </div>
          <div style="width:90px;border-bottom:1.5px solid #334155;margin:0 auto 3px"></div>
          <div style="font-size:11.5px;font-weight:900;font-style:italic;color:#1a1a6e;font-family:Georgia,serif">Examiner Sign</div>
        </div>
      </div>
    </div>
  </div>`;
}

// ── Generate full A4 Sheet HTML containing ONE Hall Ticket (for single print) ─
function buildSingleHallTicketPageHTML(d) {
  return `<div class="a4-hallticket-sheet" style="width:210mm;height:297mm;max-height:297mm;padding:15mm 10mm;box-sizing:border-box;display:flex;flex-direction:column;background:#ffffff;overflow:hidden">
    ${renderSingleHallTicketBox(d, '139mm')}
  </div>`;
}

// ── Generate full A4 Sheet HTML containing TWO Hall Tickets on ONE Page ─
function buildHallTicketTwoPerPageHTML(s1, s2, isLast) {
  const pageBreak = !isLast ? 'page-break-after:always;' : 'page-break-after:auto;';
  const second = s2 || s1;
  return `<div class="a4-hallticket-sheet" style="width:210mm;height:297mm;max-height:297mm;padding:4mm 8mm;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;background:#ffffff;overflow:hidden;${pageBreak}">
    ${renderSingleHallTicketBox(s1, '136mm')}
    <div style="height:4mm;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:10px;font-family:monospace;letter-spacing:2px;overflow:hidden">
      ✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - ✂
    </div>
    ${renderSingleHallTicketBox(second, '136mm')}
  </div>`;
}

// ── Download Center Page ───────────────────────

export default function DownloadCenterPage() {
  const location = useLocation();
  const path = location.pathname.toLowerCase();

  let downloadType = 'hall-ticket';
  if (path.includes('certificate')) downloadType = 'certificate';
  else if (path.includes('marksheet')) downloadType = 'marksheet';

  const downloadConfigs = {
    'hall-ticket': {
      title: 'DOWNLOAD HALL TICKET',
      subtitle: 'Official Examination Admit Card & Hall Ticket Download Portal',
      btnLabel: 'Download Hall Ticket',
      placeholder: 'Enter Admission No',
    },
    certificate: {
      title: 'DOWNLOAD CERTIFICATE',
      subtitle: 'Official Course Completion & Merit Certificate Download Portal',
      btnLabel: 'Download Certificate',
      placeholder: 'Enter Admission No',
    },
    marksheet: {
      title: 'DOWNLOAD MARKSHEET',
      subtitle: 'Official Statement of Marks & Grade Report Download Portal',
      btnLabel: 'Download Marksheet',
      placeholder: 'Enter Admission No',
    }
  };

  const currentConfig = downloadConfigs[downloadType] || downloadConfigs['hall-ticket'];

  // Individual lookup state
  const [admissionNo, setAdmissionNo] = useState('');
  const [error, setError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [downloadReady, setDownloadReady] = useState(null);

  // Certificate Config & Payment Gate State
  const [certConfig, setCertConfig] = useState(() => getCertificateConfig());
  const [isPaidForCert, setIsPaidForCert] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('upi'); // 'upi' | 'card'
  const [paymentTransactionId, setPaymentTransactionId] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    const handleCfgUpdate = () => setCertConfig(getCertificateConfig());
    window.addEventListener('sle_certificate_config_updated', handleCfgUpdate);
    return () => window.removeEventListener('sle_certificate_config_updated', handleCfgUpdate);
  }, []);

  useEffect(() => {
    if (downloadReady) {
      const adm = String(downloadReady.admNo || downloadReady.admissionNo || downloadReady.id || '').trim();
      const localPaid = localStorage.getItem(`sle_paid_cert_${adm}`) === 'true';
      if (localPaid || downloadReady.isPaid || downloadReady.isCertPaid) {
        setIsPaidForCert(true);
      } else {
        setIsPaidForCert(false);
      }
    }
  }, [downloadReady]);

  // Hall Ticket PIN, Date, Time & exam assignment state (Managed by Admin)
  const [hallTicketPin, setHallTicketPin] = useState('');
  const [assignedExamId, setAssignedExamId] = useState('');
  const [hallTicketExamDate, setHallTicketExamDate] = useState('2026 Feb, 8');
  const [hallTicketExamTime, setHallTicketExamTime] = useState('10:00 AM to 1:00 PM');
  const [savedExams, setSavedExams] = useState([]);
  const [isSavingCredentials, setIsSavingCredentials] = useState(false);
  const [credentialsSaved, setCredentialsSaved] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Course-Wise Students List state (for Hall Ticket & Marksheet)
  const [coursesList, setCoursesList] = useState(DEFAULT_COURSES);
  const [bulkCourse, setBulkCourse] = useState('ALL');
  const [bulkStudents, setBulkStudents] = useState([]);
  const [studentSearchFilter, setStudentSearchFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBulkSearching, setIsBulkSearching] = useState(false);
  const [bulkSearched, setBulkSearched] = useState(false);
  const [bulkExamId, setBulkExamId] = useState('');
  const [bulkExamDate, setBulkExamDate] = useState('2026 Feb, 8');
  const [bulkExamTime, setBulkExamTime] = useState('10:00 AM to 1:00 PM');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedYear, setSelectedYear] = useState('ALL');

  // Helper to verify if a student has actually taken/submitted the exam or has a saved marksheet
  const hasStudentGivenExam = useCallback((s) => {
    if (!s) return false;

    const adm = String(s.admNo || s.admissionNo || s.registrationNo || s.appNumber || s.id || s.uid || '').trim();
    const roll = String(s.htNo || s.rollNo || '').trim();
    const name = String(s.candidateName || s.name || s.studentName || s.fullName || '').trim();
    const lowerAdm = adm.toLowerCase();
    const lowerRoll = roll.toLowerCase();

    // 1. Direct boolean flags on student record
    if (s.examAttempted || s.hasTakenExam || s.examSubmitted || s.hasExamResult || s.examCompleted) {
      return true;
    }

    // 2. Check registered/saved marksheets cache (entered by admin or saved)
    try {
      const storedMs = JSON.parse(localStorage.getItem('sle_registered_marksheets') || '{}');
      if (
        (adm && (storedMs[adm] || storedMs[lowerAdm])) ||
        (roll && (storedMs[roll] || storedMs[lowerRoll]))
      ) {
        return true;
      }
    } catch (_) { }

    // 3. Check exam results cache (online exam submissions)
    try {
      const cachedResults = JSON.parse(localStorage.getItem('sle_exam_results_cache') || '[]');
      const match = findStudentExamResult(cachedResults, adm, roll, name);
      if (match) return true;
    } catch (_) { }

    return false;
  }, []);

  // 1. Subscribe to dynamic courses
  useEffect(() => {
    const unsub = subscribeToCourses((loadedCourses) => {
      if (Array.isArray(loadedCourses) && loadedCourses.length > 0) {
        setCoursesList(loadedCourses.map(c => (typeof c === 'string' ? c : c.name)).filter(Boolean));
      }
    });
    return () => unsub && unsub();
  }, []);

  // 2. Real-time subscription to created exams (Firestore + LocalStorage)
  useEffect(() => {
    const unsub = subscribeToExams((examsMap) => {
      const list = Object.values(examsMap || {});
      setSavedExams(list);
    });

    // Also fetch all exams directly from Firestore if available
    const fetchDirectExams = async () => {
      if (db) {
        try {
          const snap = await getDocs(collection(db, 'exams'));
          if (!snap.empty) {
            const list = [];
            snap.forEach(docSnap => {
              const data = docSnap.data();
              if (data && data.id) list.push(data);
            });
            if (list.length > 0) {
              setSavedExams(list);
            }
          }
        } catch (e) { }
      }
    };
    fetchDirectExams();

    return () => unsub && unsub();
  }, []);

  // Sync marksheets & exam_results from Firestore into local cache
  useEffect(() => {
    if (!db) return;
    const syncDatabase = async () => {
      try {
        // 1. Sync marksheets
        const msSnap = await getDocs(collection(db, 'marksheets'));
        if (!msSnap.empty) {
          const storedMs = JSON.parse(localStorage.getItem('sle_registered_marksheets') || '{}');
          msSnap.forEach(docSnap => {
            const data = docSnap.data();
            if (data) {
              const id = docSnap.id;
              storedMs[id] = { ...storedMs[id], ...data };
              if (data.admNo) storedMs[data.admNo] = { ...storedMs[data.admNo], ...data };
              if (data.htNo) storedMs[data.htNo] = { ...storedMs[data.htNo], ...data };
            }
          });
          localStorage.setItem('sle_registered_marksheets', JSON.stringify(storedMs));
        }

        // 2. Sync exam_results
        const exSnap = await getDocs(collection(db, 'exam_results'));
        if (!exSnap.empty) {
          const list = [];
          exSnap.forEach(docSnap => {
            const data = docSnap.data();
            if (data) list.push({ id: docSnap.id, ...data });
          });
          if (list.length > 0) {
            const cached = JSON.parse(localStorage.getItem('sle_exam_results_cache') || '[]');
            const merged = [...list, ...cached];
            const unique = Array.from(new Map(merged.map(item => [item.id || item.submittedAt, item])).values());
            localStorage.setItem('sle_exam_results_cache', JSON.stringify(unique.slice(0, 500)));
          }
        }
      } catch (err) {
        console.warn('Sync database notice:', err);
      }
    };
    syncDatabase();
  }, []);

  // 3. Auto-match exam when a student or course is loaded
  useEffect(() => {
    if (downloadReady && savedExams.length > 0) {
      const studentCourse = (downloadReady.courseCode || downloadReady.course || '').trim().toLowerCase();
      // Try exact course match, then partial match
      const matchingExam = savedExams.find(ex => (ex.course || ex.courseName || '').trim().toLowerCase() === studentCourse) ||
        savedExams.find(ex => (ex.course || ex.courseName || '').trim().toLowerCase().includes(studentCourse)) ||
        savedExams[0];
      if (matchingExam && !assignedExamId) {
        setAssignedExamId(matchingExam.id);
        if (matchingExam.examDate) setHallTicketExamDate(matchingExam.examDate);
        if (matchingExam.examTime) setHallTicketExamTime(matchingExam.examTime);
      }
    }
  }, [downloadReady, savedExams, assignedExamId]);

  // When bulk course changes, auto-select matching exam for that course
  useEffect(() => {
    if (bulkCourse && savedExams.length > 0) {
      const cLower = bulkCourse.trim().toLowerCase();
      const match = savedExams.find(ex => (ex.course || ex.courseName || '').trim().toLowerCase() === cLower) ||
        savedExams.find(ex => (ex.course || ex.courseName || '').trim().toLowerCase().includes(cLower)) ||
        savedExams[0];
      if (match) {
        setBulkExamId(match.id);
        if (match.examDate) setBulkExamDate(match.examDate);
        if (match.examTime) setBulkExamTime(match.examTime);
      }
    }
  }, [bulkCourse, savedExams]);

  // Selected Exam Object for Direct URL Display
  const currentAssignedExam = useMemo(() => {
    return savedExams.find(e => e.id === assignedExamId) || null;
  }, [savedExams, assignedExamId]);

  // When currentAssignedExam changes, update date & time
  useEffect(() => {
    if (currentAssignedExam) {
      if (currentAssignedExam.examDate) setHallTicketExamDate(currentAssignedExam.examDate);
      if (currentAssignedExam.examTime) setHallTicketExamTime(currentAssignedExam.examTime);
    }
  }, [currentAssignedExam]);

  const examDirectUrl = currentAssignedExam
    ? `${window.location.origin}/exam/${currentAssignedExam.id}`
    : '';

  // ── INDIVIDUAL STUDENT LOOKUP ─────────────────────
  const handleLookup = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setCredentialsSaved(false);
    if (!admissionNo.trim()) { setError('Please enter a valid Admission No.'); return; }
    setIsSearching(true);

    const searchKey = admissionNo.trim();
    const lowerKey = searchKey.toLowerCase();

    // Helper: find student record across bulk list and all caches
    const findInCache = () => {
      const inBulk = bulkStudents.find(r =>
        [r.registrationNo, r.appNumber, r.admissionNo, r.admNo, r.id, r.rollNo, r.htNo]
          .some(f => f && String(f).toLowerCase() === lowerKey)
      );
      if (inBulk) return inBulk;

      for (const cacheKey of ['sle_students_cache', 'sle_coaching_students_cache', 'sle_applications_cache']) {
        const raw = localStorage.getItem(cacheKey);
        if (!raw) continue;
        try {
          const recs = JSON.parse(raw);
          const m = recs.find(r =>
            [r.registrationNo, r.appNumber, r.admissionNo, r.admNo, r.id, r.rollNo, r.htNo]
              .some(f => f && String(f).toLowerCase() === lowerKey)
          );
          if (m) return m;
        } catch (_) { }
      }
      return null;
    };

    setTimeout(async () => {
      setIsSearching(false);

      if (downloadType === 'hall-ticket') {
        // Check saved hall ticket credentials in Firestore / localStorage first
        const savedCreds = await getHallTicketCredentials(searchKey);
        const existingPin = savedCreds?.examPin || '';
        const existingExam = savedCreds?.examId || '';
        const existingDate = savedCreds?.examDate || '';
        const existingTime = savedCreds?.examTime || '';

        let found = findInCache();
        if (!found && db) {
          try {
            for (const colName of ['students', 'applications', 'coaching_students']) {
              const snap = await getDocs(collection(db, colName));
              snap.forEach(d => {
                if (found) return;
                const data = { id: d.id, ...d.data() };
                const matches = [data.registrationNo, data.appNumber, data.admissionNo, data.admNo, data.id, data.rollNo, data.htNo]
                  .some(f => f && String(f).toLowerCase() === lowerKey);
                if (matches) found = data;
              });
              if (found) break;
            }
          } catch (_) { }
        }

        if (!found && !existingPin) {
          setDownloadReady(null);
          setError(`No registered student found for Admission No: "${searchKey}". Please verify the Admission No.`);
          return;
        }

        const stdCourse = found?.course || found?.courseName || found?.courseTitle || found?.courseCode || 'DCA';
        const rollNo = found?.rollNo || found?.htNo || found?.examRollNo || generateRollNo('2026', stdCourse, searchKey);

        // Auto-match exam
        const matchingExam = savedExams.find(ex => (ex.course || ex.courseName || '').toLowerCase() === stdCourse.toLowerCase()) ||
          savedExams[0];
        const targetExamId = existingExam || matchingExam?.id || getExamDocId('2026', stdCourse);
        const targetDate = existingDate || matchingExam?.examDate || found?.examDate || '2026 Feb, 8';
        const targetTime = existingTime || matchingExam?.examTime || found?.examTime || '10:00 AM to 1:00 PM';

        const newPin = existingPin || generatePin();
        setHallTicketPin(newPin);
        setAssignedExamId(targetExamId);
        setHallTicketExamDate(targetDate);
        setHallTicketExamTime(targetTime);
        if (existingPin) {
          setCredentialsSaved(true);
        } else {
          // Automatically save credentials to Firestore so single hall ticket print is immediately live
          saveHallTicketCredentials({
            rollNo,
            examPin: newPin,
            examId: targetExamId,
            studentName: found?.name || found?.fullName || found?.studentName || found?.candidateName || '',
            course: stdCourse,
            year: '2026',
            admissionNo: found?.registrationNo || found?.admissionNo || found?.admNo || found?.appNumber || found?.id || searchKey,
            centerName: found?.trustBranch || found?.trainingCenter || found?.franchiseName || found?.branchName || '',
            examDate: targetDate,
            examTime: targetTime
          }).then(() => setCredentialsSaved(true)).catch(() => { });
        }

        const studentData = {
          admNo: found?.registrationNo || found?.admissionNo || found?.admNo || found?.appNumber || found?.id || searchKey,
          admissionNo: found?.registrationNo || found?.admissionNo || found?.admNo || found?.appNumber || found?.id || searchKey,
          htNo: rollNo,
          candidateName: found?.candidateName || found?.name || found?.fullName || found?.studentName || 'STUDENT NAME',
          fatherName: found?.fatherName || found?.parentName || found?.guardianName || '',
          course: stdCourse,
          courseCode: stdCourse,
          trainingCenter: found?.trustBranch || found?.trainingCenter || found?.franchiseName || found?.branchName || found?.place || 'SLES Head Office',
          examDate: targetDate,
          examTime: targetTime,
          photoUrl: found?.photoUrl || found?.photoPreview || found?.photo || found?.candidatePhoto || '',
          examPin: newPin,
          examId: targetExamId
        };

        setDownloadReady(studentData);
        setTimeout(() => {
          const previewEl = document.getElementById('hallticket-preview-wrapper') || document.getElementById('template-preview-section');
          if (previewEl) previewEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
        return;
      }

      if (downloadType === 'marksheet') {
        const storedMarksheets = JSON.parse(localStorage.getItem('sle_registered_marksheets') || '{}');
        let savedMs = storedMarksheets[searchKey] || storedMarksheets[lowerKey];
        let found = findInCache();

        if (!savedMs && db) {
          try {
            const msDoc = await getDoc(doc(db, 'marksheets', searchKey.toLowerCase()));
            if (msDoc.exists()) {
              savedMs = msDoc.data();
            }
          } catch (e) { }
        }

        if (!savedMs && !found && db) {
          try {
            for (const colName of ['students', 'applications', 'coaching_students']) {
              const snap = await getDocs(collection(db, colName));
              snap.forEach(d => {
                if (found) return;
                const data = { id: d.id, ...d.data() };
                const matches = [data.registrationNo, data.appNumber, data.admissionNo, data.admNo, data.id, data.rollNo, data.htNo]
                  .some(f => f && String(f).toLowerCase() === lowerKey);
                if (matches) found = data;
              });
              if (found) break;
            }
          } catch (_) { }
        }

        if (!savedMs && !found) {
          setDownloadReady(null);
          setError(`No registered student or marksheet record found for Admission No: "${searchKey}".`);
          return;
        }

        const stdCourse = savedMs?.course || savedMs?.courseCode || found?.course || found?.courseName || found?.courseTitle || found?.courseCode || 'DCA';
        const rollNo = savedMs?.htNo || found?.rollNo || found?.htNo || found?.examRollNo || generateRollNo('2026', stdCourse, searchKey);
        const candidateName = savedMs?.candidateName || found?.candidateName || found?.name || found?.fullName || found?.studentName || '';

        // Check if student completed an exam
        const cachedResults = JSON.parse(localStorage.getItem('sle_exam_results_cache') || '[]');
        let studentResult = findStudentExamResult(cachedResults, searchKey, rollNo, candidateName);

        if (!studentResult && db) {
          try {
            const exSnap = await getDocs(collection(db, 'exam_results'));
            if (!exSnap.empty) {
              const liveList = [];
              exSnap.forEach(d => { const dData = d.data(); if (dData) liveList.push({ id: d.id, ...dData }); });
              studentResult = findStudentExamResult(liveList, searchKey, rollNo, candidateName);
              if (liveList.length > 0) {
                localStorage.setItem('sle_exam_results_cache', JSON.stringify(liveList.slice(0, 500)));
              }
            }
          } catch (err) {
            console.warn('Direct Firestore exam lookup notice:', err);
          }
        }

        // Strict Requirement: If student has not given/submitted an exam and has no saved marksheet record, do not generate
        if (!savedMs && !studentResult) {
          setDownloadReady(null);
          setError(`Cannot Generate Marksheet: Student "${candidateName || searchKey}" has NOT given/submitted the examination yet.`);
          return;
        }

        const resolvedPhoto = found?.photoUrl || found?.photo || found?.photoPreview || found?.candidatePhoto || savedMs?.photoUrl || '';
        let marksheetData = savedMs ? {
          ...savedMs,
          candidateName: candidateName || savedMs.candidateName,
          fatherName: found?.fatherName || found?.parentName || savedMs.fatherName,
          courseCode: stdCourse,
          courseTitle: found?.courseTitle || found?.courseName || savedMs.courseTitle || stdCourse,
          course: stdCourse,
          trainingCenter: found?.trustBranch || found?.trainingCenter || found?.franchiseName || found?.branchName || savedMs.trainingCenter,
          photoUrl: resolvedPhoto
        } : {
          ...found,
          admNo: searchKey,
          admissionNo: searchKey,
          htNo: rollNo,
          candidateName: candidateName || 'STUDENT NAME',
          fatherName: found?.fatherName || found?.parentName || '—',
          courseCode: stdCourse,
          courseTitle: found?.courseTitle || found?.courseName || stdCourse,
          course: stdCourse,
          photoUrl: resolvedPhoto,
          startDate: found?.startDate || found?.admissionDate || '2025-01-01',
          endDate: (found?.endDate && found?.endDate > (found?.startDate || found?.admissionDate || '2025-01-01') && found?.endDate !== '2026-01-01')
            ? found.endDate
            : (found?.completionDate && found?.completionDate > (found?.startDate || found?.admissionDate || '2025-01-01'))
              ? found.completionDate
              : computeOneYearEndDate(found?.startDate || found?.admissionDate || '2025-01-01'),
          division: 'FIRST',
          issueDate: new Date().toISOString().split('T')[0],
          trainingCenter: found?.trustBranch || found?.trainingCenter || found?.franchiseName || found?.branchName || 'SLES Center',
          courseName: found?.courseTitle || found?.courseName || stdCourse,
          generatedAt: new Date().toLocaleDateString()
        };

        if (!marksheetData.subjects || !marksheetData.subjects.length) {
          const courseCurriculum = getStoredSubjectsForCourse(stdCourse);
          marksheetData.subjects = courseCurriculum.map(s => ({
            name: s.name,
            intMax: s.intMax !== undefined ? s.intMax : 40,
            intObt: 0,
            extMax: s.extMax !== undefined ? s.extMax : 60,
            extObt: 0
          }));
        }

        if (studentResult) {
          marksheetData.subjects = mergeExamMarksIntoSubjects(marksheetData.subjects, studentResult);
        }

        setDownloadReady(marksheetData);
        setTimeout(() => {
          const previewEl = document.getElementById('marksheet-preview-wrapper') || document.getElementById('template-preview-section');
          if (previewEl) previewEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
        return;
      }

      // ── CERTIFICATE DOWNLOAD VALIDATION ─────────────────────
      // 1. Fetch live student record from Firestore first (ensuring latest edits are picked up)
      let found = null;
      if (db) {
        try {
          for (const colName of ['students', 'applications', 'coaching_students']) {
            const snap = await getDocs(collection(db, colName));
            snap.forEach(d => {
              if (found) return;
              const data = { id: d.id, ...d.data() };
              const matches = [data.registrationNo, data.appNumber, data.admissionNo, data.admNo, data.id, data.rollNo, data.htNo]
                .some(f => f && String(f).toLowerCase() === lowerKey);
              if (matches) found = data;
            });
            if (found) break;
          }
        } catch (_) { }
      }
      if (!found) {
        found = findInCache();
      }

      // 2. Fetch saved certificate if one exists
      const storedCertificates = JSON.parse(localStorage.getItem('sle_registered_certificates') || '{}');
      let savedCert = storedCertificates[searchKey] || storedCertificates[lowerKey];

      if (!savedCert && db) {
        try {
          for (const cKey of [lowerKey, searchKey, searchKey.replace(/\//g, '_'), lowerKey.replace(/\//g, '_')]) {
            const certDoc = await getDoc(doc(db, 'certificates', cKey));
            if (certDoc.exists()) {
              savedCert = certDoc.data();
              break;
            }
          }
        } catch (_) { }
      }

      // If we found savedCert or student record, construct the live certificate data
      if (savedCert || found) {
        const stdCourse = found?.course || found?.courseName || found?.courseTitle || found?.courseCode || savedCert?.course || savedCert?.courseCode || 'DCA';
        const rollNo = found?.rollNo || found?.htNo || found?.examRollNo || savedCert?.htNo || generateRollNo('2026', stdCourse, searchKey);
        const certStartDate = found?.startDate || found?.admissionDate || savedCert?.startDate || '2025-01-01';
        const exactYear = (() => {
          try {
            const p = certStartDate.split('-');
            return `${parseInt(p[0], 10) + 1}-${p[1]}-${p[2]}`;
          } catch (_) { return ''; }
        })();

        const certEndDate = (found?.endDate && found?.endDate > certStartDate && found?.endDate !== '2026-01-01' && found?.endDate !== exactYear)
          ? found.endDate
          : (found?.completionDate && found?.completionDate > certStartDate && found?.completionDate !== exactYear)
            ? found.completionDate
            : (savedCert?.endDate && savedCert?.endDate > certStartDate && savedCert?.endDate !== '2026-01-01')
              ? savedCert.endDate
              : computeOneYearEndDate(certStartDate, 3);

        const candidateName = found?.candidateName || found?.name || found?.fullName || found?.studentName || savedCert?.candidateName || 'STUDENT NAME';
        const fatherName = found?.fatherName || found?.parentName || savedCert?.fatherName || '—';
        const trainingCenter = found?.trustBranch || found?.trainingCenter || found?.franchiseName || found?.branchName || savedCert?.trainingCenter || 'SLES Center';
        const syncAddr = resolveBranchAddressSync(found || savedCert) || (found ? resolveBranchAddressSync(found) : '') || (savedCert ? resolveBranchAddressSync(savedCert) : '');
        const branchAddress = isDetailedCenterAddress(syncAddr, found || savedCert)
          ? syncAddr
          : (isDetailedCenterAddress(savedCert?.branchAddress, savedCert) ? savedCert.branchAddress : (isDetailedCenterAddress(found?.branchAddress, found) ? found.branchAddress : (syncAddr || savedCert?.branchAddress || found?.branchAddress || trainingCenter)));
        const photoUrl = found?.photoUrl || found?.photoPreview || found?.photo || found?.candidatePhoto || savedCert?.photoUrl || '';

        const mergedCert = {
          ...(savedCert || {}),
          admNo: searchKey,
          admissionNo: searchKey,
          htNo: rollNo,
          candidateName,
          fatherName,
          courseCode: stdCourse,
          courseTitle: found?.courseTitle || found?.courseName || savedCert?.courseTitle || stdCourse,
          course: stdCourse,
          startDate: certStartDate,
          endDate: certEndDate,
          division: savedCert?.division || 'FIRST CLASS',
          issueDate: (savedCert?.issueDate && savedCert?.issueDate > certEndDate && !savedCert?.issueDate.startsWith('2026-09-24'))
            ? savedCert.issueDate
            : computeOneMonthAfterDate(certEndDate),
          trainingCenter,
          branchAddress,
          courseName: found?.courseTitle || found?.courseName || savedCert?.courseTitle || stdCourse,
          photoUrl,
          generatedAt: savedCert?.generatedAt || new Date().toLocaleDateString()
        };

        setDownloadReady(mergedCert);
        setTimeout(() => {
          const previewEl = document.getElementById('certificate-preview-wrapper') || document.getElementById('template-preview-section');
          if (previewEl) previewEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
        return;
      } else {
        setDownloadReady(null);
        setError(`No registered student record found for Admission No: "${searchKey}". Please verify student registration.`);
      }
    }, 300);
  };

  // Auto-load student list whenever bulkCourse changes or on page mount
  useEffect(() => {
    handleBulkSearch();
  }, [bulkCourse]);

  // ── COURSE-WISE STUDENT SEARCH ─────────────────────
  const handleBulkSearch = async () => {
    setIsBulkSearching(true);
    setBulkSearched(false);
    setIsBulkSearching(true);
    setSelectedIds(new Set());
    setCurrentPage(1);

    try {
      await transferShurapurToShahapur();
    } catch (_) { }

    const targetCourse = (bulkCourse || 'ALL').trim();

    const isCourseMatch = (r) => {
      if (!targetCourse || targetCourse.toLowerCase() === 'all' || targetCourse.toLowerCase().includes('all courses')) {
        return true;
      }
      const val = (r.course || r.courseName || r.courseTitle || r.courseCode || r.coachingPlan || r.program || r.selectedClass || r.selectedCourse || '').toLowerCase().trim();
      const targetLower = targetCourse.toLowerCase();
      if (!val) return false;
      if (val === targetLower) return true;
      if (val.includes(targetLower) || targetLower.includes(val)) return true;

      const cleanTarget = targetLower.replace(/[^a-z0-9]/g, '');
      const cleanVal = val.replace(/[^a-z0-9]/g, '');
      if (cleanVal.includes(cleanTarget) || cleanTarget.includes(cleanVal)) return true;

      // Special alias matching for GST & other popular course abbreviations
      if (targetLower === 'gst') {
        return val.includes('gst') || val.includes('goods') || val.includes('tax');
      }
      if (targetLower === 'pgdca') {
        return val.includes('pgdca') || val.includes('post graduate diploma');
      }
      if (targetLower === 'dca') {
        return val.includes('dca') || val.includes('diploma in computer');
      }

      return false;
    };

    const found = [];
    const seen = new Set();

    // 1. Read from local caches first (fastest)
    for (const cacheKey of ['sle_students_cache', 'sle_coaching_students_cache', 'sle_applications_cache']) {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) continue;
      try {
        const recs = JSON.parse(raw);
        recs.forEach(r => {
          if (!isCourseMatch(r)) return;
          const uid = r.registrationNo || r.admissionNo || r.admNo || r.appNumber || r.id;
          if (!uid || seen.has(uid)) return;
          seen.add(uid);

          const storedHt = JSON.parse(localStorage.getItem('sle_registered_halltickets') || '{}');
          const htData = storedHt[uid] || null;

          const bStartDate = r.startDate || r.admissionDate || '';
          const bEndDate = (r.endDate && r.endDate > bStartDate && r.endDate !== '2026-01-01') ? r.endDate : computeOneYearEndDate(bStartDate, 3);
          const bIssueDate = computeOneMonthAfterDate(bEndDate);

          found.push({
            ...r,
            uid,
            admNo: uid,
            admissionNo: uid,
            htNo: r.rollNo || r.htNo || generateRollNo('2026', bulkCourse, uid),
            candidateName: r.name || r.fullName || r.studentName || r.candidateName || 'Candidate',
            fatherName: r.fatherName || r.parentName || '—',
            course: r.course || r.courseName || r.courseTitle || r.courseCode || bulkCourse,
            courseCode: r.course || r.courseName || r.courseTitle || r.courseCode || bulkCourse,
            startDate: bStartDate,
            endDate: bEndDate,
            issueDate: bIssueDate,
            trainingCenter: r.trustBranch || r.trainingCenter || r.franchiseName || r.branchName || r.place || 'SLES Center',
            branchAddress: resolveBranchAddressSync(r) || r.branchAddress,
            examDate: htData?.examDate || r.examDate || bulkExamDate || '2026 Feb, 8',
            examTime: htData?.examTime || r.examTime || bulkExamTime || '10:00 AM to 1:00 PM',
            examPin: htData?.examPin || r.examPin || '',
            examId: htData?.examId || r.examId || '',
            hasHallTicket: !!(htData?.examPin || r.examPin),
            photoUrl: r.photoUrl || r.photoPreview || r.photo || r.candidatePhoto || '',
          });
        });
      } catch (_) { }
    }

    // 2. Fetch live from Firestore database collections to guarantee zero missing and up-to-date records
    if (db) {
      try {
        const liveFreshList = [];
        for (const colName of ['students', 'applications', 'coaching_students']) {
          const snap = await getDocs(collection(db, colName));
          snap.forEach(docSnap => {
            const r = { id: docSnap.id, ...docSnap.data() };
            if (!r) return;
            liveFreshList.push(r);
            if (!isCourseMatch(r)) return;
            const docKey = r.appNumber || r.id || r.registrationNo;
            const uid = r.registrationNo || r.admissionNo || r.admNo || docKey;
            if (!uid) return;

            const storedHt = JSON.parse(localStorage.getItem('sle_registered_halltickets') || '{}');
            const htData = storedHt[uid] || null;

            const bStartDate = r.startDate || r.admissionDate || '';
            const bEndDate = (r.endDate && r.endDate > bStartDate && r.endDate !== '2026-01-01') ? r.endDate : computeOneYearEndDate(bStartDate, 3);
            const bIssueDate = computeOneMonthAfterDate(bEndDate);

            const studentObj = {
              ...r,
              uid,
              admNo: uid,
              admissionNo: uid,
              htNo: r.rollNo || r.htNo || generateRollNo('2026', bulkCourse, uid),
              candidateName: r.fullName || r.name || r.studentName || r.candidateName || 'Candidate',
              fatherName: r.fatherName || r.parentName || '—',
              course: r.course || r.courseName || r.courseTitle || r.courseCode || bulkCourse,
              courseCode: r.course || r.courseName || r.courseTitle || r.courseCode || bulkCourse,
              courseTitle: r.courseTitle || r.courseName || r.course || bulkCourse,
              startDate: bStartDate,
              endDate: bEndDate,
              issueDate: bIssueDate,
              trainingCenter: r.trustBranch || r.trainingCenter || r.franchiseName || r.branchName || r.place || 'SLES Center',
              branchAddress: resolveBranchAddressSync(r) || r.branchAddress,
              examDate: htData?.examDate || r.examDate || bulkExamDate || '2026 Feb, 8',
              examTime: htData?.examTime || r.examTime || bulkExamTime || '10:00 AM to 1:00 PM',
              examPin: htData?.examPin || r.examPin || '',
              examId: htData?.examId || r.examId || '',
              hasHallTicket: !!(htData?.examPin || r.examPin),
              photoUrl: r.photoUrl || r.photoPreview || r.photo || r.candidatePhoto || '',
            };

            const existingIdx = found.findIndex(x =>
              (x.uid && (x.uid === uid || x.uid === docKey)) ||
              (docKey && (x.id === docKey || x.appNumber === docKey || x.registrationNo === docKey)) ||
              (r.registrationNo && (x.registrationNo === r.registrationNo || x.admNo === r.registrationNo)) ||
              (r.appNumber && (x.appNumber === r.appNumber || x.admNo === r.appNumber))
            );

            if (existingIdx !== -1) {
              found[existingIdx] = {
                ...found[existingIdx],
                ...studentObj
              };
            } else {
              seen.add(docKey);
              seen.add(uid);
              found.push(studentObj);
            }
          });
        }

        if (liveFreshList.length > 0) {
          try {
            for (const cacheKey of ['sle_students_cache', 'sle_coaching_students_cache', 'sle_applications_cache']) {
              const raw = localStorage.getItem(cacheKey);
              if (!raw) continue;
              const cached = JSON.parse(raw);
              if (Array.isArray(cached)) {
                const updated = cached.map(item => {
                  const match = liveFreshList.find(f => (f.id && f.id === item.id) || (f.appNumber && f.appNumber === item.appNumber) || (f.registrationNo && f.registrationNo === item.registrationNo));
                  return match ? { ...item, ...match } : item;
                });
                localStorage.setItem(cacheKey, JSON.stringify(updated));
              }
            }
          } catch (_) { }
        }
      } catch (err) {
        console.warn('Firestore live bulk search notice:', err);
      }
    }

    const franchiseeFiltered = filterStudentsForFranchisee(found);
    setBulkStudents(franchiseeFiltered);
    const initialSelectedUids = downloadType === 'marksheet'
      ? franchiseeFiltered.filter(s => hasStudentGivenExam(s)).map(s => s.uid)
      : franchiseeFiltered.map(s => s.uid);
    setSelectedIds(new Set(initialSelectedUids));
    setIsBulkSearching(false);
    setBulkSearched(true);
  };

  // Calculate available academic/admission years from bulk students list
  const availableYears = useMemo(() => {
    return getAvailableYears(bulkStudents);
  }, [bulkStudents]);

  // Filtered bulk students list by search term, year, and exam completion requirement
  const filteredBulkStudents = useMemo(() => {
    let list = bulkStudents;

    // Strict Requirement: On Marksheet tab, ONLY show students who have completed/given the exam
    if (downloadType === 'marksheet') {
      list = list.filter(s => hasStudentGivenExam(s));
    }

    if (selectedYear !== 'ALL') {
      list = list.filter(s => getStudentYear(s) === selectedYear);
    }

    if (!studentSearchFilter.trim()) return list;
    const q = studentSearchFilter.toLowerCase().trim();
    return list.filter(s =>
      (s.candidateName || '').toLowerCase().includes(q) ||
      (s.admNo || '').toLowerCase().includes(q) ||
      (s.htNo || '').toLowerCase().includes(q) ||
      (s.fatherName || '').toLowerCase().includes(q)
    );
  }, [bulkStudents, studentSearchFilter, downloadType, hasStudentGivenExam, selectedYear]);

  const totalPages = Math.max(1, Math.ceil(filteredBulkStudents.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredBulkStudents.length);
  const paginatedBulkStudents = useMemo(() => {
    return filteredBulkStudents.slice(startIndex, endIndex);
  }, [filteredBulkStudents, startIndex, endIndex]);

  const toggleStudent = (uid) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(
      selectedIds.size === filteredBulkStudents.length
        ? new Set()
        : new Set(filteredBulkStudents.map(s => s.uid))
    );
  };

  // Click on single student row from the course list to load their Hall Ticket
  const handleSelectStudentForHallTicket = (student) => {
    setAdmissionNo(student.admNo || student.admissionNo);
    const pin = student.examPin || generatePin();
    const matchingExam = savedExams.find(ex => (ex.course || ex.courseName || '').toLowerCase() === (student.courseCode || bulkCourse).toLowerCase()) ||
      savedExams[0];
    const targetExamId = student.examId || matchingExam?.id || bulkExamId || getExamDocId('2026', bulkCourse);
    const targetDate = student.examDate || matchingExam?.examDate || bulkExamDate || '2026 Feb, 8';
    const targetTime = student.examTime || matchingExam?.examTime || bulkExamTime || '10:00 AM to 1:00 PM';

    setHallTicketPin(pin);
    setAssignedExamId(targetExamId);
    setHallTicketExamDate(targetDate);
    setHallTicketExamTime(targetTime);
    setCredentialsSaved(!!student.examPin);

    const rollNo = student.htNo || generateRollNo('2026', student.courseCode || bulkCourse, student.admNo || student.admissionNo);

    if (!student.examPin) {
      saveHallTicketCredentials({
        rollNo,
        examPin: pin,
        examId: targetExamId,
        studentName: student.candidateName || student.name || student.studentName || '',
        course: student.courseCode || bulkCourse,
        year: '2026',
        admissionNo: student.admNo || student.admissionNo || '',
        centerName: student.trainingCenter || student.branchName || '',
        examDate: targetDate,
        examTime: targetTime,
      }).then(() => setCredentialsSaved(true)).catch(() => { });
    }

    setDownloadReady({
      ...student,
      htNo: rollNo,
      examPin: pin,
      examId: targetExamId,
      courseCode: student.courseCode || bulkCourse,
      examDate: targetDate,
      examTime: targetTime,
    });

    // Scroll to the preview area
    setTimeout(() => {
      const previewEl = document.getElementById('hallticket-preview-wrapper') || document.getElementById('hallticket-action-panel');
      if (previewEl) previewEl.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Click on single student row from the course list to load & preview their individual Marksheet
  const handleSelectStudentForMarksheet = async (student) => {
    const adm = student.admNo || student.admissionNo || student.registrationNo || student.id;
    setAdmissionNo(adm);
    setError('');

    const stdCourse = student.courseCode || student.course || student.courseName || bulkCourse || 'Tally';
    const rollNo = student.htNo || student.rollNo || generateRollNo('2026', stdCourse, adm);

    const candidateName = student.candidateName || student.name || student.studentName || student.fullName || '';

    // Check if marksheet has been submitted via Marksheet Form
    const storedMarksheets = JSON.parse(localStorage.getItem('sle_registered_marksheets') || '{}');
    let savedMs = storedMarksheets[adm] || storedMarksheets[rollNo] || storedMarksheets[student.admissionNo];

    if (!savedMs && db && (adm || rollNo)) {
      try {
        const msDoc = await getDoc(doc(db, 'marksheets', (adm || '').toLowerCase()));
        if (msDoc.exists()) {
          savedMs = msDoc.data();
        } else if (rollNo) {
          const msRollDoc = await getDoc(doc(db, 'marksheets', rollNo.toLowerCase()));
          if (msRollDoc.exists()) savedMs = msRollDoc.data();
        }
      } catch (err) {
        console.warn('Firestore marksheet lookup error:', err);
      }
    }

    // Check if exam results exist
    const cachedResults = JSON.parse(localStorage.getItem('sle_exam_results_cache') || '[]');
    let studentResult = findStudentExamResult(cachedResults, adm, rollNo, candidateName);

    if (!studentResult && db) {
      try {
        const exSnap = await getDocs(collection(db, 'exam_results'));
        if (!exSnap.empty) {
          const liveList = [];
          exSnap.forEach(d => { const dData = d.data(); if (dData) liveList.push({ id: d.id, ...dData }); });
          studentResult = findStudentExamResult(liveList, adm, rollNo, candidateName);
          if (liveList.length > 0) {
            localStorage.setItem('sle_exam_results_cache', JSON.stringify(liveList.slice(0, 500)));
          }
        }
      } catch (err) {
        console.warn('Direct Firestore exam lookup notice:', err);
      }
    }

    if (!savedMs && !studentResult) {
      setError(`Cannot Generate Marksheet: Student "${candidateName || adm}" has NOT given/submitted the examination yet.`);
      alert(`Cannot Generate Marksheet: Student "${candidateName || adm}" has NOT given/submitted the examination yet.`);
      return;
    }

    let marksheetData = {
      ...student,
      admNo: adm,
      admissionNo: adm,
      htNo: rollNo,
      candidateName: candidateName || 'STUDENT NAME',
      fatherName: student.fatherName || student.parentName || student.guardianName || '—',
      course: stdCourse,
      courseCode: stdCourse,
      courseTitle: student.courseTitle || student.courseName || stdCourse,
      trainingCenter: student.trainingCenter || student.branchName || student.trustBranch || 'SLES Center',
      startDate: student.startDate || student.admissionDate || '2025-01-01',
      endDate: student.endDate || student.completionDate || '2026-01-01',
      division: 'FIRST',
      issueDate: new Date().toISOString().split('T')[0],
      generatedAt: new Date().toLocaleDateString()
    };

    if (savedMs) {
      marksheetData = {
        ...marksheetData,
        ...savedMs,
        candidateName: candidateName || marksheetData.candidateName,
        fatherName: student.fatherName || student.parentName || student.guardianName || marksheetData.fatherName,
        course: stdCourse,
        courseCode: stdCourse,
        courseTitle: student.courseTitle || student.courseName || stdCourse,
        trainingCenter: student.trainingCenter || student.branchName || student.trustBranch || marksheetData.trainingCenter,
        photoUrl: student.photoUrl || student.photo || student.photoPreview || marksheetData.photoUrl || savedMs.photoUrl || ''
      };
    }

    if (!marksheetData.subjects || !marksheetData.subjects.length) {
      const courseCurriculum = getStoredSubjectsForCourse(stdCourse);
      marksheetData.subjects = courseCurriculum.map(s => ({
        name: s.name,
        intMax: s.intMax !== undefined ? s.intMax : 40,
        intObt: 0,
        extMax: s.extMax !== undefined ? s.extMax : 60,
        extObt: 0
      }));
    }

    if (studentResult) {
      marksheetData.subjects = mergeExamMarksIntoSubjects(marksheetData.subjects, studentResult);
    }

    setDownloadReady(marksheetData);

    // Smoothly scroll directly to the marksheet preview!
    setTimeout(() => {
      const el = document.getElementById('marksheet-preview-wrapper') || document.getElementById('template-preview-section');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // Click on single student row to load & preview their Certificate
  const handleSelectStudentForCertificate = (student) => {
    const adm = student.admNo || student.admissionNo || student.registrationNo || student.id;
    setAdmissionNo(adm);
    setError('');

    const stdCourse = student.courseCode || student.course || student.courseName || bulkCourse || 'Tally';
    const rollNo = student.htNo || student.rollNo || generateRollNo('2026', stdCourse, adm);

    const storedCertificates = JSON.parse(localStorage.getItem('sle_registered_certificates') || '{}');
    const savedCert = storedCertificates[adm] || storedCertificates[rollNo] || storedCertificates[student.admissionNo];

    const certStartDate = student.startDate || student.admissionDate || '2025-01-01';
    const exactYear = (() => {
      try {
        const p = certStartDate.split('-');
        return `${parseInt(p[0], 10) + 1}-${p[1]}-${p[2]}`;
      } catch (_) { return ''; }
    })();

    const certEndDate = (student.endDate && student.endDate > certStartDate && student.endDate !== '2026-01-01' && student.endDate !== exactYear)
      ? student.endDate
      : (student.completionDate && student.completionDate > certStartDate && student.completionDate !== exactYear)
        ? student.completionDate
        : computeOneYearEndDate(certStartDate, 3);

    let certData = {
      ...student,
      admNo: adm,
      admissionNo: adm,
      htNo: rollNo,
      candidateName: student.candidateName || student.name || student.studentName || student.fullName || 'STUDENT NAME',
      fatherName: student.fatherName || student.parentName || student.guardianName || '—',
      course: stdCourse,
      courseCode: stdCourse,
      courseTitle: student.courseTitle || student.courseName || stdCourse,
      trainingCenter: student.trainingCenter || student.branchName || student.trustBranch || 'SLES Center',
      branchAddress: resolveBranchAddressSync(student) || student.branchAddress,
      startDate: certStartDate,
      endDate: certEndDate,
      division: 'FIRST',
      issueDate: computeOneMonthAfterDate(certEndDate),
      generatedAt: new Date().toLocaleDateString()
    };

    if (savedCert) {
      const resolvedSync = resolveBranchAddressSync(student) || resolveBranchAddressSync(savedCert);
      certData = {
        ...certData,
        ...savedCert,
        // Crucial: preserve updated application form details from student record
        candidateName: student.candidateName || student.name || student.studentName || student.fullName || certData.candidateName,
        fatherName: student.fatherName || student.parentName || student.guardianName || certData.fatherName,
        course: stdCourse,
        courseCode: stdCourse,
        courseTitle: student.courseTitle || student.courseName || stdCourse,
        trainingCenter: student.trainingCenter || student.branchName || student.trustBranch || certData.trainingCenter,
        branchAddress: isDetailedCenterAddress(resolvedSync, student)
          ? resolvedSync
          : (isDetailedCenterAddress(savedCert.branchAddress, savedCert) ? savedCert.branchAddress : (resolvedSync || certData.branchAddress || student.branchAddress)),
        photoUrl: student.photoUrl || student.photoPreview || student.photo || student.candidatePhoto || certData.photoUrl || '',
        startDate: certStartDate,
        endDate: certEndDate
      };
      if (!certData.issueDate || certData.issueDate <= certEndDate || certData.issueDate.startsWith('2026-09-24')) {
        certData.issueDate = computeOneMonthAfterDate(certEndDate);
      }
    }

    setDownloadReady(certData);

    setTimeout(() => {
      const el = document.getElementById('certificate-preview-wrapper') || document.getElementById('template-preview-section');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // Bulk Print Hall Tickets: Generate PINs + Save Credentials + Print All
  const handleBulkPrintHallTickets = async () => {
    const toPrint = bulkStudents.filter(s => selectedIds.has(s.uid) || selectedIds.has(s.id) || selectedIds.has(s.admNo));
    if (!toPrint.length) return;

    // Open print window synchronously on click so browser popup blocker does not block it after async await
    const win = window.open('', '_blank', 'width=1000,height=750');
    if (win) {
      try {
        win.document.write(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:50px;text-align:center;color:#475569">
          <h3 style="color:#b91c1c;margin-bottom:8px">Preparing Bulk Hall Tickets...</h3>
          <p style="font-size:13px">Assigning examination credentials. Please wait.</p>
        </body></html>`);
      } catch (e) {
        // window closed or restricted
      }
    }

    const examToAssign = bulkExamId || assignedExamId || (savedExams[0]?.id || getExamDocId('2026', bulkCourse));

    // Generate PINs and save credentials for all selected students with admin-managed date & time
    const preparedList = await Promise.all(toPrint.map(async (student) => {
      const rollNo = student.htNo || generateRollNo('2026', student.courseCode || bulkCourse, student.admNo);
      const pin = student.examPin || generatePin();

      await saveHallTicketCredentials({
        rollNo,
        examPin: pin,
        examId: examToAssign,
        studentName: student.candidateName || '',
        course: student.courseCode || bulkCourse,
        year: '2026',
        admissionNo: student.admNo || '',
        centerName: student.trainingCenter || '',
        examDate: bulkExamDate || '2026 Feb, 8',
        examTime: bulkExamTime || '10:00 AM to 1:00 PM',
      });

      return {
        ...student,
        htNo: rollNo,
        examPin: pin,
        examId: examToAssign,
        examDate: bulkExamDate || '2026 Feb, 8',
        examTime: bulkExamTime || '10:00 AM to 1:00 PM'
      };
    }));

    const pairedPages = [];
    for (let i = 0; i < preparedList.length; i += 2) {
      const s1 = preparedList[i];
      const s2 = (i + 1 < preparedList.length) ? preparedList[i + 1] : s1;
      const isLast = (i + 2 >= preparedList.length);
      pairedPages.push(buildHallTicketTwoPerPageHTML(s1, s2, isLast));
    }
    const pages = pairedPages.join('');
    const targetWin = win || window.open('', '_blank', 'width=1000,height=750');
    if (!targetWin) { alert('Please allow pop-ups to enable bulk print.'); return; }
    targetWin.document.open();
    targetWin.document.write(`<!DOCTYPE html><html><head>
<title>Bulk Hall Tickets — ${bulkCourse} (${preparedList.length} students)</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{background:#fff;margin:0;padding:0}
  @page{size:A4 portrait;margin:0}
  @media print{
    @page{size:A4 portrait;margin:0}
    html,body{width:210mm;margin:0;padding:0;background:#fff}
    .a4-hallticket-sheet{
      width:210mm;
      height:297mm;
      max-height:297mm;
      page-break-inside:avoid !important;
      page-break-after:always !important;
    }
    .a4-hallticket-sheet:last-child{
      page-break-after:auto !important;
    }
  }
</style>
</head><body style="-webkit-print-color-adjust:exact;print-color-adjust:exact">
${pages}
<script>
  window.onload = function() {
    window.focus();
    setTimeout(function() { window.print(); }, 250);
  };
<\/script>
</body></html>`);
    targetWin.document.close();

    // Refresh bulk search to show updated PIN badges
    handleBulkSearch();
  };

  // Bulk Print Marksheets
  const handleBulkPrintMarksheets = () => {
    const toPrint = bulkStudents.filter(s => selectedIds.has(s.uid) && hasStudentGivenExam(s));
    if (!toPrint.length) {
      alert('No selected students have completed/submitted their examination yet.');
      return;
    }
    const pages = toPrint.map((d, i) => buildMarksheetHTML(d, i, toPrint.length)).join('');
    const win = window.open('', '_blank', 'width=1000,height=700');
    if (!win) { alert('Please allow pop-ups to enable bulk print.'); return; }
    win.document.write(`<!DOCTYPE html><html><head>
<title>Bulk Marksheet — ${bulkCourse} — ${toPrint.length} students</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{background:#fff;margin:0;padding:0}
  @page{size:A4 portrait;margin:0}
  @media print{@page{size:A4 portrait;margin:0}html,body{width:210mm;margin:0;padding:0}.marksheet-print-sheet{page-break-inside:avoid;page-break-after:always}}
</style>
</head><body style="-webkit-print-color-adjust:exact;print-color-adjust:exact">
${pages}
<script>window.onload=function(){window.print()}<\/script>
</body></html>`);
    win.document.close();
  };

  // Bulk Print Certificates
  const handleBulkPrintCertificates = () => {
    const toPrint = bulkStudents.filter(s => selectedIds.has(s.uid));
    if (!toPrint.length) return;

    const storedCertificates = JSON.parse(localStorage.getItem('sle_registered_certificates') || '{}');

    const preparedList = toPrint.map((student) => {
      const adm = student.admNo || student.admissionNo || student.registrationNo || student.id;
      const stdCourse = student.courseCode || student.course || student.courseName || bulkCourse || 'DCA';
      const rollNo = student.htNo || student.rollNo || generateRollNo('2026', stdCourse, adm);
      const savedCert = storedCertificates[adm] || storedCertificates[rollNo] || storedCertificates[student.admissionNo];

      return {
        ...student,
        ...(savedCert || {}),
        admNo: adm,
        admissionNo: adm,
        htNo: rollNo,
        candidateName: student.candidateName || student.name || student.studentName || student.fullName || 'STUDENT NAME',
        fatherName: student.fatherName || student.parentName || student.guardianName || '—',
        courseCode: stdCourse,
        courseTitle: student.courseTitle || student.courseName || stdCourse,
        course: stdCourse,
        trainingCenter: student.trainingCenter || student.branchName || student.trustBranch || 'SLES Center',
        branchAddress: resolveBranchAddressSync(student) || student.branchAddress,
        startDate: student.startDate || student.admissionDate || '2025-01-01',
        endDate: student.endDate || student.completionDate || '2026-01-01',
        division: savedCert?.division || 'FIRST CLASS',
        issueDate: savedCert?.issueDate || new Date().toISOString().split('T')[0],
        photoUrl: student.photoUrl || student.photoPreview || student.photo || student.candidatePhoto || savedCert?.photoUrl || '',
      };
    });

    const pages = preparedList.map((d, i) => buildCertificateHTML(d, i, preparedList.length)).join('');
    const win = window.open('', '_blank', 'width=1000,height=750');
    if (!win) { alert('Please allow pop-ups to enable bulk print.'); return; }
    win.document.write(`<!DOCTYPE html><html><head>
<title>Bulk Certificates — ${bulkCourse} (${preparedList.length} students)</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{background:#fff;margin:0;padding:0}
  @page{size:A4 portrait;margin:0}
  @media print{@page{size:A4 portrait;margin:0}html,body{width:210mm;margin:0;padding:0}.cert-print-sheet{page-break-inside:avoid;page-break-after:always}}
</style>
</head><body style="-webkit-print-color-adjust:exact;print-color-adjust:exact">
${pages}
<script>window.onload=function(){window.print()}<\/script>
</body></html>`);
    win.document.close();
  };

  // Dedicated single-document print handler (opens clean A4 print window)
  const handlePrintActiveDocument = () => {
    if (downloadType === 'certificate' && downloadReady) {
      const html = buildCertificateHTML(downloadReady, 0, 1);
      const win = window.open('', '_blank', 'width=1000,height=750');
      if (win) {
        win.document.write(`<!DOCTYPE html><html><head>
<title>Certificate — ${downloadReady.candidateName || downloadReady.admNo || ''}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{background:#fff;width:210mm;height:297mm;margin:0;padding:0}
  @page{size:A4 portrait;margin:0}
  @media print{@page{size:A4 portrait;margin:0}html,body{width:210mm;height:297mm;margin:0;padding:0;overflow:hidden}}
</style>
</head><body style="-webkit-print-color-adjust:exact;print-color-adjust:exact">
${html}
<script>
  window.onload = function() {
    window.focus();
    setTimeout(function() { window.print(); }, 250);
  };
<\/script>
</body></html>`);
        win.document.close();
        return;
      }
    } else if (downloadType === 'marksheet' && downloadReady) {
      const html = buildMarksheetHTML(downloadReady, 0, 1);
      const win = window.open('', '_blank', 'width=1000,height=750');
      if (win) {
        win.document.write(`<!DOCTYPE html><html><head>
<title>Marksheet — ${downloadReady.candidateName || downloadReady.admNo || ''}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{background:#fff;width:210mm;height:297mm;margin:0;padding:0}
  @page{size:A4 portrait;margin:0}
  @media print{@page{size:A4 portrait;margin:0}html,body{width:210mm;height:297mm;margin:0;padding:0;overflow:hidden}}
</style>
</head><body style="-webkit-print-color-adjust:exact;print-color-adjust:exact">
${html}
<script>
  window.onload = function() {
    window.focus();
    setTimeout(function() { window.print(); }, 250);
  };
<\/script>
</body></html>`);
        win.document.close();
        return;
      }
    } else if (downloadType === 'hall-ticket' && downloadReady) {
      const html = buildSingleHallTicketPageHTML(downloadReady);
      const win = window.open('', '_blank', 'width=1000,height=750');
      if (win) {
        win.document.write(`<!DOCTYPE html><html><head>
<title>Hall Ticket — ${downloadReady.candidateName || downloadReady.admNo || ''}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{background:#fff;width:210mm;height:297mm;margin:0;padding:0}
  @page{size:A4 portrait;margin:0}
  @media print{@page{size:A4 portrait;margin:0}html,body{width:210mm;height:297mm;margin:0;padding:0;overflow:hidden}.a4-hallticket-sheet{page-break-inside:avoid}}
</style>
</head><body style="-webkit-print-color-adjust:exact;print-color-adjust:exact">
${html}
<script>
  window.onload = function() {
    window.focus();
    setTimeout(function() { window.print(); }, 250);
  };
<\/script>
</body></html>`);
        win.document.close();
        return;
      }
    }
    window.print();
  };

  return (
    <div className="py-5 sm:py-8 px-3 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-200 w-full max-w-[100vw] overflow-x-hidden">

      {/* Banner */}
      <div className="gradient-banner rounded-3xl py-6 px-4 sm:py-8 sm:px-8 shadow-xl border border-rose-800/40 text-center text-white relative overflow-hidden w-full max-w-[calc(100vw-1.5rem)] sm:max-w-full mx-auto min-w-0">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider text-rose-100 border border-white/20 max-w-full truncate">
            <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span className="truncate">S.L.E. Institutions Examination System</span>
          </div>
          <h2 className="text-xl sm:text-3xl md:text-4xl font-black tracking-wide sm:tracking-widest uppercase font-serif drop-shadow-md break-words">
            {currentConfig.title}
          </h2>
          <p className="text-rose-100 font-medium text-xs sm:text-sm max-w-xl mx-auto">
            {currentConfig.subtitle}
          </p>
        </div>
      </div>

      {/* ── COURSE-WISE STUDENTS LIST & SELECTION (Hall Ticket, Marksheet & Certificate) ── */}
      {(downloadType === 'hall-ticket' || downloadType === 'marksheet' || downloadType === 'certificate') && (
        <div className="w-full max-w-5xl mx-auto space-y-6 min-w-0 max-w-[calc(100vw-1.5rem)] sm:max-w-5xl animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-xl border border-rose-200 overflow-hidden w-full min-w-0 max-w-full">

            {/* Course Selector Banner */}
            <div className="gradient-banner border-b border-rose-800/30 px-4 py-5 sm:px-6 sm:py-6 text-white space-y-4 w-full min-w-0">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base sm:text-lg font-black tracking-wide flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-300" />
                    <span>Select Course to Load Students</span>
                  </h3>
                  <p className="text-xs text-rose-100/90 mt-0.5">
                    {downloadType === 'marksheet'
                      ? 'Choose a course to list all enrolled students and generate individual or bulk marksheets.'
                      : downloadType === 'certificate'
                        ? 'Choose a course to list all enrolled students and generate individual certificates.'
                        : 'Choose a course to list all enrolled students, assign their online exam link, and generate hall tickets.'
                    }
                  </p>
                </div>

                {/* Course Dropdown */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
                  <select
                    value={bulkCourse}
                    onChange={e => {
                      setBulkCourse(e.target.value);
                      setBulkSearched(false);
                      setBulkStudents([]);
                      setSelectedIds(new Set());
                    }}
                    className="w-full sm:w-72 md:w-80 max-w-full min-w-0 px-3.5 sm:px-4 py-2.5 rounded-2xl border-2 border-rose-300 bg-white text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-400/20 shadow-md transition truncate"
                  >
                    <option value="ALL">📋 ALL COURSES (All Registered Students)</option>
                    {coursesList.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleBulkSearch}
                    disabled={!bulkCourse || isBulkSearching}
                    className="w-full sm:w-auto px-4 sm:px-6 py-2.5 bg-white hover:bg-rose-50 disabled:opacity-50 text-rose-700 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition shadow-md shrink-0 border border-rose-200 cursor-pointer active:scale-95 whitespace-nowrap"
                    title="Load Students"
                  >
                    {isBulkSearching ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-rose-600 shrink-0" />
                        <span>Finding...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Load Students</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Results Body */}
            {bulkSearched && (
              <div className="p-3 sm:p-6 space-y-5 w-full max-w-full overflow-hidden">
                {bulkStudents.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <Users className="w-12 h-12 text-slate-300 mx-auto" />
                    <p className="text-slate-700 font-bold text-base">
                      No students found for course <span className="text-rose-600">"{bulkCourse}"</span>
                    </p>
                    <p className="text-slate-400 text-xs max-w-md mx-auto">
                      Make sure students have registered under this course through the admission form or franchisee portal.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Controls & Exam Assignment Bar */}
                    <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 sm:p-4 space-y-3 w-full max-w-full overflow-hidden">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 w-full">
                        {/* Student Search filter input & Year filter */}
                        <div className="flex flex-wrap items-center gap-2.5 flex-1 w-full sm:max-w-md">
                          <div className="relative flex-1 min-w-[180px]">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={studentSearchFilter}
                              onChange={e => setStudentSearchFilter(e.target.value)}
                              placeholder="Filter by Student Name or Adm No..."
                              className="w-full pl-10 pr-4 py-2 rounded-xl text-xs border border-slate-300 bg-white focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                            />
                          </div>

                          {/* Year Filter Dropdown */}
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 shadow-xs shrink-0">
                            <Calendar className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>Year:</span>
                            <select
                              value={selectedYear}
                              onChange={e => {
                                setSelectedYear(e.target.value);
                                setCurrentPage(1);
                              }}
                              className="bg-transparent text-slate-900 font-bold text-xs focus:outline-none cursor-pointer"
                            >
                              <option value="ALL">All Years</option>
                              {availableYears.map(yr => (
                                <option key={yr} value={yr}>{yr}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Exam Selection, Date & Time for this Course */}
                        {downloadType === 'hall-ticket' && (
                          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                            <div className="flex items-center gap-1.5 w-full sm:w-auto">
                              <label className="text-xs font-bold text-slate-700 shrink-0">Exam:</label>
                              <select
                                value={bulkExamId}
                                onChange={e => {
                                  setBulkExamId(e.target.value);
                                  const foundEx = savedExams.find(x => x.id === e.target.value);
                                  if (foundEx?.examDate) setBulkExamDate(foundEx.examDate);
                                  if (foundEx?.examTime) setBulkExamTime(foundEx.examTime);
                                }}
                                className="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-cyan-300 bg-cyan-50/50 text-cyan-950 focus:outline-none focus:border-cyan-500 w-full sm:max-w-[220px] truncate"
                              >
                                <option value="">— Select Exam —</option>
                                {savedExams.map(ex => (
                                  <option key={ex.id} value={ex.id}>
                                    {ex.examTitle || `${ex.year} - ${ex.course} Exam`} ({ex.totalQuestions || 100} Qs) {ex.status === 'active' ? '🟢 LIVE' : '🔴 Inactive'}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Bulk Date Picker with Options */}
                            <div className="flex items-center justify-between gap-1.5 bg-white px-2 py-1 rounded-xl border border-cyan-300 shadow-xs w-full sm:w-auto">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-cyan-700 shrink-0" />
                                <input
                                  type="text"
                                  value={bulkExamDate}
                                  onChange={e => setBulkExamDate(e.target.value)}
                                  placeholder="2026 Feb, 8"
                                  className="w-24 text-xs font-bold text-slate-800 focus:outline-none"
                                  title="Exam Scheduled Date"
                                />
                              </div>
                              <input
                                type="date"
                                onChange={e => {
                                  if (e.target.value) setBulkExamDate(formatDateForInput(e.target.value));
                                }}
                                className="w-5 h-5 opacity-70 hover:opacity-100 cursor-pointer border-0 bg-transparent p-0 shrink-0"
                                title="Pick Date from Calendar"
                              />
                            </div>

                            {/* Bulk Time with Presets */}
                            <div className="flex items-center justify-between gap-1.5 bg-white px-2 py-1 rounded-xl border border-cyan-300 shadow-xs w-full sm:w-auto">
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-cyan-700 shrink-0" />
                                <input
                                  type="text"
                                  value={bulkExamTime}
                                  onChange={e => setBulkExamTime(e.target.value)}
                                  placeholder="10:00 AM to 1:00 PM"
                                  className="w-32 text-xs font-bold text-slate-800 focus:outline-none"
                                  title="Exam Scheduled Time"
                                />
                              </div>
                              <select
                                value={EXAM_TIME_PRESETS.includes(bulkExamTime) ? bulkExamTime : ''}
                                onChange={e => {
                                  if (e.target.value) setBulkExamTime(e.target.value);
                                }}
                                className="text-[10px] font-bold text-cyan-900 bg-cyan-50 rounded border border-cyan-200 focus:outline-none cursor-pointer max-w-[85px] truncate shrink-0"
                              >
                                <option value="">⚡ Slots</option>
                                {EXAM_TIME_PRESETS.map((t, idx) => (
                                  <option key={idx} value={t}>{t}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Selection Toolbar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/60 w-full">
                        <div className="flex items-center gap-3 flex-wrap">
                          <button
                            type="button"
                            onClick={toggleAll}
                            className="flex items-center gap-1.5 text-xs font-bold text-rose-700 hover:text-rose-900 transition cursor-pointer"
                          >
                            {selectedIds.size === filteredBulkStudents.length && filteredBulkStudents.length > 0
                              ? <CheckSquare className="w-4 h-4 text-rose-600" />
                              : <Square className="w-4 h-4 text-slate-400" />
                            }
                            <span>{selectedIds.size === filteredBulkStudents.length ? 'Deselect All' : 'Select All'}</span>
                          </button>
                          <span className="text-xs text-slate-600 bg-white border border-slate-200 px-3 py-1 rounded-full font-bold shadow-xs">
                            {selectedIds.size} of {filteredBulkStudents.length} selected
                          </span>
                          {downloadType === 'hall-ticket' && (
                            <span className="text-[11px] text-rose-700 font-bold bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                              ✓ {filteredBulkStudents.filter(s => s.hasHallTicket).length} with active PIN
                            </span>
                          )}
                        </div>

                        {/* Bulk Print Action */}
                        <div className="w-full sm:w-auto">
                          {downloadType === 'hall-ticket' ? (
                            <button
                              type="button"
                              onClick={handleBulkPrintHallTickets}
                              disabled={selectedIds.size === 0}
                              className="gradient-button flex items-center justify-center gap-2 px-5 py-2.5 disabled:opacity-40 text-white rounded-xl text-xs font-extrabold shadow-md transition cursor-pointer w-full sm:w-auto whitespace-nowrap"
                            >
                              <Printer className="w-4 h-4" />
                              <span>Bulk Print ({selectedIds.size}) Hall Tickets</span>
                            </button>
                          ) : downloadType === 'certificate' ? (
                            <button
                              type="button"
                              onClick={handleBulkPrintCertificates}
                              disabled={selectedIds.size === 0}
                              className="gradient-button flex items-center justify-center gap-2 px-5 py-2.5 disabled:opacity-40 text-white rounded-xl text-xs font-extrabold shadow-md transition cursor-pointer w-full sm:w-auto whitespace-nowrap"
                            >
                              <Printer className="w-4 h-4" />
                              <span>Bulk Print ({selectedIds.size}) Certificates</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleBulkPrintMarksheets}
                              disabled={selectedIds.size === 0}
                              className="gradient-button flex items-center justify-center gap-2 px-5 py-2.5 disabled:opacity-40 text-white rounded-xl text-xs font-extrabold shadow-md transition cursor-pointer w-full sm:w-auto whitespace-nowrap"
                            >
                              <Printer className="w-4 h-4" />
                              <span>Bulk Print ({selectedIds.size}) Marksheets</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Student List Table */}
                    <div className="rounded-2xl border border-rose-100 overflow-hidden shadow-sm w-full max-w-full">
                      <div className="overflow-x-auto w-full max-w-full">
                        <table className="w-full text-xs font-sans min-w-[600px]">
                          <thead className="bg-rose-50 text-rose-950">
                            <tr>
                              <th className="px-3 py-3 text-center w-10 whitespace-nowrap">
                                <button type="button" onClick={toggleAll} className="cursor-pointer">
                                  {selectedIds.size === filteredBulkStudents.length && filteredBulkStudents.length > 0
                                    ? <CheckSquare className="w-4 h-4 text-rose-600" />
                                    : <Square className="w-4 h-4 text-slate-400" />
                                  }
                                </button>
                              </th>
                              <th className="px-3 py-3 text-left font-extrabold whitespace-nowrap">#</th>
                              <th className="px-3 py-3 text-left font-extrabold whitespace-nowrap">Adm. / Roll No</th>
                              <th className="px-3 py-3 text-left font-extrabold whitespace-nowrap">Student Name</th>
                              <th className="px-3 py-3 text-left font-extrabold whitespace-nowrap">Father Name</th>
                              <th className="px-3 py-3 text-left font-extrabold whitespace-nowrap">Center / Branch</th>
                              <th className="px-3 py-3 text-center font-extrabold whitespace-nowrap">
                                {downloadType === 'marksheet' ? 'Marksheet Status' : downloadType === 'certificate' ? 'Certificate Status' : 'Exam & PIN Status'}
                              </th>
                              <th className="px-3 py-3 text-center font-extrabold whitespace-nowrap">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-rose-50">
                            {filteredBulkStudents.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="px-4 py-8 text-center text-slate-500 font-bold">
                                  {downloadType === 'marksheet'
                                    ? '⚠️ No students found who have completed/given the exam for this course. Marksheets are only generated for students who have given the exam.'
                                    : 'No registered students found for this course.'}
                                </td>
                              </tr>
                            ) : (
                              paginatedBulkStudents.map((s, i) => (
                                <tr
                                  key={s.uid}
                                  className={`transition-colors ${selectedIds.has(s.uid) ? 'bg-rose-50/70' : 'bg-white hover:bg-slate-50'
                                    }`}
                                >
                                  <td className="px-3 py-3 text-center whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => toggleStudent(s.uid)}
                                      className="cursor-pointer"
                                    >
                                      <div className={`w-4 h-4 rounded border-2 mx-auto flex items-center justify-center transition ${selectedIds.has(s.uid) ? 'bg-rose-700 border-rose-700' : 'border-slate-300'
                                        }`}>
                                        {selectedIds.has(s.uid) && (
                                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </div>
                                    </button>
                                  </td>
                                  <td className="px-3 py-3 text-slate-400 font-semibold whitespace-nowrap">{startIndex + i + 1}</td>
                                  <td className="px-3 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                                    <div>{s.admNo}</div>
                                    {s.htNo && s.htNo !== s.admNo && (
                                      <div className="text-[10px] text-rose-600 font-mono">{s.htNo}</div>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 font-extrabold text-slate-900 uppercase whitespace-nowrap">
                                    {s.candidateName}
                                  </td>
                                  <td className="px-3 py-3 text-slate-600 uppercase whitespace-nowrap">{s.fatherName}</td>
                                  <td className="px-3 py-3 text-slate-700 whitespace-nowrap">{s.trainingCenter}</td>
                                  <td className="px-3 py-3 text-center whitespace-nowrap">
                                    {downloadType === 'marksheet' ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-200">
                                        <FileText className="w-3 h-3 text-amber-700" />
                                        <span>Marksheet Ready</span>
                                      </span>
                                    ) : downloadType === 'certificate' ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-900 border border-rose-200">
                                        <Award className="w-3 h-3 text-rose-700" />
                                        <span>Certificate Ready</span>
                                      </span>
                                    ) : s.examPin ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-100 text-rose-900 border border-rose-200">
                                        <Key className="w-3 h-3 text-rose-700" />
                                        <span>PIN: {s.examPin}</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                        <span>⏳ Pending PIN</span>
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 text-center whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (downloadType === 'marksheet') {
                                          handleSelectStudentForMarksheet(s);
                                        } else if (downloadType === 'certificate') {
                                          handleSelectStudentForCertificate(s);
                                        } else {
                                          handleSelectStudentForHallTicket(s);
                                        }
                                      }}
                                      className={`px-3 py-1.5 rounded-xl font-extrabold text-[11px] shadow-xs hover:shadow-md transition cursor-pointer flex items-center gap-1.5 mx-auto text-white whitespace-nowrap ${downloadType === 'marksheet'
                                        ? 'bg-gradient-to-r from-rose-700 to-rose-900 hover:from-rose-800 hover:to-rose-950'
                                        : downloadType === 'certificate'
                                          ? 'bg-gradient-to-r from-rose-700 to-rose-900 hover:from-rose-800 hover:to-rose-950'
                                          : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700'
                                        }`}
                                    >
                                      {downloadType === 'marksheet' ? (
                                        <>
                                          <FileText className="w-3.5 h-3.5" />
                                          <span>Generate Marksheet</span>
                                        </>
                                      ) : downloadType === 'certificate' ? (
                                        <>
                                          <Award className="w-3.5 h-3.5" />
                                          <span>Generate Certificate</span>
                                        </>
                                      ) : (
                                        <>
                                          <UserCheck className="w-3.5 h-3.5" />
                                          <span>Create Hall Ticket</span>
                                        </>
                                      )}
                                    </button>
                                  </td>
                                </tr>
                              )))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Pagination Controls */}
                    {filteredBulkStudents.length > 0 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 px-1 border-t border-rose-100">
                        <div className="text-xs text-slate-500 font-semibold text-center sm:text-left">
                          Showing <span className="font-extrabold text-slate-800">{filteredBulkStudents.length > 0 ? startIndex + 1 : 0}</span> to <span className="font-extrabold text-slate-800">{endIndex}</span> of <span className="font-extrabold text-slate-800">{filteredBulkStudents.length}</span> students
                        </div>

                        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end w-full sm:w-auto">
                          <div className="flex items-center gap-1 text-xs text-slate-500 font-medium mr-2">
                            <span>Rows:</span>
                            <select
                              value={pageSize}
                              onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                              className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:border-rose-500 cursor-pointer"
                            >
                              <option value={5}>5</option>
                              <option value={10}>10</option>
                              <option value={20}>20</option>
                              <option value={50}>50</option>
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 text-slate-700 font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition shadow-xs cursor-pointer"
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
                            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 text-slate-700 font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition shadow-xs cursor-pointer"
                          >
                            <span>Next</span>
                            <ChevronRight className="w-4 h-4 text-slate-600" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ASSIGN EXAM, DATE, TIME & PIN PANEL (When student is loaded) ── */}
      {downloadType === 'hall-ticket' && downloadReady && (
        <div id="hallticket-action-panel" className="max-w-3xl mx-auto bg-gradient-to-br from-cyan-50 via-sky-50 to-indigo-50 border-2 border-cyan-300 rounded-3xl p-6 shadow-xl space-y-5 animate-in fade-in duration-300">

          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-cyan-200/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-600 text-white flex items-center justify-center shadow-md shadow-cyan-600/30">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-cyan-950">
                  Assign Online Exam &amp; Schedule Hall Ticket
                </h3>
                <p className="text-xs text-cyan-700">
                  Student: <strong className="text-cyan-900 uppercase">{downloadReady.candidateName}</strong> &bull; Course: <strong className="text-cyan-900 uppercase">{downloadReady.courseCode || downloadReady.course}</strong>
                </p>
              </div>
            </div>

            {credentialsSaved && (
              <span className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-full text-xs font-black shadow-xs">
                <Check className="w-3.5 h-3.5" />
                <span>Ready to Print</span>
              </span>
            )}
          </div>

          {/* Form Rows */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Exam Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-cyan-950">
                Select Online Examination <span className="text-rose-500">*</span>
              </label>
              <select
                value={assignedExamId}
                onChange={e => {
                  setAssignedExamId(e.target.value);
                  setCredentialsSaved(false);
                  const foundEx = savedExams.find(x => x.id === e.target.value);
                  if (foundEx?.examDate) setHallTicketExamDate(foundEx.examDate);
                  if (foundEx?.examTime) setHallTicketExamTime(foundEx.examTime);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-cyan-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
              >
                <option value="">— Select an Examination —</option>
                {savedExams.map(ex => (
                  <option key={ex.id} value={ex.id}>
                    {ex.examTitle || `${ex.year} - ${ex.course} Exam`} ({ex.totalQuestions || 100} Qs) {ex.status === 'active' ? '🟢 LIVE' : '🔴 Inactive'}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-cyan-800">
                {savedExams.length} examination paper(s) available in the system.
              </p>
            </div>

            {/* Auto-Generated PIN */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-cyan-950">
                Exam Access PIN (6-Digit) <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={hallTicketPin}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-cyan-300 bg-white text-sm font-mono font-black text-cyan-900 tracking-[0.3em] text-center"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newPin = generatePin();
                    setHallTicketPin(newPin);
                    setCredentialsSaved(false);
                    setDownloadReady(prev => ({ ...prev, examPin: newPin }));
                  }}
                  className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black transition cursor-pointer shrink-0 shadow-sm"
                  title="Generate a new PIN"
                >
                  Regenerate
                </button>
              </div>
              <p className="text-[11px] text-cyan-800">
                Student uses their Roll No &amp; this PIN to log in to the exam.
              </p>
            </div>

            {/* Admin-Managed Exam Date with Options */}
            <div className="space-y-2 bg-white/70 p-3.5 rounded-2xl border border-cyan-200">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black text-cyan-950 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cyan-700" />
                  <span>Exam Scheduled Date:</span>
                </label>
                <span className="text-[10px] font-extrabold text-cyan-700 bg-cyan-100/70 px-2 py-0.5 rounded-md border border-cyan-200">
                  Select or Type
                </span>
              </div>

              <div className="flex items-center gap-2 min-w-0">
                <input
                  type="text"
                  value={hallTicketExamDate}
                  onChange={e => {
                    setHallTicketExamDate(e.target.value);
                    setCredentialsSaved(false);
                    setDownloadReady(prev => ({ ...prev, examDate: e.target.value }));
                  }}
                  placeholder="e.g. 2026 Feb, 8"
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-cyan-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
                />
                <input
                  type="date"
                  onChange={e => {
                    if (e.target.value) {
                      const formatted = formatDateForInput(e.target.value);
                      setHallTicketExamDate(formatted);
                      setCredentialsSaved(false);
                      setDownloadReady(prev => ({ ...prev, examDate: formatted }));
                    }
                  }}
                  className="shrink-0 max-w-[125px] sm:max-w-none px-2 py-1.5 rounded-xl border border-cyan-300 bg-white text-xs font-bold text-slate-700 cursor-pointer shadow-xs hover:border-cyan-500"
                  title="Pick Date from Calendar"
                />
              </div>

              {/* Quick Date Presets */}
              <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-cyan-100">
                <span className="text-[10px] font-black text-cyan-800 uppercase tracking-wider mr-1">Quick:</span>
                {[
                  { label: 'Today', val: () => getRelativeDatePreset(0) },
                  { label: 'Tomorrow', val: () => getRelativeDatePreset(1) },
                  { label: 'Next Sun', val: () => getNextDayOfWeekPreset(0) },
                  { label: 'Next Mon', val: () => getNextDayOfWeekPreset(1) },
                ].map((preset, pIdx) => (
                  <button
                    key={pIdx}
                    type="button"
                    onClick={() => {
                      const formatted = preset.val();
                      setHallTicketExamDate(formatted);
                      setCredentialsSaved(false);
                      setDownloadReady(prev => ({ ...prev, examDate: formatted }));
                    }}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-cyan-100 hover:bg-cyan-200 text-cyan-900 border border-cyan-300/80 transition cursor-pointer active:scale-95"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Admin-Managed Exam Time with Options */}
            <div className="space-y-2 bg-white/70 p-3.5 rounded-2xl border border-cyan-200">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black text-cyan-950 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-700" />
                  <span>Exam Scheduled Time:</span>
                </label>
                <select
                  value={EXAM_TIME_PRESETS.includes(hallTicketExamTime) ? hallTicketExamTime : ''}
                  onChange={e => {
                    if (e.target.value) {
                      setHallTicketExamTime(e.target.value);
                      setCredentialsSaved(false);
                      setDownloadReady(prev => ({ ...prev, examTime: e.target.value }));
                    }
                  }}
                  className="text-[10px] font-black text-cyan-900 bg-cyan-100/80 px-2 py-0.5 rounded-md border border-cyan-300 focus:outline-none cursor-pointer max-w-[140px] truncate"
                >
                  <option value="">⚡ Time Presets</option>
                  {EXAM_TIME_PRESETS.map((t, idx) => (
                    <option key={idx} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={hallTicketExamTime}
                  onChange={e => {
                    setHallTicketExamTime(e.target.value);
                    setCredentialsSaved(false);
                    setDownloadReady(prev => ({ ...prev, examTime: e.target.value }));
                  }}
                  placeholder="e.g. 10:00 AM to 1:00 PM or 11:00 AM - 1:00 PM"
                  className="w-full px-3 py-2 rounded-xl border border-cyan-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
                />
              </div>

              {/* Quick Time Slot Pills */}
              <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-cyan-100">
                <span className="text-[10px] font-black text-cyan-800 uppercase tracking-wider mr-1">Slots:</span>
                {[
                  '10:00 AM to 1:00 PM',
                  '10:00 AM to 12:00 PM',
                  '02:00 PM to 5:00 PM',
                  '02:00 PM to 4:00 PM',
                ].map((slot, sIdx) => (
                  <button
                    key={sIdx}
                    type="button"
                    onClick={() => {
                      setHallTicketExamTime(slot);
                      setCredentialsSaved(false);
                      setDownloadReady(prev => ({ ...prev, examTime: slot }));
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition cursor-pointer active:scale-95 border ${hallTicketExamTime === slot
                      ? 'bg-cyan-700 text-white border-cyan-700 shadow-xs'
                      : 'bg-cyan-100 hover:bg-cyan-200 text-cyan-900 border-cyan-300/80'
                      }`}
                  >
                    {slot.replace(' to ', ' - ').replace(':00', '').replace(':00', '')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Direct Exam Link Preview Box */}
          {currentAssignedExam && (
            <div className="bg-white/90 border border-cyan-200 rounded-2xl p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-900">
                  Student Exam Portal Direct Link:
                </span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${currentAssignedExam.status === 'active'
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}>
                    {currentAssignedExam.status === 'active' ? '🟢 Exam is LIVE' : '⏳ Exam in Waiting Mode'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={examDirectUrl}
                  className="w-full px-3 py-1.5 rounded-lg text-xs font-mono bg-slate-50 border border-slate-200 text-slate-700"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(examDirectUrl);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
                <a
                  href={examDirectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0"
                  title="Open Exam in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}

          {/* Save & Apply Button */}
          <div className="pt-2">
            <button
              type="button"
              disabled={!assignedExamId || !hallTicketPin || isSavingCredentials}
              onClick={async () => {
                if (!assignedExamId || !hallTicketPin) return;
                setIsSavingCredentials(true);
                const rollNo = downloadReady.htNo || generateRollNo('2026', downloadReady.courseCode || downloadReady.course, downloadReady.admNo);

                await saveHallTicketCredentials({
                  rollNo,
                  examPin: hallTicketPin,
                  examId: assignedExamId,
                  studentName: downloadReady.candidateName || '',
                  course: downloadReady.courseCode || downloadReady.course || '',
                  year: '2026',
                  admissionNo: downloadReady.admNo || '',
                  centerName: downloadReady.trainingCenter || '',
                  examDate: hallTicketExamDate || '2026 Feb, 8',
                  examTime: hallTicketExamTime || '10:00 AM to 1:00 PM',
                });

                setDownloadReady(prev => ({
                  ...prev,
                  examPin: hallTicketPin,
                  htNo: rollNo,
                  examId: assignedExamId,
                  examDate: hallTicketExamDate,
                  examTime: hallTicketExamTime,
                }));
                setCredentialsSaved(true);
                setIsSavingCredentials(false);
              }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-700 via-sky-700 to-indigo-700 hover:from-cyan-800 hover:to-indigo-800 text-white font-black text-sm shadow-lg shadow-cyan-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
            >
              {isSavingCredentials ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /><span>Saving Credentials to Firestore...</span></>
              ) : credentialsSaved ? (
                <><Check className="w-4 h-4" /><span>Credentials Saved &amp; Updated on Hall Ticket!</span></>
              ) : (
                <><Key className="w-4 h-4" /><span>Save Credentials &amp; Update Hall Ticket</span></>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── TEMPLATE PREVIEW DISPLAY ── */}
      {downloadReady && (
        <div id="template-preview-section" className="pt-4 scroll-mt-6">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 mb-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 ${downloadType === 'marksheet' ? 'bg-rose-100 text-rose-700' : downloadType === 'certificate' ? 'bg-rose-100 text-rose-700' : 'bg-rose-100 text-rose-700'
                }`}>
                {downloadType === 'marksheet' ? <FileText className="w-5 h-5 text-rose-700" /> : downloadType === 'certificate' ? <Award className="w-5 h-5 text-rose-700" /> : <UserCheck className="w-5 h-5 text-rose-700" />}
              </div>
              <div>
                <div className="text-[11px] text-slate-500 font-extrabold uppercase tracking-wider">
                  {downloadType === 'marksheet' ? 'Generated Marksheet' : downloadType === 'certificate' ? 'Generated Certificate' : 'Generated Hall Ticket'}
                </div>
                <div className="text-sm font-extrabold text-slate-900">
                  {downloadReady.candidateName || downloadReady.name || 'Student'}
                  <span className="text-slate-500 font-normal ml-2">({downloadReady.admNo || downloadReady.admissionNo})</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrintActiveDocument}
                className="gradient-button text-white px-5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md cursor-pointer hover:scale-105 active:scale-95 transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Save as PDF</span>
              </button>
            </div>
          </div>

          {downloadType === 'certificate' && (
            <div id="certificate-preview-wrapper" className="animate-in slide-in-from-bottom-4 duration-300 overflow-x-auto pb-4 max-w-full">
              <CertificateTemplate initialData={downloadReady} showControls={false} />
            </div>
          )}
          {downloadType === 'marksheet' && (
            <div id="marksheet-preview-wrapper" className="animate-in slide-in-from-bottom-4 duration-300 overflow-x-auto pb-4 max-w-full">
              <MarksheetTemplate initialData={downloadReady} />
            </div>
          )}
          {downloadType === 'hall-ticket' && (
            <div id="hallticket-preview-wrapper" className="animate-in slide-in-from-bottom-4 duration-300 space-y-4 overflow-x-auto pb-4 max-w-full">
              <HallTicketTemplate
                initialData={{
                  ...downloadReady,
                  examPin: hallTicketPin,
                  examDate: hallTicketExamDate,
                  examTime: hallTicketExamTime
                }}
                showControls={false}
              />
            </div>
          )}
        </div>
      )}

    </div>
  );
}
