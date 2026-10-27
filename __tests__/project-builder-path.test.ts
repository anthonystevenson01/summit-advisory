/**
 * The Project Builder's public path and the permanent redirect from its old
 * address under /tools. Pure modules, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { PROJECT_BUILDER_PATH } from "../app/lib/project-builder/copy.ts";
import nextConfig from "../next.config.ts";

describe("Project Builder path", () => {
  test("the path is /project-builder", () => {
    assert.equal(PROJECT_BUILDER_PATH, "/project-builder");
  });

  test("/tools/project-builder redirects permanently to the path, query carried", async () => {
    assert.ok(nextConfig.redirects, "next.config.ts defines redirects()");
    const redirects = await nextConfig.redirects();
    const entries = redirects.filter((r) => r.source === "/tools/project-builder");
    assert.equal(entries.length, 1, "expected exactly one redirect from /tools/project-builder");
    const entry = entries[0];
    assert.equal(entry.destination, PROJECT_BUILDER_PATH);
    assert.equal(entry.permanent, true);
    assert.equal(entry.has, undefined);
    assert.equal(entry.missing, undefined);
  });

  test("no redirect points back at the old address", async () => {
    assert.ok(nextConfig.redirects, "next.config.ts defines redirects()");
    const redirects = await nextConfig.redirects();
    for (const r of redirects) {
      assert.ok(!r.destination.includes("tools/project-builder"), `${r.source} redirects to ${r.destination}`);
    }
  });
});
