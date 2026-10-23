/**
 * Weighted score, grade bands and labels. Pure: no Redis, no network.
 */
import type { Level, ToolDimension, ToolEntry } from "./registry.ts";

export type Grade = 1 | 2 | 3 | 4 | 5;

export interface GradeInfo {
  grade: Grade;
  label: string;
  color: string;
  desc: string;
}

/**
 * Weighted mean of the 1 to 5 dimension scores, scaled to 0 to 100 and
 * rounded. A missing key defaults to 3, as the old routes did.
 */
export function calcScore(scores: Record<string, number>, dimensions: readonly ToolDimension[]): number {
  const weighted = dimensions.reduce((sum, d) => sum + (scores[d.key] ?? 3) * d.weight, 0);
  return Math.round((weighted / 5) * 100);
}

/** Grade bands: 85 and above is 5, 70 is 4, 50 is 3, 30 is 2, below 30 is 1. */
export function gradeFor(score: number): GradeInfo {
  if (score >= 85) return { grade: 5, label: "Elite", color: "#27ae60", desc: "Exceptional standard. Every element is deliberate and evidenced." };
  if (score >= 70) return { grade: 4, label: "Strong", color: "#2ecc71", desc: "Solid foundation with one or two dimensions to sharpen before scaling." };
  if (score >= 50) return { grade: 3, label: "Developing", color: "#D4A017", desc: "Good starting point with clear opportunities to strengthen." };
  if (score >= 30) return { grade: 2, label: "Early-Stage", color: "#e67e22", desc: "The foundations are here. Focus on the priority dimensions." };
  return { grade: 1, label: "Starting Point", color: "#C0392B", desc: "Significant gaps to address. The recommendations below will guide you." };
}

/** Kept as an alias so ScoreGauge changes only its import. */
export const getGrade = gradeFor;

/** The tool's legacy label for a grade (moat: Strong, Moderate, Thin, Thin, Exposed), or undefined. */
export function legacyLabelFor(entry: Pick<ToolEntry, "legacyLabel">, grade: Grade): string | undefined {
  return entry.legacyLabel?.[grade as Level];
}
