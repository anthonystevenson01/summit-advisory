# Design: Built to Scale? Release 1b, gate and capture

Branch `anthonystevenson0/built-to-scale-1b-gate`, cut from `main` after PR 11 (Release 1a). Source: `task-spec.md`, `docs/built-to-scale-plan-updates.md` section 3, `docs/designs/anthonystevenson0-built-to-scale-1a-one-code-path.md` (the architecture this builds on; nothing in it is redesigned).

This document is design only. No code, no pseudocode. Where the spec is ambiguous the assumption is stated inline and collected in section 4. Newsletter opt-in is out of scope by the owner's decision and is not designed here.

---

## 0. Shape of the change

Release 1a gates the full view per run: name, email and company on every tool, every time. After this release a visitor gives an email once, holds a signed cookie that unlocks every tool for 30 days, receives the full result by email with a saved link and a delete-my-data link, and can delete every run stored under that email with one click. The registry, pipeline stages, run store shape, routes and `ToolPage` state machine stay as 1a built them; this release adds a signing module, a mail module, an email template, a per-email index, two tokens and one cookie, and four touch points in the existing routes and page.

```
app/lib/tools/unlock-token.ts    sign and verify (HMAC-SHA256), hashEmail        pure, secret as argument
app/lib/tools/result-email.ts    renderResultEmail: subject, text, html         pure
app/lib/unlock.ts                env reader for UNLOCK_SECRET, cookie name and options, typed issue/verify helpers
app/lib/mail.ts                  the only nodemailer transport (result email and daily digest)
app/lib/runs.ts                  + emailStatus, emailedAt, runs:by-email:{hash}, listRunIdsByEmail, deleteRunsByEmail, recordEmailStatus
app/lib/events.ts                + result_emailed, data_deleted
app/lib/tools/pipeline.ts        detailRun honours cookie claims and the saved-link token; FreeView gains unlocked
app/api/tools/[tool]/score       reads the cookie, adds unlocked to the free view
app/api/tools/[tool]/unlock      email required, name and company optional; sets the cookie
app/api/tools/[tool]/details     verifies cookie and token, passes claims in, sends the email once
app/api/tools/data/delete        GET confirmation page, POST deletion, plain HTML
app/components/toolkit/ToolPage  email-first gate, skip when unlocked, restore from ?run= and ?t=
```

Three signed artefacts, one HMAC module, three purpose strings:

| Artefact | Purpose string | Claims | Expiry | Carried in |
| --- | --- | --- | --- | --- |
| Unlock cookie `summit_unlock` | `unlock-cookie` | `eh` (email hash), `iat` | 30 days, enforced on `iat` at verification and by the cookie `Max-Age` | httpOnly cookie |
| Saved link `t` | `saved-link` | `run` (run id), `iat` | none | query string of `/tools/{slug}?run=&t=` |
| Delete link `t` | `delete` | `eh` (email hash), `iat` | none | query string of `/api/tools/data/delete?e=&t=`, then a hidden form field |

No artefact ever carries an email address; only its SHA-256 hash.

---

## 1. Files to Modify / Create

Listed in implementation order, grouped into six phases. Each phase ends with a gate that must be green before the next starts. `npm test`, `npm run lint` and `npx tsc --noEmit` are expected green at every gate, run one after another (never `tsc` alongside `next build`; see the runbook caution); `npm run build` at the gates that say so. The 1a module resolution rule applies unchanged: files under `app/lib/**` import siblings with relative paths and the explicit `.ts` extension and import nothing from `next/*`, `react` or any component.

### Phase A: pure modules and their tests

