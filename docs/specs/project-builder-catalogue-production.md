# Project Builder catalogue: production spec

This is a content production spec, not a rig task. It describes how the requirement catalogue is written, checked, stored and refreshed. The only code it needs is a small script and a loader; the loader is round 1B of docs/specs/project-builder-two-stage-plan.md. The worked example is docs/catalogue/sales.md.

## What the catalogue is

Two layers.

1. **Type lists.** One list per tool type: 50 to 100 requirements in groups, each with an id, a baseline flag and a size. Written once per type. This is what stage 1 suggests from and what the prototype planner reads.
2. **Product entries.** For each known product of a type: a mark or tier against every requirement, a comment where the mark needs qualifying, and a short header. This is what the replace path and the suggest prompt read when a prospect names their current system.

Later, for stage 2, each requirement gains template acceptance criteria and each type gains entity and integration templates. Those are added type by type when a project needs them and are out of scope for the first release.

## The type list

First release, seven types, all operational: they run a process with customers, suppliers or field staff in it, which is the kind of system clients build rather than buy. Products with a public API specification or index, which the spec check script can read, are marked with an asterisk.

| No. | Type | Products |
|---|---|---|
| 1 | CRM and sales | Salesforce Sales Cloud*, HubSpot Sales Hub*, Microsoft Dynamics 365 Sales*, Pipedrive*, Zoho CRM |
| 2 | Helpdesk and customer service | Zendesk*, Freshdesk*, ServiceNow*, Intercom*, HubSpot Service Hub*, Jira Service Management* |
| 3 | Field service and jobs | ServiceTitan, Jobber*, Simpro, BigChange, Salesforce Field Service, Microsoft Dynamics 365 Field Service* |
| 4 | Ordering and inventory | NetSuite*, SAP Business One, Unleashed*, Cin7, Brightpearl, Shopify* (orders and stock) |
| 5 | Customer, supplier or partner portal | Salesforce Experience Cloud*, Zendesk Guide*, Liferay, Microsoft Power Pages, Magentrix, plus the portal modules of types 1 to 4 |
| 6 | Quoting and configure to order | Salesforce CPQ*, DealHub, PandaDoc*, Proposify*, Configure One, Infor CPQ |
| 7 | Case and claims management | Salesforce Service Cloud cases*, ServiceNow*, Pega*, Appian, Civica, Guidewire ClaimCenter |

Second release, in no fixed order: bookings and scheduling, HR and people, finance and invoicing, project and work tracking, inspections and compliance, logistics and deliveries, onboarding and applications, asset and property management, e-commerce storefront, membership and subscriptions, learning and courses, intranet and knowledge, events.

Spreadsheets and databases (Excel, Google Sheets, Access, Airtable, SharePoint) are not a type. They stay as a "what do you use today" answer that marks every baseline requirement as not covered.

A product that belongs to more than one type (Salesforce, ServiceNow, HubSpot) gets one entry per type it is marked against.

Products per type: four to six, the ones prospects name. Prefer products that publish a public API specification, because those can be checked by script. The sales type is the worked example.

## The requirement standard

A requirement is one sentence a prospect recognises as their own problem and a developer can turn into a screen or a rule. It sits one level below the module. Tests for the level:

- Too coarse if it names a module: "Reporting." "Pipeline management."
- Right if it names a behaviour with its edges: "Sequences: a timed series of emails and tasks that stops when the person replies."
- Too fine if it is testable on its own: "A reply cancels the remaining steps within one minute." That is an acceptance criterion for stage 2.

Rules for every requirement:

- One sentence, plain English, British spelling, no em or en dashes, no product names, no hype words.
- Starts with the thing, not with "The system shall".
- No "and" joining two behaviours that could be wanted separately. Split them.
- Groups of four to eight requirements; eight to twelve groups per type.
- Ids are a group letter and a number (R3, E4) and never change once published; a retired requirement keeps its id with a retired flag.

Per requirement fields:

| Field | Values | Meaning |
|---|---|---|
| id | letter and number | Stable key |
| group | text | The heading |
| requirement | sentence | The sentence the client sees |
| baseline | yes or no | Every product in the category covers it fully. It is what the category has in common, not a count or a threshold; a replacement must match it and suggest ticks it by default. A product too narrow to share the common core is left out of the category |
| size | S, M or L | Build effort: S up to 2 days, M 3 to 5 days, L 6 to 10 days, for a competent team building it properly once. Larger pieces are split into requirements |
| key | catalogue capability key | The existing 40 capability keys in catalogue.ts become the group keys, so the Must count, Notion and the prototype planner need no change |

The size scale is the one input the price band depends on. The letters stay on the requirements if the days change.

## Product entries

Per product header:

