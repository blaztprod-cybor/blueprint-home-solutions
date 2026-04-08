import {
  createEmailLogContext,
  renderIntroEmail,
  sendLoggedIntroEmail,
} from './_intro-email.js';
import { getAdminDb } from './_firebase-admin.js';

function getAudienceLabel(audience) {
  if (audience === 'contractors') return 'Home Pros';
  if (audience === 'homeowners') return 'Homeowners';
  return 'Blueprint Members';
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { audience = 'all', subject, message, sentBy } = JSON.parse(event.body || '{}');

  if (!subject || !message) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Subject and message are required' }),
    };
  }

  try {
    const db = getAdminDb();
    const snapshot = await db.collection('users')
      .where('notifyOnProductUpdates', '==', true)
      .get();

    const recipients = snapshot.docs
      .map((doc) => doc.data())
      .filter((user) => {
        if (!user.email || typeof user.email !== 'string') return false;
        if (user.isDisabled) return false;
        if (audience === 'contractors') return user.role === 'Contractor';
        if (audience === 'homeowners') return user.role === 'Homeowner';
        return user.role === 'Contractor' || user.role === 'Homeowner';
      });

    const results = await Promise.allSettled(
      recipients.map((recipient) =>
        sendLoggedIntroEmail({
          logContext: createEmailLogContext({
            handlerName: 'send-broadcast-update',
            eventType: 'broadcast_update',
            recipient: recipient.email,
            metadata: {
              audience,
              recipientRole: recipient.role,
              sentBy,
            },
          }),
          mail: {
            to: recipient.email,
            subject,
            html: renderIntroEmail({
              heading: subject,
              greeting: `Hi ${recipient.name || getAudienceLabel(audience)},`,
              bodyLines: String(message)
                .split(/\n+/)
                .map((line) => line.trim())
                .filter(Boolean),
              detailLines: [
                `<strong>Audience:</strong> ${getAudienceLabel(audience)}`,
                `<strong>Sent by:</strong> ${sentBy || 'Blueprint Admin'}`,
              ],
            }),
          },
        })
      )
    );

    const sent = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.length - sent;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        audience,
        recipients: recipients.length,
        sent,
        failed,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to send broadcast update',
      }),
    };
  }
};
