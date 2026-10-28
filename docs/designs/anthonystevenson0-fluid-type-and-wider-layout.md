# Fluid type, a wider centred column, and phone fixes

Branch: `anthonystevenson0/fluid-type-and-wider-layout` (28 Oct 2026)

Directed by Anthony in the browser preview after noticing the site looked small on a large monitor. No separate Architect pass; design recorded here.

## Problem

All text sizes were fixed px (14 to 16px for body copy), the main column was capped at 960px and sat on the left, so large screens looked small and empty. Three pages also scrolled sideways on phones in production: Careers, GTM Tools and Newsletter.

## Design

- **Fluid root size.** `html { font-size: clamp(16px, calc(16px + (100vw - 1280px) * 0.004), 19px) }`. Every `font-size` in `app/globals.css` (174 values) is now rem at exactly px/16, so all class-based text follows the root. `clamp()` headings keep their own scaling. Phones and laptops (up to 1280px) see the same sizes as before.
- **One centred column.** `--page-gutter: max(48px, calc((100% - 1104px) / 2))` gives a 1200px column with at least 48px gutters. Padding percentages resolve against the parent, so it works inside full-width bands. Applied to `.nav`, `.footer`, `.home-hero`, `.cards-section`, `.inner-hero`, `.inner-body`, and two inline blocks on GTM Tools. The 900px mobile rules still set 20px gutters on phones.
- **Capped columns.** Any `.inner-body` with its own cap uses `maxWidth: calc(<content> + 2 * var(--page-gutter))`, so the gutter never eats the content: Contact keeps 804px (50.25rem) and newsletter articles keep 624px (39rem) on a laptop.
- **Text measures in rem.** `max-width` of 520, 560 and 680px became rem so line length stays the same as text grows.
- **Phone fixes.** New shared `.grid-3` (stacks under 700px) for the GTM Tools steps; Newsletter header uses `.equity-grid`; `.equity-grid` mobile column is `minmax(0, 1fr)`; `.tk-nl-input` has `min-width: 0`; Careers value cards stack the title above the text.

## Out of scope

- Inline numeric `fontSize` values in components stay fixed px, mostly on the toolkit tools, Built to Scale and report pages, so those pages may look slightly mixed at very wide windows.
- The GTM Tools teal strip and How It Works block keep a 48px gutter on phones, as before.
