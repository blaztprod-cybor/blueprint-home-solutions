import nodemailer from 'nodemailer';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { email, name, role } = JSON.parse(event.body || '{}');

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
      subject: `Welcome to Blueprint Home Solutions!`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h1 style="color: #4F46E5;">Welcome to the Blueprint!</h1>
          <p>Hi ${name},</p>
          <p>We're excited to have you join our community as a <strong>${role}</strong>.</p>
          <p>Blueprint Home Solutions is designed to make home improvement projects seamless and professional.</p>
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h2 style="font-size: 18px; margin-top: 0;">Next Steps</h2>
            ${role === 'Homeowner'
              ? '<p>Start your first project and get estimates from top-rated professionals in your area.</p>'
              : '<p>Complete your profile and start browsing available projects in the marketplace.</p>'}
          </div>
          <p>If you have any questions, feel free to reply to this email.</p>
          <p>Best regards,<br/>The Blueprint Team</p>
        </div>
      `,
    };

    if (process.env.SMTP_USER && process.env.SMTP_USER !== 'mock_user') {
      await transporter.sendMail(mailOptions);
    } else {
      console.log(`[MOCK EMAIL SENT to ${email}]: Welcome ${name}`);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Welcome email processed' }),
    };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send email' }),
    };
  }
};
