# Design Document: Scale-Up Advisory, two routes (fractional executive + outsourced sales)

Branch: `anthonystevenson0/scale-up-two-routes-outsourced-sales`
Date: 2026-09-22
Source copy: Anthony's scale-up deck (10 slides), plus the current CXO copy in `app/scale-up-advisory/page.tsx`.

---

## 1. Files to Modify / Create

| File | Action | What and why |
|---|---|---|
| `app/scale-up-advisory/scale-up-content.ts` | **Create** | Import-free data module (only `import type`) holding all copy, route definitions, tool-to-stage map, FAQs and both pages' JSON-LD objects, so pages stay thin and tests can import the data directly (Next forbids arbitrary named exports from `page.tsx`). |
| `app/scale-up-advisory/page.tsx` | **Rewrite** | Becomes the Route 2 (outsourced sales) page: hero, two route cards, tools pointer, then the deck narrative, a section tying tools to packages, FAQs, CTA and footer. New metadata and JSON-LD. |
| `app/scale-up-advisory/fractional-executive/page.tsx` | **Create** | Route 1 page: today's CXO copy, reframed around Summit's bench, with its own metadata, canonical URL, Service and FAQPage JSON-LD, a back link, CTA and footer. |
| `app/sitemap.ts` | Modify | Add `${BASE}/scale-up-advisory/fractional-executive` (monthly, priority 0.8) directly after `/scale-up-advisory`. |
| `app/page.tsx` | Modify | Update the `sme` entry in `practiceData` (~l.38), the homepage card `desc` (~l.703), the contact dropdown (~l.663: replace the one Scale-Up option with two), and the crawler line (~l.739: add a Fractional Executives link). Add an optional `pageHref` field to the `practiceData` type and render it in `PracticePage` (see Key Decisions). |
| `__tests__/scale-up-advisory.test.ts` | **Create** | Tests on pure exported data, run by Node's built-in test runner (see Key Decisions). |
| `package.json` | Modify | Add a `"test"` script only. No dependency changes. |
| `docs/runbook.md` | (Docs agent) | Note how to run the new tests and where scale-up copy lives. |

No changes to: `app/components/SiteNav.tsx` (it has no scale-up links), `middleware.ts` (matcher is `/admin/:path*` only), `next.config.ts` (only `/AIWritingLab` rewrites), `vercel.json` (crons only), `app/globals.css` (every class needed already exists), or `toolConfig.ts`.

---

## 2. Integration Points

### 2.1 `scale-up-content.ts` (new, kebab-case utility file)
- **Runtime imports: none allowed.** Only `import type { ToolSlug } from "@/app/tools/[tool]/toolSlugs"` is allowed, because Node's type stripping erases it. A runtime import, or `@/` resolved at runtime, would break the test runner.
- Suggested named exports (`as const` where it helps):
  - `SITE_URL` (`https://summitstrategyadvisory.com`), `SCALE_UP_PATH` (`/scale-up-advisory`), `FRACTIONAL_EXEC_PATH` (`/scale-up-advisory/fractional-executive`), `OUTSOURCED_ANCHOR_ID` (`outsource-your-sales`), `BOOK_URL`. `BOOK_URL` moves the existing Google Calendar URL here. Both scale-up pages import it; `app/page.tsx` and `SiteNav` keep their own copies, since unifying those is out of scope.
  - `LAST_REVIEWED_LABEL` (`"September 2026"`) and `DATE_MODIFIED` (`"2026-09-22"`).
  - `ROUTES`: exactly 2 items `{ id: "fractional-executive" | "outsource-sales", num: "01"|"02", title, body, href, cta }`. Route 1 `href` = `FRACTIONAL_EXEC_PATH`. Route 2 `href` = `#outsource-your-sales`.
  - Route 2 narrative: `SITUATION` `{ heading, pains: [3 × {title, body}], quotes: [3 strings] }`, `WHAT_SUMMIT_IS` `{ heading, intro, parts: [2 × {num,title,body}] }`, `THESIS` (4 × {title, body}), `ROLES` (2 × {title, strap, body}), `HOW_WE_CHARGE` (string[]), `PANEL` `{ heading, intro, points: [4 × {title, body}], fractionalTeam, prospects, library: string[8] }`, `PACKAGE_STAGES` (6 × `{ id: "MAP"|"REACH"|"WIN"|"ONBOARD"|"KEEP"|"GROW", body }`), `PACKAGE_COUNT = 19`, `LEAD_ENGINE` `{ name, strap, summary, facts: string[], walkAway: string[6] }`, `WHY_SUMMIT` (4 × {title, body}).
  - `TOOL_STAGE_MAP`: 5 × `{ slug: ToolSlug, name, stage: PackageStageId, href: "/tools/<slug>", body }`, plus `TOOLS_HUB_PATH = "/tools"`.
  - `OUTSOURCED_FAQS` and `FRACTIONAL_FAQS`: `{ q, a }[]`.
  - `scaleUpServiceSchema`, `scaleUpFaqSchema`, `fractionalServiceSchema`, `fractionalFaqSchema`: plain objects. Build FAQ `mainEntity` by mapping the FAQ arrays, the same pattern `app/tools/[tool]/page.tsx` uses.
  - `scaleUpMetadata` / `fractionalMetadata` are **not** exported from here. Metadata stays inline in each page (typed `Metadata` from `next`), matching every other page in the repo.

