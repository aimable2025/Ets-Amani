import { useEffect } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { getDashboardRoute } from './utils/roleRedirect';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ApprovalPendingPage from './pages/dashboard/ApprovalPendingPage';
import AdministrateurSystemeDashboard from './pages/dashboard/AdministrateurSystemeDashboard';
import DirecteurGeneralDashboard from './pages/dashboard/DirecteurGeneralDashboard';
import AdministrateurAgenceDashboard from './pages/dashboard/AdministrateurAgenceDashboard';
import AgentDashboard from './pages/dashboard/AgentDashboard';
import ClientDashboard from './pages/dashboard/ClientDashboard';
import AbonneDashboard from './pages/dashboard/AbonneDashboard';
import { startSyncWorker } from './services/SyncWorker';
import { startSmsSyncWorker } from './services/SmsOperationService';

function HomeRedirect() {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
          <p className="text-sm font-semibold text-slate-700">Initialisation d'Ets AMANI...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && user) {
    return <Navigate to={getDashboardRoute(user)} replace />;
  }

  return <LoginPage />;
}

function AppRoutes() {
  useEffect(() => {
    // Démarrage des workers de synchronisation Offline-First
    const stopSyncWorker = startSyncWorker();
    const stopSmsWorker = startSmsSyncWorker();

    return () => {
      stopSyncWorker();
      stopSmsWorker();
    };
  }, []);

  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/validation-en-attente" element={<ApprovalPendingPage />} />

      {/* Rôles & Tableaux de bord */}
      <Route
        path="/dashboard/administrateur-systeme"
        element={
          <ProtectedRoute>
            <AdministrateurSystemeDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/directeur-general"
        element={
          <ProtectedRoute>
            <DirecteurGeneralDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/administrateur-agence"
        element={
          <ProtectedRoute>
            <AdministrateurAgenceDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/agent"
        element={
          <ProtectedRoute>
            <AgentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/client"
        element={
          <ProtectedRoute>
            <ClientDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/abonne"
        element={
          <ProtectedRoute>
            <AbonneDashboard />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
