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
};

describe("parseRoutingKey", () => {
  test("accepts a task and a task:tool", () => {
    assert.deepEqual(parseRoutingKey("scoring"), { task: "scoring" });
    assert.deepEqual(parseRoutingKey("scoring:icp"), { task: "scoring", tool: "icp" });
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
});
