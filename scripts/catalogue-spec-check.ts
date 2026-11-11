/**
 * Lists what a product's public API specification exposes.
 *
 *   npm run catalogue:spec-check -- "<product name>" <url or path> [<url or path> ...] [--hub sales]
 *
 * Each source is an OpenAPI document in JSON, an OpenAPI document in block
 * style YAML, or the HubSpot public API index; the format is recognised from
 * the content. A source that starts with http:// or https:// is fetched
 * (60 s, 10 MB); anything else is read as a local path. The listing of
 * resources and operations is plain text, written to
 * .catalogue-cache/spec/{product}.txt, and is what `catalogue:mark --spec`
 * takes as evidence. `--hub` names the HubSpot hub whose tier is shown.
 *
 * This script needs no variable: it reads a public file and calls no model.
 *
 * Exit codes:
 *   0  the listing was written
 *   1  a source could not be read or recognised, or held nothing to list
 *   2  bad arguments; nothing ran
 */
import { EXIT_CONFIG, EXIT_FAILED, EXIT_OK, parseScriptArgs, readSource, slug, writeCacheFile } from "./catalogue/io.ts";
import {
  DEFAULT_HUB,
  SPEC_CHECK_ARG_SPEC,
  SPEC_CHECK_USAGE,
  SPEC_FORMAT_NAMES,
  formatSpecListing,
  readSpecSection,
  sectionSize,
  type SpecSection,
} from "./catalogue/spec.ts";

const SOURCE_LIMITS = { timeoutMs: 60_000, maxBytes: 10 * 1024 * 1024, overflow: "fail" } as const;

async function main(): Promise<number> {
  const args = parseScriptArgs(process.argv.slice(2), SPEC_CHECK_ARG_SPEC);
  if (!args.ok) {
    console.error(args.message);
    console.error(SPEC_CHECK_USAGE);
    return EXIT_CONFIG;
  }
  const productName = args.positionals["product name"];
  const hub = args.options.hub ?? DEFAULT_HUB;

  const sections: SpecSection[] = [];
  for (const source of args.rest) {
    let text: string;
    try {
      text = await readSource(source, SOURCE_LIMITS);
    } catch (err) {
      console.error(`Could not read ${source}: ${err instanceof Error ? err.message : String(err)}`);
      return EXIT_FAILED;
    }
    const section = readSpecSection(source, text, hub);
    if (section === null) {
      console.error(`${source} is not an OpenAPI document or a HubSpot index.`);
      return EXIT_FAILED;
    }
    if (sectionSize(section) === 0) {
      if (section.format === "openapi-yaml") console.error(`${source}: no operations found; the line scanner reads block style YAML only.`);
      else if (section.format === "openapi-json") console.error(`${source}: no operations found.`);
      else console.error(`${source}: no entries found in the index.`);
      return EXIT_FAILED;
    }
    sections.push(section);
  }

  const path = writeCacheFile(`spec/${slug(productName)}.txt`, formatSpecListing(productName, sections));
  for (const section of sections) {
    const what = section.format === "hubspot-index" ? "entries" : "operations";
    console.log(`${section.source}: ${SPEC_FORMAT_NAMES[section.format]}, ${sectionSize(section)} ${what}.`);
  }
  console.log(`Wrote ${path}.`);
  return EXIT_OK;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = EXIT_FAILED;
  });
