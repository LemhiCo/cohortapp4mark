# Lemhi Cohort Portal: PRD (MVP)

| | |
|---|---|
| Owner / builder | Felipe Reyes |
| Requester and primary user | Mark Creighton (Head of Success) |
| Sponsor | Ben Botti (COO) |
| Other admins | Tim Hickle (marketing assets), Ben and John (progress) |
| Status | Draft v1, 2026-09-24, from Mark's questionnaire answers |
| Stack | Next.js (App Router) + Supabase (Postgres, Auth, Storage) + Vercel. Code on GitHub. |
| Replaces | Mark's Lovable prototype (admin side + client portal) |

---

## 1. Problem

Cohorts are becoming Lemhi's standard onboarding for new customers. Mark runs them with a Lovable prototype plus Teams, email and one-off share links. The biggest time sink is sharing recordings and transcripts: Teams recordings can't be shared externally, so after every session someone downloads the recording and transcript, uploads them somewhere, and sends a new link. MSPs end up juggling many links and keep asking where the recording is.

With 4–6 cohorts of 6–10 MSPs running at the same time, this doesn't scale.

## 2. Goals and success metrics

Goals:
1. One place per MSP for the program: schedule, the 4-week checklist, the starter kit, and every recording from their sessions.
2. Mark can run several cohorts at once and see who is behind without chasing spreadsheets or links.
3. Recordings go up the same day with almost no manual work, and each MSP only sees what it should.

We'll know it worked after the first cohort when (Mark's answers):
- No more one-off share links. Every recording and document is in the portal.
- MSPs finish the checklist on time (all 4 weeks done by the cohort end date).
- Fewer "where's the recording?" messages.
- MSPs open the portal every week.

Instrument these from day one: weekly active MSPs, % of tasks done by the end of each week, and upload time after each session.

Non-goals for the MVP:
- Messaging or Q&A in the portal. Questions stay in Teams and email.
- MSPs uploading anything to Lemhi. MSPs only receive.
- Assigning tasks to named people at the MSP. The role label is enough.
- Scheduling polls (later).
- Building this into the Lemhi platform. It is a standalone prototype, outside SOC 2 scope for now.

## 3. Users and roles

| Role | Who | Can do |
|---|---|---|
| Lemhi admin | Mark, Tim, Ben, John (and future cohort leads) | Everything, across every cohort. No per-lead restrictions. |
| MSP main contact | One person per MSP, added by Lemhi | Everything an MSP member can do, plus invite and remove teammates from their own MSP. |
| MSP member | Invited by their main contact | See their cohort, checklist and library; check off MSP tasks; add notes. |

MSP team size varies a lot: 1 person at small MSPs, 10+ at large ones. There is no hard cap.

## 4. How a cohort works (business rules)

These are the rules the data model and UI must follow.

**Program.** There is one standard 4-week program, the same for every cohort. It has 4 weeks, each with a title, a subtitle and a goal (e.g. "Week 1 — Launch: Platform onboarding, tenant setup, internal alignment"). The checklist is final: 30 tasks (Week 1 has 7). See open question Q1 about the count.

**Tasks.** Each task has a title, a description, an owner label (e.g. "MSP IT admin", "vCIO / Practice Lead", "Lemhi platform (automated)"), an owner type (MSP or Lemhi), and a kind (task or Checkpoint). Assets can be attached to a task or week.

**Cohort.** A cohort is one run of the program. It has a name, a start date, a lead, a weekly session time, and 6–10 MSPs.
- Everyone in a cohort starts together. The current week is derived from the cohort start date, not tracked per MSP.
- 4–6 cohorts run at the same time.
- Cohorts are for all new Lemhi customers from now on. Design partners and white-glove (paid) customers are the exception.

**Sessions.** Each cohort has one group session per week on Teams, 4 in total. Creating a cohort generates the 4 sessions from the start date and time; the admin can edit any of them. 1:1 calls with an MSP happen as needed and aren't on the schedule.

**Progress and "behind".**
- A task is done when it's checked. Store who checked it and when.
- An MSP is behind when any task from a week before the current week is unchecked. Behind MSPs stay in the cohort and catch up; there's no moving between cohorts in the MVP.
- A Checkpoint is a status marker. It doesn't block the next week.
- MSPs check their own tasks. Only Lemhi can check Lemhi-owned tasks and Checkpoints.
- An MSP has finished the cohort when every task is done, including all Checkpoints and the first client assessment.

