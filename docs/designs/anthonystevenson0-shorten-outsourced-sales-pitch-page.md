# Design Document: Shorten the outsourced sales page to a pitch summary

Branch: `anthonystevenson0/shorten-outsourced-sales-pitch-page`
Date: 2026-09-28
Builds on: `docs/designs/anthonystevenson0-scale-up-hub-page-separate-option-pages.md` (same content module, same CSS decisions; this task only slims the outsourced page and the constants that feed it).
Recovery point for the cut copy: `main` at `0912fd5` (`app/scale-up-advisory/outsourced-sales/page.tsx` and `app/scale-up-advisory/scale-up-content.ts`), plus the deck `Decks/Summit Growth for B2B Scale-ups.pptx` (untracked, local only).

Summary of the change: `/scale-up-advisory/outsourced-sales` stops reproducing the deck (twelve sections, about 1,600 visible words) and becomes a pitch summary in the shape of the fractional executive page: hero, one paragraph on what Summit is, the thesis band with a closing line, how we charge, where to start (the AI Lead Engine Build) with a one-line pointer to the free tools, a four-question FAQ, the CTA band, footer. The content module loses the constants nothing renders any more. Hub, fractional page, homepage, sitemap and config are untouched.

---

## 1. Files to Modify / Create

| File | Action | What changes and why |
|---|---|---|
| `app/scale-up-advisory/scale-up-content.ts` | Modify | `WHAT_SUMMIT_IS` becomes `{ label, body }`; `THESIS` gains `closer`; new `OUTSOURCED_TOOLS_LINE`; `LEAD_ENGINE` loses `walkAwayTitle`/`walkAway`; `OUTSOURCED_FAQS` trimmed to four; `SITUATION`, `HOW_IT_WORKS`, `ROLES`, `PANEL`, `PACKAGES_SECTION`, `TOOLS_SECTION`, `WHY_SUMMIT` deleted; `DATE_MODIFIED` bumped; comments that describe the old page corrected. Still `import type` only. |
| `app/scale-up-advisory/outsourced-sales/page.tsx` | Modify | Body rewritten from twelve sections to eight blocks (§2.2); import list trimmed to what renders; one new style const `bandPara`; JSDoc rewritten. Metadata block unchanged. |
| `__tests__/scale-up-advisory.test.ts` | Modify | Walk-away test removed; new pitch-page suite (FAQ order, thesis points, facts, removed constants, tools line); `WHAT_SUMMIT_IS.body` pinned to `PACKAGE_COUNT` and the stage span; `dateModified` literal bumped (§2.4). |
| `docs/designs/anthonystevenson0-shorten-outsourced-sales-pitch-page.md` | Create | This document. |
| `docs/runbook.md` | Modify (Docs agent) | The two Scale-Up entries describe the outsourced page as the full deck narrative; they need the pitch structure, the new date and the constants that moved or went (§2.5). |

No changes to: `app/scale-up-advisory/page.tsx` (hub), `app/scale-up-advisory/fractional-executive/page.tsx`, `app/page.tsx`, `app/sitemap.ts`, `next.config.ts`, `app/globals.css`, `app/components/SiteNav.tsx`, `app/components/icons/index.tsx`, `app/tools/[tool]/toolSlugs.ts`, `package.json`, `__tests__/gtm-toolkit.test.ts`. `git diff --stat` must list only the three source files above plus the two docs.

Verified: the content module is imported by exactly four files (the three pages and the test). Of the exports being deleted, only the outsourced page imports any of them, so nothing else breaks and `tsc` is the safety net for a missed reference.

---

## 2. Integration Points

### 2.1 Content module: `app/scale-up-advisory/scale-up-content.ts`

Rules unchanged: `import type { ToolSlug }` is the only import; no runtime imports, no enums, no `@/` at runtime. Metadata stays inline in the page.

**Deleted exports** (with their section comments): `SITUATION`, `HOW_IT_WORKS`, `ROLES`, `PANEL`, `PACKAGES_SECTION`, `TOOLS_SECTION`, `WHY_SUMMIT`. The whole `// ── Why Summit ──` section goes; its one surviving sentence moves into `THESIS.closer` (below).

