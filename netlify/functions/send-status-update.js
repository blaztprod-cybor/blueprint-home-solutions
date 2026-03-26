import nodemailer from 'nodemailer';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { email, name, projectTitle, oldStatus, newStatus } = JSON.parse(event.body || '{}');

  if (!email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email is required' }) };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'mock_user',
        pass: process.env.SMTP_PASS || 'mock_pass',
      },
    });

    const mailOptions = {
      from: '"Blueprint Home Solutions" <noreply@blueprinthomesolutions.com>',
      to: email,
      subject: `Project Status Updated: ${projectTitle}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h1 style="color: #4F46E5;">Project Status Update</h1>
          <p>Hi ${name},</p>
          <p>The status of your project <strong>${projectTitle}</strong> has been updated.</p>
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0; display: flex; align-items: center; justify-content: center; gap: 20px;">
            <div style="text-align: center;">
              <p style="font-size: 12px; color: #6b7280; margin-bottom: 4px; text-transform: uppercase; font-weight: bold;">Old Status</p>
              <span style="background-color: #f3f4f6; color: #374151; padding: 4px 12px; border-radius: 9999px; font-size: 14px; font-weight: bold;">${oldStatus}</span>
            </div>
            <div style="font-size: 24px; color: #9ca3af;">&rarr;</div>
            <div style="text-align: center;">
              <p style="font-size: 12px; color: #6b7280; margin-bottom: 4px; text-transform: uppercase; font-weight: bold;">New Status</p>
              <span style="background-color: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 9999px; font-size: 14px; font-weight: bold;">${newStatus}</span>
            </div>
          </div>
          <p>You can view more details about your project progress in the Blueprint dashboard.</p>
          <p>Best regards,<br/>The Blueprint Team</p>
        </div>
      `,
    };

    if (process.env.SMTP_USER && process.env.SMTP_USER !== 'mock_user') {
      await transporter.sendMail(mailOptions);
    } else {
      console.log(`[MOCK EMAIL SENT to ${email}]: Status update ${oldStatus} -> ${newStatus}`);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Status update email processed' }),
    };
  } catch (error) {
    console.error('Error sending status update email:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send email' }),
    };
  }
};
