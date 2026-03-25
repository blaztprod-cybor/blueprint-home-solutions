import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API route for sending project confirmation email
  app.post("/api/send-project-confirmation", async (req, res) => {
    const { email, name, projectTitle, startDate, description, photos } = req.body;

    console.log(`[EMAIL REQUEST] Project Confirmation for ${email}`);

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.ethereal.email",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: false,
        auth: {
          user: process.env.SMTP_USER || "mock_user",
          pass: process.env.SMTP_PASS || "mock_pass",
        },
      });

      const photoHtml = (photos || []).map((photo: string, index: number) => 
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
                <div style="display: flex; flex-wrap: wrap;">
                  ${photoHtml}
                </div>
              </div>
            ` : ''}

            <p style="font-weight: bold; color: #4F46E5; margin-top: 30px;">
              Home pros are anxious to respond to your submission and the estimate process will begin.
            </p>
            
            <p>Best regards,<br/>The Blueprint Team</p>
          </div>
        `,
      };

      if (process.env.SMTP_USER && process.env.SMTP_USER !== "mock_user") {
        await transporter.sendMail(mailOptions);
        console.log(`[SUCCESS] Email sent to ${email}`);
      } else {
        console.log(`[MOCK EMAIL SENT to ${email}]: Project ${projectTitle}`);
        console.log(`[NOTICE] To send real emails, configure SMTP_USER and SMTP_PASS in AI Studio Secrets.`);
      }
      
      res.json({ success: true, message: "Email processed" });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // API route for sending welcome email
  app.post("/api/send-welcome-email", async (req, res) => {
    const { email, name, role } = req.body;

    console.log(`[EMAIL REQUEST] Welcome Email for ${email}`);

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.ethereal.email",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: false,
        auth: {
          user: process.env.SMTP_USER || "mock_user",
          pass: process.env.SMTP_PASS || "mock_pass",
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

      if (process.env.SMTP_USER && process.env.SMTP_USER !== "mock_user") {
        await transporter.sendMail(mailOptions);
        console.log(`[SUCCESS] Welcome email sent to ${email}`);
      } else {
        console.log(`[MOCK EMAIL SENT to ${email}]: Welcome ${name}`);
        console.log(`[NOTICE] To send real emails, configure SMTP_USER and SMTP_PASS in AI Studio Secrets.`);
      }
      
      res.json({ success: true, message: "Welcome email processed" });
    } catch (error) {
      console.error("Error sending welcome email:", error);
      res.status(500).json({ error: "Failed to send welcome email" });
    }
  });

  // API route for sending project status update email
  app.post("/api/send-status-update", async (req, res) => {
    const { email, name, projectTitle, oldStatus, newStatus } = req.body;

    console.log(`[EMAIL REQUEST] Status Update for ${email}: ${oldStatus} -> ${newStatus}`);

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.ethereal.email",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: false,
        auth: {
          user: process.env.SMTP_USER || "mock_user",
          pass: process.env.SMTP_PASS || "mock_pass",
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

      if (process.env.SMTP_USER && process.env.SMTP_USER !== "mock_user") {
        await transporter.sendMail(mailOptions);
        console.log(`[SUCCESS] Status update email sent to ${email}`);
      } else {
        console.log(`[MOCK EMAIL SENT to ${email}]: Status update ${oldStatus} -> ${newStatus}`);
      }
      
      res.json({ success: true, message: "Status update email processed" });
    } catch (error) {
      console.error("Error sending status update email:", error);
      res.status(500).json({ error: "Failed to send status update email" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
