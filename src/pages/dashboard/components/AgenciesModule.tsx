import {
  AlertCircle,
  Building2,
  Check,
  Edit3,
  Loader2,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import UserAvatar from '../../../components/common/UserAvatar';
import {
  createAgency,
  deleteAgency,
  getAgencies,
  updateAgency,
  type Agency,
} from '../../../services/AgencyService';
import { getAllSystemUsers, type ManagedUser } from '../../../services/SystemUserService';

interface AgenciesModuleProps {
  onClose?: () => void;
}

export default function AgenciesModule({ onClose }: AgenciesModuleProps) {
  const { user } = useAuth();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [systemUsers, setSystemUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Form state (Create / Edit)
  const [showForm, setShowForm] = useState(false);
  const [editingAgencyId, setEditingAgencyId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [managerId, setManagerId] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'suspended'>('active');

  // Delete confirmation state
  const [confirmDeleteAgency, setConfirmDeleteAgency] = useState<Agency | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [agencyList, usersList] = await Promise.all([
        getAgencies(),
        getAllSystemUsers(),
      ]);
      setAgencies(agencyList);
      setSystemUsers(usersList);
    } catch (err) {
      console.error('[Ets AMANI] Erreur chargement des agences :', err);
      setError('Impossible de charger la liste des agences.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const agencyManagers = useMemo(() => {
    return systemUsers.filter(
      (u) =>
        (u.role === 'administrateur_agence' || u.role === 'agent' || u.role === 'directeur_general') &&
        u.status === 'active'
    );
  }, [systemUsers]);

  const agentCountsByAgency = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of systemUsers) {
      if (u.agencyId && (u.role === 'agent' || u.role === 'administrateur_agence')) {
        counts[u.agencyId] = (counts[u.agencyId] || 0) + 1;
      }
    }
    return counts;
  }, [systemUsers]);

  const filteredAgencies = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return agencies;
    return agencies.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.code || '').toLowerCase().includes(q) ||
        (a.city || '').toLowerCase().includes(q) ||
        (a.managerName || '').toLowerCase().includes(q)
    );
  }, [agencies, search]);

  const resetForm = () => {
    setEditingAgencyId(null);
    setName('');
    setCode('');
    setCity('');
    setAddress('');
    setPhone('');
    setManagerId('');
    setStatus('active');
    setShowForm(false);
  };

  const handleOpenCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handleOpenEdit = (agency: Agency) => {
    setEditingAgencyId(agency.id);
    setName(agency.name);
    setCode(agency.code || '');
    setCity(agency.city || '');
    setAddress(agency.address || '');
    setPhone(agency.phone || '');
    setManagerId(agency.managerId || '');
    setStatus(
      agency.status === 'inactive' || agency.status === 'suspended'
        ? agency.status
        : 'active'
    );
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Veuillez saisir le nom de l'agence.");
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);

    const selectedManager = agencyManagers.find((m) => m.uid === managerId);
    const actor = user
      ? { uid: user.uid, name: user.displayName, role: user.role }
      : undefined;

    try {
      if (editingAgencyId) {
        await updateAgency(
          editingAgencyId,
          {
            name: name.trim(),
            code: code.trim().toUpperCase() || undefined,
            city: city.trim(),
            address: address.trim(),
            phone: phone.trim(),
            managerId: selectedManager?.uid || null,
            managerName: selectedManager?.displayName || null,
            status,
          },
          actor
        );
        setFeedback(`Agence « ${name.trim()} » mise à jour avec succès.`);
      } else {
        await createAgency({
          name: name.trim(),
          code: code.trim().toUpperCase() || undefined,
          city: city.trim(),
          address: address.trim(),
          phone: phone.trim(),
          managerId: selectedManager?.uid || null,
          managerName: selectedManager?.displayName || null,
          status,
          actor,
        });
        setFeedback(`Agence « ${name.trim()} » enregistrée avec succès.`);
      }
      resetForm();
      await loadData();
      setTimeout(() => setFeedback(null), 3500);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'enregistrer l'agence."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteAgency) return;
    setDeletingId(confirmDeleteAgency.id);
    setError(null);
    const actor = user
      ? { uid: user.uid, name: user.displayName, role: user.role }
      : undefined;

    try {
      await deleteAgency(confirmDeleteAgency.id, actor);
      setFeedback(`Agence « ${confirmDeleteAgency.name} » supprimée.`);
      setConfirmDeleteAgency(null);
      await loadData();
      setTimeout(() => setFeedback(null), 3500);
    } catch {
      setError("Impossible de supprimer l'agence.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section
      className="rounded-3xl border border-slate-200 bg-white shadow-xl overflow-hidden"
      aria-label="Gestion du réseau des agences"
    >
      <div className="flex flex-col gap-4 border-b border-slate-200 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                Réseau des Agences Ets AMANI
              </h2>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                {agencies.length} agence{agencies.length > 1 ? 's' : ''}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Supervision des succursales, guichets, responsables d'agence et statuts d'activité.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Nouvelle Agence
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-5">
        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {feedback && (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{feedback}</span>
          </div>
        )}

        {showForm && (
          <form
            onSubmit={handleSave}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingAgencyId ? "Modifier l'agence" : 'Enregistrer une nouvelle agence'}
              </h3>
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Fermer
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nom de l'agence *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Agence Centrale Goma"
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-slate-900 outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Code agence
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ex: GOM-01"
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono uppercase text-slate-900 outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ville / Localité *
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex: Goma, Bukavu, Kinshasa..."
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-slate-900 outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Adresse physique
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Avenue, quartier, commune"
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-slate-900 outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Téléphone guichet
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+243..."
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-slate-900 outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Responsable d'agence
                </label>
                <select
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-slate-900 outline-none focus:border-slate-400"
                >
                  <option value="">Non assigné</option>
                  {agencyManagers.map((m) => (
                    <option key={m.uid} value={m.uid}>
                      {m.displayName} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Statut opérationnel
                </label>
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as 'active' | 'inactive' | 'suspended')
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-semibold text-slate-900 outline-none focus:border-slate-400"
                >
                  <option value="active">Active (Opérationnelle)</option>
                  <option value="suspended">Suspendue</option>
                  <option value="inactive">Inactive / Fermée</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editingAgencyId ? 'Enregistrer les modifications' : "Créer l'agence"}
              </button>
            </div>
          </form>
        )}

        {/* Barre de recherche */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une agence par nom, code, ville ou responsable..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs text-slate-900 outline-none focus:bg-white focus:border-slate-400"
          />
        </div>

        {/* Liste des agences */}
        {loading ? (
          <div className="py-12 text-center text-slate-400">
            <Loader2 className="mx-auto h-6 w-6 animate-spin mb-2" />
            <p className="text-xs">Chargement des agences...</p>
          </div>
        ) : filteredAgencies.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <Building2 className="mx-auto h-8 w-8 text-slate-400" />
            <h3 className="mt-3 text-sm font-bold text-slate-900">
              Aucune agence disponible
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {agencies.length === 0
                ? 'Aucune agence n’a encore été enregistrée dans la base de données. Cliquez sur « Nouvelle Agence » pour créer votre première succursale.'
                : 'Aucune agence ne correspond à votre recherche.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredAgencies.map((agency) => {
              const personnelCount = agentCountsByAgency[agency.id] || 0;
              const isSuspended = agency.status === 'suspended';
              const isInactive = agency.status === 'inactive';

              return (
                <div
                  key={agency.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white font-bold text-xs">
                          {agency.code ? agency.code.slice(0, 3) : 'AG'}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900">
                              {agency.name}
                            </h3>
                            {agency.code && (
                              <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                                {agency.code}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono">
                            ID : {agency.id}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          isSuspended
                            ? 'bg-amber-100 text-amber-800'
                            : isInactive
                              ? 'bg-red-100 text-red-800'
                              : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isSuspended
                          ? 'Suspendue'
                          : isInactive
                            ? 'Inactive'
                            : 'Active'}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {agency.city || 'Ville non spécifiée'}
                          {agency.address ? ` — ${agency.address}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {agency.phone || 'Sans téléphone'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {agency.managerName ? (
                          <UserAvatar
                            name={agency.managerName}
                            photoURL={
                              systemUsers.find((m) => m.uid === agency.managerId)?.photoURL
                            }
                            size="xs"
                          />
                        ) : (
                          <UserRound className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className="truncate">
                          Resp. : <strong>{agency.managerName || 'Non assigné'}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>
                          <strong>{personnelCount}</strong> membre{personnelCount > 1 ? 's' : ''} affecté{personnelCount > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(agency)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Modifier
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === agency.id}
                      onClick={() => setConfirmDeleteAgency(agency)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Supprimer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de confirmation de suppression */}
      {confirmDeleteAgency && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Supprimer l'agence « {confirmDeleteAgency.name} » ?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Cette action retirera l'agence ({confirmDeleteAgency.id}) de la liste active du réseau Ets AMANI.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteAgency(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={deletingId === confirmDeleteAgency.id}
                onClick={() => void handleConfirmDelete()}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingId === confirmDeleteAgency.id ? 'Suppression...' : 'Confirmer la suppression'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
