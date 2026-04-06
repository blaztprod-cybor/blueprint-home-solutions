import nodemailer from 'nodemailer';
import { createEmailLogContext, logEmailFailure, logEmailStart, logEmailSuccess } from './_intro-email.js';

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

  const { email, name, projectTitle, startDate, description, photos } = JSON.parse(event.body || '{}');

  if (!email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email is required' }) };
  }

  try {
    const logContext = createEmailLogContext({
      handlerName: 'send-project-confirmation',
      eventType: 'project_confirmation',
      recipient: email,
      metadata: { name, projectTitle, photoCount: photos?.length || 0 },
    });
    logEmailStart(logContext);
    const transporter = nodemailer.createTransport(getSmtpConfig());

    const photoHtml = (photos || []).map((photo, index) =>
      `<img src="${photo}" alt="Project Photo ${index + 1}" style="width: 150px; height: 150px; object-fit: cover; margin: 5px; border-radius: 8px;" />`
    ).join('');

    const mailOptions = {
      from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
      to: email,
      subject: `Project Request Submitted: ${projectTitle}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h1 style="color: #4F46E5;">Project Request Confirmed!</h1>
          <p>Hi ${name},</p>
          <p>Thank you for submitting your project request. We've received your details and are already working on matching you with the best pros.</p>
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h2 style="font-size: 18px; margin-top: 0;">Project Details</h2>
            <p><strong>Project:</strong> ${projectTitle}</p>
            <p><strong>Description:</strong> ${description || 'No description provided'}</p>
            <p><strong>Projected Start Date:</strong> ${startDate}</p>
          </div>
          ${photos && photos.length > 0 ? `
            <div style="margin: 20px 0;">
              <h3 style="font-size: 16px;">Uploaded Photos</h3>
              <div style="display: flex; flex-wrap: wrap;">${photoHtml}</div>
            </div>
          ` : ''}
          <p style="font-weight: bold; color: #4F46E5; margin-top: 30px;">Home pros are anxious to respond to your submission and the estimate process will begin.</p>
          <p>Best regards,<br/>The Blueprint Team</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    logEmailSuccess(logContext, info);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Email processed' }),
    };
  } catch (error) {
    logEmailFailure(
      createEmailLogContext({
        handlerName: 'send-project-confirmation',
        eventType: 'project_confirmation',
        recipient: email,
        metadata: { name, projectTitle, photoCount: photos?.length || 0 },
      }),
      error
    );
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to send email' }),
    };
  }
};
