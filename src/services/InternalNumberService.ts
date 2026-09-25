import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { firestore } from '../lib/firebase';
import { db as localDb } from '../lib/db';
import type {
  InternalNumber,
  InternalNumberStatus,
  MobileOperator,
} from '../types/internalNumber';

const COLLECTION = 'internalNumbers';

export interface CreateInternalNumberInput {
  phoneNumber: string;
  operator: MobileOperator;
  agencyId?: string | null;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  label?: string;
  description?: string;
  createdBy: string;
}

/**
 * Met à jour ou insère un numéro interne dans la base locale IndexedDB (Dexie).
 */
async function syncLocalCache(item: InternalNumber): Promise<void> {
  try {
    await localDb.internalNumbers.put({
      id: item.id,
      phoneNumber: item.phoneNumber,
      operator: item.operator,
      agencyId: item.agencyId ?? null,
      assignedUserId: item.assignedUserId ?? null,
      assignedUserName: item.assignedUserName ?? null,
      label: item.label ?? '',
      description: item.description ?? '',
      status: item.status || 'active',
      monitoringEnabled: item.monitoringEnabled ?? true,
      createdBy: item.createdBy || 'system',
      createdAt: item.createdAt || Date.now(),
      updatedAt: item.updatedAt || Date.now(),
    });
  } catch (err) {
    console.warn('[Ets AMANI] Erreur mise à jour cache local internalNumbers:', err);
  }
}

export async function createInternalNumber(
  input: CreateInternalNumberInput
): Promise<string> {
  const now = Date.now();
  const cleanPhone = input.phoneNumber.trim();

  const payload = {
    phoneNumber: cleanPhone,
    operator: input.operator,
    agencyId: input.agencyId ?? null,
    assignedUserId: input.assignedUserId ?? null,
    assignedUserName: input.assignedUserName ?? null,
    label: input.label ?? '',
    description: input.description ?? '',
    monitoringEnabled: true,
    status: 'active' as InternalNumberStatus,
    createdBy: input.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const reference = await addDoc(collection(firestore, COLLECTION), payload);

  // Synchronisation miroir dans le cache local IndexedDB pour fonctionnement Offline
  await syncLocalCache({
    id: reference.id,
    ...payload,
    createdAt: now,
    updatedAt: now,
  });

  return reference.id;
}

export async function getInternalNumber(
  id: string
): Promise<InternalNumber | null> {
  if (!id || !id.trim()) return null;

  try {
    const snapshot = await getDoc(doc(firestore, COLLECTION, id));
    if (snapshot.exists()) {
      const data = {
        id: snapshot.id,
        ...(snapshot.data() as Omit<InternalNumber, 'id'>),
      };
      await syncLocalCache(data);
      return data;
    }
  } catch {
    // En cas de panne de réseau, lecture du cache local
    const local = await localDb.internalNumbers.get(id);
    if (local) {
      return local as unknown as InternalNumber;
    }
  }

  return null;
}

export async function getInternalNumbers(): Promise<InternalNumber[]> {
  try {
    const snapshot = await getDocs(
      query(collection(firestore, COLLECTION), orderBy('phoneNumber'))
    );
    const remoteList = snapshot.docs.map((document) => ({
      id: document.id,
      ...(document.data() as Omit<InternalNumber, 'id'>),
    }));

    // Rafraîchir tout le cache local
    for (const item of remoteList) {
      await syncLocalCache(item);
    }

    return remoteList;
  } catch (err) {
    console.warn('[Ets AMANI] Firestore indisponible, utilisation du cache local internalNumbers:', err);
    const localList = await localDb.internalNumbers.toArray();
    return localList as unknown as InternalNumber[];
  }
}

export async function getAgencyInternalNumbers(
  agencyId: string
): Promise<InternalNumber[]> {
  if (!agencyId || !agencyId.trim()) return [];
  const all = await getInternalNumbers();
  return all.filter((number) => number.agencyId === agencyId);
}

export async function assignInternalNumber(
  internalNumberId: string,
  userId: string,
  userName: string
): Promise<void> {
  const now = Date.now();
  await updateDoc(doc(firestore, COLLECTION, internalNumberId), {
    assignedUserId: userId,
    assignedUserName: userName,
    updatedAt: serverTimestamp(),
  });

  await localDb.internalNumbers.update(internalNumberId, {
    assignedUserId: userId,
    assignedUserName: userName,
    updatedAt: now,
  });
}

export async function unassignInternalNumber(
  internalNumberId: string
): Promise<void> {
  const now = Date.now();
  await updateDoc(doc(firestore, COLLECTION, internalNumberId), {
    assignedUserId: null,
    assignedUserName: null,
    updatedAt: serverTimestamp(),
  });

  await localDb.internalNumbers.update(internalNumberId, {
    assignedUserId: null,
    assignedUserName: null,
    updatedAt: now,
  });
}

export async function setMonitoringState(
  internalNumberId: string,
  enabled: boolean
): Promise<void> {
  const now = Date.now();
  await updateDoc(doc(firestore, COLLECTION, internalNumberId), {
    monitoringEnabled: enabled,
    updatedAt: serverTimestamp(),
  });

  await localDb.internalNumbers.update(internalNumberId, {
    monitoringEnabled: enabled,
    updatedAt: now,
  });
}

export async function updateInternalNumberStatus(
  internalNumberId: string,
  status: InternalNumberStatus
): Promise<void> {
  const now = Date.now();
  await updateDoc(doc(firestore, COLLECTION, internalNumberId), {
    status,
    updatedAt: serverTimestamp(),
  });

  await localDb.internalNumbers.update(internalNumberId, {
    status,
    updatedAt: now,
  });
}

export async function deleteInternalNumber(
  internalNumberId: string
): Promise<void> {
  await deleteDoc(doc(firestore, COLLECTION, internalNumberId));
  await localDb.internalNumbers.delete(internalNumberId);
}
