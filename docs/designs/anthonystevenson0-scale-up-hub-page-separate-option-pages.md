# Design Document: Scale-Up Advisory hub page + separate option pages

Branch: `anthonystevenson0/scale-up-hub-page-separate-option-pages`
Date: 2026-09-24
Builds on: `docs/designs/anthonystevenson0-scale-up-two-routes-outsourced-sales.md` (same content module, same CSS decisions; only the page split and naming change).

Summary of the change: `/scale-up-advisory` becomes a slim hub (hero, two option cards, free-tools section, footer). The outsourced-sales narrative moves, unchanged in substance, to a new static page at `/scale-up-advisory/outsourced-sales`. All "route" wording goes. The homepage card links straight to the hub and the SPA `sme` view is deleted.

---

## 1. Files to Modify / Create

| File | Action | What changes and why |
|---|---|---|
| `app/scale-up-advisory/scale-up-content.ts` | Modify | Rename route identifiers to options, add the outsourced path, hero and hub-only copy, split each tool card body into `summary` + `stageNote`, move the outsourced Service/FAQ schemas to new names and add a light hub Service schema, bump `DATE_MODIFIED`. Still `import type` only. |
| `app/scale-up-advisory/page.tsx` | Rewrite | Slim hub: hero, two `next/link` option cards, free GTM tools section, footer. New metadata; only the hub Service JSON-LD. |
| `app/scale-up-advisory/outsourced-sales/page.tsx` | **Create** | New static page carrying sections 3–11 of today's hub plus FAQ, CTA band and footer, with a hero (back link to the hub), its own metadata and the outsourced Service + FAQPage JSON-LD. |
| `app/scale-up-advisory/fractional-executive/page.tsx` | Modify | Eyebrow loses "Route 01" (comes from the content module); cross-sell link points at `OUTSOURCED_SALES_PATH`; drop the `OUTSOURCED_ANCHOR_ID` import. |
| `app/sitemap.ts` | Modify | Add `${BASE}/scale-up-advisory/outsourced-sales` (monthly, 0.8) after the fractional-executive entry. |
| `app/page.tsx` | Modify | Homepage "Scale-Up Advisory" card renders as a `Link` to `/scale-up-advisory`; delete `practiceData`, `PracticePage` (incl. the `pageHref` block) and the `page === "sme"` branch; add an "Outsourced Sales" link to the crawler block. Contact `<select>` untouched. |
| `next.config.ts` | Modify | Add `redirects()` with one entry: `/?page=sme` → `/scale-up-advisory` (permanent). Keep the file free of runtime imports (see §4.6). |
| `__tests__/scale-up-advisory.test.ts` | Modify | Options instead of routes, no-route-wording regex, three sitemap pages, three Service schemas with the right URLs, hub offer catalog, FAQ mirrors, tool summary/stageNote, redirect entry, date bump. |
| `docs/runbook.md` | (Docs agent) | Retitle the "Scale-Up Advisory: two routes" entry for three pages, document the `?page=sme` redirect and the `next.config.ts` import constraint, and the renamed exports. |

No changes to: `app/globals.css` (every class needed exists), `SiteNav.tsx`, `icons/index.tsx`, `toolSlugs.ts`, `middleware.ts` (matcher stays `/admin/:path*`), footers on other pages (`/scale-up-advisory` links stay valid), `__tests__/gtm-toolkit.test.ts`, `package.json`.

---

## 2. Integration Points

### 2.1 `scale-up-content.ts` (the only place copy lives)

Rules unchanged: `import type { ToolSlug }` is the only import; no runtime imports, no `@/` at runtime, no enums/namespaces. Metadata (title/description/canonical) stays inline in each `page.tsx`, as every page in the repo does; that is not page copy.

