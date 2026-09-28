# Lemhi Cohort Portal — MVP Completion Plan

**Last updated:** 2026-09-27  
**Production portal:** <https://cohortapp4mark.vercel.app>  
**Source repository:** <https://github.com/LemhiCo/cohortapp4mark>  
**Product requirements:** [`docs/PRD.md`](./PRD.md)  
**Current application commit:** `3aa2990`  
**Latest production database change:** `20260928000000_launch_cohort_from_scratch.sql`, applied and verified 2026-09-27

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

**Do not distribute the MSP credentials until each MSP login has been rechecked in production.**

The password-free demo walkthrough is gone from the code (`e16dc4e`), and production has refused new demo sign-ins since `582d2a1`. The launch migration ran in production on 2026-09-27. It deleted all 11 demo identities, including the `demo-admin@lemhi.com` admin profile, which also revoked any walkthrough sessions still open in teammates’ browsers.

Before sending the portal link to an MSP:

- [x] Create and verify Mark’s real admin account.
- [x] Remove demo access from the code and redeploy production.
- [x] Confirm that leaving the password blank no longer opens the demo.
- [x] Apply the launch migration in production and run its verification query.
- [ ] Confirm that each MSP password opens only the intended MSP portal.

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

Items marked *(migration)* were fixed by `20260928000000_launch_cohort_from_scratch.sql`, applied and verified in production on 2026-09-27.

- [x] Cohort is now named `Cohort 1`. *(migration)*
- [x] Cohort start date is now Mon `2026-09-28`, confirmed by Felipe. *(migration)*
- [ ] Time zone is `America/New_York`; not yet confirmed with Mark. Kept as-is.
- [ ] Weekly session time is Monday at 11:00 AM Eastern; not yet confirmed with Mark. Kept as-is; Mark can change any session in Admin → Cohort.
- [x] All four fake `https://meet.google.com` URLs were cleared; session URLs are now `NULL` until Mark adds Teams links.
- [x] The `https://example.com` MSP websites are cleared; Mark fills in the real ones from each MSP’s settings. *(migration)*
- [ ] MSP logos are not uploaded. Decision: Mark uploads them; initials show until then.
- [x] The cohort lead is now Mark Creighton, Head of Success. *(migration)*
- [x] All 11 demo identities are deleted and their sessions revoked. *(migration)*
- [x] Demo progress, task notes, and completion history are cleared in place; MSP IDs and logins kept. *(migration)*

### Not yet implemented or launch-ready

- [x] Mark’s real admin account created as `mark.creighton@lemhi.com`.
- [x] Password-free demo walkthrough removed from the application code and the sign-up trigger.
- [ ] Launch-ready cohort name, dates, schedule, websites, logos, and lead profile. *(migration covers name, dates, lead; websites and logos are for Mark)*
- [x] The exact “Link coming this week” empty-session treatment is implemented in both session locations.
- [x] Production browser smoke test passed for all four MSP logins on desktop and mobile (before demo removal; recheck after the migration).
- [x] Full local RLS suite rerun: 31/31 on 2026-09-27 with the launch migration applied.
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
| Separate MSP sign-in | Implemented; demo access removed | Apply launch migration, then browser-test all four accounts |
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
| Mark admin access | Real allow-listed password account created | Verify `/admin` in a production browser |
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
- [x] Sign in as Mark and verify `/admin`. Production, 2026-09-27 (Felipe): lands on `/admin`, and “What needs attention” lists all four MSPs.
- [ ] As Mark, open each MSP page and the admin library.
- [x] Disable demo sign-in and the demo-role toggle unconditionally in production code.
- [x] Redeploy and verify password-free demo entry and the demo-role toggle are unavailable. Verified on production 2026-09-27: `582d2a1` deployed; a blank password shows the magic-link message and creates no session. Demo code removed in `e16dc4e`.
- [x] Apply the launch migration so the leftover demo identities and their sessions are deleted. Production: 0 demo users remain.
- [ ] Verify all four MSP passwords still work after demo mode is disabled. *(Needs the MSP passwords.)*
- [ ] Verify all four MSP accounts are redirected away from `/admin`. *(Needs the MSP passwords. Passed locally with a test MSP owner on desktop and mobile.)*

**Acceptance:** Mark reaches `/admin`; each MSP reaches only `/cohort`; no unauthenticated or password-free visitor can obtain demo-admin access.

### Phase 1 — Convert the demo cohort into the launch cohort — RELEASE BLOCKER

