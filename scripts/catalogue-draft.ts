/**
 * Drafts a category's requirement list from documentation pages.
 *
 *   npm run catalogue:draft -- <type> "<title>" <url> <url> <url> [<url>] [--products "<name>,<name>"] [--allow <word>,<word>] [--force]
 *
 * Fetches three or four documentation pages as text (20 s and 2 MB each,
 * 30,000 characters a page, 120,000 together), makes one model call on the
 * `catalogue` routing key with a JSON schema answer, holds the answer to the
 * requirement standard, and writes docs/catalogue/{type}.md with
 * `published: false` through the serialiser. It refuses to overwrite an
 * existing file unless `--force` is given, and it writes nothing when the
 * parser or the validator finds a problem. The raw answer is kept in
 * .catalogue-cache/answers/draft-{type}.json either way.
 *
 * `--products` names the products the category will be marked against;
 * they are written as the still to mark list, so the baseline is not judged
 * until every one of them is marked. `--allow` takes ordinary words off the
 * list of names a requirement may not hold, which is built from the
 * documentation hosts and printed before the call.
 *
 * There is one call per run and no retry: a rejected answer lists every
 * violation, so the second run is informed.
 *
 * Exit codes:
 *   0  the file was written
 *   1  the file exists, a page could not be read, the call failed, or the answer or the category was rejected
 *   2  bad arguments or missing configuration (the message names the variables); nothing ran
 *
 * This script ends by setting process.exitCode, never by calling
 * process.exit: callModel does not wait for its ai:calls log entry, and an
 * exit straight after the call would lose the entry and its cost. Never
 * prints a secret.
 */
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeTotals, hasLongDash, serialiseCategory, validateCategory } from "../app/lib/project-builder/tool-catalogue.ts";
import { CATALOGUE_DIR } from "./catalogue/build.ts";
import {
  DRAFT_ARG_SPEC,
  DRAFT_USAGE,
  buildDraftPrompt,
  draftSchema,
  draftToCategory,
  draftWarnings,
  forbiddenNamesFromUrls,
  forbiddenNamesNotice,
  parseDraftAnswer,
  parseProductList,
  pendingProductsNotice,
  type DraftAnswer,
} from "./catalogue/draft.ts";
import {
  EXIT_CONFIG,
  EXIT_FAILED,
  EXIT_OK,
  capPages,
  fetchBody,
  missingCatalogueEnv,
  pageText,
  parseScriptArgs,
  splitList,
  writeCacheFile,
  type FetchedPage,
} from "./catalogue/io.ts";

const PAGE_LIMITS = { timeoutMs: 20_000, maxBytes: 2 * 1024 * 1024, overflow: "cut" } as const;
const PAGE_CAP = 30_000;
const PAGES_CAP = 120_000;
const CALL_TIMEOUT_MS = 240_000;

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function main(): Promise<number> {
  const args = parseScriptArgs(process.argv.slice(2), DRAFT_ARG_SPEC);
  if (!args.ok) {
    console.error(args.message);
    console.error(DRAFT_USAGE);
    return EXIT_CONFIG;
  }
  const type = args.positionals.type;
  const title = args.positionals.title.trim();
  if (hasLongDash(title) || /[\r\n]/.test(title)) {
    console.error("The title must be one line with no en or em dash.");
    console.error(DRAFT_USAGE);
    return EXIT_CONFIG;
  }
  const products = parseProductList(args.options.products);
  if (!products.ok) {
    console.error(products.message);
    console.error(DRAFT_USAGE);
    return EXIT_CONFIG;
  }
  const missing = missingCatalogueEnv(process.env);
  if (missing.length > 0) {
    console.error(`Cannot draft: missing ${missing.join(", ")}. Set them in .env.local.`);
    return EXIT_CONFIG;
  }

  const file = `${CATALOGUE_DIR}/${type}.md`;
  const target = resolve(process.cwd(), file);
  if (existsSync(target) && !args.switches.force) {
    console.error(`${file} exists. Pass --force to overwrite it.`);
    return EXIT_FAILED;
  }

  const forbiddenNames = forbiddenNamesFromUrls(args.rest, splitList(args.options.allow));
  console.log(forbiddenNamesNotice(forbiddenNames));
  console.log(pendingProductsNotice(products.names));

  const pages: FetchedPage[] = [];
  for (const url of args.rest) {
    let html: string;
    try {
      html = await fetchBody(url, PAGE_LIMITS);
    } catch (err) {
      console.error(`Could not read ${url}: ${messageOf(err)}`);
      return EXIT_FAILED;
    }
    const text = pageText(html, PAGE_CAP);
    if (text === "") {
      console.error(`${url} came back with no text.`);
      return EXIT_FAILED;
    }
    pages.push({ url, text });
  }

  const { callModel } = await import("../app/lib/llm.ts");
  const prompt = buildDraftPrompt({ type, title, pages: capPages(pages, PAGES_CAP) });
  const answerFile = `answers/draft-${type}.json`;
  let raw: unknown;
  let answered = false;
  let answer: DraftAnswer;
  try {
    const result = await callModel({
      routingKey: "catalogue",
      runId: `catalogue_draft_${type}`,
      system: prompt.system,
      user: prompt.user,
      schema: draftSchema(),
      parse: (value) => {
        raw = value;
        answered = true;
        return parseDraftAnswer(value, { forbiddenNames });
      },
      temperature: 0,
      timeoutMs: CALL_TIMEOUT_MS,
      tag: "draft",
    });
    answer = result.data;
  } catch (err) {
    console.error(messageOf(err));
    if (answered) console.error(`The raw answer is in ${writeCacheFile(answerFile, `${JSON.stringify(raw, null, 2)}\n`)}. Nothing was written to ${CATALOGUE_DIR}.`);
    return EXIT_FAILED;
  }
  const answerPath = writeCacheFile(answerFile, `${JSON.stringify(raw, null, 2)}\n`);

  const category = draftToCategory({ type, title, products: products.names }, answer);
  const problems = validateCategory(category, { fileName: `${type}.md` });
  if (problems.length > 0) {
    for (const problem of problems) console.error(`${type}.md: [${problem.code}] ${problem.where}: ${problem.message}`);
    console.error(`Nothing was written to ${CATALOGUE_DIR}. The raw answer is in ${answerPath}.`);
    return EXIT_FAILED;
  }

  writeFileSync(target, serialiseCategory(category), "utf8");
  const totals = computeTotals(category);
  console.log(`Wrote ${file}: ${totals.requirements} requirements in ${totals.groups} groups, ${totals.baseline} flagged baseline as a first guess, not published.`);
  for (const warning of draftWarnings(answer)) console.log(`Note: ${warning}`);
  console.log(`The raw answer is in ${answerPath}.`);
  console.log("Next: review the file for level, gaps and wording, then run npm run catalogue:build.");
  return EXIT_OK;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error(messageOf(err));
    process.exitCode = EXIT_FAILED;
  });
