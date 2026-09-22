# Design Document: Quality Gates Green (follow-up on `anthonystevenson0/scale-up-two-routes-outsourced-sales`)

**Task:** Make `npm test`, `npm run lint`, `npx tsc --noEmit` and `npm run build` pass without new dependencies or behaviour/visual changes, and bring `CLAUDE.md` Project-Specific Context and `docs/runbook.md` in line with reality.

**Baseline measured by the Architect (Node v25.9.0):**

| Gate | Status today |
|---|---|
| `npx tsc --noEmit` | passes (exit 0) |
| `npm run build` | passes (exit 0). `/` is prerendered **static** (○), which matters for the hydration decisions below |
| `npm test` | passes, but runs only `__tests__/scale-up-advisory.test.ts` (25 tests). `node --test "__tests__/*.test.ts"` fails on `gtm-toolkit.test.ts` (Jest globals) |
| `npm run lint` | **61 errors, 12 warnings.** 25 errors and 3 warnings are in `public/specs/icp-evaluator-prototype.jsx`. The other 36 errors and 9 warnings are in app code (breakdown in §1) |

Items 3 and 4 only need to *stay* green. The Coder re-runs both at the end.

---

## 1. Files to Modify / Create

### A. Test runner

**`package.json`** (only the `scripts.test` value)
- Change the test script to `node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON "__tests__/*.test.ts"`. The glob is in escaped double quotes inside the JSON string, so Node's own glob expansion handles it the same way on every platform. Do not use single quotes, which break on Windows npm.
- Node has supported globs in `node --test` since v21. The Architect confirmed it works on v25.9.0 and it is available on the required 22.18+.
- Do not touch dependencies, devDependencies or add an `engines` field (see §6).

**`__tests__/gtm-toolkit.test.ts`** (full rewrite into node:test style, same filename)
- Imports: `describe`/`test` from `node:test`, `assert` from `node:assert/strict`, and **relative imports with explicit `.ts` extensions**:
  - `../app/components/toolkit/data/fallbackPrompts.ts`
  - `../app/components/toolkit/data/toolConfig.ts`
  - `../app/components/newsletter/data/issues.ts`
  - `../app/tools/[tool]/toolSlugs.ts`: new import for the cross-check below. This module already loads under Node, because `scale-up-advisory.test.ts` imports it.
- Loadability: the Architect confirmed that `fallbackPrompts.ts`, `toolConfig.ts` and `issues.ts` have **no import statements at all**, and `toolSlugs.ts` has no runtime `@/` imports. No module restructuring is needed. Only erasable TS syntax is allowed in the test (type annotations, `as` / `as const` assertions). No enums, no namespaces, no parameter properties.
- Replace the header comment with one describing the node:test runner and `npm test`, in the same style as `scale-up-advisory.test.ts` lines 1–6.
- Suites and expectations, corrected to the current source of truth:
  1. **FALLBACK_PROMPTS**: keep as is. The keys `positioning, problem, persona, moat, account` all still exist (the `account` API route still consumes one), and each value is a string longer than 50 chars (actual lengths 392–440).
  2. **TOOLS config.** The truth: `TOOLS` feeds only the numbered cards 02–05 in `ToolkitHub.tsx` (comment "Tools 02–05 from config"). ICP is card 01, hardcoded in the hub as a `/tools/icp` Link. Account Intelligence is a separate hub section that is currently hidden via `HIDDEN_TOOL_SLUGS`. New assertions:
     - exactly 4 tools;
     - ids in order deep-equal `["persona", "problem", "positioning", "moat"]`, because the hub renders them in array order;
     - nums deep-equal `["02", "03", "04", "05"]`;
     - required-field test kept (truthy `id/num/name/tagline/outputDescription`; `surface` and `accent` match `/^#/`), using `assert.ok` and `assert.match`;
     - **new, meaningful cross-check:** every `TOOLS` id passes `isToolPublic`. The hub maps `TOOLS` to `/tools/${id}` without filtering, so a hidden or invalid id would ship a 404 card. Also assert that `"icp"` and `"account"` are *not* in `TOOLS`, since they are rendered separately and would otherwise show up twice.
  3. **Newsletter ISSUES**: keep every existing assertion: 4 issues; ids `["001","002","003","004"]`; required fields; body block `type` in `["p","h2","pullquote","rule"]`, with non-`rule` blocks having truthy `text`; at least 4 body blocks each. Verified against the data: body lengths are 8/9/9/11 and all fields are populated.
  4. **Brand palette**: update to the current values. Every tool's `surface.toLowerCase()` equals `"#0a1a14"` and every `accent.toLowerCase()` equals `"#319a65"`. Keep it as a per-id map keyed by the four current ids, so that adding a tool without a palette entry fails loudly (lookup is `undefined`, so strictEqual fails). Don't loop over a single constant.
  5. **"Input validation helpers" suite: delete.** Its four tests only assert on string literals built inside the test (`"a".repeat(4001).length > 4000`). They exercise no production code, so they pass whatever the routes do and give false confidence. Record this in the test header or PR notes.
