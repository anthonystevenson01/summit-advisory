/**
 * Change requests: the prospect's own words under the prototype, cleaned,
 * capped and recorded against the brief. Pure: the shape, the caps, the
 * text clean and the Notion lines. The request text is data in the plan
 * diff prompt's user turn, never in a system turn, and is rendered as text
 * everywhere it is shown.
 */

export interface ChangeRequest {
  id: string;
  text: string;
  at: string;
  /** The screen slugs the planner changed for it; empty when declined. */
  screens: string[];
  model: string;
  outcome: "built" | "declined";
}

/** The per brief cap on change requests, separate from the 10 Create or Update presses. */
export const REQUESTS_PER_BRIEF = 20;
export const REQUEST_MAX_CHARS = 600;
export const REQUEST_MIN_CHARS = 4;

/** Trim, collapse whitespace, make dashes plain and cap at 600; empty when under 4 characters. */
export function cleanRequestText(text: unknown): string {
  if (typeof text !== "string") return "";
  const clean = text
    .replace(/(\d)\s*[–—]\s*(\d)/g, "$1 to $2")
    .replace(/\s*[–—]\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, REQUEST_MAX_CHARS)
    .trim();
  return clean.length >= REQUEST_MIN_CHARS ? clean : "";
}

/** UTC on purpose: the Notion page is read by the team, not the prospect, and one zone keeps the bullets comparable. */
function formatWhen(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}

/** One line per request for the Notion page: the time, then the text, with a declined mark where the planner refused it. */
export function requestLines(requests: readonly ChangeRequest[]): string[] {
  return requests.map((r) => {
    const when = formatWhen(r.at);
    const suffix = r.outcome === "declined" ? " (outside the prototype's remit, not built)" : "";
    return `${when ? `${when}: ` : ""}${r.text}${suffix}`;
  });
}
