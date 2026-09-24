import {
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { db as firestoreDb } from '../lib/firebase';
import type { DgFeatureControl, DgFeatureKey } from '../types/management';
import { DEFAULT_DG_FEATURES } from '../utils/defaultDgFeatures';

const COLLECTION = 'systemControls';
const DOCUMENT_ID = 'dgFeatures';

export async function getDgFeatures(): Promise<DgFeatureControl> {
  try {
    const ref = doc(firestoreDb, COLLECTION, DOCUMENT_ID);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) {
      return DEFAULT_DG_FEATURES;
    }
    return {
      ...DEFAULT_DG_FEATURES,
      ...snapshot.data(),
    };
  } catch {
    return DEFAULT_DG_FEATURES;
  }
}

export async function saveDgFeatures(
  features: DgFeatureControl
): Promise<void> {
  const ref = doc(firestoreDb, COLLECTION, DOCUMENT_ID);
  await setDoc(ref, features, { merge: true });
}

export async function resetDgFeatures(): Promise<DgFeatureControl> {
  await saveDgFeatures(DEFAULT_DG_FEATURES);
  return DEFAULT_DG_FEATURES;
}

export async function toggleDgFeature(
  key: DgFeatureKey
): Promise<DgFeatureControl> {
  const current = await getDgFeatures();
  const next: DgFeatureControl = {
    ...current,
    [key]: !current[key],
  };
  await saveDgFeatures(next);
  return next;
}
