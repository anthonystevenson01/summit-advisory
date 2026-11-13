/**
 * The spec check extractors: format detection, the OpenAPI JSON reader, the
 * OpenAPI YAML line scanner, the HubSpot index reader and the listing. The
 * fixtures are small samples written for these tests. No network.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  detectSpecFormat,
  extractHubSpotIndex,
  extractOpenApiJson,
  extractOpenApiYaml,
  formatSpecListing,
  readSpecSection,
  sectionSize,
  stripByteOrderMark,
  type SpecOperation,
} from "../scripts/catalogue/spec.ts";

const read = (name: string): string => readFileSync(new URL(`./fixtures/catalogue/${name}`, import.meta.url), "utf8");

const OPENAPI_JSON = read("openapi-sample.json");
const OPENAPI_YAML = read("openapi-sample.yaml");
const HUBSPOT_INDEX = read("hubspot-index-sample.json");

const EXPECTED_OPERATIONS: SpecOperation[] = [
  { resource: "Deals", method: "GET", path: "/v1/deals", summary: "List deals" },
  { resource: "Deals", method: "POST", path: "/v1/deals", summary: "Create a deal" },
  { resource: "Deals", method: "GET", path: "/v1/deals/{id}", summary: "Get one deal, with its stage history" },
  { resource: "Deals", method: "DELETE", path: "/v1/deals/{id}", summary: "deleteDeal" },
  { resource: "files", method: "GET", path: "/v1/files/{id}/content", summary: "Download a file's content" },
  { resource: "(root)", method: "PATCH", path: "/v1/{id}", summary: "Update any record by id" },
];

describe("detectSpecFormat", () => {
  test("names each of the three shapes from the content", () => {
    assert.equal(detectSpecFormat(OPENAPI_JSON), "openapi-json");
    assert.equal(detectSpecFormat(OPENAPI_YAML), "openapi-yaml");
    assert.equal(detectSpecFormat(HUBSPOT_INDEX), "hubspot-index");
    assert.equal(detectSpecFormat(`\n  ${OPENAPI_JSON}`), "openapi-json");
    assert.equal(detectSpecFormat("swagger: '2.0'\npaths: # all of them\n  /a:\n    get:\n      summary: A\n"), "openapi-yaml");
  });

  test("a byte order mark before the first character does not hide the format or break the read", () => {
    const mark = String.fromCharCode(0xfeff);
    assert.equal(stripByteOrderMark(`${mark}{}`), "{}");
    assert.equal(stripByteOrderMark("{}"), "{}");
    assert.equal(stripByteOrderMark(""), "");
    assert.equal(detectSpecFormat(mark + OPENAPI_JSON), "openapi-json");
    assert.equal(detectSpecFormat(mark + OPENAPI_YAML), "openapi-yaml");
    assert.equal(detectSpecFormat(mark + HUBSPOT_INDEX), "hubspot-index");
    assert.deepEqual(extractOpenApiYaml(mark + OPENAPI_YAML), EXPECTED_OPERATIONS);
    for (const text of [OPENAPI_JSON, OPENAPI_YAML, HUBSPOT_INDEX]) {
      assert.deepEqual(readSpecSection("source", mark + text), readSpecSection("source", text));
    }
    assert.equal(sectionSize(readSpecSection("source", mark + OPENAPI_JSON) ?? { source: "", format: "openapi-json", operations: [] }), 6);
  });

  test("gives null for anything else", () => {
    assert.equal(detectSpecFormat("Just some text about an API."), null);
    assert.equal(detectSpecFormat('{"hello": "world"}'), null);
    assert.equal(detectSpecFormat('{"results": []}'), null);
    assert.equal(detectSpecFormat('{"results": [{"name": "No versions"}]}'), null);
    assert.equal(detectSpecFormat('{"paths": '), null);
    assert.equal(detectSpecFormat("[1, 2, 3]"), null);
    assert.equal(detectSpecFormat("openapi: 3.1.0\ninfo:\n  title: No paths here\n"), null);
    assert.equal(detectSpecFormat("paths:\n  /a:\n    get:\n      summary: No version line\n"), null);
    assert.equal(detectSpecFormat(""), null);
  });
});

describe("extractOpenApiJson", () => {
  test("lists every operation with its resource, method, path and summary", () => {
    assert.deepEqual(extractOpenApiJson(JSON.parse(OPENAPI_JSON)), EXPECTED_OPERATIONS);
  });

  test("falls back from summary to operationId to the first line of the description, and cuts a long summary", () => {
    const document = {
      paths: {
        "/api/v2/things": {
          summary: "a path level summary is not an operation",
          get: { description: "First line.\nSecond line." },
          put: { summary: "   ", operationId: "putThing" },
          post: {},
          head: { summary: `Long ${"word ".repeat(60)}` },
          trace: "not an object",
        },
        "/odd": null,
      },
    };
    const operations = extractOpenApiJson(document);
    assert.deepEqual(
      operations.map((o) => [o.method, o.resource, o.summary.slice(0, 20)]),
      [
        ["GET", "things", "First line."],
        ["PUT", "things", "putThing"],
        ["POST", "things", ""],
        ["HEAD", "things", "Long word word word "],
      ],
    );
    assert.ok(operations[3].summary.length <= 160);
  });

  test("gives an empty list for something that is not an OpenAPI document", () => {
    assert.deepEqual(extractOpenApiJson(null), []);
    assert.deepEqual(extractOpenApiJson({ paths: [] }), []);
    assert.deepEqual(extractOpenApiJson("paths"), []);
  });
});

describe("extractOpenApiYaml", () => {
  test("gives the same six operations as the JSON extractor, and none of the decoys", () => {
    const operations = extractOpenApiYaml(OPENAPI_YAML);
    assert.deepEqual(operations, EXPECTED_OPERATIONS);
    assert.deepEqual(operations, extractOpenApiJson(JSON.parse(OPENAPI_JSON)));
    for (const operation of operations) {
      assert.ok(!operation.summary.includes("not this"), operation.summary);
      assert.ok(!operation.summary.includes("not an operation"), operation.summary);
    }
  });

  test("learns the indent levels from the file", () => {
    const wide = [
      "openapi: 3.0.0",
      "paths:",
      "    /orders:",
      "        get:",
      "            summary: List orders",
      "            responses:",
      "                '200':",
      "                    summary: not this",
      "        x-internal: true",
      "        post:",
      "            operationId: createOrder",
      "    /orders/{id}:",
      "        delete:",
      "            summary: |",
      "                Delete",
      "                an order",
      "            tags:",
      "            - Orders",
      "info:",
      "    summary: not this",
      "",
    ].join("\n");
    assert.deepEqual(extractOpenApiYaml(wide), [
      { resource: "orders", method: "GET", path: "/orders", summary: "List orders" },
      { resource: "orders", method: "POST", path: "/orders", summary: "createOrder" },
      { resource: "Orders", method: "DELETE", path: "/orders/{id}", summary: "Delete an order" },
    ]);
  });

  test("reads Windows line ends", () => {
    assert.deepEqual(extractOpenApiYaml(OPENAPI_YAML.replace(/\n/g, "\r\n")), EXPECTED_OPERATIONS);
  });

  test("a style it does not read gives an empty list, never an exception or a guess", () => {
    const tabbed = "openapi: 3.0.0\npaths:\n\t/orders:\n\t\tget:\n\t\t\tsummary: List orders\n";
    const flow = "openapi: 3.0.0\npaths: { /orders: { get: { summary: List orders } } }\n";
    const flowInside = "openapi: 3.0.0\npaths:\n  /orders: { get: { summary: List orders } }\n";
    const empty = "openapi: 3.0.0\npaths:\ncomponents:\n  schemas: {}\n";
    for (const text of [tabbed, flow, flowInside, empty, "", "no paths at all"]) {
      assert.deepEqual(extractOpenApiYaml(text), []);
    }
  });
});

describe("extractHubSpotIndex", () => {
  test("gives name, group, stable version, newest version and stage, and the tier for Sales Hub", () => {
    assert.deepEqual(extractHubSpotIndex(JSON.parse(HUBSPOT_INDEX)), [
      { name: "Deals", group: "CRM", stableVersion: "2026-03", newestVersion: "2026-03", newestStage: "STABLE", tier: "Free" },
      { name: "Deal Splits", group: "CRM", stableVersion: null, newestVersion: "2026-09", newestStage: "DEVELOPER_PREVIEW", tier: "Enterprise" },
      { name: "Sequences", group: "Automation", stableVersion: "2026-03", newestVersion: "2026-03", newestStage: "STABLE", tier: "Professional" },
      { name: "Webhooks", group: "Automation", stableVersion: "3", newestVersion: "2026-03", newestStage: "LATEST", tier: null },
      { name: "Deals", group: "Automation", stableVersion: "1", newestVersion: "1", newestStage: "STABLE", tier: "Starter" },
    ]);
  });

  test("the hub argument reads another hub's tier", () => {
    const service = extractHubSpotIndex(JSON.parse(HUBSPOT_INDEX), "service");
    assert.deepEqual(
      service.map((entry) => entry.tier),
      ["Starter", null, "Professional", null, null],
    );
  });

  test("numbered versions compare as numbers and rank below dated ones", () => {
    const index = {
      results: [
        { name: "Numbered", group: "G", versions: [{ version: "9", stage: "STABLE" }, { version: "10", stage: "STABLE" }, { version: "beta", stage: "STABLE" }] },
        { name: "Mixed", group: "G", versions: [{ version: "12", stage: "STABLE" }, { version: "2025-03", stage: "LATEST" }] },
      ],
    };
    const [numbered, mixed] = extractHubSpotIndex(index);
    assert.equal(numbered.stableVersion, "10");
    assert.equal(numbered.tier, null);
    assert.deepEqual([mixed.stableVersion, mixed.newestVersion, mixed.newestStage], ["12", "2025-03", "LATEST"]);
  });

  test("gives an empty list for something that is not the index", () => {
    assert.deepEqual(extractHubSpotIndex(null), []);
    assert.deepEqual(extractHubSpotIndex({ results: "none" }), []);
  });
});

describe("formatSpecListing", () => {
  test("writes the sections as plain text, the same bytes for the same input", () => {
    const yaml = readSpecSection("specs/sample.yaml", OPENAPI_YAML);
    const index = readSpecSection("https://example.test/index", HUBSPOT_INDEX);
    assert.ok(yaml && index);
    assert.equal(sectionSize(yaml), 6);
    assert.equal(sectionSize(index), 5);
    const listing = formatSpecListing("Sample Product", [yaml, index]);
    const expected = [
      "Specification listing: Sample Product",
      "",
      "Source: specs/sample.yaml",
      "Format: OpenAPI YAML",
      "Resources: 3. Operations: 6.",
      "",
      "Deals",
      "  GET /v1/deals  List deals",
      "  POST /v1/deals  Create a deal",
      "  GET /v1/deals/{id}  Get one deal, with its stage history",
      "  DELETE /v1/deals/{id}  deleteDeal",
      "",
      "files",
      "  GET /v1/files/{id}/content  Download a file's content",
      "",
      "(root)",
      "  PATCH /v1/{id}  Update any record by id",
      "",
      "Source: https://example.test/index",
      "Format: HubSpot API index",
      "APIs: 5 in 2 groups. Tier shown for: sales.",
      "",
      "Automation",
      "  Deals  stable 1  tier Starter",
      "  Sequences  stable 2026-03  tier Professional",
      "  Webhooks  stable 3  tier not stated",
      "",
      "CRM",
      "  Deal Splits  no stable version (2026-09, developer preview)  tier Enterprise",
      "  Deals  stable 2026-03  tier Free",
      "",
    ].join("\n");
    assert.equal(listing, expected);
    assert.equal(formatSpecListing("Sample Product", [yaml, index]), listing);
  });

  test("an operation with no summary has no trailing spaces, and a JSON section is named as such", () => {
    const section = readSpecSection("a.json", JSON.stringify({ openapi: "3.1.0", paths: { "/things": { get: {} } } }));
    assert.ok(section);
    const listing = formatSpecListing("P", [section]);
    assert.ok(listing.includes("Format: OpenAPI JSON\nResources: 1. Operations: 1.\n\nthings\n  GET /things\n"));
    assert.equal(/[ \t]\n/.test(listing), false);
  });

  test("a source that is none of the three shapes gives no section", () => {
    assert.equal(readSpecSection("notes.txt", "Just some text."), null);
  });
});
