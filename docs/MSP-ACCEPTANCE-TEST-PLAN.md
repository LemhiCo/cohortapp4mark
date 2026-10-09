# MSP acceptance and trust test plan

This is the release gate for the experience seen by an MSP owner or teammate. A release is not considered client-ready when a critical test fails.

## Test principles

- Test the same public domain, browser screens, and permissions a client uses.
- Use generated accounts and workspaces only inside the exact production cohort named `Cohort test 2`.
- Never modify a real MSP, cohort, user, task, note, completion, or file.
- Clean every temporary user, invitation, activity event, note, completion, asset, and MSP after each run, even after a failure.
- Run the journey on desktop and mobile. Database row-level-security tests remain a separate mandatory release gate.

## Automated client journeys

### 1. Account onboarding — critical

- Admin creates an MSP without notifying the contact.
- The admin UI offers one setup method: a copyable 72-hour secure link.
- Replacing a setup link invalidates only the older link.
- Previewing, reloading, or opening the link once does not consume it.
- The same link works in a fresh browser until password creation succeeds.
- Password rules and confirmation are enforced.
- Setup lands the owner in the correct MSP portal, marks setup complete, and closes the link.
- A later email/password login works; a wrong password does not.

### 2. Roadmap and weekly orientation — critical

- The MSP sees its own company and cohort, all four roadmap stages, current progress, sessions, Join link state, and assigned Lemhi lead.
- The MSP sees peer company name and website, but never peer contacts or private MSP data.
- Direct navigation to admin pages returns the MSP to its own portal.

### 3. Checklist and collaboration — critical

- An MSP user can complete and reopen only an MSP-owned task.
- Progress updates after completion.
- Lemhi-owned tasks and checkpoints have no MSP completion control.
- An MSP user can post and read a task note for its own MSP.
- Another MSP cannot see or write those completions or notes.
- When the cohort is ended, completion and note controls disappear and database writes are rejected.

### 4. Library and recordings — critical

- The MSP sees program, its cohort, and its MSP-scoped resources.
- It cannot see another MSP's resource or another cohort's resource.
- Search and category filters return the expected items.
- File access uses the protected asset endpoint; an unauthorized MSP cannot obtain another MSP's signed file URL.
- Recording pages expose playback, summary, action items, transcript, and download when those items exist.

### 5. Team management — critical

- Only the MSP owner sees the Team navigation and setup-link controls.
- The owner can generate a separate 72-hour teammate link.
- The teammate link has the same preview/reload/fresh-browser guarantees as the owner link.
- The teammate lands in the same MSP with the `msp_member` role.
- The teammate can use roadmap, checklist, notes, and library, but cannot invite/remove users or access admin.
- The owner can remove the teammate; the removed account can no longer sign in.

### 6. Returning access and recovery — critical

- Sign out ends the session and protected pages return to sign-in.
- Forgot-password returns the same response for known and unknown emails.
- In the local mail environment, a real MSP account can finish the scanner-safe reset and use the new password.
- A deactivated MSP or user is denied access with a useful support message.

### 7. Device and usability coverage

- The complete production journey passes in desktop Chrome and a Pixel-sized mobile Chrome viewport.
- Primary controls have accessible names and can be located by label or role.
- Empty, loading, success, expired-link, replaced-link, read-only, and error states provide plain-language feedback.

## Commands

```sh
npm run lint
npm run typecheck
npm run test:db
npm run test:e2e -- tests/e2e/auth.smoke.spec.ts tests/e2e/copyable-setup-link.spec.ts tests/e2e/file-access.spec.ts
npm run test:prod:setup
```

The production command is guarded and refuses to run without `Cohort test 2`. SMTP inbox placement and large real-video playback remain manual launch checks because an automated test cannot prove delivery to each client's mail provider or model a multi-gigabyte recording economically.
