import { sendSms } from './_sms.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { contractorPhone, message, eventType } = JSON.parse(event.body || '{}');
  if (!contractorPhone) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Contractor phone number is required' }),
    };
  }

  if (!message) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'SMS message body is required' }),
    };
  }

  try {
    const result = await sendSms({
      to: contractorPhone,
      body: message,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        textId: result.textId,
        quotaRemaining: result.quotaRemaining,
        eventType: eventType || 'contractor_update',
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to send contractor SMS notification',
        eventType: eventType || 'contractor_update',
      }),
    };
  }
};