**Template changes.** Editing a task in the program updates it for every cohort, including running ones. Removing a task archives it: completion history stays, and it disappears from checklists and progress math.

**Per-MSP tweaks.** Mark sometimes changes the checklist for one MSP. The admin can hide a program task for one MSP or add an extra task for one MSP. Progress math uses that MSP's own list.

**Notes.** Each task has a note thread per MSP, visible to that MSP and Lemhi. There are no internal-only notes.

**Content visibility.** Every asset has exactly one scope:

| Scope | Who sees it | Examples |
|---|---|---|
| Program | Every MSP in every cohort | The 19 starter files (welcome kit) |
| Cohort | Every MSP in that cohort | Group session recordings, transcripts, summaries |
| MSP | Only that MSP | 1:1 call recordings, Tim's custom marketing assets, one-off docs |

Asset categories: Recordings, Transcripts, Documentation, Marketing assets, Links.

**Recordings.** Each session (group or 1:1) gets a video recording, a transcript, and a summary with action items. They should be in the portal the same day. MSPs have agreed to recording and storage in their agreement.

**Peers.** MSPs can see the other companies in their cohort: company name, website and logo only. No contact details.

**After the cohort.** MSPs move to ongoing check-ins with their Lemhi lead. They keep read-only access to their portal and all recordings with no expiry. Read-only means they can view and download but can't check tasks or add notes (see open question Q5).

## 5. Scope and milestones

Dates: MVP link goes to MSPs on **Mon Sep 28**. The first cohort's first session is **Mon Oct 5** (MSPs: Alpha IT, WCA, one TBD).

### M1: MSP launch (Mon Sep 28)
Mark's day-one must-haves: sign-in, cohort page, checklist, starter documents.

MSP side:
- Sign-in with an emailed link (no passwords).
- Main contact can invite and remove teammates.
- **Cohort page:** cohort name and dates, current week, session schedule with Join links, Lemhi lead card (name, title, photo, email), companies in the cohort (name, website, logo).
- **Checklist:** overall and per-week progress, the current week highlighted and expanded, check off MSP tasks, Lemhi tasks shown with their status (read-only for the MSP), note thread per task, attached assets shown on their task or week.
- **Library:** starter documents with search, category filters, PDF preview, download. Badge for "Your team only" vs "Shared".

Admin side (minimum Mark needs to run the first cohort):
- Sign-in for @lemhi.com admins.
- Create a cohort (name, start date, session day and time, lead). This auto-generates 4 sessions; edit a session's title, time and Join link.
- Create an MSP portal (name, website, logo, cohort) and invite its main contact.
- Per-MSP view: checklist (check Lemhi tasks and Checkpoints, read and reply to notes), users, library.
- Upload an asset with a scope (program, cohort or MSP) and optional week or task.
- Program content seeded: 4 weeks, 30 tasks, 19 starter files.
- Migration of the real data in the Lovable app.

Fallback if M1 slips: seed the first cohort, its MSPs and main contacts with a script, and ship the admin UI for creating cohorts and portals in M2. The MSP side is not negotiable for Monday.

