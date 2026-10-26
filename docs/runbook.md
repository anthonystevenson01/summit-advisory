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

---

## Unlock gate, emailed result and delete-my-data, added October 2026

**Trigger:** A visitor scores a tool at `/tools/{slug}` and presses "Unlock and email my result" on the gate (email required, name and company optional, honeypot unchanged). From then on, for 30 days, every tool on that browser skips the gate: the score response carries `unlocked: true` and `ToolPage.tsx` requests details straight away. The first full view for a run sends the result by email with a saved link and a delete-my-data link. Opening the saved link (`/tools/{slug}?run={runId}&t={token}`) shows that run's full view with the inputs hidden until "Score again". Opening the delete link (`/api/tools/data/delete?e={emailHash}&t={token}`) shows a confirmation page; pressing "Delete my data" removes every run stored under that email.

**Service/Function:**
- `app/lib/tools/unlock-token.ts` is the pure HMAC-SHA256 module (`signToken`, `verifyToken`, `hashEmail`). Secret and clock are arguments. One module, three purpose strings: `unlock-cookie`, `saved-link`, `delete`. A token issued for one purpose fails for another.
- `app/lib/unlock.ts` is the only reader of `UNLOCK_SECRET`. Exports the cookie name and options and the typed issue and verify helpers the routes use.
- `app/lib/mail.ts` is the one nodemailer transport (`sendMail`, `isMailConfigured`, `resultFromAddress`). The daily digest now sends through it with no timeout; the result email passes a budget.
- `app/lib/tools/result-email.ts` renders the subject, plain text and text-first HTML. `redactAddresses` strips anything shaped like an address from a transport error before it is logged.
- `app/api/tools/[tool]/unlock/route.ts`: validates (email only), `markUnlocked` (records the unlock, PERSISTs the run, SADDs the id to `runs:by-email:{hash}`), appends to `gtm-unlocks` with `name` and `company` as `""` when absent, tracks `email_given`, and sets the cookie when the secret is set. Responds `{ ok: true, unlocked }` where `unlocked` is true only when a cookie went out.
- `app/api/tools/[tool]/score/route.ts`: unchanged through `scoreRun`; afterwards reads the cookie and responds with `unlocked: true` when it verifies. Nothing is written to the run at score time.
- `app/api/tools/[tool]/details/route.ts`: body `{ runId, token? }`. Order: parse, slug, runId; verify cookie and token (string checks only); read the run; stored early return with `emailed: false`; 403 when neither the record, the cookie nor the token authorises; limiter; `detailRun` with the verified claims; email once; respond with the full view plus `emailed`. `detailRun` records a cookie unlock on the run (hash only, empty name and company) before generating, so the run persists and is indexed. `full_view_opened` carries `via: form | cookie | link`.
- `app/api/tools/data/delete/route.ts`: GET and POST both verify the token against the hash. GET renders the confirmation page; POST calls `deleteRunsByEmail`, tracks `data_deleted` with the count only, clears a `summit_unlock` cookie whose hash matches, and renders the Done page. Plain HTML strings, inline BRAND styles, no script.
- `app/lib/runs.ts`: `emailStatus` (`sent`, `failed`, null) and `emailedAt` on the record; `emailIndexKey`, `getRuns`, `listRunIdsByEmail`, `deleteRunsByEmail`, `recordEmailStatus`.
- `app/components/toolkit/ToolPage.tsx`: email-first gate, skips the gate on `unlocked`, `SavedResultLoader` (under Suspense so the tool pages stay static) reads `run` and `t` and loads the saved view.

**The cookie:** name `summit_unlock`; httpOnly; `secure` in production (follows `NODE_ENV`, so `npm run dev` over http still sets it); SameSite Lax; path `/`; Max-Age 30 days. Value is a signed token with purpose `unlock-cookie` carrying `eh` (the SHA-256 hash of the trimmed, lowercased email) and `iat`. Never the address. The 30 days is enforced twice: on `iat` at verification, and by Max-Age in the browser. Each form unlock issues its own cookie; two devices hold two valid cookies with the same hash and nothing revokes them except expiry, a secret rotation, or the delete flow clearing the one it can see.

**The links:** the saved link token (purpose `saved-link`, claim `run`) and the delete link token (purpose `delete`, claim `eh`) do not expire. Each is bound to one run id or one email hash and does nothing for any other run, hash or route, so there is nothing to gain from an old link beyond what its owner could already do. The URLs use the request origin, so a preview deployment emails links to itself rather than to production.

