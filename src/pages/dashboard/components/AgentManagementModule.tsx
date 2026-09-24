import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db as firestoreDb } from '../../../lib/firebase';
import type { AppUser, UserFunction } from '../../../types/auth';

interface Props {
  users?: AppUser[];
  currentAgencyId?: string | null;
  canManageAllAgencies?: boolean;
  onClose?: () => void;
}

const AVAILABLE_SERVICES: { value: UserFunction; label: string }[] = [
  { value: 'guichetier', label: 'Guichetier (Caisse)' },
  { value: 'comptable', label: 'Comptable' },
  { value: 'agent_change', label: 'Agent de Change (Devises)' },
  { value: 'agent_operateur_mobile', label: 'Opérateur Mobile Money' },
  { value: 'agent_vodae', label: 'Agent Voda-E' },
  { value: 'agent_virtuel', label: 'Agent Virtuel' },
  { value: 'chauffeur', label: 'Chauffeur / Logistique' },
  { value: 'cleaner', label: 'Hygiène & Entretien' },
  { value: 'agent_terrain', label: 'Agent de Terrain' },
];

export default function AgentManagementModule({
  users,
  currentAgencyId,
  canManageAllAgencies = false,
  onClose,
}: Props) {
  const [internalUsers, setInternalUsers] = useState<AppUser[]>(users || []);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editingAgent, setEditingAgent] = useState<AppUser | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchAgents = async () => {
    setIsLoading(true);
    try {
      const usersRef = collection(firestoreDb, 'users');
      const q = query(usersRef, where('role', '==', 'agent'));
      const snapshot = await getDocs(q);
      const loaded: AppUser[] = snapshot.docs.map((d) => ({
        ...(d.data() as AppUser),
        uid: d.id,
      }));
      setInternalUsers(loaded);
    } catch (err) {
      console.warn('Erreur chargement des agents depuis Firestore:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (users && users.length > 0) {
      setInternalUsers(users);
    } else {
      fetchAgents();
    }
  }, [users]);

  const agents = useMemo(() => {
    return internalUsers.filter((user) => {
      if (user.role !== 'agent') return false;
      if (
        !canManageAllAgencies &&
        currentAgencyId &&
        user.agencyId &&
        user.agencyId !== currentAgencyId
      ) {
        return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (user.displayName || '').toLowerCase().includes(q) ||
        (user.email || '').toLowerCase().includes(q) ||
        (user.phoneNumber || user.phone || '').includes(q)
      );
    });
  }, [internalUsers, search, currentAgencyId, canManageAllAgencies]);

  const handleToggleMultiService = async (agent: AppUser) => {
    const nextVal = !agent.multiServiceEnabled;
    try {
      const userRef = doc(firestoreDb, 'users', agent.uid);
      await updateDoc(userRef, { multiServiceEnabled: nextVal });
      setInternalUsers((prev) =>
        prev.map((u) => (u.uid === agent.uid ? { ...u, multiServiceEnabled: nextVal } : u))
      );
      if (editingAgent?.uid === agent.uid) {
        setEditingAgent({ ...editingAgent, multiServiceEnabled: nextVal });
      }
    } catch (err) {
      console.error('Erreur mise à jour polyvalence:', err);
    }
  };

  const handleToggleService = async (agent: AppUser, serviceVal: UserFunction) => {
    const existing = agent.serviceAssignments || [];
    const hasService = existing.some((s) => s.service === serviceVal && s.active);
    let updatedAssignments;
    if (hasService) {
      updatedAssignments = existing.map((s) =>
        s.service === serviceVal ? { ...s, active: false } : s
      );
    } else {
      const found = existing.find((s) => s.service === serviceVal);
      if (found) {
        updatedAssignments = existing.map((s) =>
          s.service === serviceVal ? { ...s, active: true } : s
        );
      } else {
        updatedAssignments = [
          ...existing,
          {
            id: `assign_${Date.now()}_${serviceVal}`,
            service: serviceVal,
            type: 'permanent' as const,
            status: 'approved' as const,
            active: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            assignedAt: Date.now(),
            agencyId: agent.agencyId || currentAgencyId || 'siege',
          },
        ];
      }
    }

    try {
      const userRef = doc(firestoreDb, 'users', agent.uid);
      await updateDoc(userRef, { serviceAssignments: updatedAssignments });
      setInternalUsers((prev) =>
        prev.map((u) => (u.uid === agent.uid ? { ...u, serviceAssignments: updatedAssignments } : u))
      );
      if (editingAgent?.uid === agent.uid) {
        setEditingAgent({ ...editingAgent, serviceAssignments: updatedAssignments });
      }
      setSuccessMessage(`Services de ${agent.displayName} mis à jour.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Erreur mise à jour services:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">Gestion des agents & Services</h1>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                  {agents.length} agent{agents.length > 1 ? 's' : ''}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Attribuez les fonctions opérationnelles, la polyvalence de guichet et les services autorisés aux agents.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchAgents}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {successMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <p>{successMessage}</p>
          </div>
        )}

        <div className="mt-6 relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un agent par nom, email..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 font-semibold text-slate-700">
              <tr>
                <th className="p-4">Agent</th>
                <th className="p-4">Fonction principale</th>
                <th className="p-4">Polyvalence</th>
                <th className="p-4">Services actifs</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {agents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    Aucun agent trouvé
                  </td>
                </tr>
              ) : (
                agents.map((agent) => {
                  const activeAssignments = (agent.serviceAssignments || []).filter((s) => s.active);
                  return (
                    <tr key={agent.uid} className="transition hover:bg-slate-50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold">
                            {(agent.displayName || 'A').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{agent.displayName}</p>
                            <p className="text-xs text-slate-500">{agent.email || agent.phone || agent.phoneNumber || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-medium text-slate-800">
                        {agent.function || 'Agent standard'}
                      </td>
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => handleToggleMultiService(agent)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                            agent.multiServiceEnabled
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${agent.multiServiceEnabled ? 'bg-emerald-600' : 'bg-slate-400'}`} />
                          {agent.multiServiceEnabled ? 'Activée' : 'Désactivée'}
                        </button>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1.5">
                          {activeAssignments.length === 0 ? (
                            <span className="text-xs text-slate-400 italic">Aucun service attribué</span>
                          ) : (
                            activeAssignments.map((a) => (
                              <span
                                key={a.service}
                                className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                              >
                                {a.service}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() => setEditingAgent(agent)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          <Settings className="h-3.5 w-3.5" />
                          Configurer
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <BriefcaseBusiness className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Services de {editingAgent.displayName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cochez les services opérationnels que cet agent a l'autorisation d'exécuter.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingAgent(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Polyvalence multi-services</p>
                <p className="text-xs text-slate-500">
                  Permet à l'agent de basculer dynamiquement entre plusieurs postes au guichet.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggleMultiService(editingAgent)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  editingAgent.multiServiceEnabled
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {editingAgent.multiServiceEnabled ? 'Activée' : 'Désactivée'}
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {AVAILABLE_SERVICES.map(({ value, label }) => {
                const isChecked = (editingAgent.serviceAssignments || []).some(
                  (s) => s.service === value && s.active
                );
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleToggleService(editingAgent, value)}
                    className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
                      isChecked
                        ? 'border-blue-300 bg-blue-50/60 text-blue-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold">{label}</p>
                      <p className="text-xs text-slate-400">{value}</p>
                    </div>
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-lg border transition ${
                        isChecked
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isChecked && <Check className="h-4 w-4" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setEditingAgent(null)}
                className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Terminé
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
