# Review: Built to Scale? Release 1a, one code path

Branch `anthonystevenson0/built-to-scale-1a-one-code-path`. Design: `docs/designs/anthonystevenson0-built-to-scale-1a-one-code-path.md`. Two review rounds.

## Round 1: REJECT

Gates verified by the Reviewer: `npm test` 117 pass, `npm run lint` 0 errors, `npx tsc --noEmit` clean, `npm run build` exit 0. All 13 acceptance criteria passed. Two constraints failed.

1. Em and en dashes remained in touched registry copy (`seo.description`, `seo.about`, `seo.howItWorks`, `seo.faqs`) beyond the five preserved SEO titles, and several strings still promised a letter grade A to F, a three-way verdict, or five moat dimensions that no longer exist.
2. `callModel` in `app/lib/llm.ts` used a 50 second client timeout and retried once on connection errors, and a timeout counts as one, so a route could run 100 seconds inside `maxDuration = 60`.

## Round 2: APPROVE

Both issues resolved on disk; only `app/lib/tools/registry.ts` and `app/lib/llm.ts` changed. Gates re-run by the Reviewer and green.

- Issue 1: dashes now appear only in the six `seo.title` lines (five public plus the hidden account title). Titles and canonicals byte-identical to main. Grade wording replaced with "a score out of 100 and a grade from 1 to 5". ICP and persona FAQ dimension lists match the registry. Positioning copy says the full view includes a suggested rewrite, which matches the details schema (the rewrite extra is required on every unlocked run).
- Issue 2: `CALL_TIMEOUT_MS = 25_000`, `RETRY_WINDOW_MS = 25_000`, no retry on `OpenAI.APIConnectionTimeoutError`, retry only when fewer than 25 seconds have elapsed. Worst case about 50 seconds on the 60 second routes.

### Acceptance criteria

All 13 PASS. See the design document for the mapping. The hidden account route also calls `callModel` directly (design decision 13, forced by the SDK removal).

### Constraints

All PASS. Secrets read in one module each. Rubrics never reach the browser. No model id outside `llm.ts`. Inline BRAND styling, no Tailwind utilities. British spelling, no dashes in touched copy except the preserved titles. Tests are pure and offline. Hidden tool mechanism, daily digest, sitemap and untouched areas confirmed.

### Test coverage

Registry invariants, grade bands at every boundary, weighted maths, schema generation and validator, routing resolution and reset, calibration comparison and skip reporting, unlock and input validation, hub order. The Redis, Notion and OpenRouter paths (`llm.ts`, `rubrics.ts`, `runs.ts`, `pipeline.ts`, `ToolPage` phases, admin pages) are not unit-testable by design. The Notion loader was exercised live by the orchestrator against the real database (five published rows load; a draft is refused). The run store and the OpenRouter call inside the pipeline have not run live.

### Notes for PR (non-blocking)

- The account route keeps `maxDuration = 30` but its worst-case `callModel` path is about 50 seconds. It is hidden and returns 404 before any call today; raise to 60 when re-enabled.
- `callModel` does an uncached `HGETALL admin:calibration` on every call; consider caching with the 30 second route config cache.
- `logCall` and `track` are fire-and-forget; on Vercel a promise started right before the response returns may be dropped, so `ai:calls` can occasionally miss an entry.
- `listRuns().total` is the whole index, not the filtered count, on `/admin/runs`.
- Admin "Reset to default" also deletes the `admin:calibration` field for that key. Conservative; documented in the runbook.
- Strict `json_schema` keywords `minimum`, `maximum`, `minItems`, `maxItems` have not been exercised against OpenRouter's Anthropic endpoint. If rejected, drop them from `schema.ts` (the parser already clamps) rather than changing the mode.
- The hub card for positioning says "suggested rewrite if needed" while the page says the full view always includes one. Cosmetic.
- Before merge the human should run the live smoke: score, details 403 before unlock, unlock, details full view, `/api/tools/account/score` 404, a body carrying `rubric` scores identically, plus the admin walk-through, since the Redis and OpenRouter paths have not run live.