- [x] Confirm the official cohort name: `Cohort 1` (Felipe, 2026-09-27).
- [x] Confirm the start date: Monday `2026-09-28` (Felipe, 2026-09-27).
- [ ] Confirm time zone and weekly start time with Mark. Until then: Mondays, 11:00 AM `America/New_York`.
- [ ] Confirm the four session titles and dates. Dates follow from the start date: Sep 28, Oct 5, Oct 12, Oct 19.
- [ ] Update cohort data and regenerate/correct sessions without changing the MSP IDs. Cohort data verified in production; the session dates are still to be checked.
- [x] Replace every placeholder `https://meet.google.com` URL with `NULL` until the real URL exists.
- [x] Change both empty-link UI locations to **“Link coming this week”**.
- [ ] Confirm the current-week calculation against the real start date. In the rehearsal, Week 1 begins 2026-09-28. Known issue: `cohort_current_week()` uses the database date in UTC, so the week turns over at 8 PM Eastern the evening before.
- [x] Remove `status_override = active`. Production: now `NULL`.
- [ ] Confirm the final 30-task roadmap text. Resolve the PRD’s 27-versus-30 source inconsistency.
- [x] Clear demo completions and notes, in place, no new cohort. Production: 0 completions, 0 notes.

**Applying the launch migration in production.** Paste the whole of `supabase/migrations/20260928000000_launch_cohort_from_scratch.sql` into the Supabase SQL editor for the production project and run it once. It raises an error rather than half-applying if Mark’s admin profile is missing. It only converts the cohort while it is still named `Fall 2026 Demo Cohort`, so replaying it later is harmless. Then run this check:

```sql
select c.name, c.start_date, c.status_override, p.email as lead, p.title,
  (select count(*) from public.task_completions) as completions,
  (select count(*) from public.task_notes) as notes,
  (select count(*) from auth.users where email like 'demo-%') as demo_users,
  (select count(*) from public.msps where website is not null) as websites,
  (select count(*) from public.assets where status = 'ready') as ready_assets
from public.cohorts c left join public.profiles p on p.id = c.lead_id;
```

Expected: `Cohort 1`, `2026-09-28`, no override, `mark.creighton@lemhi.com`, `Head of Success`, then `0, 0, 0, 0, 19`.

Applied in production on 2026-09-27. The first run changed nothing: the SQL editor runs the script as one transaction and rolled it back, and the cause wasn’t captured. The second run succeeded and matched every expected value. Follow-up check for the sessions, remaining accounts, and sign-up trigger:

```sql
select
  (select string_agg(to_char(starts_at at time zone 'America/New_York', 'Mon DD HH12:MI AM') || coalesce(' ' || join_url, ''), ' | ' order by week_number)
     from public.sessions where kind = 'group') as sessions_eastern,
  (select string_agg(role || '=' || n, ', ' order by role)
     from (select role::text as role, count(*) as n from public.profiles group by role) r) as profiles_by_role,
  (select prosrc like '%demo-%' from pg_proc where proname = 'handle_new_auth_user') as trigger_has_demo,
  (select count(*) from pg_proc where proname like 'seed_demo_%') as seed_functions_left;
```

Expected: `Sep 28 11:00 AM | Oct 05 11:00 AM | Oct 12 11:00 AM | Oct 19 11:00 AM`; one `lemhi_admin` per real Lemhi admin and `msp_owner=4`; `false`; `0`.

**Acceptance:** every MSP sees the same accurate four-week schedule and roadmap; no placeholder meeting URL or fake progress appears.

### Phase 2 — Complete MSP and lead information — RELEASE BLOCKER

- [ ] Confirm each MSP’s real website. Decision: launch with no website; Mark adds each one in Admin → MSP → Settings.
- [ ] Obtain and upload each MSP logo, or explicitly accept initials for launch. Decision: initials at launch; Mark uploads logos.
- [x] Set Mark as the cohort lead. Production: lead is `mark.creighton@lemhi.com`.
- [x] Add Mark’s title and contact email to his profile: Head of Success, `mark.creighton@lemhi.com`. No photo for now.
- [ ] Review peer cards from every MSP account.
- [ ] Remove the temporary demo viewer profiles from Northstar while retaining the real `northstar@lemhi.com` owner. *(In the migration; the rehearsal kept the owner and deleted all demo users.)*

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
- [x] Write a one-page Mark operator guide with: sign in, update a session link, check progress, add a note, upload a file, and replace a recording. See [`docs/OPERATOR-GUIDE.md`](./OPERATOR-GUIDE.md). Replacing a recording currently needs Felipe, because the admin cannot delete or edit a file yet.
- [ ] Fix upload retries. After a failed upload, uploading the same file again resumes the old attempt into the old storage path, and the new library entry is marked ready with no file behind it.

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
- [x] Confirm signed-out visitors are redirected to `/sign-in`. Production, 2026-09-27: `/cohort`, `/checklist`, `/library`, `/team`, `/admin`, `/admin/library`, and `/admin/msps/…` all return 307 to `/sign-in`; `/api/assets/…` returns 401.
- [x] Browser suite 16/16 (desktop and mobile) against a local production build with local-only test accounts, 2026-09-27.
- [x] Confirm asset signed URLs expire and foreign storage paths are denied. Automated in `tests/e2e/file-access.spec.ts`, passing locally on 2026-09-27. An MSP opens its own private file. It cannot list, sign or download another MSP’s file. A signed URL fails after it expires. `/api/assets/<id>` returns 404 for a foreign file. The test creates its own data, so it only runs against a local stack.

