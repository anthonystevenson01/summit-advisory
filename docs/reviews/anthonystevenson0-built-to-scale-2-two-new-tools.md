# Review: Built to Scale? Release 2, Route to Buyer and Unit of Value

Branch `anthonystevenson0/built-to-scale-2-two-new-tools`. Design: `docs/designs/anthonystevenson0-built-to-scale-2-two-new-tools.md`. One review round.

## Round 1: APPROVE

Every gate was run by the Reviewer, not taken from the Coder.

- `npm test`: 149 tests, 149 pass, 0 fail (baseline on main was 117).
- `npm run lint`: 0 errors, 0 warnings.
- `npx tsc --noEmit`: clean.
- `npm run build`: exit 0. `/tools/[tool]` prerenders five static paths; the hidden tools are absent. `/sitemap.xml` builds.
- `npm run calibrate`: exit 0, "0 run, 7 skipped, 0 errors. Nothing runnable; pass." No network. `built-to-scale/gradeshow` reads "no registry entry, skipped"; all six new cases read "hidden in the registry pending its Published rubric row and calibration, skipped".
- `git diff --stat` does not list `app/lib/runs.ts`, `app/lib/llm.ts`, `app/lib/rubrics.ts`, `app/api/tools/[tool]/unlock/route.ts` or `app/components/toolkit/ToolPage.tsx`. `package.json` and `package-lock.json` are unchanged.

### Acceptance criteria

All 12 PASS.

1. Registry entries `ROUTE_TO_BUYER` (06) and `UNIT_OF_VALUE` (07), both `hidden: true`. Inputs `buyer`, `route`, `cycle`, `channels` and `delivery`, `pricing`, `cost`, `renewal`, each with an example inside its own bounds. Weights match the Notion draft rows exactly and sum to 1.00. All 60 level labels are the verbatim short labels from the Notion descriptors. Role sentences, extras (`gatekeeperRisk` and `channelMove` as text; `ceilingInputs` as ceiling and `lever` as text), seo, cta, buttonLabel and feeds present. Nothing outside the registry describes either tool.
2. `ToolSlug` carries both slugs; `TOOLS` order is ICP, PERSONA, PROBLEM, POSITIONING, MOAT, ROUTE_TO_BUYER, UNIT_OF_VALUE, ACCOUNT. `PUBLIC_TOOLS` is still five. The page calls `notFound()` and the score and details routes return 404 on a hidden slug; `scoreRun` throws `ToolNotFoundError`.
3. `app/lib/ceiling.ts` has no imports. Null, undefined, NaN, Infinity, zero and negatives all give null with no partial result and no default. CAD default, three letter code switch, anything else falls back to CAD. `Math.round` of the product, formatted as `CAD 380,000`.
4. `ceilingSchema` is strict: every property required, `additionalProperties: false`, `value.type: ["number", "null"]`. `parseCeilingInputs` stores the parsed object only; a string value becomes null; a missing sub-object or non-object extra throws `SchemaError`. The text and list branches are unchanged.
5. The `Ceiling` renderer narrows with `isCeilingInputs`, computes in code, shows the figure with "per person per year" and the three assumption rows beside it; when null it says the text did not give the named inputs and still lists the rows. `gatekeeperRisk` has a keyed `Risk` renderer; `channelMove` and `lever` reuse `Priority`.
6. Six case files, three per folder, template shape, every optional input filled, `agreedBy` "Proposed by agentic-rig, to be confirmed by Anthony Stevenson", no `agreedOn`, no TO FILL. `calcScore` over the expected dimensions gives 78, 54, 25 and 87, 32, 52, matching grades 4, 3, 1 and 5, 2, 3. Five grade bands covered.
7. `scripts/calibrate.ts` splits the hidden and missing reasons; the three reasons are pinned in `app/lib/tools/calibration.ts`; README and script header match.
8. `countWord`, `PUBLIC_TOOL_COUNT`, `PUBLIC_TOOL_COUNT_WORD` and `PUBLIC_TOOL_COUNT_WORD_CAPITALISED` exported from the registry. `app/tools/hub-copy.ts` derives the titles, descriptions, ItemList description, lead and tag. The FAQ footer and the scale-up `HUB_TOOLS` body and hubLink interpolate the word. The remaining "five" hits in `app/` are not tool counts (five moat types, three to five validation moves, llm.ts route descriptions, "week five").
9. `app/sitemap.ts` maps `PUBLIC_TOOLS` to entries between `/tools` and `/newsletter`.
10. Tests cover the calculator, the schema shape and parser, the hub copy and ItemList derivation, the sitemap, the registry invariants for the hidden entries, the contiguous numbering, and the case files' internal consistency.
11. All four gates green.
12. Added lines with a dash are only the two new `seo.title` lines plus the `HUB_TITLE` separator that preserves the existing hub title. British spelling throughout. No hype words.

