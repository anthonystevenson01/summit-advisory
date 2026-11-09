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


---

# Round 2: brand data service, full width panel, design quality

Branch `anthonystevenson0/project-builder-prototype` at `fccaaa8`. Task: `task-spec.md`, section "Round 2" (R1 to R9 and the round 2 constraints). Architect output only: no code.

Why: on kroger.com the crawler is dropped by the site's bot protection (even `robots.txt`), so the style fell back to neutral; the open panel is held to the 1,240 px site column; Haiku produced a thin document that opened on a Sign in card. Nothing in this round tries to get past bot protection: the crawler keeps its own honest user agent, no header spoofing, no browser emulation. A blocked site simply counts as unreadable and the brand service fills in.

## R2.0 What the Brandfetch docs say (checked 6 November 2026)

Source: https://docs.brandfetch.com/reference/brand-api (read with WebFetch). What the design relies on:

- Endpoint: `GET https://api.brandfetch.io/v2/brands/{identifier}`, where the identifier "can be a domain, website URL, email address, brand ID, ISIN, stock/ETF ticker, or crypto symbol". Explicit routes exist, including `/v2/brands/domain/{domain}`.
- Auth: "Send an API key as a bearer token in the `Authorization` header." No credential gives `402`; an unusable token gives `401` `authorization_required`.
- `logos[]`: `theme` (`dark`, `light` or null), `type` (`icon`, `logo`, `symbol`, `other`), `tags`, `formats[]` with `src`, `format` (`svg`, `webp`, `png`, `jpeg`), `size` (bytes), `width`, `height`, `background` (nullable, only listed value `transparent`). Theme describes the logo, not the background: "A dark logo should be displayed on a light background" and "A light logo should be displayed on a dark background". Types: logo is "The horizontal logo, seen on large surfaces"; symbol is "The universal mark that abstractly represents the brand"; icon is "The icon that is used on social profiles".
- `colors[]`: `hex`, `type` (`accent`, `dark`, `light`, `brand`), `brightness` (float, "0.2126*R + 0.7152*G + 0.0722*B", range not stated). Accent is "The main color that represents the brand (used to draw attention e.g. call to action button)"; dark and light are "used for surfaces or backgrounds".
- `fonts[]`: `name`, `type` (`title` or `body`), `origin` (`google`, `custom`, `system`), `originId` (nullable, format not documented), `weights`.
- Example asset hosts in the docs: `cdn.brandfetch.io` and `asset.brandfetch.io`. The docs say the shortcut fields (`logo`, `icon` and so on) need a signed `c` client id; they do not say that for `formats[].src`.
- Status codes: `200`; `204` only with `cachedOnly=true` ("not counted"); `400` (`identifier_invalid`, `url_invalid`; "Doesn't consume credit"); `401`; `402`; `403` (`api_key_invalid`, `no_api_credits`, `auth_unavailable`); `404` for an unknown domain, typically `brand_not_found`, also `domain_invalid`, `domain_unresolvable`, `domain_redirected`, and "Every 404 still consumes a credit"; `429` `quota_exceeded`, "The key's monthly quota is used up"; `500` `internal_error`.
- Quota: monthly; "Image fetches don't count toward quota". No per second rate limit is stated.

Design consequences: use the explicit domain route so a short domain is never read as a ticker; cache 404s too, because they cost a credit; treat 401, 402, 403, 429 and 5xx as errors that are not cached; fetch `formats[].src` without any client id and, if a host refuses it, try the next format (the docs do not promise these addresses work unsigned, so a refusal is an expected miss, not a failure).

## R2.1 Files to change

### Create

| File | What and why |
|---|---|
| `app/lib/project-builder/brand-data.ts` | Pure: the trimmed `BrandData` shape, `parseBrandfetch(raw)`, `chooseBrandLogoFormats(data, navIsDark)`, `brandColours(data)`, `brandFonts(data)`, `chooseNav(colours, background, logoTheme)`. No network, no Redis, no env, so the mapping is unit tested. |
| `app/lib/project-builder/brandfetch.ts` | Server only: `lookupBrand(domain, opts, deps?)`: key check, cache read, daily cap, the one GET with a short timeout, cache write, outcome. `deps` (fetch, cache get and set, reserve, env, logger) default to the real ones and are injected by tests. |
| `__tests__/project-builder-brand-data.test.ts` | Mapping, selection, merge and note tests (R2.10). |
| `__tests__/project-builder-brandfetch.test.ts` | Client tests with injected deps: no key, cache, cap, 404, errors, timeout, key never leaked. |

