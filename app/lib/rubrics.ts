/**
 * The only reader of rubrics and system prompts.
 *
 * Reads the Notion "Tool Rubrics" database (NOTION_RUBRICS_DB_ID) with
 * NOTION_TOKEN, server side only. One row per tool. The page body is the
 * rubric; the System Prompt property is the prompt.
 *
 * Published only. The query filters Status = Published, so a Draft row is
 * invisible to the site. That is the editing workflow: edit the row as Draft,
 * flip it to Published when the text is agreed, and the next cache miss picks
 * it up. Setting a row back to Draft takes that one tool offline (the route
 * answers 503 "rubric not published") without a deploy. A missing row throws
 * rather than scoring against no rubric.
 *
 * Two cache layers. Redis at `rubric:{tool}` for 10 minutes is shared across
 * instances and is what the /admin/rubrics refresh button clears. A per
 * instance memory map for 60 seconds avoids a Redis read on most calls while
 * still letting a warm instance see a refresh within a minute. Errors are
 * never cached, so a Notion outage does not pin a failure.
 *
 * The hash (SHA-256 of rubric plus prompt) is returned with every load and the
 * pipeline writes it onto every run, so a stored score can always be tied to
 * the exact text that produced it. Never logs the token or the rubric text.
 *
 * Two modes read the same row. `getRubric` returns the text rendering the
 * prompts use; `getRubricBlocks` returns the structured blocks the Built to
 * Scale? method page renders, with the same hash (computed from the text
 * rendering) so the page and the synthesis report one version. Each mode has
 * its own cache keys (`rubric:{slug}`, `rubric-blocks:{slug}`).
 */
import { createHash } from "node:crypto";
import { getRedis } from "./redis.ts";
import { TOOL_SLUGS } from "./tools/registry.ts";
import { BUILT_TO_SCALE_TOOL } from "./tools/built-to-scale-method.ts";
import { notionBlocksToStructured, richText, type NotionBlock, type NotionRichText, type RubricBlock } from "./rubric-blocks.ts";

export type { NotionBlock, NotionRichText, RubricBlock };

export interface Rubric {
  systemPrompt: string;
  rubric: string;
  version: number;
  hash: string;
  fetchedAt: string;
}

export interface RubricBlocks {
  blocks: RubricBlock[];
  version: number;
  hash: string;
  fetchedAt: string;
}

export class RubricNotPublishedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RubricNotPublishedError";
  }
}

const NOTION_VERSION = "2022-06-28";
const REDIS_TTL_SECONDS = 600;
const MEMORY_TTL_MS = 60_000;

const memory = new Map<string, { value: Rubric; at: number }>();
const blocksMemory = new Map<string, { value: RubricBlocks; at: number }>();

export function rubricKey(slug: string): string {
  return `rubric:${slug}`;
}

export function rubricBlocksKey(slug: string): string {
  return `rubric-blocks:${slug}`;
}

// ── Notion block to text ─────────────────────────────────────────────────────

/**
 * Converts page blocks to plain text. Handles paragraph, headings, bullets,
 * numbered items, quotes and tables (rows attached as `rows`, cells joined
 * with ` | `, a dashed separator after a header row).
 */
export function notionBlocksToText(blocks: NotionBlock[]): string {
  const lines: string[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case "paragraph":
        lines.push(richText(block.paragraph?.rich_text));
        break;
      case "heading_1":
        lines.push(`# ${richText(block.heading_1?.rich_text)}`);
        break;
      case "heading_2":
        lines.push(`## ${richText(block.heading_2?.rich_text)}`);
        break;
      case "heading_3":
        lines.push(`### ${richText(block.heading_3?.rich_text)}`);
        break;
      case "bulleted_list_item":
        lines.push(`• ${richText(block.bulleted_list_item?.rich_text)}`);
        break;
      case "numbered_list_item":
        lines.push(richText(block.numbered_list_item?.rich_text));
        break;
      case "quote":
        lines.push(`> ${richText(block.quote?.rich_text)}`);
        break;
      case "table": {
        const rows = (block.rows ?? []).filter((r) => r.type === "table_row");
        rows.forEach((row, i) => {
          const cells = (row.table_row?.cells ?? []).map((cell) => richText(cell).trim());
          lines.push(cells.join(" | "));
          if (i === 0 && block.table?.has_column_header && cells.length > 0) {
            lines.push(cells.map((c) => "-".repeat(Math.max(3, c.length))).join(" | "));
          }
        });
        break;
      }
      default:
        break;
    }
  }
  return lines.filter((l) => l.length > 0).join("\n");
}

// ── Notion API ───────────────────────────────────────────────────────────────

function notionHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

async function fetchChildren(blockId: string, token: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;
  do {
    const url = new URL(`https://api.notion.com/v1/blocks/${blockId}/children`);
    url.searchParams.set("page_size", "100");
    if (cursor) url.searchParams.set("start_cursor", cursor);
    const res = await fetch(url, { headers: notionHeaders(token) });
    if (!res.ok) throw new Error(`Notion blocks request failed with status ${res.status}`);
    const data = (await res.json()) as { results?: NotionBlock[]; has_more?: boolean; next_cursor?: string | null };
    blocks.push(...(data.results ?? []));
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

interface NotionPage {
  id: string;
  properties: Record<string, { type: string; number?: number | null; rich_text?: NotionRichText[]; title?: NotionRichText[] }>;
}

async function findPublishedRow(slug: string, token: string, dbId: string): Promise<NotionPage> {
  const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: "POST",
    headers: notionHeaders(token),
    body: JSON.stringify({
      page_size: 1,
      filter: {
        and: [
          { property: "Tool Key", title: { equals: slug } },
          { property: "Status", select: { equals: "Published" } },
        ],
      },
    }),
  });
  if (!res.ok) throw new Error(`Notion query failed with status ${res.status}`);
  const data = (await res.json()) as { results?: NotionPage[] };
  const page = data.results?.[0];
  if (!page) throw new RubricNotPublishedError(`rubric not published: ${slug}`);
  return page;
}

