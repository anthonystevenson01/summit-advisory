# Project Builder: two stage requirements plan

## The idea in one paragraph

Stage 1 gets a prospect, on their own and in under 40 minutes, to a brief of about 60 requirements written in their own terms, a prototype built from that list, and a price band. That is enough for everyone to decide whether the project is worth doing. Stage 2 starts only when the price is agreed. It takes the agreed list and turns it into the document a development team builds from: acceptance criteria, roles, data model, integrations, non-functionals, open questions closed, and a signed version. The catalogue sits under both: in stage 1 it supplies the requirements and sizes; in stage 2 it supplies the template criteria each requirement expands into.

## What exists today, and what each stage reuses

| In place | Where | Reused by |
|---|---|---|
| Six step builder, save and resume, submit, Notion and email hand off | Release 1 | Stage 1 shell |
| 15 generic feature cards and 40 capability lines on the replace path | catalogue.ts | Replaced by the deeper catalogue; keys kept |
| Suggest per step, document read, rule fallbacks, no overwrite rule | suggest, read routes; apply.ts | Stage 1 entry points |
| Company research from the website (products, vocabulary, locations, team size) | research.ts, runs inside the prototype pipeline | Moved to step 1 so every step reads it |
| Staged prototype pipeline: research, plan, senior review, build, audit; hidden from the prospect; costs per key | Round 3 and design rules round | Pattern for the stage 2 pipeline; the planner reads the stage 1 list |
| Admin briefs, stages, model calls, costs, routing keys | /admin | Stage states and the stage 2 views |

## Stage 1: the high level brief, customised

Target output per brief: 50 to 70 requirement rows, each a catalogue requirement reworded for the client or a client specific row, with a priority, a note where the client said how it works for them, and a size. Plus the prototype and the price band.

### Round 1A: research first

Move the company research to run when the website is entered on step 1, cached on the brief. Add an industry profile catalogue (15 to 20 industries: vocabulary, usual tool types, usual compliance, usual KPIs) and have research pick one. Every later prompt reads the research block and the profile.

- Code: research call moved and cached; profile catalogue in code; prompts read both; admin shows the research on the brief.
- Content: the industry profiles, drafted by the model and corrected.
- Effort: 3 to 4 days of rig work, 1 day of content review.
- Done when: a brief created with ocado.com shows the research on admin before step 2, and the goal step suggestions use Ocado's vocabulary.

### Round 1B: the deeper catalogue, sales first

The two layer catalogue: one list per tool type (50 to 100 requirements in groups, baseline flag, size S, M or L in build days), and per known product a mark or tier per requirement with a comment where it needs one. The loader reads markdown files in the repo for now, with the same shape a Notion loader can read later.

- Code: catalogue loader and types; tests that walk every file; the existing 40 capability keys become group headings so nothing downstream changes.
- Content: sizes on the sales requirements; then helpdesk, field service, ordering and inventory, bookings, HR, finance, project tracking, with the spec check run on each product that publishes one.
- Effort: 2 to 3 days of rig work; content about 1 day per type including review, 8 types for the first release.
- Done when: the loader serves the sales type with sizes and product marks, and a second type passes the same tests.

### Round 1C: the requirements step rebuilt

The step opens by classifying the brief into one or two tool types from the idea, the goal and the research, and names the type at the top so the prospect can change it. Three ways in, side by side:

1. **Paste a list you already have.** The document read, moved onto this step for every path, producing rows marked from your document.
2. **Talk it through.** A chat that reads the whole brief, asks one question at a time, and adds rows or notes as it goes. New route, conversation stored on the brief, the no overwrite rule, a cost cap per brief.
3. **Suggest a starting point.** The model picks requirements from the type's list, rewords each in the client's terms using the research, marks Musts, and adds client specific rows; the replaced product's marks and comments feed it when a current system was named.

Every row carries a note field for "for us it works like this". The replaced system question moves onto step 1 so it is answered on every path.

- Code: classification call; step layout; chat route and storage; suggest prompt rewritten to the catalogue; row notes in state, Notion and emails; generic cards demoted to an "and also" list.
- Effort: 8 to 10 days of rig work in two or three PRs, chat last.
- Done when: the Ocado brief produces about 60 rows in Ocado's terms by suggest alone, and the chat can add a client specific row with a note.

### Round 1D: price band and brief states

