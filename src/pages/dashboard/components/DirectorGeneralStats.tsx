import {
  Activity,
  ArrowUpRight,
  Building2,
  DollarSign,
  TrendingUp,
  Users,
} from 'lucide-react';

interface Props {
  totalAgencies?: number;
  agenciesSubtitle?: string;
  totalAgents?: number;
  activeOperations?: number;
  totalBilletageCountedUSD?: number;
  totalBilletageCountedCDF?: number;
  onSelectModule?: (moduleId: string) => void;
}

export default function DirectorGeneralStats({
  totalAgencies = 0,
  agenciesSubtitle,
  totalAgents = 0,
  activeOperations = 0,
  totalBilletageCountedUSD = 0,
  totalBilletageCountedCDF = 0,
  onSelectModule,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/* KPI 1 : Trésorerie & Billetage */}
      <div
        onClick={() => onSelectModule?.('billetage')}
        role={onSelectModule ? 'button' : undefined}
        tabIndex={onSelectModule ? 0 : undefined}
        onKeyDown={(e) => {
          if (onSelectModule && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onSelectModule('billetage');
          }
        }}
        className={`group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-150 ${
          onSelectModule ? 'cursor-pointer hover:border-slate-300 hover:shadow-md' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-500">
              Liquidités supervisées
            </p>
            <p className="mt-2 font-mono text-2xl font-bold tracking-tight tabular-nums text-slate-950 sm:text-3xl">
              ${totalBilletageCountedUSD.toLocaleString('fr-FR', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-emerald-700 tabular-nums">
            <TrendingUp className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {totalBilletageCountedCDF > 0
                ? `${totalBilletageCountedCDF.toLocaleString('fr-FR')} CDF en caisse`
                : totalBilletageCountedUSD > 0
                  ? 'Fonds en caisse vérifiés'
                  : 'Aucun billetage enregistré'}
            </span>
          </div>
          {onSelectModule && (
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-slate-900" />
          )}
        </div>
      </div>

      {/* KPI 2 : Réseau des Agences */}
      <div
        onClick={() => onSelectModule?.('agencies')}
        role={onSelectModule ? 'button' : undefined}
        tabIndex={onSelectModule ? 0 : undefined}
        onKeyDown={(e) => {
          if (onSelectModule && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onSelectModule('agencies');
          }
        }}
        className={`group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-150 ${
          onSelectModule ? 'cursor-pointer hover:border-slate-300 hover:shadow-md' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-500">
              Agences opérationnelles
            </p>
            <p className="mt-2 font-mono text-2xl font-bold tracking-tight tabular-nums text-slate-950 sm:text-3xl">
              {totalAgencies}
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition-colors group-hover:bg-blue-600 group-hover:text-white">
            <Building2 className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
          <span className="truncate text-slate-500">
            {agenciesSubtitle ||
              (totalAgencies === 0 ? 'Aucune agence enregistrée' : 'Réseau Ets AMANI')}
          </span>
          {onSelectModule && (
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-slate-900" />
          )}
        </div>
      </div>

      {/* KPI 3 : Missions & Opérations */}
      <div
        onClick={() => onSelectModule?.('operations-management')}
        role={onSelectModule ? 'button' : undefined}
        tabIndex={onSelectModule ? 0 : undefined}
        onKeyDown={(e) => {
          if (onSelectModule && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onSelectModule('operations-management');
          }
        }}
        className={`group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-150 ${
          onSelectModule ? 'cursor-pointer hover:border-slate-300 hover:shadow-md' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-500">
              Missions & opérations
            </p>
            <p className="mt-2 font-mono text-2xl font-bold tracking-tight tabular-nums text-slate-950 sm:text-3xl">
              {activeOperations}
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 transition-colors group-hover:bg-amber-500 group-hover:text-slate-950">
            <Activity className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
          <span className="truncate text-slate-500">
            {activeOperations === 0
              ? 'Aucune opération en attente'
              : 'Missions actives sur le réseau'}
          </span>
          {onSelectModule && (
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-slate-900" />
          )}
        </div>
      </div>

      {/* KPI 4 : Personnel & Agents */}
      <div
        onClick={() => onSelectModule?.('agents-management')}
        role={onSelectModule ? 'button' : undefined}
        tabIndex={onSelectModule ? 0 : undefined}
        onKeyDown={(e) => {
          if (onSelectModule && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onSelectModule('agents-management');
          }
        }}
        className={`group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-150 ${
          onSelectModule ? 'cursor-pointer hover:border-slate-300 hover:shadow-md' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-500">
              Agents actifs réseau
            </p>
            <p className="mt-2 font-mono text-2xl font-bold tracking-tight tabular-nums text-slate-950 sm:text-3xl">
              {totalAgents}
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition-colors group-hover:bg-slate-900 group-hover:text-white">
            <Users className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
          <span className="truncate text-slate-500">
            {totalAgents === 0 ? 'Aucun agent actif' : 'Guichetiers & opérateurs affectés'}
          </span>
          {onSelectModule && (
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-slate-900" />
          )}
        </div>
      </div>
    </div>
  );
}