- Jest-to-assert mapping for the Coder: `toBeDefined` → `assert.notEqual(x, undefined)`; `toBe` → `assert.equal` (strict in `/strict`); `toEqual` on arrays → `assert.deepEqual`; `toHaveLength(n)` → `assert.equal(arr.length, n)`; `toBeTruthy` → `assert.ok`; `toMatch` → `assert.match`; `toContain` on arrays → `assert.ok(arr.includes(x))`; `toBeGreaterThan(OrEqual)` → `assert.ok(a > b)` with a message.

### B. ESLint config

**`eslint.config.mjs`**
- Add `"public/**"` to the existing `globalIgnores([...])` list, with a comment saying `public/` holds static assets and design-spec prototypes (for example `public/specs/icp-evaluator-prototype.jsx`) that are served verbatim and are not app source. The Architect confirmed nothing in the repo imports anything under `public/specs/`. This clears 25 errors and 3 warnings.
- Add one config object after `...nextTs` that re-declares `@typescript-eslint/no-unused-vars` at **`"warn"`**, the same severity the Next preset uses today. Options: `argsIgnorePattern: "^_"`, `varsIgnorePattern: "^_"`, `caughtErrorsIgnorePattern: "^_"`, `destructuredArrayIgnorePattern: "^_"`, `ignoreRestSiblings: true`. The codebase already uses the `_name` convention to mean "intentionally unused" (`_systemPrompt` ×4, `_c`), but the preset doesn't honour it. This clears those 5 warnings without touching the files.

### C. `@next/next/no-html-link-for-pages` (30 errors across 7 files)

General rule for each of the 7 files below:
- Convert internal `<a href="/app-route">` to `Link` from `next/link`. Keep `href` (including the existing no-trailing-slash form), `className`, `style`, `onClick`, `title` and children exactly as they are. `Link` renders a plain `<a>` with those props, so the DOM and CSS selectors (`.footer-links a`, `.nav-link`) are unchanged.
- In each file, also convert the **unflagged sibling internal links in the same list or paragraph** (`/ai-studio`, `/loyalty-retail-media`, `/scale-up-advisory`). The rule flagged only some routes. Converting the whole group avoids one footer list mixing soft and hard navigation.
- **Leave as `<a>`:** external URLs (`BOOK_URL`, `target="_blank"`), `/admin` (not flagged; middleware-guarded), and the `/?page=…` links (see below).
- `Link` works in server components, so no `"use client"` changes are needed. Add `import Link from "next/link";` where it is missing.
- Rewrite-to-external-app links: the Architect confirmed there are **no** `/AIWritingLab` links anywhere in `app/`, so no exception is needed. If one ever appears, it must stay `<a>` with a justified disable, because `next.config.ts` rewrites it to a separate Vercel app.

Per file:

| File | Change |
|---|---|
| `app/components/SiteNav.tsx` | Lines 63 and 109 `/tools`: convert to `Link` (keep `className`, `style`, and the mobile `onClick={() => setMenuOpen(false)}`). Lines 60, 68, 74, 106, 114 and 120 `/?page=resources|blog|careers`: **keep `<a>`** and put a JS line comment `// eslint-disable-next-line @next/next/no-html-link-for-pages -- <reason>` directly above each. These `<a>` elements sit in the `) : (` branch of a ternary, which is a JS expression context, so a `//` comment is valid there. Do **not** use `{/* */}`, which would add a second child to the parenthesised expression and fail to compile. Reason text: the homepage SPA reads `?page=` from `window.location.search` once on mount, so a full document load is intentional. `/admin` stays `<a>`. |
| `app/components/toolkit/ToolkitFooter.tsx` | Lines 18–24: convert all seven to `Link` (hrefs unchanged, including the several placeholder `href="/"` entries; see §6). Keep the inline `style` on the `/tools` item. |
| `app/components/newsletter/NewsletterHub.tsx` | Lines 17–22: convert all six footer links to `Link`. |
| `app/tools/[tool]/page.tsx` | Lines 142 (`/tools`) and 146 (`/`): convert to `Link`, keeping `style`. |
| `app/ai-studio/page.tsx` | Line 139 (`/`), lines 217 and 219 (`/tools/icp`, `/tools/problem`), and footer lines 302–306 (all five internal routes): convert to `Link`. Line 291 `BOOK_URL` stays `<a>`. |
| `app/loyalty-retail-media/page.tsx` | Line 136 (`/`), line 218 (`/tools/positioning`), and footer lines 260–264: convert to `Link`. Line 249 `BOOK_URL` stays `<a>`. |
| `app/page.tsx` | `Link` is already imported. Entity block lines 744, 746, 748 and 752, and footer lines 904, 905, 906 and 908: convert to `Link`. The footer `<button>`s stay. |

