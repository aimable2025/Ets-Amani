import type { AppUser } from '../types/auth';

/**
 * Redirige l'utilisateur vers son tableau de bord selon son rôle et son état d'approbation.
 */
export function getDashboardRoute(user: AppUser | null): string {
  if (!user) {
    return '/login';
  }

  // Redirection immédiate si le compte n'est pas encore validé par la direction
  if (!user.isApproved || user.status === 'pending' || user.registrationStatus === 'pending') {
    return '/validation-en-attente';
  }

  switch (user.role) {
    case 'administrateur_systeme':
      return '/dashboard/administrateur-systeme';
    case 'directeur_general':
      return '/dashboard/directeur-general';
    case 'administrateur_agence':
      return '/dashboard/administrateur-agence';
    case 'agent':
      return '/dashboard/agent';
    case 'client':
      return '/dashboard/client';
    case 'abonne':
      return '/dashboard/abonne';
    default:
      return '/login';
  }
}
