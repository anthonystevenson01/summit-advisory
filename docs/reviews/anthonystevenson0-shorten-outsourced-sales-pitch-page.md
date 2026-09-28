# Review: Shorten the outsourced sales page to a pitch summary

Branch: `anthonystevenson0/shorten-outsourced-sales-pitch-page`
Date: 2026-09-28
Design: `docs/designs/anthonystevenson0-shorten-outsourced-sales-pitch-page.md`
Reject/retry loops: 0

## VERDICT: APPROVE

Reviewed read-only on the branch; nothing edited, staged or committed.

### Acceptance Criteria Check

1. `[PASS]` Page renders the eight blocks in order and nothing else. Verified in the built `.next/server/app/scale-up-advisory/outsourced-sales.html`. Class landmarks in order: `inner-hero` > `inner-body` (h2.section-label "What Summit is" + p.section-intro body) > `equity-band` (sage label, `bandHeading` p, `equity-cards` 01–04, then the `bandPara` closer after the cards) > `inner-body` How we charge (h2.section-label + `for-card for-yes` with 4 ✓ items, no `for-card-title`) > `inner-body` Where to start (label, strap, h3 name, summary, `for-card for-yes` with `margin-bottom:16px` and 5 ✓, `cta-bar`, then the tools line as the section's last child: `Not ready to talk? Start with our <a href="/tools">free GTM tools</a>.`) > `inner-body` FAQ (4 `.feature` cards) > `calendly-band` > `<footer>`. Heading outline: h1 → h2 What Summit is → h2 Summit's thesis → h2 How we charge → h2 Where to start (h3 The AI Lead Engine Build, plus the pre-existing h3 in the cta-bar) → h2 FAQ → h2 Start a conversation. Absent, as required: The situation, Who buys Summit, the two-part explainer, How it works / Two roles, Summit's Panel, Summit packages, See the engine at work / Try it free / See all five tools, Why Summit, What you walk away with, `for-grid`, `focus-grid`, `resource-tool`, `pkg-tag`, and all four cut FAQ questions. Hero hunk untouched in the diff.
2. `[PASS]` Content module. A Node comparison against `git show main:app/scale-up-advisory/scale-up-content.ts` (40 checks, 0 fails) confirms: export-set diff vs main is exactly +`OUTSOURCED_TOOLS_LINE`, −`SITUATION`, `HOW_IT_WORKS`, `ROLES`, `PANEL`, `PACKAGES_SECTION`, `TOOLS_SECTION`, `WHY_SUMMIT`; `LEAD_ENGINE` has no `walkAway`/`walkAwayTitle` and its remaining nine fields are verbatim and in the same order; `WHAT_SUMMIT_IS` keys are exactly `[label, body]` with the approved paragraph verbatim; `THESIS` keys `[label, heading, points, closer]` with points verbatim and the exact closer; `OUTSOURCED_TOOLS_LINE` exact; `OUTSOURCED_FAQS` equals main's `[0],[1],[3],[6]` verbatim (questions and answers); `DATE_MODIFIED` "2026-09-28", `LAST_REVIEWED_LABEL` unchanged; every other export identical to main. Comments match design §2.1. No "route"/"routes" wording under `app/scale-up-advisory`. `ToolStage.stage`/`stageNote` kept.
3. `[PASS]` JSON-LD and metadata. FAQPage block has exactly the four questions in order; Service block identical to main except `dateModified: "2026-09-28"` (six-stage OfferCatalog intact); `<title>`, description, canonical and og:url unchanged.
4. `[PASS]` Scope. `git diff --name-only` lists exactly the three source files. Hub, fractional page, `app/page.tsx`, `app/sitemap.ts`, `next.config.ts`, `app/globals.css`, `package.json`, `docs/runbook.md` untouched.
5. `[PASS]` Tests match design §2.4 exactly: walk-away test removed; `packages` gains the `WHAT_SUMMIT_IS.body` test; new `outsourced pitch page` suite with the five tests (a)–(e); date literal "2026-09-28"; imports add `THESIS`, `WHAT_SUMMIT_IS`, `OUTSOURCED_TOOLS_LINE`. All other suites unchanged.
6. `[PASS]` Quality gates, run sequentially: `npm test` 56 tests / 14 suites, 0 fail; `npm run lint` 0 warnings, 0 errors; `npx tsc --noEmit` clean; `npm run build` exit 0, `/scale-up-advisory/outsourced-sales` prerendered static.

### Constraint Check

- `[PASS]` No new dependencies, no new CSS files, existing classes only. The only new inline const is `bandPara`, matching the fractional page's band paragraph style plus the designed `marginTop: 24`.
- `[PASS]` `scale-up-content.ts` stays `import type` only.
- `[PASS]` No em-dashes (module count 0), no invented numbers ("Nineteen" = `PACKAGE_COUNT`, "MAP"/"GROW" = first/last `PACKAGE_STAGES` ids), kept copy verbatim.
- `[PASS]` Hub and fractional pages untouched.

### Test Coverage Check

- Criteria 2, 3 (FAQ half), 5 and the copy constraints are covered by meaningful assertions: `deepEqual` on FAQ order, `in` checks on the module namespace and on `LEAD_ENGINE`, the regex plus stage-derived string on the paragraph, the exact date literal, and the existing `FAQ schemas` suite (now four questions). The `copy hygiene` suite runs over the whole module JSON.
- Criterion 1 (render order) and the metadata half of criterion 3 are not unit-testable with the Node-only runner; verified from the build output instead.
- Every import in the page is used; lint confirms no unused symbols. The deleted names appear only in the test's intentional string-literal list.

### Notes for PR

1. Word count (built HTML, nav to footer exclusive, every whitespace token counted): hero 60, before the FAQ 368, total 608 (308 / 548 excluding the hero). Design estimated 367 / 607. The "about 550 words" target is met.
2. Commit step: stage only the three source files plus `docs/designs/` and `docs/reviews/`. The untracked `.claude/launch.json`, `.claude/settings.json`, `Decks/`, `SUMMIT-GTM-TOOLKIT-SPEC.md` are not part of this task and must not be added.
3. For the Docs agent (design §2.5): `docs/runbook.md` still says `PACKAGES_SECTION.closer` spells out the count, `DATE_MODIFIED (2026-09-24)`, and that the outsourced page renders `stageNote` under a "{stage} package" tag; all three are stale.
4. `TOOL_STAGE_MAP.stageNote` is rendered nowhere after this change (design decision 4.4, kept deliberately, still guarded by the test).
5. No link from the outsourced page to the fractional page remains except the hub back link (design §7.5), an owner's call for a later task.
6. The design's heading outline omitted the pre-existing h3 inside the `cta-bar` ("Start with the Lead Engine Build"); that markup is unchanged from main, not a defect.
