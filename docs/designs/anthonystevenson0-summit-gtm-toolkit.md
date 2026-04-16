# Summit GTM Toolkit — Technical Design Document

---

## Preliminary Findings from Codebase Exploration

**Framework confirmed:** Next.js App Router (v16.1.5), TypeScript, React 19, Tailwind CSS v4. All routing is file-system based. No React Router. Components live in `app/components/`.

**Existing AI pattern:** Every AI call goes through a server-side `app/api/*/route.ts` file. The `@anthropic-ai/sdk` is imported server-side only. No client ever touches the Anthropic key directly. This is a non-negotiable existing convention.

**Existing font system:** `globals.css` imports Barlow and Barlow Condensed. Oswald is introduced as a second font family scoped to toolkit UI only.

**Existing CSS system:** Hand-written CSS class system in `globals.css`. Tailwind v4 installed but existing pages use named CSS classes. New toolkit pages use the same approach, scoped under `.toolkit {}` to prevent namespace collisions.

**Rate limiting pattern:** `app/lib/ratelimit.ts` exports named factory functions using Upstash Redis with sliding window. New tools follow the same pattern.

**No existing `/tools` or `/newsletter` routes:** Greenfield directories.

**Spec conflict on AI calls resolved:** Spec section 2.3 says "client-side" (written for claude.ai artifact context). This site makes all AI calls server-side. Decision documented in Key Decisions section.

---

## 1. Files to Create / Modify

### Files to Modify (existing)

| File | Change | Why |
|---|---|---|
| `app/globals.css` | Add Oswald Google Fonts import; add toolkit CSS variable aliases; add toolkit-scoped base styles | Oswald not currently loaded; toolkit needs its own font/variable namespace without breaking existing pages |
| `app/lib/ratelimit.ts` | Add `getToolLimiter` and `getAccountIntelLimiter` factory functions | Tool API routes need rate limiting consistent with existing pattern |

### New Files — API Routes

| File | Purpose |
|---|---|
| `app/api/prompts/route.ts` | Fetches active prompts from Notion GTM Tool Prompts database; returns `{ positioning, problem, persona, moat, account }`; Cache-Control s-maxage=300; returns {} on Notion failure |
| `app/api/gtm/positioning/route.ts` | Server-side Anthropic call for Tool 01 |
| `app/api/gtm/problem/route.ts` | Server-side Anthropic call for Tool 02 |
| `app/api/gtm/persona/route.ts` | Server-side Anthropic call for Tool 03 |
| `app/api/gtm/moat/route.ts` | Server-side Anthropic call for Tool 04 |
| `app/api/gtm/account/route.ts` | Server-side Anthropic call for Tool 05 with web_search_20250305 tool; parses multi-block content array |
| `app/api/newsletter/signup/route.ts` | Newsletter signup proxy; forwards to NEWSLETTER_ENDPOINT if set; returns coming_soon if absent |

### New Files — App Routes

| File | Purpose |
|---|---|
| `app/tools/page.tsx` | GTM Toolkit hub page; server component wrapper |
| `app/tools/layout.tsx` | Toolkit layout; applies .toolkit scoped class |
| `app/newsletter/page.tsx` | Newsletter hub/archive page; server component wrapper |
| `app/newsletter/[issue]/page.tsx` | Individual newsletter issue reading view |
| `app/newsletter/layout.tsx` | Newsletter layout |

### New Files — Components

| File | Purpose |
|---|---|
| `app/components/toolkit/ToolkitHub.tsx` | Hub page client component; manages `activeTool` state; all hub sections |
| `app/components/toolkit/tools/PositioningTool.tsx` | Tool 01 client component; dark surface |
| `app/components/toolkit/tools/ProblemTool.tsx` | Tool 02 client component; light surface |
| `app/components/toolkit/tools/PersonaTool.tsx` | Tool 03 client component; light surface |
| `app/components/toolkit/tools/MoatTool.tsx` | Tool 04 client component; dark surface; collapsed threat scenario |
| `app/components/toolkit/tools/AccountIntelTool.tsx` | Tool 05 client component; dark surface; cycling loading messages |
| `app/components/toolkit/shared/DimRow.tsx` | Dimension score row; props: dimension object, dark bool |
| `app/components/toolkit/shared/NewsletterCapture.tsx` | Email capture; dark/light variants; graceful coming-soon |
| `app/components/toolkit/shared/Tag.tsx` | Pill label; props: children, color |
| `app/components/toolkit/shared/Loader.tsx` | Loading spinner; props: dark, label, sub |
| `app/components/toolkit/shared/CyclingLoader.tsx` | Cycling-message loader for Tool 05; cycles every 2.8s |
| `app/components/toolkit/shared/ErrMsg.tsx` | Error display; props: msg, retry, dark |
| `app/components/toolkit/hooks/usePrompts.ts` | Fetches /api/prompts; merges over FALLBACK_PROMPTS; sessionStorage cache |
| `app/components/toolkit/data/fallbackPrompts.ts` | FALLBACK_PROMPTS constant for all five tools |
| `app/components/toolkit/data/toolConfig.ts` | Static metadata: id, name, tagline, accent, surface, output description |
| `app/components/newsletter/NewsletterHub.tsx` | Newsletter landing/archive; manages activeIssue state |
| `app/components/newsletter/NewsletterReader.tsx` | Issue reading view; sticky nav; block renderer |
| `app/components/newsletter/data/issues.ts` | Static issue data; four placeholder issues; Issue type |