interface LoadedRow {
  systemPrompt: string;
  version: number;
  blocks: NotionBlock[];
  /** The text rendering of the blocks; the hash input for both modes. */
  rubric: string;
  hash: string;
}

/** The Published lookup and block fetch shared by both modes. */
async function loadRow(slug: string): Promise<LoadedRow> {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_RUBRICS_DB_ID;
  if (!token || !dbId) throw new RubricNotPublishedError("rubric source not configured");

  const page = await findPublishedRow(slug, token, dbId);
  const version = page.properties["Version"]?.number ?? 0;
  const systemPrompt = richText(page.properties["System Prompt"]?.rich_text).trim();

  const blocks = await fetchChildren(page.id, token);
  for (const block of blocks) {
    if (block.type === "table" && block.id) {
      block.rows = await fetchChildren(block.id, token);
    }
  }
  const rubric = notionBlocksToText(blocks).trim();
  if (!rubric) throw new RubricNotPublishedError(`rubric not published: ${slug}`);

  const hash = createHash("sha256").update(`${rubric}\n${systemPrompt}`).digest("hex");
  return { systemPrompt, version, blocks, rubric, hash };
}

async function loadFromNotion(slug: string): Promise<Rubric> {
  const row = await loadRow(slug);
  return { systemPrompt: row.systemPrompt, rubric: row.rubric, version: row.version, hash: row.hash, fetchedAt: new Date().toISOString() };
}

async function loadBlocksFromNotion(slug: string): Promise<RubricBlocks> {
  const row = await loadRow(slug);
  return { blocks: notionBlocksToStructured(row.blocks), version: row.version, hash: row.hash, fetchedAt: new Date().toISOString() };
}

// ── Public API ───────────────────────────────────────────────────────────────

function isRubric(value: unknown): value is Rubric {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.rubric === "string" && typeof v.systemPrompt === "string" && typeof v.hash === "string";
}

/** Memory, then Redis, then Notion. Errors are not cached. */
export async function getRubric(slug: string): Promise<Rubric> {
  const cached = memory.get(slug);
  if (cached && Date.now() - cached.at < MEMORY_TTL_MS) return cached.value;

  let redisHit: Rubric | null = null;
  try {
    const raw = await getRedis().get<unknown>(rubricKey(slug));
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (isRubric(parsed)) redisHit = parsed;
  } catch {
    // Redis unavailable or malformed: fall through to Notion
  }
  if (redisHit) {
    memory.set(slug, { value: redisHit, at: Date.now() });
    return redisHit;
  }

  const fresh = await loadFromNotion(slug);
  memory.set(slug, { value: fresh, at: Date.now() });
  try {
    await getRedis().set(rubricKey(slug), JSON.stringify(fresh), { ex: REDIS_TTL_SECONDS });
  } catch {
    // caching is best effort
  }
  return fresh;
}

function isRubricBlocks(value: unknown): value is RubricBlocks {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.blocks) && typeof v.hash === "string";
}

/**
 * Structured mode: the row's blocks for the method page. Memory, then Redis
 * (`rubric-blocks:{slug}`, 600 s), then Notion. Errors are not cached and
 * are the same RubricNotPublishedError as the text mode. The hash is the
 * text mode's hash for the same row, so the method page can state the
 * version the synthesis reads; the admin refresh clears both caches.
 */
export async function getRubricBlocks(slug: string): Promise<RubricBlocks> {
  const cached = blocksMemory.get(slug);
  if (cached && Date.now() - cached.at < MEMORY_TTL_MS) return cached.value;

  let redisHit: RubricBlocks | null = null;
  try {
    const raw = await getRedis().get<unknown>(rubricBlocksKey(slug));
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (isRubricBlocks(parsed)) redisHit = parsed;
  } catch {
    // Redis unavailable or malformed: fall through to Notion
  }
  if (redisHit) {
    blocksMemory.set(slug, { value: redisHit, at: Date.now() });
    return redisHit;
  }

  const fresh = await loadBlocksFromNotion(slug);
  blocksMemory.set(slug, { value: fresh, at: Date.now() });
  try {
    await getRedis().set(rubricBlocksKey(slug), JSON.stringify(fresh), { ex: REDIS_TTL_SECONDS });
  } catch {
    // caching is best effort
  }
  return fresh;
}

/** Deletes `rubric:{slug}` and `rubric-blocks:{slug}` for every registry slug and built-to-scale, and empties both memory maps. */
export async function clearRubricCache(): Promise<void> {
  memory.clear();
  blocksMemory.clear();
  const slugs = [...TOOL_SLUGS, BUILT_TO_SCALE_TOOL];
  const keys = slugs.flatMap((slug) => [rubricKey(slug), rubricBlocksKey(slug)]);
  await getRedis().del(...keys);
}
