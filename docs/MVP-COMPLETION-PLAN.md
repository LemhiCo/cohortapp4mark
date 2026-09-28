# Lemhi Cohort Portal — MVP Completion Plan

**Last updated:** 2026-09-27  
**Production portal:** <https://cohortapp4mark.vercel.app>  
**Source repository:** <https://github.com/LemhiCo/cohortapp4mark>  
**Product requirements:** [`docs/PRD.md`](./PRD.md)  
**Current application commit:** `50084cc`

## 1. Purpose of this document

This is the implementation and handoff guide from the current live prototype to the minimum viable product that Mark can use with the first MSP cohort.

It is deliberately operational. If development stops, continue at the first unchecked release-blocking item, verify its acceptance criteria, update this document, and then move to the next item.

The MVP is complete when:

1. Mark has a real admin login and can see every MSP.
2. Every MSP has a separate email/password login and can see only its own private portal data.
3. The cohort schedule, four-week roadmap, 30-task checklist, Lemhi lead, peer companies, and 19 starter assets contain launch-ready information.
4. Sessions without a final meeting URL display **“Link coming this week”**. Mark can add the real link later without a deployment.
5. Mark can follow progress, complete Lemhi-owned work, exchange task notes, and manage shared files.
6. The hosted production system passes the RLS, sign-in, portal-isolation, file-access, and admin smoke tests in this document.

This is an MVP completion target, not the full M2 feature set. Automated email, a polished recording workflow, advanced dashboard analysis, and deeper editing tools can follow once the first cohort is operating safely.

## 2. Release-blocking warning

**Do not distribute the MSP credentials while production demo mode is enabled.**

Production currently allows a password-free internal walkthrough when `DEMO_LOGIN_ENABLED` is enabled or omitted. A demo user can switch to the fixed demo-admin view. This is acceptable only for the private team walkthrough; it is not acceptable after MSP credentials are distributed.

Before sending the portal link to an MSP:

- Create and verify Mark’s real admin account.
- Set `DEMO_LOGIN_ENABLED=false` in the Vercel Production environment.
- Redeploy production.
- Confirm that leaving the password blank no longer opens the demo.
- Confirm that each MSP password opens only the intended MSP portal.

## 3. Current production state

### Already live and verified

- [x] Next.js application hosted on Vercel.
- [x] Supabase production database, Auth, and private Storage connected.
- [x] Four-week program seeded with 30 cohort tasks.
- [x] Four group session records generated for the current cohort.
- [x] MSP Cohort, Checklist, Library, and Team routes implemented.
- [x] Admin cohort setup, cohort detail, per-MSP detail, session editor, logo upload, and library upload routes implemented.
- [x] Resumable direct-to-Supabase file upload implemented; large files do not pass through a Vercel function.
- [x] PDF preview, video playback, signed download, category filtering, and library search implemented.
- [x] Nineteen real starter assets uploaded once as private program-scoped assets.
- [x] Nine fake `example.com` library placeholders removed.
- [x] Assets organized as 11 marketing assets and 8 documentation assets.
- [x] Row-level security enabled across the application tables and private storage buckets.
- [x] SQL RLS test suite exists at `supabase/tests/database/rls.test.sql`.
- [x] Password sign-in added alongside the existing demo/magic-link path and deployed.
- [x] Four separate MSP owner accounts created:

  | MSP | Login | Production status |
  |---|---|---|
  | BluePeak Networks | `bluepeak@lemhi.com` | Active owner account |
  | Harbor Ridge Technology | `harbor.ridge@lemhi.com` | Active owner account |
  | Northstar Managed IT | `northstar@lemhi.com` | Active owner account |
  | SummitDesk Solutions | `summitdesk@lemhi.com` | Active owner account |

- [x] Production access check completed for all four accounts. Each account returned:
  - Role: `msp_owner`
  - Exactly one directly visible MSP: its own
  - Three peers through the restricted peer view
  - Nineteen ready shared assets

