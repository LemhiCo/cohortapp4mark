# Client account setup testing

## Production test mode

Run:

```sh
npm run test:prod:setup
```

The command is deliberately guarded. It runs only against `https://orientation.lemhi.ai`, requires the explicit `RUN_PRODUCTION_SMOKE=1` switch embedded in the command, and aborts unless the exact production cohort named `Cohort test 2` exists.

The test creates temporary MSP records prefixed with `[E2E]` only inside `Cohort test 2`. It uses Mark's existing admin identity through a non-emailed one-time test session and does not change his password. The temporary MSP user, invitations and MSP records are removed in a `finally` cleanup block whether the test passes or fails.

## What the test proves

1. An admin can create an MSP portal inside `Cohort test 2`.
2. The admin can generate a link on the canonical `orientation.lemhi.ai` domain.
3. The invitation record expires approximately 72 hours after generation.
4. Opening and reloading the setup page does not consume the link.
5. Continuing once and closing the browser before choosing a password does not consume the original link.
6. The same original link works in a separate fresh browser.
7. The MSP can create a password and reaches its own Cohort page.
8. The MSP can later sign in using that email and password.
9. The MSP cannot open the admin portal.
10. Database row-level security lets the MSP read its own MSP record but not another MSP or that MSP's invitations.
11. The setup link stops working after password setup completes.

This smoke test intentionally does not send an email. It validates the manual 72-hour setup-link path independently of SMTP delivery and spam filtering.

## Root causes of the earlier failures

There were multiple contributing problems:

1. Legacy/default Supabase invite and recovery emails used a one-time confirmation URL. Corporate email security systems can pre-open those URLs. A scanner or interrupted first visit could consume the one-time token before the person completed setup, so their later click appeared invalid or expired.
2. The old callback automatically exchanged a one-time code as soon as the page loaded. A repeated initialization, reload or interrupted redirect could leave the next attempt with an already-used code.
3. Production's `APP_URL` still contained `https://cohortapp4mark.vercel.app`. The app could create a session on `orientation.lemhi.ai` and then redirect to the old Vercel domain. Browser session cookies do not cross domains, so the user appeared logged out and entered the invalid-link loop.
4. SMTP deliverability was a separate issue: some earlier messages were delayed, filtered as spam or not received. A correct authentication flow cannot make an undelivered email arrive.

## Current design

- The manual setup link is valid for 72 hours.
- Its signed credential is placed after `#` in the URL, so browsers do not send it during an ordinary page GET and email scanners cannot consume it by previewing the page.
- A deliberate **Continue securely** action creates the short-lived Supabase handoff.
- The original Lemhi link remains reusable until password creation finishes.
- Creating a newer copied link invalidates the older copied link.
- Authentication redirects stay on the verified request domain, preserving the secure session cookie.
- The existing automated Supabase email remains a separate 24-hour path; Mark should use the copyable 72-hour link when he wants to send access manually.