---

## 2. Integration Points

### Toolkit Pages and Root Layout
`app/tools/layout.tsx` is a nested layout — composes inside root `app/layout.tsx`. No `<html>` or `<body>` duplication. Toolkit layout applies `.toolkit` CSS class wrapper. `globals.css` is already imported at root level.

### usePrompts Hook Integration
Called once in `ToolkitHub.tsx` on mount. Resolved `prompts` object passed as prop to each tool component. Prevents redundant fetches when switching tools. sessionStorage key: `gtm-prompts-v1`.

### Tool API Route Integration
Each tool component: form submission → POST to `/api/gtm/{tool}` with field values + `systemPrompt` string → route validates, rate-limits, calls Anthropic, returns parsed JSON → component renders result.

The `systemPrompt` is passed client→server in POST body. Not a credential — it is configuration text already received via `/api/prompts`. Server validates max length (8000 chars).

### Newsletter Signup
`NewsletterCapture` → `POST /api/newsletter/signup` → server checks `NEWSLETTER_ENDPOINT` → proxies or returns `coming_soon`.

---

## 3. Data Flow

### Tools 01–04 Standard Flow
```
User fills form
→ POST /api/gtm/{tool} with { fields, systemPrompt }
→ Route: validate lengths → rate limit (5 req/IP/hr) → Anthropic messages.create
  (model: claude-sonnet-4-20250514, max_tokens: 1200, system: systemPrompt)
→ Parse JSON from text block (first { to last })
→ Return NextResponse.json(parsed)
→ Component: render result view

Error paths:
  429 → ErrMsg "Too many requests"
  502 → ErrMsg "Analysis failed — please try again"
  500 → ErrMsg with message
  Notion unreachable → usePrompts falls back silently; tool functions normally
```

### Tool 05 Account Intelligence Flow
```
User fills account name (required) + optional fields
→ POST /api/gtm/account
→ Route: validate → rate limit (3 req/IP/hr)
→ Anthropic messages.create with tools: [{ type: "web_search_20250305" }], max_tokens: 2000
→ Iterate content array from end → find last text block → parse JSON
→ Return NextResponse.json(parsed)

Client loading path:
→ loading: true → CyclingLoader with 6 messages every 2.8s
→ fetch() resolves (20–30s) → loading: false → render result
```

### Prompt Fetch Flow
```
ToolkitHub mounts → usePrompts fires
→ Check sessionStorage["gtm-prompts-v1"] → if cached and fresh (5min TTL), return
→ GET /api/prompts
  → Check NOTION_TOKEN + NOTION_PROMPTS_DB_ID → if missing: return {}
  → Query Notion for active pages → fetch blocks → return { positioning, problem, ... }
  → Cache-Control: s-maxage=300, stale-while-revalidate=60
→ Merge Notion over FALLBACK_PROMPTS → store in sessionStorage
→ Return { prompts, loading: false, source, error }
```

### Newsletter Routing Flow
```
GET /newsletter → NewsletterHub → activeIssue = null → landing/archive view
User clicks issue → setActiveIssue(id) → NewsletterReader renders in-place
GET /newsletter/001 (direct link) → [issue]/page.tsx → NewsletterReader with pre-selected issue
Issue not found → "Issue not found" within newsletter layout
```

---

## 4. Key Decisions

### D1: ICP Evaluator — Link from hub, do not migrate
Link from toolkit hub with distinct "Existing Tool" visual treatment. No migration. Rationale: existing two-phase Haiku + Sonnet architecture, Google Drive rubric loading, and Redis submission pipeline risk breaking admin panel if migrated. Confirmed by spec: "Confirm with Anthony before deciding" — safest call autonomously is to link, not migrate.