Temporary passwords are intentionally **not stored in Git, this document, source code, or database tables**. Keep the credential handoff separately in a password manager or another approved secure channel.

### Live but still contains demo values

- [ ] Cohort is named `Fall 2026 Demo Cohort`.
- [ ] Cohort start date is `2026-09-14`; confirm the real cohort date.
- [ ] Time zone is `America/New_York`; confirm it with Mark.
- [ ] Weekly session time is Monday at 11:00 AM Eastern; confirm it with Mark.
- [x] All four fake `https://meet.google.com` URLs were cleared; session URLs are now `NULL` until Mark adds Teams links.
- [ ] MSP websites are all `https://example.com`.
- [ ] MSP logos are not uploaded.
- [ ] The assigned lead is the demo admin identity, not Mark’s real profile.
- [ ] Several demo-only Northstar viewer profiles remain from internal walkthrough sign-ins.
- [ ] Demo progress, task notes, and completion history remain in the sample cohort. Decide whether to clear them before launch.

### Not yet implemented or launch-ready

- [x] Mark’s real admin account created as `mark.creighton@lemhi.com`.
- [x] Production demo mode disabled in application code regardless of environment configuration.
- [ ] Launch-ready cohort name, dates, schedule, websites, logos, and lead profile.
- [x] The exact “Link coming this week” empty-session treatment is implemented in both session locations.
- [x] Production browser smoke test passed for all four MSP logins on desktop and mobile.
- [ ] Full local RLS suite rerun; Docker Desktop was stopped during the last attempt.
- [ ] Custom domain such as `cohorts.lemhi.ai`.
- [ ] Custom SMTP and real invitation delivery. This is not required for the temporary manual-password launch.
- [x] Basic admin cohort pulse with active MSPs, behind status, sign-in/activity status, progress, and upcoming sessions.
- [ ] Add stuck-task ranking and richer multi-cohort rollups to the admin dashboard.
- [ ] Session-specific three-file upload workflow for recording, transcript, and summary.
- [ ] Per-MSP hide/add task controls in the admin UI.
- [ ] Program week/task editor.
- [ ] Admin UI for editing/deleting existing assets.
- [x] Admin UI for editing MSP name/website and deactivating/reactivating portal access.
- [ ] Admin UI for resetting MSP credentials.

## 4. MVP scope and definition of done

### 4.1 Authentication and account isolation

- Mark signs in with a real allow-listed `@lemhi.com` account and lands on `/admin`.
- Each MSP signs in with its assigned email and temporary password and lands on `/cohort`.
- Public self-registration is unavailable.
- One profile belongs to at most one MSP.
- An MSP user who requests `/admin` is redirected to `/cohort`.
- An MSP cannot read or mutate another MSP’s profiles, notes, completions, private assets, or storage objects.
- MSPs may see peer company name, website, and logo only through `cohort_peers`.
- Temporary passwords are distributed manually and are never committed to the repository.

### 4.2 MSP experience

- Cohort page shows the correct cohort name, date range, current week, weekly goal, open-task count, next session, complete four-week schedule, Lemhi lead, and peer companies.
- A session with a real URL shows a Join button.
- A session without a URL shows **“Link coming this week”** and no dead link.
- Checklist shows all four weeks, overall and weekly progress, task ownership, completion information, notes, and attached assets.
- MSP users can complete only MSP-owned tasks while the cohort is active.
- Lemhi-owned tasks and checkpoints are visible but read-only to MSP users.
- Library exposes the 19 starter assets with correct titles, categories, search, preview where supported, and download.
- A program asset is visible to all cohort MSPs; an MSP-scoped asset is visible only to its MSP.
- The portal works at phone and desktop widths.

### 4.3 Mark’s admin experience

