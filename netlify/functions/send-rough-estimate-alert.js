import { getAdminEmail, renderIntroEmail, sendIntroEmail } from './_intro-email.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { homeownerEmail, homeownerName, contractorName, projectTitle, amount } = JSON.parse(event.body || '{}');
  if (!homeownerEmail) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Homeowner email is required' }) };
  }

  try {
    const info = await sendIntroEmail({
      to: homeownerEmail,
      cc: getAdminEmail(),
      subject: `New rough estimate for ${projectTitle || 'your project'}`,
      html: renderIntroEmail({
        heading: 'New Rough Estimate Received',
        greeting: `Hi ${homeownerName || 'Homeowner'},`,
        bodyLines: [
          `${contractorName || 'A contractor'} submitted a rough estimate through Blueprint.`,
          'You can review the estimate in your homeowner portal and continue the process from there.',
        ],
        detailLines: [
          `<strong>Project:</strong> ${projectTitle || 'Project request'}`,
          `<strong>Contractor:</strong> ${contractorName || 'Contractor'}`,
          `<strong>Rough estimate:</strong> $${Number(amount || 0).toLocaleString()}`,
        ],
      }),
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, messageId: info.messageId }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to send rough estimate alert' }),
    };
  }
};
