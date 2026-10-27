# Design: Project Builder, its own page and a place in the top navigation

Branch `anthonystevenson0/project-builder-own-page`, cut from `main` at eeeca94 (PR 17, Project Builder Release 1). Source: `docs/specs/project-builder-own-page.md` (8 acceptance criteria). Builds on `docs/designs/anthonystevenson0-project-builder-1-builder.md`.

This document is design only. No code, no pseudocode. Assumptions are stated inline and collected in section 8.

---

## 0. Shape of the change

The builder moves from `/tools/project-builder` to `/project-builder` and gains a top navigation item. Nothing inside the builder changes except the one path it writes into the address bar on reset.

```
app/lib/project-builder/copy.ts            + PROJECT_BUILDER_PATH = "/project-builder" (the only place the path is written)
app/project-builder/layout.tsx             new: the .toolkit wrapper, as app/tools/layout.tsx
app/project-builder/page.tsx               new: the old page, moved; own nav state, no back row, canonical from the constant
app/tools/project-builder/                 removed
next.config.ts                             + permanent redirect /tools/project-builder -> /project-builder (query carried by Next)
app/components/SiteNav.tsx                 + "project-builder" in activePage; + "Project Builder" Link, desktop and mobile
app/globals.css                            + nowrap on .nav-link and .nav-cta; + a 901 to 1100px spacing band
link builders (6 files)                    the literal path replaced by the constant
sitemap, hub copy                          the constant
tests                                      gtm-toolkit and emails updated; new project-builder-path.test.ts
docs/runbook.md                            Release 1 entry repointed; "Moved to /project-builder, October 2026" note
```

Every hit of `git grep -n "tools/project-builder"` on main is accounted for in section 1.

---

## 1. Files to Modify / Create

