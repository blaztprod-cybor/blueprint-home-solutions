import nodemailer from 'nodemailer';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { email, name, projectTitle, startDate, description, photos } = JSON.parse(event.body || '{}');

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

    const photoHtml = (photos || []).map((photo, index) =>
      `<img src="${photo}" alt="Project Photo ${index + 1}" style="width: 150px; height: 150px; object-fit: cover; margin: 5px; border-radius: 8px;" />`
    ).join('');

    const mailOptions = {
      from: '"Blueprint Home Solutions" <noreply@blueprinthomesolutions.com>',
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

    if (process.env.SMTP_USER && process.env.SMTP_USER !== 'mock_user') {
      await transporter.sendMail(mailOptions);
    } else {
      console.log(`[MOCK EMAIL SENT to ${email}]: Project ${projectTitle}`);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Email processed' }),
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send email' }),
    };
  }
};
