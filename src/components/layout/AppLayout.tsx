import { useState } from 'react';
import Header from './Header';
import MobileNavigation from './MobileNavigation';
import Sidebar from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  activeItem?: string;
  isOnline?: boolean;
  onNavigate?: (item: string) => void;
  onNotificationsClick?: () => void;
  onProfileClick?: () => void;
}

export default function AppLayout({
  children,
  title = 'Tableau de bord',
  subtitle = 'Vue d ensemble de votre activité',
  activeItem = 'dashboard',
  isOnline = true,
  onNavigate,
  onNotificationsClick,
  onProfileClick
}: AppLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavigate = (item: string) => {
    onNavigate?.(item);
    setMobileMenuOpen(false);
  };

  const handleMobileMenuClick = () => {
    setMobileMenuOpen((current) => !current);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="flex min-h-screen">
        <div className="hidden lg:block">
          <Sidebar
            activeItem={activeItem}
            onNavigate={handleNavigate}
          />
        </div>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-[60] lg:hidden">
            <button
              type="button"
              aria-label="Fermer le menu"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
            />
            <div className="relative z-10 h-full w-[min(20rem,88vw)] shadow-2xl">
              <Sidebar
                activeItem={activeItem}
                onNavigate={handleNavigate}
              />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            title={title}
            subtitle={subtitle}
            isOnline={isOnline}
            onMenuClick={handleMobileMenuClick}
            onNotificationsClick={onNotificationsClick}
            onProfileClick={onProfileClick}
          />

          <main className="min-w-0 flex-1">
            <div className="mx-auto w-full max-w-[1600px] px-5 py-6 pb-24 sm:px-8 lg:px-10 lg:py-8">
              {children}
            </div>
          </main>

          <MobileNavigation
            activeItem="dashboard"
            onNavigate={() => {}}
            onMenuClick={handleMobileMenuClick}
          />
        </div>
      </div>
    </div>
  );
}