| File | Change and why |
|---|---|
| `app/lib/project-builder/copy.ts` (modify) | Adds one export, `PROJECT_BUILDER_PATH`, the string `"/project-builder"`, with a one line doc comment saying it is the builder's public path and every link to the builder is built from it. Declared as a plain `const` string so its type is the literal. The module header gains half a sentence noting it also holds the path. Stays pure with no imports. |
| `app/project-builder/layout.tsx` (create) | Server layout named `ProjectBuilderLayout` that wraps its children in a `div` with `className="toolkit"`, exactly as `app/tools/layout.tsx` does, so the page keeps the toolkit background, the `--tk-*` variables and the font fallback it has today. |
| `app/project-builder/page.tsx` (create) | The content of `app/tools/project-builder/page.tsx`, moved, with four changes: `CANONICAL` is the site base `https://summitstrategyadvisory.com` joined to `PROJECT_BUILDER_PATH` (imported from `@/app/lib/project-builder/copy`); `SiteNav` gets `activePage="project-builder"`; the forest back row with the "All GTM Tools" `Link` is deleted, and with it the `next/link` import; the doc comment says `/project-builder`, "its own chrome (SiteNav, ToolkitFooter)" and drops the back link. Title, description, OpenGraph, Twitter, the WebApplication ld+json shape, the `.page` wrapper, `<ProjectBuilderPage />` and `<ToolkitFooter />` are unchanged. Reads no `searchParams`, exports no `dynamic`. |
| `app/tools/project-builder/page.tsx` (delete) | Removed with its directory; the route now exists only as a redirect. |
| `next.config.ts` (modify) | A second entry in `redirects()`: `source` `/tools/project-builder`, `destination` `/project-builder` (a literal; see 4.4), `permanent: true`, no `has`, no `missing`. The comment above `redirects()` gains two sentences: the builder moved in October 2026, emailed resume links (`?b=&t=`) and shared `?src=` tags point at the old address and rely on Next merging the query into the destination, so this entry must not be removed without a migration. The file stays `import type` only. |
| `app/components/SiteNav.tsx` (modify) | `activePage` union gains `"project-builder"`. Desktop row: a `Link` to `PROJECT_BUILDER_PATH` with `className="nav-link"`, the label "Project Builder", and `style` set to `activeStyle` when `activePage === "project-builder"`, else undefined; placed directly after the GTM Tools `Link` and before the Blog ternary. Mobile menu: a `Link` to the same path with `className="nav-mobile-link"`, the same label and `onClick` that calls `setMenuOpen(false)`, placed directly after the GTM Tools mobile `Link`. No new prop and no handler. Imports the constant from `@/app/lib/project-builder/copy`. |
| `app/globals.css` (modify) | In the NAV section: `white-space: nowrap` added to `.nav-link` and `.nav-cta`; a new `@media (max-width: 1100px)` block placed directly after the `.nav-cta:active` rule (before `/* PAGE WRAPPER */`) setting `.nav` padding to `0 24px` and `.nav-link` padding to `10px 12px`, with a comment carrying the widths from 2.4. Nothing else in the file changes. |
| `app/api/project-builder/brief-auth.ts` (modify) | The `resumeUrl` template uses `PROJECT_BUILDER_PATH` after `origin`; the encoding of `b` and `t` is unchanged. Imports the constant from `@/app/lib/project-builder/copy`. |
| `app/api/admin/briefs/[id]/route.ts` (modify) | Same change on the unlock action's `resumeUrl`. |
| `app/api/admin/daily-report/route.ts` (modify) | Same change on the reminder email's `resumeUrl`. |
| `app/api/project-builder/delete/route.ts` (modify) | `backLink`'s `href` uses `PROJECT_BUILDER_PATH`; the rest of the string is unchanged. |
| `app/components/project-builder/ProjectBuilderPage.tsx` (modify) | `reset()`'s `replaceState` target becomes `PROJECT_BUILDER_PATH`, added to the existing import from `@/app/lib/project-builder/copy`. No other line changes. |
| `app/tools/hub-copy.ts` (modify) | `BUILDER_BLOCK.href` becomes `PROJECT_BUILDER_PATH`, imported with a relative `.ts` path (`../lib/project-builder/copy.ts`), as the file's other imports are, so the test can load it under Node. Label, title, body and cta unchanged. |
| `app/sitemap.ts` (modify) | The builder entry's `url` becomes the base joined to `PROJECT_BUILDER_PATH`, imported as `./lib/project-builder/copy.ts`; same position, `changeFrequency: "weekly"`, `priority: 0.8`. |
| `__tests__/gtm-toolkit.test.ts` (modify) | In "Project Builder block": `BUILDER_BLOCK.href` equals `"/project-builder"`; the sitemap test asserts the new URL is present with `priority` 0.8 and `https://summitstrategyadvisory.com/tools/project-builder` is absent. Nothing else changes. |
| `__tests__/project-builder-emails.test.ts` (modify) | `RESUME` becomes `https://summitstrategyadvisory.com/project-builder?b=brief_0123456789abcdef&t=abc.def`. Nothing else changes; every assertion keys off the constant. |
| `__tests__/project-builder-path.test.ts` (create) | The path constant and the redirect. Loads `../app/lib/project-builder/copy.ts` and `../next.config.ts` the same way `scale-up-advisory.test.ts` loads the config (default import, `assert.ok(nextConfig.redirects)` then await it). Cases in 2.7. |
| `docs/runbook.md` (modify) | The Release 1 entry repointed and a short note appended (2.8). |

Not touched: `__tests__/scale-up-advisory.test.ts` (byte-identical), `ToolkitFooter.tsx`, `ToolkitHub.tsx`, `app/tools/layout.tsx`, every other tool page, `app/page.tsx`, `app/lib/project-builder/emails.ts` and the other builder modules, the API routes beyond the link lines named above, `robots.ts`, `middleware.ts`, historical files under `docs/designs/`, `docs/reviews/`, `docs/specs/` and `docs/pr-project-builder-1.md`.

---

## 2. Integration Points

### 2.1 The path constant

`PROJECT_BUILDER_PATH` in `app/lib/project-builder/copy.ts`. Consumers, by import style:

- Next code through the `@/` alias: `app/project-builder/page.tsx`, `SiteNav.tsx`, `ProjectBuilderPage.tsx`, `brief-auth.ts`, the admin briefs route, the daily report route, the delete route.
- Node loaded modules through relative `.ts` paths: `app/tools/hub-copy.ts`, `app/sitemap.ts`, and the new test.

