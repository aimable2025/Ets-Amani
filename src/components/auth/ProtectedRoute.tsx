import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const {
    isLoading,
    isAuthenticated,
    user,
    canAccessProtectedModules,
  } = useAuth();
  const location = useLocation();

  // 1. En cours de chargement
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-400">Vérification de votre session...</p>
        </div>
      </div>
    );
  }

  // 2. Non authentifié -> Redirection Login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Compte en attente d'approbation
  if (!user.isApproved) {
    return <Navigate to="/validation-en-attente" replace />;
  }

  // 4. Inéligible aux modules protégés
  if (!canAccessProtectedModules) {
    return <Navigate to="/validation-en-attente" replace />;
  }

  // 5. Validation stricte du rôle (RBAC par route)
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
