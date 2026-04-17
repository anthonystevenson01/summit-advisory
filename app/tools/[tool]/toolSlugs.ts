/**
 * Shared registry of valid GTM-tool URL slugs + per-tool SEO metadata.
 * Consumed by app/tools/[tool]/page.tsx (server — metadata, static params,
 * 404 routing) and ToolRunner.tsx (client — runtime tool rendering).
 */

export const TOOL_SLUGS = [
  "icp",
  "persona",
  "problem",
  "positioning",
  "moat",
  "account",
] as const;

export type ToolSlug = (typeof TOOL_SLUGS)[number];

/**
 * Tools listed here are hidden site-wide: absent from the hub, routed to 404,
 * skipped by generateStaticParams, and blocked at the API. Code stays in place —
 * remove a slug from this list to re-enable the tool instantly.
 */
export const HIDDEN_TOOL_SLUGS: readonly ToolSlug[] = ["account"];

export function isToolSlug(value: string): value is ToolSlug {
  return (TOOL_SLUGS as readonly string[]).includes(value);
}

export function isToolHidden(slug: ToolSlug): boolean {
  return HIDDEN_TOOL_SLUGS.includes(slug);
}

/** True only if the slug is valid AND currently published. Use for routing. */
export function isToolPublic(value: string): value is ToolSlug {
  return isToolSlug(value) && !isToolHidden(value);
}

interface ToolSeo {
  title: string;
  description: string;
}

export const TOOL_SEO: Record<ToolSlug, ToolSeo> = {
  icp: {
    title: "ICP Evaluator — Summit GTM Toolkit",
    description:
      "Score your Ideal Customer Profile across seven weighted dimensions. Free, no signup, results in 30 seconds.",
  },
  persona: {
    title: "Buyer Persona Quality Check — Summit GTM Toolkit",
    description:
      "See whether your buyer persona is specific enough to actually drive sales decisions. Letter grade + 6 scored dimensions.",
  },
  problem: {
    title: "Market Problem Validator — Summit GTM Toolkit",
    description:
      "Stress-test whether the problem you're solving is real, urgent, and worth building against. Verdict + 6 dimensions.",
  },
  positioning: {
    title: "Positioning Statement Grader — Summit GTM Toolkit",
    description:
      "Find out if your positioning statement actually works — or just sounds good. Letter grade A–F with a suggested rewrite.",
  },
  moat: {
    title: "Competitive Moat Rater — Summit GTM Toolkit",
    description:
      "Understand how defensible your position really is — and what threatens it. Strong / Moderate / Thin / Exposed rating.",
  },
  account: {
    title: "Account Intelligence — Summit GTM Toolkit",
    description:
      "Pull live signals on any target account and build a full sales brief — ICP fit, contacts, timing verdict, opening play.",
  },
};
