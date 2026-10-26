# Design: Built to Scale? Release 4, prospect report pages

Branch `anthonystevenson0/built-to-scale-4-reports`, cut from `main` with Releases 1a, 1b, 2 and 3a merged (PR 14). Source: `task-spec.md`, `docs/built-to-scale-plan-updates.md` sections 3 ("Release 4"), 7 (the Summit-run path and the automated wording) and the Release 3a and 1b designs in `docs/designs/`, which define the composite run record, the `Scorecard` and `ScorecardWorking` contracts, the result page and OG image pattern, the token module and the mail module. Nothing in those designs is redesigned here; this document builds on them and says where it touches them.

This document is design only. No code, no pseudocode. Where the spec is ambiguous the assumption is stated inline and collected in section 4. Every file is designed against the content on `main` today (read on 26 October 2026).

---

## 0. Shape of the change

A report is a stored composite run plus Anthony's edits and commentary, addressed to one named prospect. This release makes no model call: the scores, comments and working all come from the run that already exists; the only new writes are the report record, its index, two counters and the events. The public page at `/report/{slug}` is a document for one reader (unlisted, noindex, not in the sitemap, disallowed in robots, carrying the as-of date, the public-information caveat and a correction invitation), with an optional access code and an expiry. A slide page and an OpenGraph image draw one summary shape so what the prospect prints and what Gmail or LinkedIn preview are the same picture. Admin creates a report from any composite run, edits every row and the three sections, sets slug, state, expiry and access code, and publishes or unpublishes through plain form POSTs. Tracking is three counters on the record, six events, and an email to Anthony on the first open and on every re-run.

```
app/lib/brand.ts                              + BOOK_CALL_URL, CONTACT_EMAIL (lifted from ToolPage and hub-copy)
app/lib/tools/report-model.ts                 pure, edge safe: slug rules, row merge, total and band, expiry, hash reader,
                                              state transitions, the public view, the slide view, the image data, Gradeshow edits
app/lib/tools/report-access.ts                pure, node:crypto: access-code salt, hash, constant-time verify
app/lib/tools/report-notification.ts          pure: the notification email to Anthony
app/lib/reports.ts                            the report store: report:{slug}, reports:by-updated, counters, rename, delete
app/lib/unlock.ts                             + purpose "report-access": cookie name, options, issue and verify
app/lib/ratelimit.ts                          + getReportAccessLimiter (10 per IP per hour, prefix rl:report-access)
app/lib/events.ts                             + six event names
app/components/toolkit/scorecard/Scorecard.tsx          verdict hidden when empty (one rule; 3a pages unchanged)
app/components/toolkit/scorecard/ScorecardWorking.tsx   + reportSlug prop: report re-run link and report fallback line
app/components/toolkit/shared/PrefillLoader.tsx         + via "report", hands the report slug back
app/components/toolkit/ToolPage.tsx                     BOOK_CALL_URL from brand; report slug carried into the score body
app/api/tools/[tool]/score/route.ts           + report field: validated, increments rerunCount, tracks, notifies
app/api/built-to-scale/prefill/route.ts       + via "report"
app/report/[slug]/page.tsx                    the public report page (server, dynamic)
app/report/[slug]/BookCallLink.tsx            the CTA anchor with the beacon (client)
app/report/[slug]/expired/route.ts            the 410 page
app/report/[slug]/slide/page.tsx              the slide page (server) with PrintButton.tsx (client)
app/report/[slug]/opengraph-image.tsx         next/og, edge runtime
app/api/report/[slug]/access/route.ts         verifies the code, sets the cookie
app/api/report/[slug]/event/route.ts          the beacon
app/admin/reports/page.tsx                    list
app/admin/reports/new/page.tsx                create from a composite run
app/admin/reports/[slug]/page.tsx             editor, with RowsEditor.tsx and SlugField.tsx (client)
app/admin/reports/[slug]/delete/page.tsx      the confirm step
app/api/admin/reports/route.ts                create
app/api/admin/reports/[slug]/route.ts         save, publish, unpublish, reset a row, delete
app/admin/layout.tsx, app/admin/page.tsx      "Reports" in the nav and on the dashboard
app/robots.ts                                 disallow /report/
app/globals.css                               .report-* and .rs-* rules (page gutters, slide stage, print)
scripts/seed-report.ts, package.json          the seed script and its npm script
__tests__/report-model.test.ts, report-access.test.ts, report-notification.test.ts
docs/runbook.md                               entry (Docs agent)
```

Not touched: `app/lib/llm.ts`, `app/lib/rubrics.ts`, `app/lib/tools/pipeline.ts`, `app/lib/tools/registry.ts`, the scoring prompts, `app/lib/runs.ts` (the composite reader it would need, `listRuns` filtered to `built-to-scale`, already exists), `app/sitemap.ts`, `.env.example`, `__tests__/scale-up-advisory.test.ts`.

---

## 1. Files to Modify / Create

Six phases, each with a gate that must be green before the next starts. `npm test`, `npm run lint` and `npx tsc --noEmit` run one after another at every gate (never `tsc` alongside `next build`); `npm run build` where the gate says so; `__tests__/scale-up-advisory.test.ts` is run by name at every gate and `git diff main -- __tests__/scale-up-advisory.test.ts` must be empty. The module resolution rule from 1a applies: files under `app/lib/**` import siblings with relative paths and the explicit `.ts` extension and import nothing from `next/*`, `react` or any component; pure modules import nothing that touches Redis or the network; `report-model.ts` additionally imports no `node:` module because the edge image loads it.

### Phase A: the pure report model, view builders, image data, email template, tests

