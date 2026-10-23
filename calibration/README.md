# Calibration set

Known inputs with agreed grades, one JSON file per case, one folder per tool. The calibration script scores every case against the live rubric and model, compares the grade per dimension and the overall grade, and fails if any grade moves by more than one point. Run it before publishing a rubric change in Notion and before changing a model in /admin.

The set lives in the repo on purpose. Rubrics are editable at runtime; this set is what checks those edits, so it changes only through a commit.

## Adding a case

1. Copy `_template.json` into the tool's folder and name it after the company or scenario.
2. Paste the input exactly as a visitor would type it into the tool. The `input` keys are the tool's registry input keys (for example `position` and `competitors` for moat, `icp` for the ICP evaluator).
3. Agree the grade per dimension (1 to 5) and the overall grade, and record who agreed it and when.
4. Where the case is a real company, score from public information only and say so in `source`.

Aim for 10 to 15 cases per tool, spread across the grade bands. Gradeshow is the first case for every tool it touches.

## Case shape

```json
{
  "tool": "moat",
  "name": "Example Co",
  "source": "public information, October 2026",
  "agreedBy": "Anthony Stevenson",
  "agreedOn": "2026-10-23",
  "input": { "position": "...", "competitors": "..." },
  "expected": { "grade": 2, "dimensions": { "sc": 2, "pd": 2, "ne": 1, "br": 2, "sd": 3, "pr": 2 } },
  "note": "Why these grades. One or two sentences."
}
```

`expected.grade` is the overall grade 1 to 5 (the 85/70/50/30 bands of the score out of 100). `expected.dimensions` is keyed by the tool's dimension keys from `app/lib/tools/registry.ts`.

## The TO FILL convention

A case whose `input` still contains the text `TO FILL` is a placeholder. The script reports it as skipped and never scores it, so a case can be committed before its input is written. Folders for tools not yet in the registry (`built-to-scale`, `route-to-buyer`, `unit-of-value`) are reported as "no registry entry, skipped".

## Running

```bash
npm run calibrate
```

Reads `.env.local` if present. Needs `OPENROUTER_API_KEY`, `NOTION_TOKEN`, `NOTION_RUBRICS_DB_ID` and the Upstash variables when there is at least one runnable case. Calibration runs are not stored in the run store; they are logged to `ai:calls` with a `cal_` run id so spend is visible in /admin/models.

The script prints one line per case (pass, FAIL, skipped or error) and, for a run case, one indented line per dimension with the expected and actual grade. A dimension that moved by more than one point is marked `<-- moved`.

Exit codes:

- `0`: every run case passed, or nothing was runnable.
- `1`: a grade moved by more than one point, or a case threw.
- `2`: configuration missing. The message names the variables.

On a full pass with at least one case run, the script records the pass in Redis (`admin:calibration`) for every scoring routing key it used, with the model id and the rubric hash per tool. /admin/models then shows "Passed with {model} on {date}" for that row. Changing the model for `scoring`, `scoring:{tool}` or `synthesis` in /admin marks the row uncalibrated until the script passes again.
