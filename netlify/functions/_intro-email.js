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

export const getAdminEmail = () =>
  process.env.BLUEPRINT_ADMIN_EMAIL || process.env.SMTP_USER || SMTP_FROM_EMAIL;

export const renderIntroEmail = ({ heading, greeting, bodyLines, detailLines, footerLines = [] }) => `
  <div style="font-family: sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 18px;">
    <h1 style="margin: 0 0 16px; color: #0f172a;">${heading}</h1>
    <p style="margin: 0 0 16px; color: #334155;">${greeting}</p>
    ${bodyLines.map((line) => `<p style="margin: 0 0 14px; color: #475569;">${line}</p>`).join('')}
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; margin: 20px 0;">
      ${detailLines.map((line) => `<p style="margin: 0 0 10px; color: #0f172a;">${line}</p>`).join('')}
    </div>
    ${footerLines.map((line) => `<p style="margin: 0 0 14px; color: #475569;">${line}</p>`).join('')}
    <p style="margin: 20px 0 0; color: #334155;">Best regards,<br/>Blueprint Home Solutions</p>
  </div>
`;

export const sendIntroEmail = async ({ to, cc, subject, html, replyTo }) => {
  const transporter = nodemailer.createTransport(getSmtpConfig());
  const info = await transporter.sendMail({
    from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
    to,
    cc,
    replyTo,
    subject,
    html,
  });

  return info;
};
