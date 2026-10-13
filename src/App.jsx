import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import { transferShurapurToShahapur } from './utils/studentTransfer';
import { restoreShahapurBranch } from './utils/branchManager';
import ApplicationForm from './pages/ApplicationForm';
import CoachingPrograms from './pages/CoachingPrograms';
import CoachingAdmissionForm from './pages/CoachingAdmissionForm';
import CoachingStudentsList from './pages/CoachingStudentsList';
import OfficialFormsPage from './pages/OfficialFormsPage';
import DownloadCenterPage from './pages/DownloadCenterPage';
import DownloadableForms from './pages/DownloadableForms';
import ResourceCenter from './pages/ResourceCenter';
import CandidateTracker from './pages/CandidateTracker';
import LoginPage from './pages/LoginPage';
import AdminPortal from './pages/AdminPortal';
import OnlineExamPortal from './pages/OnlineExamPortal';

import LandingPage from './pages/LandingPage';
import StudentVerificationPage from './pages/StudentVerificationPage';
import TransactionsPage from './pages/TransactionsPage';
import CertificateAdmissionForm from './pages/CertificateAdmissionForm';
import CertificatePage from './pages/CertificatePage';
import CertificateStudentList from './pages/CertificateStudentList';
import AboutUsPage from './pages/AboutUsPage';

// Protected Route Wrapper - Requires Portal Login before displaying main pages
function ProtectedRoute({ children }) {
  const isLoggedIn = localStorage.getItem('sle_portal_user') === 'true' || localStorage.getItem('sle_admin_demo') === 'true';
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export default function App() {
  useEffect(() => {
    // Automatically restore Shahapur branch and associated data if deleted
    restoreShahapurBranch();
    // Automatically transfer any Shurapur / Shorapur student records to Shahapur across local cache and Firestore
    transferShurapurToShahapur();
  }, []);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-rose-500 selection:text-white">
        
        {/* Sticky Light Glassmorphism Header Bar */}
        <Header />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          <Routes>
            {/* Public Landing, Auth & Student Exam Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/about" element={<AboutUsPage />} />
            <Route path="/about-us" element={<AboutUsPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/student-login" element={<LoginPage />} />
            <Route path="/admin" element={<AdminPortal />} />
            <Route path="/exam/:examId" element={<OnlineExamPortal />} />
            <Route path="/exam" element={<OnlineExamPortal />} />
            <Route path="/student/:admissionNo" element={<StudentVerificationPage />} />
            <Route path="/verify/:admissionNo" element={<StudentVerificationPage />} />
            <Route path="/verify" element={<StudentVerificationPage />} />


            {/* Publicly Accessible Admission & Certificate Routes */}
            <Route path="/application-form" element={<ApplicationForm />} />
            <Route path="/certificate/admission-form" element={<CertificateAdmissionForm />} />
            <Route path="/certificate" element={<CertificatePage />} />
            <Route path="/certificate/student-list" element={<CertificateStudentList />} />

            {/* Protected Portal Routes - Visible ONLY AFTER PORTAL LOGIN */}
            <Route path="/coaching" element={<ProtectedRoute><CoachingPrograms /></ProtectedRoute>} />
            <Route path="/coaching/admission-form" element={<ApplicationForm />} />
            <Route path="/coaching-admission" element={<ApplicationForm />} />
            <Route path="/coaching/list" element={<ProtectedRoute><CoachingStudentsList /></ProtectedRoute>} />
            <Route path="/coaching-list" element={<ProtectedRoute><CoachingStudentsList /></ProtectedRoute>} />
            <Route path="/forms" element={<ProtectedRoute><OfficialFormsPage /></ProtectedRoute>} />
            <Route path="/forms/exam" element={<ProtectedRoute><OfficialFormsPage /></ProtectedRoute>} />
            <Route path="/forms/certificate" element={<ProtectedRoute><OfficialFormsPage /></ProtectedRoute>} />
            <Route path="/forms/marksheet" element={<ProtectedRoute><OfficialFormsPage /></ProtectedRoute>} />
            <Route path="/downloads" element={<ProtectedRoute><DownloadCenterPage /></ProtectedRoute>} />
            <Route path="/downloads/hall-ticket" element={<ProtectedRoute><DownloadCenterPage /></ProtectedRoute>} />
            <Route path="/downloads/certificate" element={<ProtectedRoute><DownloadCenterPage /></ProtectedRoute>} />
            <Route path="/downloads/marksheet" element={<ProtectedRoute><DownloadCenterPage /></ProtectedRoute>} />
            <Route path="/list" element={<ProtectedRoute><CoachingStudentsList /></ProtectedRoute>} />
            <Route path="/list/students" element={<ProtectedRoute><CoachingStudentsList /></ProtectedRoute>} />
            <Route path="/list/approved" element={<ProtectedRoute><CoachingStudentsList /></ProtectedRoute>} />
            <Route path="/list/passed" element={<ProtectedRoute><CoachingStudentsList /></ProtectedRoute>} />
            <Route path="/list/certificate-forms" element={<ProtectedRoute><CoachingStudentsList /></ProtectedRoute>} />
            <Route path="/list/marksheet-forms" element={<ProtectedRoute><CoachingStudentsList /></ProtectedRoute>} />
            <Route path="/list/result" element={<ProtectedRoute><CoachingStudentsList /></ProtectedRoute>} />
            <Route path="/import-export" element={<Navigate to="/admin" replace />} />
            <Route path="/importexport" element={<Navigate to="/admin" replace />} />
            <Route path="/transactions" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />
            <Route path="/payment-history" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </main>

      </div>
    </BrowserRouter>
  );
}