- Mark can see all cohorts and all MSP portals.
- Mark can open each MSP and see overall/weekly progress, overdue work, users, notes, and visible assets.
- Mark can complete/reopen Lemhi-owned tasks and checkpoints.
- Mark can reply in shared task-note threads.
- Mark can edit all four session titles, dates/times, and meeting URLs.
- Mark can create another cohort and MSP portal without database work.
- Mark can upload a program-, cohort-, or MSP-scoped file or external link.
- Mark can upload an MSP logo.
- Mark can confirm which files each MSP can see.

### 4.4 Hosting and operations

- GitHub `main` is the deploy source for Vercel production.
- Production secrets exist only in Vercel/Supabase or ignored local environment files.
- The Supabase service/secret key never reaches browser code.
- Storage buckets remain private; delivery uses short-lived signed URLs.
- Database migrations are append-only and checked into Git.
- Lint, type checking, production build, RLS tests, and smoke tests pass before launch.

## 5. Architecture

### 5.1 System shape

```text
Browser
  |
  | HTTPS + Supabase session cookies
  v
Next.js App Router on Vercel
  |-- Server Components: protected page reads and rendering
  |-- Server Actions: small authenticated mutations
  |-- Route Handlers: auth callback, signed files, upload metadata
  |
  | public publishable key for user-scoped requests
  | server-only secret key for narrowly scoped provisioning/invitation work
  v
Supabase
  |-- Auth: admin and MSP identities
  |-- Postgres: program, cohorts, MSPs, tasks, progress, notes, assets
  |-- RLS: final authorization boundary
  |-- Private Storage: portal-assets and msp-logos
```

### 5.2 Route map

| Route | Audience | Responsibility |
|---|---|---|
| `/sign-in` | Everyone | Password sign-in; later, magic-link request |
| `/auth/confirm` | Everyone | Exchanges email tokens and finalizes invited access |
| `/cohort` | MSP | Weekly overview, sessions, lead, peers |
| `/checklist` | MSP | Progress, tasks, completions, notes, attachments |
| `/library` | MSP | Search and filter visible assets |
| `/library/[assetId]` | MSP | PDF/video preview, summary, action items, download |
| `/team` | MSP owner | View, invite, and remove teammates |
| `/admin` | Lemhi admin | Cohort creation and cohort list |
| `/admin/cohorts/[cohortId]` | Lemhi admin | Sessions, MSP portals, logos, owner access |
| `/admin/msps/[mspId]` | Lemhi admin | MSP progress, tasks, notes, users, assets |
| `/admin/library` | Lemhi admin | Upload and inspect scoped assets |
| `/api/assets/[assetId]` | Authorized user | Enforces access and returns signed file delivery |
| `/api/admin/assets` | Lemhi admin | Creates scoped asset metadata |
| `/api/admin/assets/[assetId]` | Lemhi admin | Finalizes upload state |
| `/api/admin/logos` | Lemhi admin | Handles private logo upload setup/finalization |

### 5.3 Authentication model

For this MVP, manually provisioned password accounts are the fastest safe substitute for unconfigured email delivery.

1. Every auth user has one `profiles` row.
2. Mark’s profile has role `lemhi_admin` and no `msp_id`.
3. Each temporary MSP account has role `msp_owner` and exactly one `msp_id`.
4. The server creates the Supabase session and stores it in secure cookies through `@supabase/ssr`.
5. Protected routes call `requireAdminProfile()` or `requireMspProfile()`.
6. Postgres RLS rechecks access even if an application route is called directly.

An `@lemhi.com` address alone must never grant admin access. Admin access requires an active `admin_allowlist` row. The four synthetic MSP emails must never be added to that allow-list.

### 5.4 Data and authorization model

- `programs`, `program_weeks`, and `program_tasks` define the reusable four-week template.
- Creating a cohort copies the template into `cohort_weeks` and `cohort_tasks` and generates four sessions.
- `profiles.msp_id` is the user-to-MSP boundary.
- `task_completions` and `task_notes` always include `msp_id` and a task from the same cohort.
- `msp_progress` is the shared SQL view for weekly, overall, and behind calculations.
- Assets exist once and have exactly one scope:
  - Program: every MSP
  - Cohort: MSPs in one cohort
  - MSP: one MSP only
