import Dexie, { type Table } from 'dexie';
import type { Operation, OperationAssignment } from '../types/operation';

export interface BilletageDenomination {
  id?: number;
  billetageId: string;
  currency: string;
  denomination: number;
  quantity: number;
  subtotal: number;
  createdAt: number;
  updatedAt: number;
}

export interface Billetage {
  id: string;
  type: 'personal' | 'business';
  userId: string;
  agencyId?: string | null;
  currency: string;
  calculatedTotal: number;
  declaredAmount?: number | null;
  discrepancy?: number | null;
  status: 'draft' | 'completed' | 'validated' | 'cancelled';
  syncStatus: 'local' | 'pending' | 'synced' | 'error';
  transactionId?: string | null;
  reference?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface SyncQueueItem {
  id?: number;
  entity:
    | 'billetage'
    | 'operation'
    | 'operationAssignment';
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  attempts: number;
  lastError?: string | null;
  status:
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed';
  createdAt: number;
  updatedAt: number;
}

export interface OperationSyncQueueItem {
  id?: number;
  entity:
    | 'operation'
    | 'operationAssignment';
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  attempts: number;
  lastError?: string | null;
  status:
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed';
  createdAt: number;
  updatedAt: number;
}

/**
 * Numéro interne Ets AMANI mis en cache localement.
 */
export interface LocalInternalNumber {
  id: string;
  phoneNumber: string;
  operator:
    | 'vodacom'
    | 'airtel'
    | 'orange'
    | 'africell';
  agencyId: string | null;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  label?: string;
  description?: string;
  status:
    | 'active'
    | 'inactive'
    | 'suspended'
    | 'archived';
  monitoringEnabled: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Opération SMS locale.
 */
export interface LocalSmsOperation {
  id: string;
  internalNumberId: string;
  agencyId: string | null;
  operator:
    | 'vodacom'
    | 'airtel'
    | 'orange'
    | 'africell';
  sender?: string;
  rawMessage: string;
  transactionReference?: string;
  amount?: number;
  currency?: string;
  transactionType?: string;
  operationDate?: number;
  receivedAt: number;
  processedAt?: number;
  status:
    | 'pending'
    | 'processed'
    | 'matched'
    | 'flagged';
  syncStatus:
    | 'pending'
    | 'synced'
    | 'failed';
  createdAt: number;
  updatedAt: number;
}

/**
 * Vraie file Offline-First dédiée aux opérations SMS.
 */
export interface SmsSyncQueueItem {
  id?: number;
  smsOperationId: string;
  operation: 'create' | 'update';
  status:
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed';
  attempts: number;
  lastError?: string | null;
  nextAttemptAt: number;
  lastAttemptAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * Base locale Ets AMANI.
 */
export class EtsAmaniDatabase extends Dexie {
  billetages!: Table<Billetage, string>;
  billetageDenominations!: Table<BilletageDenomination, number>;
  syncQueue!: Table<SyncQueueItem, number>;
  operations!: Table<Operation, string>;
  operationAssignments!: Table<OperationAssignment, string>;
  internalNumbers!: Table<LocalInternalNumber, string>;
  smsOperations!: Table<LocalSmsOperation, string>;
  smsSyncQueue!: Table<SmsSyncQueueItem, number>;

  constructor() {
    super('EtsAmaniDB');

    this.version(1).stores({
      billetages:
        'id, userId, agencyId, type, currency, status, syncStatus, transactionId, createdAt, updatedAt',
      billetageDenominations:
        '++id, billetageId, currency, denomination, createdAt, updatedAt',
      syncQueue:
        '++id, entity, entityId, operation, status, createdAt, updatedAt',
    });

    this.version(2).stores({
      billetages:
        'id, userId, agencyId, type, currency, status, syncStatus, transactionId, createdAt, updatedAt',
      billetageDenominations:
        '++id, billetageId, currency, denomination, createdAt, updatedAt',
      syncQueue:
        '++id, entity, entityId, operation, status, createdAt, updatedAt',
      operations:
        'id, operationNumber, agencyId, status, priority, type, createdBy, createdAt, updatedAt, syncStatus',
      operationAssignments:
        'id, operationId, agencyId, agentId, status, createdAt, updatedAt, syncStatus',
    });

    this.version(3).stores({
      billetages:
        'id, userId, agencyId, type, currency, status, syncStatus, transactionId, createdAt, updatedAt',
      billetageDenominations:
        '++id, billetageId, currency, denomination, createdAt, updatedAt',
      syncQueue:
        '++id, entity, entityId, operation, status, createdAt, updatedAt',
      operations:
        'id, operationNumber, agencyId, status, priority, type, createdBy, createdAt, updatedAt, syncStatus',
      operationAssignments:
        'id, operationId, agencyId, agentId, status, createdAt, updatedAt, syncStatus',
      internalNumbers:
        'id, phoneNumber, operator, agencyId, assignedUserId, status, monitoringEnabled, createdAt, updatedAt',
      smsOperations:
        'id, internalNumberId, agencyId, operator, sender, transactionReference, amount, transactionType, operationDate, receivedAt, status, syncStatus, createdAt, updatedAt',
    });

    this.version(4).stores({
      billetages:
        'id, userId, agencyId, type, currency, status, syncStatus, transactionId, createdAt, updatedAt',
      billetageDenominations:
        '++id, billetageId, currency, denomination, createdAt, updatedAt',
      syncQueue:
        '++id, entity, entityId, operation, status, createdAt, updatedAt',
      operations:
        'id, operationNumber, agencyId, status, priority, type, createdBy, createdAt, updatedAt, syncStatus',
      operationAssignments:
        'id, operationId, agencyId, agentId, status, createdAt, updatedAt, syncStatus',
      internalNumbers:
        'id, phoneNumber, operator, agencyId, assignedUserId, status, monitoringEnabled, createdAt, updatedAt',
      smsOperations:
        'id, internalNumberId, agencyId, operator, sender, transactionReference, amount, transactionType, operationDate, receivedAt, status, syncStatus, createdAt, updatedAt',
      smsSyncQueue:
        '++id, smsOperationId, operation, status, attempts, nextAttemptAt, lastAttemptAt, createdAt, updatedAt',
    });
  }
}

/**
 * Instance unique de la base locale.
 */
export const db = new EtsAmaniDatabase();
