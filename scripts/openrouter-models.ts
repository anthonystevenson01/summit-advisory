/**
 * Refreshes `__tests__/fixtures/openrouter-model-ids.json` from the live
 * OpenRouter catalogue and exits non zero when any curated id, default or
 * fallback is missing from it, so a typo or a retired id is caught before it
 * is wired and again in the smoke test. `npm test` then holds the list
 * against the fixture with no network.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --env-file-if-exists=.env.local scripts/openrouter-models.ts
 *
 * OPENROUTER_API_KEY is optional for the listing but recommended, since an
 * unauthenticated listing can omit models the account has access to. Also
 * prints the catalogue price of every curated id beside the price table, so
 * `MODEL_PRICES` can be checked by eye.
 *
 * Exit codes: 0 every id is served; 1 at least one id is missing (the
 * fixture is still rewritten, so `npm test` then names the id); 2 the
 * catalogue could not be read (the fixture is left alone).
 */
import { writeFileSync } from "node:fs";
import { CURATED_MODELS, DEFAULT_ROUTES, MODEL_PRICES, fetchOpenRouterCatalog } from "../app/lib/llm.ts";

const FIXTURE = new URL("../__tests__/fixtures/openrouter-model-ids.json", import.meta.url);

async function main(): Promise<number> {
  const catalog = await fetchOpenRouterCatalog();
  if (catalog.size === 0) {
    console.error("openrouter-models: the catalogue could not be read (network or key); the fixture is unchanged");
    return 2;
  }
  const wanted = new Set<string>(CURATED_MODELS.map((m) => m.id));
  for (const route of Object.values(DEFAULT_ROUTES)) {
    wanted.add(route.model);
    if (route.fallback) wanted.add(route.fallback);
  }
  for (const id of Object.keys(MODEL_PRICES)) wanted.add(id);
  const missing = [...wanted].filter((id) => !catalog.has(id)).sort();

  const ids = [...catalog.keys()].sort();
  const fixture = { checkedAt: new Date().toISOString().slice(0, 10), count: ids.length, ids };
  writeFileSync(FIXTURE, `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`openrouter-models: ${ids.length} ids written to the fixture (${fixture.checkedAt})`);

  for (const m of CURATED_MODELS) {
    const live = catalog.get(m.id);
    const price = MODEL_PRICES[m.id];
    const livePrompt = live?.pricing?.prompt ? (Number(live.pricing.prompt) * 1e6).toFixed(3) : "?";
    const liveCompletion = live?.pricing?.completion ? (Number(live.pricing.completion) * 1e6).toFixed(3) : "?";
    console.log(`  ${m.id.padEnd(32)} table ${price ? `${price.input}/${price.output}` : "none"}  catalogue ${livePrompt}/${liveCompletion} per M`);
  }

  if (missing.length > 0) {
    console.error(`openrouter-models: not in the live catalogue: ${missing.join(", ")}`);
    return 1;
  }
  console.log("openrouter-models: every curated id, default and fallback is served");
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error("openrouter-models:", err instanceof Error ? err.message : err);
    process.exit(2);
  },
);