### D. `react-hooks/set-state-in-effect` (4 errors)

**`app/components/toolkit/shared/ScoreGauge.tsx`** (line 31) and **`app/components/icp-evaluator.tsx`** (line 61, its local copy of `ScoreGauge`): the same fix in both.
- Remove the synchronous `setDisplayScore(score)` branch. At the top of the effect, when `!animated`, just return. Keep `[score, animated]` as the deps.
- Derive the rendered value: `shownScore = animated ? displayScore : score`. Use `shownScore` for both the dash `offset` calculation and the `<text>` number. `grade` still derives from `score`, as today.
- Why this is equivalent: when `animated` is false the output is `score` from the first render. That is the same as today after the effect commits, but one render sooner. The animated path is untouched, because the `setDisplayScore` calls inside the rAF callback are asynchronous and not flagged. No caller passes `animated={false}` today (the 5 call sites all use the default `true`), so there is no visible change.

**`app/components/toolkit/shared/ToolShareButtons.tsx`** (line 32)
- Replace the `canNativeShare` `useState` + `useEffect` pair with `useSyncExternalStore` (built into React 19, not a new dependency). Use three **module-level** functions so the identities are stable:
  - `subscribe`: a no-op that returns a no-op unsubscribe, since share capability never changes during the session;
  - `getSnapshot`: `typeof navigator !== "undefined" && typeof navigator.share === "function"`;
  - `getServerSnapshot`: `false`.
- Why this is equivalent: the server and hydration render both use `false`, which matches today's initial state, so there is no hydration mismatch. React then re-renders with the client snapshot, which is the same post-hydration flip the effect produced. Update the React import to drop `useEffect`, keep `useState` (still used by `copied`) and add `useSyncExternalStore`.

**`app/page.tsx`** (line 862, `Summit` mount effect)
- **Keep the effect and add a justified disable.** The effect reads `window.location.search` after hydration. `/` is statically prerendered with no query string, so a lazy `useState` initialiser would produce a server/client hydration mismatch. `useSyncExternalStore` would work, but it would mean splitting `page` into a URL-derived value plus a `nav()` override, which rewires the SPA's core state for no user benefit.
- To keep this to one disable line, compute `initial = tool || section` first and then do a single `if (initial) setPage(initial)`. That keeps the precedence (`tool` beats `page`) and the falsy semantics (an empty `?tool=` falls through, as today). Put `// eslint-disable-next-line react-hooks/set-state-in-effect -- <reason>` on the line directly above that `setPage` call. Reason text: syncs from `window.location` (an external system) after hydration of a static page, where a lazy initialiser would mismatch. The `/api/track-visit` fetch and the `[]` deps stay unchanged.

### E. Other app-code lint items

**`app/page.tsx`**, line 118 `catch (err: any)` (`no-explicit-any` error)
- Change to an untyped `catch (err)` (implicitly `unknown`) and set the error message to `err instanceof Error && err.message ? err.message : "Something went wrong. Please try again."`. Every value thrown in this `try` is an `Error` (the explicit `throw new Error(...)`, a fetch `TypeError`, or a JSON `SyntaxError`), so the user-visible result is the same.

**`app/components/icp-evaluator.tsx`**, line 169 `onBack` unused (warning)
- Rename in the destructure only: `{ onBack: _onBack, onBookCall }`. Keep the prop type unchanged, because `ToolRunner.tsx` still passes `onBack` and the public prop contract stays the same. The new `^_` pattern from §B silences it.

**`app/api/evaluate-icp-details/route.ts`**, line 9 `DIMENSION_KEYS` unused (warning)
- Delete the unused constant. It is local to this module (the `evaluate-icp` route has its own copy, which is still used).

