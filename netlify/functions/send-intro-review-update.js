import { getAdminEmail, renderIntroEmail, sendIntroEmail } from './_intro-email.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { recipientEmail, recipientName, recipientType, category, location, statusLabel, nextStep } = JSON.parse(event.body || '{}');
  if (!recipientEmail) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Recipient email is required' }) };
  }

  try {
    const info = await sendIntroEmail({
      to: recipientEmail,
      cc: getAdminEmail(),
      subject: `Blueprint update for ${category || 'your request'}`,
      html: renderIntroEmail({
        heading: recipientType === 'homeowner' ? 'Contractor Interest Update' : 'Introduction Request Review',
        greeting: `Hi ${recipientName || 'there'},`,
        bodyLines: [
          statusLabel || 'Blueprint has an update on your request.',
          nextStep || 'Blueprint is coordinating the next step and will follow up again when the request changes.',
        ],
        detailLines: [
          `<strong>Project:</strong> ${category || 'Project request'}`,
          `<strong>Area:</strong> ${location || 'Local service area'}`,
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
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to send review update' }),
    };
  }
};
