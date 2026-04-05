import { getAdminDb } from './_firebase-admin.js';
import { getAdminEmail, renderIntroEmail, sendIntroEmail } from './_intro-email.js';

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
      .filter((user) => typeof user.email === 'string' && user.email.length > 0);

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

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, recipients: recipients.length }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to send project alerts' }),
    };
  }
};