**Failure mode:**
- `UNLOCK_SECRET` unset: the unlock still records on the run (per-run, as before 1b); no cookie, no saved link, no email. The visitor sees the full view for that run but is gated again on the next tool. Every run shows `emailStatus: failed` with the log line "UNLOCK_SECRET is not set"; the warning "UNLOCK_SECRET is not set: unlocks are recorded but no cookie, saved link or result email is issued" logs once per instance.
- SMTP variables unset, or the send fails or times out: the visitor sees the full view without the "on its way to your inbox" line; the run records `emailStatus: failed`; the log carries the hash prefix and the transport error with addresses redacted. A `failed` status is final: there is no resend path in this release.
- Send budget: the transport gets 58 s minus the time since the handler started, capped at 10 s, and is skipped under 2 s (logged "no time budget for email"). The full view is already persisted by then, so the request stays inside `maxDuration = 60` and a retry serves the stored view.
- Cookie unlock with no address on record (the visitor deleted their data, then unlocked another tool with the surviving cookie): the run is unlocked and the full view shown; the send is recorded `failed` with "no address on record for hash".
- Run expired or deleted: a saved link gets 404 from the details route and `ToolPage` shows the normal empty page with no error. A visitor with a cookie whose run was never persisted (Redis down at score time) gets 404 on details and falls back to the gate.
- Invalid or tampered cookie: treated as no cookie; the gate shows. Invalid saved link (wrong token, wrong run, rotated secret): 403, normal page. Invalid delete link: a 400 "This link is not valid" page with no button. A delete POST without a valid token: the same page; nothing is deleted.
- Redis down: unlock and details answer 500 as in 1a; the delete POST renders a 500 "Something went wrong. Please try the link again in a few minutes." page and is safe to retry (the route is idempotent). Opening a delete link a second time renders "Done. There was nothing stored under this address."
- Secret rotation: every cookie, saved link and delete link issued under the old secret stops verifying at once. Visitors see the gate again on their next score and emailed links show the normal page or the "not valid" page. No overlap window exists in this release.

**Template/Config:**
- `UNLOCK_SECRET`: required in Production, Preview and Development on Vercel before this ships. Generate with `openssl rand -hex 32`. Signs the cookie and both links. Read in `app/lib/unlock.ts` only.
- `RESULT_FROM_EMAIL`: optional; the From address on the emailed result. Defaults to `SMTP_USER`.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: unchanged; now read by `app/lib/mail.ts` for both the result email and the daily digest. `NOTIFY_EMAIL` is still the digest's From and To.
- Redis keys:

| Key | What | TTL |
|---|---|---|
| `runs:by-email:{emailHash}` | Set of run ids unlocked under that hash (form or cookie). Written by `markUnlocked` from this release on; runs unlocked before this deploy are not in it | none; deleted by the delete flow |
| `run:{id}` | Gains `emailStatus` (`sent`, `failed`, or absent when no send was attempted) and `emailedAt` (ISO, set on a send). A cookie unlock stores `unlock` with the hash and empty `email`, `name` and `company` | unchanged |
| `events` | Gains `result_emailed` (`tool`, `runId`, `emailHash`) and `data_deleted` (`count` only). `full_view_opened` gains `via` | unchanged |
| `gtm-unlocks` | Unchanged shape; 1b entries carry `name` and `company` as `""`. Cookie unlocks do not append (the lead was reported when the email was first given). Not purged by the delete flow | none |

- Copy: gate heading "Unlock the full view", one line on what the email is used for, button "Unlock and email my result", footnote on the saved and delete links. Email subject "Your {tool} result: {score} out of 100, grade {grade} of 5"; body in registry order with both links and the line "This result was produced automatically against Summit Strategy Advisory's rubrics." The template replaces any en or em dash the model wrote.
- Preview deployments: the cookie is set on the preview host and emailed links point at the preview origin, which shows Vercel's login to anyone without access. Run previews with SMTP unset or pointed at a test inbox.

**To disable:**
- Cookies, saved links and result emails, no deploy: remove `UNLOCK_SECRET` from Vercel and redeploy the environment. The gate falls back to per-run unlocks (name and company still optional), unlocks still record on the run and in `gtm-unlocks`, every run records `emailStatus: failed`, and the warning logs once per instance. Existing cookies and emailed links stop verifying.
- Result emails only, no deploy: set the SMTP variables empty and redeploy. Cookies and saved links keep working; the send fails before touching the network ("SMTP not configured") and is recorded `failed`. The daily digest stops too, since it shares the transport.
- The delete route cannot be switched off without a deploy; it only ever deletes data under a signed hash, so there is no reason to.

**Follow-ups (from the review, non-blocking):**
- Live smoke on a preview with `UNLOCK_SECRET` set and SMTP at a test inbox: the cookie flow, the emailed result, the saved link, the delete flow and the `runs:by-email` index have unit coverage for their pure parts only.
- Timeout stacking: nodemailer's connection, greeting and socket timeouts each get the remaining budget and run one after another, so a host that stalls at every stage could exceed it. Race the send against the remaining budget.
- Route the three legacy transports (`ai-studio-request`, `admin/reset-request`, `crm-interest`) through `app/lib/mail.ts`.
- `signToken` spreads claims after the header, so a claim named `v`, `p` or `iat` would override it. All callers use fixed names; add a guard before reusing it with caller-supplied names.
- Runs unlocked before this deploy are not in `runs:by-email`, so a delete link does not cover 1a-era runs. A backfill (iterate `runs:by-time`, SADD by `unlock.emailHash`) is a short script if wanted.
- Owner decisions: the delete POST clears a matching unlock cookie (not in the spec); `gtm-unlocks` is not purged on delete (needs an LREM scan or a digest rebuilt from the run store).
- No resend path for `emailStatus: failed`; `emailStatus` is not shown on `/admin/runs`.

---

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

---

## Built to Scale? page, scorecard and method page, added October 2026

