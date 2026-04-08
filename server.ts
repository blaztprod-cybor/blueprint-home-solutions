import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";

dotenv.config({ path: ".env.local" });
dotenv.config();

const execFileAsync = promisify(execFile);
const PERMIT_SYNC_INTERVAL_MS = 10 * 60 * 1000;
const ENABLE_DEV_PERMIT_SYNC = process.env.ENABLE_DEV_PERMIT_SYNC === "true";
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || "Blueprint Home Solutions";
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || "info@blueprinthomesolutions.com";
const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.SMTP_PASS;
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;
const TWILIO_MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID;

function toAddressList(value: nodemailer.SendMailOptions["to"]) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map((entry) => String(entry));
  return String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function canUseResendApi() {
  return (
    typeof RESEND_API_KEY === "string" &&
    RESEND_API_KEY.startsWith("re_") &&
    typeof SMTP_FROM_EMAIL === "string" &&
    SMTP_FROM_EMAIL.length > 0
  );
}

function buildProjectAlertSms({
  projectTitle,
  category,
  town,
  startDate,
}: {
  projectTitle?: string;
  category?: string;
  town?: string;
  startDate?: string;
}) {
  return [
    "Blueprint: new homeowner project available.",
    `Project: ${projectTitle || category || "Project request"}.`,
    `Category: ${category || "General"}.`,
    `Area: ${town || "Local service area"}.`,
    `Start: ${startDate || "Not specified"}.`,
    "Log in to your Home Pro portal to review it.",
  ].join(" ");
}

function matchesLeadCategory(user: { leadCategories?: string[] }, category?: string) {
  if (!category) return true;
  if (!Array.isArray(user.leadCategories) || user.leadCategories.length === 0) {
    return true;
  }

  return user.leadCategories.includes(category);
}

function getSmtpSecureSetting() {
  if (process.env.SMTP_SECURE) {
    return process.env.SMTP_SECURE.toLowerCase() === "true";
  }

  return parseInt(process.env.SMTP_PORT || "587", 10) === 465;
}

async function sendSms({
  to,
  body,
}: {
  to: string;
  body: string;
}) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || (!TWILIO_FROM_NUMBER && !TWILIO_MESSAGING_SERVICE_SID)) {
    throw new Error("SMS provider is not configured");
  }

  const params = new URLSearchParams({
    To: to,
    Body: body,
  });

  if (TWILIO_MESSAGING_SERVICE_SID) {
    params.set("MessagingServiceSid", TWILIO_MESSAGING_SERVICE_SID);
  } else if (TWILIO_FROM_NUMBER) {
    params.set("From", TWILIO_FROM_NUMBER);
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || "Failed to send SMS notification");
  }

  return data;
}

