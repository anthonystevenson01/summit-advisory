/**
 * The draft script's pure half and the helpers the catalogue scripts share:
 * the prompt, the schema, the answer parser, the step to a category, the
 * configuration check and the argument reader. No network, no model call.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { CAPABILITIES } from "../app/lib/project-builder/catalogue.ts";
import { DATA_GUARD } from "../app/lib/project-builder/prompts.ts";
import { hasLongDash, parseCategory, serialiseCategory, sizeScaleSentence, validateCategory } from "../app/lib/project-builder/tool-catalogue.ts";
import { SchemaError } from "../app/lib/tools/schema.ts";
import {
  DRAFT_ARG_SPEC,
  REQUIREMENT_STANDARD,
  buildDraftPrompt,
  draftKeyEnum,
  draftSchema,
  draftToCategory,
  draftWarnings,
  forbiddenNamesFromUrls,
  forbiddenNamesNotice,
  parseDraftAnswer,
  parseProductList,
  pendingProductsNotice,
} from "../scripts/catalogue/draft.ts";
import {
  capPages,
  isHttpUrl,
  isReadableContentType,
  missingCatalogueEnv,
  pageText,
  parseScriptArgs,
  productNameProblem,
  slug,
  splitList,
} from "../scripts/catalogue/io.ts";
import { MARK_ARG_SPEC } from "../scripts/catalogue/mark.ts";
import { SPEC_CHECK_ARG_SPEC } from "../scripts/catalogue/spec.ts";

const EN_DASH = String.fromCharCode(0x2013);
const WORDS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth"];

interface RawRequirement {
  id: unknown;
  text: unknown;
  baseline: unknown;
  size: unknown;
  key: unknown;
}
interface RawAnswer {
  scope: unknown;
  groups: { name: unknown; requirements: RawRequirement[] }[];
}

function group(name: string, letter: string, key: string, count = 4): RawAnswer["groups"][number] {
  return {
    name,
    requirements: Array.from({ length: count }, (_, i) => ({
      id: `${letter}${i + 1}`,
      text: `The ${WORDS[i]} behaviour of ${name.toLowerCase()}, with its edges.`,
      baseline: i === 0,
      size: i === 0 ? "S" : "M",
      key,
    })),
  };
}

function soundAnswer(): RawAnswer {
  return {
    scope: "tools that manage support requests from customers",
    groups: [group("Requests", "R", "tickets"), group("Knowledge", "K", "kb", 5), group("Admin", "A", "none")],
  };
}

const NO_NAMES = { forbiddenNames: [] };

function rejects(answer: unknown, pattern: RegExp, options = NO_NAMES): void {
  assert.throws(
    () => parseDraftAnswer(answer, options),
    (err: unknown) => {
      assert.ok(err instanceof SchemaError, "expected a SchemaError");
      assert.match(err.message, pattern);
      return true;
    },
  );
}

describe("buildDraftPrompt", () => {
  const pages = [
    { url: "https://docs.example.test/features", text: "PAGE ONE TEXT about tickets." },
    { url: "https://help.example.test/guide", text: "PAGE TWO TEXT with a ``` fence inside." },
  ];
  const prompt = buildDraftPrompt({ type: "helpdesk", title: "Helpdesk and customer service", pages });

  test("the system turn carries the requirement standard, the size scale, every capability key and the data guard", () => {
    for (const line of REQUIREMENT_STANDARD) assert.ok(prompt.system.includes(line), line);
    assert.ok(REQUIREMENT_STANDARD.some((line) => line.includes("One sentence")));
    assert.ok(REQUIREMENT_STANDARD.some((line) => line.includes("One behaviour")));
    assert.ok(REQUIREMENT_STANDARD.some((line) => line.includes("one level below the module")));
    assert.ok(REQUIREMENT_STANDARD.some((line) => line.includes("No product or vendor names")));
    assert.ok(REQUIREMENT_STANDARD.some((line) => line.includes("British spelling")));
    assert.ok(REQUIREMENT_STANDARD.some((line) => line.includes("No em or en dashes")));
    assert.ok(REQUIREMENT_STANDARD.some((line) => line.includes("Four to eight requirements per group")));
    assert.ok(prompt.system.includes(sizeScaleSentence()));
    for (const [key, capability] of Object.entries(CAPABILITIES)) assert.ok(prompt.system.includes(`- ${key}: ${capability.title}`), key);
    assert.ok(prompt.system.includes("- none: connections, admin and platform"));
    assert.ok(prompt.system.endsWith(DATA_GUARD));
  });

  test("what was typed and what was fetched sit in the user turn only", () => {
    assert.ok(prompt.user.includes("Category type: helpdesk"));
    assert.ok(prompt.user.includes("Category title: Helpdesk and customer service"));
    for (const page of pages) assert.ok(prompt.user.includes(`Page: ${page.url}`));
    assert.ok(prompt.user.includes("PAGE ONE TEXT about tickets."));
    assert.ok(!prompt.system.includes("helpdesk"));
    assert.ok(!prompt.system.includes("Helpdesk and customer service"));
    assert.ok(!prompt.system.includes("PAGE ONE TEXT"));
    assert.ok(!prompt.system.includes("example.test"));
  });

  test("a fence inside a page cannot close its block", () => {
    assert.equal(prompt.user.split("```").length - 1, 4);
    assert.ok(prompt.user.includes("PAGE TWO TEXT with a ''' fence inside."));
  });

  test("neither turn holds a long dash", () => {
    assert.equal(hasLongDash(prompt.system), false);
    assert.equal(hasLongDash(prompt.user), false);
  });
});

describe("draftSchema", () => {
  test("is strict, requires every property at every level, and limits the key to the capability keys plus none", () => {
    const schema = draftSchema();
    assert.equal(schema.name, "catalogue_draft");
    assert.equal(schema.strict, true);
    const walk = (node: unknown): void => {
      if (typeof node !== "object" || node === null) return;
      const record = node as Record<string, unknown>;
      if (record.type === "object") {
        assert.equal(record.additionalProperties, false);
        assert.deepEqual(record.required, Object.keys(record.properties as object));
      }
      for (const child of Object.values(record)) walk(child);
    };
    walk(schema.schema);

    const root = schema.schema as { properties: { groups: { items: { properties: { requirements: { items: { properties: Record<string, { enum?: string[] }> } } } } } } };
    const requirement = root.properties.groups.items.properties.requirements.items.properties;
    assert.deepEqual(Object.keys(requirement), ["id", "text", "baseline", "size", "key"]);
    assert.deepEqual(requirement.size.enum, ["S", "M", "L"]);
    assert.deepEqual(requirement.key.enum, [...Object.keys(CAPABILITIES), "none"]);
    assert.equal(draftKeyEnum().length, Object.keys(CAPABILITIES).length + 1);
    assert.equal(draftKeyEnum()[draftKeyEnum().length - 1], "none");
  });
});

describe("parseDraftAnswer", () => {
  test("accepts a sound answer and trims its strings", () => {
    const raw = soundAnswer();
    raw.scope = "  tools that manage support requests from customers ";
    raw.groups[0].requirements[0].text = " The first behaviour of requests, with its edges. ";
    const answer = parseDraftAnswer(raw, { forbiddenNames: ["zendesk"] });
    assert.equal(answer.scope, "tools that manage support requests from customers");
    assert.equal(answer.groups.length, 3);
    assert.deepEqual(answer.groups[0].requirements[0], {
      id: "R1",
      text: "The first behaviour of requests, with its edges.",
      baseline: true,
      size: "S",
      key: "tickets",
    });
    assert.equal(answer.groups[2].requirements[3].key, "none");
  });

  test("rejects a requirement with a dash", () => {
    const raw = soundAnswer();
    raw.groups[0].requirements[1].text = `Requests routed by priority ${EN_DASH} and by team.`;
    rejects(raw, /R2 holds an en or em dash/);
  });

  test("rejects two sentences and a missing full stop", () => {
    const two = soundAnswer();
    two.groups[0].requirements[1].text = "Requests routed by priority. Requests routed by team.";
    rejects(two, /R2 is not one sentence/);
    const open = soundAnswer();
    open.groups[0].requirements[1].text = "Requests routed by priority";
    rejects(open, /R2 is not one sentence/);
  });

  test("rejects an unknown key and an unknown size", () => {
    const key = soundAnswer();
    key.groups[0].requirements[2].key = "helpdesk";
    rejects(key, /R3 has a key that is neither a capability key nor none/);
    const size = soundAnswer();
    size.groups[0].requirements[2].size = "XL";
    rejects(size, /R3 has a size outside S, M, L/);
  });

  test("rejects a duplicate id, a bad id and numbers that do not run from 1", () => {
    const duplicate = soundAnswer();
    duplicate.groups[0].requirements[3].id = "R1";
    rejects(duplicate, /R1 is a duplicate id/);
    const bad = soundAnswer();
    bad.groups[0].requirements[3].id = "R10";
    rejects(bad, /not one capital letter and one digit/);
    const gap = soundAnswer();
    gap.groups[0].requirements[3].id = "R7";
    rejects(gap, /R7 is out of order/);
  });

  test("rejects a group of three and a group of nine", () => {
    const three = soundAnswer();
    three.groups[0].requirements.pop();
    rejects(three, /group "Requests" has 3 requirements; a group holds 4 to 8/);
    const nine = soundAnswer();
    nine.groups[0] = group("Requests", "R", "tickets", 9);
    rejects(nine, /group "Requests" has 9 requirements/);
  });

  test("rejects a letter used by two groups and two letters in one group", () => {
    const shared = soundAnswer();
    shared.groups[2] = group("Admin", "K", "none");
    rejects(shared, /group "Admin" uses the letter K, which group "Knowledge" already uses/);
    const mixed = soundAnswer();
    mixed.groups[0].requirements[3].id = "Q4";
    rejects(mixed, /group "Requests" uses more than one id letter/);
  });

  test("rejects a product name from the documentation hosts, whatever its case, and only as a whole word", () => {
    const named = soundAnswer();
    named.groups[1].requirements[0].text = "Articles written in the Zendesk editor, with drafts.";
    rejects(named, /K1 names a product or vendor \(zendesk\)/, { forbiddenNames: ["zendesk"] });
    const inside = soundAnswer();
    inside.groups[1].requirements[0].text = "Articles shown on the helpdesk front page, with drafts.";
    assert.doesNotThrow(() => parseDraftAnswer(inside, { forbiddenNames: ["desk"] }));
  });

  test("rejects a group named Totals, a repeated group name and a requirement that starts with The system shall", () => {
    const totals = soundAnswer();
    totals.groups[2].name = "Totals";
    rejects(totals, /uses the reserved name Totals/);
    const repeated = soundAnswer();
    repeated.groups[2].name = "Requests";
    rejects(repeated, /repeats a group name/);
    const shall = soundAnswer();
    shall.groups[0].requirements[0].text = "The system shall route requests by priority.";
    rejects(shall, /R1 starts with "The system shall"/);
  });

  test("rejects a scope with a full stop, a baseline that is not a boolean, and a shape that is not the schema's", () => {
    const scope = soundAnswer();
    scope.scope = "tools that manage requests.";
    rejects(scope, /scope holds a full stop/);
    const baseline = soundAnswer();
    baseline.groups[0].requirements[0].baseline = "yes";
    rejects(baseline, /R1 has a baseline that is not true or false/);
    rejects(null, /the answer is not an object/);
    rejects({ scope: "tools" }, /groups is missing or empty/);
    rejects({ scope: "tools", groups: [] }, /groups is missing or empty/);
    rejects({ scope: "tools", groups: ["Requests"] }, /group 1 is not an object/);
  });

  test("names every violation at once, and cuts a very long list", () => {
    const raw = soundAnswer();
    raw.groups[0].requirements[1].text = `Requests routed ${EN_DASH} by priority. And by team.`;
    raw.groups[1].requirements[0].size = "XL";
    rejects(raw, /3 problems: .*R2 is not one sentence.*R2 holds an en or em dash.*K1 has a size outside/);

    const many = soundAnswer();
    for (const g of many.groups) for (const r of g.requirements) r.text = "No full stop and far too many problems to list in one message";
    assert.throws(
      () => parseDraftAnswer(many, NO_NAMES),
      (err: unknown) => err instanceof SchemaError && err.message.length <= 2_020,
    );
  });
});

describe("draftToCategory", () => {
  test("gives a sound, unpublished category with the header keys in order of first use, and it round trips", () => {
    const answer = parseDraftAnswer(soundAnswer(), NO_NAMES);
    const category = draftToCategory({ type: "helpdesk", title: "Helpdesk and customer service" }, answer);
    assert.equal(category.published, false);
    assert.deepEqual(category.keys, ["tickets", "kb"]);
    assert.deepEqual([category.products, category.pendingProducts, category.coverage, category.sources], [[], [], null, null]);
    assert.deepEqual(validateCategory(category, { fileName: "helpdesk.md" }), []);

    const text = serialiseCategory(category);
    assert.ok(text.startsWith("# Helpdesk and customer service: requirement catalogue\n\n```\ntype: helpdesk\n"));
    assert.ok(text.includes("published: false"));
    assert.ok(text.includes("13 requirements in 3 groups for tools that manage support requests from customers."));
    const back = parseCategory(text);
    assert.ok(back.ok);
    if (!back.ok) return;
    assert.deepEqual(back.category, category);
    assert.deepEqual(validateCategory(back.category, { fileName: "helpdesk.md", stated: back.stated }), []);
  });

  test("the products named for a draft become its still to mark list, so the first one marked cannot set the baseline alone", () => {
    const answer = parseDraftAnswer(soundAnswer(), NO_NAMES);
    const named = parseProductList("Acme Desk, Borealis Suite ,Cobalt Flow (cloud)");
    assert.deepEqual(named, { ok: true, names: ["Acme Desk", "Borealis Suite", "Cobalt Flow (cloud)"] });
    if (!named.ok) return;
    const category = draftToCategory({ type: "helpdesk", title: "Helpdesk and customer service", products: named.names }, answer);
    assert.deepEqual(category.pendingProducts, ["Acme Desk", "Borealis Suite", "Cobalt Flow (cloud)"]);
    assert.deepEqual(category.products, []);
    assert.equal(category.coverage, null);
    assert.deepEqual(validateCategory(category, { fileName: "helpdesk.md" }), []);
    const text = serialiseCategory(category);
    assert.ok(text.endsWith("## Products\n\nNo product is marked yet. Coverage marks are added by the catalogue scripts.\n\nStill to mark:\n\n- Acme Desk\n- Borealis Suite\n- Cobalt Flow (cloud)\n"));
    const back = parseCategory(text);
    assert.ok(back.ok && back.category.pendingProducts.length === 3);

    assert.deepEqual(draftToCategory({ type: "helpdesk", title: "Helpdesk" }, answer).pendingProducts, []);
  });

  test("parseProductList holds each name to the product name rule and refuses a repeat", () => {
    assert.deepEqual(parseProductList(undefined), { ok: true, names: [] });
    assert.deepEqual(parseProductList(" , "), { ok: true, names: [] });
    const reserved = parseProductList("Acme Desk,all");
    assert.ok(!reserved.ok && /reserved/.test(reserved.message));
    const piped = parseProductList("Acme | Desk");
    assert.ok(!piped.ok && /pipe/.test(piped.message));
    const dashed = parseProductList(`Acme ${EN_DASH} Desk`);
    assert.ok(!dashed.ok && /en or em dash/.test(dashed.message));
    const twice = parseProductList("Acme Desk,Borealis Suite,Acme Desk");
    assert.ok(!twice.ok && /"Acme Desk" is given more than once/.test(twice.message));
  });

  test("the draft says what the still to mark list will be, and warns when there is none", () => {
    assert.equal(pendingProductsNotice(["Acme Desk", "Borealis Suite"]), "Still to mark, written into the file: Acme Desk, Borealis Suite.");
    assert.match(pendingProductsNotice([]), /no still to mark list and the first product marked would set every baseline flag alone/);
    assert.match(pendingProductsNotice([]), /--products/);
    assert.equal(hasLongDash(pendingProductsNotice([])), false);
  });

  test("draftWarnings says when the list is outside the standard's counts", () => {
    const small = parseDraftAnswer(soundAnswer(), NO_NAMES);
    assert.deepEqual(draftWarnings(small), ["3 groups; the standard asks for 8 to 12.", "13 requirements; the standard asks for 50 to 100."]);
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "J"];
    const full = parseDraftAnswer({ scope: "tools", groups: letters.map((letter) => group(`Group ${letter}`, letter, "tickets", 6)) }, NO_NAMES);
    assert.deepEqual(draftWarnings(full), []);
  });
});

describe("forbiddenNamesFromUrls", () => {
  test("takes the registrable label of each host, four letters or more, each once", () => {
    assert.deepEqual(
      forbiddenNamesFromUrls([
        "https://developers.pipedrive.com/docs/api/v1",
        "https://knowledge.hubspot.com/deals",
        "https://www.zoho.com/crm/help/",
        "https://support.pipedrive.com/en",
        "https://help.acme.co.uk/guide",
        "https://docs.abc.com/",
        "not a url",
      ]),
      ["pipedrive", "hubspot", "zoho", "acme"],
    );
  });

  test("a host label that is an ordinary word can be allowed, whatever its case", () => {
    const urls = ["https://developer.close.com/api", "https://developers.pipedrive.com/docs", "https://www.zoho.com/crm/help/"];
    assert.deepEqual(forbiddenNamesFromUrls(urls), ["close", "pipedrive", "zoho"]);
    assert.deepEqual(forbiddenNamesFromUrls(urls, ["Close"]), ["pipedrive", "zoho"]);
    assert.deepEqual(forbiddenNamesFromUrls(urls, splitList(" close , ZOHO ,")), ["pipedrive"]);
    assert.deepEqual(forbiddenNamesFromUrls(urls, ["closed"]), ["close", "pipedrive", "zoho"]);

    const raw = soundAnswer();
    raw.groups[0].requirements[0].text = "Close a request as solved or abandoned, with the reason.";
    rejects(raw, /R1 names a product or vendor \(close\)/, { forbiddenNames: forbiddenNamesFromUrls(urls) });
    assert.doesNotThrow(() => parseDraftAnswer(raw, { forbiddenNames: forbiddenNamesFromUrls(urls, ["close"]) }));
  });

  test("the forbidden words are stated before the call, with the way to allow one", () => {
    const notice = forbiddenNamesNotice(["close", "pipedrive"]);
    assert.ok(notice.includes("close, pipedrive"));
    assert.ok(notice.includes("--allow <word>[,<word>]"));
    assert.match(notice, /rejected after the call/);
    assert.match(forbiddenNamesNotice([]), /^No word is forbidden/);
    assert.equal(hasLongDash(notice), false);
  });
});

describe("the helpers the scripts share", () => {
  test("missingCatalogueEnv names what is absent and never returns a value", () => {
    assert.deepEqual(missingCatalogueEnv({}), ["OPENROUTER_API_KEY", "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN"]);
    assert.deepEqual(missingCatalogueEnv({ OPENROUTER_API_KEY: "sk-secret-value" }), ["UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN"]);
    assert.deepEqual(missingCatalogueEnv({ OPENROUTER_API_KEY: "sk-secret-value", UPSTASH_REDIS_REST_URL: "https://redis.example.test" }), [
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN",
    ]);
    assert.deepEqual(missingCatalogueEnv({ OPENROUTER_API_KEY: "k", UPSTASH_REDIS_REST_URL: "u", UPSTASH_REDIS_REST_TOKEN: "t" }), []);
    assert.deepEqual(missingCatalogueEnv({ OPENROUTER_API_KEY: "k", KV_REST_API_URL: "u", KV_REST_API_TOKEN: "t" }), []);
    const secret = { UPSTASH_REDIS_REST_URL: "https://redis.example.test", UPSTASH_REDIS_REST_TOKEN: "token-secret-value" };
    assert.ok(!missingCatalogueEnv(secret).join(" ").includes("secret"));
  });

  test("the draft arguments: a type, a title and three or four URLs", () => {
    const urls = ["https://a.example.test/1", "https://b.example.test/2", "https://c.example.test/3", "https://d.example.test/4", "https://e.example.test/5"];
    const ok = parseScriptArgs(["helpdesk", "Helpdesk", ...urls.slice(0, 3), "--force"], DRAFT_ARG_SPEC);
    assert.ok(ok.ok);
    if (ok.ok) {
      assert.deepEqual(ok.positionals, { type: "helpdesk", title: "Helpdesk" });
      assert.deepEqual(ok.rest, urls.slice(0, 3));
      assert.deepEqual(ok.switches, { force: true });
    }
    const four = parseScriptArgs(["helpdesk", "Helpdesk", ...urls.slice(0, 4)], DRAFT_ARG_SPEC);
    assert.ok(four.ok && four.switches.force === false);
    assert.ok(four.ok && four.options.products === undefined && four.options.allow === undefined);
    const flagged = parseScriptArgs(["helpdesk", "Helpdesk", "--products", "Acme Desk,Borealis Suite", ...urls.slice(0, 3), "--allow", "close,front"], DRAFT_ARG_SPEC);
    assert.ok(flagged.ok);
    if (flagged.ok) {
      assert.deepEqual(flagged.options, { products: "Acme Desk,Borealis Suite", allow: "close,front" });
      assert.deepEqual(flagged.rest, urls.slice(0, 3));
      assert.deepEqual(splitList(flagged.options.allow), ["close", "front"]);
    }

    const message = (argv: string[]): string => {
      const result = parseScriptArgs(argv, DRAFT_ARG_SPEC);
      assert.equal(result.ok, false);
      return result.ok ? "" : result.message;
    };
    assert.match(message(["helpdesk", "Helpdesk", ...urls.slice(0, 2)]), /Expected 3 to 4 documentation URLs and found 2/);
    assert.match(message(["helpdesk", "Helpdesk", ...urls]), /found 5/);
    assert.match(message(["Help Desk", "Helpdesk", ...urls.slice(0, 3)]), /type "Help Desk" is not valid/);
    assert.match(message(["9lives", "Helpdesk", ...urls.slice(0, 3)]), /type "9lives" is not valid/);
    assert.match(message(["helpdesk", "Helpdesk", urls[0], urls[1], "docs/local.html"]), /is not an http or https URL/);
    assert.match(message(["helpdesk", "Helpdesk", ...urls.slice(0, 3), "--overwrite"]), /Unknown flag --overwrite/);
    assert.match(message(["helpdesk"]), /Missing title/);
    assert.match(message([]), /Missing type/);
  });

  test("the mark arguments: URLs are needed unless a saved answer is given", () => {
    const withAnswer = parseScriptArgs(["sales", "Pipedrive", "--answer", "saved.json", "--dry-run"], MARK_ARG_SPEC);
    assert.ok(withAnswer.ok);
    if (withAnswer.ok) {
      assert.deepEqual(withAnswer.rest, []);
      assert.deepEqual(withAnswer.options, { spec: undefined, tier: undefined, answer: "saved.json" });
      assert.deepEqual(withAnswer.switches, { "dry-run": true });
    }
    const none = parseScriptArgs(["sales", "Pipedrive"], MARK_ARG_SPEC);
    assert.ok(!none.ok && /Expected 1 to 6 documentation URLs and found 0/.test(none.message));
    const dangling = parseScriptArgs(["sales", "Pipedrive", "https://a.example.test/1", "--tier"], MARK_ARG_SPEC);
    assert.ok(!dangling.ok && /--tier needs a value/.test(dangling.message));
    const tier = parseScriptArgs(["sales", "Pipedrive", "https://a.example.test/1", "--tier", "Professional", "--spec", "listing.txt"], MARK_ARG_SPEC);
    assert.ok(tier.ok && tier.options.tier === "Professional" && tier.options.spec === "listing.txt");
  });

  test("the spec check arguments: a product name and one or more sources, a URL or a local path", () => {
    const ok = parseScriptArgs(["Pipedrive", "https://a.example.test/openapi.yaml", "specs/local.json", "--hub", "service"], SPEC_CHECK_ARG_SPEC);
    assert.ok(ok.ok && ok.rest.length === 2 && ok.options.hub === "service");
    const none = parseScriptArgs(["Pipedrive"], SPEC_CHECK_ARG_SPEC);
    assert.equal(none.ok, false);
  });

  test("a product name is checked before anything is fetched: not empty, trimmed, no pipe, line break or long dash, and not all", () => {
    for (const name of ["Pipedrive", "HubSpot Sales Hub", "Shopify (orders and stock)", "Dynamics 365, Sales", "All"]) {
      assert.equal(productNameProblem(name), null, name);
    }
    assert.match(productNameProblem("") ?? "", /empty/);
    assert.match(productNameProblem("   ") ?? "", /empty/);
    assert.match(productNameProblem(" Pipedrive") ?? "", /must not start or end with a space/);
    assert.match(productNameProblem("Pipedrive ") ?? "", /must not start or end with a space/);
    assert.match(productNameProblem("Pipe|drive") ?? "", /pipe or a line break/);
    assert.match(productNameProblem("Pipe\ndrive") ?? "", /pipe or a line break/);
    assert.match(productNameProblem(`Pipedrive ${EN_DASH} Professional`) ?? "", /en or em dash/);
    assert.match(productNameProblem("all") ?? "", /reserved/);
    assert.match(productNameProblem(undefined as unknown as string) ?? "", /empty/);
  });

  test("only text, JSON, XML and YAML bodies are read from the network, so a PDF is never sent to the model as text", () => {
    for (const type of [
      "text/html; charset=utf-8",
      "text/plain",
      "TEXT/YAML",
      "application/json",
      "application/json; charset=utf-8",
      "application/xml",
      "application/yaml",
      "application/x-yaml",
      "application/xhtml+xml",
      "application/problem+json",
      "application/vnd.oai.openapi",
      "application/vnd.oai.openapi+json;version=3.1",
      "application/vnd.api+yaml",
    ]) {
      assert.equal(isReadableContentType(type), true, type);
    }
    for (const type of ["application/pdf", "application/octet-stream", "image/png", "application/zip", "application/msword", "video/mp4", "application/jsonp", "nonsense"]) {
      assert.equal(isReadableContentType(type), false, type);
    }
    for (const absent of [null, undefined, "", "  "]) assert.equal(isReadableContentType(absent), true, "a response with no Content-Type is let through");
  });

  test("slug, isHttpUrl, pageText and capPages", () => {
    assert.equal(slug("HubSpot Sales Hub"), "hubspot-sales-hub");
    assert.equal(slug("Shopify (orders and stock)"), "shopify-orders-and-stock");
    assert.equal(slug("../../etc"), "etc");
    assert.equal(slug("***"), "product");
    assert.equal(isHttpUrl("https://example.test/a"), true);
    assert.equal(isHttpUrl("ftp://example.test/a"), false);
    assert.equal(isHttpUrl("docs/a.html"), false);

    assert.equal(pageText("<html><head><title>T</title><script>var x = 1;</script></head><body><h1>Deals</h1><p>Track deals through stages.</p></body></html>", 1_000), "Deals\n\nTrack deals through stages.");
    assert.equal(pageText(`<p>${"word ".repeat(100)}</p>`, 22), "word word word word");

    const pages = [
      { url: "a", text: "short" },
      { url: "b", text: "x".repeat(500) },
      { url: "c", text: "y".repeat(300) },
    ];
    const capped = capPages(pages, 405);
    assert.deepEqual(capped.map((p) => [p.url, p.text.length]), [["a", 5], ["b", 200], ["c", 200]]);
    assert.deepEqual(capPages(pages, 10_000), pages);
    assert.ok(capPages(pages, 405).reduce((n, p) => n + p.text.length, 0) <= 405);
  });
});
