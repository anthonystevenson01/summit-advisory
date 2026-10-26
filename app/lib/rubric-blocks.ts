/**
 * Notion page blocks to structured blocks the method page can render as
 * HTML. Pure: no Redis, no network, no env. The Notion block interfaces live
 * here and rubrics.ts re-exports them, so the one block shape serves both
 * the text rendering the prompts use and the structured rendering the page
 * uses.
 *
 * Why a structured mode beside the text mode: the text rendering flattens
 * tables and lists into prompt lines, and the method page needs the shape
 * (which row is the header, which items make one list) to style the row
 * without re-parsing prompt text. Both modes come from one Notion fetch and
 * share the hash computed from the text rendering, so the version a visitor
 * reads on the method page is the version the synthesis was prompted with.
 *
 * Consecutive bulleted items collapse into one `bullets` block and
 * consecutive numbered items into one `numbered` block; a different block
 * type ends the run. Callouts, toggles, columns, dividers, images and any
 * other type are dropped, as the text mode drops them. Rich text is the
 * plain text joined; bold and links are not carried.
 */

export interface NotionRichText {
  plain_text: string;
}

export interface NotionBlock {
  id?: string;
  type: string;
  has_children?: boolean;
  paragraph?: { rich_text: NotionRichText[] };
  heading_1?: { rich_text: NotionRichText[] };
  heading_2?: { rich_text: NotionRichText[] };
  heading_3?: { rich_text: NotionRichText[] };
  bulleted_list_item?: { rich_text: NotionRichText[] };
  numbered_list_item?: { rich_text: NotionRichText[] };
  quote?: { rich_text: NotionRichText[] };
  table?: { has_column_header?: boolean };
  table_row?: { cells: NotionRichText[][] };
  /** Table rows, attached by the loader before conversion. */
  rows?: NotionBlock[];
}

/** What the method page renders; one variant per Notion block type that is carried. */
export type RubricBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "numbered"; items: string[] }
  | { type: "quote"; text: string }
  | { type: "table"; header: boolean; rows: string[][] };

export function richText(arr: NotionRichText[] | undefined): string {
  return (arr ?? []).map((rt) => rt.plain_text).join("");
}

/** Converts page blocks in order; nothing is picked by heading, so a reordering in Notion changes the page with no deploy. */
export function notionBlocksToStructured(blocks: NotionBlock[]): RubricBlock[] {
  const out: RubricBlock[] = [];
  for (const block of blocks) {
    const last = out[out.length - 1];
    switch (block.type) {
      case "heading_1":
      case "heading_2":
      case "heading_3": {
        const level = Number(block.type.slice(-1)) as 1 | 2 | 3;
        const text = richText(block[block.type]?.rich_text).trim();
        if (text) out.push({ type: "heading", level, text });
        break;
      }
      case "paragraph": {
        const text = richText(block.paragraph?.rich_text).trim();
        if (text) out.push({ type: "paragraph", text });
        break;
      }
      case "quote": {
        const text = richText(block.quote?.rich_text).trim();
        if (text) out.push({ type: "quote", text });
        break;
      }
      case "bulleted_list_item": {
        const text = richText(block.bulleted_list_item?.rich_text).trim();
        if (!text) break;
        if (last && last.type === "bullets") last.items.push(text);
        else out.push({ type: "bullets", items: [text] });
        break;
      }
      case "numbered_list_item": {
        const text = richText(block.numbered_list_item?.rich_text).trim();
        if (!text) break;
        if (last && last.type === "numbered") last.items.push(text);
        else out.push({ type: "numbered", items: [text] });
        break;
      }
      case "table": {
        const rows = (block.rows ?? [])
          .filter((r) => r.type === "table_row")
          .map((row) => (row.table_row?.cells ?? []).map((cell) => richText(cell).trim()));
        if (rows.length > 0) out.push({ type: "table", header: Boolean(block.table?.has_column_header), rows });
        break;
      }
      default:
        break;
    }
  }
  return out;
}
