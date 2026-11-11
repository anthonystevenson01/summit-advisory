/**
 * Marks one product against a category.
 *
 *   npm run catalogue:mark -- <type> "<product name>" <url> [<url> ...] [--spec <path>] [--tier "<tier>"] [--dry-run] [--answer <path>]
 *
 * Reads docs/catalogue/{type}.md (it must parse, validate and be canonical),
 * fetches one to six documentation pages (20 s and 2 MB each, 30,000
 * characters a page, 150,000 together), and makes one model call on the
 * `catalogue` routing key that returns a mark, an evidence sentence and an
 * optional comment for every requirement, plus the product's header fields.
 * `--spec` adds a spec check listing as evidence. The product's column,
 * product row, comments and evidence are written into the file through the
 * serialiser. No requirement text, no other product's column and not the
 * published flag is changed. Baseline flags are recomputed from the marks
 * only when no product is left on the still to mark list.
 *
 * `--dry-run` prints the differences from the stored marks and writes
 * nothing. The raw answer is kept in
 * .catalogue-cache/answers/mark-{type}-{product}.json, and `--answer <path>`
 * applies a saved answer with no fetch and no call, so what was reviewed is
 * what is written and the model is not paid twice.
 *
 * The product name is the one given here, never one from the model: it is
 * the key that joins the four tables, and it is checked before anything is
 * fetched. The script does not write the sources line or the notes; update
 * those by hand. When the product is the only one marked and no product is
 * still to mark, the differences end with a warning that the baseline has
 * been set from this one product alone.
 *
 * Exit codes:
 *   0  the file was written, or a dry run was printed
 *   1  the file has errors or problems, no page could be read, the call failed, or the answer or the result was rejected
 *   2  bad arguments or missing configuration (the message names the variables); nothing ran
 *
 * This script ends by setting process.exitCode, never by calling
 * process.exit: callModel does not wait for its ai:calls log entry, and an
 * exit straight after the call would lose the entry and its cost. Never
 * prints a secret.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { canonicalDifference, parseCategory, serialiseCategory, validateCategory, type ToolCategory } from "../app/lib/project-builder/tool-catalogue.ts";
import { CATALOGUE_DIR, describeFailures } from "./catalogue/build.ts";
import {
  EXIT_CONFIG,
  EXIT_FAILED,
  EXIT_OK,
  capPages,
  fetchBody,
  missingCatalogueEnv,
  pageText,
  parseScriptArgs,
  productNameProblem,
  slug,
  writeCacheFile,
  type FetchedPage,
} from "./catalogue/io.ts";
import { MARK_ARG_SPEC, MARK_USAGE, applyProductMarks, buildMarkPrompt, diffProductMarks, markSchema, parseMarkAnswer, type MarkAnswer } from "./catalogue/mark.ts";

const PAGE_LIMITS = { timeoutMs: 20_000, maxBytes: 2 * 1024 * 1024, overflow: "cut" } as const;
const PAGE_CAP = 30_000;
const PAGES_CAP = 150_000;
const SPEC_LISTING_CAP = 60_000;
const CALL_TIMEOUT_MS = 240_000;

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function main(): Promise<number> {
  const args = parseScriptArgs(process.argv.slice(2), MARK_ARG_SPEC);
  if (!args.ok) {
    console.error(args.message);
    console.error(MARK_USAGE);
    return EXIT_CONFIG;
  }
  const type = args.positionals.type;
  const productName = args.positionals["product name"];
  const nameProblem = productNameProblem(productName);
  if (nameProblem !== null) {
    console.error(nameProblem);
    console.error(MARK_USAGE);
    return EXIT_CONFIG;
  }
  const savedAnswer = args.options.answer;
  if (savedAnswer === undefined) {
    const missing = missingCatalogueEnv(process.env);
    if (missing.length > 0) {
      console.error(`Cannot mark: missing ${missing.join(", ")}. Set them in .env.local.`);
      return EXIT_CONFIG;
    }
  }

  const fileName = `${type}.md`;
  const file = `${CATALOGUE_DIR}/${fileName}`;
  const target = resolve(process.cwd(), file);
  if (!existsSync(target)) {
    console.error(`${file} does not exist. Draft the category first.`);
    return EXIT_FAILED;
  }
  const text = readFileSync(target, "utf8");
  const parsed = parseCategory(text);
  if (!parsed.ok) {
    for (const line of describeFailures([{ file: fileName, errors: parsed.errors, problems: [], difference: null }])) console.error(line);
    console.error("Fix the file and rebuild first.");
    return EXIT_FAILED;
  }
  const category: ToolCategory = parsed.category;
  const problems = validateCategory(category, { fileName, stated: parsed.stated });
  const difference = canonicalDifference(text, category);
  if (problems.length > 0 || difference) {
    for (const line of describeFailures([{ file: fileName, errors: [], problems, difference }])) console.error(line);
    console.error("Fix the file and rebuild first.");
    return EXIT_FAILED;
  }
  const ids = category.groups.flatMap((group) => group.requirements.map((requirement) => requirement.id));

  let answer: MarkAnswer;
  let answerPath: string;
  if (savedAnswer !== undefined) {
    answerPath = savedAnswer;
    try {
      answer = parseMarkAnswer(JSON.parse(readFileSync(resolve(process.cwd(), savedAnswer), "utf8")), ids);
    } catch (err) {
      console.error(`${savedAnswer}: ${messageOf(err)}`);
      return EXIT_FAILED;
    }
  } else {
    const pages: FetchedPage[] = [];
    for (const url of args.rest) {
      try {
        const pageBody = pageText(await fetchBody(url, PAGE_LIMITS), PAGE_CAP);
        if (pageBody === "") console.error(`Skipped ${url}: it came back with no text.`);
        else pages.push({ url, text: pageBody });
      } catch (err) {
        console.error(`Skipped ${url}: ${messageOf(err)}`);
      }
    }
    if (pages.length === 0) {
      console.error("No documentation page could be read.");
      return EXIT_FAILED;
    }
    let specListing: string | null = null;
    if (args.options.spec !== undefined) {
      try {
        specListing = readFileSync(resolve(process.cwd(), args.options.spec), "utf8").slice(0, SPEC_LISTING_CAP);
      } catch (err) {
        console.error(`Could not read the spec listing ${args.options.spec}: ${messageOf(err)}`);
        return EXIT_FAILED;
      }
    }

    const { callModel } = await import("../app/lib/llm.ts");
    const prompt = buildMarkPrompt({
      category,
      productName,
      tier: args.options.tier ?? null,
      stored: category.products.find((product) => product.name === productName) ?? null,
      pages: capPages(pages, PAGES_CAP),
      specListing,
    });
    const answerFile = `answers/mark-${type}-${slug(productName)}.json`;
    let raw: unknown;
    let answered = false;
    try {
      const result = await callModel({
        routingKey: "catalogue",
        runId: `catalogue_mark_${type}`,
        system: prompt.system,
        user: prompt.user,
        schema: markSchema(ids),
        parse: (value) => {
          raw = value;
          answered = true;
          return parseMarkAnswer(value, ids);
        },
        temperature: 0,
        timeoutMs: CALL_TIMEOUT_MS,
        tag: `mark:${slug(productName)}`,
      });
      answer = result.data;
    } catch (err) {
      console.error(messageOf(err));
      if (answered) console.error(`The raw answer is in ${writeCacheFile(answerFile, `${JSON.stringify(raw, null, 2)}\n`)}. Nothing was written to ${CATALOGUE_DIR}.`);
      return EXIT_FAILED;
    }
    answerPath = writeCacheFile(answerFile, `${JSON.stringify(raw, null, 2)}\n`);
  }

  let next: ToolCategory;
  try {
    next = applyProductMarks(category, productName, answer);
  } catch (err) {
    console.error(messageOf(err));
    return EXIT_FAILED;
  }
  const nextProblems = validateCategory(next, { fileName });
  if (nextProblems.length > 0) {
    for (const line of describeFailures([{ file: fileName, errors: [], problems: nextProblems, difference: null }])) console.error(line);
    console.error(`Nothing was written to ${CATALOGUE_DIR}. The answer is in ${answerPath}.`);
    return EXIT_FAILED;
  }

  for (const line of diffProductMarks(category, next, productName)) console.log(line);
  const wasNamed = category.pendingProducts.includes(productName) || category.products.some((product) => product.name === productName);
  if (!wasNamed && category.pendingProducts.length > 0) {
    console.log(
      `Note: "${productName}" was not on the still to mark list (${category.pendingProducts.join(", ")}). ` +
        "If it is one of those under another spelling, pass the name as it is written there or tidy the list by hand.",
    );
  }

  if (args.switches["dry-run"]) {
    console.log(`Dry run: nothing was written. The answer is in ${answerPath}; apply it with --answer ${answerPath}.`);
    return EXIT_OK;
  }
  writeFileSync(target, serialiseCategory(next), "utf8");
  console.log(`Wrote ${file}. The answer is in ${answerPath}.`);
  console.log("Next: update the Sources line by hand if these sources are new, check any comment for all products still holds, then run npm run catalogue:build.");
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
