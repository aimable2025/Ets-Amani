import {
  Activity,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  History,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
  WalletCards,
  Wifi,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AppLayout from '../../components/layout/AppLayout';
import DashboardModuleCard from '../../components/dashboard/DashboardModuleCard';
import DashboardModuleGrid from '../../components/dashboard/DashboardModuleGrid';
import BilletageModule from './components/BilletageModule';
import OperationModule from './components/OperationModule';
import AgentManagementModule from './components/AgentManagementModule';
import RegistrationRequestsModule from './components/RegistrationRequestsModule';
import ConnectivityModule from './components/ConnectivityModule';
import { db } from '../../lib/db';
import { getAgencyUsers } from '../../services/AgencyUserService';

type ModuleId = 'billetage' | 'operations' | 'agents' | 'registrations' | 'connectivity';

export default function AdministrateurAgenceDashboard() {
  const { user, signOut } = useAuth();
  const [activeModule, setActiveModule] = useState<ModuleId | null>(null);

  const agencyName = user?.agencyId || 'Agence Centrale';

  const [totalUsd, setTotalUsd] = useState(0);
  const [totalCdf, setTotalCdf] = useState(0);
  const [activeAgentsCount, setActiveAgentsCount] = useState(0);
  const [activeOperationsCount, setActiveOperationsCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadStats() {
      try {
        const agencyId = user?.agencyId;

        // 1. Caisse Locale : cumul des montants de billetage
        const billetages = await db.billetages.toArray();
        const agencyBilletages = agencyId
          ? billetages.filter((b) => b.agencyId === agencyId)
          : billetages;

        let usdSum = 0;
        let cdfSum = 0;
        agencyBilletages.forEach((b) => {
          const amount = b.calculatedTotal || b.declaredAmount || 0;
          if (b.currency === 'USD') usdSum += amount;
          if (b.currency === 'CDF') cdfSum += amount;
        });

        // 2. Missions en cours
        const ops = await db.operations.toArray();
        const agencyOps = ops.filter(
          (o) =>
            (!agencyId || o.agencyId === agencyId) &&
            (o.status === 'en_cours' || o.status === 'cree' || o.status === 'assigne')
        );

        // 3. Agents actifs de l'agence
        let agentsCount = 0;
        if (agencyId) {
          const agencyUsers = await getAgencyUsers(agencyId);
          agentsCount = agencyUsers.filter((u) => u.status === 'active' && u.role === 'agent').length;
        }

        if (isMounted) {
          setTotalUsd(usdSum);
          setTotalCdf(cdfSum);
          setActiveOperationsCount(agencyOps.length);
          setActiveAgentsCount(agentsCount);
        }
      } catch (err) {
        console.warn('[Ets AMANI] Erreur chargement statistiques agence :', err);
      }
    }

    void loadStats();
    const interval = setInterval(loadStats, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user?.agencyId]);

  return (
    <AppLayout
      title={`Administration — ${agencyName}`}
      subtitle="Gestion opérationnelle, caisse locale et affectation des agents"
      activeItem="dashboard"
    >
      <div className="space-y-6">
        {/* Banner Admin Agence */}
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white font-black text-xl shadow-lg shadow-blue-600/30">
                <Building2 className="h-8 w-8" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                    Administration d'Agence
                  </h1>
                  <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-bold text-blue-300 ring-1 ring-blue-500/30">
                    {agencyName}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-300">
                  Responsable : <strong>{user?.displayName}</strong> • Supervision des agents et des caisses de l'agence.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveModule('billetage')}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-md hover:bg-emerald-400"
              >
                <Coins className="h-4 w-4" />
                Billetage de Caisse
              </button>
              <button
                type="button"
                onClick={() => setActiveModule('operations')}
                className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20"
              >
                <ClipboardCheck className="h-4 w-4" />
                Missions Agence
              </button>
              <button
                type="button"
                onClick={() => signOut()}
                className="flex items-center gap-2 rounded-xl bg-red-500/20 px-4 py-2.5 text-xs font-bold text-red-300 hover:bg-red-500/30"
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </button>
            </div>
          </div>
        </div>

        {/* Stats de l'agence */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Caisse Locale
            </span>
            <p className="mt-2 text-2xl font-black text-slate-900">
              ${totalUsd.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="mt-1 text-xs text-emerald-600 font-semibold">
              {totalCdf.toLocaleString('fr-FR')} CDF comptabilisés
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Agents affectés
            </span>
            <p className="mt-2 text-2xl font-black text-slate-900">
              {activeAgentsCount} {activeAgentsCount > 1 ? 'actifs' : 'actif'}
            </p>
            <p className="mt-1 text-xs text-slate-500">Personnel de l'agence</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Missions en cours
            </span>
            <p className="mt-2 text-2xl font-black text-slate-900">
              {activeOperationsCount} {activeOperationsCount > 1 ? 'opérations' : 'opération'}
            </p>
            <p className="mt-1 text-xs text-amber-600 font-semibold">En attente ou en exécution</p>
          </div>
        </div>

        {/* Module actif */}
        {activeModule && (
          <div className="relative">
            {activeModule === 'billetage' && (
              <BilletageModule onClose={() => setActiveModule(null)} />
            )}
            {activeModule === 'operations' && (
              <OperationModule onClose={() => setActiveModule(null)} />
            )}
            {activeModule === 'agents' && (
              <AgentManagementModule
                currentAgencyId={user?.agencyId}
                onClose={() => setActiveModule(null)}
              />
            )}
            {activeModule === 'registrations' && (
              <RegistrationRequestsModule onClose={() => setActiveModule(null)} />
            )}
            {activeModule === 'connectivity' && (
              <ConnectivityModule onClose={() => setActiveModule(null)} />
            )}
          </div>
        )}

        {/* Modules Agence */}
        <DashboardModuleGrid columns={3}>
          <DashboardModuleCard
            title="Billetage de Caisse & Coffre"
            description="Comptage contradictoire quotidien des devises USD et Francs Congolais."
            icon={WalletCards}
            variant="success"
            onClick={() => setActiveModule('billetage')}
          />
          <DashboardModuleCard
            title="Missions & Opérations"
            description="Affectation des tâches opérationnelles aux agents et suivi de complétion."
            icon={Activity}
            variant="primary"
            onClick={() => setActiveModule('operations')}
          />
          <DashboardModuleCard
            title="Gestion des Agents de l'Agence"
            description="Activer la polyvalence de guichet et affecter les services autorisés."
            icon={Users}
            variant="warning"
            onClick={() => setActiveModule('agents')}
          />
          <DashboardModuleCard
            title="Inscriptions Abonnés & Clients"
            description="Examen des pièces justificatives et approbation des clients locaux."
            icon={UserCheck}
            variant="primary"
            onClick={() => setActiveModule('registrations')}
          />
          <DashboardModuleCard
            title="Connectivité & Sync Locale"
            description="Vérification de la base locale Dexie et de l'envoi vers le serveur central."
            icon={Wifi}
            variant="default"
            onClick={() => setActiveModule('connectivity')}
          />
        </DashboardModuleGrid>
      </div>
    </AppLayout>
  );
}
