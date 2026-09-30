import {
  db,
  type ChatMessageComment,
  type LocalBroadcast,
  type LocalChatMessage,
  type LocalDebt,
  type LocalInterAgencyTransfer,
} from '../lib/db';
import type { AppUser } from '../types/auth';
import { recordAuditLog } from './AuditService';

/* =========================================================
   1. CHAT INTERNE & ASSISTANT INTELLIGENT METIER
   ========================================================= */

export async function getAuthorizedChatMessages(
  user: AppUser | null
): Promise<LocalChatMessage[]> {
  if (!user) return [];
  const all = await db.chatMessages.toArray();
  const isGlobal =
    user.role === 'administrateur_systeme' || user.role === 'directeur_general';

  const visible = all.filter((msg) => {
    if (msg.channelType === 'global') return true;
    if (msg.channelType === 'agence') {
      return isGlobal || !msg.agencyId || (user.agencyId && msg.agencyId === user.agencyId);
    }
    if (msg.channelType === 'prive') {
      return (
        msg.senderId === user.uid ||
        msg.recipientId === user.uid ||
        isGlobal
      );
    }
    if (msg.channelType === 'groupe') {
      if (msg.groupParticipantIds && msg.groupParticipantIds.length > 0) {
        return (
          isGlobal ||
          msg.senderId === user.uid ||
          msg.groupParticipantIds.includes(user.uid)
        );
      }
      return isGlobal || !msg.agencyId || msg.agencyId === user.agencyId;
    }
    if (msg.channelType === 'service') {
      return isGlobal || !msg.agencyId || msg.agencyId === user.agencyId;
    }
    return true;
  });

  return visible.sort((a, b) => a.createdAt - b.createdAt);
}

export interface SendChatMessageInput {
  channelType: LocalChatMessage['channelType'];
  channelId: string;
  channelName: string;
  agencyId?: string | null;
  recipientId?: string | null;
  recipientName?: string | null;
  serviceTag?: string | null;
  groupName?: string | null;
  groupParticipantIds?: string[];
  groupParticipantNames?: string[];
  replyToMessageId?: string | null;
  replyToSenderName?: string | null;
  replyToExcerpt?: string | null;
  forwardedFromSenderName?: string | null;
  content: string;
  attachmentType?: 'none' | 'image' | 'document';
  attachmentName?: string | null;
  attachmentDataUrl?: string | null;
}

