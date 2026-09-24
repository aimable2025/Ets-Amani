import {
  CreditCard,
  LogOut,
  Receipt,
  ShieldCheck,
  Smartphone,
  Star,
  User,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import AppLayout from '../../components/layout/AppLayout';

export default function AbonneDashboard() {
  const { user, signOut } = useAuth();

  return (
    <AppLayout
      title="Espace Abonné Privilégié — Ets AMANI"
      subtitle="Compte Partenaire & facilitation des transferts de fonds"
      activeItem="dashboard"
    >
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-purple-500 text-white font-black text-xl shadow-lg shadow-purple-500/20">
                <Star className="h-8 w-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                    Espace Abonné
                  </h1>
                  <span className="rounded-full bg-purple-400/20 px-2.5 py-0.5 text-xs font-bold text-purple-300">
                    Partenaire VIP
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-300">
                  Titulaire : <strong>{user?.displayName}</strong> • Agence de rattachement :{' '}
                  <span className="font-semibold">{user?.agencyId || 'Centrale'}</span>
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
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Avantages Abonné</h2>
                <p className="text-xs text-slate-500">Conditions préférentielles sur le réseau</p>
              </div>
            </div>
            <ul className="text-xs space-y-2 text-slate-600">
              <li className="p-3 bg-slate-50 rounded-xl">★ Taux de change préférentiels négociés</li>
              <li className="p-3 bg-slate-50 rounded-xl">★ Traitement prioritaire au guichet de votre agence</li>
              <li className="p-3 bg-slate-50 rounded-xl">★ Ligne directe avec le responsable d'agence</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Activité Récente</h2>
                <p className="text-xs text-slate-500">Mouvements de fonds enregistrés</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 py-6 text-center">
              Aucun mouvement récent enregistré sur votre compte abonné.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