### Modify

| File | What and why |
|---|---|
| `app/lib/project-builder/house-style.ts` | `HouseStyle` gains `source`, `brandLookup`, `navBackground`, `navText`, `logoTheme`; new `StyleSource` and `BrandLookup` types; `needsBrandLookup(parts)`; `mergeHouseStyle(site, brand, meta)`; `normaliseHouseStyle(raw)` for records stored before round 2; neutral defaults for the new fields. `buildHouseStyle` stays as the status rule and is called by the merge. |
| `app/lib/project-builder/house-style-read.ts` | Split into `readSiteParts` (today's crawl, returning the raw parts or the reason) and `readHouseStyle` (site, then brand top up, then merge). Budgets retuned (R2.2). Brand logo bytes go through `fetchAsset`, `checkLogoBytes`, `sanitiseSvg` and `logoDataUri`. |
| `app/lib/project-builder/prototype-run.ts` | `STYLE_BUDGET_MS` 30 s; `LONG_CALL_CAP_MS` 210 s; `EDIT_CALL_CAP_MS` 60 s; the style event carries `source` and `brand`. |
| `app/lib/project-builder/prototype.ts` | `styleNoteFor(style)` takes the whole style and picks the line by source and outcome; `StyleSource` re-exported for the page if needed. |
| `app/lib/project-builder/prototype-html.ts` | `prototypeView` calls `styleNoteFor(style)`. |
| `app/lib/briefs.ts` | `getBriefStyle` passes the stored value through `normaliseHouseStyle`. |
| `app/lib/project-builder/prompts.ts` | New design quality rules, the first screen rule, the size guidance, the inline SVG clarification; `houseStyleBlock` gains the nav lines (R2.8). |
| `app/lib/llm.ts` | `builder-prototype` default becomes Sonnet 5.5, low reasoning, 24,000 max tokens, Haiku 5.5 fallback; description updated (R2.7). |
| `app/lib/ratelimit.ts` | `brandfetchDailyKey()` and `reserveBrandfetchDailyCall()` beside the builder daily cap. |
| `app/lib/project-builder/copy.ts` | Style note lines by source; `stageLong` says four minutes. |
| `app/lib/project-builder/stats.ts`, `app/admin/stats/page.tsx` | Brand lookup and hit counts, style source counts (R2.6). |
| `app/admin/briefs/[id]/page.tsx` | The prototype box's style line shows the source and the brand outcome. |
| `app/globals.css` | `.pb-proto-panel` full width (R2.5). |
| `.env.example` | `BRANDFETCH_API_KEY`, `BRANDFETCH_DAILY_CAP` with a comment. |
| `__tests__/project-builder-house-style.test.ts`, `__tests__/project-builder-prompts.test.ts`, `__tests__/project-builder-stats.test.ts`, `__tests__/project-builder-prototype.test.ts` | Merge, prompt rules, stats, notes. |
| `docs/runbook.md` | Docs agent: the env vars, the cache key, the cap, how to read the stats. |

Not touched: the sandbox, the CSP, the safety pass, the validator, the route's auth and limits, `fetchAsset` itself, the crawler's user agent.

## R2.2 Merge order and the source field

### Order

1. Site read (`readSiteParts`): as today, through the crawler. Returns `{ parts, reason }` where `parts` is the raw `HouseStyleParts` (logo, colours, background, text, fonts, site name, tagline) or null with a reason (`unreadable` for a blocked or failing site, `nothing-usable` for a site with nothing found). With no website at all, the reason is `no-website` and there is no domain to look up, so the brand step is skipped.
2. Brand top up: `needsBrandLookup(parts)` is true when `parts` is null, or the logo is null, or there are no colours. Fonts alone missing do not spend a lookup; when a lookup runs for another reason, its fonts fill an empty role. The domain looked up is the target host (the same host the site read used, `www.` stripped).
3. Merge (`mergeHouseStyle`), field by field, site first:
   - Logo: the site logo when present, else the brand logo.
   - Colours: the site colours first, then brand colours not within a small distance of one already kept, capped at three. So a site with one colour is topped up, never replaced.
   - Fonts: per role, the site family when it is on the allow list, else the brand family for that role when it maps onto the allow list, else the site stack.
   - Background and text: the site's values when the site was read, else white and `#1F2A37`.
   - Site name and tagline: the site's; Brandfetch fields beyond logos, colours and fonts are not used (prompt text from a third party stays minimal).
   - Nav colours and `logoTheme`: computed last (R2.3.3).
4. Neutral: when the merged parts still have no logo, no colour and no font, the neutral style with the site reason.

`buildHouseStyle` then sets `status` (`found`, `partial`, `none`) by its existing rule on the merged parts.

### New fields on `HouseStyle`

- `source: "site" | "brand" | "site+brand" | "neutral"`: `site` when every used value came from the site; `brand` when the site gave nothing usable and the brand data gave something; `site+brand` when both contributed at least one of logo, colour or font; `neutral` when status is `none`.
- `brandLookup: "not-needed" | "no-website" | "no-key" | "cap" | "cached-hit" | "cached-miss" | "hit" | "miss" | "error"`: what the brand step did. Drives the note and the stats.
- `navBackground`, `navText`: the two colours the prompt is told to use for the navigation bar.
- `logoTheme: "dark" | "light" | null`: the Brandfetch theme of the chosen logo, null for a site logo.

`normaliseHouseStyle` fills these for a style stored before round 2: `source` is `neutral` when status is `none`, else `site`; `brandLookup` `not-needed`; nav is `background` and `text`; `logoTheme` null. The stored style is not rewritten; it is reused as before (read once per brief and host). Briefs already styled neutral will only get the brand top up when their host changes. Decision: acceptable, and it keeps "read once per brief" true. Anthony can clear `brief-style:{id}` by hand to force a fresh read for a brief he is testing (runbook line).

## R2.3 The Brandfetch client

### R2.3.1 `lookupBrand(domain, { deadlineAt })`

Returns `{ outcome: BrandLookup, data: BrandData | null }`. Never throws.

1. `process.env.BRANDFETCH_API_KEY` trimmed empty: `{ outcome: "no-key" }`. No log line (silent skip, R4).
2. Domain check: `normaliseDomain(domain)` and `isPublicHostname`; anything else is `error` (should not happen; the target already passed `validateWebsiteUrl`).
3. Cache read: `GET brandfetch:{domain}`. A stored `{ found: true, data }` is `cached-hit`; `{ found: false }` is `cached-miss`. A Redis failure is ignored and the lookup continues.
4. Daily cap: `reserveBrandfetchDailyCall()`; refused is `{ outcome: "cap" }`. Reserved only on a cache miss, so cached domains never touch the cap.
5. Request: `GET https://api.brandfetch.io/v2/brands/domain/{encodeURIComponent(domain)}` with headers `Authorization: Bearer {key}`, `Accept: application/json`; `signal: AbortSignal.timeout(min(4_000, deadlineAt - now - 500))`; `redirect: "error"`. Skipped (outcome `error`) when under 1 s is left.
6. Response:
   - `200`: body read as text capped at 512 KB, `JSON.parse`, `parseBrandfetch`. A body that does not parse is `error`. A parse with no usable logo, colour or font is still cached as found (it is a valid answer) and returned as `hit` with empty lists; the merge then adds nothing.
   - `404`: `miss`, cached as `{ found: false }`.
   - `400`: `miss`, not cached (no credit was spent; the domain is malformed).
   - `401`, `402`, `403`, `429`, `5xx`, anything else, a network error, an abort or a timeout: `error`, not cached.
7. Cache write: `SET brandfetch:{domain} {json} EX ttl`, with `ttl` 30 days (2,592,000 s) for a found brand and 7 days (604,800 s) for a 404. Decision: a 404 costs a credit, so it is cached, but for a shorter time because Brandfetch indexes new brands after a first request; a week lets a later brief pick the brand up.
8. Logging: one line on `error` with the HTTP status and the Brandfetch error code only (for example `project-builder brandfetch: 429 quota_exceeded for kroger.com`). The key, the `Authorization` header and the request object are never logged, never put in the cache, never returned and never sent to the browser. The domain is a company domain and may be logged.

Cached value shape (`BrandData`, trimmed by `parseBrandfetch` so the cache stays small): `{ logos: Array<{ type, theme, formats: Array<{ src, format, size, width, height, transparent }> }>, colours: Array<{ hex, type, brightness }>, fonts: Array<{ name, type, origin }>, fetchedAt }`. At most 12 logos, 8 formats each, 12 colours, 6 fonts. Only `https:` `src` values are kept.

Cache key decision: the cache is per domain and shared by all briefs, as R6 asks, because it is public brand data, not prospect data. It is not deleted with a brief. The runbook says so.

### R2.3.2 Daily cap (`ratelimit.ts`)

- `brandfetchDailyKey(now) = "brandfetch:calls:{YYYY-MM-DD}"` (UTC).
- `reserveBrandfetchDailyCall()`: INCR, EXPIRE 48 h on the first increment, `ok` when the count is at or under the cap. The cap is `BRANDFETCH_DAILY_CAP` parsed as a whole number, default 200 when unset or not a number, and `0` disables lookups. Without Redis it allows the call, matching `reserveBuilderDailyCall`. A reservation is spent even when the call then fails, the same rule as the builder cap.

### R2.3.3 Logo and colour selection (`brand-data.ts`)

Colours, `brandColours(data)`:

1. Order by type: `accent` first, then `brand` in the order given, then `dark`, then `light`.
2. Each hex goes through the existing `normaliseColour`; invalid values are dropped.
3. The same filter the site read uses drops near white, near black and low saturation greys, and near duplicates are merged. `dark` and `light` colours that survive are kept (a strong dark brand colour is useful), greys are not.
4. At most three. These become the brand side of the merge.

Separately, `darkSurface(data)` returns the first `dark` colour that is genuinely dark (brightness under 80 on the 0 to 255 scale, computed from the hex, since the API's float range is undocumented) for the nav choice below.

Nav, `chooseNav(colours, background, logoTheme, darkSurface)`:

- With a Brandfetch logo whose theme is `light` (a light logo for dark backgrounds): nav background is `darkSurface`, else `colours[0]` when its relative luminance is under 0.35, else `#1F2A37`; nav text `#FFFFFF`.
- With a Brandfetch logo whose theme is `dark` or null, or with a site logo (theme unknown; most site logos are drawn for the light header they sit in): nav background is the page `background` (white unless the site said otherwise); nav text is the page `text`; the prompt asks for a `--brand-1` accent line and active item, so the brand still shows.
- With no logo (wordmark): nav background `colours[0]`, nav text white or `#1F2A37`, whichever has the higher contrast ratio against it.

Logo, `chooseBrandLogoFormats(data, preferDarkNav)`:

1. Logos with `type` `logo` first, then `symbol`, then `icon`; `other` is not used.
2. Within a type, a theme that reads on the nav comes first. The nav is not known until the logo is chosen, so the rule is: prefer `dark` theme (reads on the default white nav), then null, then `light`; a `light` logo is still acceptable because the nav rule above then gives it a dark nav.
3. Within a logo, formats in the order `svg`, `png`, `webp`, `jpeg`, skipping any with `size` over 204,800 bytes and, for raster formats, preferring `width` of at least 160 px; `transparent` formats first among equals.
4. Returns an ordered list of at most four `src` candidates with the theme of each.

`house-style-read.ts` tries the candidates in order, at most two fetches, each through `fetchAsset` (`maxBytes` 204,800, `accept: "image/svg+xml,image/png,image/webp,image/jpeg"`, the asset deadline), then `checkLogoBytes` (magic bytes, header agreement, size), `sanitiseSvg` for SVG, and `logoDataUri`. The first that passes is the logo; its theme becomes `logoTheme`. `fetchAsset` already refuses non public hosts and caps the bytes; the Brandfetch asset hosts are public, so they pass as any CDN asset does. Fetches of `formats[].src` do not count against the Brandfetch quota (docs) and are not counted against the daily cap.

Fonts, `brandFonts(data)`: the first `title` font becomes the heading role and the first `body` font the body role, each through the existing `fontChoice` (allow list only), whatever its `origin`. A `custom` or `system` font whose name happens to be on the allow list is used; anything else yields no family. Font names never reach the prompt unless on the allow list.

Mapping onto `HouseStyle`:

| HouseStyle field | Site | Brandfetch |
|---|---|---|
| `logo` | site logo | chosen format, checked and embedded |
| `colours` | site colours first | topped up from `brandColours` |
| `headingFont`, `bodyFont` | site family per role | brand `title` and `body` when the site role is empty |
| `background`, `text` | site values | defaults |
| `navBackground`, `navText` | from `chooseNav` | from `chooseNav` |
| `logoTheme` | null | the chosen logo's theme |
| `siteName`, `tagline` | site values | not used |

### R2.3.4 Time budget inside the style read

The style read keeps one budget, raised from 26 s to 30 s (`STYLE_BUDGET_MS`), split as:

- `robots.txt` plus crawl: 14 s (was 18 s). A dropped connection fails fast; a hanging one is cut by the crawler's own page timeout and the crawl deadline.
- Site assets (stylesheets, site logo): 6 s (was 8 s).
- Brand API call: up to 4 s.
- Brand logo fetches: up to 4 s, two fetches at most.

Each stage takes `min(its share, deadlineAt - now)`, so a slow early stage shrinks the later ones rather than overrunning. A skipped or failed brand stage costs nothing more.

## R2.4 Style note copy (`copy.ts`)

`styleNoteFor(style)` picks one line. New and changed strings (British spelling, no dashes, plain):

- Source `site`, status `found`: `"Your logo and colours come from your website."`
- Source `site`, status `partial`: `"We found some of your look on your website and filled the rest with a plain style."` (unchanged).
- Source `site+brand`: `"Your look comes from your website, with the gaps filled from Brandfetch, a public directory of company logos and colours."`
- Source `brand`: `"We could not read your website, so your logo and colours come from Brandfetch, a public directory of company logos and colours."`
- Any of the three above with status `partial` and a source including `brand`: the line above plus `" Anything still missing uses a plain style."`
- Source `neutral`, reason `no-website`: unchanged `noSite`.
- Source `neutral`, reason `unreadable`, `brandLookup` `miss`, `cached-miss` or `error`: `"We could not read your website or find your logo and colours elsewhere, so the prototype uses a plain style."`
- Source `neutral`, reason `unreadable`, any other lookup (no key, cap, not needed): unchanged `unreadable`.
- Source `neutral`, reason `nothing-usable`: unchanged `nothingUsable`.

Decision: the line now shows for a site sourced style too, so the prospect always knows where the look came from (R5). Brandfetch is named because "a brand service" alone does not tell the prospect where their logo was taken from.

`stageLong` becomes `"Still drawing. A full brief can take up to four minutes."` to match R2.7.

## R2.5 Full width panel CSS

Only the open prototype panel changes; both bars keep `.pb-dock-bar` with its 1,240 px column (R7).

- `.pb-proto-panel`: remove `max-width: 1240px` and `margin: 0 auto`; set `width: 100%`, `padding: 6px 16px 16px` (16 px gutter, matching the site's phone gutter); keep the flex column, the height rule and `overflow: hidden`.
- The phone rule (`padding: 6px 12px 12px`) stays.
- The frame already fills its flex child at `height: 100%` and `width: 100%`, so no component change is needed. `PrototypeFrame` keeps its inline width.
- The blueprint panel (`.pb-dock-panel`) is not changed.

## R2.6 Stats

The `builder_prototype_style` event props gain `source` and `brand` (the `BrandLookup` value). No new event name.

`PrototypeStats` gains:

- `brandLookups`: style events with `brand` in `hit`, `miss` or `error` (live calls to the API, the quota spend).
- `brandHits`: `brand` in `hit` or `cached-hit` (a brand record was available).
- `brandCached`: `brand` in `cached-hit` or `cached-miss`.
- `brandMisses`: `brand` in `miss` or `cached-miss`.
- `brandErrors`: `brand` `error`.
- `brandCapped`: `brand` `cap`.
- `sourceSite`, `sourceBrand`, `sourceSiteBrand`, `sourceNeutral`: style events by `source`.

`/admin/stats` adds these rows to the Prototypes table. The admin brief page's style line becomes `{status}, from {source}, brand lookup {brandLookup}, host {host}`. Brandfetch calls are not model calls and do not appear in `ai:calls` or the model cost rows.

## R2.7 Model, max tokens and the time budget

`llm.ts`, `DEFAULT_ROUTES["builder-prototype"]`: `{ model: "anthropic/claude-sonnet-5.5", reasoning: "low", maxTokens: 24000, fallback: "anthropic/claude-haiku-5.5" }`. Reasoning is `low` because Sonnet class models through OpenRouter refuse `enabled: false` (the existing comment in `llm.ts`). Both ids are already in `CURATED_MODELS`. The description becomes: "Prototype so far: draws one self contained HTML prototype of the brief in the prospect's house style, or returns search and replace edits to the current one. Sonnet 5.5 at low reasoning, 24,000 max tokens for a document of up to 70,000 characters plus the reasoning. Up to three calls per press (edit, rebuild, one corrective round), each with a timeout of up to 210 s inside the route's 300 s. Has one fallback. Not calibration gated."

Sizing: 60,000 to 70,000 characters of HTML inside a JSON string is roughly 17,000 to 20,000 output tokens, plus low reasoning (a few hundred to about 2,000), so 24,000 covers the top of the guidance with a margin. `PROTOTYPE_HTML_MAX_CHARS` stays 90,000, so a document at the guidance ceiling still passes the validator.

Time budget (`maxDuration = 300`, route deadline 285 s, unchanged):

| Path | Steps | Worst case |
|---|---|---|
| Create | style 30 s, create up to 210 s | 240 s; the fix round needs 75 s left, so it runs only when the create finished early, with timeout `min(210, remaining - 20)` |
| Update by edits | style 0 s (reused), edit up to 60 s | 60 s |
| Update, edit failed | edit 60 s, rebuild up to `min(210, 285 - 60 - 20)` = 205 s | 265 s; no fix round |
| Rebuild (large change or new host) | style up to 30 s, rebuild up to 210 s | 240 s |

Constants in `prototype-run.ts`: `STYLE_BUDGET_MS = 30_000`, `LONG_CALL_CAP_MS = 210_000`, `EDIT_CALL_CAP_MS = 60_000`; `MIN_CALL_MS`, `CALL_HEADROOM_MS` and `FIX_MIN_MS` unchanged. `llm.ts`'s 240 s ceiling on `timeoutMs` already allows 210 s.

Risk: Sonnet's output rate through OpenRouter varies. At about 90 tokens a second, 20,000 tokens takes about 220 s and would time out; the prompt therefore aims at 40,000 to 60,000 characters (about 12,000 to 17,000 tokens, 130 to 190 s) with 70,000 as the ceiling. The call log's `ms` per call shows real timings after the first smoke runs. If timeouts appear, the two levers are the admin model setting (back to Haiku with no deploy) and, if the Vercel project runs Fluid Compute on Pro, raising `maxDuration` to 600 with the route deadline and caps scaled to match. That second lever is out of scope here and needs Anthony to confirm the project setting.

## R2.8 The new prompt rules, exact text

In `PROTOTYPE_RULES` (`prompts.ts`), three existing lines change and a design block is added. The resulting rules, in order (lines not listed stay as they are):

Changed line, images:

```
- No <link> tags, no external URLs, no <img> other than the logo, no icon fonts. Draw icons and charts with CSS or inline <svg> written in the document.
```

Changed line, screens (replaces the "default shape is sign in, dashboard..." line):

```
- Choose the screens from the brief. The first <section data-screen> in the document is the main working screen, a dashboard or the main list of records, and it is the one visible when the page opens. A sign in screen is optional; if you include one it is the last screen and the last navigation button.
```

Changed line, size (replaces "Every id is unique. Keep the document under 45,000 characters."):

```
- Every id is unique. Aim for 40,000 to 60,000 characters and never go over 70,000.
```

New block, appended after the build rules:

```
Design quality:
- Use the full width of the frame. The navigation bar spans the whole width. Each screen's content sits in a centred container with max-width 1280px and 24px side padding.
- Fill every screen with realistic, dense sample data for this business, as a real user would see it on a busy day. No large empty areas.
- Every list screen has a table of 8 to 12 rows with at least five columns, and a search box plus at least one filter (a select or a row of buttons). Typing in the search box or choosing a filter hides the rows that do not match.
- The dashboard has three or four figure cards (a number, a label and the change against last month) and at least one simple bar or line chart drawn with CSS or inline SVG, with labelled axes.
- Show status as small coloured labels (for example Open, Pending, Done), with at least three different states across the data.
- Use one spacing scale (4, 8, 12, 16, 24, 32 and 48px) and one type scale (12, 14, 16, 20, 24 and 32px). Headings use var(--font-heading); everything else uses var(--font-body). One border radius throughout.
- The navigation bar background is the nav background colour from the house style and its text is the nav text colour. Primary buttons, the active navigation item, links, focus rings and the main chart series use var(--brand-1). Use var(--brand-2) and var(--brand-3) for secondary accents and further chart series. The page background is var(--bg) and body text is var(--text).
```

`houseStyleBlock` gains two lines after "Text colour": `Nav background colour: {navBackground}` and `Nav text colour: {navText}`. They are hex values from the merge, so no third party text enters the prompt through them. The system turn still carries no prospect or website text; the edit and fix prompts reuse `PROTOTYPE_RULES` and so get the same block.

Not added: a validator check that the first screen is not a sign in screen. A miss would cost a whole fix round (up to 210 s) for a layout preference; the prompt rule is enough, and the smoke test checks it.

## R2.9 `.env.example`

Added under a new heading after the Ask Summit block:

```
# Project Builder brand data (Round 2)
# Optional. When the prospect's website cannot be read, or gives no logo or colours, the prototype asks
# the Brandfetch Brand API (https://docs.brandfetch.com) for the company's logo, colours and fonts.
# Server side only; never sent to the browser or logged. Without it the step is skipped and the
# prototype uses what the website gave, or a plain style.
BRANDFETCH_API_KEY=
# Optional. Live Brandfetch lookups allowed per UTC day across the site (cached domains do not count).
# Default 200. 0 turns lookups off. Answers are cached per domain for 30 days (7 days for not found).
BRANDFETCH_DAILY_CAP=200
```

## R2.10 Test plan

All on `node:test` with `node:assert/strict`, no network and no Redis: pure modules directly, `brandfetch.ts` through injected deps.

`__tests__/project-builder-brand-data.test.ts`

- `parseBrandfetch`: a fixture shaped like the documented response (logos with types, themes and formats; colours with types; fonts with origins) maps to `BrandData`; missing arrays become empty; non `https:` `src` dropped; caps on logos, formats, colours and fonts; a non object throws nothing and returns empty data.
- Logo choice: `logo` beats `symbol` beats `icon`; `other` ignored; `dark` theme before null before `light`; `svg` before `png` before `webp` before `jpeg`; a format with `size` over 204,800 skipped; a raster under 160 px wide ranked after a wider one; at most four candidates; each carries its theme.
- Colour choice: `accent` first, then `brand`, then `dark`; an invalid hex dropped; white, black and a grey dropped; near duplicates merged; at most three.
- Fonts: a `google` title font on the allow list becomes the heading family; a `custom` font not on the list gives no family; a `body` font fills the body role.
- Nav: a `light` theme logo gives a dark nav with white text; a `dark` theme logo gives the page background; no logo gives `colours[0]` with the higher contrast text.
- `needsBrandLookup`: true for null parts, no logo, no colours; false for a site with logo and colours but no fonts.
- `mergeHouseStyle`: a partial site (two colours, no logo) plus brand data keeps both site colours first, adds one brand colour, takes the brand logo, keeps site background and text, and has source `site+brand`; a site with nothing plus brand data gives source `brand`; brand null keeps the site result with source `site`; both empty gives the neutral style with the site reason and source `neutral`; status follows `buildHouseStyle`.
- `normaliseHouseStyle`: a round 1 stored style gains `source`, `brandLookup`, nav colours and `logoTheme` defaults.
- `styleNoteFor`: one assertion per line in R2.4, including the brand miss line; no line contains an em or en dash.

`__tests__/project-builder-brandfetch.test.ts` (fake fetch, in memory cache, fake reserve, fake env, captured logger)

- No key: outcome `no-key`; fetch, cache and reserve never called; nothing logged.
- Cache hit: a stored found record returns `cached-hit` with the data; no fetch, no reserve. A stored miss returns `cached-miss`.
- Cap refused: outcome `cap`; no fetch.
- 200: the request URL is `https://api.brandfetch.io/v2/brands/domain/acme.com`, the `Authorization` header is `Bearer {key}`; outcome `hit`; cache written with 2,592,000 s.
- 404: outcome `miss`; cache written `{ found: false }` with 604,800 s.
- 400: `miss`, not cached. 401, 403, 429 and 500: `error`, not cached.
- Timeout: a fetch that rejects with a `TimeoutError` or `AbortError` gives `error`; under 1 s left skips the call.
- Unparsable 200 body: `error`, not cached.
- The key: no logged string, no cached value and no returned value contains the key.

Updated tests

- `project-builder-house-style.test.ts`: `buildHouseStyle` unchanged statuses; neutral style carries `source: "neutral"`.
- `project-builder-prompts.test.ts`: the create prompt's system turn contains the first screen rule, "sign in screen is optional", "8 to 12 rows", "three or four figure cards", "bar or line chart", "40,000 to 60,000" and "70,000", the inline SVG clause and the `Design quality:` block; the edit and fix prompts contain the same block; `houseStyleBlock` carries the two nav lines; still no prospect text, tagline or site name in any system turn.
- `project-builder-stats.test.ts`: brand lookups, hits, cached, misses, errors, capped and the four source counts from fixture style events.
- `project-builder-prototype.test.ts`: `styleNoteFor` signature change.

Not unit tested (network): `readHouseStyle` end to end and the live Brandfetch call. Smoke after deploy with the key set: kroger.com (blocked site, expect source `brand`), a WordPress site with a logo (expect `site`, no lookup), a site with colours but no logo (expect `site+brand`), and one run with the key unset (expect today's behaviour). Check the first screen is a dashboard or list, the panel spans the window, and the call log `ms` for the create.

Gates: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`. Calibration does not apply.

## R2.11 Decisions and risks

- Explicit `/v2/brands/domain/{domain}` route instead of the bare identifier route named in R1: the same Brand API, documented, and a short domain cannot be read as a ticker. The Reviewer can swap the path if Anthony prefers the literal R1 form; nothing else changes.
- Lookup only when the logo or colours are missing (not for fonts alone): keeps quota for the cases that look poor.
- 404s cached for 7 days, found brands for 30: a 404 costs a credit; a shorter miss window lets a newly indexed brand appear.
- Brand logo addresses may refuse unsigned fetches (the docs only promise signed shortcut URLs). Expected: the next candidate is tried, then the wordmark. No signing or client id work is in scope.
- A site logo has no theme; the nav defaults to the page background for it, so a light logo on a light nav is the remaining risk for site logos. The brand logo path avoids it by theme.
- Third party text: only hex colours, allow listed font names and checked image bytes from Brandfetch reach the prototype or the prompt. The sandbox, CSP and safety pass are untouched.
- The per domain cache is shared across briefs and outlives a deleted brief. It holds public brand data about a company, not anything the prospect typed.
- Bot protection: a blocked site is treated as unreadable. No browser user agents, no header spoofing, no retries designed to get round a block.