| File | Change |
| --- | --- |
| `app/lib/brand.ts` (modify) | Add `BOOK_CALL_URL` (the Google Calendar appointment URL currently inlined in `ToolPage.tsx` as `BOOK_URL`, moved verbatim) and `CONTACT_EMAIL` (`info@summitstrategyadvisory.com`). `BRAND` is unchanged. |
| `app/tools/hub-copy.ts` (modify, one line) | `CONTACT_EMAIL` becomes a re-export of the brand constant so the hub and the report read one value; `__tests__/gtm-toolkit.test.ts` keeps importing it from `hub-copy.ts` and passes unchanged. |
| `app/lib/tools/report-model.ts` (create) | Pure and edge safe: imports `BTS_PARTS`, `totalOf`, `bandFor` and the view types from `./built-to-scale-method.ts`, and `BOOK_CALL_URL`, `CONTACT_EMAIL` from `../brand.ts`; no `node:` module, no registry, no store. Exports, detailed in section 2.1 to 2.6: the `ReportRecord`, `ReportRow`, `ReportState` types and the slug rules (`SLUG_PATTERN`, `isValidSlug`, `slugify`, `isPlaceholderSlug`, `placeholderSlugFor(runId)`); `mergeRows(originals, edits)`; `recomputeTotal(rows)`; `isExpired(report, nowMs)`, `defaultExpiry(publishedAtMs)`, `expiryFromDate(yyyyMmDd)`, `todayIso(nowMs)`; `readReportHash(hash)`; `applyStateChange(report, nextState, nowMs)`; `paragraphsOf(text)`; `publicViewOf(report, composite)`; `reportRerunHref(tool, childRunId, slug)`; `slideViewOf(report)`; `reportImageData(slide)`; `gradeshowEdits(originals)`; `isPreviewFetcher(userAgent)`; the copy constants in section 2.7 (`EDITED_NOTE`, `CAVEAT_LINE`, `CORRECTION_LINE`, `CTA_LABEL`, `PLACEHOLDER_TEXT`, `WORKING_MISSING_LINE`, `WORKING_NOT_STORED_LINE`, `EXPIRED_HEADING`, `EXPIRED_BODY`, `ACCESS_HEADING`, `ACCESS_PROMPT`, `ACCESS_WRONG`, `ACCESS_LIMITED`). |
| `app/lib/tools/report-access.ts` (create) | Pure, `node:crypto` only. Exports `newAccessCodeSalt()` (16 random bytes, hex), `normaliseAccessCode(code)` (trim, lowercase), `hashAccessCode(code, salt)` (scrypt of the normalised code with the salt, 32 bytes, Node's default cost, hex), `verifyAccessCode(code, stored)` (recomputes with `stored.salt` and compares with `timingSafeEqual` after a length check; false for an empty code or a malformed stored value), `ACCESS_CODE_MIN` 4 and `ACCESS_CODE_MAX` 64, `isAcceptableAccessCode(code)`. Separate from `report-model.ts` so the model stays loadable on the edge (decision 4.2). |
| `app/lib/tools/report-notification.ts` (create) | Pure. Exports `renderReportNotification(args)` returning `{ subject, text }` (section 2.8). Imports `plainDashes` from `./result-email.ts` only. |
| `__tests__/report-model.test.ts` (create) | Slug: `isValidSlug` accepts `gradeshow`, `acme-2026`, a 3 and a 60 character slug; rejects uppercase, 2 characters, 61 characters, spaces, underscores, a leading or trailing hyphen, double hyphens; `slugify("Gradeshow Ltd.")` is `gradeshow-ltd` and a result longer than 60 is cut at a hyphen; `placeholderSlugFor` is valid and `isPlaceholderSlug` of it is true. Row merge: unchanged grade and comment gives `edited` false; changed grade only, changed comment only and both give true; whitespace around a comment does not count as a change; rows come back in method order whatever the input order; a missing edit for a key keeps the original. Total and band from edited rows at 5, 9, 10, 14, 15, 19, 20 and 25 give the four labels. Expiry: `isExpired` is false one millisecond before `expiresAt`, true at it and after; `defaultExpiry` is 30 days after publish; `expiryFromDate("2026-11-25")` is the end of that day in UTC; `todayIso` yields `YYYY-MM-DD`. `readReportHash`: accepts `rows` as a JSON string and as an array, `openCount` as a string and a number, `accessCode` as `"null"` and as an object; returns null when `slug` or `runId` is missing or `rows` has four entries; clamps grades to 1 to 5. `applyStateChange`: draft to published sets `publishedAt` and a null `expiresAt` to 30 days out, keeps a future `expiresAt`, replaces a past one, and returns the `report_published` event; published to unpublished returns `report_unpublished`; draft to unpublished and published to published return no event; a second publish keeps the first `publishedAt`. `paragraphsOf` splits on blank lines, trims, drops empties. `publicViewOf`: with no edited row the `label` is empty; with one edited row it is `EDITED_NOTE`; `ctaUrl` equals `BOOK_CALL_URL` and `contactEmail` equals `CONTACT_EMAIL`; every working entry's `rerunHref` matches `/tools/{tool}?prefill={childId}&via=report&report={slug}`; the scorecard view has five rows with comments as strings, an empty verdict, `compact` content hidden (strongest, weakest and one change are empty strings); with `composite` null the working is empty on every row and `workingAvailable` is false; the as-of label is an en-GB long date. `slideViewOf`: three boxes in the order product thoughts, scorecard, moonshot; the scorecard box has total, band and five rows with dots `[T,T,T,F,F]` for grade 3; the opening is the first paragraph; the mark reads "Summit Strategy Advisory". `reportImageData`: clamps the opening to 240 characters at a word boundary with an ellipsis, each text box to 200, keeps the dots. `gradeshowEdits`: grades 3, 2, 1, 2, 2 in method order, total 10, band label "A good idea with an engine still to build", company "Gradeshow", slug `gradeshow`, placeholders in the three sections, `edited` true only where the grade differs from the original. `isPreviewFetcher`: true for a LinkedInBot, GoogleImageProxy, facebookexternalhit, Slackbot, Twitterbot and WhatsApp user agent, false for Safari on iPhone and Chrome on Windows. Copy constants: none contains U+2013 or U+2014 or " - ". `app/robots.ts` disallows `/report/`; `sitemap()` has no URL containing `/report/`. |
| `__tests__/report-access.test.ts` (create) | A code hashed with a salt verifies; a different code fails; the same code with a different salt fails; the hash is 64 hex characters and never equals or contains the code; " Gradeshow2026 " and "gradeshow2026" verify against each other (trim and case); an empty code never verifies; a stored value with a missing salt fails without throwing; `isAcceptableAccessCode` rejects 3 characters and 65 characters; `newAccessCodeSalt` is 32 hex characters and two calls differ. |
| `__tests__/report-notification.test.ts` (create) | For `event: "opened"` the subject names the company and "opened", the text carries the company, the slug, the report URL, the admin URL, the time and the open count; for `event: "rerun"` the subject names the tool and the text carries the tool name and the re-run count; a company name containing an em dash is normalised; neither subject nor text contains U+2013 or U+2014. |

**Gate A:** `npm test` green (new files plus the untouched suite), `npx tsc --noEmit`, `npm run lint` 0 errors. `app/components/toolkit/ToolPage.tsx` still compiles with its own `BOOK_URL` (the switch is Phase E). `grep -rn "node:" app/lib/tools/report-model.ts` returns nothing. `git diff --stat` touches only the files above.

### Phase B: the store and index, access and tracking helpers, component props

| File | Change |
| --- | --- |
| `app/lib/reports.ts` (create) | The report store, section 2.9. Imports `getRedis`, `runKey` and `isRunId` from `./runs.ts` (types only beyond those), `readReportHash` from `./tools/report-model.ts`. Exports `reportKey(slug)`, `REPORT_INDEX_KEY` (`reports:by-updated`), `SlugTakenError`, `ReportNotFoundError`, `createReport(input)`, `getReport(slug)`, `listReports()`, `saveReport(slug, patch)`, `renameReport(oldSlug, newSlug)`, `deleteReport(slug)`, `recordOpen(slug, nowIso)`, `recordRerun(slug)`, `persistRunForReport(runId, childIds)`. |
| `app/lib/unlock.ts` (modify) | Add purpose `report-access` beside the three existing ones: `REPORT_ACCESS_COOKIE` (`summit_report`), `reportAccessCookieOptions(slug, maxAgeSeconds)` (httpOnly, `secure` as the others, `sameSite` lax, `path` `/report/{slug}`, `maxAge` as given), `issueReportAccessCookie(slug, codeHashPrefix)` (claims `slug` and `ac`), `verifyReportAccessCookie(value, slug, codeHashPrefix)` (purpose `report-access`, `maxAgeSeconds` 30 days as a backstop, true only when both claims match). Every helper follows the module's secret-unset rule: issue returns null, verify returns false. |
| `app/lib/ratelimit.ts` (modify) | Add `getReportAccessLimiter()`: sliding window 10 per 1 h, prefix `rl:report-access`. Nothing else changes. |
| `app/lib/events.ts` (modify) | `EventName` gains `report_created`, `report_published`, `report_unpublished`, `report_opened`, `report_tool_rerun`, `book_call_clicked`. |
| `app/components/toolkit/scorecard/Scorecard.tsx` (modify, one rule) | The verdict paragraph renders only when `view.verdict` is a non-empty string. Everything else is unchanged; no new prop is needed (decision 4.6): `label=""` already hides the automated line, `compact` (reserved for this release in 3a) hides strongest, weakest and the one change, and comments show for any view carrying `oneChange` and string comments. |
| `app/components/toolkit/scorecard/ScorecardWorking.tsx` (modify) | New optional prop `reportSlug?: string`. When set: the re-run link reads "Re-run with your own inputs" and its href is `reportRerunHref(entry.tool, entry.runId, reportSlug)` from `report-model.ts`; when the entry's `full` is null the body shows `WORKING_NOT_STORED_LINE` ("The full working for this tool was not stored for this run.") and the re-run link still renders (it needs only the child's inputs). When unset, the existing behaviour and copy are byte for byte the same. |

**Gate B:** `npx tsc --noEmit`, `npm run lint`, `npm test` green; `npm run build` green (confirms `reports.ts` bundles and no edge route imports it). A short Node script run by hand against the dev Redis (not committed) or a REPL call confirms: `createReport` writes `report:{slug}` and the index entry, a second create with the same slug throws `SlugTakenError`, `renameReport` moves the hash and the index member and the old key is gone, `recordOpen` returns `first: true` once and increments `openCount`, `deleteReport` removes both. The 3a pages (`/tools/built-to-scale`, a result page) render exactly as before in the browser.

### Phase C: the public page, access route, expired page, event beacon, slide page, OG image

| File | Change |
| --- | --- |
| `app/globals.css` (modify, append) | A `.report-*` block: `.report-page` (max width 760, padding 48px 24px; 32px 16px under 480px), `.report-section` spacing, `.report-working` (light panel wrapper so the white working cards read on the white page), `.report-cta` (the CTA band). An `.rs-*` block for the slide: `.rs-stage` (`container-type: inline-size`, width 100 percent, max width 1280, `aspect-ratio: 16 / 9`, dark green background), `.rs-slide` with every size in `cqw` units so the slide scales to any width, three `.rs-box` columns, `.rs-dots`. Print rules inside `@media print`: hide `.rs-chrome` (the button row and the back link), remove page background, `.rs-stage` at 100 percent width with no max width, and `page-break-inside: avoid`. No Tailwind utilities; no selector outside these two prefixes is touched. |
| `app/report/[slug]/page.tsx` (create) | Server page, `dynamic = "force-dynamic"`. `generateMetadata` and the render in section 2.10 and the flow in section 3.1. Reads `cookies()`, `headers()` (user agent only) and `searchParams.access`. Renders `Scorecard`, `ScorecardWorking` (with `reportSlug`) and `BookCallLink`; no `SiteNav` (decision 4.11). |
| `app/report/[slug]/BookCallLink.tsx` (create) | Client. Props `{ href, slug, label }`. An anchor to `href` with `target="_blank"` and `rel="noopener noreferrer"`; on click sends `navigator.sendBeacon("/api/report/{slug}/event", JSON of { event: "book_call_clicked" })` when `sendBeacon` exists and otherwise a `fetch` with `keepalive`; never prevents the navigation. |
| `app/report/[slug]/expired/route.ts` (create) | GET, `runtime nodejs`, `dynamic force-dynamic`, `maxDuration = 15`. Section 3.3: 410 with a plain HTML page (`EXPIRED_HEADING`, `EXPIRED_BODY`, the contact address, `noindex` meta, inline BRAND styles, no script, `Cache-Control: no-store`) when the slug names a published report whose expiry has passed; 404 JSON otherwise. The page helper is a local `renderPage` mirroring the delete route's (section 6 notes the duplication). |
| `app/api/report/[slug]/access/route.ts` (create) | POST, `runtime nodejs`, `dynamic force-dynamic`, `maxDuration = 15`. Section 3.2. Reads `req.formData()`; always answers with a 303 redirect (to the report with `?access=wrong` or `?access=limited`, to `/report/{slug}/expired`, or to the report with the cookie set) or a 404 JSON for an unknown slug. |
| `app/api/report/[slug]/event/route.ts` (create) | POST, `runtime nodejs`, `dynamic force-dynamic`, `maxDuration = 15`. Section 3.4: slug valid and report published, body `event` equals `book_call_clicked`, `track("book_call_clicked", { slug })`, 204; anything else 204 with nothing tracked (a beacon has no reader). `Cache-Control: no-store`. |
| `app/report/[slug]/slide/page.tsx` (create) | Server page, `dynamic = "force-dynamic"`, metadata `robots: { index: false, follow: false }`, title "{company}: Built to Scale? summary". Same gate as the report page (404, redirect to expired, redirect to `/report/{slug}` when an access code is set and the cookie does not verify; admin draft preview as the page). No open counting. Renders `PrintButton` and a "Back to the report" link in a `.rs-chrome` row, then the slide from `slideViewOf(report)` (section 2.5) inside `.rs-stage`, with a `<style>` element carrying `@page { size: landscape; margin: 10mm }` (decision 4.12). |
| `app/report/[slug]/slide/PrintButton.tsx` (create) | Client. One button "Download as PDF" that calls `window.print()`; the browser's print dialog offers Save as PDF. No library. |
| `app/report/[slug]/opengraph-image.tsx` (create) | `runtime = "edge"`, `size 1200 by 630`, `contentType image/png`, `alt "Built to Scale? report summary"`. Section 2.11. Imports `getRedis` from `app/lib/redis` and `readReportHash`, `slideViewOf`, `reportImageData`, `isExpired` from `app/lib/tools/report-model` only. |