- `cohort_peers` intentionally returns only company name, website, and logo path.
- Private storage policies call the same database access functions used by asset metadata.

### 5.5 File architecture

- Browser files upload directly to Supabase Storage with TUS resumable upload.
- The Next.js server creates metadata but never proxies the file body.
- Assets stay in the private `portal-assets` bucket.
- `/api/assets/[assetId]` and server-side signed URL creation provide short-lived access after RLS succeeds.
- Program starter files remain single stored objects; they are not copied into four MSP folders.

## 6. Design and engineering principles

1. **Security boundary in the database.** UI hiding is helpful, but RLS decides who may read or write.
2. **One source of truth.** Cohorts, sessions, tasks, progress, and assets come from Supabase rather than duplicated frontend state.
3. **Simple before automated.** Manual password distribution and manual meeting-link updates are acceptable for the first cohort.
4. **No fake launch data.** Placeholder URLs, dates, identities, and progress must be removed or clearly labelled before credentials are shared.
5. **Scoped once, reused everywhere.** A shared file is uploaded once and authorized by program/cohort/MSP scope.
6. **Server Components by default.** Client JavaScript is limited to interactions such as upload progress, forms, and filtering.
7. **Small reversible changes.** Each task below should fit one working session and have explicit acceptance criteria.
8. **No secrets in Git.** Passwords and service keys belong in a password manager or deployment environment.
9. **Accessible, responsive UI.** Forms have labels, states remain understandable without color, and core workflows work on phones.
10. **Operational clarity over cleverness.** Mark should be able to understand what happened and correct data without engineering help.

## 7. Requirement coverage against Mark’s PRD

| Requirement | Current status | MVP action |
|---|---|---|
| Separate MSP sign-in | Implemented and DB-verified | Disable demo mode and browser-test all four accounts |
| MSP cohort page | Implemented | Replace demo schedule, lead, websites, logos, and links |
| Four-week checklist | Implemented with 30 tasks | Confirm task wording/count against Mark’s final roadmap |
| Overall/weekly progress and behind | Implemented in SQL view | Reset demo progress and verify clean calculations |
| MSP/Lemhi task ownership | Implemented | Run completion authorization tests |
| Shared task notes | Implemented | Clear sample notes and smoke-test both sides |
| Starter library | Implemented with 19 real files | Final visual/content review with Mark |
| PDF preview and downloads | Implemented | Test representative PDF and non-previewable file |
| Video playback | Implemented generically | Test with a real sample recording before first session |
| Peer companies | Implemented via limited view | Add real sites/logos and verify no contacts leak |
| Team management | Implemented, email-dependent | Defer team invites or provision additional users manually |
| Mark admin access | Demo admin only | Create real allow-listed password account |
| Create cohort/MSP | Implemented | Smoke-test once with disposable preview data |
| Edit sessions | Implemented | “Link coming this week” is complete; add the real schedule |
| Per-MSP admin view | Implemented, including portal settings | Confirm Mark’s preferred summary/order |
| Scoped asset upload | Implemented | Test program, cohort, and MSP scope in production |
| Same-day session package | Partially implemented | Generic uploads work; guided recording/transcript/summary flow remains |
| Global admin dashboard | Basic cohort pulse implemented | Add stuck-task ranking and richer rollups after launch |
| Per-MSP task customization | Schema ready, UI absent | Post-launch unless needed for a named MSP now |
| Program editor | Schema propagates edits, UI absent | Use migration/admin SQL for emergency corrections; build later |
| Activity tracking | Sign-ins recorded | Build rollups later |

## 8. Ordered implementation plan

### Phase 0 — Close the authentication safety gap — RELEASE BLOCKER

