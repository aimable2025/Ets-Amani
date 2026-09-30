import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Building2,
  CheckCheck,
  CheckCircle2,
  Copy,
  CornerUpRight,
  Globe,
  Hash,
  Lock,
  MessageCircle,
  MessageSquare,
  Paperclip,
  Plus,
  Reply,
  Search,
  Send,
  Share2,
  SmilePlus,
  Sparkles,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import type { LocalBroadcast, LocalChatMessage } from '../../../lib/db';
import { getAgencies, type Agency } from '../../../services/AgencyService';
import { getAllSystemUsers, type ManagedUser } from '../../../services/SystemUserService';
import {
  acknowledgeBroadcast,
  addChatMessageComment,
  createBroadcast,
  generateIntelligentBusinessAnalysis,
  getAuthorizedBroadcasts,
  getAuthorizedChatMessages,
  markChatMessageAsRead,
  sendChatMessage,
  toggleChatMessageReaction,
} from '../../../services/EnterpriseOperationsService';
import { triggerSyncNow } from '../../../services/SyncWorker';

interface ChatModuleProps {
  onClose?: () => void;
}

type ActiveTab = 'chat' | 'ai_assistant' | 'broadcasts';

const QUICK_REACTIONS = ['👍', '❤️', '✅', '🙏', '🔥', '⚠️'] as const;

const ETS_SERVICES = [
  { id: 'guichetier', label: 'Guichet & Caisse' },
  { id: 'comptable', label: 'Comptabilité & Audit' },
  { id: 'agent_operateur_mobile', label: 'Flotte & Mobile Money' },
  { id: 'agent_change', label: 'Change USD / CDF' },
  { id: 'agent_terrain', label: 'Opérations Terrain' },
  { id: 'service_paie', label: 'Service Paie & Salaires' },
  { id: 'administration_agence', label: 'Administration Agence' },
  { id: 'direction_generale', label: 'Direction Générale' },
] as const;

interface CustomChatGroup {
  id: string;
  name: string;
  participantIds: string[];
  participantNames: string[];
}

const DEFAULT_GROUPS: CustomChatGroup[] = [
  {
    id: 'grp-coordination',
    name: 'Coordination Direction & Agences',
    participantIds: [],
    participantNames: ['Direction Générale', 'Coordinateurs Agences'],
  },
  {
    id: 'grp-tresorerie',
    name: 'Équipe Trésorerie & Billetage',
    participantIds: [],
    participantNames: ['Caissiers', 'Guichetiers', 'Comptabilité'],
  },
  {
    id: 'grp-mobile-money',
    name: 'Opérateurs Flotte & Mobile Money',
    participantIds: [],
    participantNames: ['Opérateurs Mobile', 'Superviseurs SMS'],
  },
];

const CUSTOM_GROUPS_STORAGE_KEY = 'ets_amani_custom_chat_groups_v1';

