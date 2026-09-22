# Review — anthonystevenson0/scale-up-two-routes-outsourced-sales

**Date:** 2026-09-22
**Verdict:** APPROVE (first pass, REJECT_COUNT = 0)

## Acceptance criteria
All PASS: two route cards at top (Route 01 → /scale-up-advisory/fractional-executive, Route 02 → #outsource-your-sales from shared constant); Route 1 simple standalone page; Route 2 full deck narrative; top-level GTM tools pointer; Route 2 "engine in miniature" section ties tools to Summit's AI skills and bespoke capability build; deck typos fixed; no invented stats/prices/clients (Route 1 stats carried over from HEAD); metadata/canonicals verified in built HTML; JSON-LD parses and matches visible FAQs (same source array, tested); sitemap updated; ai/retail practice views unaffected.

## Constraints
All PASS: no new dependencies (test script only); no custom CSS files, all classes exist in globals.css or are Tailwind utilities; tool slugs public and pre-rendered; British English, zero em-dashes in content module; no secrets; naming conventions.

## Quality gates
- npm test: 25/25 pass (node:test, Node v25.9.0)
- npx tsc --noEmit: clean for source; only errors from stale git-ignored `.next/types/* 2.ts` Finder duplicates
- npm run build: succeeds, both routes static
- Lint: 0 errors in new/changed scale-up files; app/page.tsx has same 4 pre-existing errors as HEAD

## Notes flagged
1. `npm test` requires Node ≥ 22.18 / 23.6 (native TS stripping); CLAUDE.md states Node 20.
2. Jest is listed in CLAUDE.md but not installed; `__tests__/gtm-toolkit.test.ts` is stale and excluded from the test script.
3. Delete stale `.next/types/* 2.ts` locally for clean tsc.
4. ">70% fail in first 18 months" stat on fractional page is unsourced (carried over).
5. Deck line "One managed contract for effort." paraphrased as "Two roles, one contract."
