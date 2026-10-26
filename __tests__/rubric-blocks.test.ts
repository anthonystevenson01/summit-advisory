/**
 * Notion blocks to structured blocks for the method page.
 *
 * Runs on Node's built-in test runner with native TypeScript type stripping
 * (Node >= 22.18 / 23.6). No extra dependencies: `npm test`.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { notionBlocksToStructured, type NotionBlock } from "../app/lib/rubric-blocks.ts";

const rt = (text: string) => [{ plain_text: text }];

const BLOCKS: NotionBlock[] = [
  { type: "heading_2", heading_2: { rich_text: rt("The five dimensions") } },
  { type: "paragraph", paragraph: { rich_text: rt("Each is scored 1 to 5.") } },
  { type: "paragraph", paragraph: { rich_text: rt("   ") } },
  { type: "bulleted_list_item", bulleted_list_item: { rich_text: rt("First rule") } },
  { type: "bulleted_list_item", bulleted_list_item: { rich_text: rt("Second rule") } },
  { type: "callout", paragraph: { rich_text: rt("Editorial note for Anthony") } },
  { type: "numbered_list_item", numbered_list_item: { rich_text: rt("Read the parts. Then the tool results.") } },
  { type: "numbered_list_item", numbered_list_item: { rich_text: rt("Grade each dimension.") } },
  { type: "quote", quote: { rich_text: rt("A founder would repeat it.") } },
  {
    type: "table",
    table: { has_column_header: true },
    rows: [
      { type: "table_row", table_row: { cells: [rt("Dimension"), rt(" 1 "), rt("5")] } },
      { type: "table_row", table_row: { cells: [rt("Pain"), rt("Nobody owns it"), rt("Paid for")] } },
    ],
  },
  { type: "bulleted_list_item", bulleted_list_item: { rich_text: rt("After the table") } },
  { type: "heading_1", heading_1: { rich_text: rt("Top") } },
  { type: "heading_3", heading_3: { rich_text: rt("Small") } },
  { type: "divider" },
];

describe("notionBlocksToStructured", () => {
  const blocks = notionBlocksToStructured(BLOCKS);

  test("maps headings with their level, drops empty paragraphs and unknown types", () => {
    assert.deepEqual(blocks[0], { type: "heading", level: 2, text: "The five dimensions" });
    assert.deepEqual(blocks[1], { type: "paragraph", text: "Each is scored 1 to 5." });
    assert.equal(blocks.some((b) => b.type === "paragraph" && b.text.includes("Anthony")), false);
    assert.deepEqual(blocks[blocks.length - 2], { type: "heading", level: 1, text: "Top" });
    assert.deepEqual(blocks[blocks.length - 1], { type: "heading", level: 3, text: "Small" });
  });

  test("collapses consecutive list items and ends a run on another type", () => {
    assert.deepEqual(blocks[2], { type: "bullets", items: ["First rule", "Second rule"] });
    assert.deepEqual(blocks[3], { type: "numbered", items: ["Read the parts. Then the tool results.", "Grade each dimension."] });
    assert.deepEqual(blocks[6], { type: "bullets", items: ["After the table"] });
  });

  test("carries quotes and tables with trimmed cells and the header flag", () => {
    assert.deepEqual(blocks[4], { type: "quote", text: "A founder would repeat it." });
    assert.deepEqual(blocks[5], {
      type: "table",
      header: true,
      rows: [
        ["Dimension", "1", "5"],
        ["Pain", "Nobody owns it", "Paid for"],
      ],
    });
  });

  test("an empty list gives an empty result", () => {
    assert.deepEqual(notionBlocksToStructured([]), []);
  });
});
