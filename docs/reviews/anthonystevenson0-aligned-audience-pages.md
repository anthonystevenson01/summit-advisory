# Review: Product Studio and Scale-Up aligned, own URLs

## Loop 1: REJECT

The work was sound; two fixes were required.

1. In `next.config.ts` the new Product Studio entries sat between the Project Builder comment and its entry, so that comment described the wrong redirect. Moved the Product Studio block to follow the `?page=sme` entry.
2. No tests for the new redirects or content module. Added `__tests__/product-studio.test.ts`: `/ai-studio` and `/?page=ai` redirect permanently to `/product-studio`, the `ai` and `sme` query entries are separate, option hrefs sit under the hub path, and the FAQPage schema matches the FAQs.

## Loop 2: APPROVE

1. PASS. Three Product Studio pages and the content file in place. Form extraction faithful: fields, payload, validation, success and error states, endpoint.
2. PASS. Scale-Up hub matches; GTM tools section removed, tested exports kept.
3. PASS. No switch code remains; option pages have only a back link.
4. PASS. Byline removed from all four pages.
5. PASS. Both redirects are 308s and match exactly; all public links updated.
6. PASS. `npm test` 424 pass (5 new), lint and tsc clean, build passes. A crawl from `/` reached 23 pages with no broken links, and the six practice pages fit 375px.

## Notes

- Startup form copy and stored stage values unchanged on purpose; some contain dashes.
- `/api/ai-studio-request` and `/admin/ai-studio` keep their names on purpose.
