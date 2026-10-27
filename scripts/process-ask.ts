/**
 * Processes one Ask Summit request locally, the same six stages the QStash
 * route runs minus the signature check:
 *
 *   npm run process-ask -- {requestId}
 *
 * For a machine QStash cannot reach, and the fallback when QSTASH_TOKEN is
 * unset and the request sits in the queue with "needs Process now".
 *
 * Exit codes:
 *   0  the request reached `done`
 *   1  the request failed at a stage, or the lock was held
 *   2  usage, or configuration missing (the message names the variables)
 *
 * Runs under Node's type stripping with .env.local loaded by the npm
 * script. The store and the stages are imported after the configuration
 * check, as calibrate.ts does. Never prints a secret.
 */

const REQUEST_ID_PATTERN = /^ask_[0-9a-f]{16}$/;
const REQUIRED_ENV = ["OPENROUTER_API_KEY", "NOTION_TOKEN", "NOTION_RUBRICS_DB_ID"] as const;

function missingEnv(): string[] {
  const missing: string[] = REQUIRED_ENV.filter((name) => !process.env[name]);
  const hasRedis =
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  if (!hasRedis) missing.push("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN");
  return missing;
}

async function main(): Promise<number> {
  const requestId = process.argv[2] ?? "";
  if (!REQUEST_ID_PATTERN.test(requestId)) {
    console.error("Usage: npm run process-ask -- {requestId}");
    return 2;
  }
  const missing = missingEnv();
  if (missing.length > 0) {
    console.error(`Cannot process ${requestId}: missing ${missing.join(", ")}. Set them in .env.local.`);
    return 2;
  }

  const { claimProcessing, getAskRequest, releaseProcessing } = await import("../app/lib/ask-summit/store.ts");
  const { processRequest } = await import("../app/lib/ask-summit/process.ts");

  const record = await getAskRequest(requestId);
  if (!record) {
    console.error(`Request ${requestId} was not found.`);
    return 1;
  }
  if (record.state === "done") {
    console.log(`Request ${requestId} is already done (run ${record.runId ?? "none"}, report ${record.reportSlug ?? "none"}). Nothing changed.`);
    return 0;
  }
  if (!(await claimProcessing(requestId))) {
    console.error(`Request ${requestId} is locked or already processing.`);
    return 1;
  }

  const origin = process.env.SITE_ORIGIN?.trim() || "http://127.0.0.1:3000";
  console.log(`Processing ${requestId} for ${record.host} (${record.files.length} files), origin ${origin}`);
  try {
    const outcome = await processRequest(requestId, { origin, startedAt: Date.now() });
    const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
    console.log(
      [
        `State: ${outcome.state}`,
        outcome.failedStage ? `Failed at: ${outcome.failedStage} (${outcome.failedMessage ?? ""})` : null,
        `Run: ${outcome.runId ?? "none"}`,
        `Report: ${outcome.reportSlug ? `${origin}/admin/reports/${outcome.reportSlug}` : "none"}`,
        `Timings: crawl ${seconds(outcome.timings.crawl)}, documents ${seconds(outcome.timings.documents)}, extraction ${seconds(outcome.timings.extraction)}, scoring ${seconds(outcome.timings.scoring)}, report ${seconds(outcome.timings.report)}, total ${seconds(outcome.timings.total)}`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    return outcome.state === "done" ? 0 : 1;
  } finally {
    await releaseProcessing(requestId);
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
