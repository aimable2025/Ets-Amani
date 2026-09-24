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
import { db } from '../lib/firebase';
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

export async function createInternalNumber(
  input: CreateInternalNumberInput
): Promise<string> {
  const reference = await addDoc(
    collection(db, COLLECTION),
    {
      phoneNumber: input.phoneNumber.trim(),
      operator: input.operator,
      agencyId: input.agencyId ?? null,
      assignedUserId: input.assignedUserId ?? null,
      assignedUserName: input.assignedUserName ?? null,
      label: input.label ?? '',
      description: input.description ?? '',
      monitoringEnabled: true,
      status: 'active',
      createdBy: input.createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
  );
  return reference.id;
}

export async function getInternalNumber(
  id: string
): Promise<InternalNumber | null> {
  const snapshot = await getDoc(doc(db, COLLECTION, id));
  if (!snapshot.exists()) {
    return null;
  }
  return {
    id: snapshot.id,
    ...(snapshot.data() as Omit<InternalNumber, 'id'>),
  };
}

export async function getInternalNumbers(): Promise<InternalNumber[]> {
  try {
    const snapshot = await getDocs(
      query(collection(db, COLLECTION), orderBy('phoneNumber'))
    );
    return snapshot.docs.map((document) => ({
      id: document.id,
      ...(document.data() as Omit<InternalNumber, 'id'>),
    }));
  } catch (err) {
    console.warn('Erreur Firestore getInternalNumbers, retour vide:', err);
    return [];
  }
}

export async function getAgencyInternalNumbers(
  agencyId: string
): Promise<InternalNumber[]> {
  const all = await getInternalNumbers();
  return all.filter((number) => number.agencyId === agencyId);
}

export async function assignInternalNumber(
  internalNumberId: string,
  userId: string,
  userName: string
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, internalNumberId), {
    assignedUserId: userId,
    assignedUserName: userName,
    updatedAt: serverTimestamp(),
  });
}

export async function unassignInternalNumber(
  internalNumberId: string
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, internalNumberId), {
    assignedUserId: null,
    assignedUserName: null,
    updatedAt: serverTimestamp(),
  });
}

export async function setMonitoringState(
  internalNumberId: string,
  enabled: boolean
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, internalNumberId), {
    monitoringEnabled: enabled,
    updatedAt: serverTimestamp(),
  });
}

export async function updateInternalNumberStatus(
  internalNumberId: string,
  status: InternalNumberStatus
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, internalNumberId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteInternalNumber(
  internalNumberId: string
): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, internalNumberId));
}