| File | Change |
| --- | --- |
| `app/lib/tools/unlock-token.ts` (create) | Pure. Exports `signToken(secret, purpose, claims, nowSeconds?)` returning `base64url(payload) + "." + base64url(signature)` where the payload is the JSON of `{ v: 1, p: purpose, iat: nowSeconds, ...claims }` and the signature is HMAC-SHA256 over the exact payload bytes with `node:crypto`; `verifyToken(secret, purpose, token, { nowSeconds?, maxAgeSeconds? })` returning `{ ok: true, claims }` (the payload minus `v`, `p`, `iat`, plus `iat`) or `{ ok: false, reason }` with reason one of `malformed`, `signature`, `purpose`, `expired`; comparison with `timingSafeEqual` after a length check; `expired` when `maxAgeSeconds` is given and `iat + maxAgeSeconds < nowSeconds`; a non-string, a missing dot, a payload that is not JSON, a `v` other than 1, or a non-integer `iat` is `malformed`. Also exports `hashEmail(email)`: SHA-256 hex of the trimmed, lowercased address (the one normalisation every caller uses). Secret and clock are arguments so tests import it with no env. |
| `app/lib/tools/validate.ts` (modify) | `validateUnlock` requires a valid email only; `name` and `company` are trimmed and may be absent or empty, returned as `""`. The shape stays `{ ok: true, name, email, company }`. Error text "Please enter a valid email address." for a missing or malformed email. Nothing else changes. |
| `app/lib/tools/result-email.ts` (create) | Pure. Exports `renderResultEmail(args)` returning `{ subject, text, html }`. Args: `toolName`, `toolNumber`, `full` (the `FullView` shape: score, grade, gradeLabel, legacyLabel?, verdict, confidence, confidenceReason, scores, reasoning, recommendations, extras), `dimensions` (the registry entries for the tool: key, name, levels), `extrasMeta` (key, label, kind), `savedUrl`, `deleteUrl`. Content order in both text and HTML: tool name and number; score out of 100 and grade of 5 with label (and legacy label where present); verdict; confidence with reason; each dimension in registry order with score, level label and reasoning; recommendations (dimension name, score, gap, consequence, next action) or "Every dimension scored 4 or above."; each extra with its label (list extras as a bulleted list); "Your saved result" with the saved URL; "Delete my data" with the delete URL and one sentence saying it removes every result stored under this email; one closing line: "This result was produced automatically against Summit Strategy Advisory's rubrics." HTML is text-first: one column, system font stack, inline style attributes with `BRAND` hex values from `../brand.ts`, no images, no external CSS, every model-supplied string HTML-escaped (`&`, `<`, `>`, `"`). Dash rule: a `plainDashes` helper replaces an en or em dash between digits with " to " and any other en or em dash (with its surrounding spaces) with ", " in every model-supplied string before rendering, so the output never contains U+2013 or U+2014. Subject: "Your {toolName} result: {score} out of 100, grade {grade} of 5". British spelling, no hype words. |
| `__tests__/unlock-token.test.ts` (create) | A signed token verifies with the same secret and purpose and returns the claims; a changed payload character fails with `signature`; a changed signature character fails with `signature`; a token signed at `iat` verifies at `iat + maxAge` and fails with `expired` one second later; verification with another secret fails with `signature`; a token signed for `saved-link` fails for `unlock-cookie` with `purpose`; `verifyToken` with no `maxAgeSeconds` accepts a token ten years old; `malformed` for a string with no dot, for an empty string and for a non-JSON payload; `hashEmail` is case and whitespace insensitive and 64 hex characters. |
| `__tests__/validate.test.ts` (modify) | Replace "missing company is rejected" with: email alone is accepted and name and company come back as empty strings; optional fields are trimmed and returned; a bad email is still rejected; a non-object body is rejected (unchanged); keep every `validateInputs` and `renderInputs` test. |
| `__tests__/result-email.test.ts` (create) | With a fabricated full view for `moat` (two recommendations, one list extra, one text extra, a verdict containing `<b>` and an em dash, a reasoning line with "3" U+2013 "5"): subject names the tool, score and grade; text contains the tool name, score, grade label, verdict, confidence reason, every dimension name with its level label, every reasoning line, each recommendation's gap, consequence and action, the extras, both URLs and the automated line; html contains both URLs inside `href` and the escaped `&lt;b&gt;`; neither subject, text nor html contains U+2013 or U+2014; "3 to 5" appears where the dashed range went in. A second case with no recommendations renders the "scored 4 or above" line. |

**Gate A:** `npm test` green (the modified unlock test now expects email-only acceptance; nothing else in the suite references name or company), `npx tsc --noEmit`, `npm run lint` 0 errors. No route or page has changed yet; the unlock route still compiles because `validateUnlock`'s return shape is unchanged.

### Phase B: runs, mail, events, env helper

| File | Change |
| --- | --- |
| `app/lib/runs.ts` (modify) | `RunRecord` gains `emailStatus: "sent" \| "failed" \| null` and `emailedAt: string \| null`; `deserialise` defaults both to null; `serialise` needs no change (scalars). New key helper `emailIndexKey(emailHash)` = `runs:by-email:{emailHash}` (a set of run ids, no TTL). `markUnlocked` additionally SADDs the run id to that set (this is the index the spec calls "existing"; it does not exist in 1a, see assumption 4.3). New `listRunIdsByEmail(emailHash)` (SMEMBERS). New `deleteRunsByEmail(emailHash)`: SMEMBERS, then one pipeline with DEL `run:{id}` per id, ZREM `runs:by-time` for all ids, DEL the set; returns the number of run hashes that actually existed (sum of the DEL replies for `run:*`), zero when the set is empty. New `recordEmailStatus(id, status)`: HSET `emailStatus`, and `emailedAt` to now when `status` is `sent`. `RunUnlock` is unchanged; a cookie unlock stores `email`, `name` and `company` as `""`. |
| `app/lib/events.ts` (modify) | `EventName` gains `result_emailed` and `data_deleted`. Nothing else changes. |
| `app/lib/mail.ts` (create) | The only file that imports `nodemailer`. Exports `isMailConfigured()` (true when `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` are all set), `sendMail({ from, to, subject, text, html?, timeoutMs? })` which creates a transport per call exactly as the daily report does today (host, port, `secure` when port is 465, auth) and, only when `timeoutMs` is given, sets nodemailer's `connectionTimeout`, `greetingTimeout` and `socketTimeout` to it; returns nothing, throws on failure (callers decide). Exports `resultFromAddress()` returning `RESULT_FROM_EMAIL` or `SMTP_USER`. Never logs credentials. |
| `app/api/admin/daily-report/route.ts` (modify, minimal) | Replace the inline `nodemailer.createTransport` and `sendMail` with `sendMail` from `app/lib/mail.ts` with the same `from`, `to`, `subject` and `text` and no timeout; keep its own `NOTIFY_EMAIL` check, its 500 responses and its silent zero-lead return. The per-lead line tolerates empty fields: name absent prints the email alone, company absent drops the trailing separator; the em dash in that line goes (it is touched copy). The rule lines made of U+2500 stay (not a dash). Behaviour is otherwise identical. |
| `app/lib/unlock.ts` (create) | The one reader of `UNLOCK_SECRET`. Exports `UNLOCK_COOKIE = "summit_unlock"`, `UNLOCK_MAX_AGE_SECONDS` (30 days), `getUnlockSecret()` (returns the trimmed value or null; on null logs `console.warn("UNLOCK_SECRET is not set: unlocks are recorded but no cookie, saved link or result email is issued")` once per instance), `unlockCookieOptions()` (httpOnly, `secure` when `NODE_ENV` is `production`, `sameSite` lax, path `/`, `maxAge` 30 days; same shape as `sessionCookieOptions` in `auth.ts`), `issueUnlockCookie(emailHash)` and `verifyUnlockCookie(value)` (purpose `unlock-cookie`, `maxAgeSeconds` 30 days, returns `{ emailHash }` or null), `issueSavedLinkToken(runId)` and `verifySavedLinkToken(token, runId)` (purpose `saved-link`, no expiry, true only when the claim `run` equals `runId`), `issueDeleteToken(emailHash)` and `verifyDeleteToken(token, emailHash)` (purpose `delete`, no expiry, true only when the claim `eh` equals `emailHash`). Every issue helper returns null when the secret is unset; every verify helper returns null or false when it is unset. Imports only `./tools/unlock-token.ts`; no `next/*`. |

