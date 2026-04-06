import { getAdminEmail, renderIntroEmail, sendIntroEmail } from './_intro-email.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const {
    homeownerEmail,
    homeownerName,
    contractorEmail,
    contractorName,
    projectTitle,
    amount,
    estimateType,
  } = JSON.parse(event.body || '{}');

  if (!homeownerEmail || !contractorEmail) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Homeowner and contractor emails are required' }),
    };
  }

  const nextStep =
    estimateType === 'final'
      ? 'The project can now move into contracting and execution through Blueprint.'
      : 'Next step: coordinate the in-person inspection and final estimate through Blueprint.';

  try {
    const info = await sendIntroEmail({
      to: [homeownerEmail, contractorEmail],
      cc: getAdminEmail(),
      subject: `${estimateType === 'final' ? 'Final' : 'Rough'} estimate accepted for ${projectTitle || 'project'}`,
      html: renderIntroEmail({
        heading: `${estimateType === 'final' ? 'Final' : 'Rough'} Estimate Accepted`,
        greeting: `Hi ${homeownerName || 'Homeowner'} and ${contractorName || 'Home Pro'},`,
        bodyLines: [
          `${homeownerName || 'The homeowner'} accepted the ${estimateType === 'final' ? 'final' : 'rough'} estimate through Blueprint.`,
          nextStep,
        ],
        detailLines: [
          `<strong>Project:</strong> ${projectTitle || 'Project'}`,
          `<strong>Accepted estimate type:</strong> ${estimateType === 'final' ? 'Final estimate' : 'Rough estimate'}`,
          `<strong>Accepted amount:</strong> $${Number(amount || 0).toLocaleString()}`,
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
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to send estimate acceptance notification' }),
    };
  }
};
