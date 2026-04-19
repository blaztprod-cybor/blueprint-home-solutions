import { PublicContractOpportunity } from '../types';

export interface PublicContractsPayload {
  summary: {
    hot_window_days: number;
    awarded_contracts: number;
  };
  awardedContracts: PublicContractOpportunity[];
  source?: {
    contracts?: string;
    vendors?: string;
  };
}

export async function fetchPublicContracts(): Promise<PublicContractsPayload> {
  const response = await fetch('/api/public-contracts', { cache: 'no-store' });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to load public contracts');
  }

  return payload;
}
