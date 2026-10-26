/**
 * The prospect report model: slug rules, the row merge and the edited flag,
 * total and band, expiry, the hash reader, state changes, the public view,
 * the slide view and image data, the Gradeshow edit set, preview fetchers,
 * the copy, and that reports stay out of robots and the sitemap.
 *
 * Pure modules only. Runs on Node's built-in test runner with native
 * TypeScript type stripping: `npm test`.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { BOOK_CALL_URL, CONTACT_EMAIL } from "../app/lib/brand.ts";
import { BTS_PARTS, BTS_PART_KEYS, type CompositeFullView, type WorkingEntry } from "../app/lib/tools/built-to-scale-method.ts";
import {
  CTA_LABEL,
  EDITED_NOTE,
  IMAGE_BOX_MAX,
  IMAGE_OPENING_MAX,
  PLACEHOLDER_TEXT,
  REPORT_COPY,
  SLIDE_MARK,
  applyStateChange,
  defaultExpiry,
  expiryFromDate,
  gradeshowEdits,
  isExpired,
  isPlaceholderSlug,
  isPreviewFetcher,
  isValidSlug,
  mergeRows,
  paragraphsOf,
  placeholderSlugFor,
  publicViewOf,
  readReportHash,
  recomputeTotal,
  reportImageData,
  reportRerunHref,
  slideViewOf,
  slugify,
  todayIso,
  type OriginalRow,
  type ReportRecord,
} from "../app/lib/tools/report-model.ts";
import robots from "../app/robots.ts";
import sitemap from "../app/sitemap.ts";

const DASH_RE = /[–—]/;
const NOW = Date.parse("2026-10-26T10:00:00.000Z");

const ORIGINALS: OriginalRow[] = [
  { key: "pain", grade: 4, comment: "Pain comment." },
  { key: "routeToBuyer", grade: 3, comment: "Route comment." },
  { key: "unitOfValue", grade: 2, comment: "Unit comment." },
  { key: "valueEvidence", grade: 3, comment: "Evidence comment." },
  { key: "abilityToProtect", grade: 3, comment: "Protect comment." },
];

function reportOf(overrides: Partial<ReportRecord> = {}): ReportRecord {
  const rows = mergeRows(ORIGINALS);
  const { total, bandKey, band } = recomputeTotal(rows);
  return {
    slug: "gradeshow",
    company: "Gradeshow",
    runId: "run_0123456789abcdef",
    state: "published",
    asOf: "2026-10-26",
    expiresAt: null,
    accessCode: null,
    opening: "First paragraph.\n\nSecond paragraph.",
    productThoughts: "Product one.\n\nProduct two.",
    moonshot: "Moon one.",
    rows,
    total,
    bandKey,
    band,
    createdAt: "2026-10-26T09:00:00.000Z",
    updatedAt: "2026-10-26T09:00:00.000Z",
    publishedAt: null,
    firstOpenedAt: null,
    lastOpenedAt: null,
    openCount: 0,
    rerunCount: 0,
    ...overrides,
  };
}

function workingEntry(tool: string, runId: string): WorkingEntry {
  return { tool: tool as WorkingEntry["tool"], name: `${tool} tool`, number: "01", runId, full: null };
}

function compositeOf(): CompositeFullView {
  return {
    runId: "run_0123456789abcdef",
    tool: "built-to-scale",
    total: 15,
    band: "Built to scale, with work to do",
    bandKey: "work",
    verdict: "A verdict.",
    strongest: "Pain",
    weakest: "Unit of value",
    oneChange: "One change.",
    confidence: "medium",
    confidenceReason: "Because.",
    quickMode: false,
    createdAt: "2026-10-20T09:00:00.000Z",
    absentTools: [],
    unlocked: true,
    rows: BTS_PARTS.map((part, i) => ({
      key: part.key,
      name: part.name,
      grade: 3,
      comment: `Run comment ${i}.`,
      sources: [],
      feeds: [{ tool: "moat", name: "Moat Rater", number: "05" }],
      working: [workingEntry("moat", `run_${String(i).repeat(16)}`)],
    })),
  };
}

describe("slugs", () => {
  test("isValidSlug accepts the rule and rejects the rest", () => {
    assert.equal(isValidSlug("gradeshow"), true);
    assert.equal(isValidSlug("acme-2026"), true);
    assert.equal(isValidSlug("abc"), true);
    assert.equal(isValidSlug("a".repeat(60)), true);
    assert.equal(isValidSlug("Gradeshow"), false);
    assert.equal(isValidSlug("ab"), false);
    assert.equal(isValidSlug("a".repeat(61)), false);
    assert.equal(isValidSlug("grade show"), false);
    assert.equal(isValidSlug("grade_show"), false);
    assert.equal(isValidSlug("-gradeshow"), false);
    assert.equal(isValidSlug("gradeshow-"), false);
    assert.equal(isValidSlug("grade--show"), false);
    assert.equal(isValidSlug(42), false);
  });

  test("slugify lowercases, strips, hyphenates, cuts at a hyphen and pads short results", () => {
    assert.equal(slugify("Gradeshow Ltd."), "gradeshow-ltd");
    assert.equal(slugify("Café Société"), "cafe-societe");
    const long = slugify(Array.from({ length: 20 }, (_, i) => `word${i}`).join(" "));
    assert.ok(long.length <= 60 && long.length >= 3, long);
    assert.equal(isValidSlug(long), true);
    assert.ok(!long.endsWith("-"));
    assert.equal(slugify("AB"), "ab-report");
    assert.equal(slugify(""), "report");
  });

  test("placeholder slugs are valid and recognised", () => {
    const slug = placeholderSlugFor("run_0123456789abcdef");
    assert.equal(slug, "draft-89abcdef");
    assert.equal(isValidSlug(slug), true);
    assert.equal(isPlaceholderSlug(slug), true);
    assert.equal(isPlaceholderSlug("gradeshow"), false);
  });
});

describe("mergeRows", () => {
  test("unchanged grade and comment gives edited false", () => {
    const rows = mergeRows(ORIGINALS, { pain: { grade: 4, comment: "Pain comment." } });
    assert.equal(rows[0].edited, false);
    assert.equal(rows[0].original.grade, 4);
  });

  test("a changed grade, a changed comment, or both give edited true", () => {
    assert.equal(mergeRows(ORIGINALS, { pain: { grade: 3 } })[0].edited, true);
    assert.equal(mergeRows(ORIGINALS, { pain: { comment: "New." } })[0].edited, true);
    const both = mergeRows(ORIGINALS, { pain: { grade: 2, comment: "New." } })[0];
    assert.equal(both.edited, true);
    assert.equal(both.grade, 2);
    assert.equal(both.comment, "New.");
  });

  test("whitespace around a comment is not a change", () => {
    assert.equal(mergeRows(ORIGINALS, { pain: { comment: "  Pain comment. \n" } })[0].edited, false);
  });

  test("rows come back in method order whatever the input order, and a missing edit keeps the original", () => {
    const shuffled = [...ORIGINALS].reverse();
    const rows = mergeRows(shuffled, { unitOfValue: { grade: 5 } });
    assert.deepEqual(rows.map((r) => r.key), BTS_PART_KEYS);
    assert.equal(rows[2].grade, 5);
    assert.equal(rows[2].edited, true);
    assert.equal(rows[4].grade, 3);
    assert.equal(rows[4].comment, "Protect comment.");
    assert.equal(rows[4].edited, false);
  });

  test("a missing original is grade 1 with an empty comment, and grades are clamped", () => {
    const rows = mergeRows([{ key: "pain", grade: 9, comment: "x" }], { pain: { grade: 0 } });
    assert.equal(rows[0].original.grade, 5);
    assert.equal(rows[0].grade, 1);
    assert.equal(rows[1].grade, 1);
    assert.equal(rows[1].comment, "");
  });
});

describe("recomputeTotal", () => {
  test("the four bands at the boundaries", () => {
    const gradesFor = (total: number) => {
      const base = Math.floor(total / 5);
      let rest = total - base * 5;
      return BTS_PARTS.map((p) => ({ key: p.key, grade: base + (rest-- > 0 ? 1 : 0), comment: "" }));
    };
    const expect: Array<[number, string]> = [
      [5, "A hard model"],
      [9, "A hard model"],
      [10, "A good idea with an engine still to build"],
      [14, "A good idea with an engine still to build"],
      [15, "Built to scale, with work to do"],
      [19, "Built to scale, with work to do"],
      [20, "Built to scale"],
      [25, "Built to scale"],
    ];
    for (const [total, band] of expect) {
      const result = recomputeTotal(mergeRows(gradesFor(total)));
      assert.equal(result.total, total);
      assert.equal(result.band, band, String(total));
    }
  });
});

describe("expiry and dates", () => {
  test("isExpired at the limit and past it", () => {
    const expiresAt = new Date(NOW).toISOString();
    assert.equal(isExpired({ expiresAt }, NOW - 1), false);
    assert.equal(isExpired({ expiresAt }, NOW), true);
    assert.equal(isExpired({ expiresAt }, NOW + 1000), true);
    assert.equal(isExpired({ expiresAt: null }, NOW), false);
  });

  test("defaultExpiry is 30 days after publish", () => {
    assert.equal(Date.parse(defaultExpiry(NOW)) - NOW, 30 * 24 * 60 * 60 * 1000);
  });

  test("expiryFromDate is the end of that day in UTC, null when malformed", () => {
    assert.equal(expiryFromDate("2026-11-25"), "2026-11-25T23:59:59.999Z");
    assert.equal(expiryFromDate("2026-13-01"), null);
    assert.equal(expiryFromDate("25/11/2026"), null);
    assert.equal(expiryFromDate(""), null);
  });

  test("todayIso yields YYYY-MM-DD", () => {
    assert.match(todayIso(NOW), /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(todayIso(NOW), "2026-10-26");
  });
});

describe("readReportHash", () => {
  const stored = () => {
    const r = reportOf({ openCount: 3 });
    return {
      slug: r.slug,
      company: r.company,
      runId: r.runId,
      state: r.state,
      asOf: r.asOf,
      expiresAt: "null",
      accessCode: "null",
      opening: r.opening,
      productThoughts: r.productThoughts,
      moonshot: r.moonshot,
      rows: JSON.stringify(r.rows),
      total: String(r.total),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      publishedAt: "null",
      firstOpenedAt: "null",
      lastOpenedAt: "null",
      openCount: "3",
      rerunCount: 0,
    } as Record<string, unknown>;
  };

  test("accepts rows as a JSON string and as an array, counters as strings and numbers, accessCode as null and as an object", () => {
    const a = readReportHash(stored());
    assert.ok(a);
    assert.equal(a.rows.length, 5);
    assert.equal(a.openCount, 3);
    assert.equal(a.rerunCount, 0);
    assert.equal(a.accessCode, null);
    assert.equal(a.expiresAt, null);
    assert.equal(a.total, 15);
    assert.equal(a.band, "Built to scale, with work to do");

    const parsed = stored();
    parsed.rows = JSON.parse(parsed.rows as string);
    parsed.openCount = 4;
    parsed.accessCode = { salt: "ab", hash: "cd" };
    const b = readReportHash(parsed);
    assert.ok(b);
    assert.equal(b.openCount, 4);
    assert.deepEqual(b.accessCode, { salt: "ab", hash: "cd" });
    const c = readReportHash({ ...stored(), accessCode: JSON.stringify({ salt: "ab", hash: "cd" }) });
    assert.deepEqual(c?.accessCode, { salt: "ab", hash: "cd" });
  });

  test("returns null without a slug, a run id, or five rows", () => {
    assert.equal(readReportHash({ ...stored(), slug: "" }), null);
    assert.equal(readReportHash({ ...stored(), runId: undefined }), null);
    const four = reportOf().rows.slice(0, 4);
    assert.equal(readReportHash({ ...stored(), rows: JSON.stringify(four) }), null);
    assert.equal(readReportHash(null), null);
    assert.equal(readReportHash({}), null);
  });

  test("clamps grades to 1 to 5", () => {
    const rows = reportOf().rows.map((r) => ({ ...r, grade: 9, original: { ...r.original, grade: 0 } }));
    const r = readReportHash({ ...stored(), rows: JSON.stringify(rows) });
    assert.ok(r);
    assert.equal(r.rows[0].grade, 5);
    assert.equal(r.rows[0].original.grade, 1);
    assert.equal(r.total, 25);
  });
});

describe("applyStateChange", () => {
  test("draft to published sets publishedAt and a 30 day expiry, keeps a future expiry, replaces a past one", () => {
    const draft = reportOf({ state: "draft" });
    const a = applyStateChange(draft, "published", NOW);
    assert.equal(a.event, "report_published");
    assert.equal(a.patch.state, "published");
    assert.equal(a.patch.publishedAt, new Date(NOW).toISOString());
    assert.equal(a.patch.expiresAt, defaultExpiry(NOW));

    const future = new Date(NOW + 5 * 24 * 60 * 60 * 1000).toISOString();
    const b = applyStateChange(reportOf({ state: "draft", expiresAt: future }), "published", NOW);
    assert.equal(b.patch.expiresAt, undefined);

    const past = new Date(NOW - 1000).toISOString();
    const c = applyStateChange(reportOf({ state: "unpublished", expiresAt: past }), "published", NOW);
    assert.equal(c.patch.expiresAt, defaultExpiry(NOW));
    assert.equal(c.event, "report_published");
  });

  test("published to unpublished returns report_unpublished; other transitions none; a second publish keeps the first publishedAt", () => {
    assert.equal(applyStateChange(reportOf({ state: "published" }), "unpublished", NOW).event, "report_unpublished");
    assert.equal(applyStateChange(reportOf({ state: "draft" }), "unpublished", NOW).event, null);
    assert.equal(applyStateChange(reportOf({ state: "published" }), "published", NOW).event, null);
    const first = "2026-10-01T00:00:00.000Z";
    const again = applyStateChange(reportOf({ state: "unpublished", publishedAt: first, expiresAt: defaultExpiry(NOW) }), "published", NOW);
    assert.equal(again.patch.publishedAt, undefined);
    assert.equal(again.event, "report_published");
    assert.ok(again.patch.updatedAt);
  });
});

describe("paragraphsOf", () => {
  test("splits on blank lines, trims, drops empties", () => {
    assert.deepEqual(paragraphsOf("  One. \n\n\nTwo.\n \n\nThree.  \n\n"), ["One.", "Two.", "Three."]);
    assert.deepEqual(paragraphsOf(""), []);
  });
});

describe("publicViewOf", () => {
  test("the edited note only when a row is edited", () => {
    const clean = publicViewOf(reportOf(), compositeOf());
    assert.equal(clean.label, "");
    assert.equal(clean.anyEdited, false);
    const edited = publicViewOf(reportOf({ rows: mergeRows(ORIGINALS, { pain: { grade: 2 } }) }), compositeOf());
    assert.equal(edited.label, EDITED_NOTE);
    assert.equal(edited.anyEdited, true);
  });

  test("CTA, contact, caveat and the as-of label", () => {
    const view = publicViewOf(reportOf(), compositeOf());
    assert.equal(view.ctaUrl, BOOK_CALL_URL);
    assert.equal(view.ctaLabel, CTA_LABEL);
    assert.equal(view.contactEmail, CONTACT_EMAIL);
    assert.equal(view.asOfLabel, "26 October 2026");
    assert.deepEqual(view.opening, ["First paragraph.", "Second paragraph."]);
  });

  test("every working entry carries the report re-run link", () => {
    const view = publicViewOf(reportOf(), compositeOf());
    assert.equal(view.workingAvailable, true);
    for (const row of view.working) {
      assert.equal(row.entries.length, 1);
      const entry = row.entries[0];
      assert.equal(entry.rerunHref, `/tools/moat?prefill=${entry.runId}&via=report&report=gradeshow`);
      assert.match(entry.rerunHref, /via=report&report=gradeshow$/);
    }
    assert.equal(reportRerunHref("moat", "run_1", "a b"), "/tools/moat?prefill=run_1&via=report&report=a%20b");
  });

  test("the scorecard projection has five rows with string comments, an empty verdict and empty compact cells", () => {
    const { scorecard } = publicViewOf(reportOf(), compositeOf());
    assert.equal(scorecard.rows.length, 5);
    for (const row of scorecard.rows) assert.equal(typeof row.comment, "string");
    assert.equal(scorecard.rows[0].comment, "Pain comment.");
    assert.equal(scorecard.verdict, "");
    assert.equal(scorecard.strongest, "");
    assert.equal(scorecard.weakest, "");
    assert.equal(scorecard.oneChange, "");
    assert.equal(scorecard.total, 15);
    assert.equal(scorecard.tool, "built-to-scale");
    assert.equal(scorecard.rows[0].working.length, 1);
    assert.equal(scorecard.rows[0].feeds[0].tool, "moat");
  });

  test("with the composite gone the working is empty and unavailable", () => {
    const view = publicViewOf(reportOf(), null);
    assert.equal(view.workingAvailable, false);
    for (const row of view.working) assert.equal(row.entries.length, 0);
    for (const row of view.scorecard.rows) assert.deepEqual(row.working, []);
  });
});

describe("slideViewOf and reportImageData", () => {
  test("three boxes in order with dots per row, the first opening paragraph and the mark", () => {
    const slide = slideViewOf(reportOf());
    assert.deepEqual(slide.boxes.map((b) => b.title), ["Product thoughts", "Built to Scale?", "Moonshot"]);
    assert.deepEqual(slide.boxes.map((b) => b.kind), ["text", "scorecard", "text"]);
    const box = slide.boxes[1];
    assert.equal(box.kind, "scorecard");
    if (box.kind === "scorecard") {
      assert.equal(box.total, 15);
      assert.equal(box.band, "Built to scale, with work to do");
      assert.equal(box.rows.length, 5);
      assert.deepEqual(box.rows[1].dots, [true, true, true, false, false]);
      assert.equal(box.rows[1].name, "Route to buyer");
    }
    assert.equal(slide.opening, "First paragraph.");
    assert.equal(slide.mark, SLIDE_MARK);
    assert.equal(slide.mark, "Summit Strategy Advisory");
    assert.equal(slideViewOf(reportOf({ opening: "" })).opening, PLACEHOLDER_TEXT);
  });

  test("the image data clamps the opening and the text boxes at a word boundary with an ellipsis and keeps the dots", () => {
    const words = Array.from({ length: 80 }, (_, i) => `word${i}`).join(" ");
    const slide = slideViewOf(reportOf({ opening: words, productThoughts: `${words}\n\n${words}`, moonshot: "Short." }));
    const image = reportImageData(slide);
    assert.ok(image.opening.length <= IMAGE_OPENING_MAX + 1, String(image.opening.length));
    assert.ok(image.opening.endsWith("…"));
    assert.ok(!image.opening.includes("… "));
    const thoughts = image.boxes[0];
    if (thoughts.kind === "text") {
      assert.equal(thoughts.paragraphs.length, 1);
      assert.ok(thoughts.paragraphs[0].length <= IMAGE_BOX_MAX + 1);
      assert.ok(thoughts.paragraphs[0].endsWith("…"));
      assert.ok(!thoughts.paragraphs[0].slice(0, -1).endsWith(" "));
    }
    const moon = image.boxes[2];
    if (moon.kind === "text") assert.deepEqual(moon.paragraphs, ["Short."]);
    const card = image.boxes[1];
    if (card.kind === "scorecard") assert.deepEqual(card.rows[1].dots, [true, true, true, false, false]);
  });
});

describe("gradeshowEdits", () => {
  test("the worked example: grades 3, 2, 1, 2, 2, total 10, the engine band, company and slug", () => {
    const { company, slug, edits } = gradeshowEdits(ORIGINALS);
    assert.equal(company, "Gradeshow");
    assert.equal(slug, "gradeshow");
    const rows = mergeRows(ORIGINALS, edits);
    assert.deepEqual(rows.map((r) => r.grade), [3, 2, 1, 2, 2]);
    const { total, band } = recomputeTotal(rows);
    assert.equal(total, 10);
    assert.equal(band, "A good idea with an engine still to build");
    assert.deepEqual(rows.map((r) => r.edited), [true, true, true, true, true]);
    assert.equal(rows[0].comment, "Pain comment.");
    const alreadyThree: OriginalRow[] = [{ key: "pain", grade: 3, comment: "Same." }, ...ORIGINALS.slice(1)];
    const same = mergeRows(alreadyThree, gradeshowEdits(alreadyThree).edits);
    assert.equal(same[0].edited, false);
    assert.equal(same[1].edited, true);
  });
});

describe("isPreviewFetcher", () => {
  test("true for link preview bots, false for browsers", () => {
    for (const ua of [
      "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)",
      "Mozilla/5.0 (Windows NT 5.1; rv:11.0) Gecko Firefox/11.0 (via ggpht.com GoogleImageProxy)",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      "Twitterbot/1.0",
      "WhatsApp/2.23.20.0",
    ]) {
      assert.equal(isPreviewFetcher(ua), true, ua);
    }
    assert.equal(isPreviewFetcher("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"), false);
    assert.equal(isPreviewFetcher("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"), false);
    assert.equal(isPreviewFetcher(null), false);
  });
});

describe("copy, robots and sitemap", () => {
  test("no copy constant carries an en dash, an em dash or a spaced hyphen", () => {
    for (const [name, value] of Object.entries(REPORT_COPY)) {
      assert.doesNotMatch(value, DASH_RE, name);
      assert.ok(!value.includes(" - "), name);
    }
  });

  test("robots disallows /report/ and the sitemap has no report URL", () => {
    const rules = robots().rules;
    const list = Array.isArray(rules) ? rules : [rules];
    const disallow = list.flatMap((r) => (Array.isArray(r.disallow) ? r.disallow : r.disallow ? [r.disallow] : []));
    assert.ok(disallow.includes("/report/"), disallow.join(", "));
    for (const entry of sitemap()) assert.ok(!entry.url.includes("/report/"), entry.url);
  });
});
