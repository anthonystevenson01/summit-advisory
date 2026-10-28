# Review: fluid type, wider centred column, phone fixes

## Loop 1: REJECT

Issue 1: `.inner-body` elements with an inline `maxWidth` (Contact at 900, newsletter reader at 720) were squeezed, because the percentage gutter resolves against the full parent width and comes out of the capped box. At 1920 the Contact form had 84px and articles had no width at all. The scrollWidth check could not catch it.

Remediation: the cap is now content width plus both gutters, `calc(50.25rem + 2 * var(--page-gutter))` and `calc(39rem + 2 * var(--page-gutter))`. Also applied the gutter to the GTM Tools How It Works block.

## Loop 2: APPROVE

1. PASS. Root 16px up to 1280, about 18.5px at 1920, capped at 19px. All 174 conversions exact.
2. PASS. Gutter applied to all listed selectors; mobile 20px rules still win. Capped columns measured by content box: Contact 804px at 1280 and 933px at 1920, newsletter 624px at 1280 and 724px at 1920, left edges aligned with the nav, 335px on a 375px phone.
3. PASS. Careers, GTM Tools and Newsletter no longer overflow at 375px.
4. PASS. `npm test` 419 pass, lint and tsc clean, build passes.

## Notes

- Contact and newsletter content widen slightly with the root size on wide screens. Intended.
- GTM Tools teal strip and How It Works keep 48px gutters on phones, as before. Not a regression.
- Toolkit class-based text scales; inline px sizes do not. Accepted limitation.
