# Built to Scale? spec: recommended plan updates

23 October 2026. Companion to `built-to-scale-assessment.md`. Two steers from Anthony drive these: rubrics stay in Notion, secured, with one per tool; and every tool runs on the same code wherever the job is identical.

## 1. Add a Release 1a, "One code path", ahead of everything else

This is the standardisation release. It replaces the spec's "Standard result component" bullet with a full platform step and is the prerequisite for every later release. Nothing visible changes for visitors except the new result block.

### 1a.1 Tool registry

One file, `app/lib/tools/registry.ts`, is the only place a tool is described. Today the same facts are spread across `toolConfig.ts`, `dimensionConfig.ts`, `toolSlugs.ts`, each score route's `DIMS`, each details route's `DIM_NAMES`, the admin page's two dimension maps, the daily report's labels and the ICP component's own `DIMENSIONS`. Each registry entry holds:

| Field | Example | Notes |
| --- | --- | --- |
| `slug`, `number`, `name`, `tagline` | `moat`, `05`, Competitive Moat Rater | Replaces `toolConfig.ts` |
| `inputs` | position (textarea, 6000 max, required, example), competitors (text, optional) | Drives the form. Examples satisfy the Release 2 "forms with examples" item for every tool |
| `dimensions` | key, name, weight, five level labels | Weights stay in code. They are maths, and a silent change in Notion would move every grade |
| `role` | "competitive strategy expert focused on B2B SaaS" | The one sentence that differs between scoring prompts today |
| `extras` | `priority` (moat), `rewrite` (positioning), `biggestGap` and `keyQuestion` (persona), `validationMoves` (problem), `ceiling` (unit of value), `gatekeeperRisk` and `channelMove` (route to buyer) | Named extra outputs the details prompt asks for and the result page renders |
| `legacyLabel` | moat: 5 Strong, 4 Moderate, 2 Thin, 1 Exposed | Only where the spec wants a second label |
| `seo` | title, description, about, how it works, FAQs, canonical | Replaces `TOOL_SEO` |
| `hidden` | true for `account` and for 06 and 07 until calibrated | Replaces `HIDDEN_TOOL_SLUGS` |
| `feeds` | moat feeds Ability to protect | Used by Built to Scale? orchestration in Release 3 |

ICP becomes a registry entry with its seven dimensions. Its separate component, routes, Google Docs rubric and Redis lists are retired.

### 1a.2 One pipeline, called as a function

`app/lib/tools/pipeline.ts` exposes two functions and nothing else calls a model:

```
scoreRun(slug, inputs, ctx)   -> free view: score, grade, verdict, dimension scores, headline gap, confidence
detailRun(runId, ctx)         -> full view: observation and gap per dimension, extras, recommendations
```

Stages, identical for every tool: validate inputs against the registry; load the rubric and prompt server-side; call the scoring model; compute the /100, the 1 to 5 grade and the verdict; persist the run; return. `detailRun` checks the unlock, calls the details model, persists, sends the result email, returns.

Two generic routes, `app/api/tools/[tool]/score` and `app/api/tools/[tool]/details`, are thin wrappers that parse the request, apply the rate limit and call the pipeline. The eight per-tool routes and the two ICP routes are deleted. The Built to Scale? page in Release 3 calls `scoreRun` directly for each tool it needs, with no HTTP hop and no duplicated prompt logic, which is exactly what the spec's "one set of prompt logic" asks for.

Shared helpers the pipeline uses, each a small file under `app/lib/`:

- `llm.ts`: one client, model constants per phase (`SCORING_MODEL`, `DETAILS_MODEL`, `SYNTHESIS_MODEL`), one JSON extractor with the fallback regex that is currently pasted into five routes, one retry.
- `runs.ts`: `saveRun`, `getRun`, `updateRun`, `listRuns`. Storage is a hash per run at `run:{id}` plus a sorted set by time and a set per email hash. No TTL on runs tied to an email; 30 days otherwise.
- `unlock.ts`: signed cookie, 30 days, one for all tools. Verified in `detailRun`.
- `mail.ts`: the nodemailer transport already in the daily report, lifted out, plus a result email template.
- `events.ts`: `track(name, props)` to a Redis stream. The spec's ten analytics events from day one with no new dependency.

### 1a.3 One tool page