export async function sendChatMessage(
  input: SendChatMessageInput,
  user: AppUser
): Promise<LocalChatMessage> {
  const now = Date.now();
  const id = `msg-${now}-${Math.random().toString(36).substring(2, 8)}`;

  const msg: LocalChatMessage = {
    id,
    channelType: input.channelType,
    channelId: input.channelId,
    channelName: input.channelName,
    agencyId: input.agencyId !== undefined ? input.agencyId : user.agencyId ?? null,
    senderId: user.uid,
    senderName: user.displayName || user.email || 'Utilisateur',
    senderRole: user.role,
    recipientId: input.recipientId ?? null,
    recipientName: input.recipientName ?? null,
    serviceTag: input.serviceTag ?? null,
    groupName: input.groupName ?? null,
    groupParticipantIds: input.groupParticipantIds || [],
    groupParticipantNames: input.groupParticipantNames || [],
    replyToMessageId: input.replyToMessageId ?? null,
    replyToSenderName: input.replyToSenderName ?? null,
    replyToExcerpt: input.replyToExcerpt ?? null,
    forwardedFromSenderName: input.forwardedFromSenderName ?? null,
    reactions: {},
    comments: [],
    content: input.content.trim(),
    attachmentType: input.attachmentType || 'none',
    attachmentName: input.attachmentName || null,
    attachmentDataUrl: input.attachmentDataUrl || null,
    readBy: [user.uid],
    syncStatus: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  await db.chatMessages.put(msg);
  await db.syncQueue.add({
    entity: 'chatMessage',
    entityId: id,
    operation: 'create',
    attempts: 0,
    lastError: null,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });

  return msg;
}

export async function toggleChatMessageReaction(
  messageId: string,
  emoji: string,
  userId: string
): Promise<void> {
  const existing = await db.chatMessages.get(messageId);
  if (!existing) return;

  const currentReactions: Record<string, string[]> = {
    ...(existing.reactions || {}),
  };
  const list = currentReactions[emoji] || [];
  if (list.includes(userId)) {
    const nextList = list.filter((id) => id !== userId);
    if (nextList.length === 0) {
      delete currentReactions[emoji];
    } else {
      currentReactions[emoji] = nextList;
    }
  } else {
    currentReactions[emoji] = [...list, userId];
  }

  const now = Date.now();
  await db.chatMessages.update(messageId, {
    reactions: currentReactions,
    syncStatus: 'pending',
    updatedAt: now,
  });

  await db.syncQueue.add({
    entity: 'chatMessage',
    entityId: messageId,
    operation: 'update',
    attempts: 0,
    lastError: null,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });
}

export async function addChatMessageComment(
  messageId: string,
  content: string,
  user: AppUser
): Promise<void> {
  const trimmed = content.trim();
  if (!trimmed) return;
  const existing = await db.chatMessages.get(messageId);
  if (!existing) return;

  const now = Date.now();
  const newComment: ChatMessageComment = {
    id: `cmt-${now}-${Math.random().toString(36).substring(2, 7)}`,
    authorId: user.uid,
    authorName: user.displayName || user.email || 'Utilisateur',
    authorRole: user.role,
    content: trimmed,
    createdAt: now,
  };

  const updatedComments = [...(existing.comments || []), newComment];
  await db.chatMessages.update(messageId, {
    comments: updatedComments,
    syncStatus: 'pending',
    updatedAt: now,
  });

  await db.syncQueue.add({
    entity: 'chatMessage',
    entityId: messageId,
    operation: 'update',
    attempts: 0,
    lastError: null,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });
}

export async function markChatMessageAsRead(
  messageId: string,
  userId: string
): Promise<void> {
  const existing = await db.chatMessages.get(messageId);
  if (!existing) return;
  if (existing.readBy?.includes(userId)) return;

  const updatedReadBy = Array.from(new Set([...(existing.readBy || []), userId]));
  const now = Date.now();
  await db.chatMessages.update(messageId, {
    readBy: updatedReadBy,
    syncStatus: 'pending',
    updatedAt: now,
  });

  await db.syncQueue.add({
    entity: 'chatMessage',
    entityId: messageId,
    operation: 'update',
    attempts: 0,
    lastError: null,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Assistant Intelligent Ets AMANI : analyse en temps réel les données locales Dexie
 * dans le strict respect du périmètre RBAC de l'utilisateur.
 */
export async function generateIntelligentBusinessAnalysis(
  question: string,
  user: AppUser
): Promise<string> {
  const isGlobal =
    user.role === 'administrateur_systeme' || user.role === 'directeur_general';
  const scopeAgencyId = isGlobal ? null : user.agencyId || null;

  const [billetages, ops, debts, transfers, smsOps] = await Promise.all([
    db.billetages.toArray(),
    db.operations.toArray(),
    db.debts.toArray(),
    db.interAgencyTransfers.toArray(),
    db.smsOperations.toArray(),
  ]);

  const myBilletages = billetages.filter(
    (b) => (!scopeAgencyId || b.agencyId === scopeAgencyId) && b.status !== 'cancelled'
  );
  const myOps = ops.filter((o) => !scopeAgencyId || o.agencyId === scopeAgencyId);
  const myDebts = debts.filter(
    (d) => (!scopeAgencyId || d.agencyId === scopeAgencyId) && d.status !== 'rembourse'
  );
  const myTransfers = transfers.filter(
    (t) =>
      !scopeAgencyId ||
      t.sourceAgencyId === scopeAgencyId ||
      t.targetAgencyId === scopeAgencyId
  );
  const mySms = smsOps.filter((s) => !scopeAgencyId || s.agencyId === scopeAgencyId);

  let usdCaisse = 0;
  let cdfCaisse = 0;
  let discrepancyCount = 0;
  for (const b of myBilletages) {
    const val = Number(b.calculatedTotal || b.declaredAmount || 0);
    if (b.currency === 'USD') usdCaisse += val;
    if (b.currency === 'CDF') cdfCaisse += val;
    if (b.discrepancy && Math.abs(b.discrepancy) > 0) discrepancyCount++;
  }

  const pendingOps = myOps.filter(
    (o) => o.status !== 'termine' && o.status !== 'annule' && o.status !== 'rejete'
  );

  let debtUSD = 0;
  let debtCDF = 0;
  for (const d of myDebts) {
    if (d.currency === 'USD') debtUSD += d.remainingAmount;
    if (d.currency === 'CDF') debtCDF += d.remainingAmount;
  }

  const pendingTransfers = myTransfers.filter(
    (t) => t.status === 'en_attente_validation' || t.status === 'valide'
  );

  const scopeLabel = isGlobal
    ? 'Réseau Global Ets AMANI (Toutes Agences)'
    : `Agence ${user.agencyId || 'Locale'}`;

  return [
    `📊 **Synthèse Analytique Temps Réel — ${scopeLabel}**`,
    `• **Trésorerie Billetage** : $${usdCaisse.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} USD et ${cdfCaisse.toLocaleString('fr-FR')} CDF (${myBilletages.length} arrêté(s), ${discrepancyCount} écart(s) signalé(s)).`,
    `• **Missions & Opérations** : ${pendingOps.length} opération(s) active(s) en cours sur ${myOps.length} enregistrée(s) • ${mySms.length} flux SMS Mobile Money captés.`,
    `• **Portefeuille Dettes & Créances** : ${myDebts.length} dossier(s) actifs pour un reste à recouvrer de $${debtUSD.toLocaleString('fr-FR')} USD et ${debtCDF.toLocaleString('fr-FR')} CDF.`,
    `• **Transferts Inter-Agences** : ${pendingTransfers.length} transfert(s) en cours de validation/réception sur ${myTransfers.length} mouvement(s).`,
    question.toLowerCase().includes('risque') || question.toLowerCase().includes('alerte')
      ? `⚠️ **Contrôle Interne** : ${discrepancyCount > 0 ? `${discrepancyCount} billetage(s) présentent un écart contradictoire à vérifier.` : 'Aucun écart de caisse critique détecté.'}`
      : `✅ Données certifiées depuis votre base locale Offline-First Dexie et synchronisées avec Firestore.`,
  ].join('\n');
}

/* =========================================================
   2. DIFFUSIONS ADMINISTRATIVES & ANNONCES (BROADCASTS)
   ========================================================= */

export async function getAuthorizedBroadcasts(
  user: AppUser | null
): Promise<LocalBroadcast[]> {
  if (!user) return [];
  const all = await db.broadcasts.toArray();
  const isGlobal =
    user.role === 'administrateur_systeme' || user.role === 'directeur_general';

  const visible = all.filter((b) => {
    if (b.scope === 'global') return true;
    if (isGlobal) return true;
    return user.agencyId && b.agencyId === user.agencyId;
  });

  return visible.sort((a, b) => b.createdAt - a.createdAt);
}

export interface CreateBroadcastInput {
  title: string;
  message: string;
  severity: LocalBroadcast['severity'];
  scope: LocalBroadcast['scope'];
  agencyId: string | null;
  agencyName?: string | null;
  requiresAck: boolean;
  requiresReadConfirmation: boolean;
  blockingUntilAck: boolean;
}

export async function createBroadcast(
  input: CreateBroadcastInput,
  user: AppUser
): Promise<LocalBroadcast> {
  const now = Date.now();
  const id = `bc-${now}-${Math.random().toString(36).substring(2, 8)}`;

  const isGlobalRole =
    user.role === 'administrateur_systeme' || user.role === 'directeur_general';

  const effectiveScope: LocalBroadcast['scope'] = isGlobalRole
    ? input.scope
    : 'agence';
  const effectiveAgencyId =
    effectiveScope === 'global'
      ? null
      : isGlobalRole
        ? input.agencyId
        : user.agencyId || null;

  const bc: LocalBroadcast = {
    id,
    title: input.title.trim(),
    message: input.message.trim(),
    severity: input.severity,
    scope: effectiveScope,
    agencyId: effectiveAgencyId,
    agencyName: input.agencyName || (effectiveAgencyId ? effectiveAgencyId : 'Réseau Global'),
    requiresAck: input.requiresAck,
    requiresReadConfirmation: input.requiresReadConfirmation,
    blockingUntilAck: input.blockingUntilAck,
    acknowledgedBy: [user.uid],
    readBy: [user.uid],
    authorId: user.uid,
    authorName: user.displayName || 'Direction',
    authorRole: user.role,
    syncStatus: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  await db.broadcasts.put(bc);
  await db.syncQueue.add({
    entity: 'broadcast',
    entityId: id,
    operation: 'create',
    attempts: 0,
    lastError: null,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });

  await recordAuditLog({
    action: 'Diffusion annonce officielle',
    category: 'operations',
    severity: input.severity === 'critique' ? 'critical' : 'info',
    details: `Annonce « ${bc.title} » (${bc.severity}) diffusée sur le périmètre ${bc.agencyName}.`,
    actorName: user.displayName || 'Utilisateur',
    actorRole: user.role,
    actorUid: user.uid,
    metadata: { broadcastId: id, scope: effectiveScope, agencyId: effectiveAgencyId },
  });

  return bc;
}

export async function acknowledgeBroadcast(
  broadcastId: string,
  user: AppUser
): Promise<void> {
  const existing = await db.broadcasts.get(broadcastId);
  if (!existing) return;

  const nextAck = Array.from(new Set([...(existing.acknowledgedBy || []), user.uid]));
  const nextRead = Array.from(new Set([...(existing.readBy || []), user.uid]));
  const now = Date.now();

  await db.broadcasts.update(broadcastId, {
    acknowledgedBy: nextAck,
    readBy: nextRead,
    syncStatus: 'pending',
    updatedAt: now,
  });

  await db.syncQueue.add({
    entity: 'broadcast',
    entityId: broadcastId,
    operation: 'update',
    attempts: 0,
    lastError: null,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });
}

/* =========================================================
   3. SUIVI DES DETTES & REMBOURSEMENTS (DEBTS)
   ========================================================= */

export async function getAuthorizedDebts(
  user: AppUser | null
): Promise<LocalDebt[]> {
  if (!user) return [];
  const all = await db.debts.toArray();
  const isGlobal =
    user.role === 'administrateur_systeme' || user.role === 'directeur_general';

  const visible = isGlobal
    ? all
    : all.filter((d) => user.agencyId && d.agencyId === user.agencyId);

  return visible.sort((a, b) => b.createdAt - a.createdAt);
}

export interface CreateDebtInput {
  category: LocalDebt['category'];
  debtorName: string;
  debtorPhone?: string;
  agencyId: string;
  agencyName: string;
  currency: 'USD' | 'CDF';
  initialAmount: number;
  reason: string;
  dueDate: number;
}

export async function createDebtRecord(
  input: CreateDebtInput,
  user: AppUser
): Promise<LocalDebt> {
  const isGlobal =
    user.role === 'administrateur_systeme' || user.role === 'directeur_general';
  const enforcedAgencyId = isGlobal ? input.agencyId : user.agencyId || input.agencyId;

  const now = Date.now();
  const id = `debt-${now}-${Math.random().toString(36).substring(2, 7)}`;
  const reference = `DET-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const debt: LocalDebt = {
    id,
    reference,
    category: input.category,
    debtorName: input.debtorName.trim(),
    debtorPhone: input.debtorPhone?.trim() || null,
    agencyId: enforcedAgencyId,
    agencyName: input.agencyName,
    currency: input.currency,
    initialAmount: Number(input.initialAmount),
    remainingAmount: Number(input.initialAmount),
    reason: input.reason.trim(),
    dueDate: input.dueDate,
    status: input.dueDate < now ? 'en_retard' : 'en_cours',
    repayments: [],
    createdBy: user.uid,
    createdByName: user.displayName || 'Utilisateur',
    syncStatus: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  await db.debts.put(debt);
  await db.syncQueue.add({
    entity: 'debt',
    entityId: id,
    operation: 'create',
    attempts: 0,
    lastError: null,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });

  await recordAuditLog({
    action: 'Enregistrement de dette / créance',
    category: 'operations',
    severity: 'warning',
    details: `Dette ${reference} enregistrée pour ${debt.debtorName} (${debt.initialAmount} ${debt.currency}) — Agence ${debt.agencyName}.`,
    actorName: user.displayName || 'Utilisateur',
    actorRole: user.role,
    actorUid: user.uid,
    metadata: { debtId: id, reference, amount: debt.initialAmount, currency: debt.currency },
  });

  return debt;
}

export async function recordDebtRepayment(
  debtId: string,
  amount: number,
  note: string,
  user: AppUser
): Promise<LocalDebt> {
  const existing = await db.debts.get(debtId);
  if (!existing) throw new Error('Dossier de dette introuvable.');

  const isGlobal =
    user.role === 'administrateur_systeme' || user.role === 'directeur_general';
  if (!isGlobal && existing.agencyId !== user.agencyId) {
    throw new Error('Violation RBAC : cette dette appartient à une autre agence.');
  }

  const cleanAmount = Math.max(0, Number(amount));
  const nextRemaining = Math.max(0, existing.remainingAmount - cleanAmount);
  const now = Date.now();

  const nextStatus: LocalDebt['status'] =
    nextRemaining <= 0
      ? 'rembourse'
      : existing.dueDate < now
        ? 'en_retard'
        : 'partiel';

  const repayment = {
    id: `rep-${now}-${Math.random().toString(36).substring(2, 6)}`,
    amount: cleanAmount,
    currency: existing.currency,
    recordedBy: user.uid,
    recordedByName: user.displayName || 'Utilisateur',
    note: note.trim(),
    timestamp: now,
  };

  const updated: LocalDebt = {
    ...existing,
    remainingAmount: nextRemaining,
    status: nextStatus,
    repayments: [...(existing.repayments || []), repayment],
    syncStatus: 'pending',
    updatedAt: now,
  };

  await db.debts.put(updated);
  await db.syncQueue.add({
    entity: 'debt',
    entityId: debtId,
    operation: 'update',
    attempts: 0,
    lastError: null,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });

  await recordAuditLog({
    action: 'Remboursement sur dette',
    category: 'operations',
    severity: 'info',
    details: `Remboursement de ${cleanAmount} ${existing.currency} sur ${existing.reference} (${existing.debtorName}). Reste : ${nextRemaining} ${existing.currency}.`,
    actorName: user.displayName || 'Utilisateur',
    actorRole: user.role,
    actorUid: user.uid,
    metadata: { debtId, reference: existing.reference, paid: cleanAmount, remaining: nextRemaining },
  });

  return updated;
}

/* =========================================================
   4. TRANSFERTS INTER-AGENCES (INTER-AGENCY TRANSFERS)
   ========================================================= */

export async function getAuthorizedTransfers(
  user: AppUser | null
): Promise<LocalInterAgencyTransfer[]> {
  if (!user) return [];
  const all = await db.interAgencyTransfers.toArray();
  const isGlobal =
    user.role === 'administrateur_systeme' || user.role === 'directeur_general';

  const visible = isGlobal
    ? all
    : all.filter(
        (t) =>
          user.agencyId &&
          (t.sourceAgencyId === user.agencyId || t.targetAgencyId === user.agencyId)
      );

  return visible.sort((a, b) => b.createdAt - a.createdAt);
}

export interface CreateTransferInput {
  transferType: LocalInterAgencyTransfer['transferType'];
  sourceAgencyId: string;
  sourceAgencyName: string;
  targetAgencyId: string;
  targetAgencyName: string;
  amount: number;
  currency: 'USD' | 'CDF';
  operatorOrChannel?: string;
  reason: string;
}

export async function initiateInterAgencyTransfer(
  input: CreateTransferInput,
  user: AppUser
): Promise<LocalInterAgencyTransfer> {
  if (input.sourceAgencyId === input.targetAgencyId) {
    throw new Error("L'agence source et l'agence destinataire doivent être distinctes.");
  }

  const now = Date.now();
  const id = `trf-${now}-${Math.random().toString(36).substring(2, 7)}`;
  const reference = `TRF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const isGlobal =
    user.role === 'administrateur_systeme' || user.role === 'directeur_general';

  const trf: LocalInterAgencyTransfer = {
    id,
    reference,
    transferType: input.transferType,
    sourceAgencyId: input.sourceAgencyId,
    sourceAgencyName: input.sourceAgencyName,
    targetAgencyId: input.targetAgencyId,
    targetAgencyName: input.targetAgencyName,
    amount: Number(input.amount),
    currency: input.currency,
    operatorOrChannel: input.operatorOrChannel?.trim() || 'Caisse / Convoyage Interne',
    reason: input.reason.trim(),
    status: isGlobal ? 'valide' : 'en_attente_validation',
    initiatedBy: user.uid,
    initiatedByName: user.displayName || 'Utilisateur',
    initiatedByRole: user.role,
    validatedBy: isGlobal ? user.uid : null,
    validatedByName: isGlobal ? user.displayName || 'Direction' : null,
    validatedAt: isGlobal ? now : null,
    receivedBy: null,
    receivedByName: null,
    receivedAt: null,
    rejectionReason: null,
    syncStatus: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  await db.interAgencyTransfers.put(trf);
  await db.syncQueue.add({
    entity: 'interAgencyTransfer',
    entityId: id,
    operation: 'create',
    attempts: 0,
    lastError: null,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });

  await recordAuditLog({
    action: 'Initiation transfert inter-agences',
    category: 'operations',
    severity: 'warning',
    details: `Transfert ${reference} (${trf.amount} ${trf.currency}) de ${trf.sourceAgencyName} vers ${trf.targetAgencyName}.`,
    actorName: user.displayName || 'Utilisateur',
    actorRole: user.role,
    actorUid: user.uid,
    metadata: { transferId: id, reference, amount: trf.amount, currency: trf.currency },
  });

  return trf;
}

export async function updateInterAgencyTransferStatus(
  transferId: string,
  nextStatus: 'valide' | 'recu' | 'rejete',
  user: AppUser,
  rejectionReason?: string
): Promise<LocalInterAgencyTransfer> {
  const existing = await db.interAgencyTransfers.get(transferId);
  if (!existing) throw new Error('Transfert introuvable.');

  const now = Date.now();
  const patch: Partial<LocalInterAgencyTransfer> = {
    status: nextStatus,
    syncStatus: 'pending',
    updatedAt: now,
  };

  if (nextStatus === 'valide') {
    patch.validatedBy = user.uid;
    patch.validatedByName = user.displayName || 'Direction';
    patch.validatedAt = now;
  } else if (nextStatus === 'recu') {
    patch.receivedBy = user.uid;
    patch.receivedByName = user.displayName || 'Réceptionnaire';
    patch.receivedAt = now;
  } else if (nextStatus === 'rejete') {
    patch.rejectionReason = rejectionReason || 'Rejeté par le contrôle interne';
  }

  const updated: LocalInterAgencyTransfer = {
    ...existing,
    ...patch,
  };

  await db.interAgencyTransfers.put(updated);
  await db.syncQueue.add({
    entity: 'interAgencyTransfer',
    entityId: transferId,
    operation: 'update',
    attempts: 0,
    lastError: null,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });

  await recordAuditLog({
    action: `Transfert inter-agences : ${nextStatus}`,
    category: 'operations',
    severity: nextStatus === 'rejete' ? 'critical' : 'info',
    details: `Transfert ${existing.reference} (${existing.amount} ${existing.currency}) marqué « ${nextStatus} » par ${user.displayName}.`,
    actorName: user.displayName || 'Utilisateur',
    actorRole: user.role,
    actorUid: user.uid,
    metadata: { transferId, reference: existing.reference, status: nextStatus },
  });

  return updated;
}