`next.config.ts` cannot import it (4.4); the new test ties the two together by asserting the redirect's `destination` equals the constant.

The catalogue test walks every export of `copy.ts` for en and em dashes; the new string has a hyphen only and passes.

### 2.2 The page and its layout

`/project-builder` resolves to `app/project-builder/layout.tsx` (the `.toolkit` div) wrapping `app/project-builder/page.tsx`. The rendered tree is the same as today's minus the back row: ld+json script, `SiteNav`, `.page` div containing `ProjectBuilderPage` and `ToolkitFooter`. The root layout's `metadataBase` is unchanged; the canonical, `openGraph.url` and the ld+json `url` are absolute and read the same `CANONICAL`.

`.toolkit` is a single rule (`globals.css` line 1492): the `--tk-*` variables, a Georgia font fallback, the `#F5F9F6` background and `min-height: 100vh`. There are no `.toolkit` descendant selectors, and the builder sets its own white background and DM Sans inline, so the visible effect is the off white behind and below the builder. Keeping it through a sibling layout reproduces today's DOM exactly.

The top of the page loses the 14px forest back row. The first thing under the fixed nav is the Save row, which has its own 14px top padding; the sticky stepper rail keeps `top: 64px`. No spacer is added (the builder is unchanged by constraint).

### 2.3 The navigation item

Desktop order: Resources, GTM Tools, Project Builder, Blog, Careers, Book a Call, admin icon. Mobile order: Resources, GTM Tools, Project Builder, Blog, Careers, Book a Call.

The item is a `next/link` in both places, the same pattern as GTM Tools (no SPA branch, so no `onProjectBuilder` prop). On the homepage, which passes `onResources`, `onBlog`, `onCareers`, `onBookCall` and `onLogoClick`, the item is a client navigation to `/project-builder`, exactly as GTM Tools already is; the SPA state is discarded with the page, which is today's behaviour for GTM Tools. The mobile link closes the menu on tap through `setMenuOpen(false)`, as the GTM Tools mobile link does.

Highlight: `activeStyle` (the existing `{ color: "rgba(255,255,255,0.9)", cursor: "default" }`) on the desktop item when `activePage === "project-builder"`. The mobile menu highlights no item today and this item follows suit (assumption A3).

`SiteNav` is rendered by each page, not the root layout. Pages that render it (homepage, `/ai-studio`, `/loyalty-retail-media`, the three scale up pages, `/newsletter`, `/tools`, every tool page, Built to Scale and its method and report pages, and the new page) all get the item. Admin and `/report` pages do not use `SiteNav` and are unchanged.

### 2.4 Nav width at 901px: measured, and the fix

Inputs from `globals.css`: `.nav` padding `0 48px`; logo 160px wide (the `width` attribute; CSS sets only the height); `.nav-right` `gap: 4px`; `.nav-link` Barlow Condensed 13px, weight 600, `letter-spacing: 0.1em`, uppercase, padding `10px 18px`; `.nav-cta` weight 700, padding `10px 24px`, `margin-left: 12px`; the admin link is a `.nav-link` holding a 16px icon (52px wide).

Measured in Chromium with Barlow Condensed loaded from Google Fonts (the same face `next/font` self hosts), item widths including padding: Resources 100.5, GTM Tools 97.9, Project Builder 137.5, Blog 64.6, Careers 85.9, Book a Call 121.8 (+12 margin), admin 52.

| Case | Row needed | Space at 901px | Result |
|---|---|---|---|
| Today, five text items | 96 + 160 + 554.7 = 810.7 | 901 | fits, 90.3 spare |
| Six items, current spacing | 96 + 160 + 696.2 = 952.2 | 901 | does not fit: the flex items shrink and "Project Builder", "GTM Tools" and "Book a Call" break onto two lines (item height 62px against 41px) |
| Six items, band spacing | 48 + 160 + 624.2 = 832.2 | 901 | fits, 68.8 spare |

The fix, in `globals.css` only:

1. `white-space: nowrap` on `.nav-link` and `.nav-cta`, so a label can never break onto two lines.
2. `@media (max-width: 1100px)`: `.nav` padding `0 24px` (saves 48px) and `.nav-link` padding `10px 12px` (saves 12px on each of six `.nav-link` elements, 72px). The `.nav-cta` padding and margin, the gap, the font and the label are unchanged.

