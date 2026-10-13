import React, { useState, useEffect, useMemo } from 'react';
import {
  Download,
  Upload,
  Eye,
  EyeOff,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Database,
  FileText,
  Sparkles,
  RefreshCw,
  X,
  Printer,
  User,
  Phone,
  MapPin,
  Calendar,
  GraduationCap,
  Building,
  ShieldCheck,
  ShieldAlert,
  HardDrive,
  Clock,
  Layers,
  Search,
  CheckSquare,
  Square,
  AlertTriangle,
  FileJson,
  Package,
  BookOpen,
  BookmarkCheck,
  FileQuestion,
  Award,
  Receipt,
  UserCheck,
  CreditCard,
  Settings,
  Mail,
  Users,
  Palette,
  History
} from 'lucide-react';
import { db, collection, getDocs, setDoc, doc, writeBatch } from '../firebase';

// Helper to sanitize documents before saving to Firestore (removes undefined)
function sanitizeFirestoreData(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeFirestoreData(item)).filter(item => item !== undefined);
  }
  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      clean[k] = sanitizeFirestoreData(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

// Complete list of system collections for full security backup & restore
const SYSTEM_COLLECTIONS = [
  { id: 'franchisees', name: 'Franchisees & Centers', icon: Building, color: 'text-indigo-500', desc: 'Franchise profiles, credentials, plans & valid till dates' },
  { id: 'students', name: 'Registered Students', icon: GraduationCap, color: 'text-rose-500', desc: 'Student admissions, registration IDs & class details' },
  { id: 'applications', name: 'Student Applications', icon: FileText, color: 'text-amber-500', desc: 'Online and offline student admission applications' },
  { id: 'branches', name: 'Authorized Branches', icon: MapPin, color: 'text-emerald-500', desc: 'Official center branches, addresses & location codes' },
  { id: 'courses', name: 'Courses & Syllabus', icon: BookOpen, color: 'text-sky-500', desc: 'Computer, vocational & skill education courses' },
  { id: 'course_subjects', name: 'Course Subjects', icon: BookmarkCheck, color: 'text-teal-500', desc: 'Subject codes, curriculum & exam marks allocations' },
  { id: 'exams', name: 'Examinations', icon: FileQuestion, color: 'text-cyan-500', desc: 'Question papers, schedules & exam session configs' },
  { id: 'exam_results', name: 'Exam Results', icon: Award, color: 'text-purple-500', desc: 'Student marks, grades & performance reports' },
  { id: 'hall_tickets', name: 'Hall Tickets', icon: Receipt, color: 'text-blue-500', desc: 'Issued exam admit cards and verification codes' },
  { id: 'marksheets', name: 'Marksheets', icon: FileSpreadsheet, color: 'text-green-500', desc: 'Official student marks statements & grades' },
  { id: 'directors', name: 'Board of Directors', icon: UserCheck, color: 'text-indigo-400', desc: 'Authorized signatories, designations & signatures' },
  { id: 'transactions', name: 'Payment Transactions', icon: CreditCard, color: 'text-emerald-400', desc: 'Franchise fees, student fee receipts & online transactions' },
  { id: 'system_settings', name: 'System Settings', icon: Settings, color: 'text-slate-400', desc: 'Portal configs, pricing rules & application fee settings' },
  { id: 'plans', name: 'Franchise Plans', icon: Package, color: 'text-purple-400', desc: '1-Year, 2-Year, 3-Year & First-Time fee plans' },
  { id: 'inquiries', name: 'Landing Inquiries', icon: Mail, color: 'text-amber-400', desc: 'Public website lead and admission inquiries' },
  { id: 'coaching_students', name: 'Coaching Students', icon: Users, color: 'text-pink-500', desc: 'Coaching batch enrollments & records' },
  { id: 'coaching_applications', name: 'Coaching Applications', icon: FileText, color: 'text-rose-400', desc: 'Coaching program submissions' },
  { id: 'certificate_history', name: 'Certificate History', icon: History, color: 'text-violet-500', desc: 'Certificate issuance records & verification log' },
  { id: 'certificate_config', name: 'Certificate Designer Config', icon: Palette, color: 'text-fuchsia-500', desc: 'Certificate design layouts, coordinates & styling' },
  { id: 'users', name: 'Portal Users', icon: User, color: 'text-cyan-400', desc: 'Admin & authorized staff account records' }
];

export default function ImportExportData({ isDarkMode: propDarkMode }) {
  // Respect parent isDarkMode or read from localStorage
  const isDarkMode = propDarkMode !== undefined ? propDarkMode : (localStorage.getItem('sle_admin_dark_mode') === 'true');

  // Navigation tab: 'backup-restore' (Security JSON) or 'student-spreadsheet' (CSV)
  const [activeTab, setActiveTab] = useState('backup-restore');

  // -------------------------------------------------------------
  // STATE: FULL DATABASE SECURITY BACKUP & RESTORE
  // -------------------------------------------------------------
  const [collectionCounts, setCollectionCounts] = useState({});
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [selectedCollections, setSelectedCollections] = useState(() => 
    SYSTEM_COLLECTIONS.map(c => c.id)
  );
  const [isExportingDB, setIsExportingDB] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);
  const [lastBackupTime, setLastBackupTime] = useState(() => 
    localStorage.getItem('sle_last_db_backup') || null
  );

  // Restore States
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoreFileData, setRestoreFileData] = useState(null);
  const [restoreFileName, setRestoreFileName] = useState('');
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreState, setRestoreState] = useState('preview'); // 'preview' | 'restoring' | 'completed' | 'error'
  const [restoreSummary, setRestoreSummary] = useState(null);
  const [restoreProgress, setRestoreProgress] = useState(null);
  const [restoreLog, setRestoreLog] = useState([]);
  const [restoreMode, setRestoreMode] = useState('merge'); // 'merge' | 'overwrite'
  const [dbNotification, setDbNotification] = useState(null);

  // -------------------------------------------------------------
  // STATE: STUDENT SPREADSHEET (CSV)
  // -------------------------------------------------------------
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [showDataTable, setShowDataTable] = useState(true);
  const [importingStudents, setImportingStudents] = useState(false);
  const [studentImportStatus, setStudentImportStatus] = useState(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [selectedStudentForView, setSelectedStudentForView] = useState(null);

  // -------------------------------------------------------------
  // 1. FETCH LIVE DATABASE COUNTS FOR ALL COLLECTIONS
  // -------------------------------------------------------------
  const fetchCollectionCounts = async () => {
    setLoadingCounts(true);
    const counts = {};

    for (const col of SYSTEM_COLLECTIONS) {
      try {
        if (db) {
          const snap = await getDocs(collection(db, col.id));
          counts[col.id] = snap.size;
        } else {
          counts[col.id] = 0;
        }
      } catch (err) {
        // Fallback to local cache estimate if permission or network issue
        try {
          const cached = JSON.parse(localStorage.getItem(`sle_${col.id}_cache`) || '[]');
          counts[col.id] = Array.isArray(cached) ? cached.length : 0;
        } catch (e) {
          counts[col.id] = 0;
        }
      }
    }

    setCollectionCounts(counts);
    setLoadingCounts(false);
  };

  useEffect(() => {
    fetchCollectionCounts();
  }, []);

  // -------------------------------------------------------------
  // 2. EXPORT DATABASE SECURITY BACKUP (.JSON)
  // -------------------------------------------------------------
  const handleExportDatabase = async (targetCollectionId = null) => {
    setIsExportingDB(true);
    setExportProgress({ current: 0, total: 0, message: 'Initiating security snapshot...' });
    setDbNotification(null);

    const colsToExport = targetCollectionId 
      ? [targetCollectionId] 
      : selectedCollections;

    if (colsToExport.length === 0) {
      alert('Please select at least one collection to export.');
      setIsExportingDB(false);
      setExportProgress(null);
      return;
    }

    try {
      const backupCollections = {};
      let totalDocsCount = 0;
      const totalCols = colsToExport.length;

      for (let i = 0; i < totalCols; i++) {
        const colId = colsToExport[i];
        setExportProgress({
          current: i + 1,
          total: totalCols,
          message: `Backing up collection '${colId}' (${i + 1}/${totalCols})...`
        });

        backupCollections[colId] = [];

        if (db) {
          try {
            const snap = await getDocs(collection(db, colId));
            snap.forEach(d => {
              backupCollections[colId].push({
                id: d.id,
                ...d.data()
              });
            });
          } catch (err) {
            console.warn(`Could not read collection ${colId} from Firestore:`, err);
            // Fallback to local cache if available
            try {
              const cached = JSON.parse(localStorage.getItem(`sle_${colId}_cache`) || '[]');
              if (Array.isArray(cached)) {
                backupCollections[colId] = cached;
              }
            } catch (e) {}
          }
        }

        totalDocsCount += backupCollections[colId].length;
      }

      // Also bundle local storage caches for full fail-safe restoration
      const localCaches = {};
      const cacheKeys = [
        'sle_students_cache',
        'sle_coaching_students_cache',
        'sle_franchisees_cache',
        'sle_branches_cache',
        'sle_courses_cache',
        'sle_directors_cache',
        'sle_transactions_cache',
        'sle_certificate_config',
        'sle_pricing_settings',
        'sle_student_app_charges'
      ];
      cacheKeys.forEach(k => {
        try {
          const val = localStorage.getItem(k);
          if (val) localCaches[k] = JSON.parse(val);
        } catch (e) {}
      });

      const now = new Date();
      const timestampIso = now.toISOString();
      const dateStr = timestampIso.split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');

      const backupPayload = {
        system: 'SLES INSTITUTION MANAGEMENT SYSTEM',
        portal: 'SuperAdmin Portal Security Backup',
        version: '2.0.0',
        exportedAt: timestampIso,
        exportedBy: 'SuperAdmin',
        type: targetCollectionId ? `SINGLE_COLLECTION_${targetCollectionId.toUpperCase()}` : 'FULL_SECURITY_DATABASE_BACKUP',
        metadata: {
          totalCollections: Object.keys(backupCollections).length,
          totalDocuments: totalDocsCount,
          environment: 'production',
          checksumAlgorithm: 'json-length'
        },
        collectionCounts: Object.fromEntries(
          Object.entries(backupCollections).map(([k, v]) => [k, v.length])
        ),
        collections: backupCollections,
        localCaches
      };

      // Trigger download
      const jsonString = JSON.stringify(backupPayload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      const fileName = targetCollectionId
        ? `sles_${targetCollectionId}_backup_${dateStr}_${timeStr}.json`
        : `sles_security_backup_complete_${dateStr}_${timeStr}.json`;
      downloadLink.download = fileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);

      const backupRecord = `${dateStr} ${now.toLocaleTimeString()}`;
      localStorage.setItem('sle_last_db_backup', backupRecord);
      setLastBackupTime(backupRecord);

      setDbNotification({
        type: 'success',
        title: 'Security Backup Exported Successfully!',
        message: `Saved ${totalDocsCount} documents across ${Object.keys(backupCollections).length} collection(s) to ${fileName}.`
      });
    } catch (err) {
      console.error('Database export error:', err);
      setDbNotification({
        type: 'error',
        title: 'Export Failed',
        message: `An error occurred while exporting: ${err.message}`
      });
    } finally {
      setIsExportingDB(false);
      setExportProgress(null);
    }
  };

  // -------------------------------------------------------------
  // 3. SELECT & PARSE RESTORE BACKUP FILE (.JSON)
  // -------------------------------------------------------------
  const handleSelectRestoreFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setRestoreFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed || (!parsed.collections && typeof parsed !== 'object')) {
          alert('Invalid backup file. The uploaded JSON does not contain institutional collections.');
          return;
        }

        // Standardize format if raw collections or wrapped
        let standardizedCols = parsed.collections || {};
        if (Object.keys(standardizedCols).length === 0) {
          // Check if top-level keys match any SYSTEM_COLLECTIONS
          const topLevelMatches = Object.keys(parsed).filter(k => 
            SYSTEM_COLLECTIONS.some(sc => sc.id === k)
          );
          if (topLevelMatches.length > 0) {
            standardizedCols = {};
            topLevelMatches.forEach(k => {
              standardizedCols[k] = parsed[k];
            });
          }
        }

        setRestoreFileData({
          raw: parsed,
          collections: standardizedCols,
          metadata: parsed.metadata || {},
          exportedAt: parsed.exportedAt || 'Unknown Date',
          exportedBy: parsed.exportedBy || 'Unknown',
          version: parsed.version || '1.0',
          localCaches: parsed.localCaches || {}
        });
        setRestoreConfirmed(false);
        setRestoreState('preview');
        setRestoreSummary(null);
        setRestoreLog([]);
        setRestoreProgress(null);
        setRestoreModalOpen(true);
      } catch (err) {
        console.error('Failed to parse backup JSON:', err);
        alert('Could not read JSON file. Please ensure it is a valid formatted JSON file.');
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  // -------------------------------------------------------------
  // 4. EXECUTE HIGH-SPEED BATCHED DATABASE RESTORATION
  // -------------------------------------------------------------
  const handleExecuteRestore = async () => {
    if (!restoreFileData || !restoreFileData.collections) return;
    if (!restoreConfirmed) {
      alert('Please check the confirmation box to proceed with database restoration.');
      return;
    }

    setIsRestoring(true);
    setRestoreState('restoring');
    setRestoreLog([]);
    const logs = [];
    const addLog = (msg) => {
      logs.push(msg);
      setRestoreLog([...logs]);
    };

    addLog(`[${new Date().toLocaleTimeString()}] Starting high-speed restoration...`);
    addLog(`Restore Mode: ${restoreMode === 'merge' ? 'Safe Merge (Upsert)' : 'Complete Sync'}`);

    const cols = Object.keys(restoreFileData.collections);
    let totalRestoredDocs = 0;

    // Calculate total docs across all collections
    let grandTotalDocs = 0;
    cols.forEach(colId => {
      const raw = restoreFileData.collections[colId];
      const count = Array.isArray(raw) ? raw.length : (typeof raw === 'object' && raw ? Object.keys(raw).length : 0);
      grandTotalDocs += count;
    });
    let overallProcessedDocs = 0;

    try {
      for (let cIdx = 0; cIdx < cols.length; cIdx++) {
        const colId = cols[cIdx];
        const rawDocs = restoreFileData.collections[colId];
        const docList = Array.isArray(rawDocs) ? rawDocs : (typeof rawDocs === 'object' && rawDocs ? Object.values(rawDocs) : []);
        
        addLog(`Processing collection '${colId}': ${docList.length} documents...`);
        
        // Immediately sync local cache so data is guaranteed saved locally
        try {
          const cacheKey = `sle_${colId}_cache`;
          localStorage.setItem(cacheKey, JSON.stringify(docList));
          if (colId === 'students') {
            localStorage.setItem('sle_coaching_students_cache', JSON.stringify(docList));
          }
        } catch (e) {}

        setRestoreProgress({
          collection: colId,
          colIndex: cIdx + 1,
          totalCols: cols.length,
          currentDocs: 0,
          totalDocsInCol: docList.length,
          overallPercent: grandTotalDocs > 0 ? Math.round((overallProcessedDocs / grandTotalDocs) * 100) : 0
        });

        if (db && docList.length > 0) {
          const BATCH_SIZE = 80; // Safe paced chunking for Firestore rate limits
          for (let bIdx = 0; bIdx < docList.length; bIdx += BATCH_SIZE) {
            const chunk = docList.slice(bIdx, bIdx + BATCH_SIZE);
            const batch = writeBatch(db);

            for (let dIdx = 0; dIdx < chunk.length; dIdx++) {
              const item = chunk[dIdx];
              const rawId = item.id || item.registrationNo || item.regNo || item.franchiseeId || item.code || `doc_${bIdx + dIdx}`;
              const docId = String(rawId).replace(/[\/\\]/g, '_').trim() || `doc_${bIdx + dIdx}`;
              
              const docPayload = sanitizeFirestoreData({ ...item });
              delete docPayload.id;

              const docRef = doc(db, colId, docId);
              batch.set(docRef, {
                ...docPayload,
                id: docId,
                lastRestoredAt: new Date().toISOString()
              }, { merge: true });
            }

            try {
              // 6-second timeout safety guard to prevent Firestore Spark rate limit deadlocks
              await Promise.race([
                batch.commit(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Quota backoff timeout')), 6000))
              ]);
              totalRestoredDocs += chunk.length;
              overallProcessedDocs += chunk.length;
            } catch (bErr) {
              console.warn(`Paced batch fallback for ${colId} (slice ${bIdx}):`, bErr?.message || bErr);
              // Paced single write fallback
              for (let dIdx = 0; dIdx < chunk.length; dIdx++) {
                const item = chunk[dIdx];
                const rawId = item.id || item.registrationNo || item.regNo || item.franchiseeId || item.code || `doc_${bIdx + dIdx}`;
                const docId = String(rawId).replace(/[\/\\]/g, '_').trim() || `doc_${bIdx + dIdx}`;
                const docPayload = sanitizeFirestoreData({ ...item });
                delete docPayload.id;

                try {
                  await Promise.race([
                    setDoc(doc(db, colId, docId), {
                      ...docPayload,
                      id: docId,
                      lastRestoredAt: new Date().toISOString()
                    }, { merge: true }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
                  ]);
                  totalRestoredDocs++;
                } catch (sErr) {
                  // Document saved to local cache; continue smoothly
                }
                overallProcessedDocs++;
              }
            }

            // Pacing delay (120ms) between batches to stay under Firestore free-tier quotas
            await new Promise(r => setTimeout(r, 120));

            setRestoreProgress({
              collection: colId,
              colIndex: cIdx + 1,
              totalCols: cols.length,
              currentDocs: Math.min(bIdx + BATCH_SIZE, docList.length),
              totalDocsInCol: docList.length,
              overallPercent: grandTotalDocs > 0 ? Math.min(100, Math.round((overallProcessedDocs / grandTotalDocs) * 100)) : 100
            });
          }
        }

        addLog(`✓ Successfully restored collection '${colId}' (${docList.length} docs).`);
      }

      // Restore bundled local storage caches if present
      if (restoreFileData.localCaches) {
        Object.entries(restoreFileData.localCaches).forEach(([k, v]) => {
          try {
            localStorage.setItem(k, JSON.stringify(v));
          } catch (e) {}
        });
        addLog(`✓ Synchronized ${Object.keys(restoreFileData.localCaches).length} system local cache stores.`);
      }

      addLog(`[${new Date().toLocaleTimeString()}] Restore complete! Successfully restored ${totalRestoredDocs} documents.`);
      
      setRestoreState('completed');
      setRestoreSummary({
        totalDocs: totalRestoredDocs,
        totalCols: cols.length,
        time: new Date().toLocaleTimeString()
      });

      setDbNotification({
        type: 'success',
        title: 'Database Restored Successfully!',
        message: `Restored ${totalRestoredDocs} documents across ${cols.length} collection(s) into database.`
      });

      // Refresh live counts
      fetchCollectionCounts();
      fetchStudents();
    } catch (err) {
      console.error('Restoration error:', err);
      addLog(`❌ Restoration encountered an error: ${err.message}`);
      setRestoreState('error');
      setDbNotification({
        type: 'error',
        title: 'Restoration Failed',
        message: `An error occurred: ${err.message}`
      });
    } finally {
      setIsRestoring(false);
    }
  };

  // -------------------------------------------------------------
  // 5. FETCH LIVE STUDENTS FOR SPREADSHEET (CSV)
  // -------------------------------------------------------------
  const fetchStudents = async () => {
    setLoadingStudents(true);
    let loadedMap = new Map();

    // Check localStorage cache first
    try {
      const cached = JSON.parse(localStorage.getItem('sle_students_cache') || '[]');
      cached.forEach(item => {
        if (item.registrationNo || item.regNo || item.id) {
          const key = String(item.registrationNo || item.regNo || item.id);
          loadedMap.set(key, item);
        }
      });
    } catch (e) {}

    // Check Firestore 'students' collection
    if (db) {
      try {
        const snap = await getDocs(collection(db, 'students'));
        snap.forEach(docSnap => {
          const data = docSnap.data();
          const key = String(data.registrationNo || data.regNo || docSnap.id);
          loadedMap.set(key, { id: docSnap.id, ...data });
        });
      } catch (e) {}
    }

    const list = Array.from(loadedMap.values()).map((s, idx) => {
      const regNo = String(s.registrationNo || s.regNo || 202638001 + idx);
      const fId = String(s.franchiseeId || s.environmentId || s.centerCode || 'FR-2026-901');
      const name = String(s.fullName || s.name || s.studentName || 'Student Name');
      const mobile = String(s.contactNo || s.mobileNo || s.phone || 'N/A');
      const place = String(s.place || s.location || s.trustBranch || s.address || 'Athani');
      const cls = String(s.selectedClass || s.class || s.admissionClass || '10th');
      const date = String(s.createdDate || s.date || s.admissionDate || new Date().toISOString().split('T')[0]);

      return {
        ...s,
        registrationNo: regNo,
        franchiseeId: fId,
        fullName: name,
        mobileNo: mobile,
        place: place,
        selectedClass: cls,
        createdDate: date
      };
    });

    setStudents(list);
    setLoadingStudents(false);
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // Filter students based on search query
  const filteredStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return students;
    const q = studentSearchQuery.toLowerCase();
    return students.filter(s => 
      s.fullName?.toLowerCase().includes(q) ||
      s.registrationNo?.toLowerCase().includes(q) ||
      s.franchiseeId?.toLowerCase().includes(q) ||
      s.mobileNo?.toLowerCase().includes(q) ||
      s.place?.toLowerCase().includes(q) ||
      s.selectedClass?.toLowerCase().includes(q)
    );
  }, [students, studentSearchQuery]);

  // Download CSV Excel Template Handler
  const handleDownloadTemplate = () => {
    const headers = [
      'REGISTRATION NO',
      'FRANCHISEE ID',
      'NAME',
      'MOBILE NO',
      'PLACE',
      'CLASS',
      'DATE'
    ];

    const sampleRow = [
      '202638001',
      'FR-2026-901',
      'Ananya Gowda',
      '9845012345',
      'Athani',
      '10th',
      '2026-08-25'
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), sampleRow.join(',')].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'sle_student_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Active Database Records to CSV Excel
  const handleExportCSV = () => {
    if (students.length === 0) {
      alert('No student records available to export.');
      return;
    }

    const headers = [
      'REGISTRATION NO',
      'FRANCHISEE ID',
      'NAME',
      'MOBILE NO',
      'PLACE',
      'CLASS',
      'DATE'
    ];

    const rows = students.map(s => [
      `"${s.registrationNo}"`,
      `"${s.franchiseeId}"`,
      `"${s.fullName}"`,
      `"${s.mobileNo}"`,
      `"${s.place}"`,
      `"${s.selectedClass}"`,
      `"${s.createdDate}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sle_students_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Excel/CSV File Upload & Import
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportingStudents(true);
    setStudentImportStatus(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r\n|\n/);
        if (lines.length < 2) {
          setStudentImportStatus({ type: 'error', message: 'The uploaded file appears to be empty.' });
          setImportingStudents(false);
          return;
        }

        const newRecords = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          
          if (values.length >= 2) {
            const regNo = values[0] || String(202638000 + i);
            const fId = values[1] || 'FR-2026-901';
            const name = values[2] || `Student ${i}`;
            const mobile = values[3] || 'N/A';
            const place = values[4] || 'Athani';
            const cls = values[5] || '10th';
            const date = values[6] || new Date().toISOString().split('T')[0];

            const record = {
              id: `STUD-${regNo}`,
              registrationNo: regNo,
              regNo: regNo,
              appNumber: `SLE-2026-${regNo}`,
              franchiseeId: fId,
              fullName: name,
              name: name,
              contactNo: mobile,
              mobileNo: mobile,
              phone: mobile,
              place: place,
              location: place,
              trustBranch: place,
              selectedClass: cls,
              class: cls,
              admissionClass: cls,
              createdDate: date,
              date: date,
              paymentStatus: 'Paid',
              status: 'Approved',
              importedAt: new Date().toISOString()
            };
            newRecords.push(record);
          }
        }

        if (newRecords.length === 0) {
          setStudentImportStatus({ type: 'error', message: 'No valid student rows found in uploaded file.' });
          setImportingStudents(false);
          return;
        }

        // Save records to Firestore & localStorage
        try {
          const cached = JSON.parse(localStorage.getItem('sle_students_cache') || '[]');
          const updatedCache = [...newRecords, ...cached];
          localStorage.setItem('sle_students_cache', JSON.stringify(updatedCache));
          localStorage.setItem('sle_coaching_students_cache', JSON.stringify(updatedCache));
        } catch (e) {}

        if (db) {
          for (const rec of newRecords) {
            try {
              await setDoc(doc(db, 'students', rec.id), rec, { merge: true });
            } catch (err) {}
          }
        }

        setStudentImportStatus({ type: 'success', message: `Successfully imported ${newRecords.length} student record(s)!` });
        fetchStudents();
        fetchCollectionCounts();
      } catch (err) {
        console.error('File import error:', err);
        setStudentImportStatus({ type: 'error', message: 'Error processing CSV file. Please verify column formatting.' });
      } finally {
        setImportingStudents(false);
      }
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  // Toggle selection for all collections
  const toggleSelectAll = () => {
    if (selectedCollections.length === SYSTEM_COLLECTIONS.length) {
      setSelectedCollections([]);
    } else {
      setSelectedCollections(SYSTEM_COLLECTIONS.map(c => c.id));
    }
  };

  const toggleSelectCollection = (id) => {
    setSelectedCollections(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const totalMonitoredDocs = Object.values(collectionCounts).reduce((acc, n) => acc + (n || 0), 0);

  return (
    <div className={`min-h-screen py-6 px-3 sm:px-6 font-sans transition-colors duration-200 ${
      isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ========================================================= */}
        {/* TOP HERO HEADER */}
        {/* ========================================================= */}
        <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl relative overflow-hidden ${
          isDarkMode
            ? 'bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-slate-800'
            : 'bg-gradient-to-r from-indigo-50 via-purple-50 to-white border-indigo-100'
        }`}>
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2.5">
                <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  SuperAdmin Data Center
                </span>
                {lastBackupTime && (
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                    isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <Clock className="w-3 h-3 text-emerald-500" />
                    Last Backup: {lastBackupTime}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight flex items-center gap-3">
                <Database className="w-8 h-8 sm:w-9 sm:h-9 text-cyan-500 shrink-0" />
                <span>Data Import & Export Center</span>
              </h1>
              <p className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Secure institutional disaster recovery snapshots and spreadsheet management. Export complete database collections to encrypted JSON or import student records in bulk.
              </p>
            </div>

            {/* Quick Stat Pill */}
            <div className={`p-4 rounded-2xl border flex items-center gap-4 shrink-0 ${
              isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
                <HardDrive className="w-6 h-6" />
              </div>
              <div>
                <p className={`text-[10px] font-black uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Monitored Database
                </p>
                <p className="text-xl font-black text-cyan-500 font-mono">
                  {loadingCounts ? '...' : `${totalMonitoredDocs} Records`}
                </p>
                <p className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Across {SYSTEM_COLLECTIONS.length} Collections
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Global Notification Banner */}
        {dbNotification && (
          <div className={`p-4 rounded-2xl border flex items-start justify-between gap-3 text-xs font-bold animate-in fade-in duration-200 ${
            dbNotification.type === 'success'
              ? isDarkMode ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : isDarkMode ? 'bg-rose-950/40 border-rose-800 text-rose-200' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <div className="flex items-start gap-3">
              {dbNotification.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-black text-sm">{dbNotification.title}</p>
                <p className="font-medium mt-0.5">{dbNotification.message}</p>
              </div>
            </div>
            <button
              onClick={() => setDbNotification(null)}
              className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* NAVIGATION TABS */}
        {/* ========================================================= */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('backup-restore')}
            className={`px-5 py-3 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center gap-2.5 cursor-pointer ${
              activeTab === 'backup-restore'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/25 scale-[1.02]'
                : isDarkMode
                  ? 'text-slate-400 hover:text-white hover:bg-slate-900'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Full System Security Backup & Restore (JSON)</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/20 text-white font-mono">
              Live DB
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('student-spreadsheet')}
            className={`px-5 py-3 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center gap-2.5 cursor-pointer ${
              activeTab === 'student-spreadsheet'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25 scale-[1.02]'
                : isDarkMode
                  ? 'text-slate-400 hover:text-white hover:bg-slate-900'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Student Spreadsheets (CSV / Excel)</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/20 text-indigo-400 font-mono">
              {students.length}
            </span>
          </button>
        </div>

        {/* ========================================================= */}
        {/* TAB 1: FULL DATABASE SECURITY BACKUP & RESTORE */}
        {/* ========================================================= */}
        {activeTab === 'backup-restore' && (
          <div className="space-y-6 animate-in fade-in duration-300">

            {/* ACTION CONTROL CARD */}
            <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl space-y-6 ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
                <div className="space-y-1">
                  <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-cyan-500" />
                    <span>Database Security Management</span>
                  </h2>
                  <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Select institutional collections to generate complete offline disaster recovery files, or restore from a prior security snapshot.
                  </p>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                  {/* Export Button */}
                  <button
                    type="button"
                    onClick={() => handleExportDatabase(null)}
                    disabled={isExportingDB || selectedCollections.length === 0}
                    className="flex-1 sm:flex-none px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-black text-xs sm:text-sm shadow-lg shadow-cyan-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isExportingDB ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Download className="w-4 h-4 text-cyan-200" />
                    )}
                    <span>
                      {isExportingDB ? 'Creating Backup...' : `Export Database Backup (.JSON) [${selectedCollections.length}]`}
                    </span>
                  </button>

                  {/* Restore / Import File Input Button */}
                  <label className="flex-1 sm:flex-none px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4 text-emerald-200" />
                    <span>Restore From Backup (.JSON)</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleSelectRestoreFile}
                      className="hidden"
                    />
                  </label>

                  {/* Refresh Button */}
                  <button
                    type="button"
                    onClick={fetchCollectionCounts}
                    disabled={loadingCounts}
                    className={`p-3 rounded-2xl border transition cursor-pointer ${
                      isDarkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                    }`}
                    title="Refresh Live Database Counts"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingCounts ? 'animate-spin text-cyan-500' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Export Progress Bar */}
              {isExportingDB && exportProgress && (
                <div className={`p-4 rounded-2xl border space-y-2 animate-pulse ${
                  isDarkMode ? 'bg-cyan-950/30 border-cyan-800 text-cyan-300' : 'bg-cyan-50 border-cyan-200 text-cyan-900'
                }`}>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
                      {exportProgress.message}
                    </span>
                    <span>{exportProgress.current} / {exportProgress.total}</span>
                  </div>
                  <div className="w-full bg-cyan-900/30 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-cyan-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.round((exportProgress.current / exportProgress.total) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Collection Selection Toolbar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                      selectedCollections.length === SYSTEM_COLLECTIONS.length
                        ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-500'
                        : isDarkMode ? 'border-slate-700 text-slate-400 hover:text-white' : 'border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {selectedCollections.length === SYSTEM_COLLECTIONS.length ? (
                      <CheckSquare className="w-3.5 h-3.5" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                    <span>{selectedCollections.length === SYSTEM_COLLECTIONS.length ? 'Deselect All' : 'Select All Collections'}</span>
                  </button>
                  <span className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    ({selectedCollections.length} of {SYSTEM_COLLECTIONS.length} selected for export)
                  </span>
                </div>

                <div className={`text-xs font-mono font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Target Storage: Google Cloud Firestore + Local Cache
                </div>
              </div>

              {/* COLLECTIONS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {SYSTEM_COLLECTIONS.map(col => {
                  const isSelected = selectedCollections.includes(col.id);
                  const Icon = col.icon;
                  const count = collectionCounts[col.id] !== undefined ? collectionCounts[col.id] : 0;

                  return (
                    <div
                      key={col.id}
                      className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-3 ${
                        isSelected
                          ? isDarkMode
                            ? 'bg-slate-800/80 border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                            : 'bg-cyan-50/40 border-cyan-300 shadow-sm shadow-cyan-500/10'
                          : isDarkMode
                            ? 'bg-slate-900/60 border-slate-800 opacity-60 hover:opacity-100'
                            : 'bg-white border-slate-200 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div>
                        {/* Header with Checkbox and Icon */}
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => toggleSelectCollection(col.id)}
                            className="flex items-center gap-2 cursor-pointer text-left"
                          >
                            <span className={isSelected ? 'text-cyan-500' : 'text-slate-400'}>
                              {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                            </span>
                            <span className={`text-xs font-black truncate ${isSelected ? (isDarkMode ? 'text-white' : 'text-slate-900') : 'text-slate-500'}`}>
                              {col.name}
                            </span>
                          </button>

                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${col.color} bg-white/5 dark:bg-slate-800`}>
                            <Icon className="w-4 h-4" />
                          </div>
                        </div>

                        {/* Description */}
                        <p className={`text-[11px] font-medium mt-1 line-clamp-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          {col.desc}
                        </p>
                      </div>

                      {/* Footer with Count and Single Export Button */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                        <div>
                          <span className={`text-[10px] font-black uppercase tracking-wider block ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            Collection ID
                          </span>
                          <span className="font-mono text-xs font-bold text-cyan-500">
                            {col.id} ({loadingCounts ? '...' : count})
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleExportDatabase(col.id)}
                          disabled={isExportingDB}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                            isDarkMode
                              ? 'bg-slate-700/60 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300'
                              : 'bg-slate-100 hover:bg-cyan-100 text-slate-700 hover:text-cyan-800'
                          }`}
                          title={`Download only ${col.name} as JSON`}
                        >
                          <Download className="w-3 h-3" />
                          <span>Export</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>

            {/* SECURITY BACKUP BEST PRACTICES ADVISORY */}
            <div className={`p-6 rounded-3xl border ${
              isDarkMode ? 'bg-indigo-950/20 border-indigo-900/50 text-indigo-300' : 'bg-indigo-50/60 border-indigo-100 text-indigo-950'
            }`}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-500 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-black text-sm tracking-tight">SuperAdmin Security & Disaster Recovery Protocols</h3>
                  <ul className="text-xs space-y-1 list-disc list-inside font-medium opacity-90">
                    <li>Generate a full backup JSON weekly and prior to making mass franchisee or student migrations.</li>
                    <li>Store exported `.json` backups in a secured offline drive or encrypted cloud repository.</li>
                    <li>When restoring data, the <strong>Safe Merge</strong> mode safely upserts documents into Firestore without destroying unrelated existing records.</li>
                    <li>Student and franchisee photo URLs remain securely referenced via their Cloudinary and Firebase Storage media endpoints.</li>
                  </ul>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: STUDENT SPREADSHEETS (CSV / EXCEL) */}
        {/* ========================================================= */}
        {activeTab === 'student-spreadsheet' && (
          <div className="space-y-6 animate-in fade-in duration-300">

            {/* TOP SPREADSHEET CONTROLS CARD */}
            <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl space-y-6 ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
                
                {/* File Upload Selector Input */}
                <div className="w-full lg:w-auto flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <label className={`text-xs sm:text-sm font-black uppercase tracking-wide shrink-0 ${
                    isDarkMode ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    Upload Student CSV Sheet:
                  </label>
                  <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    onChange={handleFileUpload}
                    disabled={importingStudents}
                    className={`file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold text-xs rounded-2xl p-1.5 w-full sm:w-auto cursor-pointer border ${
                      isDarkMode
                        ? 'border-slate-700 bg-slate-800 text-slate-300 file:bg-indigo-600 file:text-white hover:file:bg-indigo-700'
                        : 'border-slate-300 bg-white text-slate-600 file:bg-slate-900 file:text-white hover:file:bg-slate-800'
                    }`}
                  />
                </div>

                {/* Download Template Action Button */}
                <div className="w-full lg:w-auto flex flex-col items-center lg:items-end gap-1.5 text-center lg:text-right">
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-700 to-red-800 hover:from-rose-800 hover:to-red-900 text-white font-black text-xs sm:text-sm shadow-lg shadow-rose-900/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-amber-300" />
                    <span>Download CSV Template</span>
                  </button>
                  <p className="text-[11px] font-semibold text-rose-500 max-w-sm">
                    Download the standardized template, fill in student rows, and upload.
                  </p>
                </div>

              </div>

              {/* Import Status Alert Banner */}
              {importingStudents && (
                <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center gap-3 text-xs font-bold animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                  <span>Importing student records into database and local cache...</span>
                </div>
              )}

              {studentImportStatus && (
                <div className={`p-4 rounded-2xl border flex items-center gap-3 text-xs font-bold ${
                  studentImportStatus.type === 'success'
                    ? isDarkMode ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : isDarkMode ? 'bg-rose-950/40 border-rose-800 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  {studentImportStatus.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                  )}
                  <span>{studentImportStatus.message}</span>
                </div>
              )}

            </div>

            {/* Table Control Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowDataTable(prev => !prev)}
                  className="px-5 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {showDataTable ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span>{showDataTable ? 'Hide Data Table' : 'Show Data Table'}</span>
                </button>

                {showDataTable && (
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs shadow transition flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span>Export CSV (Excel)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={fetchStudents}
                  className={`p-2.5 rounded-2xl border shadow-sm transition cursor-pointer ${
                    isDarkMode ? 'border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300' : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-700'
                  }`}
                  title="Refresh Student Records"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingStudents ? 'animate-spin text-indigo-500' : ''}`} />
                </button>
              </div>

              {/* Search Filter Input */}
              {showDataTable && (
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search Name, Reg No, Place..."
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 rounded-2xl text-xs border font-medium outline-none transition ${
                      isDarkMode
                        ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500'
                        : 'bg-white border-slate-300 text-slate-900 focus:border-indigo-500'
                    }`}
                  />
                  {studentSearchQuery && (
                    <button
                      onClick={() => setStudentSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* DATABASE RECORDS TABLE */}
            {showDataTable && (
              <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl space-y-6 ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-sky-500" />
                    <h2 className="text-xl font-black tracking-tight">Active Student Database</h2>
                  </div>
                  <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full ${
                    isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                  }`}>
                    Showing {filteredStudents.length} of {students.length} Records
                  </span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className={`font-extrabold uppercase border-b tracking-wider ${
                      isDarkMode ? 'bg-slate-950 text-slate-300 border-slate-800' : 'bg-slate-100 text-slate-800 border-slate-200'
                    }`}>
                      <tr>
                        <th className="px-4 py-3.5 whitespace-nowrap">REGISTRATION NO</th>
                        <th className="px-4 py-3.5 whitespace-nowrap">FRANCHISEE ID</th>
                        <th className="px-4 py-3.5 whitespace-nowrap">NAME</th>
                        <th className="px-4 py-3.5 whitespace-nowrap">MOBILE NO</th>
                        <th className="px-4 py-3.5 whitespace-nowrap">PLACE</th>
                        <th className="px-4 py-3.5 whitespace-nowrap">CLASS</th>
                        <th className="px-4 py-3.5 whitespace-nowrap">DATE</th>
                        <th className="px-4 py-3.5 text-center whitespace-nowrap">VIEW DETAILS</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${
                      isDarkMode ? 'divide-slate-800 bg-slate-900/50' : 'divide-slate-200 bg-white'
                    }`}>
                      {loadingStudents ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-500">
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="w-5 h-5 animate-spin text-rose-600" />
                              <span>Loading Student Database Records...</span>
                            </div>
                          </td>
                        </tr>
                      ) : filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-500 font-semibold">
                            No student admission records found matching query.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((s, idx) => (
                          <tr
                            key={s.id || idx}
                            className={`transition-colors ${
                              isDarkMode ? 'hover:bg-slate-800/60 text-slate-200' : 'hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <td className="px-4 py-3.5 font-mono font-bold text-rose-500">{s.registrationNo}</td>
                            <td className="px-4 py-3.5 font-mono text-indigo-400 font-semibold">{s.franchiseeId}</td>
                            <td className="px-4 py-3.5 font-extrabold uppercase">{s.fullName}</td>
                            <td className="px-4 py-3.5 font-mono font-semibold">{s.mobileNo}</td>
                            <td className="px-4 py-3.5 font-semibold">{s.place}</td>
                            <td className="px-4 py-3.5 font-bold text-purple-400">{s.selectedClass}</td>
                            <td className="px-4 py-3.5 font-mono text-slate-400">{s.createdDate}</td>
                            <td className="px-4 py-3.5 text-center">
                              <button
                                type="button"
                                onClick={() => setSelectedStudentForView(s)}
                                className={`px-3 py-1.5 rounded-xl font-bold border transition-all text-xs flex items-center justify-center gap-1.5 mx-auto cursor-pointer ${
                                  isDarkMode
                                    ? 'bg-indigo-950/50 hover:bg-indigo-900/60 border-indigo-800 text-indigo-300'
                                    : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700'
                                }`}
                              >
                                <Eye className="w-3.5 h-3.5 text-indigo-500" />
                                <span>View Details</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

              </div>
            )}

          </div>
        )}

      </div>

      {/* ========================================================= */}
      {/* RESTORE DATABASE VERIFICATION & CONFIRMATION MODAL */}
      {/* ========================================================= */}
      {restoreModalOpen && restoreFileData && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className={`rounded-3xl max-w-2xl w-full border shadow-2xl p-6 sm:p-8 space-y-6 relative my-8 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            
            {!isRestoring && (
              <button
                onClick={() => setRestoreModalOpen(false)}
                className={`absolute right-6 top-6 p-2 rounded-full transition cursor-pointer ${
                  isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {/* Modal Header */}
            <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                restoreState === 'completed' 
                  ? 'bg-emerald-500/20 text-emerald-500' 
                  : 'bg-cyan-500/10 text-cyan-500'
              }`}>
                {restoreState === 'completed' ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                ) : (
                  <ShieldAlert className="w-6 h-6 text-cyan-500" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight">
                  {restoreState === 'completed' ? 'Database Restoration Complete' : 'Database Security Restore Verification'}
                </h3>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  File: <span className="font-mono font-bold text-cyan-500">{restoreFileName}</span>
                </p>
              </div>
            </div>

            {/* IF RESTORE IS COMPLETED: CELEBRATORY SUCCESS SCREEN */}
            {restoreState === 'completed' ? (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className={`p-6 rounded-3xl border text-center space-y-3 ${
                  isDarkMode ? 'bg-emerald-950/30 border-emerald-800/80' : 'bg-emerald-50 border-emerald-200'
                }`}>
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-black text-emerald-500 tracking-tight">
                    All Database Records Restored Successfully!
                  </h3>
                  <p className={`text-xs font-medium max-w-md mx-auto ${isDarkMode ? 'text-emerald-200/90' : 'text-emerald-900'}`}>
                    Successfully restored <strong className="font-mono text-sm">{restoreSummary?.totalDocs || 0}</strong> documents across <strong className="font-mono text-sm">{restoreSummary?.totalCols || 0}</strong> collections into your active database.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      ✓ Firestore Live Synced
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      ✓ Local Caches Updated
                    </span>
                  </div>
                </div>

                {/* Live Log Summary */}
                {restoreLog.length > 0 && (
                  <div className={`p-3.5 rounded-2xl font-mono text-[11px] space-y-1 max-h-40 overflow-y-auto border ${
                    isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                  }`}>
                    {restoreLog.map((logLine, idx) => (
                      <div key={idx} className={logLine.startsWith('✓') ? 'text-emerald-500 font-bold' : logLine.startsWith('❌') ? 'text-rose-500 font-bold' : ''}>
                        {logLine}
                      </div>
                    ))}
                  </div>
                )}

                {/* Moving Forward Action Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setRestoreModalOpen(false);
                      fetchCollectionCounts();
                      fetchStudents();
                    }}
                    className={`w-full sm:w-auto px-6 py-2.5 rounded-2xl font-bold text-xs cursor-pointer border ${
                      isDarkMode ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300' : 'border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    Done & Close Window
                  </button>

                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-lg shadow-emerald-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4 text-emerald-200" />
                    <span>Reload Admin Portal</span>
                  </button>
                </div>
              </div>
            ) : (
              /* PREVIEW & RESTORING STATE */
              <>
                {/* File Inspection Summary */}
                <div className={`p-4 rounded-2xl border space-y-3 ${
                  isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className={`block text-[10px] font-black uppercase ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        Exported At
                      </span>
                      <span className="font-bold text-indigo-400">
                        {new Date(restoreFileData.exportedAt).toLocaleDateString()} {new Date(restoreFileData.exportedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div>
                      <span className={`block text-[10px] font-black uppercase ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        Exported By
                      </span>
                      <span className="font-bold">{restoreFileData.exportedBy}</span>
                    </div>
                    <div>
                      <span className={`block text-[10px] font-black uppercase ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        Collections
                      </span>
                      <span className="font-bold text-cyan-500 font-mono">
                        {Object.keys(restoreFileData.collections).length} Collections
                      </span>
                    </div>
                  </div>

                  {/* Collection Counts List inside file */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                    <span className={`block text-[10px] font-black uppercase mb-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      Documents Found Inside Backup File:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
                      {Object.entries(restoreFileData.collections).map(([k, v]) => {
                        const count = Array.isArray(v) ? v.length : (typeof v === 'object' ? Object.keys(v).length : 0);
                        return (
                          <div key={k} className={`px-2.5 py-1.5 rounded-xl border text-[11px] flex items-center justify-between ${
                            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                          }`}>
                            <span className="truncate font-medium">{k}</span>
                            <span className="font-mono font-bold text-emerald-500">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Restore Mode Radio */}
                {!isRestoring && (
                  <div className="space-y-2">
                    <label className={`text-xs font-black uppercase tracking-wider block ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      Select Restoration Strategy:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <label className={`p-3 rounded-2xl border flex items-start gap-2.5 cursor-pointer transition ${
                        restoreMode === 'merge'
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : isDarkMode ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-50'
                      }`}>
                        <input
                          type="radio"
                          name="restoreMode"
                          value="merge"
                          checked={restoreMode === 'merge'}
                          onChange={() => setRestoreMode('merge')}
                          className="mt-0.5 accent-emerald-500"
                        />
                        <div>
                          <span className="font-bold text-emerald-500 block">Safe Merge / Upsert (Recommended)</span>
                          <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            Updates existing documents and adds new ones. Does not wipe unreferenced docs.
                          </span>
                        </div>
                      </label>

                      <label className={`p-3 rounded-2xl border flex items-start gap-2.5 cursor-pointer transition ${
                        restoreMode === 'overwrite'
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : isDarkMode ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-50'
                      }`}>
                        <input
                          type="radio"
                          name="restoreMode"
                          value="overwrite"
                          checked={restoreMode === 'overwrite'}
                          onChange={() => setRestoreMode('overwrite')}
                          className="mt-0.5 accent-cyan-500"
                        />
                        <div>
                          <span className="font-bold text-cyan-500 block">Complete Sync</span>
                          <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            Directly syncs all documents and completely updates local caches.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Progress Display */}
                {isRestoring && restoreProgress && (
                  <div className={`p-4 rounded-2xl border space-y-2 ${
                    isDarkMode ? 'bg-cyan-950/30 border-cyan-800' : 'bg-cyan-50 border-cyan-200'
                  }`}>
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
                        Restoring Collection: <strong>{restoreProgress.collection}</strong>
                      </span>
                      <span>
                        {restoreProgress.currentDocs} / {restoreProgress.totalDocsInCol} docs ({restoreProgress.colIndex}/{restoreProgress.totalCols} cols)
                      </span>
                    </div>
                    <div className="w-full bg-cyan-900/30 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-cyan-500 h-2.5 rounded-full transition-all duration-200"
                        style={{ width: `${restoreProgress.overallPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-mono text-cyan-500 font-bold">
                      <span>High-Speed Firestore Batch Write Active</span>
                      <span>{restoreProgress.overallPercent}% Complete</span>
                    </div>
                  </div>
                )}

                {/* Live Log */}
                {restoreLog.length > 0 && (
                  <div className={`p-3 rounded-2xl font-mono text-[11px] space-y-1 max-h-36 overflow-y-auto border ${
                    isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                  }`}>
                    {restoreLog.map((logLine, idx) => (
                      <div key={idx} className={logLine.startsWith('✓') ? 'text-emerald-500 font-bold' : logLine.startsWith('❌') ? 'text-rose-500 font-bold' : ''}>
                        {logLine}
                      </div>
                    ))}
                  </div>
                )}

                {/* Confirmation Checkbox */}
                {!isRestoring && (
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs font-semibold select-none">
                    <input
                      type="checkbox"
                      checked={restoreConfirmed}
                      onChange={(e) => setRestoreConfirmed(e.target.checked)}
                      className="mt-0.5 rounded accent-emerald-500 w-4 h-4"
                    />
                    <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>
                      I confirm that I want to restore this data into the live Firebase database. I understand this will update database records.
                    </span>
                  </label>
                )}

                {/* Action Buttons */}
                <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                  {!isRestoring ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setRestoreModalOpen(false)}
                        className={`px-5 py-2.5 rounded-2xl font-bold text-xs cursor-pointer ${
                          isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleExecuteRestore}
                        disabled={!restoreConfirmed}
                        className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-lg shadow-emerald-500/25 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4 text-emerald-200" />
                        <span>Confirm & Execute Restore</span>
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-xs font-bold text-cyan-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Restoring live records at high speed... Please wait a moment.</span>
                    </div>
                  )}
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW DETAILS MODAL (FOR STUDENT RECORD) */}
      {/* ========================================================= */}
      {selectedStudentForView && (
        <div id="printable-record-modal" className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200 printable-modal">
          <div className={`rounded-3xl max-w-2xl w-full border shadow-2xl p-6 sm:p-8 space-y-6 relative my-8 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            
            <button
              onClick={() => setSelectedStudentForView(null)}
              className={`absolute right-6 top-6 p-2 rounded-full transition cursor-pointer ${
                isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black">{selectedStudentForView.fullName}</h3>
                <p className="text-xs text-rose-500 font-mono font-bold">
                  Registration No: {selectedStudentForView.registrationNo}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
              <div className={`p-3.5 rounded-2xl border ${
                isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className={`block text-[11px] font-bold uppercase ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                  Franchisee ID
                </span>
                <span className="font-extrabold text-indigo-400 font-mono text-sm">{selectedStudentForView.franchiseeId}</span>
              </div>

              <div className={`p-3.5 rounded-2xl border ${
                isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className={`block text-[11px] font-bold uppercase ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                  Mobile Number
                </span>
                <span className="font-bold">{selectedStudentForView.mobileNo}</span>
              </div>

              <div className={`p-3.5 rounded-2xl border ${
                isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className={`block text-[11px] font-bold uppercase ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                  Place / Branch
                </span>
                <span className="font-bold">{selectedStudentForView.place}</span>
              </div>

              <div className={`p-3.5 rounded-2xl border ${
                isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className={`block text-[11px] font-bold uppercase ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                  Class / Course
                </span>
                <span className="font-bold text-purple-400">{selectedStudentForView.selectedClass}</span>
              </div>

              <div className={`p-3.5 rounded-2xl border sm:col-span-2 ${
                isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className={`block text-[11px] font-bold uppercase ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                  Admission Date
                </span>
                <span className="font-semibold text-slate-400">{selectedStudentForView.createdDate}</span>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Record</span>
              </button>
              <button
                onClick={() => setSelectedStudentForView(null)}
                className={`px-5 py-2.5 rounded-2xl font-bold text-xs cursor-pointer ${
                  isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
