import { getAdminAuth, getAdminDb } from './_firebase-admin.js';
import { createEmailLogContext, renderIntroEmail, sendLoggedIntroEmail } from './_intro-email.js';
import { getVerifiedRequestUser } from './_user-records.js';

function formatPermitDate(value) {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const requestUser = await getVerifiedRequestUser({
      authorizationHeader: event.headers.authorization || event.headers.Authorization,
      adminAuth,
      adminDb,
    });

    const { permits } = JSON.parse(event.body || '{}');
    if (!Array.isArray(permits) || permits.length === 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'At least one permit must be selected.' }),
      };
    }

    const trimmedPermits = permits.slice(0, 25);
    const info = await sendLoggedIntroEmail({
      logContext: createEmailLogContext({
        handlerName: 'email-selected-permits',
        eventType: 'permit_selection_email',
        recipient: requestUser.email,
        metadata: {
          permitCount: trimmedPermits.length,
        },
      }),
      mail: {
        to: requestUser.email,
        subject: `Blueprint filing feed selection (${trimmedPermits.length})`,
        html: renderIntroEmail({
          heading: 'Your Blueprint filing selection',
          greeting: `Hi ${requestUser.email.split('@')[0]},`,
          bodyLines: [
            'Here is the filing list you selected from the live Blueprint feed.',
            'Direct homeowner contact remains coordinated through Blueprint.',
          ],
          detailLines: trimmedPermits.map((permit) => [
            `<strong>${permit.borough || 'N/A'}</strong>`,
            `${permit.address || [permit.house_number, permit.street_name].filter(Boolean).join(' ') || 'Address unavailable'}`,
            `ZIP: ${permit.zip_code || 'Unavailable'}`,
            `Work Type: ${permit.job_type || 'N/A'}`,
            `Filed: ${formatPermitDate(permit.filing_date)}`,
            `Projected Cost: $${Number(permit.estimated_job_costs || 0).toLocaleString()}`,
            `Company: ${permit.owner_business_name || permit.owner_name || 'Unavailable'}`,
          ].join('<br/>')),
        }),
      },
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, messageId: info?.messageId || null }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to email selected filings' }),
    };
  }
};