`app/components/toolkit/ToolPage.tsx` renders any registry entry: hero, what we evaluate, inputs, loading, `ResultBlock` (score, grade, verdict, confidence), dimension rows, `UnlockGate`, full view with observations, extras and recommendations, book a call. The five tool components, including the 812-line ICP evaluator, go. Per-tool rendering differences are limited to an `extras` renderer map keyed by extra name, so a new extra is one small component rather than a new page.

`app/tools/[tool]/page.tsx` already routes by slug and only needs to read the registry instead of `toolSlugs.ts`.

### 1a.4 Admin from the registry

`app/admin/gtm` and `app/admin/icp` merge into one runs view built from the registry: tool filter, score, grade, confidence, rubric version, unlocked email, details present. The daily digest reads the same run store.

### 1a.5 Ready when

- All five tools render from the registry through `ToolPage` and the two generic routes, and the per-tool routes and components are deleted.
- Rubrics and prompts are never sent to or accepted from the browser.
- Every run is stored at `run:{id}` with inputs, scores, grade, verdict, extras, confidence, rubric version, model and timestamp.
- A registry test asserts weights sum to 1, keys are unique, every public slug has a rubric key, and every tool has at least one input example.
- The calibration script runs against the five tools and passes.
- Every model call is routed by a key that can be changed in /admin without a deploy, the change takes effect within a minute, and the run record shows which model answered (section 9.6).
- `npm test`, lint, type check and build are green.

Effort: 2 days. It absorbs most of the spec's Release 1 and makes Releases 2 and 3 cheaper than the spec estimates.

## 2. Rubric governance: Notion, server-only, one per tool

### 2.1 Structure

One Notion database, "Tool Rubrics", replaces the five hard-coded page IDs and the separate prompts database. One row per tool key: `icp`, `persona`, `problem`, `positioning`, `moat`, `route-to-buyer`, `unit-of-value`, `built-to-scale`. Properties:

| Property | Purpose |
| --- | --- |
| Tool Key (title) | Matches the registry slug |
| Status (select) | Draft or Published. The site reads Published only, so a rubric can be edited safely |
| Version (number) | Bumped by hand on each published change |
| System Prompt (rich text) | The role and house rules for that tool |
| Page body | The rubric: per-dimension definitions, 1 to 5 descriptors, evidence that earns each level, common inflations to resist |

The `built-to-scale` row holds the method: the five dimension definitions, the 1 and 5 descriptions from the spec, the bands, and the comment rules. The method page in Release 3 renders from the same source, so the public definition and the scoring definition cannot drift.

A rubric template in `docs/rubric-template.md` sets the sections so all eight read the same way and the calibration set can be reviewed against them. The ICP rubric migrates from Google Docs into this database and the `GOOGLE_API_KEY`, `SKILL_DOC_ID` and `RECOMMENDATIONS_DOC_ID` variables are retired.

**Created 23 October 2026.** Database id `dad404fc12af4207bd446e9e8be22330`, data source `4f9fee30-1e7c-479a-be41-25ca8f738073`, under GTM Web Tools in Summit HQ. Eight rows exist: the five existing tools at Version 2 and Published, with the new Verdict, Extras, Confidence and Grade bands sections added; `route-to-buyer`, `unit-of-value` and `built-to-scale` at Version 1 and Draft with proposed descriptors and weights for Anthony to edit. The five old rubric pages carry a superseded notice and stay until the pipeline reads the database.

### 2.2 Securing them

- `app/lib/rubrics.ts` is the only reader. It queries the database with `NOTION_TOKEN`, filters Status equals Published, caches each row in Redis at `rubric:{tool}` for ten minutes and in memory for the life of the instance.
- The public `GET /api/gtm/rubrics` and `GET /api/prompts` routes are removed. The `usePrompts` and `useRubrics` hooks and their sessionStorage caches go with them. Nothing rubric-shaped reaches the browser.
- Score and details routes ignore any `rubric` or `systemPrompt` field in the request body. The pipeline loads them itself.
- Each stored run records the rubric version and a hash of the rubric text it was scored with, so a result can always be traced to the rubric that produced it, and hand-edited report scores can be distinguished from scored ones.
- An admin "Rubrics" page lists each tool's live version, when it was fetched, and a refresh button that clears the cache. This is the only way to force a new rubric live inside the ten-minute window, and it is behind the admin session.

### 2.3 Calibration gate

