# CRM and sales: requirement catalogue

```
type: sales
title: CRM and sales
keys: contacts, pipeline, forms, chat, emailtrack, quotes, invoicing, tasks, automations, approvals, forecast, reports, campaigns, portal, tickets
published: false
```

83 requirements in 12 groups for tools that manage contacts, deals, quotes and sales activity. Each requirement is one level below the module: a behaviour a client recognises and a developer can turn into a screen or a rule.

- **Baseline** yes means every product in this category covers it fully. It is what the category has in common, so a replacement must match it and the builder ticks it by default.
- **Size** is build effort: S 1 to 2 days, M 3 to 5 days, L 6 to 10 days.
- **Key** is the capability key the requirement sits under. Connections and admin requirements have none; the builder holds them as connections and guardrails.
- **Marks**: F covered in the assumed tier, P partly or only on a higher tier or add-on, N not covered.

## Groups and requirements

### Records

| Id | Requirement | Baseline | Size | Key |
|---|---|---|---|---|
| R1 | One record per company and per person, linked, with history and notes in one place. | yes | M | contacts |
| R2 | Custom fields on any record, with types, required flags and pick lists. | yes | M | contacts |
| R3 | Duplicates found on entry and merged without losing history. | no | M | contacts |
| R4 | Record ownership and territories, with reassignment and transfer of open work. | no | M | contacts |
| R5 | Import from spreadsheets with field mapping and a preview before commit. | yes | M | contacts |
| R6 | Activity timeline on every record: calls, emails, meetings, notes, stage changes. | yes | M | contacts |
| R7 | Custom record types beyond companies, people and deals, such as sites, assets or policies, linked to the standard records. | no | L | contacts |
| R8 | Links between records: parent and child companies, and each person's role on a deal. | yes | M | contacts |
| R9 | Files and documents stored against any record. | yes | S | contacts |

### Finding and working

| Id | Requirement | Baseline | Size | Key |
|---|---|---|---|---|
| S1 | Search across every record type from one box. | yes | M | contacts |
| S2 | Saved views and filters on any list, shared with a team. | yes | M | contacts |
| S3 | Bulk edit and bulk actions on a selection of records. | yes | M | contacts |
| S4 | A daily queue of tasks, calls and follow-ups for each rep to work through. | no | M | tasks |

### Pipeline

| Id | Requirement | Baseline | Size | Key |
|---|---|---|---|---|
| P1 | Deals move through named stages on a board, with value, owner, close date and probability. | yes | M | pipeline |
| P2 | Several pipelines for different products or teams, each with its own stages. | yes | S | pipeline |
| P3 | Required fields or steps before a deal can leave a stage. | no | S | pipeline |
| P4 | Rotting or stale deal flags after a set number of idle days. | no | S | pipeline |
| P5 | Lost reasons captured on close and reportable. | yes | S | pipeline |
| P6 | Products and line items on a deal, with quantities, discounts and totals. | yes | M | quotes |
| P7 | Credit for a deal shared between more than one rep. | no | M | pipeline |
| P8 | A checklist or playbook per stage that guides the rep on what to do next. | no | M | pipeline |
| P9 | Deals in more than one currency, with rates held by date. | yes | M | pipeline |

### Leads and capture

| Id | Requirement | Baseline | Size | Key |
|---|---|---|---|---|
| L1 | Web forms that create a lead or contact and attach the page and campaign they came from. | no | M | forms |
| L2 | Lead scoring from fit and activity, with the score visible on the record. | no | M | contacts |
| L3 | Assignment rules that route new leads by territory, size or round robin. | no | M | automations |
| L4 | Lead to contact and deal conversion that keeps the history. | yes | S | contacts |
| L5 | Enrichment of company and contact details from an outside source. | no | M | contacts |
| L6 | Qualification stages for leads, with a reason recorded when one is ruled out. | no | S | contacts |
| L7 | Live chat or a chatbot on the website that captures leads into the CRM. | no | L | chat |
| L8 | Leads from advert forms on LinkedIn, Facebook or Google brought in automatically. | no | M | forms |

### Email and calls

| Id | Requirement | Baseline | Size | Key |
|---|---|---|---|---|
| E1 | Two way email sync, so emails sent from the inbox appear on the right record. | yes | L | emailtrack |
| E2 | Email sent from inside the record, with templates and merge fields. | yes | M | emailtrack |
| E3 | Open and click tracking on sent email. | no | S | emailtrack |
| E4 | Sequences: a timed series of emails and tasks that stops when the person replies. | no | L | emailtrack |
| E5 | Calls placed and recorded from the record, with outcome logged. | no | L | emailtrack |
| E6 | Meeting booking links that write the meeting to the record and the calendar. | no | M | emailtrack |
| E7 | SMS and WhatsApp conversations held from the record and logged like email. | no | L | emailtrack |
| E8 | Calls recorded and transcribed on the record, with a written summary. | no | L | emailtrack |
| E9 | Email replies drafted from the record's history for the rep to edit and send. | no | M | emailtrack |