**Deleted fields:** `LEAD_ENGINE.walkAwayTitle`, `LEAD_ENGINE.walkAway`.

**Kept verbatim:** `SITE_URL`, the four path constants, `BOOK_URL`, `LAST_REVIEWED_LABEL` ("September 2026"), `HERO`, `OptionId`, `ScaleUpOption`, `OPTIONS`, `HUB_OPTIONS_LABEL`, `HUB_TOOLS` (copy), `OUTSOURCED_HERO`, `THESIS.label`/`heading`/`points`, `HOW_WE_CHARGE_TITLE`, `HOW_WE_CHARGE`, `PackageStageId`, `PACKAGE_STAGES`, `PACKAGE_COUNT`, `ToolStage` (all fields, see §4.4), `TOOL_STAGE_MAP`, `LEAD_ENGINE.label`/`strap`/`name`/`summary`/`factsTitle`/`facts`/`ctaTitle`/`ctaBody`/`ctaButton`, `SCALE_UP_CTA`, `Faq`, every `FRACTIONAL_*` export, `provider`, `faqPageSchema`, `scaleUpServiceSchema`, `outsourcedServiceSchema`, `outsourcedFaqSchema`, `fractionalServiceSchema`, `fractionalFaqSchema`.

**Changed or added, in file order:**

1. `DATE_MODIFIED = "2026-09-28"`.
2. `WHAT_SUMMIT_IS` keeps its export name and position but its shape becomes exactly two fields:
   - `label: "What Summit is"`
   - `body: "The convenience of outsourcing. The ownership of insourcing. Nineteen fixed-price packages cover the whole sales process, from MAP to GROW, taken up piece by piece as you grow. Each one is two things: an engine built on your intelligence, and the fractional people to run it."`
   - `as const`. Doc comment: the paragraph spells out `PACKAGE_COUNT` ("Nineteen") and spans `PACKAGE_STAGES` first to last ("from MAP to GROW"); the test checks both, so change them together.
3. `THESIS` gains a fourth field after `points`: `closer: "Summit runs on the same engine. If we end up on a call, it probably booked it."` Nothing else in `THESIS` changes.
4. `PACKAGE_COUNT` doc comment: "Source of truth for the package count. WHAT_SUMMIT_IS.body spells it out ("Nineteen")."
5. `ToolStage` doc comments (fields unchanged): `summary`: "What the tool does, in one sentence. The hub cards show this." `stageNote`: "How it ties to the package stage. No page renders it since the outsourced page became a pitch summary (September 2026); kept with `stage` as the documented tool-to-stage map, and the test still requires it to name `stage`."
6. `HUB_TOOLS` doc comment: the cards carry the constant `cardTag` rather than "{stage} package" because no page explains the package stages any more (the outsourced page only says "from MAP to GROW").
7. `LEAD_ENGINE`: delete `walkAwayTitle` and `walkAway`; the remaining nine fields and their order stay as they are.
8. New export directly after `LEAD_ENGINE`, inside the "Where to start" section:
   `OUTSOURCED_TOOLS_LINE = { lead: "Not ready to talk? Start with our", link: "free GTM tools" } as const`.
   Doc comment: rendered by the outsourced page as `{lead} <Link to TOOLS_HUB_PATH>{link}</Link>.`, the full stop supplied by the page, the same pattern as `FRACTIONAL_CROSS_SELL.toolsLead`/`toolsLink`.
9. `OUTSOURCED_FAQS`: exactly four entries, question and answer text verbatim from today's array, in this order: today's [0] "What is an outsourced sales team?", [1] "Is it cheaper than hiring an SDR?", [3] "Who owns what Summit builds?", [6] "How is this different from a lead-gen agency?". Deleted: [2] "What's in the AI Lead Engine Build?", [4] "What happens after the eight weeks?", [5] "How do the free GTM tools relate to working with Summit?", [7] "Can I hire a fractional executive instead?".
10. Comments: header line 6 becomes "(outsource your sales: pitch summary)"; the section comment "── Outsource your sales: page narrative (follows the deck) ──" becomes "── Outsource your sales: pitch summary (the deck narrative is on main at 0912fd5) ──"; "── Free tools, joined to the message ──" becomes "── Free tools (hub cards) ──". The `outsourcedServiceSchema` comment ("with the six package stages as its offer catalog") stays true and stays.

