# Design: Built to Scale? Release 2, Route to Buyer and Unit of Value

Branch `anthonystevenson0/built-to-scale-2-two-new-tools`. Source: `task-spec.md` (including the `notes` block, which carries the Notion rubric descriptors for both tools), `docs/built-to-scale-plan-updates.md` sections 1a.1 and 3, and the Release 1a design at `docs/designs/anthonystevenson0-built-to-scale-1a-one-code-path.md`.

This document is design only. No code, no pseudocode. Where the spec is ambiguous the assumption is stated inline and collected in section 4.

---

## 0. Shape of the change

Release 1a made a tool one registry entry plus a Notion row. This release proves it: two new tools are added by editing `registry.ts`, writing six calibration files and nothing else that describes a tool. Three things fall out of it that are not pure data:

1. A new extra kind, `ceiling`, because the Unit of Value tool asks the details model for three numbers rather than a sentence. The model returns the inputs as structured JSON with the assumption behind each; the figure is computed in code, never by the model.
2. A pure calculator, `app/lib/ceiling.ts`, with no imports, that multiplies units per person per period by price per unit by periods per year and formats the result in a currency (CAD by default).
3. The word "five" in the toolkit copy becomes a value derived from the registry, so flipping `hidden` on either tool changes no copy.

Both tools ship `hidden: true`. Visitors see no change. The Built to Scale? page (Release 3a) will reach them through the registry `feeds` map; nothing in this release calls them.

```
app/lib/tools/registry.ts        + ROUTE_TO_BUYER (06), UNIT_OF_VALUE (07), count helpers
app/lib/ceiling.ts               new: pure calculator, types, type guard, labels
app/lib/tools/schema.ts          ceiling kind in detailsSchema and parseDetails; ExtraValue widened
app/lib/tools/pipeline.ts        one type line: FullView.extras uses ExtraValue
app/lib/tools/calibration.ts     three exported skip reason strings
app/components/toolkit/shared/extras.tsx   Ceiling and Risk renderers; keyed map; object fallback
app/admin/runs/page.tsx          guard for an object extra value
app/tools/hub-copy.ts            new: hub titles, descriptions, lead, tag and ItemList from the registry
app/tools/page.tsx               reads hub-copy.ts
app/components/toolkit/ToolkitHub.tsx      reads hub-copy.ts
app/tools/[tool]/page.tsx        FAQ footer count word from the registry
app/tools/[tool]/toolSlugs.ts    re-exports the count helpers
app/scale-up-advisory/scale-up-content.ts  HUB_TOOLS body and hubLink from the count word
app/sitemap.ts                   tool entries mapped from PUBLIC_TOOLS
scripts/calibrate.ts             hidden entry reason distinct from missing entry
calibration/README.md            note updated
calibration/route-to-buyer/*.json          three cases
calibration/unit-of-value/*.json           three cases
__tests__/ceiling.test.ts        new
__tests__/calibration-cases.test.ts        new
__tests__/registry.test.ts, schema.test.ts, gtm-toolkit.test.ts, calibration.test.ts, scale-up-advisory.test.ts   updated
```

---

## 1. Files to Modify / Create

### 1.1 `app/lib/tools/registry.ts` (modify)

- `ToolSlug` gains `"route-to-buyer" | "unit-of-value"`, placed before `"account"`.
- `ToolExtra.kind` becomes `"text" | "list" | "ceiling"`.
- Two new entries, `ROUTE_TO_BUYER` and `UNIT_OF_VALUE`, defined after `MOAT` and before the `ACCOUNT` comment block. Full content in section 2.1.
- `TOOLS` becomes `[ICP, PERSONA, PROBLEM, POSITIONING, MOAT, ROUTE_TO_BUYER, UNIT_OF_VALUE, ACCOUNT]`.
- Three new exports after `PUBLIC_TOOLS`: `countWord`, `PUBLIC_TOOL_COUNT`, `PUBLIC_TOOL_COUNT_WORD`, `PUBLIC_TOOL_COUNT_WORD_CAPITALISED` (section 2.4). The file keeps its "plain data with no imports" rule; the helper is a small pure function over a lookup table.
- The file header comment gains one sentence: the public tool count and its word form are exported here so copy never hard codes a number.

### 1.2 `app/lib/ceiling.ts` (create)

Pure, no imports, safe in client components, server components, tests and scripts. Exports the ceiling input types, the type guard, the fixed labels, the default currency, `computeCeiling` and `unsupportedCeilingInputs`. Full API in section 2.2.

### 1.3 `app/lib/tools/schema.ts` (modify)

- `import type { CeilingInputs } from "../ceiling.ts"` (type only, so the module stays pure and `runs.ts` is unaffected).
- `ExtraValue` becomes `string | string[] | CeilingInputs`. `runs.ts` imports `ExtraValue` from here, so `RunRecord.extras` widens without touching `runs.ts`.
- `detailsSchema`: a third branch for `kind === "ceiling"` that emits the strict object schema in section 2.3.
- `parseDetails`: a third branch for `kind === "ceiling"` that validates the object per section 2.3 and stores the parsed object.

### 1.4 `app/lib/tools/pipeline.ts` (modify, one type line)

`FullView.extras` is typed `Record<string, string | string[]>` today, by hand. It becomes `Record<string, ExtraValue>` with `ExtraValue` added to the existing type import from `./schema.ts`. Without this, `toFullView` fails `tsc` once `RunRecord.extras` widens. No prompt, stage or behaviour changes: `buildDetailsSystem` already lists every extra with its `ask`, and the schema carries the field level guidance. See decision 4.3 for why nothing else in the pipeline changes.

### 1.5 `app/lib/tools/calibration.ts` (modify)

Add three exported string constants: `SKIP_REASON_TO_FILL` (the existing "input contains TO FILL"), `SKIP_REASON_NO_ENTRY` (the existing "no registry entry, skipped") and `SKIP_REASON_HIDDEN` ("hidden in the registry pending its Published rubric row and calibration, skipped"). The script and the tests read them from here so the table text is pinned once.

### 1.6 `scripts/calibrate.ts` (modify)

- The `!entry || entry.hidden` branch splits: a missing entry reports `SKIP_REASON_NO_ENTRY`; a hidden entry reports `SKIP_REASON_HIDDEN`. Both still skip without reading the files.
- The `TO FILL` branch uses `SKIP_REASON_TO_FILL`.
- Header comment: the sentence "its folder has no public registry entry (the Release 2 tools)" becomes two cases, no registry entry (`built-to-scale`) and a hidden entry (`route-to-buyer`, `unit-of-value` until Anthony flips them).

### 1.7 `calibration/README.md` (modify)

The "TO FILL convention" paragraph: `built-to-scale` has no registry entry and is reported as "no registry entry, skipped"; `route-to-buyer` and `unit-of-value` have hidden registry entries and are reported as "hidden in the registry pending its Published rubric row and calibration, skipped". Add one sentence to "Adding a case": a case proposed by the pipeline carries `agreedBy` "Proposed by agentic-rig, to be confirmed by Anthony Stevenson" and no `agreedOn` until Anthony confirms it, at which point both fields are set to his name and the date.

### 1.8 `calibration/route-to-buyer/` and `calibration/unit-of-value/` (create, three files each)

Section 2.6 lists the files, the businesses, the expected grades and the reasoning the Coder writes into `note`. Inputs are complete, written in the voice of a visitor pasting into the form, no `TO FILL`.

### 1.9 `app/components/toolkit/shared/extras.tsx` (modify)