### Meetings and dialling

| Id | Requirement | Baseline | Size | Key |
|---|---|---|---|---|
| T1 | Two way calendar sync, so meetings appear on the record and in the rep's calendar. | yes | L | emailtrack |
| T2 | Call lists worked through in order with a dialler. | no | L | emailtrack |
| T3 | A summary of the account's history, open deals and recent activity before a meeting. | no | M | emailtrack |
| T4 | Video meetings created from the record, with the link in the invitation. | no | S | emailtrack |

### Quotes and orders

| Id | Requirement | Baseline | Size | Key |
|---|---|---|---|---|
| Q1 | Quotes built from a product list with pricing, discounts and tax. | no | M | quotes |
| Q2 | Quote as a PDF or web page sent for e-signature, with status back on the deal. | no | L | quotes |
| Q3 | Approval of discounts over a threshold before a quote goes out. | no | S | quotes |
| Q4 | Order or invoice raised from a won deal, or handed to the finance system. | no | M | invoicing |
| Q5 | Subscription or renewal dates tracked, with renewal deals created automatically. | no | M | quotes |
| Q6 | Invoices and payment links raised from a deal, with payment status shown on it. | no | L | invoicing |
| Q7 | Price books: different prices by customer group, region or currency. | no | M | quotes |
| Q8 | Product options and bundles, with rules on what can be sold together. | no | L | quotes |
| Q9 | Contracts produced from templates and stored against the account with their key dates. | no | M | quotes |

### Tasks and workflow

| Id | Requirement | Baseline | Size | Key |
|---|---|---|---|---|
| W1 | Tasks with due dates, owners and reminders, linked to the record. | yes | S | tasks |
| W2 | Rules that create tasks, send emails or change fields when something happens. | yes | L | automations |
| W3 | Approval steps with a record of who approved what and when. | no | M | approvals |
| W4 | Notifications in app, by email or in Slack or Teams when a deal changes. | yes | M | automations |
| W5 | Templates for repeatable sets of tasks, such as onboarding a new customer. | no | S | tasks |

### Forecasting and reporting

| Id | Requirement | Baseline | Size | Key |
|---|---|---|---|---|
| F1 | Forecast by period, owner and stage, with weighted and committed views. | no | M | forecast |
| F2 | Quotas per rep and team, with attainment shown against them. | yes | M | forecast |
| F3 | Standard reports on activity, conversion by stage, cycle length and win rate. | yes | M | reports |
| F4 | Custom reports on any field, saved, scheduled and exported. | no | L | reports |
| F5 | Dashboards per role, with filters by team, period and territory. | yes | M | reports |
| F6 | Commission worked out from closed deals against each rep's plan. | no | L | forecast |
| F7 | Deals scored for how likely they are to close, with the reasons shown. | no | L | forecast |
| F8 | What changed in the pipeline over a period: deals added, moved, slipped and lost. | no | M | reports |

### Marketing link

| Id | Requirement | Baseline | Size | Key |
|---|---|---|---|---|
| M1 | Lists and segments built from any field or activity. | no | M | campaigns |
| M2 | Marketing emails to a segment, with opens, clicks and unsubscribes recorded. | no | L | campaigns |
| M3 | Campaign attribution: which campaign a deal came from and what it was worth. | no | M | campaigns |
| M4 | Consent and contact preferences recorded per person, with an unsubscribe honoured everywhere. | no | M | campaigns |
| M5 | Website activity of known contacts shown on their record. | no | L | campaigns |

### Customers and partners

| Id | Requirement | Baseline | Size | Key |
|---|---|---|---|---|
| C1 | A portal where customers see their quotes, orders and open requests. | no | L | portal |
| C2 | Support tickets linked to the account so sales see open issues. | no | M | tickets |
| C3 | Account plans for key customers: goals, contacts, open opportunities and risks. | no | M | contacts |
| C4 | A won deal starts onboarding: a project, tasks or a ticket created with the deal's details. | no | M | automations |
| C5 | Partners register deals and see the leads passed to them. | no | L | portal |

### Admin and platform