**`app/api/evaluate-icp/route.ts`**, dead helpers (2 warnings)
- Delete `parseJsonFromResponse` (lines 225–265). Its only dependents are the types `DimensionReasoning` (line 20) and `EvaluateResponse` (line 26), which nothing else uses, so delete both. **Do not** delete `DIMENSION_KEYS` here: it is still used at lines 371 and 377.
- Delete `extractTextFromDocBody` (lines 50–90). This orphans `extractParagraphText` (line 39), whose only callers are inside `extractTextFromDocBody`, so delete it too.
- Before deleting each symbol, grep the route file (and `app/` generally) to confirm there are no other references. Re-run lint afterwards to catch any further cascade, such as helper types that are now unused.

### F. Documentation

**`CLAUDE.md`**: edit only the `## Project-Specific Context` section.
- `Language / runtime` → `TypeScript / Node 22.18+ (required: npm test uses Node's native TypeScript type stripping; 23.6+ also works)`.
- `Framework` → `Next.js 16 (App Router) / React 19`.
- `Database` line: keep the user's uncommitted Upstash Redis line **exactly as it is**.
- `Test framework` → `Node built-in test runner (node:test + node:assert/strict) via npm test. Jest is not installed`.
- `### CI / Quality Gates` → a list of `npm test` (Node test runner, all `__tests__/*.test.ts`), `npm run lint` (ESLint, 0 errors), `npx tsc --noEmit`, and `npm run build`.
- Leave every other line in the section, and everything outside it, unchanged. Edit with targeted replacements, not a whole-file rewrite, so the rest of the uncommitted working-tree state is preserved.

