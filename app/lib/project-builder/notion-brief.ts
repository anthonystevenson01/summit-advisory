/**
 * The Notion "Project Briefs" page for a brief: the properties and the body
 * blocks, as plain objects the writer in project-builder-notion.ts sends
 * with fetch. Pure: the engine, the catalogue and the status list.
 *
 * Property names and types are a contract with a database created by hand
 * (the runbook lists them). Every rich text goes through `plainDashes` and
 * is cut at Notion's 2,000 character limit per rich text; the body is
 * chunked at 100 blocks per request by `chunkBlocks`. A `heading_1` with
 * the submission date opens the body so a resubmission appends a dated
 * second copy rather than editing blocks.
 */
import { plainDashes } from "../tools/result-email.ts";
import { COMPLIANCE, HANDOVER, PATHS, RUN_OPTIONS, STEPS } from "./catalogue.ts";
import { BRIEF_STATUSES, type BriefState, type BriefStatus } from "./brief.ts";
import { countByPriority, buildRequirements, otherIntegrations, requirementsForNotion } from "./requirements.ts";

export const NOTION_STATUS_LABELS: Record<BriefStatus, string> = Object.fromEntries(BRIEF_STATUSES.map((s) => [s.key, s.label])) as Record<BriefStatus, string>;

export const NOTION_TEXT_LIMIT = 2_000;
export const NOTION_BLOCK_CHUNK = 100;
export const PASTED_BLOCK_CAP = 10;

export interface BriefPageContact {
  name: string;
  email: string;
  company: string;
  website: string;
}

export interface BriefPageArgs {
  id: string;
  state: BriefState;
  source: string | null;
  contact: BriefPageContact;
  sourceTag: string;
  status: BriefStatus;
  submittedAt: string | null;
  adminUrl: string;
}

export type NotionProperties = Record<string, unknown>;
export type NotionBlock = Record<string, unknown>;

function rt(text: string): Array<{ type: "text"; text: { content: string } }> {
  const clean = plainDashes(text).slice(0, NOTION_TEXT_LIMIT);
  return [{ type: "text", text: { content: clean } }];
}

function title(text: string): unknown {
  return { title: rt(text) };
}

function richText(text: string): unknown {
  return { rich_text: text ? rt(text) : [] };
}

function select(name: string): unknown {
  return { select: name ? { name: plainDashes(name).slice(0, 100) } : null };
}

function number(value: number): unknown {
  return { number: value };
}

function url(value: string | null): unknown {
  return { url: value || null };
}

function date(iso: string | null): unknown {
  return { date: iso ? { start: iso } : null };
}

export function briefPageProperties(args: BriefPageArgs): NotionProperties {
  const { state, contact } = args;
  const counts = countByPriority(buildRequirements(state));
  const name = state.name.trim() || (state.idea.trim() ? state.idea.trim().slice(0, 60) : "Untitled project");
  return {
    "Project name": title(name),
    Company: richText(contact.company),
    "Contact name": richText(contact.name),
    Email: { email: contact.email || null },
    Website: url(contact.website ? `https://${contact.website}` : null),
    Source: richText(args.sourceTag),
    "Starting point": select(PATHS.find((p) => p.key === state.path)?.title ?? ""),
    "System replaced": richText(state.path === "replace" ? state.rep.sys : ""),
    Must: number(counts.Must),
    Should: number(counts.Should),
    Could: number(counts.Could),
    Budget: select(state.budget),
    Timing: select(state.timing),
    Status: select(NOTION_STATUS_LABELS[args.status]),
    Submitted: date(args.submittedAt),
    "Admin link": url(args.adminUrl),
  };
}

function heading1(text: string): NotionBlock {
  return { object: "block", type: "heading_1", heading_1: { rich_text: rt(text) } };
}

function heading2(text: string): NotionBlock {
  return { object: "block", type: "heading_2", heading_2: { rich_text: rt(text) } };
}

function paragraph(text: string): NotionBlock {
  return { object: "block", type: "paragraph", paragraph: { rich_text: rt(text) } };
}

function bullet(text: string): NotionBlock {
  return { object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: rt(text) } };
}

function tableRow(cells: string[]): NotionBlock {
  return { object: "block", type: "table_row", table_row: { cells: cells.map((c) => rt(c)) } };
}

function labelled(pairs: Array<[string, string]>): NotionBlock[] {
  return pairs.filter(([, value]) => value.trim().length > 0).map(([label, value]) => paragraph(`${label}: ${value}`));
}

function formatDate(iso: string | null): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "not submitted";
  return new Date(t).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}