**Gate C:** build, lint, tsc, tests green. Smoke against `npm run dev` with Upstash and `UNLOCK_SECRET` set, using a report created in the Gate B check and set `published` by hand (the admin editor is Phase D; set the field with a REPL call): `/report/{slug}` renders the company, the as-of line and the caveat, the opening, the dark scorecard with comments visible and no automated line, the edited note only after a row is changed by hand, product thoughts, moonshot, the working with the re-run links carrying `via=report&report={slug}`, the correction line with the address and the "Book 30 minutes" button; the run hash shows `openCount` 1, `firstOpenedAt` and `lastOpenedAt` after the first open, 2 after the second, and the count does not move when the admin session cookie is present or when the request carries a LinkedInBot user agent; the `events` stream has `report_opened` with the slug only; with `NOTIFY_EMAIL` and SMTP set the first open emails Anthony once and the second does not; clicking the CTA leaves `book_call_clicked` in the stream; the page source carries `noindex, nofollow` and `og:image` pointing at `/report/{slug}/opengraph-image`; at 375 px wide nothing scrolls horizontally. With `state` set to `draft`: 404 without the admin cookie, the draft banner with it. With `expiresAt` set in the past: a 307 to `/report/{slug}/expired` and a 410 page there. With an access code set by hand (salt and hash from the pure module): the form shows; a wrong code redirects back with the "did not match" line; an eleventh attempt from one IP in an hour shows the "too many attempts" line; the right code sets `summit_report` with `Path=/report/{slug}` and `HttpOnly` and the page renders; the cookie does nothing on a second report's path. `/report/{slug}/slide` shows the 16 by 9 stage with the opening across the top and the three boxes, scales with the window width, and the print preview (Ctrl+P) is one landscape page; "Download as PDF" opens the dialog. `/report/{slug}/opengraph-image` is a 1200 by 630 PNG with the three boxes for a published report without a code, the fallback frame for one with a code, and 404 for a draft or an unknown slug.

### Phase D: admin list, new, editor, delete confirm, routes, nav

| File | Change |
| --- | --- |
| `app/admin/reports/page.tsx` (create) | Server, `dynamic force-dynamic`. Section 2.12: the table from `listReports()`, the status line from `?status=`, a "New report" link. |
| `app/admin/reports/new/page.tsx` (create) | Server, `dynamic force-dynamic`. `listRuns({ tool: BUILT_TO_SCALE_TOOL, limit: 20, offset: 0 })` filtered with `isCompositeRun`. Section 2.13. |
| `app/admin/reports/[slug]/page.tsx` (create) | Server, `dynamic force-dynamic`. The editor, section 2.14. Reads `getReport(slug)` (404 via `notFound()` when missing), `getCompositeRun(report.runId)` and the children (to show how much working is stored), `?status=` and `?error=`. |
| `app/admin/reports/[slug]/RowsEditor.tsx` (create) | Client. Props: the five rows (key, name, grade, comment, original grade, original comment, edited). Renders, per row, the grade `<select name="grade:{key}">` (1 to 5), the comment `<textarea name="comment:{key}">`, the original grade and comment read-only beside it, and a submit button `name="action" value="reset:{key}"` labelled "Reset to run"; keeps the five grades in state only to show the live total and band from `totalOf` and `bandFor` (the one piece of client state, within what the models page already uses). The inputs are plain named fields inside the server-rendered form. |
| `app/admin/reports/[slug]/SlugField.tsx` (create) | Client. Props: `company`, `slug`, `isPlaceholder`. Renders the company input and the slug input (both named); while the slug is the placeholder or empty and has not been typed in, typing the company fills the slug with `slugify(company)`. State is the two field values. |
| `app/admin/reports/[slug]/delete/page.tsx` (create) | Server. The confirm step: the company and slug, one sentence ("This deletes the report and its index entry. The composite run it was built from is kept. Unsaved edits on the editor are not kept."), a form POSTing `action=delete-confirmed` to `/api/admin/reports/{slug}`, and a "Keep it" link back to the editor. |
| `app/api/admin/reports/route.ts` (create) | POST, `runtime nodejs`, `dynamic force-dynamic`, `maxDuration = 30`. Section 3.5: create a draft from `runId` and redirect to the editor. 401 JSON without a session, as the models and rubrics routes. |
| `app/api/admin/reports/[slug]/route.ts` (create) | POST, `runtime nodejs`, `dynamic force-dynamic`, `maxDuration = 30`. Section 3.6: one handler branching on the `action` field (`save`, `publish`, `unpublish`, `reset:{key}`, `delete-confirmed`), every outcome a 303 redirect with `?status=` or `?error=`. |
| `app/admin/layout.tsx` (modify) | A "Reports" link to `/admin/reports` after "Rubrics" in the nav, same style. |
| `app/admin/page.tsx` (modify, one entry) | The links grid gains `{ href: "/admin/reports", title: "Reports", body: "Prospect reports built from Built to Scale? runs" }`. |

**Gate D:** build, lint, tsc, tests green. In the browser, logged in: `/admin/reports` lists the Gate B report with company, slug, state, total, expiry, opens, re-runs, updated and the two links; `/admin/reports/new` lists the recent composite runs with date, total, band, the quick flag, 80 characters of the pain part (or the description), the unlock email where present, and a note of how many children have stored working; "Create report" lands on the editor with `?status=created`, company blank, the placeholder slug, the rows copied with their originals beside them, as-of today, state draft, the three placeholders; typing a company suggests the slug; Save persists every field and shows "Saved"; changing the slug moves the record (the old editor URL and the old public URL 404, the list shows the new slug once); a reset button restores one row's grade and comment from the run and keeps the other edits that were on the form; a changed grade or comment shows "edited" on save and the live total and band update as the selects change; Publish sets state, `publishedAt` and a 30 day expiry when none was set and shows "Published"; the public page now renders; Unpublish 404s it; setting an access code shows "set", never the code, and the public page asks for it; the clear checkbox removes it; the delete button opens the confirm page and confirming returns to the list with "Deleted" and the hash and index entry gone while `run:{runId}` remains; a wrong slug, a taken slug, a blank company on publish, a bad date and a 3 character code each come back with the matching error line and the form values intact where the browser restores them. `/admin` shows the Reports card and the nav link.

### Phase E: the score route re-run hook, ToolPage, prefill via

| File | Change |
| --- | --- |
| `app/api/tools/[tool]/score/route.ts` (modify) | `Body` gains `report?: unknown`. After `scoreRun`, when `rerunOf` is a non-empty string and `report` is a string that passes `isValidSlug`: `getReport(slug)`; when it exists and is `published`, `recordRerun(slug)`, `track("report_tool_rerun", { tool, runId, rerunOf, report: slug })` and `after(notifyReportEvent(...))` (section 3.7). Any failure in this block is logged and the response is unchanged; the existing `re_run` event still fires. Nothing else in the route moves. |
| `app/api/built-to-scale/prefill/route.ts` (modify) | `via === "report"` tracks `tool_rerun_from_scorecard` with the existing props plus `via: "report"` and, when the `report` query value passes `isValidSlug`, `report`. The response is unchanged. |
| `app/components/toolkit/shared/PrefillLoader.tsx` (modify) | `via` prop type gains `"report"`; the component reads the URL's own `via` and `report` params: when the URL says `via=report` and `report` matches `SLUG_PATTERN`, the fetch is made with `via=report&report={slug}` and `PrefillPayload` gains `report?: string` carrying the slug. The `from` path and the existing `scorecard` behaviour are unchanged. |
| `app/components/toolkit/ToolPage.tsx` (modify) | `BOOK_URL` is deleted and the CTA anchor reads `BOOK_CALL_URL` from `@/app/lib/brand`. New state `reportSlug: string | null`, set from `payload.report` in `handlePrefill`; the score body includes `report` when set; the prefilled line reads "Inputs loaded from the Summit report. Edit anything and score again." when `reportSlug` is set and the existing line otherwise. "Score again" keeps `reportSlug` so a second run from the same page still counts. |

**Gate E:** build, lint, tsc, tests green; `/tools/[tool]` still listed static in the build output. In the browser: a report's re-run link opens `/tools/moat?prefill={childId}&via=report&report={slug}` with the inputs filled and the report line; scoring records `re_run` and `report_tool_rerun` (slug only), `rerunCount` on the report increments, Anthony receives the re-run email, and the admin list shows the count; the same link with `report=` pointing at a draft or unknown slug scores normally and increments nothing; a tool page's "Book a Call" button still opens the calendar; `grep -rn "calendar.google.com" app` matches `app/lib/brand.ts` only.

### Phase F: seed script, robots, runbook

| File | Change |
| --- | --- |
| `scripts/seed-report.ts` (create) | Section 3.8. Run as `npm run seed-report -- {runId} [--gradeshow]`. |
| `package.json` (modify, one script) | `"seed-report": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --env-file-if-exists=.env.local scripts/seed-report.ts"`. No dependency changes. |
| `app/robots.ts` (modify) | `disallow` becomes `["/admin/", "/api/", "/report/"]`. |
| `docs/runbook.md` (modify, Docs agent) | Entry "Built to Scale? Release 4: prospect report pages": trigger (how a report is made, published, sent and tracked), the record and keys, the public page gate order, the access code and cookie, the 410 page, the slide and image, the admin pages and the form actions, the events and the notification email, the seed script and the operational prerequisite that the run's full view be opened before a report is created (so the working is stored), the Gmail and LinkedIn preview behaviour, failure modes (secret unset, SMTP unset, run deleted under a report, Redis down), how to extend or expire a report, how to disable (unpublish, or clear `NOTIFY_EMAIL` to silence notifications). |