- `ExtraValue` is no longer declared locally. It becomes `import type { ExtraValue } from "@/app/lib/tools/schema"` (type only, erased at build; `ToolPage.tsx` keeps importing `ExtraValue` from this file and compiles unchanged).
- Runtime import of `computeCeiling`, `unsupportedCeilingInputs`, `isCeilingInputs`, `CEILING_INPUT_LABELS` from `@/app/lib/ceiling`.
- `text()` guards a non-string, non-array value (returns an empty string) so no renderer can print "[object Object]".
- New `Risk` renderer (amber left border, 15 px, weight 500) and new `Ceiling` renderer (section 2.5).
- `EXTRA_RENDERERS` gains `gatekeeperRisk: Risk`, `channelMove: Priority`, `ceilingInputs: Ceiling`, `lever: Priority`.
- `renderExtra` fallback: array to `GenericList`, string to `GenericText`, any other value with no keyed renderer renders nothing (returns null). A new registry extra of an object kind can never break the page.

### 1.10 `app/components/toolkit/ToolPage.tsx` (no change)

Lines 496 to 503 skip `undefined`, an empty array and an empty string and pass everything else to `renderExtra`. An object passes through. The `FullView.extras` type there comes from `extras.tsx`, which now re-exports the widened union, so the file compiles unchanged. The unlock form is untouched (Release 1b owns it).

### 1.11 `app/admin/runs/page.tsx` (modify, one branch)

The extras block renders an array as a list and anything else as `{value}` inside a div. A `CeilingInputs` object there is a React child error ("Objects are not valid as a React child"). Add a branch: string renders as today; array as today; any other value renders `JSON.stringify(value, null, 1)` inside a `pre` with a 12 px monospace style. The admin table is for checking runs, so the raw object is the honest view; the formatted figure lives on the visitor page. No runs of a hidden tool can exist yet, so this is a guard for the flip, not for today.

### 1.12 `app/tools/hub-copy.ts` (create)

A pure module with one import, `PUBLIC_TOOLS` and the count words from `../lib/tools/registry.ts` (relative, with the `.ts` extension, so the test can load it under plain Node). Exports: `HUB_TITLE`, `HUB_DESCRIPTION`, `HUB_DESCRIPTION_OG`, `HUB_DESCRIPTION_TWITTER`, `HUB_LEAD`, `HUB_TAG`, `HUB_ITEM_LIST_DESCRIPTION` and `itemListSchema`. Strings in section 2.4. This is the one place the hub says how many tools there are.

### 1.13 `app/tools/page.tsx` (modify)

`metadata` and the JSON-LD script read from `hub-copy.ts`. The three titles, three descriptions and the ItemList description and `numberOfItems` all derive. The page keeps its `alternates`, `openGraph.url`, images and twitter card fields as they are.

### 1.14 `app/components/toolkit/ToolkitHub.tsx` (modify)

The lead paragraph becomes `HUB_LEAD` and the first hero tag becomes `HUB_TAG`, both imported from `@/app/tools/hub-copy`. The comment "Tools 01 to 05 from the registry" becomes "Public tools from the registry, in number order".

### 1.15 `app/tools/[tool]/page.tsx` (modify)

The FAQ footer sentence ": five free tools for teams selling into finite markets" uses `PUBLIC_TOOL_COUNT_WORD` from the registry import the file already has.

### 1.16 `app/tools/[tool]/toolSlugs.ts` (modify)

Re-export `PUBLIC_TOOL_COUNT` and `PUBLIC_TOOL_COUNT_WORD` alongside the existing re-exports. This is the only runtime path `scale-up-content.ts` may use.

### 1.17 `app/scale-up-advisory/scale-up-content.ts` (modify)

- The import line becomes a relative runtime import from `../tools/[tool]/toolSlugs.ts` for `PUBLIC_TOOL_COUNT_WORD` and `type ToolSlug`. Relative with the `.ts` extension because `__tests__/scale-up-advisory.test.ts` loads this module directly under Node, where the `@/` alias does not resolve. The registry is plain data, so pulling it in under Node is safe (the same test already imports `toolSlugs.ts`).
- The module comment "Keep this module free of runtime imports" is reworded: runtime imports are allowed only from `toolSlugs.ts` by relative `.ts` path, because the test loads this file under plain Node.
- `HUB_TOOLS.body` and `HUB_TOOLS.hubLink` become template strings using the count word (section 2.4). The body no longer enumerates the tools by name (decision 4.6).

### 1.18 `app/sitemap.ts` (modify)

Import `PUBLIC_TOOLS` from `./lib/tools/registry.ts` (relative with the `.ts` extension; the scale-up test imports `sitemap.ts` under plain Node). Replace the five literal `/tools/{slug}` lines with one entry per public tool, `url: tool.seo.canonical`, `lastModified: now`, `changeFrequency: "monthly"`, `priority: 0.7`, spread into the array between `/tools` and `/newsletter` so order is unchanged for the existing five.

### 1.19 Tests

| File | Change |
| --- | --- |
| `__tests__/ceiling.test.ts` | new, section 2.7 |
| `__tests__/calibration-cases.test.ts` | new, section 2.7 |
| `__tests__/registry.test.ts` | numbering assertions rewritten; hidden entry checks; count helper checks |
| `__tests__/schema.test.ts` | ceiling kind schema and parse checks |
| `__tests__/gtm-toolkit.test.ts` | numbering assertions rewritten; derivation checks for hub copy, ItemList, sitemap and scale-up copy |
| `__tests__/calibration.test.ts` | skip reason constants |
| `__tests__/scale-up-advisory.test.ts` | the literal `5` in "has five entries" becomes `PUBLIC_TOOL_COUNT`; nothing else changes |

---

## 2. Integration Points

### 2.1 Registry entries

Both entries follow the shape of `MOAT`. Strings below are final copy; the Coder lifts them as written. British spelling, no dashes, no hype. The `seo.title` uses the same separator character as the five existing titles (copy it from `ICP.seo.title`); it is the one permitted exception.

#### ROUTE_TO_BUYER

| Field | Value |
| --- | --- |
| `slug` | `route-to-buyer` |
| `number` | `06` |
| `name` | Route to Buyer |
| `tagline` | Score how you reach the buyer across six dimensions. Find the one constraint between you and the people who can sign. |
| `outputDescription` | Score, grade, six scored dimensions, the gatekeeper whose no costs most, and the first channel move. |
| `role` | a B2B go-to-market expert who has built sales motions for companies selling into finite, named-account markets |
| `hidden` | `true` |
| `feeds` | `["routeToBuyer"]` |
| `cta.heading` | Need help reaching the buyer? |
| `cta.body` | Summit works alongside small teams selling to enterprise: finding the channels that gather buyers, shortening the cycle, and closing the gap between aspiration and pipeline reality. |
| `buttonLabel` | Check My Route |

Inputs (all `kind: "textarea"` unless stated):

| key | label | required | minLength | maxLength | placeholder | example |
| --- | --- | --- | --- | --- | --- | --- |
| `buyer` | Who the buyer is | yes | 50 | 4000 | Who signs, who influences and who can say no. Role, company type, the budget line the money comes from, and roughly how many such buyers exist. | The buyer is the Director of Fleet Operations at Canadian municipalities with 150 to 900 vehicles. There are about 110 of them. The CFO approves anything over 75,000 CAD and the procurement office runs the tender. Budget comes from the fleet replacement line, set each autumn. |
| `route` | How you reach them today | yes | 50 | 4000 | How a first conversation starts now. Outbound, referrals, partners, tenders, events, inbound. Who does it and how much of it depends on the founder. | Most conversations start when a fleet manager we already serve mentions us to a peer at the Canadian Public Fleet Managers conference. The founder does every first call. We answer public tenders when we see them, usually too late. |
| `cycle` | Typical sales cycle | no | 0 | 600 (`kind: "text"`) | First contact to signature: how long, and the steps in between. | Nine to fourteen months: pilot on ten vehicles, council budget approval, tender, legal review. |
| `channels` | Partners and channels | no | 0 | 2000 | Any partner, association, marketplace, community or event that already gathers these buyers, and whether you have a place in it. | We sponsor the fleet managers conference and sit on its vendor panel. Two telematics installers refer us when a municipality asks about reporting. No marketplace listing. |