export function briefPageBlocks(args: BriefPageArgs): NotionBlock[] {
  const { state } = args;
  const blocks: NotionBlock[] = [];
  blocks.push(heading1(`Submitted on ${formatDate(args.submittedAt)}`));

  blocks.push(heading2(STEPS[0]));
  const path = PATHS.find((p) => p.key === state.path)?.title ?? "";
  const step1: Array<[string, string]> = [
    ["Project name", state.name],
    ["Company website", state.biz.website],
    ["Starting point", path],
    ["Idea", state.idea],
  ];
  if (state.path === "replace" && state.rep.sys) {
    step1.push(["Replacing", state.rep.sys]);
    step1.push(["Why they are moving", state.rep.reasons.join(", ")]);
    step1.push(["Switch-over", `${state.rep.migrate ? "bring existing data across" : "no data migration"}${state.rep.parallel ? ", run both side by side for a while" : ""}`]);
  }
  blocks.push(...labelled(step1));

  blocks.push(heading2(STEPS[1]));
  blocks.push(
    ...labelled([
      ["Problem", state.problem],
      ["Who has it", state.audience],
      ["Success measure", state.success],
      ["Signs off the scope", state.signoff],
      ["Timing", state.timing],
      ["Budget", state.budget],
      ["Users", state.roles.join(", ")],
    ]),
  );

  blocks.push(heading2(STEPS[2]));
  blocks.push(
    ...labelled([
      ["Features", Object.entries(state.features).map(([k, p]) => `${k} (${p})`).join(", ")],
      ["Connections", state.integrations.concat(otherIntegrations(state)).join(", ")],
    ]),
  );

  blocks.push(heading2(STEPS[3]));
  const guard = [state.sso && "single sign-on", state.perms && "roles and permissions", state.audit && "audit trail", state.personal && "handles personal data"].filter(Boolean).join(", ");
  blocks.push(
    ...labelled([
      ["Guardrails", guard],
      ["Standards", state.compliance.filter((c) => COMPLIANCE.includes(c)).join(", ")],
      ["Data must be stored in", state.residency !== "No preference" ? state.residency : ""],
      ["Number of users", state.scale],
      ["Needs to be up", state.uptime],
      ["Who runs it after launch", RUN_OPTIONS.find((r) => r.key === state.run)?.title ?? ""],
      ["Their team's skills", state.skills],
      ["Handover should include", HANDOVER.filter((h) => state.handover.includes(h.key)).map((h) => h.title).join(", ")],
    ]),
  );

  blocks.push(heading2("Requirements"));
  const rows = requirementsForNotion(state);
  if (rows.length === 0) {
    blocks.push(paragraph("None"));
  } else {
    blocks.push({
      object: "block",
      type: "table",
      table: {
        table_width: 5,
        has_column_header: true,
        has_row_header: false,
        children: [
          tableRow(["ID", "Requirement", "Type", "Priority", "Source"]),
          ...rows.map((r) => tableRow([r.id, r.text, r.cat, r.pri, r.built ? `${r.source}, already built` : r.source])),
        ],
      },
    });
  }

  blocks.push(heading2("AI ideas added"));
  const added = state.ideas.filter((i) => state.ideaPick[i.id] && state.ideaPick[i.id] !== "no");
  blocks.push(...(added.length ? added.map((i) => bullet(`${i.title} (${state.ideaPick[i.id]})`)) : [paragraph("None")]));

  blocks.push(heading2("AI ideas passed on"));
  const passed = state.ideas.filter((i) => state.ideaPick[i.id] === "no");
  blocks.push(...(passed.length ? passed.map((i) => bullet(i.title)) : [paragraph("None")]));

  blocks.push(heading2("Their own notes"));
  const notes: NotionBlock[] = [];
  if (state.biz.notes.trim()) notes.push(paragraph(state.biz.notes.trim()));
  for (const line of state.unplaced) notes.push(bullet(line));
  blocks.push(...(notes.length ? notes : [paragraph("None")]));

  if (args.source && args.source.trim()) {
    blocks.push(heading2("Pasted material"));
    const text = plainDashes(args.source.trim());
    for (let i = 0; i < text.length && i / NOTION_TEXT_LIMIT < PASTED_BLOCK_CAP; i += NOTION_TEXT_LIMIT) {
      blocks.push(paragraph(text.slice(i, i + NOTION_TEXT_LIMIT)));
    }
  }
  return blocks;
}

/** Notion accepts at most 100 children per request. */
export function chunkBlocks<T>(blocks: T[], size = NOTION_BLOCK_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < blocks.length; i += size) out.push(blocks.slice(i, i + size));
  return out;
}

/** The page URL from a page id, with or without dashes. */
export function notionPageUrl(pageId: string): string {
  return `https://www.notion.so/${pageId.replace(/-/g, "")}`;
}