**Gate F:** all four quality gates green one after another; `__tests__/scale-up-advisory.test.ts` byte identical to `main`; `npm run seed-report -- {runId} --gradeshow` against the dev Redis creates the Gradeshow draft and prints its editor URL, and a second run prints "already exists" and exits 0; `/robots.txt` from `npm run dev` lists `Disallow: /report/`; `grep -rn "font-oswald" app/report app/lib/tools/report-model.ts app/admin/reports` returns nothing; `git status` shows only intended files. The orchestrator runs the seed once on the preview after the smoke, as the spec says.

---

## 2. Integration Points

### 2.1 The report record (`ReportRecord`, hash `report:{slug}`)

| Field | Type | Notes |
| --- | --- | --- |
| `slug` | string | Lowercase letters, digits and hyphens, 3 to 60 characters, no leading, trailing or double hyphen; unique; the key |
| `company` | string | The prospect's name; blank on creation |
| `runId` | string | The composite run the report was built from (a `run_` id) |
| `state` | `draft`, `published`, `unpublished` | Draft on creation |
| `asOf` | string `YYYY-MM-DD` | Today on creation (London date) |
| `expiresAt` | ISO or null | Null until publish; then 30 days from publish unless set; extendable |
| `accessCode` | `{ salt, hash }` or null | Never the code; stored as one JSON field like `unlock` on a run |
| `opening`, `productThoughts`, `moonshot` | string | Paragraphs separated by blank lines; `PLACEHOLDER_TEXT` ("Anthony to write") on creation |
| `rows` | array of five `ReportRow` | `{ key, grade, comment, original: { grade, comment }, edited }` in method order; `original` is the run's row at creation (decision 4.4) |
| `total`, `bandKey`, `band` | number, key, label | Recomputed in code from the five grades on every save |
| `createdAt`, `updatedAt`, `publishedAt` | ISO, ISO, ISO or null | `updatedAt` moves on edits only, never on counters |
| `firstOpenedAt`, `lastOpenedAt` | ISO or null | Set by `recordOpen` |
| `openCount`, `rerunCount` | number | Incremented with HINCRBY |

Serialisation follows `runs.ts`: nested values (`accessCode`, `rows`) as JSON strings, null as `"null"`, numbers as themselves; `readReportHash` in the pure module reads both Upstash shapes (JSON string or already parsed) and is the one deserialiser (the store and the edge image both use it).

### 2.2 Slug rules

`SLUG_PATTERN` is the 3 to 60 rule above. `slugify(text)`: lowercase, diacritics stripped, every run of characters outside `a to z` and `0 to 9` becomes one hyphen, leading and trailing hyphens trimmed, cut to 60 at the last hyphen inside the limit; a result shorter than 3 is padded with `report` (so `slugify("AB")` is `ab-report`). `placeholderSlugFor(runId)` is `draft-` plus the last 8 hex characters of the run id; `isPlaceholderSlug` matches `draft-` plus 8 hex. The placeholder is what a new report is keyed under until Anthony names it, and the seed script relies on it for idempotence.

### 2.3 Row merge, total, band, expiry, state

- `mergeRows(originals, edits)`: `originals` is the run's five rows (or the report's stored originals), `edits` a partial map by key of `{ grade, comment }`. For each part in method order the result row carries the edited grade (clamped 1 to 5, integer) and the trimmed edited comment where an edit exists, else the original; `edited` is true when the grade differs from the original grade or the trimmed comment differs from the trimmed original comment. `original` is carried through unchanged.
- `recomputeTotal(rows)` returns `{ total, bandKey, band }` through the 3a `totalOf` and `bandFor`; a total outside 5 to 25 cannot occur from five clamped grades, so the throw is a bug signal, not a path.
- `isExpired(report, nowMs)` is true when `expiresAt` is set and `Date.parse(expiresAt) <= nowMs`; a null `expiresAt` is never expired (drafts). `defaultExpiry(publishedAtMs)` is 30 days later as ISO. `expiryFromDate(yyyyMmDd)` is 23:59:59.999 UTC of that day as ISO, or null for a malformed value. `todayIso(nowMs)` is the `YYYY-MM-DD` of the London calendar day (an `Intl.DateTimeFormat` with `en-CA` and `Europe/London`, which prints ISO order).
- `applyStateChange(report, nextState, nowMs)` returns `{ patch, event }`: to `published` from any other state sets `publishedAt` when null, sets `expiresAt` to `defaultExpiry(now)` when null or already past, and the event is `report_published`; to `unpublished` from `published` the event is `report_unpublished`; any other transition (including same state) has no event; the patch always carries `state` and `updatedAt`.

### 2.4 The public view (`publicViewOf(report, composite)`)

`composite` is the 3a `CompositeFullView` built by the page through `toCompositeFullView(run, children)`, or null when the run is gone. The result, `ReportPublicView`:

| Field | Content |
| --- | --- |
| `company`, `slug`, `asOf`, `asOfLabel` | `asOfLabel` is the en-GB long date ("26 October 2026") |
| `caveat` | `CAVEAT_LINE` |
| `opening`, `productThoughts`, `moonshot` | `string[]` paragraphs via `paragraphsOf` |
| `scorecard` | A `CompositeFullView`-shaped projection for the 3a `Scorecard` (decision 4.6): `runId` the report's `runId`, `tool` `built-to-scale`, `total`, `band`, `bandKey` from the report, `verdict`, `strongest`, `weakest`, `oneChange`, `confidenceReason` all `""`, `confidence` `"medium"`, `quickMode` false, `createdAt` the as-of date, `absentTools` `[]`, `unlocked` true, five rows `{ key, name, grade, comment, sources: [], feeds, working }` where `feeds` and `working` come from the matching composite row when `composite` is given and are `[]` otherwise |
| `label` | `EDITED_NOTE` when any row is edited, else `""` |
| `anyEdited` | boolean |
| `working` | Five entries `{ key, name, grade, entries: ReportWorkingEntry[] }` where each entry is the composite `WorkingEntry` plus `rerunHref` |
| `workingAvailable` | true when `composite` is given and at least one entry exists |
| `correction` | `CORRECTION_LINE` with `contactEmail` (`CONTACT_EMAIL`) |
| `ctaLabel`, `ctaUrl` | `CTA_LABEL` ("Book 30 minutes"), `BOOK_CALL_URL` |

`reportRerunHref(tool, childRunId, slug)` is `/tools/{tool}?prefill={childRunId}&via=report&report={slug}` with both values URL encoded; `ScorecardWorking` calls the same function so the page and the component cannot disagree.

### 2.5 The slide view (`slideViewOf(report)`) and image data (`reportImageData(slide)`)

`ReportSlideView`: `company`, `asOfLabel`, `opening` (the first paragraph of the opening, or `PLACEHOLDER_TEXT` when empty), `mark` ("Summit Strategy Advisory"), `boxes` as an ordered array of three: `{ kind: "text", title: "Product thoughts", paragraphs }`, `{ kind: "scorecard", title: "Built to Scale?", total, band, rows: [{ name, grade, dots: boolean[] }] }` (five rows in method order, dots filled to the grade, exactly as `scorecardImageData` does in 3a), `{ kind: "text", title: "Moonshot", paragraphs }`. The slide page draws this shape at 1280 by 720; the OG image draws `reportImageData(slide)`, the same shape with `opening` clamped to 240 characters and each text box's paragraphs joined with a space and clamped to 200, cut at the last space inside the limit with an ellipsis character appended (never a dash). Clamping lives in the pure module so the test pins it.

### 2.6 Gradeshow edits and preview fetchers