### 2.2 `app/scale-up-advisory/page.tsx` (server component, no `"use client"`)
- Exports `metadata` and a default component, and imports `SiteNav`, `next/image` `Image` and the content module.
- Renders two `<script type="application/ld+json">` tags (Service, FAQPage), then `<SiteNav />`, then `.page > .inner`, then the footer. This is the existing structure.
- **Section order and styling.** All classes already exist. Tailwind is only for non-layout touch-ups such as `no-underline` and `italic`.

  1. **Hero** `.inner-hero`
     - Eyebrow: "For B2B Scale-Ups".
     - `h1.inner-title`: "Grow without the gamble."
     - `.inner-lead`: "Summit builds, runs and leads your commercial function. Fractional talent, guided by your intelligence, enabled by AI." (fixes "guide by".)
     - The existing "Last reviewed: September 2026 · By Anthony Stevenson" line, same inline style.
  2. **Two routes** `.inner-body`
     - `h2.section-label` "Two ways in".
     - Container `.for-grid`. It is 2 columns and collapses to 1 at 900px. Do **not** use `.cards`: it has 3 columns, and an inline `gridTemplateColumns` would override its mobile rule.
     - Each route is an `<a className="card no-underline">` wrapping `.card-body`, which holds `span.resource-tag` "Route 01"/"Route 02", `.card-title`, `.card-desc` and `.card-link` (CTA text plus `ArrowRight` from `@/app/components/icons`, a plain server-safe component).
     - Route 1: "Hire a fractional executive". Summit has senior commercial people you can bring in part-time as your CRO, CCO or CMO. CTA "Meet the model →", linking to the new page.
     - Route 2: "Outsource your sales". Packages that let you hand over as much or as little of sales as you need. CTA "See how it works ↓", linking to `#outsource-your-sales`.
     - **Tools pointer.** Directly under the grid, reuse today's small paragraph pattern (l.134 style). Text: "Not ready to talk? Our free GTM tools are a good place to start:". Inline-link all 5 tools from `TOOL_STAGE_MAP` plus "the full toolkit" (`/tools`), and add "(more on how they fit below)", linking to `#free-tools`.
  3. **Route 2 anchor.** Wrap everything from here to the FAQ in an element with `id={OUTSOURCED_ANCHOR_ID}`. Add Tailwind `scroll-mt-20` (required: `.nav` is `position: fixed`, 64px tall). Apply the same to `id="free-tools"`.
     - First block, `.inner-body`: `section-label` "Route 02 · Outsource your sales".
     - `p.section-intro` from `SITUATION.heading`: "Your business is starting to scale and sales looks expensive."
     - Three pains in `.focus-grid` (3 columns, collapses): No single source of truth / Pipeline you can't predict / Hiring is a gamble.
     - A small `section-label` "Who buys Summit?", then the 3 quotes in a second `.focus-grid`, `.focus-body` with `italic`.
  4. **What Summit is** `.inner-body`
     - `section-label` "What Summit is". Intro line "The convenience of outsourcing. The ownership of insourcing." Then the package sentence.
     - `.features` (2 items): "01 The Engine build" (intelligence library with ICP and target accounts mapped, personas, signals, battlecards, objection handling; playbooks for the sales motions you need, fixing "motion's"; your voice and positioning; built with real sales know-how) and "02 The people to run it".
  5. **Thesis**, dark `.equity-band` (reuse the existing inner-body override styles)
     - `section-label` (sage) "Summit's thesis". Big line "Four things are true at once."
     - `.equity-cards` with 4 `.equity-card`s. `.equity-card-num` is "01" to "04". `.equity-card-label` holds a white bold title span plus body.
     - Fix "rouge" → "rogue" and "covers" → "cover".
     - Body 4: "No platform, no licence. The IP and the tools we build for your operation are yours."
  6. **How it works** `.inner-body`
     - `section-label` "How it works". Intro "Two roles, one contract."
     - `.features` (2): Forward deployed specialists ("They set up. They stay on.") and Fractional sales people ("They flex with the plan.").
     - Then one full-width `.for-card.for-yes` titled "How we charge", with `HOW_WE_CHARGE` as `.for-item`s using the `.for-check` "✓" glyph:
       - packages are fixed-price pieces of work
       - people are a monthly rate that flexes with the plan
       - no platform fee, no licence, nothing per seat
       - you own everything we build
  7. **The Panel** `.inner-body`
     - `section-label` "Summit's Panel". Intro "Fractional people, guided by everything you know."
     - Short paragraph built from `fractionalTeam` and `prospects`.
     - `.features` (4): Who to go after / What to say / How to say it / Always measuring, always learning.
     - Then a label "The intelligence library" and a `.pkg-meta` row of 8 `.pkg-tag` chips.
  8. **Package coverage** `.inner-body`
     - `section-label` "Summit packages". Intro "Packages across every sales motion and process."
     - `.focus-grid` of 6 `.focus-card`s (`.focus-title` = stage id, `.focus-body` = deck line).
     - Closing emphasised line: "Nineteen packages. The whole lifecycle covered." Render it from `PACKAGE_COUNT` using a number-to-word, or hardcode "Nineteen", but keep `PACKAGE_COUNT` as the tested source of truth.
  9. **Tools joined to the message** `.inner-body`, `id="free-tools"`
     - `section-label` "See the engine at work". Heading line: "Our free tools are the engine, in miniature."
     - Two short paragraphs:
       - The five free GTM tools are small demonstrations of the AI skills Summit uses every day: scoring an ICP, pressure-testing a persona, grading positioning.
       - When Summit takes on your sales, we build bespoke versions of the same kind of AI for you, trained on your intelligence library rather than a blank form, and they're yours to keep.
     - `.resources` grid of 5 `<a className="resource resource-tool no-underline">` cards. Each has `span.resource-tag` "{stage} package", `.resource-title` tool name, `.resource-desc` (one line on how the tool relates to that stage) and `span.resource-cta` "Try it free →".
     - After the grid, a line linking "See all five tools" → `/tools`.
  10. **Where to start** `.inner-body`
      - `section-label` "Where to start". Intro "Generate consistent leads every month."
      - Title line "The AI Lead Engine Build" (a `resource-title`-style heading, or an `h3` with `feature-title` class), then the summary.
      - `.for-grid` with two `.for-card.for-yes` cards:
        - "What you walk away with": the 6 `walkAway` items with checks.
        - "The shape of it": `facts`, i.e. fixed price; eight weeks; live conversations by week five; predictable pipeline every month after; you own every asset at the end.
      - Then `.cta-bar`: h3 "Start with the Lead Engine Build", p "Book a 30-minute call. No obligation." and `<a className="cta-bar-btn no-underline" href={BOOK_URL} target="_blank" rel="noopener noreferrer">`.
  11. **Why Summit** `.inner-body`
      - `section-label` "Why Summit". Intro "Built by operators, not an agency."
      - One paragraph on twenty years selling technology across North America, Europe and Australia.
      - `.features` (3): Done the exact job / Doing it now / Summit runs on the engine. The web rewording of the last one should keep the joke: "If we end up on a call, the engine probably booked it."
  12. **FAQ** `.inner-body`: `section-label` "Frequently Asked Questions", then `.features` mapped from `OUTSOURCED_FAQS`. This is the existing pattern.
  13. **CTA** `.calendly-band`, same markup as today.
      - Title: "Worth 30 minutes?"
      - Body: "See what the first package looks like for your business. No obligation, no pitch deck."
      - Button: "Book a 30-Minute Call →".
  14. **Footer**: identical to today's.