Margins with the fix, measured on a replica row:

| Width | Spacing | Free space between logo and links |
|---|---|---|
| 901 | band | 68.8px (51.8px with a 17px classic scrollbar, where the fixed nav is 884px wide) |
| 1100 | band | 267.8px |
| 1101 | original | 148.8px (131.8px with a scrollbar) |
| 1440 | original | 487.8px |

So the row fits with at least 50px to spare at every width from 901 to 1440, and above 1100px the nav looks exactly as it does today. The breakpoint stays at 900px.

Order matters: the band block sits in the NAV section, before the existing `@media (max-width: 900px)` block (line 1469), so at 900px and below that block's `.nav { padding: 0 20px }` still wins and `.nav-right` is hidden. The band uses `max-width` only (no `min-width: 901px`) so there is no fractional gap between 900 and 901 on zoomed viewports.

### 2.5 The redirect

Next applies `redirects()` before the filesystem, so `/tools/project-builder` never reaches `app/tools/[tool]` (which would 404 it anyway, as `project-builder` is not a public tool slug). The response is a 308.

Query handling, confirmed in the installed Next (`node_modules/next/dist/shared/lib/router/utils/prepare-destination.js`, `prepareDestination`): the destination's query is built from the incoming query first, then the destination's own query on top. The destination has no query of its own, so `/tools/project-builder?b=brief_x&t=a.b&src=li` lands on `/project-builder?b=brief_x&t=a.b&src=li`. The `t` token is base64url with a dot, all unreserved characters, so it survives re-serialisation unchanged. The source has no `:path*`; there are no subpaths to carry. `/tools/project-builder/` (trailing slash) is normalised to the slashless form by Next first, then redirected.

### 2.6 Link builders

Every hit of `git grep -n "tools/project-builder"` on main and what happens to it:

| Hit | Outcome |
|---|---|
| `app/api/project-builder/brief-auth.ts:95` | constant (save link, confirmation, "Email me my link") |
| `app/api/admin/briefs/[id]/route.ts:75` | constant (unlock email) |
| `app/api/admin/daily-report/route.ts:81` | constant (reminder email) |
| `app/api/project-builder/delete/route.ts:46` | constant (delete page back link) |
| `app/components/project-builder/ProjectBuilderPage.tsx:642` | constant (reset) |
| `app/sitemap.ts:25` | constant |
| `app/tools/hub-copy.ts:87` | constant |
| `app/tools/project-builder/page.tsx:7, 48` | file deleted; the new page uses the constant |
| `__tests__/gtm-toolkit.test.ts:136, 144` | new path; one deliberate absence assertion on the old sitemap URL |
| `__tests__/project-builder-emails.test.ts:21` | new path |
| `docs/runbook.md:489, 514` | new path; the old path survives only in the moved note |
| `docs/designs/*`, `docs/reviews/*`, `docs/specs/*`, `docs/pr-project-builder-1.md` | historical records, left as written (A5) |

After the change, `git grep -n "tools/project-builder" -- . ':!docs/designs' ':!docs/reviews' ':!docs/specs' ':!docs/pr-*.md'` returns: the `next.config.ts` redirect and its comment, the runbook note, the redirect test, and the gtm-toolkit absence assertion. Nothing else.

### 2.7 Tests (node:test, pure modules only)

`__tests__/project-builder-path.test.ts`, describe "Project Builder path":

1. `PROJECT_BUILDER_PATH` is exactly `"/project-builder"`.
2. `next.config.ts` defines `redirects()`; exactly one entry has `source` `"/tools/project-builder"`; its `destination` equals `PROJECT_BUILDER_PATH`; `permanent` is `true`; it has no `has` and no `missing` (so the query is never a condition and is always carried).
3. No redirect's `destination` contains `tools/project-builder` (no loop back).

`__tests__/gtm-toolkit.test.ts`, describe "Project Builder block":

4. `BUILDER_BLOCK.href` is `"/project-builder"` (the existing dash and cta assertions stay).
5. The sitemap has an entry with `url` `https://summitstrategyadvisory.com/project-builder` and `priority` 0.8, and no entry with `url` `https://summitstrategyadvisory.com/tools/project-builder`.

