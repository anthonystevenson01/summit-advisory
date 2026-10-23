/**
 * Event stream: `track(name, props)` appends to the Redis stream `events`
 * (XADD, approximate MAXLEN 50000). Tracking never throws and callers never
 * await it on the response path.
 */
import { getRedis } from "./redis.ts";

export type EventName = "tool_started" | "result_shown" | "email_given" | "full_view_opened" | "re_run";

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
