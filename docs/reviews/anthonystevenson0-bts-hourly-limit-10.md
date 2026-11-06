# Review: Built to Scale? score limit from 2 to 10 per IP per hour

Branch `anthonystevenson0/bts-hourly-limit-10`, cut from main at `2944817`. Design: `docs/designs/anthonystevenson0-bts-hourly-limit-10.md`. One review round.

## Round 1: APPROVE

Gates re-run by the Reviewer: `npm test` 426 pass in 132 suites, `npm run lint` 0 errors, `npx tsc --noEmit` clean, `npm run build` green with the edge share image route present. `npm run calibrate` not required: no rubric, prompt, model or scoring change.

### Acceptance criteria

All 5 PASS. `getBuiltToScaleLimiter` uses `slidingWindow(BTS_HOURLY_LIMIT, "1 h")` with the cap at 10 on the unchanged `rl:bts` prefix. The 429 message is byte-identical to the old one apart from the number and is now built from the same constant. The five runbook lines that state the cap say 10; two of them (367 and 406, "hourly tokens") were beyond the three named in the task and were right to change. No other limiter, route or copy changed.

### Constraints

All PASS. No new dependencies. British spelling and no dashes in added lines. Route order unchanged: parse, honeypot, validate, limiter, score. `built-to-scale-method.ts` has only type imports, so `ratelimit.ts` gains no runtime dependency; no edge route imports `ratelimit.ts`, and the edge share image already imported the method module.

### Test coverage

A pure test pins the cap at 10 and checks the message states it with no dashes, without loading Redis. The route's 429 path itself is untested, as before; left to a manual check after deploy.

### Notes for PR (non-blocking)

1. Spend: the per-IP ceiling rises from about 20 cents an hour to about 1 dollar an hour, roughly 24 dollars a day from one IP running flat out. There is no site-wide daily cap on this route; adding one is the follow-up if `ai:calls` shows abuse.
2. Existing `rl:bts` windows carry over, so an IP that used 2 runs has 8 left as soon as this deploys. Nothing needs clearing.
3. The 429 message now lives in `built-to-scale-method.ts` beside the other shared Built to Scale? copy.
4. A failed run still spends a token. Refunding it, or a synthesis-only retry, is a follow-up.
