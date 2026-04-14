import { getAdminDb } from './_firebase-admin.js';
import { getAdminEmail, renderIntroEmail, sendIntroEmail } from './_intro-email.js';
import { isSmsConfigured, sendSms } from './_sms.js';

function buildProjectAlertSms({ projectTitle, category, town, startDate }) {
  const parts = [
    'Blueprint: new homeowner project available.',
    `Project: ${projectTitle || category || 'Project request'}.`,
    `Category: ${category || 'General'}.`,
    `Area: ${town || 'Local service area'}.`,
    `Start: ${startDate || 'Not specified'}.`,
    'Open your Home Pro portal for details.',
  ];

  return parts.join(' ');
}

function matchesLeadCategory(user, category, categoryLabel) {
  if (!category && !categoryLabel) return true;
  if (!Array.isArray(user.leadCategories) || user.leadCategories.length === 0) {
    return true;
  }

  return user.leadCategories.includes(category || '') || user.leadCategories.includes(categoryLabel || '');
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

  const { projectTitle, categoryId, category, town, startDate, description } = JSON.parse(event.body || '{}');

  try {
    const db = getAdminDb();
    const snapshot = await db.collection('users')
      .where('role', '==', 'Contractor')
      .where('subscriptionLevel', 'in', ['trial', 'beginner', 'junior', 'pro'])
      .get();
    const mergedUsers = await mergeUsersWithProfiles(db, snapshot.docs);

    const recipients = mergedUsers
      .filter((user) => typeof user.email === 'string' && user.email.length > 0)
      .filter((user) => user.notifyOnNewProjects === true)
      .filter((user) => matchesLeadCategory(user, categoryId, category));

    const smsRecipients = mergedUsers
      .filter(
        (user) =>
          user.notifyOnNewProjects === true &&
          matchesLeadCategory(user, categoryId, category) &&
          user.notifyOnSmsLeadAlerts === true &&
          user.smsConsentAt &&
          typeof user.phone === 'string' &&
          user.phone.trim().length > 0
      );

    console.log('[ALERTS][NEW_PROJECT]', {
      projectTitle,
      categoryId,
      category,
      contractorPool: mergedUsers.length,
      emailRecipients: recipients.map((entry) => entry.email),
      smsRecipients: smsRecipients.map((entry) => entry.phone),
    });

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
    if (isSmsConfigured() && smsRecipients.length > 0) {
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
        smsEligibleRecipients: smsRecipients.length,
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
