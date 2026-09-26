import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

export const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    'AIzaSyCte0umcFfJNPBdzlT0MbXwDFaEruRv9lI',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    'ets-amani.firebaseapp.com',
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    'ets-amani',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    'ets-amani.firebasestorage.app',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    '697171148070',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    '1:697171148070:web:bd1150821e623991ad55e7',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

// Initialisation unique du singleton Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Service d'Authentification Firebase
export const auth = getAuth(app);

// Service Firestore avec persistance locale IndexedDB multi-onglets active
export const firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

/**
 * Aliases de compatibilité pour Firestore (modules UI, services métiers et workers)
 */
export const firestoreDb = firestore;
export const db = firestore;

export default app;
