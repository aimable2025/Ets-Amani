import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Building2,
  CheckCheck,
  CheckCircle2,
  Globe,
  Hash,
  Lock,
  MessageSquare,
  Paperclip,
  Send,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import type { LocalBroadcast, LocalChatMessage } from '../../../lib/db';
import { getAgencies, type Agency } from '../../../services/AgencyService';
import { getAllSystemUsers, type ManagedUser } from '../../../services/SystemUserService';
import {
  acknowledgeBroadcast,
  createBroadcast,
  generateIntelligentBusinessAnalysis,
  getAuthorizedBroadcasts,
  getAuthorizedChatMessages,
  markChatMessageAsRead,
  sendChatMessage,
} from '../../../services/EnterpriseOperationsService';
import { triggerSyncNow } from '../../../services/SyncWorker';

interface ChatModuleProps {
  onClose?: () => void;
}

type ActiveTab = 'chat' | 'ai_assistant' | 'broadcasts';

export default function ChatModule({ onClose }: ChatModuleProps) {
  const { user } = useAuth();
  const isGlobalRole =
    user?.role === 'administrateur_systeme' || user?.role === 'directeur_general';
  const canBroadcast =
    isGlobalRole || user?.role === 'administrateur_agence';

  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [broadcasts, setBroadcasts] = useState<LocalBroadcast[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [usersList, setUsersList] = useState<ManagedUser[]>([]);

  // Sélection du canal de discussion
  const [channelType, setChannelType] = useState<LocalChatMessage['channelType']>('global');
  const [selectedServiceTag, setSelectedServiceTag] = useState<string>('guichetier');
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>('');
  const [messageText, setMessageText] = useState('');
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [Sending, setSending] = useState(false);

  // Assistant Intelligent Métier
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiHistory, setAiHistory] = useState<Array<{ role: 'user' | 'assistant'; text: string; time: number }>>([
    {
      role: 'assistant',
      text: "Bonjour ! Je suis l'Assistant Analytique Interne Ets AMANI. Posez-moi une question sur votre trésorerie, vos écarts de billetage, vos opérations en attente, vos dettes ou vos transferts inter-agences.",
      time: Date.now(),
    },
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Création d'une diffusion officielle
  const [showBroadcastForm, setShowBroadcastForm] = useState(false);
  const [bcTitle, setBcTitle] = useState('');
  const [bcMessage, setBcMessage] = useState('');
  const [bcSeverity, setBcSeverity] = useState<LocalBroadcast['severity']>('important');
  const [bcScope, setBcScope] = useState<LocalBroadcast['scope']>(
    isGlobalRole ? 'global' : 'agence'
  );
  const [bcAgencyId, setBcAgencyId] = useState<string>(user?.agencyId || '');
  const [bcRequiresAck, setBcRequiresAck] = useState(true);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const loadAll = async () => {
    if (!user) return;
    try {
      const [msgs, bcs, ags, usrs] = await Promise.all([
        getAuthorizedChatMessages(user),
        getAuthorizedBroadcasts(user),
        getAgencies(),
        getAllSystemUsers(),
      ]);
      setMessages(msgs);
      setBroadcasts(bcs);
      setAgencies(ags);
      setUsersList(usrs.filter((u) => u.uid !== user.uid));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void loadAll();
    const interval = setInterval(loadAll, 6000);
    return () => clearInterval(interval);
  }, [user?.uid, user?.agencyId]);

  const currentChannelId = useMemo(() => {
    if (channelType === 'global') return 'channel-global';
    if (channelType === 'agence') return `channel-agency-${user?.agencyId || 'centrale'}`;
    if (channelType === 'groupe') return 'channel-direction-coordinateurs';
    if (channelType === 'service') return `channel-service-${selectedServiceTag}`;
    if (channelType === 'prive') {
      const ids = [user?.uid || '', selectedRecipientId || 'none'].sort();
      return `channel-dm-${ids.join('-')}`;
    }
    return 'channel-global';
  }, [channelType, user?.agencyId, user?.uid, selectedServiceTag, selectedRecipientId]);

  const currentChannelName = useMemo(() => {
    if (channelType === 'global') return 'Canal Général Réseau Ets AMANI';
    if (channelType === 'agence') return `Canal Agence (${user?.agencyId || 'Locale'})`;
    if (channelType === 'groupe') return 'Groupe Coordination Direction & Agences';
    if (channelType === 'service') return `Canal Service : ${selectedServiceTag}`;
    if (channelType === 'prive') {
      const target = usersList.find((u) => u.uid === selectedRecipientId);
      return target ? `Discussion privée • ${target.displayName}` : 'Discussion privée';
    }
    return 'Canal Général';
  }, [channelType, user?.agencyId, selectedServiceTag, selectedRecipientId, usersList]);

  const channelMessages = useMemo(() => {
    return messages.filter((m) => {
      if (channelType === 'global') return m.channelType === 'global';
      if (channelType === 'agence') return m.channelType === 'agence';
      if (channelType === 'groupe') return m.channelType === 'groupe';
      if (channelType === 'service') {
        return m.channelType === 'service' && (!m.serviceTag || m.serviceTag === selectedServiceTag);
      }
      if (channelType === 'prive') {
        if (!selectedRecipientId) return m.channelType === 'prive';
        return (
          m.channelType === 'prive' &&
          ((m.senderId === user?.uid && m.recipientId === selectedRecipientId) ||
            (m.senderId === selectedRecipientId && m.recipientId === user?.uid))
        );
      }
      return true;
    });
  }, [messages, channelType, selectedServiceTag, selectedRecipientId, user?.uid]);

  // Marquer automatiquement comme lus les messages affichés
  useEffect(() => {
    if (!user) return;
    channelMessages.forEach((m) => {
      if (!m.readBy?.includes(user.uid)) {
        void markChatMessageAsRead(m.id, user.uid);
      }
    });
  }, [channelMessages, user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !messageText.trim()) return;
    setSending(true);
    try {
      const recipient = usersList.find((u) => u.uid === selectedRecipientId);
      await sendChatMessage(
        {
          channelType,
          channelId: currentChannelId,
          channelName: currentChannelName,
          agencyId: user.agencyId || null,
          recipientId: channelType === 'prive' ? selectedRecipientId || null : null,
          recipientName: channelType === 'prive' ? recipient?.displayName || null : null,
          serviceTag: channelType === 'service' ? selectedServiceTag : null,
          content: messageText,
          attachmentType: attachmentName ? 'document' : 'none',
          attachmentName,
        },
        user
      );
      setMessageText('');
      setAttachmentName(null);
      await loadAll();
      void triggerSyncNow();
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } finally {
      setSending(false);
    }
  };

  const handleAskAssistant = async (customQuestion?: string) => {
    const q = (customQuestion || aiPrompt).trim();
    if (!user || !q) return;
    setAiPrompt('');
    setAiHistory((prev) => [...prev, { role: 'user', text: q, time: Date.now() }]);
    setIsAnalyzing(true);
    try {
      const reply = await generateIntelligentBusinessAnalysis(q, user);
      setAiHistory((prev) => [...prev, { role: 'assistant', text: reply, time: Date.now() }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !bcTitle.trim() || !bcMessage.trim()) return;
    const targetAg = agencies.find((a) => a.id === bcAgencyId);
    await createBroadcast(
      {
        title: bcTitle,
        message: bcMessage,
        severity: bcSeverity,
        scope: bcScope,
        agencyId: bcScope === 'global' ? null : bcAgencyId || user.agencyId || null,
        agencyName:
          bcScope === 'global'
            ? 'Réseau Global Ets AMANI'
            : targetAg?.name || user.agencyId || 'Agence Locale',
        requiresAck: bcRequiresAck,
        requiresReadConfirmation: true,
        blockingUntilAck: bcSeverity === 'critique',
      },
      user
    );
    setBcTitle('');
    setBcMessage('');
    setShowBroadcastForm(false);
    await loadAll();
    void triggerSyncNow();
  };

  const handleAckBroadcast = async (bcId: string) => {
    if (!user) return;
    await acknowledgeBroadcast(bcId, user);
    await loadAll();
    void triggerSyncNow();
  };

  const unacknowledgedCount = useMemo(() => {
    if (!user) return 0;
    return broadcasts.filter(
      (b) => b.requiresAck && !b.acknowledgedBy?.includes(user.uid)
    ).length;
  }, [broadcasts, user]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">
              Communication Interne, Annonces & Assistant Métier
            </h2>
            <p className="text-xs text-slate-500">
              Canaux Privé, Groupe, Agence, Service, Global & Synthèse Intelligente Offline-First
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              activeTab === 'chat'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Chat Interne ({messages.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ai_assistant')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              activeTab === 'ai_assistant'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Chat Intelligent Métier
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('broadcasts')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              activeTab === 'broadcasts'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <Bell className="h-3.5 w-3.5" />
            Annonces Officielles
            {unacknowledgedCount > 0 && (
              <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] text-white">
                {unacknowledgedCount}
              </span>
            )}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ONGLET 1 : CHAT INTERNE MULTI-CANAUX */}
      {activeTab === 'chat' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Sélecteur de type de conversation */}
          <div className="space-y-3 lg:col-span-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Canaux de conversation
            </p>
            <div className="space-y-1.5">
              {(
                [
                  { id: 'global', label: 'Global (Tout Ets AMANI)', icon: Globe },
                  { id: 'agence', label: 'Mon Agence Locale', icon: Building2 },
                  { id: 'groupe', label: 'Groupe Coordination', icon: Users },
                  { id: 'service', label: 'Par Service Opérationnel', icon: Hash },
                  { id: 'prive', label: 'Message Privé Direct', icon: Lock },
                ] as const
              ).map((ch) => {
                const Icon = ch.icon;
                const active = channelType === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setChannelType(ch.id)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-xs font-bold transition ${
                      active
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{ch.label}</span>
                  </button>
                );
              })}
            </div>

            {channelType === 'service' && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Choisir le service :
                </label>
                <select
                  value={selectedServiceTag}
                  onChange={(e) => setSelectedServiceTag(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold"
                >
                  <option value="guichetier">Guichet & Caisse</option>
                  <option value="comptable">Comptabilité & Audit</option>
                  <option value="agent_operateur_mobile">Flotte & Mobile Money</option>
                  <option value="agent_change">Change USD / CDF</option>
                  <option value="agent_terrain">Opérations Terrain</option>
                </select>
              </div>
            )}

            {channelType === 'prive' && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Destinataire :
                </label>
                <select
                  value={selectedRecipientId}
                  onChange={(e) => setSelectedRecipientId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold"
                >
                  <option value="">Tous mes messages privés</option>
                  {usersList.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Fil de discussion */}
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 lg:col-span-8">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 rounded-t-2xl">
              <div>
                <h3 className="text-xs font-black text-slate-900">{currentChannelName}</h3>
                <p className="text-[11px] text-slate-500">
                  Synchronisation Offline-First active ({channelMessages.length} message(s))
                </p>
              </div>
            </div>

            <div className="h-80 overflow-y-auto p-4 space-y-3">
              {channelMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                  <MessageSquare className="h-8 w-8 mb-2 text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">
                    Aucun message dans ce canal
                  </p>
                  <p className="text-[11px]">
                    Envoyez le premier message à votre équipe.
                  </p>
                </div>
              ) : (
                channelMessages.map((msg) => {
                  const isMe = msg.senderId === user?.uid;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-xs ${
                          isMe
                            ? 'bg-slate-900 text-white'
                            : 'border border-slate-200 bg-white text-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold">{msg.senderName}</span>
                          <span className="opacity-70 text-[10px] uppercase">
                            ({msg.senderRole})
                          </span>
                        </div>
                        <p className="whitespace-pre-line">{msg.content}</p>
                        {msg.attachmentName && (
                          <div className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[10px] font-semibold">
                            <Paperclip className="h-3 w-3" />
                            <span>{msg.attachmentName}</span>
                          </div>
                        )}
                        <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] opacity-70">
                          <span>
                            {new Date(msg.createdAt).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <CheckCheck className="h-3 w-3" />
                          <span>{msg.readBy?.length || 1} lu(s)</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            <form
              onSubmit={handleSendMessage}
              className="border-t border-slate-200 bg-white p-3 rounded-b-2xl space-y-2"
            >
              {attachmentName && (
                <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-1 text-xs text-blue-800">
                  <span>Pièce jointe : {attachmentName}</span>
                  <button type="button" onClick={() => setAttachmentName(null)}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <label className="cursor-pointer rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
                  <Paperclip className="h-4 w-4" />
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setAttachmentName(f.name);
                    }}
                  />
                </label>
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Écrire un message opérationnel..."
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={Sending || !messageText.trim()}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  Envoyer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ONGLET 2 : CHAT INTELLIGENT METIER */}
      {activeTab === 'ai_assistant' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              'Quel est l’état actuel de la trésorerie et des caisses ?',
              'Y a-t-il des écarts de billetage ou risques à contrôler ?',
              'Point sur les dettes actives et transferts inter-agences',
              'Synthèse des missions et opérations en attente',
            ].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleAskAssistant(q)}
                className="rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            {aiHistory.map((item, idx) => (
              <div
                key={idx}
                className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs whitespace-pre-line ${
                    item.role === 'user'
                      ? 'bg-slate-900 text-white'
                      : 'border border-blue-200 bg-white text-slate-800 shadow-xs'
                  }`}
                >
                  {item.text}
                </div>
              </div>
            ))}
            {isAnalyzing && (
              <div className="text-xs font-semibold text-blue-600 animate-pulse">
                Analyse des tables locales Dexie en cours...
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleAskAssistant();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Posez une question sur la caisse, les opérations, les dettes..."
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={!aiPrompt.trim() || isAnalyzing}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              Analyser
            </button>
          </form>
        </div>
      )}

      {/* ONGLET 3 : DIFFUSIONS & ANNONCES OFFICIELLES */}
      {activeTab === 'broadcasts' && (
        <div className="space-y-4">
          {canBroadcast && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowBroadcastForm((v) => !v)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                {showBroadcastForm ? 'Fermer le formulaire' : '+ Nouvelle Diffusion Officielle'}
              </button>
            </div>
          )}

          {showBroadcastForm && canBroadcast && (
            <form
              onSubmit={handleCreateBroadcast}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3"
            >
              <h3 className="text-xs font-bold text-slate-900">
                Publier une note de service / alerte réseau
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  type="text"
                  required
                  value={bcTitle}
                  onChange={(e) => setBcTitle(e.target.value)}
                  placeholder="Titre de l'annonce officielle"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <select
                  value={bcSeverity}
                  onChange={(e) => setBcSeverity(e.target.value as LocalBroadcast['severity'])}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                >
                  <option value="info">Information standard</option>
                  <option value="important">Important</option>
                  <option value="critique">Critique (Accusé prioritaire)</option>
                </select>
                {isGlobalRole ? (
                  <select
                    value={bcScope}
                    onChange={(e) => setBcScope(e.target.value as LocalBroadcast['scope'])}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                  >
                    <option value="global">Tout le Réseau Ets AMANI</option>
                    <option value="agence">Agence spécifique</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled
                    value={`Agence : ${user?.agencyId || 'Locale'}`}
                    className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs"
                  />
                )}
              </div>

              {isGlobalRole && bcScope === 'agence' && (
                <select
                  value={bcAgencyId}
                  onChange={(e) => setBcAgencyId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">Sélectionner l'agence cible</option>
                  {agencies.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.code})
                    </option>
                  ))}
                </select>
              )}

              <textarea
                rows={2}
                required
                value={bcMessage}
                onChange={(e) => setBcMessage(e.target.value)}
                placeholder="Contenu détaillé de l'instruction ou annonce..."
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs"
              />

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={bcRequiresAck}
                    onChange={(e) => setBcRequiresAck(e.target.checked)}
                  />
                  Exiger un accusé de lecture nominatif
                </label>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                >
                  Diffuser maintenant
                </button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {broadcasts.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">
                Aucune annonce officielle enregistrée.
              </p>
            ) : (
              broadcasts.map((bc) => {
                const acked = user ? bc.acknowledgedBy?.includes(user.uid) : false;
                return (
                  <div
                    key={bc.id}
                    className={`rounded-2xl border p-4 text-xs ${
                      bc.severity === 'critique'
                        ? 'border-red-300 bg-red-50/70'
                        : bc.severity === 'important'
                          ? 'border-amber-300 bg-amber-50/60'
                          : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <span className="font-black text-sm text-slate-900">
                            {bc.title}
                          </span>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                            {bc.severity} • {bc.agencyName || 'Global'}
                          </span>
                        </div>
                        <p className="text-slate-700 whitespace-pre-line">{bc.message}</p>
                        <p className="text-[11px] text-slate-500">
                          Par {bc.authorName} • {new Date(bc.createdAt).toLocaleString('fr-FR')} •{' '}
                          {bc.acknowledgedBy?.length || 0} confirmation(s) de lecture
                        </p>
                      </div>

                      {bc.requiresAck && (
                        <div className="shrink-0">
                          {acked ? (
                            <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-100 px-3 py-1.5 font-bold text-emerald-800">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Lecture confirmée
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAckBroadcast(bc.id)}
                              className="rounded-xl bg-slate-900 px-3.5 py-2 font-bold text-white hover:bg-slate-800"
                            >
                              Accuser réception
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