**Trigger:** A visitor opens `/tools` and sees the three path block above the tool grid: "Use a tool" (anchors to the grid), "Score your own model" (links to `/tools/built-to-scale`) and "Ask Summit to score it" (a "Coming next" card with a mailto to `info@summitstrategyadvisory.com`; Release 3b replaces it with a form). On `/tools/built-to-scale` the visitor fills the five parts (Pain, Route to buyer, Unit of value, Value evidence, Ability to protect; 40 to 2000 characters each) or the quick box (one description of the same length) and submits. The page POSTs `/api/built-to-scale/score`, shows the dark scorecard, and after the 1b unlock gate POSTs `/api/built-to-scale/details` for the full view, which also sends the result email once. The result page `/tools/built-to-scale/r/{id}` renders a stored scorecard for anyone with the link (free view; the full view with the unlock cookie or the saved link token from the email) and carries a 1200 by 630 OpenGraph image. The method page `/tools/built-to-scale/method` renders the Notion `built-to-scale` row's body. Two hand-offs: "Score the whole model" on a completed tool result opens `/tools/built-to-scale?from={runId}` with that tool's parts prefilled; a scorecard row's "re-run with these inputs" link opens `/tools/{slug}?prefill={childRunId}`. Both read `GET /api/built-to-scale/prefill?runId=`. `npm run calibrate` also runs `calibration/built-to-scale/*.json` through `scoreModel` when the row is Published and the case has no TO FILL marker (the Gradeshow case is still TO FILL, so it is reported as skipped).

