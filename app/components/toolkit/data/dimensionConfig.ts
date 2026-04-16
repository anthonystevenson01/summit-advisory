export function getGrade(score: number): { label: string; color: string; desc: string } {
  if (score >= 85) return { label: "Elite", color: "#27ae60", desc: "Exceptional standard — every element is deliberate and evidenced." };
  if (score >= 70) return { label: "Strong", color: "#2ecc71", desc: "Solid foundation with 1–2 dimensions to sharpen before scaling." };
  if (score >= 50) return { label: "Developing", color: "#D4A017", desc: "Good starting point with clear opportunities to strengthen." };
  if (score >= 30) return { label: "Early-Stage", color: "#e67e22", desc: "The foundations are here — focus on the priority dimensions." };
  return { label: "Starting Point", color: "#C0392B", desc: "Significant gaps to address — the recommendations below will guide you." };
}

export interface DimConfig {
  key: string;
  name: string;
  weight: number;
  levels: Record<number, string>;
}

export function calcScore(scores: Record<string, number>, dims: DimConfig[]): number {
  const weighted = dims.reduce((sum, d) => sum + (scores[d.key] ?? 3) * d.weight, 0);
  return Math.round((weighted / 5) * 100);
}

const PERSONA_DIMS: DimConfig[] = [
  { key: "pc", name: "Pain Clarity", weight: 0.25, levels: { 1: "Absent", 2: "Generic", 3: "Named", 4: "Quantified", 5: "Segmented" } },
  { key: "da", name: "Decision Authority", weight: 0.20, levels: { 1: "Absent", 2: "Identified", 3: "Partial", 4: "Mapped", 5: "Strategic" } },
  { key: "sp", name: "Specificity", weight: 0.18, levels: { 1: "Vague", 2: "Basic", 3: "Partial", 4: "Detailed", 5: "Comprehensive" } },
  { key: "re", name: "Reachability", weight: 0.15, levels: { 1: "Unknown", 2: "Vague", 3: "Listed", 4: "Mapped", 5: "Operationalised" } },
  { key: "jf", name: "Job-to-be-Done Fit", weight: 0.12, levels: { 1: "Absent", 2: "Generic", 3: "Named", 4: "Specific", 5: "Evidenced" } },
  { key: "fm", name: "Finite Market Alignment", weight: 0.10, levels: { 1: "Absent", 2: "Aware", 3: "Partial", 4: "Applied", 5: "Embedded" } },
];

const POSITIONING_DIMS: DimConfig[] = [
  { key: "di", name: "Differentiation", weight: 0.25, levels: { 1: "Generic", 2: "Claimed", 3: "Partial", 4: "Clear", 5: "Undeniable" } },
  { key: "sp", name: "Specificity", weight: 0.22, levels: { 1: "Vague", 2: "Broad", 3: "Partial", 4: "Specific", 5: "Precise" } },
  { key: "mf", name: "Market Fit", weight: 0.18, levels: { 1: "Misaligned", 2: "Weak", 3: "Partial", 4: "Strong", 5: "Perfect" } },
  { key: "cl", name: "Clarity", weight: 0.15, levels: { 1: "Unclear", 2: "Confused", 3: "Partial", 4: "Clear", 5: "Crystal" } },
  { key: "cr", name: "Credibility", weight: 0.12, levels: { 1: "Absent", 2: "Weak", 3: "Partial", 4: "Strong", 5: "Verified" } },
  { key: "er", name: "Emotional Resonance", weight: 0.08, levels: { 1: "Flat", 2: "Weak", 3: "Moderate", 4: "Strong", 5: "Compelling" } },
];

const PROBLEM_DIMS: DimConfig[] = [
  { key: "pa", name: "Problem Acuity", weight: 0.25, levels: { 1: "Absent", 2: "Vague", 3: "Named", 4: "Quantified", 5: "Evidenced" } },
  { key: "me", name: "Market Evidence", weight: 0.20, levels: { 1: "None", 2: "Anecdotal", 3: "Partial", 4: "Strong", 5: "Verified" } },
  { key: "ug", name: "Urgency", weight: 0.18, levels: { 1: "None", 2: "Low", 3: "Moderate", 4: "High", 5: "Critical" } },
  { key: "ad", name: "Addressability", weight: 0.15, levels: { 1: "Unknown", 2: "Unclear", 3: "Partial", 4: "Clear", 5: "Defined" } },
  { key: "cg", name: "Competitive Gap", weight: 0.12, levels: { 1: "None", 2: "Minimal", 3: "Partial", 4: "Clear", 5: "Significant" } },
  { key: "ms", name: "Monetisation Signal", weight: 0.10, levels: { 1: "None", 2: "Weak", 3: "Partial", 4: "Strong", 5: "Verified" } },
];

const MOAT_DIMS: DimConfig[] = [
  { key: "sc", name: "Switching Cost", weight: 0.25, levels: { 1: "None", 2: "Minimal", 3: "Moderate", 4: "Strong", 5: "Locked" } },
  { key: "pd", name: "Product Differentiation", weight: 0.22, levels: { 1: "Generic", 2: "Weak", 3: "Partial", 4: "Clear", 5: "Unique" } },
  { key: "ne", name: "Network / Data Effect", weight: 0.18, levels: { 1: "None", 2: "Early", 3: "Building", 4: "Established", 5: "Dominant" } },
  { key: "br", name: "Brand & Relationships", weight: 0.15, levels: { 1: "None", 2: "Minimal", 3: "Growing", 4: "Strong", 5: "Entrenched" } },
  { key: "sd", name: "Speed & Execution", weight: 0.12, levels: { 1: "Slow", 2: "Below Avg", 3: "Average", 4: "Fast", 5: "Elite" } },
  { key: "pr", name: "Price Defensibility", weight: 0.08, levels: { 1: "Exposed", 2: "Weak", 3: "Moderate", 4: "Strong", 5: "Protected" } },
];

export const TOOL_DIMENSIONS: Record<string, DimConfig[]> = {
  persona: PERSONA_DIMS,
  positioning: POSITIONING_DIMS,
  problem: PROBLEM_DIMS,
  moat: MOAT_DIMS,
};
