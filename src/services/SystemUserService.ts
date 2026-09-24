import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { db, firebaseConfig, isFirebaseConfigured } from '../lib/firebase';
import { recordAuditLog } from './AuditService';
import { appointDirectorGeneral as appointDgCore } from './DirectorGeneralService';
import type {
  AccountStatus,
  AppUser,
  PublicRegistrationRole,
  RegistrationStatus,
  UserCategory,
  UserFunction,
  UserRole,
} from '../types/auth';

const USERS_COLLECTION = 'users';
const LOCAL_USERS_KEY = 'ets_amani_local_managed_users';

export interface ManagedUser {
  uid: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  photoURL?: string | null;
  category: UserCategory;
  role: UserRole;
  function?: UserFunction;
  agencyId?: string | null;
  status: AccountStatus;
  isApproved: boolean;
  registrationStatus?: RegistrationStatus;
  requestedRole?: PublicRegistrationRole;
  permissions: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
  notes?: string;
  rejectionReason?: string;
}

function getLocalManagedUsers(): ManagedUser[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return [];
}

function saveLocalManagedUser(user: ManagedUser): void {
  try {
    const list = getLocalManagedUsers();
    const index = list.findIndex((u) => u.uid === user.uid);
    if (index >= 0) {
      list[index] = user;
    } else {
      list.unshift(user);
    }
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export async function getAllSystemUsers(): Promise<ManagedUser[]> {
  const usersMap = new Map<string, ManagedUser>();

  getLocalManagedUsers().forEach((u) => {
    usersMap.set(u.uid, u);
  });

  try {
    const usersReference = collection(db, USERS_COLLECTION);
    const snapshot = await getDocs(usersReference);
    if (!snapshot.empty) {
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const userItem: ManagedUser = {
          uid: docSnap.id,
          displayName: data.displayName || 'Utilisateur',
          email: data.email || null,
          phone: data.phone || null,
          photoURL: data.photoURL || null,
          category: data.category || 'client',
          role: data.role || 'client',
          function: data.function,
          agencyId: data.agencyId || null,
          status: data.status || 'pending',
          isApproved: data.isApproved === true,
          registrationStatus: data.registrationStatus,
          requestedRole: data.requestedRole,
          permissions: Array.isArray(data.permissions) ? data.permissions : [],
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          notes: data.notes,
          rejectionReason: data.rejectionReason,
        };
        usersMap.set(userItem.uid, userItem);
      });
    }
  } catch (error) {
    console.warn('Ets AMANI - Utilisation du cache local pour la liste des utilisateurs:', error);
  }

  return Array.from(usersMap.values()).sort((a, b) => {
    return a.displayName.localeCompare(b.displayName);
  });
}

