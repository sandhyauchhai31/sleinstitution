import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Award,
  ChevronLeft,
  ChevronRight,
  BookmarkCheck,
  Send,
  Printer,
  RotateCcw,
  Sparkles,
  HelpCircle,
  FileCheck,
  Building,
  User,
  Hash,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Maximize2,
  AlertTriangle,
  Loader2,
  GraduationCap,
  Lock,
  LayoutGrid,
  X
} from 'lucide-react';
import { getExamById, getAllStoredExamsList, saveStudentExamResult, getExamLiveStatus } from '../utils/questionPaperManager';
import { getStudentSession, clearStudentSession, markExamAttempted, isExamAlreadyAttempted } from '../utils/examAuthManager';

export default function OnlineExamPortal() {
  const { examId } = useParams();
  const navigate = useNavigate();

  // Session: student credentials from sessionStorage (set by LoginPage student tab)
  const [studentSession, setStudentSession] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  // Screen state: 'loading' | 'waiting' | 'exam' | 'submitted' | 'error'
  const [examState, setExamState] = useState('loading');
  const [examData, setExamData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Examination State
  const [activeSubjectTab, setActiveSubjectTab] = useState('ALL');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [questionId]: 'A' | 'B' | 'C' | 'D' }
  const [markedForReview, setMarkedForReview] = useState({}); // { [questionId]: boolean }
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(120 * 60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState(false);

  // ── Anti-Cheating & Proctoring Security System ──────────────────
  const [tabSwitchWarnings, setTabSwitchWarnings] = useState(0);
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [warningReason, setWarningReason] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenRequiredModal, setShowFullscreenRequiredModal] = useState(false);
  const [isDisqualified, setIsDisqualified] = useState(false);

  const tabSwitchWarningsRef = useRef(0);
  const isSubmittingRef = useRef(false);
  const warningModalOpenRef = useRef(false);
  const MAX_STRIKES = 3;

  const answersRef = useRef(answers);
  answersRef.current = answers;
  const markedForReviewRef = useRef(markedForReview);
  markedForReviewRef.current = markedForReview;

  // Result State
  const [examResult, setExamResult] = useState(null);

  // Waiting room countdown display (just cosmetic)
  const [waitingDots, setWaitingDots] = useState('.');

  // Draft auto-save key
  const getDraftKey = useCallback((session, eid) => 
    `sle_exam_draft_${(session?.rollNo || 'anon')}_${eid || examId}`, [examId]);

  // ── Step 1: Load session from sessionStorage ─────────────────────
  useEffect(() => {
    const session = getStudentSession();
    setStudentSession(session);
    setSessionChecked(true);
  }, []);

  // ── Step 2: Once session known, load exam data ────────────────────
  useEffect(() => {
    if (!sessionChecked) return;

    async function loadExam() {
      setIsLoading(true);
      setLoadError('');

      const targetId = examId;
      if (!targetId) {
        setLoadError('No exam ID found. Please log in again.');
        setIsLoading(false);
        return;
      }

      try {
        // Enforce one-time exam: Check if this candidate already completed/submitted
        const currentSession = getStudentSession();
        if (currentSession?.rollNo) {
          const alreadyDone = await isExamAlreadyAttempted(currentSession.rollNo);
          if (alreadyDone || currentSession.examAttempted) {
            setLoadError('This examination has already been completed and submitted. It is a one-time examination and cannot be taken again.');
            setIsLoading(false);
            return;
          }
        }

        // Always fetch fresh from Firestore (bypasses stale cache) for session-based access
        let exam = await getExamById(targetId);
        
        // Fallback: If exam not found directly by ID, look up by course or pick first active exam
        if (!exam) {
          const session = getStudentSession();
          const allExams = getAllStoredExamsList();
          if (session?.course) {
            const cLower = String(session.course).trim().toLowerCase();
            exam = allExams.find(e => (e.course || e.courseName || '').trim().toLowerCase() === cLower) ||
                   allExams.find(e => (e.course || e.courseName || '').trim().toLowerCase().includes(cLower));
          }
          if (!exam && allExams.length > 0) {
            exam = allExams.find(e => e.status === 'active') || allExams[0];
          }
        }

        if (exam) {
          setExamData(exam);
          setTimeRemainingSeconds((exam.duration || 120) * 60);

          // Restore draft answers if student reloaded the page mid-exam
          const session = getStudentSession();
          if (session) {
            const draftKey = getDraftKey(session, exam.id || targetId);
            try {
              const draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
              if (draft?.answers) setAnswers(draft.answers);
              if (draft?.markedForReview) setMarkedForReview(draft.markedForReview);
            } catch (e) {}
          }

          // Determine initial screen based on exam status
          if (exam.status === 'active') {
            setExamState('exam');
          } else {
            setExamState('waiting');
          }
        } else {
          setLoadError(`Examination not found. Please check your credentials.`);
          setExamState('error');
        }
      } catch (err) {
        setLoadError('Failed to load examination. Please check your connection.');
        setExamState('error');
      } finally {
        setIsLoading(false);
      }
    }

    loadExam();
  }, [sessionChecked, examId]);


  // ── Step 3: Live status watcher (waiting room & active exam live sync) ─────────
  useEffect(() => {
    const targetId = examData?.id || examId;
    if (!targetId || examState === 'submitted' || examState === 'error' || examState === 'loading') return;

    const unsub = getExamLiveStatus(targetId, (status, freshExamData) => {
      const isLive = status === 'active';
      if (isLive) {
        if (freshExamData) setExamData(freshExamData);
        setExamState(currentState => {
          if (currentState === 'waiting') {
            setTimeRemainingSeconds(prev => (prev > 0 ? prev : (freshExamData?.duration || 120) * 60));
            return 'exam';
          }
          return currentState;
        });
      } else {
        // Status is 'inactive', 'deactive', 'paused', or 'completed'
        setExamState(currentState => {
          if (currentState === 'exam') {
            // Save draft answers immediately
            try {
              const session = getStudentSession();
              const draftKey = getDraftKey(session, targetId);
              localStorage.setItem(draftKey, JSON.stringify({ 
                answers: answersRef.current, 
                markedForReview: markedForReviewRef.current, 
                savedAt: Date.now() 
              }));
            } catch (e) {}
            return 'waiting';
          }
          return currentState;
        });
      }
    });

    return () => unsub();
  }, [examId, examData?.id]);

  // ── Waiting room animated dots ────────────────────────────────────
  useEffect(() => {
    if (examState !== 'waiting') return;
    const interval = setInterval(() => {
      setWaitingDots(d => d.length >= 3 ? '.' : d + '.');
    }, 600);
    return () => clearInterval(interval);
  }, [examState]);

  // ── Auto-save draft answers every 15 seconds ──────────────────────
  useEffect(() => {
    if (examState !== 'exam' || !studentSession) return;
    const interval = setInterval(() => {
      try {
        const draftKey = getDraftKey(studentSession, examId);
        localStorage.setItem(draftKey, JSON.stringify({ answers, markedForReview, savedAt: Date.now() }));
      } catch (e) {}
    }, 15000);
    return () => clearInterval(interval);
  }, [examState, answers, markedForReview, studentSession, examId]);

  // Questions List & Filtering by Subject Tab
  const allQuestions = useMemo(() => {
    return examData?.questions || [];
  }, [examData]);

  const subjectList = useMemo(() => {
    if (!examData) return [];
    if (examData.subjectDistribution && Object.keys(examData.subjectDistribution).length > 0) {
      return Object.keys(examData.subjectDistribution);
    }
    const set = new Set();
    allQuestions.forEach(q => {
      if (q.subjectId) set.add(q.subjectId);
    });
    return Array.from(set);
  }, [examData, allQuestions]);

  const filteredQuestions = allQuestions;

  const currentQuestion = filteredQuestions[currentQuestionIndex] || allQuestions[0];

  // Timer Countdown Handler
  useEffect(() => {
    if (examState !== 'exam') return;

    if (timeRemainingSeconds <= 0) {
      handleFinalSubmit();
      return;
    }

    const timer = setInterval(() => {
      setTimeRemainingSeconds(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [examState, timeRemainingSeconds]);

  // Format Seconds to HH:MM:SS
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Answer Selection
  const handleSelectOption = (qId, optionLetter) => {
    setAnswers(prev => {
      const updated = { ...prev, [qId]: optionLetter };
      answersRef.current = updated;
      return updated;
    });
  };

  const handleClearResponse = (qId) => {
    setAnswers(prev => {
      const copy = { ...prev };
      delete copy[qId];
      answersRef.current = copy;
      return copy;
    });
  };

  const handleToggleMarkReview = (qId) => {
    setMarkedForReview(prev => {
      const updated = { ...prev, [qId]: !prev[qId] };
      markedForReviewRef.current = updated;
      return updated;
    });
  };

  // Fullscreen Helper
  const enterFullscreen = async () => {
    try {
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      } else if (docEl.msRequestFullscreen) {
        await docEl.msRequestFullscreen();
      }
      setIsFullscreen(true);
      setShowFullscreenRequiredModal(false);
    } catch (err) {
      console.warn('Fullscreen request error:', err);
      setShowFullscreenRequiredModal(false);
    }
  };

  // Compute Scores & Final Submit
  const handleFinalSubmit = async (options = {}) => {
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setIsConfirmModalOpen(false);
    setWarningModalOpen(false);
    setShowFullscreenRequiredModal(false);

    const isAutoDisqualified = options?.disqualified || false;
    const disqualificationReason = options?.disqualificationReason || '';

    // Exit fullscreen cleanly if active
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      }
    } catch (_) {}

    let totalMarksObtained = 0;
    let totalMaxMarks = 0;
    const subjectWiseScore = {};

    const curAnswers = answersRef.current || {};

    // Initialize subject scores
    subjectList.forEach(s => {
      subjectWiseScore[s] = {
        subject: s,
        totalQuestions: 0,
        answeredQuestions: 0,
        correctAnswers: 0,
        marksObtained: 0,
        maxMarks: 0,
        percentage: 0
      };
    });

    allQuestions.forEach(q => {
      const subj = q.subjectId || 'General';
      if (!subjectWiseScore[subj]) {
        subjectWiseScore[subj] = {
          subject: subj,
          totalQuestions: 0,
          answeredQuestions: 0,
          correctAnswers: 0,
          marksObtained: 0,
          maxMarks: 0,
          percentage: 0
        };
      }

      const qMarks = Number(q.marks) || 1;
      totalMaxMarks += qMarks;
      subjectWiseScore[subj].totalQuestions += 1;
      subjectWiseScore[subj].maxMarks += qMarks;

      const studentAns = (curAnswers[q.id] || '').toUpperCase().trim();
      const correctAns = (q.correctAnswer || 'A').toUpperCase().trim();

      if (studentAns) {
        subjectWiseScore[subj].answeredQuestions += 1;
      }

      if (studentAns === correctAns) {
        totalMarksObtained += qMarks;
        subjectWiseScore[subj].correctAnswers += 1;
        subjectWiseScore[subj].marksObtained += qMarks;
      }
    });

    // Compute subject percentages
    Object.values(subjectWiseScore).forEach(stat => {
      stat.percentage = stat.maxMarks > 0 ? Math.round((stat.marksObtained / stat.maxMarks) * 100) : 0;
    });

    const overallPercentage = totalMaxMarks > 0 ? Math.round((totalMarksObtained / totalMaxMarks) * 100) : 0;
    const passingPercent = Number(examData.passingPercentage) || 40;
    const isPassed = !isAutoDisqualified && (overallPercentage >= passingPercent);

    const resultPayload = {
      examId: examData.id,
      examTitle: examData.examTitle || `${examData.year} - ${examData.course} Exam`,
      year: examData.year,
      course: examData.course,
      studentName: studentSession?.studentName || '',
      studentRollNo: studentSession?.rollNo || '',
      registrationNo: studentSession?.rollNo || studentSession?.admissionNo || '',
      centerName: studentSession?.centerName || '',
      totalQuestions: allQuestions.length,
      answeredCount: Object.keys(curAnswers).length,
      totalMarksObtained,
      totalMaxMarks,
      overallPercentage,
      passingPercentage: passingPercent,
      isPassed,
      grade: isAutoDisqualified ? 'DISQUALIFIED' : (overallPercentage >= 85 ? 'A+' : overallPercentage >= 75 ? 'A' : overallPercentage >= 60 ? 'B' : overallPercentage >= 40 ? 'C' : 'F'),
      isDisqualified: isAutoDisqualified,
      disqualificationReason,
      tabViolations: tabSwitchWarningsRef.current,
      subjectWiseBreakdown: subjectWiseScore,
      answersSummary: curAnswers,
      submittedAt: new Date().toISOString()
    };

    setExamResult(resultPayload);

    // Clear draft from localStorage
    if (studentSession) {
      try { localStorage.removeItem(getDraftKey(studentSession, examId)); } catch(e) {}
    }

    // Save to Firestore & local storage (1 single write)
    try {
      await saveStudentExamResult(resultPayload);
      // Mark attempt on hall_tickets (merged into result write to minimize cost)
      if (studentSession?.rollNo) {
        await markExamAttempted(studentSession.rollNo);
      }
    } catch (e) {
      console.warn('Error saving student exam result:', e);
    }

    // Always record submitted exam in persistent submitted storage
    try {
      const submittedList = JSON.parse(localStorage.getItem('sle_submitted_exams') || '[]');
      const ids = [studentSession?.rollNo, studentSession?.admissionNo, examId].filter(Boolean).map(s => String(s).toUpperCase());
      ids.forEach(id => {
        if (!submittedList.includes(id)) submittedList.push(id);
      });
      localStorage.setItem('sle_submitted_exams', JSON.stringify(submittedList));
    } catch (e) {}

    // Clear student session after successful submit
    clearStudentSession();

    setIsSubmitting(false);
    setExamState('submitted');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Trigger Security Violation
  const triggerSecurityViolation = useCallback((reason) => {
    if (examState !== 'exam' || isSubmittingRef.current) return;

    const currentStrikes = tabSwitchWarningsRef.current + 1;
    tabSwitchWarningsRef.current = currentStrikes;
    setTabSwitchWarnings(currentStrikes);
    setWarningReason(reason);

    if (currentStrikes >= MAX_STRIKES) {
      // 3rd strike reached: Disqualify and Auto-Submit immediately
      setIsDisqualified(true);
      setWarningModalOpen(false);
      handleFinalSubmit({
        disqualified: true,
        disqualificationReason: `Exceeded security violation limit (3 tab-switch or window blur violations). Last violation: ${reason}`
      });
    } else {
      setWarningModalOpen(true);
      warningModalOpenRef.current = true;
    }
  }, [examState]);

  // Anti-Cheat Proctoring Security Listeners
  useEffect(() => {
    if (examState !== 'exam') return;

    // Prompt fullscreen on entering exam if not already fullscreen
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      setShowFullscreenRequiredModal(true);
    }

    // 1. Tab Switch & Minimize Detection via Page Visibility API & Mobile PageHide API
    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerSecurityViolation('Tab switch or minimized window detected.');
      }
    };

    // Mobile specific: fires when app is switched, phone is locked, or browser tab is minimized/swiped away
    const handlePageHide = () => {
      triggerSecurityViolation('Exam minimized or switched to another app/tab.');
    };

    // 2. Window Blur (e.g. clicking another application, Alt+Tab, opening new window, split-screen on mobile)
    const handleWindowBlur = () => {
      setTimeout(() => {
        if (document.hidden || !document.hasFocus()) {
          triggerSecurityViolation('Navigating away from the examination window detected.');
        }
      }, 150);
    };

    // 3. Fullscreen Change Detection
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
      setIsFullscreen(isNowFullscreen);
      if (!isNowFullscreen && examState === 'exam' && !isSubmittingRef.current) {
        setShowFullscreenRequiredModal(true);
        triggerSecurityViolation('Exited Fullscreen mode.');
      }
    };

    // 4. Keyboard Shortcuts & Screenshot Key Interception
    const handleKeyDown = (e) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const key = e.key ? e.key.toLowerCase() : '';

      // Block Screenshot / PrintScreen
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        e.preventDefault();
        try { navigator.clipboard?.writeText?.(''); } catch (_) {}
        triggerSecurityViolation('Screenshot attempt detected.');
        return false;
      }

      // Block Ctrl+T (New Tab), Ctrl+N (New Window), Ctrl+W (Close Tab)
      if (isCtrlOrMeta && (key === 't' || key === 'n' || key === 'w')) {
        e.preventDefault();
        e.stopPropagation();
        triggerSecurityViolation(`Attempted shortcut: Ctrl+${key.toUpperCase()} (Opening/closing tabs is prohibited)`);
        return false;
      }

      // Block Incognito shortcuts (Ctrl+Shift+N, Ctrl+Shift+P)
      if (isCtrlOrMeta && e.shiftKey && (key === 'n' || key === 'p')) {
        e.preventDefault();
        e.stopPropagation();
        triggerSecurityViolation('Attempted shortcut for Incognito window.');
        return false;
      }

      // Block DevTools (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C)
      if (e.key === 'F12' || (isCtrlOrMeta && e.shiftKey && (key === 'i' || key === 'j' || key === 'c'))) {
        e.preventDefault();
        e.stopPropagation();
        triggerSecurityViolation('Developer inspection tools are prohibited.');
        return false;
      }

      // Block Ctrl+U (View Source), Ctrl+S (Save), Ctrl+P (Print)
      if (isCtrlOrMeta && (key === 'u' || key === 's' || key === 'p')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Block Copy/Cut/Paste (Ctrl+C, Ctrl+V, Ctrl+X)
      if (isCtrlOrMeta && (key === 'c' || key === 'v' || key === 'x')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Block Alt+Left / Alt+Right (Browser History Navigation)
      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        try { navigator.clipboard?.writeText?.(''); } catch (_) {}
        triggerSecurityViolation('Screenshot attempt detected.');
      }
    };

    // 5. Disable Context Menu (Right Click & Mobile Long-Press)
    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    // 6. Disable Copy/Paste and Clear Clipboard
    const handleClipboardEvent = (e) => {
      e.preventDefault();
      try {
        if (e.clipboardData) {
          e.clipboardData.setData('text/plain', '');
        }
      } catch (_) {}
      return false;
    };

    // 7. Mobile & Web Text Selection Suppression
    const handleSelectStart = (e) => {
      e.preventDefault();
      return false;
    };

    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (sel && sel.toString().length > 0) {
        sel.removeAllRanges();
      }
    };

    // 8. Screenshot / Print Prevention (Blank on Print / PDF export)
    const handleBeforePrint = (e) => {
      e.preventDefault();
      triggerSecurityViolation('Print or Screen Capture attempt detected.');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleClipboardEvent);
    document.addEventListener('cut', handleClipboardEvent);
    document.addEventListener('paste', handleClipboardEvent);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('selectionchange', handleSelectionChange);
    window.addEventListener('beforeprint', handleBeforePrint);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleClipboardEvent);
      document.removeEventListener('cut', handleClipboardEvent);
      document.removeEventListener('paste', handleClipboardEvent);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('selectionchange', handleSelectionChange);
      window.removeEventListener('beforeprint', handleBeforePrint);
    };
  }, [examState, triggerSecurityViolation]);

  // Status counters for Question Palette
  const answeredCount = Object.keys(answers).length;
  const reviewCount = Object.values(markedForReview).filter(Boolean).length;
  const unansweredCount = allQuestions.length - answeredCount;

  // Render Loading / Error
  if (isLoading || !sessionChecked) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-600 text-white flex items-center justify-center shadow-lg mb-4 animate-pulse">
          <GraduationCap className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Loading Examination...</h3>
        <p className="text-xs text-slate-500 mt-1">Verifying your credentials and fetching exam paper</p>
      </div>
    );
  }

  if (examState === 'error' || loadError) {
    const isAlreadySubmitted = loadError?.toLowerCase().includes('already') || loadError?.toLowerCase().includes('one-time');

    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300">
        <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-4 shadow-inner ${
          isAlreadySubmitted ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'
        }`}>
          {isAlreadySubmitted ? <CheckCircle2 className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
        </div>
        <h3 className="text-xl font-black text-slate-900">
          {isAlreadySubmitted ? 'Exam Already Submitted' : 'Exam Unavailable'}
        </h3>
        <p className="text-sm text-slate-600 mt-2 mb-6 leading-relaxed">
          {loadError || 'The requested exam is not accessible.'}
        </p>
        <Link
          to="/student-login"
          className="px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition shadow-md"
        >
          Return to Student Login
        </Link>
      </div>
    );
  }

  // ==========================================
  // WAITING ROOM: Exam Not Yet Active
  // ==========================================
  if (examState === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950 flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          {/* Animated Glow Ring */}
          <div className="relative flex items-center justify-center mb-8">
            <div className="absolute w-40 h-40 rounded-full bg-cyan-500/20 animate-ping" />
            <div className="absolute w-32 h-32 rounded-full bg-cyan-500/30 animate-pulse" />
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center shadow-2xl shadow-cyan-500/40 relative z-10">
              <Clock className="w-12 h-12 text-white" />
            </div>
          </div>

          {/* Card */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
            <div>
              <div className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold px-4 py-2 rounded-full mb-4">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                EXAM NOT YET STARTED
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                {examData?.examTitle || `${examData?.course} Examination`}
              </h2>
              <p className="text-cyan-200/70 text-sm mt-2">
                S.L.E. Institutions &bull; {examData?.year} &bull; {examData?.course}
              </p>
            </div>

            {/* Student Identity Chip */}
            {studentSession && (
              <div className="bg-white/10 border border-white/20 rounded-2xl p-4 text-left space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300/70">Logged in as</p>
                <p className="text-white font-bold text-sm">{studentSession.studentName || 'Student'}</p>
                <p className="text-cyan-200/60 text-xs font-mono">{studentSession.rollNo}</p>
              </div>
            )}

            <div className="text-white/80 space-y-1">
              <p className="text-base font-semibold">⏳ Waiting for admin to activate the exam{waitingDots}</p>
              <p className="text-sm text-white/50">Your exam paper will appear automatically when the exam goes live. Do not close this tab.</p>
            </div>

            {/* Live pulse indicator */}
            <div className="flex items-center justify-center gap-2 text-cyan-300 text-xs font-semibold">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              Listening for exam activation...
            </div>

            <Link
              to="/login"
              className="block text-xs text-white/30 hover:text-white/60 transition"
              onClick={() => clearStudentSession()}
            >
              Not you? Go back to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: LIVE INTERACTIVE EXAMINATION SCREEN
  // ==========================================
  if (examState === 'exam') {
    const globalQIndex = allQuestions.findIndex(q => q.id === currentQuestion?.id);
    const selectedOption = currentQuestion ? answers[currentQuestion.id] : null;
    const isMarked = currentQuestion ? markedForReview[currentQuestion.id] : false;

    return (
      <div 
        className="min-h-screen bg-slate-100 flex flex-col select-none"
        style={{
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none'
        }}
      >
        {/* Anti-screenshot & PDF print masking */}
        <style>{`
          @media print {
            body { display: none !important; }
          }
        `}</style>
        
        {/* Top Fixed Exam Control Header */}
        <header className="sticky top-0 z-40 bg-slate-900 text-white px-3 sm:px-6 py-2 sm:py-3 shadow-md border-b border-slate-800">
          <div className="max-w-7xl mx-auto">
            
            {/* DESKTOP / TABLET HEADER (sm and above) */}
            <div className="hidden sm:flex items-center justify-between gap-4">
              {/* Left: Exam & Student Info */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-rose-600 flex items-center justify-center text-white font-black shrink-0 shadow-md">
                  {examData.course?.[0] || 'E'}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-black text-white truncate">
                    {examData.examTitle || `${examData.year} - ${examData.course} Exam`}
                  </h2>
                  <p className="text-[11px] text-slate-400 truncate">
                    Candidate: <strong className="text-slate-200">{studentSession?.studentName || 'Candidate'}</strong> ({studentSession?.rollNo || studentSession?.admissionNo || 'Guest / Preview'})
                  </p>
                </div>
              </div>

              {/* Center / Right: Live Countdown Timer, Proctoring Badge & Submit Button */}
              <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                {/* Proctoring Active Indicator */}
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-xs ${
                    tabSwitchWarnings === 0
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : tabSwitchWarnings === 1
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-rose-500/30 text-rose-300 border-rose-500/60 animate-pulse'
                  }`}
                  title="Anti-Cheating Proctoring System is Active. Switching tabs is strictly prohibited."
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Proctored • Strikes: {tabSwitchWarnings}/{MAX_STRIKES}</span>
                </div>

                {/* Fullscreen Toggle Button */}
                <button
                  type="button"
                  onClick={enterFullscreen}
                  className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition cursor-pointer"
                  title="Enter Fullscreen"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Fullscreen</span>
                </button>

                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono font-black text-xs sm:text-sm border shadow-inner ${
                  timeRemainingSeconds < 300 
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 animate-pulse' 
                    : 'bg-slate-800 text-amber-400 border-slate-700'
                }`}>
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>{formatTime(timeRemainingSeconds)}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsConfirmModalOpen(true)}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs transition shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Exam</span>
                </button>
              </div>
            </div>

            {/* MOBILE HEADER (< sm) */}
            <div className="flex sm:hidden flex-col gap-1.5">
              {/* Row 1: Student info on Left, Timer & Submit on Right */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-lg bg-rose-600 flex items-center justify-center text-white font-black text-xs shrink-0 shadow-sm">
                    {examData.course?.[0] || 'E'}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xs font-black text-white truncate leading-tight">
                      {examData.examTitle || examData.course || 'Exam'}
                    </h2>
                    <p className="text-[10px] text-slate-400 truncate leading-tight">
                      {studentSession?.studentName || 'Candidate'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-lg font-mono font-black text-[11px] border shadow-inner ${
                    timeRemainingSeconds < 300 
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 animate-pulse' 
                      : 'bg-slate-800 text-amber-400 border-slate-700'
                  }`}>
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>{formatTime(timeRemainingSeconds)}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsConfirmModalOpen(true)}
                    className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 active:from-emerald-700 active:to-teal-700 text-white font-bold text-[11px] transition shadow flex items-center gap-1 cursor-pointer"
                  >
                    <Send className="w-3 h-3" />
                    <span>Submit</span>
                  </button>
                </div>
              </div>

              {/* Row 2: Strikes Status & Mobile Palette Drawer Trigger */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
                <div
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md border font-bold text-[10.5px] ${
                    tabSwitchWarnings === 0
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : tabSwitchWarnings === 1
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-rose-500/30 text-rose-300 border-rose-500/60 animate-pulse'
                  }`}
                  title="Anti-Cheating Proctoring System"
                >
                  <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>Strikes: {tabSwitchWarnings}/{MAX_STRIKES}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMobilePaletteOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-800 active:bg-slate-700 text-slate-300 border border-slate-700 font-bold text-[10.5px] cursor-pointer"
                >
                  <LayoutGrid className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span>Palette ({allQuestions.length > 0 ? (globalQIndex >= 0 ? globalQIndex : currentQuestionIndex) + 1 : 0}/{allQuestions.length})</span>
                </button>
              </div>
            </div>

          </div>
        </header>

        {/* Main Content Layout */}
        <div className="max-w-7xl mx-auto w-full p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 flex-1">
          
          {/* LEFT 8 COLUMNS: QUESTION CARD */}
          <div className="lg:col-span-8 flex flex-col space-y-4">
            
            {/* Question Details Card */}
            {currentQuestion ? (
              <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-sm border border-slate-200 flex-1 flex flex-col justify-between select-none">
                
                <div>
                  {/* Question Header Pill */}
                  <div className="flex items-center justify-between gap-3 pb-3 sm:pb-4 mb-3 sm:mb-5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-rose-100 text-rose-700 font-extrabold text-xs sm:text-sm">
                        Question {(globalQIndex >= 0 ? globalQIndex : currentQuestionIndex) + 1} of {allQuestions.length}
                      </span>
                    </div>

                    <span className="text-xs font-bold text-slate-500 shrink-0">
                      +{currentQuestion.marks || 1} Mark
                    </span>
                  </div>

                  {/* Question Text */}
                  <div className="text-base sm:text-lg font-bold text-slate-900 leading-snug sm:leading-relaxed mb-4 sm:mb-6">
                    {currentQuestion.question || '(No question text entered)'}
                  </div>

                  {/* 4 Options Grid */}
                  <div className="space-y-2.5 sm:space-y-3">
                    {['A', 'B', 'C', 'D'].map((optKey, oIdx) => {
                      const optText = currentQuestion.options?.[oIdx] || '';
                      const isSelected = selectedOption === optKey;

                      return (
                        <div
                          key={optKey}
                          onClick={() => handleSelectOption(currentQuestion.id, optKey)}
                          className={`flex items-start gap-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all cursor-pointer active:scale-[0.99] ${
                            isSelected
                              ? 'border-rose-600 bg-rose-50/50 shadow-sm'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 bg-white'
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-lg sm:rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                            isSelected
                              ? 'bg-rose-600 text-white shadow-md'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {optKey}
                          </div>
                          <div className="text-xs sm:text-sm font-medium text-slate-800 pt-1 sm:pt-0.5 flex-1 break-words">
                            {optText || `Option ${optKey}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Navigation & Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 pt-4 sm:pt-6 mt-4 sm:mt-6 border-t border-slate-100">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => handleToggleMarkReview(currentQuestion.id)}
                      className={`flex-1 sm:flex-initial px-3 sm:px-3.5 py-2.5 sm:py-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                        isMarked
                          ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <BookmarkCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>{isMarked ? 'Marked for Review' : 'Mark for Review'}</span>
                    </button>

                    {selectedOption && (
                      <button
                        type="button"
                        onClick={() => handleClearResponse(currentQuestion.id)}
                        className="px-2.5 sm:px-3 py-2.5 sm:py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition cursor-pointer active:scale-95 shrink-0"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto sm:ml-auto">
                    <button
                      type="button"
                      disabled={currentQuestionIndex === 0}
                      onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                      className="w-full sm:w-auto justify-center px-4 py-2.5 sm:py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 disabled:opacity-40 transition flex items-center gap-1 cursor-pointer active:scale-95"
                    >
                      <ChevronLeft className="w-4 h-4 shrink-0" />
                      <span>Previous</span>
                    </button>

                    <button
                      type="button"
                      disabled={currentQuestionIndex >= filteredQuestions.length - 1}
                      onClick={() => setCurrentQuestionIndex(prev => Math.min(filteredQuestions.length - 1, prev + 1))}
                      className="w-full sm:w-auto justify-center px-5 py-2.5 sm:py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold disabled:opacity-40 transition flex items-center gap-1 cursor-pointer active:scale-95"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-4 h-4 shrink-0" />
                    </button>
                  </div>
                </div>

              </div>
            ) : (
              <div className="bg-white rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center text-slate-500">
                No questions found in this section.
              </div>
            )}
          </div>

          {/* RIGHT 4 COLUMNS: QUESTION PALETTE & PROGRESS */}
          <div className="lg:col-span-4 flex flex-col space-y-4">
            
            {/* Status Counters Widget */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-sm border border-slate-200 space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Examination Overview
              </h3>

              <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
                <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl">
                  <span className="text-base sm:text-lg font-black block text-emerald-600">{answeredCount}</span>
                  <span className="text-[10px]">Answered</span>
                </div>
                <div className="bg-amber-50 text-amber-800 border border-amber-200 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl">
                  <span className="text-base sm:text-lg font-black block text-amber-600">{reviewCount}</span>
                  <span className="text-[10px]">Review</span>
                </div>
                <div className="bg-slate-100 text-slate-700 border border-slate-200 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl">
                  <span className="text-base sm:text-lg font-black block text-slate-800">{unansweredCount}</span>
                  <span className="text-[10px]">Pending</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
                  <span>Overall Progress</span>
                  <span>{Math.round((answeredCount / (allQuestions.length || 1)) * 100)}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
                    style={{ width: `${Math.round((answeredCount / (allQuestions.length || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Question Number Palette Grid */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-sm border border-slate-200 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Question Palette ({filteredQuestions.length})
                </h3>
                <span className="text-[10px] text-slate-400 font-semibold">Click to jump</span>
              </div>

              <div className="grid grid-cols-6 sm:grid-cols-5 gap-1.5 sm:gap-2 max-h-[300px] sm:max-h-[360px] overflow-y-auto p-1 pr-1.5">
                {filteredQuestions.map((q, idx) => {
                  const isCurrent = q.id === currentQuestion?.id;
                  const isAns = !!answers[q.id];
                  const isRev = !!markedForReview[q.id];

                  let btnStyle = 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200';
                  if (isAns && isRev) {
                    btnStyle = 'bg-amber-500 text-white border-amber-600 shadow-sm';
                  } else if (isAns) {
                    btnStyle = 'bg-emerald-600 text-white border-emerald-700 shadow-sm';
                  } else if (isRev) {
                    btnStyle = 'bg-amber-100 text-amber-800 border-amber-300';
                  }

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        setCurrentQuestionIndex(idx);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`h-9 sm:h-10 rounded-lg sm:rounded-xl font-bold text-xs border transition-all cursor-pointer flex items-center justify-center relative ${btnStyle} ${
                        isCurrent ? 'ring-2 ring-rose-500 ring-offset-2 scale-105 z-10' : ''
                      }`}
                    >
                      <span>{q.qNo || idx + 1}</span>
                      {isRev && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-300 absolute top-1 right-1" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Submit Action Button */}
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(true)}
                className="w-full mt-4 py-3 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Submit All Responses</span>
              </button>
            </div>

          </div>

        </div>

        {/* Mobile Slide-up Question Palette Drawer */}
        {isMobilePaletteOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex flex-col justify-end lg:hidden animate-in fade-in duration-200">
            <div 
              className="absolute inset-0"
              onClick={() => setIsMobilePaletteOpen(false)}
            />
            <div className="relative bg-white rounded-t-3xl p-4 sm:p-5 max-h-[85vh] flex flex-col shadow-2xl border-t border-slate-200 animate-in slide-in-from-bottom duration-300">
              {/* Drawer handle */}
              <div className="w-12 h-1.5 rounded-full bg-slate-300 mx-auto mb-3" />
              
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Question Palette</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Tap any question to jump</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobilePaletteOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 active:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Compact Stats */}
              <div className="grid grid-cols-3 gap-2 my-3 text-center text-xs font-bold">
                <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-2 rounded-xl">
                  <span className="text-base font-black block text-emerald-600">{answeredCount}</span>
                  <span className="text-[10px]">Answered</span>
                </div>
                <div className="bg-amber-50 text-amber-800 border border-amber-200 p-2 rounded-xl">
                  <span className="text-base font-black block text-amber-600">{reviewCount}</span>
                  <span className="text-[10px]">Review</span>
                </div>
                <div className="bg-slate-100 text-slate-700 border border-slate-200 p-2 rounded-xl">
                  <span className="text-base font-black block text-slate-800">{unansweredCount}</span>
                  <span className="text-[10px]">Pending</span>
                </div>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-6 gap-1.5 overflow-y-auto max-h-[48vh] p-1 pr-1">
                {filteredQuestions.map((q, idx) => {
                  const isCurrent = q.id === currentQuestion?.id;
                  const isAns = !!answers[q.id];
                  const isRev = !!markedForReview[q.id];

                  let btnStyle = 'bg-slate-100 text-slate-700 border-slate-200';
                  if (isAns && isRev) {
                    btnStyle = 'bg-amber-500 text-white border-amber-600';
                  } else if (isAns) {
                    btnStyle = 'bg-emerald-600 text-white border-emerald-700';
                  } else if (isRev) {
                    btnStyle = 'bg-amber-100 text-amber-800 border-amber-300';
                  }

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        setCurrentQuestionIndex(idx);
                        setIsMobilePaletteOpen(false);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`h-10 rounded-xl font-bold text-xs border transition flex items-center justify-center relative ${btnStyle} ${
                        isCurrent ? 'ring-2 ring-rose-500 ring-offset-1 scale-105 z-10' : ''
                      }`}
                    >
                      <span>{q.qNo || idx + 1}</span>
                      {isRev && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-300 absolute top-1 right-1" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Submit button in drawer */}
              <div className="pt-3 mt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobilePaletteOpen(false);
                    setIsConfirmModalOpen(true);
                  }}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Submit All Responses</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {isConfirmModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 max-h-[92vh] overflow-y-auto">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <FileCheck className="w-6 h-6" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-black text-slate-900">Confirm Exam Submission?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  You have answered <strong>{answeredCount}</strong> of <strong>{allQuestions.length}</strong> questions.
                </p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-3 text-xs space-y-1 text-slate-600 border border-slate-200">
                <div className="flex justify-between">
                  <span>Answered:</span>
                  <span className="font-bold text-emerald-600">{answeredCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Unanswered:</span>
                  <span className="font-bold text-rose-600">{unansweredCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Marked for Review:</span>
                  <span className="font-bold text-amber-600">{reviewCount}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
                >
                  Continue Exam
                </button>
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Calculating...' : 'Yes, Submit Now'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mandatory Fullscreen Prompt Modal */}
        {showFullscreenRequiredModal && !warningModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
            <div className="max-w-md w-full bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl border border-slate-200 text-center space-y-4 sm:space-y-5 max-h-[92vh] overflow-y-auto">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-cyan-100 text-cyan-700 flex items-center justify-center mx-auto shadow-inner">
                <Maximize2 className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <h3 className="text-lg sm:text-xl font-black text-slate-900">
                  Mandatory Fullscreen Mode
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  To ensure examination integrity, this exam must be taken in Fullscreen mode. Opening new tabs or navigating away is strictly monitored.
                </p>
              </div>

              <div className="bg-amber-50 rounded-2xl p-3.5 sm:p-4 border border-amber-200 text-left text-xs text-amber-900 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-amber-900">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>Proctoring Security Rules:</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-[11px] sm:text-[11.5px] text-amber-800">
                  <li>Do not switch tabs or open new tabs (3 strikes = auto-submit).</li>
                  <li>Do not exit fullscreen mode until finished.</li>
                  <li>Keyboard shortcuts (Ctrl+T, Ctrl+N, F12) and copy/paste are disabled.</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={enterFullscreen}
                className="w-full py-3 sm:py-3.5 rounded-2xl bg-gradient-to-r from-cyan-600 via-sky-600 to-indigo-600 hover:from-cyan-700 hover:to-indigo-700 text-white font-black text-xs sm:text-sm shadow-lg shadow-cyan-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Maximize2 className="w-4 h-4" />
                <span>Enter Fullscreen &amp; Continue Exam</span>
              </button>
            </div>
          </div>
        )}

        {/* Security Violation Strike Warning Modal */}
        {warningModalOpen && (
          <div className="fixed inset-0 z-50 bg-rose-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in zoom-in-95 duration-200">
            <div className="max-w-md w-full bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl border-2 border-rose-500 text-center space-y-4 sm:space-y-5 max-h-[92vh] overflow-y-auto">
              
              {/* Pulsing Warning Icon */}
              <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 animate-pulse">
                  <ShieldAlert className="w-8 h-8 sm:w-10 sm:h-10" />
                </div>
              </div>

              <div className="space-y-1 sm:space-y-1.5">
                <span className="px-3 sm:px-3.5 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300 inline-block">
                  Security Violation: Warning {tabSwitchWarnings} of {MAX_STRIKES}
                </span>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 pt-1">
                  Tab Switch or Navigation Detected!
                </h3>
                <p className="text-xs text-rose-700 font-semibold bg-rose-50 rounded-xl p-2 sm:p-2.5 border border-rose-200">
                  {warningReason || 'Leaving the examination window or switching tabs is strictly forbidden.'}
                </p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-3 sm:p-4 border border-slate-200 text-xs text-slate-600 space-y-1.5 sm:space-y-2 text-left">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Important Notice:</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px] sm:text-[11.5px]">
                  All tab changes, shortcuts, and focus losses are logged in real-time. 
                  You have <strong className="text-rose-600">{MAX_STRIKES - tabSwitchWarnings} warning(s)</strong> remaining. If you leave this window again, your examination will be <strong>permanently auto-submitted and cancelled</strong>.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setWarningModalOpen(false);
                  warningModalOpenRef.current = false;
                  enterFullscreen();
                }}
                className="w-full py-3 sm:py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white font-black text-xs sm:text-sm shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <span>I Understand &bull; Return to Exam</span>
              </button>
            </div>
          </div>
        )}

      </div>
    );
  }

  // ==========================================
  // VIEW 3: EXAM SUBMITTED CONFIRMATION
  // ==========================================
  if (examState === 'submitted') {
    const isTerminatedDisqualified = examResult?.isDisqualified || isDisqualified;

    return (
      <div className="min-h-[85vh] py-8 sm:py-12 px-3 sm:px-6 bg-slate-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-slate-200 overflow-hidden text-center p-6 sm:p-10 space-y-5 sm:space-y-6 animate-in fade-in zoom-in-95 duration-300">
          
          {/* Status Badge */}
          {isTerminatedDisqualified ? (
            <div className="w-20 h-20 rounded-3xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
              <ShieldAlert className="w-10 h-10" />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>
          )}

          <div>
            <span className={`px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider inline-block mb-3 border ${
              isTerminatedDisqualified
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {isTerminatedDisqualified ? 'Exam Terminated / Disqualified' : 'Exam Submitted'}
            </span>
            <h1 className="text-2xl font-black text-slate-900 mb-1.5">
              {isTerminatedDisqualified ? 'Security Disqualification' : 'Your Exam is Submitted'}
            </h1>
            <p className="text-sm font-semibold text-slate-700">
              {studentSession?.studentName || examResult?.studentName || 'Candidate'}
            </p>
            {(studentSession?.rollNo || examResult?.registrationNo || studentSession?.admissionNo) && (
              <p className="text-xs text-slate-500 font-mono mt-1">
                Roll No: {studentSession?.rollNo || examResult?.registrationNo || studentSession?.admissionNo}
              </p>
            )}
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs text-slate-600 space-y-1.5">
            {isTerminatedDisqualified ? (
              <>
                <p className="font-bold text-rose-700">
                  {examResult?.disqualificationReason || 'The examination was automatically cancelled and submitted due to exceeding allowed tab-switch / security violations.'}
                </p>
                <p className="text-slate-500">
                  Your responses and violation logs have been submitted to the institute proctor for review.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-slate-800">
                  Your examination has been completed and recorded successfully.
                </p>
                <p className="text-slate-500">
                  Thank you for attending. You may now safely exit this window.
                </p>
              </>
            )}
          </div>

          <div className="pt-2">
            <Link
              to="/student-login"
              onClick={() => clearStudentSession()}
              className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Done / Exit Examination</span>
            </Link>
          </div>

        </div>
      </div>
    );
  }

  return null;
}
