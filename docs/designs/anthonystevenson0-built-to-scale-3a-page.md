# Design: Built to Scale? Release 3a, the page and the three-path entry point

Branch `anthonystevenson0/built-to-scale-3a-page`, cut from `main` after Release 2 (`origin/anthonystevenson0/built-to-scale-2-two-new-tools`) merges. Source: `task-spec.md`, `docs/built-to-scale-plan-updates.md` sections 3, 7, 8 and 9.6, the Release 1a, 1b and 2 designs in `docs/designs/`, and the Notion `built-to-scale` row (database `dad404fc12af4207bd446e9e8be22330`, Draft, Version 1), read on 26 October 2026 for the dimension names, the band wording and the synthesis instructions.

This document is design only. No code, no pseudocode. Every file named under "Release 2" below is designed against the content on that branch, not on `main`, because the Coder starts after it merges. Where the spec is ambiguous the assumption is stated inline and collected in section 4.

---

## 0. Shape of the change

Release 1a made every tool one registry entry scored by one pipeline. Release 2 added `feeds` and the two hidden tools. This release puts a composite on top: a page takes five parts (or one description), the orchestration composes each public tool's inputs from those parts through a registry mapping, runs `scoreRun` for every public tool in parallel, makes one synthesis call on the `synthesis` routing key, computes the total and the band in code and stores a composite run at `run:{id}`. A dark `Scorecard` renders it; a result page shares it with a 1200 by 630 image; a method page renders the same Notion row the synthesis is prompted from, so the public definition and the scoring definition cannot drift.

```
app/lib/tools/registry.ts                 + builtToScale mapping per tool; feeds aligned to the Notion table
app/lib/tools/built-to-scale-method.ts    pure: the five parts, bands, total, validation, input composition, view types
app/lib/tools/built-to-scale-schema.ts    pure: synthesis JSON schema and parser
app/lib/tools/built-to-scale-email.ts     pure: the Built to Scale? result email
app/lib/tools/built-to-scale-image.ts     pure: the OG image data function and the raw hash reader (edge safe)
app/lib/rubric-blocks.ts                  pure: Notion blocks to structured blocks
app/lib/rubrics.ts                        + getRubricBlocks (structured mode), cache keys for it
app/lib/runs.ts                           + CompositeRunRecord, getCompositeRun, markCompositeUnlocked, findAddressForHash; RunRecord gains source and parentId
app/lib/tools/pipeline.ts                 PipelineContext.source gains "built-to-scale"; parentId carried onto child runs
app/lib/tools/built-to-scale.ts           scoreModel, detailModel, the synthesis prompt, view projections
app/lib/ratelimit.ts                      + getBuiltToScaleLimiter (2 per IP per hour, prefix rl:bts)
app/lib/events.ts                         + six event names
app/lib/llm.ts                            synthesis admin description only
app/api/built-to-scale/score              } 
app/api/built-to-scale/details            } three new routes
app/api/built-to-scale/prefill            }
app/api/tools/[tool]/unlock               accepts built-to-scale
app/api/tools/[tool]/errors.ts            + SynthesisFailedError mapping
app/components/toolkit/scorecard/Scorecard.tsx         pure presentational, reused by Release 4
app/components/toolkit/scorecard/ScorecardWorking.tsx  per row working expander (client)
app/components/toolkit/shared/UnlockGate.tsx           the 1b gate, extracted from ToolPage
app/components/toolkit/shared/PrefillLoader.tsx        reads ?from and ?prefill, calls the prefill endpoint
app/components/toolkit/BuiltToScalePage.tsx            the client page (form, toggle, states)
app/tools/built-to-scale/page.tsx                      server page with metadata
app/tools/built-to-scale/method/page.tsx               method page from the Notion row
app/tools/built-to-scale/r/[id]/page.tsx               shareable result page
app/tools/built-to-scale/r/[id]/opengraph-image.tsx    next/og image on the edge runtime
app/tools/hub-copy.ts, ToolkitHub.tsx                  three-path block, hero and How It Works copy
app/components/toolkit/ToolPage.tsx                    "Score the whole model" and ?prefill re-run
app/admin/runs/page.tsx, app/admin/rubrics/page.tsx    composite runs, single run view, built-to-scale rubric row
scripts/calibrate.ts, app/lib/tools/calibration.ts     composite cases through scoreModel
app/sitemap.ts, docs/runbook.md, app/globals.css       two URLs, runbook entry, scorecard mobile rules
```

Visitors today see five public tools, so the orchestration runs five children; `unitOfValue` has no feeding tool until Anthony flips `unit-of-value`, and the synthesis is told so. Nothing in this release flips a tool.

---

## 1. Files to Modify / Create

Listed in implementation order in six phases. Each phase ends with a gate that must be green before the next starts. `npm test`, `npm run lint` and `npx tsc --noEmit` are expected green at every gate, run one after another (never `tsc` alongside `next build`); `npm run build` where the gate says so. The 1a module resolution rule applies: files under `app/lib/**` import siblings with relative paths and the explicit `.ts` extension and import nothing from `next/*`, `react` or any component; pure modules import nothing that touches Redis, OpenRouter or `node:` built-ins beyond what they already use.

### Phase A: registry mapping, pure method module, schema, total and band, tests