**Acceptance:** all automated checks are green, and the production acceptance sheet records the tester, date, account, and result.

### Phase 6 — Deployment and handoff — RELEASE BLOCKER

- [x] Confirm production Vercel points to GitHub `main`. Verified 2026-09-27: each of the last 12 production deployments is a commit on `main`, which is the default branch.
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

**Local file uploads fail with Supabase CLI 2.117.0.** Its Storage service writes with `ON CONFLICT (bucket_id, name COLLATE "C")`, but no local index matches, so every upload returns `database error, code: 42P10`. Production is unaffected. Until the CLI is updated, run this after each `supabase start` or `supabase db reset`:

```bash
docker exec -i supabase_db_cohortapp4mark psql -U supabase_admin -d postgres -c 'create unique index if not exists local_objects_current_version_c on storage.objects (bucket_id, name collate "C") where archived_at is null;'
```

Browser tests are most reliable against a production build (`npm run build`, `npx next start -p 3000`, then `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npx playwright test`). The dev server blocks its reload socket for `127.0.0.1` and may reload the page mid-test.

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

**Production migration history is incomplete.** Production migrations have been applied by pasting them into the SQL editor, so Supabase’s migration history does not record them. Before ever running `supabase db push` against production, record the ones already applied with `supabase migration repair --status applied <version>`. Otherwise the CLI replays them, and the early demo migrations would overwrite the launch cohort.

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

`DEMO_LOGIN_ENABLED` is no longer read by the application and can be deleted from Vercel.

Preview and production must use separate Supabase projects before customer data or recordings are added to preview environments.

## 13. Information still needed from Felipe or Mark

- [x] Mark’s exact work email and full display name: Mark Creighton, `mark.creighton@lemhi.com`.
- [x] Official cohort name: `Cohort 1`.
- [x] Official cohort start date: Monday 2026-09-28.
- [ ] Time zone, session weekday, and session time. Using Mondays 11:00 AM Eastern until Mark confirms.
- [ ] Final Teams links when available; until then use no URL.
- [x] Websites for all four MSPs: launch empty; Mark fills them in.
- [x] Logos for all four MSPs: launch with initials; Mark uploads them.
- [x] Mark’s title and contact email: Head of Success, `mark.creighton@lemhi.com`. No photo for now.
- [ ] Final confirmation of all 30 tasks and their week assignments.
- [x] Decision: clear demo progress/notes in place (Felipe, 2026-09-27).
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

## 16. Verification log

| Date | Tester | Environment | Check | Result |
|---|---|---|---|---|
| 2026-09-27 | Claude | Production | Vercel production deployment of `582d2a1` | Pass: latest production deployment, status success |
| 2026-09-27 | Claude | Production | Blank password with `demo-check-20260927@lemhi.com` | Pass: magic-link message, no session, `/admin` still redirects to `/sign-in` |
| 2026-09-27 | Claude | Production | Signed-out access to 7 protected routes and `/api/assets/…` | Pass: 307 to `/sign-in`; API 401 |
| 2026-09-27 | Claude | Local rehearsal | Launch migration on a production-shaped database | Pass: cohort converted, demo data and users removed, owner and assets kept, demo emails rejected, replay after launch keeps real data |
| 2026-09-27 | Claude | Local | `npm run test:db` | Pass: 31/31 |
| 2026-09-27 | Claude | Local production build | `npx playwright test` with local-only admin and MSP accounts | Pass: 16/16, desktop and mobile |
| 2026-09-27 | Felipe | Production | Mark signs in, reaches `/admin`, sees “What needs attention” | Pass: all four MSPs listed |
| 2026-09-27 | Felipe | Production | Launch migration, first run | No effect: rolled back, cause not captured |
| 2026-09-27 | Felipe | Production | Launch migration, second run, plus verification query | Pass: `Cohort 1`, `2026-09-28`, no override, Mark as lead (Head of Success), `0, 0, 0, 0, 19` |
| 2026-09-27 | Claude | Production | Admin “Upcoming sessions” showed UTC times (3:00 PM for 11:00 AM ET) | Fixed in `3aa2990` and deployed |
| 2026-09-27 | Claude | Production | Every recent production deployment is a commit on `main` | Pass: last 12 deployments |
| 2026-09-27 | Claude | Local production build | `tests/e2e/file-access.spec.ts`: own file opens, foreign file denied, signed URL expires, route 404s foreign file | Pass: 4/4 |
| — | Felipe | Production | Follow-up check: session dates, accounts by role, trigger | Pending |
| — | Felipe | Production | One MSP signs in and is redirected away from `/admin` | Pending |
