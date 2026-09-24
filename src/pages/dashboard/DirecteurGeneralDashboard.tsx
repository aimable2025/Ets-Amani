import {
  Activity,
  ArrowRight,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Coins,
  History,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  WalletCards,
  Wifi,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AppLayout from '../../components/layout/AppLayout';
import DashboardModuleCard from '../../components/dashboard/DashboardModuleCard';
import DashboardModuleGrid from '../../components/dashboard/DashboardModuleGrid';
import DashboardToolbar, {
  type DashboardViewMode,
} from '../../components/dashboard/DashboardToolbar';
import DirectorGeneralStats from './components/DirectorGeneralStats';
import {
  DG_MODULES,
  type DgModuleCategory,
  type DgModuleItem,
} from './components/DirectorGeneralModules';
import BilletageModule from './components/BilletageModule';
import InternalNumbersModule from './components/InternalNumbersModule';
import OperationModule from './components/OperationModule';
import ConnectivityModule from './components/ConnectivityModule';
import AgentManagementModule from './components/AgentManagementModule';
import RegistrationRequestsModule from './components/RegistrationRequestsModule';
import AuditModule from './components/AuditModule';
import SystemConfigModule from './components/SystemConfigModule';
import { getDgFeatures } from '../../services/DgFeatureService';
import {
  subscribeToDirectorGeneralConfig,
  type DirectorGeneralConfig,
} from '../../services/DirectorGeneralService';
import type { DgFeatures } from '../../types/management';

export default function DirecteurGeneralDashboard() {
  const { user, signOut } = useAuth();
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DgModuleCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<DashboardViewMode>('list');
  const [features, setFeatures] = useState<DgFeatures | undefined>(undefined);
  const [dgConfig, setDgConfig] = useState<DirectorGeneralConfig | null>(null);

  useEffect(() => {
    getDgFeatures().then(setFeatures).catch(() => {});
    const unsub = subscribeToDirectorGeneralConfig((cfg) => {
      setDgConfig(cfg);
    });
    return () => {
      unsub();
    };
  }, []);

  const isSuspended =
    user?.status === 'suspended' || dgConfig?.status === 'suspended';

  const visibleModules = useMemo(() => {
    return DG_MODULES.filter((mod) => {
      if (mod.isAvailable && !mod.isAvailable(features)) {
        return false;
      }
      if (selectedCategory !== 'all' && mod.category !== selectedCategory) {
        return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        mod.title.toLowerCase().includes(q) ||
        mod.description.toLowerCase().includes(q)
      );
    });
  }, [features, selectedCategory, search]);

  const handleOpenModule = (id: string) => {
    setActiveModuleId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <AppLayout
      title="Direction Générale — Ets AMANI"
      subtitle="Pilotage global, trésorerie et supervision réseau"
      activeItem="dashboard"
    >
      <div className="space-y-6">
        {/* Banner DG */}
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 font-black text-xl shadow-lg shadow-amber-400/20">
                DG
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                    Direction Générale
                  </h1>
                  {isSuspended ? (
                    <span className="rounded-full bg-amber-500/30 px-3 py-1 text-xs font-bold text-amber-300 ring-1 ring-amber-500/50">
                      Mandat Suspendu
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-500/30">
                      Mandat Actif
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-300">
                  Bienvenue, <strong>{user?.displayName}</strong> • Supervision globale de toutes les agences Ets AMANI.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isSuspended}
                onClick={() => handleOpenModule('billetage')}
                className="flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-md hover:bg-amber-300 disabled:opacity-50"
              >
                <Coins className="h-4 w-4" />
                Billetage Rapide
              </button>
              <button
                type="button"
                disabled={isSuspended}
                onClick={() => handleOpenModule('operations-management')}
                className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20 disabled:opacity-50"
              >
                <ClipboardCheck className="h-4 w-4" />
                Nouvelle Mission
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

        {/* Alerte suspension DG */}
        {isSuspended && (
          <div className="rounded-3xl border border-amber-300 bg-amber-50 p-6 text-amber-900 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-amber-800">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="space-y-1 text-xs">
                <h3 className="text-sm font-bold text-amber-950">
                  Votre mandat de Direction Générale est momentanément suspendu
                </h3>
                <p className="text-amber-800">
                  Motif enregistré par l'Administrateur Système : <em>« {dgConfig?.suspensionReason || 'Procédure administrative en cours'} »</em>.
                </p>
                <p className="text-amber-700">
                  Les opérations décisionnelles sont verrouillées en consultation seule jusqu'à levée de la suspension.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Statistiques consolidées */}
        <DirectorGeneralStats />

        {/* Affichage d'un module spécifique si sélectionné */}
        {activeModuleId && (
          <div className="relative">
            {activeModuleId === 'billetage' && (
              <BilletageModule onClose={() => setActiveModuleId(null)} />
            )}
            {activeModuleId === 'operations-management' && (
              <OperationModule onClose={() => setActiveModuleId(null)} />
            )}
            {activeModuleId === 'internal-numbers' && (
              <InternalNumbersModule onClose={() => setActiveModuleId(null)} />
            )}
            {activeModuleId === 'connectivity-sync' && (
              <ConnectivityModule onClose={() => setActiveModuleId(null)} />
            )}
            {activeModuleId === 'agents-management' && (
              <AgentManagementModule canManageAllAgencies onClose={() => setActiveModuleId(null)} />
            )}
            {activeModuleId === 'registration-requests' && (
              <RegistrationRequestsModule onClose={() => setActiveModuleId(null)} />
            )}
            {activeModuleId === 'audit-logs' && (
              <AuditModule onClose={() => setActiveModuleId(null)} />
            )}
            {activeModuleId === 'dg-config' && (
              <SystemConfigModule onClose={() => setActiveModuleId(null)} />
            )}
          </div>
        )}

        {/* Barre d'outils et recherche */}
        <DashboardToolbar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Rechercher un module, rapport ou fonction..."
        >
          <div className="hidden sm:flex items-center gap-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Tous
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('operations')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                selectedCategory === 'operations'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Opérations
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('network')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                selectedCategory === 'network'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Réseau
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('oversight')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                selectedCategory === 'oversight'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Supervision
            </button>
          </div>
        </DashboardToolbar>

        {/* Grille des modules de la Direction Générale */}
        <DashboardModuleGrid columns={3}>
          {visibleModules.map((item) => (
            <DashboardModuleCard
              key={item.id}
              title={item.title}
              description={item.description}
              icon={item.icon}
              variant={item.variant}
              badge={item.badge}
              onClick={() => handleOpenModule(item.id)}
            />
          ))}
        </DashboardModuleGrid>
      </div>
    </AppLayout>
  );
}
