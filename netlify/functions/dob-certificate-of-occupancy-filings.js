import { fetchPermitRows } from './_dob-filings.js';

export const handler = async (event) => {
  const limitParam = Number.parseInt(event.queryStringParameters?.limit || '20', 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 5000) : 20;

  try {
    const payload = await fetchPermitRows({
      limit,
      filter: 'certificate_of_occupancy',
      occupancyOnly: true,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filings: payload.permits,
        permits: payload.permits,
        meta: payload.meta,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to load certificate of occupancy filings from Supabase',
      }),
    };
  }
};
