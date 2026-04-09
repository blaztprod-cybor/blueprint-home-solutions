import {
  createEmailLogContext,
  renderIntroEmail,
  sendLoggedIntroEmail,
} from './_intro-email.js';
import { getAdminDb } from './_firebase-admin.js';

function normalizeAudienceSegments(audienceSegments, audience) {
  if (Array.isArray(audienceSegments) && audienceSegments.length > 0) {
    return audienceSegments;
  }

  if (typeof audience === 'string' && audience.length > 0) {
    return [audience];
  }

  return ['all'];
}

function getAudienceLabel(audienceSegments) {
  if (audienceSegments.includes('all')) return 'Blueprint Members';
  return audienceSegments.join(', ');
}

function matchesAudience(user, audienceSegments) {
  if (audienceSegments.includes('all')) {
    return user.role === 'Contractor' || user.role === 'Homeowner';
  }

  return audienceSegments.some((segment) => {
    switch (segment) {
      case 'contractors':
        return user.role === 'Contractor';
      case 'homeowners':
        return user.role === 'Homeowner';
      case 'verified':
        return !!user.isVerified;
      case 'unverified':
        return !user.isVerified;
      case 'licensed':
        return user.role === 'Contractor' && typeof user.licenseNumber === 'string' && user.licenseNumber.trim().length > 0;
      case 'unlicensed':
        return user.role === 'Contractor' && (!user.licenseNumber || String(user.licenseNumber).trim().length === 0);
      default:
        return false;
    }
  });
}

async function mergeUsersWithProfiles(db, accountDocs) {
  const profileSnapshots = await Promise.all(
    accountDocs.map((doc) => db.collection('user_profiles').doc(doc.id).get())
  );
  const profileMap = new Map(
    profileSnapshots
      .filter((doc) => doc.exists)
      .map((doc) => [doc.id, doc.data() || {}])
  );

  return accountDocs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    ...(profileMap.get(doc.id) || {}),
  }));
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const {
    audience = 'all',
    audienceSegments: rawAudienceSegments,
    recipients: providedRecipients,
    subject,
    message,
    sentBy,
  } = JSON.parse(event.body || '{}');
  const audienceSegments = normalizeAudienceSegments(rawAudienceSegments, audience);

  if (!subject || !message) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Subject and message are required' }),
    };
  }

  try {
    const adminDb = getAdminDb();
    const recipients = Array.isArray(providedRecipients) && providedRecipients.length > 0
      ? providedRecipients.filter((user) => !!user?.email && typeof user.email === 'string')
      : (await mergeUsersWithProfiles(
          adminDb,
          (await adminDb.collection('users').get()).docs
        ))
          .filter((user) => {
            if (!user.email || typeof user.email !== 'string') return false;
            if (user.isDisabled) return false;
            if (user.notifyOnProductUpdates !== true) return false;
            return matchesAudience(user, audienceSegments);
          });

    const results = await Promise.allSettled(
      recipients.map((recipient) =>
        sendLoggedIntroEmail({
          logContext: createEmailLogContext({
            handlerName: 'send-broadcast-update',
            eventType: 'broadcast_update',
            recipient: recipient.email,
              metadata: {
                audienceSegments,
                recipientRole: recipient.role,
                sentBy,
              },
          }),
          mail: {
            to: recipient.email,
            subject,
              html: renderIntroEmail({
                heading: subject,
                greeting: `Hi ${recipient.name || getAudienceLabel(audienceSegments)},`,
                bodyLines: String(message)
                  .split(/\n+/)
                  .map((line) => line.trim())
                  .filter(Boolean),
                detailLines: [
                  `<strong>Audience:</strong> ${getAudienceLabel(audienceSegments)}`,
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
        audienceSegments,
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