### 2.3 `app/scale-up-advisory/fractional-executive/page.tsx` (server component)
- Same shell (JSON-LD scripts, `SiteNav`, `.page > .inner`, footer).
- **Hero:**
  - `<a className="inner-back no-underline" href="/scale-up-advisory">`, with the `ArrowLeft` icon if available, text "Scale-Up Advisory".
  - Eyebrow "Scale-Up Advisory · Route 01". h1 "Hire a fractional executive".
  - Lead: senior commercial leadership, part-time. Summit has a bench of experienced commercial executives (Anthony among them) who step in as your CRO, CCO or CMO, own the function and are accountable for outcomes.
  - "Last reviewed: September 2026" byline.
- **What we do**: `.features` with today's 4 items. Only the fourth body changes wording: "a senior executive from Summit's bench, not a junior consultant".
- **Why Fractional** `.equity-band`: today's copy and 3 stat cards unchanged (20–40%, 3–12 mo, $500K–$20M). Swap em-dashes for commas or full stops where natural.
- **Cross-sell line** (small paragraph style): "Need the sales work done as well as led? See how Summit runs outsourced sales →", linking to `/scale-up-advisory#outsource-your-sales`, followed by a one-line pointer to `/tools`.
- **FAQ**: `FRACTIONAL_FAQS`, today's 5 CXO questions. Reframe Q4 from "Anthony Stevenson works directly with clients" to "You work directly with a senior executive from Summit's bench (Anthony among them), not a junior consultant." Remove em-dashes.
- **CTA**: `.calendly-band` "Tell us what you're trying to grow." Footer.
- **Metadata:**
  - title: "Hire a Fractional CRO, CCO or CMO | Summit Scale-Up Advisory"
  - description: about 150 characters
  - canonical: `https://summitstrategyadvisory.com/scale-up-advisory/fractional-executive`
  - OG/twitter mirrored, image `/opengraph-image`