Dimensions, in this order, with `levels` taken verbatim from the Notion descriptors and `standard` derived from the Measures line:

| key | name | weight | levels 1 to 5 | standard |
| --- | --- | --- | --- | --- |
| `bi` | Buyer Identifiable | 0.20 | Absent, Vague, Named, Specific, Listable | You can name the buyer's role, the type of company they sit in and the budget line the purchase comes from, and you could list them by name. |
| `ch` | Channels That Gather Buyers | 0.20 | None, Possible, Present, Working, Owned | Partners, organisers, marketplaces, communities or events already concentrate these buyers somewhere the company reaches today, and the company has a working place in that channel. |
| `gk` | Gatekeeper Dependence | 0.15 | Captive, Heavy, Present, Light, None | No party sits between the company and the buyer whose single no can stop a sale, and a no from anyone else costs little. |
| `ba` | Buyer Attention | 0.10 | Wrong time, Unknown, Known, Timed, Triggered | The company knows when the buyer is able to act and reaches them on that trigger, not when they are busiest. |
| `sc` | Sales Cycle | 0.15 | Open-ended, Long, Defined, Short, Transactional | The steps from first contact to signature are few, defined and short enough to repeat many times a year. |
| `cw` | Cost to Win Against Deal Value | 0.20 | Founder heroics, Expensive, Covered, Repeatable, Efficient | Acquisition effort and spend are small against first-year value, and winning repeats without the founder in the room. |

Weights sum to 1.00.

Extras:

| key | label | kind | ask |
| --- | --- | --- | --- |
| `gatekeeperRisk` | Gatekeeper risk | text | One line naming the party whose no costs this company most on the way to the buyer, and what that no costs in time, money or lost accounts. |
| `channelMove` | First channel move | text | The one channel move to make first, one sentence, specific to this business and naming the channel. |

SEO:

| field | value |
| --- | --- |
| `title` | Route to Buyer, separator, Summit GTM Toolkit |
| `description` | See whether you can name, reach and win your buyer without the founder in every deal. A score out of 100, a grade from 1 to 5 and six scored dimensions. |
| `about` | The Route to Buyer scores how a company reaches the people who can sign: whether the buyer can be named, whether a channel already gathers them, how many gatekeepers sit in the way, whether the company reaches them when they can act, how long the cycle runs, and what it costs to win against what a deal is worth. It is built for teams selling into a finite market, where every buyer burned is one fewer to sell to. |
| `howItWorks` | Describe the buyer, how you reach them today, the typical cycle and any channels / The tool scores the route across six weighted dimensions / Receive a score out of 100, a grade from 1 to 5, a one-line verdict and the gatekeeper whose no costs most / Free, no signup, results in under 30 seconds |
| `faqs[0]` | q: What is a route to buyer? a: A route to buyer is the path a first conversation takes from your company to the person who can sign: who starts it, which channel it runs through, who has to say yes on the way, and how long it takes. A strong route is one the company can repeat without the founder, through a channel that already gathers the buyers. |
| `faqs[1]` | q: Why does the route matter more in a finite market? a: When there are 110 buyers, not 110,000, every route that burns a buyer removes one you cannot replace. A route that depends on founder introductions or a gatekeeper's goodwill caps how many of those buyers you will ever reach. The check finds the constraint before you scale spend into it. |
| `faqs[2]` | q: What are the six dimensions in the Route to Buyer? a: Buyer Identifiable, Channels That Gather Buyers, Gatekeeper Dependence, Buyer Attention, Sales Cycle, and Cost to Win Against Deal Value. Each is scored from 1 to 5 and weighted into a score out of 100 and a grade from 1 to 5. |
| `faqs[3]` | q: Is the Route to Buyer free? a: Yes. It is free to use with no signup or account required. Results are generated in under 30 seconds. |
| `canonical` | `https://summitstrategyadvisory.com/tools/route-to-buyer` |

#### UNIT_OF_VALUE

| Field | Value |
| --- | --- |
| `slug` | `unit-of-value` |
| `number` | `07` |
| `name` | Unit of Value |
| `tagline` | Score what one sale consumes and what caps it across six dimensions. See the revenue ceiling per head and the lever most likely to break it. |
| `outputDescription` | Score, grade, six scored dimensions, the annual revenue ceiling per head with its assumptions, and the lever to break it. |
| `role` | a B2B business model analyst who has scaled service and software companies |
| `hidden` | `true` |
| `feeds` | `["unitOfValue"]` |
| `cta.heading` | Need help moving growth off headcount? |
| `cta.body` | Summit works alongside small teams selling to enterprise: reshaping the unit, pricing for expansion, and closing the gap between aspiration and pipeline reality. |
| `buttonLabel` | Check My Unit |

Inputs (all `kind: "textarea"`):

| key | label | required | minLength | maxLength | placeholder | example |
| --- | --- | --- | --- | --- | --- | --- |
| `delivery` | What you deliver and what one sale consumes | yes | 50 | 4000 | What the customer buys, and what delivering one of them uses up: hours, people, slots, seats, servers. Numbers where you have them. | We run incident response tabletop exercises for mid-sized hospitals. One exercise is a one-day on-site session led by one of our facilitators, with about two days of preparation and one day of write-up. Each facilitator runs one exercise a week, forty weeks a year. |
| `pricing` | How it is priced | yes | 20 | 3000 | Per what, at what price, in which currency. Tiers, usage, seats, retainers. | Priced per exercise at 9,500 CAD. A three exercise programme is 25,000 CAD. No retainer, no subscription. |
| `cost` | What a delivery takes in people and time | no | 0 | 3000 | Who does the work, how long it takes, and what it costs you to deliver one unit. | A facilitator costs us about 140,000 CAD a year fully loaded. Preparation is mostly re-used templates now, so a new facilitator reaches full speed in six weeks. |
| `renewal` | How customers renew or expand | no | 0 | 2000 | What share of customers buy again, how often, and whether they buy more each time. | About half of hospitals book a second exercise within eighteen months, usually the same size. Two of thirty have bought a programme. |

Dimensions:

| key | name | weight | levels 1 to 5 | standard |
| --- | --- | --- | --- | --- |
| `ud` | Unit of Delivery | 0.20 | People-bound, Mostly people, Mixed, Mostly product, Product | One sale consumes product capacity (seats, slots, servers) rather than people's hours. |
| `cu` | Capacity per Unit | 0.20 | One, Few, Many, Hundreds, Unbounded | One unit of capacity serves an unbounded number of customers at the same time. |
| `mv` | Margin at Volume | 0.20 | Erodes, Flat and thin, Holds, Improves, Compounds | Margin compounds as volume grows because each extra customer costs less to serve than the last. |
| `rr` | Repeat Revenue | 0.15 | None, Some, Partial, Majority, Compounding | Most of next year's revenue already exists through renewals or usage, and it grows without a new sale. |
| `vg` | Value Growth per Unit | 0.10 | Fixed, Limited, Growing, Tiered, Expanding | The value delivered per unit rises over time through tiers, usage or expansion rather than being fixed by the unit. |
| `cb` | Ceiling Breaker | 0.15 | None, Named, Started, Proven, Primary | A credible lever (software, channel or pricing) that moves growth off headcount is already the primary engine of growth. |

Weights sum to 1.00.

Extras:

| key | label | kind | ask |
| --- | --- | --- | --- |
| `ceilingInputs` | Revenue ceiling per head | ceiling | Where the text supports it, the three inputs to the annual revenue ceiling per head, each as a number with the assumption behind it: unitsPerPersonPerPeriod (how many units one person delivers in one period, for example clients per evaluator per show), pricePerUnit (the price of one unit, in the currency the text uses), periodsPerYear (how many periods there are in a year). Return null for any input the text does not give. Never estimate a missing one. The code computes the figure. |
| `lever` | Ceiling breaker | text | The one lever most likely to break the ceiling on this business, one sentence, specific to this business and naming whether it is software, channel or pricing. |