**Gate B:** `npx tsc --noEmit`, `npm run lint`, `npm test` green; `npm run build` green (confirms `app/lib/mail.ts` bundles and the daily report route still compiles). Call `GET /api/admin/daily-report` locally with `CRON_SECRET` unset and SMTP unset: the zero-lead path returns the same JSON as before; with one unlock in the list and SMTP unset it returns the same 500 "SMTP not configured" as before.

### Phase C: pipeline and the three routes

| File | Change |
| --- | --- |
| `app/lib/tools/pipeline.ts` (modify) | `PipelineContext` gains optional `cookieUnlock?: { emailHash: string }` (verified claims the route passes in) and `linkVerified?: boolean` (the saved-link token verified for this run id). `FreeView` gains `unlocked: boolean`; `toFreeView` sets it to `run.unlock !== null`. `detailRun` authorisation becomes: unlocked when `run.unlock` is set, or `ctx.cookieUnlock` is set, or `ctx.linkVerified` is true; otherwise `UnlockRequiredError`. When `run.unlock` is null and `ctx.cookieUnlock` is set, `detailRun` calls `markUnlocked(run.id, { emailHash, email: "", name: "", company: "", at: now })` before anything else and continues with the updated run. When `run.unlock` is null and only `linkVerified` is true (not expected in practice; see 3.3), details are generated without recording an unlock. The stored full view early return (`detailsAt` set) stays first. `full_view_opened` gains `via: "form" \| "cookie" \| "link"` (form when the run already had an unlock, cookie when the cookie recorded it, link when the token authorised). `detailRun` returns `{ full, run, generated }` where `generated` is true when this call produced the details (false on the stored early return). `scoreRun` is unchanged. The pipeline reads no cookie, header or env. |
| `app/api/tools/[tool]/unlock/route.ts` (modify) | Body `{ runId, email, name?, company?, website }`. `validateUnlock` (400 on bad email only). `hashEmail` from `unlock-token.ts` replaces the inline `createHash`. `markUnlocked` as before (now also indexes by hash). `gtm-unlocks` RPUSH keeps the same keys with `name` and `company` as `""` when absent. `track("email_given", { tool, runId, emailHash })` unchanged. Response `{ ok: true, unlocked: boolean }` with `unlocked` true when a cookie was issued; when `getUnlockSecret()` returns a secret, set `UNLOCK_COOKIE` to `issueUnlockCookie(emailHash)` with `unlockCookieOptions()`; when null, no cookie and `unlocked: false`. Honeypot and 404 paths unchanged. |
| `app/api/tools/[tool]/score/route.ts` (modify) | After `scoreRun`, read `req.cookies.get(UNLOCK_COOKIE)?.value`, `verifyUnlockCookie`, and respond with `{ ...free, unlocked: free.unlocked \|\| claims !== null }`. Nothing before `scoreRun` changes; the honeypot answer stays `{ ok: true }`. |
| `app/api/tools/[tool]/details/route.ts` (modify) | Body `{ runId, token? }`. Order in section 3.3. Sends the result email once per run after a generated full view (section 3.4) and responds with `{ ...full, emailed: boolean }`. `maxDuration` stays 60. |
| `app/api/tools/[tool]/errors.ts` (no change) | `UnlockRequiredError` still maps to 403 with the same message. |

**Gate C:** build, lint, tsc, tests green. `curl` smoke against `npm run dev` with `UNLOCK_SECRET` set and SMTP pointed at a test inbox (or unset, in which case the log shows the send recorded as `failed` and the flow still completes): score returns `unlocked: false`; unlock with email only returns `{ ok: true, unlocked: true }` and a `Set-Cookie: summit_unlock=...; HttpOnly; SameSite=Lax; Max-Age=2592000; Path=/`; details with that cookie returns the full view and `emailed: true`, and the run hash shows `emailStatus: sent`, `emailedAt` and the email arrives with both links; a second details call returns the stored view with `emailed: false` and no second email; a fresh score with the cookie returns `unlocked: true`; details on that fresh run with the cookie returns the full view, the run's `unlock` holds the hash with empty name and company, and `runs:by-email:{hash}` lists both ids; details with the saved-link token and no cookie returns the stored view; details with a token for a different run id, no cookie, returns 403; a tampered cookie behaves as no cookie; with `UNLOCK_SECRET` removed, unlock returns `unlocked: false` and no `Set-Cookie`, details after it still returns the full view, no email is attempted and the run shows `emailStatus: failed` with the warning logged once.

### Phase D: ToolPage and the saved-result loader

| File | Change |
| --- | --- |
| `app/components/toolkit/ToolPage.tsx` (modify) | Section 2.4 has the state changes. Gate copy and fields: email (required, type email), name (optional), company (optional), honeypot unchanged. Submit enabled when the email matches the same regex `validateUnlock` uses. On score: if `free.unlocked` is true, skip `scored` and go straight to `unlocking`, then request details with no token; a 403 falls back to `scored` so the form shows (cookie expired or secret rotated between the two calls). On unlock success, request details as today. A shared `requestDetails(runId, token?)` replaces the inline details fetch. When the details response has `emailed: true`, the full view shows one line under the result block: "A copy of this result is on its way to your inbox, with a saved link and a delete-my-data link." A child component `SavedResultLoader` (same file) wrapped in `<Suspense fallback={null}>` reads `run` and `t` with `useSearchParams`; when both are present and `run` matches the run id pattern, it starts the details request in an effect and hands the result to the page only in the async continuation (never a synchronous setState in the effect body, per the `react-hooks/set-state-in-effect` rule the 1a review noted). On success the page enters `full` with `free` and `full` populated from the full view and `savedMode` true, which hides the input section until "Score again" is pressed and shows one line above the results: "This is your saved result. Score again to run a fresh evaluation."; on any failure (403, 404, network) the page stays in `input` with no error message, which is the normal page. |

