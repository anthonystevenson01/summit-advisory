/**
 * Shared unlock helper for GTM tools.
 *
 * Each tool previously duplicated this flow: (1) fire-and-forget the lead
 * capture to /api/gtm/unlock, (2) fetch the detailed scoring rationale from
 * /api/gtm/{tool}/details. Centralising here keeps the logic in one place
 * and makes the per-tool `handleUnlock` trivial.
 */

export type ToolDetailsResult = {
  dimensionReasoning: Array<{ dim: string; score: number; reasoning: string }>;
  recommendations: Array<{ dim: string; score: number; gap: string; consequence: string; action: string }>;
};

export interface UnlockArgs {
  tool: "persona" | "problem" | "positioning" | "moat";
  id: string;
  name: string;
  email: string;
  company: string;
  scores: Record<string, number>;
  rubric: string;
}

/**
 * Submit the lead capture (fire-and-forget) and fetch the detailed
 * dimension reasoning. Returns the details payload, or `null` on failure
 * — callers should treat `null` as "scores only".
 */
export async function submitToolUnlock(args: UnlockArgs): Promise<ToolDetailsResult | null> {
  const { tool, id, name, email, company, scores, rubric } = args;

  // Fire-and-forget lead capture. We never block on it.
  fetch("/api/gtm/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, tool, name, email, company }),
  }).catch(() => {});

  try {
    const res = await fetch(`/api/gtm/${tool}/details`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, scores, rubric }),
    });
    if (!res.ok) return null;
    return (await res.json()) as ToolDetailsResult;
  } catch {
    return null;
  }
}
