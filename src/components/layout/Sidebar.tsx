import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  Calculator,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Settings,
  ShieldCheck,
  Users,
  WalletCards
} from 'lucide-react';

interface SidebarProps {
  activeItem?: string;
  onNavigate?: (item: string) => void;
}

interface NavigationItem {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string;
}

const mainNavigation: NavigationItem[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: Activity },
  { id: 'billetage', label: 'Billetage', icon: WalletCards },
  { id: 'agencies', label: 'Agences', icon: Building2 },
  { id: 'members', label: 'Membres', icon: Users },
];

const managementNavigation: NavigationItem[] = [
  { id: 'reports', label: 'Rapports', icon: FileText },
  { id: 'accounting', label: 'Comptabilité', icon: Calculator },
  { id: 'commissions', label: 'Commissions', icon: BarChart3 },
  { id: 'chat', label: 'Chat interne', icon: MessageSquare },
];

const systemNavigation: NavigationItem[] = [
  { id: 'alerts', label: 'Alertes', icon: Bell },
  { id: 'regulations', label: 'Réglementation', icon: ShieldCheck },
  { id: 'settings', label: 'Paramètres', icon: Settings },
];

export default function Sidebar({
  activeItem = 'dashboard',
  onNavigate
}: SidebarProps) {
  const handleNavigation = (item: string) => {
    onNavigate?.(item);
  };

  return (
    <aside className="flex h-full min-h-screen w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-20 shrink-0 items-center border-b border-slate-200 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white shadow-sm">
            EA
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-bold tracking-tight text-slate-950">
              Ets AMANI
            </div>
            <div className="truncate text-xs text-slate-500">
              Gestion & supervision
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <NavigationSection
          title="Principal"
          items={mainNavigation}
          activeItem={activeItem}
          onNavigate={handleNavigation}
        />
        <NavigationSection
          title="Gestion"
          items={managementNavigation}
          activeItem={activeItem}
          onNavigate={handleNavigation}
        />
        <NavigationSection
          title="Système"
          items={systemNavigation}
          activeItem={activeItem}
          onNavigate={handleNavigation}
        />
      </div>

      <div className="shrink-0 border-t border-slate-200 p-4">
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-xs font-bold text-white">
                EA
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-50 bg-emerald-500" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-800">
                Utilisateur
              </div>
              <div className="truncate text-xs text-slate-500">
                Compte actif
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-slate-200 pt-3">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-slate-600">
              Système opérationnel
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

interface NavigationSectionProps {
  title: string;
  items: NavigationItem[];
  activeItem: string;
  onNavigate: (item: string) => void;
}

function NavigationSection({
  title,
  items,
  activeItem,
  onNavigate
}: NavigationSectionProps) {
  return (
    <section className="mb-7 last:mb-0">
      <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </div>
      <nav className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeItem;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={[
                'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all',
                isActive
                  ? 'bg-slate-950 font-semibold text-white shadow-sm'
                  : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950'
              ].join(' ')}
            >
              <Icon
                size={18}
                strokeWidth={isActive ? 2.2 : 1.9}
                className={
                  isActive
                    ? 'text-blue-400'
                    : 'text-slate-400 transition-colors group-hover:text-slate-600'
                }
              />
              <span className="min-w-0 flex-1 truncate">
                {item.label}
              </span>
              {item.badge && (
                <span
                  className={[
                    'rounded-full px-2 py-0.5 text-[10px] font-bold',
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'bg-slate-100 text-slate-500'
                  ].join(' ')}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </section>
  );
}
