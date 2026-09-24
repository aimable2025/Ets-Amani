import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  Calculator,
  CalendarCheck2,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  KeyRound,
  LayoutDashboard,
  MessageSquare,
  Package,
  Receipt,
  RotateCcw,
  Scale,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  WalletCards,
  Wifi,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DgFeatures } from '../../../types/management';

export type DgModuleCategory =
  | 'operations'
  | 'finance'
  | 'network'
  | 'oversight'
  | 'settings';

export interface DgModuleItem {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  category: DgModuleCategory;
  badge?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  isAvailable?: (features?: DgFeatures) => boolean;
}

export const DG_MODULES: DgModuleItem[] = [
  {
    id: 'operations-management',
    title: 'Opérations Réseau',
    description: 'Création, affectation et suivi des missions opérationnelles d agence.',
    icon: Activity,
    category: 'operations',
    variant: 'primary',
  },
  {
    id: 'billetage',
    title: 'Billetage & Liquidités',
    description: 'Comptage contradictoire, réconciliation des devises USD / CDF et contrôle caisse.',
    icon: WalletCards,
    category: 'operations',
    variant: 'success',
  },
  {
    id: 'internal-numbers',
    title: 'Numéros Flotte & Supervision',
    description: 'Gestion de la flotte téléphonique interne et suivi des flux SMS opérateurs.',
    icon: Smartphone,
    category: 'operations',
    variant: 'warning',
    isAvailable: (f) => f?.internalNumbersManage ?? true,
  },
  {
    id: 'connectivity-sync',
    title: 'Moteur Offline-First',
    description: 'État du réseau, latence, volume Dexie IndexedDB et synchronisation cloud.',
    icon: Wifi,
    category: 'network',
    variant: 'primary',
  },
  {
    id: 'agencies',
    title: 'Réseau des Agences',
    description: 'Supervision des succursales, guichets, plafonds et directeurs locaux.',
    icon: Building2,
    category: 'network',
    isAvailable: (f) => f?.agenciesManage ?? true,
  },
  {
    id: 'agents-management',
    title: 'Personnel & Guichets',
    description: 'Gestion des affectations d agents, polyvalence multi-services et habilitations.',
    icon: Users,
    category: 'network',
  },
  {
    id: 'registration-requests',
    title: 'Validations Inscriptions',
    description: 'Approbation ou rejet des demandes de comptes clients et abonnés.',
    icon: UserCheck,
    category: 'oversight',
    variant: 'primary',
    isAvailable: (f) => (f ? f.membersManage || f.clientsManage : true),
  },
  {
    id: 'audit-logs',
    title: 'Journal d Audit',
    description: 'Traçabilité immuable de l ensemble des actions système et modifications de statut.',
    icon: ShieldCheck,
    category: 'oversight',
    variant: 'danger',
    isAvailable: (f) => f?.auditRead ?? true,
  },
  {
    id: 'dg-config',
    title: 'Configuration DG',
    description: 'Paramètres des modules opérationnels, délais de rétention et identité.',
    icon: Settings,
    category: 'settings',
  },
];
