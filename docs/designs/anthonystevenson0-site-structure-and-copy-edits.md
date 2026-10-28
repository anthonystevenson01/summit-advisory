# Product Studio: rename and Startups / Enterprise choice

Branch: `anthonystevenson0/site-structure-and-copy-edits` (28 Oct 2026)

Iterative edit session directed by Anthony in the browser preview. No separate Architect pass; design recorded here.

## Files

- `app/page.tsx`: `AIStudioPage` becomes `ProductStudioPage` with local `audience` state ("startups" by default) and two toggle buttons under the hero. Startups shows the existing equity content and idea form unchanged. Enterprise renders a new `EnterpriseStudio` component built from the "Summit Product Studio intro, Oct 26" deck. Home card, contact dropdown, link strip and footer renamed.
- `app/globals.css`: one new `.studio-choice*` block for the toggle buttons. Everything else reuses existing classes (`.features`, `.process-steps`, `.case-grid`, `.equity-band`, `.submit-btn`).
- `app/ai-studio/page.tsx`, `app/layout.tsx`, `public/llms.txt`: "AI Product Studio" renamed to "Product Studio" in headings, metadata and schema.
- Footers in the loyalty, scale-up, newsletter and toolkit pages: "AI Studio" link label renamed.

## Decisions

- The `/ai-studio` URL and the `?page=ai` deep link stay, so existing links and search results keep working.
- Toggle buttons use `aria-pressed` inside a labelled group rather than a partial ARIA tabs pattern.
- Enterprise copy carries no pricing: every build is quoted against a signed-off spec in the Project Builder, which the tab links to.

## Out of scope

- The standalone `/ai-studio` page gets the rename only, not the toggle.
- Admin screens, API logs and the existing blog post title.
- Older copy on the page that still uses dashes.