**Service/Function:**
- `app/lib/tools/built-to-scale.ts`: `scoreModel(body, ctx)` and `detailModel(runId, ctx)`, the only file that builds the synthesis prompt. Stages, in order: validate the parts; load the `built-to-scale` rubric row (a Draft row fails here, before any child call); compose each public tool's inputs from the parts through the registry mapping; run `scoreRun` for every public tool in parallel with `Promise.allSettled` (six tools today, seven once Route to Buyer is unhidden), each child stored with `source: "built-to-scale"` and `parentId` as it completes; then one synthesis call through `callModel` on the `synthesis` routing key with the row's system prompt and body, the parts and every child's free view grouped by the dimension it feeds; total out of 25 and band computed in code from the five grades; composite saved at `run:{id}`. Timings from the live run: children 5 to 12 seconds typical (about 55 worst case, overlapping), synthesis about 20 seconds typical, about 50 seconds end to end on Opus 5.5 at medium reasoning. The score route hands the orchestration a deadline of 57 seconds inside `maxDuration = 60`; the synthesis is refused with under 15 seconds left and abandoned one second before the deadline so the 502 still goes out. `detailModel` authorises as `detailRun` does (record, cookie or saved link token), then produces every child's full view in parallel through `detailRun` on first open and caches it on the child; `detailsAt` is set only when every child succeeded.
- `app/lib/tools/built-to-scale-method.ts`: the method as code. `BTS_PARTS` (names, labels, prompts, headings, examples), `BANDS`, `bandFor`, `totalOf`, `validateParts`, `composeToolInputs` (headings per part, no padding, cut at the input's maxLength), `expandPartsFromInputs` (the reverse, for the hand-off), the view types and the copy constants (`AUTOMATED_LABEL` verbatim from the plan updates section 7.3, `AUTOMATED_LINE`, `QUICK_NOTE`, `LOCKED_COMMENT`). Pure.
- `app/lib/tools/built-to-scale-schema.ts`: the strict synthesis schema (exactly five rows, enum dimension, no total or band field) and `parseSynthesis` (rows in the method's order, grades clamped 1 to 5, sources filtered to the child ids that ran). Pure.
- `app/lib/tools/built-to-scale-email.ts`: the result email (subject, text, HTML) with total, band, verdict, five rows with grade and comment, strongest, weakest, one change, saved link, delete link and the automated line; every model string through `plainDashes`. Pure.
- `app/lib/tools/built-to-scale-image.ts`: `readCompositeSummary` and `scorecardImageData` for the OpenGraph image. Pure and edge safe (no `node:` imports, no registry).
- `app/lib/tools/registry.ts`: `builtToScale` on every entry maps each input key to the ordered parts that fill it (an empty list leaves the input empty); `feeds` aligned to the Notion method table (persona also feeds pain; problem also feeds value evidence). The registry test pins both.
- `app/lib/runs.ts`: `CompositeRunRecord` shares `run:{id}` and the indexes with tool runs, discriminated on `tool: "built-to-scale"`. `getRun` returns null for a composite (so the three tool routes 404 it unchanged) and `getCompositeRun` null for a tool run; `getRuns` and `listRuns` return the union. `markCompositeUnlocked` writes the unlock onto the composite and every child, PERSISTs them all and indexes them under the email hash in one pipeline, so the working lives as long as the scorecard and the delete flow removes the lot. `findAddressForHash` recovers the address for a cookie unlock.
- `app/lib/rubrics.ts` and `app/lib/rubric-blocks.ts`: `getRubricBlocks(slug)` is the structured mode beside `getRubric`: same Notion fetch, same hash, its own cache (`rubric-blocks:{slug}`, memory 60 seconds, Redis 600 seconds). `clearRubricCache` clears both modes for every registry slug and `built-to-scale`.
- Routes, all `runtime = "nodejs"`: `app/api/built-to-scale/score/route.ts` (POST `parts` or `description`, honeypot field `website`, limiter `rl:bts` at 2 per IP per hour, `maxDuration = 60`, returns the free view with `unlocked` from the cookie); `app/api/built-to-scale/details/route.ts` (POST `runId` and optional `token`; same claims handling as the tool details route; details limiter under `{ip}:built-to-scale`; `maxDuration = 60`; emails once when this request produced the full working); `app/api/built-to-scale/prefill/route.ts` (GET `runId` and `via`; returns `runId`, `tool` and `inputs` only, `Cache-Control: no-store`). `app/api/tools/[tool]/unlock` accepts `built-to-scale` as a tool and uses `markCompositeUnlocked`. `app/api/tools/[tool]/errors.ts` maps `SynthesisFailedError` to 502 and `NoToolsAvailableError` to 503.
- Pages: `app/tools/built-to-scale/page.tsx` (static; metadata and canonical; wraps the client `app/components/toolkit/BuiltToScalePage.tsx`); `app/tools/built-to-scale/r/[id]/page.tsx` (dynamic, noindex, canonical to itself) with `opengraph-image.tsx` (edge runtime, reads the run hash through `app/lib/redis.ts`) and `OpenFullView.tsx`; `app/tools/built-to-scale/method/page.tsx` (dynamic) with `RubricBlocks.tsx`. Both new URLs are in the sitemap; the result pages are not.
- Components: `app/components/toolkit/scorecard/Scorecard.tsx` (the dark panel; no hooks, so the server result page and the client page render the same thing) and `ScorecardWorking.tsx` (per row expander with each feeding tool's full view and the re-run link); `shared/UnlockGate.tsx` (the 1b gate extracted from `ToolPage`, unchanged copy and field ids); `shared/PrefillLoader.tsx` (reads `from` or `prefill` under Suspense and fetches the inputs once). `ToolPage.tsx` gains the "Score the whole model" link and the re-run prefill.
- Admin: `/admin/runs` has a "Built to Scale?" filter chip; composite rows show total and band in place of score and grade, and the expanded row shows the parts (or the description in quick mode), the five rows and the child run ids as links. Child rows show "child of {parentId}". The `synthesis` key's description on `/admin/models` says it is live.
- Events through `track`: `bts_started`, `bts_result_shown`, `bts_full_view_opened`, `bts_result_emailed`, `score_whole_model_handoff`, `tool_rerun_from_scorecard`. Child runs also emit `tool_started` and `result_shown` with `source: "built-to-scale"`; a report that counts tool runs should filter on it.

**Failure mode:**
- `built-to-scale` row not Published: the score route answers 503 "rubric not published" before any child call, so nothing is spent; the page shows that message. The method page shows "The method page is being updated. The tool itself is unaffected; check back shortly." with a 200. Stored result pages still render.
- A child tool's row Draft at run time: that tool is treated as absent, like a hidden tool. Its slug is stored in `absentTools`, the synthesis prompt names it, and its dimension is graded from the visitor's text with confidence lowered one step. The visitor sees a normal scorecard. Any other child failure (schema, provider, timeout) fails the whole run with that error's usual response; a scorecard built on fewer tools without saying so would be dishonest.
- Synthesis failure (provider error, unusable answer, or no time left): 502 "The scorecard could not be written. Your tool results are saved. Please try again." The children stay stored with `parentId` pointing at a composite that was never saved; they expire in 30 days. One of the visitor's two hourly tokens is spent.
- The 15 second refusal: with under 15 seconds of the route's budget left after the children, the synthesis is not started and the route answers the same 502. A synthesis that starts and overruns is abandoned one second before the deadline; `llm.ts` logs it to `ai:calls` whenever it settles, possibly after the response.
- Rate limit: a third run from one IP inside an hour answers 429 "Built to Scale? runs are limited to 2 an hour from one connection. Please try again later." with `Retry-After: 3600`. Without Upstash the limiter is off, as for the tools. An office behind one NAT address shares the two.
- Unknown or expired result id: the result page 404s, the details route answers 404 "Run not found. It may have expired.", and the OpenGraph image draws the frame with the title and the line only. A tool run id at the composite routes and a composite id at the tool routes both 404.
- Prefill 404s: an unknown id, a composite id or a hidden tool's run answers 404 and a malformed id 400; the loader does nothing and the page shows its normal empty form. The visitor sees no error.
- A child's working fails at details time: the full view is returned with the fallback line in that row ("The working for this tool could not be produced. Open the full view again to retry."), `detailsAt` stays unset and no email is sent; the next open regenerates only the missing child, then emails.
- Result email failure: logged with the hash prefix, recorded `emailStatus: failed` on the composite, the full view still returned. No resend path, as in 1b.
- Quick mode: never an error. The composite is flagged `quickMode: true`, the result shows the one line note on lower confidence, and the synthesis is instructed to lower confidence one step and name the part that would raise it.

**Template/Config:**
- No new environment variables; `.env.example` is unchanged. The edge image needs `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in the edge scope, which are the same project variables.
- Redis keys:

| Key | Content | TTL |
|---|---|---|
| `run:{id}` (composite) | `tool: "built-to-scale"`, `quickMode`, `inputs` (the five parts, or `{ description }`), `children` (slug to child run id), `absentTools`, `rows` (key, grade, comment, sources), `total`, `bandKey`, `band`, `verdict`, `strongest`, `weakest`, `oneChange`, `confidence`, `confidenceReason`, `rubricVersion`, `rubricHash`, `models.synthesis`, `routes.synthesis`, `calibrated.synthesis`, `detailsAt`, `unlock`, `emailStatus`, `emailedAt` | 30 days; removed by unlock |
| `run:{id}` (child) | An ordinary tool run with `source: "built-to-scale"` and `parentId`; carries the parent's unlock once the composite is unlocked | 30 days; removed with the parent's unlock |
| `runs:by-time` | Composites and children both; `countRuns` counts six children plus one composite per run today | none |
| `runs:by-email:{emailHash}` | Gains the composite id and every child id on unlock | none; deleted by the delete flow |
| `rubric-blocks:{slug}` | The structured blocks, version, hash and fetch time for the method page | 600 seconds; cleared by the admin refresh |
| `rl:bts` | The Built to Scale? score limiter, 2 per IP per hour | sliding window |
| `events` | The six new event names above | unchanged |

- Routing key `synthesis` in `app/lib/llm.ts`: default `anthropic/claude-opus-5.5`, medium reasoning, 4000 max tokens, fallback `anthropic/claude-sonnet-5.5`, temperature 0 from the orchestration. Change it on `/admin/models` without a deploy; the change marks the key uncalibrated. If `ai:calls` shows "ran out of tokens" for `synthesis`, raise its max tokens there. Children use their existing `scoring:{tool}` keys.
- Notion "Tool Rubrics" database `dad404fc12af4207bd446e9e8be22330`: the `built-to-scale` row is Published. Its body is both the synthesis prompt and the method page. The dimension names and the band table also exist in code (`BTS_PARTS`, `BANDS`); a Notion edit to either needs a matching code change or the scorecard and the method page disagree.
- Copy: the hub block and the hero in `app/tools/hub-copy.ts` (`ENTRY_PATHS`, `CONTACT_EMAIL`); the automated label and the scorecard lines in `built-to-scale-method.ts`; the email in `built-to-scale-email.ts`. The tool count in the hub copy is derived from `PUBLIC_TOOLS`.
- To unhide Route to Buyer (Tool 07): it failed three calibration cases on single dimension moves greater than one point (Harbourline cost to win, expected 4, actual 2; Northfield buyer attention, expected 2, actual 4; Pennant gatekeeper, expected 2, actual 5). Decide per case whether the proposed grade or the rubric descriptor is wrong and edit the case file or the Notion row. Then set `hidden: false` on `ROUTE_TO_BUYER` in `app/lib/tools/registry.ts`; the numbers are already contiguous (Unit of Value 06, Route to Buyer 07), so renumber only if the order changes. Run `npm run calibrate` and confirm the three cases pass within one point; set `agreedBy` and `agreedOn`. Add a `TOOL_STAGE_MAP` entry in `app/scale-up-advisory/scale-up-content.ts` (the hygiene test bans the word "route" in exported copy and needs an allowance for the slug). Run the four gates and deploy. From then on the orchestration runs seven children and the synthesis prompt stops naming the tool as absent; no change to the Built to Scale? code is needed.
- To edit the method page: edit the `built-to-scale` row's body in Notion (keep Status Published; bump Version when the body changes), then press refresh on `/admin/rubrics` or wait ten minutes. The page renders the blocks in order: headings, paragraphs, bullets, numbered lists (the leading clause of each item is bolded by the renderer), quotes and tables. Bold, links, callouts, toggles, columns, dividers and images are not carried. The same body is the synthesis prompt, so an edit changes scoring too: re-run `npm run calibrate` afterwards as for a tool row.

**To disable:**
- The whole feature, no deploy: set the `built-to-scale` row's Status to Draft in Notion and press refresh on `/admin/rubrics`. The score route answers 503 before any child call, the page shows that message, and the method page shows its updating message. Stored result pages keep rendering and their full views still open from the stored children, which depend on the tool rows, not this one. The hub block and the links to the page remain; removing them is a deploy.
- Result emails only: as in the 1b entry (unset the SMTP variables); the full view still opens and `emailStatus` records `failed`.
- The rate limit cannot be changed without a deploy; the `synthesis` model can, on `/admin/models`.

**Follow-ups (from the review, non-blocking):**
- `problem.evidence` is capped at 2000 characters and the composed heading adds about 50, so a 2000 character Value evidence part loses its tail in that one input; in quick mode the note and heading cost about 230. Raise `evidence.maxLength` or shorten the heading.
- `UnlockGate.tsx` carries `var(--font-oswald)` lifted from `ToolPage`; switch it to Barlow Condensed.
- `countRuns` counts six children plus one composite per Built to Scale? run; child events carry `source: "built-to-scale"` for filtering, the index count does not.
- Partial working: a failed child leaves a per tool fallback line and the result page keeps offering "Open the full view"; no email goes until every child succeeds, by design.
- A failed synthesis spends one of the two hourly tokens and leaves children pointing at a never saved parent; a synthesis only retry (children already stored) is the obvious next step if failures are common.
- `app/api/tools/[tool]/errors.ts` imports the orchestration module, so the tool routes bundle it; harmless.
- Route to Buyer stays hidden pending the owner's judgement of the three calibration cases above.
- Spec numbering had Route to Buyer as 06 and Unit of Value as 07; with the registry's contiguous number rule they are swapped while Route to Buyer stays hidden.
- OpenGraph image: the text wordmark and the runtime's default font are used; loading Barlow Condensed or the PNG mark on the edge is a follow-up. The prefill endpoint is an unauthenticated GET by run id; a signed prefill token is the upgrade if wanted.

## Prospect report pages, added October 2026

**Trigger:** Anthony sends a prospect a link to `/report/{slug}`: a private page built from a stored Built to Scale? composite run plus his edited grades, comments and three written sections (opening paragraph, product thoughts, moonshot). The prospect opens the link (and types the access code into the form when one was set), reads the page, and may print the one-slide summary at `/report/{slug}/slide` or follow a "Re-run with your own inputs" link from the working into a tool. Nothing is listed anywhere: the page and slide carry `noindex, nofollow`, `/report/` is disallowed in `app/robots.ts`, the sitemap is untouched, and every report carries the as-of date, "Prepared by Summit Strategy Advisory from public information" and an invitation to correct it. A report is sent to the company it names and to nobody else without their agreement. On the admin side the trigger is the "Reports" link in the admin nav and the card on the dashboard.

**Service/Function:**
- Public page `app/report/[slug]/page.tsx` (dynamic, Node). Gate order: slug, read, state (a draft or unpublished report 404s unless the admin session is present, which sees it under a "Draft preview" banner), expiry (a redirect to `/report/{slug}/expired`), access code (the form posts to `/api/report/{slug}/access`; the page renders only once the `summit_report` cookie verifies). Then, top to bottom: company, as-of date and the caveat, the opening, the 3a `Scorecard` with the edited rows (no automated label; "Scores and comments edited by Summit." only when a row is edited), product thoughts, moonshot, the working (each dimension's feeding tools through `ScorecardWorking` with `reportSlug`, each entry linking to `/tools/{tool}?prefill={childRunId}&via=report&report={slug}`), the correction line with `CONTACT_EMAIL`, and "Book 30 minutes" to `BOOK_CALL_URL`. Each render past the gate by a real reader records the open (`firstOpenedAt` with HSETNX, `openCount`, `lastOpenedAt`), tracks `report_opened` and, on the first open, emails Anthony from inside `after()`. Admin sessions and link preview fetchers (by user agent: LinkedIn, Gmail's image proxy, Facebook, Slack, Twitter, WhatsApp, Telegram, Discord, Skype, Bing, Embedly and anything containing "bot/", "crawler" or "preview") are not counted.
- Slide `app/report/[slug]/slide/page.tsx`: the same gate, no counting; a 16 by 9 stage sized in container query units with the opening across the top and three boxes (Product thoughts; Built to Scale? with total, band and the five dotted rows; Moonshot), the Summit mark and the as-of date. "Download as PDF" is `window.print()`; the `@page { size: landscape }` rule lives on this page only.
- Expired `app/report/[slug]/expired/route.ts`: plain HTML 410 for a published report whose expiry has passed, with the contact address; 404 JSON for anything else so the URL cannot tell a draft from an unknown slug.
- OpenGraph image `app/report/[slug]/opengraph-image.tsx` (edge, 1200 by 630): the three-box layout for a published, unexpired report without an access code; the fallback frame (wordmark and "Open the link to read the report") for a coded report, because link previews are fetched without cookies, and for any Redis error; 404 for drafts, unpublished, expired and unknown slugs. It imports `app/lib/redis.ts` and `report-model.ts` only; nothing with a `node:` import may join that graph.
- Public routes: `POST /api/report/[slug]/access` (limiter `rl:report-access` first, then state, code and cookie; always a 303 back to the report with `?access=wrong` or `?access=limited`, or with the cookie set; `maxDuration = 15`) and `POST /api/report/[slug]/event` (the CTA beacon; accepts only `book_call_clicked` for a published slug; always 204; `maxDuration = 15`).
- Admin pages: `/admin/reports` (company, slug, state, total and band, expiry, opens, re-runs, updated, Edit and View links), `/admin/reports/new` (the twenty most recent composite runs with date, total, quick flag, the first 80 characters of the pain part, the unlock email and "stored working x of y tools", each with a "Create report" button), `/admin/reports/[slug]` (the editor: company and slug, as-of, state, expiry, access code shown as "set" or "not set", the three textareas, the five rows each with a grade select, a comment, the run's original beside it and a "Reset to run" button, live total and band, Save, Publish or Unpublish, Delete) and `/admin/reports/[slug]/delete` (the confirm step).
- Admin routes, both behind `validateSession()` with `maxDuration = 30`: `POST /api/admin/reports` (create from `runId`: claims `draft-{last 8 of the run id}`, copies the rows with the run's originals, placeholders in the three sections, PERSISTs the run and its children, tracks `report_created`; a second click on the same run opens the existing draft) and `POST /api/admin/reports/[slug]` (one handler for `action` = save, publish, unpublish, `reset:{key}` and `delete-confirmed`; validates everything before writing; rename first with RENAMENX; rows merged against the stored originals so `edited` is recomputed on every save; a new access code hashed before the write; `report_published` and `report_unpublished` tracked on the transitions).
- Modules: `app/lib/reports.ts` (the store), `app/lib/tools/report-model.ts` (pure and edge safe: slug rules, `mergeRows`, `recomputeTotal` through the 3a `totalOf` and `bandFor`, expiry, `applyStateChange`, `readReportHash`, `publicViewOf`, `slideViewOf`, `reportImageData`, `gradeshowEdits`, `isPreviewFetcher`, the copy), `app/lib/tools/report-access.ts` (scrypt with a per-report salt, constant-time verify; Node only), `app/lib/tools/report-notification.ts` (the alert template, pure), `app/lib/report-notify.ts` (`notifyReportEvent`, never throws), `app/lib/unlock.ts` (purpose `report-access`, `REPORT_ACCESS_COOKIE`, the issue and verify helpers), `app/lib/ratelimit.ts` (`getReportAccessLimiter`). `BOOK_CALL_URL` and `CONTACT_EMAIL` now live in `app/lib/brand.ts`; `ToolPage` and the hub copy read them from there.
- The re-run hook: `app/api/tools/[tool]/score/route.ts` accepts `report` beside `rerunOf`; when the slug names a published, unexpired report it increments `rerunCount`, tracks `report_tool_rerun` and emails Anthony from `after()`. `PrefillLoader` reads `via=report&report={slug}` from the URL and `ToolPage` keeps the slug across "Score again". The prefill endpoint carries the slug into its event props only.
- Events through `track`: `report_created`, `report_published`, `report_unpublished`, `report_opened`, `report_tool_rerun`, `book_call_clicked`, each with the slug and nothing personal.

**Per prospect, in order:**
1. Research the company from public information and write the five parts.
2. Run Built to Scale? on `/tools/built-to-scale` with those parts (the five-part form, not the quick box, where possible), unlock it, and open the full view so every child's working is stored. `/admin/reports/new` shows "x of y tools" per run, so a run with working missing is visible before the report exists.
3. In `/admin`, click Reports, then New report, find the run and click Create report. The editor opens on the placeholder slug with "Report created from the run" at the top.
4. Type the company name; the slug fills itself from it until it is typed over. Check the as-of date (today, London). Set each grade and rewrite each comment; the run's grade and comment stay beside the row and "Reset to run" restores them. Write the opening paragraph, product thoughts and moonshot (paragraphs separated by a blank line; the slide shows the first paragraph of the opening and about 400 characters per box). Set an access code if the content warrants one. Click Save; the Public page, Slide and Image links at the top right open the draft preview under the admin session.
5. Click Publish. Expiry becomes 30 days from now unless a date was typed; `report_published` is tracked. Open the public page once more in a private window to see what the prospect sees.
6. Send the link, with the access code in a separate message when one is set, and the slide: open `/report/{slug}/slide`, click Download as PDF, choose Save as PDF in the dialog, and attach it. Gmail and LinkedIn previews draw the OpenGraph image; for a coded report the preview is the plain frame.
7. Follow up once. The first-open email and each re-run email say when; the editor shows opens, first and last open, and re-runs. After that, Unpublish or let the expiry pass.

**Failure mode:**
- Unknown slug, invalid slug, a draft or an unpublished report: 404 for everyone but the admin session, which sees drafts and unpublished reports under the preview banner. The slide follows the page; the image 404s for all of them.
- Expired: the page and slide redirect to `/report/{slug}/expired`, which answers 410 with "This report has expired" and the contact address. Extend the expiry in the editor and the page is back without a deploy. Expiry is the end of the chosen day in UTC; the as-of date is the London calendar date.
- Access code wrong: back to the form with "That code did not match". More than 10 attempts from one IP in an hour: "Too many attempts from this connection. Try again in an hour." Without Upstash the limiter is off. `UNLOCK_SECRET` unset: no cookie can be signed or verified, so a coded report shows the form on every visit and the route logs a warning naming the variable; reports without a code are unaffected. Clearing or changing the code invalidates every cookie issued under the old one.
- Redis down: the page and slide 404 and the image draws the frame; the admin list shows "The report store could not be read"; a save redirects with "The change could not be saved. Check the Redis variables." Nothing is cached, so the pages return as soon as Redis does.
- A half-written create: a crash between the slug claim (HSETNX) and the rest of the write leaves `report:{slug}` holding only `slug`. It reads as missing (the list, the editor and the page all 404) but the slug stays taken: the editor answers "That slug is already in use", or the create button answers "A draft already exists" and redirects to an editor that 404s. Fix: `DEL report:{slug}` in the Upstash console and create again. One admin and one pipeline make this unlikely.
- A stale index member (a crash between a rename's RENAMENX and its index move): the list prunes it on the next read; nothing to do.
- SMTP or `NOTIFY_EMAIL` unset: the first-open and re-run emails are skipped with one warning per instance ("report notifications are off"); the page and the score route are unaffected. A transport failure is logged with addresses redacted. The emails run after the response from `after()`, so a slow SMTP never delays the page.
- The run behind a report deleted (the 1b delete flow removes unlocked runs): the report keeps rendering its scorecard from the stored rows, the working section says the results are no longer stored, the editor says "Run not found." and the reset buttons do nothing. The run and its children were PERSISTed at create, so only a delete, not expiry, gets here.
- Admin preview of a coded draft: the admin session sees the access form, and the access route refuses non-published reports, so the code cannot be entered until the report is published or the code cleared. Expected; preview before setting the code, or publish and then check.
- Blanking the expiry on a published report: the editor prefills the current value, so this needs a deliberate clear. A blank on save means "30 days from the original publish date", which can expire a long-extended report at once. Type a date instead.
- Placeholders can be published: Publish requires a company name only, so "Anthony to write" can go live. Read the preview before publishing.
- Quick mode runs: the re-run links prefill the tool with the description and the quick-mode note rather than five parts; the new page and the editor flag the run as quick. Nothing blocks it.
- Open counting: a preview by an unlisted fetcher counts as an open and can send the first-open email early, so `openCount` is an upper bound. The re-run counter is informational: a crafted score request naming a published slug can move it, at the cost of a real scored run under the score limiter.
- The `report` field on a score request: validated as a slug, looked up once, never stored on the run or echoed. A draft, unpublished, expired or unknown slug does nothing.

**Template/Config:**
- No new environment variables; `.env.example` is unchanged. `NOTIFY_EMAIL` receives the alerts, sent from `RESULT_FROM_EMAIL` (or `SMTP_USER`) with a 10 second timeout; `UNLOCK_SECRET` signs the access cookie; the edge image needs the Upstash variables in the edge scope, as the 3a image does.
- Redis keys:

| Key | Content | TTL |
|---|---|---|
| `report:{slug}` | `slug`, `company`, `runId`, `state` (`draft`, `published`, `unpublished`), `asOf`, `expiresAt`, `accessCode` (`{ salt, hash }` or null; never the code), `opening`, `productThoughts`, `moonshot`, `rows` (five entries: key, grade, comment, `original` grade and comment, `edited`), `total`, `bandKey`, `band` (rewritten on save, recomputed on read), `createdAt`, `updatedAt`, `publishedAt`, `firstOpenedAt`, `lastOpenedAt`, `openCount`, `rerunCount` | none; removed by delete |
| `reports:by-updated` | Sorted set, score `updatedAt` in ms, member slug; moved on save and rename, pruned of stale members on read | none |
| `run:{id}` (the composite and its children) | Unchanged content; the TTL is removed by PERSIST when a report is created from the run | none after create |
| `rl:report-access` | Access-code attempts, 10 per IP per hour | sliding window |
| `events` | The six event names above | unchanged |

- The `summit_report` cookie: httpOnly, `SameSite=Lax`, `Secure` in production, path `/report/{slug}`, Max-Age the seconds until the report expires (at least 60, at most 30 days), value a token signed with `UNLOCK_SECRET` under purpose `report-access` carrying the slug and the first 8 hex characters of the code hash. One cookie per report; a preview host's cookie does not reach production.
- Copy: every public line (`CAVEAT_LINE`, `EDITED_NOTE`, `CORRECTION_LINE`, `CTA_LABEL`, the access, expired and working lines, `SLIDE_MARK`) is a constant in `report-model.ts` and tested for dashes. `BOOK_CALL_URL` and `CONTACT_EMAIL` are in `app/lib/brand.ts`. The report page uses the production origin for its OpenGraph URL.
- Seed script: `npm run seed-report -- <compositeRunId> --gradeshow` creates the draft `gradeshow` (company "Gradeshow", grades Pain 3, Route to buyer 2, Unit of value 1, Value evidence 2, Ability to protect 2, total 10, "A good idea with an engine still to build", each run comment kept for rewriting, as-of today, the three sections as "Anthony to write") and PERSISTs the run. Without `--gradeshow` it creates `draft-{last 8 of the run id}` with the run's rows unchanged. It reads `.env.local`, needs the Upstash variables, and is idempotent: an existing slug prints "already exists" and exits 0 with nothing changed. Exit 1 when the run is missing or not a composite; 2 for usage or missing configuration. The orchestrator runs it once on the preview after the smoke, then once in production; Anthony finishes the report in the editor.

**To disable:**
- One report, no deploy: open it from `/admin/reports` and click Unpublish. The page, slide and image 404 at once and the access cookie stops working. Publish again to restore it with the same slug and expiry. Delete (the Delete link, then "Delete the report") removes the hash and the index entry and keeps the composite run.
- All reports, no deploy: unpublish each from the list. There is no global switch; the routes stay deployed and answer 404 for everything unpublished.
- Alerts only: unset `NOTIFY_EMAIL` or the SMTP variables; the pages and counters are unaffected.
- The access limiter cannot be changed without a deploy.

**Follow-ups (from the review, non-blocking):**
- Oswald in the two admin report headings matches the existing admin pages; the task constraint said none in new components. Owner to confirm or switch to Barlow Condensed.
- `originFromHeaders` builds the alert email's links from the forwarded host header. Safe on Vercel; a hard-coded base or `NEXT_PUBLIC_SITE_URL` would close the spoof case elsewhere.
- An admin previewing a draft that already has an access code sees the form and cannot enter the code until publish or clear (above).
- Blanking the expiry on a published report resets it to 30 days from the original publish date (above).
- A half-written create key blocks its slug until deleted by hand (above).
- The access, event, expired and score routes each do one extra report read; fine at this volume.
- Five pre-existing pages still inline the calendar booking URL; only `ToolPage` reads `BOOK_CALL_URL`.
- Preview smoke before merge: real Upstash claim and rename, the access-code flow and cookie scoping, the limiter, SMTP on first open and re-run, the end-to-end re-run hook from a report link, open counting skipped for the admin session and a preview bot, the report page at 375 px, print to PDF, Gmail and LinkedIn previews.
