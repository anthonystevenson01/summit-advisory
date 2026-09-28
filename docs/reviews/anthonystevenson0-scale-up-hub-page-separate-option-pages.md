# Review: Scale-Up Advisory hub page + separate option pages

Branch: `anthonystevenson0/scale-up-hub-page-separate-option-pages`
Date: 2026-09-24
Design: `docs/designs/anthonystevenson0-scale-up-hub-page-separate-option-pages.md`
Reject/retry loops: 0

## VERDICT: APPROVE

### Acceptance Criteria Check

1. `[PASS]` Hub order and contents. `app/scale-up-advisory/page.tsx` renders `SiteNav` → hero (eyebrow, title, lead, "Last reviewed" byline, unchanged from main) → "Two ways in" with exactly two `next/link` cards → "Free GTM tools" section (heading "We know AI. We've built free tools to help you.", five `resource-tool` cards, "See all five tools →" to `/tools`) → footer. Rendered HTML from `next start` confirms: card hrefs `/scale-up-advisory/fractional-executive` and `/scale-up-advisory/outsourced-sales`, five tool links, zero `calendly-band`, zero FAQ headings, zero element `id`s, no `<a href="#…">`, no `resource-tag` on the option cards.
2. `[PASS]` No route wording. `grep -rn -i -E "\broutes?\b" app/scale-up-advisory app/page.tsx` returns nothing; the rendered HTML of all three pages (scripts stripped) has zero hits. Exports are `OPTIONS`/`OptionId`/`ScaleUpOption`; the `copy hygiene` test runs `doesNotMatch(JSON.stringify(content), /\broutes?\b/i)` and passes.
3. `[PASS]` New outsourced page. Diffing the moved block (main hub lines 141–378 vs `outsourced-sales/page.tsx` lines 105–340, whitespace-insensitive) shows only the allowed differences: comment renumbering, the removed `id={OUTSOURCED_ANCHOR_ID}`/`scroll-mt-20` wrapper and the tools section's `id`/`scroll-mt-20`, and `{t.body}` → `{t.summary} {t.stageNote}`. Section labels in rendered order: The situation | Who buys Summit? | What Summit is | Summit's thesis | How it works | Summit's Panel | The intelligence library | Summit packages | See the engine at work | Where to start | Why Summit | FAQ | Start a conversation; footer present. Metadata verified in HTML: title "Outsourced Sales for B2B Scale-Ups | Summit Scale-Up Advisory", canonical and `og:url` = `https://summitstrategyadvisory.com/scale-up-advisory/outsourced-sales`, `twitter:card` summary_large_image, description 159 chars. JSON-LD parses: Service with url on the new path plus FAQPage (8 questions). Hero back link `inner-back` → `/scale-up-advisory`.
4. `[PASS]` Fractional page: the only diff vs main is the import swap and the cross-sell `href={OUTSOURCED_SALES_PATH}`; rendered eyebrow is "For B2B Scale-Ups"; one link to `/scale-up-advisory/outsourced-sales`.
5. `[PASS]` Homepage: "sme" card renders as `<Link href="/scale-up-advisory" className="card no-underline">`; `ai`/`retail` keep the identical `<button>` branch (inner markup byte-for-byte the same, fragment adds no DOM). `practiceData`, `PracticePage`, `pageHref` and the `page === "sme"` line are gone and referenced nowhere in app code. Live check on the production build: `GET /?page=sme` → 308 to `/scale-up-advisory?page=sme`; `GET /?page=blog` → 200 (untouched).
6. `[PASS]` Sitemap lists all three scale-up URLs, no duplicates (tests pass); homepage crawler block links "Outsourced Sales" → `/scale-up-advisory/outsourced-sales`.
7. `[PASS]` All copy in `scale-up-content.ts`, whose only import is `import type { ToolSlug }`; pages map onto existing `globals.css` classes (`card*`, `for-grid`, `resource*`, `inner-back`, `section-label`, `section-intro`, etc.). Hardcoded page strings are limited to the pre-existing byline, footer, "Frequently Asked Questions" heading and inline metadata (design decision 12).
8. `[PASS]` Tests updated per design §2.8 (51 tests, 13 suites, 0 failures). Gates: `npm test` exit 0; `npm run lint` exit 0, no warnings; `npx tsc --noEmit` exit 0 (see note 3); `npm run build` exit 0 with `/scale-up-advisory`, `/scale-up-advisory/fractional-executive`, `/scale-up-advisory/outsourced-sales` all prerendered static.

