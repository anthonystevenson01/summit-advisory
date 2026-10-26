# Review: Built to Scale? Release 4, prospect report pages

Branch `anthonystevenson0/built-to-scale-4-reports`, cut from main after Release 3a. Design: `docs/designs/anthonystevenson0-built-to-scale-4-reports.md`. One review round.

## Round 1: APPROVE

Gates re-run by the Reviewer: `npm test` 273 pass, `npm run lint` 0 errors, `npx tsc --noEmit` clean, `npm run build` green with the report page, slide, expired route and OpenGraph image, the two public API routes, the four admin report pages and the two admin routes all listed, and `/tools/[tool]` still static. `scale-up-advisory.test.ts` byte-identical to main. `llm.ts`, `rubrics.ts`, `pipeline.ts`, the registry, `runs.ts` and `sitemap.ts` untouched. `package.json` gains only the `seed-report` script. No model call in any new file. No dashes in new source. The report model has no `node:` import so the image bundles on the edge; hashing lives in `report-access.ts` as the design's documented deviation.

### Acceptance criteria

All 10 PASS. The runbook entry is the Docs agent's deliverable.

### Constraints

All PASS. No new dependencies. Access codes hashed with scrypt and a per-report salt, compared in constant time, never logged or echoed; the cookie is signed under a new purpose, scoped to the report path, httpOnly, with a bounded Max-Age; attempts limited to 10 per IP per hour. Unlisted: noindex and nofollow on page, slide and the expired response, `/report/` disallowed in robots, not in the sitemap, as-of date, caveat and correction line present. `Scorecard` and `ScorecardWorking` reused with defaults that keep the 3a pages unchanged. Admin writes are plain form POSTs behind the session check. Inline BRAND styles. British spelling. The notification email runs after the response. Oswald appears in two admin headings to match the existing admin pages, flagged as a note.

### Test coverage

Slug rules, row merge and the edited flag, bands at every boundary, expiry at and past the limit, the hash reader for both Upstash shapes, state changes and the 30 day default, the public view (edited note, CTA, contact, re-run links with `via=report`), the slide view and image clamp, the Gradeshow edit set (total 10, engine band), preview agents, copy dashes, robots and sitemap, access-code hash and verify, and the notification template. Store, cookie round trip, limiter, SMTP and the edge image stay on the preview smoke list.

### Notes for PR (non-blocking)

1. Oswald in the two admin report headings matches the existing admin pages; the task constraint said none in new components. Owner to confirm or switch to Barlow Condensed.
2. `originFromHeaders` builds the notification email's links from the forwarded host header. Safe on Vercel; a hard-coded base or `NEXT_PUBLIC_SITE_URL` would close the spoof case elsewhere.
3. An admin previewing a draft that already has an access code sees the form, but the access route refuses non-published reports, so the code cannot be entered until publish or clear. Expected; the runbook says so.
4. Blanking the expiry on an already-published report resets it to 30 days from the original publish date, which can expire a long-extended report at once. The editor prefills the current value, so it needs a deliberate clear; the runbook says so.
5. A crash between the slug claim and the rest of the create write would leave a key holding only the slug, which reads as missing but blocks the slug. One admin user and one pipeline make this unlikely; the fix is a delete of that key.
6. The access, event, expired and score routes each do one extra report read; fine at this volume.
7. Five pre-existing pages still inline the calendar booking URL; only `ToolPage` reads the shared constant, as specified.
8. Preview smoke before merge: real Upstash claim and rename, the access-code flow and cookie scoping, the limiter, SMTP on first open and re-run, the end-to-end re-run hook from a report link, open counting skipped for the admin session and a preview bot, the report page at 375 px, print to PDF, Gmail and LinkedIn previews.
