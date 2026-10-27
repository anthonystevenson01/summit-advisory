# Review: Built to Scale? Release 3b, Ask Summit to score it

Branch `anthonystevenson0/built-to-scale-3b-ask-summit`, cut from main after Release 4 merged. Design: `docs/designs/anthonystevenson0-built-to-scale-3b-ask-summit.md`.

## Round 1: REJECT

Gates re-run by the Reviewer on the working tree: `npm test` 336 pass, `npm run lint` 0 errors, `npx tsc --noEmit` clean, `npm run build` green with `/api/ask-summit/process` listed as a Node function and `/tools` still static. `scale-up-advisory.test.ts` byte-identical to main. Ten of eleven acceptance criteria passed and every constraint passed. One reachable bug blocked approval and one smaller logic gap against the design was flagged.

1. `app/api/admin/ask-summit/rerun/route.ts`: a failed rerun left the request record in `processing`. `claimProcessing` writes the state and the lock, but only the success path restored it; the `rerun-invalid` return, a thrown `scoreModel` and the outer catch all returned with the state still `processing`. After 15 minutes the queue would show a `done` request as stale with a "Process now" button, and the processing route's stale check or the button would reprocess it from scratch: a new crawl, a new extraction call, a new composite run and a second draft report under a new placeholder slug.
2. `app/components/toolkit/AskSummitPage.tsx`: a non-OK submit kept the request id, so a retry after a 400 re-uploaded every file under an id whose token count was already spent. With two or three files the upload cap tripped on the retry, the prospect saw a generic upload failure and needed a third attempt, and the earlier blobs were left as orphans. Design decision 4.13 says a retry mints a new id.

## Round 2: APPROVE

Three files changed since round 1 and nothing else: `app/api/admin/ask-summit/rerun/route.ts`, `app/lib/ask-summit/store.ts`, `app/components/toolkit/AskSummitPage.tsx`. Gates re-run by the Reviewer: `npm test` 336 pass, `npm run lint` 0 errors, `npx tsc --noEmit` clean, `npm run build` green. `scale-up-advisory.test.ts` byte-identical to main.

- Issue 1: `previousState` is captured from the one `getAskRequest` read before the claim. The `finally` runs on the `rerun-invalid` return, a thrown `scoreModel` and the outer catch, writes `{ state: previousState }` in its own try/catch (logged through `redactAddresses`), then releases the lock in a separate try/catch, so neither failure skips the other. The success path writes the same state, so the finally write is idempotent and cannot clobber `done`. `claimProcessing` gains `{ countAttempt?: boolean }`; the `SET NX EX 360` claim is unchanged and only the attempts counter is skipped. The processing route and `scripts/process-ask.ts` still count attempts; the rerun does not.
- Issue 2: `requestIdRef.current` is reset in the 503 branch, the generic non-OK branch and the fetch catch. The only path that keeps the id is a 200, where the form moves to done. Every retry mints a fresh id, as design decision 4.13 says.

### Acceptance criteria

All 11 PASS. The runbook entry is the Docs agent's deliverable.

### Constraints

All PASS. Dependencies limited to `@vercel/blob` 2.8.2, `@upstash/qstash` 2.12.1 and `fflate` 0.8.3, pinned exactly; no PDF library. Secrets from env in one module each; every log that can carry a transport error goes through `redactAddresses`; no response, email or event carries a blob url, pathname or token; the processing route verifies the QStash signature before parsing the body and has no bypass. No model id outside `llm.ts`; extraction on the `extraction` key, scoring and synthesis through `scoreModel`. Crawler: Summit user agent, robots honoured with longest prefix and a capped crawl delay, same host after one `www.`, 40 attempts, 1.5 MB, 10 s per page, queries dropped on followed links. Privacy: cron retention, delete-my-data covers requests, consent line complete, the 3a result page and details route 404 an ask-summit run without the admin session. Rate limits 2 per email and 5 per IP per day; 3 files, 25 MB, three types, enforced in the token, at submit and in the document stage. `maxDuration` 300 on the process route only. Inline BRAND styles, British spelling, no dashes in new source. `rubrics.ts`, the registry, `schema.ts`, the prompts and `scoreModel`'s stages untouched. `createReport` and the Release 4 editor reused.

### Test coverage

URL validation and same-host rule; the free-mail list with the exact message; extension and magic bytes including mismatched pairs; robots group selection, longest prefix, tie, wildcard prefix and crawl-delay cap; the stripper on a fixture with every dropped block; DOCX and PPTX on real in-memory zips including the cap and both error classes; the extraction schema (strict, five parts, enum, `additionalProperties: false` at every level) and parser (empty text kept, unknown or missing part and bad confidence rejected); the placeholder rule through `validateParts`; both email templates (fields, links, escaping, no dashes, redaction); retention and spend threshold at the boundary; the stage clock; the hash reader. Routes, the crawler's fetch loop, the rerun route and the client form are not pure modules and stay on the preview smoke list.

### Notes for PR (non-blocking)

1. `@vercel/blob` 2.8.2 cannot pin the access level in the server token, so "private" is set by the client upload call. The server never exposes a url, so only the uploader of their own file could choose public; the Blob store can also be set to private-only in the Vercel console. Runbook line.
2. `savePages` writes the whole crawl store (up to 1.5 MB JSON) as one Redis string; Upstash request-size limits vary by plan (1 MB on the free tier). A large site would fail the crawl stage at `savePages` with a clear message. Check on the preview with a large site, or lower `CRAWL_TEXT_CAP`.
3. The text-only extraction fallback only fires when the provider rejects the PDF within about 4 seconds, because the extraction minimum of 56 s must remain under the 60 s cap. A longer extraction cap is the lever if the fallback never fires.
4. `readBlob` uses the SDK's `get(url, { access: "private" })`, a public export in 2.8.2.
5. Reruns no longer increment `attempts`; the queue's Attempts column is the processing count only.
6. `countAskRequestsByState` and the retention cron scan the whole index, one HGETALL per request. Fine at the expected volume.
7. Magic bytes are checked in the document stage, not at submit, because that is the first point the server holds the bytes (design decision 2). Runbook line.
8. Preview smoke before merge, needing Blob, QStash, SMTP and Upstash: the token route with real bodies, an end-to-end submission to `done`, the pause switch on all routes, the three emails, the editor rerun including a forced scoring failure leaving the request `done`, Process now and Delete data, the retention route, the delete link covering requests, the spend alert, the 3a result page 404 in a private window, and Vercel Pro for the 300 s function.
