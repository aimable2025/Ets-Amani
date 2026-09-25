import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../lib/db';
import { firestore, isFirebaseConfigured } from '../lib/firebase';
import type { SyncQueueItem } from '../lib/db';

const SYNC_INTERVAL_MS = 10000;
const MAX_ATTEMPTS = 5;

let isSyncing = false;
let syncIntervalId: ReturnType<typeof setInterval> | null = null;

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
