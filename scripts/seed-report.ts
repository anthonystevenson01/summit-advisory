/**
 * Seeds a draft prospect report from a stored Built to Scale? composite run.
 *
 *   npm run seed-report -- {runId} [--gradeshow]
 *
 * Without the flag the report is keyed under the placeholder slug for the
 * run (`draft-` plus the run id's last 8 characters) with the run's rows
 * copied and the three sections as placeholders. With `--gradeshow` the
 * spec's worked example is applied: company "Gradeshow", slug `gradeshow`,
 * grades Pain 3, Route to buyer 2, Unit of value 1, Value evidence 2,
 * Ability to protect 2 (total 10, "A good idea with an engine still to
 * build"), each original comment kept for Anthony to rewrite in the editor.
 *
 * Idempotent: a second run with an existing slug reports and exits 0 with
 * nothing changed, so the script can sit in a deploy checklist and be run
 * on the preview and then in production without ever overwriting the edits
 * Anthony has made in the editor since. The check is a read followed by the
 * store's HSETNX claim, so two concurrent runs cannot both create. No model
 * call and no event: the seed is an operator action, logged to stdout.
 *
 * Exit codes:
 *   0  created, or already exists
 *   1  the run was not found or is not a composite, or Redis failed
 *   2  usage or configuration missing (the message names the variables)
 *
 * Runs under Node's type stripping with .env.local loaded by the npm script.
 * The store and the run reader are imported after the configuration check,
 * as calibrate.ts does, so a missing variable never constructs a client.
 * Never prints a secret.
 */
import { gradeshowEdits, mergeRows, placeholderSlugFor, recomputeTotal, todayIso, PLACEHOLDER_TEXT } from "../app/lib/tools/report-model.ts";

const RUN_ID_PATTERN = /^run_[0-9a-f]{16}$/;

function usage(): void {
  console.error("Usage: npm run seed-report -- {runId} [--gradeshow]");
}

function missingEnv(): string[] {
  const hasRedis =
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  return hasRedis ? [] : ["UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN"];
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const gradeshow = args.includes("--gradeshow");
  const runId = args.find((a) => !a.startsWith("--")) ?? "";
  if (!RUN_ID_PATTERN.test(runId)) {
    usage();
    return 2;
  }
  const missing = missingEnv();
  if (missing.length > 0) {
    console.error(`Cannot seed: missing ${missing.join(", ")}. Set them in .env.local.`);
    return 2;
  }

  // Imported here so the configuration check above never constructs a client.
  const { getCompositeRun } = await import("../app/lib/runs.ts");
  const { createReport, getReport, persistRunForReport, SlugTakenError } = await import("../app/lib/reports.ts");

  const run = await getCompositeRun(runId);
  if (!run) {
    console.error(`Run ${runId} not found or not a composite.`);
    return 1;
  }

  const originals = run.rows.map((r) => ({ key: r.key, grade: r.grade, comment: r.comment }));
  let slug = placeholderSlugFor(runId);
  let company = "";
  let rows = mergeRows(originals);
  if (gradeshow) {
    const edits = gradeshowEdits(originals);
    slug = edits.slug;
    company = edits.company;
    rows = mergeRows(originals, edits.edits);
  }

  if (await getReport(slug)) {
    console.log(`Report ${slug} already exists at /admin/reports/${slug}; nothing changed.`);
    return 0;
  }

  try {
    await createReport({
      slug,
      company,
      runId,
      asOf: todayIso(),
      rows,
      opening: PLACEHOLDER_TEXT,
      productThoughts: PLACEHOLDER_TEXT,
      moonshot: PLACEHOLDER_TEXT,
    });
  } catch (err) {
    if (err instanceof SlugTakenError) {
      console.log(`Report ${slug} already exists at /admin/reports/${slug}; nothing changed.`);
      return 0;
    }
    throw err;
  }
  try {
    await persistRunForReport(runId, Object.values(run.children));
  } catch (err) {
    console.error(`Persist failed for ${runId} (the report still exists): ${err instanceof Error ? err.message : String(err)}`);
  }

  const { total, band } = recomputeTotal(rows);
  console.log(`Created draft report ${slug} from ${runId}. Edit it at /admin/reports/${slug}`);
  if (gradeshow) console.log(`Gradeshow edits applied: total ${total}, ${band}.`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
