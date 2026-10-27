/**
 * The Notion writer for Project Builder briefs: creates the page in the
 * "Project Briefs" database (NOTION_BRIEFS_DB_ID) on the first save,
 * updates its properties on submit and on every admin status change,
 * appends the body on submit, and archives the page when a brief is
 * deleted. The page shape itself is the pure builder in
 * project-builder/notion-brief.ts; this file is the fetch and the retries.
 *
 * Every call returns a value and never throws: a 429, a 5xx or a thrown
 * fetch is retried up to three attempts in all with 1 s then 2 s between,
 * each attempt under an 8 s timeout; any other 4xx is final (a missing or
 * mistyped property is a 400 that no retry would fix). The error string
 * never contains the token. Worst case about 30 s, which is why the save
 * and submit routes write Notion before the mails and check the time budget
 * between side effects.
 */
import { NOTION_VERSION } from "./rubrics.ts";
import { briefPageBlocks, briefPageProperties, chunkBlocks, type BriefPageArgs, type NotionBlock } from "./project-builder/notion-brief.ts";
import type { BriefRecord } from "./briefs.ts";

const NOTION_API = "https://api.notion.com/v1";
const ATTEMPT_TIMEOUT_MS = 8_000;
const WAITS_MS = [1_000, 2_000];

export type NotionWriteResult = { ok: true; pageId: string } | { ok: false; error: string };

export function isNotionBriefsConfigured(): boolean {
  return Boolean(process.env.NOTION_TOKEN?.trim() && process.env.NOTION_BRIEFS_DB_ID?.trim());
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.NOTION_TOKEN ?? ""}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Attempt = { ok: true; body: Record<string, unknown> } | { ok: false; status: number; error: string };

async function once(method: "POST" | "PATCH", path: string, payload: unknown): Promise<Attempt> {
  try {
    const res = await fetch(`${NOTION_API}/${path}`, {
      method,
      headers: headers(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
    });
    if (res.ok) {
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return { ok: true, body };
    }
    let message = "";
    try {
      const body = (await res.json()) as { message?: string };
      message = typeof body.message === "string" ? body.message.slice(0, 200) : "";
    } catch {
      // no JSON body
    }
    return { ok: false, status: res.status, error: `Notion ${res.status}${message ? `: ${message}` : ""}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, error: `Notion request failed: ${message.slice(0, 200)}` };
  }
}

/** Three attempts in all on a 429, a 5xx or a thrown fetch; any other 4xx is final. */
async function request(method: "POST" | "PATCH", path: string, payload: unknown): Promise<Attempt> {
  let last: Attempt = { ok: false, status: 0, error: "not attempted" };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await sleep(WAITS_MS[attempt - 1]);
    last = await once(method, path, payload);
    if (last.ok) return last;
    const retryable = last.status === 0 || last.status === 429 || last.status >= 500;
    if (!retryable) return last;
  }
  return last;
}

function pageArgs(brief: BriefRecord, source: string | null, adminUrl: string): BriefPageArgs {
  return {
    id: brief.id,
    state: brief.state,
    source,
    contact: { name: brief.contact.name, email: brief.contact.email, company: brief.contact.company, website: brief.contact.website },
    sourceTag: brief.sourceTag,
    status: brief.status,
    submittedAt: brief.submittedAt,
    adminUrl,
  };
}

async function appendChildren(pageId: string, chunks: NotionBlock[][]): Promise<string | null> {
  for (const chunk of chunks) {
    const r = await request("PATCH", `blocks/${pageId}/children`, { children: chunk });
    if (!r.ok) return r.error;
  }
  return null;
}

/** POSTs the page with its properties and the first 100 body blocks, then appends further chunks. */
export async function createBriefPage(brief: BriefRecord, source: string | null, adminUrl: string): Promise<NotionWriteResult> {
  if (!isNotionBriefsConfigured()) return { ok: false, error: "Notion briefs database not configured" };
  const args = pageArgs(brief, source, adminUrl);
  const [first, ...rest] = chunkBlocks(briefPageBlocks(args));
  const r = await request("POST", "pages", {
    parent: { database_id: process.env.NOTION_BRIEFS_DB_ID },
    properties: briefPageProperties(args),
    children: first ?? [],
  });
  if (!r.ok) return { ok: false, error: r.error };
  const pageId = typeof r.body.id === "string" ? r.body.id : "";
  if (!pageId) return { ok: false, error: "Notion answered without a page id" };
  if (rest.length > 0) {
    const error = await appendChildren(pageId, rest);
    if (error) return { ok: false, error };
  }
  return { ok: true, pageId };
}

/** PATCHes the properties; with `appendBody`, PATCHes the body in chunks of 100 after them. */
export async function updateBriefPage(
  brief: BriefRecord,
  source: string | null,
  adminUrl: string,
  options: { appendBody: boolean },
): Promise<NotionWriteResult> {
  if (!isNotionBriefsConfigured()) return { ok: false, error: "Notion briefs database not configured" };
  if (!brief.notionPageId) return { ok: false, error: "no Notion page id on the brief" };
  const args = pageArgs(brief, source, adminUrl);
  const r = await request("PATCH", `pages/${brief.notionPageId}`, { properties: briefPageProperties(args) });
  if (!r.ok) return { ok: false, error: r.error };
  if (options.appendBody) {
    const error = await appendChildren(brief.notionPageId, chunkBlocks(briefPageBlocks(args)));
    if (error) return { ok: false, error };
  }
  return { ok: true, pageId: brief.notionPageId };
}

/** Best effort: Notion has no delete through the API, so a deleted brief's page is archived. */
export async function archiveBriefPage(pageId: string): Promise<boolean> {
  if (!isNotionBriefsConfigured() || !pageId) return false;
  const r = await request("PATCH", `pages/${pageId}`, { archived: true });
  return r.ok;
}