- [x] Obtain Mark’s exact work email and display name.
- [x] Add Mark’s email to `admin_allowlist`.
- [x] Create and auto-confirm Mark’s Supabase Auth user with a strong temporary password.
- [x] Verify the trigger creates an active `lemhi_admin` profile with `msp_id = null`.
- [ ] Sign in as Mark and verify `/admin`, every cohort, every MSP, and admin library access.
- [x] Disable demo sign-in and the demo-role toggle unconditionally in production code.
- [ ] Redeploy and verify password-free demo entry and the demo-role toggle are unavailable.
- [ ] Verify all four MSP passwords still work after demo mode is disabled.
- [ ] Verify all four MSP accounts are redirected away from `/admin`.

**Acceptance:** Mark reaches `/admin`; each MSP reaches only `/cohort`; no unauthenticated or password-free visitor can obtain demo-admin access.

### Phase 1 — Convert the demo cohort into the launch cohort — RELEASE BLOCKER

- [ ] Confirm the official cohort name.
- [ ] Confirm start date, time zone, weekly weekday, and weekly start time.
- [ ] Confirm the four session titles and dates.
- [ ] Update cohort data and regenerate/correct sessions without changing the MSP IDs.
- [x] Replace every placeholder `https://meet.google.com` URL with `NULL` until the real URL exists.
- [x] Change both empty-link UI locations to **“Link coming this week”**.
- [ ] Confirm the current-week calculation against the real start date.
- [ ] Remove `status_override = active` unless Mark explicitly needs the override.
- [ ] Confirm the final 30-task roadmap text. Resolve the PRD’s 27-versus-30 source inconsistency.
- [ ] Clear demo completions and notes or move the four MSPs to a newly created clean cohort.

**Acceptance:** every MSP sees the same accurate four-week schedule and roadmap; no placeholder meeting URL or fake progress appears.

### Phase 2 — Complete MSP and lead information — RELEASE BLOCKER

- [ ] Confirm each MSP’s real website.
- [ ] Obtain and upload each MSP logo, or explicitly accept initials for launch.
- [ ] Set Mark as the cohort lead.
- [ ] Add Mark’s title, contact email, and optional photo to his profile.
- [ ] Review peer cards from every MSP account.
- [ ] Remove the temporary demo viewer profiles from Northstar while retaining the real `northstar@lemhi.com` owner.

**Acceptance:** each MSP portal identifies the correct MSP, correct Lemhi lead, and the correct three peer companies without exposing user/contact records.

### Phase 3 — Finalize the starter library — RELEASE BLOCKER

- [x] Upload all 19 real starter assets.
- [x] Remove all nine demo library entries.
- [x] Add titles, categories, and summaries.
- [ ] Mark reviews titles and categories for business accuracy.
- [ ] Open every asset from one MSP account.
- [ ] Spot-check every file from a second MSP account.
- [ ] Confirm a PDF previews inline and downloads.
- [ ] Confirm ZIP, DOCX, PPTX, and other unsupported preview types download cleanly.
- [ ] Confirm an MSP-scoped test file is invisible to the other three MSPs, then delete the test file.
- [ ] Correct the placeholder Microsoft developer metadata in the Conversation Coach package before external Microsoft distribution.

**Acceptance:** all 19 assets are reachable by intended users, no broken or demo resources remain, and private scope is proven.

### Phase 4 — Make Mark’s workflow operational — MVP CORE

- [ ] Mark edits a session and adds/removes its Join URL from the UI.
- [ ] Mark opens each MSP dashboard and can understand overall progress and weekly status.
- [ ] Mark completes and reopens one Lemhi-owned task.
- [ ] An MSP completes and reopens one MSP-owned task.
- [ ] Mark and an MSP exchange one note on the same task.
- [ ] Mark uploads one cohort-scoped document and all four MSPs see it.
- [ ] Mark uploads one MSP-scoped document and only that MSP sees it.
- [ ] Mark uploads one representative video and confirms browser playback.
- [ ] Write a one-page Mark operator guide with: sign in, update a session link, check progress, add a note, upload a file, and replace a recording.

**Acceptance:** Mark can run the cohort’s normal weekly work without a developer or direct database access.

### Phase 5 — Automated release verification — RELEASE BLOCKER

