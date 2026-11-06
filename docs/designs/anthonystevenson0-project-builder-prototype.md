# Design: Project Builder "Prototype so far"

Branch: `anthonystevenson0/project-builder-prototype`. Task: `task-spec.md` (acceptance criteria 1 to 24, 21a to 21e). Architect output only: no code.

## 0. Shape of the change

A prospect with a saved brief presses "Create prototype" (later "Update prototype") in a second dock tab. The client posts the current brief state to `POST /api/project-builder/prototype`. The server saves that state, works out whether anything has changed since the last prototype (a hash of the prototype relevant fields), reads the company's house style once per website host through the existing Ask Summit crawler, asks the model (routing key `builder-prototype`) for a self contained HTML document, or for search and replace edits to the current one, validates it, runs a safety pass, stores it at `brief-prototype:{id}` and returns it. The client shows it in a sandboxed `srcdoc` iframe. The resume link, the read only view, the admin brief page, the save, confirmation and alert emails and the Notion page all reach the saved prototype.

Alongside it, the Save sheet drops to name and email (`validateContact` gains a save mode), Submit still asks for company and website, the save email reports progress, and a `view=prototype` query parameter on the resume link opens the prototype tab.

Work splits into seven phases (the Coder may land them in order, each with its tests):

- A. Pure modules: `prototype.ts`, `prototype-html.ts`, `house-style.ts` and their tests.
- B. Contact save mode, copy, prompts, schemas, emails, Notion builder, stats and their test updates.
- C. Routing key, `llm.ts` timeout option, limiter, events, crawler extensions, brief store.
- D. `house-style-read.ts`, `prototype-run.ts`, the route, the changes to the existing routes.
- E. The page: dock tab, viewer, frame, Save sheet, Submit step, read only view, CSS.
- F. Admin: brief page section, full screen page, stats table, models fallback.
- G. Docs (Docs agent): runbook entry.

---

## 1. Files to Modify / Create

### Create

| File | What and why |
|---|---|
| `app/lib/project-builder/prototype.ts` | Pure, client safe: the prototype snapshot of a brief, its hash, the readiness check and line, the change description between two snapshots, the "large change" rule, website resolution (21b), the shared constants (caps, sandbox value, query parameter) and the record and view types. One definition used by the page, the route and the tests. |
| `app/lib/project-builder/prototype-html.ts` | Pure: `applyEdits` (port of Canvas `applyCanvasEdits`), `validatePrototypeHtml` (port of Canvas `validateHtml` plus two checks), the safety pass, the CSP string, head injection, the size cap and `renderPrototypeDocument` (logo substitution for serving). |
| `app/lib/project-builder/house-style.ts` | Pure: the `HouseStyle` shape, the neutral style, the Google Fonts allow list, extraction of logo candidates, stylesheet links, colours, fonts and tagline from HTML and CSS text, logo byte checks (magic bytes, type, 200 KB), SVG sanitising, the data URI builder and the font stylesheet URL. |
| `app/lib/project-builder/house-style-read.ts` | Server only: `readHouseStyle(website, opts)` drives the existing crawler (`fetchRobots`, `crawlSite` with a three page cap and raw HTML kept, `fetchAsset` for stylesheets and the logo) under a deadline and returns a `HouseStyle` via the pure functions. Never throws. |
| `app/lib/project-builder/prototype-run.ts` | Server only: the generation orchestration (style, create or update, edit then fallback, one corrective round, safety, store) under the route's deadline. Keeps the route thin and the time budget in one place. |
| `app/api/project-builder/prototype/route.ts` | `POST`: auth, limiter, readiness, save state, up to date short circuit, caps, lock, `runPrototype`, response. |
| `app/components/project-builder/PrototypeDock.tsx` | Client: the "Prototype so far" bar and panel, the button states, the staged loading lines, the style note, the error line, the viewer. |
| `app/components/project-builder/PrototypeViewer.tsx` | Client: the mockup label, the frame, "Open full screen" as a fixed overlay with Close and Escape. Used by the dock panel and the read only view. |
| `app/components/project-builder/PrototypeFrame.tsx` | No hooks, no `"use client"`: the one `<iframe srcDoc sandbox="allow-scripts">` with title, `referrerPolicy="no-referrer"`, empty `allow`. Importable from server pages (admin) and client components, so the sandbox attribute is written in one place. |
| `app/admin/briefs/[id]/prototype/page.tsx` | Server page behind the admin middleware: the brief's prototype full viewport with a back link. The admin "Open full screen" target, no client JavaScript. |
| `__tests__/project-builder-prototype.test.ts` | Readiness, hash, snapshot changes, large change rule, website resolution, sandbox constant. |
| `__tests__/project-builder-prototype-html.test.ts` | Edit applier, validator, safety pass (each banned construct, CSP first), size cap, logo substitution. |
| `__tests__/project-builder-house-style.test.ts` | Logo candidates, colours, fonts, tagline, logo type and size checks, SVG sanitiser, font URL. |

### Modify

