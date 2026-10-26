"use client";

import { useState } from "react";
import { bandFor, totalOf, type BtsPartKey } from "@/app/lib/tools/built-to-scale-method";

export interface EditorRow {
  key: BtsPartKey;
  name: string;
  grade: number;
  comment: string;
  originalGrade: number;
  originalComment: string;
  edited: boolean;
  hasOriginal: boolean;
}

const GRADES = [1, 2, 3, 4, 5];

const fieldStyle = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 6,
  border: "1px solid #D0D5D2",
  fontSize: 13,
  fontFamily: "var(--font-dm-sans), sans-serif",
  color: "#1A1A1A",
  background: "#fff",
  boxSizing: "border-box" as const,
  lineHeight: 1.5,
};

const smallLabel = { fontSize: 11, fontWeight: 600 as const, color: "#666", textTransform: "uppercase" as const, letterSpacing: "0.04em", margin: "0 0 4px" };

/**
 * The five rows: a grade select and a comment textarea per row, the run's
 * original beside it, and a "Reset to run" submit button carrying
 * `action=reset:{key}`. The grades are the one piece of client state, kept
 * only for the live total and band; the inputs are plain named fields in
 * the server form.
 */
export default function RowsEditor({ rows }: { rows: EditorRow[] }) {
  const [grades, setGrades] = useState<Record<string, number>>(Object.fromEntries(rows.map((r) => [r.key, r.grade])));
  const total = totalOf(rows.map((r) => ({ grade: grades[r.key] ?? r.grade })));
  const band = bandFor(total);

  return (
    <div>
      {rows.map((row) => (
        <div key={row.key} style={{ borderTop: "1px solid #E8ECE9", padding: "16px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#053030" }}>
              {row.name}
              {row.edited && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: "#D4A017" }}>edited</span>}
              {!row.hasOriginal && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: "#C0392B" }}>no original</span>}
            </span>
            <button
              type="submit"
              name="action"
              value={`reset:${row.key}`}
              style={{ background: "none", border: "1px solid #D0D5D2", borderRadius: 4, padding: "4px 10px", fontSize: 12, fontWeight: 600, color: "#005A66", cursor: "pointer", fontFamily: "var(--font-dm-sans), sans-serif" }}
            >
              Reset to run
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label htmlFor={`grade-${row.key}`} style={smallLabel}>Grade</label>
              <select
                id={`grade-${row.key}`}
                name={`grade:${row.key}`}
                value={grades[row.key] ?? row.grade}
                onChange={(e) => setGrades((prev) => ({ ...prev, [row.key]: Number(e.target.value) }))}
                style={{ ...fieldStyle, width: 80, marginBottom: 8 }}
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <label htmlFor={`comment-${row.key}`} style={smallLabel}>Comment</label>
              <textarea id={`comment-${row.key}`} name={`comment:${row.key}`} defaultValue={row.comment} style={{ ...fieldStyle, minHeight: 110, resize: "vertical" }} />
            </div>
            <div style={{ background: "#F5F7F6", borderRadius: 6, padding: "10px 12px" }}>
              <p style={smallLabel}>From the run</p>
              <p style={{ fontFamily: "var(--font-barlow-condensed), sans-serif", fontSize: 20, fontWeight: 700, color: "#053030", margin: "0 0 6px" }}>
                {row.originalGrade} <span style={{ fontSize: 12, fontWeight: 400, color: "#666" }}>of 5</span>
              </p>
              <p style={{ fontSize: 12, color: "#666", lineHeight: 1.55, margin: 0, whiteSpace: "pre-wrap" }}>{row.originalComment || "No comment stored."}</p>
            </div>
          </div>
        </div>
      ))}
      <p style={{ borderTop: "1px solid #E8ECE9", padding: "14px 0 0", margin: 0, fontSize: 14, color: "#053030" }}>
        <span style={{ fontFamily: "var(--font-barlow-condensed), sans-serif", fontSize: 22, fontWeight: 700 }}>Total {total} of 25</span>
        <span style={{ marginLeft: 10, color: "#666" }}>{band.label}</span>
      </p>
    </div>
  );
}
