import { db } from '../lib/db';

export interface ResolvedInternalNumber {
  internalNumberId: string;
  phoneNumber: string;
  operator: 'vodacom' | 'airtel' | 'orange' | 'africell';
  agencyId: string | null;
  assignedUserId?: string | null;
  monitoringEnabled: boolean;
}

function normalizePhoneNumber(phoneNumber: string): string {
  return phoneNumber
    .trim()
    .replace(/[^\d+]/g, '')
    .replace(/^00/, '+');
}

export async function resolveInternalNumber(
  phoneNumber: string
): Promise<ResolvedInternalNumber | null> {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) {
    return null;
  }

  const numbers = await db.internalNumbers.toArray();
  const match = numbers.find((item) => {
    const localNumber = normalizePhoneNumber(item.phoneNumber);
    return localNumber === normalized;
  });

  if (!match) {
    return null;
  }

  return {
    internalNumberId: match.id,
    phoneNumber: match.phoneNumber,
    operator: match.operator,
    agencyId: match.agencyId ?? null,
    assignedUserId: match.assignedUserId ?? null,
    monitoringEnabled: match.monitoringEnabled === true,
  };
}
