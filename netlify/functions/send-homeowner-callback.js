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

  const { name, email, phone, category } = JSON.parse(event.body || '{}');

  if (!name || !email || !phone || !category) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Name, email, phone, and category are required.' }),
    };
  }

  try {
    const transporter = nodemailer.createTransport(getSmtpConfig());

    const adminEmail = process.env.HOMEOWNER_CALLBACK_EMAIL || process.env.SMTP_USER;

    const mailOptions = {
      from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
      to: adminEmail || email,
      replyTo: email,
      subject: `New homeowner callback request: ${category}`,
      html: `
        <div style="font-family: sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px;">
          <h1 style="margin: 0 0 16px; color: #0f172a;">New homeowner callback request</h1>
          <p style="margin: 0 0 20px; color: #475569;">A homeowner selected a service card on the landing page and requested a callback.</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 10px 0; font-weight: 700; color: #334155;">Service</td><td style="padding: 10px 0; color: #0f172a;">${category}</td></tr>
            <tr><td style="padding: 10px 0; font-weight: 700; color: #334155;">Name</td><td style="padding: 10px 0; color: #0f172a;">${name}</td></tr>
            <tr><td style="padding: 10px 0; font-weight: 700; color: #334155;">Email</td><td style="padding: 10px 0; color: #0f172a;">${email}</td></tr>
            <tr><td style="padding: 10px 0; font-weight: 700; color: #334155;">Phone</td><td style="padding: 10px 0; color: #0f172a;">${phone}</td></tr>
          </table>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error('Error sending homeowner callback request:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to submit callback request.' }),
    };
  }
};