async function syncPermitFeed() {
  try {
    const { stdout, stderr } = await execFileAsync("node", ["scripts/fetch-permits.mjs"], {
      cwd: process.cwd(),
      env: process.env,
    });

    if (stdout.trim()) {
      console.log(`[PERMIT SYNC] ${stdout.trim()}`);
    }

    if (stderr.trim()) {
      console.warn(`[PERMIT SYNC WARNING] ${stderr.trim()}`);
    }
  } catch (error) {
    console.error("[PERMIT SYNC ERROR]", error);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  const createTransporter = () =>
    nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.ethereal.email",
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: getSmtpSecureSetting(),
      auth: {
        user: process.env.SMTP_USER || "mock_user",
        pass: process.env.SMTP_PASS || "mock_pass",
      },
    });

  const adminEmail =
    (EMAIL_ADDRESS_PATTERN.test(String(process.env.BLUEPRINT_ADMIN_EMAIL || "").trim())
      ? String(process.env.BLUEPRINT_ADMIN_EMAIL).trim()
      : EMAIL_ADDRESS_PATTERN.test(String(process.env.SMTP_USER || "").trim())
        ? String(process.env.SMTP_USER).trim()
        : SMTP_FROM_EMAIL);
  const getAdminDb = () => {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "blueprint-home-solutions";
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

    const app = getApps()[0] || initializeApp(
      clientEmail && privateKey
        ? {
            credential: cert({ projectId, clientEmail, privateKey }),
            projectId,
          }
        : {
            credential: applicationDefault(),
            projectId,
          }
    );

    return getAdminFirestore(app, process.env.FIREBASE_FIRESTORE_DATABASE_ID || "blueprinthomesolutionsdata");
  };
  const sendMail = async (options: nodemailer.SendMailOptions) => {
    if (canUseResendApi()) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${SMTP_FROM_NAME} <${SMTP_FROM_EMAIL}>`,
          to: toAddressList(options.to),
          cc: toAddressList(options.cc),
          reply_to: toAddressList(options.replyTo),
          subject: options.subject,
          html: options.html,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to send email with Resend API");
      }

      return { messageId: data?.id };
    }

    const transporter = createTransporter();
    if (process.env.SMTP_USER && process.env.SMTP_USER !== "mock_user") {
      return transporter.sendMail(options);
    }

    console.log(`[MOCK EMAIL SENT] ${options.subject} -> ${options.to}`);
    return { messageId: `mock-${Date.now()}` };
  };
  const renderIntroEmail = ({
    heading,
    greeting,
    bodyLines,
    detailLines,
  }: {
    heading: string;
    greeting: string;
    bodyLines: string[];
    detailLines: string[];
  }) => `
    <div style="font-family: sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 18px;">
      <h1 style="margin: 0 0 16px; color: #0f172a;">${heading}</h1>
      <p style="margin: 0 0 16px; color: #334155;">${greeting}</p>
      ${bodyLines.map((line) => `<p style="margin: 0 0 14px; color: #475569;">${line}</p>`).join("")}
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; margin: 20px 0;">
      ${detailLines.map((line) => `<p style="margin: 0 0 10px; color: #0f172a;">${line}</p>`).join("")}
      </div>
      <p style="margin: 20px 0 0; color: #334155;">Best regards,<br/>Blueprint Home Solutions</p>
    </div>
  `;
  const createEmailLogContext = ({
    handlerName,
    eventType,
    recipient,
    metadata = {},
  }: {
    handlerName: string;
    eventType: string;
    recipient: string | string[];
    metadata?: Record<string, unknown>;
  }) => ({
    requestId: `${handlerName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    handlerName,
    eventType,
    recipient,
    metadata,
  });
  const logEmailStart = (context: ReturnType<typeof createEmailLogContext>) => {
    console.log(`[EMAIL][START] ${context.handlerName}`, context);
  };
  const logEmailSuccess = (
    context: ReturnType<typeof createEmailLogContext>,
    info: { messageId?: string }
  ) => {
    console.log(`[EMAIL][SUCCESS] ${context.handlerName}`, {
      requestId: context.requestId,
      eventType: context.eventType,
      recipient: context.recipient,
      messageId: info?.messageId,
    });
  };
  const logEmailFailure = (context: ReturnType<typeof createEmailLogContext>, error: unknown) => {
    console.error(`[EMAIL][FAILURE] ${context.handlerName}`, {
      requestId: context.requestId,
      eventType: context.eventType,
      recipient: context.recipient,
      metadata: context.metadata,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  };
  const sendLoggedMail = async ({
    logContext,
    mail,
  }: {
    logContext: ReturnType<typeof createEmailLogContext>;
    mail: nodemailer.SendMailOptions;
  }) => {
    logEmailStart(logContext);
    try {
      const info = await sendMail(mail);
      logEmailSuccess(logContext, info);
      return info;
    } catch (error) {
      logEmailFailure(logContext, error);
      throw error;
    }
  };
  const getContractorNotificationContent = ({
    eventType,
    contractorName,
    projectTitle,
    category,
    town,
    amount,
    estimateType,
    requestedVisitDate,
  }: {
    eventType: string;
    contractorName?: string;
    projectTitle?: string;
    category?: string;
    town?: string;
    amount?: number;
    estimateType?: string;
    requestedVisitDate?: string;
  }) => {
    switch (eventType) {
      case "signup_confirmation":
        return {
          subject: "Blueprint Home Pro signup received",
          heading: "Home Pro Signup Received",
          bodyLines: [
            "Blueprint received your contractor signup and your account has been created.",
            "Your account remains unverified until Blueprint completes its review. You can still finish your profile and access your portal while review is pending.",
          ],
          detailLines: [
            "<strong>Status:</strong> Account created",
            "<strong>Verification:</strong> Pending Blueprint review",
            "<strong>Next step:</strong> Blueprint will review your profile before marketplace access is approved",
          ],
        };
      case "intro_request_acknowledgment":
        return {
          subject: `Blueprint received your ${category || "project"} introduction request`,
          heading: "Introduction Request Received",
          bodyLines: [
            "Blueprint received your request and will review it before any homeowner introduction is approved.",
            "We will keep you updated as the request moves through the review process.",
          ],
          detailLines: [
            `<strong>Project:</strong> ${category || "Project request"}`,
            `<strong>Area:</strong> ${town || "Local service area"}`,
            "<strong>Status:</strong> Requested",
          ],
        };
      case "estimate_confirmation":
        return {
          subject: `${estimateType === "final" ? "Final" : "Rough"} estimate submitted for ${projectTitle || "project lead"}`,
          heading: `${estimateType === "final" ? "Final" : "Rough"} Estimate Submitted`,
          bodyLines: [
            `Blueprint recorded your ${estimateType === "final" ? "final" : "rough"} estimate submission.`,
            "You can return to the Home Pro portal at any time to monitor project status and next steps.",
          ],
          detailLines: [
            `<strong>Project:</strong> ${projectTitle || "Project lead"}`,
            `<strong>Estimate type:</strong> ${estimateType === "final" ? "Final estimate" : "Rough estimate"}`,
            `<strong>Amount:</strong> $${Number(amount || 0).toLocaleString()}`,
          ],
        };
      case "inspection_request_confirmation":
        return {
          subject: `Inspection request sent for ${projectTitle || "project lead"}`,
          heading: "Inspection Request Sent",
          bodyLines: [
            "Blueprint recorded your request to schedule an in-person inspection.",
            "You can monitor the homeowner response and project status from the Home Pro portal.",
          ],
          detailLines: [
            `<strong>Project:</strong> ${projectTitle || "Project lead"}`,
            `<strong>Requested inspection date:</strong> ${requestedVisitDate || "Not specified"}`,
          ],
        };
      default:
        throw new Error("Unsupported contractor notification event");
    }
  };
  const sendContractorNotificationEmail = async ({
    handlerName,
    eventType,
    contractorEmail,
    contractorName,
    projectTitle,
    category,
    town,
    amount,
    estimateType,
    requestedVisitDate,
    replyTo,
    deprecatedEndpoint = false,
  }: {
    handlerName: string;
    eventType: string;
    contractorEmail: string;
    contractorName?: string;
    projectTitle?: string;
    category?: string;
    town?: string;
    amount?: number;
    estimateType?: string;
    requestedVisitDate?: string;
    replyTo?: string;
    deprecatedEndpoint?: boolean;
  }) => {
    const content = getContractorNotificationContent({
      eventType,
      contractorName,
      projectTitle,
      category,
      town,
      amount,
      estimateType,
      requestedVisitDate,
    });
    return sendLoggedMail({
      logContext: createEmailLogContext({
        handlerName,
        eventType,
        recipient: contractorEmail,
        metadata: {
          contractorName,
          projectTitle,
          category,
          town,
          amount,
          estimateType,
          requestedVisitDate,
          deprecatedEndpoint,
        },
      }),
      mail: {
        from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
        to: contractorEmail,
        cc: adminEmail,
        replyTo,
        subject: content.subject,
        html: renderIntroEmail({
          heading: content.heading,
          greeting: `Hi ${contractorName || "Home Pro"},`,
          bodyLines: content.bodyLines,
          detailLines: content.detailLines,
        }),
      },
    });
  };

  // API route for sending project confirmation email
  app.post("/api/send-project-confirmation", async (req, res) => {
    const { email, name, projectTitle, startDate, description, photos } = req.body;

    console.log(`[EMAIL REQUEST] Project Confirmation for ${email}`);

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    try {
      const transporter = createTransporter();

      const photoHtml = (photos || []).map((photo: string, index: number) => 
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
            <p>Thank you for submitting your project request. Blueprint Home Solutions has received your details, and Home Pros are now reviewing your project.</p>
            <p>Interested Home Pros may request the opportunity to provide a rough estimate through Blueprint.</p>
            
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h2 style="font-size: 18px; margin-top: 0;">Project Details</h2>
              <p><strong>Project:</strong> ${projectTitle}</p>
              <p><strong>Description:</strong> ${description || 'No description provided'}</p>
              <p><strong>Projected Start Date:</strong> ${startDate}</p>
            </div>

            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
              <h3 style="font-size: 16px; margin-top: 0;">Need to add more photos later?</h3>
              <p style="margin-bottom: 0;">
                Email additional project photos from the same email address you used on your request to
                <strong> info@blueprinthomesolutions.com</strong> and Blueprint will attach them to your submission.
              </p>
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
              Blueprint will keep the process moving as Home Pros review your request and ask to provide a rough estimate.
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

  app.post("/api/send-contractor-sms-notification", async (req, res) => {
    const { contractorPhone, message, eventType } = req.body;

    if (!contractorPhone) {
      return res.status(400).json({ error: "Contractor phone number is required" });
    }

    if (!message) {
      return res.status(400).json({ error: "SMS message body is required" });
    }

    try {
      const result = await sendSms({
        to: contractorPhone,
        body: message,
      });

      res.json({
        success: true,
        sid: result.sid,
        status: result.status,
        eventType: eventType || "contractor_update",
      });
    } catch (error) {
      console.error("Error sending contractor SMS notification:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to send contractor SMS notification",
        eventType: eventType || "contractor_update",
      });
    }
  });

  app.get("/api/recent-project-posts", async (_req, res) => {
    const formatRelativeDate = (value: string) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "Recently posted";

      const diffMs = Date.now() - date.getTime();
      const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));

      if (diffHours < 1) return "Posted just now";
      if (diffHours < 24) return `Posted ${diffHours}h ago`;

      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return "Posted 1 day ago";
      return `Posted ${diffDays} days ago`;
    };

    try {
      const db = getAdminDb();
      const snapshot = await db.collection("projects").orderBy("createdAt", "desc").limit(8).get();

      const items = snapshot.docs.map((entry) => {
        const data = entry.data();
        return {
          id: entry.id,
          category: data.category || data.title || "Home Improvement",
          town: data.location?.town || "Local area",
          summary: formatRelativeDate(data.createdAt),
        };
      });

      res.json({ items });
    } catch (error) {
      console.error("Error loading recent project posts:", error);
      res.status(500).json({ error: "Failed to load recent project posts" });
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
      const transporter = createTransporter();

      const mailOptions = {
        from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
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
      const transporter = createTransporter();

      const mailOptions = {
        from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
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

  app.post("/api/send-admin-message", async (req, res) => {
    const { email, name, subject, message, recipientType } = req.body;

    console.log(`[EMAIL REQUEST] Admin message to ${recipientType || "contact"} ${email}`);

    if (!email || !subject || !message) {
      return res.status(400).json({ error: "Email, subject, and message are required" });
    }

    try {
      const transporter = createTransporter();
      const recipientLabel = recipientType === "home-pro" ? "Home Pro" : "Homeowner";
      const safeName = name || recipientLabel;

      const mailOptions = {
        from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
        to: email,
        subject,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h1 style="color: #4F46E5;">Blueprint Home Solutions Update</h1>
            <p>Hi ${safeName},</p>
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
              ${String(message)
                .split(/\n+/)
                .filter(Boolean)
                .map((paragraph: string) => `<p style="margin: 0 0 12px;">${paragraph}</p>`)
                .join("")}
            </div>
            <p>Best regards,<br/>Blueprint Home Solutions</p>
          </div>
        `,
      };

      if (process.env.SMTP_USER && process.env.SMTP_USER !== "mock_user") {
        await transporter.sendMail(mailOptions);
        console.log(`[SUCCESS] Admin message sent to ${email}`);
      } else {
        console.log(`[MOCK EMAIL SENT to ${email}]: ${subject}`);
      }

      res.json({ success: true, message: "Admin message processed" });
    } catch (error) {
      console.error("Error sending admin message:", error);
      res.status(500).json({ error: "Failed to send admin message" });
    }
  });

  app.post("/api/send-broadcast-update", async (req, res) => {
    const { audience = "all", subject, message, sentBy } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ error: "Subject and message are required" });
    }

    const audienceLabel =
      audience === "contractors"
        ? "Home Pros"
        : audience === "homeowners"
          ? "Homeowners"
          : "Blueprint Members";

    try {
      const snapshot = await getAdminDb()
        .collection("users")
        .where("notifyOnProductUpdates", "==", true)
        .get();

      const recipients = snapshot.docs
        .map((doc) => doc.data())
        .filter((entry: any) => {
          if (!entry.email || typeof entry.email !== "string") return false;
          if (entry.isDisabled) return false;
          if (audience === "contractors") return entry.role === "Contractor";
          if (audience === "homeowners") return entry.role === "Homeowner";
          return entry.role === "Contractor" || entry.role === "Homeowner";
        });

      const results = await Promise.allSettled(
        recipients.map((recipient: any) =>
          sendLoggedMail({
            logContext: createEmailLogContext({
              handlerName: "send-broadcast-update",
              eventType: "broadcast_update",
              recipient: recipient.email,
              metadata: {
                audience,
                recipientRole: recipient.role,
                sentBy,
              },
            }),
            mail: {
              from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
              to: recipient.email,
              subject,
              html: renderIntroEmail({
                heading: subject,
                greeting: `Hi ${recipient.name || audienceLabel},`,
                bodyLines: String(message)
                  .split(/\n+/)
                  .map((line: string) => line.trim())
                  .filter(Boolean),
                detailLines: [
                  `<strong>Audience:</strong> ${audienceLabel}`,
                  `<strong>Sent by:</strong> ${sentBy || "Blueprint Admin"}`,
                ],
              }),
            },
          })
        )
      );

      const sent = results.filter((result) => result.status === "fulfilled").length;
      const failed = results.length - sent;

      res.json({
        success: true,
        audience,
        recipients: recipients.length,
        sent,
        failed,
      });
    } catch (error) {
      console.error("Error sending broadcast update:", error);
      res.status(500).json({ error: "Failed to send broadcast update" });
    }
  });

  app.post("/api/send-intro-request-acknowledgment", async (req, res) => {
    const { contractorEmail, contractorName, category, town } = req.body;
    if (!contractorEmail) {
      return res.status(400).json({ error: "Contractor email is required" });
    }

    try {
      const info = await sendContractorNotificationEmail({
        handlerName: "send-intro-request-acknowledgment",
        eventType: "intro_request_acknowledgment",
        contractorEmail,
        contractorName,
        category,
        town,
        deprecatedEndpoint: true,
      });

      res.json({ success: true, messageId: info.messageId, threadId: info.messageId });
    } catch (error) {
      console.error("Error sending intro acknowledgment:", error);
      res.status(500).json({ error: "Failed to send intro acknowledgment" });
    }
  });

  app.post("/api/send-intro-review-update", async (req, res) => {
    const { recipientEmail, recipientName, recipientType, category, location, statusLabel, nextStep } = req.body;
    if (!recipientEmail) {
      return res.status(400).json({ error: "Recipient email is required" });
    }

    try {
      const info = await sendMail({
        from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
        to: recipientEmail,
        cc: adminEmail,
        subject: `Blueprint update for ${category || "your request"}`,
        html: renderIntroEmail({
          heading: recipientType === "homeowner" ? "Contractor Interest Update" : "Introduction Request Review",
          greeting: `Hi ${recipientName || "there"},`,
          bodyLines: [
            statusLabel || "Blueprint has an update on your request.",
            nextStep || "Blueprint is coordinating the next step and will follow up again when the request changes.",
          ],
          detailLines: [
            `<strong>Project:</strong> ${category || "Project request"}`,
            `<strong>Area:</strong> ${location || "Local service area"}`,
          ],
        }),
      });

      res.json({ success: true, messageId: info.messageId, threadId: info.messageId });
    } catch (error) {
      console.error("Error sending intro review update:", error);
      res.status(500).json({ error: "Failed to send intro review update" });
    }
  });

  app.post("/api/send-intro-approval-shared-thread", async (req, res) => {
    const { homeownerEmail, homeownerName, contractorEmail, contractorName, category, location, homeownerPhone } = req.body;
    if (!homeownerEmail || !contractorEmail) {
      return res.status(400).json({ error: "Homeowner and contractor emails are required" });
    }

    try {
      const info = await sendMail({
        from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
        to: [homeownerEmail, contractorEmail].join(", "),
        cc: adminEmail,
        replyTo: adminEmail,
        subject: `Blueprint introduction approved: ${category || "project request"}`,
        html: renderIntroEmail({
          heading: "Blueprint Introduction Approved",
          greeting: `Hi ${homeownerName || "Homeowner"} and ${contractorName || "Home Pro"},`,
          bodyLines: [
            "Blueprint approved this introduction and is opening one shared email thread so everyone can coordinate in one place.",
            "Please reply on this thread for scheduling and next steps so Blueprint remains copied during the early workflow.",
          ],
          detailLines: [
            `<strong>Project:</strong> ${category || "Project request"}`,
            `<strong>Area:</strong> ${location || "Local service area"}`,
            `<strong>Homeowner:</strong> ${homeownerName || "Homeowner"}${homeownerPhone ? ` (${homeownerPhone})` : ""}`,
            `<strong>Home Pro:</strong> ${contractorName || "Home Pro"}`,
          ],
        }),
      });

      res.json({ success: true, messageId: info.messageId, threadId: info.messageId });
    } catch (error) {
      console.error("Error sending intro approval email:", error);
      res.status(500).json({ error: "Failed to send intro approval email" });
    }
  });

  app.post("/api/send-intro-decline", async (req, res) => {
    const { contractorEmail, contractorName, category, location, declineReason } = req.body;
    if (!contractorEmail) {
      return res.status(400).json({ error: "Contractor email is required" });
    }

    try {
      const info = await sendMail({
        from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
        to: contractorEmail,
        cc: adminEmail,
        subject: `Blueprint update on your ${category || "project"} request`,
        html: renderIntroEmail({
          heading: "Introduction Request Update",
          greeting: `Hi ${contractorName || "Home Pro"},`,
          bodyLines: [
            "Blueprint is not moving forward with this introduction request.",
            "Thank you for your interest. We will keep you posted on future opportunities that fit your profile.",
          ],
          detailLines: [
            `<strong>Project:</strong> ${category || "Project request"}`,
            `<strong>Area:</strong> ${location || "Local service area"}`,
            "<strong>Outcome:</strong> Declined",
            `<strong>Note:</strong> ${declineReason || "No additional reason provided"}`,
          ],
        }),
      });

      res.json({ success: true, messageId: info.messageId, threadId: info.messageId });
    } catch (error) {
      console.error("Error sending intro decline email:", error);
      res.status(500).json({ error: "Failed to send intro decline email" });
    }
  });

  app.post("/api/send-contractor-signup-confirmation", async (req, res) => {
    const { email, name } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    try {
      const info = await sendContractorNotificationEmail({
        handlerName: "send-contractor-signup-confirmation",
        eventType: "signup_confirmation",
        contractorEmail: email,
        contractorName: name,
        deprecatedEndpoint: true,
      });

      res.json({ success: true, messageId: info.messageId });
    } catch (error) {
      console.error("Error sending contractor signup confirmation:", error);
      res.status(500).json({ error: "Failed to send contractor signup confirmation" });
    }
  });

  app.post("/api/send-contractor-notification", async (req, res) => {
    const {
      eventType,
      contractorEmail,
      contractorName,
      projectTitle,
      category,
      town,
      amount,
      estimateType,
      requestedVisitDate,
      replyTo,
    } = req.body;

    if (!contractorEmail) {
      return res.status(400).json({ error: "Contractor email is required" });
    }

    if (!eventType) {
      return res.status(400).json({ error: "Notification event type is required" });
    }

    try {
      const info = await sendContractorNotificationEmail({
        handlerName: "send-contractor-notification",
        eventType,
        contractorEmail,
        contractorName,
        projectTitle,
        category,
        town,
        amount,
        estimateType,
        requestedVisitDate,
        replyTo,
      });

      res.json({ success: true, messageId: info.messageId, eventType });
    } catch (error) {
      console.error("Error sending contractor notification:", error);
      res.status(500).json({ error: "Failed to send contractor notification", eventType });
    }
  });

  app.post("/api/send-rough-estimate-alert", async (req, res) => {
    const { homeownerEmail, homeownerName, contractorName, projectTitle, amount } = req.body;
    if (!homeownerEmail) {
      return res.status(400).json({ error: "Homeowner email is required" });
    }

    try {
      const info = await sendMail({
        from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
        to: homeownerEmail,
        cc: adminEmail,
        subject: `New rough estimate for ${projectTitle || "your project"}`,
        html: renderIntroEmail({
          heading: "New Rough Estimate Received",
          greeting: `Hi ${homeownerName || "Homeowner"},`,
          bodyLines: [
            `${contractorName || "A contractor"} submitted a rough estimate through Blueprint.`,
            "You can review the estimate in your homeowner portal and continue the process from there.",
          ],
          detailLines: [
            `<strong>Project:</strong> ${projectTitle || "Project request"}`,
            `<strong>Contractor:</strong> ${contractorName || "Contractor"}`,
            `<strong>Rough estimate:</strong> $${Number(amount || 0).toLocaleString()}`,
          ],
        }),
      });

      res.json({ success: true, messageId: info.messageId });
    } catch (error) {
      console.error("Error sending rough estimate alert:", error);
      res.status(500).json({ error: "Failed to send rough estimate alert" });
    }
  });

  app.post("/api/send-contractor-estimate-confirmation", async (req, res) => {
    const { contractorEmail, contractorName, projectTitle, amount, estimateType } = req.body;
    if (!contractorEmail) {
      return res.status(400).json({ error: "Contractor email is required" });
    }

    try {
      const info = await sendContractorNotificationEmail({
        handlerName: "send-contractor-estimate-confirmation",
        eventType: "estimate_confirmation",
        contractorEmail,
        contractorName,
        projectTitle,
        amount,
        estimateType,
        deprecatedEndpoint: true,
      });

      res.json({ success: true, messageId: info.messageId });
    } catch (error) {
      console.error("Error sending contractor estimate confirmation:", error);
      res.status(500).json({ error: "Failed to send contractor estimate confirmation" });
    }
  });

  app.post("/api/send-contractor-inspection-request-confirmation", async (req, res) => {
    const { contractorEmail, contractorName, projectTitle, requestedVisitDate } = req.body;
    if (!contractorEmail) {
      return res.status(400).json({ error: "Contractor email is required" });
    }

    try {
      const info = await sendContractorNotificationEmail({
        handlerName: "send-contractor-inspection-request-confirmation",
        eventType: "inspection_request_confirmation",
        contractorEmail,
        contractorName,
        projectTitle,
        requestedVisitDate,
        deprecatedEndpoint: true,
      });

      res.json({ success: true, messageId: info.messageId });
    } catch (error) {
      console.error("Error sending contractor inspection confirmation:", error);
      res.status(500).json({ error: "Failed to send contractor inspection confirmation" });
    }
  });

  app.post("/api/send-estimate-accepted-notification", async (req, res) => {
    const {
      homeownerEmail,
      homeownerName,
      contractorEmail,
      contractorName,
      projectTitle,
      amount,
      estimateType,
    } = req.body;

    if (!homeownerEmail || !contractorEmail) {
      return res.status(400).json({ error: "Homeowner and contractor emails are required" });
    }

    const nextStep =
      estimateType === "final"
        ? "The project can now move into contracting and execution through Blueprint."
        : "Next step: coordinate the in-person inspection and final estimate through Blueprint.";

    try {
      const info = await sendMail({
        from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
        to: [homeownerEmail, contractorEmail],
        cc: adminEmail,
        subject: `${estimateType === "final" ? "Final" : "Rough"} estimate accepted for ${projectTitle || "project"}`,
        html: renderIntroEmail({
          heading: `${estimateType === "final" ? "Final" : "Rough"} Estimate Accepted`,
          greeting: `Hi ${homeownerName || "Homeowner"} and ${contractorName || "Home Pro"},`,
          bodyLines: [
            `${homeownerName || "The homeowner"} accepted the ${estimateType === "final" ? "final" : "rough"} estimate through Blueprint.`,
            nextStep,
          ],
          detailLines: [
            `<strong>Project:</strong> ${projectTitle || "Project"}`,
            `<strong>Accepted estimate type:</strong> ${estimateType === "final" ? "Final estimate" : "Rough estimate"}`,
            `<strong>Accepted amount:</strong> $${Number(amount || 0).toLocaleString()}`,
          ],
        }),
      });

      res.json({ success: true, messageId: info.messageId });
    } catch (error) {
      console.error("Error sending estimate acceptance notification:", error);
      res.status(500).json({ error: "Failed to send estimate acceptance notification" });
    }
  });

  app.post("/api/send-new-project-alerts", async (req, res) => {
    const { projectTitle, category, town, startDate, description } = req.body;

    try {
      const db = getAdminDb();
      const snapshot = await db.collection("users")
        .where("role", "==", "Contractor")
        .where("notifyOnNewProjects", "==", true)
        .where("subscriptionLevel", "in", ["trial", "beginner", "junior", "pro"])
        .get();

      const recipients = snapshot.docs
        .map((entry) => entry.data())
        .filter((user) => typeof user.email === "string" && user.email.length > 0)
        .filter((user: any) => matchesLeadCategory(user, category));

      const smsRecipients = snapshot.docs
        .map((entry) => entry.data())
        .filter(
          (user: any) =>
            matchesLeadCategory(user, category) &&
            user.notifyOnSmsLeadAlerts === true &&
            user.smsConsentAt &&
            typeof user.phone === "string" &&
            user.phone.trim().length > 0
        );

      await Promise.all(
        recipients.map((recipient) =>
          sendMail({
            from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
            to: recipient.email,
            cc: adminEmail,
            subject: `New homeowner project: ${projectTitle || category || "Project request"}`,
            html: renderIntroEmail({
              heading: "New Homeowner Project Submitted",
              greeting: `Hi ${recipient.name || "Home Pro"},`,
              bodyLines: [
                "A new homeowner project was submitted to Blueprint and matches the active project feed.",
                "Open your Home Pro portal to review the project and decide whether to place a bid or request an introduction.",
              ],
              detailLines: [
                `<strong>Project:</strong> ${projectTitle || category || "Project request"}`,
                `<strong>Category:</strong> ${category || "General"}`,
                `<strong>Area:</strong> ${town || "Local service area"}`,
                `<strong>Requested start:</strong> ${startDate || "Not specified"}`,
                `<strong>Description:</strong> ${description || "No description provided"}`,
              ],
            }),
          })
        )
      );

      let smsRecipientsNotified = 0;
      if ((TWILIO_FROM_NUMBER || TWILIO_MESSAGING_SERVICE_SID) && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && smsRecipients.length > 0) {
        const smsBody = buildProjectAlertSms({ projectTitle, category, town, startDate });
        const smsResults = await Promise.allSettled(
          smsRecipients.map((recipient: any) =>
            sendSms({
              to: recipient.phone,
              body: smsBody,
            })
          )
        );
        smsRecipientsNotified = smsResults.filter((result) => result.status === "fulfilled").length;
      }

      res.json({ success: true, recipients: recipients.length, smsRecipients: smsRecipientsNotified });
    } catch (error) {
      console.error("Error sending new project alerts:", error);
      res.status(500).json({ error: "Failed to send new project alerts" });
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

  const shouldRunPermitSync = process.env.NODE_ENV === "production" || ENABLE_DEV_PERMIT_SYNC;
  if (shouldRunPermitSync) {
    void syncPermitFeed();
    setInterval(() => {
      void syncPermitFeed();
    }, PERMIT_SYNC_INTERVAL_MS);
  } else {
    console.log("[PERMIT SYNC] Skipped automatic permit sync in local dev. Set ENABLE_DEV_PERMIT_SYNC=true to enable it.");
  }
}

startServer();