`__tests__/project-builder-emails.test.ts`: the `RESUME` fixture moves to the new path; its existing assertions then check the new URL appears in text and HTML.

`__tests__/scale-up-advisory.test.ts` is unchanged and still passes: its `/?page=sme` lookup finds its entry among two, and its "no duplicate URLs" sitemap test still holds.

### 2.8 Runbook

In the "Project Builder Release 1" entry of `docs/runbook.md`:

- **Trigger** (line 489): "lands on `/tools/project-builder` directly" becomes "opens Project Builder from the top navigation or lands on `/project-builder` directly"; the resume link becomes `/project-builder?b={id}&t={token}`.
- **Pages** bullet (line 514): `app/project-builder/page.tsx` with `app/project-builder/layout.tsx` (the `.toolkit` wrapper), "its own chrome: `SiteNav` with the Project Builder item active, no back link, `ToolkitFooter`"; the rest of the bullet unchanged.
- **Copy** bullet: adds that `copy.ts` holds `PROJECT_BUILDER_PATH`, the one place the path is written.

Appended after the entry's Follow-ups list, a bold label **Moved to /project-builder, October 2026:** with four bullets: the page now lives at `/project-builder` with a "Project Builder" item between GTM Tools and Blog on every page that renders `SiteNav`; `next.config.ts` redirects `/tools/project-builder` permanently (308) to `/project-builder` and Next carries the query, so emailed resume links and `?src=` tags keep working, and the redirect must stay (removing it needs a migration, and browsers have cached the 308); every link is built from `PROJECT_BUILDER_PATH`; between 901 and 1100px the nav uses tighter spacing (24px side padding, 12px link padding) so six items fit, and above 1100px it is unchanged.

---

## 3. Data Flow

**Nav click, any page.** `SiteNav` renders the `Link`; a click is a client navigation to `/project-builder` (the mobile tap also closes the menu); the static page is served; `ProjectBuilderPage` restores from `localStorage` as today. The key `summit-project-builder-v3` is per origin, not per path, so drafts in progress before the move are still there.

**Old resume link from an email already sent.** The prospect opens `/tools/project-builder?b=...&t=...`; Next answers 308 to `/project-builder?b=...&t=...`; the browser follows; `ResumeLoader` under `Suspense` reads `b` and `t` with `useSearchParams` and GETs `/api/project-builder/briefs/{id}?t=` as before. Error paths are unchanged: a bad or old token is 403 and shows the invalid link line; an unknown id is 404.

**Old shared link with `?src=`.** Same redirect; the client reads `src` and records the source tag on first save as before.

**New emails.** Save link, confirmation, "Email me my link", unlock and reminder build `{origin}/project-builder?b={id}&t={token}`. The delete page's back link goes to `/project-builder`.

**Reset.** `reset()` clears local state and calls `replaceState` to `/project-builder`, which drops any `b`, `t` or `src` from the address bar on the new page.

**Hub.** `/tools` renders `BUILDER_BLOCK` with `href` `/project-builder`; the band and its copy are unchanged.

**Crawlers.** The sitemap lists `/project-builder` at 0.8; the canonical, `og:url` and ld+json `url` say the same; the old URL answers 308, so its index entry consolidates onto the new one.

---

## 4. Key Decisions

**4.1 The constant lives in `copy.ts`.** Alternatives: a new `app/lib/project-builder/paths.ts`, or `brief.ts`. `copy.ts` is what the spec names, is already imported by `ProjectBuilderPage`, is pure with no imports (so `hub-copy.ts` and `sitemap.ts` can load it under Node without pulling in anything else), and the path is a user facing address. A new module for one string is more surface than it earns.

**4.2 A sibling `layout.tsx` for `.toolkit`.** Alternative: a wrapping `div` inside the page. A layout mirrors `/tools`, keeps the page component's tree identical to today's, and leaves room for a later subpage without repeating the wrapper.

