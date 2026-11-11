# Review record: Project Builder round 1B, requirement catalogue loader and scripts

VERDICT: APPROVE

Branch `anthonystevenson0/catalogue-loader-and-scripts`. Two review loops: loop 1 rejected, loop 2 approved. No blocking issue remains. The Reviewer made no change to the repository in either loop.

## Loop 1: REJECT (one blocking issue)

The code met criteria 1 to 12 and every constraint, but eleven tests pinned the current content of `docs/catalogue/sales.md` and `ordering.md` (counts, particular ids and texts, comment and evidence row counts, pending product names, "ordering has no marks"). In a temp copy, every one of these valid edits, each followed by a successful `catalogue:build`, turned `npm test` red:

| Routine edit | Tests failing in loop 1 |
|---|---|
| Mark the first ordering product | 6 |
| Add one requirement to sales | 3 |
| Add one evidence row to sales | 2 |
| Change one mark in sales | 2 |
| Add a screen pattern to ordering | 2 |
| A year in any text (for example "version 2026-03") | 2 |
| Re-mark a product with its stored marks | 1 |

The tooling's own next step (marking ordering) would have broken a quality gate. Fourteen non-blocking notes (N1 to N14) were also raised; nine were fixed in the remediation pass and five were left as follow ups.

## Loop 2: what was verified

### Gates (run by the Reviewer, Node v25.9.0)

```
npm test               tests 767  suites 214  pass 767  fail 0  skipped 0   exit 0
npm run lint           eslint                                                 exit 0 (no warnings)
npx tsc --noEmit       (no output)                                            exit 0
npm run build          Compiled successfully                                  exit 0
npm run catalogue:build
  ordering: 66 requirements in 10 groups, 26 baseline, 0 products marked, 6 still to mark, not published.
  sales: 83 requirements in 12 groups, 26 baseline, 5 products marked, 0 still to mark, not published.
  app/lib/project-builder/tool-catalogue.generated.ts is already in step.     exit 0
  generated module checksum equal before and after
```

### The blocking issue is closed

In a fresh temp copy (no secrets copied), the whole suite was run after each edit and rebuild. Every one stayed green:

- First ordering product through `catalogue:mark --answer`.
- All six ordering products marked in turn, so the last one recomputes the baseline.
- One requirement added to sales; one evidence row added; one mark changed; one requirement reworded.
- A screen pattern added to ordering; a pending name removed from ordering.
- A year added to the sales Sources line.
- HubSpot re-marked with its stored marks.

Controls still fail as they should: a sales edit with no rebuild fails "every category file builds, and the committed module is exactly what the build writes", and a stale generated module fails the same test.

Content pins remaining in the five catalogue test files: only that `sales.md` and `ordering.md` exist and sort in that order. That is sound; removing a category would be deliberate.

### The tests were not weakened

33 regressions were planted one at a time in the temp copy. All 33 were caught. They covered:

- **Parser:** drops the last coverage column, swaps the size and key cells, drops note paragraphs, drops the sources line, ignores the pending list.
- **Serialiser:** sorts comment rows, reverses evidence rows, omits the still to mark list.
- **Size scale and validator:** wrong day figure for L; baseline rule off, or applied while products are pending; published evidence rule off; totals check off; baseline rule on "any F".
- **Read API:** next column's mark, `all` comment before the product's own, evidence from another product, unpublished category through the first door, wrong group name, inverted baseline filter, shallow freeze.
- **Generated module:** drops evidence rows, adds a date.
- **Mark merge and parser:** overwrites every column, always or never recomputes baseline, drops other products' comments, accepts F with no evidence.
- **New helpers:** content type rule, product name rule, `--allow`, `--products`.

### Catalogue file comparison

Against the files as they stood before regularising, by the Reviewer's own cell by cell comparison:

- **sales.md:** 20 lines differ. One is the legend's Key bullet (fixed wording). One is the coverage header (`Dynamics 365 Sales` to `Microsoft Dynamics 365 Sales`). Eleven comment rows and seven evidence rows differ in the Product cell only (`HubSpot` to `HubSpot Sales Hub`, `Salesforce` to `Salesforce Sales Cloud`).
- **ordering.md:** only the Products paragraph changed, to the fixed sentence plus a list of the same six names in the same order.
- No requirement, flag, size, key, pattern, product row, mark, comment sentence or evidence sentence was lost or reworded.
- Independent totals match: sales 83 (12 S, 48 M, 23 L), 26 baseline, 294 to 494 and 83 to 140 days; ordering 66 (10, 42, 14), 26 baseline, 220 to 370 and 72 to 122.
- Loop 1 fuzz of 30,000 mutated files through the parser: 0 exceptions. 300 randomised merges over the real sales data never changed an id, text, size, key, another product's column or the published flag.