| Id | Requirement | Baseline | Size | Key |
|---|---|---|---|---|
| A1 | Roles and permissions down to field level, with sharing rules. | no | L | none |
| A2 | Single sign-on and two factor sign in. | no | M | none |
| A3 | Audit log of changes to records and settings. | no | M | none |
| A4 | Mobile app with offline access to records and tasks. | yes | L | none |
| A5 | Open API and webhooks for other systems to read and write records. | yes | L | none |
| A6 | Data residency choice and GDPR tools: export, erase, consent. | no | M | none |
| A7 | Teams and a reporting hierarchy, so managers see their team's records and numbers. | no | M | none |
| A8 | Full export of all data, on demand and on a schedule. | no | M | none |

### Totals

83 requirements: 12 small, 48 medium, 23 large. 26 baseline. The whole list is 294 to 494 build days; the baseline alone is 83 to 140 days.

## Screen patterns

The screens every tool of this type has, each naming the requirements it serves. The prototype planner starts from these.

| Screen | Serves |
|---|---|
| Pipeline board | P1, P2, P3, P4, P8 |
| Deal detail | P5, P6, R6, W1, Q1, Q6 |
| Company and contact record | R1, R2, R6, R7, R8, R9, C2, C3 |
| Lists, search and the daily queue | S1, S2, S3, S4 |
| Leads inbox | L1, L2, L3, L4 |
| Email, calls and sequences | E1, E2, E4, E5, E7, E8, E9, T2 |
| Quote builder | Q1, Q2, Q3, Q5, Q7, Q8 |
| Forecast and dashboards | F1, F2, F3, F5, F7, F8 |
| Settings: fields, roles, rules | R2, A1, W2, W3 |

## Product coverage

| Id | Salesforce Sales Cloud | HubSpot Sales Hub | Microsoft Dynamics 365 Sales | Pipedrive | Zoho CRM |
|---|---|---|---|---|---|
| R1 | F | F | F | F | F |
| R2 | F | F | F | F | F |
| R3 | P | F | F | F | F |
| R4 | F | P | F | P | F |
| R5 | F | F | F | F | F |
| R6 | F | F | F | F | F |
| R7 | F | P | F | N | P |
| R8 | F | F | F | F | F |
| R9 | F | F | F | F | F |
| S1 | F | F | F | F | F |
| S2 | F | F | F | F | F |
| S3 | F | F | F | F | F |
| S4 | P | F | F | P | P |
| P1 | F | F | F | F | F |
| P2 | F | F | F | F | F |
| P3 | F | F | F | P | F |
| P4 | P | P | P | F | P |
| P5 | F | F | F | F | F |
| P6 | F | F | F | F | F |
| P7 | F | P | N | N | N |
| P8 | F | F | F | N | F |
| P9 | F | F | F | F | F |
| L1 | P | F | P | P | F |
| L2 | P | P | F | N | F |
| L3 | F | P | F | P | F |
| L4 | F | F | F | F | F |
| L5 | P | P | P | P | P |
| L6 | F | F | F | P | F |
| L7 | P | F | P | P | P |
| L8 | P | F | P | N | P |
| E1 | F | F | F | F | F |
| E2 | F | F | F | F | F |
| E3 | P | F | F | F | F |
| E4 | P | F | P | P | F |
| E5 | P | F | P | F | P |
| E6 | P | F | P | F | F |
| E7 | P | P | P | P | P |
| E8 | P | F | P | P | P |
| E9 | P | F | F | F | P |
| T1 | F | F | F | F | F |
| T2 | P | P | P | P | P |
| T3 | P | F | F | P | P |
| T4 | P | F | F | F | F |
| Q1 | F | F | F | P | F |
| Q2 | P | F | P | P | F |
| Q3 | F | P | F | N | F |
| Q4 | P | F | F | P | F |
| Q5 | P | P | P | P | F |
| Q6 | P | F | P | N | P |
| Q7 | F | P | F | N | F |
| Q8 | P | P | P | N | F |
| Q9 | F | P | P | P | P |
| W1 | F | F | F | F | F |
| W2 | F | F | F | F | F |
| W3 | F | F | F | N | F |
| W4 | F | F | F | F | F |
| W5 | F | P | P | P | P |
| F1 | F | F | F | P | F |
| F2 | F | F | F | F | F |
| F3 | F | F | F | F | F |
| F4 | F | F | F | P | F |
| F5 | F | F | F | F | F |
| F6 | P | N | N | N | N |
| F7 | F | F | F | P | F |
| F8 | P | F | P | P | P |
| M1 | F | F | F | P | F |
| M2 | P | P | P | P | F |
| M3 | P | P | P | N | F |
| M4 | F | F | P | P | F |
| M5 | P | F | P | P | P |
| C1 | P | P | P | N | F |
| C2 | P | F | P | N | F |
| C3 | F | P | P | N | N |
| C4 | F | F | F | P | P |
| C5 | P | N | P | N | F |
| A1 | F | P | F | P | F |
| A2 | F | P | F | F | F |
| A3 | F | P | F | P | F |
| A4 | F | F | F | F | F |
| A5 | F | F | F | F | F |
| A6 | F | F | F | P | F |
| A7 | F | P | F | F | F |
| A8 | F | P | P | P | F |

