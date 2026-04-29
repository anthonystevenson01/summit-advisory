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

export interface ToolFaq {
  q: string;
  a: string;
}

interface ToolSeo {
  title: string;
  description: string;
  /** 2–3 sentence plain-English description rendered as static HTML above the tool. */
  about: string;
  /** Short bullet points explaining how the tool works — rendered as a static list. */
  howItWorks: string[];
  /** FAQs rendered as static HTML + FAQPage schema. */
  faqs: ToolFaq[];
  /** Canonical URL for this tool. */
  canonical: string;
}

export const TOOL_SEO: Record<ToolSlug, ToolSeo> = {
  icp: {
    title: "ICP Evaluator — Summit GTM Toolkit",
    description:
      "Score your Ideal Customer Profile across seven weighted dimensions. Free, no signup, results in 30 seconds.",
    about:
      "The ICP Evaluator scores your Ideal Customer Profile across seven weighted dimensions tailored for teams selling into finite, defined markets — where there is no volume to hide behind. Weak ICPs cost revenue in small markets; this tool surfaces the gaps before they cost you accounts you can't replace.",
    howItWorks: [
      "Describe your ideal customer across seven dimensions",
      "The tool weights each dimension for finite-market relevance",
      "Receive a scored breakdown with specific gaps highlighted",
      "Free to use — no signup, results in under 30 seconds",
    ],
    faqs: [
      {
        q: "What is an Ideal Customer Profile (ICP)?",
        a: "An Ideal Customer Profile (ICP) is a detailed description of the type of organisation most likely to buy your product, get value from it, and renew or expand over time. A strong ICP goes beyond industry and company size — it defines the specific situation, problem, and buying context that makes a customer a perfect fit.",
      },
      {
        q: "Why does ICP quality matter more in finite markets?",
        a: "In high-volume markets, a weak ICP wastes pipeline but can be compensated with volume. In finite markets — where the total addressable account list may be hundreds or low thousands — there is no volume to compensate for poor targeting. Every misfit account you pursue is a fit account you're not pursuing.",
      },
      {
        q: "What are the seven dimensions in the ICP Evaluator?",
        a: "The tool evaluates your ICP across specificity, problem clarity, buying situation definition, decision-maker identification, value alignment, measurable success criteria, and fit signal strength. Each dimension is weighted for finite-market selling conditions.",
      },
      {
        q: "Is the ICP Evaluator free?",
        a: "Yes — the ICP Evaluator is completely free to use with no signup or account required. Results are generated in under 30 seconds.",
      },
    ],
    canonical: "https://summitadvisory.com/tools/icp",
  },
  persona: {
    title: "Buyer Persona Quality Check — Summit GTM Toolkit",
    description:
      "See whether your buyer persona is specific enough to actually drive sales decisions. Letter grade + 6 scored dimensions.",
    about:
      "The Buyer Persona Quality Check grades your buyer persona on specificity, behavioural accuracy, and decision-making relevance. Most buyer personas describe a demographic; this tool checks whether yours is specific enough to actually change how your team sells.",
    howItWorks: [
      "Describe your buyer persona in detail",
      "The tool evaluates it across six scored dimensions",
      "Receive a letter grade (A–F) with dimension-level feedback",
      "Free, no signup required",
    ],
    faqs: [
      {
        q: "What is a buyer persona?",
        a: "A buyer persona is a semi-fictional representation of your ideal buyer — the individual within a target organisation who initiates, influences, or approves the purchase decision. A strong buyer persona captures their goals, frustrations, decision criteria, and day-to-day context, not just their job title and company size.",
      },
      {
        q: "What is the difference between an ICP and a buyer persona?",
        a: "An ICP (Ideal Customer Profile) describes the ideal organisation to target. A buyer persona describes the individual within that organisation who buys. You need both: a strong ICP tells you which accounts to pursue; a strong buyer persona tells you how to sell to them once you're in.",
      },
      {
        q: "What makes a buyer persona specific enough to drive sales?",
        a: "A sales-effective buyer persona includes specific triggers that make a buyer active in the market, the exact language they use to describe their problem, the internal and external stakeholders who influence their decision, and what a successful outcome looks like to them personally — not just to the company.",
      },
      {
        q: "How is the Buyer Persona Quality Check scored?",
        a: "The tool evaluates your persona across six dimensions: specificity, problem articulation, trigger identification, stakeholder mapping, success criteria, and objection predictability. Each dimension is graded and contributes to an overall letter grade from A to F.",
      },
    ],
    canonical: "https://summitadvisory.com/tools/persona",
  },
  problem: {
    title: "Market Problem Validator — Summit GTM Toolkit",
    description:
      "Stress-test whether the problem you're solving is real, urgent, and worth building against. Verdict + 6 dimensions.",
    about:
      "The Market Problem Validator stress-tests whether the problem your product solves is real, specific, urgent, and defensible enough to build a business against. It evaluates problem quality across six dimensions and delivers a clear verdict on whether the problem is worth pursuing at scale.",
    howItWorks: [
      "Describe the market problem you're solving",
      "The tool evaluates it across six problem-quality dimensions",
      "Receive a verdict: Validated / Partially Validated / Not Validated",
      "Dimension-level feedback surfaces the specific weaknesses",
    ],
    faqs: [
      {
        q: "What makes a market problem worth building against?",
        a: "A buildable market problem is specific (affects a defined group), acute (causes real pain when unsolved), frequent (occurs regularly, not once), and currently solved poorly or expensively by existing options. The best problems are ones where the buyer is already spending money on a workaround.",
      },
      {
        q: "What is the difference between a real problem and a perceived problem?",
        a: "A real problem has observable symptoms — buyers can describe it, are already trying to solve it, and will pay to solve it better. A perceived problem is one the founder believes exists but which buyers don't actively feel pain from. The Market Problem Validator tests for evidence of real pain, not just logical reasoning.",
      },
      {
        q: "How do I know if my problem is urgent enough?",
        a: "Urgency is evidenced by buyers prioritising the problem unprompted, allocating existing budget to solve it, or experiencing measurable consequences when it goes unsolved. If buyers say 'yes, that's a problem' but don't act on it, the urgency isn't sufficient to support a product business.",
      },
      {
        q: "Can the tool be used for early-stage startup validation?",
        a: "Yes — the Market Problem Validator is designed for exactly this use case. It is most useful before building, helping founders stress-test their problem hypothesis before investing in product development.",
      },
    ],
    canonical: "https://summitadvisory.com/tools/problem",
  },
  positioning: {
    title: "Positioning Statement Grader — Summit GTM Toolkit",
    description:
      "Find out if your positioning statement actually works — or just sounds good. Letter grade A–F with a suggested rewrite.",
    about:
      "The Positioning Statement Grader evaluates whether your positioning statement clearly communicates who you're for, what you do, and why you're the better choice — or whether it's generic enough to apply to any competitor. It grades A–F and suggests a rewrite when the statement isn't pulling its weight.",
    howItWorks: [
      "Paste in your positioning statement",
      "The tool evaluates it against six positioning criteria",
      "Receive a letter grade with dimension-level feedback",
      "If the grade is C or below, a suggested rewrite is generated",
    ],
    faqs: [
      {
        q: "What is a positioning statement?",
        a: "A positioning statement is a single sentence or short paragraph that defines who your product is for, what category it belongs to, what unique value it delivers, and why a buyer should choose it over alternatives. A strong positioning statement is specific enough that it could only describe your product — not your competitors.",
      },
      {
        q: "What makes a positioning statement weak?",
        a: "The most common weakness is generality — statements like 'the leading platform for teams that want to grow' apply to hundreds of products. Weak positioning fails to specify the exact buyer, the exact problem, or the specific mechanism of the advantage. If you replaced your company name with a competitor's, the statement should no longer be true.",
      },
      {
        q: "What is the difference between positioning and messaging?",
        a: "Positioning is the internal strategic foundation — the logic of why you win in your market. Messaging is the external expression of that positioning in language buyers respond to. You build positioning first, then derive messaging from it. The Positioning Statement Grader evaluates the strategic foundation.",
      },
      {
        q: "How specific should a positioning statement be?",
        a: "Specific enough that your target buyer reads it and thinks 'that's exactly us', and your non-target buyer reads it and thinks 'that's not for me'. Specificity that excludes the wrong buyers is a feature, not a flaw — especially in finite markets where sales efficiency matters.",
      },
    ],
    canonical: "https://summitadvisory.com/tools/positioning",
  },
  moat: {
    title: "Competitive Moat Rater — Summit GTM Toolkit",
    description:
      "Understand how defensible your position really is — and what threatens it. Strong / Moderate / Thin / Exposed rating.",
    about:
      "The Competitive Moat Rater evaluates how defensible your competitive position is across the key dimensions of durable advantage: switching costs, network effects, proprietary data, brand, and cost position. It delivers a four-level rating — Strong, Moderate, Thin, or Exposed — with a breakdown of what's protecting you and what isn't.",
    howItWorks: [
      "Describe your competitive position and key advantages",
      "The tool evaluates defensibility across five moat dimensions",
      "Receive a four-level rating: Strong / Moderate / Thin / Exposed",
      "Breakdown identifies which moat types are present and which are absent",
    ],
    faqs: [
      {
        q: "What is a competitive moat?",
        a: "A competitive moat is a durable structural advantage that makes it difficult for competitors to replicate your position or for customers to switch away. The term was popularised by Warren Buffett. In B2B markets, moats typically come from switching costs, proprietary data, network effects, brand trust, or cost advantages.",
      },
      {
        q: "What are the five types of competitive moat?",
        a: "The five main moat types in B2B software and services are: (1) switching costs — the time and expense of replacing your product; (2) network effects — value increasing as more users join; (3) proprietary data — unique data assets competitors can't replicate; (4) brand — trusted reputation that commands a premium; and (5) cost position — the ability to deliver at a lower cost than competitors.",
      },
      {
        q: "What does a 'Thin' moat rating mean?",
        a: "A Thin moat means your competitive advantage is real but easily replicable. Competitors can match your features, pricing, or positioning without significant barrier. Thin moat companies typically win through superior execution in the short term but are vulnerable to well-funded competitors who can out-execute over time.",
      },
      {
        q: "How do I build a stronger competitive moat?",
        a: "Moats are built by deepening switching costs (integrations, proprietary workflows, data lock-in), generating network effects where possible, accumulating proprietary data from product usage, and building brand through consistent delivery of distinctive results. The Competitive Moat Rater identifies which dimensions have the most room for improvement.",
      },
    ],
    canonical: "https://summitadvisory.com/tools/moat",
  },
  account: {
    title: "Account Intelligence — Summit GTM Toolkit",
    description:
      "Pull live signals on any target account and build a full sales brief — ICP fit, contacts, timing verdict, opening play.",
    about:
      "Account Intelligence pulls live signals on any target account and generates a full sales brief covering ICP fit score, key contacts, timing verdict, and a recommended opening play — saving hours of pre-call research.",
    howItWorks: [
      "Enter a target account domain or company name",
      "The tool pulls live signals across multiple data sources",
      "Receive ICP fit score, key contacts, timing verdict, and opening play",
    ],
    faqs: [
      {
        q: "What is account intelligence in B2B sales?",
        a: "Account intelligence is the process of gathering and synthesising information about a target account before outreach — including company context, recent signals, key decision-makers, and indicators of buying readiness. Strong account intelligence improves open rates, conversation quality, and close rates.",
      },
    ],
    canonical: "https://summitadvisory.com/tools/account",
  },
};