**`docs/runbook.md`**: the "Running the tests" subsection (around lines 137–146).
- Code block: `npm test` comment becomes "node:test, runs every `__tests__/*.test.ts`". Add `npm run lint` (ESLint; `public/**` is ignored). Keep the `tsc` and build lines.
- Node bullet: keep the ≥ 22.18 / ≥ 23.6 requirement. Drop "despite the project context listing Node 20", because CLAUDE.md now says so.
- Replace the "Jest is not installed…" bullet with a short note: tests use `node:test`. Imports in tests must be relative with explicit `.ts` extensions. Imported modules must not have runtime `@/` alias imports (Node can't resolve them; type-only imports are fine because they are stripped). `gtm-toolkit.test.ts` now runs and pins the hub's `TOOLS` cards (02–05) to public tool slugs.
- Add one line on lint conventions: prefix intentionally unused vars and args with `_`. `/?page=` links in `SiteNav` stay `<a>` on purpose.
- Keep the stale `.next/types/* 2.ts` bullet.

---

## 2. Integration Points

- `npm test` → `node --test` expands `__tests__/*.test.ts` → both files run in the same process and module cache.
- `gtm-toolkit.test.ts` → data modules (pure literals) and `toolSlugs.ts` (`isToolPublic`, `TOOL_SLUGS`). These are the same sources `ToolkitHub.tsx` and `ToolRunner.tsx` consume, so the test pins the hub-card-to-route contract.
- `eslint.config.mjs` → the flat config order is `nextVitals` → `nextTs` → the rule override object → `globalIgnores`. The override must come **after** `...nextTs`, or the preset re-applies its default options.
- `Link` in server components (`ai-studio`, `loyalty-retail-media`, `tools/[tool]/page.tsx`, `ToolkitFooter`) and in client components (`SiteNav`, `NewsletterHub`, `page.tsx`) needs no boundary changes.
- `ToolShareButtons` is used by 5 tool components with an unchanged props API. `ScoreGauge` is used by 4 tool components, and `icp-evaluator`'s local copy by 1, all with unchanged props.

## 3. Data Flow

- **Tests:** static literals → imported under Node type stripping → asserted. Error path: a stale expectation or unresolvable import makes `node --test` report failure and exit non-zero.
- **Home deep links:** a non-home page's `SiteNav` `<a href="/?page=blog">` triggers a full document load → static `/` HTML → hydration (`page="home"`) → mount effect reads the query → `setPage("blog")`. This is identical to today.
- **Internal Links:** a click triggers client-side navigation to the same URL, and prefetch warms static routes in production. The rendered route and markup are the same. Modified-clicks (cmd/ctrl, middle-click) still open new tabs, because `Link` defers to the browser for those.
- **Share button:** server `false` → hydration `false` → client snapshot → a `true` re-render on capable devices.
- **Gauge:** with `animated` true, rAF drives the count-up from 0 as today. With `animated` false, `score` is rendered directly.

## 4. Key Decisions

| Decision | Alternatives | Rationale |
|---|---|---|
| Rewrite `gtm-toolkit.test.ts` to node:test | Install Jest or Vitest; delete the file | No new dependencies without approval; this matches the existing test's approach and keeps real coverage. |
| TOOLS expected = 4 ids, 02–05, public | Put ICP/account back into `toolConfig` to satisfy the old test | The hub deliberately renders ICP and Account separately. Changing the source to match a stale test would duplicate cards (a behaviour change). |
| Delete the "Input validation helpers" tests | Keep them converted verbatim | They test no production code. Real route-validation tests would need logic pulled out of `next/server` route modules, which is out of scope. |
| Ignore `public/**` in ESLint | Fix the 25 prototype errors; per-file disable | It's a served static design spec, not source, and nothing imports it. Linting static assets adds noise with no benefit. |
| `^_` ignore patterns in config | Rename or remove each var; inline disables | This honours the convention the code already uses. Removing `_systemPrompt` would change component prop destructuring for no gain. |
| Keep `/?page=` as `<a>` + disable | Convert to `Link` | The homepage state is initialised from the URL only on mount. Soft navigation timing (history update vs. child effect) and router-cache reuse could leave the wrong section showing. A full load is today's behaviour and is guaranteed correct. |
| Convert unflagged sibling links too | Convert only flagged anchors | Consistent navigation within a single list; zero markup difference. |
| `useSyncExternalStore` for `navigator.share` | Lazy initialiser (hydration mismatch); disable | This is the idiomatic React 19 answer for reading browser capabilities, and it is hydration-safe. |
| Derive the gauge value | Disable the rule | A trivial, provably equivalent refactor. |
| Disable for the `page.tsx` mount effect | `useSyncExternalStore` + override state; `useSearchParams` (needs a Suspense boundary on a static page) | Both alternatives restructure the SPA's central state or its render boundary. A disable with a reason is the lowest-risk way to preserve behaviour. |
| Delete dead helpers in API routes | Leave the warnings | Easy, `tsc` and lint catch any mistake, and there are no runtime callers. |

## 5. Constraints Honoured

- **No new dependencies:** only `node:test`, `node:assert/strict`, `next/link` and React's `useSyncExternalStore`, all already available. `package.json` changes only `scripts.test`.
- **No behaviour or visual changes:** `Link` renders identical `<a>` markup, and `/?page=` hard loads are preserved. The gauge, share button and home-state changes are each argued equivalent in §1D. The `catch` change keeps the same messages. Deleted code has no callers. Soft navigation in place of a full reload for internal links is the intended outcome of the lint rule and is not a visible change. The Reviewer should accept it as such.
- **Secrets via env only:** no secrets are touched.
- **Conventions:** no new CSS; the utility and test filenames are unchanged.
- **CLAUDE.md:** only the Project-Specific Context section changes, and the user's Upstash line is preserved verbatim.

**Risks for the Reviewer to check:**
1. `//` vs `{/* */}` placement for the disables inside the SiteNav ternaries (a compile error if wrong).
2. The ESLint override must come after `...nextTs`, and severity must stay `warn`.
3. The `evaluate-icp` deletion cascade: `DIMENSION_KEYS` must survive.
4. `ToolShareButtons` snapshot functions must be module-level (inline functions resubscribe every render).
5. The npm test glob must be quoted in a way that works on Windows.
6. Run all four gates at the end: `npm test` (expect both files, 0 failures), `npm run lint` (0 errors; ideally 0 warnings), `npx tsc --noEmit`, and `npm run build`.

## 6. Out of Scope

- **Placeholder `href="/"`** for AI Studio, Scale-Up Advisory, Resources and Blog in `ToolkitFooter.tsx`: a pre-existing content bug. Fixing it changes navigation targets. Suggest a follow-up.
- **`engines.node` in `package.json`:** Vercel reads it to pick the production Node version, so adding it could change the deploy runtime. That is a team decision.
- **Bumping `@types/node` from ^20 to ^22:** a dependency change that needs approval.
- **`middleware.ts` → `proxy.ts` deprecation warning** during build: not a gate failure, and it's a framework migration.
- **Cancelling in-flight rAF on unmount or score change** in both gauges: a pre-existing minor leak. Fixing it is a behaviour change, however small.
- **Duplicate `ScoreGauge` in `icp-evaluator.tsx`** versus the shared one: consolidating it is a refactor. Only the lint fix is applied.
- Real unit tests for API route input validation, which would need logic extracted from `next/server` modules.
- `public/specs/icp-evaluator-prototype.jsx` content is unchanged; it is only ignored by lint.
