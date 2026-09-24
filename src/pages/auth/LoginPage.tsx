import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Coins,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Smartphone,
  UserCheck,
  Users,
  WalletCards,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginPage() {
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Veuillez renseigner votre email et votre mot de passe.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err: any) {
      setError(
        err?.message || 'Identifiants incorrects ou compte inactif. Veuillez réessayer.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Left section: branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-slate-950 p-12 text-white relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-emerald-600/20 blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-950 font-black text-xl shadow-lg">
              EA
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white">Ets AMANI</h1>
              <p className="text-xs text-slate-400">Système Intégré de Gestion & Transferts</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-6 max-w-md">
          <h2 className="text-3xl font-black leading-tight text-white sm:text-4xl">
            Gestion sécurisée, <br />
            trésorerie & opérations en temps réel.
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Plateforme professionnelle Offline-First conçue pour les succursales, guichetiers, directeurs et clients de l'Ets AMANI à travers la RDC.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <Coins className="h-6 w-6 text-amber-400 mb-2" />
              <p className="font-bold text-sm">Billetage Contradictoire</p>
              <p className="text-xs text-slate-400 mt-1">Devises USD & CDF réconciliées en temps réel.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <ShieldCheck className="h-6 w-6 text-emerald-400 mb-2" />
              <p className="font-bold text-sm">Offline-First Garanti</p>
              <p className="text-xs text-slate-400 mt-1">Saisie autonome dans Dexie et sync dès reconnexion.</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-500">
          © {new Date().getFullYear()} Ets AMANI. Tous droits réservés.
        </div>
      </div>

      {/* Right section: login form & fast demo switcher */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 overflow-y-auto">
        <div className="mx-auto w-full max-w-md space-y-6">
          <div className="lg:hidden flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white font-bold text-base">
              EA
            </div>
            <div>
              <p className="font-bold text-slate-900">Ets AMANI</p>
              <p className="text-[11px] text-slate-500">Gestion Opérationnelle</p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-black text-slate-900">Connexion sécurisée</h2>
            <p className="mt-1 text-xs text-slate-500">
              Accédez à votre espace opérationnel ou administratif.
            </p>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Adresse Email ou Identifiant
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@ets-amani.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-slate-950 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-950/10 transition hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? 'Connexion en cours...' : 'Se connecter'}
            </button>
          </form>

          <div className="pt-2 text-center text-xs text-slate-500">
            Vous n'avez pas encore de compte ?{' '}
            <Link to="/register" className="font-bold text-blue-600 hover:underline">
              S'inscrire (Client / Abonné)
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
