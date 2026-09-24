import type { AppUser } from '../types/auth';

export function getDashboardRoute(
  user: AppUser
): string {
  if (!user.isApproved) {
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
      return '/';
  }
}