`scripts/calibrate.ts`, run with the Node test runner, scores a fixed set of 10 to 15 inputs per tool and compares grades to an agreed answer file in `calibration/`. A one-point move on any item fails the script. It runs on demand before publishing a rubric change and in CI on any change to the registry, pipeline or model constants. This is what makes a Notion edit safe: the rubric can change, but a change that moves grades is caught before it is trusted.

### 2.4 Where the calibration set lives

In the repo, not in Notion. The rubric is editable at runtime by design; the calibration set is the thing that checks those edits, so it has to be versioned with the code, change only through a commit, and be readable by CI without a Notion token. A second Notion database would make calibration results depend on whatever the rows said at the moment the script ran, which is the problem the set exists to catch.

Layout:

```
calibration/
  README.md                 how to add a case, how to run
  icp/
    gradeshow.json          one case per file
    ...
  persona/
  problem/
  positioning/
  moat/
  route-to-buyer/
  unit-of-value/
  built-to-scale/
    gradeshow.json          expected total and five grades
```

Each case holds the input exactly as a visitor would type it, the agreed grade per dimension, the agreed overall grade, who agreed it and when, and a note on why. The script scores every case, compares grades, and fails on any one-point move. Inputs for the calibration set are written by Anthony; where a case is a real company it is scored from public information only and the file says so.

If authoring in Notion is easier, a `Calibration Cases` database can be the drafting place and a small sync command pulls approved rows into `calibration/` as a commit. That is a convenience to add later, not a dependency.

## 3. Changes to the remaining releases

**Release 1b, gate and capture (0.5 to 1 day).** The spec's gate items, now built once in `UnlockGate` and `unlock.ts`: email only, 30-day cookie across all tools, emailed result, Scale-Up Letter opt-in with a note at the point of entry, delete-my-data link in the email. Recommend keeping name and company as optional fields rather than dropping them, so the daily digest keeps its lead context without adding friction.

**Release 2 (1 to 1.5 days, down from 2 to 3).** Each new tool is a registry entry, a Notion rubric row, calibration inputs and a card. Ready-when gains one line: adding a tool touches the registry, the Notion database, the calibration set and nothing else. The ceiling calculator is a pure function in `app/lib/ceiling.ts` with its own tests. Both tools ship hidden and are flipped on when they pass calibration.

**Release 3a, the page (1.5 to 2 days).** Orchestration is a `scoreModel(inputs)` function that calls `scoreRun` for each tool named in the registry's `feeds` map, then one synthesis call that writes the five comments, the verdict, strongest, weakest and one change. The composite is stored as a run of tool `built-to-scale` with `sources` holding the child run ids. The scorecard component is new and is the only new UI in this release. Decide the grade font here: load Oswald in `layout.tsx` or change the spec to Barlow Condensed, which is what the site actually renders today.

**Release 3b, Run it for me (2 to 3 days, separate).** Pull this out of Release 3 so the page can ship. Before it starts, decide upload and parsing: direct-to-blob upload for the 25 MB limit, a queued job for the run time, and either approved parsing libraries or a first version that accepts a URL and PDFs only, since the Anthropic API reads PDFs natively.

**Release 4 (2 to 3 days).** Unchanged in scope. The report model references a `built-to-scale` run id and stores edited scores alongside, flagged as hand-edited. Admin forms are the bulk of the work.

**Release 5.** Unchanged. Benchmarks read from the run store.

## 4. Housekeeping before the pipeline runs

- Correct `CLAUDE.md`: styling is inline style objects with brand tokens plus `globals.css`, not Tailwind. Add the registry, pipeline and rubric rules above as project constraints so the Architect and Coder agents build to them.
- Add the Notion database ID to `.env.example` as `NOTION_RUBRICS_DB_ID` and remove the Google Docs variables.
- Retire the four score routes, four details routes, two ICP routes, five tool components, two hooks and `toolSlugs.ts` in Release 1a. Keep `/api/gtm/*` paths as 308 redirects for one release in case anything external links to them.

## 5. Decisions this resolves and decisions still open

Resolved by this update: rubrics stay in Notion with server-only access and versioning; ICP folds into the shared pipeline; analytics is a Redis event stream; prompts and rubrics merge into one Notion database.

Still open:

1. Grade font: Oswald or Barlow Condensed.
2. Gate fields: email only, or email plus optional name and company.
3. Run it for me: approve blob storage and parsing libraries, or ship URL plus PDF first.
4. Vercel plan: confirm 300 second functions are available, or approve a queue.

