/**
 * Calibration comparison: grade per dimension and overall grade against the
 * agreed `expected` in a case file. Pure: no Redis, no network.
 */

export interface CalibrationCase {
  tool: string;
  name: string;
  source?: string;
  agreedBy?: string;
  agreedOn?: string;
  input: Record<string, string>;
  expected: { grade: number; dimensions: Record<string, number> };
  note?: string;
}

export interface CalibrationActual {
  grade: number;
  scores: Record<string, number>;
}

export interface ComparisonRow {
  key: string;
  expected: number;
  actual: number | null;
  delta: number | null;
}

export interface Comparison {
  pass: boolean;
  rows: ComparisonRow[];
}

export interface CaseResult {
  tool: string;
  name: string;
  file?: string;
  status: "run" | "skipped" | "error";
  reason?: string;
  comparison?: Comparison;
}

export const TO_FILL_MARKER = "TO FILL";

/** False when any input value still contains the TO FILL placeholder. */
export function isCaseFillable(c: Pick<CalibrationCase, "input">): boolean {
  const values = Object.values(c.input ?? {});
  if (values.length === 0) return false;
  return values.every((v) => typeof v === "string" && !v.includes(TO_FILL_MARKER));
}

/**
 * Compares the overall grade and each expected dimension grade. A case
 * passes when every |delta| is at most 1. A dimension the run did not score
 * is reported with a null actual and fails the case.
 */
export function compareCase(expected: CalibrationCase["expected"], actual: CalibrationActual): Comparison {
  const rows: ComparisonRow[] = [];
  const overall = Number.isFinite(actual.grade) ? actual.grade : null;
  rows.push({
    key: "overall",
    expected: expected.grade,
    actual: overall,
    delta: overall === null ? null : overall - expected.grade,
  });
  for (const [key, want] of Object.entries(expected.dimensions ?? {})) {
    const got = actual.scores[key];
    const present = typeof got === "number" && Number.isFinite(got);
    rows.push({
      key,
      expected: want,
      actual: present ? got : null,
      delta: present ? got - want : null,
    });
  }
  const pass = rows.every((r) => r.delta !== null && Math.abs(r.delta) <= 1);
  return { pass, rows };
}

function pad(text: string, width: number): string {
  // Always at least one space after the text so adjacent columns never touch.
  return text + " ".repeat(Math.max(1, width - text.length));
}

/** A printable table, one line per case plus one indented line per row that moved. */
export function formatTable(results: CaseResult[]): string {
  const lines: string[] = [];
  const header = `${pad("Tool", 14)}${pad("Case", 28)}${pad("Status", 10)}Detail`;
  lines.push(header);
  lines.push("-".repeat(header.length + 24));
  for (const r of results) {
    if (r.status === "skipped") {
      lines.push(`${pad(r.tool, 14)}${pad(r.name, 28)}${pad("skipped", 10)}${r.reason ?? ""}`);
      continue;
    }
    if (r.status === "error" || !r.comparison) {
      lines.push(`${pad(r.tool, 14)}${pad(r.name, 28)}${pad("error", 10)}${r.reason ?? "no comparison"}`);
      continue;
    }
    const overall = r.comparison.rows.find((row) => row.key === "overall");
    const summary = overall
      ? `overall expected ${overall.expected}, actual ${overall.actual ?? "none"}`
      : "";
    lines.push(`${pad(r.tool, 14)}${pad(r.name, 28)}${pad(r.comparison.pass ? "pass" : "FAIL", 10)}${summary}`);
    for (const row of r.comparison.rows) {
      if (row.key === "overall") continue;
      const flag = row.delta === null || Math.abs(row.delta) > 1 ? " <-- moved" : "";
      lines.push(`${pad("", 42)}${pad(row.key, 10)}expected ${row.expected}, actual ${row.actual ?? "none"}${flag}`);
    }
  }
  return lines.join("\n");
}
