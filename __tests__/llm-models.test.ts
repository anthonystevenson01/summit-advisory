/**
 * The curated model list, the price table, the defaults and the fallbacks
 * held against the OpenRouter catalogue fixture (refreshed only by
 * scripts/openrouter-models.ts, which itself fails when the live catalogue
 * lacks an id), so a typo or a retired id fails `npm test` with no network.
 * Imports llm.ts directly: the module constructs no client and reads no
 * env at import time, and this test runs with none set.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CURATED_MODELS,
  CURATED_MODEL_IDS,
  DEFAULT_ROUTES,
  MODEL_PRICES,
  PRICES_CHECKED_AT,
  PROVIDER_PREFIXES,
  ROUTING_TASKS,
  TASK_DESCRIPTIONS,
  TASK_LABELS,
  curatedModel,
  estimateCost,
} from "../app/lib/llm.ts";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/openrouter-model-ids.json", import.meta.url), "utf8")) as { checkedAt: string; ids: string[] };
const served = new Set(fixture.ids);

const PROTOTYPE_KEYS = ["builder-prototype-research", "builder-prototype-plan", "builder-prototype-review", "builder-prototype-build", "builder-prototype-audit"] as const;

describe("the curated list against the catalogue fixture", () => {
  test("the fixture is a dated list of ids", () => {
    assert.match(fixture.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(fixture.ids.length > 100);
  });

  test("every curated id, every default model and every fallback is in the live catalogue", () => {
    for (const m of CURATED_MODELS) assert.ok(served.has(m.id), `curated ${m.id} is not served`);
    for (const [task, route] of Object.entries(DEFAULT_ROUTES)) {
      assert.ok(served.has(route.model), `${task} default ${route.model} is not served`);
      if (route.fallback) assert.ok(served.has(route.fallback), `${task} fallback ${route.fallback} is not served`);
    }
  });

  test("every entry has a provider, a name, a location, a reasoning policy and a pin field, with a unique id under its provider's prefix", () => {
    assert.equal(new Set(CURATED_MODEL_IDS).size, CURATED_MODELS.length);
    for (const m of CURATED_MODELS) {
      assert.ok(m.provider in PROVIDER_PREFIXES, m.id);
      assert.ok(m.name.length > 0, m.id);
      assert.ok(m.location.length > 0, m.id);
      assert.ok(["optional", "always", "none"].includes(m.reasoning), m.id);
      assert.ok(m.pin === null || (Array.isArray(m.pin) && m.pin.length > 0 && m.pin.every((p) => /^[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(p))), m.id);
      assert.ok(m.id.startsWith(PROVIDER_PREFIXES[m.provider]), `${m.id} does not start with ${PROVIDER_PREFIXES[m.provider]}`);
      assert.doesNotMatch(`${m.name} ${m.location}`, /[–—]/);
    }
  });

  test("the pinned entries are exactly the DeepSeek, Moonshot and Z.ai ones", () => {
    const pinned = CURATED_MODELS.filter((m) => m.pin !== null).map((m) => m.provider).sort();
    assert.deepEqual([...new Set(pinned)], ["deepseek", "moonshot", "zai"]);
    for (const m of CURATED_MODELS) assert.equal(m.pin !== null, ["deepseek", "moonshot", "zai"].includes(m.provider), m.id);
  });

  test("the spec's minimum entries are present", () => {
    const names = CURATED_MODELS.map((m) => m.name);
    for (const name of ["Fable 5.1", "Opus 5.5", "Sonnet 5.5", "Haiku 5.5", "Opus 5", "Sonnet 5", "Haiku 4.5", "GPT-6 Astra", "GPT-6 Luna", "Gemini 3.8 Flash", "Kimi K3", "DeepSeek V4 Flash", "DeepSeek V4 Pro", "GLM 5.2", "Muse Spark 1.3"]) {
      assert.ok(names.includes(name), name);
    }
  });
});

describe("the price table", () => {
  test("covers every curated id with positive prices, nothing else, and carries a checked date", () => {
    assert.deepEqual(Object.keys(MODEL_PRICES).sort(), [...CURATED_MODEL_IDS].sort());
    for (const [id, price] of Object.entries(MODEL_PRICES)) {
      assert.ok(price.input > 0 && price.output > 0, id);
      assert.ok(served.has(id), id);
    }
    assert.match(PRICES_CHECKED_AT, /^\d{4}-\d{2}-\d{2}$/);
  });

  test("estimateCost prices a known id per million tokens and gives null for an unknown one", () => {
    const price = MODEL_PRICES["anthropic/claude-haiku-5.5"];
    const cost = estimateCost("anthropic/claude-haiku-5.5", { promptTokens: 1_000_000, completionTokens: 2_000_000 });
    assert.ok(cost !== null && Math.abs(cost - (price.input + 2 * price.output)) < 1e-9);
    assert.equal(estimateCost("vendor/unknown", { promptTokens: 10, completionTokens: 10 }), null);
  });
});

describe("the default routes", () => {
  test("the five prototype keys replace the old key, with a fallback each, and the old key is gone from the labels and descriptions", () => {
    for (const key of PROTOTYPE_KEYS) {
      assert.ok((ROUTING_TASKS as readonly string[]).includes(key), key);
      assert.ok(DEFAULT_ROUTES[key].fallback, key);
      assert.ok(TASK_LABELS[key].length > 0, key);
      assert.ok(TASK_DESCRIPTIONS[key].length > 0, key);
    }
    assert.ok(!(ROUTING_TASKS as readonly string[]).includes("builder-prototype"));
    assert.ok(!("builder-prototype" in TASK_LABELS));
  });

  test("the defaults are Anthony's choices with the spec's reasoning and caps", () => {
    assert.deepEqual(DEFAULT_ROUTES["builder-prototype-research"], { model: "deepseek/deepseek-v4-flash", maxTokens: 2000, fallback: "anthropic/claude-haiku-5.5" });
    assert.deepEqual(DEFAULT_ROUTES["builder-prototype-plan"], { model: "anthropic/claude-fable-5.1", reasoning: "low", maxTokens: 4000, fallback: "anthropic/claude-sonnet-5.5" });
    assert.deepEqual(DEFAULT_ROUTES["builder-prototype-review"], { model: "anthropic/claude-opus-5.5", reasoning: "medium", maxTokens: 3000, fallback: "anthropic/claude-fable-5.1" });
    assert.deepEqual(DEFAULT_ROUTES["builder-prototype-build"], { model: "openai/gpt-6-astra", maxTokens: 12000, fallback: "anthropic/claude-sonnet-5.5" });
    assert.deepEqual(DEFAULT_ROUTES["builder-prototype-audit"], { model: "moonshotai/kimi-k3", maxTokens: 1000, fallback: "anthropic/claude-haiku-5.5" });
  });

  test("the catalogue key runs on the extraction model, with a label, a description, no fallback and a cap the admin form can save", () => {
    assert.ok((ROUTING_TASKS as readonly string[]).includes("catalogue"));
    assert.equal(DEFAULT_ROUTES.catalogue.model, DEFAULT_ROUTES.extraction.model);
    assert.equal(DEFAULT_ROUTES.catalogue.reasoning, DEFAULT_ROUTES.extraction.reasoning);
    assert.equal(DEFAULT_ROUTES.catalogue.fallback, undefined);
    assert.ok((DEFAULT_ROUTES.catalogue.maxTokens ?? 0) > 0 && (DEFAULT_ROUTES.catalogue.maxTokens ?? 0) <= 16000);
    assert.ok(TASK_LABELS.catalogue.length > 0);
    assert.ok(TASK_DESCRIPTIONS.catalogue.includes("Not calibration gated"));
  });

  test("every default and fallback is a curated id, and no effort is set on an entry with no reasoning", () => {
    for (const [task, route] of Object.entries(DEFAULT_ROUTES)) {
      const entry = curatedModel(route.model);
      assert.ok(entry, `${task}: ${route.model} is not curated`);
      if (route.fallback) assert.ok(curatedModel(route.fallback), `${task}: fallback ${route.fallback} is not curated`);
      if (entry.reasoning === "none") assert.equal(route.reasoning, undefined, task);
    }
  });

  test("the probed reasoning policy: the entries that refuse off are marked always, the rest optional", () => {
    for (const id of ["anthropic/claude-sonnet-5.5", "anthropic/claude-opus-5.5", "anthropic/claude-fable-5.1", "openai/gpt-6-astra", "google/gemini-3.8-flash", "meta/muse-spark-1.3"]) {
      assert.equal(curatedModel(id)?.reasoning, "always", id);
    }
    for (const id of ["anthropic/claude-haiku-5.5", "anthropic/claude-haiku-4.5", "anthropic/claude-opus-5", "anthropic/claude-sonnet-5", "openai/gpt-6-luna", "moonshotai/kimi-k3", "deepseek/deepseek-v4-flash", "deepseek/deepseek-v4-pro", "z-ai/glm-5.2"]) {
      assert.equal(curatedModel(id)?.reasoning, "optional", id);
    }
  });

  test("no label or description carries an en or em dash", () => {
    for (const text of [...Object.values(TASK_LABELS), ...Object.values(TASK_DESCRIPTIONS)]) assert.doesNotMatch(text, /[–—]/, text);
  });
});
