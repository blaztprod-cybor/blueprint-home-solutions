<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Blueprint Home Solutions

This app now runs as a single Node process:

- Vite builds the frontend into `dist`
- `server.ts` serves the built app in production
- backend endpoints are exposed under `/api/*`

That architecture fits Railway directly. Netlify config is still in the repo as legacy reference, but production should point at Railway.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Create `.env.local` and set the values you need for local development.
3. Start the app:
   `npm run dev`
4. Build the frontend bundle when you want to verify production assets:
   `npm run build`

## Netlify Permit Feed

The permit feed no longer needs a daily site redeploy to stay current.

- Netlify serves live permit reads through `/api/dob-permits`
- a scheduled Netlify function `sync-permits` runs `@daily`
- the scheduled job refreshes `dob_permits` in Supabase
- the frontend falls back to `public/data/permits.json` only if the live source is unavailable

Required Netlify environment variables for the permit feed:

- `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

For manual backfills, run:
`npm run permits:sync`

## Railway Deploy

Railway should use:

- Build command: `npm run build`
- Start command: `npm start`

Required environment variables depend on which features you need enabled:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_ADMIN_PROJECT_ID` or `GOOGLE_APPLICATION_CREDENTIALS` or both `FIREBASE_ADMIN_CLIENT_EMAIL` and `FIREBASE_ADMIN_PRIVATE_KEY`
- `FIREBASE_FIRESTORE_DATABASE_ID` if you are not using the default database
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM_NAME`
- `SMTP_FROM_EMAIL`
- `HOMEOWNER_CALLBACK_EMAIL`
- `BLUEPRINT_ADMIN_EMAIL`
- `TEXTBELT_API_KEY`
- `TEXTBELT_SENDER`

Optional:

- `RESEND_API_KEY` if you want Resend API delivery instead of SMTP fallback
- `ENABLE_DEV_PERMIT_SYNC=true` for local permit sync testing

`PORT` is provided by Railway automatically. The server already listens on `process.env.PORT`.

If you enable reply webhooks in Textbelt, point them at:

- Local: `/api/textbelt-inbound-sms`
- Railway: `/api/textbelt-inbound-sms`

## Domain Cutover

When Railway is live:

1. Add the custom domain in Railway.
2. Update DNS to point `blueprinthomesolutions.com` at Railway instead of Netlify.
3. Verify the root app and a backend route such as `/api/recent-project-posts`.
4. Re-test email and SMS flows from production.

## Internal Docs

- System blueprint: [`docs/system-blueprint.md`](docs/system-blueprint.md)
- Homeowner portal requirements: [`docs/homeowner-portal-requirements.md`](docs/homeowner-portal-requirements.md)
- Vendor onboarding policy: [`docs/vendor-onboarding-policy.md`](docs/vendor-onboarding-policy.md)
- Lead introduction product requirements: [`docs/lead-introduction-product-requirements.md`](docs/lead-introduction-product-requirements.md)