- Name, vendor, tiers as sold, which tier the marks assume.
- Data location options and whether UK or EU hosting is standard.
- API: public spec available yes or no, webhooks yes or no, rate limits if published.
- The two or three reasons people usually leave it, in one sentence each, with no opinion words.

Per requirement:

| Field | Values |
|---|---|
| mark | F covered in the assumed tier, P partly or only on a higher tier or add-on, N not covered |
| tier | When the vendor publishes it: Free, Starter, Professional, Enterprise. Replaces P with something precise |
| comment | Only when the mark needs qualifying. One sentence. Target under 20 comments per product |
| evidence | Endpoint, documentation page or "product knowledge". Required for every F and N |

## The drafting method

Per type:

1. **Draft the requirements.** One model call with the public feature and documentation pages of three or four leading products of the type, asking for grouped requirements to the standard above. Output to the type's markdown file. About an hour including the fetch.
2. **Correct the requirements.** Summit reads the list for level, gaps and wording. Requirements move between groups, split or merge. Target 20 to 40 minutes per type. This is the review that matters most; marks are cheaper to fix than requirements.
3. **Draft the product entries.** For each product, a model call with the corrected requirements and the product's documentation, returning a mark and evidence per requirement. Where the product publishes an API specification, the spec check script runs first and its findings go into the call as evidence.
4. **Spec check.** `scripts/catalogue-spec-check.ts` pulls the public specification, lists resources and operations, and reports the requirements whose mark the specification supports or contradicts. Presence of an endpoint supports F. Absence is a prompt to check documentation, never proof of N.
5. **Correct the marks.** Summit spot checks, with attention to P marks and anything the spec check flagged. Ten minutes per product.
6. **Publish.** Set published on the file header. The loader tests run.

Sources, in order of trust: the product's public API specification or index; its documentation; its pricing page for tiers; its feature pages last. Review sites are not sources.

## Execution

This spec describes the standard; it runs nothing. Producing the catalogue needs three scripts and the loader, built by the rig as round 1B of the two stage plan, then run per type with two Summit review passes between them.

| Script | Input | Output |
|---|---|---|
| scripts/catalogue-draft.ts | type name, three or four documentation URLs | the type file with grouped requirements, baseline flags and sizes, unpublished |
| scripts/catalogue-spec-check.ts | product name, public specification URL | a report of requirements the specification supports or contradicts, with the endpoints |
| scripts/catalogue-mark.ts | type file, product name, documentation URLs, spec check report | the product's coverage column, header and evidence notes written into the type file |

All model calls go through app/lib/llm.ts under a new routing key, catalogue, settable in /admin/models like the others, with cost recorded. The scripts read and write only docs/catalogue/*.md. The loader and its tests are the acceptance gate: a file the loader rejects is not published.

Per type the run is: draft, Summit corrects the requirements, spec check and mark for each product, Summit spot checks the marks, published set to true, loader tests pass. The scripts are first run over the sales file, which must come out unchanged.

## Storage

First release: one markdown file per type at `docs/catalogue/{type}.md`, in the shape of the sales file, with a header block:

```
type: sales
title: CRM and sales
keys: contacts, pipeline, quotes, emailtrack, campaigns, forecast, reports, tasks
published: true
```

Then the groups and requirements table, then one coverage table with a column per product, then the product headers, then the evidence notes. The loader parses the tables; a test walks every file for ids, fields, the dash rule and the size values.

Move to Notion when the requirements have stopped changing and the edits are product marks: a Requirements database and a Coverage database, Published rows only, read server side and cached, the same pattern as the Tool Rubrics. The loader exposes one interface so the move changes nothing above it.

## Refresh

Quarterly: re-run the spec check for every product with a public specification, diff against the stored marks, and put the changes to Summit as a list to accept or reject. New products are added when a prospect names one that is missing, as a product entry only; the type's requirements do not change for one product. Requirements are added when a project finds a gap, with a new id at the end of the group.

## Handover to the code rounds

- Round 1B needs the sales file in the shape above, with sizes, and a second type file so the loader is tested on two.
- Round 1C needs the baseline flags and the product comments.
- Round 1D needs the sizes and the size scale.
- Round 1E needs a screen patterns list per type, which is a short addition to the type file: the five to eight screens every tool of that type has, each naming the requirement ids it serves.
- Stage 2 rounds need template criteria per requirement, added later and only for the types in play.

## Effort

| Piece | Effort |
|---|---|
| Spec check script, in the repo, with a test on a stored sample spec | 1 day |
| Sales type: sizes, baseline flags, header blocks, screen patterns | Half a day |
| Each further type, requirements plus four to six products | 1 day of drafting and checking, plus 30 to 50 minutes of Summit review |
| First release of seven types | About 7 working days, spread over two to three weeks around the code rounds |
| Quarterly refresh | Half a day |