## 6. Revised sequencing

| Release | Scope | Effort | Depends on |
| --- | --- | --- | --- |
| 1a | One code path: registry, pipeline, generic routes, `ToolPage`, run store, server-only Notion rubrics, calibration script, ICP fold-in | 2 days | Nothing |
| 1b | Gate, emailed result, newsletter opt-in, events | 0.5 to 1 day | 1a |
| 2 | Route to Buyer and Unit of Value as registry entries and rubrics, ceiling calculator, seven-tool copy | 1 to 1.5 days | 1a |
| 3a | Built to Scale? page, method page from the rubric, orchestration, scorecard, hand-offs, score card image | 1.5 to 2 days | 1a, 2 |
| 3b | Run it for me | 2 to 3 days | 3a, decision 3 and 4 |
| 4 | Reports, admin forms, tracking, Gradeshow | 2 to 3 days | 3a |
| 5 | Polish, benchmarks, blog post | 1 to 2 days | 3a |

Total 10 to 14.5 days. The first three are usable on their own and 1a is the one that pays for itself: every later release gets smaller.

## 7. The entry point: three paths at the top of /tools

The tools page opens with one choice, above the tool grid, so a visitor picks how much help they want before they see anything else. This replaces the spec's "Three ways in" table, which mixed entry points with hand-offs between them. The hand-offs stay, but the front door has three clear paths.

| Path | Who does the work | What they get | When |
| --- | --- | --- | --- |
| **Use a tool** | The visitor, one tool at a time | That tool's score, grade, verdict and full view on email | Today, Release 1 |
| **Score your own model** | The visitor, with the automated Built to Scale? run | Total out of 25, five rows, comments, working, saved link, score card image | Release 3a |
| **Ask Summit to score it** | Summit, with the tools as a head start and a person reviewing every line | A reviewed report with Summit's commentary, a one-slide summary and a 30-minute call | Release 3b plus 4 |

### 7.1 What this changes in the plan

**Run it for me becomes "Ask Summit to score it".** The spec had an automated route that crawled a site, parsed uploads, ran the tools and emailed a scorecard within minutes, with Anthony reviewing afterwards if it looked promising. The person moves to the front. The visitor gives their site URL, uploads a deck or documents, and their email. The automated run still happens, but as preparation: it lands in the admin queue as a draft report with the drafted inputs, the tool runs and the scorecard already filled in. Anthony reviews, corrects inputs, edits scores and writes the commentary. The visitor gets the reviewed report, not the raw run.

That merges the spec's Release 3b (Run it for me) with the Release 4 workflow. The admin queue, the editable drafted inputs and the one-click path to a report are the same work either way. What goes is the "scorecard by email within minutes" promise; what replaces it is a confirmation email with a turnaround (two working days is realistic given the spec's 70 to 95 minutes per report) and a note that a person is reading it.

The cost and abuse controls stay as specified: two requests per email per day, three files, 25 MB, PDF, PPTX and DOCX, plus the expiry and delete-my-data terms. Add one: a request is only accepted with a company email, since Summit is committing a person's time.

**The self-serve run is labelled as automated, every time it is shown.** The spec already separates the two audiences; this makes the separation visible on the page, on the result and in the email.

**The hand-offs remain.** A tool result still offers "score the whole model", each scorecard row still links down to its tool, and a self-serve scorecard gains a third offer: "Ask Summit to review this", which sends the completed run into the same admin queue with the inputs already there. That is the cheapest conversion in the whole plan because the visitor has done the typing.

### 7.2 Copy for the three cards

House rules apply: no hype, no dashes, British spelling, say what it is.

**Use a tool**
Seven diagnostics, one question each. Pain, buyer, positioning, moat and more. Free, no account, a score and verdict in under a minute, the full working on email.

**Score your own model**
One form, five dimensions, a score out of 25 for how well your business model can scale. Scored automatically against Summit's rubrics, the same ones we use in client work. It is a machine's reading of what you tell it, so it is only as good as your input, and it is not advice.

**Ask Summit to score it**
Give us your website and a deck. We run the same tools, then a person reads the output, checks it against what we know, edits the scores and writes the commentary. You get a reviewed report, a one-slide summary and a call to walk through it. Usually within two working days.

### 7.3 Explaining the automated evaluation

