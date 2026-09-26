import { useState } from 'react';
import {
  Clock,
  LogOut,
  Phone,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function ApprovalPendingPage() {
  const { user, signOut, refreshUser, logout } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Action : Rafraîchir le statut et vérifier les droits
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      if (refreshUser) {
        await refreshUser();
      } else {
        window.location.reload();
        return;
      }

      const isPrivileged =
        user?.role === 'administrateur_systeme' || user?.role === 'directeur_general';

      const isAccountApproved =
        user?.isApproved && (user?.status === 'active' || user?.status === 'approved');

      if (isPrivileged || isAccountApproved) {
        window.location.href = '/';
      } else {
        alert("Votre compte n'a pas encore été validé par la Direction.");
      }
    } catch (err) {
      console.error('[Ets AMANI] Erreur lors du rafraîchissement :', err);
      window.location.reload();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Action : Déconnexion forcée et nettoyage total
  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      if (signOut) {
        await signOut();
      } else if (logout) {
        await logout();
      }
    } catch (err) {
      console.warn('[Ets AMANI] Erreur déconnexion Firebase :', err);
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login';
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-8 ring-amber-50/50">
          <Clock className="h-8 w-8" />
        </div>

        <h1 className="mt-6 text-xl font-bold text-slate-900">
          Validation en attente
        </h1>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Votre compte (<strong>{user?.displayName || user?.email || 'Enregistré'}</strong>) a été enregistré avec succès. Pour des raisons réglementaires et de sécurité des opérations financières, l'activation finale doit être approuvée par la Direction ou l'Administrateur de votre agence.
        </p>

        <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-xs text-left space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-400">Rôle demandé :</span>
            <span className="font-bold text-slate-800 uppercase">{user?.role || 'Non spécifié'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Agence :</span>
            <span className="font-bold text-slate-800">{user?.agencyId || 'Non assignée'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Statut :</span>
            <span className="font-bold text-amber-600">En cours d'examen</span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Vérification...' : 'Vérifier à nouveau'}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            {isLoggingOut ? 'Déconnexion...' : 'Se déconnecter'}
          </button>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-4 flex items-center justify-center gap-2 text-[11px] text-slate-400">
          <Phone className="h-3.5 w-3.5" />
          <span>Assistance Ets AMANI : +243 992 294 852</span>
        </div>
      </div>
    </div>
  );
}
