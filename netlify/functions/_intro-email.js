import nodemailer from 'nodemailer';

const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || 'Blueprint Home Solutions';
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || 'info@blueprinthomesolutions.com';
const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.SMTP_PASS;
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toAddressList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const canUseResendApi = () =>
  typeof RESEND_API_KEY === 'string' &&
  RESEND_API_KEY.startsWith('re_') &&
  typeof SMTP_FROM_EMAIL === 'string' &&
  SMTP_FROM_EMAIL.length > 0;

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
  (EMAIL_ADDRESS_PATTERN.test(String(process.env.BLUEPRINT_ADMIN_EMAIL || '').trim())
    ? String(process.env.BLUEPRINT_ADMIN_EMAIL).trim()
    : EMAIL_ADDRESS_PATTERN.test(String(process.env.SMTP_USER || '').trim())
      ? String(process.env.SMTP_USER).trim()
      : SMTP_FROM_EMAIL);

export const createEmailLogContext = ({ handlerName, eventType, recipient, metadata = {} }) => ({
  requestId: `${handlerName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  handlerName,
  eventType,
  recipient,
  metadata,
});

export const logEmailStart = (context) => {
  console.log(`[EMAIL][START] ${context.handlerName}`, {
    requestId: context.requestId,
    eventType: context.eventType,
    recipient: context.recipient,
    metadata: context.metadata,
  });
};

export const logEmailSuccess = (context, info) => {
  console.log(`[EMAIL][SUCCESS] ${context.handlerName}`, {
    requestId: context.requestId,
    eventType: context.eventType,
    recipient: context.recipient,
    messageId: info?.messageId,
  });
};

export const logEmailFailure = (context, error) => {
  console.error(`[EMAIL][FAILURE] ${context.handlerName}`, {
    requestId: context.requestId,
    eventType: context.eventType,
    recipient: context.recipient,
    metadata: context.metadata,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
};

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
  if (canUseResendApi()) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${SMTP_FROM_NAME} <${SMTP_FROM_EMAIL}>`,
        to: toAddressList(to),
        cc: toAddressList(cc),
        reply_to: toAddressList(replyTo),
        subject,
        html,
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.message || data?.error || 'Failed to send email with Resend API');
    }

    return { messageId: data?.id };
  }

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

export const sendLoggedIntroEmail = async ({
  logContext,
  mail,
}) => {
  logEmailStart(logContext);
  try {
    const info = await sendIntroEmail(mail);
    logEmailSuccess(logContext, info);
    return info;
  } catch (error) {
    logEmailFailure(logContext, error);
    throw error;
  }
};
