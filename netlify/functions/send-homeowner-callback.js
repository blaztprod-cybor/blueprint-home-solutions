import nodemailer from 'nodemailer';

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
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'mock_user',
        pass: process.env.SMTP_PASS || 'mock_pass',
      },
    });

    const adminEmail = process.env.HOMEOWNER_CALLBACK_EMAIL || process.env.SMTP_USER;

    const mailOptions = {
      from: '"Blueprint Home Solutions" <noreply@blueprinthomesolutions.com>',
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

    if (process.env.SMTP_USER && process.env.SMTP_USER !== 'mock_user') {
      await transporter.sendMail(mailOptions);
    } else {
      console.log(`[MOCK CALLBACK REQUEST] ${JSON.stringify({ name, email, phone, category })}`);
    }

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
      body: JSON.stringify({ error: 'Failed to submit callback request.' }),
    };
  }
};