- **JSON-LD:**
  - `Service`: name "Fractional Executive Leadership", `serviceType` "Fractional executive leadership", provider as today, `areaServed` as today, `url` = canonical, `dateModified` = `DATE_MODIFIED`.
  - `FAQPage` from `FRACTIONAL_FAQS`.

### 2.4 `/scale-up-advisory` metadata and schema
- title: "Outsourced Sales & Fractional Executives for B2B Scale-Ups | Summit"
- description (about 155 characters): Summit builds, runs and leads your commercial function. Fractional sales people, an AI-powered engine built on your intelligence, fixed-price packages, and you own everything.
- OG/twitter: same title/description, `/opengraph-image`. Canonical unchanged.
- `scaleUpServiceSchema`: `@type` "Service", name "Outsourced Sales for B2B Scale-Ups", `serviceType` "Outsourced sales and business development" (not "Management Consulting"), `dateModified` `DATE_MODIFIED`, `url`, provider, `areaServed` `["Canada","United States","United Kingdom","Europe","Australia"]` (the deck says North America, Europe, Australia), description.
  - Optional `hasOfferCatalog` listing the six stages as `OfferCatalog` → `Offer` → `Service` names. No prices (the deck gives none).
- `OUTSOURCED_FAQS` (6 to 8), answers in plain British English:
  1. What is an outsourced (fractional) sales team?
  2. Is it cheaper than hiring an SDR? Answer qualitatively: fractional, no ramp gamble, no platform fee. **Do not invent figures.**
  3. What's in the AI Lead Engine Build? Eight weeks, live conversations by week five, fixed price, the six walk-away items.
  4. Who owns what you build? The client owns everything: IP, library, playbook, tools. No licence.
  5. What happens after the eight weeks? Keep the fractional SDR on a flexing monthly rate and add further packages from the nineteen as you grow, or walk away with the assets.
  6. How do the free GTM tools relate to working with Summit?
  7. (optional) How is this different from a lead-gen agency?
  8. (optional) Can I hire a fractional executive instead? Links conceptually to Route 1.