Suggested wording, used on the Built to Scale? form, on the result page beneath the headline, in the result email and on the method page:

> This score was produced automatically. The rubrics behind it come from Summit's advisory work, so the questions and the standards are ours, but the reading of your answers was done by a model, not a person. It will miss context it was not given and it cannot check your claims. Treat it as a structured first opinion. If you want a person to look, ask Summit to score it.

A note on the phrase "our trained models". The site runs a general model against Summit's rubrics; Summit has not trained or fine-tuned a model. "Trained models" would be an inaccurate claim and the kind a sceptical founder would test. "Scored against Summit's rubrics, built from decades of advisory work" says the same thing and is true. If fine-tuning happens later the wording can change then.

### 7.4 Where it lands in the releases

- **Release 1:** the three-path block ships on /tools with the first path live and the other two shown as "coming" with an email capture for notice. No new build beyond the block itself.
- **Release 3a:** path two goes live. The automated label appears on the form, the result and the email.
- **Release 3b:** path three goes live as "Ask Summit to score it", feeding the admin queue. Release 4's report editor is what Anthony uses to answer each request, so 3b and 4 should be planned as one block of 4 to 5 days.
- **Release 5:** the "Ask Summit to review this" offer on self-serve results, once the queue has handled a few real requests and the turnaround promise is known to hold.

## 8. Model plan: how many calls, which model, and who chooses

### 8.1 Calls per run

| Run | Model calls | What each does |
| --- | --- | --- |
| One tool, free view | 1 | Score six dimensions, return JSON |
| One tool, full view | +1 | Reasoning, gaps, extras, recommendations |
| Built to Scale?, self-serve | 5 to 7, then 1 | One scoring call per tool the model needs, then one synthesis call that writes the five comments, verdict, strongest, weakest and one change |
| Built to Scale?, working expanded | +1 per row opened | The full view for that tool, cached once produced |
| Ask Summit to score it | +1 extraction, then the self-serve run | Reads the crawled pages and uploaded documents and drafts the five input sections. PDFs go to the model directly as document blocks; no model is used for crawling |

Calls within a run are independent, so the scoring calls run in parallel and the synthesis waits for them. Wall time is the slowest scoring call plus the synthesis call, not the sum.

### 8.2 There is no model panel today

The website calls the Anthropic SDK directly with two hard-coded model ids: Haiku 4.5 for scoring and a Sonnet 4 snapshot from May 2025 for details. Nothing chooses between them. The AI Writing Lab app has a model allowlist and a user-facing picker over OpenRouter, but that is the visitor choosing, not the system picking the best model for a task, and the website does not use it.

Recommendation: do not build an automatic router. The calibration rule (same input scores the same twice, a one-point move blocks a change) needs a fixed model per task. A router that swaps models by load, cost or availability would move grades without anyone changing a rubric. Instead:

- One file, `app/lib/llm.ts`, holds a model per phase: `SCORING_MODEL`, `DETAILS_MODEL`, `SYNTHESIS_MODEL`, `EXTRACTION_MODEL`. Changing one is a code change that triggers the calibration script.
- Every stored run records the model id used for each phase alongside the rubric version, so a result can always be traced.
- If an admin-side switch is wanted later, it is a per-phase setting in Redis with the same rule: a change forces a calibration run before it goes live.

### 8.3 Suggested assignment and cost

Prices are Anthropic list prices per million tokens as of October 2026. Costs are estimates from token counts, not measured.

| Phase | Model | Price in / out | Why |
| --- | --- | --- | --- |
| Scoring | Claude Haiku 5.5 | $0.10 / $0.50 | Structured JSON against a rubric. Ten times cheaper than the Haiku 4.5 in use now. Calibrate first; if grades wobble, move scoring to Sonnet 5.5 |
| Details | Claude Sonnet 5.5 | $2 / $10 | Reasoning and recommendations; replaces the 2025 Sonnet snapshot |
| Synthesis | Claude Opus 5.5 | $4 / $20 | One call per Built to Scale? run writes the headline the visitor shares and Anthony edits. Worth the top model |
| Extraction | Claude Sonnet 5.5 | $2 / $10 | Long input, structured output |

| Run | Estimated cost |
| --- | --- |
| One tool, free view | under $0.01 |
| One tool, full view | about $0.03 |
| Built to Scale?, self-serve, no rows expanded | about $0.07 |
| Built to Scale?, every row expanded | about $0.25 |
| Ask Summit to score it, 40 pages and a 30-page deck | about $0.50 to $0.75 |

