import { getAdminEmail, renderIntroEmail, sendIntroEmail } from './_intro-email.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { email, name } = JSON.parse(event.body || '{}');
  if (!email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email is required' }) };
  }

  try {
    const info = await sendIntroEmail({
      to: email,
      cc: getAdminEmail(),
      subject: 'Blueprint Home Pro signup received',
      html: renderIntroEmail({
        heading: 'Home Pro Signup Received',
        greeting: `Hi ${name || 'Home Pro'},`,
        bodyLines: [
          'Blueprint received your contractor signup and your account has been created.',
          'Your account remains unverified until Blueprint completes its review. You can still finish your profile and access your portal while review is pending.',
        ],
        detailLines: [
          '<strong>Status:</strong> Account created',
          '<strong>Verification:</strong> Pending Blueprint review',
          '<strong>Next step:</strong> Blueprint will review your profile before marketplace access is approved',
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
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to send contractor signup confirmation' }),
    };
  }
};
