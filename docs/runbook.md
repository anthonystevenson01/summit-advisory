# Agentic Rig — Runbook

This file is maintained by the Docs agent. Each time the pipeline ships a feature, an entry is appended here automatically.

---

<!-- Docs agent appends entries below this line -->

## Contact Us Form — added March 2026

**Trigger:** User submits the form at `/contact`. The browser POSTs JSON to `/api/contact`.

**Service/Function:** `app/api/contact/route.ts` → `POST` handler. The client-side entry point is `app/contact/ContactForm.tsx` → `handleSubmit`.

**Failure mode:**

- _Client validation fails_ — form displays inline field errors; no network request is made.
- _Network error_ — catch block in `handleSubmit` shows a top-banner error; form data is preserved so the user can retry.
- _Server returns `{ success: false }`_ — banner displays the server's `message` string (or a generic fallback). The form remains editable.
- _Server returns a non-2xx status_ — same banner path as above via the `!response.ok` check.

**Template/Config:** No environment variables or config keys required for the current implementation (submission is logged to stdout only). To wire up an email provider, add the relevant credentials as environment variables and extend the `POST` handler after the `console.log` call.

**To disable:** Return a `503` response at the top of the `POST` handler in `app/api/contact/route.ts`, or add a Next.js middleware redirect for the `/api/contact` path. No deploy is required if the middleware approach is used with an environment-variable feature flag.

**Known limitations / future work:**

- `isValidEmail` is duplicated between `ContactForm.tsx` and `route.ts` — extract to `lib/validation.ts`.
- No rate limiting on `POST /api/contact` — add middleware or WAF rule before production.
- No `aria-live` loading announcement — minor accessibility improvement.

---

## Summit GTM Toolkit — added April 2026

**Overview:** Five AI-powered diagnostic tools and The Scale-Up Letter newsletter, deployed as new routes on the existing summitstrategyadvisory.com Next.js site. All AI calls are server-side for security and consistency with the existing codebase pattern.

### Routes

**Public-facing:**
- `GET /tools` — GTM Toolkit hub listing five diagnostic tools
- `GET /newsletter` — The Scale-Up Letter publication hub and reading view
- `POST /api/newsletter/signup` — Newsletter signup proxy

**Tool routes (server-side AI):**
- `POST /api/gtm/positioning` — Positioning Statement Grader (letter grade + 6 dimensions)
- `POST /api/gtm/problem` — Market Problem Validator (go/no-go verdict)
- `POST /api/gtm/persona` — Persona Quality Check (grade + 6 dimensions)
- `POST /api/gtm/moat` — Competitive Moat Rater (hexagonal score + moat rating)
- `POST /api/gtm/account` — Account Intelligence (web_search_20250305 + cycling loader)

**Support:**
- `GET /api/prompts` — Notion proxy returning system prompts keyed by tool_id; returns `{}` if Notion unreachable

### Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes (existing) | Used for all AI tool calls |
| `NOTION_TOKEN` | No | Notion integration token for fetching system prompts at runtime |
| `NOTION_PROMPTS_DB_ID` | No | Notion GTM Tool Prompts database ID |
| `NEWSLETTER_ENDPOINT` | No | Newsletter platform signup endpoint; graceful "coming soon" if absent |
| `UPSTASH_REDIS_REST_URL` | Yes (existing) | Rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Yes (existing) | Rate limiting |

### Notion Setup (optional)

1. Create a Notion database named "GTM Tool Prompts" with properties: `Title` (tool_id string), `Version` (number), `Active` (checkbox), `Notes` (rich text). Prompt text lives in the page body.
2. Add five pages: `positioning`, `problem`, `persona`, `moat`, `account` — tick Active on each.
3. Create a Notion integration, copy the token → `NOTION_TOKEN`.
4. Copy the database ID → `NOTION_PROMPTS_DB_ID`.
5. If Notion is unreachable at runtime, hardcoded fallbacks in `app/components/toolkit/data/fallbackPrompts.ts` are used automatically.

### Deployment Requirements

**Tool 05 (Account Intelligence) requires Vercel Pro or higher.** It uses `web_search_20250305` with `maxDuration = 30`. Free tier times out at 10 seconds and will return 504. All other tools work on any plan.

### Local Testing