**Remove** these exports (and every reference to them): `OUTSOURCED_ANCHOR_ID`, `FREE_TOOLS_ANCHOR_ID`, `TOOLS_POINTER`, `ROUTES`, `RouteId`, `ScaleUpRoute`, `scaleUpFaqSchema`. Nothing links to `#free-tools` once the hub's tools pointer goes, so no section id is kept on the outsourced page either.

**Rename / add** (grouped as the file is today):

- URLs and dates: add `OUTSOURCED_SALES_PATH = "/scale-up-advisory/outsourced-sales"` next to `FRACTIONAL_EXEC_PATH`. `DATE_MODIFIED` → `"2026-09-24"`. `LAST_REVIEWED_LABEL` stays `"September 2026"`.
- Top level: `HERO` unchanged. `type OptionId = "fractional-executive" | "outsource-sales"`. `interface ScaleUpOption { id: OptionId; title: string; body: string; href: string; cta: string }` (no `num`). `OPTIONS: readonly ScaleUpOption[]`, same two entries and copy as today's `ROUTES`, except entry 2 `href: OUTSOURCED_SALES_PATH`. Update the doc comment (no anchor talk).
- Hub-only copy, new:
  - `HUB_OPTIONS_LABEL = "Two ways in"` (today's hardcoded section label, moved into the module).
  - `HUB_TOOLS = { label, heading, body, cardTag, cardCta, hubLink } as const`. Structure: label "Free GTM tools"; heading is the user's message in Anthony's words, e.g. "We know AI. We've built free tools to help you."; `body` is one short paragraph, e.g. "Summit uses AI every day, in our own sales and in the engines we build for clients. Along the way we've built five free GTM tools that put some of that to work for you: score your ICP, validate the problem, pressure-test a persona, grade your positioning, rate your moat. No sign-up, no obligation. Try them before you talk to us."; `cardTag: "Free tool"`; `cardCta: "Try it free"`; `hubLink: "See all five tools"`. The Coder finalises the words; the test only requires the heading/body to mention "AI" and "free". No em-dashes, no invented numbers ("five" is real and already tested).
- Outsourced narrative: `SITUATION.label` → `"The situation"` (the page's h1 already says "Outsource your sales"). Everything else in `SITUATION`, `WHAT_SUMMIT_IS`, `THESIS`, `HOW_IT_WORKS`, `ROLES`, `HOW_WE_CHARGE*`, `PANEL`, `PACKAGES_SECTION`, `PACKAGE_STAGES`, `PACKAGE_COUNT`, `TOOLS_SECTION`, `LEAD_ENGINE`, `WHY_SUMMIT`, `SCALE_UP_CTA` unchanged.
- New `OUTSOURCED_HERO = { back: "Scale-Up Advisory", eyebrow: HERO.eyebrow, title: "Outsource your sales", lead } as const`. `lead` is a two-to-three sentence summary built only from existing claims, e.g. "Hand over as much or as little of sales as you need. Summit builds the engine on your intelligence, supplies the fractional people to run it, and charges a fixed price for each package. You own everything we build."
- `ToolStage`: replace `body` with `summary` (the tool sentence) and `stageNote` (the package tie-in), splitting today's two-sentence bodies at the full stop, verbatim. Example: problem → summary "Tests whether the problem you solve is real and urgent.", stageNote "It's the first question in any MAP package." The outsourced page renders `{summary} {stageNote}` (identical text to today); the hub renders `summary` only, because "MAP package" means nothing without the packages section.
- `OUTSOURCED_FAQS`, last answer: replace "That's Route 01, and it has its own page." with "That option has its own page." Nothing else in the FAQs changes.
- `FRACTIONAL_HERO.eyebrow` → `HERO.eyebrow` ("For B2B Scale-Ups"), shared by all three pages. Rationale: the eyebrow sits directly under the back link, so "Scale-Up Advisory" twice in a row would read as a mistake.
- Header comment and section comments: drop "Route 01/02"; list the three pages.
- JSON-LD:
  - `outsourcedServiceSchema`: today's `scaleUpServiceSchema` object unchanged except `url` = SITE_URL + OUTSOURCED_SALES_PATH (template literal). `outsourcedFaqSchema = faqPageSchema(OUTSOURCED_FAQS)`.
  - `scaleUpServiceSchema` (hub, new content): `@type` "Service", name "Scale-Up Advisory", serviceType "Fractional executive leadership and outsourced sales", `url` = SITE_URL + SCALE_UP_PATH, `dateModified: DATE_MODIFIED`, `provider`, `areaServed` = the union used today (`Canada, United States, United Kingdom, Europe, Australia`), a one-to-two sentence description of the practice, and `hasOfferCatalog: { "@type": "OfferCatalog", name: "Ways to work with Summit", itemListElement: OPTIONS.map(o => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: o.title, description: o.body, url: SITE_URL + o.href } })) }` (all as template literals). No prices, no availability.
  - `fractionalServiceSchema`, `fractionalFaqSchema` unchanged.

### 2.2 Hub: `app/scale-up-advisory/page.tsx` (server component)

Imports from the module: `HERO, HUB_OPTIONS_LABEL, HUB_TOOLS, LAST_REVIEWED_LABEL, OPTIONS, TOOLS_HUB_PATH, TOOL_STAGE_MAP, scaleUpServiceSchema`. Components: `SiteNav`, `ArrowRight`, `next/image`, `next/link`. Local style consts: `smallPara`, `inlineLink` only (no `bandHeading`; an unused const is a lint warning).

Render order, all inside the existing `.page > .inner` shell:

1. One `<script type="application/ld+json">` with `scaleUpServiceSchema`. No FAQPage script (the hub has no FAQ).
2. `<SiteNav />`.
3. Hero `.inner-hero`: `HERO.eyebrow`, `h1.inner-title` `HERO.title`, `.inner-lead` `HERO.lead`, the existing "Last reviewed: {LAST_REVIEWED_LABEL} · By Anthony Stevenson…" byline, unchanged.
4. Options `.inner-body`: `h2.section-label` `HUB_OPTIONS_LABEL`; `.for-grid` (2 columns, collapses at 900px); each option is `<Link key={o.id} href={o.href} className="card no-underline">` → `.card-body` → `.card-title` `o.title`, `p.card-desc` `o.body`, `.card-link` `{o.cta} <ArrowRight />`. No `resource-tag`, no `num`, no anchor branch, no `<a>`.
5. Tools `.inner-body`: `h2.section-label` `HUB_TOOLS.label`; `p.section-intro` with `<strong>{HUB_TOOLS.heading}</strong>` (`marginBottom: 16` like the outsourced tools section); `p.section-intro` `HUB_TOOLS.body`; `.resources` (`marginTop: 32`) of five `<Link key={t.slug} href={t.href} className="resource resource-tool no-underline">` → `span.resource-tag` `HUB_TOOLS.cardTag`, `.resource-title` `t.name`, `p.resource-desc` `t.summary`, `span.resource-cta` `{HUB_TOOLS.cardCta} →`; then `p` (`smallPara`) with `<Link href={TOOLS_HUB_PATH} style={inlineLink}>{HUB_TOOLS.hubLink} →</Link>`.
6. Footer, identical to today's.

Nothing else: no situation/thesis/packages/etc., no FAQ, no `.calendly-band`, no `id=` anchors, no `scroll-mt-*`.

Metadata (inline): TITLE "Scale-Up Advisory: Fractional Executives & Outsourced Sales | Summit"; DESCRIPTION ≤ 160 chars along the lines of "Summit builds, runs and leads the commercial function for B2B scale-ups. Hire a fractional CRO, CCO or CMO, or outsource your sales. Free AI GTM tools included."; canonical `https://summitstrategyadvisory.com/scale-up-advisory` (unchanged); OG/Twitter mirrored with `/opengraph-image`.

### 2.3 Outsourced page: `app/scale-up-advisory/outsourced-sales/page.tsx` (server component, new)

Imports from the module: `BOOK_URL, HOW_IT_WORKS, HOW_WE_CHARGE, HOW_WE_CHARGE_TITLE, LAST_REVIEWED_LABEL, LEAD_ENGINE, OUTSOURCED_FAQS, OUTSOURCED_HERO, PACKAGES_SECTION, PACKAGE_STAGES, PANEL, ROLES, SCALE_UP_CTA, SCALE_UP_PATH, SITUATION, THESIS, TOOLS_HUB_PATH, TOOLS_SECTION, TOOL_STAGE_MAP, WHAT_SUMMIT_IS, WHY_SUMMIT, outsourcedFaqSchema, outsourcedServiceSchema`. Components: `SiteNav`, `ArrowLeft`, `next/image`, `next/link`. Local style consts `smallPara`, `inlineLink`, `bandHeading` copied from today's hub (duplicated per page, as `smallPara`/`inlineLink` already are on the fractional page; accepted, see §4.8).

Render order:

1. Two JSON-LD scripts: `outsourcedServiceSchema`, `outsourcedFaqSchema`.
2. `<SiteNav />`.
3. Hero `.inner-hero`, same markup as the fractional page: `<Link href={SCALE_UP_PATH} className="inner-back no-underline"><ArrowLeft /> {OUTSOURCED_HERO.back}</Link>`, `.inner-eyebrow` `OUTSOURCED_HERO.eyebrow`, `h1.inner-title` `OUTSOURCED_HERO.title`, `.inner-lead` `OUTSOURCED_HERO.lead`, the "Last reviewed" byline.
4. Sections 3–11 of today's hub, moved verbatim in markup and order, with two edits: the `<div id={OUTSOURCED_ANCHOR_ID} className="scroll-mt-20">` wrapper is gone, and the tools section loses `id`/`scroll-mt-20`. That is: The situation (`SITUATION`, `.focus-grid` ×2) → What Summit is (`.features`) → Thesis (`.equity-band`, `bandHeading`) → How it works (`ROLES` `.features` + `HOW_WE_CHARGE` `.for-card.for-yes`) → The Panel (`.features` + `.pkg-meta` chips) → Packages (`.focus-grid` + closer) → See the engine at work (`TOOLS_SECTION` heading/paragraphs, `.resources` cards with tag `{t.stage} package`, desc `{t.summary} {t.stageNote}`, cta `{TOOLS_SECTION.cardCta} →`, then the `{TOOLS_SECTION.hubLink} →` line) → Where to start (`LEAD_ENGINE`, two `.for-card`s, `.cta-bar` with `BOOK_URL`) → Why Summit (`.features`).
5. FAQ `.inner-body` (`OUTSOURCED_FAQS` in `.features`, heading "Frequently Asked Questions" hardcoded as on every page).
6. CTA `.calendly-band` with `SCALE_UP_CTA` and `BOOK_URL`.
7. Footer, identical.

Metadata (inline): TITLE "Outsourced Sales for B2B Scale-Ups | Summit Scale-Up Advisory"; DESCRIPTION = today's hub description ("Summit builds, runs and leads your commercial function. Fractional sales people, an AI engine built on your intelligence, fixed-price packages. You own it all."); `CANONICAL = "https://summitstrategyadvisory.com/scale-up-advisory/outsourced-sales"` used for `alternates.canonical` and `openGraph.url`; Twitter `summary_large_image`; image `/opengraph-image`.

### 2.4 Fractional page: `app/scale-up-advisory/fractional-executive/page.tsx`

- Import list: replace `OUTSOURCED_ANCHOR_ID` with `OUTSOURCED_SALES_PATH`. `SCALE_UP_PATH` stays (back link).
- Cross-sell: `<Link href={OUTSOURCED_SALES_PATH} style={inlineLink}>{FRACTIONAL_CROSS_SELL.link}</Link>`.
- Eyebrow renders `FRACTIONAL_HERO.eyebrow` as today; the text change happens in the module. No other change.

### 2.5 Homepage: `app/page.tsx` (client SPA)

- `HomePage`: type the `cards` array as `{ id: string; icon: string; title: string; desc: string; href?: string }[]` and give the `sme` entry `href: "/scale-up-advisory"`. In the map, build the shared inner JSX (icon wrap + `.card-body`) once, then render `c.href ? <Link key={c.id} href={c.href} className="card no-underline">…</Link> : <button type="button" key={c.id} className="card" onClick={() => onNavigate(c.id)}>…</button>`. `ai` and `retail` have no `href`, so their markup and behaviour are byte-for-byte as today. `.card` already sets `display:flex`, `text-align:left`, `padding:0`, so the `<a>` lays out like the buttons; Tailwind's preflight makes links inherit colour, and `no-underline` matches the other card links in the repo.
- Crawler block: after the "Fractional Executives" link add `{" · "}<Link href="/scale-up-advisory/outsourced-sales" style={{ color: "rgba(255,255,255,0.35)" }}>Outsourced Sales</Link>` before "Free GTM Tools".
- Delete: the whole `practiceData` constant (its only reader was `PracticePage`; the `ai`/`retail` entries were already dead data because those views are `AIStudioPage`/`RetailAdvisoryPage`), the `PracticePage` component (including the `pageHref` block), and the `{page === "sme" && …}` line in `Summit`. Keep `ICON_SME` (card icon), `ArrowLeft` (other views), `Link` (footer, crawler block), the `useEffect` (unchanged), `nav`, `goToBooking`, and the contact `<select>` options.
- No client-side redirect code: `?page=sme` is handled in `next.config.ts` (§2.6). An unknown `?page=` value renders the empty SPA shell exactly as it does today for any unknown value; that pre-existing behaviour is out of scope.

### 2.6 `next.config.ts`

Add, alongside `rewrites()`:

- `redirects()` returning one entry: `source: "/"`, `has: [{ type: "query", key: "page", value: "sme" }]`, `destination: "/scale-up-advisory"`, `permanent: true` (308).
- Keep `import type { NextConfig }` as the file's only import. The redirect test loads this file with Node's type stripping (verified: it loads today), so a future runtime import here would need the test adjusted.

Behaviour: Next merges the incoming query into the destination for redirects (`prepare-destination.js`: "1. initial URL query values"), so `/?page=sme` lands on `/scale-up-advisory?page=sme`. The hub is static, ignores the query and declares the clean canonical, so this is cosmetic. Other `?page=` values are untouched because `has` matches `sme` exactly.

### 2.7 Sitemap

Insert `{ url: BASE + "/scale-up-advisory/outsourced-sales", lastModified: now, changeFrequency: "monthly", priority: 0.8 }` (as a template literal like its neighbours) directly after the fractional-executive line. Hub stays at 0.9.

### 2.8 Tests: `__tests__/scale-up-advisory.test.ts`

Same runner, same relative `.ts` imports. Update the header comment (hub + two option pages). Import list: drop `OUTSOURCED_ANCHOR_ID`, `ROUTES`, `scaleUpFaqSchema`; add `OPTIONS`, `OUTSOURCED_SALES_PATH`, `HUB_TOOLS`, `outsourcedServiceSchema`, `outsourcedFaqSchema`, `SCALE_UP_PATH`; add `import nextConfig from "../next.config.ts"`.

| Suite | Assertions |
|---|---|
| `sitemap` | includes `${BASE}/scale-up-advisory`, `…/fractional-executive`, `…/outsourced-sales`; no duplicate URLs. |
| `options` (replaces `routes`) | `OPTIONS.length === 2`; `[0].id === "fractional-executive"` and `href === FRACTIONAL_EXEC_PATH === "/scale-up-advisory/fractional-executive"`; `[1].id === "outsource-sales"` and `href === OUTSOURCED_SALES_PATH === "/scale-up-advisory/outsourced-sales"`; every `href` starts with `"/scale-up-advisory/"` and contains no `#`. |
| `hub tools copy` (new) | `${HUB_TOOLS.heading} ${HUB_TOOLS.body}` matches `/\bAI\b/` and `/\bfree\b/i`. |
| `tool-to-stage map` | existing five tests unchanged, plus: every entry has non-empty `summary` and `stageNote`, and `stageNote` includes `t.stage` (each note names its stage). |
| `packages` | unchanged. |
| `service schemas` | loop over `[["scale-up", scaleUpServiceSchema], ["outsourced", outsourcedServiceSchema], ["fractional", fractionalServiceSchema]]`: `@context`, `@type === "Service"`, `dateModified === "2026-09-24"` (literal, bumped), absolute Summit URL, `serviceType !== "Management Consulting"`. URLs: scale-up → `${BASE}/scale-up-advisory`, outsourced → `${BASE}/scale-up-advisory/outsourced-sales`, fractional → `${BASE}/scale-up-advisory/fractional-executive`. Hub catalog: `scaleUpServiceSchema.hasOfferCatalog.itemListElement` has 2 items whose `itemOffered.url` equal `${BASE}${OPTIONS[i].href}` and `itemOffered.name` equal `OPTIONS[i].title`. |
| `FAQ schemas` | cases `["outsourced", outsourcedFaqSchema, OUTSOURCED_FAQS]`, `["fractional", fractionalFaqSchema, FRACTIONAL_FAQS]`; body unchanged. |
| `homepage deep link` (new) | `const redirects = await nextConfig.redirects()`; find the entry with `source === "/"` and a `has` item `{ type: "query", key: "page", value: "sme" }`; assert it exists, `destination === "/scale-up-advisory"`, `permanent === true`. |
| `copy hygiene` | existing typo list and em-dash cap (≤ 3; today 0) unchanged; add `assert.doesNotMatch(JSON.stringify(content), /\broutes?\b/i)`. Because the namespace's export names are keys in that string, this also fails on any export called `ROUTES`. |

Verified today: `JSON.stringify(content)` currently has five route hits (`FRACTIONAL_HERO.eyebrow`, the FAQ answer, the `ROUTES` key, `SITUATION.label`, and the FAQ answer again via the FAQ schema). The changes in §2.1 clear all five.

---

## 3. Data Flow

- **Build time.** The content module's constants are read by the three server pages; JSX maps them onto existing `globals.css` classes; JSON-LD objects are `JSON.stringify`'d into `<script>` tags; inline `metadata` exports feed `<head>`. All three routes prerender statically (no params, no fetching). `next build` also validates the new `redirects()` entry and the sitemap.
- **Navigation.** Homepage card → `/scale-up-advisory` (hard link). Hub card 1 → `/scale-up-advisory/fractional-executive`; card 2 → `/scale-up-advisory/outsourced-sales`. Both option pages → back link → hub. Fractional cross-sell → outsourced page. Hub tool cards and both tools sections → `/tools/<slug>` and `/tools`. `/?page=sme` → 308 → `/scale-up-advisory?page=sme`.
- **Error paths.** No runtime inputs, so failures are build/test time: a bad tool slug fails `tsc` (typed `ToolSlug`) and the tool-map test; a hidden tool fails the test; a sitemap omission, a wrong schema URL, a stray "route", a reintroduced `#` href, or a removed redirect each fail `npm test`. A tool card whose slug is hidden would 404 in production, which the `isToolPublic` test prevents. External links to `/scale-up-advisory#outsource-your-sales` land on the hub (fragments never reach the server), where the "Outsource your sales" card is one click away.

---

## 4. Key Decisions

1. **Outsourced sales gets its own route instead of an anchor.** Alternative: keep the narrative on the hub under the anchor. Rejected: the user wants a slim top page with "just the two links to the options", and two peer pages give each offer its own canonical, title and FAQ schema.
2. **Naming: `ROUTES` → `OPTIONS`, `RouteId` → `OptionId`, `ScaleUpRoute` → `ScaleUpOption`; `num` dropped.** The test stringifies the module namespace, so an export named `ROUTES` would fail the no-route-wording check even with clean copy. `num` has no consumer once the "Route 01/02" tags go; keeping dead fields invites them back.
3. **Anchor constants removed rather than kept.** `OUTSOURCED_ANCHOR_ID` and `FREE_TOOLS_ANCHOR_ID` have no consumers after the split (the hub's "more on how they fit below" pointer is replaced by the hub tools section). Alternative considered: keep `id="free-tools"` on the outsourced page as a deep-link affordance. Rejected: nothing links to it, and an id without a link drifts.
4. **`ToolStage.body` split into `summary` + `stageNote`.** The hub cannot show "It's the first question in any MAP package." with no packages context, and the constraint forbids rewriting the outsourced copy. Splitting at the existing full stop keeps the outsourced text identical and gives the hub a self-contained one-liner. Alternative: render `TOOL_SEO[slug].description` on the hub. Rejected: copy would leave the content module (criterion 7) and those strings carry em-dashes.
5. **Hub JSON-LD is an umbrella `Service` with an `OfferCatalog` of the two options; the outsourced `Service` and the FAQPage move to the outsourced page under new names.** Structured data must describe the page it sits on; the hub no longer carries the outsourced narrative or FAQs. Explicit names (`scaleUpServiceSchema`, `outsourcedServiceSchema`, `outsourcedFaqSchema`, `fractionalServiceSchema`, `fractionalFaqSchema`) let the tests pin each URL.
6. **`/?page=sme` handled by a `next.config.ts` redirect, not in the SPA effect.** Alternative: `window.location.replace("/scale-up-advisory")` inside the existing `useEffect`. Rejected: it flashes the homepage for a few hundred ms, needs JS, sends no 308, and cannot be unit-tested (client component). The config redirect is server-side, cached by browsers, honoured by `next dev` and Vercel, and testable by importing `next.config.ts` under Node (verified). Cost: the query is carried (`/scale-up-advisory?page=sme`), which is cosmetic, and `next.config.ts` must keep only type imports for the test to load it. No client fallback: two mechanisms for one dead link is clutter.
7. **Homepage card becomes a `Link`; `PracticePage` and all of `practiceData` are deleted.** Alternative: give `practiceData` entries an `href` and keep `PracticePage`. Rejected: `PracticePage` was only ever rendered for `sme`, and the `ai`/`retail` entries in `practiceData` were never read (their views are bespoke components), so keeping the constant would only produce an unused-variable lint warning. The other two cards keep their `<button>` + `onNavigate` path untouched.
8. **Style constants duplicated per page.** `smallPara`, `inlineLink`, `bandHeading` are copied into the outsourced page, as the fractional page already copies two of them. Alternative: a shared `app/scale-up-advisory/styles.ts`. Rejected as a new file for three tiny objects in a restructure; the content module stays copy-only. Note for a later tidy-up.
9. **Eyebrows.** All three pages use `HERO.eyebrow` ("For B2B Scale-Ups"). The literal reading of criterion 4 ("drops Route 01") would give "Scale-Up Advisory", but that duplicates the back link directly above it on both option pages. Same for `SITUATION.label` → "The situation" instead of repeating the h1.
10. **Hub tool cards show a constant tag ("Free tool"), not the stage.** "MAP package" is meaningless on the hub; dropping the tag entirely would make these the only `.resource` cards in the site without one.
11. **`DATE_MODIFIED` bumps to 2026-09-24; `LAST_REVIEWED_LABEL` stays "September 2026".** Material copy change (new hub, new page, reworded labels). The test pins the literal, so it is updated in the same commit, per the runbook rule.
12. **Metadata stays inline in page files.** Consistent with every page in the repo and with the previous design; criterion 7 concerns page copy.

---

## 5. Constraints Honoured

| Constraint | How |
|---|---|
| No new dependencies | None. `node:test`, `next/link`, existing icons only. `package.json` untouched. |
| No new CSS files; reuse `globals.css` classes | Hub: `inner-hero/eyebrow/title/lead`, `inner-body`, `section-label`, `section-intro`, `for-grid`, `card/card-body/card-title/card-desc/card-link`, `resources`, `resource resource-tool`, `resource-tag/title/desc/cta`, `footer*`. Outsourced page: exactly the classes today's hub uses plus `inner-back`. Tailwind only where the codebase already uses it (`no-underline`, `italic`). No `scroll-mt-*` needed anywhere any more. |
| `scale-up-content.ts` is `import type` only | Unchanged; verified loadable under Node today. New exports are plain objects/strings. |
| Anthony's plain British English, no em-dashes, no invented numbers | New strings: hub tools label/heading/body/tag, `OUTSOURCED_HERO`, reworded `SITUATION.label`, FAQ sentence, hub schema description, page metadata. All claims restate existing copy; "five" tools is tested. Em-dash cap ≤ 3 stays (today 0). |
| No substantive change to outsourced / fractional copy | Outsourced sections move verbatim; the only text edits are the section label, one FAQ sentence and the eyebrow. Tool bodies are split, not rewritten. |
| Secrets via env vars | N/A, static pages. |
| Quality gates | `npm test` (updated suite), `npm run lint` (no unused imports/consts; `Link` for internal hrefs), `npx tsc --noEmit` (renamed exports resolve; `ScaleUpOption` has no `num`), `npm run build` (three static routes, valid `redirects()`). |

---

## 6. Out of Scope

- `docs/runbook.md` wording (Docs agent), beyond the pointers in §1.
- A cross-sell line on the outsourced page pointing back at the fractional page; the FAQ mentions the option and the hero back link reaches the hub. Optional follow-up.
- `BreadcrumbList` JSON-LD on the option pages, a scale-up-specific OG image, and changes to `layout.tsx` site descriptions.
- Making unknown `?page=` values on the homepage do anything other than today's empty shell.
- Unifying the duplicated `BOOK_URL` (SiteNav/homepage) or extracting shared style constants (§4.8).
- The stale `docs/reviews`/`docs/designs` files from the previous task, and the "Route" wording in those historical documents.
- Any change to the tools hub (`/tools`), `toolSlugs.ts`, or the contact form `<select>`.

---

## Risks and edge cases for the Reviewer

- **SEO.** The outsourced content's canonical moves from `/scale-up-advisory` to `/scale-up-advisory/outsourced-sales`, and the hub loses most of its text, so rankings for outsourced-sales queries transfer to the new URL over time (helped by the hub card, sitemap, crawler block and the fractional cross-sell). No server redirect is possible for `#outsource-your-sales` links: they land on the hub, which shows the outsourced card. The hub's title, description and Service schema change from "Outsourced Sales…" to the umbrella practice.
- **Route wording regex.** `/\broutes?\b/i` on the stringified namespace also catches export names and the FAQ schema mirror. Grep the three page files too: JSX comments and the section label are not in the module, but criterion 2 covers user-visible copy, and the `Route {r.num}` tag must go with the `num` field.
- **`next.config.ts` loadability.** The redirect test imports it under Node type stripping; keep it to `import type` and plain objects.
- **Redirect landing URL** carries `?page=sme` (cosmetic, see §2.6). If the human objects, the fallback is decision 6's rejected alternative.
- **Unused imports/consts** after the split (e.g. `bandHeading` on the hub, `SCALE_UP_PATH` on the hub) are lint warnings, not errors, but keep them out.
- **Both `.card` and `.resource-tool` on `<Link>`** need `no-underline`; the hub already does this today.
- **Hub tools grid** is 2 columns with five cards, so one orphan card in the last row, exactly as on the outsourced page today.