### D2: All AI calls are server-side (spec section 2.3 overridden)
Spec section 2.3 written for claude.ai artifact context. Production Next.js site: all AI calls go through `app/api/*/route.ts`. Client-side Anthropic key would be visible to any user in network tab. This is a security violation and violates the site's existing convention.

### D3: Tool 05 web_search call is server-side
`web_search_20250305` passed in `tools` array inside `app/api/gtm/account/route.ts`. Route handles multi-block response parsing. Multi-block format is an implementation detail that belongs server-side, not in client component code.

Risk: Vercel function timeout. Tool 05 takes 20–30s. Route must declare `export const maxDuration = 30`. Requires Vercel Pro or above.

### D4: Oswald via @import in globals.css, scoped to .toolkit
Follows existing font loading pattern. `.toolkit` CSS scope prevents Oswald bleeding into existing pages.

### D5: NEWSLETTER_ENDPOINT is server-side (not NEXT_PUBLIC_)
Newsletter platforms require API keys in auth headers. `NEXT_PUBLIC_` would expose these. Server proxy route is two lines now and avoids painful refactor later.

### D6: systemPrompt passed through POST body client→server
Avoids server re-fetching Notion on every API call. Prompt is not a credential. Server validates length.

### D7: activeTool state + query param deep links
`/tools?tool=positioning` sets initial `activeTool` on load. Consistent with existing `?tool=icp-evaluator` pattern. Simpler than full URL segments per tool.

---

## 5. Constraints Honoured

- **Existing pages untouched:** Only additive changes to `globals.css` (scoped `.toolkit`) and `ratelimit.ts` (new functions at bottom)
- **Prompts from Notion with fallbacks:** `usePrompts` + `/api/prompts` + `FALLBACK_PROMPTS` architecture implemented exactly as specified
- **Tool 05 web_search:** `web_search_20250305` in server-side route; multi-block parsing implemented
- **claude-sonnet-4-20250514, correct max_tokens:** Applied per route
- **Summit brand palette:** CSS variable aliases; no off-brand colours
- **Zero new npm dependencies:** `@anthropic-ai/sdk` already installed; all else is built-ins
- **Secrets server-side only:** All env vars accessed in `app/api/` routes only
- **Oswald + Georgia:** Oswald via @import; Georgia via `.toolkit-prose` class
- **Exact niche copy:** "For teams selling into a finite market" verbatim in nav + footer
- **Suite name "Summit GTM Toolkit":** Applied verbatim
- **Threat Scenario + Suggested Rewrite collapsed:** Both `useState(false)` with deliberate reveal
- **Responsive to 375px:** Grid collapses to 1 column at 640px breakpoint
- **Newsletter graceful signup:** `coming_soon` response when `NEWSLETTER_ENDPOINT` absent

---

## 6. Out of Scope

- **Ecrebo Outbound Pipeline:** Separate product, separate spec, separate build
- **Newsletter sending/CMS:** Static TypeScript data; configurable signup endpoint only
- **Analytics:** Vercel Analytics deferred (open item in spec); comment placeholder in layouts
- **Notion database setup:** Operational task for Anthony; code is fallback-first
- **Admin panel integration for toolkit submissions:** GTM toolkit is public lead gen; no Redis persistence for tool usage
- **ICP Evaluator migration:** Linked from hub; not migrated
- **Streaming responses:** Full JSON responses only; CyclingLoader simulates activity

---

## Risks

1. **Vercel timeout (Tool 05):** 20–30s web search requires Pro plan with 30s function timeout. `maxDuration = 30` export in route. ErrMsg handles 504 gracefully.
2. **web_search_20250305 availability:** Requires tool access on API key tier. API error is surfaced clearly via ErrMsg.
3. **Notion rate limits on cold start:** Mitigated by Vercel CDN edge cache (s-maxage=300).
4. **CSS class namespace collision:** All toolkit classes prefixed `tk-` or nested under `.toolkit {}`.

---

## Assumptions

1. Vercel Pro or above (30s function timeout for Tool 05)
2. `ANTHROPIC_API_KEY` already set in Vercel project (used by existing routes)
3. `web_search_20250305` available on existing API key tier
4. No auth wall on toolkit tools (public lead gen)
5. Four placeholder newsletter issues are static TS data
6. `typeof window !== "undefined"` guard in `usePrompts` for SSR safety
7. Toolkit nav is self-contained; does not use existing `.nav` CSS classes