**4.3 Spacing band, not a breakpoint move.** Alternatives: raise the hamburger breakpoint to about 1000px (the 900px block also drives the hero, cards, footer and form layouts, so it would need a nav only query, and tablets in landscape would lose the row); tighten spacing at every width (changes the look on every desktop for no gain above 1100px); a smaller font or a shorter label (the spec forbids the label change, and the font change breaks parity with the other items). The band touches two declarations, only between 901 and 1100px, and leaves 50px or more spare at the narrowest case.

**4.4 The redirect destination is a literal in `next.config.ts`.** Importing the constant would need a value import of a `.ts` file from the config, which the file's comment forbids (the tests load it under Node type stripping, and Next's config loader is not set up for `.ts` extension imports). The new test asserts `destination === PROJECT_BUILDER_PATH`, so a drift fails `npm test`.

**4.5 A new test file for the redirect.** `scale-up-advisory.test.ts` must stay byte-identical, and the redirect belongs to the builder, so `__tests__/project-builder-path.test.ts` holds it with the constant check. The hub and sitemap checks stay in `gtm-toolkit.test.ts` where they already are.

**4.6 Three resume URL builders keep their own template.** Alternative: a shared `builderResumeUrl(origin, id, token)` helper. It would dedupe three lines, but it is a refactor of routes the spec says only change their path; each line changes by one substitution and the encoding stays visibly identical.

**4.7 `nowrap` on the nav items.** Without it, a squeezed row degrades into two line labels (measured above). With it, the labels stay on one line and the budget in 2.4 guarantees they fit.

**4.8 Keep `ToolkitFooter`.** The spec requires it. Its GTM Tools link stays dimmed (it is hard coded to mark /tools as the section); changing that would touch every tool page. Flagged in 7.

---

## 5. Constraints Honoured

| Constraint | How |
|---|---|
| No change to the builder's behaviour, copy, data, API routes, email wording, Notion writes or admin pages beyond the path | The only edits under `app/api`, `app/components/project-builder` and `app/lib/project-builder` are the six path substitutions and the new export; no wording, response shape, status code or field changes. |
| No change to the other tool pages, the /tools hub layout, or the GTM Tools nav item | `app/tools/layout.tsx`, `ToolkitHub.tsx`, `ToolRunner.tsx`, the Built to Scale pages and the GTM Tools `Link`s are untouched; only `BUILDER_BLOCK.href`'s value changes. The CSS band changes nav spacing between 901 and 1100px on every page, which the spec allows ("adjust the nav spacing"). |
| No new dependencies | None. |
| `scale-up-advisory.test.ts` byte-identical | Not edited; the redirect test is a new file. Check with `git diff main -- __tests__/scale-up-advisory.test.ts`. |
| Inline BRAND styles and `globals.css` classes, no Tailwind utilities; nav label in the same case and style | The item reuses `.nav-link` and `.nav-mobile-link` (uppercase by CSS); the label is written "Project Builder" like "GTM Tools". |
| British spelling, no em or en dashes, no hype words | New copy is the label and runbook lines only; the catalogue test covers `copy.ts`. |
| `app/lib/**` pure, relative `.ts` sibling imports, nothing from `next/*` or `react` | `copy.ts` gains a string and keeps no imports. |
| `next.config.ts` `import type` only | The redirect uses a literal. |
| Page stays static | Neither the page nor the layout reads `searchParams`; the query is read on the client as today. Gate: the build lists `/project-builder` as static. |
| Calibration | Not required: no rubric, prompt, model or scoring change. |

---

## 6. Out of Scope

- A Project Builder link in `ToolkitFooter` or the homepage footer, and un-dimming GTM Tools in `ToolkitFooter` on this page (shared footer; other tool pages must not change).
- An active state in the mobile menu (no item has one today).
- A helper for the three resume URL templates (4.6).
- Rewriting historical design, review, spec and PR documents that mention the old path.
- Any change to the builder's top spacing now that the back row is gone.
- Migrating or reissuing resume links already emailed; the redirect covers them.
- The pre-existing 375px horizontal scroll on `/tools` noted in the Release 1 follow-ups.

---

## 7. Risks and edge cases for the Reviewer

