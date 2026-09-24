import {
  collection,
  getDocs,
} from 'firebase/firestore';
import { auth, db as firestoreDb } from '../lib/firebase';
import {
  db,
  type LocalInternalNumber,
} from '../lib/db';

/**
 * Synchronise les numéros internes Firestore vers Dexie.
 */
export async function syncInternalNumbers(): Promise<void> {
  if (!auth.currentUser) {
    return;
  }

  try {
    const snapshot = await getDocs(collection(firestoreDb, 'internalNumbers'));
    const firestoreIds = new Set<string>();

    for (const document of snapshot.docs) {
      const data = document.data();
      const internalNumber: LocalInternalNumber = {
        id: document.id,
        phoneNumber: data.phoneNumber ?? '',
        operator: data.operator ?? 'vodacom',
        agencyId: data.agencyId ?? null,
        assignedUserId: data.assignedUserId ?? null,
        assignedUserName: data.assignedUserName ?? null,
        label: data.label ?? '',
        description: data.description ?? '',
        status: data.status ?? 'active',
        monitoringEnabled: data.monitoringEnabled === true,
        createdBy: data.createdBy ?? '',
        createdAt: data.createdAt ?? Date.now(),
        updatedAt: data.updatedAt ?? Date.now(),
      };
      firestoreIds.add(document.id);
      await db.internalNumbers.put(internalNumber);
    }

    const localNumbers = await db.internalNumbers.toArray();
    for (const local of localNumbers) {
      if (!firestoreIds.has(local.id) && snapshot.docs.length > 0) {
        await db.internalNumbers.delete(local.id);
      }
    }
  } catch (error: unknown) {
    console.warn(
      '[Ets AMANI] Synchronisation Firestore des numéros internes reportée :',
      error instanceof Error ? error.message : error
    );
  }
}
