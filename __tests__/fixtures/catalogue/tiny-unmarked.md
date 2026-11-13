# Tiny unmarked tools: requirement catalogue

```
type: tiny-unmarked
title: Tiny unmarked tools
keys: contacts, tasks
published: false
```

5 requirements in 2 groups for tools that exist only to test a category before any product is marked. Each requirement is one level below the module: a behaviour a client recognises and a developer can turn into a screen or a rule.

- **Baseline** yes means every product in this category covers it fully. It is what the category has in common, so a replacement must match it and the builder ticks it by default.
- **Size** is build effort: S 1 to 2 days, M 3 to 5 days, L 6 to 10 days.
- **Key** is the capability key the requirement sits under. Connections and admin requirements have none; the builder holds them as connections and guardrails.

## Groups and requirements

### Alpha records

| Id | Requirement | Baseline | Size | Key |
|---|---|---|---|---|
| A1 | One record per customer, with notes in one place. | yes | S | contacts |
| A2 | Custom fields on a record, with types and pick lists. | yes | M | contacts |
| A3 | Import from a spreadsheet with a preview before commit. | no | L | contacts |

### Beta work

| Id | Requirement | Baseline | Size | Key |
|---|---|---|---|---|
| B1 | Tasks with due dates and owners, linked to a record. | yes | M | tasks |
| B2 | Single sign-on for every user. | no | M | none |

### Totals

5 requirements: 1 small, 3 medium, 1 large. 3 baseline. The whole list is 16 to 27 build days; the baseline alone is 7 to 12 days.

## Screen patterns

The screens every tool of this type has, each naming the requirements it serves. The prototype planner starts from these.

| Screen | Serves |
|---|---|
| Customer record | A1, A2 |
| Task list | B1 |

## Products

No product is marked yet. Coverage marks are added by the catalogue scripts.

Still to mark:

- Cobalt Flow
- Delta Works (orders, stock and returns)