SEO:

| field | value |
| --- | --- |
| `title` | Unit of Value, separator, Summit GTM Toolkit |
| `description` | See what one sale consumes, what caps it, and the revenue ceiling per head. A score out of 100, a grade from 1 to 5 and six scored dimensions. |
| `about` | The Unit of Value scores what a company sells as a unit: what one sale consumes, how many customers one unit of capacity serves, whether margin holds as volume grows, how much revenue repeats, whether value per unit can rise, and whether there is a credible lever to move growth off headcount. Where the input gives the numbers, it computes the annual revenue ceiling per head and shows the assumptions beside it. |
| `howItWorks` | Describe what you deliver, how it is priced, what a delivery takes and how customers renew / The tool scores the unit across six weighted dimensions / Receive a score out of 100, a grade from 1 to 5, a one-line verdict and, where the numbers allow, the revenue ceiling per head / Free, no signup, results in under 30 seconds |
| `faqs[0]` | q: What is a unit of value? a: The unit of value is what a customer buys as one thing and what delivering it uses up: an hour, a day, a seat, a slot, a server. It decides whether revenue grows with headcount or without it. A business whose unit is people's time has a ceiling set by how many people it can hire and keep busy. |
| `faqs[1]` | q: What is the revenue ceiling per head? a: Units one person can deliver in a period, multiplied by the price of a unit, multiplied by the periods in a year. For a show-based business that is clients per evaluator per show, times price, times shows a year. The check computes it from the numbers in your input and never estimates a number you did not give. |
| `faqs[2]` | q: What are the six dimensions in the Unit of Value? a: Unit of Delivery, Capacity per Unit, Margin at Volume, Repeat Revenue, Value Growth per Unit, and Ceiling Breaker. Each is scored from 1 to 5 and weighted into a score out of 100 and a grade from 1 to 5. |
| `faqs[3]` | q: Is the Unit of Value free? a: Yes. It is free to use with no signup or account required. Results are generated in under 30 seconds. |
| `canonical` | `https://summitstrategyadvisory.com/tools/unit-of-value` |

#### What `hidden: true` gates, with the exact checks

- `PUBLIC_TOOLS` is `TOOLS.filter((t) => !t.hidden)` in the registry, so the hub cards (`ToolkitHub.tsx` maps `PUBLIC_TOOLS`), the admin chips, the admin rubric list, the models override dropdown, `generateStaticParams` in `app/tools/[tool]/page.tsx`, the ItemList JSON-LD and (after this release) the sitemap all omit both tools.
- `app/tools/[tool]/page.tsx`: `generateMetadata` returns `{}` and the page calls `notFound()` when `isToolPublic(tool)` is false, so `/tools/route-to-buyer` and `/tools/unit-of-value` return 404 even when requested directly.
- `app/api/tools/[tool]/score/route.ts`: `if (!entry || !isToolPublic(tool))` returns 404 before validation. `scoreRun` in `pipeline.ts` throws `ToolNotFoundError` on `entry.hidden`, which `errors.ts` maps to 404, so a direct function call (the calibration script, a future Release 3a caller) is gated too.
- `app/api/tools/[tool]/details/route.ts`: `if (!isToolPublic(tool))` returns 404.
- `app/api/tools/[tool]/unlock/route.ts`: untouched; it is gated the same way today (Release 1b owns it, and no run of a hidden tool can exist to unlock).
- `ToolRunner.tsx` renders `ToolPage` only when `isToolPublic(slug)`.
- `isToolHidden` defaults to `true` for an unknown slug, so a typo in a flip cannot expose anything.

### 2.2 `app/lib/ceiling.ts` API

Types:

- `CeilingInputKey`: `"unitsPerPersonPerPeriod" | "pricePerUnit" | "periodsPerYear"`.
- `CEILING_INPUT_KEYS`: readonly tuple of the three keys in that order. This is the order the schema, the parser, the calculator and the renderer all use.
- `CEILING_INPUT_LABELS`: `Record<CeilingInputKey, string>` with "Units per person per period", "Price per unit", "Periods per year".
- `CeilingInput`: `{ value: number | null; assumption: string }`.
- `CeilingInputs`: `Record<CeilingInputKey, CeilingInput>`. This is what the model returns, what `parseDetails` stores on the run, and what the renderer reads.
- `CeilingAssumption`: `{ key: CeilingInputKey; label: string; value: number; text: string }`.
- `CeilingResult`: `{ value: number; currency: string; formatted: string; assumptions: CeilingAssumption[] }`. `assumptions` always has three entries in key order.
- `DEFAULT_CURRENCY`: `"CAD"`.

Functions:

- `isCeilingInputs(value: unknown): value is CeilingInputs`. True when `value` is a non-array object with all three keys, each a non-array object whose `value` is `null` or a number and whose `assumption` is a string. Used by the parser's structural check, the renderer and the admin guard.
- `isSupportedCeilingValue(value: unknown): value is number`. True only for a finite number greater than zero. Null, undefined, NaN, Infinity, zero and negatives are unsupported. Zero is unsupported because a zero input means the text gave nothing usable, not a zero ceiling.
- `unsupportedCeilingInputs(inputs: CeilingInputs): CeilingInputKey[]`. The keys, in order, whose `value` fails `isSupportedCeilingValue`. Empty when the figure can be computed.
- `computeCeiling(inputs: CeilingInputs, currency?: string): CeilingResult | null`. Returns `null` when `unsupportedCeilingInputs` is non-empty. Otherwise multiplies the three values, rounds to the nearest whole unit of currency with `Math.round`, and returns `value` (the rounded number), `currency`, `formatted` and the three assumptions. `currency` is the parameter upper-cased and trimmed when it matches three letters A to Z, otherwise `DEFAULT_CURRENCY`. `formatted` is the currency code, a space, and the rounded value grouped with commas via `toLocaleString("en-GB")` (the same call `validate.ts` already uses), for example `CAD 380,000`. No `Intl.NumberFormat` currency style: its output differs by ICU build and would make the test brittle. Each assumption is `{ key, label: CEILING_INPUT_LABELS[key], value: inputs[key].value, text: inputs[key].assumption.trim() }`.

The function never estimates: there is no default for a missing input, and there is no partial result. The spec's "return null for any input the text does not support; never estimate one" is enforced twice, once in the prompt and once here.

### 2.3 Details schema and parser for `kind: "ceiling"`

Schema emitted for the extra key (strict mode rules: every property required, `additionalProperties: false`, nullable via a type array):

- The extra: `type: "object"`, `additionalProperties: false`, `required` is the three keys in `CEILING_INPUT_KEYS` order, `description` is `x.ask`.
- Each key: `type: "object"`, `additionalProperties: false`, `required: ["value", "assumption"]`, with:
  - `value`: `type: ["number", "null"]`, description per key: "Units one person delivers in one period, as a number, or null when the text does not say." / "Price of one unit in the currency the text uses, as a number, or null when the text does not say." / "Periods in a year, as a number, or null when the text does not say."
  - `assumption`: `type: "string"`, description: "One sentence naming the figure and where in the text it comes from, or, when value is null, why the text does not support it."

The schema lives in `schema.ts` next to the `text` and `list` branches so that nothing outside `schema.ts` knows the JSON shape; it uses `CEILING_INPUT_KEYS` and `CEILING_INPUT_LABELS` from `ceiling.ts` (runtime import of a pure module with no imports; `schema.ts` stays importable under plain Node).

Parser branch in `parseDetails` for `kind === "ceiling"`:

