/**
 * Event stream: `track(name, props)` appends to the Redis stream `events`
 * (XADD, approximate MAXLEN 50000). Tracking never throws and callers never
 * await it on the response path.
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
  | "book_call_clicked";

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
