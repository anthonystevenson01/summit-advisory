# Review: Project Builder prototype, Round 3: staged build, change requests, model choice

Branch: `anthonystevenson0/prototype-round-3-staged-build`
Final verdict: **APPROVE** (loop 2; one REJECT in loop 1)

## Loop 1: REJECT

The gates passed (npm test 599/599, lint 0, tsc clean, build ok). Acceptance criteria 1 to 32 passed, with 23 partial by agreement (Gemini 3.8 Pro is not served by OpenRouter and is left out) and 33 pending (the smoke test and runbook entry are done before merge, not in the diff). `prototype-html.ts` carried one added line (`planVersion` on the served view); the Round 1 safety pass, CSP, sandbox, validator and their tests were byte for byte unchanged. No model id outside `llm.ts` except the test that holds the list against the catalogue fixture. The sentinel tests showed nothing from a request body, the brief, the profile or a page reaches a system turn, and the research call takes crawled pages and the brand record only.

One blocking bug:

1. `placeScreens` in `screens.ts` used `String.replace` with a string replacement, so `$'`, `` $` `` and `$&` in a screen's html, css or js were expanded as replacement patterns. Reproduced through `assembleDocument`: `$'000` in a cell duplicated the rest of the document and the validator failed the press ("pb-switch used more than once"); `'$'` in a script left the script tags unbalanced and failed the press; `$&` in css put a literal `</head>` into the style block. Nothing bad was ever stored, but a plausible screen (currency formatting with `'$'`) failed the whole press after every model call was spent.

Also noted: a shorter planned slug could own ids belonging to a longer one (`jobs` and `jobs-2`); background research from the save route ran outside the daily cap; a request accepted with no changed screens stored a new version and said "Done"; with `allow_fallbacks: false` the provider pin bound the `models` fallback too, so a pinned outage could fail the fallback as well.

## Loop 2: APPROVE

The gates pass: npm test 602/602, lint 0, tsc clean, build ok. `prototype-html.ts` still shows the one `planVersion` line and the Round 1 tests and `PrototypeFrame.tsx` are unchanged.

1. **Replacement patterns fixed.** All three `replace` calls in `placeScreens` take a function, so a screen's text is inserted literally. The new test puts `$'` in html, `$&` in css and `'$'` in js and checks the assembled document passes the validator with each once, three screens and one `</head>`.
2. **Slug prefix rule.** `checkScreen` takes the planned slugs and refuses ids that start with a longer planned slug's prefix; passed on the first call and the retry in `prototype-run.ts`. Tested with `jobs` and `jobs-list`.
3. **No-change requests.** `diffOutcome` in `plan.ts` names a diff refused, unchanged or changed. On the request path an accepted diff with no changed screen stores nothing, records the request and answers the new line `requestNoChange` ("Nothing on the screens needed to change for that. Your prototype is as it was."), plain and British. The press path is unchanged.
4. **Daily cap on background research.** The save route reserves a daily call after claiming the research lock and skips the build when the cap is reached.
5. **Pin and fallback.** A pinned primary sends no `models` array; on a non-refusal, non-timeout error `callModel` resends once on the route's fallback with that model's own provider block (`providerBlock`) and its own reasoning policy (none, the route's effort, forced low for an always entry, else off). An unpinned primary still sends the `models` array. The reasoning refusal path and the fallback path are exclusive branches with no further resend, so nothing is double sent. The log carries the fallback as `model` with `fallbackUsed: true` and the served provider.

## Notes for the PR (non-blocking)

- **Reasoning flag on the fallback leg.** When a pinned primary falls back to an "always" model with the route set to off, low effort is sent but `reasoningForced` stays false on that log row; `fallbackUsed: true` shows which model answered. A one line fix if the stats page ever needs it.
- **Fallback timing.** A pinned primary that fails fast is followed by one full attempt on the fallback under the same timeout, so a pinned model on the build key (admin choice) can spend a fast fail plus 90 s. The defaults pin only research and audit, both non blocking stages.
- **No-change requests in Notion.** A request answered "nothing needed to change" is stored with outcome `declined`, so the Notion bullet carries the "outside the prototype's remit" suffix. Cosmetic; a third outcome would make it exact.
- **Plan key lost between saves.** If the function dies between `saveBriefPrototype` and `saveBriefPlan`, the record has `planVersion > 0` with no plan; the request route answers "Press Update prototype first" while an unchanged brief answers "unchanged". Rare; worth a runbook line.
- **Unquoted ids.** `checkScreen` and the validator read quoted `id="..."` only; an unquoted `id=foo` is invisible to both. Cosmetic, inside the sandbox.
- **Parallel failure.** `Promise.all` rejects on the first failed screen while the other in flight calls keep running and logging.
- **Admin cache.** Route overrides are cached for 30 s per process, so a switch flipped in /admin/models reaches the prototype function within 30 s, as before this round.
- **Before merge (AC 33).** Run the smoke test on a real company site and record in the runbook: stage timings against the 45 s target, the provider each pinned model answered from, the reasoning outcome per provider, every Must on a screen, a request changing only the named screens, the stats table with all five keys and cost. The PR description must say Gemini 3.8 Pro was left out because OpenRouter does not serve it.
