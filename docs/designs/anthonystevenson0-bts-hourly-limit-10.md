# Design: Built to Scale? score limit from 2 to 10 per IP per hour

Branch: `anthonystevenson0/bts-hourly-limit-10`
Requested: 6 November 2026, after a production outage used up the 2 allowed runs.

## 1. Files to Modify / Create

| File | Change | Why |
|---|---|---|
| `app/lib/tools/built-to-scale-method.ts` | Add two exports beside the other shared copy constants: `BTS_HOURLY_LIMIT` (the number 10) and `BTS_RATE_LIMIT_MESSAGE`, the 429 string built from that number: "Built to Scale? runs are limited to 10 an hour from one connection. Please try again later." | One pure definition that the limiter, the route and a test can all read, so the number and the message cannot drift apart again. |
| `app/lib/ratelimit.ts` | `getBuiltToScaleLimiter` uses `Ratelimit.slidingWindow(BTS_HOURLY_LIMIT, "1 h")`, imported from `./tools/built-to-scale-method.ts`. Prefix stays `rl:bts`. Comment reads "10 Built to Scale? runs per IP per hour (seven scoring calls plus one synthesis per run)". | AC1. |
| `app/api/built-to-scale/score/route.ts` | Delete the local `RATE_LIMIT_MESSAGE` and import `BTS_RATE_LIMIT_MESSAGE` from `@/app/lib/tools/built-to-scale-method` (already imported from there for `validateParts`). The doc comment says "`rl:bts`, 10 per IP per hour". Order of operations unchanged. | AC2. |
| `__tests__/built-to-scale-method.test.ts` | Add one `describe` block: `BTS_HOURLY_LIMIT` equals 10; `BTS_RATE_LIMIT_MESSAGE` contains "10 an hour" and has no em or en dash. | AC4; pins the cap without importing Redis. |
| `docs/runbook.md` | Five lines in the Built to Scale? entry, listed below. | AC3. |

Runbook edits (Built to Scale? entry only):

- Line 358 (routes bullet): "limiter `rl:bts` at 10 per IP per hour".
- Line 367 (synthesis failure bullet): "One of the visitor's ten hourly tokens is spent."
- Line 369 (rate limit bullet): "an eleventh run from one IP inside an hour answers 429" with the new message quoted exactly; last sentence "An office behind one NAT address shares the ten."
- Line 387 (`rl:bts` row): "The Built to Scale? score limiter, 10 per IP per hour".
- Line 406 (known limitations bullet): "A failed synthesis spends one of the ten hourly tokens ...".

Assumption: the task names lines 358, 369 and 387, but 367 and 406 also state the limit ("two hourly tokens") and would be wrong after the change. AC3 says lines that state the limit must say 10, so they are in scope. No other runbook line changes.

## 2. Integration Points

- `getBuiltToScaleLimiter()` is called only by `app/api/built-to-scale/score/route.ts`. The Ask Summit process route scores through `scoreModel` without this limiter and is unaffected.
- `ratelimit.ts` already imports a cap from a pure module (`BUILDER_DAILY_CAP` from `./project-builder/brief.ts`); the new import follows that precedent, using the relative `.ts` path the file already uses.
- `built-to-scale-method.ts` imports only types, so importing it from `ratelimit.ts` adds no runtime dependency and keeps it safe for the test runner.

## 3. Data Flow

Unchanged: parse body, honeypot, `validateParts` (400 before the limiter, so a malformed body spends no token), `limiter.limit(ip)` on `rl:bts`, then `scoreModel`. Over the limit: 429 with `BTS_RATE_LIMIT_MESSAGE`, `Retry-After: 3600`, `X-RateLimit-Remaining`. Without Upstash the limiter is null and every run is allowed, as before.

Existing windows: Upstash sliding window keys are `rl:bts:{ip}:{window}` and the limit is read at call time, so counts already in Redis carry over. An IP that used 2 runs in the last hour has 8 left immediately after deploy; nothing needs clearing.

## 4. Key Decisions

1. **Shared constant in `built-to-scale-method.ts`, plus a test.**
   Alternatives: change the literal in both files with no test; or put the constant in `ratelimit.ts` and test it there.
   Rationale: the module already holds the copy constants every Built to Scale? surface shares and is pure, so a test imports it without loading `@upstash/redis`. Testing `ratelimit.ts` directly would load both Upstash packages. The test is worth it because the defect being fixed is partly drift: the number lives in a limiter, a visitor message, a doc comment and the runbook. Deriving the message from the number removes one source of drift, and the test pins the owner's decision so a later edit to the cap is deliberate.

2. **Do not reuse `RATE_LIMIT_MESSAGE(limit)` from `app/api/tools/[tool]/errors.ts`.**
   Its wording ("Too many evaluations. You have used ...") is the tool routes' copy; using it here would change the visitor-facing Built to Scale? message beyond the number, which AC4 rules out. `errors.ts` also imports `llm`, `rubrics` and the pipeline, so it is not a pure home for a constant.

3. **Keep the prefix `rl:bts` and the `"1 h"` sliding window.** Existing windows carry over and the runbook key table stays accurate apart from the number.

4. **Message wording keeps the existing sentence, with 10 as a numeral**, matching the current style ("limited to 2 an hour"). British spelling, no dashes, no new copy.

## 5. Constraints Honoured

- No new dependencies.
- British spelling, no em or en dashes in any new or edited line (the test checks the message).
- Prefix `rl:bts` unchanged.
- Validate-before-limiter order in the route unchanged.
- No other limiter, route or copy changes.
- Registry, pipeline, rubrics and model routing untouched; no calibration needed (no rubric, prompt, model or scoring change).

## 6. Out of Scope

- Refunding the token when a run fails (synthesis 502 or child failure). Follow-up: the runbook already suggests a synthesis-only retry; a refund would need a decision on whether a run that already spent money at the provider should be free to repeat.
- A site-wide daily ceiling for Built to Scale? like `reserveBuilderDailyCall`. See the cost note.
- The details route limiter (`{ip}:built-to-scale` on `rl:details`, 10 per hour) and every other limiter.

## Test Plan

- New unit test in `__tests__/built-to-scale-method.test.ts` as above.
- Gates: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`. `npm run calibrate` is not required.
- Optional manual check after deploy: an eleventh scored run from one IP inside an hour answers 429 with the new message.

## Cost Note

One run is seven scoring calls plus one Opus synthesis, about 10 cents. The per-IP ceiling moves from about 20 cents an hour to about 1 dollar an hour, or roughly 24 dollars a day for one IP running flat out. There is no site-wide cap on this route, so a spread of IPs is bounded only by provider spend alerts. Risk accepted by the owner's request; a daily site-wide reservation counter is the follow-up if abuse appears in `ai:calls`.
