# Deployment and M1 launch checklist

## Environments

Use separate Supabase projects for preview and production. Vercel preview deployments point to the preview project; the production branch points only to production. Never copy production customer rows or recordings into preview.

Set these variables in each Vercel environment:

- `NEXT_PUBLIC_SUPABASE_URL` — that environment's Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — browser-safe publishable key.
- `SUPABASE_SECRET_KEY` — server-only secret key; never prefix it with `NEXT_PUBLIC_`.
- `APP_URL` — the canonical origin, with no trailing slash (for example `https://cohorts.lemhi.ai`).

## First deployment

1. Create paid preview and production Supabase projects owned by Lemhi.
2. Link the CLI to preview and apply every checked-in migration. Repeat against production after preview verification.
3. Run the RLS test suite locally against the migrated schema.
4. Create the Vercel project from the GitHub repository and add the environment variables above.
5. Add the production and preview origins to Supabase Auth URL Configuration. Include `/auth/confirm` callback URLs for both.
6. Configure custom SMTP in both Supabase projects. Use a verified Lemhi sending domain and set a branded sender address.
7. Bootstrap the first production admin with `npm run admin:bootstrap -- admin@lemhi.com "Full Name"` using production environment variables.
8. Upload the 19 starter files with `npm run assets:seed -- manifest.json ./starter-files`.
9. Add the chosen domain in Vercel, point its DNS record, and update `APP_URL` plus Supabase Auth URLs.

## Storage settings

- Keep `portal-assets` and `msp-logos` private.
- Confirm the project and bucket file-size limits permit at least 5 GB per object.
- Confirm the paid plan has enough storage and egress for permanent recordings; review usage monthly.
- Upload large recordings with the browser's resumable flow. Do not proxy file bytes through Vercel.

## Release gate

- [ ] `npm run lint`, `npm run typecheck`, `npm run test:e2e`, and `npm run build` pass.
- [ ] `npm run test:db` passes every RLS isolation test.
- [ ] All 19 starter assets are ready and visible in an external MSP account.
- [ ] Custom SMTP delivers an invitation and a requested sign-in link to a real non-Lemhi email.
- [ ] An MSP owner can invite and remove a teammate.
- [ ] MSP A cannot see MSP B's people, notes, completions, or private assets.
- [ ] A real PDF previews and downloads through a short-lived URL.
- [ ] A large test recording resumes after an interrupted upload and plays in the portal.
- [ ] The first cohort's name, MSPs, contacts, lead, timezone, dates, and Join links are correct.
- [ ] Mobile checks pass for sign-in, Cohort, Checklist, Library, and Team.
- [ ] Production secrets are absent from Git history and client bundles.
- [ ] DNS, `APP_URL`, and Supabase redirect URLs use the final domain.

The app is not ready to invite real MSPs until every release-gate item is checked.
