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

## Permit Feed

The permit feed no longer needs a daily site redeploy to stay current.

- Railway serves live permit reads through `/api/dob-permits`
- Railway serves certificate-of-occupancy reads through `/api/dob-certificate-of-occupancy-filings`
- Railway serves recent occupancy-only reads through `/api/recent-occupancy-filings`
- both routes read from Supabase when `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured
- both routes fall back to `public/data/permits.json` if Supabase is unavailable

`/api/dob-certificate-of-occupancy-filings` is the explicit certificate-of-occupancy feed. `/api/recent-occupancy-filings` remains available as a compatibility alias. Both are derived from the same synced `dob_permits` table and filter for occupancy-style job types such as `CO`, `Alteration CO`, and related DOB values.

Required permit-feed environment variables:

- `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

API key management:

- `GET /api/api-keys` lists the signed-in customer's API keys
- `POST /api/api-keys` creates a new API key for the signed-in customer
- `POST /api/api-keys/:keyId/revoke` revokes an existing API key
- `/api/dob-certificate-of-occupancy-filings` accepts `x-api-key: <key>` or `Authorization: Bearer <key>`
- `/api/recent-occupancy-filings` is a protected compatibility alias and accepts the same API key auth

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
- `SUPABASE_SERVICE_ROLE_KEY`
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
- `PERMIT_SYNC_SECRET` if you want Railway or another scheduler to trigger `POST /api/admin/sync-permits`
- `ENABLE_SERVER_PERMIT_SYNC=true` only if you intentionally want the web server to poll and sync permits on an interval

`PORT` is provided by Railway automatically. The server already listens on `process.env.PORT`.

For scheduled permit refreshes on Railway, prefer a cron job or external scheduler that calls:

- `POST /api/admin/sync-permits`
- Header: `Authorization: Bearer <PERMIT_SYNC_SECRET>`

This is safer than relying on the web server to run background polling on every production instance.

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