- [x] Start Docker Desktop.
- [x] Run `npm run supabase:start`.
- [x] Run `npm run supabase:reset`.
- [x] Run `npm run test:db`; all 31 pgTAP assertions passed on 2026-09-27.
- [x] Run `npm run lint`.
- [x] Run `npm run typecheck`.
- [x] Run `npm run build`.
- [x] Add password-account browser smoke tests without committing credentials.
- [x] Run production smoke tests using environment-provided test credentials.
- [x] Confirm each MSP’s heading/name and denial from `/admin`.
- [ ] Confirm signed-out visitors are redirected to `/sign-in`.
- [ ] Confirm asset signed URLs expire and foreign storage paths are denied.

**Acceptance:** all automated checks are green, and the production acceptance sheet records the tester, date, account, and result.

### Phase 6 — Deployment and handoff — RELEASE BLOCKER

- [ ] Confirm production Vercel points to GitHub `main`.
- [ ] Confirm `APP_URL` matches the public production origin.
- [ ] Confirm Supabase Auth allows the production origin and `/auth/confirm` callback.
- [ ] Confirm production Storage file-size limits support the expected recording size.
- [ ] Confirm the Supabase project will not pause and has adequate storage/bandwidth.
- [ ] Decide whether the Vercel URL is acceptable for launch or configure `cohorts.lemhi.ai`.
- [ ] Store Mark’s and MSP temporary credentials in an approved password manager.
- [ ] Send credentials separately to each MSP; never send all four in one message.
- [ ] Ask each MSP to sign in while a Lemhi owner is available to help.
- [ ] Record sign-in success and rotate any password sent through an insecure channel.
- [ ] Tag the launch commit in Git.

**Acceptance:** Mark and all four MSPs have independently confirmed access to production.

## 9. First-session and recording plan

The minimum launch does not require final meeting links today. Sessions should contain accurate titles and times, with `join_url = NULL`. The portal must say **“Link coming this week”** until Mark pastes the real Teams URL in Admin → Cohort → Session.

Before the first live session:

- [ ] Mark adds the correct Teams link.
- [ ] One MSP confirms the Join button opens the correct meeting.
- [ ] Supabase Storage maximum file size is above the expected recording size.
- [ ] A representative large video upload is tested through the resumable uploader.
- [ ] Playback is tested in the same browser families MSPs will use.

After each group session, the temporary MVP process is:

1. Download recording and transcript from Teams/Avoma.
2. Open Admin → Library.
3. Upload video as category `recording`, scope `cohort`, and attach it to the relevant week if desired.
4. Upload transcript as category `transcript`, scope `cohort`.
5. Upload or paste the summary/action items using the current asset metadata process.
6. Sign in as one MSP and confirm playback/download.

The later M2 improvement is one “Upload session package” screen that accepts video, transcript, and summary together and sets scope/session automatically.

## 10. Manual account provisioning runbook

Use this only until an admin credential-management UI exists.

### MSP owner

1. Create the MSP record and note its UUID.
2. Create a pending `invitations` row with:
   - intended email
   - role `msp_owner`
   - intended `msp_id`
   - a valid Lemhi admin as `invited_by`
3. In Supabase Auth, create the user with that same email, a generated strong password, and **Auto Confirm User** enabled.
4. The database trigger should create the profile from the pending invitation.
5. Verify:
   - role is `msp_owner`
   - `msp_id` is the intended MSP
   - profile is active
   - email is not in `admin_allowlist`
6. Sign in through the application and confirm the correct MSP name.
7. Store the password outside Git and transmit it separately.

Never create an MSP auth user before its invitation row. The database trigger rejects uninvited identities by design.

### Lemhi admin

1. Confirm the address ends in `@lemhi.com`.
2. Generate a strong temporary password in a password manager.
3. Run `scripts/bootstrap-admin.mjs` with production environment variables and `ADMIN_TEMP_PASSWORD` set only in the command environment.
4. The script inserts or activates the email in `admin_allowlist`, creates and confirms the Auth user, and verifies the resulting profile.
5. Verify the profile role is `lemhi_admin` and `msp_id` is `NULL`.
6. Verify `/admin` access.

