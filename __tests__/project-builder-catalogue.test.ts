/**
 * The Project Builder catalogue: shape, cross references and no dashes in
 * any string. Pure module, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import * as catalogue from "../app/lib/project-builder/catalogue.ts";
import * as copy from "../app/lib/project-builder/copy.ts";
import {
  CAPABILITIES,
  FEATURES,
  GENERIC_CAPABILITIES,
  HANDOVER,
  HANDOVER_REQUIREMENTS,
  PRIORITIES,
  REPLACEMENT_REASONS,
  ROLES,
  STEPS,
  SYSTEM_CATEGORIES,
} from "../app/lib/project-builder/catalogue.ts";

const DASH_RE = /[–—]/;

function walkStrings(value: unknown, path: string, visit: (text: string, at: string) => void, seen = new Set<unknown>()): void {
  if (typeof value === "string") {
    visit(value, path);
    return;
  }
  if (value instanceof RegExp || value === null || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) walkStrings(child, `${path}.${key}`, visit, seen);
}

describe("Project Builder catalogue", () => {
  test("FEATURES has fifteen unique entries with a title, body, requirement and a RegExp matcher", () => {
    assert.equal(FEATURES.length, 15);
    assert.equal(new Set(FEATURES.map((f) => f.key)).size, 15);
    for (const f of FEATURES) {
      assert.ok(f.title.length > 0, f.key);
      assert.ok(f.body.length > 0, f.key);
      assert.ok(f.requirement.length > 0, f.key);
      assert.ok(f.matcher instanceof RegExp, f.key);
    }
  });

  test("eight categories, 32 systems, every capability key known, every category names a role", () => {
    assert.equal(SYSTEM_CATEGORIES.length, 8);
    let systems = 0;
    for (const cat of SYSTEM_CATEGORIES) {
      assert.ok(cat.roles.length > 0, cat.category);
      for (const role of cat.roles) assert.ok(ROLES.includes(role), `${cat.category}: ${role}`);
      for (const [name, keys] of Object.entries(cat.systems)) {
        systems += 1;
        assert.ok(keys.length > 0, name);
        for (const k of keys) assert.ok(k in CAPABILITIES, `${name}: ${k}`);
      }
    }
    assert.equal(systems, 32);
    assert.equal(Object.keys(CAPABILITIES).length, 40);
  });

  test("the generic capabilities exist and the handover keys match their sentences", () => {
    for (const k of GENERIC_CAPABILITIES) assert.ok(k in CAPABILITIES, k);
    assert.deepEqual(HANDOVER.map((h) => h.key).sort(), Object.keys(HANDOVER_REQUIREMENTS).sort());
  });

  test("the six step names, the three priorities and the eight reasons as sentences", () => {
    assert.deepEqual(STEPS, ["Your business", "The goal", "What it does", "Rules and running it", "Make it smarter", "Submit"]);
    assert.deepEqual(PRIORITIES, ["Must", "Should", "Could"]);
    assert.equal(Object.keys(REPLACEMENT_REASONS).length, 8);
    for (const [reason, sentence] of Object.entries(REPLACEMENT_REASONS)) assert.ok(sentence.endsWith("."), reason);
  });

  test("no exported string in the catalogue or the copy carries an en or em dash", () => {
    walkStrings(catalogue, "catalogue", (text, at) => assert.doesNotMatch(text, DASH_RE, at));
    walkStrings(copy, "copy", (text, at) => assert.doesNotMatch(text, DASH_RE, at));
  });
});
