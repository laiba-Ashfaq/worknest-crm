import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';

import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { LeadsPage } from './pages/LeadsPage';
import { RecoveryQueuePage } from './pages/RecoveryQueuePage';
import { PipelineBoardPage } from './pages/PipelineBoardPage';
import { ContactsPage } from './pages/ContactsPage';
import { ConversationsPage } from './pages/ConversationsPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { TeamPage } from './pages/TeamPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { AuditHistoryPage } from './pages/AuditHistoryPage';
import { PublicLeadFormPage } from './pages/PublicLeadFormPage';

const queryClient = new QueryClient();

// Protected Route wrapper ensuring valid authentication session
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-whitepace-navy" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Marketing & Client Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/public/lead/:slug" element={<PublicLeadFormPage />} />

            {/* Authenticated Workspace Application Routes */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/leads" element={<LeadsPage />} />
              <Route path="/recovery" element={<RecoveryQueuePage />} />
              <Route path="/pipeline" element={<PipelineBoardPage />} />
              <Route path="/contacts" element={<ContactsPage />} />
              <Route path="/conversations" element={<ConversationsPage />} />
              <Route path="/appointments" element={<AppointmentsPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/team" element={<TeamPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/audit" element={<AuditHistoryPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};
