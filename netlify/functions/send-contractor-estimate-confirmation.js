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

  const { contractorEmail, contractorName, projectTitle, amount, estimateType } = JSON.parse(event.body || '{}');

  if (!contractorEmail) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Contractor email is required' }) };
  }

  try {
    const content = getContractorNotificationContent({
      eventType: 'estimate_confirmation',
      contractorName,
      projectTitle,
      amount,
      estimateType,
    });
    const info = await sendLoggedIntroEmail({
      logContext: createEmailLogContext({
        handlerName: 'send-contractor-estimate-confirmation',
        eventType: 'estimate_confirmation',
        recipient: contractorEmail,
        metadata: { contractorName, projectTitle, amount, estimateType, deprecatedEndpoint: true },
      }),
      mail: {
        to: contractorEmail,
        cc: getAdminEmail(),
        subject: content.subject,
        html: renderIntroEmail({
          heading: content.heading,
          greeting: `Hi ${contractorName || 'Home Pro'},`,
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
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to send contractor estimate confirmation' }),
    };
  }
};