export async function updateManagedUserStatus(
  targetUid: string,
  newStatus: AccountStatus,
  actor: { uid: string; name: string; role: string },
  reason?: string,
): Promise<void> {
  const isApproved = newStatus === 'active';

  try {
    const ref = doc(db, USERS_COLLECTION, targetUid);
    await updateDoc(ref, {
      status: newStatus,
      isApproved,
      ...(reason ? { notes: reason } : {}),
      updatedAt: serverTimestamp(),
    });

    const dgConfigRef = doc(db, 'system', 'directorGeneral');
    const dgSnap = await getDoc(dgConfigRef);
    if (dgSnap.exists() && dgSnap.data()?.uid === targetUid) {
      await updateDoc(dgConfigRef, {
        status: newStatus,
        updatedBy: actor.uid,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.warn('Mise à jour Firestore impossible (mode hors-ligne):', error);
  }

  const localList = getLocalManagedUsers();
  const existing = localList.find((u) => u.uid === targetUid);
  if (existing) {
    existing.status = newStatus;
    existing.isApproved = isApproved;
    if (reason) existing.notes = reason;
    saveLocalManagedUser(existing);
  }

  await recordAuditLog({
    action: `Changement de statut utilisateur: ${newStatus}`,
    category: 'rbac',
    severity: newStatus === 'disabled' || newStatus === 'suspended' ? 'warning' : 'info',
    details: `Le statut de l utilisateur ${targetUid} a été modifié vers '${newStatus}'. ${reason ? `Motif: ${reason}` : ''}`,
    actorName: actor.name,
    actorRole: actor.role,
    actorUid: actor.uid,
  });
}

export async function updateManagedUserProfile(
  targetUid: string,
  updates: Partial<ManagedUser>,
  actor: { uid: string; name: string; role: string },
): Promise<void> {
  try {
    const ref = doc(db, USERS_COLLECTION, targetUid);
    await updateDoc(ref, {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    if (updates.displayName) {
      const dgConfigRef = doc(db, 'system', 'directorGeneral');
      const dgSnap = await getDoc(dgConfigRef);
      if (dgSnap.exists() && dgSnap.data()?.uid === targetUid) {
        await updateDoc(dgConfigRef, {
          displayName: updates.displayName,
          updatedBy: actor.uid,
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    console.warn('Mise à jour Firestore impossible:', error);
  }

  const localList = getLocalManagedUsers();
  const existing = localList.find((u) => u.uid === targetUid);
  if (existing) {
    Object.assign(existing, updates);
    saveLocalManagedUser(existing);
  }

  await recordAuditLog({
    action: 'Modification profil utilisateur',
    category: 'rbac',
    severity: 'info',
    details: `Mise à jour des informations de l'utilisateur ${targetUid} (${updates.displayName || 'Profil'}).`,
    actorName: actor.name,
    actorRole: actor.role,
    actorUid: actor.uid,
  });
}

export async function appointDirectorGeneral(
  params: {
    uid?: string;
    displayName: string;
    email: string;
    phone?: string;
    password?: string;
  },
  actor: { uid: string; name: string; role: string },
  previousDgUid?: string,
): Promise<ManagedUser> {
  const dgRecord = await appointDgCore(params, actor, previousDgUid);

  const dgUser: ManagedUser = {
    uid: dgRecord.uid,
    displayName: dgRecord.displayName || params.displayName.trim(),
    email: dgRecord.email || params.email.trim(),
    phone: dgRecord.phone || params.phone?.trim() || null,
    category: 'direction',
    role: 'directeur_general',
    status: 'active',
    isApproved: true,
    registrationStatus: 'approved',
    permissions: ['*'],
    createdAt: dgRecord.appointedAt || Date.now(),
    updatedAt: Date.now(),
  };

  saveLocalManagedUser(dgUser);
  return dgUser;
}

export async function createAdministrativeUser(
  params: {
    displayName: string;
    email: string;
    phone?: string;
    role: UserRole;
    category: UserCategory;
    agencyId?: string | null;
    function?: UserFunction;
    password?: string;
  },
  actor: { uid: string; name: string; role: string },
): Promise<ManagedUser> {
  let newUid = '';

  if (isFirebaseConfigured && params.password && params.email) {
    try {
      const secondaryApp = initializeApp(firebaseConfig, `AuthCreateUser_${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, params.email, params.password);
      newUid = cred.user.uid;
      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);
    } catch (err) {
      console.warn('Création Firebase Auth via instance secondaire:', err);
    }
  }

  if (!newUid) {
    newUid = `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  }

  const permissions =
    params.role === 'administrateur_agence'
      ? ['agency_read', 'agency_write', 'operations_read', 'operations_write', 'billetage_read', 'billetage_write']
      : params.role === 'agent'
        ? ['operations_create', 'operations_read', 'billetage_create', 'billetage_read']
        : [];

  const newUser: ManagedUser = {
    uid: newUid,
    displayName: params.displayName.trim(),
    email: params.email.trim(),
    phone: params.phone?.trim() || null,
    category: params.category,
    role: params.role,
    function: params.function,
    agencyId: params.agencyId || null,
    status: 'active',
    isApproved: true,
    registrationStatus: 'approved',
    permissions,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  try {
    const userDocRef = doc(db, USERS_COLLECTION, newUid);
    await setDoc(
      userDocRef,
      {
        ...newUser,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.warn('Erreur écriture Firestore nouvel utilisateur:', error);
  }

  saveLocalManagedUser(newUser);

  await recordAuditLog({
    action: `Création compte administratif (${params.role})`,
    category: 'rbac',
    severity: 'info',
    details: `Création du compte ${params.displayName} (${params.role}) avec affectation agence ${params.agencyId || 'globale'}.`,
    actorName: actor.name,
    actorRole: actor.role,
    actorUid: actor.uid,
  });

  return newUser;
}
