# Design: Built to Scale? Release 1a, one code path

Branch `anthonystevenson0/built-to-scale-1a-one-code-path`. Source: `task-spec.md`, `docs/built-to-scale-plan-updates.md` sections 1, 2, 8, 9 and 9.6, `docs/built-to-scale-assessment.md`. Reference implementation for the OpenRouter client and admin routing table: `Summit - Canvas/app/lib/ai.ts`, `app/api/admin/models/route.ts`, `app/admin/AdminClient.tsx` (read only).

This document is design only. No code, no pseudocode. Where the spec is ambiguous the assumption is stated inline and collected in section 4.

---

## 0. Shape of the change

Today a tool is described in seven places (`toolConfig.ts`, `dimensionConfig.ts`, `toolSlugs.ts`, each score route's `DIMS`, each details route's `DIM_NAMES`, two admin dimension maps, the ICP component's `DIMENSIONS`), scored by ten route files that are copies of each other, rendered by five 430 to 812 line components, and fed rubrics from the browser. After this release:

```
app/lib/tools/registry.ts        one description per tool (pure data)
app/lib/tools/scoring.ts         weighted score, grade bands, labels (pure)
app/lib/tools/schema.ts          JSON schemas from a registry entry (pure)
app/lib/tools/validate.ts        input and unlock validation (pure)
app/lib/tools/calibration.ts     grade comparison (pure)
app/lib/tools/routing.ts         routing key resolution (pure)
app/lib/llm.ts                   the only model client, DEFAULT_ROUTES, CURATED_MODELS, ai:calls log
app/lib/rubrics.ts               the only reader of Notion rubrics and prompts
app/lib/runs.ts                  run:{id} store and runs:by-time index
app/lib/events.ts                track() to the Redis stream
app/lib/tools/pipeline.ts        scoreRun / detailRun: the only prompt builder and llm caller
app/api/tools/[tool]/score       }
app/api/tools/[tool]/details     } three generic routes
app/api/tools/[tool]/unlock      }
app/components/toolkit/ToolPage.tsx   one page for every registry entry
app/admin/runs, /models, /rubrics     admin from the run store and routing table
scripts/calibrate.ts                  calibration gate
```

Visitors see the same five tools at the same URLs with a new `ResultBlock` (score out of 100, grade 1 to 5, label, legacy label where present, verdict, confidence) above the existing breakdown and unlock flow.

---

## 1. Files to Modify / Create

Listed in implementation order, grouped into six phases. Each phase ends with a gate that must be green before the next starts. `npm test`, `npm run lint` and `npx tsc --noEmit` are expected green at every gate; `npm run build` at the gates that say so.

### Module resolution rule for the whole lib graph (read before Phase A)

Tests and `scripts/calibrate.ts` run under plain Node with type stripping. Node does not resolve the `@/` path alias and ESM needs full specifiers. Therefore:

- Every file under `app/lib/` and `scripts/` imports sibling lib files with **relative paths and the explicit `.ts` extension** (for example `./tools/registry.ts`, `../redis.ts`). No `@/` alias inside `app/lib/**`. Package imports (`openai`, `@upstash/redis`, `node:crypto`) are unchanged.
- `tsconfig.json` gains `"allowImportingTsExtensions": true` (legal because `noEmit` is already true). Next's bundler resolves an exact existing file path, so `.ts` specifiers build. The Coder confirms this with `npm run build` at the end of Phase B, before any route depends on it.
- Fallback if the build rejects `.ts` specifiers: keep extensionless relative imports in `app/lib/**` and add `scripts/register-ts.mjs`, a resolve hook registered with `node --import` that appends `.ts` to extensionless relative specifiers; `npm run calibrate` and `npm test` then pass `--import ./scripts/register-ts.mjs`. No new dependency either way.
- Nothing under `app/lib/**` imports from `next/*`, `react`, or any component. The pure modules in Phase A import nothing but each other's types.

### Phase A: registry and pure logic, with tests

| File | Change |
| --- | --- |
| `app/lib/tools/registry.ts` (create) | The single description of every tool: `icp`, `persona`, `problem`, `positioning`, `moat` (public, numbers 01 to 05) and `account` (hidden). Exports `TOOLS` (array in number order), `TOOL_SLUGS`, `ToolSlug` type, `getTool(slug)`, `isToolSlug`, `isToolHidden`, `isToolPublic`, `PUBLIC_TOOLS`, `ROUTING_TASKS`. Carries ICP's seven dimensions, weights and level labels from `icp-evaluator.tsx`, the four GTM tools' dimensions from `dimensionConfig.ts`, the "highest standard" tips from each component, card copy from `toolConfig.ts`, SEO from `toolSlugs.ts`. Type shape in section 2.1. |
| `app/lib/tools/scoring.ts` (create) | `calcScore(scores, dimensions)` (weighted mean over 5, times 100, rounded, missing key defaults to 3 as today), `gradeFor(score)` returning grade 1 to 5 plus the existing label, colour and description text (bands 85/70/50/30), `legacyLabelFor(entry, grade)`. `getGrade` is kept as an alias of `gradeFor` so `ScoreGauge` changes only its import. |
| `app/lib/tools/schema.ts` (create) | `scoringSchema(entry)` and `detailsSchema(entry)` build the JSON schemas in section 2.4 from a registry entry. `parseScoring(entry, raw)` and `parseDetails(entry, raw)` are the one validator: structural checks, integer clamp 1 to 5, enum checks, unknown keys dropped. Returns a typed result or throws a `SchemaError` with the first problem. |
| `app/lib/tools/validate.ts` (create) | `validateInputs(entry, body)` returns `{ ok, inputs }` or `{ ok: false, error }` (required, `minLength`, `maxLength`, trim, unknown keys dropped, `rubric` and `systemPrompt` keys ignored). `validateUnlock(body)` checks name, email (existing regex), company; returns the trimmed trio or an error string. `renderInputs(entry, inputs)` produces the labelled plain text block the prompts use (`Label:\nvalue` per input, blank line between). |
| `app/lib/tools/calibration.ts` (create) | `isCaseFillable(case)` (false when any input value contains `TO FILL`), `compareCase(expected, actual)` returning `{ pass, rows }` where each row is `{ key: dimensionKey | "overall", expected, actual, delta }` and `pass` is true when every `|delta| <= 1`. `formatTable(results)` returns the printable table string. Case file type in section 2.7. |
| `app/lib/tools/routing.ts` (create) | `ROUTING_TASKS` (`scoring`, `details`, `synthesis`, `extraction`), `RoutingKey` type, `parseRoutingKey(key)` (task plus optional tool, tool must be a registry slug), `resolveRoute(key, overrides, defaults)` with the order in section 2.5, `CALIBRATION_GATED(key)` (true for `scoring`, `scoring:{tool}`, `synthesis`). Pure; `DEFAULT_ROUTES` is passed in, not imported. |
| `__tests__/registry.test.ts` (create) | Weights per tool sum to 1 within 0.001; dimension keys unique per tool; slugs unique; numbers 01 to 05 for public tools in array order; every public slug has at least one input with a non-empty `example`, a non-empty `seo` block (title, description, about, howItWorks, faqs, canonical) and a non-empty `role`; `account` is hidden; every `legacyLabel` map has keys 1 to 5; every extra key is unique within its tool. |
| `__tests__/scoring.test.ts` (create) | Grade bands at 29/30, 49/50, 69/70, 84/85 (grades 1/2, 2/3, 3/4, 4/5); weighted score for a known vector per tool (for example moat all 3s is 60; ICP vector `{bca 5, pa 4, usp 3, it 2, cd 1, nf 5, fs 5}` is 72); missing key defaults to 3; legacy label for moat grade 2 and 3 both "Thin". |
| `__tests__/schema.test.ts` (create) | `scoringSchema(moat)` has six properties under `scores`, all six in `required`, `additionalProperties` false, confidence enum present; `detailsSchema(positioning)` has one `extras` property named `rewrite` and reasoning keys match the dimensions; `parseScoring` rejects a missing key and clamps 7 to 5. |
| `__tests__/routing.test.ts` (create) | Resolution order: `scoring:icp` override beats `scoring` override beats default; removing the specific override falls back to the task override; removing both falls back to the default; `parseRoutingKey` rejects `scoring:unknown` and `banana`; every task in `ROUTING_TASKS` has an entry in a sample defaults map shaped like `DEFAULT_ROUTES`. |
| `__tests__/calibration.test.ts` (create) | Exact match passes; one-point move on one dimension passes; two-point move on the overall grade fails; a case with `TO FILL` is reported skipped and not compared. |
| `__tests__/validate.test.ts` (create) | Unlock validation: missing company rejected, bad email rejected, trimmed trio returned; input validation: required empty rejected, over `maxLength` rejected, under `minLength` rejected, `rubric` key in body ignored, unknown key dropped. |
| `__tests__/gtm-toolkit.test.ts` (modify) | Remove the `FALLBACK_PROMPTS` and `toolConfig` suites. Replace with: hub cards come from `PUBLIC_TOOLS` in order `icp, persona, problem, positioning, moat` numbered `01` to `05`; every public tool links to a public route (`isToolPublic`); `account` is absent from `PUBLIC_TOOLS`. Keep the newsletter `ISSUES` suite. Drop the brand palette suite (surface and accent are no longer per tool; the hub uses one surface and accent constant). |

**Gate A:** `npm test` green including `scale-up-advisory.test.ts` untouched; `npx tsc --noEmit` green; `npm run lint` 0 errors. The old config files still exist at this point (they are removed in Phase D), so no importer breaks yet. Do not touch `toolSlugs.ts` until Phase D.

### Phase B: llm, rubrics, runs, events

| File | Change |
| --- | --- |
| `package.json` (modify) | Remove `@anthropic-ai/sdk`; add `openai` (the same major as Canvas, `^7`); add script `"calibrate": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --env-file-if-exists=.env.local scripts/calibrate.ts"`. `npm install` to refresh the lockfile. |
| `tsconfig.json` (modify) | Add `allowImportingTsExtensions: true` (see the resolution rule). |
| `app/lib/redis.ts` (no change) | Already a lazy singleton; imported relatively from the new lib files. |
| `app/lib/llm.ts` (create) | The only file that constructs a model client or names a model id. Exports `DEFAULT_ROUTES`, `CURATED_MODELS`, `TASK_LABELS`, `TASK_DESCRIPTIONS`, `getRouteConfig()` (merged overrides, 30 s in-memory cache), `invalidateRouteCache()`, `resolveRoute(key)` (wraps the pure resolver with the live overrides), `callModel(args)`, `logCall(entry)`, `MODEL_CONFIG_KEY = "admin:model-config"`, `AI_CALLS_KEY = "ai:calls"`, `CALIBRATION_KEY = "admin:calibration"`. Details in section 2.5 and 2.6. |
| `app/lib/rubrics.ts` (create) | `getRubric(slug)` returning `{ systemPrompt, rubric, version, hash, fetchedAt }`, `clearRubricCache()` (deletes `rubric:{slug}` for every registry slug and empties the memory map), `notionBlocksToText(blocks)` extended with tables, `RubricNotPublishedError`. Details in section 2.3. |
| `app/lib/runs.ts` (create) | `newRunId()`, `saveRun(run)`, `getRun(id)`, `updateRun(id, patch)`, `markUnlocked(id, unlock)`, `listRuns({ tool?, limit, offset })`, `countRuns()`. Keys and TTLs in section 2.8. |
| `app/lib/events.ts` (create) | `track(name, props)`: XADD to stream `events` with approximate MAXLEN 50000, fields `name`, `ts`, `props` (JSON string). Never throws (try/catch around everything, Redis unavailable included), never awaited by callers on the response path (callers call it without `await` and the function itself swallows rejections). `EventName` union: `tool_started`, `result_shown`, `email_given`, `full_view_opened`, `re_run`. |

**Gate B:** `npx tsc --noEmit`, `npm run lint`, `npm test` green; `npm run build` green (this is the check that `.ts` specifiers bundle; if it fails, apply the fallback in the resolution rule before continuing). Nothing calls the new modules yet.

### Phase C: pipeline and generic routes

| File | Change |
| --- | --- |
| `app/lib/tools/pipeline.ts` (create) | `scoreRun(slug, inputs, ctx)` and `detailRun(runId, ctx)`; the only code that builds prompts or calls `callModel`. Stages in section 3. Exports `toFreeView(run)` and `toFullView(run)` projections so routes never touch the record directly. |
| `app/api/tools/[tool]/score/route.ts` (create) | POST. `runtime nodejs`, `dynamic force-dynamic`, `maxDuration = 60`. Parse body, honeypot, slug check (404 for unknown or hidden), input validation (400), rate limit (429), `scoreRun`, `re_run` event when `rerunOf` is present, JSON free view. Error mapping in section 3.4. |
| `app/api/tools/[tool]/details/route.ts` (create) | POST. Same exports. Body `{ runId }`. Loads the run; if it already has details, returns the full view before the limiter (idempotent re-open, as today). Otherwise limiter (429), `detailRun`, JSON full view. |
| `app/api/tools/[tool]/unlock/route.ts` (create) | POST. Body `{ runId, name, email, company, website }`. Validates with `validateUnlock`, loads the run (404 if missing or tool mismatch), `markUnlocked`, RPUSH to `gtm-unlocks` with `{ id: runId, tool, name, email, company, unlockedAt }` (the digest's shape, so `daily-report` needs no change), `track("email_given")`, returns `{ ok: true }`. |
| `app/lib/ratelimit.ts` (no change) | `getEvaluateLimiter` and `getDetailsLimiter` are reused as they are. |

**Gate C:** build, lint, tsc, tests green. Manual smoke with `curl` against `npm run dev`: `POST /api/tools/moat/score` returns a free view with `runId`, `score`, `grade`, `verdict`, `confidence`; `POST /api/tools/moat/details` without an unlock returns 403; after `POST /api/tools/moat/unlock`, details returns the full view; `POST /api/tools/account/score` returns 404; a body carrying `rubric` scores identically. The old per-tool routes still exist and are untouched; they are deleted in Phase D.

### Phase D: ToolPage, and deletion of per-tool components and routes

| File | Change |
| --- | --- |
| `app/components/toolkit/shared/ResultBlock.tsx` (create) | Client component. Props: `score`, `grade`, `label`, `legacyLabel?`, `verdict`, `confidence`. Renders `ScoreGauge`, a grade chip ("Grade 4 of 5"), the legacy label chip where present, the verdict sentence, a confidence chip (low, medium, high) with a one-line explanation. Inline styles with BRAND tokens. |
| `app/components/toolkit/shared/extras.tsx` (create) | `EXTRA_RENDERERS`: a map from extra key to a small component rendering that extra (`priority`, `rewrite`, `biggestGap`, `keyQuestion`, `validationMoves`). A key with no renderer falls back to a generic labelled paragraph or list, so a new extra never breaks the page. |
| `app/components/toolkit/ToolPage.tsx` (create) | Client component, props `{ slug }`. Reads `getTool(slug)`. Sections and state machine in section 2.9. Reuses `ScoreGauge`, `GtmDimensionBar`, `ToolShareButtons`, `CyclingLoader`, `ErrMsg`, `Tag`, `ResultBlock`, the extras map, and the existing `gtm-tool-grid` class for the two-panel intro. Honeypot field as today. |
| `app/components/toolkit/shared/ScoreGauge.tsx` (modify) | Import `getGrade` from `app/lib/tools/scoring.ts` instead of `dimensionConfig`. Nothing else changes. |
| `app/components/toolkit/shared/ToolShareButtons.tsx` (modify) | Import `ToolSlug` type from the registry. |
| `app/tools/[tool]/toolSlugs.ts` (reduce) | Becomes a re-export shim: `TOOL_SLUGS`, `ToolSlug`, `isToolSlug`, `isToolHidden`, `isToolPublic`, `ToolFaq`, and `TOOL_SEO` (derived as `Record<ToolSlug, seo>` from the registry). Kept only because `scale-up-advisory.test.ts` and `scale-up-content.ts` import it and the test must stay untouched. A header comment says new code imports the registry. |
| `app/tools/[tool]/page.tsx` (modify) | Reads the registry: `generateStaticParams` from `PUBLIC_TOOLS`, `generateMetadata` and the FAQ block from `entry.seo`. Same titles, descriptions, canonicals and FAQ copy. The `params` Promise handling stays as it is. |
| `app/tools/[tool]/ToolRunner.tsx` (modify) | Drops `usePrompts` and `useRubrics`. Renders `<ToolPage slug />` for every public registry tool and `<AccountIntelTool systemPrompt="" />` for `account` (the component is untouched; its route uses its own default prompt when the string is empty). Chrome (nav, back row, footer, children) unchanged. |
| `app/components/toolkit/ToolkitHub.tsx` (modify) | Cards map over `PUBLIC_TOOLS` (ICP is no longer a hand-written card; it is `01` in the registry). One surface and accent constant for all cards (`#0a1a14`, `#319A65`). The Account Intelligence section reads `isToolHidden("account")` from the registry. Legacy `?tool=` redirect unchanged. |
| `app/tools/page.tsx` (modify) | `itemListSchema` built from `PUBLIC_TOOLS` (`position = index + 1`, `name`, `seo.description`, `seo.canonical`). Page metadata text unchanged. |
| `app/api/gtm/account/route.ts` (modify, minimal) | Replace the `@anthropic-ai/sdk` import (the package is removed) with `callModel` from `llm.ts` on routing key `extraction`, passing `web: true` so `llm.ts` attaches OpenRouter's web plugin, and the existing account-brief JSON shape as the schema. `isToolHidden` now imported from the registry. Everything else (limiter, body validation, hidden check, response shape, `maxDuration = 30`) stays. The tool remains hidden so this path is not reachable by visitors. |
| Delete | `app/api/gtm/moat/score/route.ts`, `app/api/gtm/moat/details/route.ts`, `app/api/gtm/persona/score/route.ts`, `app/api/gtm/persona/details/route.ts`, `app/api/gtm/positioning/score/route.ts`, `app/api/gtm/positioning/details/route.ts`, `app/api/gtm/problem/score/route.ts`, `app/api/gtm/problem/details/route.ts`, `app/api/gtm/rubrics/route.ts`, `app/api/gtm/unlock/route.ts`, `app/api/prompts/route.ts`, `app/api/evaluate-icp/route.ts`, `app/api/evaluate-icp-details/route.ts`, `app/api/icp-unlock/route.ts`, `app/components/icp-evaluator.tsx`, `app/components/toolkit/tools/MoatTool.tsx`, `app/components/toolkit/tools/PersonaTool.tsx`, `app/components/toolkit/tools/PositioningTool.tsx`, `app/components/toolkit/tools/ProblemTool.tsx`, `app/components/toolkit/hooks/usePrompts.ts`, `app/components/toolkit/hooks/useRubrics.ts`, `app/components/toolkit/data/fallbackPrompts.ts`, `app/components/toolkit/data/toolConfig.ts`, `app/components/toolkit/data/dimensionConfig.ts`, `app/components/toolkit/shared/useToolUnlock.ts`. Remove the now-empty `hooks/` and `data/` directories. |

**Gate D:** build, lint, tsc, tests green. `grep -rn "anthropic" app package.json` returns nothing; `grep -rn "claude-" app` matches only `app/lib/llm.ts`. In the browser: each of `/tools/icp`, `/tools/persona`, `/tools/problem`, `/tools/positioning`, `/tools/moat` renders, scores, shows the result block, unlocks and shows the full view; `/tools/account` is 404; `/tools` lists five cards 01 to 05.

### Phase E: admin pages and routes

| File | Change |
| --- | --- |
| `app/api/admin/models/route.ts` (create) | GET and PATCH. Both call `validateSession()` from `app/lib/auth.ts` first and return 401 otherwise (the middleware lets `/api/admin/*` through unauthenticated so the login route works; this route must check itself). Shapes in section 2.6. |
| `app/api/admin/rubrics/route.ts` (create) | POST behind `validateSession()`: `clearRubricCache()`, then redirect 303 to `/admin/rubrics`. Used by the refresh button (a plain form POST, no client JS). |
| `app/admin/runs/page.tsx` (create) | Server component, `dynamic force-dynamic`, `searchParams` is a Promise (`{ tool?, page? }`). Tool filter chips from `PUBLIC_TOOLS` plus All. Table: date, tool, score, grade, confidence, rubric version, scoring model, unlock email, details present. Expandable `<details>` row with inputs (labelled from the registry), per-dimension scores with level labels, reasoning, extras and recommendations. 100 rows per page via `listRuns`. Styling copied from the current `gtm/page.tsx` table. |
| `app/admin/page.tsx` (modify) | Cards: Page visits, Build requests (unchanged), Runs scored (`countRuns()`), Emails captured (`LLEN gtm-unlocks` plus `LLEN icp-unlocks`, the legacy list, labelled as such). Links: AI Studio, Runs, Models, Rubrics. Remove the ICP and GTM cards and links. |
| `app/admin/models/page.tsx` (create) | Server shell (title, intro line) rendering `ModelsClient`. |
| `app/admin/models/ModelsClient.tsx` (create) | Client component. Fetches GET `/api/admin/models`. One row per task in `ROUTING_TASKS`, per-tool override rows expandable beneath each task. Columns: task label and description; model select limited to the catalog (a retired model still shows as a disabled option so the row reads); live price in and out per million; reasoning select (off, low, medium, high); max tokens number; fallback select (synthesis only); calibration state ("Passed with {model} on {date}" or "Uncalibrated since {date}", or "Not gated" for details and extraction); calls and spend in the last 30 days; Reset to default; "Add per-tool override" picker (task plus registry tool slug) that PATCHes a `{task}:{tool}` key. Inline styles with BRAND tokens, same table style as the runs page. Changes PATCH one key at a time and re-render from the returned config. |
| `app/admin/rubrics/page.tsx` (create) | Server component. For each public tool calls `getRubric(slug)` inside try/catch and lists: tool, version, hash (first 12 chars), fetched at, system prompt length, rubric length, or the error ("Not published"). One form button "Refresh rubrics" posting to `/api/admin/rubrics`. |
| `app/admin/layout.tsx` (modify) | Nav links: Dashboard, AI Studio, Runs, Models, Rubrics. Remove ICP Submissions and GTM Submissions. |
| Delete | `app/admin/gtm/page.tsx`, `app/admin/icp/page.tsx` (and their directories). |

**Gate E:** build, lint, tsc, tests green. In the browser behind the admin session: `/admin` counts, `/admin/runs` lists the Phase D runs with the filter working, `/admin/models` changes `scoring` to another curated model and the row turns uncalibrated, Reset clears it, `/admin/rubrics` lists five published rows and Refresh re-fetches. A run scored after the model change shows the new model id in `/admin/runs`.

### Phase F: calibration script, env and docs

| File | Change |
| --- | --- |
| `scripts/calibrate.ts` (create) | Reads `calibration/{tool}/*.json` for every registry slug (folders for slugs not in the registry, such as `built-to-scale`, `route-to-buyer`, `unit-of-value`, are reported as "no registry entry, skipped"). Skips `TO FILL` cases and reports them. Calls `scoreRun(slug, case.input, { source: "calibration" })` for the rest, sequentially per tool, tools in parallel. Compares with `compareCase`, prints `formatTable`, prints a summary line, exits 1 on any failure or any thrown error. On a full pass with at least one case run, writes `admin:calibration` for every routing key that resolved during the run (section 2.6). Exits 2 with a clear message when `OPENROUTER_API_KEY`, `NOTION_TOKEN`, `NOTION_RUBRICS_DB_ID` or the Upstash variables are missing. Never prints a secret. |
| `.env.example` (modify) | Sections: OpenRouter (`OPENROUTER_API_KEY`), Notion (`NOTION_TOKEN`, `NOTION_RUBRICS_DB_ID`), Upstash (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, with the `KV_*` alternative kept), SMTP and digest (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `NOTIFY_EMAIL`, `CRON_SECRET`), admin (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_ALLOWED_EMAIL`), newsletter (`NEWSLETTER_ENDPOINT`). Removed: `ANTHROPIC_API_KEY`, `NOTION_PROMPTS_DB_ID`, `GOOGLE_API_KEY`, `SKILL_DOC_ID`, `RECOMMENDATIONS_DOC_ID`, `NOTION_*_RUBRIC_ID`. No dashes in comments. |
| `docs/runbook.md` (modify, Docs agent) | Entry "Built to Scale? Release 1a: one code path": the pipeline stages, the routing table and how to change a model, the calibration script and what a failure means, the Redis keys, the retired env vars. |
| `calibration/README.md` (modify) | Replace "Flags and output format are defined by the script in Release 1a" with the actual usage, the `TO FILL` convention, the exit codes, and the `expected` shape for tool cases (section 2.7). |

**Gate F:** `npm run calibrate` runs end to end against the five tools (every case currently in the folders is a `TO FILL` skip or absent, so the expected result is "0 run, N skipped, pass" with no `admin:calibration` write because nothing ran); all four quality gates green; `git status` shows no stray files.

---

## 2. Integration Points

### 2.1 Registry type shape (`app/lib/tools/registry.ts`)

`ToolEntry` fields, all required unless marked optional:

- `slug`: one of `icp | persona | problem | positioning | moat | account` (string literal union `ToolSlug`).
- `number`: two-character string `"01"` to `"05"`; `"00"` for `account`.
- `name`: display name, equal to the SEO title's prefix before the dash (the existing scale-up test depends on this).
- `tagline`: card and hero sentence.
- `outputDescription`: the "You get" line on the hub card.
- `intro` (optional): array of paragraph strings rendered between the hero and the two panels. Only `icp` sets it, carrying the two narrative sections from `icp-evaluator.tsx` with their H2s as a `{ heading?, text }` pair per item.
- `inputs`: ordered array of `ToolInput`: `key` (string, unique within the tool), `label`, `placeholder`, `example` (a realistic filled-in value shown under a "Show an example" link and insertable into the field), `maxLength` (number), `minLength` (number, 0 when absent), `required` (boolean), `kind` (`"textarea" | "text"`).
- `dimensions`: ordered array of `ToolDimension`: `key` (two or three letters, unique within the tool), `name`, `weight` (number, weights sum to 1), `levels` (object with keys 1 to 5, each a short label), `standard` (the "highest standard" tip sentence).
- `role`: one sentence, for example "a competitive strategy expert focused on B2B SaaS and enterprise software".
- `extras`: array of `ToolExtra`: `key` (string), `label`, `ask` (the instruction the details prompt gives for this extra), `kind` (`"text" | "list"`). `moat`: `priority` (text, the 90 day priority). `positioning`: `rewrite` (text). `persona`: `biggestGap` (text), `keyQuestion` (text). `problem`: `validationMoves` (list). `icp`: empty array. `account`: empty array.
- `legacyLabel` (optional): object keyed 1 to 5. Only `moat`: `{ 5: "Strong", 4: "Moderate", 3: "Thin", 2: "Thin", 1: "Exposed" }`.
- `seo`: `title`, `description`, `about`, `howItWorks` (string array), `faqs` (array of `{ q, a }`), `canonical`. Copied verbatim from `TOOL_SEO`, including the dash in each title, because titles and canonicals must not change and the untouched scale-up test splits the title on it.
- `hidden`: boolean. `true` for `account` only.
- `feeds`: array of Built to Scale dimension names as strings (`pain`, `routeToBuyer`, `unitOfValue`, `valueEvidence`, `abilityToProtect`); `moat` feeds `abilityToProtect`, `problem` feeds `pain`, `icp` and `persona` feed `routeToBuyer`, `positioning` feeds `valueEvidence`. Informational in this release.
- `cta`: `{ heading, body }` for the book-a-call panel (today's per-tool copy, dashes removed).
- `buttonLabel`: the submit button text (Rate My Moat, Grade My Positioning, Score My Persona, Validate My Problem, Evaluate My ICP).

ICP dimensions and weights: `bca` .25, `pa` .18, `usp` .15, `it` .15, `cd` .12, `nf` .10, `fs` .05, with the level labels from `LEVEL_LABELS` in `icp-evaluator.tsx`. ICP inputs: one `textarea` `icp`, required, `minLength` 50, `maxLength` 8000. Moat: `position` textarea 6000 required min 50, `competitors` text 500 optional. Positioning: `statement` textarea 4000 required min 20, `context` text 500 optional. Persona: `persona` textarea 6000 required min 50, `tamSize` text 100 optional (the old select becomes a text field; see assumptions). Problem: `problem` textarea 4000 required min 50, `evidence` textarea 2000 optional, `tamSize` text 100 optional. Account keeps no inputs in the registry (its component owns its form).

The registry is plain data with no imports, so it is safe to import from client components, server components, routes, tests and the script.

### 2.2 Entry points and call order

Visitor scoring:

1. `ToolPage` POSTs `{ inputs, website, rerunOf? }` to `/api/tools/{slug}/score`.
2. The route: parse JSON (400 on failure); if `website` is non-empty return `{ ok: true }` with an empty body shape identical to success minus the run (honeypot, silent); `getTool(slug)` and `isToolPublic` (404); `validateInputs` (400); `getEvaluateLimiter().limit(`${ip}:${slug}`)` (429 with the existing message and headers); `scoreRun(slug, inputs, { source: "web", ip })`; if `rerunOf` is a string, `track("re_run", { tool, runId, rerunOf })`; respond `toFreeView(run)`.
3. `scoreRun`: section 3.1.

Visitor unlock and full view:

4. `ToolPage` POSTs `{ runId, name, email, company, website }` to `/api/tools/{slug}/unlock`; on `{ ok }` it POSTs `{ runId }` to `/api/tools/{slug}/details`.
5. The details route: `getRun` (404), tool mismatch (404), if `run.details` exists respond `toFullView(run)`; else `getDetailsLimiter().limit(`${ip}:${slug}`)` (429); `detailRun(runId, ctx)`; respond `toFullView(run)`.
6. `detailRun`: section 3.2.

Admin:

7. `/admin/models` client fetches GET `/api/admin/models`; PATCH on each change; the route writes `admin:model-config`, `admin:calibration` and calls `invalidateRouteCache()`. Other instances pick the change up within 30 seconds through the config cache TTL.
8. `/admin/rubrics` calls `getRubric` per tool; the refresh form POSTs `/api/admin/rubrics`.
9. `/admin/runs` and `/admin` call `listRuns` and `countRuns`.

Calibration:

10. `scripts/calibrate.ts` imports `scoreRun` directly (no HTTP) and the pure comparison; writes `admin:calibration` through `llm.ts`'s exported helper `recordCalibrationPass(key, { model, rubricHashes })`.

### 2.3 Rubric loader (`app/lib/rubrics.ts`)

- Environment: `NOTION_TOKEN`, `NOTION_RUBRICS_DB_ID`. Missing either throws `RubricNotPublishedError("rubric source not configured")` so the pipeline maps it to 503 like a missing row.
- Lookup: `POST https://api.notion.com/v1/databases/{NOTION_RUBRICS_DB_ID}/query` with Notion version `2022-06-28` (as the old routes) and a filter requiring `Tool Key` title equals the slug and `Status` select equals `Published`, `page_size` 1. Zero results throws `RubricNotPublishedError("rubric not published: {slug}")`. The `data_source_id` in the spec is not needed with this API version; recorded in the runbook in case Notion retires the database query endpoint.
- From the page: `Version` number property, `System Prompt` rich text (plain_text joined).
- Body: `GET /v1/blocks/{pageId}/children?page_size=100`, following `next_cursor` until `has_more` is false (the old route read one page only; rubrics are long). Conversion keeps the old cases (paragraph, heading_1 to 3, bulleted and numbered list items, quote) and adds `table`: fetch the table block's children (`table_row` blocks, each with `cells` as an array of rich text arrays), emit each row as cells joined with ` | `, and when `has_column_header` is true emit a separator line of dashes after the first row. Toggle and column blocks are not handled (none are used in the rubrics).
- Result: `{ systemPrompt, rubric, version, hash, fetchedAt }` where `hash` is SHA-256 hex (node:crypto) of `rubric + "\n" + systemPrompt`.
- Cache: Redis `rubric:{slug}` JSON with `ex: 600`; in-memory `Map` per instance with a 60 second TTL (short so an admin refresh is visible everywhere within a minute while Redis carries the 10 minute cache). Read order: memory, Redis, Notion. Errors are not cached.
- The loader never logs the token or the rubric text.

### 2.4 JSON schemas (`app/lib/tools/schema.ts`)

Scoring schema (`name: "{slug}_scoring"`, `strict: true`): an object, `additionalProperties` false, required `scores`, `verdict`, `confidence`, `confidenceReason`.

- `scores`: object, `additionalProperties` false, one integer property per dimension key with `minimum` 1 and `maximum` 5, all keys required.
- `verdict`: string, one sentence, the single most important finding.
- `confidence`: string enum `low`, `medium`, `high` reflecting how much evidence the input gave.
- `confidenceReason`: string, under 20 words.

Details schema (`name: "{slug}_details"`, `strict: true`): an object, `additionalProperties` false, required `reasoning`, `recommendations`, `extras`.

- `reasoning`: object, `additionalProperties` false, one string property per dimension key, all required (two or three sentences quoting the input where possible).
- `recommendations`: array of objects with `dim` (string enum of the dimension keys), `gap`, `consequence`, `action` (strings), `additionalProperties` false, all required. The prompt asks for one entry per dimension scoring 3 or below; the pipeline enforces it by dropping entries for dimensions above 3 and recording a missing-recommendation note in the run when one is absent.
- `extras`: object, `additionalProperties` false, one property per registry extra, all required: `kind` text is a string, `kind` list is an array of strings (`minItems` 1, `maxItems` 5). Tools with no extras get an empty object schema with no properties.

The scores object is an object keyed by dimension, not an array, so strict mode guarantees every dimension is present and no extra one appears. `parseScoring` and `parseDetails` are the single validator; nothing anywhere searches text for braces.

### 2.5 Routing key resolution

Keys: `scoring`, `details`, `synthesis`, `extraction`, each optionally narrowed to `{task}:{tool}` where tool is a registry slug. `resolveRoute(key, overrides, defaults)`:

1. If `key` has a tool part and `overrides[key]` exists, use it (source `override:specific`).
2. Else if `overrides[task]` exists, use it (source `override:task`).
3. Else `defaults[task]` (source `default`).

An override with an empty or non-string `model` is ignored at that step. The result is `{ key, task, tool?, model, reasoning?, maxTokens?, fallback?, source }`. Reset is deleting the hash field for that key; resolution then falls through naturally.

`DEFAULT_ROUTES` in `llm.ts`:

| Key | Model | Reasoning | Max tokens | Fallback |
| --- | --- | --- | --- | --- |
| `scoring` | current Haiku on OpenRouter | none | 600 | none, never |
| `details` | current Sonnet on OpenRouter | none | 3000 | none |
| `synthesis` | current Opus on OpenRouter | medium | 4000 | current Sonnet |
| `extraction` | current Sonnet on OpenRouter | low | 4000 | none |

Model ids are OpenRouter ids in the `anthropic/claude-{family}-{version}` form, without a date suffix. The Coder confirms the exact ids against `GET https://openrouter.ai/api/v1/models` at implementation time and picks, per family, the highest undated version listed. `CURATED_MODELS` (also in `llm.ts`, the only other place a model id appears) holds those three plus one alternative per family tier so the admin dropdown has choices; the admin route rejects a model not in this list.

### 2.6 `llm.ts` surface, call log, calibration state

`callModel({ routingKey, runId, system, user, schema, maxTokens?, temperature?, web? })`:

- Client: `openai` with `baseURL https://openrouter.ai/api/v1`, `apiKey OPENROUTER_API_KEY`, default headers `HTTP-Referer: https://summitstrategyadvisory.com` and `X-Title: Summit Strategy Advisory`. Constructed lazily once per instance; a missing key throws `LlmNotConfiguredError` (503 at the route).
- Resolves the route (live overrides, 30 s cache). Builds a chat completion with a system message whose content is a single text part carrying `cache_control: { type: "ephemeral" }` (prompt caching for the rubric prefix), a user message, `response_format` `{ type: "json_schema", json_schema: { name, strict: true, schema } }`, `max_tokens` from the override or the default, `temperature` 0 for `scoring` and `details` (callers cannot raise it; the parameter is only honoured for `synthesis` and `extraction`), `reasoning: { effort }` when set, `models: [model, fallback]` when a fallback is configured (synthesis only), and `plugins: [{ id: "web" }]` when `web` is true.
- Reads `choices[0].message.content`, parses JSON once, hands the object to the caller's validator (the pipeline passes `parseScoring` or `parseDetails`). The resolved model that answered is `response.model` (the fallback may differ from the request).
- Usage: OpenRouter includes `usage` on every response with `prompt_tokens`, `completion_tokens`, `cost` and `prompt_tokens_details.cached_tokens`; the deprecated `usage: { include: true }` request flag is not sent.
- Returns `{ data, model, routingKey, source, ms, usage, calibrated }`.
- One retry on a network error or a 5xx; no retry on a 4xx or a validation failure (the route returns 502 "model returned an unusable answer").
- Always logs, success or failure, with `logCall`.

`ai:calls` entry (RPUSH then LTRIM to the last 2000): `ts` (ISO), `key` (routing key requested), `model` (the model that answered), `runId` (string or null), `ms`, `promptTokens`, `completionTokens`, `cachedTokens`, `cost` (number from `usage.cost`, or null when absent), `ok`, `error` (message, first 200 chars, never the key or the prompt), `calibrated` (boolean).

`admin:calibration` hash, field per routing key, JSON value: `{ model, passedAt?, rubricHashes?, uncalibratedSince? }`. A key is calibrated for a call when the entry exists, `passedAt` is set and `entry.model` equals the resolved model. The admin PATCH on a gated key (`scoring`, `scoring:{tool}`, `synthesis`) writes `{ model: newModel, uncalibratedSince: now }`, replacing any pass. `recordCalibrationPass(key, { model, rubricHashes })` writes `{ model, passedAt: now, rubricHashes }`. `details` and `extraction` keys are never written and read as "not gated".

GET `/api/admin/models` returns `{ config, defaults, labels, descriptions, catalog, calibration, usage }` where `catalog` is the curated list enriched from the OpenRouter `/models` endpoint (`promptPrice`, `completionPrice` per million, `context`) cached in Redis `admin:model-catalog` for 600 seconds, and `usage` is `{ [routingKey]: { calls, cost } }` aggregated from `ai:calls` entries with `ts` in the last 30 days. PATCH body `{ key, model?, reasoning?, maxTokens?, fallback?, reset? }`: `parseRoutingKey` (400), model in `CURATED_MODELS` (400), `reasoning` in `low|medium|high` or absent, `maxTokens` integer 100 to 16000 or absent, `fallback` only when task is `synthesis` and in the curated list; `reset: true` deletes the field. Writes the hash field as JSON `{ model, reasoning?, maxTokens?, fallback? }`, marks calibration as above when gated, invalidates the cache, returns `{ config, calibration }`.

### 2.7 Calibration case file (`calibration/{tool}/*.json`)

`{ tool, name, source, agreedBy, agreedOn, input: Record<inputKey, string>, expected: { grade: 1..5, dimensions: Record<dimKey, 1..5> }, note }`. `input` keys are the registry input keys for that tool. The existing `_template.json` already has this shape. The `built-to-scale` case uses a different `expected` shape (`total`, `band`, `rows`); it is for Release 3 and the script reports its folder as having no registry entry.

### 2.8 Redis keys and TTLs

| Key | Type | Content | TTL |
| --- | --- | --- | --- |
| `run:{id}` | hash | the run record, section 2.10 | 30 days from creation (`expire` on save); `persist` on unlock |
| `runs:by-time` | sorted set | member run id, score `createdAt` ms | none |
| `rubric:{slug}` | string (JSON) | `{ systemPrompt, rubric, version, hash, fetchedAt }` | 600 s |
| `admin:model-config` | hash | field routing key, JSON override | none |
| `admin:calibration` | hash | field routing key, JSON state | none |
| `admin:model-catalog` | string (JSON) | enriched curated catalog | 600 s |
| `ai:calls` | list | JSON entries, LTRIM to last 2000 | none |
| `events` | stream | XADD with approximate MAXLEN 50000 | none |
| `gtm-unlocks` | list | existing digest shape, appended by the unlock route | none (unchanged) |

Expired runs leave their id in `runs:by-time`; `listRuns` drops ids whose hash is missing and removes them from the set as it goes. No migration of `gtm-submissions`, `icp-submissions`, `gtm-text:*`, `icp-text:*`, `gtm-details:*`, `icp-details:*`; they are no longer written or read.

Run ids: `run_` plus 16 lowercase hex characters from `crypto.randomUUID()` with dashes removed, truncated.

### 2.9 `ToolPage` sections and state

Phases: `input`, `scoring`, `scored`, `unlocking`, `full`, `error`.

Sections in order:

1. Hero: gradient as today, eyebrow "Tool {number} GTM Toolkit", `name`, `tagline`, `ToolShareButtons`.
2. Optional `intro` paragraphs (ICP only).
3. Two panels in `gtm-tool-grid`: "What we evaluate" (dimension names) and "What the highest standard looks like" (`dimension.standard`).
4. Form from `inputs`: label with required marker or "(optional)", textarea or text input, character counter for textareas, "Show an example" link that fills the field with `example`, honeypot, submit button with `buttonLabel`, disabled until every required input meets `minLength`.
5. Loading: `CyclingLoader` (light, messages "Reading your input", "Scoring {n} dimensions", "Writing the verdict").
6. Results card: `ResultBlock`; "Dimension breakdown" with `GtmDimensionBar` per dimension, `locked` until `full`, level label from `dimension.levels[score]`; a "Score again" link that resets to `input` and remembers the run id for `rerunOf`.
7. Unlock form (name, email, company, same copy as today minus dashes) when `scored`; `CyclingLoader` when `unlocking`.
8. Full view: reasoning under each bar, extras via `EXTRA_RENDERERS`, recommendations (gap, consequence, next action, dimension name from the registry), book-a-call panel from `cta`, the framework footnote.
9. `ErrMsg` with retry on any failed call; a 503 shows "This tool is being updated. Please try again in a few minutes." and a 429 shows the server's message.

Nothing rubric-shaped is fetched or sent by the page. The free view's `scores` are sent to the page (as today) so the locked bars can render blurred; reasoning, extras and recommendations only arrive after unlock.

### 2.10 Run record

Hash `run:{id}` fields (nested values stored as JSON strings by the Upstash client):

`id`, `tool`, `createdAt` (ISO), `source` (`web`), `inputs` (object), `scores` (object), `score` (0 to 100), `grade` (1 to 5), `verdict`, `confidence` (`low|medium|high`), `confidenceReason`, `extras` (object or null), `dimensionReasoning` (object keyed by dimension or null), `recommendations` (array or null), `detailsAt` (ISO or null), `rubricVersion` (number), `rubricHash`, `models` (object: `scoring` and later `details`, each the model id that answered), `routes` (object: routing key per call, so a `scoring:{tool}` override is visible), `calibrated` (object: boolean per call key), `unlock` (null or `{ emailHash, email, name, company, at }`), `ip` (not stored; the ctx carries it only for rate limiting).

`emailHash` is SHA-256 of the lowercased trimmed email (for the Release 1b per-email index); `email` is stored in clear as well because the admin runs table shows it and the digest already stores it in clear.

---

## 3. Data Flow

### 3.1 `scoreRun(slug, inputs, ctx)`

1. `getTool(slug)`; unknown or hidden throws `ToolNotFoundError`.
2. `validateInputs(entry, inputs)`; failure throws `InputError(message)`.
3. `track("tool_started", { tool, source })` (not awaited).
4. `getRubric(slug)`; `RubricNotPublishedError` propagates.
5. Build the scoring prompt. System: `entry.role` as the opening sentence, the Notion system prompt, the dimension list (key, name, weight percent, the five level labels), the strict scoring guide from today's routes ("missing elements score 1, not 3; vague mentions score 2"), then the rubric text under a "Scoring criteria" heading. User: the rendered inputs inside `<user_input>` tags, plus "Return the JSON object only." (the schema enforces it; the sentence is belt and braces).
6. `callModel({ routingKey: "scoring:" + slug, runId, system, user, schema: scoringSchema(entry), maxTokens default })`, then `parseScoring`. The routing key carries the tool part so a per-tool override resolves; the log records the requested key and the resolved source.
7. `calcScore`, `gradeFor`, `legacyLabelFor`.
8. Assemble the run record (section 2.10). When `ctx.source` is `web`: `saveRun` (hash, expire 30 days, ZADD index). When `calibration`: not persisted, no events, `runId` prefixed `cal_` in the call log.
9. `track("result_shown", { tool, runId, score, grade, confidence })`.
10. Return `{ run, free: toFreeView(run) }`. Free view: `runId`, `tool`, `score`, `grade`, `gradeLabel`, `gradeDescription`, `legacyLabel?`, `verdict`, `confidence`, `confidenceReason`, `scores`.

Errors: `ToolNotFoundError` 404; `InputError` 400; `RubricNotPublishedError` and `LlmNotConfiguredError` 503 `{ error: "rubric not published" }` or `{ error: "model provider not configured" }`; `SchemaError` or an empty model answer 502; anything else 500 with a generic message. The route logs the error server side without the prompt text. Redis failure on `saveRun` is logged and the response still goes out (as today), but then `detailRun` will 404 that run; acceptable and unchanged from current behaviour.

### 3.2 `detailRun(runId, ctx)`

1. `getRun(runId)`; missing throws `RunNotFoundError` (404).
2. `run.unlock` null throws `UnlockRequiredError` (403).
3. If `run.detailsAt` is set, return `toFullView(run)` without calling a model.
4. `getRubric(run.tool)` (the live rubric; the run keeps the hash it was scored with and records the details hash separately if different, as `detailsRubricHash`).
5. Build the details prompt. System: `entry.role`, the Notion system prompt, the pre-assigned scores with dimension names and level labels, the task description (reasoning per dimension quoting the input; recommendations for every dimension scoring 3 or below with gap, consequence, action; each extra's `ask`), the tone line from today's routes, the rubric text. User: the rendered inputs.
6. `callModel({ routingKey: "details:" + run.tool, ... schema: detailsSchema(entry) })`, `parseDetails`; drop recommendations for dimensions above 3; attach `score` and `name` to each recommendation from the run and registry.
7. `updateRun` with `dimensionReasoning`, `recommendations`, `extras`, `detailsAt`, `models.details`, `routes.details`, `calibrated.details`.
8. `track("full_view_opened", { tool, runId })`.
9. Return `toFullView(run)`: the free view plus `reasoning`, `recommendations`, `extras`, and `dimensions` metadata is not sent (the page has the registry).

Errors as in 3.1 plus `RunNotFoundError` 404 and `UnlockRequiredError` 403.

### 3.3 Unlock route

Parse (400), honeypot (silent ok), `validateUnlock` (400), `getRun` and tool match (404), `markUnlocked` (HSET `unlock`, PERSIST), RPUSH `gtm-unlocks`, `track("email_given", { tool, runId, emailHash })`, `{ ok: true }`. A second unlock on the same run overwrites the unlock fields and appends again to `gtm-unlocks` (same as today's fire-and-forget behaviour).

### 3.4 Route error mapping (shared helper in `app/api/tools/[tool]/errors.ts`)

One function maps pipeline error classes to status and a visitor-safe message; the three routes use it so the mapping lives once. Debug details are logged, not returned (today's `debug` and `raw` fields in error responses are dropped).

### 3.5 Calibration script

Read cases, skip and report, `scoreRun` per case (`ctx.source: "calibration"`), collect `{ run.grade, run.scores, run.routes, run.models, run.rubricHash }`, `compareCase`, print the table (tool, case, overall expected and actual, per dimension expected and actual, pass or fail, skipped reason), summary, exit code. On full pass: for each distinct `run.routes.scoring` key seen, `recordCalibrationPass(key, { model: the model that answered, rubricHashes: { [tool]: run.rubricHash } merged across tools })`.

---

## 4. Key Decisions

1. **Registry as plain data, no imports.** Alternative: a registry that imports scoring helpers. Chosen because the registry is imported by client components, server pages, routes, tests and the script; zero imports means zero resolution problems and zero server code in the browser bundle.

2. **Pure logic in leaf modules with injected inputs** (`resolveRoute(key, overrides, defaults)`, `calcScore(scores, dims)`, `compareCase`). Alternative: have them read `DEFAULT_ROUTES` or Redis directly. Chosen so tests import them with no network and no env, satisfying the constraint that `llm.ts`, `rubrics.ts` and `runs.ts` are structured so pure logic is importable without Redis or OpenRouter.

3. **`.ts` extension imports inside `app/lib` with `allowImportingTsExtensions`.** Alternative: a Node resolve hook, or a bundling step for the script. Chosen because it is the smallest change that lets plain Node run the real pipeline for calibration; the hook is the documented fallback. This is the first thing the Coder verifies with `npm run build` at Gate B.

4. **Scores as a keyed object, not an array, in the JSON schema.** Alternative: today's array of `{ dim, score }`. Chosen because strict schema mode then guarantees one entry per dimension and no invented keys; "a tool with six dimensions cannot return five" becomes a property of the schema rather than a check.

5. **Verdict and confidence come from the scoring call.** The spec says the pipeline "computes" them; a verdict needs the input, and the assessment recommended adding it to the scoring JSON so it is stored with the run. Confidence is the model's judgement of evidence sufficiency (enum plus a reason), validated by the schema. Alternative considered: derive confidence from input length; rejected as a proxy that would mislead on short but dense inputs.

6. **Routing key for every tool call carries the tool part** (`scoring:moat`), resolved specific first. Alternative: call with `scoring` and only use the tool part when an override exists. Chosen because resolution is then one code path and the run's `routes` field shows exactly which key resolved and from where.

7. **`CURATED_MODELS` lives in `llm.ts`.** The spec allows model ids only in `DEFAULT_ROUTES`; a curated dropdown is a list of model ids, so it sits in the same file to keep the "one file names a model id" rule true in spirit and in grep.

8. **No fallback for scoring, one for synthesis**, as section 9.3 of the plan requires; the admin PATCH rejects a fallback on any key other than `synthesis`.

9. **Rate limit keys stay per IP per tool** (`{ip}:{slug}`), matching the four GTM routes today. Alternative: one bucket per IP across tools (the ICP route's behaviour). Chosen to preserve the behaviour visitors have on the four tools; the spec's "5 scores per IP per hour" is the limiter definition either way. Flagged as an assumption for the human.

10. **Persona and problem `tamSize` becomes an optional text input.** The spec limits input kinds to `textarea | text`. The old select's options are listed in the placeholder. Alternative: add a `select` kind with options; rejected to stay inside the spec's type.

11. **Calibration runs are not persisted.** `ctx.source: "calibration"` skips `saveRun` and events but still logs to `ai:calls` with a `cal_` run id, so admin spend is accurate and the runs table is not polluted by test cases.

12. **In-memory rubric cache TTL is 60 seconds, Redis is 10 minutes.** The spec says "in memory for the instance"; a shorter memory TTL makes the admin refresh effective across warm instances within a minute while still avoiding a Redis read on most calls.

13. **The account route is repointed to `callModel` with `web: true`** rather than left importing the removed SDK or stubbed. It is hidden and unreachable by visitors, keeps its structure, and gives Release 2 a working example of a web-enabled call. The alternative (replace the body with a 503) deletes working code the spec says to leave alone.

14. **Dashboard email count reads `gtm-unlocks` and `icp-unlocks` list lengths**, not the run store, because the unlock route keeps appending to the list and a count over all runs would need a scan or a second index; a `runs:unlocked` index is left for Release 1b when per-email deletion needs it.

15. **Admin models page is a client component** (`ModelsClient.tsx`) because dropdowns and PATCH need interactivity; the rubrics refresh is a plain form POST to keep that page a server component.

16. **The error response no longer carries `debug` or `raw` model text.** Those leaked prompt and model output to the browser; they are logged server side instead.

Assumptions collected: 5, 9, 10, 11, 12, 13, plus: the SEO titles keep their dashes (constraint on unchanged titles, and the untouched scale-up test splits on the dash); ICP's hero H1 becomes `name` ("ICP Evaluator"); ICP's Tier 2 "CRM Reality Check" teaser is not carried into `ToolPage` (it is marketing copy, not a tool output; `/api/crm-interest` stays untouched); the Notion API version stays `2022-06-28` with the database id; the admin unlock email is stored in clear on the run alongside its hash.

---

## 5. Constraints Honoured

- **No new dependencies other than `openai`; `@anthropic-ai/sdk` removed.** Phase B changes `package.json` exactly so; the account route is repointed so no file imports the removed SDK. The resolve-hook fallback is plain Node, not a package.
- **Secrets via env only; never log `OPENROUTER_API_KEY` or `NOTION_TOKEN`.** Both are read in one place each (`llm.ts`, `rubrics.ts`); error messages name the variable, never the value; `ai:calls` error text is truncated and comes from the SDK message, and the calibrate script prints a "missing" check only.
- **Rubrics and prompts never reach the browser and are never read from a request body.** The rubrics and prompts routes are deleted; `validateInputs` drops `rubric` and `systemPrompt` keys; `ToolPage` fetches nothing but its three tool endpoints; the free and full views carry no rubric or prompt text.
- **No model id outside `DEFAULT_ROUTES` in `llm.ts`; no per-tool route or component files.** `CURATED_MODELS` sits in the same file; `grep -rn "claude-" app` is a Gate D check; every per-tool route and component is in the Phase D delete list; the account pair is the spec's explicit exception.
- **Dimension weights in code, descriptors in Notion.** Weights are registry fields with a test on their sum; the rubric text is read from Notion at run time and hashed onto every run.
- **Styling.** `ToolPage`, `ResultBlock`, extras and admin pages use inline style objects with `BRAND` tokens plus existing `globals.css` classes (`gtm-tool-grid`, `tk-*`, `pulse`). No Tailwind utilities. `ScoreGauge`, `GtmDimensionBar`, `ToolShareButtons`, `Tag`, `CyclingLoader`, `ErrMsg` are reused unchanged apart from two import lines.
- **British spelling, no dashes, no hype words.** All new UI copy, prompts and comments follow this; copy carried over into the registry (taglines, tips, CTA text, unlock text) has its dashes replaced. SEO titles are the one deliberate exception because the constraint on unchanged titles and the untouched test both depend on them.
- **Tests: node:test and node:assert/strict only, no network.** Every new test imports a pure leaf module; none imports `llm.ts`, `rubrics.ts`, `runs.ts`, `pipeline.ts` or anything that touches Redis or OpenRouter.
- **Hidden tool mechanism.** `account` is `hidden: true` in the registry; `isToolHidden` is read by the page's static params and metadata, the hub, `ToolRunner`, the three generic routes and the account route; `AccountIntelTool.tsx` is untouched.
- **Daily report keeps working.** The unlock route appends to `gtm-unlocks` with the same fields; `daily-report/route.ts` is untouched. ICP unlocks now land in `gtm-unlocks` with `tool: "icp"` and show in the digest's GTM section labelled "icp" (its label map does not know `icp`; the fallback prints the slug).
- **Sitemap, robots, SEO metadata unchanged.** `sitemap.ts` and `robots.ts` are untouched; `page.tsx` reads the same titles, descriptions and canonicals from the registry.
- **Untouched areas.** `app/scale-up-advisory`, `app/newsletter`, `app/ai-studio`, `app/loyalty-retail-media` and the homepage are not edited; `scale-up-content.ts` keeps compiling because `toolSlugs.ts` still exports `ToolSlug`.
- **`maxDuration` at most 60.** Score and details routes export 60; unlock and admin routes need no override; the account route keeps 30. One model call per route; the details call at 3000 output tokens is well inside the limit.
- **Node 22.18+ type stripping.** The script and tests run under plain Node with the resolution rule above.

---

## 6. Out of Scope

- Release 1b gate changes: email-only unlock, signed 30-day cookie, emailed result, newsletter opt-in, delete-my-data link. The unlock form keeps name, email and company; the run stores an email hash so 1b can index by it.
- Release 2 tools (`route-to-buyer`, `unit-of-value`), the ceiling calculator and seven-tool copy. Their Draft rubric rows are not read; their calibration folders are reported as "no registry entry".
- Release 3 Built to Scale? page, `synthesis` and `extraction` callers. The routing keys exist with defaults so the admin table is complete; nothing calls them yet.
- Migrating or deleting `gtm-submissions`, `icp-submissions`, `gtm-text:*`, `icp-text:*`, `gtm-details:*`, `icp-details:*`. Left in Redis untouched; they expire or sit idle.
- Changing the daily digest's label map or adding a run-store view to it.
- A monthly spend alert, the Batch API, PDF input, and provider `require_parameters` routing preferences.
- The ICP Tier 2 "CRM Reality Check" teaser and its `/api/crm-interest` posting from the tool page. The route stays; the teaser is dropped from the generic page. Flag to the human in the PR summary in case it should return as a registry-driven block.
- Loading the Oswald font in `app/layout.tsx` (the assessment's font question). `ToolPage` keeps the `var(--font-oswald)` references the old components used.
- A shared OpenRouter package across Summit apps; Canvas stays the reference by copy.
- Rate limiting on the unlock route beyond the existing Redis write; unchanged from today.

---

## 7. Risks and edge cases for the Reviewer

1. **`.ts` import specifiers under Next's bundler.** Verified at Gate B with `npm run build`; fallback documented. If the fallback is used, `package.json` scripts carry `--import ./scripts/register-ts.mjs` and the design's resolution rule note is updated in the runbook.
2. **Next 16 route params are a Promise.** The three generic routes and the two admin pages await `params` and `searchParams`; the existing `page.tsx` already does. Route handler signature: second argument `{ params: Promise<{ tool: string }> }`.
3. **`generateStaticParams` and hidden tools.** Static params come from `PUBLIC_TOOLS` only; a hidden slug requested directly hits `isToolPublic` and `notFound()`. `dynamicParams` is left at its default so an unknown slug 404s rather than being generated. Flipping `account` to visible requires a deploy (it is a code flag), which is the existing behaviour.
4. **ICP's input shape** (one textarea, 8000 characters, minimum 50) fits the generic form; the ICP intro narrative moves to the optional `intro` field so the page keeps its SEO text. The ICP H1 shortens to the registry `name`.
5. **Unlock form keeps name, email and company** (Release 1b changes it); the run stores both `email` and `emailHash`.
6. **Daily digest** still reads `gtm-unlocks` and `icp-unlocks`; ICP unlocks now appear under GTM with the raw slug label. Cosmetic; no change made.
7. **`maxDuration`.** The details call is the longest (Sonnet, 3000 tokens); if a model is switched to Opus with high reasoning in admin, a details call could approach 60 seconds. The admin page shows reasoning per key; the runbook notes that `details` should stay at none or low.
8. **Strict schema support varies by provider endpoint.** Anthropic models through OpenRouter support `json_schema`; the pipeline still runs the parser on every answer, so a lenient provider cannot slip a malformed object through. If a future curated model lacks structured outputs, the call fails with 502 and the log shows the error; the admin can reset the route.
9. **Rubric cache and the refresh button.** Clearing Redis does not clear other instances' memory; the 60 second memory TTL bounds the delay.
10. **Expired run ids in `runs:by-time`.** `listRuns` prunes as it reads; `countRuns` (ZCARD) can over-count by the pruned amount until the next list; acceptable for a dashboard card.
11. **Honeypot.** The score route returns a shape that looks like success so bots are not told; the page treats a missing `runId` as an error and shows retry, which is what a human with a filled honeypot (autofill) would see. Same as today.
12. **`scale-up-advisory.test.ts` must stay untouched and green.** It imports `TOOL_SEO`, `TOOL_SLUGS` and `isToolPublic` from `toolSlugs.ts` and compares `TOOL_SEO[slug].title.split(" —")[0]` with names in `scale-up-content.ts`; the shim and the unchanged titles keep it passing. Run it explicitly at Gate D.
13. **ESLint `react-hooks/set-state-in-effect`.** `ToolPage` scrolls to results in an effect as today (no setState in the effect); loaders use `CyclingLoader`. The models client fetches in an async continuation as the Canvas client does.
14. **Secrets in logs.** The calibrate script and routes log error messages only; the OpenAI SDK error message can include the request id but not the key. Reviewer to grep the diff for `process.env.OPENROUTER_API_KEY` and `NOTION_TOKEN` and confirm each appears once, in `llm.ts` and `rubrics.ts` respectively, plus the presence checks in the script.
