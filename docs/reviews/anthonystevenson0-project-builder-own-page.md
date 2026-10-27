VERDICT: APPROVE

# Review: Project Builder, its own page and a place in the top navigation

Branch `anthonystevenson0/project-builder-own-page`. Inputs: `docs/specs/project-builder-own-page.md`, `docs/designs/anthonystevenson0-project-builder-own-page.md`, and the code diff against `origin/main` (fetched 26 October 2026). `git diff origin/main...HEAD --stat` and `git diff origin/main HEAD --stat` are identical (19 files), so the merge commit 37181c7 brings in nothing beyond this task.

## Gates (run by the Reviewer, Node 25.9.0)

| Gate | Result |
|---|---|
| `npm test` | 419 pass, 0 fail, 0 skipped. "Project Builder path" (3 cases), the updated sitemap case and the scale-up cases all pass |
| `npm run lint` | exit 0, no errors or warnings |
| `npx tsc --noEmit` | exit 0 |
| `npm run build` | exit 0. `○ /project-builder` (static). `/tools/project-builder` absent from the route list and from `.next/prerender-manifest.json` (the `[tool]` params are icp, moat, persona, positioning, problem, unit-of-value only) |
| `git diff origin/main HEAD -- __tests__/scale-up-advisory.test.ts` | empty |
| Calibration | not required (no rubric, prompt, model or scoring change) |

Dev server on port 3123 (`npx next dev --port 3123`), stopped afterwards and the port confirmed free:

- `GET /project-builder` 200.
- `HEAD /tools/project-builder` 308, `location: /project-builder`.
- `HEAD /tools/project-builder?b=x&t=y&src=z` 308, `location: /project-builder?b=x&t=y&src=z`.
- `HEAD /tools/project-builder/` 308 to `/tools/project-builder`, then 308 to `/project-builder` (two hops, harmless).
- Rendered `/project-builder`: canonical, `og:url` and the ld+json `url` are `https://summitstrategyadvisory.com/project-builder`; Twitter card, title, description and image present; `class="toolkit"` wrapper present; no "All GTM Tools"; the Project Builder nav link carries the active style and GTM Tools does not.
- `/tools` renders the nav item and the hub card `href="/project-builder"`; `/` renders the nav item as a plain link.
- Browser check on `/`: at 901px the desktop row is one line (every item 40px high, document width 901, 69px between logo and links, band padding `10px 12px`); at 1101px the original `10px 18px` padding is back with 149px spare; at 900px `.nav-right` is hidden and the hamburger shows. The mobile menu lists Resources, GTM Tools, Project Builder, Blog, Careers, Book a Call; tapping Project Builder lands on `/project-builder` with the menu closed.

## Acceptance Criteria Check

1. [PASS] `app/project-builder/page.tsx` renders `ProjectBuilderPage`, `SiteNav activePage="project-builder"` and `ToolkitFooter` with no back row; `layout.tsx` beside it supplies `.toolkit`; canonical, OpenGraph, Twitter and ld+json use the new URL built from the constant; no `searchParams`, build lists it static.
2. [PASS] `app/tools/project-builder/` removed (git rename); `next.config.ts` has a permanent `/tools/project-builder` to `/project-builder` redirect with no `has` or `missing`; query carried (checked live); the file stays `import type` only.
3. [PASS] `SiteNav` gains a `next/link` "Project Builder" item between GTM Tools and Blog on desktop and mobile; mobile `onClick` closes the menu; `activeStyle` only when `activePage === "project-builder"`; homepage needs no handler; the row fits from 901px (band) to 1440px.
4. [PASS] `PROJECT_BUILDER_PATH` in the pure `copy.ts`, used by brief-auth, the admin unlock, the daily report reminder, the delete back link, `replaceState`, hub-copy, the sitemap and the canonical. `git grep "tools/project-builder"` outside historical docs returns only the redirect and its comment, the runbook note, the redirect test and the gtm-toolkit absence assertion.
5. [PASS] Sitemap lists `/project-builder` at 0.8 and not the old URL (asserted).
6. [PASS] gtm-toolkit test updated (href, sitemap entry and priority, old URL absent); emails `RESUME` on the new path; new `project-builder-path.test.ts` asserts the constant and the redirect's source, destination, `permanent: true`, no `has` or `missing`, and no loop back.
7. [PASS] Runbook Release 1 entry repointed (trigger, pages, copy) and a "Moved to /project-builder, October 2026" note added with the redirect, the constant and the nav band.
8. [PASS] All four gates pass; the build lists `/project-builder` static and not `/tools/project-builder`.

## Constraint Check

- [PASS] Builder behaviour, copy, data, API routes, email wording, Notion writes and admin pages unchanged beyond the path substitutions.
- [PASS] Other tool pages, the /tools hub layout and the GTM Tools nav item unchanged; only `BUILDER_BLOCK.href`'s value moves.
- [PASS] No new dependencies.
- [PASS] `__tests__/scale-up-advisory.test.ts` byte identical to main.
- [PASS] Styling: existing `.nav-link` and `.nav-mobile-link` classes, no Tailwind utilities; label case matches the other items.
- [PASS] Copy: no em or en dashes in added lines; no American spellings found; no hype words.
- [PASS] `app/lib/project-builder/copy.ts` stays pure with no imports; Node loaded consumers (`hub-copy.ts`, `sitemap.ts`) import it with relative `.ts` paths.
- [PASS] CSS scope: the new rules touch only `.nav`, `.nav-link` and `.nav-cta`, which are used only in `SiteNav`; the 1100px band sits before the 900px block (line 131 against 1481), so the hamburger breakpoint still wins at 900px and below.
- [PASS] `next.config.ts` remains `import type` only; the destination is a literal tied to the constant by test.

## Test Coverage Check

- AC1: no unit test for the page (a Next page, not a pure module); covered by the build listing it static and the live HTML check above. Acceptable under "pure modules only".
- AC2: the redirect's source, destination (equal to the constant), permanent flag and the absence of conditions are asserted; the query carry is Next behaviour, verified live.
- AC3: component behaviour is not unit tested (no React test harness in the repo); verified in the browser.
- AC4: the constant is asserted; the hub href and the sitemap URL are asserted through it. The three resume URL templates live in route files and are not unit tested; they are covered by the grep and the email fixture only.
- AC5: sitemap presence, priority 0.8 and the old URL's absence asserted.
- The tests assert behaviour rather than restating code, and would fail on a drift between the redirect and the constant.

## Notes for PR

1. After deploy, open one real resume link emailed before the move (`/tools/project-builder?b=...&t=...`) and confirm it loads the brief at its step.
2. `/tools/project-builder/` with a trailing slash takes two 308 hops (slash removal, then the redirect). Harmless; no action.
3. `SiteNav` is a client component on every page and now imports `copy.ts`. Turbopack tree shakes the unused exports, so this is fine today; if `copy.ts` ever gains side effects, move the path to a one line module.
4. The resume URL is still built by three separate templates (brief-auth, admin unlock, daily report). The design chose not to add a helper (4.6); a `builderResumeUrl()` would let a test cover the exact URL shape.
5. `ToolkitFooter` still dims GTM Tools on this page and the mobile menu has no active state (design 4.8 and A3). Out of scope, visible.
6. The edited header comment in `copy.ts` now has one line well over the file's usual width. Cosmetic.
7. The dev server warns that Next inferred the workspace root from the parent checkout's lockfile when run in a worktree. Pre-existing, not caused by this change.