Never add an MSP login email to `admin_allowlist`.

### Password reset during the temporary phase

Until SMTP is configured, reset the password from Supabase Auth as an authorized Lemhi operator, store the new value securely, and transmit it directly. Do not place passwords in task notes, GitHub issues, Slack channels with broad membership, or this repository.

## 11. Developer runbook

### Local setup

```bash
npm install
npm run supabase:start
npm run supabase:reset
npm run dev
```

Required local variables are documented in `.env.example`. Never commit `.env.local` or `.env.production.local`.

### Verification

```bash
npm run lint
npm run typecheck
npm run test:db
npm run test:e2e
npm run build
git diff --check
```

### Database changes

1. Add a new append-only SQL file under `supabase/migrations/`.
2. Reset the local database.
3. Run database tests.
4. Regenerate TypeScript types when the schema changes:

```bash
npm run db:types
```

5. Review the generated diff.
6. Apply the migration to preview, verify it, then apply to production.

### Deployment

1. Commit verified work to `main`.
2. Push to GitHub.
3. Wait for the Vercel production deployment.
4. Open `/sign-in` and confirm the expected build is live.
5. Run the production smoke test.
6. If a deployment fails, inspect Vercel logs before making another change.

## 12. Production environment variables

| Variable | Browser-visible? | Purpose |
|---|---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Production Supabase URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Browser-safe Supabase key |
| `SUPABASE_SECRET_KEY` | No | Narrow server-only admin operations |
| `APP_URL` | No | Canonical application origin and auth callback base |
| `DEMO_LOGIN_ENABLED` | No | Must be `false` before MSP credential distribution |

Preview and production must use separate Supabase projects before customer data or recordings are added to preview environments.

## 13. Information still needed from Felipe or Mark

- [ ] Mark’s exact work email and full display name.
- [ ] Official cohort name.
- [ ] Official cohort start date.
- [ ] Time zone, session weekday, and session time.
- [ ] Final Teams links when available; until then use no URL.
- [ ] Correct websites for all four MSPs.
- [ ] Logos for all four MSPs, or approval to launch with initials.
- [ ] Mark’s title, preferred contact email, and optional photo.
- [ ] Final confirmation of all 30 tasks and their week assignments.
- [ ] Decision: clear demo progress/notes in place or create a new clean cohort.
- [ ] Decision: use the Vercel URL or configure a Lemhi subdomain.
- [ ] Confirmation that storing client recordings in this standalone Supabase project is approved.

## 14. Deferred until after the minimum launch

These should not delay the separate-account MVP unless Mark identifies one as immediately necessary:

- Custom SMTP and automated invitations
- Password self-service/reset emails
- Additional MSP teammates
- Advanced dashboard analysis and stuck-task ranking
- Guided recording/transcript/summary upload
- Per-MSP task hiding and extra-task controls
- Program editor
- Admin asset edit/delete controls
- MSP credential reset UI
- Avoma ingestion automation
- Reminder and recap emails
- Single sign-on with the Lemhi platform
- Bulk ZIP download

## 15. Stop/resume protocol

If work stops unexpectedly:

1. Run `git status --short` and do not discard unknown changes.
2. Read this file and `docs/PRD.md` in full.
3. Check the production portal before assuming the last change deployed.
4. Start with the first unchecked item in **Phase 0**. Do not skip a release blocker.
5. Run the acceptance criteria for the completed phase.
6. Update the checkboxes and the “Last updated” date.
7. Commit the documentation update with the corresponding implementation.

The safest MVP sequence is:

```text
Real Mark admin
  → disable demo access
  → correct cohort/session data
  → correct MSP/lead data
  → verify 19 assets
  → test Mark’s weekly workflow
  → run RLS and browser tests
  → distribute credentials separately
```
