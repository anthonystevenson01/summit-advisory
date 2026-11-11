/**
 * Routing key resolution order and reset.
 *
 * Runs on Node's built-in test runner with native TypeScript type stripping
 * (Node >= 22.18 / 23.6). No extra dependencies: `npm test`.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  ROUTING_TASKS,
  isCalibrationGated,
  parseRoutingKey,
  resolveRoute,
  type RouteConfig,
  type RoutingTask,
} from "../app/lib/tools/routing.ts";

const DEFAULTS: Record<RoutingTask, RouteConfig> = {
  scoring: { model: "vendor/small", maxTokens: 600 },
  details: { model: "vendor/medium", maxTokens: 3000 },
  synthesis: { model: "vendor/large", reasoning: "medium", maxTokens: 4000, fallback: "vendor/medium" },
  extraction: { model: "vendor/medium", reasoning: "low", maxTokens: 4000 },
  "builder-read": { model: "vendor/small", maxTokens: 6000, fallback: "vendor/medium" },
  "builder-suggest": { model: "vendor/small", maxTokens: 1500 },
  "builder-ideas": { model: "vendor/medium", reasoning: "low", maxTokens: 3000 },
  "builder-prototype-research": { model: "vendor/small", maxTokens: 2000, fallback: "vendor/medium" },
  "builder-prototype-plan": { model: "vendor/large", reasoning: "low", maxTokens: 4000, fallback: "vendor/medium" },
  "builder-prototype-review": { model: "vendor/large", reasoning: "medium", maxTokens: 3000, fallback: "vendor/medium" },
  "builder-prototype-build": { model: "vendor/other", maxTokens: 12000, fallback: "vendor/medium" },
  "builder-prototype-audit": { model: "vendor/small", maxTokens: 1000, fallback: "vendor/small" },
  catalogue: { model: "vendor/medium", reasoning: "low", maxTokens: 16000 },
};

const PROTOTYPE_KEYS = ["builder-prototype-research", "builder-prototype-plan", "builder-prototype-review", "builder-prototype-build", "builder-prototype-audit"];

describe("parseRoutingKey", () => {
  test("accepts a task and a task:tool", () => {
    assert.deepEqual(parseRoutingKey("scoring"), { task: "scoring" });
    assert.deepEqual(parseRoutingKey("scoring:icp"), { task: "scoring", tool: "icp" });
    assert.deepEqual(parseRoutingKey("builder-read"), { task: "builder-read" });
    for (const key of PROTOTYPE_KEYS) assert.deepEqual(parseRoutingKey(key), { task: key });
  });

  test("the catalogue key parses and is never narrowed to a tool", () => {
    assert.deepEqual(parseRoutingKey("catalogue"), { task: "catalogue" });
    assert.equal(ROUTING_TASKS[ROUTING_TASKS.length - 1], "catalogue");
  });

  test("the old builder-prototype key no longer parses, so a stale override under it is ignored", () => {
    assert.equal(parseRoutingKey("builder-prototype"), null);
  });

  test("rejects an unknown tool and an unknown task", () => {
    assert.equal(parseRoutingKey("scoring:unknown"), null);
    assert.equal(parseRoutingKey("banana"), null);
    assert.equal(parseRoutingKey("scoring:icp:extra"), null);
  });
});

describe("resolveRoute", () => {
  test("specific override beats task override beats default", () => {
    const overrides = {
      "scoring:icp": { model: "vendor/specific" },
      scoring: { model: "vendor/task" },
    };
    const r = resolveRoute("scoring:icp", overrides, DEFAULTS);
    assert.equal(r.model, "vendor/specific");
    assert.equal(r.source, "override:specific");
    assert.equal(r.task, "scoring");
    assert.equal(r.tool, "icp");
  });

  test("removing the specific override falls back to the task override", () => {
    const r = resolveRoute("scoring:icp", { scoring: { model: "vendor/task" } }, DEFAULTS);
    assert.equal(r.model, "vendor/task");
    assert.equal(r.source, "override:task");
  });

  test("removing both falls back to the default", () => {
    const r = resolveRoute("scoring:icp", {}, DEFAULTS);
    assert.equal(r.model, "vendor/small");
    assert.equal(r.source, "default");
    assert.equal(r.maxTokens, 600);
  });

  test("a task override applies to the plain task key too", () => {
    const r = resolveRoute("details", { details: { model: "vendor/other", maxTokens: 1000 } }, DEFAULTS);
    assert.equal(r.model, "vendor/other");
    assert.equal(r.maxTokens, 1000);
  });

  test("an override with an empty model is ignored", () => {
    const r = resolveRoute("scoring", { scoring: { model: "" } }, DEFAULTS);
    assert.equal(r.source, "default");
  });

  test("an override keeps the audit switch; the default has none", () => {
    const off = resolveRoute("builder-prototype-audit", { "builder-prototype-audit": { model: "vendor/small", enabled: false } }, DEFAULTS);
    assert.equal(off.enabled, false);
    assert.equal(resolveRoute("builder-prototype-audit", {}, DEFAULTS).enabled, undefined);
  });

  test("throws on an unknown key", () => {
    assert.throws(() => resolveRoute("banana", {}, DEFAULTS));
  });

  test("every task has a default", () => {
    for (const task of ROUTING_TASKS) {
      assert.ok(DEFAULTS[task].model.length > 0, task);
      assert.equal(resolveRoute(task, {}, DEFAULTS).model, DEFAULTS[task].model);
    }
  });
});

describe("isCalibrationGated", () => {
  test("scoring, scoring:tool and synthesis are gated", () => {
    assert.equal(isCalibrationGated("scoring"), true);
    assert.equal(isCalibrationGated("scoring:moat"), true);
    assert.equal(isCalibrationGated("synthesis"), true);
  });

  test("details and extraction are not", () => {
    assert.equal(isCalibrationGated("details"), false);
    assert.equal(isCalibrationGated("details:moat"), false);
    assert.equal(isCalibrationGated("extraction"), false);
    assert.equal(isCalibrationGated("banana"), false);
  });

  test("the builder keys, including the five prototype stages, are not gated", () => {
    for (const key of PROTOTYPE_KEYS) assert.equal(isCalibrationGated(key), false, key);
    assert.equal(isCalibrationGated("builder-read"), false);
    assert.equal(isCalibrationGated("builder-suggest"), false);
    assert.equal(isCalibrationGated("builder-ideas"), false);
  });

  test("the catalogue key is not gated", () => {
    assert.equal(isCalibrationGated("catalogue"), false);
  });
});
