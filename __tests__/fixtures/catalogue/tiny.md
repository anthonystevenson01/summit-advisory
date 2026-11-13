# Tiny tools: requirement catalogue

```
type: tiny
title: Tiny tools
keys: contacts, tasks
published: true
```

5 requirements in 2 groups for tools that exist only to test the catalogue format. Each requirement is one level below the module: a behaviour a client recognises and a developer can turn into a screen or a rule.

- **Baseline** yes means every product in this category covers it fully. It is what the category has in common, so a replacement must match it and the builder ticks it by default.
- **Size** is build effort: S 1 to 2 days, M 3 to 5 days, L 6 to 10 days.
- **Key** is the capability key the requirement sits under. Connections and admin requirements have none; the builder holds them as connections and guardrails.
- **Marks**: F covered in the assumed tier, P partly or only on a higher tier or add-on, N not covered.

## Groups and requirements

### Alpha records

| Id | Requirement | Baseline | Size | Key |
|---|---|---|---|---|
| A1 | One record per customer, with notes in one place. | yes | S | contacts |
| A2 | Custom fields on a record, with types and pick lists. | no | M | contacts |
| A3 | Import from a spreadsheet with a preview before commit. | no | L | contacts |

### Beta work

| Id | Requirement | Baseline | Size | Key |
|---|---|---|---|---|
| B1 | Tasks with due dates and owners, linked to a record. | yes | M | tasks |
| B2 | Single sign-on for every user. | no | M | none |

### Totals

5 requirements: 1 small, 3 medium, 1 large. 2 baseline. The whole list is 16 to 27 build days; the baseline alone is 4 to 7 days.

## Screen patterns

The screens every tool of this type has, each naming the requirements it serves. The prototype planner starts from these.

| Screen | Serves |
|---|---|
| Customer record | A1, A2 |
| Task list | B1 |

## Product coverage

| Id | Acme Desk | Borealis Suite |
|---|---|---|
| A1 | F | F |
| A2 | F | P |
| A3 | N | P |
| B1 | F | F |
| B2 | P | N |

### Comments on marks

Only where a mark needs qualifying.

| Id | Product | Comment |
|---|---|---|
| A2 | Borealis Suite | Pick lists need the higher tier. |
| A3 | all | Neither product shows a preview before commit. |

## Products

| Product | Tier assumed | Public API specification | Usual reasons for leaving |
|---|---|---|---|
| Acme Desk | Standard | Yes | Price steps between tiers; no import tool. |
| Borealis Suite | Team | Documentation only | Slow support; single sign-on missing. |

### Acme tiers

Standard: records, fields and tasks. Plus: single sign-on and audit.

## Evidence

From each product's public API specification. An endpoint present supports F; an endpoint absent is checked against documentation before a mark of N.

| Id | Product | Evidence |
|---|---|---|
| A1 | Acme Desk | Customers endpoint with notes. |
| A1 | Borealis Suite | Accounts endpoint; notes are a sub resource. |
| A2 | Acme Desk | Field definitions endpoint with types. |
| A3 | Acme Desk | No import endpoint; the documentation offers a paid service. |
| B1 | Acme Desk | Tasks endpoint with due date and owner. |
| B1 | Borealis Suite | Tasks endpoint. |
| B2 | Borealis Suite | No single sign-on in any tier. |

Sources: Acme Desk OpenAPI (example.test), Borealis Suite documentation. Both products are invented for the tests.
