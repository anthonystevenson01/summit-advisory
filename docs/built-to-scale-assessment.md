# Built to Scale? build spec: assessment against the current codebase

23 October 2026. Spec: `Dev/Summit - GTM tools/Built to Scale Website Build Spec.md`.

## Summary

The plan is sound and the sequencing is right. Three things change the picture once you read the code:

1. **The "Today" column in the spec describes the marketing copy, not the tools.** None of the four GTM tools produce a letter grade, a verdict, a suggested rewrite, a 90-day priority or a "biggest gap". Those phrases exist only in `toolConfig.ts` card copy and the SEO text in `toolSlugs.ts`. What the tools actually return is a score out of 100, six dimensions scored 1 to 5, a five-band label (Elite, Strong, Developing, Early-Stage, Starting Point), and after unlock, per-dimension reasoning plus gap / consequence / action recommendations. So the Release 1 items "keep the rewrite" and "keep the 90-day priority" are new features, not preservation.
2. **Release 1 is partly done already, and partly bigger than stated.** The four GTM tools already share one output shape and one grade function with the exact bands the spec asks for (85 / 70 / 50 / 30 in `dimensionConfig.ts`). The ICP Evaluator does not: it is an 812-line standalone component with its own gauge, grade function, seven dimensions, Google Docs rubric, separate API routes and separate Redis lists. The half-day estimate holds only if ICP is left alone and the gate is left alone. It does not hold for the spec as written.
3. **The codebase has a duplication problem the spec should fix before adding tools.** The four score routes and four details routes are byte-identical apart from a tool name, a dimension table and two prompt strings. The four tool components are 430 lines each with about 130 lines of difference. Adding Tool 06 and 07 by copying makes six copies of everything. Collapsing to one generic route pair and one tool component driven by a registry makes Release 2 mostly config and prompts.

Revised total: 9 to 14 days against the spec's 8 to 11. The extra is the ICP fold-in, the gate rework, and Run it for me, which is the single most expensive item and has two platform constraints the spec does not mention.

## What exists today

| Area | State |
| --- | --- |
| Routes | `/tools` hub, `/tools/[tool]` for icp, persona, problem, positioning, moat. `account` exists but is hidden via `HIDDEN_TOOL_SLUGS`. |
| Scoring | Haiku 4.5 scores 1 to 5 per dimension, server computes the weighted /100. Sonnet 4 (May 2025 model) writes reasoning and recommendations on unlock. |
| Rubrics and prompts | Fetched from Notion at runtime by the client, cached in sessionStorage, and sent back to the server in the request body. ICP uses Google Docs via Drive API instead. |
| Storage | Upstash Redis. `gtm-submissions` and `icp-submissions` are unbounded lists. Input text lives at `gtm-text:{id}` for 6 hours. Details are cached at `gtm-details:{tool}:{id}` for 24 hours. Admin reads whole lists with `lrange 0 -1`. |
| Gate | Name, email and company required. Unlock is React state only: it does not survive a refresh, does not carry across tools, and nothing is emailed. Unlock records go to a `gtm-unlocks` list. |
| Email | Nodemailer with SMTP env vars, used by the daily lead digest (Vercel Cron) and admin password reset. Reusable for emailed results and notifications. |
| Newsletter | `/api/newsletter/signup` proxies to `NEWSLETTER_ENDPOINT`. If unset it returns "coming soon". |
| Admin | Cookie session in Redis, server-rendered read-only pages for ICP and GTM submissions. No write forms. |
| OG images | `app/opengraph-image.tsx` uses `next/og` on the edge runtime. The same pattern gives you a dynamic score card image. |
| Rate limits | `@upstash/ratelimit`: 5 scores per IP per hour, 10 details per hour. Matches the spec's tool limit. |
| Analytics | None. No gtag, Plausible or Vercel Analytics. Only a `page-visits` counter. |
| Tests | Node test runner, pure data tests on config and slugs. No route or component tests. |
| Fonts | `--font-oswald` is used in about 30 places in `globals.css` and in every tool component, but `layout.tsx` only loads Barlow, Barlow Condensed, DM Sans and DM Mono. Oswald is falling back to the system sans. |
| Styling | Inline style objects plus a 2,774-line `globals.css`. `CLAUDE.md` says Tailwind for everything, which is not what the code does. |

