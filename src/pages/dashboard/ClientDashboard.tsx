import {
  CreditCard,
  History,
  LogOut,
  Receipt,
  Send,
  User,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import AppLayout from '../../components/layout/AppLayout';

export default function ClientDashboard() {
  const { user, signOut } = useAuth();

  return (
    <AppLayout
      title="Espace Client — Ets AMANI"
      subtitle="Consultation de vos transactions, transferts et paiements"
      activeItem="dashboard"
    >
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-950 p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white font-black text-xl">
                <User className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                  Bienvenue, {user?.displayName}
                </h1>
                <p className="mt-1 text-sm text-slate-300">
                  Compte Client certifié Ets AMANI • Accès guichet & services de change
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => signOut()}
              className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20 self-start lg:self-center"
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Dernières Opérations</h2>
                <p className="text-xs text-slate-500">Historique de vos opérations au guichet</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 py-6 text-center">
              Aucune opération récente enregistrée.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Services Disponibles</h2>
                <p className="text-xs text-slate-500">Présentez-vous en agence pour vos transactions</p>
              </div>
            </div>
            <ul className="text-xs space-y-2 text-slate-600">
              <li className="p-3 bg-slate-50 rounded-xl">✓ Change manuel devises USD / CDF</li>
              <li className="p-3 bg-slate-50 rounded-xl">✓ Dépôts et retraits Mobile Money</li>
              <li className="p-3 bg-slate-50 rounded-xl">✓ Transferts inter-agences sécurisés</li>
            </ul>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
