import {
  Bell,
  ChevronDown,
  Menu,
  Search,
  Wifi,
  WifiOff
} from 'lucide-react';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  isOnline?: boolean;
  onMenuClick?: () => void;
  onNotificationsClick?: () => void;
  onProfileClick?: () => void;
}

export default function Header({
  title = 'Tableau de bord',
  subtitle = 'Vue d ensemble de votre activité',
  isOnline = true,
  onMenuClick,
  onNotificationsClick,
  onProfileClick
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-20 items-center gap-4 px-5 sm:px-8 lg:px-10">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Ouvrir le menu"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 lg:hidden"
        >
          <Menu size={20} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-bold tracking-tight text-slate-950 sm:text-xl">
              {title}
            </h1>
          </div>
          <p className="mt-0.5 hidden truncate text-xs text-slate-500 sm:block">
            {subtitle}
          </p>
        </div>

        <div className="hidden w-64 lg:block xl:w-80">
          <label className="relative block">
            <span className="sr-only">Rechercher</span>
            <Search
              size={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              placeholder="Rechercher..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            />
          </label>
        </div>

        <div
          className={[
            'hidden items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium sm:flex',
            isOnline
              ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
              : 'border-amber-100 bg-amber-50 text-amber-700'
          ].join(' ')}
          title={isOnline ? 'Connexion disponible' : 'Mode hors connexion'}
        >
          {isOnline ? <Wifi size={15} /> : <WifiOff size={15} />}
          <span className="hidden xl:inline">
            {isOnline ? 'En ligne' : 'Hors ligne'}
          </span>
        </div>

        <button
          type="button"
          onClick={onNotificationsClick}
          aria-label="Notifications"
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
        >
          <Bell size={19} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white" />
        </button>

        <button
          type="button"
          onClick={onProfileClick}
          className="group flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 pr-2 transition hover:bg-slate-50 sm:gap-3 sm:pr-3"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-xs font-bold text-white">
            EA
          </div>
          <div className="hidden min-w-0 text-left md:block">
            <div className="max-w-28 truncate text-sm font-semibold text-slate-800">
              Utilisateur
            </div>
            <div className="max-w-28 truncate text-[11px] text-slate-500">
              Compte actif
            </div>
          </div>
          <ChevronDown
            size={16}
            className="hidden text-slate-400 transition-transform group-hover:text-slate-600 md:block"
          />
        </button>
      </div>

      <div className="border-t border-slate-100 px-5 py-3 sm:px-8 lg:hidden">
        <label className="relative block">
          <span className="sr-only">Rechercher</span>
          <Search
            size={17}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            placeholder="Rechercher dans Ets AMANI..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
          />
        </label>
      </div>
    </header>
  );
}