## Release by release

### Release 1: one scoring language

Mostly feasible, and the right place to pay down the duplication.

What is already there: a shared `getGrade()` with the right bands, a shared `ScoreGauge`, a shared `GtmDimensionBar`, a shared `submitToolUnlock` helper, stored ids per run.

What is genuinely new:

- A verdict line. Nothing generates one today. Either derive it from the lowest-weighted-dimension gap (no LLM call) or add it to the Haiku scoring call output. Recommend adding it to the scoring JSON so it is stored with the run.
- Grade 1 to 5 shown next to the /100. Trivial given the bands exist.
- Suggested rewrite (positioning), 90-day priority (moat), biggest gap and key question (persona), validation moves (problem). All new prompt outputs. Each is a field on the details call, so one prompt change per tool.
- ICP on the same result block. Decide whether to fold ICP into the generic pipeline (its seven dimensions and Google Docs rubric come along as config) or only swap its result block. The fold-in is the better long-term answer and about a day of work.
- Durable storage by id. Today the text expires in 6 hours and details in 24. Reports and saved links need a `run:{id}` record with inputs, scores, details, confidence, rubric version and timestamp, kept indefinitely for emailed runs and 30 days otherwise. Keep the lists only as an index or replace them with a sorted set by timestamp.
- The gate. Email only, one unlock for 30 days across all tools, emailed result, Scale-Up Letter opt-in. That is a signed cookie, a transactional email template via the existing nodemailer setup, and a call into the newsletter proxy. Dropping name and company loses the lead fields the daily digest reports on; confirm that trade.
- Analytics events. Nothing exists. Cheapest path that fits the stack is a server-side event list in Redis with an admin view. A third-party provider means a new dependency.

Realistic effort: 1.5 to 2 days if the generic route refactor is included, which it should be.

### Release 2: Route to Buyer and Unit of Value

After the Release 1 refactor each new tool is a dimension table, two prompts, example inputs and a card. The ceiling calculator is a small pure function with a tested formula and an assumptions list; put it in `app/lib/` so the test runner can hit it. Currency switch is UI state.

The hidden-slug mechanism already exists, so both tools can ship to production hidden and be flipped on when calibrated.

"Five" is hard-coded in at least six places: hub metadata title and description, the ItemList schema `numberOfItems`, the hub hero tags, the FAQ footer in `[tool]/page.tsx`, the ICP FAQ, and the tests that assert four cards and numbers 02 to 05. Budget half a day for copy and test updates.

Effort: 1.5 to 2 days, down from 2 to 3, provided Release 1 did the refactor.

### Release 3: the Built to Scale? page

Split this in two. The page, method page, orchestration, scorecard and hand-offs are 1.5 to 2 days. Run it for me is a separate 2 to 3 days with decisions attached.

The page itself:

- Orchestration is a server route that calls the generic score function for each tool and a final Sonnet pass. Rubrics must then be fetched server-side, not from the client body as today. That is a small change to the rubric route and worth doing for the tools too, since the current design lets a client send any rubric it likes.
- Hand-off from a tool into the form: store the run id in the URL (`/tools/built-to-scale?from=run_...`) and prefill from the stored run. Needs the durable storage from Release 1.
- Scorecard component: new, dark panel, five dots per row. Decide on the grade font now. Either load Oswald in `layout.tsx` or change the spec to Barlow Condensed, which is what the rest of the site actually renders in.
- Score card image: copy the `opengraph-image.tsx` pattern into `/tools/built-to-scale/[id]/opengraph-image.tsx`.
- Confidence flag, strongest and weakest, one change: all outputs of the final pass.

Run it for me has two platform constraints:

- **Request body limit.** Vercel serverless functions cap request bodies at 4.5 MB. A 25 MB upload has to go direct to object storage (Vercel Blob, S3 presigned URL) and be read back by the function. Both options are new dependencies or new infrastructure.
- **Execution time.** Crawl up to 40 pages, parse files, run seven tools and a final pass. That is minutes, not seconds. Needs `maxDuration` raised (Pro plan allows 300 s, Fluid Compute up to 800 s) or a queue (QStash is in the Upstash family already in use). The spec's "within minutes by email" fits a queued job better than a held request.
- **File parsing.** PDF, PPTX and DOCX text extraction needs libraries. The Anthropic API accepts PDFs natively as document blocks, which removes one library. DOCX and PPTX are zipped XML and need an unzip library at minimum. `CLAUDE.md` says no new dependencies without approval, so this needs a decision before the Architect runs.

### Release 4: prospect reports

Straightforward on this stack. A report is a Redis hash per slug with the run id, edited scores, commentary, state, expiry and access code. Noindex is page metadata plus a `/report/` disallow in `robots.ts`, and the sitemap is a static list so nothing to exclude. Open tracking is a Redis increment and a nodemailer send to `NOTIFY_EMAIL`, both patterns already present.

The admin is the bulk of the work. It is currently read-only server components. Reports need create, edit and publish forms with write routes behind the existing session check. Budget most of the 2 to 3 days here.

The hand-edited score marker and the "re-run with your own inputs" buttons both depend on the stored run model from Release 1.

### Release 5

Benchmarks need every run stored with scores, which again comes back to the Release 1 storage model. The rest is copy and images and the estimates hold.

## Cross-cutting

**Scoring consistency.** Rubrics are editable in Notion and read at runtime, so a Notion edit changes grades silently. Store the rubric hash on each run, and run the calibration set as a script (`scripts/calibrate.ts` under the Node test runner) before merging prompt changes. The spec's rule that a one-point move blocks the change is only enforceable if the set runs somewhere automated.

**Models.** Details use `claude-sonnet-4-20250514`. Newer models exist and calibration results are model-specific, so pin a model per release and recalibrate when it changes.

**Data retention.** The spec promises 30-day deletion and a delete-my-data link. Redis TTLs cover the first for uploads and crawled pages. The second needs runs indexed by email so they can be removed together.

**Conventions.** Update `CLAUDE.md` before running the pipeline. The Coder agent will otherwise reach for Tailwind in a codebase that uses inline styles and a global stylesheet, and the Reviewer will flag the mismatch either way.

## Decisions needed before Release 1 starts

1. Fold the ICP Evaluator into the generic pipeline, or only align its result block?
2. Drop name and company from the gate, accepting the loss in lead data?
3. Analytics: Redis event log (no new dependency) or a hosted provider?
4. Grade font: load Oswald, or standardise on Barlow Condensed?

## Decisions needed before Release 3

5. Approve dependencies for file upload and parsing, or scope Run it for me to URL crawl plus PDF only (PDF via the Anthropic API needs nothing new).
6. Confirm the Vercel plan supports a 300 s function, or approve a queue.
7. Rubrics: keep runtime Notion fetch with a stored hash per run, or snapshot rubrics into the repo?

## Suggested sequencing change

| Release | Scope | Effort |
| --- | --- | --- |
| 1a | Generic score/details routes and tool component from a registry, verdict in scoring output, durable `run:{id}` storage, ICP fold-in, standard result block | 1.5 days |
| 1b | Email-only gate with 30-day cookie, emailed result, newsletter opt-in, Redis analytics events | 0.5 to 1 day |
| 2 | Route to Buyer and Unit of Value as config plus prompts, ceiling calculator, seven-tool copy | 1.5 to 2 days |
| 3a | Built to Scale? page, method page, orchestration, scorecard, hand-offs, score card image | 1.5 to 2 days |
| 3b | Run it for me: upload to blob, queued job, crawl, extraction, admin queue | 2 to 3 days |
| 4 | Reports: data model, page, admin forms, tracking, Gradeshow | 2 to 3 days |
| 5 | Polish, benchmarks, blog post | 1 to 2 days |

Total 10 to 14.5 days.