function loadSavedGroups(): CustomChatGroup[] {
  if (typeof window === 'undefined') return DEFAULT_GROUPS;
  try {
    const raw = window.localStorage.getItem(CUSTOM_GROUPS_STORAGE_KEY);
    if (!raw) return DEFAULT_GROUPS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_GROUPS;
    return [...DEFAULT_GROUPS, ...parsed];
  } catch {
    return DEFAULT_GROUPS;
  }
}

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

  // Sélection du destinataire / canal de discussion
  const [channelType, setChannelType] = useState<LocalChatMessage['channelType']>('global');
  const [selectedServiceTag, setSelectedServiceTag] = useState<string>('guichetier');
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>('');
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');

  // Gestion des groupes (prédéfinis + personnalisés)
  const [groups, setGroups] = useState<CustomChatGroup[]>(loadSavedGroups);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('grp-coordination');
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMemberIds, setNewGroupMemberIds] = useState<string[]>([]);

  // Rédaction, Réponse (Reply), Réactions, Commentaires et Partage/Transfert
  const [messageText, setMessageText] = useState('');
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<LocalChatMessage | null>(null);
  const [openReactionPickerMsgId, setOpenReactionPickerMsgId] = useState<string | null>(null);
  const [openCommentsMsgIds, setOpenCommentsMsgIds] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [sharingMessage, setSharingMessage] = useState<LocalChatMessage | null>(null);
  const [shareTargetType, setShareTargetType] =
    useState<LocalChatMessage['channelType']>('prive');
  const [shareRecipientId, setShareRecipientId] = useState<string>('');
  const [shareServiceTag, setShareServiceTag] = useState<string>('guichetier');
  const [shareGroupId, setShareGroupId] = useState<string>('grp-coordination');
  const [shareNote, setShareNote] = useState<string>('');
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Assistant Intelligent Métier
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiHistory, setAiHistory] = useState<
    Array<{ role: 'user' | 'assistant'; text: string; time: number }>
  >([
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
  const messageInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => {
      setFeedbackToast((cur) => (cur === msg ? null : cur));
    }, 3200);
  };

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
    const interval = setInterval(loadAll, 5000);
    return () => clearInterval(interval);
  }, [user?.uid, user?.agencyId]);

  const filteredUsers = useMemo(() => {
    if (!userSearchQuery.trim()) return usersList;
    const q = userSearchQuery.toLowerCase();
    return usersList.filter(
      (u) =>
        (u.displayName || '').toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q) ||
        (u.function || '').toLowerCase().includes(q) ||
        (u.agencyId || '').toLowerCase().includes(q)
    );
  }, [usersList, userSearchQuery]);

  const activeGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) || groups[0],
    [groups, selectedGroupId]
  );

  const activeServiceLabel = useMemo(
    () =>
      ETS_SERVICES.find((s) => s.id === selectedServiceTag)?.label ||
      selectedServiceTag,
    [selectedServiceTag]
  );

  const currentChannelId = useMemo(() => {
    if (channelType === 'global') return 'channel-global';
    if (channelType === 'agence') return `channel-agency-${user?.agencyId || 'centrale'}`;
    if (channelType === 'groupe') return `channel-group-${activeGroup?.id || 'coordination'}`;
    if (channelType === 'service') return `channel-service-${selectedServiceTag}`;
    if (channelType === 'prive') {
      const ids = [user?.uid || '', selectedRecipientId || 'none'].sort();
      return `channel-dm-${ids.join('-')}`;
    }
    return 'channel-global';
  }, [channelType, user?.agencyId, user?.uid, activeGroup, selectedServiceTag, selectedRecipientId]);

  const currentChannelName = useMemo(() => {
    if (channelType === 'global') return 'Canal Général Réseau Ets AMANI';
    if (channelType === 'agence') return `Canal Agence (${user?.agencyId || 'Locale'})`;
    if (channelType === 'groupe') {
      return `Groupe : ${activeGroup?.name || 'Coordination'}`;
    }
    if (channelType === 'service') {
      return `Service : ${activeServiceLabel}`;
    }
    if (channelType === 'prive') {
      const target = usersList.find((u) => u.uid === selectedRecipientId);
      return target
        ? `Destinataire : ${target.displayName} (${target.function || target.role})`
        : 'Tous mes messages privés directs';
    }
    return 'Canal Général';
  }, [
    channelType,
    user?.agencyId,
    activeGroup,
    activeServiceLabel,
    selectedRecipientId,
    usersList,
  ]);

  const channelMessages = useMemo(() => {
    return messages.filter((m) => {
      if (channelType === 'global') return m.channelType === 'global';
      if (channelType === 'agence') return m.channelType === 'agence';
      if (channelType === 'groupe') {
        if (m.channelType !== 'groupe') return false;
        if (activeGroup?.id === 'grp-coordination' && m.channelId === 'channel-direction-coordinateurs') {
          return true;
        }
        return m.channelId === currentChannelId || m.groupName === activeGroup?.name;
      }
      if (channelType === 'service') {
        return (
          m.channelType === 'service' &&
          (!m.serviceTag || m.serviceTag === selectedServiceTag)
        );
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
  }, [
    messages,
    channelType,
    selectedServiceTag,
    selectedRecipientId,
    user?.uid,
    activeGroup,
    currentChannelId,
  ]);

  // Marquer automatiquement comme lus les messages affichés
  useEffect(() => {
    if (!user) return;
    channelMessages.forEach((m) => {
      if (!m.readBy?.includes(user.uid)) {
        void markChatMessageAsRead(m.id, user.uid);
      }
    });
  }, [channelMessages, user]);

  const handleCreateCustomGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !user) return;
    const selectedUsers = usersList.filter((u) => newGroupMemberIds.includes(u.uid));
    const participantIds = Array.from(new Set([user.uid, ...selectedUsers.map((u) => u.uid)]));
    const participantNames = [
      user.displayName || 'Moi',
      ...selectedUsers.map((u) => u.displayName || u.email || 'Membre'),
    ];
    const customGroup: CustomChatGroup = {
      id: `grp-${Date.now()}`,
      name: newGroupName.trim(),
      participantIds,
      participantNames,
    };

    const existingCustom = groups.filter(
      (g) => !DEFAULT_GROUPS.some((dg) => dg.id === g.id)
    );
    const updatedCustom = [...existingCustom, customGroup];
    try {
      window.localStorage.setItem(CUSTOM_GROUPS_STORAGE_KEY, JSON.stringify(updatedCustom));
    } catch {
      // ignore
    }
    setGroups([...DEFAULT_GROUPS, ...updatedCustom]);
    setSelectedGroupId(customGroup.id);
    setChannelType('groupe');
    setNewGroupName('');
    setNewGroupMemberIds([]);
    setShowCreateGroupModal(false);
    showToast(`Groupe « ${customGroup.name} » créé et sélectionné.`);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !messageText.trim()) return;
    if (channelType === 'prive' && !selectedRecipientId) {
      showToast('Veuillez sélectionner un utilisateur destinataire.');
      return;
    }

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
          recipientName:
            channelType === 'prive' ? recipient?.displayName || null : null,
          serviceTag: channelType === 'service' ? selectedServiceTag : null,
          groupName: channelType === 'groupe' ? activeGroup?.name || null : null,
          groupParticipantIds:
            channelType === 'groupe' ? activeGroup?.participantIds || [] : [],
          groupParticipantNames:
            channelType === 'groupe' ? activeGroup?.participantNames || [] : [],
          replyToMessageId: replyingTo?.id || null,
          replyToSenderName: replyingTo?.senderName || null,
          replyToExcerpt: replyingTo
            ? replyingTo.content.slice(0, 120)
            : null,
          content: messageText,
          attachmentType: attachmentName ? 'document' : 'none',
          attachmentName,
        },
        user
      );
      setMessageText('');
      setAttachmentName(null);
      setReplyingTo(null);
      await loadAll();
      void triggerSyncNow();
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } finally {
      setSending(false);
    }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    await toggleChatMessageReaction(messageId, emoji, user.uid);
    setOpenReactionPickerMsgId(null);
    await loadAll();
    void triggerSyncNow();
  };

  const handleAddComment = async (messageId: string) => {
    if (!user) return;
    const text = (commentInputs[messageId] || '').trim();
    if (!text) return;
    await addChatMessageComment(messageId, text, user);
    setCommentInputs((prev) => ({ ...prev, [messageId]: '' }));
    setOpenCommentsMsgIds((prev) => ({ ...prev, [messageId]: true }));
    await loadAll();
    void triggerSyncNow();
  };

  const handleReplyToMessage = (msg: LocalChatMessage) => {
    setReplyingTo(msg);
    messageInputRef.current?.focus();
  };

  const handleCopyMessage = async (msg: LocalChatMessage) => {
    const formatted = `[Ets AMANI • ${msg.senderName}] : ${msg.content}`;
    try {
      await navigator.clipboard.writeText(formatted);
      showToast('Message copié dans le presse-papiers.');
    } catch {
      showToast('Copie effectuée.');
    }
  };

  const handleConfirmForwardMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !sharingMessage) return;

    if (shareTargetType === 'prive' && !shareRecipientId) {
      showToast('Veuillez choisir un utilisateur destinataire pour le partage.');
      return;
    }

    const recipient = usersList.find((u) => u.uid === shareRecipientId);
    const targetGroup = groups.find((g) => g.id === shareGroupId) || groups[0];
    const targetService =
      ETS_SERVICES.find((s) => s.id === shareServiceTag)?.label || shareServiceTag;

    let targetChannelId = 'channel-global';
    let targetChannelName = 'Canal Général Réseau Ets AMANI';
    if (shareTargetType === 'agence') {
      targetChannelId = `channel-agency-${user.agencyId || 'centrale'}`;
      targetChannelName = `Canal Agence (${user.agencyId || 'Locale'})`;
    } else if (shareTargetType === 'groupe') {
      targetChannelId = `channel-group-${targetGroup.id}`;
      targetChannelName = `Groupe : ${targetGroup.name}`;
    } else if (shareTargetType === 'service') {
      targetChannelId = `channel-service-${shareServiceTag}`;
      targetChannelName = `Service : ${targetService}`;
    } else if (shareTargetType === 'prive') {
      const ids = [user.uid, shareRecipientId].sort();
      targetChannelId = `channel-dm-${ids.join('-')}`;
      targetChannelName = `Destinataire : ${recipient?.displayName || 'Utilisateur'}`;
    }

    const forwardedContent = shareNote.trim()
      ? `${shareNote.trim()}\n\n— Message partagé de ${sharingMessage.senderName} :\n« ${sharingMessage.content} »`
      : sharingMessage.content;

    await sendChatMessage(
      {
        channelType: shareTargetType,
        channelId: targetChannelId,
        channelName: targetChannelName,
        agencyId: user.agencyId || null,
        recipientId: shareTargetType === 'prive' ? shareRecipientId : null,
        recipientName:
          shareTargetType === 'prive' ? recipient?.displayName || null : null,
        serviceTag: shareTargetType === 'service' ? shareServiceTag : null,
        groupName: shareTargetType === 'groupe' ? targetGroup.name : null,
        groupParticipantIds:
          shareTargetType === 'groupe' ? targetGroup.participantIds : [],
        groupParticipantNames:
          shareTargetType === 'groupe' ? targetGroup.participantNames : [],
        forwardedFromSenderName: sharingMessage.senderName,
        content: forwardedContent,
        attachmentType: sharingMessage.attachmentType || 'none',
        attachmentName: sharingMessage.attachmentName || null,
      },
      user
    );

    setSharingMessage(null);
    setShareNote('');
    await loadAll();
    void triggerSyncNow();
    showToast(`Message partagé vers ${targetChannelName}.`);
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
              Destinataires au choix (Utilisateur, Service, Groupe, Agence, Global) • Réactions, Réponses, Commentaires & Partage
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

      {feedbackToast && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{feedbackToast}</span>
          </div>
          <button type="button" onClick={() => setFeedbackToast(null)}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ONGLET 1 : CHAT INTERNE MULTI-CANAUX */}
      {activeTab === 'chat' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Colonne gauche : Choix du Destinataire (Utilisateur, Service, Groupe, Agence, Global) */}
          <div className="space-y-4 lg:col-span-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                1. Type de destinataire
              </p>
              <div className="space-y-1.5">
                {(
                  [
                    {
                      id: 'prive',
                      label: 'Utilisateur Ets AMANI (Privé)',
                      icon: Lock,
                      badge: `${usersList.length} membre(s)`,
                    },
                    {
                      id: 'service',
                      label: 'Service en particulier',
                      icon: Hash,
                      badge: `${ETS_SERVICES.length} services`,
                    },
                    {
                      id: 'groupe',
                      label: 'Chat en Groupe',
                      icon: Users,
                      badge: `${groups.length} groupes`,
                    },
                    {
                      id: 'agence',
                      label: 'Canal de mon Agence',
                      icon: Building2,
                    },
                    {
                      id: 'global',
                      label: 'Réseau Global Ets AMANI',
                      icon: Globe,
                    },
                  ] as const
                ).map((ch) => {
                  const Icon = ch.icon;
                  const active = channelType === ch.id;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setChannelType(ch.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-left text-xs font-bold transition ${
                        active
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{ch.label}</span>
                      </div>
                      {'badge' in ch && ch.badge && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            active
                              ? 'bg-white/15 text-white'
                              : 'bg-slate-200/70 text-slate-600'
                          }`}
                        >
                          {ch.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sélection d'un utilisateur précis de l'application Ets AMANI */}
            {channelType === 'prive' && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5 text-blue-600" />
                    Choisir l'utilisateur destinataire :
                  </label>
                  {selectedRecipientId && (
                    <button
                      type="button"
                      onClick={() => setSelectedRecipientId('')}
                      className="text-[10px] font-bold text-blue-600 hover:underline"
                    >
                      Voir tous
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Rechercher par nom, rôle, fonction..."
                    className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs outline-none focus:border-slate-900"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {filteredUsers.length === 0 ? (
                    <p className="py-3 text-center text-[11px] text-slate-400">
                      Aucun utilisateur trouvé.
                    </p>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSelected = selectedRecipientId === u.uid;
                      return (
                        <button
                          key={u.uid}
                          type="button"
                          onClick={() => setSelectedRecipientId(u.uid)}
                          className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition ${
                            isSelected
                              ? 'bg-blue-600 text-white font-bold shadow-xs'
                              : 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-200/70'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-bold">{u.displayName}</p>
                            <p
                              className={`truncate text-[10px] ${
                                isSelected ? 'text-blue-100' : 'text-slate-500'
                              }`}
                            >
                              {u.function || u.role}
                              {u.agencyId ? ` • ${u.agencyId}` : ''}
                            </p>
                          </div>
                          <span
                            className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                              isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            Choisir
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Sélection d'un service particulier */}
            {channelType === 'service' && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                <label className="block text-[11px] font-bold text-slate-700">
                  Choisir le service destinataire :
                </label>
                <div className="space-y-1">
                  {ETS_SERVICES.map((srv) => {
                    const active = selectedServiceTag === srv.id;
                    return (
                      <button
                        key={srv.id}
                        type="button"
                        onClick={() => setSelectedServiceTag(srv.id)}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${
                          active
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/70'
                        }`}
                      >
                        <span># {srv.label}</span>
                        {active && <CheckCircle2 className="h-3.5 w-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sélection ou création d'un groupe */}
            {channelType === 'groupe' && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700">
                    Groupes de discussion :
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCreateGroupModal((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-slate-800"
                  >
                    <Plus className="h-3 w-3" />
                    Nouveau groupe
                  </button>
                </div>

                {showCreateGroupModal && (
                  <form
                    onSubmit={handleCreateCustomGroup}
                    className="rounded-xl border border-blue-200 bg-white p-3 space-y-2"
                  >
                    <p className="text-[11px] font-bold text-slate-800">
                      Créer un groupe personnalisé
                    </p>
                    <input
                      type="text"
                      required
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Nom du groupe (ex: Comité Caisse)"
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                    />
                    <p className="text-[10px] font-semibold text-slate-500">
                      Sélectionner les membres ({newGroupMemberIds.length}) :
                    </p>
                    <div className="max-h-28 overflow-y-auto space-y-1 border border-slate-100 rounded-lg p-1.5">
                      {usersList.map((u) => {
                        const checked = newGroupMemberIds.includes(u.uid);
                        return (
                          <label
                            key={u.uid}
                            className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer hover:bg-slate-50 px-1.5 py-1 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewGroupMemberIds((prev) => [...prev, u.uid]);
                                } else {
                                  setNewGroupMemberIds((prev) =>
                                    prev.filter((id) => id !== u.uid)
                                  );
                                }
                              }}
                            />
                            <span className="truncate font-medium">
                              {u.displayName} ({u.function || u.role})
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowCreateGroupModal(false)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-600"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        className="rounded-lg bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white"
                      >
                        Créer le groupe
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-1">
                  {groups.map((grp) => {
                    const active = selectedGroupId === grp.id;
                    return (
                      <button
                        key={grp.id}
                        type="button"
                        onClick={() => setSelectedGroupId(grp.id)}
                        className={`flex w-full flex-col rounded-xl px-3 py-2 text-left text-xs transition ${
                          active
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-200/70'
                        }`}
                      >
                        <span className="font-bold">{grp.name}</span>
                        <span
                          className={`truncate text-[10px] ${
                            active ? 'text-blue-100' : 'text-slate-500'
                          }`}
                        >
                          {grp.participantNames.join(', ')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Colonne droite : Fil de discussion interactif */}
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 lg:col-span-8">
            {/* Barre supérieure du canal & sélecteur rapide de destinataire */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3 rounded-t-2xl">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <h3 className="text-xs font-black text-slate-900">
                    {currentChannelName}
                  </h3>
                </div>
                <p className="text-[11px] text-slate-500">
                  {channelMessages.length} message(s) • Réactions, commentaires, réponses et transfert actifs
                </p>
              </div>

              {/* Sélecteur rapide de destinataire dans l'en-tête du chat */}
              <div className="flex flex-wrap items-center gap-1.5">
                <select
                  value={channelType}
                  onChange={(e) =>
                    setChannelType(e.target.value as LocalChatMessage['channelType'])
                  }
                  aria-label="Type de destinataire"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold text-slate-800"
                >
                  <option value="prive">Destinataire : Utilisateur</option>
                  <option value="service">Destinataire : Service</option>
                  <option value="groupe">Destinataire : Groupe</option>
                  <option value="agence">Destinataire : Mon Agence</option>
                  <option value="global">Destinataire : Global</option>
                </select>

                {channelType === 'prive' && (
                  <select
                    value={selectedRecipientId}
                    onChange={(e) => setSelectedRecipientId(e.target.value)}
                    aria-label="Choisir un utilisateur"
                    className="max-w-[190px] rounded-xl border border-blue-200 bg-blue-50/60 px-2.5 py-1.5 text-[11px] font-bold text-blue-900"
                  >
                    <option value="">-- Choisir un utilisateur --</option>
                    {usersList.map((u) => (
                      <option key={u.uid} value={u.uid}>
                        {u.displayName} ({u.function || u.role})
                      </option>
                    ))}
                  </select>
                )}

                {channelType === 'service' && (
                  <select
                    value={selectedServiceTag}
                    onChange={(e) => setSelectedServiceTag(e.target.value)}
                    aria-label="Choisir un service"
                    className="rounded-xl border border-blue-200 bg-blue-50/60 px-2.5 py-1.5 text-[11px] font-bold text-blue-900"
                  >
                    {ETS_SERVICES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                )}

                {channelType === 'groupe' && (
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    aria-label="Choisir un groupe"
                    className="rounded-xl border border-blue-200 bg-blue-50/60 px-2.5 py-1.5 text-[11px] font-bold text-blue-900"
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Liste des messages */}
            <div className="h-[420px] overflow-y-auto p-4 space-y-4">
              {channelMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                  <MessageSquare className="h-8 w-8 mb-2 text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">
                    Aucun message dans cette conversation
                  </p>
                  <p className="text-[11px]">
                    Choisissez votre destinataire (utilisateur, service ou groupe) et envoyez un message.
                  </p>
                </div>
              ) : (
                channelMessages.map((msg) => {
                  const isMe = msg.senderId === user?.uid;
                  const reactionEntries = Object.entries(msg.reactions || {}).filter(
                    ([, uids]) => Array.isArray(uids) && uids.length > 0
                  );
                  const commentsList = msg.comments || [];
                  const isCommentsOpen = Boolean(openCommentsMsgIds[msg.id]);

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`w-full sm:max-w-[85%] rounded-2xl px-4 py-3 text-xs shadow-xs ${
                          isMe
                            ? 'bg-slate-900 text-white'
                            : 'border border-slate-200 bg-white text-slate-900'
                        }`}
                      >
                        {/* En-tête expéditeur -> destinataire */}
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold">{msg.senderName}</span>
                            <span className="opacity-70 text-[10px] uppercase">
                              ({msg.senderRole})
                            </span>
                            {msg.recipientName && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  isMe
                                    ? 'bg-blue-500/30 text-blue-200'
                                    : 'bg-blue-50 text-blue-700'
                                }`}
                              >
                                → {msg.recipientName}
                              </span>
                            )}
                            {msg.serviceTag && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  isMe
                                    ? 'bg-emerald-500/30 text-emerald-200'
                                    : 'bg-emerald-50 text-emerald-700'
                                }`}
                              >
                                #{ETS_SERVICES.find((s) => s.id === msg.serviceTag)?.label || msg.serviceTag}
                              </span>
                            )}
                            {msg.groupName && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  isMe
                                    ? 'bg-purple-500/30 text-purple-200'
                                    : 'bg-purple-50 text-purple-700'
                                }`}
                              >
                                👥 {msg.groupName}
                              </span>
                            )}
                          </div>

                          {msg.forwardedFromSenderName && (
                            <span className="inline-flex items-center gap-1 text-[10px] italic opacity-75">
                              <CornerUpRight className="h-3 w-3" />
                              Transféré de {msg.forwardedFromSenderName}
                            </span>
                          )}
                        </div>

                        {/* Citation d'un message répondu */}
                        {msg.replyToExcerpt && (
                          <div
                            className={`mb-2 rounded-xl border-l-4 px-3 py-1.5 text-[11px] ${
                              isMe
                                ? 'border-blue-400 bg-white/10 text-slate-200'
                                : 'border-blue-600 bg-slate-100 text-slate-700'
                            }`}
                          >
                            <p className="font-bold text-[10px]">
                              En réponse à {msg.replyToSenderName || 'un message'} :
                            </p>
                            <p className="truncate italic opacity-90">
                              « {msg.replyToExcerpt} »
                            </p>
                          </div>
                        )}

                        {/* Contenu du message */}
                        <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>

                        {msg.attachmentName && (
                          <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-semibold border border-current/15">
                            <Paperclip className="h-3 w-3" />
                            <span>{msg.attachmentName}</span>
                          </div>
                        )}

                        {/* Pastilles de réactions actives */}
                        {reactionEntries.length > 0 && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {reactionEntries.map(([emoji, uids]) => {
                              const iReacted = user ? uids.includes(user.uid) : false;
                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => handleToggleReaction(msg.id, emoji)}
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold transition ${
                                    iReacted
                                      ? 'bg-blue-600 text-white ring-1 ring-blue-300'
                                      : isMe
                                        ? 'bg-white/15 text-white hover:bg-white/25'
                                        : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                                  }`}
                                >
                                  <span>{emoji}</span>
                                  <span>{uids.length}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Barre d'actions du message : Réagir, Répondre, Commenter, Partager, Copier */}
                        <div
                          className={`mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-[10px] ${
                            isMe ? 'border-white/15' : 'border-slate-100'
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-1">
                            {/* Bouton Réactions */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenReactionPickerMsgId((cur) =>
                                    cur === msg.id ? null : msg.id
                                  )
                                }
                                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold transition ${
                                  isMe
                                    ? 'hover:bg-white/15 text-slate-200'
                                    : 'hover:bg-slate-100 text-slate-600'
                                }`}
                                title="Réagir avec un émoji"
                              >
                                <SmilePlus className="h-3.5 w-3.5" />
                                <span>Réagir</span>
                              </button>

                              {openReactionPickerMsgId === msg.id && (
                                <div className="absolute bottom-full left-0 z-20 mb-1 flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg">
                                  {QUICK_REACTIONS.map((emoji) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() => handleToggleReaction(msg.id, emoji)}
                                      className=" rounded-xl p-1.5 text-sm hover:bg-slate-100 transition transform hover:scale-110"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Bouton Répondre */}
                            <button
                              type="button"
                              onClick={() => handleReplyToMessage(msg)}
                              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold transition ${
                                isMe
                                  ? 'hover:bg-white/15 text-slate-200'
                                  : 'hover:bg-slate-100 text-slate-600'
                              }`}
                              title="Répondre à ce message"
                            >
                              <Reply className="h-3.5 w-3.5" />
                              <span>Répondre</span>
                            </button>

                            {/* Bouton Commentaires */}
                            <button
                              type="button"
                              onClick={() =>
                                setOpenCommentsMsgIds((prev) => ({
                                  ...prev,
                                  [msg.id]: !prev[msg.id],
                                }))
                              }
                              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold transition ${
                                isMe
                                  ? 'hover:bg-white/15 text-slate-200'
                                  : 'hover:bg-slate-100 text-slate-600'
                              }`}
                              title="Afficher ou ajouter un commentaire"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              <span>
                                Commenter
                                {commentsList.length > 0 ? ` (${commentsList.length})` : ''}
                              </span>
                            </button>

                            {/* Bouton Partager / Transférer */}
                            <button
                              type="button"
                              onClick={() => {
                                setSharingMessage(msg);
                                setShareNote('');
                              }}
                              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold transition ${
                                isMe
                                  ? 'hover:bg-white/15 text-slate-200'
                                  : 'hover:bg-slate-100 text-slate-600'
                              }`}
                              title="Partager ou transférer à un utilisateur, service ou groupe"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                              <span>Partager</span>
                            </button>

                            {/* Bouton Copier */}
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(msg)}
                              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold transition ${
                                isMe
                                  ? 'hover:bg-white/15 text-slate-200'
                                  : 'hover:bg-slate-100 text-slate-600'
                              }`}
                              title="Copier le texte"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5 opacity-75">
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

                        {/* Section Commentaires sous le message */}
                        {(isCommentsOpen || commentsList.length > 0) && (
                          <div
                            className={`mt-2.5 rounded-xl p-2.5 space-y-2 ${
                              isMe
                                ? 'bg-white/10 text-white'
                                : 'bg-slate-50 border border-slate-200/80 text-slate-800'
                            }`}
                          >
                            {commentsList.length > 0 && (
                              <div className="space-y-1.5">
                                {commentsList.map((cmt) => (
                                  <div
                                    key={cmt.id}
                                    className={`rounded-lg px-2.5 py-1.5 text-[11px] ${
                                      isMe ? 'bg-slate-950/40' : 'bg-white border border-slate-200/60'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-bold">
                                        {cmt.authorName}{' '}
                                        <span className="opacity-65 text-[9px] uppercase">
                                          ({cmt.authorRole})
                                        </span>
                                      </span>
                                      <span className="text-[9px] opacity-65">
                                        {new Date(cmt.createdAt).toLocaleTimeString('fr-FR', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                    </div>
                                    <p className="mt-0.5">{cmt.content}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {isCommentsOpen && (
                              <div className="flex items-center gap-1.5 pt-1">
                                <input
                                  type="text"
                                  value={commentInputs[msg.id] || ''}
                                  onChange={(e) =>
                                    setCommentInputs((prev) => ({
                                      ...prev,
                                      [msg.id]: e.target.value,
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      void handleAddComment(msg.id);
                                    }
                                  }}
                                  placeholder="Ajouter un commentaire sur ce message..."
                                  className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] text-slate-900 outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => void handleAddComment(msg.id)}
                                  className="rounded-lg bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-blue-500"
                                >
                                  Commenter
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Zone de rédaction avec bannière de réponse et rappel du destinataire */}
            <form
              onSubmit={handleSendMessage}
              className="border-t border-slate-200 bg-white p-3 rounded-b-2xl space-y-2"
            >
              {/* Bannière de réponse active */}
              {replyingTo && (
                <div className="flex items-center justify-between rounded-xl border-l-4 border-blue-600 bg-blue-50/80 px-3 py-2 text-xs text-blue-950">
                  <div className="min-w-0">
                    <p className="font-bold text-[11px] flex items-center gap-1">
                      <Reply className="h-3 w-3 text-blue-600" />
                      Réponse à {replyingTo.senderName}
                    </p>
                    <p className="truncate text-[11px] text-blue-800 italic">
                      « {replyingTo.content} »
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="ml-2 rounded-lg p-1 text-blue-700 hover:bg-blue-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {attachmentName && (
                <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-1 text-xs text-blue-800">
                  <span>Pièce jointe : {attachmentName}</span>
                  <button type="button" onClick={() => setAttachmentName(null)}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <label
                  className="cursor-pointer rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                  title="Joindre un document ou une image"
                >
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
                  ref={messageInputRef}
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={`Écrire à : ${currentChannelName}...`}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={sending || !messageText.trim()}
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

      {/* Fenêtre modale de Partage / Transfert d'un message */}
      {sharingMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={handleConfirmForwardMessage}
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-blue-600" />
                  Partager / Transférer ce message
                </h3>
                <p className="text-[11px] text-slate-500">
                  Choisissez l'utilisateur, le service ou le groupe destinataire
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSharingMessage(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-slate-50 p-3 text-xs border border-slate-200">
              <p className="font-bold text-slate-700 mb-0.5">
                Message de {sharingMessage.senderName} :
              </p>
              <p className="text-slate-600 line-clamp-3 italic">
                « {sharingMessage.content} »
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Type de destinataire :
                </label>
                <select
                  value={shareTargetType}
                  onChange={(e) =>
                    setShareTargetType(
                      e.target.value as LocalChatMessage['channelType']
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold"
                >
                  <option value="prive">Utilisateur Ets AMANI (Message privé)</option>
                  <option value="service">Service en particulier</option>
                  <option value="groupe">Chat en Groupe</option>
                  <option value="agence">Canal de mon Agence</option>
                  <option value="global">Canal Général Réseau Ets AMANI</option>
                </select>
              </div>

              {shareTargetType === 'prive' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Choisir l'utilisateur :
                  </label>
                  <select
                    required
                    value={shareRecipientId}
                    onChange={(e) => setShareRecipientId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold"
                  >
                    <option value="">-- Sélectionner un utilisateur --</option>
                    {usersList.map((u) => (
                      <option key={u.uid} value={u.uid}>
                        {u.displayName} ({u.function || u.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {shareTargetType === 'service' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Choisir le service :
                  </label>
                  <select
                    value={shareServiceTag}
                    onChange={(e) => setShareServiceTag(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold"
                  >
                    {ETS_SERVICES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {shareTargetType === 'groupe' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Choisir le groupe :
                  </label>
                  <select
                    value={shareGroupId}
                    onChange={(e) => setShareGroupId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold"
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Note d'accompagnement (optionnelle) :
                </label>
                <input
                  type="text"
                  value={shareNote}
                  onChange={(e) => setShareNote(e.target.value)}
                  placeholder="Ex: Pour suivi prioritaire à votre niveau..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => void handleCopyMessage(sharingMessage)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <Copy className="h-3.5 w-3.5" />
                Copier texte
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSharingMessage(null)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Transférer
                </button>
              </div>
            </div>
          </form>
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