Resulting export order for the outsourced page's constants: `OUTSOURCED_HERO`, `WHAT_SUMMIT_IS`, `THESIS`, `HOW_WE_CHARGE_TITLE`, `HOW_WE_CHARGE`, `PackageStageId`, `PACKAGE_STAGES`, `PACKAGE_COUNT`, `ToolStage`, `TOOL_STAGE_MAP`, `LEAD_ENGINE`, `OUTSOURCED_TOOLS_LINE`, `SCALE_UP_CTA`, `Faq`, `OUTSOURCED_FAQS`, then the fractional copy and the JSON-LD block unchanged.

### 2.2 Page: `app/scale-up-advisory/outsourced-sales/page.tsx` (server component)

**Imports from the module (15):** `BOOK_URL`, `HOW_WE_CHARGE`, `HOW_WE_CHARGE_TITLE`, `LAST_REVIEWED_LABEL`, `LEAD_ENGINE`, `OUTSOURCED_FAQS`, `OUTSOURCED_HERO`, `OUTSOURCED_TOOLS_LINE`, `SCALE_UP_CTA`, `SCALE_UP_PATH`, `THESIS`, `TOOLS_HUB_PATH`, `WHAT_SUMMIT_IS`, `outsourcedFaqSchema`, `outsourcedServiceSchema`. Removed from the import list: `HOW_IT_WORKS`, `PACKAGES_SECTION`, `PACKAGE_STAGES`, `PANEL`, `ROLES`, `SITUATION`, `TOOLS_SECTION`, `TOOL_STAGE_MAP`, `WHY_SUMMIT`. Components unchanged: `SiteNav`, `ArrowLeft` (back link), `Image` (footer), `Link` (back link, byline, tools line, footer). Every import is used, so ESLint's `no-unused-vars` (a warning in this repo) stays silent.

**Metadata:** `TITLE`, `DESCRIPTION`, `CANONICAL` and the `metadata` export are unchanged. Every claim in `DESCRIPTION` (fractional sales people, an engine built on your intelligence, fixed-price packages, you own it all) is still on the page.

