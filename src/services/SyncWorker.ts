import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../lib/db';
import { firestore, isFirebaseConfigured } from '../lib/firebase';
import type { SyncQueueItem, Billetage } from '../lib/db';
import type { Operation, OperationAssignment } from '../types/operation';

const SYNC_INTERVAL_MS = 10000;
const MAX_ATTEMPTS = 5;

let isSyncing = false;
let syncIntervalId: ReturnType<typeof setInterval> | null = null;

async function pullRemoteDataToLocal(): Promise<void> {
  if (!isFirebaseConfigured || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return;
  }

  // 1. Hydratation descendante des opérations
  try {
    const opsSnap = await getDocs(query(collection(firestore, 'operations'), limit(200)));
    for (const docSnap of opsSnap.docs) {
      const remoteData = docSnap.data() as Operation;
      const id = remoteData.id || docSnap.id;
      const localExisting = await db.operations.get(id);
      if (!localExisting || localExisting.syncStatus !== 'pending') {
        await db.operations.put({
          ...remoteData,
          id,
          syncStatus: 'synced',
        });
      }
    }
  } catch {
    // Silencieux si hors-ligne ou règles restreintes pour le rôle courant
  }

  // 2. Hydratation descendante des affectations d'opérations
  try {
    const assignSnap = await getDocs(query(collection(firestore, 'operationAssignments'), limit(200)));
    for (const docSnap of assignSnap.docs) {
      const remoteData = docSnap.data() as OperationAssignment;
      const id = remoteData.id || docSnap.id;
      const localExisting = await db.operationAssignments.get(id);
      if (!localExisting || localExisting.syncStatus !== 'pending') {
        await db.operationAssignments.put({
          ...remoteData,
          id,
          syncStatus: 'synced',
        });
      }
    }
  } catch {
    // Silencieux
  }

  // 3. Hydratation descendante des billetages d'agence
  try {
    const billSnap = await getDocs(query(collection(firestore, 'billetages'), limit(150)));
    for (const docSnap of billSnap.docs) {
      const raw = docSnap.data();
      const id = (raw.id as string) || docSnap.id;
      const localExisting = await db.billetages.get(id);
      if (!localExisting || localExisting.syncStatus !== 'pending') {
        const billetageRow: Billetage = {
          id,
          type: raw.type === 'personal' ? 'personal' : 'business',
          userId: String(raw.userId || ''),
          agencyId: raw.agencyId ? String(raw.agencyId) : null,
          currency: String(raw.currency || 'USD'),
          calculatedTotal: Number(raw.calculatedTotal || 0),
          declaredAmount: raw.declaredAmount !== undefined ? raw.declaredAmount : null,
          discrepancy: raw.discrepancy !== undefined ? raw.discrepancy : null,
          status: raw.status || 'completed',
          syncStatus: 'synced',
          transactionId: raw.transactionId ?? null,
          reference: raw.reference ?? null,
          createdAt: Number(raw.createdAt || Date.now()),
          updatedAt: Number(raw.updatedAt || Date.now()),
        };
        await db.billetages.put(billetageRow);
      }
    }
  } catch {
    // Silencieux
  }
}

async function syncSingleItem(item: SyncQueueItem): Promise<void> {
  const { entity, entityId, operation } = item;

  if (entity === 'billetage') {
    if (operation === 'delete') {
      const docRef = doc(firestore, 'billetages', entityId);
      await deleteDoc(docRef);
    } else {
      const billetage = await db.billetages.get(entityId);
      if (!billetage) {
        return;
      }
      const denominations = await db.billetageDenominations
        .where('billetageId')
        .equals(entityId)
        .toArray();

      const docRef = doc(firestore, 'billetages', entityId);
      await setDoc(
        docRef,
        {
          ...billetage,
          denominations,
          syncedAt: serverTimestamp(),
          syncStatus: 'synced',
        },
        { merge: true }
      );

      await db.billetages.update(entityId, {
        syncStatus: 'synced',
        updatedAt: Date.now(),
      });
    }
  } else if (entity === 'operation') {
    if (operation === 'delete') {
      const docRef = doc(firestore, 'operations', entityId);
      await deleteDoc(docRef);
    } else {
      const op = await db.operations.get(entityId);
      if (!op) {
        return;
      }
      const docRef = doc(firestore, 'operations', entityId);
      await setDoc(
        docRef,
        {
          ...op,
          syncedAt: serverTimestamp(),
          syncStatus: 'synced',
        },
        { merge: true }
      );

      await db.operations.update(entityId, {
        syncStatus: 'synced',
        updatedAt: Date.now(),
      });
    }
  } else if (entity === 'operationAssignment') {
    if (operation === 'delete') {
      const docRef = doc(firestore, 'operationAssignments', entityId);
      await deleteDoc(docRef);
    } else {
      const assignment = await db.operationAssignments.get(entityId);
      if (!assignment) {
        return;
      }
      const docRef = doc(firestore, 'operationAssignments', entityId);
      await setDoc(
        docRef,
        {
          ...assignment,
          syncedAt: serverTimestamp(),
          syncStatus: 'synced',
        },
        { merge: true }
      );

      await db.operationAssignments.update(entityId, {
        syncStatus: 'synced',
        updatedAt: Date.now(),
      });
    }
  }
}

export async function processSyncQueue(): Promise<{
  processed: number;
  errors: number;
}> {
  if (isSyncing) {
    return { processed: 0, errors: 0 };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { processed: 0, errors: 0 };
  }

  if (!isFirebaseConfigured) {
    return { processed: 0, errors: 0 };
  }

  isSyncing = true;
  let processed = 0;
  let errors = 0;

  try {
    const pendingItems = await db.syncQueue
      .where('status')
      .anyOf('pending', 'failed')
      .toArray();

    for (const item of pendingItems) {
      if (!item.id) continue;

      if (item.attempts >= MAX_ATTEMPTS && item.status === 'failed') {
        continue;
      }

      await db.syncQueue.update(item.id, {
        status: 'processing',
        updatedAt: Date.now(),
      });

      try {
        await syncSingleItem(item);
        await db.syncQueue.update(item.id, {
          status: 'completed',
          updatedAt: Date.now(),
        });
        processed++;
      } catch (err: unknown) {
        errors++;
        const nextAttempts = (item.attempts || 0) + 1;
        const willFail = nextAttempts >= MAX_ATTEMPTS;
        const msg = err instanceof Error ? err.message : 'Erreur inconnue lors de la synchronisation';

        await db.syncQueue.update(item.id, {
          status: willFail ? 'failed' : 'pending',
          attempts: nextAttempts,
          lastError: msg,
          updatedAt: Date.now(),
        });
      }
    }
    await pullRemoteDataToLocal();
  } catch (globalErr) {
    console.warn('[Ets AMANI SyncWorker] Erreur traitement file :', globalErr);
  } finally {
    isSyncing = false;
  }

  return { processed, errors };
}

export function startSyncWorker(): () => void {
  if (syncIntervalId) {
    return () => {
      if (syncIntervalId) {
        clearInterval(syncIntervalId);
        syncIntervalId = null;
      }
    };
  }

  void processSyncQueue();

  const handleOnline = () => {
    void processSyncQueue();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
  }

  syncIntervalId = setInterval(() => {
    void processSyncQueue();
  }, SYNC_INTERVAL_MS);

  return () => {
    if (syncIntervalId) {
      clearInterval(syncIntervalId);
      syncIntervalId = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
    }
  };
}

export async function triggerSyncNow(): Promise<{
  processed: number;
  errors: number;
}> {
  return processSyncQueue();
}