### Comments on marks

Only where a mark needs qualifying.

| Id | Product | Comment |
|---|---|---|
| R7 | HubSpot Sales Hub | Custom objects are Enterprise only. |
| R7 | Zoho CRM | Custom modules are Enterprise only. |
| E4 | Salesforce Sales Cloud | Sequences are the Sales Engagement add-on. |
| E4 | Pipedrive | No sequence object; built from automations or the Campaigns add-on. |
| E7 | all | Through an add-on or a connected messaging provider, not in the base product. |
| E8 | Salesforce Sales Cloud | Einstein Conversation Insights add-on. |
| Q1 | Pipedrive | Products and discounts on deals, no quote object; documents come from Smart Docs templates. |
| Q2 | Salesforce Sales Cloud | E-signature needs a connected signing product. |
| Q6 | Salesforce Sales Cloud | Billing is the Revenue Cloud add-on. |
| Q6 | Zoho CRM | Invoices are in the product; payment links need Zoho Books or Invoice. |
| L1 | Pipedrive | Web forms are the LeadBooster add-on. |
| M3 | HubSpot Sales Hub | Campaign attribution needs Marketing Hub Professional. |
| A2 | HubSpot Sales Hub | Two factor in every tier; single sign-on is Enterprise. |
| P7 | HubSpot Sales Hub | Deal splits are Enterprise only. |
| Q8 | Salesforce Sales Cloud | Bundles and rules are the CPQ add-on. |
| F6 | Salesforce Sales Cloud | Commission is the Spiff add-on. |
| T2 | all | A power dialler needs an add-on or a connected calling product. |
| C5 | Salesforce Sales Cloud | Partner deal registration needs Experience Cloud. |
| L7 | Pipedrive | Chat is the LeadBooster add-on. |

## Products

| Product | Tier assumed | Public API specification | Usual reasons for leaving |
|---|---|---|---|
| Salesforce Sales Cloud | Enterprise, no add-ons | Per organisation | Cost of add-ons for sequences, calling and billing; needs an administrator. |
| HubSpot Sales Hub | Professional | Yes, with the tier each API needs | Price steps between tiers; custom objects and single sign-on only on Enterprise. |
| Microsoft Dynamics 365 Sales | Enterprise | Dataverse metadata | Complexity of setup; reliance on a partner for changes. |
| Pipedrive | Professional | Yes | No quotes, sequences or lead scoring; outgrown as process gets more complex. |
| Zoho CRM | Enterprise | Documentation by module | Interface and consistency across the suite; support. |

### HubSpot tiers

Free: records, pipelines, products, quotes, invoices, tasks, calls, meetings, forms, lists, marketing email send, imports, exports, users and webhooks. Starter: goal targets. Professional: sequences, leads, forecasts, workflows, custom channels and quote approvals. Enterprise: custom objects, deal splits, single sign-on and behavioural events.

## Evidence

From each product's public API specification. An endpoint present supports F; an endpoint absent is checked against documentation before a mark of N.

| Id | Product | Evidence |
|---|---|---|
| L1 | Pipedrive | No web form endpoint; forms are the LeadBooster add-on. |
| L2 | Pipedrive | No scoring field or endpoint; leads carry labels and sources only. |
| E4 | Pipedrive | No sequence endpoint; email sequences come through automations or the Campaigns add-on. |
| Q1 | Pipedrive | Products, discounts and installments on deals, but no quote object; Smart Docs builds documents from templates on Professional and above. |
| P3 | HubSpot Sales Hub | Pipelines API with stage properties; Pipeline Governance API. Required stage properties are in every tier. |
| Q4 | HubSpot Sales Hub | Invoices, Orders, Payments and Payment Links APIs, free tier. |
| W3 | HubSpot Sales Hub | Quote approvals are part of Sales Hub Professional. |
| F1 | HubSpot Sales Hub | Forecasts and Forecast Types APIs, Sales Hub Professional. |
| F2 | HubSpot Sales Hub | Goal Targets API, Sales Hub Starter and above. |
| M3 | HubSpot Sales Hub | Campaigns API needs Marketing Hub Professional, not Sales Hub. |
| A2 | HubSpot Sales Hub | Two factor is free; single sign-on is Enterprise. |

Sources: Pipedrive OpenAPI v1 and v2 (developers.pipedrive.com), HubSpot public API index (api.hubspot.com/public/api/spec/v1/specs). Marks for Salesforce, Dynamics 365 and Zoho CRM rest on product documentation.
