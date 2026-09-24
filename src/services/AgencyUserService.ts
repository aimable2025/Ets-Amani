import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  AccountStatus,
  UserFunction,
  UserRole,
} from '../types/auth';

const USERS_COLLECTION = 'users';

export interface AgencyUser {
  uid: string;
  displayName: string;
  email?: string;
  phone?: string;
  role: UserRole;
  function?: UserFunction;
  agencyId?: string | null;
  status: AccountStatus;
  isApproved: boolean;
}

export async function getAgencyUsers(
  agencyId: string,
): Promise<AgencyUser[]> {
  const normalizedAgencyId = agencyId.trim();
  if (!normalizedAgencyId) {
    return [];
  }

  const reference = collection(db, USERS_COLLECTION);
  const usersQuery = query(
    reference,
    where('agencyId', '==', normalizedAgencyId),
  );

  const snapshot = await getDocs(usersQuery);
  return snapshot.docs.map((document) => {
    const data = document.data();
    return {
      uid: typeof data.uid === 'string' ? data.uid : document.id,
      displayName: typeof data.displayName === 'string' ? data.displayName : 'Utilisateur',
      email: typeof data.email === 'string' ? data.email : undefined,
      phone: typeof data.phone === 'string' ? data.phone : undefined,
      role: data.role as UserRole,
      function: data.function as UserFunction | undefined,
      agencyId: typeof data.agencyId === 'string' ? data.agencyId : null,
      status: data.status as AccountStatus,
      isApproved: data.isApproved === true,
    };
  });
}

export async function getAgencyUsersByRole(
  agencyId: string,
  role: UserRole,
): Promise<AgencyUser[]> {
  const normalizedAgencyId = agencyId.trim();
  if (!normalizedAgencyId) {
    return [];
  }

  const reference = collection(db, USERS_COLLECTION);
  const usersQuery = query(
    reference,
    where('agencyId', '==', normalizedAgencyId),
    where('role', '==', role),
  );

  const snapshot = await getDocs(usersQuery);
  return snapshot.docs.map((document) => {
    const data = document.data();
    return {
      uid: typeof data.uid === 'string' ? data.uid : document.id,
      displayName: typeof data.displayName === 'string' ? data.displayName : 'Utilisateur',
      email: typeof data.email === 'string' ? data.email : undefined,
      phone: typeof data.phone === 'string' ? data.phone : undefined,
      role: data.role as UserRole,
      function: data.function as UserFunction | undefined,
      agencyId: typeof data.agencyId === 'string' ? data.agencyId : null,
      status: data.status as AccountStatus,
      isApproved: data.isApproved === true,
    };
  });
}

export interface AgencyUserStats {
  total: number;
  agents: number;
  subscribers: number;
  members: number; // alias for backwards compatibility
  clients: number;
  activeAgents: number;
  activeSubscribers: number;
  activeMembers: number; // alias for backwards compatibility
  activeClients: number;
}

export async function getAgencyUserStats(
  agencyId: string,
): Promise<AgencyUserStats> {
  const users = await getAgencyUsers(agencyId);
  const agents = users.filter((item) => item.role === 'agent');
  const subscribers = users.filter((item) => item.role === 'abonne');
  const clients = users.filter((item) => item.role === 'client');

  const activeAgents = agents.filter(
    (item) => item.status === 'active' && item.isApproved,
  ).length;
  const activeSubscribers = subscribers.filter(
    (item) => item.status === 'active' && item.isApproved,
  ).length;
  const activeClients = clients.filter(
    (item) => item.status === 'active' && item.isApproved,
  ).length;

  return {
    total: users.length,
    agents: agents.length,
    subscribers: subscribers.length,
    members: subscribers.length,
    clients: clients.length,
    activeAgents,
    activeSubscribers,
    activeMembers: activeSubscribers,
    activeClients,
  };
}