**Gate D:** build, lint, tsc, tests green. In the browser against `npm run dev`: on `/tools/moat` the gate shows email, name (optional), company (optional) and the one-line purpose copy; unlocking with email only shows the full view and the emailed line; opening `/tools/persona` and scoring skips the gate and shows the full view; the emailed saved link opens the full view for that run with the inputs hidden and the saved notice; the same link with one character changed in `t` shows the normal empty page; clearing cookies and scoring shows the gate again. `/tools/moat` is still listed as a static page in the build output (the `useSearchParams` child did not make the page dynamic).

### Phase E: the delete flow

| File | Change |
| --- | --- |
| `app/api/tools/data/delete/route.ts` (create) | `runtime nodejs`, `dynamic force-dynamic`. GET and POST both return `text/html; charset=utf-8` with `Cache-Control: no-store`. GET: read `e` (must be 64 lowercase hex) and `t` from the query; `verifyDeleteToken(t, e)`; invalid → 400 with the "This link is not valid" page (no form); valid → 200 with the confirmation page: heading "Delete my data", two sentences ("This removes every result stored under your email address from Summit's tools. The emails already sent to you are not recalled."), a form with `method="POST"`, `action` the same path, hidden `e` and `t`, and one button "Delete my data". POST: `req.formData()`, same validation and verification (400 page when invalid); `deleteRunsByEmail(e)`; `track("data_deleted", { count })` with the count only, never the hash; if the request carries a `summit_unlock` cookie whose verified hash equals `e`, clear it on the response (`Max-Age` 0, same options); 200 with the "Done" page: "Done. {count} result{s} deleted." (or "Done. There was nothing stored under this address." when zero) and a link back to `/tools`. All three pages are one HTML string each built by a local `renderPage({ title, body })` function: `<!doctype html>`, viewport meta, system font stack, inline style attributes with `BRAND` hex values, no `<script>`, no external stylesheet, the Summit name as plain text in a header band. `e` and `t` are HTML-escaped when echoed into hidden fields even though they are validated. Nothing is appended to `gtm-unlocks`. |

Route precedence: `app/api/tools/data/delete/route.ts` is a static segment under `app/api/tools/`; `[tool]` only matches a single segment followed by `score`, `details` or `unlock`, so `/api/tools/data/delete` cannot be captured by the dynamic route. The Coder confirms with a request in Gate E.

**Gate E:** build, lint, tsc, tests green. With a run unlocked under a test address: open the delete link from the email in a browser: the confirmation page renders with no JavaScript (check the page source has no `<script>`); press the button: the Done page reports the count, `run:{id}` is gone, the id is gone from `runs:by-time`, `runs:by-email:{hash}` is gone, the `events` stream has one `data_deleted` entry with `count` only, and `LLEN gtm-unlocks` is unchanged; opening the same link again renders Done with "nothing stored"; a link with a changed `e` renders the invalid page; a POST without `t` renders the invalid page.

### Phase F: env and docs

| File | Change |
| --- | --- |
| `.env.example` (modify) | New section "Unlock gate and emailed results": `UNLOCK_SECRET` (required in production; "generate with: openssl rand -hex 32"; signs the 30 day unlock cookie, the saved link and the delete link; rotating it logs every visitor out and breaks every emailed link; when unset, unlocks still work per run, no cookie or email is sent and the server warns once), `RESULT_FROM_EMAIL` (optional; the From address on the emailed result; defaults to `SMTP_USER`). No dashes in comments. |
| `docs/runbook.md` (modify, Docs agent) | Entry "Built to Scale? Release 1b: gate, cookie, emailed result and delete flow": trigger, the three signed artefacts and their purposes, cookie name and options, where the 30 days is enforced, the details route order, the email send rules and `emailStatus`, the new Redis key `runs:by-email:{hash}`, the delete route and what it does and does not remove (`gtm-unlocks` stays), the two new events, the two env vars, failure modes (secret unset, SMTP unset, send timeout, invalid link), how to disable (unset `UNLOCK_SECRET` to fall back to per-run unlocks), and the preview deployment notes from section 7. |

**Gate F:** `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` green, one after another; `git status` shows only the intended files; `grep -rn "process.env.UNLOCK_SECRET" app` matches `app/lib/unlock.ts` only; `grep -rln "nodemailer" app` matches `app/lib/mail.ts` only; no file in the Release 2 list (section 5) is in the diff.

---

## 2. Integration Points

### 2.1 Token module surface (`app/lib/tools/unlock-token.ts`)

- `signToken(secret, purpose, claims, nowSeconds?)`: `claims` is a flat object of strings and numbers; `nowSeconds` defaults to the current time in whole seconds; the payload key order is `v`, `p`, `iat`, then the claims in the order given, so the same inputs always produce the same token (tests rely on this).
- `verifyToken(secret, purpose, token, options?)`: `options.nowSeconds` defaults to now, `options.maxAgeSeconds` is optional; the check order is malformed, signature, purpose, expired, so a tampered token never reveals whether its purpose or age would have passed.
- `hashEmail(email)`: SHA-256 hex of `email.trim().toLowerCase()`.
- Base64url without padding for both halves, matching what cookies and query strings carry without escaping.