```bash
# Test a tool route
curl -X POST http://localhost:3000/api/gtm/positioning \
  -H "Content-Type: application/json" \
  -d '{"statement":"We help enterprise retailers improve NRR via loyalty data.","context":"","systemPrompt":""}'

# Test prompt fetch
curl http://localhost:3000/api/prompts

# Test newsletter signup (no endpoint configured → coming_soon)
curl -X POST http://localhost:3000/api/newsletter/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Rate limit test: submit 6 requests to any `/api/gtm/*` route from the same IP within one hour — the 6th returns 429.

### Operational Notes

- **Notion fallbacks:** Tools function fully without Notion configured. Fallback prompts are in `fallbackPrompts.ts`.
- **Newsletter coming soon:** If `NEWSLETTER_ENDPOINT` is unset, signup returns `{ status: "coming_soon" }` and the component shows a positive message — not an error.
- **CSS scoping:** All toolkit styles are scoped under `.toolkit {}` in `globals.css` with a `tk-` prefix on class names. No bleed into existing pages.
- **ICP Evaluator:** Linked from the hub at `/?tool=icp-evaluator`. Not migrated — preserves the existing two-phase scoring + admin pipeline.
- **Rate limits:** 5 req/IP/hr for tools 01–04; 3 req/IP/hr for Tool 05 (web search cost).

### Files Modified

- `app/globals.css` — Added Oswald font @import; appended ~500 lines of `.toolkit {}` scoped CSS
- `app/lib/ratelimit.ts` — Added `getToolLimiter()` and `getAccountIntelLimiter()` factory functions

---

## Scale-Up Advisory: three pages — added September 2026

**Trigger:** Static pages, pre-rendered at build time. No API endpoints, env vars or runtime data fetching.
**Service/Function:**
- `/scale-up-advisory` (`app/scale-up-advisory/page.tsx`): the hub. Hero, the two option cards (`OPTIONS`, each a `next/link` to its own page), the free GTM tools section (`HUB_TOOLS` copy over the five `TOOL_STAGE_MAP` cards, plus a link to `/tools`), footer. No FAQ, CTA band or in-page anchors; the nav carries Book a Call.
- `/scale-up-advisory/fractional-executive` (`app/scale-up-advisory/fractional-executive/page.tsx`): hire a fractional CRO/CCO/CMO. Its cross-sell link points at `OUTSOURCED_SALES_PATH`.
- `/scale-up-advisory/outsourced-sales` (`app/scale-up-advisory/outsourced-sales/page.tsx`): outsource your sales, as a pitch summary in the shape of the fractional page (since September 2026). Hero with a back link to the hub (`OUTSOURCED_HERO`), one paragraph on what Summit is, the thesis band (four points and a closing line), how we charge, where to start (the AI Lead Engine Build with its five facts and CTA bar, then a one-line pointer to the free GTM tools), a four-question FAQ and the CTA band, with its own metadata and canonical and the outsourced Service + FAQPage JSON-LD. The full deck narrative it used to carry is on `main` at `0912fd5`.
- Homepage (`app/page.tsx`): the "Scale-Up Advisory" card is a plain `Link` to `/scale-up-advisory`. The old SPA view (`practiceData.sme`, `PracticePage`, `pageHref`) is gone. `/?page=sme` is a permanent (308) redirect to `/scale-up-advisory`, declared in `redirects()` in `next.config.ts`; Next carries the query, so the landing URL is `/scale-up-advisory?page=sme`, which the static hub ignores. Nothing on the site links to `/?page=sme` any more; the redirect is for bookmarks and external links.
**Failure mode:** Build/test time only. A tool slug typo fails `tsc` (typed as `ToolSlug`) and `npm test`. A tool that is hidden or newly published fails `npm test` until `TOOL_STAGE_MAP` is updated (intended). A tool card pointing at a hidden tool would 404 in production, which is what the test prevents. `npm test` also fails if an option `href` is not a page under `/scale-up-advisory/` (or contains `#`), a Service schema points at the wrong URL, the hub offer catalog drifts from `OPTIONS`, a page is missing from the sitemap, the `?page=sme` redirect is removed or changed, or the word "route"/"routes" appears anywhere in the content module.
**Template/Config:** All copy, option definitions, FAQs and JSON-LD live in `app/scale-up-advisory/scale-up-content.ts`. Exports by page: hub `HERO`, `OPTIONS`, `HUB_OPTIONS_LABEL`, `HUB_TOOLS`, `scaleUpServiceSchema` (a Service for the practice with an `OfferCatalog` of the two options); outsourced page `OUTSOURCED_HERO`, `WHAT_SUMMIT_IS`, `THESIS`, `HOW_WE_CHARGE_TITLE`/`HOW_WE_CHARGE`, `LEAD_ENGINE`, `OUTSOURCED_TOOLS_LINE`, `SCALE_UP_CTA`, `OUTSOURCED_FAQS`, `outsourcedServiceSchema`, `outsourcedFaqSchema`; fractional page `FRACTIONAL_*`, `fractionalServiceSchema`, `fractionalFaqSchema`. Shared: `TOOL_STAGE_MAP` (each entry has `summary`, which the hub renders, and `stageNote`, documentation only), `DATE_MODIFIED` (`2026-09-28`), `LAST_REVIEWED_LABEL`. Booking link is `BOOK_URL` in that file (the homepage and `SiteNav` still keep their own copies). The only config is the redirect entry in `next.config.ts` `redirects()`.
**To disable:** Revert the branch or remove the page folders; there is no runtime toggle. To drop the `?page=sme` redirect on its own, delete the entry in `redirects()` and the `homepage deep link` test, then redeploy.

### Editing the copy

- Edit strings in `app/scale-up-advisory/scale-up-content.ts`. The pages only map this data onto existing `globals.css` classes, so copy changes rarely need a JSX change.
- Keep the module free of runtime imports (`import type` only). The tests load it directly with Node's type stripping, which cannot resolve the `@/` alias or pull in React/Next. The same applies to `next.config.ts`: the redirect test imports it the same way, so a runtime import there means adjusting the test.
- FAQs (`OUTSOURCED_FAQS`, `FRACTIONAL_FAQS`) feed both the visible FAQ and the FAQPage JSON-LD, so they always match. The hub has no FAQ and no FAQPage schema.
- When you make a material copy change, bump `DATE_MODIFIED` (JSON-LD, currently `2026-09-28`) and `LAST_REVIEWED_LABEL` (byline). The test pins `DATE_MODIFIED`, so update the assertion too.
- Copy hygiene is enforced by the test: the deck typos ("guide by", "motion's", "rouge", "small team covers", "Management Consulting") must not reappear, em-dashes in the module are capped at a small number, and the options are never called "routes". That last check runs `/\broutes?\b/i` over the stringified module, which includes export names, so an export called `ROUTES` fails it too. Use "option" or "page".
- The three heroes share `HERO.eyebrow` ("For B2B Scale-Ups"). On the option pages the back link directly above the eyebrow already reads "Scale-Up Advisory", so don't put that text in the eyebrow.
- `HUB_TOOLS.heading` and `.body` must keep saying "AI" and "free"; the test checks both words.
- `PACKAGE_COUNT` (19) is the tested source of truth; `WHAT_SUMMIT_IS.body` spells it out ("Nineteen") and names the first and last stage ("from MAP to GROW"), so change the number, the paragraph and `PACKAGE_STAGES` together. The test checks both the word and the stage span.
- The four outsourced FAQ questions and their order are pinned by the test (`outsourced pitch page` suite), along with the four thesis points, `THESIS.closer`, the five Lead Engine facts and `OUTSOURCED_TOOLS_LINE`. Adding, removing or reordering a question means updating the assertion too.

### Tool-to-stage map

`TOOL_STAGE_MAP` ties each public free tool to the package stage it demonstrates (Problem and ICP → MAP, Persona and Positioning → REACH, Moat → WIN). Names are hardcoded rather than imported. Each entry has a `summary` (what the tool does) and a `stageNote` (how it ties to the stage): the hub shows `summary` only, under a constant "Free tool" tag (no page explains the package stages any more, so a stage name would mean nothing to a visitor). Since the outsourced page became a pitch summary (September 2026) no page renders `stageNote`; `stage` and `stageNote` are kept as the documented tool-to-stage map, and the test still requires the note to name its stage. The test checks that every mapped slug is public, `href` is `/tools/<slug>`, the name matches the `TOOL_SEO` title, the stage is a real `PACKAGE_STAGES` id, the `stageNote` names its stage, and the set of public tools equals the set of mapped tools. If you publish or hide a tool (e.g. Account Intelligence), add or remove it here and pick a stage.

### Running the tests

```bash
npm test          # node:test, runs every __tests__/*.test.ts
npm run lint      # ESLint; public/** is ignored
npx tsc --noEmit  # type check
npm run build     # strongest check: validates page exports, metadata and the redirects() entry
```

- **Node ≥ 22.18 (or ≥ 23.6) is required** for `npm test`, because it relies on Node's native TypeScript type stripping. It will fail on Node 20.
- **Tests use `node:test`.** Imports in tests must be relative with explicit `.ts` extensions, and imported modules must not have runtime `@/` alias imports (Node can't resolve them; type-only imports are fine because they are stripped). `gtm-toolkit.test.ts` now runs and pins the hub's `TOOLS` cards (02–05) to public tool slugs.
- **Lint conventions:** prefix intentionally unused vars and args with `_`. The `/?page=` links in `SiteNav` stay `<a>` on purpose (the homepage reads `?page=` only on mount, so a full load is required).
- If `tsc` reports errors only in `.next/types/* 2.ts` (or similarly numbered duplicates), those are generated duplicates in the git-ignored build folder, not source. They appear when `tsc` runs while `next build` is rewriting `.next/types/`, or from Finder copies. Delete them and rerun `tsc`. Run the gates one after another, never `tsc` and `next build` at the same time.

---

## Scale-Up Advisory hub + separate option pages — added September 2026

**Trigger:** A visitor opens `/scale-up-advisory`, `/scale-up-advisory/fractional-executive` or `/scale-up-advisory/outsourced-sales` (all static, pre-rendered at build time), clicks the "Scale-Up Advisory" card on the homepage, or follows an old `/?page=sme` deep link.

**Service/Function:** `ScaleUpAdvisoryPage` in `app/scale-up-advisory/page.tsx` (the hub, now hero + two option cards + free GTM tools), `OutsourcedSalesPage` in `app/scale-up-advisory/outsourced-sales/page.tsx` (new; the outsourced narrative, FAQ and CTA moved here verbatim from the hub), `FractionalExecutivePage` (its cross-sell now links to the outsourced page), the `redirects()` entry in `next.config.ts` (`/?page=sme` → 308 → `/scale-up-advisory`), and the `HomePage` card in `app/page.tsx` (a `Link`, replacing the deleted `PracticePage` SPA view). Copy and JSON-LD in `app/scale-up-advisory/scale-up-content.ts`; the new page is listed in `app/sitemap.ts`.

**Failure mode:** No runtime inputs, so failures are build/test time. `npm test` fails on a missing sitemap entry, an option `href` that is not a page under `/scale-up-advisory/`, a Service schema on the wrong URL, a hub offer catalog that drifts from `OPTIONS`, a tool without `summary`/`stageNote`, a removed or changed `?page=sme` redirect, or "route"/"routes" anywhere in the content module. Two things that are not failures but look like them: old `/scale-up-advisory#outsource-your-sales` links land on the hub (fragments never reach the server), where the "Outsource your sales" card is one click away; and the redirect lands on `/scale-up-advisory?page=sme` because Next carries the query, which the static hub ignores.

**Template/Config:** No env vars. `next.config.ts` `redirects()`: `source: "/"`, `has: [{ type: "query", key: "page", value: "sme" }]`, `destination: "/scale-up-advisory"`, `permanent: true`. Both `next.config.ts` and `scale-up-content.ts` must stay `import type` only; the tests load them under Node's type stripping. `DATE_MODIFIED` bumped to `2026-09-24` (pinned by the test).

**To disable:** No runtime toggle. Revert the branch to put the outsourced narrative back on the hub. To drop only the `?page=sme` redirect, delete the entry in `redirects()` and the `homepage deep link` test, then redeploy; the homepage then renders its empty SPA shell for `?page=sme`, as it does for any unknown `?page=` value.

**Caution:** Do not run `npx tsc --noEmit` at the same time as `npm run build`. `next build` rewrites `.next/types/` while it runs, and `tsc` (which includes that folder via `tsconfig.json`) can pick up half-written or duplicated files there, such as `.next/types/routes.d 2.ts`, and report errors that are not in the source. Run the gates one after another; if it happens, delete the duplicates in `.next/types/` and rerun `tsc`.

**Known limitations / future work:** `smallPara`, `inlineLink` and `bandHeading` are duplicated across the three page files (a shared `styles.ts` was rejected as a new file for three small objects); the outsourced page has no cross-sell back to the fractional page at all (the FAQ that pointed there was cut in the pitch-summary change, September 2026); the back link to the hub is the way across; no `BreadcrumbList` JSON-LD on the option pages.

---

## Outsourced sales page as a pitch summary — added September 2026

**Trigger:** A visitor opens `/scale-up-advisory/outsourced-sales` (static, pre-rendered at build time). No API endpoints, env vars or runtime data fetching.

**Service/Function:** `OutsourcedSalesPage` in `app/scale-up-advisory/outsourced-sales/page.tsx`, cut from twelve sections (about 1,600 visible words) to eight blocks (about 600) in the shape of the fractional page: hero (unchanged), What Summit is (one paragraph, `WHAT_SUMMIT_IS.body`), the thesis band (`THESIS.points` plus the new `THESIS.closer` under the cards), How we charge (`HOW_WE_CHARGE` under an `h2.section-label`, no card title), Where to start (the `LEAD_ENGINE` facts card, the `cta-bar`, then the `OUTSOURCED_TOOLS_LINE` pointer to `/tools`), four FAQs (`OUTSOURCED_FAQS`), the CTA band, footer. Copy lives in `app/scale-up-advisory/scale-up-content.ts`, which lost the constants nothing renders any more (`SITUATION`, `HOW_IT_WORKS`, `ROLES`, `PANEL`, `PACKAGES_SECTION`, `TOOLS_SECTION`, `WHY_SUMMIT`, `LEAD_ENGINE.walkAwayTitle`/`walkAway`). Hub, fractional page, homepage, sitemap and `next.config.ts` untouched.

**Failure mode:** Build/test time only. A stale reference to a deleted export fails `tsc` and `next build`. `npm test` fails if the four FAQ questions change or reorder, the thesis loses a point or its closer, the Lead Engine Build has other than five facts or regains `walkAway`, `WHAT_SUMMIT_IS.body` stops saying "Nineteen fixed-price packages" or "from MAP to GROW", a deleted constant comes back, `DATE_MODIFIED` moves without its assertion, or an em-dash or the word "route" creeps into the module. The FAQPage JSON-LD cannot drift from the visible FAQ: both read `OUTSOURCED_FAQS`.

**Template/Config:** No env vars or config. Metadata (title, description, canonical), the outsourced Service JSON-LD (six-stage `OfferCatalog`) and `LAST_REVIEWED_LABEL` are unchanged; `DATE_MODIFIED` is `2026-09-28` (pinned by the test). New in the module: `THESIS.closer`; `OUTSOURCED_TOOLS_LINE` (`{ lead, link }`, rendered with the full stop supplied by the page, as `FRACTIONAL_CROSS_SELL.toolsLead`/`toolsLink` is); `WHAT_SUMMIT_IS` reshaped to `{ label, body }`. One new style const in the page, `bandPara` (the fractional band's paragraph style with a top margin).

**Where the full narrative lives:** `main` at `0912fd5` (`app/scale-up-advisory/outsourced-sales/page.tsx` and `scale-up-content.ts` as they were before this change) and the deck `Decks/Summit Growth for B2B Scale-ups.pptx` (untracked, local only). To bring a section back, restore its constant from that commit and re-add its block to the page.

**To disable:** No runtime toggle. Revert the branch to restore the twelve-section page; there is nothing to switch off on its own.

**Caution:** Run the gates one after another (`npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`), never `tsc` and `next build` at the same time, or `tsc` may report errors from half-written `.next/types/` files that are not in the source.

**Known limitations / future work:** The page no longer links to the fractional page (the FAQ that did was cut); the hub back link is the way across, and a one-line cross-sell would restore symmetry with the fractional page's "Need the sales work done as well as led?" line. `TOOL_STAGE_MAP.stageNote` is rendered nowhere (kept as documentation, still tested). The Service `OfferCatalog` names six stage packages that the page only summarises as "from MAP to GROW". Fewer visible words and a four-question FAQPage (was eight) are an accepted SEO trade-off.

---

## GTM tool pipeline, routing table and calibration gate, added October 2026

**Trigger:** A visitor scores a tool at `/tools/{slug}` (icp, persona, problem, positioning, moat). `ToolPage.tsx` POSTs to `/api/tools/{slug}/score`; after the unlock form it POSTs to `/api/tools/{slug}/unlock` and then `/api/tools/{slug}/details`. The hidden `account` tool keeps its own route at `/api/gtm/account` and answers 404 while `hidden: true` in the registry.

**Service/Function:**
- `app/lib/tools/registry.ts` describes every tool once. Nothing else holds a dimension, weight, input or SEO string.
- `app/lib/tools/pipeline.ts` exports `scoreRun(slug, inputs, ctx)` (validate against the registry, load the Published rubric and system prompt from Notion, one scoring call at temperature 0 with a JSON schema generated from the registry, score out of 100, grade 1 to 5 on the 85/70/50/30 bands, persist, return the free view) and `detailRun(runId, ctx)` (requires an unlock, one details call for per dimension reasoning, recommendations for dimensions at 3 or below and the tool's extras, persist, return the full view; a second call for the same run is served from Redis).
- Routes: `app/api/tools/[tool]/score/route.ts` (5 scores per IP per tool per hour, `maxDuration = 60`), `app/api/tools/[tool]/details/route.ts` (10 per IP per tool per hour, `maxDuration = 60`), `app/api/tools/[tool]/unlock/route.ts` (name, email, company; records the unlock on the run and appends to `gtm-unlocks` so the daily digest is unchanged). Errors map through `app/api/tools/[tool]/errors.ts`. Any `rubric` or `systemPrompt` field in a request body is dropped.
- `app/lib/llm.ts` is the only model client (OpenRouter through the `openai` package) and the only file that names a model id (`DEFAULT_ROUTES`, `CURATED_MODELS`). `app/lib/rubrics.ts` is the only reader of Notion. `app/lib/runs.ts` is the run store. `app/lib/events.ts` is the event stream.
- Admin: `/admin/runs` (every run, filter by tool, expandable inputs and reasoning), `/admin/models` (the routing table), `/admin/rubrics` (live rubric version, hash, fetched time, refresh button). `/admin` counts come from the run store.

**Failure mode:**
- Rubric row missing or not Published in Notion, or `NOTION_TOKEN` / `NOTION_RUBRICS_DB_ID` unset: 503 `rubric not published`. The tool never scores without a rubric.
- `OPENROUTER_API_KEY` unset: 503 `model provider not configured`.
- Model answer fails the schema validator, or is empty: 502 "The model returned an unusable answer. Please try again." The page shows a retry.
- Details requested before the unlock: 403. Unknown or hidden slug: 404. Expired or unknown run id: 404.
- Rate limit reached: 429 with `Retry-After: 3600`.
- Timeout: one attempt is capped at 40 seconds. A connection error or 5xx inside the first 15 seconds is retried once; a timeout is never retried, so the worst case is about 55 seconds inside the route's 60. A timed out call surfaces as 500 "Something went wrong" and is logged to `ai:calls` with `ok: false`.
- Upstash variables unset: rate limiting is skipped. Redis unreachable: the run is scored but not saved (the page still shows the result; unlock then fails with 404 because the run is not stored), and `ai:calls` and `events` writes are dropped silently. Tracking and call logging never throw and are never awaited on the response path, so on Vercel an entry can occasionally be lost when the function returns first.
- Any other error: 500 with a generic message; the detail is in the function log, never in the response.

**Template/Config:**
- Environment: `OPENROUTER_API_KEY` (all model calls), `NOTION_TOKEN` and `NOTION_RUBRICS_DB_ID` (rubrics and prompts; the database is `dad404fc12af4207bd446e9e8be22330`), `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (or the `KV_REST_API_*` pair). SMTP and admin variables are unchanged.
- Retired and safe to delete from Vercel: `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `SKILL_DOC_ID`, `RECOMMENDATIONS_DOC_ID`, `NOTION_PROMPTS_DB_ID` and every `NOTION_*_RUBRIC_ID`.
- Redis keys:

| Key | What | TTL |
|---|---|---|
| `run:{id}` | Hash, one per scored run: inputs, scores, score, grade, verdict, confidence, reasoning, recommendations, extras, rubric version and hash, model per call, calibrated flag per call, unlock | 30 days; removed when the run is unlocked, so unlocked runs persist |
| `runs:by-time` | Sorted set index of run ids by created time | none; `listRuns` prunes expired ids as it reads |
| `rubric:{slug}` | Cached `{ systemPrompt, rubric, version, hash, fetchedAt }` from Notion | 10 minutes, plus a 60 second in memory cache per instance |
| `admin:model-config` | Hash, routing key to `{ model, reasoning?, maxTokens?, fallback? }` override | none; cached in memory for 30 seconds |
| `admin:calibration` | Hash, routing key to `{ model, passedAt, rubricHashes }` or `{ model, uncalibratedSince }` | none |
| `admin:model-catalog` | The curated model list with OpenRouter prices | 10 minutes |
| `ai:calls` | List, one entry per model call: key, model, runId, ms, tokens, cost, ok, error, calibrated | none; capped at the last 2000 |
| `events` | Stream: `tool_started`, `result_shown`, `email_given`, `full_view_opened`, `re_run` | none; capped at about 50000 entries |
| `gtm-unlocks` | List read by the daily digest; unchanged shape, ICP unlocks now land here with `tool: "icp"` | none |

- The old `gtm-submissions`, `icp-submissions`, `gtm-text:*`, `icp-text:*`, `gtm-details:*` and `icp-details:*` keys are no longer written. They are left in place; no migration.
- Changing a model: `/admin/models` shows one row per routing key (`scoring`, `details`, `synthesis`, `extraction`) with the current model and live price, reasoning, calibration state, and calls and spend over the last 30 days. Pick a model from the dropdown (curated list only) and save; the change is live within 30 seconds, no deploy. "Add per-tool override" creates a `{task}:{tool}` row that wins over the task row for that tool only. "Reset to default" deletes the override and the key's calibration record. Changing `scoring`, `scoring:{tool}` or `synthesis` marks that key "Uncalibrated since" until the calibration script records a pass with that model; `details` and `extraction` are not gated. Reasoning is off for `scoring` (Haiku 5.5 allows it) and low for `details`, `extraction` and `synthesis` (medium). Sonnet and Opus class models through OpenRouter refuse to disable reasoning with a 400 "Reasoning is mandatory"; if a key is set to a model that refuses, the client resends once with low effort and the call log shows `reasoningFallback: true`. The 5.x models think before answering and thinking tokens count against max tokens, so if you turn reasoning on for a key in `/admin/models`, raise that key's max tokens to cover the thinking plus the answer (a scoring answer is about 150 tokens; thinking adds hundreds to thousands) or calls fail with 502 and `ai:calls` shows "ran out of tokens". Keep `details` reasoning off or low: a heavy reasoning model on a 3000 token answer can approach the 60 second limit. Any saved change on `scoring`, `scoring:{tool}` or `synthesis`, including a reasoning change, marks that key uncalibrated.
- Changing a rubric or system prompt: edit the row in the Notion "Tool Rubrics" database (page body is the rubric, the System Prompt property is the prompt), bump Version, set Status to Published. The site picks it up within 10 minutes, or at once after the refresh button on `/admin/rubrics`, which clears every `rubric:*` key (each warm instance then catches up within its 60 second memory cache). Then run `npm run calibrate`. Every run stores the rubric hash it was scored with, so results are traceable across versions.
- Calibration: `npm run calibrate` (reads `.env.local`; needs the OpenRouter, Notion and Upstash variables when at least one case is runnable). It scores every `calibration/{tool}/*.json` case through `scoreRun`, compares the overall grade and each dimension grade with `expected`, prints a table and exits `0` when every run case is within one point (or nothing was runnable), `1` when a grade moved by more than one point or a case threw, `2` when configuration is missing. A case whose input contains `TO FILL` is reported as skipped and never scored; a folder with no public registry entry (`built-to-scale`, `route-to-buyer`, `unit-of-value`) is reported as skipped too. On a full pass with at least one case run it writes `admin:calibration` for every scoring key used, which `/admin/models` shows as "Passed with {model} on {date}". Calibration runs are not stored in `run:{id}`; they appear in `ai:calls` with a `cal_` run id. See `calibration/README.md` for the case format.

**To disable:**
- One tool, no deploy: set its row to Draft in Notion and press refresh on `/admin/rubrics`. That tool answers 503 "rubric not published" until the row is Published again; the other tools are unaffected.
- All scoring, no deploy: remove `OPENROUTER_API_KEY` from Vercel and redeploy the environment. Every score and details call answers 503 "model provider not configured"; pages still render.
- One tool permanently: set `hidden: true` on its registry entry and deploy. It leaves the hub, the sitemap params and the three routes (404).

## Route to Buyer and Unit of Value, two hidden GTM tools, added October 2026

**Trigger:** A visitor runs Route to Buyer at `/tools/route-to-buyer` or Unit of Value at `/tools/unit-of-value` once Anthony flips `hidden` on their registry entries. Today nothing runs: both entries ship `hidden: true`, so the page calls `notFound()`, the score, details and unlock routes answer 404, and the hub, the sitemap and `generateStaticParams` do not list them. When live, both tools follow the pipeline in the entry above. The only new behaviour is the `ceilingInputs` extra on Unit of Value, which the details call returns as structured JSON and the code turns into a figure.

**Service/Function:**
- `app/lib/tools/registry.ts`: entries `ROUTE_TO_BUYER` (Tool 06) and `UNIT_OF_VALUE` (Tool 07) sit in `TOOLS` between `MOAT` and `ACCOUNT`, each with six dimensions carrying the Notion weights and short level labels, a role sentence, extras (`gatekeeperRisk` and `channelMove`; `ceilingInputs` and `lever`), SEO, cta, buttonLabel and feeds (`routeToBuyer`; `unitOfValue`). The same file exports the count helpers `countWord`, `PUBLIC_TOOL_COUNT`, `PUBLIC_TOOL_COUNT_WORD` and `PUBLIC_TOOL_COUNT_WORD_CAPITALISED`. Every piece of copy that states how many tools there are reads one of these; no page holds the word "five".
- `app/lib/ceiling.ts`: the revenue ceiling per head calculator. Units per person per period, times price per unit, times periods per year, rounded to the nearest whole unit of currency and formatted as `CAD 380,000`. It has no imports, so it runs in client components, server components, tests and scripts. Any input that is null, zero, negative or not finite gives null; it never estimates a missing input. `isCeilingInputs` is the type guard the renderer uses on a stored value.
- `app/lib/tools/schema.ts`: the `ceiling` extra kind. `detailsSchema` emits a strict object for it (three required inputs, each `{ value: number | null, assumption: string }`, no additional properties) and `parseDetails` stores the parsed object as the extra. The figure is never asked of the model. Text and list extras are unchanged.
- `app/components/toolkit/shared/extras.tsx`: `Ceiling` renders `ceilingInputs` (the figure, the words "per person per year", and the three assumption rows beside it); `Risk` renders `gatekeeperRisk` with an amber border; `channelMove` and `lever` reuse `Priority`. `renderExtra` renders nothing for an object value with no keyed renderer. `/admin/runs` shows a structured extra as raw JSON.
- `app/tools/hub-copy.ts`: a plain module inside `app/tools/`, not a route; it renders nothing on its own. It holds every hub string that states the count (metadata title and descriptions, the ItemList description, the hero lead and tag) and the schema.org ItemList. `app/tools/page.tsx` and `ToolkitHub.tsx` import from it. The FAQ footer in `app/tools/[tool]/page.tsx` and `HUB_TOOLS` in `app/scale-up-advisory/scale-up-content.ts` interpolate `PUBLIC_TOOL_COUNT_WORD` directly.
- `app/sitemap.ts` maps `PUBLIC_TOOLS` to one `/tools/{slug}` entry each, so a tool appears in the sitemap the moment it is public and never before.
- Calibration: `calibration/route-to-buyer/` and `calibration/unit-of-value/` hold three cases each, fully written, with `agreedBy` "Proposed by agentic-rig, to be confirmed by Anthony Stevenson" and no `agreedOn`. `scripts/calibrate.ts` reports them as skipped with `SKIP_REASON_HIDDEN` from `app/lib/tools/calibration.ts` (the three skip reasons are pinned there so the table, the README and the script header say the same thing). `__tests__/calibration-cases.test.ts` checks that every case file agrees with its registry entry (input keys, dimension keys, overall grade equal to the band of the weighted dimension grades); it does not judge whether the grades are right.

**Failure mode:**
- Hidden slug: 404 from the page and all three API routes, and absent from the hub, the sitemap and the static params. This is the designed state until the flip, not a fault.
- A details answer that breaks the strict ceiling schema (a missing input object, an extra property, a non object where the extra should be): `SchemaError`, surfaced as 502 "The model returned an unusable answer. Please try again.", the same as any other extra. A string or NaN where a number should be is stored as null rather than rejected, so one bad field does not cost the whole answer.
- An input the text did not support (null, zero or negative): no figure. The panel shows the plain sentence "The ceiling cannot be computed because the text did not give {inputs}." with the three assumption rows beneath it, each unsupported one marked "not supported by the text", so the reader sees what was missing and why.
- A stored extra that is not a well formed ceiling object (a run scored before this release, or a hand edited value): `Ceiling` returns null and renders nothing. The page never throws on a bad extra.
- Everything else (rubric not Published, missing keys, rate limits, timeouts, Redis down) is as in the entry above.

**Template/Config:**
- No new environment variables.
- Notion "Tool Rubrics" database `dad404fc12af4207bd446e9e8be22330`: the rows `route-to-buyer` and `unit-of-value` exist as Draft, Version 1. The site reads Published rows only, so a hidden tool with a Draft row is gated twice; publishing the row alone changes nothing on the site.
- Currency: `DEFAULT_CURRENCY` is `CAD` in `app/lib/ceiling.ts`. `computeCeiling` accepts a three letter code and falls back to CAD for anything else; the renderer passes none, so every rendered figure is CAD today. Per run currency is deferred.
- Weights live in the registry; descriptors and system prompts live in Notion, as before.
- To flip a tool on, do both tools together (the registry test requires public numbers to run 01, 02, 03 with no gap, so flipping 06 without 07 fails `npm test` on purpose):
  1. In Notion, set the row's Status to Published (bump Version if the body changed) and press refresh on `/admin/rubrics`, or wait ten minutes.
  2. Set `hidden: false` on both `ROUTE_TO_BUYER` and `UNIT_OF_VALUE` in `app/lib/tools/registry.ts` in your working tree. The calibrate script skips hidden entries, so this must come before the run.
  3. Run `npm run calibrate`. The six cases now run. Read the table, confirm or correct the grades in each case file, and set `agreedBy` and `agreedOn` to your name and the date.
  4. Add a `TOOL_STAGE_MAP` entry for each tool in `app/scale-up-advisory/scale-up-content.ts` (slug, name, stage, href, summary, stageNote) so the scale-up hub cards list them. The scale-up hygiene test bans the word "route" in exported copy and will match the `route-to-buyer` slug; adjust that test to allow the slug.
  5. Run the four gates (`npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`), commit, open a PR, deploy. The hub count, the metadata, the ItemList, the FAQ footer, the scale-up copy and the sitemap all move from five to seven with no copy edit.

**To disable:**
- Before the flip: nothing to do; both tools are already off.
- After the flip, no deploy: set the tool's Notion row back to Draft and press refresh on `/admin/rubrics`. That tool answers 503 "rubric not published" until the row is Published again; the page still renders and the other tools are unaffected.
- After the flip, with a deploy: set `hidden: true` on the entry (both entries, to keep the numbering contiguous) and deploy. The tool leaves the hub, the sitemap and the static params, the three routes answer 404, and the copy returns to the lower count on its own.
