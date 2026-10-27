/**
 * Event stream: `track(name, props)` appends to the Redis stream `events`
 * (XADD, approximate MAXLEN 50000). Tracking never throws and callers never
 * await it on the response path. `readEventsSince` is the one reader, for
 * the /admin/stats page: XRANGE by time in pages of at most 1,000 entries.
 */
import { getRedis } from "./redis.ts";

export type EventName =
  | "tool_started"
  | "result_shown"
  | "email_given"
  | "full_view_opened"
  | "re_run"
  | "result_emailed"
  | "data_deleted"
  | "bts_started"
  | "bts_result_shown"
  | "bts_full_view_opened"
  | "bts_result_emailed"
  | "score_whole_model_handoff"
  | "tool_rerun_from_scorecard"
  | "report_created"
  | "report_published"
  | "report_unpublished"
  | "report_opened"
  | "report_tool_rerun"
  | "book_call_clicked"
  | "builder_started"
  | "builder_step_completed"
  | "builder_doc_read"
  | "builder_suggest_used"
  | "builder_ideas_run"
  | "builder_saved"
  | "builder_resumed"
  | "builder_submitted"
  | "builder_change_requested"
  | "brief_deleted";

export const EVENTS_KEY = "events";
const EVENTS_MAX = 50_000;

export function track(name: EventName, props: Record<string, unknown> = {}): Promise<void> {
  return (async () => {
    try {
      await getRedis().xadd(
        EVENTS_KEY,
        "*",
        { name, ts: new Date().toISOString(), props: JSON.stringify(props) },
        { trim: { type: "MAXLEN", threshold: EVENTS_MAX, comparison: "~" } },
      );
    } catch {
      // tracking must never break a request
    }
  })();
}

export interface EventRow {
  name: string;
  ts: string;
  props: Record<string, unknown>;
}

const MAX_PAGES = 50;

/**
 * Every event between two times, oldest first, read in pages of `pageSize`
 * with XRANGE. Each next page starts from the last id's sequence plus one;
 * a short page ends the loop, as does the page cap so a runaway stream can
 * never hold the admin page open. A malformed `props` string becomes `{}`.
 */
export async function readEventsSince(sinceMs: number, untilMs: number, pageSize = 1000): Promise<EventRow[]> {
  const redis = getRedis();
  const out: EventRow[] = [];
  let start = `${Math.max(0, Math.floor(sinceMs))}-0`;
  const end = `${Math.floor(untilMs)}-18446744073709551615`;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const entries = await redis.xrange<Record<string, unknown>>(EVENTS_KEY, start, end, pageSize);
    const ids = Object.keys(entries);
    for (const id of ids) {
      const fields = entries[id];
      const name = typeof fields.name === "string" ? fields.name : "";
      const ts = typeof fields.ts === "string" ? fields.ts : "";
      let props: Record<string, unknown> = {};
      const raw = fields.props;
      if (typeof raw === "string") {
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) props = parsed as Record<string, unknown>;
        } catch {
          // malformed props: ignored
        }
      } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        props = raw as Record<string, unknown>;
      }
      out.push({ name, ts, props });
    }
    if (ids.length < pageSize) break;
    const [ms, seq] = ids[ids.length - 1].split("-");
    start = `${ms}-${Number(seq) + 1}`;
  }
  return out;
}
