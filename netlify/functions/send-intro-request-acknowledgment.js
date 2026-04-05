import { getAdminEmail, renderIntroEmail, sendIntroEmail } from './_intro-email.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { contractorEmail, contractorName, category, town } = JSON.parse(event.body || '{}');
  if (!contractorEmail) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Contractor email is required' }) };
  }

  try {
    const info = await sendIntroEmail({
      to: contractorEmail,
      cc: getAdminEmail(),
      subject: `Blueprint received your ${category || 'project'} introduction request`,
      html: renderIntroEmail({
        heading: 'Introduction Request Received',
        greeting: `Hi ${contractorName || 'Home Pro'},`,
        bodyLines: [
          'Blueprint received your request and will review it before any homeowner introduction is approved.',
          'We will keep you updated as the request moves through the review process.',
        ],
        detailLines: [
          `<strong>Project:</strong> ${category || 'Project request'}`,
          `<strong>Area:</strong> ${town || 'Local service area'}`,
          '<strong>Status:</strong> Requested',
        ],
      }),
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, messageId: info.messageId, threadId: info.messageId }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to send acknowledgment' }),
    };
  }
};