At the spec's rate limits (five tool runs per IP per hour, two Summit requests per email per day) the ceiling is set by traffic, not by the per-run cost. A thousand self-serve runs a month is under $100 before any detail rows are opened.

### 8.4 Two features worth using

- **Prompt caching.** The system prompt and rubric are identical for every run of a tool, so mark them as a cached prefix. Cache reads cost about a tenth of the input price. The minimum cacheable prefix is model-dependent, so short rubrics may not cache; the registry can report the prefix size per tool.
- **Batch API.** Half price, asynchronous, results within hours. Right for the calibration script and for the Ask Summit queue, where a person is the bottleneck anyway. Wrong for self-serve, where the visitor is waiting.

## 9. Use OpenRouter, on the Summit Canvas pattern

Three Summit codebases already call models, each a different way:

| Codebase | Client | Who picks the model | Config | Logging |
| --- | --- | --- | --- | --- |
| AI Writing Lab | OpenRouter via the `openai` package | The visitor, from a fixed allowlist | Code only | None |
| Summit Canvas | OpenRouter via the `openai` package | Anthony, per task, in /admin | Defaults in code, overrides in Redis (`admin:model-config`), curated catalog with live pricing from OpenRouter | Every call to `ai:calls` with task, model, time, size, estimated cost; shown in /admin |
| MIESystem | Anthropic SDK direct | Code, from a candidate list per task with fallback and cost per call | Code only | Cost and latency returned per call |
| Website today | Anthropic SDK direct | Nobody; two ids hard-coded in ten route files | None | None |

The Canvas version is the model panel, and it is the right base for the website. It is a per-task assignment that a person sets, not an automatic chooser, so it fits the calibration rule in section 8. The recommendation is to lift `app/lib/ai.ts` and `app/api/admin/models/route.ts` from Canvas into the website's Release 1a, with four changes for this use.

### 9.1 What to carry over unchanged

- The `openai` client pointed at OpenRouter, with the `HTTP-Referer` and `X-Title` headers set to the website.
- Task-based routing: a `TaskConfig` of model id plus optional reasoning effort, defaults in code, overrides in a Redis hash, a 30-second config cache, and `taskExtraBody` for the reasoning parameter.
- The curated catalog: a short list of model ids, enriched at request time from OpenRouter's `/models` endpoint with price, context length and vision support, cached ten minutes. Dropdowns in /admin only ever offer that list.
- The call log and the admin usage view, with cost by task and by model.
- The per-user hourly limit, swapped for the website's existing per-IP limiter.

### 9.2 Tasks for the website

| Task | Default | Reasoning | Notes |
| --- | --- | --- | --- |
| `scoring` | Current Haiku | none | One call per tool per run. Structured JSON, deterministic |
| `details` | Current Sonnet | none | Full view per tool |
| `synthesis` | Current Opus | medium | One call per Built to Scale? run |
| `extraction` | Current Sonnet | low | Ask Summit: crawled pages and documents to five drafted inputs |

Model ids are OpenRouter ids (`anthropic/...`) taken from the live catalog, as Canvas does, so the registry never hard-codes a dated snapshot again.

### 9.3 Four changes from the Canvas version

1. **Calibration status on the routing table.** Each task row shows the model it last passed calibration with and the date. Changing `scoring` or `synthesis` marks the row uncalibrated until `scripts/calibrate.ts` passes against the new model, and every run records the model id and the calibration state at the time it ran. Canvas has no equivalent because a page edit is judged by eye; a grade is not.
2. **Structured outputs.** OpenRouter passes `response_format` with a JSON schema through to models that support it. Use it for `scoring` and `details` and delete the regex JSON extraction that is pasted into five routes today. The schema is generated from the registry entry, so a tool with six dimensions cannot return five.
3. **Cost per run, not per call.** Canvas logs each call with character counts and estimates cost from the catalog price. Add `runId` to each log entry and ask OpenRouter to include usage in the response so cost is reported rather than estimated. A Built to Scale? run's eight calls then sum to one figure, which is what the spec's monthly spend alert and the admin queue need. The alert itself is the existing daily cron reading the last 24 hours of the log.
4. **Provider fallback for the synthesis call only.** OpenRouter accepts a list of models to try in order. Give `synthesis` one fallback so a provider outage does not drop the headline, and record which model answered. Do not give `scoring` a fallback: a silent switch there moves grades, which is the thing the calibration rule exists to stop.

