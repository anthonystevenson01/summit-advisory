# Review: Product Studio rename and Startups / Enterprise choice

VERDICT: APPROVE (first pass)

## Acceptance criteria

1. PASS. No visitor-facing "AI Product Studio" or "AI Studio" label remains on marketing pages. `/ai-studio` URLs unchanged. Blog title left alone.
2. PASS. Startups is the default and its content is unchanged; JSX wrapping is correct.
3. PASS. Enterprise tab covers every deck section, links to the Project Builder and uses the existing booking handler. No prices or client names.
4. PASS. New copy is British, has no em or en dashes, and is plain.
5. PASS. `npm test` (419 pass), `npm run lint`, `npx tsc --noEmit`, `npm run build`.

## Constraints

No new dependencies. Shared classes plus one new CSS block; no Tailwind utilities. Registry, pipeline, rubric and model rules untouched.

## Notes and follow-ups

1. Tab accessibility: the first version used tab roles without the full pattern. Fixed before merge by switching to `aria-pressed` toggle buttons in a labelled group.
2. `public/llms.txt` still said "AI Product Studio". Fixed before merge.
3. Copy claims to confirm with Anthony: "shipped into banks, grocers and telcos", "some of the world's largest brands", "at the frontier". All come from the Oct 26 deck.
4. Accepted limitation: the standalone `/ai-studio` page has the rename only, and its meta description still speaks to founders.
5. No new tests: the change is presentational in a client component.
