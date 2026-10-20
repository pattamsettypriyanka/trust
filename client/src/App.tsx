import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { Layout } from './components/Layout.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { MyDocumentsPage } from './pages/MyDocumentsPage.js';
import { SharedWithMePage } from './pages/SharedWithMePage.js';
import { UploadPage } from './pages/UploadPage.js';
import { DocumentDetailsPage } from './pages/DocumentDetailsPage.js';
import { ManagePermissionsPage } from './pages/ManagePermissionsPage.js';
import { DocumentActivityPage } from './pages/DocumentActivityPage.js';
import { AdminAuditPage } from './pages/AdminAuditPage.js';
import { AdminUsersPage } from './pages/AdminUsersPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { AccessDeniedPage } from './pages/AccessDeniedPage.js';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route path="/" element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="my-documents" element={<MyDocumentsPage />} />
            <Route path="shared-with-me" element={<SharedWithMePage />} />
            <Route path="upload" element={<UploadPage />} />
            <Route path="documents/:id" element={<DocumentDetailsPage />} />
            <Route path="documents/:id/permissions" element={<ManagePermissionsPage />} />
            <Route path="documents/:id/activity" element={<DocumentActivityPage />} />
            <Route path="admin/audit" element={<AdminAuditPage />} />
            <Route path="admin/users" element={<AdminUsersPage />} />
            <Route path="access-denied" element={<AccessDeniedPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};