### 2.2 Server helper surface (`app/lib/unlock.ts`)

Listed in Phase B. The three routes and the delete route import only this helper plus `UNLOCK_COOKIE`; none of them touches `UNLOCK_SECRET` or the token module directly. The pure module and the helper are separate so tests import the pure one with no env and so the "where is the secret read" grep has one answer.

### 2.3 Run store additions (`app/lib/runs.ts`)

| Key | Type | Content | TTL |
| --- | --- | --- | --- |
| `runs:by-email:{emailHash}` | set | run ids unlocked under that hash (form or cookie) | none |

`markUnlocked` writes `unlock`, PERSISTs the run and SADDs the id. The index is written from this release on; runs unlocked under 1a are not in it (section 7, risk 7). `deleteRunsByEmail` reads only this set, never scans `runs:by-time`. `listRunIdsByEmail` is also used by the details route to find an address for a cookie-unlocked run (section 3.4).

Run record fields added: `emailStatus` (`sent`, `failed` or null) and `emailedAt` (ISO or null). Nothing else in the record changes; a cookie unlock fills `RunUnlock` with the hash and empty strings.

### 2.4 `ToolPage` state and calls

Phases stay `input`, `scoring`, `scored`, `unlocking`, `full`, `error`. New state: `savedMode` (boolean), `emailed` (boolean). Calls:

1. Score: POST `/api/tools/{slug}/score` with `{ inputs, website, rerunOf? }` (unchanged). Response now carries `unlocked`. If true: phase `unlocking`, then step 3 with no token. If false: phase `scored`, gate shown.
2. Unlock: POST `/api/tools/{slug}/unlock` with `{ runId, email, name, company, website }` where name and company may be empty strings. On `{ ok }`: step 3.
3. Details: POST `/api/tools/{slug}/details` with `{ runId }` or `{ runId, token }`. On 200: phase `full`, `emailed` from the response. On 403 from step 1's path: phase `scored` (the gate). On 403 or 404 from the saved-link path: phase `input`, nothing shown. Other errors: `ErrMsg` with retry as today.
4. Saved link: `SavedResultLoader` reads `run` and `t`; if present, step 3 with the token, `savedMode` true on success. The hub's `LegacyToolRedirect` is the pattern: a child under `Suspense` so the static page keeps rendering statically.

The browser sends the cookie automatically on every same-origin call; the page never reads or stores it. The page never sees an email hash.

Gate copy (final): heading "Unlock the full view"; line under it: "We use your email to send you this result and to unlock every tool for 30 days. Nothing else."; fields "Email", "Name (optional)", "Company (optional)"; button "Unlock and email my result"; footnote: "Your result arrives by email with a saved link and a delete-my-data link. No spam, no third-party sharing." followed by the existing privacy address.

### 2.5 Details route body and response

Request `{ runId: string, token?: string }`. Response: the `FullView` plus `emailed: boolean` (true only when this request sent the email). Errors unchanged: 400, 404, 403, 429, 502, 503, 500 through `errorResponse`.

### 2.6 Mail module and the daily report

