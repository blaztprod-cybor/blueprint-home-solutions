<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/0535c480-1012-4655-a793-62fed6b056e5

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in `.env.local` to your Gemini API key
3. If you want contractor SMS alerts enabled through Textbelt, add these environment variables in Netlify and your local shell or `.env.local`:
   `TEXTBELT_API_KEY`
   `TEXTBELT_SENDER` (optional)
4. If you want vendor and homeowner emails to send from `info@blueprinthomesolutions.com`, set these environment variables in Netlify and your local shell or `.env.local`:
   `SMTP_HOST`
   `SMTP_PORT`
   `SMTP_SECURE`
   `SMTP_USER`
   `SMTP_PASS`
   `SMTP_FROM_NAME`
   `SMTP_FROM_EMAIL`
   `HOMEOWNER_CALLBACK_EMAIL`
5. For production inbox placement, also configure DNS for `blueprinthomesolutions.com` with:
   SPF for your email provider
   DKIM enabled and verified
   DMARC published, starting with monitoring
   The same authenticated domain used for both `from` and return-path whenever your provider supports it
6. Run the app:
   `npm run dev`

Contractor SMS alerts are sent only for contractors who have `notifyOnSmsLeadAlerts` enabled, a saved phone number, and an `smsConsentAt` timestamp on their user record.
If you enable reply webhooks in Textbelt, point them at `/api/textbelt-inbound-sms` locally or `/.netlify/functions/textbelt-inbound-sms` on Netlify.

## Internal Docs

- System blueprint: [`docs/system-blueprint.md`](docs/system-blueprint.md)
- Homeowner portal requirements: [`docs/homeowner-portal-requirements.md`](docs/homeowner-portal-requirements.md)
- Vendor onboarding policy: [`docs/vendor-onboarding-policy.md`](docs/vendor-onboarding-policy.md)
- Lead introduction product requirements: [`docs/lead-introduction-product-requirements.md`](docs/lead-introduction-product-requirements.md)
