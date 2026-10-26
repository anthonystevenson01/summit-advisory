# Review: Built to Scale? Release 3a, the page and the entry point

Branch `anthonystevenson0/built-to-scale-3a-page`, cut from main at `563b01a` after Release 2 merged. Design: `docs/designs/anthonystevenson0-built-to-scale-3a-page.md`. One review round.

## Round 1: APPROVE

Gates re-run by the Reviewer: `npm test` 234 pass, `npm run lint` 0 errors, `npx tsc --noEmit` clean, `npm run build` green (`/tools/built-to-scale` static, `/tools/[tool]` statically generated with six paths, method page, result page and its OpenGraph image dynamic, three new API routes). `__tests__/scale-up-advisory.test.ts` byte-identical to main and passing. `package.json` and `.env.example` untouched.

Owner-approved additions beyond the spec: the three Notion rows are Published; Unit of Value passed its three calibration cases and is public as Tool 06; Route to Buyer failed three cases on single-dimension moves greater than one point and stays hidden as Tool 07, treated as absent by the orchestration and named in the synthesis prompt; registry-derived copy reads six tools; one `unit-of-value` entry added to the scale-up stage map, which the untouched test requires.

### Acceptance criteria

All 14 PASS. The runbook entry is the Docs agent's deliverable.

### Constraints

All PASS. No new dependencies. Secrets via env; email failures logged through the address redaction; the prefill endpoint never returns unlock or email fields. Rubric and method text never from a request body. Every model call through `callModel` with a routing key; no model id outside `llm.ts`. Weights, bands and total in code; definitions in Notion. Inline BRAND styles plus `.bts-*` rules; no Tailwind utilities; no Oswald in the new components. British spelling, no dashes in new copy; the automated label is the verbatim section 7.3 text on the form, result, result page, email and method page. Tests pure and offline. `maxDuration = 60` on both routes with the synthesis refused under 15 seconds remaining, raced to the deadline, children stored before synthesis, and a 502 with a retry message if synthesis fails. Rate limit 2 per IP per hour on its own prefix. `llm.ts`, `rubrics.ts` and `pipeline.ts` changed only where the spec allows. Hidden tools treated as absent and named in the prompt.

### Test coverage

Registry invariants and the full `feeds` map; part validation and input composition; total and band at every boundary; synthesis schema shape and parser (four or six rows, duplicates, unknown dimensions, clamping, source filtering); the Built to Scale email template; the image data function; the rubric blocks converter; composite calibration comparison; hub copy and sitemap. Routes, the store and prompt assembly are covered by the Coder's live run: a real `scoreModel` run took 53 seconds, scored seven children, and produced 15 of 25 with every row citing a child id, matching the web route on the same inputs. Not executed locally (no Upstash): the 429, the unlock and details and email path, the composite 404 at the tool routes, the result page by cookie and by saved link, the admin chip; read and found to follow the 1b code.

### Notes for PR (non-blocking)

1. The `problem.evidence` input is capped at 2000 characters and the composed part heading adds about 50, so a 2000-character value-evidence part loses its tail in that one input; in quick mode the note and heading cost about 230. Raise `evidence.maxLength` or shorten the heading as a follow-up.
2. `UnlockGate.tsx` carries `var(--font-oswald)` lifted from ToolPage; switch to Barlow Condensed as a one-line follow-up.
3. `countRuns` now counts six children plus one composite per Built to Scale run; child events carry `source: "built-to-scale"` for filtering, the index count does not.
4. Partial working: if a child's full view fails, the page shows a per-tool fallback line and the result page keeps offering "Open the full view"; no email goes until every child succeeds, by design.
5. A failed synthesis still spends one of the two hourly tokens and leaves children pointing at a never-saved parent; a synthesis-only retry is the obvious follow-up.
6. `app/api/tools/[tool]/errors.ts` now imports the orchestration module, so the tool routes bundle it; harmless.
7. Calibration: Route to Buyer's three cases each moved more than one point on one dimension (Harbourline cost to win 4 to 2; Northfield buyer attention 2 to 4; Pennant gatekeeper 2 to 5). The owner decides whether the proposed grade or the rubric descriptor is wrong before the tool is unhidden.
8. Spec numbering had Route to Buyer as 06 and Unit of Value as 07; with the registry's contiguous-number rule they are swapped while Route to Buyer stays hidden.