### 2.5 `app/page.tsx` (client component, SPA)
- `practiceData.sme`:
  - lead: rewritten to the new pitch.
  - features (4): Route 1 "Hire a fractional executive"; Route 2 "Outsource your sales"; "Start with the AI Lead Engine Build" (eight weeks, fixed price, you own it); "Free GTM tools" (the engine in miniature).
  - cta: "Explore scale-up advisory".
  - New optional `pageHref: "/scale-up-advisory"`.
- `PracticePage`: when `p.pageHref` is set, render a text link below `.features` and above `.cta-bar`: "Read the full Scale-Up Advisory page →", styled like the l.134 paragraph link (teal, 600). `ai`/`retail` don't set it, so nothing changes for them.
- Card `desc` (l.703): about 20 words covering both routes, e.g. "Outsourced sales and fractional executives for B2B scale-ups. Fixed-price packages, AI-enabled, and you own everything we build."
- Contact `<select>` (l.663): replace `<option>Scale-Up Advisory</option>` with `<option>Scale-Up: Hire a fractional executive</option>` and `<option>Scale-Up: Outsource your sales</option>`.
- Crawler line (l.739): insert `· <a href="/scale-up-advisory/fractional-executive">Fractional Executives</a>` after the Scale-Up Advisory link, with the same inline style.

### 2.6 Tests: `__tests__/scale-up-advisory.test.ts`
- Import `describe`/`test` from `node:test` and `assert` from `node:assert/strict`.
- Import via **relative paths with explicit `.ts` extensions**: `../app/scale-up-advisory/scale-up-content.ts`, `../app/tools/[tool]/toolSlugs.ts` and `../app/sitemap.ts`. `__tests__` is excluded from `tsconfig`, so `tsc` doesn't object to the extensions.
- Cases:
  1. **Sitemap**: includes both `/scale-up-advisory` and `/scale-up-advisory/fractional-executive`, and URLs are unique.
  2. **Routes**: `ROUTES` has length 2. Route 1 href equals `FRACTIONAL_EXEC_PATH`. Route 2 href equals `#` + `OUTSOURCED_ANCHOR_ID`.
  3. **Tool map**:
     - 5 entries with unique slugs.
     - Every `slug` passes `isToolPublic`.
     - `href === "/tools/" + slug`.
     - `name === TOOL_SEO[slug].title.split(" —")[0]`, which guards against drift.
     - Every `stage` is one of the `PACKAGE_STAGES` ids.
     - The public slug set equals the mapped slug set, so a newly published tool fails the test until it's mapped.
  4. **Package stages**: ids are exactly `MAP, REACH, WIN, ONBOARD, KEEP, GROW` in order. `PACKAGE_COUNT === 19`.
  5. **Lead Engine**: `walkAway.length === 6`.
  6. **Schemas**, for both Service schemas:
     - `@context` `https://schema.org`, `@type` "Service".
     - Scale-up `serviceType !== "Management Consulting"`.
     - `dateModified === "2026-09-22"`.
     - `url`s are absolute on `summitstrategyadvisory.com`.
  7. **FAQ schemas**: `@type` "FAQPage"; `mainEntity.length` equals the source FAQ array length; each item has `@type` "Question", a non-empty `name`, and an `acceptedAnswer["@type"] === "Answer"` with non-empty text.
  8. **Copy hygiene**: serialise all exported copy with `JSON.stringify` of the module namespace and assert it contains none of `guide by`, `motion's`, `rouge`, `small team covers`, `Management Consulting`. Assert the em-dash count stays under a small threshold (e.g. ≤ 3) to enforce the "no em-dash overuse" rule.
- `package.json` script:

  ```
  "test": "node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON __tests__/scale-up-advisory.test.ts"
  ```

  This was verified locally (Node v25.9.0): `.ts` imports, `import type` erasure and `sitemap.ts` all work.

---

## 3. Data Flow

