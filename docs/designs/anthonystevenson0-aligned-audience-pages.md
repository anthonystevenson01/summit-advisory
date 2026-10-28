# Product Studio and Scale-Up: one pattern, every choice on its own URL

Branch: `anthonystevenson0/aligned-audience-pages` (28 Oct 2026)

Directed by Anthony in the local preview over several turns. No separate Architect pass; design recorded here.

## Problem

Scale-Up had a hub with two option cards, each its own page. Product Studio was a view inside the homepage SPA (`/?page=ai`) with an in-page Startups / Enterprise toggle and no URLs, plus an older standalone `/ai-studio` page. The two practices presented the same kind of choice in two different ways.

## Design

- **Hubs.** `/product-studio` and `/scale-up-advisory` share one layout: "← All Practices" back link, hero, "Two ways in" with two cards. Product Studio adds recent work (Podbeat.ai, Canvas). Scale-Up's free GTM tools section is removed; the tools stay at `/tools` and `/tools/[tool]`.
- **Option pages.** `/product-studio/startups`, `/product-studio/enterprise`, `/scale-up-advisory/fractional-executive`, `/scale-up-advisory/outsourced-sales`. Each has a back link to its hub and nothing that links across to the other option (a switch was tried and removed at Anthony's request).
- **Content.** `app/product-studio/product-studio-content.ts` mirrors `scale-up-content.ts`: paths, hero copy, options, FAQs and JSON-LD as plain data.
- **Startup idea form.** Moved out of the SPA into `app/components/product-studio/StartupIdeaForm.tsx`, unchanged. It still posts to `/api/ai-studio-request`, so the admin queue at `/admin/ai-studio` keeps working.
- **Old URLs.** `/ai-studio` and `/?page=ai` are permanent (308) redirects to `/product-studio` in `next.config.ts`, next to the existing `?page=sme` entry. Home card, footers, sitemap and `llms.txt` point at the new URLs. The SPA Product Studio code and `app/ai-studio` are removed.
- **Byline.** "Last reviewed · By Anthony Stevenson, Founder" removed from every page (Scale-Up hub and option pages, Loyalty & Retail Media).

## Out of scope

- The homepage Loyalty & Retail Media card still opens the SPA view; `/loyalty-retail-media` is the standalone page. Same duplication Product Studio had; a candidate for the same treatment.
- `/api/ai-studio-request` and `/admin/ai-studio` keep their names.
- Startup form copy (including the stage option values, which are stored) is unchanged and still has dashes.
