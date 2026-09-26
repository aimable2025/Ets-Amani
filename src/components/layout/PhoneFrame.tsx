import React from 'react';

interface PhoneFrameProps {
  children: React.ReactNode;
  appName?: string;
}

export const PhoneFrame: React.FC<PhoneFrameProps> = ({
  children,
  appName = 'Ets AMANI',
}) => {
  return (
    <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center sm:py-8 sm:px-4">
      {/* Simulation d'un smartphone sur grands écrans / Plein écran sur mobile */}
      <div className="relative w-full h-screen sm:h-[844px] sm:max-w-[390px] bg-slate-900 sm:rounded-[48px] sm:border-[10px] sm:border-slate-800 sm:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden ring-1 ring-white/10">
        
        {/* Notch / Encoche supérieure (Visible uniquement sur grands écrans) */}
        <div className="hidden sm:flex absolute top-0 left-1/2 -translate-x-1/2 h-6 w-36 bg-slate-800 rounded-b-2xl z-50 items-center justify-center gap-2">
          <div className="w-3 h-3 rounded-full bg-slate-900 border border-slate-700/50" />
          <div className="w-10 h-1.5 rounded-full bg-slate-900 border border-slate-700/50" />
        </div>

        {/* Barre de statut mobile simulée (Superposée en haut) */}
        <div className="w-full bg-slate-950/80 backdrop-blur-md px-6 pt-2 pb-1.5 text-slate-400 text-[11px] font-semibold flex justify-between items-center z-40 border-b border-white/5 select-none shrink-0">
          <span>{appName}</span>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] uppercase tracking-wider text-slate-300">En ligne</span>
          </div>
        </div>

        {/* Zone de contenu défilable (Viewport de l'application) */}
        <main className="flex-1 w-full overflow-y-auto overflow-x-hidden bg-slate-50 relative flex flex-col">
          {children}
        </main>

        {/* Indicator de navigation bas (iPhone home bar simulée) */}
        <div className="hidden sm:flex w-full bg-slate-950 py-1.5 justify-center items-center shrink-0 border-t border-white/5">
          <div className="w-28 h-1 rounded-full bg-slate-700" />
        </div>
      </div>
    </div>
  );
};

export default PhoneFrame;