1. `extrasRaw[x.key]` must be a non-array object, else `SchemaError("extras.{key} is not an object")`.
2. Each of the three keys must be present and a non-array object, else `SchemaError("extras.{key}.{inputKey} is missing")`.
3. `value`: kept when `null` or a finite number; anything else (a string, NaN, Infinity, undefined) becomes `null`. Zero and negatives are kept as returned; the calculator treats them as unsupported, so the run record shows exactly what the model said.
4. `assumption`: trimmed string, or an empty string when absent or not a string.
5. Stored value: the parsed `CeilingInputs` object, keys in `CEILING_INPUT_KEYS` order, nothing else. No figure, no currency.

The `text` and `list` branches are untouched.

### 2.4 Count helper and the copy that uses it

In `registry.ts`, after `PUBLIC_TOOLS`:

- `countWord(n: number, capitalised?: boolean): string`. A lookup of the words zero to twelve; any other integer returns its digits. `capitalised` upper-cases the first letter. Pure, no imports.
- `PUBLIC_TOOL_COUNT: number` is `PUBLIC_TOOLS.length`.
- `PUBLIC_TOOL_COUNT_WORD: string` is `countWord(PUBLIC_TOOL_COUNT)` ("five" today, "seven" after both flips).
- `PUBLIC_TOOL_COUNT_WORD_CAPITALISED: string` is `countWord(PUBLIC_TOOL_COUNT, true)`.

`app/tools/hub-copy.ts` (new, pure, one relative `.ts` import from the registry) holds every hub string that states the count:

| export | value |
| --- | --- |
| `HUB_TITLE` | `Summit GTM Toolkit`, separator, `{Capitalised} Free Tools for Finite Markets` (56 characters at "Seven", inside the 60 character guide; the separator is the one already in the title today) |
| `HUB_DESCRIPTION` | `{Capitalised} free AI-powered GTM diagnostic tools for B2B teams selling into finite, named-account markets. ICP Evaluator, Positioning Grader, Moat Rater, and more. No signup required.` |
| `HUB_DESCRIPTION_OG` | `{Capitalised} free AI-powered GTM diagnostic tools for B2B teams selling into finite, named-account markets. No signup required.` |
| `HUB_DESCRIPTION_TWITTER` | `{Capitalised} free AI-powered GTM diagnostic tools for B2B teams selling into finite markets. No signup.` |
| `HUB_ITEM_LIST_DESCRIPTION` | `{Capitalised} free AI diagnostic tools for B2B teams selling into finite, named-account markets.` |
| `HUB_LEAD` | `{Capitalised} free AI diagnostic tools for teams selling into finite, named-account markets. No signup. Results in under 30 seconds.` |
| `HUB_TAG` | `{Capitalised} Free Tools` |
| `itemListSchema` | the object currently built in `page.tsx`, with `description: HUB_ITEM_LIST_DESCRIPTION` and `numberOfItems: PUBLIC_TOOLS.length` |

Call sites:

| file | string today | after |
| --- | --- | --- |
| `app/tools/page.tsx` | three titles, three descriptions, ItemList description | `HUB_TITLE`, `HUB_DESCRIPTION`, `HUB_DESCRIPTION_OG`, `HUB_DESCRIPTION_TWITTER`, `itemListSchema` from `hub-copy.ts` |
| `app/components/toolkit/ToolkitHub.tsx` | lead paragraph, first hero tag, "Tools 01 to 05" comment | `HUB_LEAD`, `HUB_TAG`, comment reworded |
| `app/tools/[tool]/page.tsx` | `: five free tools for teams selling into finite markets.` | `: {PUBLIC_TOOL_COUNT_WORD} free tools for teams selling into finite markets.` |
| `app/scale-up-advisory/scale-up-content.ts` | `HUB_TOOLS.body` enumerates five tools; `hubLink` "See all five tools" | body: `Summit uses AI every day, in our own sales and in the engines we build for clients. Along the way we've built {word} free GTM tools that put some of that to work for you. Each one scores a part of your go-to-market and tells you what to fix first. No sign-up. Try them before you talk to us.`; hubLink: `See all {word} tools` |

The scale-up copy hygiene test checks heading plus body for "AI" and "free" (both kept), a maximum of three em dashes (none added) and the absence of the word "route" anywhere in the module's exports (the new body contains no such word; see risk 7.4 for what happens at flip time).

### 2.5 Extras renderers

`Ceiling` renderer, inside a `panelStyle` panel with `BRAND.lightTeal` background and a `BRAND.teal` border like `Rewrite`:

- Narrow the value with `isCeilingInputs`; if it fails (a stored run from before a schema change, or a malformed value) render nothing.
- Call `computeCeiling(value)` with the default currency.
- When a result comes back: the heading (the extra label), then the figure on one line in the Oswald face at 28 px, `BRAND.darkGreen`, as `{formatted}` followed by a 13 px `BRAND.mid` suffix "per person per year", then a three row list (`assumptions` in order), each row `{label}: {value}` in 14 px `BRAND.dark` weight 600 followed by the assumption text in 14 px `BRAND.mid`.
- When `null`: the heading, then one plain sentence in 14 px `BRAND.dark`: "The ceiling cannot be computed because the text did not give {labels of the unsupported keys, joined with commas and "and", lower-cased}." Below it the same three row list, with "not supported by the text" in `BRAND.mid` italics in place of the number where the value is unsupported, and the model's assumption text beside it so the visitor sees what was and was not found.
- A two column layout (figure left, assumptions right) on screens above 640 px via `display: grid` with `gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)"` and `gap: 20`; single column below via the existing `.gtm-tool-grid` pattern is not reused because the panel is nested, so the Coder uses a flex wrap with `minWidth` 220 on the figure column instead. Inline styles with BRAND tokens only; no Tailwind utilities.

`Risk` renderer: `panelStyle` with a 3 px `BRAND.amber` left border, 15 px `BRAND.darkGreen` weight 500 paragraph. Used for `gatekeeperRisk`.

`Priority` (existing, `BRAND.brandGreen` left border) is reused for `channelMove` and `lever`: each is "the one move".

### 2.6 Calibration cases

Six files, `_template.json` shape, `tool` matching the folder, `input` keyed by the registry input keys with every key present (optional inputs filled too so the cases exercise the full form), `expected.dimensions` keyed by the six dimension keys, `agreedBy: "Proposed by agentic-rig, to be confirmed by Anthony Stevenson"`, no `agreedOn`, `source: "invented example written for calibration, October 2026"` (none is a real company, so no public-information claim is made), and a `note` giving the reasoning below in one to three sentences. The Coder writes the inputs in full, in the first person, as a founder would paste them into the form, with concrete numbers that support the expected grades. The `expected.grade` is the band of `calcScore` over `expected.dimensions` (checked by the new test), so the dimension grades are chosen first and the overall grade follows.

