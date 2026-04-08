import { getAdminDb } from './_firebase-admin.js';
import { getAdminEmail, renderIntroEmail, sendIntroEmail } from './_intro-email.js';
import { isTwilioConfigured, sendSms } from './_twilio.js';

function buildProjectAlertSms({ projectTitle, category, town, startDate }) {
  const parts = [
    'Blueprint: new homeowner project available.',
    `Project: ${projectTitle || category || 'Project request'}.`,
    `Category: ${category || 'General'}.`,
    `Area: ${town || 'Local service area'}.`,
    `Start: ${startDate || 'Not specified'}.`,
    'Log in to your Home Pro portal to review it.',
  ];

  return parts.join(' ');
}

function matchesLeadCategory(user, category) {
  if (!category) return true;
  if (!Array.isArray(user.leadCategories) || user.leadCategories.length === 0) {
    return true;
  }

  return user.leadCategories.includes(category);
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { projectTitle, category, town, startDate, description } = JSON.parse(event.body || '{}');

  try {
    const db = getAdminDb();
    const snapshot = await db.collection('users')
      .where('role', '==', 'Contractor')
      .where('notifyOnNewProjects', '==', true)
      .where('subscriptionLevel', 'in', ['trial', 'beginner', 'junior', 'pro'])
      .get();

    const recipients = snapshot.docs
      .map((doc) => doc.data())
      .filter((user) => typeof user.email === 'string' && user.email.length > 0)
      .filter((user) => matchesLeadCategory(user, category));

    const smsRecipients = snapshot.docs
      .map((doc) => doc.data())
      .filter(
        (user) =>
          matchesLeadCategory(user, category) &&
          user.notifyOnSmsLeadAlerts === true &&
          user.smsConsentAt &&
          typeof user.phone === 'string' &&
          user.phone.trim().length > 0
      );

    await Promise.all(
      recipients.map((recipient) =>
        sendIntroEmail({
          to: recipient.email,
          cc: getAdminEmail(),
          subject: `New homeowner project: ${projectTitle || category || 'Project request'}`,
          html: renderIntroEmail({
            heading: 'New Homeowner Project Submitted',
            greeting: `Hi ${recipient.name || 'Home Pro'},`,
            bodyLines: [
              'A new homeowner project was submitted to Blueprint and matches the active project feed.',
              'Open your Home Pro portal to review the project and decide whether to place a bid or request an introduction.',
            ],
            detailLines: [
              `<strong>Project:</strong> ${projectTitle || category || 'Project request'}`,
              `<strong>Category:</strong> ${category || 'General'}`,
              `<strong>Area:</strong> ${town || 'Local service area'}`,
              `<strong>Requested start:</strong> ${startDate || 'Not specified'}`,
              `<strong>Description:</strong> ${description || 'No description provided'}`,
            ],
          }),
        })
      )
    );

    let smsRecipientsNotified = 0;
    if (isTwilioConfigured() && smsRecipients.length > 0) {
      const smsBody = buildProjectAlertSms({ projectTitle, category, town, startDate });
      const smsResults = await Promise.allSettled(
        smsRecipients.map((recipient) =>
          sendSms({
            to: recipient.phone,
            body: smsBody,
          })
        )
      );

      smsRecipientsNotified = smsResults.filter((result) => result.status === 'fulfilled').length;
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        recipients: recipients.length,
        smsRecipients: smsRecipientsNotified,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to send project alerts' }),
    };
  }
};