### M2: First session (Mon Oct 5)
- **Recording upload flow:** pick a session (or "1:1 with <MSP>"), then drop the video, transcript and summary. Scope is set automatically (group → cohort, 1:1 → that MSP). Target: under 2 minutes of Mark's time per session. Videos upload straight from the browser to storage and play in the portal.
- **Admin dashboard** (Mark's picks, in priority order):
  1. MSPs behind schedule
  2. Users who haven't signed in (invited, never signed in), plus MSPs with no activity in 7 days
  3. Stuck tasks: tasks from past weeks, ranked by how many MSPs haven't done them
  4. Upcoming sessions across cohorts
  5. Progress across all cohorts at once (a card per cohort: week X of 4, % done, number behind)
- Per-MSP checklist tweaks (hide or add a task).
- Program editor: edit weeks and tasks; changes reach running cohorts.
- Activity tracking (last seen per user and MSP).
- "View as MSP" preview for admins.

### M3: Later
- Recordings ingested from Avoma automatically (e.g. via n8n). Meeting titles include the **cohort name**, not the MSP name, so group sessions can be matched to a cohort automatically. 1:1s still need a manual pick.
- Weekly recap and reminder emails. Mark sends these by hand today.
- Scheduling poll for session times (Mark: nice to have later).
- A link from the Lemhi platform so clients have one entry point; SSO after that.
- Bulk download as a zip.

## 6. Screens

MSP portal (top nav: Cohort · Checklist · Library · Team, the last for main contacts):
- **Cohort (home).** A "This week" block at the top: current week and goal, next session with Join, what's open this week. Below it, the schedule, lead, and peer companies.
- **Checklist.** Weeks as sections, current week open, past weeks collapsed with a warning if anything is still open. Each task shows title, description, owner label, done-by and date, the note thread, and attached assets.
- **Library.** Search; filters: All, Recordings, Transcripts, Documentation, Marketing assets, Links. Recordings open a player page with the video, transcript and summary on one screen.
- **Team.** Members list, invite by email, remove.

Admin (@lemhi.com only):
- **Dashboard.** See M2.
- **Cohorts.** List and detail: sessions (with an upload button per session), MSPs with W1–W4 progress, peer view preview.
- **MSP detail.** Tabs: Checklist, Library, Users, Settings (name, website, logo, cohort, deactivate).
- **Program.** Weeks and tasks editor; starter library.
- **Library.** Every asset, filterable by scope, cohort, MSP and category.
- **Admins.** Lemhi team members.

Visual design: keep the Lovable look, which already matches the Lemhi brand. EB Garamond Bold for headings, DM Sans for everything else. Parchment `#F7F2E8`, Forest Ink `#12130F`, Evergreen `#295A42` (primary), Dark Evergreen `#0F2418`. Orange `#C4682D` only for small section eyebrows. Must work on phones.

## 7. Data model (proposed, to be finalized in plan mode)

- `profiles`: user id (auth), name, email, role (`lemhi_admin` | `msp_owner` | `msp_member`), msp_id (null for admins), title and photo (for leads), last_seen_at
- `programs`: one row today
- `program_weeks`: program_id, number (1–4), title, subtitle, goal
- `tasks`: program_id, week_number, position, title, description, owner_label, owner_type (`msp` | `lemhi`), kind (`task` | `checkpoint`), msp_id (null = program task; set = extra task for one MSP), archived_at
- `msp_hidden_tasks`: msp_id, task_id
- `cohorts`: program_id, name, start_date, timezone, session_weekday, session_time, lead_id, status (`upcoming` | `active` | `ended`, derived from dates with an admin override)
- `sessions`: cohort_id (or msp_id for a 1:1), week_number (null for 1:1), title, starts_at (timestamptz), join_url, kind (`group` | `one_on_one`)
- `msps`: name, website, logo_path, cohort_id, status (`active` | `deactivated`)
- `task_completions`: msp_id, task_id, completed_by, completed_at, unique (msp_id, task_id)
- `task_notes`: msp_id, task_id, author_id, body, created_at
- `assets`: title, category, kind (`file` | `link`), storage_path or url, mime, size_bytes, scope (`program` | `cohort` | `msp`), cohort_id, msp_id, session_id, week_number, task_id, created_by, created_at
- `activity_events`: user_id, msp_id, type (sign_in, view, asset_open), created_at

### Access rules (Postgres row-level security; this is the core of the build)
- Lemhi admins read and write everything.
- MSP users read: program weeks and tasks; their own cohort and its sessions; their own MSP; peers in their cohort through a view or function that returns only name, website and logo.
- MSP users read assets where scope = program; scope = cohort and cohort_id = their cohort; or scope = msp and msp_id = their MSP.
- MSP users write `task_completions` only for their own MSP, only for tasks with owner_type = msp, and only while the cohort isn't ended.
- MSP users write `task_notes` only for their own MSP while the cohort isn't ended.
- MSP owners invite and remove users only within their own MSP.
- Storage buckets are private. Files are served through short-lived signed URLs, issued only after the same rules pass. Nothing is public.
- Automated tests prove that MSP A can't read MSP B's MSP-scoped assets, notes, completions or users, and can't read another cohort's assets. These are release blockers.

## 8. Technical requirements and constraints

- **Uploads.** Teams recordings run to hundreds of MB. Upload from the browser directly to Supabase Storage using resumable uploads. Don't route files through Vercel functions, which have a small request body limit (4.5 MB).
- **Supabase plan.** Use a paid plan: free projects pause after a period of inactivity and cap file size. Check current limits and pricing.
- **Email.** Supabase's built-in email is for testing only: heavily rate-limited, and it may only deliver to your own team. Set up custom SMTP (e.g. Resend or Postmark) with a Lemhi sending domain before inviting MSPs.
- **Storage growth.** Recordings are kept forever. Rough estimate: 5 cohorts × 4 sessions × ~0.5 GB, plus 1:1s, is about 10+ GB per month. Pick a plan with room, and consider compressing video later.
- **Time zones.** Store session times as timestamptz with the cohort's time zone. Show them in the viewer's local time with the zone label.
- **Domain.** Needs a subdomain (e.g. `cohorts.lemhi.ai`). Check with Alex.
- **Security.** Magic links only for MSPs. Admin role only for allow-listed @lemhi.com addresses. No secrets in the client; the service role key stays server-side.

## 9. Launch data (decision updated 2026-09-24)

This portal starts as a brand-new system. No Lovable database records, portals, users, progress, or notes will be migrated. Create the first cohort, MSP portals, and invitations directly in this app. The 19 final starter files still need to be supplied and uploaded once as program-scoped assets.

## 10. Open questions

| # | Question | Owner | Needed by |
|---|---|---|---|
| Q1 | Mark says Week 1 has 7 tasks and 30 total, but the other weeks showed 5 + 9 + 6 = 20, which makes 27. Where are the other 3? Resolve from the Lovable export. | Felipe | M1 |
| Q2 | Who is the third MSP in the first cohort? | Mark | M1 |
| Q3 | Resolved: do not migrate Lovable data; start fresh. | Felipe + Mark | M1 |
| Q4 | What is the weekly session day and time for the first cohort? Oct 5 is a Monday. | Mark | M1 |
| Q5 | After a cohort ends, can an MSP still check off tasks to catch up, or is it fully read-only? | Mark | M2 |
| Q6 | Do white-glove and design-partner customers use the portal (e.g. a cohort of one)? | Mark | M3 |
| Q7 | Who writes the summary and action items: Avoma notes pasted in, or Mark? | Mark | M2 |
| Q8 | Domain, Supabase project ownership and billing, and a sending domain for email. | Felipe + Alex | M1 |
| Q9 | Recordings contain client data. Confirm that storing them outside the platform is OK given SOC 2 and the customer agreement. | Ben + Alex | M2 |

## Appendix: Mark's answers (2026-09-24)

- First session Mon Oct 5, 2026. MSPs: Alpha IT, WCA, TBD. Contacts ready for all.
- Day one needs: sign-in, cohort page, checklist, starter documents. The 19 Lovable files are final. Some real data needs to move.
- Cohorts are standard onboarding for new customers, except design partners and white-glove (paid) customers.
- Everyone starts together. Behind MSPs stay and catch up. Checkpoints are status markers. Questions go through Teams and email.
- Finished = all Checkpoints passed + every task checked + first client assessment done. Afterward: ongoing check-ins with their lead.
- Mark's week: prep and run the session, upload recording, transcript and notes, follow up with MSPs who are behind, send reminders and recaps. The biggest time sink is sharing recordings and transcripts.
- Dashboard wants: behind schedule, not signed in, stuck tasks, upcoming sessions, all cohorts at once. All admins see everything.
- MSPs check their own tasks; Lemhi checks Lemhi tasks and Checkpoints. The checklist is final (7 in Week 1, 30 total). Fixes propagate to running cohorts. Sometimes customized per MSP. Notes are shared between MSP and Lemhi. No per-person assignment. MSPs never upload.
- 1:1s happen as needed. Group recordings go to the whole cohort. Share video, transcript, and summary with action items, the same day. Consent is in the agreement. Meeting titles include the cohort name. Scheduling poll later.
- 4–6 cohorts at once, 6–10 MSPs each, 1 to 10+ people per MSP, same program every time. Admins: Mark, Tim (marketing assets), Ben, John.
- Sign-in with an emailed link. Lemhi adds the main contact, who invites their team. Peers see name, website and logo. Read-only access after the cohort ends.
- Launch starts fresh; no Lovable portal, user, progress, or note data will be migrated.
- Success: no share links, checklist finished on time, fewer recording requests, weekly portal use.
