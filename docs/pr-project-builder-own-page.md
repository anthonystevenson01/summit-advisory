Give the Project Builder its own page and a top navigation item

## What was built
The Project Builder moves out of the GTM Toolkit to its own page at `/project-builder`, with a "Project Builder" item between GTM Tools and Blog in the top navigation on every page, desktop and mobile. The old `/tools/project-builder` address redirects permanently with its query kept, so resume links already emailed and shared `?src=` tags keep working. The builder's behaviour, copy, data, API routes, email wording and admin pages are unchanged apart from the path they link to.

## Architect decisions
- One constant, `PROJECT_BUILDER_PATH = "/project-builder"`, in the pure `app/lib/project-builder/copy.ts`, used by every link builder: the three resume URL templates (save, admin unlock, daily reminder), the delete page's back link, the reset's `replaceState`, the /tools hub block, the sitemap, the canonical and the nav. `git grep "tools/project-builder"` in code now finds only the redirect, the runbook and the tests about the old address.
- The redirect is a plain, unconditional 308 in `next.config.ts`. Next carries the incoming query into the destination, so `?b=&t=&src=` arrive intact and the static page reads them on the client as before. The destination is a literal because the config may only `import type`; a new test asserts it equals the constant, is permanent and has no `has` or `missing`.
- A sibling `app/project-builder/layout.tsx` restores the `.toolkit` wrapper the page used to inherit from `app/tools/layout.tsx`, so it looks as it did. The "All GTM Tools" back row is gone and `SiteNav` highlights the new item.
- The extra nav item does not fit at 901px with today's spacing (about 952px needed). Rather than move the 900px hamburger breakpoint, which also drives page layouts, a 901 to 1100px band tightens the nav's side padding to 24px and link padding to 12px (about 832px needed), and `nowrap` stops a label ever breaking onto two lines. Above 1100px the nav is unchanged.
- The three resume URL templates keep their own line rather than a new helper, to keep the route changes to a one word substitution.

## Reviewer verdict
APPROVED (loop 1): all eight acceptance criteria and every constraint pass; build lists `/project-builder` static and no longer lists `/tools/project-builder`; `__tests__/scale-up-advisory.test.ts` is byte identical to main.

## Tests
3 added, 0 broken. 419 pass on the branch against 416 on main. The new `__tests__/project-builder-path.test.ts` asserts the constant, the redirect (source, destination equal to the constant, permanent, unconditional) and that no redirect points back at the old address. Two existing tests were edited, not added: the hub block's `href` and the sitemap case in `gtm-toolkit.test.ts` (now also asserting priority 0.8 and that the old URL is absent), and the resume URL fixture in `project-builder-emails.test.ts`. `npm run lint` 0 errors, `npx tsc --noEmit` clean, `npm run build` passes (run by the Reviewer; the later Docs changes are comments only). Calibration not needed (no rubric, prompt, model or scoring change).

## Notes
- **After deploy:** open one real resume link emailed before the move (`/tools/project-builder?b=...&t=...`) and confirm it loads the brief at its step.
- **Never remove the redirect without a migration.** Every resume link sent before this change depends on it, and browsers cache the 308. The runbook says so under the Release 1 entry's "Moved to /project-builder" note.
- `/tools/project-builder/` with a trailing slash takes two 308 hops (slash removal, then the redirect). Harmless.
- Out of scope and visible: `ToolkitFooter` still dims its GTM Tools link on this page, and the mobile menu has no active state for any item, this one included.
- Browser checks already done: the desktop nav row sits on one line at 901, 1024, 1101, 1280 and 1440px with no sideways scroll; the mobile menu lists Project Builder third and closes on tap from the homepage; the old address with `?src=creds-deck` lands on the new page with the tag stored; the /tools "Building something?" block links to the new page.
- Smaller follow ups from the review: a `builderResumeUrl()` helper would let a test cover the exact resume URL shape; `SiteNav` now imports `copy.ts`, which is fine while that module has no side effects (move the path to a one line module if it ever gains one).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
