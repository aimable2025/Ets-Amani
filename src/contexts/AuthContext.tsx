import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../lib/firebase';
import {
  createPendingUserProfile,
  getUserProfile,
  type PendingUserProfileInput,
} from '../services/UserProfileService';
import type {
  AppUser,
  PublicRegistrationRole,
  UserRole,
} from '../types/auth';

export interface PublicRegistrationFormInput {
  email: string;
  password: string;
  phone: string;
  firstName: string;
  lastName: string;
  postName?: string;
  gender?: string;
  requestedRole: PublicRegistrationRole;
  province?: string;
  profession?: string;
  agencyId?: string;
}

interface AuthContextValue {
  user: AppUser | null;
  firebaseUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  role: UserRole | null;
  isAdministrateurSysteme: boolean;
  isDirecteurGeneral: boolean;
  isAdministrateurAgence: boolean;
  isAgent: boolean;
  isClient: boolean;
  isAbonne: boolean;
  canAccessProtectedModules: boolean;
  hasPermission: (permission: string) => boolean;
  signIn: (email: string, password?: string) => Promise<void>;
  signOut: () => Promise<void>;
  registerPublicUser: (input: PublicRegistrationFormInput) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'ets_amani_session_user';

// Helper interne pour normaliser les rôles et permissions
const normalizeUserPermissions = (rawUser: AppUser): AppUser => {
  const normalizedRole = rawUser.role ? rawUser.role.trim().toLowerCase() : '';
  const isPrivileged =
    normalizedRole === 'administrateur_systeme' || normalizedRole === 'directeur_general';

  if (isPrivileged) {
    return {
      ...rawUser,
      role: normalizedRole as UserRole,
      isApproved: true,
      status: 'active',
      registrationStatus: 'approved',
    };
  }

  return {
    ...rawUser,
    role: normalizedRole as UserRole,
  };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialisation ultra-rapide via la session locale, puis mise à jour réseau
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      let hasLocalSession = false;

      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as AppUser;
          if (isMounted) {
            setUser(normalizeUserPermissions(parsed));
            hasLocalSession = true;
            // Déblocage immédiat de l'UI si on a un utilisateur en cache
            setIsLoading(false);
          }
        }
      } catch {
        // ignore
      }

      if (isFirebaseConfigured && auth) {
        onAuthStateChanged(auth, async (fbUser) => {
          if (!isMounted) return;
          setFirebaseUser(fbUser);
          if (fbUser) {
            try {
              const profile = await getUserProfile(fbUser.uid);
              if (profile && isMounted) {
                const normalized = normalizeUserPermissions(profile);
                setUser(normalized);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
              }
            } catch (err) {
              console.warn('[Ets AMANI] Erreur chargement profil Firestore :', err);
            }
          } else if (isMounted) {
            setUser(null);
            localStorage.removeItem(STORAGE_KEY);
          }

          if (isMounted && !hasLocalSession) {
            setIsLoading(false);
          }
        });
      } else if (isMounted && !hasLocalSession) {
        setIsLoading(false);
      }
    };

    void restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const signIn = useCallback(
    async (emailInput: string, passwordInput?: string) => {
      const normalizedEmail = emailInput.trim().toLowerCase();

      if (!normalizedEmail || !passwordInput) {
        throw new Error('Veuillez renseigner votre email et votre mot de passe.');
      }

      if (isFirebaseConfigured && auth) {
        try {
          const userCredential = await signInWithEmailAndPassword(
            auth,
            normalizedEmail,
            passwordInput
          );
          setFirebaseUser(userCredential.user);
          const profile = await getUserProfile(userCredential.user.uid);
          if (profile) {
            const normalized = normalizeUserPermissions(profile);
            setUser(normalized);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
            return;
          }
          throw new Error('Profil utilisateur introuvable dans la base Firestore.');
        } catch (err: unknown) {
          if (!navigator.onLine) {
            const cached = localStorage.getItem(STORAGE_KEY);
            if (cached) {
              const parsed = JSON.parse(cached) as AppUser;
              if (parsed.email?.toLowerCase() === normalizedEmail) {
                setUser(normalizeUserPermissions(parsed));
                return;
              }
            }
            throw new Error('Connexion réseau requise pour valider votre session.');
          }
          const errorMessage = err instanceof Error ? err.message : 'Identifiants incorrects.';
          throw new Error(errorMessage);
        }
      } else {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as AppUser;
          if (parsed.email?.toLowerCase() === normalizedEmail) {
            setUser(normalizeUserPermissions(parsed));
            return;
          }
        }
        throw new Error('Service d authentification indisponible. Veuillez vérifier votre connexion.');
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    try {
      if (isFirebaseConfigured && auth) {
        await firebaseSignOut(auth);
      }
    } catch {
      // ignore
    }
    setUser(null);
    setFirebaseUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const registerPublicUser = useCallback(
    async (input: PublicRegistrationFormInput) => {
      const normalizedEmail = input.email.trim().toLowerCase();
      let uid = `candidate-${Date.now()}`;

      if (isFirebaseConfigured && auth) {
        try {
          const cred = await createUserWithEmailAndPassword(
            auth,
            normalizedEmail,
            input.password
          );
          uid = cred.user.uid;
          await firebaseSignOut(auth);
        } catch (err: unknown) {
          console.warn('[Ets AMANI] Erreur création compte Auth :', err);
          const msg = err instanceof Error ? err.message : 'Impossible de créer le compte utilisateur.';
          throw new Error(msg);
        }
      }

      const pendingData: PendingUserProfileInput = {
        fullName: `${input.firstName} ${input.lastName}`.trim(),
        firstName: input.firstName,
        lastName: input.lastName,
        postName: input.postName || '',
        gender: input.gender || 'M',
        dateOfBirth: '2000-01-01',
        placeOfBirth: input.province || 'Nord-Kivu',
        avenue: '',
        neighborhood: '',
        commune: '',
        province: input.province || 'Nord-Kivu',
        nationality: 'Congolaise',
        profession: input.profession || 'Commerçant',
        identityDocument: 'Carte d électeur',
        phone: input.phone,
        email: normalizedEmail,
        requestedRole: input.requestedRole,
        agencyId: input.agencyId || null,
      };

      try {
        await createPendingUserProfile(uid, pendingData);
      } catch (err: unknown) {
        console.warn('[Ets AMANI] Erreur écriture Firestore profil en attente :', err);
        const msg = err instanceof Error ? err.message : 'Erreur lors de l enregistrement de la demande.';
        throw new Error(msg);
      }

      setUser(null);
      setFirebaseUser(null);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    },
    []
  );

  const refreshUser = useCallback(async () => {
    if (!user) return;
    if (isFirebaseConfigured && user.uid) {
      try {
        const fresh = await getUserProfile(user.uid);
        if (fresh) {
          const normalized = normalizeUserPermissions(fresh);
          setUser(normalized);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        }
      } catch {
        // ignore
      }
    }
  }, [user]);

  const value = useMemo<AuthContextValue>(() => {
    const rawRole = user?.role || '';
    const normalizedRole = rawRole.trim().toLowerCase();
    const isPrivileged = normalizedRole === 'administrateur_systeme' || normalizedRole === 'directeur_general';

    const canAccessProtectedModules =
      !!user &&
      (isPrivileged ||
        (user.isApproved && (user.status === 'active' || user.status === 'approved')));

    const hasPermission = (permission: string) => {
      if (!user) return false;
      if (isPrivileged) return true;
      if (user.permissions?.includes('*') || user.permissions?.includes(permission)) return true;
      return false;
    };

    return {
      user,
      firebaseUser,
      isAuthenticated: !!user,
      isLoading,
      role: normalizedRole as UserRole,
      isAdministrateurSysteme: normalizedRole === 'administrateur_systeme',
      isDirecteurGeneral: normalizedRole === 'directeur_general',
      isAdministrateurAgence: normalizedRole === 'administrateur_agence',
      isAgent: normalizedRole === 'agent',
      isClient: normalizedRole === 'client',
      isAbonne: normalizedRole === 'abonne',
      canAccessProtectedModules,
      hasPermission,
      signIn,
      signOut,
      registerPublicUser,
      refreshUser,
    };
  }, [
    user,
    firebaseUser,
    isLoading,
    signIn,
    signOut,
    registerPublicUser,
    refreshUser,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth doit être utilisé à l intérieur de AuthProvider');
  }
  return ctx;
}
