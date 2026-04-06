import {
  createEmailLogContext,
  getAdminEmail,
  renderIntroEmail,
  sendLoggedIntroEmail,
} from './_intro-email.js';
import { getContractorNotificationContent } from './send-contractor-notification.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { email, name } = JSON.parse(event.body || '{}');
  if (!email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email is required' }) };
  }

  try {
    const content = getContractorNotificationContent({
      eventType: 'signup_confirmation',
      contractorName: name,
    });
    const info = await sendLoggedIntroEmail({
      logContext: createEmailLogContext({
        handlerName: 'send-contractor-signup-confirmation',
        eventType: 'signup_confirmation',
        recipient: email,
        metadata: { contractorName: name, deprecatedEndpoint: true },
      }),
      mail: {
        to: email,
        cc: getAdminEmail(),
        subject: content.subject,
        html: renderIntroEmail({
          heading: content.heading,
          greeting: `Hi ${name || 'Home Pro'},`,
          bodyLines: content.bodyLines,
          detailLines: content.detailLines,
        }),
      },
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