Sizes on the chosen rows, plus factors for each connection, SSO, migration and mobile, give a range in build days and a price band from a configured day rate, with the assumptions listed. Brief states: drafted, sized, agreed, in detail, signed off. Admin shows the state and the band; the prospect sees the band at the end of stage 1 with its assumptions.

- Code: sizing function with tests; day rate and factors in admin; state on the brief; the band in the summary step, Notion and the emails.
- Effort: 3 to 4 days.
- Done when: two briefs with different Must lists get different bands and the assumptions explain why.

### Round 1E: the prototype reads the list

The planner starts from the type's baseline screens and the client's rows rather than inventing a plan, and the coverage map is against the 60 rows. The build gets the vocabulary from the research.

- Code: planner prompt and coverage map; catalogue screen patterns per type (content, small).
- Effort: 2 to 3 days.
- Done when: the Ocado prototype's coverage map lists catalogue row ids and the screens use Ocado's words.

Stage 1 total: about 20 to 24 days of rig work across five rounds, and content work in parallel of roughly 10 days for the first eight types and the industry profiles.

## The gate: submit for a quote

At the end of stage 1 the prospect has their requirements, their reasoning and a prototype they have played with and changed. They submit it to Summit for a quote. The brief moves to quoted when Summit sends the quote back, which the prospect sees in the tool and by email with the price band, the assumptions and what stage 2 involves. If they accept, Summit marks the brief agreed and stage 2 opens for them: a new set of steps in the same wizard, on the same resume link. Nothing in stage 2 is reachable before that. The gate is deliberately in Summit's hands because it is the point where a prospect becomes a client and discovery is usually paid.

## Stage 2: from agreed list to a document a team can build from

Stage 2 is prospect facing: the same wizard grows new steps (criteria, roles, data, connections, questions, sign off) that the client works through, with Summit able to answer and edit from admin after meetings. Target output per brief: a versioned requirements document the client signs, with 150 to 350 acceptance level requirements under the agreed rows, roles against capabilities, a data model, integration detail, non-functionals and an empty open questions list.

### Round 2A: template criteria in the catalogue

Each catalogue requirement gains four to eight template acceptance criteria. Content, drafted by the model per type and corrected, sales first. Stored beside the requirements.

- Effort: about 1 day per type for drafting and review; sales first, others as projects need them.

### Round 2B: expand

A hidden pipeline stage in the Round 3 pattern: for each agreed row, draft the criteria from the templates, the row's note, the research and the replaced product's comments. Mark what it could not settle as an open question. Store criteria on the brief with the row id they sit under.

- Code: expand stage, storage, admin view by row, cost per key.
- Effort: 4 to 5 days.

### Round 2C: ask

The chat's second mode: works through the open questions one at a time with the client, rewrites the affected criteria on each answer, and closes the question. Summit can answer on the client's behalf from admin after a meeting.

- Code: question list on the brief, chat mode, criteria rewrite with history; the questions step in the wizard.
- Effort: 4 to 5 days.

### Round 2D: roles, data and integrations

Three structured sections generated from the agreed rows and the catalogue, then edited: roles against capabilities (see, do, approve); the data model (records, fields, statuses, where existing data comes from); integration detail per connection (objects, direction, frequency, conflicts, history). Each is a page in the detail view and a section in the document.

- Code: three generators with templates per tool type, editable views, storage.
- Content: entity and integration templates per type.
- Effort: 6 to 8 days.

### Round 2E: review and sign off

The senior review stage runs over the whole document: coverage against the goal, contradictions, untestable requirements, missing roles and data. Then a versioned document with a change log, exported to Google Docs (the Release 3 export) and to Notion. The client approves a version; a later change makes a new version.

- Code: review stage prompt and findings, version store, document assembly, export, approval record.
- Effort: 5 to 6 days.

Stage 2 total: about 20 to 25 days of rig work and the template content per type as it is needed.

## Order and dependencies

1. 1A research first and 1B catalogue loader can run in parallel; both are needed by 1C.
2. 1C requirements step, with suggest and paste first and chat in its own PR.
3. 1D price band and states; 1E prototype planner. Independent of each other.
4. Submit for a quote and the quoted and agreed states in place once 1D ships; stage 2 steps appear only on agreed briefs.
5. 2A templates and 2B expand together; 2C ask; 2D roles, data, integrations; 2E review and sign off.

## Not in this plan

- Replacing the sign off meeting. The tool gets the document to the meeting; a person signs it there.
- Estimating below the price band. Fixed quotes come from the stage 2 document, not from stage 1.
- Industry profiles beyond the first 15 to 20.
