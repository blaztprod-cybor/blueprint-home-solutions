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
3. If you want contractor SMS alerts enabled through Twilio, add these environment variables in Netlify and your local shell or `.env.local`:
   `TWILIO_ACCOUNT_SID`
   `TWILIO_AUTH_TOKEN`
   `TWILIO_FROM_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID`
4. Run the app:
   `npm run dev`

Contractor SMS alerts are sent only for contractors who have `notifyOnSmsLeadAlerts` enabled, a saved phone number, and an `smsConsentAt` timestamp on their user record.

## Internal Docs

- System blueprint: [`docs/system-blueprint.md`](docs/system-blueprint.md)
- Homeowner portal requirements: [`docs/homeowner-portal-requirements.md`](docs/homeowner-portal-requirements.md)
- Vendor onboarding policy: [`docs/vendor-onboarding-policy.md`](docs/vendor-onboarding-policy.md)
- Lead introduction product requirements: [`docs/lead-introduction-product-requirements.md`](docs/lead-introduction-product-requirements.md)
