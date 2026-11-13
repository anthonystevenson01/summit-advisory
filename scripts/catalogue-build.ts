/**
 * Builds the generated catalogue module from the markdown files.
 *
 *   npm run catalogue:build
 *
 * Reads every docs/catalogue/*.md (the folder holds category files only),
 * and writes app/lib/project-builder/tool-catalogue.generated.ts. It refuses
 * to write when any file does not parse, has a validator problem or is not
 * in the canonical form: it prints one line per item and exits 1. The file
 * is written only when its contents would change. Needs no env.
 *
 * Exit codes:
 *   0  the generated module is in step with the markdown
 *   1  a file has errors or problems; nothing was written
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { computeTotals } from "../app/lib/project-builder/tool-catalogue.ts";
import { CATALOGUE_DIR, GENERATED_MODULE_PATH, buildCatalogue, describeFailures, summaryLine } from "./catalogue/build.ts";
import { EXIT_FAILED, EXIT_OK } from "./catalogue/io.ts";

function main(): number {
  const dir = resolve(process.cwd(), CATALOGUE_DIR);
  if (!existsSync(dir)) {
    console.error(`${CATALOGUE_DIR} does not exist. Run this from the repository root.`);
    return EXIT_FAILED;
  }
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => ({ name, text: readFileSync(join(dir, name), "utf8") }));

  const result = buildCatalogue(files);
  if (!result.ok) {
    for (const line of describeFailures(result.failures)) console.error(line);
    console.error(`Nothing written. Fix the ${result.failures.length === 1 ? "file" : "files"} above and run npm run catalogue:build again.`);
    return EXIT_FAILED;
  }

  const target = resolve(process.cwd(), GENERATED_MODULE_PATH);
  const current = existsSync(target) ? readFileSync(target, "utf8") : null;
  const changed = current !== result.moduleText;
  if (changed) writeFileSync(target, result.moduleText, "utf8");

  for (const category of result.categories) {
    const totals = computeTotals(category);
    console.log(summaryLine(category.type, totals, category.products.length, category.pendingProducts.length, category.published));
  }
  console.log(changed ? `Wrote ${GENERATED_MODULE_PATH}.` : `${GENERATED_MODULE_PATH} is already in step.`);
  return EXIT_OK;
}

process.exitCode = main();