### 9.4 What OpenRouter changes about section 8

- **Prompt caching still works** for Anthropic models through OpenRouter, but it is explicit: the cached prefix has to be marked on the system message. The pipeline does this once in `llm.ts` so every tool benefits.
- **The Anthropic Batch API is not available** through OpenRouter. The calibration script and the Ask Summit queue run as ordinary calls. At the volumes in section 8 the difference is pennies and not worth a second client.
- **PDF input** goes through OpenRouter's file input rather than Anthropic's document blocks. It supports a choice of parsing engine; the default text engine is enough for decks. Verify this against the OpenRouter docs when Release 3b starts, as the exact parameter shape is the one thing in this section written from memory.
- **One bill.** The Writing Lab, Canvas and the website spend from one OpenRouter account with one spend cap, which is simpler than an Anthropic key per app. OpenRouter adds a small fee on credits; immaterial at this scale.

### 9.5 Dependency and housekeeping

- `openai` replaces `@anthropic-ai/sdk` in `package.json`. That is a dependency change under the no-new-dependencies rule, but it brings the website in line with the other two apps rather than adding a third approach. `ANTHROPIC_API_KEY` is retired and `OPENROUTER_API_KEY` added to `.env.example`.
- The routing table lives at `/admin/models` beside the rubrics page from section 2, so the two things that can move a grade sit together, each with its calibration state.
- Three apps now carry near-identical OpenRouter code. A shared package is a later decision; for now copy the Canvas files and note in `CLAUDE.md` that Canvas is the reference implementation.

### 9.6 Changing the model for any call, without a deploy

This is a requirement, not a nice-to-have: Anthony must be able to change which model handles each kind of call from /admin, and see which model produced any result.

**Routing keys.** Every call the pipeline makes names a routing key before it goes out. The key has two parts, task and tool, and the tool part is optional:

| Key | Covers |
| --- | --- |
| `scoring` | The scoring call for every tool |
| `scoring:unit-of-value` | The scoring call for that tool only, overriding the task default |
| `details` / `details:{tool}` | The full-view call, task-wide or per tool |
| `synthesis` | The one Built to Scale? call that writes comments and verdict |
| `extraction` | The Ask Summit drafting call |

Resolution is specific first: `scoring:unit-of-value` if set, else `scoring`, else the code default. So the normal case is four rows to manage, and a per-tool override exists for the day one tool needs a stronger model than the rest. Adding a tool to the registry adds nothing to the routing table unless an override is wanted.

**What is settable per key.** Model id from the curated catalog, reasoning effort (none, low, medium, high), max output tokens, and for `synthesis` only, a fallback model. Temperature is fixed at zero for `scoring` and `details` and is not exposed, because the calibration rule depends on it.

**Where it lives.** Defaults in `app/lib/llm.ts` as code, exactly as Canvas does. Overrides in one Redis hash, `admin:model-config`, keyed by routing key. A 30-second in-process cache, so a change is live everywhere within a minute without a deploy. A reset-to-default control per row clears the override.

**The admin page.** `/admin/models` shows one row per task, with per-tool overrides expandable beneath. Each row has the current model, its live price from the catalog, reasoning, the calibration state (passed with model X on date Y, or uncalibrated since the change), the number of calls and spend in the last 30 days, and a dropdown that only offers the curated catalog. A model that has been retired upstream still shows on its row so an old run can be read, but cannot be selected.

**What every run records.** For each call inside a run: the routing key, the model id that answered (which for `synthesis` may be the fallback), reasoning, usage and cost, and whether the model was calibrated at the time. A prospect report therefore always shows what produced its numbers, and a change in /admin never alters an existing result.

**Guardrails on a change.** Changing `scoring` or `synthesis`, or any per-tool scoring override, marks the row uncalibrated. Self-serve runs continue, flagged internally, so the site never stops because a dropdown moved; the calibration script clears the flag when it passes. Changing `details` or `extraction` needs no calibration because they do not produce grades. Rubric changes (section 2) and model changes are the only two things that can move a grade, and both are visible on the same admin screen with the same state.

**Test.** The registry test asserts every call site names a routing key that exists in the defaults, so a new call cannot ship without a row in /admin.
