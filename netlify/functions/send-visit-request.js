import nodemailer from 'nodemailer';

const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || 'Blueprint Home Solutions';
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || 'info@blueprinthomesolutions.com';

const getSmtpSecureSetting = () => {
  if (process.env.SMTP_SECURE) {
    return process.env.SMTP_SECURE.toLowerCase() === 'true';
  }

  return parseInt(process.env.SMTP_PORT || '587', 10) === 465;
};

const getSmtpConfig = () => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass || user === 'mock_user' || pass === 'mock_pass') {
    throw new Error('SMTP is not configured');
  }

  return {
    host,
    port,
    secure: getSmtpSecureSetting(),
    auth: { user, pass },
  };
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { email, homeownerName, contractorName, projectTitle, requestedVisitDate } = JSON.parse(event.body || '{}');

  if (!email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email is required' }) };
  }

  try {
    const transporter = nodemailer.createTransport(getSmtpConfig());

    const formattedVisitDate = requestedVisitDate
      ? new Date(requestedVisitDate).toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })
      : 'a requested time';

    const mailOptions = {
      from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
      to: email,
      subject: `Visit Request for ${projectTitle}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h1 style="color: #4F46E5;">New Visit Request</h1>
          <p>Hi ${homeownerName || 'Homeowner'},</p>
          <p><strong>${contractorName || 'A contractor'}</strong> requested to schedule a visit for your project <strong>${projectTitle}</strong>.</p>
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 8px;"><strong>Requested date:</strong> ${formattedVisitDate}</p>
            <p style="margin: 0;">Please return to Blueprint Home Solutions to review the project and continue communication through the platform.</p>
          </div>
          <p>Best regards,<br/>The Blueprint Team</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Visit request email processed' }),
    };
  } catch (error) {
    console.error('Error sending visit request email:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to send visit request email' }),
    };
  }
};