### Constraint Check

- `[PASS]` No new dependencies: `package.json`/`package-lock.json` absent from `git status` and `git diff --stat`.
- `[PASS]` No new CSS files; `app/globals.css` untouched; Tailwind utilities used are only `no-underline` and `italic`, both already in the codebase.
- `[PASS]` `scale-up-content.ts` and `next.config.ts` contain only `import type`; the test suite loads both under Node type stripping.
- `[PASS]` Copy: 0 em-dashes in the module (cap 3); new strings (`HUB_TOOLS`, `OUTSOURCED_HERO`, `SITUATION.label`, FAQ sentence, hub schema description, metadata) restate existing claims; "five" tools is real and tested; "No sign-up." matches the existing `/tools` metadata ("No signup required"); British spellings throughout; hub description 156 chars.
- `[PASS]` Outsourced/fractional substance unchanged beyond what the design requires (label "The situation", one FAQ sentence, shared eyebrow, tool body split at the existing full stop).
- `[PASS]` Secrets: n/a, static pages.

### Test Coverage Check

- Criteria 2, 3 (schema URLs, FAQ mirror, summary/stageNote), 5 (redirect entry), 6 (sitemap), 7 (module loads with no runtime imports) and the tool-map invariants (`isToolPublic`, names match `TOOL_SEO`, every public tool mapped) are all asserted, and the assertions are specific (literal URLs, literal date, `has` query shape, no `#` in hrefs, stage note names its stage).
- Criteria 1 and 4 (page structure, hub card markup, cross-sell link) are not unit-testable with the project's Node-only runner (no React renderer); verified from the rendered production HTML instead. Criterion 2 on page files is covered by grep plus the module-level regex, which also fails on any `ROUTES`-style export name.
- No trivial or wrong tests found; the `homepage deep link` test would fail if the redirect were removed or its destination/`permanent` flag changed.

### Notes for PR

1. Redirect target carries the query: `/?page=sme` → 308 → `/scale-up-advisory?page=sme`. Design-accepted cosmetic (§2.6); the hub is static and declares the clean canonical.
2. `docs/runbook.md` still described "Route 02", `#outsource-your-sales` and `#free-tools` at review time; the Docs agent updates it. The older `docs/designs/...two-routes...md` and `docs/reviews/...two-routes...md` keep route/anchor wording as historical records (design §6).
3. `tsc` initially failed only on two gitignored, generated duplicates (`.next/types/routes.d 2.ts`, `routes.d 5.ts`), created by running `tsc` concurrently with `next build`. Deleting them (build output, not source) made `tsc` pass clean. Do not run `tsc` concurrently with `next build`.
4. Untracked files that are not part of this change and must not be staged: `.claude/launch.json`, `.claude/settings.json`, `Decks/`, `SUMMIT-GTM-TOOLKIT-SPEC.md`. Stage only the seven modified files, `app/scale-up-advisory/outsourced-sales/page.tsx`, and `docs/designs/` + `docs/reviews/`.
5. Old external links to `/scale-up-advisory#outsource-your-sales` land on the hub (fragments never reach the server); the "Outsource your sales" card is one click away. Design-accepted.
6. JSON-LD shapes verified from rendered HTML: hub emits Service with `OfferCatalog` → two `Offer`/`Service` items carrying absolute URLs to both option pages; outsourced emits Service (six package-stage offers) + FAQPage; fractional unchanged. The layout's Organization schema also appears on each page, as before.
7. Optional follow-ups already listed in design §6: shared style constants for `smallPara`/`inlineLink`/`bandHeading` (now duplicated on three pages), a cross-sell from the outsourced page back to the fractional page, and BreadcrumbList JSON-LD.