### Constraints

All PASS. One registry, one pipeline (the `pipeline.ts` diff is one type import and one type line), rubrics server side only, no model id outside `llm.ts`, no new dependencies, untouched Release 1b files, BRAND inline styles with no `className` in `extras.tsx`, node:test with relative `.ts` imports and no `@/` import in any test-loaded module, both tools hidden.

### Test coverage

Every criterion has a test that exercises behaviour rather than restating it. One honest limitation: the count-copy tests pass at five whether the word is derived or hard-coded, because both equal "five" today; derivation is confirmed by reading the three modules and by the build. The FAQ footer string is covered by the build only.

### Edge cases checked

Contiguity test message present. Relative `.ts` import through the `[tool]` directory passes both `npm test` and `npm run build`. The registry ask and the `pricePerUnit` field description both say "in the currency the text uses". `ceiling.ts` has no `node:` import and no `Intl` currency style. The admin `pre` branch precedes the generic render. `text()` returns an empty string for an object; `renderExtra` returns null for an unkeyed object. The parser tolerates a string value.

### Bugs looked for and not found

A zero value reaching the renderer shows "not supported by the text" and withholds the figure. `isCeilingInputs` on a malformed stored value makes `Ceiling` return null rather than throw. `computeCeiling` does not mutate its input. Rounding of 12.5 x 99.99 x 3 gives 3750. A non-string assumption becomes an empty string. No case input exceeds its `maxLength`; every required input is present and at least `minLength`; all six files are valid JSON.

### Notes for PR

- Calibration for the five existing tools has no case folders in this branch (only `built-to-scale` is tracked at HEAD), so "0 run, 7 skipped" is the honest total, not a regression.
- The count-copy tests cannot distinguish "five" derived from "five" literal until the count changes; the flip to seven is the day they earn their keep.
- On the day `route-to-buyer` goes public, `TOOL_STAGE_MAP` in `scale-up-content.ts` needs its entry, and the scale-up hygiene test that bans the word "route" in exported copy will match the slug. Nothing to do now.
- `countWord` returns digits above twelve, which is acceptable for the foreseeable count.
- `Ceiling` uses teal at 25 percent alpha for the panel border where the design said solid teal; a style choice, not blocking.
- `app/tools/hub-copy.ts` is a plain module inside the app directory, not a route; worth one sentence in the runbook so nobody expects it to render.

## Round 2: APPROVE (after merging main with Release 1b)

Main gained Release 1b (PR 12) before this PR opened. Merging it (commit 03c8d76) left one conflict in `docs/runbook.md` (two entries appended at the same place; both kept) and one type error: Release 1b's `ResultEmailView.extras` was typed `Record<string, string | string[]>` while `FullView.extras` now carries `ExtraValue`. The fix touches `app/lib/tools/result-email.ts` and `__tests__/result-email.test.ts` only: the email view accepts `ExtraValue`, and a `CeilingInputs` value renders as the same lines the page shows (the figure per person per year with its assumptions, or the "cannot be computed" sentence). Any other object renders nothing. String and list extras are unchanged.

Gates re-run by the Reviewer: `npm test` 170 pass, `npm run lint` 0 errors, `npx tsc --noEmit` clean, `npm run build` exit 0. The module stays pure (relative `.ts` imports of `../ceiling.ts` and the `ExtraValue` type only). No dashes in added lines. `pipeline.ts` still types `FullView.extras` as `Record<string, ExtraValue>`.
