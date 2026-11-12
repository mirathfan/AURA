# Vercel deployment

This Next.js project is ready for Vercel's zero-configuration framework detection.

## First-time setup

```bash
npm install
npx vercel link
```

The link command creates a local `.vercel` directory. It is intentionally ignored by Git.

## Verify locally

```bash
npm run lint
npm run build
npm run vercel:build
```

`vercel:build` requires the project to be linked first.

## Deploy

```bash
npm run deploy:preview
npm run deploy:production
```

The first command creates a preview deployment. The second promotes a production deployment.

## Environment

`NEXT_PUBLIC_SITE_URL` is optional. When it is not set, the site reads Vercel's automatic deployment URL variables for canonical and social metadata. For Beta 1, set it to `https://aura-kasatlabs.vercel.app`.

Beta 1 uses `support@getaura.app` for both support and privacy. The value is generated from `shared/privacyPolicy.ts` into `website/lib/privacyPolicy.ts`; `website/lib/site.ts` uses it consistently on privacy, terms, support and delete-account pages. Run `node scripts/sync-privacy-policy.cjs` from the repository root after disclosure/contact changes. `NEXT_PUBLIC_SUPPORT_EMAIL` no longer overrides the canonical contact. Public `/privacy` and `/terms` accessibility and mailbox deliverability remain unverified release gates; configuration is not verification.

The beta form writes to Google Sheets through the server-only `/api/beta` route. The preferred setup uses a token-protected Apps Script web app bound to the target sheet:

- `GOOGLE_APPS_SCRIPT_WEB_APP_URL`
- `GOOGLE_APPS_SCRIPT_TOKEN`

The route also supports direct Google Sheets API access through a service account:

- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SHEETS_RANGE`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

Public site variables:

- `NEXT_PUBLIC_SITE_URL`

Enable the Google Sheets API for the Google Cloud project, create a service account and JSON key, then share the spreadsheet with the service-account email as an Editor. Never expose the private key through a `NEXT_PUBLIC_` variable.

The beta endpoint validates names and email addresses, uses a hidden `company` field as a bot trap, and checks the configured sheet before appending an email. The duplicate check is best-effort; Google Sheets does not provide an atomic unique constraint, so simultaneous identical requests can still race.