- **Build time (static):** `scale-up-content.ts` constants are read by both server pages. JSX maps arrays to existing CSS-class markup. JSON-LD objects are passed through `JSON.stringify` into `<script>` tags. `metadata` exports feed Next's `<head>`. Both routes pre-render statically, since there are no params or data fetching.
- **Navigation:**
  - Homepage card → SPA `sme` view → `pageHref` link → `/scale-up-advisory`.
  - Route 1 card → `/scale-up-advisory/fractional-executive` → back link / cross-sell → `/scale-up-advisory#outsource-your-sales`.
  - Tool cards → `/tools/<slug>`, which is served by the existing `[tool]` route. A hidden tool would 404, which is why the test enforces `isToolPublic`.
- **Error paths:**
  - No runtime inputs, so there are no runtime error paths.
  - The failure modes are all build or test time: a slug typo (caught by the `ToolSlug` type in `tsc` and by the test), a tool hidden later (test fails, which is intended), or a sitemap omission (test).
  - Anchor `#outsource-your-sales` missing from the DOM means the link does nothing. Mitigation: the id comes from the same `OUTSOURCED_ANCHOR_ID` constant used for the href.

---

## 4. Key Decisions

1. **Data module separate from pages.**
   - Alternatives: keep everything inline (today's style), or export from `page.tsx`.
   - Rationale: Next's type check rejects non-standard named exports from `page.tsx`, and tests need importable data. It also keeps two long pages readable.
   - One module covers both routes: they're a single content area, and one import in tests.
2. **Test runner: Node built-in `node:test`, not Jest.**
   - Facts: **Jest is not installed.** There's no `jest`/`ts-jest` in `package.json` or `node_modules`, and no `test` script, so `npm test` currently errors with "Missing script". The existing `__tests__/gtm-toolkit.test.ts` uses Jest globals and is already stale: it expects 5 `TOOLS` numbered 01–05 and different surfaces, while `toolConfig.ts` has 4. It can't run as-is.
   - Adding Jest would break the "no new dependencies without team approval" constraint. Node's runner needs nothing new.
   - Alternative: `vitest`. That is also a new dependency.
   - **Orchestrator: flag to the human** that CLAUDE.md lists Jest but it isn't set up. The script targets only the new file so the stale Jest file can't break `npm test`.
3. **Route cards use `.for-grid` + `.card`, not `.cards`.**
   - `.cards` is a 3-column grid with a 1-column mobile rule. Overriding its columns inline would kill the mobile collapse.
   - Unlayered global CSS beats Tailwind utilities (layered), so `grid-cols-2` wouldn't override it either.
   - `.for-grid` is already a responsive 2-column grid.
4. **Route 1 is a link to a new page; Route 2 is an in-page anchor.** Both follow the acceptance criteria. Route 2 is the main content of `/scale-up-advisory`, so the canonical URL and search equity stay on the offer Anthony is leading with.
5. **Tool-to-stage mapping:**

   | Tool | Stage | Reason |
   |---|---|---|
   | Market Problem Validator | MAP | Market definition |
   | ICP Evaluator | MAP | ICP scored and ranked |
   | Buyer Persona Quality Check | REACH | The right people, in the right order |
   | Positioning Statement Grader | REACH | The right message, "what to say" |
   | Competitive Moat Rater | WIN | Battlecards, competitive handling |

   ONBOARD / KEEP / GROW get no tool. The copy should say the tools cover the front of the lifecycle, and that the engine goes further.
   - Assumption: the Account Intelligence tool (`account`) stays hidden, so it's excluded. The test keeps this honest.
6. **Tool names hardcoded in the content module, not imported from `toolConfig.ts`/`toolSlugs.ts`.**
   - A runtime import would break Node type stripping through the `@/` alias, and `toolConfig.TOOLS` lacks `icp`.
   - Drift is caught by the test comparing to `TOOL_SEO` titles. `ToolSlug` is imported as a type only.
7. **`PracticePage` gets an optional `pageHref`.** The SPA `sme` view today has no path to the real page, and it can't hold two route cards without a bespoke component. A single optional field is the smallest change that makes the SPA view point at both routes. Rejected alternative: a bespoke `ScaleUpPracticePage` component, which duplicates content.
8. **`BOOK_URL` centralised only for the scale-up pages**, to avoid touching `SiteNav`/homepage wiring.
9. **No invented numbers.** Pricing, SDR cost comparisons and client names are absent from the deck, so the copy stays qualitative. The existing 20–40% / 3–12 mo / $500K–$20M stats are kept on Route 1 only, as they are today.
10. **Voice.** The Coder writes final copy in Anthony's plain, direct British English (organisation, licence, programme). Use full stops and commas over em-dashes, with at most a couple per page; the test enforces the threshold on the content module. The Coder may use the `write-like-anthony` skill.

---

## 5. Constraints Honoured

| Constraint | How it's met |
|---|---|
| No new dependencies | `node:test`/`node:assert` are built in. `package.json` gains a script only. |
| No secrets | Only public URLs (the booking link already in the repo, the site domain). |
| Reuse existing CSS classes; no new CSS files | Only classes already in `globals.css`: `inner-hero`, `inner-eyebrow`, `inner-title`, `inner-lead`, `inner-back`, `inner-body`, `section-label`, `section-intro`, `for-grid`/`for-card`/`for-yes`/`for-item`/`for-check`, `card`/`card-body`/`card-title`/`card-desc`/`card-link`, `focus-grid`/`focus-card`/`focus-title`/`focus-body`, `features`/`feature`, `equity-band`/`equity-cards`/`equity-card*`, `pkg-meta`/`pkg-tag`, `resources`/`resource`/`resource-tool`/`resource-tag`/`resource-title`/`resource-desc`/`resource-cta`, `cta-bar*`, `calendly-*`, `footer*`. Tailwind utilities are used only for `no-underline`, `italic` and `scroll-mt-*`. Inline styles only where the existing page already uses them (byline, small link paragraph, band headings). |
| Naming conventions | kebab-case utility (`scale-up-content.ts`), PascalCase component names, camelCase/UPPER_SNAKE constants as in `toolConfig`/`toolSlugs`. |
| Deck typos fixed | "guided by", "sales motions", "rogue", "cover". Enforced by test 8. |
| Dates | `dateModified` `2026-09-22` in both Service schemas; "Last reviewed: September 2026" on both pages. |
| Quality gates | `npm test` (new script) and `npx tsc --noEmit` (baseline is clean today). `npm run build` should also be run; it's the stronger check because it validates page exports and metadata types. |

---

## 6. Out of Scope

- Installing Jest or repairing `__tests__/gtm-toolkit.test.ts`. It is stale and needs team approval for a runner. Recommend a follow-up task.
- Named bench profiles or bios on the fractional executive page, per the task.
- Individual pages for the 19 packages, or a pricing page. The deck names only the six stages and one package.
- Changes to `app/layout.tsx` site descriptions and `opengraph-image.tsx` ("GTM leadership for B2B scale-ups" is still accurate).
- Footer link lists on other pages (`ai-studio`, `loyalty-retail-media`, `NewsletterHub`). `/scale-up-advisory` remains the entry point; the new page is reachable from it, the sitemap and the homepage crawler line.
- Unifying the duplicated `BOOK_URL` in `SiteNav`/`app/page.tsx`.
- A new OG image specific to scale-up.

## Risks / Edge Cases for the Reviewer

- **Node version.** Native TS stripping needs Node ≥ 22.18 / 23.6. CLAUDE.md says Node 20, but the local machine is v25.9.0. The test script fails on Node 20. Flag in the PR and runbook.
- **Content module imports.** If the Coder adds any runtime import, or a non-type `@/` import, to `scale-up-content.ts`, tests will fail to resolve. Keep it `import type` only.
- **Anchor offset.** `.nav` is `position: fixed` (64px). Both anchors need `scroll-mt-20`, or the section label hides under the nav.
- **Anchor elements on button classes.** `.card` and `.inner-back` were written for `<button>`. On `<a>` they need `no-underline`. `.card` sets no colour on the root, and child classes set their own colours, so this is fine.
- **FAQ text in JSON-LD must match the visible FAQ text.** Both are rendered from the same array.
- The optional `hasOfferCatalog` must not include prices or availability claims.
