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

// Redirection intelligente pour la racine
function HomeRedirect() {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-400">Initialisation d'Ets AMANI...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && user) {
    if (!user.isApproved) {
      return <Navigate to="/validation-en-attente" replace />;
    }
    return <Navigate to={getDashboardRoute(user.role)} replace />;
  }

  return <Navigate to="/login" replace />;
}

// Composant pour empêcher un utilisateur connecté d'accéder aux pages /login ou /register
function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) return null;

  if (isAuthenticated && user) {
    if (!user.isApproved) {
      return <Navigate to="/validation-en-attente" replace />;
    }
    return <Navigate to={getDashboardRoute(user.role)} replace />;
  }

  return <>{children}</>;
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
      {/* Route Racine */}
      <Route path="/" element={<HomeRedirect />} />

      {/* Routes Publiques (uniquement si NON connecté) */}
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />

      {/* Route de validation en attente */}
      <Route path="/validation-en-attente" element={<ApprovalPendingPage />} />

      {/* Rôles & Tableaux de bord avec contrôles RBAC stricts */}
      <Route
        path="/dashboard/administrateur-systeme"
        element={
          <ProtectedRoute allowedRoles={['administrateur_systeme']}>
            <AdministrateurSystemeDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/directeur-general"
        element={
          <ProtectedRoute allowedRoles={['directeur_general']}>
            <DirecteurGeneralDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/administrateur-agence"
        element={
          <ProtectedRoute allowedRoles={['administrateur_agence']}>
            <AdministrateurAgenceDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/agent"
        element={
          <ProtectedRoute allowedRoles={['agent']}>
            <AgentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/client"
        element={
          <ProtectedRoute allowedRoles={['client']}>
            <ClientDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/abonne"
        element={
          <ProtectedRoute allowedRoles={['abonne']}>
            <AbonneDashboard />
          </ProtectedRoute>
        }
      />

      {/* Catch-all pour les URL inconnues */}
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
