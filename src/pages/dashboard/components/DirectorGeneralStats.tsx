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
  totalAgents?: number;
  activeOperations?: number;
  totalBilletageCountedUSD?: number;
}

export default function DirectorGeneralStats({
  totalAgencies = 3,
  totalAgents = 8,
  activeOperations = 12,
  totalBilletageCountedUSD = 45280,
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
          ${totalBilletageCountedUSD.toLocaleString('fr-FR')}
        </p>
        <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Fonds en caisse équilibrés</span>
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
        <p className="mt-2 text-xs text-slate-500">Goma, Kinshasa, Bukavu</p>
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
        <p className="mt-2 text-xs text-slate-500">En cours de traitement local</p>
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
        <p className="mt-2 text-xs text-slate-500">Guichetiers & opérateurs</p>
      </div>
    </div>
  );
}
