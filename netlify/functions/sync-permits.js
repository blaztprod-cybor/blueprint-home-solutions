import { syncDobPermits } from './_permit-sync.js';

export const config = {
  schedule: '@daily',
};

export default async () => {
  try {
    const payload = await syncDobPermits();
    console.log('[PERMIT SYNC][DAILY]', {
      count: payload.count,
      latestIssuedDate: payload.permits[0]?.filing_date || null,
      generatedAt: payload.generatedAt,
      startDate: payload.startDate,
    });
  } catch (error) {
    console.error('[PERMIT SYNC][DAILY][ERROR]', error);
    throw error;
  }
};
