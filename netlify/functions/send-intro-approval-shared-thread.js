import { getAdminEmail, renderIntroEmail, sendIntroEmail } from './_intro-email.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { homeownerEmail, homeownerName, contractorEmail, contractorName, category, location, homeownerPhone } = JSON.parse(event.body || '{}');
  if (!homeownerEmail || !contractorEmail) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Homeowner and contractor emails are required' }) };
  }

  try {
    const info = await sendIntroEmail({
      to: [homeownerEmail, contractorEmail].join(', '),
      cc: getAdminEmail(),
      replyTo: getAdminEmail(),
      subject: `Blueprint introduction approved: ${category || 'project request'}`,
      html: renderIntroEmail({
        heading: 'Blueprint Introduction Approved',
        greeting: `Hi ${homeownerName || 'Homeowner'} and ${contractorName || 'Home Pro'},`,
        bodyLines: [
          'Blueprint approved this introduction and is opening one shared email thread so everyone can coordinate in one place.',
          'Please reply on this thread for scheduling and next steps so Blueprint remains copied during the early workflow.',
        ],
        detailLines: [
          `<strong>Project:</strong> ${category || 'Project request'}`,
          `<strong>Area:</strong> ${location || 'Local service area'}`,
          `<strong>Homeowner:</strong> ${homeownerName || 'Homeowner'}${homeownerPhone ? ` (${homeownerPhone})` : ''}`,
          `<strong>Home Pro:</strong> ${contractorName || 'Home Pro'}`,
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
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to send approval email' }),
    };
  }
};
