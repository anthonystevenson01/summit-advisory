---
# Task Spec: Project Builder, Release 1: the public builder, save and resume, submit and hand-off
# Source: the "Project Builder: design doc" Claude Doc (23 October 2026) and the prototype page saved at docs/prototypes/project-builder-prototype.html
# Not in this release: the report studio, the draft report and its suggested diagrams, the AI review, the Google Doc, and the background business research with web search and Clay. Those are Releases 2 and 3.
# Owner: anthonystevenson0
# Branch: anthonystevenson0/project-builder-1-builder
# ticket_id: none

objective: >
  A public page at /tools/project-builder where a prospect defines a software project
  in six steps, with a one-tap suggestion on every step, saves it and comes back by an
  emailed link on any device, and submits it to Summit. The builder, its catalogue, its
  requirements engine, its prompts and its rule-based fallbacks come from the prototype
  and are rebuilt inside this Next.js site, not as a separate app. Every model call goes
  through the existing routing layer; briefs, business context and save tokens live in
  Upstash Redis; the save link, the submit confirmation and the alert to Anthony go
  through the existing mail transport; every submitted brief becomes a page in a Notion
  "Project Briefs" database; and a small read-only admin section lists briefs, shows one,
  sets its status and can unlock it for changes. The prospect never sees a report or a
  download: the confirmation page says Anthony will send the project brief within two
  working days. The design doc's stack choices (Vite, Supabase, Supabase Auth, Turnstile)
  are replaced by what this site already has, as listed under constraints.