`sendMail` is the only transport. The daily report passes `from: NOTIFY_EMAIL`, `to: NOTIFY_EMAIL`, its subject and text, and no timeout, so its behaviour (including nodemailer's default timeouts) is unchanged. The result email passes `from: resultFromAddress()`, `to` the visitor address, `timeoutMs` from the budget rule in 3.4.

### 2.7 Events

| Event | Props | Where |
| --- | --- | --- |
| `email_given` | `tool`, `runId`, `emailHash` | unlock route (unchanged) |
| `full_view_opened` | `tool`, `runId`, `via` (`form`, `cookie`, `link`) | `detailRun`, only when details are generated (unchanged timing, new prop) |
| `result_emailed` | `tool`, `runId`, `emailHash` | details route after a successful send |
| `data_deleted` | `count` | delete route POST |

---

## 3. Data Flow

### 3.1 Unlock (form)

Input: `{ runId, email, name?, company?, website }`. Parse (400); honeypot (silent `{ ok: true }`); slug public (404); `validateUnlock` (400 on bad email); `getRun` and tool match (404); `emailHash = hashEmail(email)`; `markUnlocked` (HSET `unlock`, PERSIST, SADD index); RPUSH `gtm-unlocks` `{ id, tool, name: name or "", email, company: company or "", unlockedAt }` (failure logged, not fatal); `track("email_given")`; secret present → `Set-Cookie` with `issueUnlockCookie(emailHash)`; respond `{ ok: true, unlocked }`.

A second unlock on the same run overwrites the unlock fields and re-appends to `gtm-unlocks`, as in 1a. An unlock from a browser that already holds a cookie (only possible by direct POST, since the page skips the gate) simply issues a fresh cookie for the new address.

### 3.2 Score with a cookie

Unchanged through `scoreRun`. Afterwards: read the cookie, `verifyUnlockCookie`, respond `{ ...free, unlocked }`. No write to the run at score time; the unlock is recorded at details time (spec 3). The page therefore calls details immediately, which records it.

### 3.3 Details route, exact order

1. Parse the body (400). Slug public (404). `runId` present (400).
2. Read the cookie value and `verifyUnlockCookie` → `cookieUnlock` or null. Read `body.token` and `verifySavedLinkToken(token, runId)` → `linkVerified` boolean. Both are plain string checks; no Redis yet.
3. `getRun` (404), tool match (404).
4. If `run.detailsAt` is set: respond the stored full view with `emailed: false`, before the limiter, as in 1a. (A run can only have details after an unlock, so `run.unlock` is always set here; the 1a check is kept as is.)
5. If `run.unlock` is null and `cookieUnlock` is null and `linkVerified` is false: 403.
6. Limiter (429), unchanged.
7. `detailRun(runId, { source: "web", ip, cookieUnlock, linkVerified })`. Inside: authorise (step 5 again, defensively); if `run.unlock` is null and `cookieUnlock` is set, `markUnlocked` with the hash and empty strings (PERSIST and index); stored early return (not reachable here, kept); rubric, model call, parse, persist (unchanged); `track("full_view_opened", { via })`; return `{ full, run, generated: true }`.
8. If `generated` is true and `run.emailStatus` is null: section 3.4. Otherwise no email.
9. Respond `{ ...full, emailed }`.

Why the cookie unlock is recorded inside `detailRun` rather than in the route: the spec places it in the pipeline, the pipeline already owns the run write, and the calibration script and any future caller get the same rule. The route only verifies and passes claims.

### 3.4 Sending the result email, once

Preconditions: this request generated the details, `run.emailStatus` is null (checked on the record read in 3.3 step 3 and again on the record `detailRun` returns), the secret is set (otherwise no links can be signed), and an address can be resolved:

- Form unlock: `run.unlock.email` is non-empty; use it.
- Cookie unlock: `run.unlock.email` is empty; `listRunIdsByEmail(run.unlock.emailHash)`, read the ids newest first (one pipeline `hgetall`), take the first run whose `unlock.email` is non-empty. None found (the visitor deleted their data, or the index is empty): no address, record `failed`, log "no address on record for hash {first 12 chars}".

Steps: build `savedUrl = {origin}/tools/{slug}?run={runId}&t={issueSavedLinkToken(runId)}` and `deleteUrl = {origin}/api/tools/data/delete?e={emailHash}&t={issueDeleteToken(emailHash)}` where `origin` is `req.nextUrl.origin`; `renderResultEmail(...)`; time budget: `remaining = 58 s minus the time since the route started`; if `remaining` is under 2 s, do not attempt and record `failed` with the log "no time budget for email"; else `sendMail` with `timeoutMs = min(10 s, remaining)`; success → `recordEmailStatus(id, "sent")`, `track("result_emailed", { tool, runId, emailHash })`, `emailed = true`; any throw (including "SMTP not configured", which `sendMail` throws when `isMailConfigured()` is false) → `console.error` with the error message and the hash prefix, never the address, `recordEmailStatus(id, "failed")`, `emailed = false`. The response goes out either way; the email never fails the request.

"Once": the status on the record is the guard. The second request for the same run hits the stored early return (step 4) and never reaches this section. Two concurrent first requests could both generate details and both send; that race already exists for the model call in 1a and is accepted (section 7, risk 9). A `failed` status is final in this release; there is no resend path.

### 3.5 Saved link

`/tools/{slug}?run={runId}&t={token}` → the static page renders → `SavedResultLoader` → details with the token → the route verifies the token against that run id only → stored full view (the email is only ever sent after details exist, so this is always the early return in practice) → `full` with `savedMode`. Invalid token → 403 → normal page. Expired run (deleted or never persisted) → 404 → normal page. The token has no expiry; it is bound to one run id and useless for any other run or for the delete route (different purpose).

### 3.6 Delete link

GET `/api/tools/data/delete?e=&t=` → validate shapes → `verifyDeleteToken(t, e)` → confirmation page → POST with the same `e` and `t` as hidden fields → verify again → `deleteRunsByEmail(e)` → `track("data_deleted", { count })` → clear the cookie if its hash matches → Done page. Errors: invalid shape or token → 400 invalid page; Redis failure → 500 page "Something went wrong. Please try the link again in a few minutes." (logged). The delete token has no expiry so an old email's link still works; it only ever deletes data under its own hash, so a leaked link cannot touch anyone else's data.

### 3.7 Daily digest

Unchanged read of `gtm-unlocks` and `icp-unlocks`; entries now carry `name` and `company` as empty strings for 1b unlocks and both present for 1a-era entries; the formatter omits empty parts. Cookie unlocks do not append to `gtm-unlocks` (the digest is a lead report; the lead was reported when the email was first given), so the dashboard's "Emails captured" count keeps meaning first-time captures.

---

## 4. Key Decisions

1. **One HMAC module, three purpose strings, claims as a flat object.** Alternative: three separate token formats or a JWT library. Chosen because `node:crypto` is already present (no new dependency), the purpose string inside the signed payload makes a saved-link token useless as a cookie or delete token, and one `verifyToken` means one set of tests covers tampering, expiry and purpose for all three.

2. **30 days enforced twice: `iat` plus `maxAgeSeconds` at verification, and `Max-Age` on the cookie.** The payload check is authoritative (a cookie copied to another client after its `Max-Age` still fails); `Max-Age` is what makes the browser drop it. Saved and delete links carry `iat` for auditability but no `maxAgeSeconds` is applied, per the spec's "no expiry".

3. **Cookie payload is `eh` and `iat` only; the cookie unlock records `email: ""` on the run.** Alternative: look up the address at unlock time and copy it onto the run. Rejected because the spec says the pipeline records the email hash only, and keeping the record literal makes "what does a cookie unlock store" a one-line answer. Consequence: the address for the emailed result on a cookie-unlocked run is resolved at send time from a sibling run under the same hash (decision 5).

4. **The per-email index is created in this release.** The spec calls it "the existing per-email set"; 1a has no such set (its decision 14 deferred it). Assumption: `runs:by-email:{hash}` is the intended set, written by `markUnlocked` from now on. Runs unlocked before this deploy are not in it; see risk 7.

5. **Cookie-unlocked runs are emailed too, with the address resolved from the index.** Alternative: email only form-unlocked runs. Rejected because the objective is that every result survives a closed tab, and the address is on record under that hash from the first unlock. The cost is one SMEMBERS and one pipelined read on the first details of a cookie-unlocked run. When the index holds no address (data deleted), the send is recorded `failed` and the visitor sees the full view without the emailed line.

6. **Saved-link and delete links use the request origin.** Alternative: `entry.seo.canonical` (always production). Chosen so a preview deployment emails links to itself rather than to production, where the run may be in a different Redis. Production requests carry the production host. Risk 1 covers previews behind Vercel Authentication.

7. **`useSearchParams` in a Suspense-wrapped child, not server `searchParams`.** `/tools/[tool]` is statically generated from `PUBLIC_TOOLS`; reading `searchParams` in the server page would opt every tool page out of static rendering for an edge case. The hub already uses the child-under-Suspense pattern for `?tool=`, so this is the house way. The build output at Gate D confirms the pages stay static.

8. **Delete pages are route handlers returning HTML, not an App Router page with a server action.** Alternative: a page under `app/tools/data/delete`. Rejected because a React page ships the client runtime even when the form would work without it, the admin refresh already uses a plain form POST to a route handler, and the spec puts the URL under `/api/`. Three static HTML strings with inline styles satisfy "no client JavaScript beyond the form".

9. **The email is sent from the route, after `detailRun`, with a time budget.** Alternative: send inside the pipeline. Rejected so the pipeline stays free of transport concerns and the calibration script never emails. The budget rule (58 s minus elapsed, capped at 10 s, skipped under 2 s) keeps the request inside `maxDuration = 60` even after the 1a worst case of about 55 s for the model call; the visitor still gets the full view, and the send is recorded `failed`.

10. **`detailRun` returns `{ full, run, generated }`.** Alternative: keep returning `FullView` and re-read the run in the route to decide on the email. Rejected to avoid a second Redis read and to make "did this call generate the details" explicit rather than inferred from timestamps.

11. **No secret means no cookie, no saved link and no email.** Alternative: send the email without links. Rejected because an email that says the result is stored but offers no delete link breaks the privacy promise on the gate. The unlock still records per run (1a behaviour) and the warning logs once, so a misconfigured environment is visible but not broken.

12. **The delete POST also clears a matching unlock cookie.** Not in the spec; added because a visitor who deletes their data would otherwise keep a 30 day cookie whose hash now points at nothing, and would be silently re-indexed on their next details request. Only a cookie whose verified hash equals `e` is cleared; a different visitor's cookie on the same browser is left alone. Flagged for the human.

13. **"Second device" needs no server state.** Each form unlock issues an independent cookie; two devices hold two valid cookies with the same hash; nothing revokes them except expiry, secret rotation or the delete flow clearing the one it sees. No session store is added.

14. **`gtm-unlocks` is not purged on delete.** The spec limits deletion to the run store and the two indexes and says to append nothing; an LREM over a growing list would need a scan. Flagged as a privacy gap in section 6 for the human to decide on separately.

15. **Dashes in model output are normalised in the template, not the prompt.** The constraint applies to generated copy; the prompts are unchanged by constraint, so the template is the one place that can guarantee no en or em dash reaches the email.

Assumptions collected: 3, 4, 5, 6, 12, plus: the cookie name is `summit_unlock`; `RESULT_FROM_EMAIL` falls back to `SMTP_USER` and not to `NOTIFY_EMAIL`; the `emailed` and `unlocked` response flags are route-level additions and not part of the stored record; `source` on the run stays `web` for cookie unlocks; the saved notice and the emailed line are the only new visible copy on the full view.

---

## 5. Constraints Honoured

- **No new dependencies.** `node:crypto` for HMAC and hashing; `nodemailer` already present and now imported from one file. `package.json` is untouched.
- **Secrets via env only; never log an address in full.** `UNLOCK_SECRET` is read in `app/lib/unlock.ts` only; SMTP variables in `app/lib/mail.ts` and the daily report's own presence check. Logs carry the first 12 characters of the hash, never the address; `data_deleted` carries a count only; `email_given` and `result_emailed` carry the hash as 1a already does.
- **Newsletter opt-in out of scope.** `/api/newsletter/signup` and `NewsletterCapture` are not in the file list and not in the gate.
- **No change to scoring, rubrics, routing, `llm.ts`, `rubrics.ts`; `scoreRun` only gains the flag.** `scoreRun` is untouched; `toFreeView` gains `unlocked`; the score route adds the cookie read after the call. `schema.ts`, `scoring.ts`, `routing.ts`, `llm.ts`, `rubrics.ts` are not in the diff.
- **Styling.** `ToolPage` keeps inline `BRAND` style objects; the email and the delete pages use inline style attributes with `BRAND` hex values; no Tailwind utilities; `CyclingLoader`, `ErrMsg`, `ResultBlock`, `GtmDimensionBar` reused unchanged.
- **British spelling, no em or en dashes, no hype words.** All new UI, email and page copy is written to this; the template strips dashes from model text; the touched digest line loses its em dash; the test asserts the email output has none.
- **Tests pure and offline.** New tests import `unlock-token.ts`, `validate.ts`, `result-email.ts` and the registry only; none imports `runs.ts`, `mail.ts`, `unlock.ts` (env), `pipeline.ts` or any route. The deletion helper has no separable pure logic beyond key naming, so it is covered by the Gate E smoke rather than a unit test (stated in section 6).
- **`maxDuration = 60` kept; the send cannot push past it.** Decision 9 and section 3.4: the send starts only after the full view is computed and persisted, with a transport timeout of at most 10 s and never more than the remaining budget.
- **Cookies and tokens httpOnly and signed; no address in a cookie.** Cookie options in `unlockCookieOptions`; every artefact is HMAC-signed; payloads carry the hash only. The `secure` flag follows `NODE_ENV` as `auth.ts` does (risk 2).
- **Release 2 files untouched.** This release does not edit `app/lib/tools/registry.ts`, `app/lib/ceiling.ts`, `app/components/toolkit/shared/extras.tsx`, anything under `calibration/`, or the hub copy in `ToolkitHub.tsx` and `app/tools/page.tsx`. The template reads dimension names and extra labels from the registry at call time through the route; the registry file itself is not changed. Gate F greps the diff for these paths.
- **Pipeline reads no cookies or headers.** `PipelineContext` carries verified claims as plain data; the routes do the reading and verification.
- **Daily digest keeps working.** The unlock route appends the same keys with empty strings where absent; the report tolerates them and uses the shared transport with identical parameters.
- **Node 22.18+ type stripping and the module resolution rule.** All new lib files use relative `.ts` imports and import nothing from Next or React.

---

## 6. Out of Scope

- Newsletter opt-in and any change to `/api/newsletter/signup` or `NewsletterCapture` (owner's decision).
- Purging `gtm-unlocks` or `icp-unlocks` on delete, and recalling or editing emails already sent. The delete flow removes the run store entries and both indexes only, as specified. The owner should decide whether a visitor's delete request should also drop their `gtm-unlocks` entries; that needs an LREM over the list or a rebuild of the digest from the run store.
- A resend path for `emailStatus: failed`, an admin "resend" button, or a retry queue.
- Backfilling `runs:by-email:{hash}` for runs unlocked under 1a (risk 7).
- Showing `emailStatus` on `/admin/runs`, or any admin page change. The record carries the fields; the table is unchanged.
- Rate limiting the unlock or delete routes beyond what exists (none on unlock, none on delete; the delete route is idempotent and bound to a signed token).
- A unit test for `deleteRunsByEmail`: it is Redis calls and key names with no separable pure logic; covered by the Gate E smoke.
- Secret rotation with overlap (two accepted secrets). A rotation invalidates every cookie and link at once; documented in the runbook.
- Changing the email send to a background job; Vercel drops work after the response, so the send stays awaited.
- Any change to `scoreRun` beyond the `unlocked` flag, to prompts, or to the Release 2 files.

---

## 7. Risks and edge cases for the Reviewer

1. **Preview deployments behind Vercel Authentication.** The `summit_unlock` cookie is set on the preview host and works there for anyone who has passed Vercel's wall. Emailed links from a preview point at the preview origin (decision 6) and will show Vercel's login to a visitor without access. Previews should run with SMTP unset or pointed at a test inbox; the runbook says so. Production is unaffected.
2. **`secure` flag in local dev.** `NODE_ENV` is `development` under `npm run dev`, so the cookie is sent over `http://127.0.0.1:3000`; in production and preview it is `secure`. A production build run locally over http (`npm run build && npm start`) will set a `secure` cookie the browser will not return; the Gate C smoke uses `npm run dev`.
3. **Email send inside `maxDuration`.** Covered by the budget rule in 3.4; the Reviewer should confirm the elapsed clock starts at the top of the handler, not after `detailRun`.
4. **SMTP not configured.** `sendMail` throws, the run records `failed`, the visitor still gets the full view and no emailed line. Preview and local environments will show `failed` on every run; that is expected and logged once per run.
5. **1a unlocks (name and company present) versus 1b (optional).** `RunUnlock` is unchanged; `/admin/runs` renders empty strings as blank lines; the digest omits empty parts. A 1a-era run re-opened under 1b hits the stored early return and behaves as before.
6. **Daily digest reading empty strings.** Phase B formatter change; `JSON.parse` of the list entries is unchanged; entries with missing keys (none expected) would print `undefined`, so the formatter should treat a non-string as empty.
7. **Runs unlocked before this deploy are not in `runs:by-email`.** They received no email and therefore no delete link, so the only exposure is a visitor whose address was used under 1a and again under 1b: the delete removes the 1b runs and leaves the 1a run. Acceptable for now; a backfill (iterate `runs:by-time`, SADD by `unlock.emailHash`) is a ten-line script if the owner wants it.
8. **`UNLOCK_SECRET` unset in production.** Unlocks fall back to per run, no cookies, no emails, `failed` on every run, and one warning per instance. The runbook lists it as required; the Reviewer should confirm the warning text names the variable and not a value.
9. **Concurrent first details requests.** Two could both generate details and both send (3.4). Same race as 1a's double model call; not worth a lock in this release.
10. **Token bound to one run.** A saved-link token for run A sent with run B's id fails `verifySavedLinkToken` (claim mismatch) and the route 403s unless a cookie or unlock applies; the Gate C smoke covers it.
11. **Honeypot on the gate.** Unchanged; a filled honeypot on unlock answers `{ ok: true }` without `unlocked`, the page then requests details and gets 403, and falls back to the gate, which is what an autofill victim would see today.
12. **Stored early return before authorisation.** A stranger who knows a run id can read a full view that already exists, as in 1a (the id is 64 bits of entropy). Unchanged; noted so nobody reads the new token as closing it.
13. **HTML in the delete pages and the email.** `e` and `t` are echoed into hidden fields after validation; model strings are escaped in the email. The Reviewer should check both escaping paths and that no `<script>` appears in the delete pages' source.
14. **`react-hooks/set-state-in-effect`.** `SavedResultLoader` must set state only in the async continuation of its fetch; a synchronous `setPhase` in the effect body will fail lint.
15. **Static rendering of `/tools/[tool]`.** `useSearchParams` outside a Suspense boundary bails the whole page out of static rendering and fails the build with a clear message; Gate D checks the build output.
16. **Redis failure on the cookie unlock write.** If `markUnlocked` throws inside `detailRun`, the error maps to 500 and no model call is made; the visitor retries. If the write succeeds but `updateRun` later fails, the run is unlocked without details and the next request regenerates them; same as 1a.
