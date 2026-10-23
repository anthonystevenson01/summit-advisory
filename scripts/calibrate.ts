/**
 * Calibration gate: scores every case in calibration/{tool}/*.json against
 * the live rubric and model, compares each grade with the agreed `expected`,
 * and fails if any grade moves by more than one point.
 *
 *   npm run calibrate
 *
 * Exit codes:
 *   0  every run case passed, or nothing was runnable
 *   1  a grade moved by more than one point, or a case threw or was unreadable
 *   2  configuration missing (the message names the variables); nothing ran
 *
 * Skipped means the case was not scored and counted neither way: its input
 * still contains the "TO FILL" placeholder, its folder has no registry entry
 * (built-to-scale), or its registry entry is hidden pending its Published
 * rubric row and calibration (route-to-buyer and unit-of-value until Anthony
 * flips them). Skipped cases are still listed so a half written set is
 * visible, and a set with only skipped cases passes.
 *
 * Runs under Node's type stripping and imports the pipeline directly, no
 * HTTP. Calibration runs are not saved to the run store; they are logged to
 * ai:calls with a `cal_` run id. On a full pass the script records
 * admin:calibration for every scoring key it used. Never prints a secret.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { getTool } from "../app/lib/tools/registry.ts";
import {
  SKIP_REASON_HIDDEN,
  SKIP_REASON_NO_ENTRY,
  SKIP_REASON_TO_FILL,
  compareCase,
  formatTable,
  isCaseFillable,
  type CalibrationCase,
  type CaseResult,
} from "../app/lib/tools/calibration.ts";

const CALIBRATION_DIR = resolve(process.cwd(), "calibration");
const REQUIRED_ENV = ["OPENROUTER_API_KEY", "NOTION_TOKEN", "NOTION_RUBRICS_DB_ID"] as const;

type Runnable = { file: string; data: CalibrationCase };

function readCases(): { results: CaseResult[]; runnable: Map<string, Runnable[]> } {
  const results: CaseResult[] = [];
  const runnable = new Map<string, Runnable[]>();

  const folders = readdirSync(CALIBRATION_DIR).filter((name) => {
    if (name.startsWith("_") || name.startsWith(".")) return false;
    return statSync(join(CALIBRATION_DIR, name)).isDirectory();
  });

  for (const folder of folders.sort()) {
    const entry = getTool(folder);
    const files = readdirSync(join(CALIBRATION_DIR, folder)).filter((f) => f.endsWith(".json")).sort();

    if (!entry || entry.hidden) {
      const reason = entry ? SKIP_REASON_HIDDEN : SKIP_REASON_NO_ENTRY;
      for (const file of files) {
        results.push({ tool: folder, name: file.replace(/\.json$/, ""), file, status: "skipped", reason });
      }
      continue;
    }

    for (const file of files) {
      const path = join(CALIBRATION_DIR, folder, file);
      let data: CalibrationCase;
      try {
        data = JSON.parse(readFileSync(path, "utf8")) as CalibrationCase;
      } catch (err) {
        results.push({ tool: folder, name: file, file, status: "error", reason: `unreadable: ${err instanceof Error ? err.message : String(err)}` });
        continue;
      }
      const name = data.name || file.replace(/\.json$/, "");
      if (!isCaseFillable(data)) {
        results.push({ tool: folder, name, file, status: "skipped", reason: SKIP_REASON_TO_FILL });
        continue;
      }
      if (!data.expected || typeof data.expected.grade !== "number") {
        results.push({ tool: folder, name, file, status: "error", reason: "expected.grade is missing" });
        continue;
      }
      const list = runnable.get(folder) ?? [];
      list.push({ file, data });
      runnable.set(folder, list);
    }
  }

  return { results, runnable };
}

function missingEnv(): string[] {
  const missing: string[] = REQUIRED_ENV.filter((name) => !process.env[name]);
  const hasRedis =
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  if (!hasRedis) missing.push("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN");
  return missing;
}

function summarise(results: CaseResult[]): { run: number; skipped: number; failed: number; errored: number } {
  let run = 0;
  let skipped = 0;
  let failed = 0;
  let errored = 0;
  for (const r of results) {
    if (r.status === "skipped") skipped += 1;
    else if (r.status === "error") errored += 1;
    else {
      run += 1;
      if (!r.comparison?.pass) failed += 1;
    }
  }
  return { run, skipped, failed, errored };
}

async function main(): Promise<number> {
  const { results, runnable } = readCases();
  const toRun = [...runnable.values()].reduce((n, list) => n + list.length, 0);

  if (toRun === 0) {
    console.log(formatTable(results));
    const s = summarise(results);
    console.log(`\n${s.run} run, ${s.skipped} skipped, ${s.errored} errors. Nothing runnable; pass.`);
    return s.errored > 0 ? 1 : 0;
  }

  const missing = missingEnv();
  if (missing.length > 0) {
    console.error(`Cannot run ${toRun} case${toRun === 1 ? "" : "s"}: missing ${missing.join(", ")}. Set them in .env.local.`);
    return 2;
  }

  // Imported here so a configuration check above never constructs a client.
  const { scoreRun } = await import("../app/lib/tools/pipeline.ts");
  const { recordCalibrationPass } = await import("../app/lib/llm.ts");

  // Keys seen during the run: resolved scoring key to the model that answered.
  const seenRoutes = new Map<string, string>();
  const rubricHashes: Record<string, string> = {};

  // Tools in parallel, cases within a tool in sequence.
  await Promise.all(
    [...runnable.entries()].map(async ([tool, cases]) => {
      for (const { file, data } of cases) {
        const name = data.name || file.replace(/\.json$/, "");
        try {
          const { run } = await scoreRun(tool, data.input, { source: "calibration" });
          const comparison = compareCase(data.expected, { grade: run.grade, scores: run.scores });
          results.push({ tool, name, file, status: "run", comparison });
          seenRoutes.set(run.routes.scoring, run.models.scoring);
          rubricHashes[tool] = run.rubricHash;
        } catch (err) {
          results.push({ tool, name, file, status: "error", reason: err instanceof Error ? err.message.slice(0, 200) : String(err) });
        }
      }
    }),
  );

  results.sort((a, b) => a.tool.localeCompare(b.tool) || a.name.localeCompare(b.name));
  console.log(formatTable(results));
  const s = summarise(results);
  console.log(`\n${s.run} run, ${s.skipped} skipped, ${s.failed} failed, ${s.errored} errors.`);

  if (s.failed > 0 || s.errored > 0) {
    console.log("Calibration failed. A grade moved by more than one point or a case could not run. Nothing was recorded.");
    return 1;
  }

  for (const [key, model] of seenRoutes) {
    await recordCalibrationPass(key, { model, rubricHashes });
    console.log(`Recorded calibration pass for ${key} with ${model}.`);
  }
  console.log("Calibration passed.");
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
