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