### The non-blocking fixes

| Note | Result | What was checked |
|---|---|---|
| N1 | Fixed | The key count in the draft test is derived from `CAPABILITIES`. |
| N2 `--allow` | Fixed, tested | Allowed words only feed a set comparison. The notice prints before any fetch. |
| N3 product name | Fixed, tested | Checked straight after argument parsing, before the env check, any fetch and any call. |
| N4 `--products` and warning | Fixed, tested | Names go through the product name rule and the serialiser; the sole product warning prints in the dry run. |
| N7 content type | Fixed, tested | JSON, YAML and text types are read; PDF and octet-stream are refused with a message. |
| N8 byte order mark | Fixed, tested | A JSON file with the mark is read. |
| N9 freeze | Fixed, tested | The reader hands out deeply frozen data; scripts parse from markdown and are unaffected. |
| N11 | Fixed, tested | Problem code `internal`. |
| N12 | Fixed, tested | Singular and plural in the build summary. |

## Acceptance criteria

| # | Result | Evidence |
|---|---|---|
| 1 | PASS | Typed structure and named errors; fixture structure tests; never throws. |
| 2 | PASS | Every listed rule has a case in the `validateCategory` suite, including the baseline narrowing while products are pending. |
| 3 | PASS | Byte for byte round trip for every file in docs/catalogue and both fixtures. |
| 4 | PASS | `SIZE_SCALE` and `buildDays`; no day figure elsewhere. |
| 5 | PASS | Build refuses unsound files; in step test verified with both controls. |
| 6 | PASS | Exact fixture tests plus rules over every real category; unpublished categories only through the named door. |
| 7 | PASS | Three pure extractors tested on fixtures. |
| 8 | PASS | Draft prompt, schema, parser and conversion tested; refusal to overwrite without `--force`. |
| 9 | PASS | Merge tests; `--dry-run` writes nothing. |
| 10 | PASS | Key in `ROUTING_TASKS`, defaults, label and description; no model id in any new file; missing variables named, exit 2. |
| 11 | PASS | Every rejection the criterion lists has a named test; no test touches the network or a model. |
| 12 | PASS | All gates; no dependency change; existing Project Builder tests untouched. |
| 13 | n/a at review | Runbook entry, written by the Docs agent after review. |

## Constraints

All passed: nothing prospect facing touched; the `/tools/project-builder` redirect is in place; not a registry tool; no new dependencies; baseline is "F for every product" and never a count or share; the serialiser and generator write no date, draft number, review note or name; no en or em dash on any added line; British spelling; scripts write only the category file, the generated module and the git ignored cache; secrets by env only; model calls only through `callModel`.

## Follow ups (all non-blocking)

- **N5** `scripts/catalogue/spec.ts`: the YAML scanner learns its indent levels once per file; a file whose paths indent their children differently loses operations without a warning.
- **N6** `scripts/catalogue/spec.ts`: the YAML summary falls back to operationId only; JSON also uses the description's first line.
- **N10** `tool-catalogue.generated.ts`: `TOOL_CATEGORIES` can be imported directly, bypassing the published door and the freeze. Round 1C should import the read API only, with a test.
- **N13** No suite test runs the four entry scripts; exit codes, the `--force` refusal and `--dry-run` were verified by hand.
- **N14** The import guard test covers three modules, not all of `app/`.
- `scripts/catalogue/io.ts`: `application/octet-stream` and `application/yml` are refused; the remedy is to save the file and pass the local path, which the message does not yet say.
- `scripts/catalogue/draft.ts`: the forbidden words notice says to stop now, but the script goes straight on; `--allow` on a second run is the real remedy.
- A `--products` name that holds a comma cannot be given on the command line; it is added to the file by hand.
- `tool-catalogue-read.ts`: the frozen categories are typed as mutable, so a write compiles and throws at run time. A deep readonly type in round 1C would catch it at compile time.
- Three type errors in test files that no gate sees, because `tsconfig.json` excludes `__tests__`; the tests run correctly.
- Re-marking a product moves its comment and evidence rows to the end of their tables, as designed; other rows keep their order.
