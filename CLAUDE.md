# Lemhi Cohort Portal conventions

## Product rules

- `docs/PRD.md` is the source of truth.
- This is a standalone prototype, not part of the Lemhi platform.
- MSP users belong to exactly one MSP.
- Cohorts become read-only 28 days after their start date unless an admin overrides the status.
- Ended cohort checklist content is frozen; program changes propagate only to upcoming and active cohorts.
- The first client assessment is a manually checked Lemhi-owned task representing work in Lemhi Engage.
- Files live in private Supabase Storage, never in Git or through Vercel Functions.

## Commands

- `npm run dev` — start Next.js locally.
- `npm run build` — production build.
- `npm run lint` — ESLint.
- `npm run typecheck` — TypeScript without emitting files.
- `npm run supabase:start` — start the local Supabase stack.
- `npm run supabase:reset` — rebuild the local database from migrations and seed.
- `npm run test:db` — run pgTAP database and RLS tests.
- `npm run test:e2e` — run desktop and mobile Playwright smoke tests against the local app.
- `npm run db:types` — regenerate `lib/database.types.ts` from the local database.
- `npm run admin:bootstrap -- name@lemhi.com "Full Name"` — allow-list and invite the first Lemhi admin.
- `npm run assets:seed -- manifest.json ./starter-files` — upload the 19 program starter files from a completed manifest.

## Folder structure

- `app/` — App Router pages, layouts, server actions and route handlers.
- `components/` — shared UI, organized by product area.
- `lib/supabase/` — browser, server and privileged Supabase clients.
- `lib/database.types.ts` — generated database types; do not hand-edit after migrations exist.
- `supabase/migrations/` — append-only schema migrations.
- `supabase/tests/database/` — pgTAP tests, especially cross-tenant RLS cases.
- `scripts/` — idempotent bootstrap and asset-upload scripts.
- `docs/` — product and architecture documentation.

## Security invariants

- Enable RLS on every table in an exposed schema and write explicit operation policies.
- Treat RLS as the source of truth; UI checks are not authorization.
- The secret/service key may appear only in `server-only` modules and trusted scripts.
- Validate authorization with the signed-in user's server client before any privileged operation.
- MSP A must never read MSP B's users, notes, completions or MSP-scoped assets.
- Peer directory data is limited to company name, website and logo.
- MSPs may mutate only visible MSP-owned tasks while their cohort is writable.
- Storage buckets stay private and file access uses short-lived signed URLs.
- All sign-in and invite emails use token-hash callbacks through `/auth/confirm`.
- Admin provisioning requires both an active allow-list row and an `@lemhi.com` address.

## Implementation style

- TypeScript strict mode; Server Components by default.
- Use Server Actions for small form mutations and Route Handlers for auth callbacks, signed URLs and direct-upload setup.
- Keep dependencies minimal. Approved additions beyond the core stack are Zod, `tus-js-client`, and Playwright.
- Use Tailwind with the brand tokens in `app/globals.css`; EB Garamond headings and DM Sans body copy.
- Preserve unrelated user changes and keep migrations append-only after application.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
