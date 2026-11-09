# Design: Project Builder prototype, design rules round

Branch `anthonystevenson0/prototype-design-rules`, cut from main at `4cd7254` (PR #24 merged). Task: `task-spec.md` (acceptance criteria 1 to 10). Baseline: Round 3 as merged (`docs/designs/anthonystevenson0-prototype-round-3-staged-build.md`). Architect output only: no code.

## 0. Shape of the change

Two server side levers, nothing the prospect sees in the builder changes:

1. The shell stylesheet (`baseCss` in `shell.ts`) gains the rules a model cannot be trusted to apply: an accent and on-accent pair resolved for contrast, hover and focus states with a short transition, pointer cursors, minimum target sizes, tabular right aligned numbers, reduced motion, one muted text token, an empty state and a field error style. Three new shared classes (`pb-num`, `pb-empty`, `pb-field-error`) join `SHELL_CLASSES`.
2. The screen prompt (`DESIGN_RULES` in `prompts.ts`) gains seven short lines for the choices only the model makes: icons, charts complete at rest, numbers in `pb-num`, empty states, field errors, status by text as well as colour, one primary action per screen.

Two more per screen checks in `checkScreen` (`screens.ts`) catch the two failures seen on 9 November 2026 (an SVG chart with no marks drawn, a coloured table row) and feed the existing one retry.

Measured on main at `4cd7254` (neutral style, five screens titled `Screen 0` to `Screen 4`, company `Ocado`, project `Orders`): `baseCss` is 5,983 characters and `renderShell` is 7,922; `shellScreenBudget(7_922, 5)` is 16,000 (the cap). The additions below measure about 1,510 characters net, so the shell lands near 9,430 and the five screen budget stays at 16,000; even at the full 3,000 allowance the budget would be 15,615.

---

## 1. Files to Modify / Create

### Modify

| File | What and why |
|---|---|
| `app/lib/project-builder/shell.ts` | `ShellVariables` gains `accent` and `onAccent`; a new exported `resolveAccent(colours, text)` and the constants `ACCENT_SURFACE = "#FFFFFF"`, `ACCENT_MIN_CONTRAST = 4.5`, `TEXT_MUTED = "#55636B"`; `shellVariables` calls `resolveAccent`; `baseCss` emits `--accent`, `--on-accent` and `--text-muted` and the rule changes in section 2.2; `SHELL_CLASSES` gains three entries. AC 1, 2, 3, 7. |
| `app/lib/project-builder/prompts.ts` | `DESIGN_RULES` is built from the existing lines plus a new exported `DESIGN_CHOICE_RULES` array of seven lines (section 2.3). Nothing else in the file changes. AC 4. |
| `app/lib/project-builder/screens.ts` | `checkScreen` gains the empty chart check and the coloured row check (section 2.4), each one issue line, added after the id checks and before the size check. Nothing existing is weakened. AC 5. |
| `__tests__/project-builder-shell.test.ts` | `resolveAccent` cases (light first colour alone, light first with a dark second, dark first, neutral), the tokens in `:root`, the CSS rules by group, the three new class lines, the shell size and budget assertion. AC 1, 2, 3, 7. |
| `__tests__/project-builder-prompts.test.ts` | `DESIGN_CHOICE_RULES`: at most seven lines, under 900 characters together, no dashes, each line in the screen and fix system turns; the three class names in the user turn. AC 4. |
| `__tests__/project-builder-screens.test.ts` | The two new checks, positive and negative, including the false positive guards; the no dash test extended with the new lines. AC 5. |
| `docs/runbook.md` | Docs agent: a `## Project Builder prototype, design rules round, added November 2026` section directly after the Round 3 section (section 6 of this document lists its contents). AC 8, 10. |

### Not touched

`house-style.ts`: `contrastRatio` is already exported and is the only helper the resolution needs; the darkening step is channel arithmetic in `shell.ts`, not luminance maths, so nothing is duplicated and the file stays as it is. `prototype-run.ts`, `prototype-html.ts`, `PrototypeFrame.tsx`, every route, `llm.ts`, `schemas.ts`, `package.json`. `__tests__/project-builder-prototype.test.ts` and `project-builder-prototype-html.test.ts` pass unchanged.

---

## 2. Integration Points

### 2.1 Accent and on-accent resolution (`shell.ts`)

`resolveAccent(colours: readonly string[], text: string): { accent: string; onAccent: string }`, called by `shellVariables` after the three brand colours and the text colour have been resolved through `colour()` (so every input is a six digit hex and the fallbacks have already been applied: a missing second colour is the first, a missing third is the second, a missing first is the neutral `#2F5D7C`).

Inputs: `[brand1, brand2, brand3]` in that order and `text` (the house style text colour, default `#1F2A37`). Duplicates from the fallbacks are harmless.

The surface the accent is measured against is `ACCENT_SURFACE = "#FFFFFF"`, the shell's fixed `--surface`: figure values, secondary button text, table cells, inputs and list items all sit on `--surface`, and for any light page background white is the hardest case. Assumption stated: the shell is a light theme by construction (`--surface`, the table header grey and the label tints are fixed), so a site whose own background is dark is already out of the shell's design and is not handled here (noted in the runbook as a known limit).

Steps:

1. Accent for text uses: the first of `[brand1, brand2, brand3]` with `contrastRatio(c, ACCENT_SURFACE) >= 4.5`.
2. When none reaches it: darken `brand1` by scaling each RGB channel by 0.9 (floored to an integer) and repeat until `contrastRatio >= 4.5`, with a guard of 60 steps (black is 21:1, so the loop always ends; flooring guarantees progress at low channel values). Scaling keeps the hue and the channel order, so a yellow becomes a dark gold rather than a grey. Measured: `#F5D000` becomes `#816c00` in six steps at 5.15:1; `#7AB8E6` becomes `#4f7796` in four at 4.76:1; a plain `#FFFFFF` becomes `#6c6c6c` in eight at 5.25:1.
3. On-accent for filled buttons: the fill stays `--brand-1` (the spec's rule); `onAccent` is `#FFFFFF` when `contrastRatio(brand1, "#FFFFFF") >= contrastRatio(brand1, text)`, else `text`. Same rule and tie break as `chooseNav`. For `#F5D000` that is the text colour (9.63:1 against 1.51:1); for the neutral `#2F5D7C` it is white (7.05:1).

Tokens emitted in `:root`, after `--nav-text` and before the scales: `--accent`, `--on-accent`, `--text-muted` (`TEXT_MUTED = "#55636B"`, 6.21:1 on white; the value the shell already used in five places, now one token).

Where the tokens are used (section 2.2): `--accent` on `.pb-figure-value`, `.pb-button--secondary` (text and border), `a`, every focus outline, the row and list focus outline, and the input focus border; `--on-accent` on `.pb-button` text and `.pb-nav-button.is-active` text (today both are `#fff`, which is the Ocado failure on the active nav item too); `--text-muted` on `.pb-figure-label`, `.pb-figure-delta`, `.pb-field label`, `.pb-detail dt`, `.pb-muted` and the new `.pb-empty`.

Known limit, stated for the Reviewer: a mid tone brand (`#808080`: 3.95:1 against white, 3.68:1 against the text colour) gets the better of the two and still sits under 4.5:1 on a filled button. The spec fixes the fill at `--brand-1`, so this is accepted and noted in the runbook; the text accent for that brand is darkened to `#737373` (4.74:1) and is fine.

### 2.2 The stylesheet (`baseCss`), by group

All values measured on the exact strings below; the Coder keeps the wording and may reorder within a group. Growth is characters added to the joined stylesheet, newlines included.

**Tokens (+59).** `--accent:{v.accent};--on-accent:{v.onAccent};--text-muted:#55636B;` in `:root`.

**Interaction states (+712, less the 41 removed).**
- `.pb-button,.pb-nav-button,[data-go],.pb-select{cursor:pointer}` (the nav button and button already carry it in their own rules; the shared rule is what covers `[data-go]` on any element, including a row).
- `.pb-button,.pb-nav-button,.pb-search,.pb-select,.pb-input,.pb-table tbody tr,.pb-list li,[data-go]{transition:color .15s,background-color .15s,border-color .15s,box-shadow .15s}`: the four properties only, 150 ms.
- `.pb-button:hover{box-shadow:inset 0 0 0 99em rgba(0,0,0,.08)}` replaces `.pb-button:hover{filter:brightness(.92)}`: an inset shadow darkens any fill, filled or secondary, through one of the four transitioned properties; `filter` is dropped from the shell altogether.
- `.pb-search:hover,.pb-select:hover,.pb-input:hover{border-color:#B9C4BF}`.
- `.pb-list li:hover{background:#F7F9F8}` (the table row hover already exists and stays).
- `.pb-table tbody tr:focus-visible,.pb-list li:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}` for rows and items a screen makes focusable.
- The existing shared focus rule gains `[data-go]:focus-visible` and switches its outline colour from `var(--brand-1)` to `var(--accent)` (a yellow ring on white is invisible).
- `.pb-search:focus-visible,.pb-select:focus-visible,.pb-input:focus-visible{border-color:var(--accent)}`.
- `.pb-nav-button:focus-visible{outline-color:var(--nav-text)}`: the nav sits on its own background, where the nav text colour is the one known to read.
- `.pb-nav-button:hover` stays as it is (opacity and a border); opacity is not transitioned, which is accepted.

**Motion (+94).** `@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}`. Animations are included because a screen's own css may add keyframes; the spec asks for transitions removed and this is the same intent.

**Sizes (+117).** `.pb-button,.pb-nav-button,.pb-search,.pb-select,.pb-input,[data-go]{min-width:24px;min-height:24px}` placed before the component rules so the later `min-height:36px` on `.pb-button` and the input classes wins at equal specificity; `.pb-nav-button` gains `min-height:36px` in its own rule. The button and input 36px already present is kept.

**Numerics (+161).** `.pb-table,.pb-figure-value{font-variant-numeric:tabular-nums}` and `.pb-num,.pb-table th.pb-num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}`. The second selector is required: `.pb-table th` (0,1,1) sets `text-align:left` and would beat a bare `.pb-num` (0,1,0) on a header cell.

**New classes (+306).**
- `.pb-empty{border:1px dashed var(--line);border-radius:var(--radius);padding:var(--space-5);text-align:center;color:var(--text-muted);margin-bottom:var(--space-4)}`. Shown and hidden with the `hidden` attribute (no display is set on the class, so the attribute works as the browser intends).
- `.pb-field-error{font-size:var(--text-1);color:var(--bad);margin-top:var(--space-1)}` and `.pb-field-error:empty{display:none}`, the `pb-notice` pattern: the model writes an empty element under the input and fills `textContent` from js.
- `a{color:var(--accent)}`: screens cannot write URLs, but an anchor without `href` is possible and the spec names links.

**Muted token and value swaps (+103).** `#55636B` becomes `var(--text-muted)` in five rules; `#fff` becomes `var(--on-accent)` on `.pb-button` and `.pb-nav-button.is-active`; `var(--brand-1)` becomes `var(--accent)` on `.pb-figure-value`, `.pb-button--secondary` (which also gains `border-color:var(--accent)`) and the focus rule. After the change the literal `#55636B` appears once in the stylesheet, in the token.

**Budget (AC 7).** Net growth about 1,511 characters (1,552 added, 41 removed); shell about 9,430 on the five screen fixture against the 10,922 allowance (7,922 + 3,000); `shellScreenBudget` stays 16,000 on five screens, well above 12,000. The test fixes the fixture (neutral style, `Ocado`, `Orders`, five screens `screen-0` to `screen-4` titled `Screen 0` to `Screen 4`) and the baseline constant `ROUND_3_SHELL_CHARS = 7_922` with a comment saying how it was measured, and asserts `length <= ROUND_3_SHELL_CHARS + 3_000` and `shellScreenBudget(length, 5) >= 12_000`.

### 2.3 The screen prompt (`prompts.ts`)

`DESIGN_CHOICE_RULES: readonly string[]`, exported, exactly these seven lines (885 characters joined with newlines, no en or em dash, British spelling):

```
- Icons are inline SVG with one stroke width (1.5) and no fill; never emoji.
- Draw every chart complete in the html: bars, lines, axes and labels as SVG elements that show with no script running. Use js only to filter what a chart shows.
- Every number, amount or date in a table sits in a td or th with the class pb-num. Text you colour yourself uses var(--accent), not var(--brand-1).
- Where a search or filter can leave a list empty, add a pb-empty box with a short sentence, hidden (the hidden attribute) until js shows it.
- When a required field is blank, show one sentence in a pb-field-error under that field, filled by js; no other error style.
- Status is a pb-label whose text names the state. Never colour a tr, td or whole row for status, and never rely on colour alone.
- One filled pb-button per screen, for its main action; every other button is pb-button--secondary.
```

`DESIGN_RULES` becomes `[...the existing nine lines, ...DESIGN_CHOICE_RULES].join("\n")`, so the lines sit under the same `Design quality:` heading, in the system turn, after the build rules and before the data guard, in both `screenPrompt` and `screenFixPrompt` (the fix prompt reuses the screen prompt's system turn). The third line carries the one shell fact the model needs to avoid repeating the yellow text failure in its own css: coloured text uses `--accent`. The existing eighth line (`var(--brand-1)` for primary actions and the main chart series) stays; chart marks at low contrast are out of scope (section 6).

The new class lines in `SHELL_CLASSES`, reaching the user turn through `shellClassLines()` unchanged:

- `pb-num`: "a numeric table cell or header, right aligned with tabular figures; put it on every td and th that holds a number, amount or date"
- `pb-empty`: "a dashed box with one short muted sentence, shown in place of the rows when a filter leaves nothing; keep it hidden with the hidden attribute until js shows it"
- `pb-field-error`: "a short error line in the pb-field under its input, empty until js fills it when a required field is blank"

Token cost: about 220 tokens more per screen call on the system turn, which `callModel` caches; about 60 tokens more on the user turn. Five screens on a full build, so about 1,400 tokens per press at most, under one per cent of a screen call's output.

### 2.4 The two screen checks (`screens.ts`)

Both run on `build.html` (and the second on `build.css`), inside `checkScreen`, after the id checks and before the size line, so a screen that fails both the ids and a design check reports all of them in one retry. Each produces at most one line per field. They are pure regex passes like every other check, with no HTML parser.

**Empty chart.** For every opening tag whose `class` attribute contains the token `pb-chart` (`/<([a-z][a-z0-9-]*)\b[^>]*\bclass\s*=\s*["'][^"']*\bpb-chart\b[^"']*["'][^>]*>/gi`, the tag name captured), take the slice of html from the end of that tag to the matching close: walk forward counting opening and closing tags of the same name (`<div` and `</div`, usually) until the depth returns to zero, or to the end of the html. Within the slice, for each `<svg ...>...</svg>` block (`/<svg\b[^>]*>[\s\S]*?<\/svg\s*>/gi`), the svg is drawn at rest when it contains any of `rect`, `path`, `polyline`, `circle` or `polygon`, or three or more `line` elements. Otherwise one issue:

`html: a chart in a pb-chart box has an svg with no marks drawn (no rect, path, polyline, circle or polygon, and at most two line elements). Draw every bar, line and point as svg elements in the html; js may only filter them.`

Decisions inside the check, with the reasoning the parent asked for:

- `polygon` counts as a mark although the spec's list does not name it: an area chart is one polygon, it is complete at rest, and a false positive costs a 90 s retry on the critical path that may also rewrite a good chart. Including it is additive (fewer flags, never more) and loses nothing: a polygon only svg has marks by definition.
- `line` counts only from three: two lines are the axes, and the 9 November 2026 failure drew axes and a legend with no bars. Under the spec's literal list (`line` as a mark) that chart would have passed. Three or more lines are a series drawn as segments or a grid, which cannot be told from a drawn chart without rendering; that residual is accepted and noted. An svg with one or two lines and nothing else is an empty frame and is flagged. This is a small superset of the spec's flagging and the Reviewer should hold it to AC 5's intent (charts complete at rest) rather than its element list; if the literal five are preferred, dropping the line count rule is one regex and no test but one changes.
- A `text` only svg (labels, legend, no marks) is flagged: that is exactly the failure.
- A legend drawn with small `rect` swatches beside axes drawn with `line` passes: known limit, the prompt rule is the main lever and this check is the backstop for the plain empty frame.
- A `pb-chart` box with no svg at all is not flagged (the spec names an svg inside the box; CSS bars in divs are drawn at rest). A chart built entirely by js into an empty box therefore passes the check; the prompt's "no script running" line is the only guard. Noted.
- Svgs outside a `pb-chart` box (icons, a sparkline in a figure card) are never examined, so a polygon or text icon cannot trip it.

**Coloured rows and cells.** Two regex passes:

- In `build.css`: split into rules with `/([^{}]+)\{([^{}]*)\}/g` (the same trick `house-style.ts` uses, which also reaches rules nested in `@media`). A rule is flagged when any comma separated selector matches `/(^|[\s>+~])(tr|td)(?![\w-])/i` (so `tr`, `tbody tr`, `tr.amended`, `tr:nth-child(2)`, `.x td` match; `.tr-row`, `#td`, `tr-x` and `th` do not) and its body matches `/(^|[;\s])background(-color)?\s*:\s*(?!(none|transparent|inherit|unset|initial)\b)/i` (a background set to nothing is left alone).
- In `build.html`: `/<(tr|td)\b[^>]*\sstyle\s*=\s*["'][^"']*\bbackground(-color)?\s*:/i`.

One line per field:

`css: a rule on tr or td sets a background. Coloured rows and cells are not allowed; show the state with a pb-label in a cell and remove the background.`

`html: a tr or td carries an inline background style. Coloured rows and cells are not allowed; show the state with a pb-label in a cell and remove the style.`

False positives accepted, each fixed by the retry and each something the shell already provides: a screen's own `tr:hover` colour, a `td{background:#fff}` to cancel the zebra, a selected row highlight (`tr.is-selected{background}`; a selected row can use a left border or a bold cell instead). `th` is left alone because a header background is not a status and the spec names `tr` and `td` only.

**How the checks feed the retry (AC 5, and the assumption that must be stated).** `prototype-run.ts` runs `checkScreen` after the first build call; any issue line triggers `screenFixPrompt` with the lines in the user turn under "The checks it failed:"; after the retry it runs `checkScreen` again; any line still present keeps the previous build of that screen when one exists, else fails the press with `invalid`. That loop is unchanged (the constraint keeps every change in `shell.ts`, `prompts.ts`, `screens.ts`, the tests and the runbook) and it has no way to tell an advisory line from a blocking one. The spec's "never a hard failure" is therefore read as: these checks never fail the document (they are not in the validator or the safety pass, which are untouched) and always go through the one retry with the reason named; after a failed retry they follow the same per screen rule as every existing check. The residual, a first Create whose model repeats a coloured row or an empty chart after being told once, is a risk (section 7, R1) rather than something this design can remove. The alternative is one line in `prototype-run.ts` filtering lines that start with a design prefix before the keep or fail decision; it is outside the allowed files and is left for the Orchestrator and the human to choose if they want the stricter reading.

---

## 3. Data Flow

1. A press reaches `runPrototype`; the house style is read or reused as today.
2. `renderShell(plan, houseStyle, ...)` calls `shellVariables(style)`, which resolves the three brand colours, then `resolveAccent([brand1, brand2, brand3], text)`, then `baseCss(v)` writes `:root` with the two new tokens and the muted token and the rules of section 2.2. The shell's length feeds `shellScreenBudget` as before.
3. `screenPrompt(args)` carries `DESIGN_RULES` (with the seven new lines) in the system turn and the three new class lines in the user turn; five calls in parallel.
4. `checkScreen` runs the existing checks, then the empty chart check and the coloured row check. Issues go to `screenFixPrompt` once; a clean screen is placed; an unclean one after the retry keeps its previous build or fails `invalid` (unchanged).
5. `assembleDocument` places the screens, the safety pass and validator run unchanged, the record is stored in the same shape.
6. Admin full screen view serves the stored document as is. A record built before this change keeps its old shell CSS (the shell is written per build); a later press rebuilds the shell with the new rules.

Error paths: `resolveAccent` cannot throw (every input is a validated hex; the darkening loop is bounded); the checks cannot throw (regex passes on strings). No new failure kind reaches a route.

---

## 4. Key Decisions

| Decision | Alternatives | Rationale |
|---|---|---|
| D1. Accent measured against white, the shell's fixed surface | Measure against `--bg`; against the lighter of the two | Figure values, secondary buttons, cells and inputs sit on `--surface`, which is fixed white; for any light page background white is the hardest case; a dark page background makes a loop that requires both unsatisfiable, since darkening cannot help against dark. |
| D2. Darken by RGB scaling (0.9 per step, floored) | HSL lightness steps; mixing with black by a fraction | Keeps hue and channel order (yellow to gold, not to grey); needs no HSL conversion (house-style has `hslToRgb` but no inverse, and adding one would be new maths in a file this task may only re-export from); flooring guarantees termination without a step counter, the 60 step guard is belt and braces. |
| D3. Fill stays `--brand-1`; only the text on it is chosen | Darken the fill too when neither text colour reaches 4.5:1 | The spec says so; the brand colour on buttons is the one thing a prospect recognises; the mid tone residual is noted. |
| D4. `--text-muted` is a fixed `#55636B`, not derived | Derive from `--text` | The surface is fixed white, so the muted value can be fixed too; 6.21:1; one token, six uses, no arithmetic. |
| D5. Button hover is an inset box-shadow, replacing `filter:brightness` | Keep the filter; darken via a second variable | The spec limits transitions to colour, background, border and box-shadow; an inset shadow darkens any fill (filled or secondary) with no second token and animates through an allowed property; `filter` leaves the shell. |
| D6. The seven lines live in an exported `DESIGN_CHOICE_RULES` array | Append strings to `DESIGN_RULES` directly | The test must measure "at most seven lines, under 900 characters together" on the real lines, not on a copy; an array makes the cap a one line assertion and keeps the Round 2 lines untouched. |
| D7. `polygon` counts as a mark; `line` counts from three | The spec's literal five | Section 2.4: the literal list would have passed the very chart the spec cites, and a polygon only svg is drawn. |
| D8. The new checks are ordinary `checkScreen` lines; `prototype-run.ts` unchanged | A separate advisory function and a filter in the run | The constraint keeps every change in the three modules and the loop cannot distinguish lines; the reading of "never a hard failure" and the residual are in section 2.4 and R1. |
| D9. `--on-accent` on the active nav button too | Leave `#fff` | Same failure as the filled button (a yellow fill with white text); one token swap. |
| D10. Focus outlines use `--accent`; the nav button's uses `--nav-text` | Keep `--brand-1` | A brand colour that fails 4.5:1 on white also fails as a ring; on the nav the known readable colour is the nav text. |

---

## 5. Constraints Honoured

- One registry, one pipeline: every change is in `shell.ts`, `prompts.ts`, `screens.ts`, their three tests and the runbook. `house-style.ts` is not changed (its exported `contrastRatio` is reused; no luminance maths is duplicated: the darkening step is channel scaling, with contrast still read through `contrastRatio`).
- Prospect facing UI, sandbox, CSP, safety pass, validator: untouched byte for byte; `assembleDocument` still calls them unchanged; the Round 1 and 2 prototype tests run as they are.
- No model id, routing key, time budget, cap or route change; no new dependency; `SCREEN_BUDGET_MAX`, `SHELL_HEADROOM` and `PROTOTYPE_HTML_MAX_CHARS` unchanged.
- No Tailwind: the shell stays a plain CSS template string.
- Prompt additions short: seven lines, 885 characters, one shell fact only.
- British spelling, no em or en dashes, plain sentences: the tests on `shellClassLines`, the system turns and the issue lines already assert no dash; the new lines are covered by the same assertions.
- Nothing in `screens.ts` is weakened: both checks are additions placed before the size line; every existing line and regex stays.
- Secrets: nothing about keys changes.

---

## 6. Runbook entry (for the Docs agent)

A `## Project Builder prototype, design rules round, added November 2026` section directly after the Round 3 section, short, with:

- **What the shell now enforces:** the accent pair and how it is resolved (first brand colour at 4.5:1 on white, else the first colour darkened; the fill stays `--brand-1` with white or the text colour on it), the muted token, hover and focus states with a 150 ms transition on four properties, reduced motion, pointer cursors, 24px and 36px targets, tabular numbers, `pb-num`, `pb-empty`, `pb-field-error`. The Ocado evidence in one line.
- **What the prompt asks for:** the seven lines, named not quoted.
- **The two new screen checks:** what each flags, the issue line text, that they go through the one retry like every other check and after a failed retry follow the keep previous or `invalid` rule (R1), and the known limits (a legend of rects beside line axes passes; a box with no svg passes; a selected row background is flagged).
- **Old records:** the shell is written per build, so a prototype stored before this change keeps its old CSS until the next press; the admin view and the stored format are unchanged. A dark site background is outside the shell's light theme (D1); a mid tone brand gets the better of white or the text colour on filled buttons and may sit under 4.5:1 (D3).
- **Before and after comparison method:** the same Ocado brief (`brief_e7063bab84634459`, GPT-6 Astra on the build key), Create on the branch preview, each screen captured from `/admin/briefs/{id}/prototype` at 1,531 px wide, set beside the 9 November 2026 live build screenshots; a comparison page listing per screen: button text readable on the brand fill, figure values readable, hover and focus visible, numbers right aligned, chart drawn before any click, no coloured rows, an empty state after a filter that matches nothing, a field error on a blank required field, one filled button. Also the retry count on `/admin/stats` (fix retries on the build key) before and after, since the two checks can raise it.

---

## 7. Risks

- **R1. A design check failing twice fails a first Create.** Low likelihood (the fix is mechanical and named in the retry), real cost (an otherwise usable prototype is lost; on an Update the previous screen is kept instead). Mitigation: the issue lines say exactly what to remove or draw; the comparison run reports the fix retry count. Escape hatch if it bites: the one line filter in `prototype-run.ts` (section 2.4), a separate small change.
- **R2. Screen budget.** Shell growth about 1,510 characters; the five screen budget stays at its 16,000 cap, so no screen loses room. Even at the full 3,000 the budget is 15,615. The test pins both numbers.
- **R3. Prompt token growth.** About 220 cached system tokens and 60 user tokens per screen call; negligible against a 1,700 token prompt and a 5,000 token answer. The seven lines are the cap; the test refuses an eighth or a 900th character.
- **R4. Models ignoring `pb-num`.** No check enforces it (a check would need to know which cells hold numbers). The class line and the prompt line both name it; the comparison run reports it per screen. If ignored widely, a later round can add a check on `td` text that is purely numeric without the class.
- **R5. Retry rate rises.** Two more reasons to retry, each costing a screen call (about 50 s and $0.29 on Astra). Watched on `/admin/stats`; if the rate climbs, the prompt lines are the first lever (they are what the check enforces), the checks the second.
- **R6. False positives in the row check.** A screen's own hover, zebra cancel or selected row background is flagged and retried; accepted because the shell already gives each of those. The regex ignores `.tr-`, `#td` and `th` to keep the surprise small.
- **R7. Old records.** A prototype stored before this change serves with its old CSS until the next press; `/admin/briefs/{id}/prototype` and the stored shape are unchanged, so nothing breaks; the runbook says so.
- **R8. Dark brand text colour or dark site background.** `resolveAccent` assumes a light surface (D1). A site read as dark background with light text already renders oddly in the shell today; this round does not change that and the runbook notes it.
- **R9. The 24px minimum on `[data-go]`.** A `tr` with `data-go` gets `min-width:24px` (no effect on a table row) and the pointer; a `span` with `data-go` becomes at least 24px square only if it is a block or inline-block (min sizes do not apply to inline elements). Accepted; buttons are what the prompt tells the model to use for `data-go`.

---

## 8. Test Plan

**AC 1, `__tests__/project-builder-shell.test.ts`, `describe("resolveAccent")`:**
- Light first colour alone: `resolveAccent(["#F5D000", "#F5D000", "#F5D000"], "#1F2A37")`: `accent !== "#F5D000"`, `contrastRatio(accent, "#FFFFFF") >= 4.5`, the blue channel stays `00` and red stays above green (hue kept), `onAccent === "#1F2A37"`.
- Light first with a dark second: `["#F5D000", "#123456", "#123456"]`: `accent === "#123456"` (the first that reaches 4.5:1), `onAccent === "#1F2A37"` (the fill is still the yellow).
- Dark first: `["#123456", "#F5D000", "#F5D000"]`: `accent === "#123456"`, `onAccent === "#FFFFFF"`.
- Neutral: `shellVariables(NEUTRAL_HOUSE_STYLE)`: `accent === brand1 === "#2F5D7C"`, `onAccent === "#FFFFFF"`.
- A mid tone `["#808080", ...]`: the accent is darkened to at least 4.5:1; `onAccent` is white (3.95 against 3.68), documenting D3.
- The rendered `:root` carries `--accent:`, `--on-accent:`, `--text-muted:#55636B`, and `contrastRatio("#55636B", "#FFFFFF") >= 4.5`.

**AC 2, `describe("baseCss")` on `baseCss(shellVariables(style))`:**
- Interaction: the `cursor:pointer` rule lists `[data-go]`; every `transition:` declaration in the stylesheet names only `color`, `background-color`, `border-color`, `box-shadow` with `.15s` (regex over all `transition:[^;}]*` matches); `.pb-button:hover` contains `box-shadow:inset`; the stylesheet contains no `filter:`; `.pb-list li:hover`, `.pb-table tbody tr:hover`, `.pb-search:hover`, `.pb-input:focus-visible` present; the shared focus rule contains `[data-go]:focus-visible` and `var(--accent)`; `.pb-nav-button:focus-visible{outline-color:var(--nav-text)}`.
- Motion: `@media (prefers-reduced-motion:reduce)` with `transition:none`.
- Sizes: the 24px rule names the six selectors; `.pb-button{` and `.pb-input` rules still carry `min-height:36px`; `.pb-nav-button{` carries `min-height:36px`; the 24px rule's index is lower than the `.pb-button{` rule's.
- Numerics: `.pb-table,.pb-figure-value{font-variant-numeric:tabular-nums}`; `.pb-num,.pb-table th.pb-num{text-align:right`.
- New classes: `.pb-empty{` with `dashed` and `var(--text-muted)`; `.pb-field-error{` with `var(--bad)`; `.pb-field-error:empty{display:none}`; `a{color:var(--accent)}`.
- Muted: `#55636B` occurs exactly once in the stylesheet; `.pb-figure-label`, `.pb-figure-delta`, `.pb-field label`, `.pb-detail dt`, `.pb-muted` each contain `var(--text-muted)`.
- Tokens in use: `.pb-figure-value` contains `var(--accent)`; `.pb-button{` contains `color:var(--on-accent)` and `background:var(--brand-1)`; `.pb-nav-button.is-active` contains `var(--on-accent)`; `.pb-button--secondary` contains `color:var(--accent)` and `border-color:var(--accent)`.
- No en or em dash in the stylesheet.

**AC 3, the existing `every shared class has a use line` test:** `SHELL_CLASSES.length >= 23`; the names include `pb-num`, `pb-empty`, `pb-field-error`; each new line is one sentence pattern as before; `shellClassLines()` carries `pb-num: `.

**AC 4, `__tests__/project-builder-prompts.test.ts`, in `describe("the staged build prompts")`:** `DESIGN_CHOICE_RULES.length <= 7`; `DESIGN_CHOICE_RULES.join("\n").length < 900`; every line starts with `- ` and has no dash; `screenP.system` and `fixP.system` include every line; distinctive substrings asserted (`never emoji`, `no script running`, `class pb-num`, `pb-empty box`, `pb-field-error under`, `Never colour a tr, td`, `pb-button--secondary`); the user turn includes `pb-num:`, `pb-empty:`, `pb-field-error:`. The existing leak and dash tests on every system turn cover the new lines without change.

**AC 5, `__tests__/project-builder-screens.test.ts`, `describe("checkScreen design checks")`:**
- Empty chart, flagged: a `pb-chart` div whose svg has two `line` and `text` elements; one with `text` only; one with `<g>` groups and nothing else. The issue includes `pb-chart` and `no marks drawn`.
- Empty chart, not flagged: svg with a `rect`; with a `path`; with a `polyline`; with a `circle`; with a `polygon` only; with four `line` elements; a `pb-chart` inside a `pb-card` with a sibling legend div before the svg (depth walk); a `text` only svg outside any `pb-chart`; a `pb-chart` box with no svg; two charts where one is drawn gives exactly one issue.
- Coloured rows, flagged: css `.jobs-table tr.amended{background:#EEE}`; `.jobs-table td{background-color:#fff}`; the same inside `@media (max-width:600px){...}`; `tbody tr:nth-child(3){background:red}`; html `<tr style="background:#f3e8ff">`; `<td style="color:red;background-color:red">`. The css line says `css:` and the html line `html:`.
- Coloured rows, not flagged: `.jobs-row{background:#fff}`; `.tr-strip{background:red}`; `.jobs-table th{background:#eee}`; `.jobs-table tr{background:transparent}`; `.jobs-table td{border-color:red}`; html `<tr class="x" data-go="dashboard">`; `<td style="text-align:right">`; the `clean()` fixture still returns `[]`.
- Both lines pass the no dash test (added to its aggregate case).
- `assembleDocument` with a flagged screen still assembles (the check is per screen, not in the validator), proving the document path is untouched.

**AC 6:** `__tests__/project-builder-prototype.test.ts` and `project-builder-prototype-html.test.ts` unchanged and green; `git diff --stat` shows no change outside the seven files in section 1.

**AC 7:** the shell test's `describe("shell size")`: the fixture, `ROUND_3_SHELL_CHARS = 7_922`, `length <= ROUND_3_SHELL_CHARS + 3_000`, `shellScreenBudget(length, 5) >= 12_000`.

**AC 8:** no code change; the runbook states it; the Reviewer confirms `app/admin/briefs/[id]/prototype` and `prototype.ts` are not in the diff.

**AC 9:** `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` in the Coder's report; `package.json` unchanged. No rubric, model or scoring change, so `npm run calibrate` is not required.

**AC 10:** the runbook section exists with the five parts of section 6; no dash; British spelling.

---

## 9. Out of Scope

- Chart series contrast (`var(--brand-1)` bars on white at 1.5:1 for a pale brand): the spec keeps `--brand-1` for the main series; a `--series-1` token resolved like the accent is a later round.
- Darkening the button fill for a mid tone brand (D3).
- A check that numeric cells carry `pb-num` (R4).
- A check on a `pb-chart` box with no svg, or on marks added by script to a frame that already has lines (section 2.4).
- Any change to `prototype-run.ts`, including the advisory filter (D8, R1).
- The nav button hover (opacity) and the nav's own colours, which `chooseNav` already resolves for contrast.
- `th` backgrounds, `pb-label` tints and the zebra and hover greys, all fixed shell values that already read.
- Native app rules from the skill (44pt targets, safe areas, haptics): a desktop prototype in an iframe, as the spec says.
