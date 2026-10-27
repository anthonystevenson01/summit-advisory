---
# Task Spec: Project Builder, its own page and a place in the top navigation
# Source: Anthony's request of 27 October 2026, "give the project builder its own page on the website and put it in the top navigation"
# Builds on: Project Builder Release 1 (PR #17, merged as eeeca94)
# Owner: anthonystevenson0
# Branch: anthonystevenson0/project-builder-own-page
# ticket_id: none

objective: >
  The Project Builder moves out of the GTM Toolkit to a page of its own at
  /project-builder, and gets its own item in the site's top navigation on every
  page, desktop and mobile. Today it lives at /tools/project-builder, shows an
  "All GTM Tools" back link and highlights GTM Tools in the nav, so it reads as
  one of the diagnostic tools rather than a service. The builder itself, its
  behaviour, copy, data, routes and admin are unchanged. Every link the site
  sends or renders points at the new address, and the old address redirects
  permanently with its query string kept, so resume links already emailed to
  prospects and any ?src= tags already shared keep working.

acceptance_criteria:
  1. New page. `app/project-builder/page.tsx` renders the builder at `/project-builder`: the same `ProjectBuilderPage` component, `SiteNav` with a new `activePage` value `"project-builder"`, and `ToolkitFooter`, with no "All GTM Tools" back link. The page keeps the `.toolkit` wrapper (through a `layout.tsx` beside it or the page itself) so fonts, colours and spacing match what it looks like today under /tools. Metadata, canonical, OpenGraph, Twitter and the WebApplication ld+json all use `https://summitstrategyadvisory.com/project-builder`. The page stays static (no searchParams read on the server).
  2. Old address. `app/tools/project-builder/` is removed. `next.config.ts` gains a permanent redirect from `/tools/project-builder` to `/project-builder`; Next carries the incoming query across, so `/tools/project-builder?b=...&t=...&src=...` lands on `/project-builder?b=...&t=...&src=...`. Keep `next.config.ts` to `import type` only, as its comment requires.
  3. Top navigation. `SiteNav` gains a "Project Builder" item between GTM Tools and Blog, as a `next/link` to `/project-builder`, in both the desktop row and the mobile menu (the mobile one closes the menu on tap, as the others do). It is highlighted with the existing active style when `activePage` is `"project-builder"`. It works on the homepage, which passes SPA handlers for the other items: the new item needs no handler. The desktop row must not wrap, overflow or clip at any width from 901px (just above the 900px hamburger breakpoint) to 1440px; if the extra item does not fit at 901px, adjust the nav spacing or the breakpoint in `globals.css` rather than shortening the label.
  4. One path. A single exported constant holds the builder's path (`PROJECT_BUILDER_PATH = "/project-builder"`, in a pure module such as `app/lib/project-builder/copy.ts`) and every place that builds a link to the builder uses it: the resume URL in `app/api/project-builder/brief-auth.ts`, the admin unlock route, the daily report's reminder emails, the delete page's back link, the `replaceState` in `ProjectBuilderPage.tsx`, the hub block's `href` in `app/tools/hub-copy.ts`, the sitemap and the page's canonical. `git grep "tools/project-builder"` afterwards finds only the redirect, the runbook's note about it, and tests that assert the redirect.
  5. Sitemap. `/project-builder` is listed at priority 0.8 and `/tools/project-builder` is not.
  6. Tests (node:test, pure modules only): `__tests__/gtm-toolkit.test.ts` updated for the hub block's new `href` and the sitemap URL, and asserts the old URL is absent; the resume URL constant in `__tests__/project-builder-emails.test.ts` uses the new path; a test that loads `next.config.ts` and asserts the redirect's source, destination and `permanent: true`; a test that `PROJECT_BUILDER_PATH` is `"/project-builder"`.
  7. Docs. The Release 1 runbook entry in `docs/runbook.md` names the new path and the redirect, and a short "Moved to /project-builder, October 2026" note is added under it.
  8. `npm test`, `npm run lint` (0 errors), `npx tsc --noEmit` and `npm run build` pass. The build lists `/project-builder` as static and no longer lists `/tools/project-builder`.

project_setup:
  type: existing

constraints:
  - No change to the builder's behaviour, copy, data, API routes, emails' wording, Notion writes or admin pages beyond the path they link to.
  - No change to the other tool pages, the /tools hub layout, or the GTM Tools nav item.
  - No new dependencies.
  - `__tests__/scale-up-advisory.test.ts` stays byte-identical to main.
  - Styling: inline BRAND style objects and `globals.css` classes; no Tailwind utilities. Nav label in the same case and style as the other items.
  - Copy: British spelling, no em or en dashes, no hype words.
  - `app/lib/**` pure modules import siblings with relative `.ts` paths and nothing from `next/*` or `react`.

codebase_context:
  - CLAUDE.md
  - app/components/SiteNav.tsx
  - app/page.tsx
  - app/tools/layout.tsx
  - app/tools/project-builder/page.tsx
  - app/components/project-builder/ProjectBuilderPage.tsx
  - app/lib/project-builder/copy.ts
  - app/api/project-builder/brief-auth.ts
  - app/api/project-builder/delete/route.ts
  - app/api/admin/briefs/[id]/route.ts
  - app/api/admin/daily-report/route.ts
  - app/tools/hub-copy.ts
  - app/components/toolkit/ToolkitHub.tsx
  - app/sitemap.ts
  - app/globals.css
  - next.config.ts
  - __tests__/gtm-toolkit.test.ts
  - __tests__/project-builder-emails.test.ts
  - __tests__/scale-up-advisory.test.ts
  - docs/runbook.md

output_format: >
  Code applied to disk on the working branch. The Architect writes the design to
  docs/designs/anthonystevenson0-project-builder-own-page.md. The Reviewer's notes go to
  docs/reviews/anthonystevenson0-project-builder-own-page.md.

ticket_id:

owner: anthonystevenson0

priority: medium

required_access: []

notes: >
  Assumptions, each reversible: the address is /project-builder; the nav label is
  "Project Builder" and sits between GTM Tools and Blog; the "Building something?"
  block on /tools stays and now links to the new page. Resume links already sent by
  email point at /tools/project-builder and rely on the redirect keeping the query
  string, so the redirect must not be removed later without a migration.
