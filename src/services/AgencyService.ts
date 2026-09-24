import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const AGENCIES_COLLECTION = 'agencies';

export interface Agency {
  id: string;
  name: string;
  code?: string;
  city?: string;
  country?: string;
  status?: string;
  [key: string]: unknown;
}

export const DEFAULT_AGENCIES: Agency[] = [
  {
    id: 'agency-goma-01',
    name: 'Agence Centrale Goma',
    code: 'GOM-01',
    city: 'Goma',
    country: 'RDC',
    status: 'active',
  },
  {
    id: 'agency-kin-01',
    name: 'Agence Kinshasa Gombe',
    code: 'KIN-01',
    city: 'Kinshasa',
    country: 'RDC',
    status: 'active',
  },
  {
    id: 'agency-bkv-01',
    name: 'Agence Bukavu Ibanda',
    code: 'BKV-01',
    city: 'Bukavu',
    country: 'RDC',
    status: 'active',
  },
];

export async function getAgency(agencyId: string): Promise<Agency | null> {
  const normalizedAgencyId = agencyId.trim();
  if (!normalizedAgencyId) {
    return null;
  }
  try {
    const reference = doc(db, AGENCIES_COLLECTION, normalizedAgencyId);
    const snapshot = await getDoc(reference);
    if (snapshot.exists()) {
      const data = snapshot.data();
      const name =
        typeof data.name === 'string'
          ? data.name
          : typeof data.nom === 'string'
            ? data.nom
            : typeof data.agencyName === 'string'
              ? data.agencyName
              : 'Agence sans nom';
      return {
        id: snapshot.id,
        name,
        code: typeof data.code === 'string' ? data.code : undefined,
        city: typeof data.city === 'string' ? data.city : undefined,
        country: typeof data.country === 'string' ? data.country : undefined,
        status: typeof data.status === 'string' ? data.status : undefined,
        ...data,
      };
    }
  } catch (error) {
    console.warn('Ets AMANI - getAgency fallback :', error);
  }
  const defaultMatch = DEFAULT_AGENCIES.find((a) => a.id === normalizedAgencyId);
  if (defaultMatch) {
    return defaultMatch;
  }
  return {
    id: normalizedAgencyId,
    name: `Agence (${normalizedAgencyId})`,
    city: 'Goma',
    country: 'RDC',
    status: 'active',
  };
}

export async function getAgencies(): Promise<Agency[]> {
  try {
    const reference = collection(db, AGENCIES_COLLECTION);
    const agenciesQuery = query(reference, orderBy('name'));
    const snapshot = await getDocs(agenciesQuery);
    if (snapshot.empty) {
      return DEFAULT_AGENCIES;
    }
    return snapshot.docs.map((document) => {
      const data = document.data();
      return {
        id: document.id,
        name:
          typeof data.name === 'string'
            ? data.name
            : typeof data.nom === 'string'
              ? data.nom
              : typeof data.agencyName === 'string'
                ? data.agencyName
                : 'Agence sans nom',
        code: typeof data.code === 'string' ? data.code : undefined,
        city: typeof data.city === 'string' ? data.city : undefined,
        country: typeof data.country === 'string' ? data.country : undefined,
        status: typeof data.status === 'string' ? data.status : undefined,
        ...data,
      };
    });
  } catch (error) {
    console.warn('Ets AMANI - getAgencies fallback to default agencies :', error);
    return DEFAULT_AGENCIES;
  }
}
