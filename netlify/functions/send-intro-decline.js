import { getAdminEmail, renderIntroEmail, sendIntroEmail } from './_intro-email.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { contractorEmail, contractorName, category, location, declineReason } = JSON.parse(event.body || '{}');
  if (!contractorEmail) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Contractor email is required' }) };
  }

  try {
    const info = await sendIntroEmail({
      to: contractorEmail,
      cc: getAdminEmail(),
      subject: `Blueprint update on your ${category || 'project'} request`,
      html: renderIntroEmail({
        heading: 'Introduction Request Update',
        greeting: `Hi ${contractorName || 'Home Pro'},`,
        bodyLines: [
          'Blueprint is not moving forward with this introduction request.',
          'Thank you for your interest. We will keep you posted on future opportunities that fit your profile.',
        ],
        detailLines: [
          `<strong>Project:</strong> ${category || 'Project request'}`,
          `<strong>Area:</strong> ${location || 'Local service area'}`,
          `<strong>Outcome:</strong> Declined`,
          declineReason ? `<strong>Note:</strong> ${declineReason}` : '<strong>Note:</strong> No additional reason provided',
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
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to send decline email' }),
    };
  }
};