**Style consts:** `smallPara`, `inlineLink`, `bandHeading` unchanged. Add one:
`bandPara = { color: "rgba(255,255,255,0.6)", fontSize: 16, lineHeight: 1.7, maxWidth: 620, marginTop: 24 } as const`
(the fractional band's paragraph style, with a top margin because here the line follows the cards instead of preceding them).

**JSDoc** (replaces the current one): the outsourced sales option as a pitch summary in the shape of the fractional page: hero, what Summit is, thesis, how we charge, where to start with a pointer to the free tools, four FAQs, CTA. The deck narrative that used to be here is on `main` at `0912fd5` and in the deck. The page carries its own metadata, canonical and JSON-LD.

**Render order.** Everything below sits inside the existing `.page > .inner` shell, after the two JSON-LD scripts and `<SiteNav />`, exactly as today. Comment numbering becomes 1 to 8.

1. **Hero** `.inner-hero`: byte-for-byte unchanged (back link with `ArrowLeft` to `SCALE_UP_PATH`, eyebrow, `h1.inner-title`, `.inner-lead`, the "Last reviewed" byline).
2. **What Summit is** `.inner-body`: `h2.section-label` = `WHAT_SUMMIT_IS.label`; `p.section-intro` = `WHAT_SUMMIT_IS.body`. Plain text, no `<strong>`, no inline style. (`.section-intro` keeps its 36px bottom margin; with the body's 64px padding that is a 100px gap before the dark band, in line with the fractional page's 112px.)
3. **Thesis** `.equity-band`: the existing markup unchanged (band, `inner-body` with zero vertical padding, `h2.section-label` in sage = `THESIS.label`, `p` with `bandHeading` = `THESIS.heading`, `.equity-cards` mapping `THESIS.points` with the `01`..`04` numbers), then one new element after the closing `</div>` of `.equity-cards`: `<p style={bandPara}>{THESIS.closer}</p>`.
4. **How we charge** `.inner-body`: `h2.section-label` = `HOW_WE_CHARGE_TITLE`; then the existing `div.for-card.for-yes` mapping `HOW_WE_CHARGE` to `div.for-item` (`span.for-check` "✓" + `span` item), **without** its `div.for-card-title` (the h2 says it; see §4.5). The card sits directly in the `inner-body`, as it did at the end of "How it works", so the full-width look is already proven.
5. **Where to start** `.inner-body`: `h2.section-label` = `LEAD_ENGINE.label`; `p.section-intro` = `LEAD_ENGINE.strap`; `h3.feature-title` (`fontSize: 24`) = `LEAD_ENGINE.name`; `p.section-intro` = `LEAD_ENGINE.summary`; then the facts card rendered directly, no `.for-grid`: `div.for-card.for-yes` with `style={{ marginBottom: 16 }}`, `div.for-card-title` = `LEAD_ENGINE.factsTitle`, five `div.for-item` from `LEAD_ENGINE.facts`; then the `.cta-bar` unchanged (`cta-bar-left` h3 `ctaTitle`, p `ctaBody`, `a.cta-bar-btn` to `BOOK_URL` with `target="_blank" rel="noopener noreferrer"` and `{ctaButton} →`); then, as the section's last child, the **tools line**: `<p style={smallPara}>{OUTSOURCED_TOOLS_LINE.lead}{" "}<Link href={TOOLS_HUB_PATH} style={inlineLink}>{OUTSOURCED_TOOLS_LINE.link}</Link>.</p>`. The walk-away card is gone.
6. **FAQ** `.inner-body`: markup unchanged (hardcoded "Frequently Asked Questions" `h2.section-label`, `.features` of `.feature` cards from `OUTSOURCED_FAQS`); it now renders four cards.
7. **CTA** `.calendly-band` with `SCALE_UP_CTA` and `BOOK_URL`: unchanged.
8. **Footer**: unchanged.

Heading outline after the change: h1 (hero) → h2 What Summit is → h2 Summit's thesis → h2 How we charge → h2 Where to start (h3 The AI Lead Engine Build) → h2 Frequently Asked Questions → h2 Start a conversation.

### 2.3 Hub and fractional pages

Untouched. The hub keeps importing `HERO`, `HUB_OPTIONS_LABEL`, `HUB_TOOLS`, `LAST_REVIEWED_LABEL`, `OPTIONS`, `TOOLS_HUB_PATH`, `TOOL_STAGE_MAP`, `scaleUpServiceSchema`; the fractional page keeps its `FRACTIONAL_*`, `BOOK_URL`, `LAST_REVIEWED_LABEL`, `OUTSOURCED_SALES_PATH`, `SCALE_UP_PATH`, `TOOLS_HUB_PATH` and its two schemas. None of those exports change shape.

### 2.4 Tests: `__tests__/scale-up-advisory.test.ts`

Same runner, same relative `.ts` imports. Header comment: add that the outsourced page is a pitch summary. Named imports: add `THESIS`, `WHAT_SUMMIT_IS`, `OUTSOURCED_TOOLS_LINE`; keep `LEAD_ENGINE` (still used).

| Suite | Change |
|---|---|
| `sitemap`, `options`, `hub tools copy`, `homepage deep link` | Unchanged. |
| `tool-to-stage map` | Unchanged, including "every stage is a real package stage" and "every tool has a summary and a stage note that names its stage" (decision §4.4). |
| `packages` | Remove "the Lead Engine Build has six walk-away items". Keep the stage-order and nineteen tests. Add "the What Summit is paragraph spells out the package count and the stage span": `assert.match(WHAT_SUMMIT_IS.body, /\bNineteen fixed-price packages\b/)` and `assert.ok(WHAT_SUMMIT_IS.body.includes("from " + PACKAGE_STAGES[0].id + " to " + PACKAGE_STAGES[PACKAGE_STAGES.length - 1].id))`. |
| `outsourced pitch page` (new) | (a) "the thesis has four points and a closing line": `assert.equal(THESIS.points.length, 4)`; `assert.ok(THESIS.closer.length > 0)`. (b) "the Lead Engine Build has five facts and no walk-away list": `assert.equal(LEAD_ENGINE.facts.length, 5)`; `assert.ok(!("walkAway" in LEAD_ENGINE))`. (c) "the FAQ is exactly the four pitch questions in order": `assert.deepEqual(OUTSOURCED_FAQS.map((f) => f.q), ["What is an outsourced sales team?", "Is it cheaper than hiring an SDR?", "Who owns what Summit builds?", "How is this different from a lead-gen agency?"])`. (d) "the tools line points at the free GTM tools": `assert.ok(OUTSOURCED_TOOLS_LINE.lead.length > 0)`; `assert.equal(OUTSOURCED_TOOLS_LINE.link, "free GTM tools")`. (e) "the cut sections' constants are gone from the module": for each of `SITUATION`, `HOW_IT_WORKS`, `ROLES`, `PANEL`, `PACKAGES_SECTION`, `TOOLS_SECTION`, `WHY_SUMMIT`: `assert.ok(!(name in content), name)` (uses the existing `import * as content`). |
| `service schemas` | The dated test's literal becomes `"2026-09-28"` for all three schemas (they all read `DATE_MODIFIED`). |
| `FAQ schemas` | Unchanged; the outsourced case now mirrors four questions. |
| `copy hygiene` | Unchanged: typo list, em-dash cap (≤ 3; the module has 0 today and the new copy adds none), no-route regex (the new copy contains no "route"). |

### 2.5 Runbook notes for the Docs agent (`docs/runbook.md`)

- Entry "Scale-Up Advisory: three pages": the `/scale-up-advisory/outsourced-sales` bullet now lists the pitch structure (hero, what Summit is, thesis with closing line, how we charge, where to start with the tools line, four FAQs, CTA); the Template/Config line's `DATE_MODIFIED (2026-09-24)` becomes `2026-09-28`; the exports-by-page list for the outsourced page becomes `OUTSOURCED_HERO`, `WHAT_SUMMIT_IS`, `THESIS`, `HOW_WE_CHARGE*`, `LEAD_ENGINE`, `OUTSOURCED_TOOLS_LINE`, `SCALE_UP_CTA`, `OUTSOURCED_FAQS` and the two schemas.
- "Editing the copy": the `DATE_MODIFIED` bullet's "currently `2026-09-24`" becomes `2026-09-28`; the `PACKAGE_COUNT` bullet's "`PACKAGES_SECTION.closer` spells it out" becomes "`WHAT_SUMMIT_IS.body` spells it out ("Nineteen") and names the first and last stage"; add that the four outsourced FAQ questions and their order are pinned by the test.
- "Tool-to-stage map": "the outsourced page shows both sentences under a '{stage} package' tag" is no longer true; `stage`/`stageNote` are kept as documentation only.
- Entry "hub + separate option pages", Known limitations: "no cross-sell back to the fractional page beyond its FAQ" becomes "no cross-sell back to the fractional page at all (the FAQ that pointed there was cut in the pitch-summary change); the back link to the hub is the way across".
- New entry for this change following the runbook's pattern (Trigger, Service/Function, Failure mode, Template/Config, To disable, Caution, Known limitations), naming `0912fd5` as where the full narrative lives.

---

## 3. Data Flow

- **Build time.** The page reads fifteen constants from the module and maps them onto existing `globals.css` classes; `outsourcedServiceSchema` and `outsourcedFaqSchema` (built from the trimmed `OUTSOURCED_FAQS` by the unchanged `faqPageSchema`) are `JSON.stringify`'d into the two `<script type="application/ld+json">` tags; the inline `metadata` export feeds `<head>`. The route stays static (no params, no fetching).
- **Navigation.** Back link → `/scale-up-advisory`. Lead Engine `cta-bar` and the CTA band → `BOOK_URL` (new tab). Tools line → `/tools` (`TOOLS_HUB_PATH`). Footer links unchanged. The page no longer links to the five tool pages or to the fractional page (see §7).
- **Error paths.** No runtime inputs, so failures are build or test time: a leftover reference to a deleted export fails `tsc` and `next build`; a FAQ reorder, a fifth question, a changed date, a reintroduced `walkAway`, a paragraph that stops saying "Nineteen" or "from MAP to GROW", an em-dash over the cap, or a deleted constant creeping back each fail `npm test`. The FAQPage schema cannot drift from the visible FAQ because both come from the same array.

### Expected visible word count (for the orchestrator's browser check)

Method: the page's visible text from nav to footer exclusive, split on whitespace, every token counted (so "✓", "→" and "·" count). Applied to today's page this method gives 1,141 before the FAQ and 1,613 in total against the measured 1,156 / 1,628, so the browser runs about 15 tokens higher than the estimate; expect the same offset below.

| Block | Tokens |
|---|---|
| Hero (back link, eyebrow, title, lead, byline) | 60 |
| What Summit is | 49 |
| Thesis (label, heading, four cards, closing line) | 134 |
| How we charge (label + four bullets, 4 "✓") | 36 |
| Where to start (label, strap, name, summary, facts card with 5 "✓", CTA bar with "→") | 78 |
| Tools line | 10 |
| **Before the FAQ** | **367** (307 excluding the hero) |
| FAQ (heading + four Q&As) | 214 |
| CTA band | 26 |
| **Total** | **607** (547 excluding the hero) |

So in the browser expect roughly 380 before the FAQ and 620 in total counting the hero, or roughly 320 / 560 if the hero is excluded; excluding the hero the figures match the brief's "about 300 / about 550". The fractional page measures 296 / 669 by the same method, so the new page is a little fuller before the FAQ and a little shorter overall: the same shape and length. The cut FAQs removed 201 words; the four kept answers are 54, 61, 29 and 41 words.

---

## 4. Key Decisions

**4.1 `WHAT_SUMMIT_IS` keeps its name, changes shape to `{ label, body }`.** Alternatives: a new export (`WHAT_SUMMIT_IS_SUMMARY`) leaving the old one to delete; keeping `heading`/`intro` and rendering the first two sentences in bold as today. Rationale: the plan gives one paragraph as final copy, so one string is the honest shape; the page already imports this name; a bold split would need the copy cut into two fields and was not asked for. The paragraph is a literal, not built from `PACKAGE_COUNT` at runtime: the copy is verbatim and the test ties the two together.

**4.2 The kept Why Summit line becomes `THESIS.closer`.** Alternatives: keep `WHY_SUMMIT` with one point (a section of one card, and the label "Why Summit" would then be a heading over one sentence); a standalone `THESIS_CLOSER` export. Rationale: the line closes the thesis ("runs on the same engine") and renders inside the band, so it belongs to the band's object; one import, one object, no orphan section.

**4.3 `OUTSOURCED_TOOLS_LINE = { lead, link }`.** Mirrors `FRACTIONAL_CROSS_SELL.toolsLead`/`toolsLink`, so both option pages render the tools pointer the same way (`smallPara`, `inlineLink`, full stop supplied by the page). The old name `TOOLS_POINTER` was deleted last task and appears in the runbook history with a different meaning, so it is not reused. No `href` field: the page uses `TOOLS_HUB_PATH`, as the fractional page does.

**4.4 `ToolStage.stage` and `stageNote` stay (option a).** Alternative (b): drop both fields, the `PackageStageId` dependency in `ToolStage`, and the two tests that check them. Rationale for (a): the hub still renders `TOOL_STAGE_MAP` and `PackageStageId` stays in use by `PACKAGE_STAGES` anyway; the stage mapping is real product knowledge (which package each free tool demonstrates) that the cut FAQ used to state and that the runbook documents; the tests keep it honest at zero cost; and (b) is a one-line change later if a tools section never returns. Only the doc comments change, so they stop claiming the outsourced page renders `stageNote`.

**4.5 How we charge: `h2.section-label` outside, no title inside the card.** Alternative: keep the card exactly as today (with `for-card-title`) and no section label. Rationale: every other block on this page and on the fractional page opens with an `h2.section-label`, so this one gets a heading in the document outline; saying "How we charge" twice, ten pixels apart, would look like a mistake. The card's four bullets and their markup are unchanged, and `HOW_WE_CHARGE_TITLE` stays in use as the label. The hub already renders a `section-label` directly followed by cards, so the spacing is a known look.

**4.6 The facts card renders directly, `marginBottom: 16`, no `.for-grid`.** Alternative: keep `.for-grid` with one child (it would fill the left column only and leave the right half empty at desktop width), or keep the grid with an inline `gridTemplateColumns: "1fr"` override. Rationale: the How we charge card directly above is already a full-width `for-card` outside a grid, so this matches it; the inline margin reproduces the 16px the grid used to put before the `cta-bar`. Below 900px the grid was already single-column, so mobile is unchanged.

**4.7 The tools line lives inside the Where to start `inner-body`, after the `cta-bar`.** Alternative: its own `inner-body` with `paddingBottom: 0`, as the fractional page does for its cross-sell. Rationale: the line is the "not ready" alternative to the CTA it follows, and `smallPara`'s 24px top margin gives it the right distance from the teal bar; the fractional page needs a separate block only because it has no CTA bar to hang off. One less wrapper.

**4.8 Closing line style: `bandPara` at 16px, white at 60%.** Alternatives: `.equity-body` (exists in `globals.css`: 14px, white at 55%, tuned for the two-column `equity-grid` on the homepage and AI Studio); `smallPara` recoloured. Rationale: the line is a punchline, not a footnote, and 16px at 60% is what the fractional band uses for its paragraphs, so the two dark bands read the same; `smallPara` is 14px ghost-on-white and is wrong for a dark band. Declared as a const next to `bandHeading`, the page's existing pattern, not inline.

**4.9 Dead constants are deleted, not left exported.** The task requires it; the rationale is that the module is the single source of copy and unrendered copy would drift silently. The recovery points are named in this document and in the page's JSDoc.

**4.10 `DATE_MODIFIED` to `2026-09-28`; `LAST_REVIEWED_LABEL` stays "September 2026".** A material copy change on the outsourced page changes the three Service schemas' `dateModified` (they share the constant); the byline is still correct.

**4.11 Metadata and the outsourced Service schema unchanged.** Title, description and canonical remain accurate for the shorter page (§2.2). The OfferCatalog of six stage packages stays: "Nineteen fixed-price packages ... from MAP to GROW" supports it, as the task accepts.

---

## 5. Constraints Honoured

- **No new dependencies; no new CSS files.** Only existing classes: `inner-hero`, `inner-back`, `inner-eyebrow`, `inner-title`, `inner-lead`, `inner-body`, `section-label`, `section-intro`, `equity-band`, `equity-cards`, `equity-card`, `equity-card-num`, `equity-card-label`, `for-card`, `for-yes`, `for-card-title`, `for-item`, `for-check`, `feature-title`, `features`, `feature`, `feature-body`, `cta-bar`, `cta-bar-left`, `cta-bar-btn`, `calendly-band`, `calendly-content`, `calendly-title`, `calendly-body`, `calendly-btn`, `footer`, `footer-logo`, `footer-links`, `footer-copy`, `no-underline`. Inline styles are the page's existing consts plus `bandPara`; `globals.css` is untouched. The classes that only the cut sections used (`focus-*`, `pkg-meta`, `pkg-tag`, `resources`, `resource-*`) stay in the stylesheet for the hub and other pages.
- **`scale-up-content.ts` stays `import type` only.** No new imports at all.
- **Copy.** The two new paragraphs and the tools line are the final copy from the brief, verbatim; everything kept is verbatim from today's module; no em-dashes added (module count stays 0, cap 3); no invented numbers ("Nineteen" = `PACKAGE_COUNT`, "MAP"/"GROW" = the first and last `PACKAGE_STAGES` ids, "eight weeks"/"week five" already in `LEAD_ENGINE`).
- **Dates.** `DATE_MODIFIED` = `2026-09-28` and the test literal moves with it; `LAST_REVIEWED_LABEL` unchanged.
- **Hub and fractional pages untouched**, along with `app/page.tsx`, `app/sitemap.ts`, `next.config.ts`.
- **Conventions.** camelCase consts, PascalCase component, kebab-case content file; no new files besides this design doc (the Reviewer's notes go to `docs/reviews/` as usual).
- **Quality gates.** `npm test` (suites in §2.4), `npm run lint` (no unused imports or consts), `npx tsc --noEmit` (no dangling references), `npm run build` (static page, metadata unchanged). Run them one after another, never `tsc` and `next build` at the same time (runbook caution).

---

## 6. Out of Scope

- Any change to the hub, the fractional page, the homepage, the sitemap, `next.config.ts`, `SiteNav`, or `globals.css`.
- A cross-link from the outsourced page to the fractional page. The cut FAQ ("Can I hire a fractional executive instead?") was the only one; adding a replacement line was not in the approved plan. Flagged in §7 for the owner.
- Rewriting metadata (title/description) or the outsourced Service JSON-LD; both still describe the page accurately.
- `BreadcrumbList` JSON-LD, a shared `styles.ts` for the duplicated style consts, or any change to `HUB_TOOLS` copy: carried over from the previous design's known limitations, unchanged.
- Editing the deck or exporting the cut copy anywhere; git history (`0912fd5`) and the deck are the record.
- The untracked files in the working tree (`.claude/launch.json`, `.claude/settings.json`, `Decks/`, `SUMMIT-GTM-TOOLKIT-SPEC.md`) are not part of this task and must not be staged.

---

## 7. Risks and Edge Cases (for the Reviewer)

1. **SEO: fewer words.** Visible copy drops from about 1,613 tokens to about 607, with the "What's in the AI Lead Engine Build?", "eight weeks", packages and tools explanations gone from the body. The page keeps its title, description, canonical, Service schema, an h1 and six h2s, and its core terms (outsourced sales, fractional, fixed-price packages, engine, SDR, lead-gen agency). Accepted by the owner in the plan.
2. **SEO: FAQPage shrinks from eight to four questions.** The schema still mirrors the visible FAQ exactly. Google restricted FAQ rich results to authoritative government and health sites in August 2023, so the practical loss is small; the structured data still describes the page truthfully.
3. **Service schema richer than the visible page.** The OfferCatalog names six stage packages with one-line descriptions that no longer appear on the page; the visible support is "Nineteen fixed-price packages ... from MAP to GROW". Accepted by the task; a Service is not a rich-result type with content-matching enforcement, unlike FAQPage.
4. **Removed copy is only in git history and the deck.** `main` at `0912fd5` holds the full narrative; the JSDoc and the runbook name it. Nothing in the repo will fail if the deck moves.
5. **No path from the outsourced page to the fractional page** after the FAQ cut, except back to the hub. Worth a one-line cross-sell in a later task if the owner wants symmetry with the fractional page's "Need the sales work done as well as led?" line.
6. **Lint and type check.** Nine imports leave the page's import list; `ArrowLeft`, `Image`, `Link`, `SiteNav`, `smallPara`, `inlineLink`, `bandHeading` all stay in use; `bandPara` is used once. Any stale reference to a deleted export (page or test) fails `tsc`, which is the intended safety net. `"walkAway" in LEAD_ENGINE` is a plain runtime `in` check and type-checks fine on the `as const` object.
7. **Layout.** A `for-card` outside a `for-grid` is the existing How we charge layout, so full-width cards are proven; the only new spacing is `marginBottom: 16` on the facts card before the `cta-bar`. At and below 900px nothing changes (grids were already single-column, `cta-bar` already stacks).
8. **Word count measurement.** The browser count depends on whether the hero and punctuation-only tokens ("✓" ×9, "→" ×2, "·" ×1) are included; §3 gives both bases and the +15 calibration offset so the orchestrator can compare like with like.
9. **Hero lead still true.** `OUTSOURCED_HERO.lead` restates fixed price, fractional people, engine on your intelligence and ownership; all four survive on the page (What Summit is, How we charge, thesis point 4).