- `gradeshowEdits(originals)` returns `{ company: "Gradeshow", slug: "gradeshow", edits }` where `edits` maps Pain 3, Route to buyer 2, Unit of value 1, Value evidence 2, Ability to protect 2 with each original comment kept (the comments are Anthony's to write in the editor); `mergeRows(originals, edits)` then yields total 10 and the band "A good idea with an engine still to build" with `edited` true where a grade moved. The seed script composes these; the test asserts the figures.
- `isPreviewFetcher(userAgent)`: true when the lowercased agent contains any of `linkedinbot`, `googleimageproxy`, `facebookexternalhit`, `slackbot`, `twitterbot`, `whatsapp`, `telegrambot`, `discordbot`, `skypeuripreview`, `bingpreview`, `embedly`, `bot/`, `crawler`, `preview`. Used only to skip open counting (risk 7.5).

### 2.7 Copy constants (pure module, tested for dashes)

- `CAVEAT_LINE`: "Prepared by Summit Strategy Advisory from public information."
- `EDITED_NOTE`: "Scores and comments edited by Summit."
- `CORRECTION_LINE`: "If anything here is out of date or wrong, tell us and we will correct it."
- `CTA_LABEL`: "Book 30 minutes"
- `PLACEHOLDER_TEXT`: "Anthony to write"
- `WORKING_MISSING_LINE`: "The tool results behind this scorecard are no longer stored. Ask Summit for a fresh run."
- `WORKING_NOT_STORED_LINE`: "The full working for this tool was not stored for this run."
- `EXPIRED_HEADING`: "This report has expired"; `EXPIRED_BODY`: "Reports are kept for a limited time. Ask Summit for a fresh one."
- `ACCESS_HEADING`: "This report needs an access code"; `ACCESS_PROMPT`: "Enter the code Summit sent you."; `ACCESS_WRONG`: "That code did not match. Check the message from Summit and try again."; `ACCESS_LIMITED`: "Too many attempts from this connection. Try again in an hour."

### 2.8 The notification email (`renderReportNotification`)

Args: `company`, `slug`, `event` (`opened` or `rerun`), `atIso`, `openCount`, `rerunCount`, `reportUrl`, `adminUrl`, `tool?` (the tool name for a re-run). Subject: "Report opened: {company}" or "Report re-run: {company} ({tool})". Text, one line each: the company and slug; "What happened: opened for the first time" or "What happened: {tool} re-run from the report"; "When: {en-GB date and time} UTC"; "Opens so far: n"; "Re-runs so far: n"; "Report: {reportUrl}"; "Edit: {adminUrl}". Every caller string goes through `plainDashes`. Plain text only (the digest is plain text and this is a one-line alert to one person).

### 2.9 The report store (`app/lib/reports.ts`)

| Function | Redis | Behaviour |
| --- | --- | --- |
| `createReport(input)` | HSETNX `report:{slug}` `slug`, then HSET the rest, ZADD `reports:by-updated` | HSETNX returning 0 means the slug exists: throw `SlugTakenError` and write nothing else. `input` is `{ slug, company, runId, asOf, rows (with originals), opening, productThoughts, moonshot }`; the store fills `state: draft`, `expiresAt: null`, `accessCode: null`, the timestamps, counters 0, and `total`, `bandKey`, `band` through `recomputeTotal` |
| `getReport(slug)` | HGETALL | `readReportHash`; null for an invalid slug (checked before the read), an empty hash or a malformed one |
| `listReports()` | ZRANGE rev, pipelined HGETALL | Newest updated first; members whose hash is gone are dropped and ZREMed best effort, as `listRuns` does |
| `saveReport(slug, patch)` | HSET, ZADD with the new `updatedAt` | Serialises as `runs.ts` does; `patch` never carries `slug` (renames go through `renameReport`) |
| `renameReport(oldSlug, newSlug)` | RENAMENX, then HSET `slug`, ZREM old, ZADD new | RENAMENX returning 0 means the new slug exists: throw `SlugTakenError`, nothing moved; a missing source key throws `ReportNotFoundError`. The three follow-up commands run in one pipeline. Decision 4.5 |
| `deleteReport(slug)` | DEL, ZREM | Nothing else is touched; returns whether the hash existed |
| `recordOpen(slug, nowIso)` | pipeline: HSETNX `firstOpenedAt`, HINCRBY `openCount` 1, HSET `lastOpenedAt` | Returns `{ first, openCount }` where `first` is the HSETNX reply; `updatedAt` is not touched |
| `recordRerun(slug)` | HINCRBY `rerunCount` 1 | Returns the new count |
| `persistRunForReport(runId, childIds)` | PERSIST `run:{id}` for the composite and each valid child id, one pipeline | Removes the 30 day TTL so the working outlives the report's life (decision 4.4). `runs.ts` is not changed; this uses its exported `runKey` and `isRunId` |

Redis keys introduced: `report:{slug}` (hash, no TTL), `reports:by-updated` (sorted set, score `updatedAt` in ms, member slug), `rl:report-access` (limiter). The cookie is `summit_report`.

### 2.10 The report page (`/report/[slug]`)

`generateMetadata`: when the report is published and not expired (any access state): title "{company}: Built to Scale? report", description "{CAVEAT_LINE} As of {asOfLabel}.", `robots: { index: false, follow: false }`, OpenGraph title and description with `type: "article"` and the page URL, twitter `summary_large_image`; the image comes from the sibling `opengraph-image.tsx` by file convention. Otherwise `{ title: "Report", robots: { index: false, follow: false } }` so a draft's company name never reaches a crawler.

Render, top to bottom, inside `.report-page` on white with DM Sans body and Barlow Condensed numerals and labels: a header band (dark green) with "Summit Strategy Advisory" as text and the eyebrow "Built to Scale? report"; when the admin session is present and the state is not published, a banner "Draft preview. Only you can see this page." (decision 4.9); H1 the company; the line "As of {asOfLabel}. {CAVEAT_LINE}"; the opening paragraphs (17 px, line height 1.65); the `Scorecard` with `view` the projection, `label` the edited note or empty, `compact` true; "Product thoughts" (H2 Barlow Condensed 26 px dark green) with its paragraphs; "Moonshot" the same; "The working" (H2) with, per dimension that has entries, a sub heading "{name}, {grade} of 5" and `ScorecardWorking` for that row with `parentRunId` the run id and `reportSlug` the slug, inside `.report-working`; when the run is gone, `WORKING_MISSING_LINE`; a correction block (`CORRECTION_LINE` followed by a `mailto:` link to `CONTACT_EMAIL`); the CTA band (`.report-cta`, light background): "Talk it through with Summit" and the `BookCallLink` labelled `CTA_LABEL`; a footer line with the as-of date and the caveat again. No `SiteNav`, no `ToolkitFooter`, no share buttons (decision 4.11).

The access form (when a code is set and the cookie does not verify): the same header band, `ACCESS_HEADING`, `ACCESS_PROMPT`, the `ACCESS_WRONG` or `ACCESS_LIMITED` line when `searchParams.access` says so, a form with `method="POST"`, `action="/api/report/{slug}/access"`, one input `name="code"` (type text, `autocomplete="off"`, `autocapitalize="none"`, `spellcheck` false), one button "Open the report". No company name on this screen; the H1 is the heading.

### 2.11 The OG image (`opengraph-image.tsx`, edge)

Reads `hgetall("report:{slug}")` through `getRedis()` after `isValidSlug`, then `readReportHash`. Three outcomes: (a) published, not expired, no access code: `slideViewOf` then `reportImageData`, drawn at 1200 by 630 on `#053030` with the wordmark "SUMMIT STRATEGY ADVISORY" top left in `#6EBF8B` 14 px letter spaced, the company at 34 px white weight 700 with "Built to Scale? report, as of {date}" at 18 px at 55 percent white beneath, the clamped opening at 22 px across the top, then three boxes side by side (each `rgba(255,255,255,0.06)` with a 12 px radius): "Product thoughts" text at 18 px; the scorecard box with the total at 96 px weight 900, "of 25", the band at 20 px `#6EBF8B` uppercase and five rows of name at 16 px with 12 px dots (filled `#319A65`, empty 2 px border at 35 percent white) and the grade; "Moonshot" text at 18 px; (b) published with an access code, or any Redis error: the fallback frame, the wordmark, "Built to Scale? report" and the line "Open the link to read the report", no company, no numbers; (c) draft, unpublished, expired, unknown or invalid slug: a plain 404 response with no body. Fonts are the runtime's default sans, as the 3a image. The import graph is `next/og`, `app/lib/redis.ts` and `report-model.ts` only; `report-access.ts`, `reports.ts`, `runs.ts` and the registry are never imported here (risk 7.2).

### 2.12 Admin list (`/admin/reports`)

Heading "Reports", a "New report" link to `/admin/reports/new`, the status line (`created`, `saved`, `published`, `unpublished`, `reset`, `deleted`, `exists`) when `?status=` is present. A table in the runs page style: Company (or "Untitled" in grey for blank), Slug, State (a chip: draft grey, published green, unpublished amber), Total ("{total}/25" in Barlow Condensed with the band beneath in 11 px), Expiry (date, "expired" in red when past, "on publish" for null), Opens, Re-runs, Updated (en-GB short), and two links: "Edit" to the editor and "View" to `/report/{slug}` (shown for every state; the page renders a draft preview for the admin). Empty state: "No reports yet."

### 2.13 Admin new (`/admin/reports/new`)

Heading "New report", the line "Pick the Built to Scale? run to build the report from. Open the run's full view first so every tool's working is stored.", the error line for `?error=run-not-found`. A table of the twenty most recent composites: Date, Total ("/25") and band, Quick ("quick" chip when `quickMode`), Pain (the first 80 characters of `inputs.pain`, or of `inputs.description` in quick mode, with an ellipsis), Email (`unlock.email` or blank), Working ("{n} of {m} tools" where `n` counts children with `detailsAt`; the page reads the children with `getToolRuns`), and a form per row POSTing `runId` to `/api/admin/reports` with the button "Create report". A quick-mode row's button carries the title "Quick mode run: the working was made from one description" (risk 7.4).

### 2.14 Admin editor (`/admin/reports/[slug]`)

Header: the company (or "Untitled report"), the slug, the state chip, "{total} of 25, {band}", counters ("Opened n times, first on {date}, last on {date}; re-run n times"), `publishedAt` and `expiresAt`, and links "Public page", "Slide", "Image" (to the three public URLs; the public page link opens the admin preview for a draft), "Run" (to `/admin/runs?id={runId}`), and "Working stored for n of m tools" with the line "Open the full view on the result page to store the rest" when short (or "Run not found" in red when the run is gone). The status and error lines from the query.

One form, `method="POST"`, `action="/api/admin/reports/{slug}"`, fields in order: `SlugField` (company, slug) with the hint "Lowercase letters, digits and hyphens, 3 to 60 characters. Changing it moves the report; the old link stops working."; `asOf` (date input); `state` (select draft, published, unpublished); `expiresAt` (date input, blank means "30 days from publish"); access code: the line "Access code: set" or "Access code: not set", an input `accessCode` (text, `autocomplete="off"`, placeholder "New code, 4 to 64 characters, not case sensitive; leave blank to keep") and a checkbox `clearAccessCode` "Remove the access code"; `opening`, `productThoughts`, `moonshot` textareas (min height 140, 200, 140) each with the hint "Paragraphs separated by a blank line. The slide shows the first paragraph of the opening and about 400 characters per box."; the `RowsEditor` with the five rows; the live "Total {n} of 25, {band}" line; then the buttons: "Save" (`action=save`), "Publish" (`action=publish`, shown when not published), "Unpublish" (`action=unpublish`, shown when published), and on the right a link styled as a red outline button "Delete" to `/admin/reports/{slug}/delete`. No fetch, no JSON, no client state beyond the two small components.

Error codes the page maps to lines: `slug-invalid` ("The slug must be lowercase letters, digits and hyphens, 3 to 60 characters."), `slug-taken` ("That slug is already in use."), `company-required` ("Give the report a company name before publishing."), `asof-invalid`, `expiry-invalid` ("Dates must be YYYY-MM-DD."), `grade-invalid` ("Grades must be whole numbers from 1 to 5."), `code-invalid` ("An access code is 4 to 64 characters."), `run-not-found` ("The run behind this report could not be read; the row could not be reset."), `not-found`, `failed` ("The change could not be saved. Check the Redis variables.").

---

## 3. Data Flow

### 3.1 The report page, exact order

1. `slug` fails `isValidSlug`: `notFound()`.
2. `getReport(slug)`; a Redis error is logged (message only) and treated as missing: `notFound()`.
3. `admin = await validateSession()`. State not `published`: `notFound()` unless `admin`, in which case continue with the draft banner.
4. `isExpired(report, now)`: `redirect("/report/{slug}/expired")` (a 307; the destination answers 410, section 3.3). Admin preview is not exempt: an expired report is expired for Anthony too, so he sees what the prospect sees.
5. Access gate: when `report.accessCode` is set, read `cookies().get("summit_report")` and `verifyReportAccessCookie(value, slug, hash prefix)`. When it fails, render the access form (200) with the `?access=` message and stop; nothing is counted or tracked. When `UNLOCK_SECRET` is unset no cookie can ever verify: the form renders with a logged warning (fail closed; risk 7.12).
6. Working: `getCompositeRun(report.runId)`; when found, `getToolRuns(Object.values(run.children))` and `toCompositeFullView(run, children)` (3a); when missing or on error, `composite` is null (logged).
7. `view = publicViewOf(report, composite)`.
8. Open counting, unless `admin` or `isPreviewFetcher(headers().get("user-agent"))`: `const { first } = await recordOpen(slug, nowIso)` (a failure is logged and counting is skipped for this render); `void track("report_opened", { slug })`; when `first`, `after(() => notifyReportEvent({ kind: "opened", report, origin }))`.
9. Render.

`notifyReportEvent` (a small server helper in `app/lib/report-notify.ts`, created in Phase C; imports `reports.ts` types, `report-notification.ts`, `mail.ts`): never throws; when `NOTIFY_EMAIL` is unset or `isMailConfigured()` is false it logs once per instance and returns; otherwise `renderReportNotification` with `reportUrl` `{origin}/report/{slug}` and `adminUrl` `{origin}/admin/reports/{slug}`, `sendMail({ from: resultFromAddress() || NOTIFY_EMAIL, to: NOTIFY_EMAIL, subject, text, timeoutMs: 10_000 })`; any throw is logged through `redactAddresses`. It runs inside `after()` from `next/server` so the response is sent first and the platform keeps the function alive until the send settles (decision 4.8); the guard is the same shape as `track`'s (an async body wrapped in try and catch, never awaited by the render).

### 3.2 The access route, exact order

1. `slug` fails `isValidSlug`: 404 JSON.
2. `getClientIp`; `getReportAccessLimiter().limit(ip)`; on failure 303 to `/report/{slug}?access=limited`. The limiter runs before the Redis read of the report so a guessing loop costs one limiter call per attempt.
3. `getReport(slug)`; missing or not published: 404 JSON. Expired: 303 to the expired page. No access code set: 303 to `/report/{slug}`.
4. `req.formData()`, field `code` as a string (anything else is an empty code). `verifyAccessCode(code, report.accessCode)`; false: 303 to `/report/{slug}?access=wrong`. The code is never logged and never echoed.
5. True: `issueReportAccessCookie(slug, hash prefix)`; null (secret unset): 303 back to the page with `?access=wrong` and a logged warning naming the variable. Otherwise 303 to `/report/{slug}` with `Set-Cookie summit_report` using `reportAccessCookieOptions(slug, maxAge)` where `maxAge` is the seconds until `expiresAt`, capped at 30 days.

The hash prefix claim (`ac`, the first 8 hex of `accessCode.hash`) means clearing or changing the code invalidates every cookie issued under the old one without any server state. The `slug` claim and the cookie path together mean a cookie for one report does nothing on another.

### 3.3 The expired page

GET `/report/{slug}/expired`: `isValidSlug` then `getReport`; when the report exists, is published and `isExpired` is true, 410 with the HTML page (`EXPIRED_HEADING`, `EXPIRED_BODY`, "Write to {CONTACT_EMAIL}" as a mailto link, the Summit header band, `noindex` meta, no script, `Cache-Control: no-store`); anything else 404 JSON, so the URL cannot be used to enumerate drafts. The page is a route handler because an App Router page cannot set a 410 status; the report page redirects here (decision 4.7).

### 3.4 The event beacon

POST `/api/report/{slug}/event`: body read as text and parsed as JSON leniently (`sendBeacon` sends a text body); `event` must equal `book_call_clicked`; the slug must pass `isValidSlug` and name a published report (one `getReport`); then `void track("book_call_clicked", { slug })`. Always 204 with `Cache-Control: no-store`; nothing is read from cookies or headers, nothing personal is written. The `BookCallLink` fires it on click and lets the navigation to the calendar continue.

### 3.5 Create (POST `/api/admin/reports`)

1. `validateSession()` else 401 JSON.
2. `req.formData()`, `runId`; `isRunId` and `getCompositeRun`; missing: 303 to `/admin/reports/new?error=run-not-found`.
3. `slug = placeholderSlugFor(runId)`; `getReport(slug)` exists: 303 to `/admin/reports/{slug}?status=exists` (a second click on the same run reopens the same draft).
4. `rows` = the run's five rows as `{ key, grade, comment, original: { grade, comment }, edited: false }` in method order (a missing row in a malformed run becomes grade 1 and an empty comment, flagged in the editor as "no original"); `asOf = todayIso(now)`; the three sections `PLACEHOLDER_TEXT`.
5. `createReport(...)`; `SlugTakenError` (a race with step 3) is handled as step 3. `persistRunForReport(runId, childIds)` (a failure is logged, the report still exists). `void track("report_created", { slug })`.
6. 303 to `/admin/reports/{slug}?status=created`.

### 3.6 Save, publish, unpublish, reset, delete (POST `/api/admin/reports/[slug]`)

1. `validateSession()` else 401 JSON. `slug` invalid: 404 JSON. `getReport(slug)` missing: 303 to `/admin/reports?status=not-found`.
2. `action` from the form: `delete-confirmed` goes to step 8. Otherwise the form is read into a candidate: `company` trimmed; `slug` trimmed and lowercased, and when blank, `slugify(company)` (or the current slug when the company is blank too); `asOf` must match `YYYY-MM-DD` (`asof-invalid`); `expiresAt` blank keeps null, else `expiryFromDate` (`expiry-invalid`); `state` must be one of the three; `opening`, `productThoughts`, `moonshot` trimmed (blank keeps `PLACEHOLDER_TEXT`); `grade:{key}` and `comment:{key}` for the five keys (`grade-invalid` when not an integer 1 to 5); `accessCode` non-empty must pass `isAcceptableAccessCode` (`code-invalid`); `clearAccessCode` present clears. Validation errors: 303 back to the editor with `?error={code}` and nothing written.
3. `reset:{key}`: the candidate's row for `key` is replaced by the stored `original` for that key (grade and comment), then the save continues as `save` so the other edits on the form are kept; the status is `reset`.
4. New slug: when it differs from the current slug, `isValidSlug` (`slug-invalid`) and `renameReport(current, next)` first; `SlugTakenError`: 303 back with `slug-taken`. From here the report is addressed by the new slug.
5. Rows: `mergeRows(stored originals, candidate edits)`; `recomputeTotal`.
6. State: the effective next state is `published` for `action=publish`, `unpublished` for `action=unpublish`, else the select's value. Publishing with a blank company: 303 back with `company-required` (after the rename, if any, so the slug change is not lost). `applyStateChange(report, next, now)` gives the state patch and the event.
7. Access code: when `clearAccessCode`, `accessCode: null`; when a new code was given, `{ salt: newAccessCodeSalt(), hash: hashAccessCode(code, salt) }`; else untouched. `saveReport(slug, patch)` with every field above plus `updatedAt`; the event from step 6 is tracked with `{ slug }`. 303 to `/admin/reports/{slug}?status={saved|published|unpublished|reset}`.
8. Delete: `deleteReport(slug)`; 303 to `/admin/reports?status=deleted`. The composite run and its children are untouched; so is `reports:by-updated` beyond the one ZREM.

Any Redis failure in steps 4 to 8 is logged and answers 303 back with `?error=failed`. The route never logs the access code; the only logged values are the slug, the action and error messages.

### 3.7 The re-run hook (score route)

After `scoreRun` succeeds and before the response: when `body.rerunOf` is a non-empty string and `body.report` is a string passing `isValidSlug`: `getReport(slug)`; when found and `published`, `recordRerun(slug)` (returns the count), `void track("report_tool_rerun", { tool, runId: free.runId, rerunOf, report: slug })`, and `after(() => notifyReportEvent({ kind: "rerun", report, tool: entry.name, rerunCount, origin }))`. The slug is trusted for nothing else: it is never written to the run, never echoed, never used to read anything but the one report. A draft, unpublished, expired or unknown slug increments nothing (an expired report still counts a re-run? no: the hook requires `published` and not expired, since the link should have 410ed). The existing `re_run` event is unchanged and fires first.

The slug reaches the page through the URL (`via=report&report={slug}`): `PrefillLoader` reads both params, passes them to the prefill endpoint (which only tracks) and hands `report` back; `ToolPage` keeps it in state and includes it in the score body. `ScorecardWorking` builds the URL from `reportRerunHref`, so the only place that knows the shape is the pure module.

### 3.8 The seed script

`scripts/seed-report.ts`, run through the npm script with `.env.local` loaded: reads `process.argv` for a run id and the `--gradeshow` flag; prints usage and exits 2 without a run id or when the Upstash variables are missing (never prints a value); imports `getCompositeRun` from `runs.ts` and the report store lazily after the check, as `calibrate.ts` does. Steps: `getCompositeRun(runId)` (exit 1 "run not found or not a composite"); `slug` is `gradeshow` with the flag, else `placeholderSlugFor(runId)`; `getReport(slug)` exists: print "Report {slug} already exists at /admin/reports/{slug}; nothing changed." and exit 0; build the rows with originals as the create route does; with the flag apply `gradeshowEdits` through `mergeRows` and set the company; `createReport`, `persistRunForReport`; print the editor URL and, with the flag, "total 10, A good idea with an engine still to build"; exit 0. No model call, no event (the admin create tracks `report_created`; the seed is an operator action and is logged to stdout instead; assumption 4.13). The runbook documents the one-time run on the preview after the smoke.

### 3.9 The slide page and the print path

Same gate as 3.1 steps 1 to 5 (the access form is not rendered here; the page redirects to `/report/{slug}` so the one form lives in one place), no counting, then `slideViewOf(report)`. The chrome row (`.rs-chrome`, hidden in print): "Back to the report" and `PrintButton`. The stage: company and as-of top left, the mark top right, the opening across the top, three boxes beneath, the caveat line in the footer. "Download as PDF" is `window.print()`; the `<style>` element in the page sets `@page` landscape with a 10 mm margin, and the `cqw` sizing in `globals.css` makes the stage fill the printable width so a letter or A4 landscape sheet carries one slide.

---

## 4. Key Decisions

1. **A report stores its rows in full, with the run's originals snapshotted at creation.** Alternative: store only the edits and read originals from the run at render. Rejected: the run can disappear (the 1b delete flow removes every run under an email hash, composite and children included; a report built on an unlocked run is one delete link away from losing its scorecard), and "reset to run" and the "original beside it" column should not depend on a second read. Consequence: the run is needed only for the working, and a report renders its scorecard with the run gone.

2. **The hashing lives in `report-access.ts`, not `report-model.ts`.** The spec lists hashing among the model's helpers; the edge image imports the model for the slide view and the hash reader, and `node:crypto` cannot load on the edge (the 3a design kept `runs.ts` out of the image for the same reason). Two pure modules, one test file each; AC1's helpers are all present, one of them in a sibling file. Flagged as the one deviation from AC1's file listing.

3. **Scrypt with a per-report salt, case-insensitive codes.** `scryptSync` is in `node:crypto`, costs tens of milliseconds, and the limiter bounds attempts at 10 per IP per hour, so the hash cost is not the defence. Codes are normalised by trim and lowercase before hashing because a prospect types them on a phone with autocapitalisation; the editor says so. The stored value is the salt and the hash only; the admin page shows "set" or "not set".

4. **Creating a report PERSISTs the composite and its children, without unlocking them.** A run that was never unlocked expires 30 days after it was made; a report defaults to 30 days from publish and can be extended, so the working would vanish under a live report. PERSIST removes the TTL and nothing else: no unlock record, no email index entry, so the delete flow and the digest are unaffected. Deleting a report does not restore the TTL (the spec says delete removes the hash and index entry and nothing else; a run that outlives its report is a stored run like any unlocked one). `runs.ts` is untouched: the store issues PERSIST through `runKey` from a new module, which the constraint allows.

5. **Slug change is RENAMENX plus an index move; creation is HSETNX.** Alternative: EXISTS then HSET. Rejected because the check and the write would not be atomic. RENAMENX refuses when the destination exists and fails when the source is gone, which are exactly the two errors to report; HSETNX on the `slug` field claims a new key atomically. Both are supported by the Upstash client. The ZREM and ZADD that follow are not atomic with the rename; a crash between them leaves a stale index member, which `listReports` prunes on the next read. Risk 7.3 covers the remaining race.

6. **No new `Scorecard` prop; one rendering rule.** The task anticipated props to hide the automated label and to show comments without a gate. Reading the 3a component: `label=""` already hides the line (the render is conditional on a truthy label), `compact` was reserved for this release and hides strongest, weakest and the one change, and comments render for any row whose `comment` is a string on a view carrying `oneChange`. The one gap is the verdict paragraph, which the report does not have; it now renders only when non-empty, which changes nothing in 3a because the parser rejects an empty verdict. The report passes a `CompositeFullView`-shaped projection with empty strings in the fields it does not use; the projection is built in the pure module and tested, so the filler values are in one place. `ScorecardWorking` does need a prop (`reportSlug`) because its link and fallback copy differ; the default leaves 3a byte for byte unchanged.

7. **410 through a redirect to a route handler.** An App Router page can answer 404 (`notFound()`) or redirect, not 410. The spec asks for a 410 page, so the report page redirects (307) to `/report/{slug}/expired`, a route handler that re-reads the report, confirms it is published and expired, and answers 410 with plain HTML in the delete route's style; any other state answers 404 so the URL reveals nothing about drafts. Alternative: a `proxy.ts` matcher on `/report/*` reading Redis on the edge for every request. Rejected as a second reader of the report in a different runtime for one status code.

8. **Notifications run inside `after()` with a never-throw body.** `track` is fire and forget because an XADD is milliseconds; an SMTP send is seconds, and on Vercel work that is not awaited can be dropped when the function freezes after the response. `after()` from `next/server` runs the callback once the response is sent and keeps the function alive until it settles, so the page never waits and the email is not lost. The body carries the same guard as `track` (try and catch, log only). The counter write itself is awaited: it is one pipeline and the render needs `first` to decide whether to notify.

9. **Admin sessions see drafts as a preview; the public gets 404.** The spec says a draft 404s; Anthony cannot publish a page he has never seen. The page checks `validateSession()` anyway (to skip counting), so the draft preview costs nothing extra: a banner and no counting. The OG image and the slide follow the page (the image cannot check the session on the edge and answers 404 for drafts; a draft has no preview image, which is fine). Flagged as an assumption.

10. **Access-coded reports get the fallback OG frame.** A link preview is fetched without cookies; drawing the three boxes for a report Anthony protected with a code would publish its summary to every mail client and social cache that sees the link. The frame shows the wordmark and "Open the link to read the report", nothing about the company. A report without a code shows the slide, as the spec asks.

11. **The report page has no site navigation, share buttons or marketing footer.** It is a document for one named reader sent by email, not a page a visitor browses to. The header band names Summit, the footer carries the date and caveat, and the only outbound actions are the correction address and the booking button. The slide page carries only "Back to the report" and the print button.

12. **The slide scales with container query units and the print rule lives in a `<style>` element on the slide page.** `@page` cannot be scoped by selector, so putting it in `globals.css` would set landscape for every page on the site; the slide page owns it. Sizes in `cqw` make one layout serve the screen at any width and the printed sheet without JavaScript measuring the viewport; the stage is 1280 by 720 at full size and the same proportions everywhere else. Alternative: a fixed 1280 px stage with a JavaScript scale. Rejected: more client code for a worse print result.

13. **The seed script tracks no event and the create route does.** The seed is an operator action run once per environment; an event for it would read as a report being made through the product. Assumption flagged.

14. **Preview fetchers are skipped by user agent, not by cookie.** Gmail's image proxy and LinkedIn's bot fetch the page HTML to build a preview and would count as an open and trigger the first-open email. A short agent list in the pure module skips them; it is a heuristic and the runbook says so. Access-coded reports are immune anyway (no cookie, no content, no count).

15. **The `report` field in the score body is a slug and nothing more.** It is validated against the pattern, looked up once, and used to increment one counter and name one event; it is never stored on the run, never echoed, and a non-published slug does nothing. The prefill endpoint carries it only into an existing event's props. Nothing a visitor can send through it reaches a report's content.

Assumptions collected: 2, 9, 13, plus: `CONTACT_EMAIL` is `info@summitstrategyadvisory.com` (the hub's value); a report created from a run that has no stored working renders the working section with the "not stored" line per tool and the re-run links, and the admin pages tell Anthony to open the full view first; the as-of date is a London calendar date; the placeholder slug is `draft-` plus the run id's last 8 hex characters; expiry dates are end of day UTC; the notification goes to `NOTIFY_EMAIL` from `RESULT_FROM_EMAIL` or `SMTP_USER` (the daily digest sends from `NOTIFY_EMAIL` to itself; a results address is the better sender for a transactional alert, and either is already configured); the OG image's clamp limits (240 and 200 characters) are the design's figures and easily changed.

---

## 5. Constraints Honoured

- **No new dependencies.** `node:crypto` (scrypt, random bytes, timing-safe compare) for the access code; `next/og` for the image, already used twice; the browser's print dialog for PDF; `@upstash/redis` commands already in the client. `package.json` gains one script and no package.
- **Secrets via environment variables only; access codes never stored or logged in clear; no visitor personal data on reports.** `UNLOCK_SECRET` is read only in `app/lib/unlock.ts` (the new purpose uses the same reader); `NOTIFY_EMAIL` and the SMTP variables are read in `report-notify.ts` and `mail.ts`. The code is hashed in the admin route before any write and verified in the access route without logging; the editor shows "set" or "not set"; the cookie carries the slug and 8 hex characters of the hash, never the code. The record holds counters and timestamps only: no IP, no user agent, no email; the beacon body is one event name; `report_opened`, `report_tool_rerun` and `book_call_clicked` carry the slug (and for the re-run the tool and run ids, which the existing `re_run` event already carries).
- **Reports are unlisted.** `noindex, nofollow` in the page and slide metadata and on the expired and access pages; `app/sitemap.ts` is not edited and the test asserts no `/report/` URL in it; `app/robots.ts` disallows `/report/`; the admin layout already carries `noindex`. The page carries the as-of date and `CAVEAT_LINE` at the top and in the footer, `CORRECTION_LINE` with the address, and nothing is published anywhere else: no hub card, no listing, no share buttons; the only distribution is the link Anthony sends, and the OG image follows the page's state (404 for drafts and expired reports, the frame when a code is set). Consent is procedural: the runbook entry says a report is sent to the company it names and to nobody else without their agreement.
- **Reuse `Scorecard` and `ScorecardWorking`; no fork.** The report page renders both components from their 3a files; the one `Scorecard` rule and the one `ScorecardWorking` prop default to the 3a behaviour (decision 4.6). Gate B re-checks the 3a pages in the browser.
- **No model calls.** No file in this release imports `callModel`, `scoreRun`, `detailRun`, `scoreModel` or `detailModel`; `grep -rn "callModel\|scoreModel\|detailModel\|detailRun" app/report app/admin/reports app/api/report app/api/admin/reports app/lib/reports.ts app/lib/tools/report-*.ts scripts/seed-report.ts` returns nothing at Gate F. The working is read, never produced; the runbook makes "open the full view first" the operator's step.
- **Admin writes are plain form POSTs behind `validateSession()`; no admin client JavaScript beyond the models page's kind.** Both admin routes check the session first and answer 303 redirects with status codes in the query; the pages are server components with one `<form>`; the two client components hold field state only (grades for the live total, company and slug for the suggestion), which is less than `ModelsClient` already does. The middleware protects the pages as today.
- **Styling: inline BRAND objects and `globals.css`; no Tailwind; Barlow Condensed for numerals; no Oswald in new components.** The public page, slide, access and expired pages, admin pages and both client components use inline styles with `BRAND` and the `.report-*`, `.rs-*` and existing `.bts-*` classes; `var(--font-barlow-condensed)` for totals, grades and labels, `var(--font-dm-sans)` for body; the admin pages reuse the runs page's header style, which is the one place Oswald is defined, and the Gate F grep covers the new public and lib files. The dark scorecard is the 3a component unchanged.
- **Copy: British spelling, no em or en dashes, no hype words; no automated label; the edited note only when a row is edited.** All copy is in the pure module's constants and tested for dashes; the notification normalises caller strings; `AUTOMATED_LABEL` and `AUTOMATED_LINE` are not imported by any report file; `label` is `EDITED_NOTE` only when `anyEdited`.
- **Tests import pure modules only.** `report-model.test.ts` imports `report-model.ts`, `built-to-scale-method.ts`, `brand.ts`, `robots.ts` and `sitemap.ts` (both already load under Node: type-only `next` imports); `report-access.test.ts` imports `report-access.ts`; `report-notification.test.ts` imports `report-notification.ts`. None imports `reports.ts`, `runs.ts`, `unlock.ts`, `mail.ts`, a route or a page.
- **`maxDuration = 60` or lower on every new route; the render never waits on the email.** Access, event and expired routes are 15; the two admin routes 30; the page and slide are server components with no model call. The email runs in `after()` with a 10 s transport budget.
- **Untouched files.** `llm.ts`, `rubrics.ts`, `pipeline.ts`, the registry and the prompts are not in the diff; `runs.ts` is not edited because the composite reader exists (`listRuns` with `tool: "built-to-scale"`); `sitemap.ts` is not edited; `scale-up-advisory.test.ts` is byte identical, checked at every gate.
- **Rate limit on access attempts.** `rl:report-access`, 10 per IP per hour, applied before the report read in the access route; the existing limiters are untouched.
- **Node 22.18+ type stripping and the module rule.** New lib files use relative `.ts` imports; `report-model.ts` has no `node:` import; the seed script mirrors `calibrate.ts` (lazy imports after the env check).

---

## 6. Out of Scope

- Release 3b: "Ask Summit to score it" as a form, uploads, the extraction call and the admin queue. A report starts from an existing composite run only.
- Producing a run's working from the report side (that is `detailModel`, a model call). The operator opens the full view on the result page before creating the report; the admin pages say how much working is stored.
- A free summary per child (score, grade, verdict) in the working section when the full view was never stored; the "not stored" line and the re-run link stand in.
- Re-expiring a run when its report is deleted; an admin control to delete the run; backfilling PERSIST for reports created before this deploy (none exist).
- An audit history of edits, a diff against the run beyond the `edited` flag and the original column, or versioned reports.
- A second accepted secret for `UNLOCK_SECRET` rotation (rotation invalidates every report access cookie at once, as it does the unlock cookies).
- Per-report notification preferences, digests of opens, or notifying anyone but `NOTIFY_EMAIL`.
- Loading Barlow Condensed or the PNG mark into the OG image (3a decision 11 stands).
- A PDF library, server-side rendering of the slide to an image for download, or a PPTX export.
- Extracting the plain HTML page helper shared by the delete route and the expired route into a module; the duplication is fifteen lines and is noted for a later tidy.
- Changes to `gtm-unlocks`, the daily digest, or showing reports on the dashboard beyond the link card.

---

## 7. Risks and edge cases for the Reviewer

1. **The 3a `Scorecard` contract.** The report relies on three existing behaviours (empty `label` hides the line, `compact` hides the three cells, string comments on a full-shaped view render) plus one new rule (empty verdict hidden). The Reviewer should confirm the 3a result page and the Built to Scale? page render identically before and after (Gate B), that the projection's filler values never reach the screen, and that `ScorecardWorking` with `reportSlug` unset is unchanged in copy and href.

2. **Edge runtime imports.** `opengraph-image.tsx` may import `next/og`, `app/lib/redis.ts` and `report-model.ts` only. `report-model.ts` imports `built-to-scale-method.ts` (which imports types only from the registry and schema) and `brand.ts`; neither pulls in `node:` modules. A later import of `report-access.ts`, `reports.ts`, `runs.ts` or the registry into the model would break the edge build with a clear error at `npm run build`; Gate C's build is the check, and the `grep -rn "node:"` in Gate A is the early one.

3. **Slug change races.** RENAMENX is atomic for the uniqueness check; the index move after it is not, and two admin tabs saving the same report with different slugs in the same second can leave one tab's redirect pointing at a slug that no longer exists (it lands on the list with `not-found`). There is one admin user; the Reviewer should confirm the editor's redirect uses the slug the rename actually applied and that `listReports` prunes a stale member.

4. **A report from a quick-mode run.** The children were composed from one description with the quick-mode note prefixed to every input, so a prospect's re-run link prefills a tool with that note and the description, not five parts; the comments were written with lowered confidence. The new page marks quick runs and the button carries a title explaining it; nothing blocks it, because Anthony edits every row anyway. The Reviewer should check the quick flag is visible in the new page and the editor header.

5. **Open counter inflation by link previews.** Gmail, LinkedIn, Slack and others fetch the page HTML (and the image) when a link is pasted or delivered. The user-agent skip in 2.6 catches the named fetchers; an unlisted one counts as an open and can trigger the first-open email before the prospect reads anything. The runbook says the first-open email can be a preview and that `openCount` is an upper bound; access-coded reports are unaffected. The Reviewer should check the skip happens before `recordOpen`, and that the admin session skip is tested in Gate C.

6. **Access-code cookies on preview hosts.** The cookie is host bound and path scoped: a code entered on a preview deployment sets a cookie for the preview host only; production needs the code again. Previews behind Vercel Authentication show Vercel's login before the access form, as 1b noted for the unlock cookie. `secure` follows `NODE_ENV`, so the Gate C smoke runs under `npm run dev` over http. Nothing leaks across hosts.

7. **`scale-up-advisory.test.ts` must stay byte identical.** It loads `sitemap.ts`, `toolSlugs.ts`, `next.config.ts` and the scale-up content; none is edited. The only temptation is adding a sitemap assertion there; the design puts the sitemap and robots assertions in `report-model.test.ts` instead. Every gate diffs the file against `main`.

8. **The 410 path is a 307 then a 410.** A crawler following the chain sees 410 at the end; a human sees the expired page. The redirect carries no query. The Reviewer should check the expired route answers 404, not 410, for a draft or unknown slug.

9. **`after()` availability and behaviour.** Next 16 exports `after` from `next/server` for server components and route handlers. If the Coder finds it unavailable in a server component context, the fallback is the `track` pattern (un-awaited promise with a catch), accepting that a frozen function may drop the send; the runbook would note it. The Reviewer should confirm the callback body cannot throw and that the page's HTML is not delayed by it.

10. **The run disappearing under a report.** The 1b delete flow removes an unlocked composite and its children; PERSIST does not protect against DEL. The report keeps rendering (decision 4.1) with `WORKING_MISSING_LINE`; the editor shows "Run not found" and the reset buttons are disabled with the `run-not-found` error if pressed. The Reviewer should confirm the page does not 500 when `getCompositeRun` returns null or throws.

11. **RENAMENX and HSETNX through the Upstash client.** Both are documented commands on the client; the Gate B check exercises them against the real Redis. If either is missing in the installed version, the fallback is SET NX on a claim key `report:claim:{slug}` with a short TTL around an EXISTS check, and the design note changes; the Reviewer should check Gate B's output.

12. **`UNLOCK_SECRET` unset.** No report access cookie can be signed or verified, so an access-coded report shows the form on every visit and the access route sends the visitor back with the "did not match" line after a logged warning naming the variable. Reports without a code are unaffected. Fail closed is deliberate: silently opening a protected report would be worse than a stuck form.

13. **Scrypt on the Node runtime.** `scryptSync` with default parameters uses about 16 MB and tens of milliseconds per call; at 10 attempts per IP per hour it is negligible. The admin save hashes once. No edge code hashes anything.

14. **The `report` field as a probe.** Every score request may carry a slug, costing one `getReport` read after the model call; the score limiter (5 per IP per tool per hour) bounds it. A valid published slug can have its `rerunCount` inflated by hand-crafted requests, which also cost the attacker a real scored run each time. The counter is informational; the runbook says so.

15. **Draft preview for admin.** `validateSession` reads the `admin_session` cookie, which is `path=/`, so it is present on `/report/{slug}` in Anthony's browser; the preview and the counting skip both depend on it. Logged out, he sees what the prospect sees. The Reviewer should check the preview banner never renders without the session.

16. **Long text in the slide and the image.** The image clamps; the slide does not. A long section overflows its box on the slide page; the box has `overflow: hidden` so the layout holds and the editor's hint gives the budget. The Reviewer should look at the slide with a 1200 character box and confirm nothing escapes the stage.

17. **Container query units and print.** `cqw` is supported in every current browser; the print engine uses the same layout. Letter landscape with a 10 mm margin has a printable width of about 259 mm; the stage fills it at 16 by 9, which fits the 196 mm height. A4 landscape works the same. The Reviewer should print to PDF from Chrome and Safari in the Gate C check.

18. **Expiry end of day UTC and the London as-of date.** `expiresAt` from the editor is 23:59:59.999 UTC of the chosen day; the as-of date is the London calendar date. A report set to expire "today" in London in the evening expires at 00:59 London time next day in summer. Documented in the runbook; not worth a time zone field.

19. **Placeholders published by accident.** Publish requires a company name only; "Anthony to write" can go live. The editor shows the three sections next to the Publish button and the public page shows the placeholder text verbatim, which is visible on the admin preview. Blocking publish on placeholders would stop a report that deliberately leaves a section short; flagged for the owner, not enforced.

20. **`cookies()` and `headers()` in the page.** Both make the page dynamic; it is already `force-dynamic`. `generateMetadata` reads neither (it reads the report only), so link previews get the same metadata with or without a cookie, and the metadata reveals the company only for a published, unexpired report.