1. **Old emailed links.** Resume links sent before this change point at `/tools/project-builder?b=&t=`. They work only through the redirect and only because Next merges the query (2.5). The test pins `source`, `destination`, `permanent` and the absence of `has` and `missing`; a manual check after deploy should open one real old link. The tokens lapse after 30 days, but `?src=` tags and bookmarks do not, so the redirect stays for good; the runbook and the config comment say so.
2. **Cached 308.** Browsers cache a permanent redirect. If `/tools/project-builder` is ever wanted back, returning visitors will still be sent on. Intended.
3. **Homepage SPA.** The new item has no handler branch; confirm on `/` that it navigates to `/project-builder` on desktop and mobile while Resources, Blog and Careers still switch views in place, and that the mobile menu closes.
4. **Nav crowding.** Check the desktop row at 901, 1024, 1100, 1101, 1280 and 1440px on `/` (buttons) and `/tools` (anchors): one line, nothing clipped, no horizontal scroll, the CTA and admin icon visible. At 900px the hamburger shows. The band must sit before the 900px block in the file. Firefox and Windows render Barlow Condensed slightly differently; the narrowest margin is 51.8px.
5. **Static page.** The build output must list `/project-builder` as static (circle) and must not list `/tools/project-builder` at all.
6. **`.toolkit` styles.** Compare `/project-builder` with today's `/tools/project-builder`: same off white below the builder, same footer, same fonts. The only intended visual difference is the missing back row (and the nav highlight moving to Project Builder).
7. **`activePage === "tools"` for the builder.** The old page was the only place that passed `"tools"` for the builder; the new page passes `"project-builder"`. `ToolkitFooter` still dims GTM Tools unconditionally on this page (4.8); not a regression of this change but visible.
8. **Grep scope.** AC4's grep must exclude historical docs (2.6); the gtm-toolkit absence assertion is a deliberate hit.
9. **`hub-copy.ts` and `sitemap.ts` imports.** Both must import the constant with a relative `.ts` path, or `npm test` fails to load them under Node while `tsc` and the build still pass.
10. **Reset on the new page.** `replaceState` must use the constant; with the old literal, reset would write `/tools/project-builder` into the address bar and a refresh would bounce through the redirect.
11. **Delete page back link.** A relative `href`; confirm it lands on `/project-builder`.

### Gates

`npm test` (the new file, the updated gtm-toolkit and emails tests, `scale-up-advisory.test.ts` by name), `npm run lint` (0 errors), `npx tsc --noEmit`, `npm run build` (`/project-builder` static, no `/tools/project-builder`). Then against `npm run dev`: `/project-builder` renders with the item highlighted; `curl -sI "localhost:3000/tools/project-builder?b=x&t=y&src=z"` answers 308 with `location: /project-builder?b=x&t=y&src=z`; the nav widths in risk 4; the mobile menu at 375px; reset leaves the address at `/project-builder`. `git diff main -- __tests__/scale-up-advisory.test.ts` is empty. `npm run calibrate` not run.

---

## 8. Assumptions

- **A1.** The path is `/project-builder` and the label "Project Builder", between GTM Tools and Blog (spec notes).
- **A2.** The constant is `PROJECT_BUILDER_PATH` in `app/lib/project-builder/copy.ts` (4.1).
- **A3.** The mobile menu gets no active highlight, matching the other mobile items; "highlighted with the existing active style" applies to the desktop row, where `activeStyle` exists.
- **A4.** The fix for the 901px fit is the 1100px spacing band plus `nowrap`; the 900px breakpoint stays (4.3). If the team prefers the breakpoint move, the alternative is a nav only `@media (max-width: 1000px)` that hides `.nav-right` and shows `.nav-hamburger`, leaving the 900px block for page layout.
- **A5.** AC4's grep is read as covering code, tests, config and the runbook; historical documents under `docs/designs`, `docs/reviews`, `docs/specs` and `docs/pr-project-builder-1.md` keep the old path as written.
- **A6.** The gtm-toolkit test's assertion that the old sitemap URL is absent is a permitted grep hit alongside the redirect test (it is a test about the old address).
- **A7.** `ToolkitFooter` is used unchanged, dimmed GTM Tools link included (4.8).
- **A8.** No spacer replaces the removed back row; the builder's own 14px top padding is enough.
- **A9.** The redirect is exact on `/tools/project-builder` with no `:path*`; no subpaths have ever existed.