| file | business | expected dimensions | score | grade |
| --- | --- | --- | --- | --- |
| `route-to-buyer/harbourline-berth-scheduling.json` | Harbourline, berth scheduling software for the seventeen Canadian port authorities. Buyer: Director of Operations, named list, capital budget line. Channel: Association of Canadian Port Authorities working group, where the company presents twice a year. One gatekeeper (the port's IT security review). Cycle six months, four defined steps. Two closes a year by the head of sales, not the founder. | bi 5, ch 4, gk 3, ba 4, sc 3, cw 4 | 78 | 4 Strong |
| `route-to-buyer/northfield-school-catering.json` | Northfield, catering supply to independent schools in Ontario. Buyer "the bursar or the head" at about 300 schools. Reach: founder's network and a stand at one annual conference. Procurement committee and a board sign-off in the way. Timing known (budgets set in spring). Cycle five to nine months, steps loosely defined. Founder closes every deal. | bi 3, ch 3, gk 3, ba 2, sc 3, cw 2 | 54 | 3 Developing |
| `route-to-buyer/pennant-assistant.json` | Pennant, an AI assistant "for any small business". Buyer is "the owner". Reach: cold email and LinkedIn posts, no channel, no partner. Every deal through the founder, no cycle to speak of, deals of 1,200 CAD a year won after months of chasing. | bi 1, ch 1, gk 2, ba 2, sc 1, cw 1 | 25 | 1 Starting Point |
| `unit-of-value/ledgerline-payroll.json` | Ledgerline, payroll software for Canadian credit unions, priced per employee per month, 94 percent net revenue retention, gross margin rising with each cohort, one hosted platform serving all 160 customers, usage tiers that move customers up as they grow, and a partner channel with the two core banking vendors already producing a third of new revenue. | ud 5, cu 4, mv 4, rr 5, vg 4, cb 4 | 87 | 5 Elite |
| `unit-of-value/tabletop-exercises.json` | The hospital tabletop exercise business in the registry example: one facilitator, one exercise a week, forty weeks a year, 9,500 CAD per exercise, templates cut preparation time, half the customers rebook within eighteen months, a three exercise programme exists, and a self-serve scenario library is in build. The ceiling computes: 1 x 9,500 x 40 = 380,000 CAD per head per year. | ud 2, cu 2, mv 3, rr 3, vg 3, cb 3 | 52 | 3 Developing |
| `unit-of-value/oakridge-joinery.json` | Oakridge, bespoke shopfitting joinery. Every job quoted on hours, two joiners per job, margin thin and falling as overtime rises, about a fifth of clients return, no tiering, the only named lever is "hire more joiners". | ud 1, cu 1, mv 2, rr 2, vg 2, cb 2 | 32 | 2 Early-Stage |

Across the six cases all five grade bands appear (5, 4, 3, 3, 2, 1). Each tool spans at least three bands.

### 2.7 Tests

`__tests__/ceiling.test.ts` (new; imports `../app/lib/ceiling.ts`):

- Happy path: 1, 9500, 40 gives `value` 380000, `currency` "CAD", `formatted` "CAD 380,000", three assumptions in key order with the fixed labels and the trimmed assumption texts.
- Rounding: 12.5, 99.99, 3 gives 3750.
- Null in any one position gives `null`; `unsupportedCeilingInputs` names that key only.
- Zero, a negative, NaN and Infinity in any position give `null`.
- Currency switch: "usd" gives `currency` "USD" and `formatted` "USD 380,000"; "dollars" falls back to "CAD".
- `isCeilingInputs` accepts a well formed object and rejects a string, an array, an object missing a key, and an object whose `value` is a string.
- `computeCeiling` never mutates its input (deep-equal before and after).

`__tests__/calibration-cases.test.ts` (new; `node:fs`, `node:path`, the registry, `scoring.ts`, `calibration.ts`): for every folder under `calibration/` whose name is a registry slug with at least one dimension, and every `.json` file in it:

- parses as JSON; `tool` equals the folder name; `name` is non-empty.
- `input` keys are a subset of the tool's input keys and every required input is present and at least `minLength` long and at most `maxLength`; `isCaseFillable` is true.
- `expected.dimensions` keys equal the tool's dimension keys exactly; each value is an integer 1 to 5; `expected.grade` is an integer 1 to 5.
- `gradeFor(calcScore(expected.dimensions, tool.dimensions)).grade` equals `expected.grade` (the dimension grades and the overall grade agree through the registry weights).
- `agreedBy` is non-empty; `note` is non-empty.
- Both new folders exist and hold at least three files each.

`__tests__/registry.test.ts`:

- "public tools are numbered contiguously from 01 in array order": `PUBLIC_TOOLS.map(number)` deep-equals `PUBLIC_TOOLS.map((_, i) => two-digit i + 1)`, and `PUBLIC_TOOLS.map(slug)` deep-equals `TOOLS.filter(not hidden).map(slug)`. Holds today (01 to 05) and after both flips (01 to 07).
- "TOOLS is in the agreed order": slugs deep-equal `["icp", "persona", "problem", "positioning", "moat", "route-to-buyer", "unit-of-value", "account"]`.
- "the Release 2 tools are hidden and numbered 06 and 07": for each of `route-to-buyer` and `unit-of-value`: `isToolHidden` true, `isToolPublic` false, absent from `PUBLIC_TOOLS`, `number` "06" / "07", six dimensions with the exact key lists `["bi","ch","gk","ba","sc","cw"]` and `["ud","cu","mv","rr","vg","cb"]`, weights deep-equal the Notion values and sum to 1 within 0.001, five non-empty level labels and a standard per dimension, inputs with examples within bounds (`buyer`, `route`, `cycle`, `channels` / `delivery`, `pricing`, `cost`, `renewal`), extras keys `["gatekeeperRisk","channelMove"]` / `["ceilingInputs","lever"]` with `ceilingInputs.kind === "ceiling"`, `feeds` `["routeToBuyer"]` / `["unitOfValue"]`, a full seo block with the canonical in the standard form, `role` non-empty.
- The existing "weights sum to 1", "inputs with examples", "five level labels" loops change from `PUBLIC_TOOLS` to `TOOLS.filter((t) => t.dimensions.length > 0)` so the hidden entries are held to the same invariants today (account has no dimensions and stays excluded).
- Count helpers: `countWord(5)` "five", `countWord(7, true)` "Seven", `countWord(0)` "zero", `countWord(13)` "13"; `PUBLIC_TOOL_COUNT === PUBLIC_TOOLS.length`; `PUBLIC_TOOL_COUNT_WORD === countWord(PUBLIC_TOOL_COUNT)`.

`__tests__/schema.test.ts`:

- `detailsSchema(getTool("unit-of-value"))`: extras properties keys `["ceilingInputs", "lever"]` and required the same; `ceilingInputs.type` "object", `additionalProperties` false, `required` the three keys in order; each key's schema has `required ["value","assumption"]`, `additionalProperties` false, `value.type` deep-equals `["number","null"]`, `assumption.type` "string".
- `detailsSchema(getTool("route-to-buyer"))`: two string extras.
- `parseDetails(unit-of-value)` accepts a full answer with one null and two numbers and stores the object with trimmed assumptions; a string `value` becomes `null`; a missing sub-object throws `SchemaError`; a missing `ceilingInputs` throws `SchemaError`; a non-object `ceilingInputs` throws `SchemaError`; the `lever` string is unchanged.
- The existing positioning and problem cases stay as they are (text and list unchanged).

`__tests__/gtm-toolkit.test.ts`:

- The two hub numbering tests become the derived form (slugs equal `TOOLS.filter(not hidden)`, numbers contiguous from 01).
- "the hidden Release 2 tools are absent from PUBLIC_TOOLS".
- New describe "Count copy derives from the registry": `HUB_LEAD` starts with `PUBLIC_TOOL_COUNT_WORD_CAPITALISED`; `HUB_TAG` equals `{Capitalised} Free Tools`; `HUB_TITLE` contains the capitalised word; `itemListSchema.numberOfItems === PUBLIC_TOOLS.length` and `itemListElement.length` matches; `sitemap()` URLs include every `PUBLIC_TOOLS` canonical and no `/tools/{slug}` URL for a hidden slug; `HUB_TOOLS.body` and `HUB_TOOLS.hubLink` contain `PUBLIC_TOOL_COUNT_WORD`; the FAQ footer is not loadable under Node (it is a React page) so its string is covered by the build and by review.

`__tests__/calibration.test.ts`: the skipped-case test uses `SKIP_REASON_TO_FILL`; a new test asserts `SKIP_REASON_HIDDEN` contains "hidden" and "Published" and differs from `SKIP_REASON_NO_ENTRY`, and that `formatTable` prints it for a skipped row.

`__tests__/scale-up-advisory.test.ts`: only the literal `5` in "has five entries with unique slugs" becomes `PUBLIC_TOOL_COUNT` (imported from `toolSlugs.ts`, which the test already imports from). The test name becomes "has one entry per public tool with unique slugs".

---

## 3. Data Flow

### 3.1 Scoring a hidden tool today

A request to `/api/tools/unit-of-value/score` hits `isToolPublic` and returns 404 before any model call. `scoreRun("unit-of-value", ...)` called directly throws `ToolNotFoundError`. Nothing in this release calls either.

### 3.2 Details for Unit of Value, once public

1. `detailRun` loads the run and the live rubric, builds the details system prompt. The extras line reads: `3. extras: ceilingInputs (Revenue ceiling per head): {ask} lever (Ceiling breaker): {ask}`. The ask names the three keys and the null rule in words; the schema (step 2) enforces the shape.
2. `callModel` sends `detailsSchema(entry)`: `extras.ceilingInputs` is the strict three key object from section 2.3; `extras.lever` is a string.
3. `parseDetails` validates (section 2.3) and returns `extras: { ceilingInputs: CeilingInputs, lever: string }`.
4. `updateRun` writes `extras` as a JSON string field on `run:{id}` as today (`JSON_FIELDS` includes `extras`; nested objects round-trip through `serialise` and `parseValue` unchanged). The run stores only what the model returned: three numbers or nulls and three assumption strings. No figure, no currency.
5. `toFullView` returns `extras` unchanged to the page.
6. `ToolPage` iterates `entry.extras`, finds the `ceilingInputs` value is an object (not undefined, not an empty array, not an empty string) and calls `renderExtra`.
7. `Ceiling` renderer narrows with `isCeilingInputs`, calls `computeCeiling(value)` and renders the figure with its assumptions, or the plain "cannot be computed" sentence with the assumptions the model did give.

Error paths: a model answer that violates the schema (missing sub-object, non-object extra) throws `SchemaError`, which `errors.ts` maps to 502 "unusable answer" as for any extra today. A model that returns a string where a number belongs (a lenient provider) is tolerated: the value becomes null and the renderer says the text did not support that input, which is also the correct answer when the model could not find a number. An old run whose `ceilingInputs` is not an object renders nothing rather than crashing.

### 3.3 Copy derivation

`registry.ts` computes `PUBLIC_TOOL_COUNT` and the two words at module load. `hub-copy.ts`, `page.tsx`, `ToolkitHub.tsx`, `[tool]/page.tsx`, `toolSlugs.ts`, `scale-up-content.ts` and `sitemap.ts` read them. Flipping `hidden` on an entry changes the count, the words, the hub cards, the ItemList, the static params, the sitemap and the API gates in one edit. The `number` field is still a literal on each entry (section 7.1).

### 3.4 Calibration script

`readCases` sorts folders, looks up `getTool(folder)`: `built-to-scale` has no entry and reports `SKIP_REASON_NO_ENTRY`; `route-to-buyer` and `unit-of-value` have hidden entries and report `SKIP_REASON_HIDDEN`; their three files each appear as skipped rows. With nothing runnable the script prints the table and "Nothing runnable; pass." and exits 0, without checking environment variables. After Anthony flips a tool, its folder becomes runnable with no change to the script or the cases.

---

## 4. Key Decisions

### 4.1 The figure is computed in the renderer from stored inputs, not stored on the run

Decision: the run record stores the model's `CeilingInputs` object only; `computeCeiling` runs in `extras.tsx` (and the Coder may call it in admin later) every time the page renders.

Alternative: compute in `detailRun` and store `{ value, currency, assumptions }` (the shape the spec names) on the run. Rejected because the pipeline would need a branch keyed on an extra kind, which breaks the "pipeline passes `entry.extras` through `schema.ts` and knows nothing else" rule from Release 1a and the constraint that `pipeline.ts` changes only as far as the new kind needs (one type line). A stored figure also freezes the formula, currency and rounding at the time of the run; recomputing from the inputs means a fix to `ceiling.ts` applies to every run and the figure can never disagree with the code. The run still carries everything needed to reproduce it. The spec's `{ value, currency, assumptions }` is the rendered shape (`CeilingResult`), not the stored one.

### 4.2 One structured object per ceiling, with the assumption beside each number

Decision: the model returns `{ value, assumption }` per input, not three bare numbers plus one assumptions string. Alternative: three nullable numbers and one free text `assumptions` field. Rejected because the per input pairing is what the page shows ("12 clients per evaluator per show: taken from 'each evaluator sees about a dozen clients'"), a null value needs its own explanation of why the text did not support it, and strict mode makes the pairing free.

### 4.3 `pipeline.ts` changes one type line and no behaviour

The details prompt already lists each extra as `key (label): ask`. The ceiling `ask` names the three keys, the units and the null rule in plain words; the schema's per field descriptions repeat the units and the null rule at the point the model fills each field. Between the two, the model has the shape twice. A third statement in the prompt builder would be a per kind branch in the pipeline for no gain. The `FullView.extras` type is widened because `tsc` requires it, nothing else.

### 4.4 The new kind is named `ceiling` and the type lives in `ceiling.ts`

Decision: `ToolExtra.kind: "text" | "list" | "ceiling"`; `CeilingInputs` is declared in `app/lib/ceiling.ts` and imported as a type by `schema.ts`, which widens `ExtraValue`. Alternative: a generic `"object"` kind with the schema carried on the registry extra. Rejected: the registry would then hold JSON schema fragments, which is code in data, and the renderer would still need to know the shape. A named kind keeps the registry declarative and gives the schema, the parser and the renderer one shared type. `ceiling.ts` has no imports, so `schema.ts` and `runs.ts` remain loadable under plain Node and in the browser.

### 4.5 The count helper lives in the registry, with a pure hub copy module beside the page

Decision: `countWord`, `PUBLIC_TOOL_COUNT` and the two word constants are exported from `registry.ts`; the hub's count bearing strings and the ItemList object move to `app/tools/hub-copy.ts`. Alternative: a sibling `app/lib/tools/copy.ts` for the helper, and leave the strings inline in `page.tsx` and `ToolkitHub.tsx`. The registry already exports `PUBLIC_TOOLS` and is already the thing every call site imports, so the helper belongs beside it and adds no import. The strings cannot be tested where they are (`page.tsx` imports React and Next, which plain Node cannot load), and acceptance criterion 10 asks for a test that the hub word and `numberOfItems` derive, so they move to a pure module that both the page and the test import. One module, one import, one test.

### 4.6 The scale-up body stops enumerating the tools

Decision: `HUB_TOOLS.body` names the count and what the tools do in general, not each tool. Alternative: derive the list of names or verbs from the registry. Rejected: the verbs ("score your ICP, validate the problem") are copy, not registry fields, and adding a per tool "verb phrase" field to the registry for one paragraph on one page is a field nothing else uses. The generalised sentence reads cleanly at five and at seven, and the cards below it already list the tools by name through `TOOL_STAGE_MAP`.

### 4.7 Hidden entries are held to the same registry invariants as public ones

The weight, label, input example and seo loops in the registry test move from `PUBLIC_TOOLS` to every entry with dimensions. The two new entries are therefore checked today, not on the day they flip. `account` has no dimensions and is naturally excluded, as it is now.

### 4.8 Currency is a parameter with a CAD default; the model does not return one

Decision: `computeCeiling(inputs, currency)` defaults to CAD and the renderer passes nothing. The model's three inputs carry no currency field; the `pricePerUnit` assumption text is asked to name the currency the text uses. Alternative: a fourth `currency` enum field on the extra so a business priced in pounds shows GBP. Not done because the task fixes the extra to three inputs and the figure will first be seen in calibration, where Anthony can decide whether a per run currency is worth a schema field. Flagged in section 7.3.

### 4.9 Calibration cases are invented, not real companies

The spec asks for realistic businesses with agreed grades. None of the six is a real company, so `source` says so and no public-information claim is made. The grades are proposed by the pipeline and marked for Anthony's confirmation; the new test only checks that each case is internally consistent (the overall grade is the band of the weighted dimension grades), not that the grades are right. That judgement is Anthony's.

### 4.10 The admin guard is a raw object view

Decision: `app/admin/runs/page.tsx` prints a non-string, non-array extra as pretty JSON. Alternative: render the computed figure there too. Not done: no run of a hidden tool can exist, the admin table is for checking what was stored, and the raw object is what was stored. The richer view is a later nicety.

Assumptions collected: the tool names "Route to Buyer" and "Unit of Value", as the spec and the Notion rows name them (the Orchestrator set these; the Architect had proposed a "Check" suffix); `cycle` is a single line text input and `cost` and `renewal` are optional so a visitor with less can still run and confidence drops as the Notion rule says; zero is unsupported for a ceiling input; the hub title keeps its existing separator; calibration inputs include the optional fields so the examples exercise the whole form; the six businesses are invented; `agreedOn` is omitted until Anthony confirms.

---

## 5. Constraints Honoured

- **One registry.** Both tools are described only in `registry.ts`. The ceiling input keys and labels live in `ceiling.ts`, which is a calculator, not a tool description; the registry extra names the kind and the ask. No page, route, component, test or script hard codes a dimension, weight, input key or SEO string for either tool; tests read them from the registry and assert against the Notion values.
- **One pipeline.** `pipeline.ts` gains one type line. The three generic routes are untouched. The schema branch and the parser branch sit in `schema.ts`, where the other two kinds already sit.
- **Rubrics server side only.** Nothing new reads Notion or accepts a rubric; the registry carries weights and the short level labels only, not the descriptor paragraphs.
- **No model id outside `llm.ts`.** None added.
- **No new dependencies.** `ceiling.ts`, `hub-copy.ts` and the tests use nothing beyond Node built-ins.
- **Untouched: `llm.ts`, `rubrics.ts`, `runs.ts`, the unlock route, ToolPage's unlock form, `detailRun`, every mail module.** `runs.ts` widens through its existing type import from `schema.ts`. `ToolPage.tsx` is not edited.
- **Hidden stays hidden.** Both entries ship `hidden: true`; the registry test asserts it; `PUBLIC_TOOLS` is unchanged, so the hub, static params, sitemap, ItemList, admin lists and the three routes are unchanged for visitors. The Notion rows are not published.
- **Calibration honest.** Hidden entries report a reason that names the registry flag, the Published row and calibration; the README and the script header say the same; nothing runnable exits 0.
- **Styling.** The two new renderers use inline style objects with `BRAND` tokens; no Tailwind utilities; `panelStyle` and `headingStyle` are reused.
- **Tests.** `node:test` and `node:assert/strict`; every import is relative with the `.ts` extension; no test imports `llm.ts`, `rubrics.ts`, `runs.ts` or `pipeline.ts`. `sitemap.ts`, `scale-up-content.ts` and `hub-copy.ts` import the registry by relative `.ts` path for the same reason.
- **Copy.** British spelling, no em or en dashes, no hype words in every new string, note and comment. The `seo.title` separator is the single permitted exception, copied from the existing titles.
- **Quality gates.** The Coder runs `npm test`, `npm run lint`, `npx tsc --noEmit` and `npm run build`. `npm run calibrate` is run once to confirm the six new rows print as skipped with the hidden reason and the exit code is 0; no model is called because nothing is runnable.

---

## 6. Out of Scope

- Flipping `hidden` on either tool, publishing the Notion rows, confirming the calibration grades, and running calibration against a model. Anthony's call after calibration.
- A per run currency on the ceiling extra (decision 4.8).
- `TOOL_STAGE_MAP` entries for the two tools in `scale-up-content.ts`, and the `TOOL_COLOURS` entries in `app/admin/runs/page.tsx`. Both are needed on the day a tool flips, not before; the scale-up test already fails loudly if a public tool is unmapped.
- Release 3a: the Built to Scale? page, `scoreModel`, the synthesis call, reading `feeds`.
- Release 1b: unlock, cookie, email, per email lookup and deletion.
- Any change to the existing five tools' copy beyond the count word, or to their SEO titles.
- A formatted ceiling view in admin (decision 4.10).

---

## 7. Risks and edge cases for the Reviewer

1. **Contiguity at flip time.** The rewritten numbering test asserts public numbers run 01, 02, ... with no gap. Flipping `unit-of-value` alone would make the public list 01 to 05 then 07 and fail the test. That is deliberate: it forces a decision (flip both, or renumber) rather than a card that reads "Tool 07" with no 06. The Reviewer should confirm the test message says so.
2. **Plain Node loading of `sitemap.ts`, `scale-up-content.ts` and `hub-copy.ts`.** All three now import the registry at runtime. They must use a relative path ending in `.ts`; an `@/` alias import in any of them breaks `npm test` even though `npm run build` passes. The Coder runs `npm test` before `npm run build`, not only after.
3. **Currency on the figure.** The renderer shows CAD for every business. A visitor who priced in pounds sees "CAD 380,000" under a pound price. The `pricePerUnit` assumption text is asked to name the currency, which softens it, and calibration will show whether a schema field is needed. Reviewer to confirm the ask and the field description both say "in the currency the text uses".
4. **The scale-up copy hygiene test bans the word "route".** `JSON.stringify` of the module's exports must not contain `route` or `routes` as a word. Today the module exports nothing with that string. On the day `route-to-buyer` goes public, `TOOL_STAGE_MAP` must gain its slug and that assertion will match "route" in "route-to-buyer". The flip will need that test adjusted (exclude slugs, or test copy fields only). Noted here so it is not a surprise; nothing to do now.
5. **`[tool]` in a relative import path.** `scale-up-content.ts` already imports `@/app/tools/[tool]/toolSlugs` for a type; making it a runtime relative import of the same path is the first runtime import through a bracketed directory. Brackets are literal in an import specifier for Next's bundlers and for Node; the Coder confirms with `npm run build` and `npm test`.
6. **Strict schema and nullable numbers.** `type: ["number", "null"]` is the OpenAI structured outputs form for a nullable field and is accepted by OpenRouter for Anthropic models. If a future curated model rejects a type array, the details call fails with 502 and the log shows it; the admin can reroute. The parser also tolerates a string in `value` (becomes null) so a lenient provider cannot break the page.
7. **Template literals under `as const`.** `HUB_TOOLS` is declared `as const`; a template string with a runtime interpolation infers `string`, not a literal type, which is fine because nothing narrows on it. The Coder should not try to keep a literal type there.
8. **The `cycle` input is `kind: "text"`.** The form renders a single line input for it with no character counter; the example is well within 600 characters. If the Reviewer prefers a textarea for consistency with the other three inputs, it is one field change and no test depends on it.
9. **`extras.tsx` now imports `ceiling.ts` at runtime.** `ceiling.ts` has no imports and no Node built-ins, so it bundles into the client with no server code. The Reviewer should check the file stays that way (no `node:` imports, no `Intl` currency style).
10. **Admin `pre` for an object extra.** The branch must come before the generic `{value}` render; a `CeilingInputs` object reaching `{value}` is a runtime error in the admin page. Cannot happen until a tool flips, but it is the kind of thing that surfaces in production first.
11. **Calibration case file names.** The script and the new test treat any `.json` in the folder as a case; the Coder must not leave a scratch file there, and the `note` must not contain `TO FILL` either (the fillable check only reads `input`, but the README convention is that the phrase means placeholder).
12. **The registry test moves three loops from `PUBLIC_TOOLS` to every entry with dimensions.** If a future hidden entry is added half written, `npm test` fails until its inputs, labels and seo are complete. That is the intended behaviour and matches the "adding a tool touches the registry, the Notion database, the calibration set and nothing else" ready-when line in the plan.