acceptance_criteria:
  1. Catalogue and engine as pure modules. The prototype's data (the four starting points, the example ideas, the user roles, the 15 feature cards with their keyword matchers and requirement sentences, the integrations, the compliance options, the handover options and sentences, the four "who runs it" options, the 40 capabilities, the 34 systems in 8 categories, the replacement reasons, the generic capability set, the AI idea kinds and sizes, the six step names, the priority labels and the source labels) lives in `app/lib/project-builder/catalogue.ts` as plain typed data with no imports. The brief state shape, `blank()`, the requirements builder (feature, custom, AI idea, integration, guardrail and handover rows with category, priority and source), the Must/Should/Could counts, the six essentials, the completeness percentage, the replacement reasons to requirement sentences (with the system name substituted), the rule-based step suggestions and the rule-based smart ideas keyed off chosen features all live in `app/lib/project-builder/` pure modules that import nothing from Next, React, Redis or the network. Behaviour matches the prototype: the same inputs produce the same requirement rows, counts, essentials and completeness. Tests cover each of them.
  2. The page. `/tools/project-builder` is a server page with metadata (title, description, canonical, OpenGraph and Twitter images from the existing `/opengraph-image`) and an `ld+json` WebApplication block in the same shape as the tool pages, in the sitemap at priority 0.8, rendered inside the standard toolkit chrome (`SiteNav` with `activePage="tools"`, a back link to /tools, `ToolkitFooter`). The client component renders the six steps from the prototype (Your business, The goal, What it does, Rules and running it, Make it smarter, Submit) with the stepper across the top (completed steps green, any step reopenable by tapping it), Back and Next, the Save button at the top of every step, and the blueprint strip docked at the bottom with the running counts, the completeness meter, the full list by priority coloured by source, and the per-item priority change and remove. Step 1 opens with "Tell us what you want to build." and no subtitle, then the project name, the business section (website and "Anything else we should know?", no example text) and the four starting points; the document and partly-built routes show the paste box and a file input for .txt, .md and .csv read in the browser (no upload to the server, 60,000 character cap); the idea route shows the one-sentence field with the tappable examples; the replacing-a-system route shows the category chips, the system grid, the "not listed" field, the capability cards with priorities and "Select what most teams use", the reasons, the data and parallel-running questions and "Build my requirements list". Progress saves to localStorage on every change before the first server save, so a refresh on the same device loses nothing. Works at 375px with no horizontal scroll. Inline BRAND styles and `globals.css` classes; Barlow Condensed and DM Sans, not Oswald or Carlito.
  3. Suggestions. Four AI endpoints under `app/api/project-builder/`, each POST, each with a honeypot field, an input size cap, a per-IP limiter and a per-brief cap enforced from the brief record where a brief id is given: `read` (the document and partly-built routes; returns the extracted baseline: name, problem, audience, success, sign-off, roles, features with priorities, custom requirements marked "From your document", integrations, guardrails, and lines it could not place), `lookup` (a system not in the catalogue; returns its usual capabilities as cards), `suggest` (one endpoint, a `step` field choosing the goal, features, connections, guardrails or running-it helper; fills only blank fields and adds, never overwrites) and `ideas` (make it smarter; three to six cards with what it does, the part of the brief it builds on, the kind, the size and how it helps the success measure, with a human-in-charge note on anything touching customers, money or personal data, or a "no AI needed" answer with one or two simple automations). Every call sends the same context block: the business notes and website, the starting point, the system being replaced and why, and every answer from every step including later ones and the ideas turned down. Prompts are the prototype's four prompts moved to `app/lib/project-builder/prompts.ts` with the same JSON output shapes expressed as `NamedSchema` objects for `callModel`; a failed or malformed call returns the rule-based fallback for that step with `fallback: true` and the page says so in one line. Every helper has Undo. Limits: 5 document reads per IP per day, 30 suggestions per brief, 3 ideas runs per brief, 200 builder model calls per day site wide (over it, the helpers say so and the prospect fills the step by hand).
  4. Routing. Three new routing tasks in `ROUTING_TASKS`, `DEFAULT_ROUTES`, `TASK_LABELS` and `TASK_DESCRIPTIONS`: `builder-read` (claude-haiku-5.5, fallback claude-sonnet-5.5, used by `read`), `builder-suggest` (claude-haiku-5.5, used by `lookup` and `suggest`) and `builder-ideas` (claude-sonnet-5.5, used by `ideas`). None is calibration gated. They appear in /admin/models like the others and resolve through overrides in `admin:model-config`. No model id anywhere but `llm.ts`. Every call is logged to `ai:calls` with the brief id in the log entry so cost per brief can be read from the log.
  5. Save and resume. The first Save opens a short form: name, work email, company name and company website, all required; the website accepts `acme.com` or a full URL and is stored as the bare lowercase domain; a free-mail address (gmail, hotmail, outlook, yahoo, icloud) gets a one-line prompt for a work address but is allowed; one consent line under the form ("we'll email you a link to your brief, and Anthony may follow up") and a separate unticked marketing box. `app/lib/briefs.ts` stores one Redis hash per brief at `brief:{id}` (the brief state, contact with the email in clear and its hash, source tag from `?src=`, status, `savedAt`, `submittedAt`, `updatedAt`, `lastRemindedAt`, `notionPageId`, `notionStatus`, `suggestCount`, `ideasCount`, `readCount`), an index sorted set `briefs:by-updated`, a per-email set `briefs:by-email:{emailHash}`, and the pasted source text separately at `brief-source:{id}` with a 90 day TTL. Drafts expire 6 months after their last update (a TTL refreshed on every save); submitted briefs persist. The save route emails the resume link through `app/lib/mail.ts` with the subject "Pick up your project brief where you left off": a signed token from `app/lib/tools/unlock-token.ts` under a new purpose `brief-link` carrying the brief id, verified with a 30 day `maxAgeSeconds`, in the URL as `/tools/project-builder?b={id}&t={token}`. Opening the link loads the brief at the step it was left, with everything as it was including what Claude pulled from the document. After the first save, the page autosaves on every step change through a PUT that carries the token, and the Save button reads "Saved at 14:32". "Email me my link" on the start screen takes an address and always answers "If we have a brief for that address, the link is on its way", sending a fresh link for every draft under that hash and nothing on screen. Every email carries a "Delete my brief" link (purpose `brief-delete`, claim the email hash) whose GET shows a confirmation page and whose POST removes every brief, source text and index entry under that hash, in the same plain HTML style as the existing delete-my-data page.
  6. Submit. The Submit step shows the six essentials as a checklist (problem, success measure, sign-off, one user, one must have, who runs it) with the missing ones prompted and submit still allowed, the contact form when the brief has not been saved, and the summary. Submit sets the status to `submitted`, locks the brief (saves and suggestions on a submitted brief answer 409), tracks the event, sends the confirmation email to the prospect ("Anthony will send your project brief within two working days", with the view link and the delete link), sends the alert to `NOTIFY_EMAIL` (name, company, project, starting point, Must count, source, the admin link, and a line when the Notion write failed), and creates the Notion page. The confirmation page says the same thing. Opening the link after submit shows a read-only view of the answers and the status, never a report. "Ask to change something" on that view posts a short message that emails Anthony; Anthony unlocks the brief from admin, which sets the status back to `draft` and emails the prospect their link.
  7. Notion. `app/lib/project-builder/notion-brief.ts` is a pure builder of the Notion page properties and body blocks for a brief: Project name (title), Company, Contact name, Email, Website, Source, Starting point, System replaced, Must, Should and Could counts (numbers), Budget, Timing, Status (select: Draft, Submitted, With Summit, Shared, Approved, Changes requested, Quoted, Won, Lost), Submitted (date), Admin link (url), and a body carrying the brief, the requirements table by priority with source, the AI ideas added and passed on, and the prospect's own notes. `app/lib/project-builder-notion.ts` writes it with `fetch` against the Notion API (`NOTION_TOKEN`, the existing `Notion-Version`, the new `NOTION_BRIEFS_DB_ID`), creating the page on the first save with status Draft and updating it on submit and on every admin status change, with three retries on a 5xx or network error and the outcome stored on the brief as `notionStatus` (`ok` or `failed`) and `notionPageId`. A failed write never blocks the prospect. No company or person database relation in this release.
  8. Admin. `/admin/briefs` lists briefs from the index (updated, project, company, contact, status, starting point, Must count, source, Notion status, links to the admin view and the Notion page). `/admin/briefs/[id]` shows the full brief read only (contact, source tag, every answer by step, the requirements table, the ideas added and passed on, the pasted source text while it still exists, the suggestion counts and the model calls for that brief from `ai:calls`), a status select with Save (writes the brief and updates Notion), an Unlock button for a submitted brief (status back to `draft`, link re-emailed), and a Delete button with a confirm step. Plain form POSTs to `app/api/admin/briefs/[id]/route.ts` behind `validateSession()`; the admin layout nav gains "Briefs". The daily report cron gains a "Project briefs" section listing briefs saved or submitted in the last 24 hours, sends one reminder to any draft untouched for 3 days that has not had one (how far through they are, the link, one line to opt out by deleting the brief), and deletes drafts untouched for 6 months whose TTL has not already removed them.
  9. Hub. `/tools` gains a short block above the newsletter capture, "Building something? Define your project and Summit will send you a brief", linking to /tools/project-builder, with its copy in `app/tools/hub-copy.ts`. The tool count copy and the three path cards do not change. `__tests__/gtm-toolkit.test.ts` still passes.
  10. Events, through the existing `track`: `builder_started`, `builder_step_completed` (step number), `builder_doc_read`, `builder_suggest_used` (step), `builder_ideas_run`, `builder_saved` (first save only), `builder_resumed`, `builder_submitted` (source, starting point, Must count), `builder_change_requested`, `brief_deleted` (count only). No answer text and no address in any event.
  11. Data handling. Nothing leaves the browser before the first save except text sent to `read`, which is processed and not stored. Addresses never appear in tokens, URLs, logs or events; the hash does. The admin view is the only place a brief is readable without its token. `.env.example` documents `NOTION_BRIEFS_DB_ID`. The page carries a plain line by the paste box that pasted material is not used to train models and is deleted after 90 days, and links the privacy notice.
  12. Tests (node:test, pure modules only): the catalogue shape (every system's capabilities exist in the capability list, every feature has a matcher and a sentence); the requirements builder for each source and category; counts, essentials and completeness at the boundaries; the replacement reason sentences with the system name; the rule-based suggestions and ideas; the brief state validation and the domain normaliser (acme.com, https://www.acme.com/path, bad input); the free-mail check; the status machine (draft to submitted, submitted locks, unlock back to draft, admin statuses); the token purposes `brief-link` and `brief-delete` (round trip, wrong purpose, expired link); the four email templates (save link, confirmation, alert, reminder) carry the right links, no dashes and no address in the subject; the Notion page builder produces every property and the body blocks; the prompt builders include every step's answers and the turned-down ideas in the context block; each JSON schema parser accepts a valid reply and rejects a malformed one.
  13. Stats page. `/admin/stats` is a server-rendered page behind the admin middleware that reads the `events` stream (XRANGE by time) for a window of 7, 30 or 90 days chosen by a query parameter, defaulting to 30, and shows plain tables: the builder funnel (started, reached each of the six steps, saved, submitted, with the drop-off between each as a count and a percentage), saves and submits by source tag, helper use by step with the rules-fallback count, document reads and ideas runs, model calls, tokens and spend per routing key for the window read from `ai:calls`, cost per submitted brief, and briefs by status from the brief index with the median time from submit to the first admin status change. The stream is read in pages of at most 1,000 entries; the aggregation is a pure function in `app/lib/project-builder/stats.ts` that takes the event rows and the call log rows and returns the tables, tested with a fixture of a few dozen events. The admin home gains a link to it. No charting library and no client JavaScript.
  14. `npm test`, `npm run lint` (0 errors), `npx tsc --noEmit` and `npm run build` pass. `npm run calibrate` is not needed: no scoring or synthesis prompt, model or rubric changes. `__tests__/scale-up-advisory.test.ts` stays byte-identical to main. `docs/runbook.md` gains an entry in the house format (trigger, service, failure modes, config, to disable).

project_setup:
  type: existing

constraints:
  - No new dependencies. Redis through `app/lib/redis.ts`, rate limits through `app/lib/ratelimit.ts` with new limiter prefixes, mail through `app/lib/mail.ts`, tokens through `app/lib/tools/unlock-token.ts` with new purpose strings read in `app/lib/unlock.ts`, Notion through `fetch`. No Supabase, no Turnstile, no Vite: bot protection is the honeypot plus the limiters, as on the tool routes.
  - Every model call goes through `callModel` with one of the three new routing keys. No model id, client or API key outside `app/lib/llm.ts`. `scoring`, `details`, `synthesis` and `extraction` routes, their prompts, the pipeline and the registry's tool entries are not changed; `ROUTING_TASKS` in the registry gains the three builder tasks and nothing else.
  - Prompts treat pasted text as material to analyse, never as instructions. Model output is rendered as text, never as HTML. Every helper fills blanks or adds; none overwrites a prospect's own words.
  - Secrets via environment variables only. Addresses never in tokens, URLs, logs or events. `UNLOCK_SECRET` signs the brief tokens; when it is unset the save still records the brief and the page says the link could not be emailed.
  - Styling: inline BRAND style objects and `globals.css` classes, the toolkit chrome, Barlow Condensed for display and DM Sans for text. The prototype's CSS is a reference for layout and behaviour, not for tokens or fonts. No Tailwind utilities.
  - Copy: British spelling, no em or en dashes, no hype words, plain sentences. Step copy, hints, helper labels, checklist wording, the consent line and the confirmation line come from the prototype and the design doc as written.
  - Pure modules under `app/lib/project-builder/` import siblings with relative paths and the `.ts` extension, import nothing from `next/*`, `react` or any component, and never touch Redis, the network or env. Tests import pure modules only.
  - `maxDuration = 60` or lower on every new route. The save and submit responses never wait on the Notion write or an email beyond the same budget rule the result email uses; a failed side effect is recorded on the brief and never returned as an error to the prospect.
  - The builder page keeps working when the API is briefly down: every step renders from local state, and only Save, the helpers and Submit need the server.
  - Nothing in this release renders a report, a summary or a download for the prospect, and nothing writes to Google Drive.

codebase_context:
  - CLAUDE.md
  - docs/prototypes/project-builder-prototype.html
  - docs/designs/anthonystevenson0-built-to-scale-3a-page.md
  - docs/designs/anthonystevenson0-built-to-scale-1b-gate.md
  - docs/runbook.md
  - app/lib/llm.ts
  - app/lib/tools/routing.ts
  - app/lib/tools/registry.ts
  - app/lib/tools/schema.ts
  - app/lib/tools/unlock-token.ts
  - app/lib/unlock.ts
  - app/lib/mail.ts
  - app/lib/tools/result-email.ts
  - app/lib/runs.ts
  - app/lib/events.ts
  - app/lib/ratelimit.ts
  - app/lib/rubrics.ts
  - app/lib/auth.ts
  - app/lib/brand.ts
  - app/lib/redis.ts
  - app/api/tools/[tool]/score/route.ts
  - app/api/tools/[tool]/details/route.ts
  - app/api/tools/[tool]/unlock/route.ts
  - app/api/tools/[tool]/errors.ts
  - app/api/tools/data/delete/route.ts
  - app/api/admin/daily-report/route.ts
  - app/api/admin/models/route.ts
  - app/admin/layout.tsx
  - app/admin/page.tsx
  - app/admin/runs/page.tsx
  - app/admin/models/ModelsClient.tsx
  - app/components/toolkit/BuiltToScalePage.tsx
  - app/components/toolkit/ToolPage.tsx
  - app/components/toolkit/ToolkitHub.tsx
  - app/components/toolkit/shared/UnlockGate.tsx
  - app/tools/[tool]/ToolRunner.tsx
  - app/tools/built-to-scale/page.tsx
  - app/tools/hub-copy.ts
  - app/tools/page.tsx
  - app/sitemap.ts
  - app/globals.css
  - .env.example
  - __tests__/unlock-token.test.ts
  - __tests__/result-email.test.ts
  - __tests__/gtm-toolkit.test.ts

output_format: >
  Code applied to disk on the working branch. The Architect writes the design to
  docs/designs/anthonystevenson0-project-builder-1-builder.md. The Reviewer's notes go to
  docs/reviews/anthonystevenson0-project-builder-1-builder.md.

ticket_id:

owner: anthonystevenson0

priority: high

required_access:
  - name: NOTION_BRIEFS_DB_ID
    why: The "Project Briefs" database every saved and submitted brief is written to. The existing NOTION_TOKEN integration needs insert and update access to it, not just read.
    where_to_get: Create the database in Notion with the properties in criterion 7, share it with the site's integration, copy the id from the database URL.
  - name: UNLOCK_SECRET, SMTP_*, NOTIFY_EMAIL, OPENROUTER_API_KEY, UPSTASH_*
    why: Already set for the GTM tools. Reused as they are.
    where_to_get: Vercel project settings.

notes: >
  Assumptions made where the design doc left a question open, each reversible later:
  the turnaround promise is two working days; briefs go into a new "Project Briefs"
  database with no relation to the Companies and People databases yet; Redis holds
  briefs and Supabase is not introduced; delivery partners have no access in this
  release; the site-wide model call cap starts at 200 a day and the OpenRouter spend
  alert is set by hand in the OpenRouter dashboard; the public-information lookup
  wording is not needed because the research job is not in this release. The
  prototype borrows four things from the Claude artifact runtime (sampling, a small
  database, the viewer's identity and a Google Drive connector); this release replaces
  the first two with the site's model layer and Redis and drops the other two until the
  studio arrives. The prototype's `window.claude.use` calls, its studio code and its
  report, diagram and Google Doc functions are reference only and must not be ported.
  Release 2 is the report studio, the draft report, the AI review and the diagram library
  (no fixed diagrams: the review suggests up to three from a library of six types and
  Anthony adds, removes or picks others) behind the admin login; Release 3 is the Google Doc export and the background business research.
