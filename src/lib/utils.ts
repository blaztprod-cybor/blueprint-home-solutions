import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPermitPhase(status?: string) {
  const normalizedStatus = String(status || '').trim();

  if (normalizedStatus === 'Pending Plan Examiner Assignment') return 'Phase 1';
  if (normalizedStatus === 'Plan Examiner Review') return 'Phase 2';
  if (normalizedStatus === 'Pending Prof Cert QA Assignment') return 'Phase 3';
  if (normalizedStatus === 'Prof Cert QA Review') return 'Phase 4';
  if (normalizedStatus === 'Approved') return 'Approved';

  return normalizedStatus || 'N/A';
}

export function isApprovedPermitPhase(status?: string) {
  return String(status || '').trim() === 'Approved';
}