| File | What and why |
|---|---|
| `app/lib/ask-summit/crawler.ts` | Export `fetchRobots`; `CrawlOptions` gains optional `maxPages`, `keepHtml` and `robots` (pre fetched rules); `CrawledPage.html` filled only when `keepHtml`; new export `fetchAsset` (one GET with the crawler's user agent, timeout, redirect and host rules, a streamed byte cap and a content type check); new export `crawlerUserAgent()` so the user agent has one definition. Ask Summit behaviour is unchanged when the new options are absent. |
| `app/lib/ask-summit/crawl-rules.ts` | `CrawledPage` gains optional `html?: string`; new constant `PAGE_HTML_CAP = 500_000`. |
| `app/lib/ask-summit/validation.ts` | Export the existing host block rule as `isPublicHostname(hostname)` (the negation of `isBlockedHost`) so `fetchAsset` checks asset hosts and redirect targets with the same rule as the form. |
| `app/lib/ask-summit/process.ts` | `userAgent()` delegates to `crawlerUserAgent()`. No behaviour change. |
| `app/lib/tools/registry.ts` | `ROUTING_TASKS` gains `"builder-prototype"`. |
| `app/lib/llm.ts` | `DEFAULT_ROUTES`, `TASK_LABELS`, `TASK_DESCRIPTIONS` gain `builder-prototype`; `CallModelArgs` gains optional `timeoutMs` passed as the per request timeout; header comment lists the new key. Still the only file with a model id. |
| `app/api/admin/models/route.ts`, `app/admin/models/ModelsClient.tsx` | Allow a fallback on `builder-prototype` as on `synthesis` and `builder-read`. |
| `app/lib/ratelimit.ts` | `getBuilderPrototypeLimiter()`: 6 per IP per hour, prefix `rl:builder-prototype`. |
| `app/lib/events.ts` | `EventName` gains `builder_prototype_run` and `builder_prototype_style`. |
| `app/lib/briefs.ts` | `BriefRecord` gains `prototypeAt`, `prototypeHash`, `prototypeCount`; keys `brief-prototype:{id}`, `brief-style:{id}`, `brief-prototype-lock:{id}`; get and save functions; TTL follows the brief; delete removes both keys; counter union gains `prototypeCount`. |
| `app/lib/project-builder/brief.ts` | `validateContact(raw, mode = "submit")` with a `"save"` mode; `CONTACT_ERRORS.saveMissing`; `PROTOTYPE_RUNS_PER_BRIEF = 10` beside the other caps. |
| `app/lib/project-builder/prompts.ts` | `houseStyleBlock`, `prototypeCreatePrompt`, `prototypeEditPrompt`, `prototypeFixPrompt`. |
| `app/lib/project-builder/schemas.ts` | `prototypeSchema` and `parsePrototype`; `prototypeEditsSchema` and `parsePrototypeEdits`. |
| `app/lib/project-builder/copy.ts` | `PROTOTYPE` copy block; Save sheet lede for name and email; `DOCK.tabBlueprint` stays "Your blueprint". |
| `app/lib/project-builder/emails.ts` | Save link email: progress lines, prototype status line, labelled "Carry on with your project" link, optional "View your prototype" line; confirmation and alert: optional prototype line. |
| `app/lib/project-builder/notion-brief.ts` | `BriefPageArgs.prototypeUrl` and `prototypeAdminUrl`; a "Prototype" section with linked paragraphs when present. |
| `app/lib/project-builder-notion.ts` | `pageArgs`, `createBriefPage`, `updateBriefPage` take an optional `{ prototypeUrl, prototypeAdminUrl }`. |
| `app/lib/project-builder/stats.ts` | `StatsTables.prototypes` counted from the two new events. |
| `app/admin/stats/page.tsx` | Render the prototypes table. |
| `app/api/project-builder/brief-auth.ts` | `BriefLinks.prototypeUrl` (the resume URL plus `&view=prototype`); `adminPrototypeUrlFor(origin, id)`. |
| `app/api/project-builder/briefs/route.ts` | Contact validated in save mode; save email gets progress and (normally absent) prototype info. |
| `app/api/project-builder/briefs/[id]/route.ts` | GET returns `prototype` (served view or null), `prototypeCount`, `styleStatus`; PUT validates a contact in save mode. |
| `app/api/project-builder/briefs/[id]/submit/route.ts` | Optional `contact` in the body; the resulting contact must pass submit mode (400 with `needContact: true`); links computed before Notion; prototype line in both emails; prototype links in the Notion body. |
| `app/api/project-builder/link/route.ts` | Resent save email carries progress and the prototype line when `prototypeAt` is set. |
| `app/components/project-builder/ProjectBuilderPage.tsx` | Dock state becomes `null`, `"blueprint"` or `"prototype"`; prototype state and generation; pending generation after a first save; `view` parameter on resume; Save and Submit contact modes; toast offset. |
| `app/components/project-builder/BlueprintDock.tsx` | Renders as a tab inside the shared dock wrapper (class `pb-dock-tab` instead of `pb-dock`); props unchanged. |
| `app/components/project-builder/SaveSheet.tsx` | Passes `mode="save"` to `ContactFields`. |
| `app/components/project-builder/ContactFields.tsx` | `mode: "save" or "submit"`: save shows name, email, consent and marketing; submit shows all four (only the missing two when `onlyMissing` is set). |
| `app/components/project-builder/StepSubmit.tsx` | When saved but company or website is missing, shows those two fields above Submit; prefills the website from Step 1 or the email domain. |
| `app/components/project-builder/ReadOnlyView.tsx` | Optional `prototype` prop: a "Your prototype" section with the viewer, anchor id `pb-prototype`. |
| `app/admin/briefs/[id]/page.tsx` | Prototype section (meta, frame, full screen link) and the count in "Counts". |
| `app/globals.css` | Dock wrapper and tab classes, prototype panel, full screen overlay, extra page bottom padding for two bars. |
| `__tests__/routing.test.ts` | `DEFAULTS` gains `builder-prototype` (the `Record<RoutingTask, ...>` type requires it); assert it is not calibration gated. |
| `__tests__/project-builder-brief.test.ts` | Save mode cases. |
| `__tests__/project-builder-emails.test.ts` | Progress and prototype lines. |
| `__tests__/project-builder-notion.test.ts` | Prototype section present only with a URL. |
| `__tests__/project-builder-stats.test.ts` | Prototype counts. |
| `__tests__/project-builder-prompts.test.ts` | The three prototype prompts and two schemas. |
| `docs/runbook.md` | Docs agent: Project Builder section entry. |

Not touched: `next.config.ts` (the `/tools/project-builder` redirect), any Tailwind config, `package.json`.

---

## 2. Integration Points

### 2.1 Pure module `prototype.ts`

Constants:

- `PROTOTYPE_SANDBOX = "allow-scripts"`.
- `PROTOTYPE_VIEW_PARAM = "view"`, `PROTOTYPE_VIEW_VALUE = "prototype"` (deep link `?b=..&t=..&view=prototype`).
- `PROTOTYPE_HTML_MAX_CHARS = 90_000` (the stored document without the logo).
- `PROTOTYPE_SCREENS_MIN = 3`, `PROTOTYPE_SCREENS_MAX = 5`, `PROTOTYPE_EDITS_MAX = 40`.
- `LARGE_CHANGE_LINES = 12`.

Types:

- `PrototypeSnapshot`: the prototype relevant subset of `BriefState`, normalised: `name`, `idea`, `path`, `problem`, `audience`, `success`, `roles` (sorted), `features` (sorted `key:pri` pairs), `custom` (text, pri, cat; in order), `integrations` (sorted) plus `intOther`, `sso`, `perms`, `audit`, `personal`, `compliance` (sorted), `scale`, `uptime`, `run`, `handover` (sorted), picked ideas (title, what, priority; ideas marked "no" excluded), `rep` (`sys`, caps as sorted pairs, extra titles, reasons sorted), `biz.notes`, `website` (normalised domain of `biz.website`). Excluded on purpose: `step`, sources (`featSrc`, `intSrc`, `src` on custom rows), `ideasKey`, `ideaSeq`, `unplaced`, timing, budget, residency, signoff, built flags. Rationale: those do not change what the screens show; including `step` would mark the prototype out of date on every step change.
- `PrototypeRecord` (stored): `html` (sanitised, with `{{LOGO}}` placeholder, CSP and font link already injected), `hash`, `snapshot`, `createdAt`, `updatedAt`, `version` (1 on create, +1 per update), `lastMode` (`"created"`, `"edited"`, `"rebuilt"`), `model` (the model that produced the final HTML), `routingKey` (`"builder-prototype"`), `calls` (array, last run only: `{ kind: "create" | "edit" | "rebuild" | "fix", model, ms, ok }`), `styleHost` (the host the style came from, or null).
- `PrototypeView` (sent to the browser): `html` (served document, logo substituted), `hash`, `updatedAt`, `version`, `styleStatus` (`"found" | "partial" | "none"`), `styleNote` (one line from copy, empty when found).

Functions:

- `prototypeSnapshot(state)`: the snapshot.
- `prototypeHash(state)`: `cyrb53` (53 bit, pure JS) over the canonical JSON of the snapshot (keys in a fixed order), as a 14 character hex string with a `p1-` version prefix. Pure JS so the browser computes the same value synchronously; `node:crypto` is not available in the client bundle and SubtleCrypto is async. Collision risk is irrelevant for a "has anything changed" check.
- `prototypeReadiness(state)`: `{ ready, missing: Array<"description" | "goalOrFeature"> }`. Description: `idea`, `biz.notes`, or on the replace path `rep.sys`. Goal or feature: `problem`, `success`, any feature, any custom row with category Feature, any picked idea, or any replace capability. Copy picks the line (section 2.13).
- `describeChanges(before, after)`: plain lines ("Added feature: Approvals (Must)", "Removed user type: Managers", "Project name is now Garage CRM", "Added connection: Spreadsheets", "Changed priority: Dashboards from Should to Must", "Business notes changed"). Used in the edit prompt.
- `isLargeChange(before, after)`: true when `before` is null (old record), when `path`, `idea` or `website` changed, or when `describeChanges` returns `LARGE_CHANGE_LINES` or more lines.
- `resolvePrototypeWebsite(state, contact)`: first of `normaliseDomain(biz.website)`, `normaliseDomain(contact.website)`, the email domain when `!isFreeMailAddress(email)`; each candidate must pass `validateWebsiteUrl` (blocks localhost, IP literals, `.local`, `.internal`, bare names); returns `{ url: "https://{domain}/", host }` or null.

### 2.2 Pure module `prototype-html.ts`

- `LOGO_PLACEHOLDER = "{{LOGO}}"`.
- `PROTOTYPE_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:; base-uri 'none'; form-action 'none'"`. The spec's five directives plus `base-uri` and `form-action`, which only tighten it (decision 4.6).
- `ALLOWED_URL_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"]`.
- `applyEdits(html, edits)`: the Canvas function, in order, each `old_str` must match exactly once in the document as it stands; an empty `old_str` is an error; throws `EditApplyError` naming the edit number; returns the new string only when all apply.
- `validatePrototypeHtml(html)`: issues array, empty means pass. Ported checks: protocol markers (`<edits>`, `<edit>`, `<search>`, `<replace>`, `<rewrite>`), exactly one `<html`, exactly one `<body`, at most one `<head`, balanced `<style>`, balanced `<script>`, duplicate ids (first eight). Added: the number of elements with a `data-screen` attribute is between 3 and 5; the length is at most `PROTOTYPE_HTML_MAX_CHARS` (measured after the safety pass with the placeholder, so the logo never counts). Issue strings are plain English sentences so they can go straight back to the model.
- `sanitisePrototypeHtml(html, fontHref)`: the safety pass (section 3.6). Idempotent.
- `renderPrototypeDocument(storedHtml, logoDataUri)`: replaces `{{LOGO}}` only inside `src="..."` attribute values with the data URI (or, without a logo, removes the `<img>` whose `src` is the placeholder and leaves its `alt` text as a span), then runs `sanitisePrototypeHtml` again as defence in depth. This is what every reader serves.

### 2.3 Pure module `house-style.ts`

- `HouseStyle`: `status` (`"found"` when a logo and at least one colour or font came through, `"partial"` when some of it did, `"none"`), `reason` (`""`, `"no-website"`, `"unreadable"`, `"nothing-usable"`), `host`, `readAt`, `siteName`, `tagline` (at most 160 characters, dashes made plain), `colours` (one to three `#rrggbb`), `background`, `text`, `headingFont` and `bodyFont` (`{ family: string | null, stack: string }`, `family` only from the allow list), `logo` (`{ dataUri, mime, bytes } | null`).
- `NEUTRAL_HOUSE_STYLE`: white background, `#1F2A37` text, one accent `#2F5D7C`, Inter for both, no logo.
- `GOOGLE_FONTS`: a fixed list of about 45 common families (Inter, Roboto, Open Sans, Lato, Montserrat, Poppins, Source Sans 3, Nunito, Nunito Sans, Raleway, Work Sans, DM Sans, Manrope, Rubik, Noto Sans, PT Sans, Mulish, Barlow, IBM Plex Sans, IBM Plex Serif, Karla, Figtree, Plus Jakarta Sans, Outfit, Space Grotesk, Oswald, Playfair Display, Merriweather, Lora, Libre Baskerville, Source Serif 4, Fraunces, EB Garamond, Crimson Pro, Archivo, Hind, Quicksand, Josefin Sans, Cabin, Bitter, Roboto Slab, Ubuntu, Heebo, Lexend, Sora, Urbanist, Red Hat Display, Cormorant Garamond).
- `findLogoCandidates(html, pageUrl)`: absolute http(s) or `data:image/` URLs and inline SVG markup, in this order: an `<img>` whose `src`, `alt`, `class` or `id` contains "logo" (first one in document order; one inside `<header>` wins); an inline `<svg>` whose `class`, `id` or `aria-label` contains "logo"; `link rel="apple-touch-icon"`; `link rel="icon"` with type SVG or the largest `sizes`; `meta property="og:image"`. At most four. Order rationale in 4.4.
- `findStylesheetLinks(html, pageUrl)`: `<link rel="stylesheet" href>` absolute URLs, same host first, at most three.
- `extractColours(html, cssTexts)`: `meta name="theme-color"` first; then values of custom properties whose name contains `primary`, `brand`, `accent`, `main` or `secondary`; then the most frequent hex, `rgb()` and `hsl()` colours across inline `style` attributes, `<style>` blocks and the stylesheets. Normalised to `#rrggbb`, near white, near black and low saturation greys dropped, near duplicates merged; at most three.
- `extractFonts(html, cssTexts)`: families from a Google Fonts `link` on the page (strongest signal), then `font-family` on `body`, `html`, `:root` and `h1` to `h3` rules and `--font*` custom properties. The first family on the allow list wins for each role; otherwise the generic stack: serif (`Georgia, 'Times New Roman', serif`) when the declaration's generic is `serif`, else the system sans stack. Font names never reach the prompt unless on the allow list.
- `extractTagline(html, pageTexts)`: `og:description`, then `meta name="description"`, then the first `<h1>` text; trimmed to 160 characters at a word. `siteName` from `og:site_name`, else the title before a separator.
- `checkLogoBytes(bytes, contentType)`: magic bytes decide: PNG (`89 50 4E 47`), JPEG (`FF D8 FF`), WebP (`RIFF` .... `WEBP`), SVG (text whose first element after an optional XML prolog and comments is `<svg`). Content type must not contradict (an `image/png` header on JPEG bytes is refused). More than 204,800 bytes is refused. GIF, ICO, AVIF and everything else are refused. Returns `{ mime } | null`.
- `sanitiseSvg(text)`: null when over 200 KB or not an SVG root; removes `<!DOCTYPE>` and `<!ENTITY>`, `<script>`, `<foreignObject>`, `<iframe>`, `<object>`, `<embed>`, `<use>` and `<image>` with non fragment `href` or `xlink:href`, every `on*` attribute, `href` or `xlink:href` values that are not `#fragment`, `style` content with `@import` or `url(` pointing outside the document, and `javascript:` anywhere. Returns the cleaned text.
- `logoDataUri(bytes, mime)`: base64 data URI. SVG is sanitised first and encoded as base64 too.
- `fontStylesheetUrl(style)`: `https://fonts.googleapis.com/css2?family=...&display=swap` built only from allow list families with weights 400, 600 and 700; null when neither role uses a Google font.
- `buildHouseStyle(parts)`: assembles the record and sets `status` and `reason`.

### 2.4 Crawler extensions (`crawler.ts`, `crawl-rules.ts`, `validation.ts`)

The constraint says reuse the crawler and do not write a second fetcher, so every new network read goes through `crawler.ts`:

- `fetchRobots(origin, userAgent)` becomes an export (unchanged body).
- `CrawlOptions`: `maxPages?: number` (defaults to `CRAWL_MAX_PAGES`; `stopNow` uses it), `keepHtml?: boolean` (when true, `CrawledPage.html` holds the raw HTML capped at `PAGE_HTML_CAP`; shell pages under 40 characters of text are still skipped, but for `keepHtml` the start page's HTML is kept even when the visible text is short, since a script heavy home page still carries its `<head>`), `robots?: { rules: RobotsRules; status: CrawlStore["robots"] }` (skips the internal robots fetch).
- `fetchAsset(url, opts)` with `opts = { deadlineAt, userAgent, maxBytes, accept, siteHost, robots }`: refuses non http(s) URLs and hosts failing `isPublicHostname`; when the asset is on `siteHost`, checks `isAllowed(robots, path)`; GET with `AbortSignal.timeout(min(PAGE_TIMEOUT_MS, deadlineAt - now))`, `redirect: "follow"`, the crawler user agent; refuses when the final URL's host fails `isPublicHostname`, when the status is not 2xx, when `content-length` exceeds `maxBytes`, or when streaming passes `maxBytes` (the reader is cancelled); returns `{ ok: true, bytes, contentType, finalUrl } | { ok: false, reason }`. Never throws.
- `crawlerUserAgent()`: `ASK_SUMMIT_USER_AGENT` or `DEFAULT_USER_AGENT`; `process.ts` delegates to it.

Asset host rule (assumption, stated for the Reviewer): pages stay same host as today; stylesheets and logos may come from any public host the company's own page references (Webflow, Squarespace and Shopify serve them from CDNs), because a same host rule would lose most logos. Robots rules apply to same host assets.

### 2.5 Brief store (`briefs.ts`)

- Keys: `brief-prototype:{id}` (JSON `PrototypeRecord`), `brief-style:{id}` (JSON `HouseStyle`, logo included), `brief-prototype-lock:{id}` (`SET NX EX 300`).
- Hash fields on `brief:{id}`: `prototypeAt` (ISO or null), `prototypeHash` (or null), `prototypeCount` (number, in `NUMERIC_FIELDS`). `createBrief` initialises them; `deserialise` defaults them. These keep emails, the link route and the admin list from reading the large keys.
- `getBriefPrototype(id)`, `saveBriefPrototype(id, record)` (SET with `EX BRIEF_DRAFT_TTL_SECONDS`, then HSET `prototypeAt`, `prototypeHash` through `updateBrief` without `updatedAt`), `getBriefStyle(id)`, `saveBriefStyle(id, style)` (SET with the same EX), `claimPrototypeLock(id)`, `releasePrototypeLock(id)`.
- TTL follows the brief: in `updateBrief`, where a draft's TTL is refreshed, also EXPIRE the two keys (a no op when absent); in `setBriefStatus`, PERSIST both on a non draft, EXPIRE both on draft. `deleteBrief` and `deleteBriefsByEmail` DEL both keys in their pipelines. A reader treats a missing key as no prototype and the page shows "Create prototype"; the hash fields are only hints.
- `BriefCounter` gains `"prototypeCount"`.

Rationale for separate keys: the same reasons `brief-source` is separate (section in the `briefs.ts` header): the admin list reads every hash in pages, and a 100 to 400 KB value on the hash would make that slow.

### 2.6 Routing and the model client (`registry.ts`, `llm.ts`)

- `ROUTING_TASKS` gains `"builder-prototype"`. `parseRoutingKey` accepts it; it is never narrowed per tool.
- `DEFAULT_ROUTES["builder-prototype"] = { model: "anthropic/claude-haiku-5.5", maxTokens: 16000, fallback: "anthropic/claude-sonnet-5.5" }` (reasoning off; decision 4.8).
- `TASK_LABELS`: "Project Builder: prototype". `TASK_DESCRIPTIONS`: one paragraph: what it does, one self contained HTML document or a list of edits, up to three calls per press (edit, rebuild, one corrective round), 16,000 max tokens, the per call timeout up to 150 s inside the route's 300 s, not calibration gated, has one fallback.
- `CallModelArgs.timeoutMs?: number`: when set, passed as the per request option `{ timeout }` to `openai.chat.completions.create(body, { timeout })`, clamped to 15 to 240 seconds; the client default of 40 s is unchanged for every other caller. The retry rule is unchanged (connection errors only inside the first 15 s, never after a timeout), so the worst case of one call is 15 s plus `timeoutMs`; the caller budgets for that.
- `isCalibrationGated("builder-prototype")` stays false (only scoring and synthesis are gated).
- Admin models: the fallback select shows for `builder-prototype`; the route's fallback whitelist gains it.

### 2.7 Prompts and schemas

`prompts.ts` (system turns carry no prospect or website text; everything from the brief and the website goes in the user turn under `DATA_GUARD`):

- `houseStyleBlock(style, companyName)`: user turn lines: company name (from the contact, else `siteName`), colours, background, text colour, heading and body font families (or "system fonts"), whether a logo is available, the site's own tagline labelled as "wording from their website".
- `prototypeCreatePrompt(state, style, ctx)`: system: the `HEAD` rule set adapted (reply with only JSON, British spelling, no em or en dashes, plain language), then the build rules: one complete HTML document; three to five screens, each a `<section data-screen="{slug}">`, only one visible at a time; a top navigation bar with a button per screen; switching by inline script with `addEventListener`; every button and tab responds; forms are inputs plus `<button type="button">` that shows an in page success message (no form submission, which the sandbox blocks); invented sample data only; no `fetch`, `XMLHttpRequest`, `localStorage`, `sessionStorage`, cookies, `alert`, `confirm`, `prompt` or `window.open`; no `<link>`, no external URLs and no images except the logo; use `{{LOGO}}` as the `src` of a single `<img>` in the navigation bar when a logo is available, else the company name as a text wordmark; CSS custom properties `--brand-1` to `--brand-3`, `--bg`, `--text`, `--font-heading`, `--font-body` set from the style given; screens chosen from the brief (sign in, dashboard, main record list, record detail, settings as the default shape), labelled with the brief's own words; keep the document under 45,000 characters; `screens` lists the screen names. User turn: `contextBlock(state, ctx)` then `houseStyleBlock`.
- `prototypeEditPrompt(state, style, current, changes, ctx)`: system: the same build rules plus the edit protocol: return `edits`, each `old_str` copied exactly from the current document and unique in it, smallest edits that bring the prototype in line with the changes, keep everything else as it is, at most 40 edits, set `rewrite` to true instead when the changes touch most screens. User turn: the change lines, the context block, the house style block, then the current document between triple quotes after `MATERIAL_GUARD`.
- `prototypeFixPrompt(state, style, broken, issues, ctx)`: system: the create rules plus "your previous document failed these checks; return the whole corrected document". User turn: the issue lines, the context, the style block, the broken document fenced.

`schemas.ts` (strict, every property required):

- `prototypeSchema()` named `builder_prototype`: `{ screens: string[], html: string, summary: string }`. `parsePrototype`: object required, `html` a non empty string (else `SchemaError`), capped at 200,000 characters before validation (the validator reports the real cap), `screens` cleaned and capped at 5, `summary` capped at 300.
- `prototypeEditsSchema()` named `builder_prototype_edits`: `{ rewrite: boolean, edits: Array<{ old_str: string, new_str: string }>, summary: string }`. `parsePrototypeEdits`: `edits` array required, at most 40 kept, items without a string `old_str` dropped.

### 2.8 Server modules

`house-style-read.ts`, `readHouseStyle(target, { deadlineAt })`:

1. `target` null: return neutral with `reason: "no-website"`.
2. `fetchRobots(origin)`; `crawlSite(url, { deadlineAt: crawlDeadline, userAgent, maxPages: 3, keepHtml: true, robots })` where `crawlDeadline = min(deadlineAt, now + 18 s)`.
3. No page with HTML: neutral with `reason: "unreadable"`.
4. From the start page: stylesheet links (up to three) fetched in parallel by `fetchAsset` (`maxBytes` 400 KB, `accept: "text/css"`, content type must contain `css`); logo candidates tried in order (at most three fetches) with `maxBytes` 204,800, each through `checkLogoBytes` and, for SVG, `sanitiseSvg`; inline SVG and `data:image/` candidates need no fetch. Asset deadline `min(deadlineAt, now + 8 s)`.
5. `buildHouseStyle`; nothing usable gives neutral with `reason: "nothing-usable"`.
Any thrown error is caught and becomes neutral with `reason: "unreadable"`. Never fails the run.

`prototype-run.ts`, `runPrototype(input)` with `input = { brief, state, source, deadlineAt }`, returns `{ record, style, mode, corrected, calls }` or throws `PrototypeFailedError(reason)`:

1. Style: `getBriefStyle(id)`. Resolve the website (2.1). When there is no stored style, or the resolved host differs from `style.host` (including a neutral "no-website" style and a website now known), read it (`readHouseStyle` with `deadlineAt = now + 26 s`), `saveBriefStyle`, track `builder_prototype_style`. Otherwise reuse.
2. Font href: `fontStylesheetUrl(style)`.
3. Existing record: `getBriefPrototype(id)`.
4. Create path (no record): call `create` (budget rule below) and go to step 6.
5. Update path: if `isLargeChange(record.snapshot, snapshot)` or the style host changed, call `rebuild` (a create prompt) and go to 6. Otherwise call `edit`; on a call error, `rewrite: true`, zero edits, an `EditApplyError`, or a validator failure after `sanitise`, fall back to `rebuild`. A successful edit goes to 7 as mode `"edited"`.
6. Sanitise then validate. On issues, one `fix` call with the issues and the sanitised document; sanitise and validate again; issues again throw `PrototypeFailedError("invalid")`.
7. Build the record (version, `createdAt` kept on update, `updatedAt` now, `model` from the producing call, `calls`, `snapshot`, `hash`, `styleHost`), `saveBriefPrototype`.

Budget rule for every call: `remaining = deadlineAt - now`; refuse to start a call with less than 45 s left (throw `PrototypeFailedError("time")`, or for a fallback after a failed edit, throw the same); `timeoutMs = min(cap, remaining - 20 s)` where cap is 150 s for create, rebuild and fix and 75 s for edit; the fix call additionally needs 75 s left or it is skipped and the run fails with `"invalid"`. Each call first reserves one daily builder call (`reserveBuilderDailyCall`); a refused reservation throws `PrototypeFailedError("daily")`. Each call uses `callModel({ routingKey: "builder-prototype", runId: brief.id, temperature: 0.4, timeoutMs, ... })`, so every call is logged to `ai:calls` with the key, model, brief id and timestamp like the other builder calls.

### 2.9 The route `POST /api/project-builder/prototype`

`runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 300`.

Request body: `{ briefId: string, token: string, state: BriefState, website: "" }`. Nothing else is read: no prompt, system text, HTML, style, model or mode field is accepted; unknown fields are ignored. Create versus update is decided on the server from whether a record exists.

Order:

1. `readJson` (400 "Invalid JSON body.").
2. Honeypot (`website` non empty): `{ ok: true }`.
3. No `briefId`: 400 `{ error: PROTOTYPE.saveFirst, needSave: true }`.
4. `resolveBrief(body)`: 400 bad id, 403 token, 404 gone, 409 locked (`locked: true`).
5. `parseBriefState(body.state)` (400 on `BriefStateError`).
6. Limiter `getBuilderPrototypeLimiter()` scope `prototype`: 429 `RATE_LIMIT_MESSAGE`, `Retry-After: 3600`.
7. Readiness: not ready gives 400 `{ error: readinessLine, notReady: true, missing }`.
8. `saveBriefState(id, state)`: the stored state is now what the prospect sees (autosave only runs on step changes, so storage can lag the screen). Generation reads from this stored state.
9. Hash: `prototypeHash(state)`. When a record exists with the same hash: 200 `{ ok: true, mode: "unchanged", upToDate: true, prototype: view, runs }`. No model call, no cap spent.
10. Per brief cap: `brief.prototypeCount >= PROTOTYPE_RUNS_PER_BRIEF`: 429 `{ error: PROTOTYPE.cap, cap: true }` (no `Retry-After`).
11. Lock: `claimPrototypeLock(id)` fails: 429 `{ error: PROTOTYPE.busy, busy: true }`, `Retry-After: 60`.
12. `incrementBriefCounter(id, "prototypeCount")` (a press that reaches the model spends a run, like the reservation rule).
13. `runPrototype({ brief, state, source: getBriefSource(id) ?? "", deadlineAt: startedAt + 285 s })`.
14. Success: track `builder_prototype_run` `{ mode: "created" | "updated", path: "create" | "edits" | "rebuild", ok: true, corrected, style: style.status, ms }`; 200 `{ ok: true, mode: "created" | "updated", upToDate: true, prototype: view, runs, message }` where `view` comes from `renderPrototypeDocument(record.html, style.logo?.dataUri)` and `message` is `PROTOTYPE.created` or `PROTOTYPE.updated` plus the style note when neutral.
15. Failure: track the same event with `ok: false, reason`; `PrototypeFailedError("daily")` gives 429 `{ error: DAILY_LIMIT_LINE variant PROTOTYPE.daily }` with `Retry-After` to midnight UTC; `"invalid"`, `"time"` and model errors give 502 `{ error: PROTOTYPE.failed, prototype: previousViewOrNull }`; `LlmNotConfiguredError` gives 503; anything else through `builderErrorResponse` (500).
16. `finally`: `releasePrototypeLock(id)`.

Response `prototype` shape is `PrototypeView` (2.1). The previous prototype is never overwritten on failure because the store write happens only at step 7 of the run.

### 2.10 Existing routes

- `POST briefs`: `validateContact(body.contact, "save")`. Save email args gain `progress` (computed in the renderer from state) and `prototype: null` (a brand new brief has none).
- `GET briefs/[id]`: adds `prototype` (`PrototypeView | null`, built from `getBriefPrototype` and `getBriefStyle`), `prototypeCount`, `styleStatus` (`style?.status ?? null`). `Cache-Control: no-store` unchanged.
- `PUT briefs/[id]`: a contact is validated in save mode. The client always sends the full contact draft, so company and website already held are kept.
- `POST briefs/[id]/submit`: body may carry `contact`; `const candidate = body.contact ?? record.contact`; `validateContact(candidate, "submit")` fails: 400 `{ error, needContact: true }` before any write. When `body.contact` is present it is saved with the state through `saveBriefState(id, state, source, contact)`. Links are computed before Notion. When `record.prototypeAt` is set: Notion gets `prototypeUrl` (links.prototypeUrl) and `prototypeAdminUrl`; the confirmation and the alert get `prototypeUrl`.
- `POST link`: for each brief, `prototype: brief.prototypeAt ? { updatedAt: brief.prototypeAt, url: links.prototypeUrl } : null`.
- `brief-auth.ts`: `BriefLinks.prototypeUrl = resumeUrl + "&view=prototype"`; `adminPrototypeUrlFor(origin, id) = {origin}/admin/briefs/{id}/prototype`.

### 2.11 Emails (`emails.ts`)

- `Section` gains `linkLabel?: string`: HTML renders `<a href>{label}</a>`, text renders `{label}: {url}`. Existing sections without a label render as today.
- `renderSaveLinkEmail(args)` (draft wording) lines: `Your brief is saved and is on the step "{step}".`; `{n} requirements, {m} of them Must.` (singular forms handled); `{pct}% ready to submit.`; prototype line: `No prototype yet. You can make one from the builder.` or `Your prototype was last updated on {d} at {hh:mm} UTC.`; `RESUME_LINE`; one link labelled `Carry on with your project` (the resume URL). When a prototype exists, a second section with the line `View your prototype:` and the prototype URL labelled `View your prototype`. Locked wording keeps its current lines and gains the prototype line and link when present. `SaveLinkArgs.prototype?: { updatedAt: string; url: string } | null`.
- `renderConfirmationEmail` and `renderAlertEmail`: optional `prototypeUrl`; when present, one section `Your prototype` (confirmation) or `Prototype` (alert) with one plain line and the link. No HTML from the prototype ever enters an email.
- Every new string goes through `plainDashes` and `escapeHtml` as now. Date format: `en-GB`, day and month, `UTC`.

### 2.12 Notion (`notion-brief.ts`, `project-builder-notion.ts`)

- `BriefPageArgs.prototypeUrl?: string | null` and `prototypeAdminUrl?: string | null`.
- `briefPageBlocks`: after "Their own notes", when `prototypeUrl` is set, `heading2("Prototype")`, a paragraph whose rich text is a link (`text.link.url`) labelled "View the prototype", a plain line "The prospect link works for 30 days. The admin link does not expire.", and a linked paragraph "Admin view of the prototype" to `prototypeAdminUrl`. New `linkParagraph(label, url)` helper. No property change, so the hand made database needs no new column.
- `pageArgs(brief, source, adminUrl, extras?)` passes them; `createBriefPage` and `updateBriefPage` take the optional extras. Only the submit route passes them, and only the submit appends the body, so the link appears in the submitted copy.

### 2.13 Copy (`copy.ts`)

New `PROTOTYPE` block (British spelling, no dashes, plain):

- `tab: "Prototype so far"`, `create: "Create prototype"`, `update: "Update prototype"`, `upToDate: "Your prototype is up to date"`.
- `needs: { description: "Add a sentence about the project or your business first.", goalOrFeature: "Add a goal or at least one feature first.", both: "Add a sentence about the project and a goal or a feature first." }`.
- `saveFirst: "We'll ask for your name and email first so the prototype is kept with your brief."`.
- `stageReading: "Reading your website."`, `stageDrawing: "Drawing the screens."`, `stageLong: "Still drawing. A full brief can take up to three minutes."`.
- `created: "Your prototype is ready."`, `updated: "Your prototype is updated with your latest changes."`.
- `failed: "The prototype could not be drawn just now. Your previous version is still here."`, `failedFirst: "The prototype could not be drawn just now. Please try again in a minute."`.
- `noSite: "There was no website to read, so the prototype uses a plain style."`, `unreadable: "We could not read your website, so the prototype uses a plain style."`, `nothingUsable: "We could not find your logo or colours on your website, so the prototype uses a plain style."`, `partial: "We found some of your look on your website and filled the rest with a plain style."`.
- `mockup: "An illustrative mockup of what you have described, not a commitment to a design or a build."`.
- `openFull: "Open full screen"`, `closeFull: "Close full screen"`, `frameTitle: "Prototype of the software you have described"`, `lastUpdated: (when) => "Last updated " + when`, `empty: "No prototype yet. When your brief has a description and a goal or feature, press Create prototype."`, `cap: "You have made the most prototypes this brief allows. Anthony will take it from here."`, `busy: "A prototype is already being drawn for this brief. Try again in a minute."`, `daily: "The prototype helper has reached today's limit. Try again tomorrow."`, `readOnlyTitle: "Your prototype"`, bar statuses `barNone: "Not made yet"`, `barCurrent: "Up to date"`, `barStale: "Out of date"`, `barWorking: "Drawing"`.

`SAVE.sheetLedeNew` becomes "Add your name and email and we'll send you a link, so you can pick it up on any device." `CONTACT_ERRORS.saveMissing = "Please add your name and email."` lives in `brief.ts` beside the other contact errors (the existing convention). Email lines live in `emails.ts` as the other email constants do (existing convention; flagged in section 5).

### 2.14 Contact save mode (`brief.ts`)

`validateContact(raw, mode: "save" | "submit" = "submit")`:

- Submit mode: unchanged (four fields, valid email, domain shaped website).
- Save mode: name and email required (`saveMissing`), email must match `EMAIL_REGEX`; company optional (trimmed, capped); website optional, but when given it must normalise to a domain (else `CONTACT_ERRORS.website`); returns `Contact` with `company` and `website` possibly empty.

The default stays `"submit"` so any caller not updated keeps the strict rule.

### 2.15 Events and stats

- `builder_prototype_run` props: `mode` (`"created" | "updated"`), `path` (`"create" | "edits" | "rebuild"`), `ok`, `corrected`, `style`, `ms`, `reason` on failure. The up to date short circuit does not emit it.
- `builder_prototype_style` props: `status`, `reason`. Emitted once per website read.
- `StatsTables.prototypes = { created, updated, failed, corrected, styleFound, stylePartial, styleNone }`: `created` and `updated` count `ok` run events by mode; `failed` counts `ok: false`; `styleFound` and so on count style events by status. Model cost rows already include any `builder-*` key, so `builder-prototype` appears there with no change.
- `/admin/stats` renders one table "Prototypes" with those seven numbers.

### 2.16 The page

`ProjectBuilderPage.tsx`:

- `dockOpen: boolean` becomes `dockTab: null | "blueprint" | "prototype"`. Each tab's toggle sets its own name or null, so only one panel is open at a time (AC1).
- New state: `prototype: PrototypeView | null`, `protoBusy: boolean`, `protoStage: "reading" | "drawing" | "long" | null`, `protoNote: string`, `protoError: string`, `pendingPrototype: boolean`, `styleStatus` from resume.
- `SavedInfo` gains `prototypeCount`. Local storage does not hold prototype HTML (size); after a refresh with a saved brief the page fetches nothing new unless resumed, so the prototype shows again through the resume link; the dock shows "Not made yet" until then. Assumption: acceptable, because a saved brief's canonical return path is the link. To avoid that gap, on mount with a stored `saved` id and token, the page silently calls GET `briefs/{id}?t=` only for the `prototype` field when `saved.prototypeCount > 0`. This is a read, rate free, and keeps the tab populated after a refresh.
- `generatePrototype(info = saved)`: if not saved, set `pendingPrototype` and open the Save sheet with the `saveFirst` line; after `doSave` succeeds, a pending press runs once. Otherwise set `protoBusy`, stage `"reading"` when `styleStatus` is null and a website can be resolved on the client (`resolvePrototypeWebsite`), else `"drawing"`; timers move reading to drawing at 12 s and drawing to long at 60 s; POST `{ briefId, token, state, website: "" }`; on 200 set `prototype`, `protoNote` (message), clear error, update `prototypeCount`; on 409 `lock()`; on 400 `needSave` reopen the sheet; on any other error set `protoError` to the body's error (or `OFFLINE_LINE`) and keep `prototype` (AC5). Timers cleared in `finally`.
- `ResumeLoader` reads `view`; `resume(id, token, view)` sets `prototype` and `styleStatus` from the GET; when `view === "prototype"`, sets `dockTab = "prototype"` for a draft, or for a locked brief scrolls to `#pb-prototype` after render. `step` is restored from the stored state as today (AC 21d).
- `doSave(mode)`: the sheet calls it with `"save"`; Submit calls it with `"submit"`. Submit when saved and the contact is missing company or website: validate in submit mode on the client, PUT the contact, then POST submit with `contact` in the body as a server side guard.
- `openSave` keeps prefilling the website from Step 1; Submit prefills from Step 1, else from a company email domain.
- Toast bottom offset moves from 80 px to 132 px to clear two bars.

`PrototypeDock.tsx` props: `state`, `prototype`, `open`, `onToggle`, `saved`, `locked`, `busy`, `stage`, `note`, `error`, `runsLeft`, `onGenerate`. Bar: label "Prototype so far", status word (`barNone`, `barCurrent`, `barStale`, `barWorking`), Open or Close. Panel: the button, the line under it, the stage line with `role="status"` and `aria-live="polite"`, the style note, the error line, then `PrototypeViewer` (or the `empty` line).

Button states (first match wins):

| Condition | Label | Enabled | Line |
|---|---|---|---|
| `locked` | no button | | |
| `busy` | `create` or `update` | no | the stage line |
| not ready | `create` or `update` | no | `needs.*` |
| record exists, hash equal | `upToDate` | no | `lastUpdated` |
| `runsLeft <= 0` | `create` or `update` | no | `cap` |
| not saved | `create` | yes | `saveFirst` |
| no record | `create` | yes | |
| record exists, hash differs | `update` | yes | `lastUpdated` |

The client hash uses `prototypeHash(state)` from the shared module, so "up to date" is exact and instant. The server repeats the check (step 9) and is the authority.

`PrototypeViewer.tsx`: the `mockup` line, `PrototypeFrame` at `height: min(60vh, 560px)` in the dock and `min(80vh, 760px)` in the read only view, the "Open full screen" button. Full screen is a `position: fixed; inset: 0` overlay (`.pb-proto-full`, z-index above the dock and toast) with a Close button that takes focus on open, Escape to close, and the frame at full size. The same `srcDoc` string is used, so nothing is refetched.

`PrototypeFrame.tsx`: `<iframe title srcDoc sandbox={PROTOTYPE_SANDBOX} referrerPolicy="no-referrer" allow="" loading="lazy" style>`. No `allow-same-origin`, `allow-forms`, `allow-popups`, `allow-top-navigation`, `allow-modals`.

`BlueprintDock.tsx`: the `section` uses class `pb-dock-tab`; the wrapper `<div className="pb-dock">` moves to the page and holds both tabs. Blueprint first, prototype underneath it (AC1).

`ContactFields.tsx`: `mode` prop and an `onlyMissing` flag used by Step 6 when saved.

`StepSubmit.tsx`: when `saved` and company or website is blank, the panel shows `ContactFields mode="submit" onlyMissing` above Submit; the "Submitting as" line drops the company when blank.

`ReadOnlyView.tsx`: optional `prototype`; when present, a section titled `readOnlyTitle` with `id="pb-prototype"` before the change request form, the viewer full width.

`globals.css`: `.pb-dock` keeps `position: fixed`; new `.pb-dock-tab + .pb-dock-tab { border-top: 1px solid #4A8E8E }` (the `DOCK_RULE` value), `.pb-proto-panel` (`max-height: min(72vh, 720px); overflow: auto`), `.pb-proto-full` (overlay), `.pb-page { padding-bottom: 150px }`. Styling in components stays inline with BRAND tokens and `builder-styles.ts` values; no Tailwind utilities.

### 2.17 Admin

- `app/admin/briefs/[id]/page.tsx`: reads `getBriefPrototype` and `getBriefStyle` with the brief; "Counts" adds `prototypes {n}`; a "Prototype" box: last updated, version, last mode, model, up to date or out of date against `prototypeHash(brief.state)`, style status, host and reason, then `PrototypeFrame` full width at 640 px high and a plain link "Open full screen" to `/admin/briefs/{id}/prototype`. Server rendered, no client JavaScript, as the page header promises.
- `app/admin/briefs/[id]/prototype/page.tsx`: validates the id, reads both keys, renders a slim header (project name, "Back to the brief") and `PrototypeFrame` at `calc(100vh - 56px)`. The middleware's `/admin/:path*` matcher covers it.

---

## 3. Data Flow

### 3.1 First press on a saved brief (create)

Browser state, briefId and token → route steps 1 to 12 → `runPrototype`: no style stored, website resolved from `biz.website`, else the contact website, else a company email domain → `readHouseStyle` (robots, up to three pages with raw HTML, up to three stylesheets, up to three logo fetches, about 26 s at most) → `brief-style:{id}` saved, `builder_prototype_style` tracked → daily reservation → create call (Haiku, up to 150 s) → `parsePrototype` → sanitise with the font href → validate → (issues: one fix call) → record saved at `brief-prototype:{id}`, hash fields on the brief → `builder_prototype_run` → served view (logo substituted, sanitised again) → the dock shows it.

Error paths: website unreadable or absent gives the neutral style and a note, never a failure; a model error, timeout, or a document still invalid after the fix gives 502 with the failure line, nothing stored, the run counted; daily cap gives 429; a second press while running gives 429 busy.

### 3.2 Update

Same entry. Hash differs from `record.hash` → style reused (host unchanged) → `describeChanges(record.snapshot, snapshot)`; small change: edit call with the current stored HTML (the `{{LOGO}}` placeholder keeps base64 out of the prompt) → `applyEdits` → sanitise → validate → saved as version n+1, mode `"edited"`. Large change, style host change, or any edit failure: rebuild with a create prompt, then the validator and at most one fix. The previous record stays until a valid replacement is saved.

### 3.3 Up to date

Client hash equals `prototype.hash`: button disabled, no request. If a stale tab posts anyway, step 9 answers `"unchanged"` without a model call or a run spent.

### 3.4 Unsaved prospect

Press → Save sheet (name and email) → POST briefs (save mode) → save email (progress lines, "No prototype yet") → `pendingPrototype` → POST prototype.

### 3.5 Resume and deep link

Email link `?b&t` (or `&view=prototype`) → `ResumeLoader` → GET briefs/[id] → state (with its `step`), source, contact, counters, `prototype` → page at the saved step; with `view=prototype` the prototype tab opens (draft) or the page scrolls to the prototype section (submitted). Any device, since everything comes from the store.

### 3.6 The safety pass, in order

Applied to every model output before validation and storage, and again when serving:

1. Remove `<script>` elements that carry a `src` attribute (whole element).
2. Remove `<iframe>`, `<object>`, `<embed>`, `<frame>`, `<frameset>`, `<applet>`, `<portal>` elements (with content where paired) and any stray open or close tags of those names.
3. Remove `<base>` tags.
4. Remove every `<meta http-equiv>` (refresh, CSP, set-cookie, anything); keep `charset`, `viewport`, `name` metas.
5. Remove every `<link>` tag. The one allowed font stylesheet is injected by the server in step 9, so no model written link survives.
6. Remove `action`, `formaction`, `target`, `ping`, `srcset` and `srcdoc` attributes anywhere.
7. Replace every `http://` or `https://` URL whose host is not `fonts.googleapis.com` or `fonts.gstatic.com` with `#`, wherever it appears (attributes, CSS `url()`, `@import`, text). Protocol relative `//host` in `src`, `href` and `url()` is treated the same. CSS `@import` rules are removed entirely.
8. In `href` attributes, `data:` and `javascript:` values become `#` (navigation inside the frame to a document without our CSP is the gap this closes).
9. Head: ensure a `<head>` exists (insert after `<html ...>`, or create the skeleton when missing so the validator can still report); remove any previous injected block; insert as the first children of `<head>`, in order: `<meta http-equiv="Content-Security-Policy" content="{PROTOTYPE_CSP}">`, `<meta name="referrer" content="no-referrer">`, `<meta charset="utf-8">` when absent, and the font `<link rel="stylesheet">` when a font href exists (built only by `fontStylesheetUrl`). The injected block is wrapped in marker comments so the pass is idempotent and the edit prompt can tell the model not to touch it.
10. Size: over `PROTOTYPE_HTML_MAX_CHARS` is a validator issue (so the fix round can shorten it); the route never stores an over cap document.

The CSP blocks everything the regex pass might miss: no network except the two font hosts, no external images, no frames, no form posts, no base rewriting. The sandbox gives an opaque origin, so the frame cannot read the builder's cookies, storage or DOM, cannot navigate the top window and cannot open popups.

### 3.7 Logo handling

Fetched bytes → `checkLogoBytes` (magic bytes, header agreement, 200 KB) → SVG through `sanitiseSvg` → `logoDataUri` → stored in `brief-style:{id}` → the model only ever sees `{{LOGO}}` → `renderPrototypeDocument` puts the data URI into `img src` at serve time. `img-src data:` in the CSP means a logo can only ever be a data URI. Nothing is loaded from the company's site at view time (AC7).

### 3.8 Hand off

Submit with a prototype → the confirmation email and the alert carry one "View your prototype" line → the Notion body appended on submit carries the prospect link and the admin link → the admin brief page shows the frame and the full screen link.

---

## 4. Key Decisions

4.1 **A saved brief is required.** Alternatives: generate for unsaved state and keep it in the browser only. Chosen: require a save, because AC10 and AC17 need the brief record (auth, per brief cap, storage, resume), and 21a makes saving cheap (name and email). The button never dead ends: an unsaved press opens the Save sheet and continues.

4.2 **The posted state is saved first, then used.** Alternative: read state only from storage. Autosave runs only on step changes, so storage can lag the screen and the "up to date" hash would disagree with what the prospect sees. Saving through the existing `saveBriefState` makes storage the source of truth for the generation. Only the `BriefState` shape is accepted, through `parseBriefState`, so no prompt or HTML text enters from the request.

4.3 **Separate Redis keys for the prototype and the house style, with three summary fields on the hash.** Keeps admin list reads small, lets the style survive a failed generation (read once per host), and lets emails and the link route avoid large reads. TTL and deletes follow the brief in `briefs.ts` so no orphan outlives it.

4.4 **Logo order: a logo marked image first, og:image last.** The spec lists og:image first, but og:image is usually a social banner or photograph, while an `<img>` or inline `<svg>` marked "logo" is the actual mark. Apple touch icons and SVG icons are next best. All the spec's sources are used; only the priority differs.

4.5 **Crawler extended, not copied.** `fetchAsset` lives in `crawler.ts` with the same user agent, timeout, host rule and robots rules; `crawlSite` gains a page cap and raw HTML option. Ask Summit calls are unchanged. Assets may be on public CDN hosts the company page references (2.4).

4.6 **CSP plus regex pass plus sandbox, with two extra directives.** No HTML parser dependency is allowed, so the regex pass is best effort and the CSP and sandbox are the real boundary. `base-uri 'none'` and `form-action 'none'` are added because they only reduce what the document can do; the spec's five directives are present verbatim.

4.7 **Logo placeholder instead of an inline data URI in the stored HTML.** A 200 KB logo is about 270,000 base64 characters: it would blow the size cap, cost tokens on every edit call and risk the model corrupting it. The placeholder keeps the stored document small and stable.

4.8 **Default model Haiku 5.5, 16,000 max tokens, Sonnet 5.5 fallback, reasoning off.** A 30 to 45 KB document is roughly 10,000 output tokens; Haiku finishes that well inside the 150 s cap, Sonnet with mandatory reasoning would be close to it. Admin can switch in `/admin/models` with no deploy; the description warns that a slower model needs the timeout headroom. Temperature 0.4: some variety in layout, stable enough for edits.

4.9 **Time budget: `maxDuration = 300` (Vercel Pro, already used by Ask Summit processing), route deadline 285 s.** Worst case: style 26 s, edit 75 s, rebuild 150 s gives 251 s, and the fix round is skipped unless 75 s remain. A create: style 26 s, create 150 s, fix up to 89 s (remaining minus 20 s) stays under 285 s. Every call is refused below 45 s left. `callModel` gains a per call timeout so the 40 s client default for everyone else is untouched.

4.10 **"Large change" decided on the server, plus the model's `rewrite` flag.** A deterministic rule (path, idea or website changed, or 12 or more change lines, or no snapshot) avoids paying for an edit call that will obviously fail; the model can still opt out with `rewrite: true`.

4.11 **Per brief cap of 10 presses that reach the model, plus one daily reservation per call.** There is no existing general per brief call cap; this follows the ideas pattern (a counter on the hash) and the site wide daily cap. The up to date short circuit spends nothing.

4.12 **Client side hash with a pure 53 bit hash.** Lets the button say "up to date" without a request; the server checks again.

4.13 **Admin full screen as a server page.** The admin brief page is deliberately free of client JavaScript; a separate page keeps it so. The prospect views use a client overlay because the builder is already a client app.

4.14 **Style re-read when the resolved host changes.** "Read once per brief" is honoured per website; a prospect who adds a website after a neutral first prototype gets their style on the next update (a rebuild, since style touches every screen).

4.15 **Form buttons, not form submission.** A sandbox without `allow-forms` blocks submission before the `submit` event fires, so the prompt asks for `type="button"` handlers. Otherwise "forms accept input and show a pretend success state" would silently fail.

---

## 5. Constraints Honoured

- No new dependencies: regex and string code only; `cyrb53` written inline; `openai` client already approved.
- Canvas ideas ported as small modules (`applyEdits`, `validatePrototypeHtml`, house style shape); nothing imported from the Canvas repo.
- Crawler reused: every fetch goes through `crawler.ts`; robots respected, same host pages, three page cap, no JavaScript rendering; server side only.
- Model calls only through `callModel` on `builder-prototype`; no model id outside `llm.ts`; the key is in `ROUTING_TASKS`, `DEFAULT_ROUTES`, `TASK_LABELS` and `TASK_DESCRIPTIONS` so `/admin/models` shows it.
- Prompts in `prompts.ts`, server side; the route accepts no prompt, system text or HTML; prospect and website text only in the user turn under the data guard.
- Builder styling inline with BRAND tokens, `builder-styles.ts` and `globals.css` classes; no Tailwind utilities. The prototype's own CSS uses the prospect's house style.
- `/tools/project-builder` redirect untouched.
- Secrets: none new; `OPENROUTER_API_KEY`, Upstash and Notion variables as today.
- Not calibration gated: `isCalibrationGated` unchanged and tested false for the key.
- Copy: UI strings in `copy.ts`; contact errors in `brief.ts` and email lines in `emails.ts` as the existing convention places them (the catalogue test's no dash walk covers `copy.ts`; the email tests assert no dashes in rendered emails). British spelling, no em or en dashes, plain sentences.
- Not staged: `docs/prototypes/`, `docs/specs/`, `Decks/`, `.claude/`, `SUMMIT-GTM-TOOLKIT-SPEC.md`.
- Quality gates: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`; calibration not applicable.

---

## 6. Test Plan

All on `node:test` with `node:assert/strict`, pure modules only (no Redis, no network, no env).

`__tests__/project-builder-prototype.test.ts`

- Readiness: blank is not ready with both missing; idea only misses goal or feature; feature only misses description; `biz.notes` plus `problem` is ready; replace path with `rep.sys` and one cap is ready; the line chosen for each case.
- Hash: same for equal states with keys in a different order; unchanged by `step`, `featSrc`, `ideasKey`, `ideaSeq`, timing and budget; changed by a feature priority, a role, a custom row, a picked idea, a website; changes when an idea moves to "no".
- `describeChanges`: added and removed feature, priority change, role added, name change; empty when equal.
- `isLargeChange`: null before; path change; website change; 12 lines; small change false.
- `resolvePrototypeWebsite`: Step 1 website wins; contact website next; company email domain next; free mail gives null; `localhost`, an IP literal and `.internal` give null.
- `PROTOTYPE_SANDBOX` equals `"allow-scripts"` and contains none of `allow-same-origin`, `allow-forms`, `allow-popups`, `allow-top-navigation`.

`__tests__/project-builder-prototype-html.test.ts`

- `applyEdits`: one edit; sequential edits where the second targets inserted text; not found throws and names the edit; two matches throws; a failure on edit 3 leaves the input unchanged (all or nothing); empty `old_str` throws.
- Validator: a valid three screen document passes; two `<body>`; missing `<html>`; two `<head>`; unbalanced `<style>`; unbalanced `<script>`; duplicate ids; protocol markers; two screens; six screens; over the size cap.
- Safety pass, one test per construct: external `script src`; `iframe`; `object`; `embed`; `base`; `meta http-equiv="refresh"`; a model written CSP meta replaced; `form action="https://..."` and `formaction`; a `link rel="stylesheet"` to another host and a `link rel="icon"`; an external `img src`; an external URL in CSS `url()` and an `@import`; protocol relative `//evil.example`; `href="javascript:..."` and `href="data:..."`; `target` and `ping`. Each is gone or neutralised.
- CSP: present as the first element of `<head>` with the exact directive string; inserted when the model gave no `<head>`; only one after running the pass twice (idempotent).
- Font link: the injected link survives with a `fonts.googleapis.com` href; a model written link to the same host is still removed.
- `renderPrototypeDocument`: `{{LOGO}}` in an `img src` becomes the data URI; the placeholder in text is untouched; with no logo the placeholder image becomes its alt text.

`__tests__/project-builder-house-style.test.ts`

- Logo candidates: sample HTML with an og:image, an apple touch icon, an icon link and `<img class="site-logo">` returns the logo image first and og:image last; relative URLs resolved; inline `<svg class="logo">` picked up; at most four.
- Colours: theme-color first; `--brand-primary` next; frequency ordering from inline and linked CSS; greys, white and black dropped; `rgb()` and three digit hex normalised; at most three.
- Fonts: a Google Fonts link family wins; `body { font-family: "DM Sans", sans-serif }` maps to DM Sans; a proprietary family with `serif` fallback maps to the serif stack; unknown family names never appear in the result.
- Tagline: og:description, then meta description, then h1; capped at 160 characters at a word; dashes made plain.
- `checkLogoBytes`: PNG, JPEG, WebP and SVG accepted; GIF and ICO refused; 204,801 bytes refused; an `image/png` header on JPEG bytes refused.
- `sanitiseSvg`: removes `<script>`, `onload`, `<foreignObject>`, an external `xlink:href`; keeps `#fragment` references; refuses a non SVG root and an oversize input.
- `fontStylesheetUrl`: only allow list families; null for system stacks.
- `buildHouseStyle`: found, partial and none statuses.

Updated files

- `project-builder-brief.test.ts`: save mode accepts name and email only; missing name or bad email refused with the save message; a bad optional website refused; submit mode (default) unchanged.
- `project-builder-emails.test.ts`: save email has the requirement count, Must count, percent and "No prototype yet"; with a prototype it has the last updated line and the prototype link; "Carry on with your project" label in HTML and text; confirmation and alert carry the line only with a URL; no em or en dash in any rendered email.
- `project-builder-notion.test.ts`: Prototype section present with a URL (linked rich text), absent without.
- `project-builder-stats.test.ts`: created, updated, failed, corrected and style counts from fixture events.
- `project-builder-prompts.test.ts`: create, edit and fix prompts carry `HEAD` style rules and the data guard; no prospect text and no tagline in any system turn; the edit prompt's user turn carries the change lines and the fenced current document; the two schemas are strict at every level; `parsePrototype` rejects a missing `html`; `parsePrototypeEdits` caps at 40.
- `routing.test.ts`: `builder-prototype` in `DEFAULTS`; parses; not calibration gated.

Not unit tested (network or Redis): `fetchAsset`, `readHouseStyle`, `runPrototype`, the route. The Coder should smoke them locally against two or three real sites (one Webflow, one WordPress, one with no site) and one forced validator failure.

---

## 7. Risks and edge cases

- **Latency.** A create can take one to two and a half minutes. The staged lines and the kept previous version cover it; if Haiku is replaced by a slower model in admin, timeouts rise. The description in `/admin/models` says so.
- **Truncation.** A document longer than 16,000 tokens fails as "ran out of tokens" (a 502). The prompt asks for under 45,000 characters; the fix round only runs on validator issues, not call failures.
- **Regex safety pass misses.** Exotic markup could slip past the regexes. The CSP meta (first in head, before any model content) and the sandbox bound the damage to the frame itself.
- **DNS rebinding and private IPs.** Host name checks block literals and private suffixes but not a public name that resolves to a private address. Same exposure as Ask Summit today; Vercel functions have no private network to reach.
- **Notion link expiry.** The prospect link token lasts 30 days. The Notion block also carries the admin link, and the existing "Admin link" property stays.
- **Prototype key expiry drift.** Mitigated by refreshing the two keys wherever the hash TTL is refreshed; readers treat a missing key as no prototype.
- **Concurrent presses or tabs.** The lock answers 429 busy; the lock expires after 300 s if a function is killed.
- **Fonts host at view time.** The only external requests a viewer's browser makes are to the two Google Fonts hosts (allowed by the spec).
- **A brief locked mid run.** The run finishes and stores; the next page call gets 409 and the read only view shows the saved prototype.
- **Contacts saved before this change** always have all four fields, so submit mode passes for them.

---

## 8. Out of Scope

- Streaming the model output to the browser (the staged lines are timer based and honest about it).
- Version history of prototypes (only the latest is kept, per AC17).
- Rendering the prototype in Notion or in an email (links only, per AC19 and AC20).
- Prototype lines in the reminder and unlock emails (AC20 names the save and resume, confirmation and alert emails).
- Screenshots or thumbnails of the prototype.
- Changes to the admin briefs list page.
- Any change to scoring, synthesis, rubrics or calibration.
