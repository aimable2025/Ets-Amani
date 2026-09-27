import {
  Activity,
  ArrowUpRight,
  Building2,
  DollarSign,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';

interface Props {
  totalAgencies?: number;
  agenciesSubtitle?: string;
  totalAgents?: number;
  activeOperations?: number;
  totalBilletageCountedUSD?: number;
  totalBilletageCountedCDF?: number;
}

export default function DirectorGeneralStats({
  totalAgencies = 0,
  agenciesSubtitle,
  totalAgents = 0,
  activeOperations = 0,
  totalBilletageCountedUSD = 0,
  totalBilletageCountedCDF = 0,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Liquidités Supervisées
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-3 text-2xl font-black text-slate-900">
          ${totalBilletageCountedUSD.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>
            {totalBilletageCountedCDF > 0
              ? `${totalBilletageCountedCDF.toLocaleString('fr-FR')} CDF comptabilisés`
              : totalBilletageCountedUSD > 0
                ? 'Fonds en caisse comptabilisés'
                : 'Aucun billetage enregistré'}
          </span>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Agences Opérationnelles
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Building2 className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-3 text-2xl font-black text-slate-900">{totalAgencies}</p>
        <p className="mt-2 truncate text-xs text-slate-500">
          {agenciesSubtitle ||
            (totalAgencies === 0 ? 'Aucune agence enregistrée' : 'Réseau Ets AMANI')}
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Missions & Opérations
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Activity className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-3 text-2xl font-black text-slate-900">{activeOperations}</p>
        <p className="mt-2 text-xs text-slate-500">
          {activeOperations === 0 ? 'Aucune opération en cours' : 'En cours de traitement'}
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Agents Actifs Réseau
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            <Users className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-3 text-2xl font-black text-slate-900">{totalAgents}</p>
        <p className="mt-2 text-xs text-slate-500">
          {totalAgents === 0 ? 'Aucun agent actif' : 'Guichetiers & opérateurs'}
        </p>
      </div>
    </div>
  );
}