| File | Change |
| --- | --- |
| `app/lib/tools/registry.ts` (modify, Release 2 content) | `ToolEntry` gains `builtToScale: Record<string, BuiltToScaleDimension[]>`: one key per input key of the tool, each value the ordered list of parts that feed that input (an empty list means the orchestration leaves the input empty). Every entry gets the mapping in section 2.1, including the two hidden tools and `account` (an empty object). `feeds` is aligned to the Notion method table's "Feeds from" column: `persona` becomes `["routeToBuyer", "pain"]` and `problem` becomes `["pain", "valueEvidence"]`; the other five are already right. No other field changes. The header comment gains one sentence: `builtToScale` and `feeds` are the only description of how the five Built to Scale? parts reach a tool and which dimension its result informs. |
| `app/lib/tools/built-to-scale-method.ts` (create) | Pure, imports only types from `./registry.ts` and `./schema.ts`. Exports `BUILT_TO_SCALE_TOOL` (`"built-to-scale"`), `BTS_PARTS` (the five parts in the method's order, section 2.2), `BTS_PART_KEYS`, `isPartKey`, `PART_MIN`, `PART_MAX` (40 and 2000), `BANDS` and `bandFor(total)`, `totalOf(rows)`, `validateParts(body)`, `composeToolInputs(entry, parts, quickMode)`, `expandPartsFromInputs(entry, inputs)`, `QUICK_MODE_INPUT_NOTE`, `quickModeInstruction()`, `absentToolsInstruction(absent)`, the view types (`CompositeRow`, `CompositeFreeView`, `CompositeFullView`, `WorkingEntry`), and the copy constants in section 2.9 (`AUTOMATED_LABEL`, `AUTOMATED_LINE`, `QUICK_NOTE`, `LOCKED_COMMENT`). Details in sections 2.2 to 2.5. |
| `app/lib/tools/built-to-scale-schema.ts` (create) | Pure, imports `BTS_PARTS` and `CONFIDENCE_LEVELS` and `SchemaError` only. Exports `synthesisSchema()` (section 2.6), `parseSynthesis(raw, allowedSources)` (section 2.6) and the `SynthesisResult` type. |
| `app/lib/tools/built-to-scale-email.ts` (create) | Pure. Exports `renderBuiltToScaleEmail({ full, savedUrl, deleteUrl })` returning `{ subject, text, html }` (section 2.11). Imports `plainDashes` and a newly exported `escapeHtml` from `./result-email.ts`, `BRAND`, and the method module. |
| `app/lib/tools/built-to-scale-image.ts` (create) | Pure, no `node:` imports (it runs on the edge). Exports `readCompositeSummary(hash)` (raw Redis hash to `{ total, band, rows: [{ key, grade }] } | null`, tolerant of JSON strings and already parsed values, null when `tool` is not `built-to-scale` or a field is missing) and `scorecardImageData(summary)` returning `{ total, band, rows: [{ name, dots: boolean[] }] (five, method order, dots length five, filled up to the grade), line: "scored against Summit's rubrics" }`. |
| `app/lib/tools/result-email.ts` (modify, one line) | Export the existing `escapeHtml` so the Built to Scale? template shares the one escaping path. Nothing else changes. |
| `app/lib/tools/calibration.ts` (modify) | Add `CompositeCalibrationCase` (`tool: "built-to-scale"`, `input: Record<partKey, string>`, `expected: { total: number; band?: string; rows: Record<partKey, number> }`), `compareCompositeCase(expected, actual: { total, rows })` returning the existing `Comparison` shape (row `overall` compares the total, then one row per expected part key; pass when every delta is within one; a missing row fails), and `SKIP_REASON_NOT_PUBLISHED` ("built-to-scale rubric row not Published, skipped"). `compareCase`, `formatTable` and the existing constants are untouched. |
| `calibration/built-to-scale/gradeshow.json` (modify) | The `expected.rows` key `unitOfValueConstraints` becomes `unitOfValue` so the keys equal the five part keys. Inputs stay `TO FILL`. |
| `__tests__/registry.test.ts` (modify) | New tests: every entry with dimensions has `builtToScale` whose keys equal its input keys exactly; every mapped part key is one of the five; every required input maps to at least one part; every part key is mapped by at least one scored tool and fed (`feeds`) by at least one scored tool; the full `feeds` map deep-equals the Notion table (`icp` routeToBuyer; `persona` routeToBuyer, pain; `problem` pain, valueEvidence; `positioning` valueEvidence; `moat` abilityToProtect; `route-to-buyer` routeToBuyer; `unit-of-value` unitOfValue; `account` none). The Release 2 test that pins `feeds` for the two hidden tools still passes. |
| `__tests__/built-to-scale-method.test.ts` (create) | `BTS_PARTS` has five entries in the order pain, routeToBuyer, unitOfValue, valueEvidence, abilityToProtect with non-empty label, prompt, heading and example (example within 40 to 2000). `validateParts`: five parts of 40 characters pass; a 39 character part is rejected naming the part; a 2001 character part is rejected; a missing part is rejected; a body with only `description` passes with `quickMode` true; a body with parts and a description uses the parts; unknown keys are dropped; whitespace is trimmed. `composeToolInputs` for `moat` (position holds the heading line and the abilityToProtect text; competitors is empty) and `icp` (icp holds pain then routeToBuyer, each under its heading, a blank line between); for every scored tool and every input with a non-empty mapping, 40 character parts compose to at least `minLength`; 2000 character parts never exceed `maxLength` (truncation at the last space before the limit); in quick mode the description appears once per input even when the mapping names two parts, under the heading "Business description" and preceded by `QUICK_MODE_INPUT_NOTE`; inputs with an empty mapping are empty in both modes. `totalOf` sums five grades. `bandFor` at 5, 9, 10, 14, 15, 19, 20, 25 returns the four bands with the exact labels; `bandFor` below 5 or above 25 throws. `expandPartsFromInputs` for `problem` puts `problem` into pain and `evidence` into valueEvidence and leaves three parts empty; for `icp` the same text lands in pain and routeToBuyer; values are sliced to 2000. `quickModeInstruction()` and `absentToolsInstruction(["unit-of-value"])` name the tool and contain no dashes. |
| `__tests__/built-to-scale-schema.test.ts` (create) | `synthesisSchema()`: `rows` has `minItems` 5 and `maxItems` 5; the row `dimension` enum deep-equals the five keys in order; every object has `additionalProperties` false; top level `required` is `rows, verdict, strongest, weakest, oneChange, confidence, confidenceReason`; `grade` is an integer 1 to 5; `sources` is an array of strings. `parseSynthesis`: a good answer with the five rows out of order comes back in method order; four rows throws `SchemaError`; six rows throws; a duplicate dimension throws; an unknown dimension throws; grade 7 clamps to 5 and 0 to 1; `sources` not in `allowedSources` are dropped and valid ones kept in the model's order; an empty or missing verdict throws; a confidence outside the enum throws; `comment`, `strongest`, `weakest`, `oneChange` are trimmed. |
| `__tests__/built-to-scale-email.test.ts` (create) | With a fabricated full view (total 13, band "A good idea with an engine still to build", a verdict with an em dash, five rows with comments, strongest, weakest, oneChange, `quickMode` true): subject names the total and band; text and html contain the total, band, verdict, every row name with its grade and comment, strongest, weakest, the one change, both URLs (html inside `href`), the quick note and the automated paragraph; neither contains U+2013 or U+2014; html escapes `<b>`. A second case with `quickMode` false has no quick note. |
| `__tests__/built-to-scale-image.test.ts` (create) | `scorecardImageData` for total 10 and rows 3,2,1,2,2 returns five rows in order with the Notion names and dots `[T,T,T,F,F]` for the first; `readCompositeSummary` accepts `rows` as a JSON string and as an array, `total` as a string "10" or a number, returns null for a hash whose `tool` is `moat`, and null when `rows` is missing. |
| `__tests__/calibration.test.ts` (modify) | `compareCompositeCase`: exact match passes with six rows; total off by one passes; total off by two fails; a row off by two fails; a missing row fails with a null actual; `SKIP_REASON_NOT_PUBLISHED` prints in `formatTable` and differs from the three existing reasons. |
| `__tests__/calibration-cases.test.ts` (modify) | A new describe for the `built-to-scale` folder: every file parses, `tool` is `built-to-scale`, `input` keys are a subset of the five part keys, `expected.total` is an integer 5 to 25, `expected.rows` keys equal the five part keys exactly with integer values 1 to 5, the rows sum to `expected.total`, and `expected.band` (when present) equals `bandFor(expected.total).label`. The `TO FILL` convention is allowed here (the Gradeshow inputs are placeholders), so `isCaseFillable` is not asserted for this folder. |

**Gate A:** `npm test` green including `scale-up-advisory.test.ts` untouched (run it by name as well as in the suite), `npx tsc --noEmit` green, `npm run lint` 0 errors. No route, page or store has changed. `git diff --stat` touches only the files above.

### Phase B: rubrics structured mode, run store, pipeline context, orchestration module, routes

| File | Change |
| --- | --- |
| `app/lib/rubric-blocks.ts` (create) | Pure. Exports `RubricBlock` (`{ type: "heading", level: 1 | 2 | 3, text } | { type: "paragraph", text } | { type: "bullets", items: string[] } | { type: "numbered", items: string[] } | { type: "quote", text } | { type: "table", header: boolean, rows: string[][] }`) and `notionBlocksToStructured(blocks)` (section 2.7). The `NotionBlock` and rich text interfaces move here from `rubrics.ts`, which re-exports them so nothing else changes. |
| `app/lib/rubrics.ts` (modify, structured mode only) | Add `getRubricBlocks(slug)` returning `{ blocks, version, hash, fetchedAt }`: same Published lookup and block fetch as `loadFromNotion` (shared private loader that returns the raw blocks with table rows attached, used by both paths), converted with `notionBlocksToStructured`, `hash` identical to `getRubric`'s (SHA-256 of the text rendering plus the system prompt, so the method page and the synthesis report the same hash). Cache: Redis `rubric-blocks:{slug}` JSON for 600 s, memory map 60 s, errors never cached, read order memory then Redis then Notion. `clearRubricCache` also deletes `rubric-blocks:{slug}` for every registry slug and for `built-to-scale`, and `rubric:built-to-scale` (the text cache the synthesis uses; today the clear loop iterates `TOOL_SLUGS` only). `getRubric` itself is unchanged in behaviour. |
| `app/lib/runs.ts` (modify) | `RunRecord.source` becomes `"web" | "built-to-scale"`; `RunRecord` gains `parentId: string | null` (a scalar field, not a JSON field; `deserialise` defaults it to null). New `CompositeRunRecord` (section 2.8) and `StoredRun = RunRecord | CompositeRunRecord`, `isCompositeRun(run)`. `JSON_FIELDS` gains `children`, `rows`, `absentTools`; `parseValue` treats `total` as numeric; `quickMode` is read as true only for `true` or `"true"`. `getRun(id)` keeps its signature and returns null when the stored `tool` is `built-to-scale` (so the three tool routes 404 a composite id with no change). New `getCompositeRun(id)` returns `CompositeRunRecord | null` (null for a tool run). `getRuns(ids)` and `listRuns` return `StoredRun[]`; `listRuns.tool` becomes `string | undefined`. New `markCompositeUnlocked(id, childIds, unlock)`: HSET `unlock` on the composite and on every child, PERSIST all, SADD all ids into `runs:by-email:{hash}` (one pipeline). New `findAddressForHash(emailHash, excludeId)`: the newest run under the hash (either kind) whose `unlock.email` is non-empty, or null; the tool details route's private `resolveAddress` becomes a call to it (section 2.10). `saveCompositeRun(run)` mirrors `saveRun` (HSET, 30 day expire, ZADD). `deleteRunsByEmail` is unchanged and now removes children too because they are indexed. |
| `app/lib/tools/pipeline.ts` (modify, minimal) | `PipelineContext.source` becomes `"web" | "calibration" | "built-to-scale"`; gains `parentId?: string`. `scoreRun` persists and tracks when `source !== "calibration"` (today `isWeb`), writes `source: ctx.source === "calibration" ? "web" : ctx.source` and `parentId: ctx.parentId ?? null` onto the record, and `tool_started` and `result_shown` carry the source. `detailRun`, prompts and schemas are untouched. |
| `app/lib/events.ts` (modify) | `EventName` gains `bts_started`, `bts_result_shown`, `bts_full_view_opened`, `bts_result_emailed`, `score_whole_model_handoff`, `tool_rerun_from_scorecard`. |
| `app/lib/ratelimit.ts` (modify) | Add `getBuiltToScaleLimiter()`: sliding window 2 per 1 h, prefix `rl:bts`. Tool limiters unchanged. |
| `app/lib/llm.ts` (modify, one string) | `TASK_DESCRIPTIONS.synthesis`: "One call per Built to Scale? run that writes the five comments, verdict, strongest, weakest and one change. Live since Release 3a. Has one fallback so an outage does not drop the headline." Nothing else. |
| `app/lib/tools/built-to-scale.ts` (create) | `scoreModel(body, ctx)`, `detailModel(runId, ctx)`, `toCompositeFreeView(run)`, `toCompositeFullView(run, children)`, `SynthesisFailedError`, `NoToolsAvailableError`. Sections 2.3 to 2.6 and 3.1 to 3.3. The only file that builds the synthesis prompt. Imports `scoreRun`, `detailRun`, `toFullView`, `toFreeView` from `./pipeline.ts`, `callModel` from `../llm.ts`, `getRubric` from `../rubrics.ts`, the run store, `track`, the registry and the pure modules. |
| `app/api/tools/[tool]/errors.ts` (modify) | `SynthesisFailedError` maps to 502 `{ error: "The scorecard could not be written. Your tool results are saved. Please try again." }`; `NoToolsAvailableError` maps to 503 `{ error: "rubric not published" }` (every child was absent or unpublished). The new routes import this file by its `@/app/api/tools/[tool]/errors` path. |
| `app/api/built-to-scale/score/route.ts` (create) | POST, `runtime nodejs`, `dynamic force-dynamic`, `maxDuration = 60`. Order in section 3.4. |
| `app/api/built-to-scale/details/route.ts` (create) | POST, same exports, `maxDuration = 60`. Order in section 3.5, mirroring the 1b tool details route. |
| `app/api/tools/[tool]/unlock/route.ts` (modify) | Accepts `tool === "built-to-scale"` alongside public slugs. For a composite: `getCompositeRun`, `markCompositeUnlocked(run.id, Object.values(run.children), unlock)`; for a tool run the existing `markUnlocked`. The `gtm-unlocks` entry carries `tool: "built-to-scale"`; cookie issue and `email_given` unchanged. |
| `app/api/tools/[tool]/details/route.ts` (modify, minimal) | `resolveAddress` is replaced by `findAddressForHash(run.unlock.emailHash, run.id)`. Nothing else. |

**Gate B:** `npx tsc --noEmit`, `npm run lint`, `npm test` green; `npm run build` green. `curl` smoke against `npm run dev` with the Notion, OpenRouter and Upstash variables set and the `built-to-scale` row set to Published by the owner for the duration of the smoke (then back to Draft; the last check below covers the Draft path): `POST /api/built-to-scale/score` with five 60 character parts returns a composite free view with `runId`, `total` 5 to 25, `band`, five `rows` each with `key`, `name`, `grade` and `feeds`, no `comment`, `verdict`, `strongest`, `weakest`, `confidence`, `quickMode: false`, `unlocked: false`, and the run hash shows `tool: built-to-scale`, `children` with five ids, each child hash showing `parentId` and `source: built-to-scale`; a `description` only body returns `quickMode: true`; a 30 character part returns 400 naming the part; a third request from the same IP within the hour returns 429 with `Retry-After`; `POST /api/built-to-scale/details` without an unlock returns 403; after `POST /api/tools/built-to-scale/unlock` with an email it returns the full view with `rows[].comment`, `oneChange`, `rows[].working[]` each carrying a child full view, and `emailed` true or false per SMTP; a second details call returns the stored view with `emailed: false`; `POST /api/tools/moat/details` with a composite id returns 404. With the Notion row back to Draft the score route returns 503 `rubric not published`.

### Phase C: Scorecard, the gate component and the page

| File | Change |
| --- | --- |
| `app/globals.css` (modify, append) | A small `.bts-*` block (section 2.12): the row grid, the headline sizes, and one `@media (max-width: 480px)` rule set. No Tailwind utilities, no other selectors touched. |
| `app/components/toolkit/scorecard/Scorecard.tsx` (create) | Pure presentational, no `"use client"`, no hooks, no fetches. Props and sections in section 2.12. Imports `BRAND`, the view types and copy constants from the method module, and nothing else. Renders in the client page and in the server result page. |
| `app/components/toolkit/scorecard/ScorecardWorking.tsx` (create) | Client. Props `{ row: CompositeRow (full), parentRunId }`. A native `<details>` per feeding tool: tool number and name, score of 100, grade of 5 with label, verdict, confidence line, `GtmDimensionBar` per dimension with the reasoning under it, extras via `renderExtra`, recommendations in the ToolPage style, and when `isToolPublic(tool)` a link "Re-run this tool with these inputs" to `/tools/{slug}?prefill={childRunId}`. When `full` is null for an entry: one line "The working for this tool could not be produced. Open the full view again to retry." |
| `app/components/toolkit/shared/UnlockGate.tsx` (create) | Client. The gate block currently inline in `ToolPage` (heading "Unlock the full view", the one line on what the email is for, Email, Name (optional), Company (optional), button "Unlock and email my result", the footnote with the privacy address), lifted verbatim. Props: `idPrefix`, `onSubmit(email, name, company)`, `busy`. Owns its three field states; the button is enabled when the email matches `EMAIL_REGEX`. |
| `app/components/toolkit/ToolPage.tsx` (modify, part 1) | The inline gate becomes `<UnlockGate idPrefix={entry.slug} onSubmit={...} />` with `handleUnlock` taking the trio as arguments. Behaviour and copy identical. (The hand-off edits are Phase E.) |
| `app/components/toolkit/BuiltToScalePage.tsx` (create) | Client. Sections, state and calls in section 2.13. Reuses `CyclingLoader`, `ErrMsg`, `ToolShareButtons`, `UnlockGate`, `Scorecard`, `ScorecardWorking`, `PrefillLoader` (Phase E; until then the `from` query is ignored). Honeypot as `ToolPage`. |
| `app/components/toolkit/shared/ToolShareButtons.tsx` (modify, minimal) | Optional prop `path?: string`; when given it replaces `/tools/{slug}` in the built URL. `slug` stays required for the existing call sites. |
| `app/tools/built-to-scale/page.tsx` (create) | Server page. `metadata`: title "Built to Scale? Score your business model out of 25: Summit GTM Toolkit", description "One form, five dimensions, a score out of 25 for how well your business model can scale. Scored automatically against Summit's rubrics. Free, no account.", canonical `https://summitstrategyadvisory.com/tools/built-to-scale`, OpenGraph and twitter with the site image as the tool pages do. Renders `SiteNav`, the back row to `/tools` as `ToolRunner` does, `<BuiltToScalePage />`, a WebApplication JSON-LD (name "Built to Scale?", url the canonical, provider Summit), and `ToolkitFooter`. Static (no `searchParams` read in the server component). |

**Gate C:** build, lint, tsc, tests green; `/tools/built-to-scale` is listed as static in the build output. In the browser against `npm run dev` with the row Published: the page shows the eyebrow, heading, the automated paragraph, the toggle, five labelled textareas with prompts, counters and "Show an example" buttons that fill them; "Score my model" is disabled until every part has 40 characters; scoring shows the loader; the result shows the dark scorecard with the total in Barlow Condensed, the band, the verdict, five rows with dots filled to the grade, the grade of 5, the locked comment line, strongest and weakest, then the gate; unlocking with an email shows comments, the one change, and a working expander per row listing each feeding tool with bars, reasoning, extras, recommendations and the re-run link; the quick toggle shows one textarea and the result carries the one line quick note; at 375 px wide (device toolbar) nothing scrolls horizontally and every row reads name, dots, grade, comment; Copy link copies `/tools/built-to-scale/r/{id}`.

### Phase D: result page, OG image, method page

| File | Change |
| --- | --- |
| `app/tools/built-to-scale/r/[id]/page.tsx` (create) | Server page, `dynamic = "force-dynamic"`. `generateMetadata` and the render in section 2.14. Reads the cookie with `cookies()` from `next/headers` and `searchParams.t`; never calls a model. |
| `app/tools/built-to-scale/r/[id]/OpenFullView.tsx` (create) | Client. One button "Open the full view" that POSTs `{ runId }` to the details route and calls `router.refresh()` on 200; shows `CyclingLoader` while waiting and `ErrMsg` on failure. Rendered only when the server page found the visitor authorised and the composite has no stored details. |
| `app/tools/built-to-scale/r/[id]/opengraph-image.tsx` (create) | `runtime = "edge"`, `size 1200 by 630`, `contentType image/png`, `alt "Built to Scale? scorecard"`. Section 2.15. |
| `app/tools/built-to-scale/method/page.tsx` (create) | Server page, `dynamic = "force-dynamic"`, metadata title "The Built to Scale? method: how a business model is scored out of 25", description, canonical `/tools/built-to-scale/method`. Section 2.16. |
| `app/tools/built-to-scale/method/RubricBlocks.tsx` (create) | Server component (no `"use client"`): `RubricBlock[]` to JSX with inline BRAND styles. Section 2.16. |

**Gate D:** build, lint, tsc, tests green. In the browser: `/tools/built-to-scale/r/{id}` for a scored but not unlocked run shows the free scorecard, the automated paragraph beneath the headline, the quick note when applicable, "Score your own model" and "How this is scored"; the same URL in a browser holding the unlock cookie after the run's full view was opened shows the comments, one change and working; the saved link from the email (`?t=`) in a cookieless window shows the full view; a wrong `t` shows the free view; an unknown id is 404; `/tools/built-to-scale/r/{id}/opengraph-image` returns a 1200 by 630 PNG with the wordmark, the total, the band, five names with dots and the line; the page source carries `og:image` pointing at it; `/tools/built-to-scale/method` renders the headings, the dimension table (five rows with the 1 and 5 columns), the bands table, the numbered synthesis steps and the comment bullets, with the automated paragraph under the title; with the row set to Draft it shows the "being updated" message and a 200.

### Phase E: hub entry block and copy, ToolPage hand-offs, prefill endpoint

| File | Change |
| --- | --- |
| `app/tools/hub-copy.ts` (modify) | Add `HUB_LEAD` rewrite, `HUB_INTRO`, `HOW_IT_WORKS` (three steps), `ENTRY_PATHS` (three cards) and `CONTACT_EMAIL`; exact strings in section 2.17. `HUB_TITLE`, the descriptions, `HUB_TAG` and `itemListSchema` are unchanged. |
| `app/components/toolkit/ToolkitHub.tsx` (modify) | Hero lead reads the rewritten `HUB_LEAD`; the How It Works block maps `HOW_IT_WORKS`; a new three-path section renders `ENTRY_PATHS` between the niche callout and How It Works (section 2.17); the tool grid section gets `id="tools"`. Legacy redirect, cards, account section and newsletter unchanged. |
| `app/api/built-to-scale/prefill/route.ts` (create) | GET, `runtime nodejs`, `dynamic force-dynamic`. Section 3.6. |
| `app/components/toolkit/shared/PrefillLoader.tsx` (create) | Client. Props `{ param: "from" | "prefill", via: "tool" | "scorecard", onLoaded(payload) }`. Under `Suspense` in the parent. Reads the named query param with `useSearchParams`; when it matches the run id pattern, GETs the prefill endpoint once (a ref guards re-runs) and hands `{ runId, tool, inputs }` to `onLoaded` in the async continuation only; any failure does nothing. |
| `app/components/toolkit/ToolPage.tsx` (modify, part 2) | On `scored` and `full`, under the result block, a line "Take this result into Built to Scale? and score all five dimensions." with a `Link` "Score the whole model" to `/tools/built-to-scale?from={runId}`. A `PrefillLoader param="prefill" via="scorecard"` whose `onLoaded` fills `values` from `inputs` when `payload.tool === entry.slug` (sliced to each input's `maxLength`), sets `rerunOf` to the run id and `prefilledFrom` state, which shows one line above the form: "Inputs loaded from your Built to Scale? run. Edit anything and score again." |
| `app/components/toolkit/BuiltToScalePage.tsx` (modify) | Mounts `PrefillLoader param="from" via="tool"`; `onLoaded` calls `expandPartsFromInputs(getTool(tool), inputs)` and sets the non-empty parts, leaves the others empty, selects five-part mode and shows one line above the form: "Your {tool name} answers are in the parts they feed. Fill the rest and score the whole model." |
| `__tests__/gtm-toolkit.test.ts` (modify) | New describe "Three paths and method copy": `ENTRY_PATHS` has three entries whose titles are exactly "Use a tool", "Score your own model", "Ask Summit to score it"; hrefs are `#tools`, `/tools/built-to-scale` and a `mailto:` to `CONTACT_EMAIL`; the third is flagged `comingNext`; the first body starts with the capitalised count word; `HOW_IT_WORKS` has three steps numbered 01 to 03; none of `HUB_LEAD`, `HUB_INTRO`, the step bodies or the card bodies contains U+2013, U+2014 or a hyphen used as a dash (regex ` - `); `HUB_LEAD` still starts with the capitalised count word; `sitemap()` includes `/tools/built-to-scale` and `/tools/built-to-scale/method`. |

**Gate E:** build, lint, tsc, tests green; `/tools` and `/tools/[tool]` still static in the build output. In the browser: `/tools` opens with the three cards above the grid, "Use a tool" scrolls to the grid, "Score your own model" opens the page, "Ask Summit to score it" shows "Coming next" and a mailto; a moat result shows "Score the whole model", which opens the Built to Scale? page with the ability to protect part filled and the note line; a scorecard working row's re-run link opens `/tools/moat?prefill=` with the inputs filled and the re-run line; scoring from there records `re_run` with `rerunOf`; the prefill endpoint returns 404 for a composite id and for an unknown id, and `Cache-Control: no-store`.

### Phase F: admin, calibration, sitemap, runbook

| File | Change |
| --- | --- |
| `app/admin/runs/page.tsx` (modify) | Section 2.18: a "Built to Scale?" chip, composite rows, an `id` search param for a single run, the expandable composite detail. |
| `app/admin/rubrics/page.tsx` (modify) | The list iterates `PUBLIC_TOOLS` plus `built-to-scale`, so the row's Published state, version and hash show and Refresh clears its cache too. |
| `scripts/calibrate.ts` (modify) | Section 3.7: the `built-to-scale` folder runs through `scoreModel` when the row is Published. |
| `app/sitemap.ts` (modify) | After the tool entries: `/tools/built-to-scale` (weekly, 0.8) and `/tools/built-to-scale/method` (monthly, 0.6). Result pages are not listed. |
| `calibration/README.md` (modify) | The composite case shape (`expected.total`, `expected.rows` keyed by the five part keys, optional `band`), the not-published skip reason, and that composite cases are five-part only. |
| `docs/runbook.md` (modify, Docs agent) | Entry "Built to Scale? Release 3a: the page, the scorecard and the three paths": trigger, the orchestration stages and time budget, the registry mapping and `feeds` alignment with the Notion table, the routes and their limits, the composite record and the child rules (persist on unlock, delete with the parent), the result page and image, the method page and its degrade, the hidden tool rule and what changes when a tool is flipped, the events, calibration for composite cases, failure modes (synthesis failed, row Draft, child rubric Draft, OG image for an expired run), and the Notion edit rule: bands and dimension names live in code as well as in the row, so a change to either table in Notion needs a matching code change. |

**Gate F:** all four quality gates green one after another; `npm run calibrate` prints the Gradeshow case as skipped (`TO FILL`) and the six Release 2 rows as hidden, exit 0; with a temporarily filled composite case and the row Published it runs five children and one synthesis and prints the composite comparison. `/admin/runs` shows the composite rows with total and band, filters by the chip, opens a child by its link; `/admin` Runs Scored counts the composite; `/admin/rubrics` lists `built-to-scale`. `git status` shows only intended files; `grep -rn "font-oswald" app/components/toolkit/scorecard app/tools/built-to-scale` returns nothing.

---

## 2. Integration Points

### 2.1 Registry mapping (`builtToScale`) and `feeds`

`builtToScale` is keyed by the tool's input keys; each value lists the parts, in the order they are concatenated, that fill that input. An empty list means the orchestration never fills the input. Required inputs must name at least one part (tested). The composition rule and the length rules are in 2.3.

| Tool | Input | Parts | Why |
| --- | --- | --- | --- |
| `icp` | `icp` | pain, routeToBuyer | An ICP description is who has the problem and how they buy |
| `persona` | `persona` | routeToBuyer, pain | The persona is the signer and the pain they own |
| `persona` | `tamSize` | none | A 100 character text field; the route part already carries the count |
| `problem` | `problem` | pain | |
| `problem` | `evidence` | valueEvidence | |
| `problem` | `tamSize` | none | |
| `positioning` | `statement` | valueEvidence | The nearest thing to a positioning statement is the value claim and its proof |
| `positioning` | `context` | none | 500 character text field |
| `moat` | `position` | abilityToProtect | |
| `moat` | `competitors` | none | 500 character text field; competitors are named inside the part |
| `route-to-buyer` | `buyer` | routeToBuyer, pain | Who signs, plus who owns the budget from the pain part |
| `route-to-buyer` | `route` | routeToBuyer | |
| `route-to-buyer` | `cycle` | none | 600 character text field; the cycle is inside the route part |
| `route-to-buyer` | `channels` | none | Inside the route part |
| `unit-of-value` | `delivery` | unitOfValue | |
| `unit-of-value` | `pricing` | unitOfValue | The same part feeds both required inputs; see decision 4.4 |
| `unit-of-value` | `cost` | none | |
| `unit-of-value` | `renewal` | none | |
| `account` | none | `{}` | No inputs in the registry |

`feeds` (which dimension a tool's result informs in the synthesis) is aligned to the Notion table: `icp` routeToBuyer; `persona` routeToBuyer, pain; `problem` pain, valueEvidence; `positioning` valueEvidence; `moat` abilityToProtect; `route-to-buyer` routeToBuyer; `unit-of-value` unitOfValue; `account` none. `feeds` and `builtToScale` are independent: `builtToScale` says what text a tool reads, `feeds` says where its result is grouped. A tool may feed two dimensions and then appears under both in the synthesis user content.

### 2.2 The five parts (`BTS_PARTS`, method order)

Each part: `key`, `name` (the Notion dimension name, used on the scorecard, the image and the method), `label` (the form label), `prompt` (the one line under the label), `heading` (the line that prefixes the part inside a composed tool input; long enough that a 40 character part always clears every `minLength`), `example` (the "Show an example" text; one invented business throughout, the hospital tabletop exercise company from the Release 2 calibration set, so the five examples read as one model).

| key | name | label | prompt | heading |
| --- | --- | --- | --- | --- |
| `pain` | Pain | Pain | The problem, who owns it, what it costs them and the proof they will pay. | Pain, the problem and who owns it: |
| `routeToBuyer` | Route to buyer | Route to buyer | Who signs, how you reach them today, the channels and gatekeepers, the cycle and what a win costs. | Route to buyer, who signs and how you reach them: |
| `unitOfValue` | Unit of value constraints | Unit of value | What one sale consumes, how it is priced, whether margin holds, how revenue repeats and what could break the ceiling. | Unit of value, what one sale consumes and how it is priced: |
| `valueEvidence` | Value evidence | Value evidence | How a customer sees that it worked, how fast, and the number they could show their board. | Value evidence, how the customer sees the result: |
| `abilityToProtect` | Ability to protect | Ability to protect | What stops someone copying it once it works, and whether each win makes the next easier. | Ability to protect, what stops a copy: |

Examples (final copy, British spelling, no dashes; each between 200 and 600 characters):

- pain: "Mid-sized hospitals in Ontario and British Columbia have to run an incident response exercise every year to keep accreditation, and most run a poor one the week before the audit. The Director of Emergency Preparedness owns it and has a training budget of around 40,000 CAD. Twenty eight of the thirty hospitals we have run one for booked it again within eighteen months, so the pain is real and paid for."
- routeToBuyer: "The buyer is the Director of Emergency Preparedness, with the CFO signing anything over 25,000 CAD. There are about 190 such hospitals in Canada. Most first conversations start with a referral from a director we already serve, or at the two provincial emergency management conferences we sponsor. The founder runs every first call. From first contact to a signed order takes three to five months."
- unitOfValue: "One unit is a one day on site tabletop exercise run by one facilitator, with two days of preparation from templates and one day of write up. Priced per exercise at 9,500 CAD, or 25,000 CAD for a programme of three. A facilitator runs one exercise a week for forty weeks. Margin per exercise is about 55 percent and does not change with volume. Half of hospitals buy again. We are building a self serve scenario library that would sell as an annual licence."
- valueEvidence: "After the exercise the hospital gets a written gap report with the five actions it must take before the next audit, and the accreditation body accepts it as evidence. Directors tell us the report is the thing they show the board. We do not yet measure time to close the gaps, and the result shows up at the next audit, nine to twelve months later."
- abilityToProtect: "The scenarios are ours and are refined after every exercise, and the two provincial emergency management associations list us as the only vendor they have reviewed. A competitor could hire a former emergency manager and start, but would not have the library of 60 hospital specific scenarios or the audit history. Each exercise adds a scenario and a referral."

Quick mode box: label "Describe the business", prompt "What you sell, to whom, how you reach them, how you deliver and price it, how a customer sees the result, and what protects it. Numbers where you have them.", example the five example texts above joined with blank lines (sliced to 2000 characters at the last full stop).

### 2.3 Input composition (`composeToolInputs(entry, parts, quickMode)`)

Returns `Record<inputKey, string>` for every input of the entry.

- Five-part mode: for an input whose mapping lists parts, the value is the parts in mapping order, each rendered as `heading` on one line then the part text, parts separated by a blank line. An input with an empty mapping is `""`.
- Quick mode: `parts` holds the same description under all five keys. For an input whose mapping is non-empty the value is `QUICK_MODE_INPUT_NOTE` ("Note: this is one unstructured description of the business, written for a quick Built to Scale? check, not an answer to this field. Score only what it supports; what it does not mention scores 1, not 3."), a blank line, the heading "Business description:", then the description once. Identical part texts are never repeated within one input.
- Length: after assembly the value is cut to the input's `maxLength` at the last space before the limit when it exceeds it (only possible when two parts near 2000 characters feed one 4000 character input). Nothing is ever padded; the headings guarantee every mapped input clears `minLength` from a 40 character part (tested for every scored tool).
- The child then goes through `validateInputs` inside `scoreRun` as any web input would; the composition never includes `rubric` or `systemPrompt` keys.

`expandPartsFromInputs(entry, inputs)` is the reverse, for the hand-off from a tool result: for each input with a non-empty value, for each part its mapping names, the input text is set as that part (or appended after a blank line when another input already filled it; identical text is not repeated). Values are sliced to 2000. Parts no input names stay `""`.

### 2.4 Validation (`validateParts(body)`)

Input: the request body. Reads `parts` (object) and `description` (string). Result `{ ok: true, parts: Record<partKey, string>, quickMode: boolean }` or `{ ok: false, error }`.

- If `parts` is an object with at least one non-empty trimmed value: five-part mode. Every one of the five keys must be present and trimmed to 40 to 2000 characters, else the error names the part label ("Pain must be at least 40 characters." / "... under 2,000 characters." / "Pain is required."). Unknown keys dropped. `description` ignored.
- Else if `description` is a non-empty string: quick mode. 40 to 2000 characters after trim, same messages with "The description". `parts` becomes the description under all five keys.
- Else `{ ok: false, error: "Fill in the five parts or describe the business." }`.

### 2.5 Total and band

`totalOf(rows)` sums the five grades (5 to 25). `bandFor(total)` returns `{ key, label }` from `BANDS`, in code, never from the model:

| total | key | label |
| --- | --- | --- |
| 20 to 25 | `built` | Built to scale |
| 15 to 19 | `work` | Built to scale, with work to do |
| 10 to 14 | `engine` | A good idea with an engine still to build |
| 5 to 9 | `hard` | A hard model |

Labels are the Notion row's wording (the comma in the second). Out of range throws.

### 2.6 Synthesis schema and parser (`built-to-scale-schema.ts`)

`synthesisSchema()` returns a `NamedSchema` (`name: "built_to_scale_synthesis"`, `strict: true`): an object, `additionalProperties` false, required `rows`, `verdict`, `strongest`, `weakest`, `oneChange`, `confidence`, `confidenceReason`.

- `rows`: array, `minItems` 5, `maxItems` 5, description "Exactly five rows, one per dimension, in this order: pain, routeToBuyer, unitOfValue, valueEvidence, abilityToProtect." Items: object, `additionalProperties` false, required `dimension`, `grade`, `comment`, `sources`; `dimension` string enum of the five keys in order; `grade` integer minimum 1 maximum 5 with the description "1 to 5, scoring the model's potential, not the current team"; `comment` string "Two sentences at most, naming the constraint and its cause, fitting a scorecard row; no numbers that were not in the input or the tool results"; `sources` array of strings "Run ids of the tool results this row relied on, from the list given; may be empty".
- `verdict` string "One line, under 15 words, that a founder would repeat to a co-founder"; `strongest` and `weakest` strings "One line on the highest (lowest) dimension, naming it"; `oneChange` string "The single change that would lift the total most, one sentence, specific to this business"; `confidence` enum low, medium, high; `confidenceReason` string "Under 25 words; name the input that would raise it".

No total, no band, no name field: the code computes and labels.

`parseSynthesis(raw, allowedSources)`: object check; `rows` must be an array of exactly five objects; each `dimension` must be one of the five keys and each key must appear exactly once (duplicate or unknown throws `SchemaError` naming it); `grade` must be a finite number, rounded and clamped 1 to 5; `comment` string (empty allowed, trimmed); `sources` filtered to strings present in `allowedSources`, order kept, duplicates removed; rows are returned in method order regardless of the model's order; `verdict` non-empty string else throws; `strongest`, `weakest`, `oneChange` strings (trimmed, empty allowed); `confidence` must be in the enum; `confidenceReason` trimmed string or `""`. Returns `SynthesisResult`.

### 2.7 Structured rubric blocks (`rubric-blocks.ts`, `getRubricBlocks`)

`notionBlocksToStructured(blocks)` walks the same block list `notionBlocksToText` reads (table rows already attached as `rows`):

- `heading_1` to `heading_3` become `heading` with the level; `paragraph` becomes `paragraph` (empty text dropped); `quote` becomes `quote`.
- Consecutive `bulleted_list_item` blocks collapse into one `bullets` block; consecutive `numbered_list_item` blocks into one `numbered` block. A different block type ends the run.
- `table` becomes `table` with `header` from `has_column_header` and `rows` as arrays of trimmed cell strings.
- `callout`, `toggle`, `column_list`, `divider`, `image` and any other type are dropped (the row's editorial callout is for Anthony, not visitors; the text mode already drops it).
- Rich text is `plain_text` joined; bold and links are not carried (the body uses bold for the six step names; the renderer gives numbered items weight on the leading clause up to the first full stop, which reads the same).

`getRubricBlocks(slug)` in `rubrics.ts` shares the Published lookup and the block fetch with `getRubric` through one private loader that returns `{ page, systemPrompt, version, blocks }`; the text path hashes the text rendering plus the prompt as today, and the blocks path reports that same hash (computed from `notionBlocksToText(blocks)`), so `/admin/rubrics` and the method page agree. Errors are the existing `RubricNotPublishedError`.

### 2.8 Composite run record (`CompositeRunRecord`, hash `run:{id}`)

`id`, `tool: "built-to-scale"`, `createdAt`, `source: "web"`, `quickMode` (boolean), `inputs` (five-part mode: the five parts keyed by part key; quick mode: `{ description }`), `children` (object slug to child run id, public tools that ran), `absentTools` (array of slugs skipped: hidden, or rubric not published at run time), `rows` (array of five `{ key, grade, comment, sources }` in method order; `sources` are child ids the model cited and the parser kept), `total`, `bandKey`, `band` (label), `verdict`, `strongest`, `weakest`, `oneChange`, `confidence`, `confidenceReason`, `rubricVersion`, `rubricHash` (the `built-to-scale` row), `models` (`synthesis`), `routes` (`synthesis`), `calibrated` (`synthesis`), `detailsAt` (set when every child's full view was produced), `unlock`, `emailStatus`, `emailedAt`. The child records carry their own rubric hashes and models, so the composite does not repeat them.

Child runs are ordinary `RunRecord`s with `source: "built-to-scale"` and `parentId`. They are saved with the 30 day TTL; `markCompositeUnlocked` PERSISTs and indexes them with the parent, and the 1b delete flow removes them with it.

Run ids for both kinds come from `newRunId()`; `getCompositeRun` and `getRun` discriminate on the stored `tool`.

### 2.9 Copy constants (in the method module, tested for dashes)

- `AUTOMATED_LABEL` (section 7.3 of the plan updates, verbatim): "This score was produced automatically. The rubrics behind it come from Summit's advisory work, so the questions and the standards are ours, but the reading of your answers was done by a model, not a person. It will miss context it was not given and it cannot check your claims. Treat it as a structured first opinion. If you want a person to look, ask Summit to score it."
- `AUTOMATED_LINE`: "Produced automatically against Summit's rubrics. A structured first opinion, not advice."
- `QUICK_NOTE`: "Quick check from one description: confidence is one step lower than a five part run would earn."
- `LOCKED_COMMENT`: "Unlock the full view to read the comment."
- Card and page copy in sections 2.13, 2.14, 2.16 and 2.17.

### 2.10 Address resolution shared

`findAddressForHash(emailHash, excludeId)` in `runs.ts`: `listRunIdsByEmail`, `getRuns` of the other ids, newest first by `createdAt`, the first with a non-empty `unlock.email`, else null. The tool details route and the composite details route both call it; behaviour for tool runs is unchanged.

### 2.11 The Built to Scale? email (`renderBuiltToScaleEmail`)

Args: `full: CompositeFullView`, `savedUrl`, `deleteUrl`. Subject "Your Built to Scale? score: {total} of 25, {band}". Text and HTML in the same order: "Built to Scale? scorecard, Summit GTM Toolkit"; "{total} of 25" and the band; verdict; confidence with reason; the quick note when `quickMode`; "Five dimensions": each row as "{name}: {grade} of 5" then the comment; "Strongest" line; "Weakest" line; "The one change" line; "Your saved result" with the saved URL; "Delete my data" with the 1b sentence and the delete URL; `AUTOMATED_LABEL` as the closing paragraph. HTML: the 1b text-first layout (one column, system font stack, inline styles with BRAND hex values, no images), the total in a 28 px line as the tool email shows the score, each row a short block with a dotted five character run (filled and empty circles as text characters "●" and "○") before the grade so the row reads in plain text too. Every model string goes through `plainDashes` then `escapeHtml` in HTML, `plainDashes` in text. Working is not in the email.

### 2.12 `Scorecard` and the row grid

Props: `view: CompositeFreeView | CompositeFullView`; `label?: string` (rendered beneath the headline; default `AUTOMATED_LINE`); `renderWorking?: (row: CompositeRow) => ReactNode` (called per row only when the view is full and the prop is given); `compact?: boolean` (reserved for Release 4 report embeds; today false; it hides strongest, weakest and the one change).

Sections, top to bottom, inside one panel with background `BRAND.darkGreen`, radius 12, padding 28 (16 on mobile), text `BRAND.white`:

1. Headline: eyebrow "Built to Scale?" in Barlow Condensed 12 px, letter spacing 0.14 em, `BRAND.brandGreen`; the total as "{total}" in `var(--font-barlow-condensed)` weight 700 at 72 px (56 on mobile) with "of 25" beside it in 18 px DM Sans at 60 percent white; the band in Barlow Condensed 22 px uppercase, letter spacing 0.06 em; the verdict in DM Sans 17 px, line height 1.5, max width 640; the quick note in 13 px at 70 percent white when `quickMode`; then the `label` line in 12 px at 60 percent white.
2. Rows: a `div.bts-rows` with a top border rgba white 0.12. Each row is `div.bts-row`, a CSS grid of two columns (`minmax(0, 1fr) auto`) and two lines: name (DM Sans 15 px weight 600) left, and on the right a flex of five dots (10 px circles, gap 6; filled `BRAND.brandGreen`; empty a 1.5 px border rgba white 0.3) followed by "{grade}" in Barlow Condensed 28 px weight 700 and "/5" in 13 px at 60 percent white; the second line spans both columns: the comment in DM Sans 14 px at 85 percent white, or, when the view has no comment, `LOCKED_COMMENT` in 13 px italic at 50 percent white. Rows are separated by a 1 px rgba white 0.08 line. Below the comment, `renderWorking(row)` when given.
3. Strongest and weakest: two cells side by side (one column on mobile), each an uppercase Barlow Condensed 12 px label and the line in 14 px.
4. The one change (full view only): a cell with a 3 px `BRAND.brandGreen` left border, label "The one change", the sentence in 15 px weight 500.

Dots are rendered from the grade: `Array.from({ length: 5 })` with index less than grade filled; `aria-label` "{grade} of 5" on the dots group and the numeral marked `aria-hidden` so screen readers hear it once.

Mobile rules in `globals.css` under `@media (max-width: 480px)`: `.bts-panel` padding 16; `.bts-total` font size 56; `.bts-row` grid stays two columns so the dots never wrap under the name; `.bts-dots` fixed width 86 px; `.bts-pair` (strongest and weakest) one column; the method table wrapper `overflow-x: auto`. Nothing has a min width above 320 px, so 375 px shows no horizontal scroll. Fonts: `var(--font-barlow-condensed)` for numerals and labels, `var(--font-dm-sans)` for body; no `--font-oswald` anywhere in the new components.

### 2.13 `BuiltToScalePage` sections and state

Phases: `input`, `scoring`, `scored`, `unlocking`, `full`, `error`, as `ToolPage`. State: `mode` (`five` | `quick`), `parts` (five strings), `description`, `honeypot`, `free`, `full`, `error`, `errorReturn`, `emailed`, `prefilledFrom` (`{ tool, name } | null`).

Sections in order:

1. Hero band (the tool page gradient): eyebrow "Summit GTM Toolkit", H1 "Built to Scale?", lead "One form, five dimensions, a score out of 25 for how well your business model can scale.", a link "How this is scored" to `/tools/built-to-scale/method`.
2. Under the heading, in a light panel: `AUTOMATED_LABEL` in one paragraph (13 px, `BRAND.mid`). This is the label on the form.
3. Toggle: two buttons "Five parts" and "Quick check", the active one in `BRAND.brandGreen`; switching keeps both sets of text.
4. Five-part form: for each part in order, label with the required marker, the prompt line in 12 px `BRAND.mid`, a textarea (min height 140), the counter "{n} / 2,000" turning red under 40 and amber over 1,800, and "Show an example" which fills that part only. Quick form: one textarea with its label, prompt, counter and example. The honeypot input as `ToolPage`. The prefilled line when `prefilledFrom` is set. Button "Score my model", enabled when every part (or the description) is 40 to 2000 characters after trim; disabled while scoring.
5. Loading: `CyclingLoader` light with "Scoring {n} tools" (n from `PUBLIC_TOOLS.length`), "Reading the results together", "Writing the scorecard".
6. Result: `Scorecard` with the free or full view, `label` omitted (the paragraph is already above), `renderWorking` set to a `ScorecardWorking` per row when `full`. Beneath it: `ToolShareButtons` with `path` `/tools/built-to-scale/r/{runId}` and title "Built to Scale? scorecard: Summit Strategy Advisory" (they render on the dark panel's footer strip), a "Score again" link that returns to `input` keeping the text, and when `emailed` the 1b "on its way to your inbox" line.
7. `UnlockGate` when `scored`; loader "Unlocking the scorecard", "Writing the working for each tool", "Sending your copy" when `unlocking`.
8. `ErrMsg` on error; 503 shows the 1b "being updated" message; 502 and 429 show the server message.

Calls: `POST /api/built-to-scale/score` with `{ parts, website }` or `{ description, website }`; on `unlocked` true go to `unlocking` and request details; `POST /api/tools/built-to-scale/unlock` with the gate trio; `POST /api/built-to-scale/details` with `{ runId }`; a 403 returns to `scored`. Events are server side; the page sends none.

### 2.14 Result page (`/tools/built-to-scale/r/[id]`)

`generateMetadata`: `getCompositeRun(id)`; missing returns `{ title: "Built to Scale? scorecard" }` (the page then 404s); present returns title "Built to Scale? {total} of 25: {band}", description the verdict (dash normalised), canonical `https://summitstrategyadvisory.com/tools/built-to-scale/r/{id}`, `robots: { index: false }` (a visitor's result is not a page to rank), and OpenGraph and twitter titles; the image is picked up from the sibling `opengraph-image.tsx` by Next's file convention, so no `images` entry is written by hand.

Render: `notFound()` when missing. Authorisation: `run.unlock` set, or `verifyUnlockCookie(cookies().get(UNLOCK_COOKIE)?.value)`, or `verifySavedLinkToken(searchParams.t, id)`. Then:

- Authorised and `run.detailsAt` set: `getRuns(Object.values(run.children))`, `toCompositeFullView(run, children)`, `Scorecard` with `label` = `AUTOMATED_LABEL` and `renderWorking` = `ScorecardWorking`.
- Authorised and no stored details: the free view in `Scorecard` plus `OpenFullView` (one client button) under it.
- Not authorised: the free view only.

Around the scorecard: `SiteNav`, a back row to `/tools/built-to-scale` reading "Built to Scale?", eyebrow "Scorecard", a line "Scored on {date}" (en-GB long date), the `Scorecard`, then a CTA band: heading "Score your own model", one line "One form, five dimensions, a score out of 25. Free, no account.", a button to `/tools/built-to-scale`, and a link "How this is scored" to the method page; `ToolShareButtons` with the page path; `ToolkitFooter`. The saved link token is read once on the server and never echoed into the page.

### 2.15 OG image (`opengraph-image.tsx`, edge)

Reads `UPSTASH` through `getRedis()` from `app/lib/redis.ts` (the only lib import; it has no `node:` dependency), `hgetall("run:{id}")` after checking the id pattern, then `readCompositeSummary(hash)` and `scorecardImageData(summary)`. Layout at 1200 by 630 on `#053030`: the wordmark "SUMMIT STRATEGY ADVISORY" top left in `#6EBF8B` 14 px letter spaced as the site image does it (the mark is text, decision 4.11); below it "Built to Scale?" at 36 px white weight 700; left column: the total at 160 px weight 900 white with "of 25" at 28 px at 55 percent white, the band at 30 px `#6EBF8B` uppercase; right column: five rows, each the dimension name at 24 px white and five 18 px circles (filled `#319A65`, empty 2 px border rgba white 0.35) with the grade at 28 px; bottom line "scored against Summit's rubrics" at 20 px at 55 percent white. Fonts are the edge runtime's default sans (no font file fetch; decision 4.11). When the run is missing, expired or not a composite, the same frame renders with "Built to Scale?" and the line only, no numbers. `Cache-Control` is Next's default for file-based images; the composite's numbers never change after the run, so caching is safe.

### 2.16 Method page

`getRubricBlocks("built-to-scale")` inside try/catch. On success: `SiteNav`, back row to `/tools/built-to-scale`, eyebrow "The method", H1 "How Built to Scale? scores a business model", a lead "Five dimensions, each scored 1 to 5, totalling 25. The definitions below are the ones the scoring reads; they come from the same Summit rubric, so what you read here is what the model is held to.", `AUTOMATED_LABEL` in the light panel, then `<RubricBlocks blocks />`, then a line "Version {version}, updated from the rubric on {fetchedAt date}", a CTA to the tool page, footer. On `RubricNotPublishedError` or any error: the same chrome and H1, one paragraph "The method page is being updated. The tool itself is unaffected; check back shortly.", the CTA, and a 200 (the page is a server component; no `notFound()`), logged with the error message only.

`RubricBlocks` renders: `heading` level 2 as an H2 in Barlow Condensed 26 px `BRAND.darkGreen` (level 1 the same at 30 px, level 3 an H3 at 18 px DM Sans weight 600); `paragraph` 15 px line height 1.7; `bullets` a `ul` with 8 px gaps; `numbered` an `ol` whose items set the text up to the first full stop in weight 600; `quote` a left bordered paragraph; `table` inside a `div` with `overflowX: auto` and class `bts-table-wrap`, a `table` with `borderCollapse`, header row cells in Barlow Condensed 13 px uppercase on `BRAND.lightBg`, body cells 14 px with a 1 px `BRAND.border` bottom and vertical align top, the first column weight 600. The spec's named content (five dimension definitions with the 1 and 5 descriptions, the bands, the "How the synthesis call works" steps and the comment rules) is simply the row's sections in order; nothing is picked by heading, so a reordering in Notion changes the page without a deploy.

### 2.17 Hub copy and the three-path block

In `hub-copy.ts` (pure; `{Count}` is `PUBLIC_TOOL_COUNT_WORD_CAPITALISED` or `PUBLIC_TOOL_COUNT_WORD`):

- `HUB_LEAD`: "{Count} free diagnostics and one score for the whole model. Each one reads what you tell it against the rubrics Summit uses in client work and tells you what to fix first. No signup, a result in under a minute."
- `HUB_INTRO` (replaces "Three steps. No account required. Results in under 30 seconds."): "Three steps. No account. A result in under a minute."
- `HOW_IT_WORKS`: 01 "Pick a path": "Use one tool to check one part of your model, score the whole model in one form, or ask Summit to score it for you." 02 "Get scored against the rubrics": "A model reads what you wrote against Summit's rubrics, the ones we use in client work, and returns a score, a grade and a verdict. It reads what you give it and cannot check your claims." 03 "Fix the right thing first": "Every result names the constraint, what it costs in a finite market and the one change to make first. The full working arrives by email."
- `ENTRY_PATHS` (titles and bodies from section 7.2 of the plan updates, the first body's count derived): `{ title: "Use a tool", body: "{Count} diagnostics, one question each. Pain, buyer, positioning, moat and more. Free, no account, a score and verdict in under a minute, the full working on email.", href: "#tools", cta: "See the tools" }`; `{ title: "Score your own model", body: "One form, five dimensions, a score out of 25 for how well your business model can scale. Scored automatically against Summit's rubrics, the same ones we use in client work. It is a machine's reading of what you tell it, so it is only as good as your input, and it is not advice.", href: "/tools/built-to-scale", cta: "Score my model" }`; `{ title: "Ask Summit to score it", body: "Give us your website and a deck. We run the same tools, then a person reads the output, checks it against what we know, edits the scores and writes the commentary. You get a reviewed report, a one-slide summary and a call to walk through it. Usually within two working days.", href: "mailto:info@summitstrategyadvisory.com?subject=Ask%20Summit%20to%20score%20it", cta: "Email Summit", comingNext: true }`.
- `CONTACT_EMAIL`: `info@summitstrategyadvisory.com` (the address in the site's Organization schema).

`ToolkitHub` renders the block as a `cards-section` titled "Three ways in" with three `card`-class panels in the hub's card style: a top strip with the number 01 to 03 in Barlow Condensed and, for the third, a tag "Coming next" in amber; title, body, and the `cta` as the card link (`Link` for the first two, a plain anchor for the mailto). The first card's `#tools` anchor targets `id="tools"` on the grid section. Hero lead reads `HUB_LEAD`; the How It Works section reads `HUB_INTRO` and `HOW_IT_WORKS` instead of the inline array (which contained an em dash and "six dimensions").

### 2.18 Admin runs page

- Chips: All, the public tools, and "Built to Scale?" (`tool=built-to-scale`, colour `#319A65`). `toolFilter` accepts public slugs or `built-to-scale`.
- A `id` search param: when present and matching the id pattern, the page shows that single run (either kind, via `getRun` then `getCompositeRun`) with a "All runs" link and the same row and detail rendering; `listRuns` is not called.
- Rows: for a composite, the Tool chip reads "Built to Scale?", the Score cell shows `{total}` with "/25" in 11 px, the Grade cell shows the band label, Confidence as stored, Rubric `v{rubricVersion}`, Model `models.synthesis`, Unlock and Details as today (Details "Yes" when `detailsAt`), Open shows the verdict.
- Composite detail: "Inputs" lists the five parts by `BTS_PARTS` label (or "Business description" in quick mode) in the existing `pre` style, with "Quick mode" noted; "Rows" lists the five rows as name, grade of 5, comment; "Children" lists each `children` entry as "{tool name}: {runId}" linking to `/admin/runs?id={runId}`, and "Absent tools" when any; the footer lines show the run id, rubric hash, routes and calibrated as today.
- Child rows (tool runs with `parentId`) show "child of {parentId}" as a link in the detail footer.
- `TOOL_COLOURS` gains `"built-to-scale": "#319A65"`.

---

## 3. Data Flow

### 3.1 `scoreModel(body, ctx)`

`ctx`: `{ source: "web" | "calibration", ip?, deadlineAt?: number }`.

1. `validateParts(body)`; failure throws `InputError`.
2. Composite id: `newRunId()` for web, `cal_` prefixed for calibration (as `scoreRun`). `track("bts_started", { quickMode, source })` for web.
3. `getRubric("built-to-scale")` before any child call; `RubricNotPublishedError` propagates (503), so a Draft composite row fails fast and spends no child calls.
4. Candidate tools: `PUBLIC_TOOLS` in registry order. Hidden tools are never candidates (the hidden tool rule) and are listed in `absentTools` with reason "hidden" for the prompt.
5. Children in parallel (`Promise.allSettled`): for each candidate, `composeToolInputs(entry, parts, quickMode)` then `scoreRun(slug, inputs, { source: ctx.source === "calibration" ? "calibration" : "built-to-scale", ip, parentId })`. A child rejected with `RubricNotPublishedError` is moved to `absentTools` with reason "rubric not published" (one Draft row must not take the page down); any other rejection (model failure, `SchemaError`, `InputError`) rethrows after the others settle, so the route maps it as the tool routes would (502, 500). If no child succeeded, throw `NoToolsAvailableError` (503).
6. Deadline: when `ctx.deadlineAt` is set and fewer than 15 s remain, throw `SynthesisFailedError("no time left for the synthesis")` without calling the model. The children are already stored.
7. The synthesis call: `callModel({ routingKey: "synthesis", runId, system, user, schema: synthesisSchema(), parse: (raw) => parseSynthesis(raw, childIds), temperature: 0 })`, raced against the remaining budget (`deadlineAt` minus 1 s) when a deadline is set; the timer losing throws `SynthesisFailedError`; the model call then continues in the background only until the function freezes and is logged by `llm.ts` whenever it settles. Any throw from `callModel` (empty answer, `SchemaError`, provider error after the one retry) is wrapped as `SynthesisFailedError` with the original message logged.
8. `total = totalOf(rows)`, `band = bandFor(total)`. Build the `CompositeRunRecord` (section 2.8) with `rows` as `{ key, grade, comment, sources }` from the parsed result.
9. Web: `saveCompositeRun` (persist failure logged, response still goes out as `scoreRun` does), `track("bts_result_shown", { runId, total, band: bandKey, confidence, quickMode, children: count, absent: absentTools })`. Calibration: nothing persisted, no events.
10. Return `{ run, free: toCompositeFreeView(run), children: RunRecord[] }`.

Synthesis prompt composition (the only place it is built):

- System, in order, joined by blank lines: `rubric.systemPrompt` (the Notion System Prompt property); "The five dimensions, in order, with the tools that feed each:" followed by one line per part `{key}: {name}. Fed by: {tool names in PUBLIC_TOOLS order whose feeds include the key, or "no tool in this run"}`; "Grades are integers from 1 to 5. The total out of 25 and the band are computed by the code; do not return them. Cite a row's sources by run id from the list in the results."; `absentToolsInstruction(absentTools)` when any ("These tools were not available for this run: {names}. Where a dimension lists no tool, grade it from the visitor's own text for that part and lower confidence one step."); `quickModeInstruction()` when quick mode ("This run was made from one unstructured description, not the five parts. Return confidence one step lower than the evidence alone would justify, never high, and in confidenceReason name which of the five parts, written out properly, would raise it most."); "Return the JSON object only."; then "Method\n\n" plus `rubric.rubric` (the row body: the method table, the bands, the worked example, the synthesis steps and the comment rules).
- User: "## The visitor's five parts" then, in five-part mode, each part as `### {name}` and its text; in quick mode `### Business description (unstructured, used for every part)` and the text once. Then "## Tool results by dimension" and, per part in order, `### {name}` followed by, for each child whose entry `feeds` includes the key (PUBLIC_TOOLS order), one block: `Tool {number} {name} (run {runId})`, `Score {score} of 100, grade {grade} of 5 ({gradeLabel}), confidence {confidence}: {confidenceReason}`, `Verdict: {verdict}`, `Dimension scores: {dimension name} {score} ({level label}); ...`; or, when no child feeds the key, "No tool result for this dimension in this run." Child full views are not available at score time (details are produced on unlock), so only free views are sent; the Notion instruction that mentions observations and extras is satisfied as far as the data exists, and the prompt says so in one line: "Only the scoring results are available here; the full working is produced later."

Errors: `InputError` 400; `NoToolsAvailableError` and `RubricNotPublishedError` 503; `SynthesisFailedError` 502 with the children stored; child model failures 502 or 500 through the existing mapping; `LlmNotConfiguredError` 503.

### 3.2 `detailModel(runId, ctx)`

`ctx` as `detailRun`'s (`source`, `ip`, `cookieUnlock?`, `linkVerified?`).

1. `getCompositeRun(runId)`; missing throws `RunNotFoundError`.
2. Authorise as `detailRun`: `run.unlock` (via form); else `cookieUnlock` (record it with `markCompositeUnlocked` on the composite and its children, hash only, via cookie); else `linkVerified` (via link); else `UnlockRequiredError`.
3. Stored early return: when `run.detailsAt` is set, `getRuns(childIds)`, return `{ full: toCompositeFullView(run, children), run, generated: false }`.
4. Children full views in parallel: `detailRun(childId, { source: "web", ip })` per child (each child carries the unlock copied by `markCompositeUnlocked`, so `detailRun` authorises via "form" and serves stored details on repeat). `Promise.allSettled`; a rejected child is logged with the child id and the error message and its working entry is `full: null`.
5. When every child succeeded: `updateRun(run.id, { detailsAt: now })` (the composite's `updateRun` goes through the same `serialise`), `track("bts_full_view_opened", { runId, via })`, `generated: true`. When any failed: no `detailsAt`, `generated: false`, the full view is still returned (comments and the one change are stored on the composite; only that row's working is missing) and the next request regenerates the missing ones at the cost of the failed calls only.
6. Return `{ full, run, generated }`.

`toCompositeFreeView(run)`: `runId`, `tool`, `total`, `band`, `bandKey`, `verdict`, `strongest`, `weakest`, `confidence`, `confidenceReason`, `quickMode`, `createdAt`, `rows` (five: `key`, `name`, `grade`, `feeds: [{ tool, name, number }]` from the registry for the children that ran and feed the key), `absentTools`, `unlocked: run.unlock !== null`. No comments, no one change, no child ids.

`toCompositeFullView(run, children)`: the free view plus per row `comment`, `sources` (child ids the model cited), `working: [{ runId, tool, name, number, full: toFullView(child) | null }]` for every feeding child in registry order (null when the child has no `detailsAt` or was not loaded), and `oneChange`.

### 3.3 Hidden tool rule, stated once

A hidden tool is not a candidate; its slug is in `absentTools` and the synthesis system prompt lists it as unavailable. A dimension keeps whichever feeding tools remain; a dimension with none is graded from the part text with lowered confidence. Today `unit-of-value` and `route-to-buyer` are hidden, so `unitOfValue` has no tool and `routeToBuyer` is fed by `icp` and `persona`. Flipping a tool (its registry flag) adds it to the run with no change to this module, and `absentTools` on stored runs records what each run had.

### 3.4 Score route, exact order

1. `startedAt = Date.now()`. Parse JSON (400). Honeypot: a non-empty `website` answers `{ ok: true }`.
2. `validateParts(body)` (400 with the message).
3. `getClientIp`; `getBuiltToScaleLimiter().limit(ip)` (429 with `Retry-After: 3600` and the message "Built to Scale? runs are limited to 2 an hour from one connection. Please try again later."). The limiter runs after validation so a malformed body does not spend a token.
4. `scoreModel({ parts | description }, { source: "web", ip, deadlineAt: startedAt + 57_000 })`.
5. `verifyUnlockCookie(cookie)`; respond `{ ...free, unlocked: free.unlocked || claims !== null }`.
6. Errors through `errorResponse(err, "built-to-scale score")`.

### 3.5 Details route, exact order (mirrors 1b)

1. `startedAt`. Parse (400). `runId` required (400).
2. `verifyUnlockCookie`, `verifySavedLinkToken(body.token, runId)` (string checks only).
3. `getCompositeRun` (404).
4. Stored early return when `run.detailsAt && run.unlock`: load children, respond `{ ...full, emailed: false }` before the limiter.
5. 403 when `!run.unlock && !cookieUnlock && !linkVerified`.
6. `getDetailsLimiter().limit(`${ip}:built-to-scale`)` (429).
7. `detailModel(runId, { source: "web", ip, cookieUnlock?, linkVerified })`.
8. Email once when `result.generated && run.emailStatus === null && result.run.emailStatus === null`: address from `run.unlock.email` or `findAddressForHash`; `savedUrl = {origin}/tools/built-to-scale/r/{runId}?t={issueSavedLinkToken(runId)}`; `deleteUrl` as 1b; `renderBuiltToScaleEmail`; the 1b budget rule (58 s minus elapsed, capped at 10 s, skipped under 2 s); `recordEmailStatus` sent or failed; `track("bts_result_emailed", { runId, emailHash })`; failures logged through `redactAddresses` with the hash prefix only.
9. Respond `{ ...full, emailed }`.

### 3.6 Prefill endpoint

GET `/api/built-to-scale/prefill?runId={id}&via=tool|scorecard`. Order: `runId` must match the id pattern (400); `getRun` (a composite id or an unknown id is 404 "Run not found"); the run's tool must be public (404); respond `{ runId, tool, inputs }` with `Cache-Control: no-store`; `via=tool` tracks `score_whole_model_handoff` and `via=scorecard` tracks `tool_rerun_from_scorecard`, both with `{ tool, runId }` (and `parentId` when the run has one); an absent or other `via` tracks nothing. Never scores, reasoning, extras, unlock or email fields. No token (decision 4.9). No rate limit beyond the Redis read.

### 3.7 Calibration script

The `built-to-scale` folder gets its own branch in `readCases`: files are read; a `TO FILL` input is skipped (`SKIP_REASON_TO_FILL`); `expected.total` must be a number and `expected.rows` keys must equal the five part keys (else `error`); runnable cases go into a separate list. When at least one is runnable: after the environment check, `getRubric("built-to-scale")` in try/catch; `RubricNotPublishedError` marks every composite case `skipped` with `SKIP_REASON_NOT_PUBLISHED`; otherwise each case runs sequentially through `scoreModel(case.input, { source: "calibration" })` (five-part mode; the folder never holds quick cases), `compareCompositeCase(expected, { total: run.total, rows: grade per key })`, and the result row uses the existing `CaseResult` shape so `formatTable` prints it (overall is the total). On a full pass the script records `admin:calibration` for `run.routes.synthesis` with `run.models.synthesis` and for every child's scoring key as the tool cases do (the returned `children` carry `routes` and `models`). Tool folders are unchanged.

### 3.8 Unlock and delete for a composite

Form unlock on the Built to Scale? page posts to `/api/tools/built-to-scale/unlock`: `markCompositeUnlocked` writes the unlock on the composite and its children, PERSISTs them all and indexes them under the hash, appends `gtm-unlocks` with `tool: "built-to-scale"`, tracks `email_given`, sets the cookie. A cookie unlock is recorded inside `detailModel` the same way. The 1b delete flow reads `runs:by-email:{hash}` and therefore removes the composite and its children together.

---

## 4. Key Decisions

1. **One mapping field per tool, keyed by input key, values a list of parts (possibly empty).** Alternative: a part to inputs map. Rejected: the registry test must assert every input is accounted for, and "which parts does this input read" is the question the composer asks. The empty list is how a 100 or 500 character text field (`tamSize`, `context`, `competitors`, `cycle`) stays empty rather than receiving a truncated part; the criterion's "one or more" is read as applying to inputs the orchestration fills, and the test requires at least one part for every required input. Assumption flagged.

2. **`feeds` aligned to the Notion method table.** The registry had `persona` feeding `routeToBuyer` only and `problem` feeding `pain` only; the Notion row (the method the visitor reads) has Persona under Pain and Problem under Value evidence as well. The synthesis groups results by `feeds`, so the two had to agree; the registry test now pins the whole map to the table so a later Notion edit fails a test rather than drifting silently.

3. **Headings inside composed inputs, and no padding.** The scoring prompts are untouched by constraint, so the only way to tell a tool what it is reading is inside the input text. A heading per part names the part in the tool's own input; in quick mode a note line says the text is unstructured and that absence scores 1. Headings are long enough that a 40 character part clears every `minLength`; the test proves it for every scored tool.

4. **A part may feed two inputs of one tool (`route-to-buyer`, `unit-of-value`).** Alternative: a pointer line ("Included in the field above") in the second input. Rejected because `route` and `delivery` require 50 characters and a fixed pointer would fail validation or need per input exceptions. The duplicate costs a few hundred Haiku tokens and reads as a visitor pasting the same paragraph twice, which the rubric already copes with.

5. **Composite and tool runs share `run:{id}` and the indexes, with two record types discriminated on `tool`.** Alternative: widen `RunRecord.tool` to include `built-to-scale`. Rejected: every existing caller does `getTool(run.tool)` and reads `scores`, `score`, `grade`; a composite in that type would be a run of junk. `getRun` returns null for a composite so the three tool routes 404 it with no code change; `getCompositeRun` is the composite's door; `listRuns` and `getRuns` return the union because admin and the address lookup need both.

6. **Children carry the parent's unlock.** Alternative: authorise children through the parent inside `detailModel` by passing `linkVerified: true`. Rejected: that mislabels the `via` and leaves children with a 30 day TTL while the unlocked parent persists, so the working would 404 a month later. Copying the unlock (hash, email, name, company) onto each child and PERSISTing them keeps `detailRun` unchanged, keeps the working alive as long as the scorecard, and lets the delete flow remove the lot.

7. **The total and band are code; the model returns grades only.** Required by the spec; the schema has no total field and the parser would drop one. `bandFor` throws outside 5 to 25 so a bug cannot produce a blank band.

8. **Synthesis at temperature 0 and raced against the route's deadline.** `callModel` honours a caller temperature for synthesis; fixing it at 0 makes the composite calibration comparable run to run. The deadline race exists because `llm.ts` cannot be changed and one call can take 55 s: children (parallel, worst 55 s) plus synthesis (worst 55 s) exceed 60 s, so the orchestration refuses to start a synthesis with under 15 s left and abandons one that overruns, returning 502 with the children stored. Typical wall time is 5 to 12 s for the children and about 20 s for the synthesis.

9. **Prefill is an unauthenticated GET by run id.** The spec allows it and gives the reason as 128 bit ids; the ids are `run_` plus 16 hex characters, 64 bits of entropy, which is still beyond guessing (the 1a design accepted the same exposure for stored full views). What it returns is the visitor's own text, so the response is `no-store`, carries no scores, and child ids are kept out of the free view (section 3.2) so a shared result page never exposes a child's inputs. Alternative: a signed `prefill` token minted into every hand-off link. Rejected for this release as it would thread a token through the free view, the full view's working rows and both pages for a marginal gain; noted in section 7 as the upgrade if the owner wants it.

10. **Comments and the one change are gated; total, band, rows with grades, verdict, strongest and weakest are free.** The spec puts comments in `detailModel`'s full view and says the result page shows the free view to anyone. The locked row shows `LOCKED_COMMENT` so the shape of the scorecard is visible before the gate.

11. **The OG image uses the text wordmark and the runtime's default font.** The edge runtime cannot import `runs.ts` (it uses `node:crypto`), so the image reads the hash through `app/lib/redis.ts` and a pure reader. Loading Barlow Condensed in the image would need a font file fetched per render or committed as a binary; the existing site image uses neither, and the spec's constraint on Barlow Condensed is for the page. The PNG mark in `public/brand-icons` would need an absolute URL or a binary import on the edge; the wordmark text matches the site's current OG image. Both flagged as follow-ups.

12. **The method page is dynamic and degrades to a message, never a 404 or 500.** It reads a cache that refreshes every ten minutes; the row is Draft until launch, so the page must render something harmless now. A build time render would fail on a Draft row.

13. **`Scorecard` is a plain component with render slots.** It takes the view and two optional slots (`label`, `renderWorking`) and imports nothing but BRAND and the pure method module, so the Release 4 report pages can render a composite's view on the server with no client code, and the working (links, child full views, `<details>`) stays in the page that owns the data.

14. **A Draft child rubric makes that tool absent rather than failing the run.** The hidden tool rule covers the registry flag; a Notion row set to Draft is the same situation from the visitor's side (a tool temporarily off). Any other child failure fails the run, because a scorecard built on four of five tools without saying so would be dishonest, whereas an absent tool is named in the prompt and stored on the run.

15. **The gate is extracted into `UnlockGate`.** Both pages need the identical 1b gate; copying 40 lines of JSX would be the second copy of copy the 1b design called `UnlockGate` in the first place. `ToolPage` behaviour is unchanged.

16. **Quick mode lowers confidence by instruction, not by code.** The spec says the synthesis is "told"; the model knows what the evidence alone would justify and the code does not. The note on the result is unconditional on `quickMode`.

17. **The partial working case keeps `detailsAt` unset and sends no email.** The email promises the full view; sending it while a row's working is missing would email a saved link to an incomplete view. The next open regenerates only the missing child (stored children early return), then emails.

18. **Hub ItemList unchanged.** Built to Scale? is not a registry tool; adding it to the ItemList would break the "numberOfItems equals public tools" test and the page's own definition of the list as the tools. The page is in the sitemap and has its own JSON-LD.

Assumptions collected: 1, 9, 11, 16, plus: the Summit contact address is `info@summitstrategyadvisory.com`; the result page is `noindex`; the quick description shares the 2000 character limit with a part (the spec's figure; easily raised later); the composite calibration case `band` is informational and checked for consistency with `bandFor` only; the "Release 5 note" copy for the hero and How It Works is not in the repository, so the strings in 2.17 are written to the brief (method, three paths, no dashes, derived count) and the Reviewer should read them as proposed copy.

---

## 5. Constraints Honoured

- **No new dependencies.** `next/og` is already used by `app/opengraph-image.tsx`; `@upstash/redis` on the edge is the existing client. `package.json` is untouched.
- **Secrets via env; no address logged in full; the 1b rules.** No new env vars (`.env.example` untouched); the composite details route reuses the 1b send path with `redactAddresses` and hash prefixes; `bts_result_emailed` carries the hash as `result_emailed` does; the prefill endpoint never returns unlock fields.
- **Rubrics and method text never come from a request body.** `validateParts` reads `parts` and `description` only; the synthesis system prompt is built in `built-to-scale.ts` from `getRubric("built-to-scale")`; the method page reads `getRubricBlocks` server side; no route accepts a rubric, prompt or block.
- **Every model call through `callModel` with a routing key; no model id anywhere new.** Children use `scoring:{tool}` through `scoreRun`; the synthesis uses `synthesis`; the only change to `llm.ts` is the synthesis description string. `grep -rn "claude-" app` still matches `llm.ts` only.
- **Weights, bands and the total are code; definitions and comment rules are Notion.** `BANDS`, `bandFor`, `totalOf` in the method module with boundary tests; the dimension definitions, the 1 and 5 descriptions, the synthesis steps and the comment rules are read from the row at run time and rendered on the method page from the same row.
- **Styling: inline BRAND objects and `globals.css`; dark panel; Barlow Condensed numerals; no Oswald; no Tailwind utilities.** The site loads Barlow, Barlow Condensed, DM Sans and DM Mono through `next/font` in `app/layout.tsx`; `--font-oswald` is defined only inside the admin layout, so the public tool pages' existing `var(--font-oswald)` references already fall back to sans serif. The scorecard, the result page, the method page and the hub block use `var(--font-barlow-condensed)` for numerals and labels and `var(--font-dm-sans)` for body text; Oswald is not added to `app/layout.tsx`; the new `.bts-*` rules in `globals.css` carry only the grid and the mobile breakpoints; no Tailwind class is used.
- **Copy: British spelling, no dashes, no hype; the 7.3 label on the form, the result, the result page, the email and the method page.** `AUTOMATED_LABEL` is the verbatim 7.3 text and is rendered on the form (under the heading), on the result page (beneath the headline through the `label` slot), in the email (closing paragraph) and on the method page; the scorecard inside the form result carries `AUTOMATED_LINE` beneath the headline because the paragraph sits directly above it. Every new string is in a pure module or a constant and the tests assert no U+2013 or U+2014 in the hub copy, the method copy, the email and the instructions. The email normalises model text through `plainDashes` as 1b does.
- **Tests import pure modules only.** New tests import `registry.ts`, `built-to-scale-method.ts`, `built-to-scale-schema.ts`, `built-to-scale-email.ts`, `built-to-scale-image.ts`, `rubric-blocks.ts`, `calibration.ts`, `hub-copy.ts`, `sitemap.ts` and `scoring.ts`; none imports `built-to-scale.ts`, `pipeline.ts`, `rubrics.ts`, `runs.ts`, `llm.ts` or a route.
- **`maxDuration = 60` on both new routes; parallel children, one synthesis; synthesis failure leaves the children stored and returns 502 with a try again message.** Section 3.1 steps 4 to 7 and section 3.4; the deadline race is what keeps the route inside 60 s when `llm.ts` cannot be shortened.
- **Rate limit 2 per IP per hour for the Built to Scale? score; tool limits unchanged.** `getBuiltToScaleLimiter` with prefix `rl:bts`; the composite details reuse the details limiter under its own key; `getEvaluateLimiter` and `getDetailsLimiter` are untouched and the children are called as functions, not through the tool routes, so they spend no tool tokens.
- **`llm.ts` only the description; `rubrics.ts` only the structured mode; tool scoring prompts untouched.** `pipeline.ts` changes are the context source, `parentId` and the persist condition; `buildScoringSystem`, `buildScoringUser`, the details prompts and the schemas are not edited. The structured mode in `rubrics.ts` includes its cache keys and the clear; the shared loader refactor does not change what `getRubric` returns.
- **Hidden tool rule.** Section 3.3; `absentTools` is stored on every run and named in the prompt.
- **Release 2 content.** Every edit to `registry.ts`, `calibration.ts`, `schema.ts` (unchanged), `extras.tsx` (unchanged), `scripts/calibrate.ts`, `hub-copy.ts`, `ToolkitHub.tsx`, `app/tools/page.tsx`, `sitemap.ts` and `admin/runs/page.tsx` is designed against the branch content; the Coder starts after the merge and reads the merged file before editing.
- **`scale-up-advisory.test.ts` untouched.** It imports `toolSlugs.ts`, `sitemap.ts`, `next.config.ts` and the scale-up content; none of those is edited except `sitemap.ts`, which gains two entries that no assertion in that test excludes (it checks the scale-up pages are present). The Coder runs the file by name at every gate.
- **Node 22.18+ type stripping and the module resolution rule.** All new lib files use relative `.ts` imports; `built-to-scale-image.ts` and `built-to-scale-method.ts` have no `node:` imports so the edge bundle and the tests both load them.

---

## 6. Out of Scope

- Release 3b: uploads, the queue, "Ask Summit to score it" as a form, and the `extraction` routing key's caller. The third card is a mailto.
- Release 4: prospect reports, hand edited scores, the "Ask Summit to review this" offer on a self serve result; `Scorecard` is built to be reused there but nothing in this release consumes it outside the two pages.
- Flipping `route-to-buyer` or `unit-of-value`, publishing any Notion row, filling the Gradeshow calibration inputs, or confirming the composite case grades. The owner publishes `built-to-scale` before launch; until then the page answers 503 and the method page shows the updating message.
- A signed prefill token (decision 9), a per run currency, a resend path for a failed email, and purging `gtm-unlocks` on delete (1b decisions stand).
- Loading Barlow Condensed or the PNG mark into the OG image (decision 11).
- Indexing result pages, adding Built to Scale? to the hub ItemList, or a FAQ block on the new pages.
- Refunding a rate limit token when the synthesis fails (section 7, risk 3).
- Changing `getRuns` beyond its return type, or backfilling `parentId` and `source` on existing runs (they read as `null` and `web`).
- Any change to the tool scoring or details prompts, to `schema.ts`, to `extras.tsx`, or to the ceiling calculator.

---

## 7. Risks and edge cases for the Reviewer

1. **Time inside 60 s.** Worst case per `llm.ts`: one attempt 40 s, a retry only within the first 15 s, so about 55 s per call. Children run in parallel, so the children phase is bounded at about 55 s; the synthesis is another 55 s worst case. The orchestration therefore refuses a synthesis with under 15 s left and races one that starts; the Reviewer should confirm the deadline is computed from a clock started at the top of the route handler, that the race timer is cleared when the call wins, and that a synthesis abandoned by the race is logged by `llm.ts` as a normal call outcome (it will show in `ai:calls` whenever it settles, possibly after the response). Typical wall time is 25 to 35 s with Opus at medium reasoning; a Haiku child outlier does not add to it because they overlap.

2. **Synthesis `max_tokens` with medium reasoning.** The default is 4000 and thinking tokens count against it. The JSON answer is about 500 to 700 tokens; medium reasoning on Opus can spend several thousand. The owner's test run completed in about 20 s, so the default has worked at least once; if `ai:calls` shows "ran out of tokens" for `synthesis`, raise the key's max tokens in `/admin/models` (no deploy) and note it marks the key uncalibrated.

3. **Rate limiter cost per visitor action.** One Built to Scale? run is five children today and seven after the flips, plus one synthesis, for one visitor click: about $0.07 at the plan's prices. The limiter is 2 per IP per hour, and a failed synthesis spends one of the two with no scorecard. The spec accepts this; the Reviewer should note that a synthesis-only retry (children already stored, parent id returned on the 502) is the obvious follow-up if failures are common, and that an office NAT sharing one IP will hit the limit quickly.

4. **Quick mode and calibration.** Composite calibration cases are five-part only; quick mode's grades will differ from a five-part run of the same business and are never compared. The quick note on the result and the instruction in the prompt are the visitor's warning; the Reviewer should check the test asserts the instruction text is present when `quickMode` is true and absent otherwise.

5. **Vercel edge runtime for the OG image.** The function must stay free of `node:` imports: it imports `app/lib/redis.ts`, the pure image module and `next/og` only. The Upstash REST client works on the edge; the env vars must be present in the edge scope (they are the same project variables). A missing run renders the fallback frame, not an error. Edge functions have a smaller bundle budget; the registry is not imported by the image module (names come from `BTS_PARTS`), so the bundle stays small. If a dimension name in Notion changes, the image's names come from code (`BTS_PARTS.name`) and would need the same edit.

6. **The Release 2 merge changes files under the Coder.** `registry.ts` (the mapping and `feeds` edits sit on the branch's seven entries), `calibration.ts` (three skip constants already present), `scripts/calibrate.ts` (hidden entry branch), `hub-copy.ts` (new on the branch), `ToolkitHub.tsx`, `app/tools/page.tsx`, `sitemap.ts`, `admin/runs/page.tsx` (the object extra branch) and the tests all differ from `main`. The Coder must branch from `main` after PR 13 merges and read each file before editing; any edit designed here that does not find its anchor on the merged file means the merge did not happen yet. The Reviewer checks the branch point.

7. **`scale-up-advisory.test.ts` must stay untouched and green.** The only file it loads that this release edits is `sitemap.ts`; two added URLs do not affect its assertions. Run it by name at every gate.

8. **Notion tables versus code.** The band table and the dimension names exist in the row and in code (`BANDS`, `BTS_PARTS`). The method page shows the row; the scorecard shows the code. A Notion edit to either table without a matching code change makes the two disagree. The runbook says so; the registry and method tests pin the code side. The Reviewer should confirm the method page does not re-derive anything from the table (it renders the row as is).

9. **`unitOfValue` has no feeding tool today.** The synthesis grades it from the part text with lowered confidence, as instructed. The owner should flip `unit-of-value` (and `route-to-buyer`) before launch so every dimension has a tool; the registry test's "every part key is fed by a scored tool" assertion passes because hidden entries count as scored, which is deliberate so the flip needs no test change.

10. **Children of a run whose composite failed.** A `SynthesisFailedError` leaves five stored children with `parentId` pointing at a composite that was never saved. Admin shows them as children of an unknown parent (the link 404s to the single run view's "not found"); the delete flow does not know them because they were never unlocked, so they expire in 30 days. Acceptable; noted.

11. **Partial working and the email.** When one child's details fail, the full view is returned without that row's working, `detailsAt` stays unset and no email goes; the visitor sees the full view with the fallback line in one row. The Reviewer should confirm the page shows the full view (comments and one change) in this case rather than an error, and that the next details request regenerates only the failed child.

12. **Composite ids in tool routes and tool ids in composite routes.** `getRun` returns null for a composite (404 at the tool routes); `getCompositeRun` returns null for a tool run (404 at the composite routes); the unlock route branches on the `tool` param. The Gate B smoke covers both crossings.

13. **The `run.unlock` early return in the result page.** A stranger with a result link to an unlocked run whose details are stored sees the free view only; the full view needs the cookie, the record and the stored details together, or the saved link token. The saved link token is bound to the composite id, so a token for a child does nothing here.

14. **`react-hooks/set-state-in-effect`.** `PrefillLoader`, `OpenFullView` and the page's loaders set state only in async continuations, as the 1b `SavedResultLoader` does. The Reviewer should check the prefill loader's guard ref so React strict mode does not fire the fetch twice.

15. **Static rendering of the tool page.** `/tools/built-to-scale/page.tsx` reads no `searchParams`; `useSearchParams` is confined to `PrefillLoader` under `Suspense`. The build output must list the page as static; `/tools/built-to-scale/r/[id]` and `/method` are dynamic by design.

16. **Mobile at 375 px.** The row grid keeps two columns with a fixed width dots group; names such as "Unit of value constraints" wrap within the first column. The Reviewer should check in the device toolbar that the total, the band and the five rows render without horizontal scroll and that the working expander's dimension bars fit (they already do on tool pages at that width).

17. **The gate extraction.** `UnlockGate` must keep the exact 1b copy, field ids (`{prefix}-unlock-{key}`), the email regex check and the footnote. The ToolPage flow (`handleUnlock` then `requestDetails`) is unchanged; the Gate C smoke on a tool page confirms it.

18. **Child events double count.** Children emit `tool_started` and `result_shown` with `source: "built-to-scale"`; a report that counts tool runs should filter by source. The runbook notes it.

19. **Notion rich text formatting.** The row uses bold in the numbered steps; the structured converter carries plain text only, and the renderer bolds the leading clause of each numbered item. If the owner relies on bold elsewhere, it will render plain. Links in the body are not carried.

20. **Prefill and the hidden tool at flip time.** A child of a tool that is later hidden keeps a working row; the re-run link is shown only when `isToolPublic(tool)` at render time, and the prefill endpoint 404s a hidden tool's run, so neither path leads to a 404 page.
