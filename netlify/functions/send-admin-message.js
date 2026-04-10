import { getAdminAuth, getAdminDb } from './_firebase-admin.js';
import { createEmailLogContext, renderIntroEmail, sendLoggedIntroEmail } from './_intro-email.js';
import { getVerifiedRequestUser } from './_user-records.js';

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

    if (!requestUser.isAdmin) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Admin access required' }),
      };
    }

    const { email, name, subject, message, recipientType } = JSON.parse(event.body || '{}');
    if (!email || !subject || !message) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Email, subject, and message are required' }),
      };
    }

    const recipientLabel = recipientType === 'home-pro' ? 'Home Pro' : 'Homeowner';
    const safeName = name || recipientLabel;

    const info = await sendLoggedIntroEmail({
      logContext: createEmailLogContext({
        handlerName: 'send-admin-message',
        eventType: 'admin_message',
        recipient: email,
        metadata: {
          recipientType: recipientType || 'contact',
          sentBy: requestUser.email,
        },
      }),
      mail: {
        to: email,
        subject,
        html: renderIntroEmail({
          heading: 'Blueprint Home Solutions Update',
          greeting: `Hi ${safeName},`,
          bodyLines: String(message)
            .split(/\n+/)
            .map((line) => line.trim())
            .filter(Boolean),
          detailLines: [
            `<strong>Recipient type:</strong> ${recipientLabel}`,
          ],
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
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to send admin message' }),
    };
  }
};
