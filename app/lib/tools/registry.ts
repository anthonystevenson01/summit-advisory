/**
 * The single description of every GTM tool.
 *
 * The rule: nothing else describes a tool. Pages, routes, the pipeline, the
 * JSON schemas, the admin tables, the hub and the calibration script all read
 * this file, so adding or changing a tool is one edit here plus a Published
 * row in the Notion "Tool Rubrics" database. A dimension name, weight, input
 * key or SEO string written anywhere else is a bug; move it here.
 *
 * Plain data with no imports, so it is safe to import from client components,
 * server components, routes, tests and scripts. Weights live here (tested to
 * sum to 1 per tool); rubric descriptors and system prompts live in Notion and
 * are read server side by app/lib/rubrics.ts, never from the browser.
 *
 * `hidden: true` keeps a tool out of the hub, the static params and the three
 * generic routes. Flipping it is a code change and a deploy. The public tool
 * count and its word form are exported here so copy never hard codes a number.
 *
 * `builtToScale` and `feeds` are the only description of how the five Built
 * to Scale? parts reach a tool (which parts fill each of its inputs) and which
 * dimension its result informs in the synthesis.
 */

export type ToolSlug = "icp" | "persona" | "problem" | "positioning" | "moat" | "route-to-buyer" | "unit-of-value" | "account";

export type InputKind = "textarea" | "text";

export interface ToolInput {
  key: string;
  label: string;
  placeholder: string;
  /** A realistic filled-in value the page can insert into the field. */
  example: string;
  maxLength: number;
  minLength: number;
  required: boolean;
  kind: InputKind;
}

export type Level = 1 | 2 | 3 | 4 | 5;

export interface ToolDimension {
  key: string;
  name: string;
  weight: number;
  levels: Record<Level, string>;
  /** The "highest standard" tip sentence shown on the tool page. */
  standard: string;
}

export interface ToolExtra {
  key: string;
  label: string;
  /** The instruction the details prompt gives for this extra. */
  ask: string;
  /** `ceiling` is the structured three input object for the revenue ceiling per head (see app/lib/ceiling.ts). */
  kind: "text" | "list" | "ceiling";
}

export interface ToolFaq {
  q: string;
  a: string;
}

export interface ToolSeo {
  title: string;
  description: string;
  about: string;
  howItWorks: string[];
  faqs: ToolFaq[];
  canonical: string;
}

export interface ToolIntro {
  heading?: string;
  text: string;
}

export type BuiltToScaleDimension = "pain" | "routeToBuyer" | "unitOfValue" | "valueEvidence" | "abilityToProtect";

export interface ToolEntry {
  slug: ToolSlug;
  number: string;
  name: string;
  tagline: string;
  outputDescription: string;
  intro?: ToolIntro[];
  inputs: ToolInput[];
  dimensions: ToolDimension[];
  role: string;
  extras: ToolExtra[];
  legacyLabel?: Record<Level, string>;
  seo: ToolSeo;
  hidden: boolean;
  feeds: BuiltToScaleDimension[];
  /**
   * How the five Built to Scale? parts fill this tool's inputs: one key per
   * input key, each value the ordered parts concatenated into that input. An
   * empty list means the orchestration leaves the input empty.
   */
  builtToScale: Record<string, BuiltToScaleDimension[]>;
  cta: { heading: string; body: string };
  buttonLabel: string;
}

export const ROUTING_TASKS = ["scoring", "details", "synthesis", "extraction"] as const;

const ICP: ToolEntry = {
  slug: "icp",
  number: "01",
  name: "ICP Evaluator",
  tagline: "Score your ICP across seven dimensions weighted for your situation. Find the gaps. Fix them before they cost you accounts you cannot replace.",
  outputDescription: "Weighted ICP score, dimension breakdown, and specific improvement recommendations.",
  intro: [
    {
      text: "If you are a small team selling to enterprise, you already know the dynamics are different. But most ICP frameworks are built for companies with 10,000 accounts and an SDR army. Yours has maybe 150 accounts. Three things make selling in this world fundamentally different, and your ICP needs to address all of them.",
    },
    {
      heading: "There Is No Volume to Hide Behind",
      text: "Your universe is finite. The challenge is not finding accounts. It is choosing which 30 to pursue first, knowing how to get access, and making every touch count. When you burn an account (wrong person, wrong timing, wrong message) that account is closed to you for 12 to 18 months. There is no volume to hide behind. Your real competitor is not the other vendor. It is \"do nothing\". Enterprise organisations have enormous inertia, and most of your target accounts are defaulting to the status quo right now. Your ICP needs to distinguish between accounts that have an active reason to change and accounts that are sitting comfortably, because pursuing the comfortable ones with the same intensity burns your limited capacity on deals that will stall. And you carry a trust tax that incumbents do not. Every enterprise buyer evaluating a small vendor is doing a private risk calculation that has nothing to do with your product, and your ICP needs to account for which accounts have champions willing to take that bet.",
    },
    {
      heading: "The Machines Are Only as Smart as What You Feed Them",
      text: "This is why your ICP is an important document in your GTM stack. And it is becoming more critical, not less. Sequencing tools, intent platforms, and agentic SDRs can reach more accounts faster than ever. But every one of those machines takes its direction from the same source. A weak ICP fed into a powerful automation stack just produces high-velocity waste aimed at the wrong accounts, with the wrong message, at the wrong time.",
    },
    {
      text: "This evaluator is built for these dynamics and gives you specific, actionable recommendations for every gap it finds.",
    },
  ],
  inputs: [
    {
      key: "icp",
      label: "Your ICP Description",
      placeholder:
        "Paste your ICP description here. Include as much detail as you have: who you target (industry, size, geography), what problems they face, how they typically buy (roles, process), what you are displacing (competitor, internal process), who you do not sell to, and how many target accounts exist.",
      example:
        "We sell a contract analytics platform to UK and Irish NHS trusts and private hospital groups with 2,000 to 8,000 staff. There are about 240 target accounts. The buyer is the Director of Procurement, with the Head of Legal and the CFO on the committee. The pain is supplier contracts expiring without renegotiation, which costs a typical trust 4 to 6 percent of non-pay spend each year. Triggers include a new CFO, a CQC finding on procurement, or a merger of trusts. We displace spreadsheets and a shared mailbox; the incumbent alternative is a Bravo or Atamis module that nobody uses. We do not sell to trusts in special measures or to groups already on Oracle Procurement Cloud.",
      maxLength: 8000,
      minLength: 50,
      required: true,
      kind: "textarea",
    },
  ],
  dimensions: [
    {
      key: "bca",
      name: "Buying Committee & Access Mapping",
      weight: 0.25,
      levels: { 1: "Absent", 2: "Minimal", 3: "Partial", 4: "Strong", 5: "Elite" },
      standard: "Full buying committee mapped with roles, influence levels, access paths, and internal champions identified per account.",
    },
    {
      key: "pa",
      name: "Pain Articulation Depth",
      weight: 0.18,
      levels: { 1: "Absent", 2: "Generic", 3: "Named", 4: "Quantified", 5: "Segmented" },
      standard: "Pain quantified in business terms, segmented by persona, with evidence of how it manifests differently across account tiers.",
    },
    {
      key: "usp",
      name: "Universe Sizing & Account Intelligence",
      weight: 0.15,
      levels: { 1: "Absent", 2: "Awareness", 3: "Listed", 4: "Prioritised", 5: "Operationalised" },
      standard: "Named accounts ranked into pursuit tiers with intelligence standards defined for each tier.",
    },
    {
      key: "it",
      name: "Intent / Trigger Definition",
      weight: 0.15,
      levels: { 1: "Absent", 2: "Vague", 3: "Generic", 4: "Specific", 5: "Operationalised" },
      standard: "Specific, observable triggers mapped to outreach timing, not just broad market trends.",
    },
    {
      key: "cd",
      name: "Competitive Displacement Awareness",
      weight: 0.12,
      levels: { 1: "Absent", 2: "Aware", 3: "Categorised", 4: "Mapped", 5: "Strategic" },
      standard: "Incumbent solutions mapped per account with displacement strategies and competitive positioning documented.",
    },
    {
      key: "nf",
      name: "Negative Filters",
      weight: 0.1,
      levels: { 1: "Absent", 2: "Minimal", 3: "Partial", 4: "Structured", 5: "Validated" },
      standard: "Validated exclusion criteria that protect your pipeline from accounts that look right but will not close.",
    },
    {
      key: "fs",
      name: "Firmographic Specificity",
      weight: 0.05,
      levels: { 1: "Absent", 2: "Vague", 3: "Basic", 4: "Detailed", 5: "Comprehensive" },
      standard: "Precise firmographic boundaries that narrow without over-constraining your finite universe.",
    },
  ],
  role: "an expert at evaluating Ideal Customer Profiles for B2B enterprise sales into finite, named-account markets",
  extras: [],
  seo: {
    title: "ICP Evaluator — Summit GTM Toolkit",
    description:
      "Score your Ideal Customer Profile across seven weighted dimensions. Free, no signup, results in 30 seconds.",
    about:
      "The ICP Evaluator scores your Ideal Customer Profile across seven weighted dimensions tailored for teams selling into finite, defined markets, where there is no volume to hide behind. Weak ICPs cost revenue in small markets; this tool surfaces the gaps before they cost you accounts you cannot replace.",
    howItWorks: [
      "Describe your ideal customer across seven dimensions",
      "The tool weights each dimension for finite-market relevance",
      "Receive a score out of 100, a grade from 1 to 5 and a one-sentence verdict, with specific gaps highlighted",
      "Free to use, no signup, results in under 30 seconds",
    ],
    faqs: [
      {
        q: "What is an Ideal Customer Profile (ICP)?",
        a: "An Ideal Customer Profile (ICP) is a detailed description of the type of organisation most likely to buy your product, get value from it, and renew or expand over time. A strong ICP goes beyond industry and company size: it defines the specific situation, problem, and buying context that makes a customer a perfect fit.",
      },
      {
        q: "Why does ICP quality matter more in finite markets?",
        a: "In high-volume markets, a weak ICP wastes pipeline but can be compensated with volume. In finite markets, where the total addressable account list may be hundreds or low thousands, there is no volume to compensate for poor targeting. Every misfit account you pursue is a fit account you are not pursuing.",
      },
      {
        q: "What are the seven dimensions in the ICP Evaluator?",
        a: "The tool evaluates your ICP across Buying Committee and Access Mapping, Pain Articulation Depth, Universe Sizing and Account Intelligence, Intent and Trigger Definition, Competitive Displacement Awareness, Negative Filters, and Firmographic Specificity. Each dimension is weighted for finite-market selling conditions.",
      },
      {
        q: "Is the ICP Evaluator free?",
        a: "Yes. The ICP Evaluator is completely free to use with no signup or account required. Results are generated in under 30 seconds.",
      },
    ],
    canonical: "https://summitstrategyadvisory.com/tools/icp",
  },
  hidden: false,
  feeds: ["routeToBuyer"],
  builtToScale: { icp: ["pain", "routeToBuyer"] },
  cta: {
    heading: "Need help building a better ICP?",
    body: "Summit works alongside small teams selling to enterprise: refining targeting, building account strategies, and closing the gap between aspiration and pipeline reality.",
  },
  buttonLabel: "Evaluate My ICP",
};

const PERSONA: ToolEntry = {
  slug: "persona",
  number: "02",
  name: "Buyer Persona Quality Check",
  tagline: "Score your buyer persona across six dimensions weighted for finite-market enterprise selling. Find the gaps before they cost you accounts.",
  outputDescription: "Grade, overall score, 6 scored dimensions, biggest gap, key question to answer.",
  inputs: [
    {
      key: "persona",
      label: "Your Buyer Persona Definition",
      placeholder:
        "Paste your buyer persona definition here. Include job title, seniority, company type, pain points, goals, decision-making role, and any other relevant detail.",
      example:
        "Head of Revenue Operations at a Series B to Series D B2B SaaS company with 150 to 600 staff, reporting to the CRO. Owns the CRM, forecasting and the tooling budget (typically 200k to 600k a year). Their pain is forecast accuracy: the board asks for a number every quarter and the pipeline data is too dirty to trust, so they spend the last week of every quarter in spreadsheets. They buy when a new CRO arrives or after a missed quarter. The CRO sponsors, the CFO approves anything over 100k, and sales managers can veto by refusing to adopt. They read Pavilion and RevOps Co-op, attend SaaStr, and will take a call from a peer referral but ignore cold email.",
      maxLength: 6000,
      minLength: 50,
      required: true,
      kind: "textarea",
    },
    {
      key: "tamSize",
      label: "Approximate TAM Size",
      placeholder: "Under 500 accounts, 500 to 1000, 1000 to 5000, 5000+ or unknown",
      example: "Under 500 accounts",
      maxLength: 100,
      minLength: 0,
      required: false,
      kind: "text",
    },
  ],
  dimensions: [
    {
      key: "pc",
      name: "Pain Clarity",
      weight: 0.25,
      levels: { 1: "Absent", 2: "Generic", 3: "Named", 4: "Quantified", 5: "Segmented" },
      standard: "Pain is quantified in business terms, segmented by persona tier, with evidence of how it manifests across company sizes.",
    },
    {
      key: "da",
      name: "Decision Authority",
      weight: 0.2,
      levels: { 1: "Absent", 2: "Identified", 3: "Partial", 4: "Mapped", 5: "Strategic" },
      standard: "Full buying committee mapped (who sponsors, who influences, who vetoes) with access paths per role.",
    },
    {
      key: "sp",
      name: "Specificity",
      weight: 0.18,
      levels: { 1: "Vague", 2: "Basic", 3: "Partial", 4: "Detailed", 5: "Comprehensive" },
      standard: "Precise enough that a new SDR could self-qualify a prospect in 30 seconds without asking a manager.",
    },
    {
      key: "re",
      name: "Reachability",
      weight: 0.15,
      levels: { 1: "Unknown", 2: "Vague", 3: "Listed", 4: "Mapped", 5: "Operationalised" },
      standard: "Named channels, communities, and events where this buyer spends time, with engagement patterns documented.",
    },
    {
      key: "jf",
      name: "Job-to-be-Done Fit",
      weight: 0.12,
      levels: { 1: "Absent", 2: "Generic", 3: "Named", 4: "Specific", 5: "Evidenced" },
      standard: "The job is specific, evidenced from customer interviews, and distinguishes your buyers from adjacent personas.",
    },
    {
      key: "fm",
      name: "Finite Market Alignment",
      weight: 0.1,
      levels: { 1: "Absent", 2: "Aware", 3: "Partial", 4: "Applied", 5: "Embedded" },
      standard: "Your persona tells you who NOT to pursue as clearly as who to pursue, and constraints are applied to your target list.",
    },
  ],
  role: "a B2B buyer persona expert focused on enterprise and scale-up sales into finite markets",
  extras: [
    {
      key: "biggestGap",
      label: "Biggest gap",
      ask: "The single most consequential gap in this persona for a team selling into a finite market, in two or three sentences that reference the input.",
      kind: "text",
    },
    {
      key: "keyQuestion",
      label: "Key question to answer",
      ask: "The one question the team should answer next to make this persona usable for selling, as a single direct question.",
      kind: "text",
    },
  ],
  seo: {
    title: "Buyer Persona Quality Check — Summit GTM Toolkit",
    description:
      "See whether your buyer persona is specific enough to actually drive sales decisions. A score out of 100, a grade from 1 to 5 and 6 scored dimensions.",
    about:
      "The Buyer Persona Quality Check scores your buyer persona on specificity, behavioural accuracy, and decision-making relevance. Most buyer personas describe a demographic; this tool checks whether yours is specific enough to actually change how your team sells.",
    howItWorks: [
      "Describe your buyer persona in detail",
      "The tool evaluates it across six scored dimensions",
      "Receive a score out of 100 and a grade from 1 to 5 with dimension-level feedback",
      "Free, no signup required",
    ],
    faqs: [
      {
        q: "What is a buyer persona?",
        a: "A buyer persona is a semi-fictional representation of your ideal buyer: the individual within a target organisation who initiates, influences, or approves the purchase decision. A strong buyer persona captures their goals, frustrations, decision criteria, and day-to-day context, not just their job title and company size.",
      },
      {
        q: "What is the difference between an ICP and a buyer persona?",
        a: "An ICP (Ideal Customer Profile) describes the ideal organisation to target. A buyer persona describes the individual within that organisation who buys. You need both: a strong ICP tells you which accounts to pursue; a strong buyer persona tells you how to sell to them once you are in.",
      },
      {
        q: "What makes a buyer persona specific enough to drive sales?",
        a: "A sales-effective buyer persona includes specific triggers that make a buyer active in the market, the exact language they use to describe their problem, the internal and external stakeholders who influence their decision, and what a successful outcome looks like to them personally, not just to the company.",
      },
      {
        q: "How is the Buyer Persona Quality Check scored?",
        a: "The tool evaluates your persona across six dimensions: Pain Clarity, Decision Authority, Specificity, Reachability, Job-to-be-Done Fit, and Finite Market Alignment. Each dimension is scored from 1 to 5 and weighted into an overall score out of 100 and a grade from 1 to 5.",
      },
    ],
    canonical: "https://summitstrategyadvisory.com/tools/persona",
  },
  hidden: false,
  feeds: ["routeToBuyer", "pain"],
  builtToScale: { persona: ["routeToBuyer", "pain"], tamSize: [] },
  cta: {
    heading: "Need help building a stronger persona?",
    body: "Summit works alongside small teams selling to enterprise: refining targeting, building account strategies, and closing the gap between aspiration and pipeline reality.",
  },
  buttonLabel: "Score My Persona",
};

const PROBLEM: ToolEntry = {
  slug: "problem",
  number: "03",
  name: "Market Problem Validator",
  tagline: "Score your market problem across six dimensions. Find out if the problem you are solving is worth building a company around.",
  outputDescription: "Verdict, score, 6 scored dimensions, next validation moves.",
  inputs: [
    {
      key: "problem",
      label: "Problem Description",
      placeholder: "Describe the problem your target customer faces. Be specific: who has it, how often, what the cost is.",
      example:
        "Mid-sized logistics firms (50 to 400 vehicles) lose between 3 and 7 percent of revenue to disputed delivery charges because proof of delivery is captured on paper or in a driver's personal phone and cannot be found when a customer queries an invoice 30 days later. Finance teams spend two to three days a month chasing drivers for photos. The problem is worst for firms serving retailers with strict delivery windows, where a missing signature means the whole invoice is held.",
      maxLength: 4000,
      minLength: 50,
      required: true,
      kind: "textarea",
    },
    {
      key: "evidence",
      label: "Supporting Evidence",
      placeholder: "Customer interviews, lost deal patterns, NPS complaints, market research",
      example:
        "14 interviews with finance leads at logistics firms; 11 named the dispute problem unprompted. Two firms already pay a part-time clerk to chase proof of delivery. Our pilot customer cut disputed invoices from 6 percent to under 1 percent in the first quarter.",
      maxLength: 2000,
      minLength: 0,
      required: false,
      kind: "textarea",
    },
    {
      key: "tamSize",
      label: "Approximate TAM Size",
      placeholder: "Under 500 accounts, 500 to 1000, 1000 to 5000, 5000+ or unknown",
      example: "1000 to 5000 accounts",
      maxLength: 100,
      minLength: 0,
      required: false,
      kind: "text",
    },
  ],
  dimensions: [
    {
      key: "pa",
      name: "Problem Acuity",
      weight: 0.25,
      levels: { 1: "Absent", 2: "Vague", 3: "Named", 4: "Quantified", 5: "Evidenced" },
      standard: "The problem is named precisely (who has it, how often, what it costs) with no room for interpretation.",
    },
    {
      key: "me",
      name: "Market Evidence",
      weight: 0.2,
      levels: { 1: "None", 2: "Anecdotal", 3: "Partial", 4: "Strong", 5: "Verified" },
      standard: "Multiple verified data points: customer interviews, deal loss patterns, industry research, analyst reports.",
    },
    {
      key: "ug",
      name: "Urgency",
      weight: 0.18,
      levels: { 1: "None", 2: "Low", 3: "Moderate", 4: "High", 5: "Critical" },
      standard: "There is a documented reason why this problem needs solving now, not in 18 months.",
    },
    {
      key: "ad",
      name: "Addressability",
      weight: 0.15,
      levels: { 1: "Unknown", 2: "Unclear", 3: "Partial", 4: "Clear", 5: "Defined" },
      standard: "The problem has a defined solution space. It is not a symptom of something deeper that cannot be fixed.",
    },
    {
      key: "cg",
      name: "Competitive Gap",
      weight: 0.12,
      levels: { 1: "None", 2: "Minimal", 3: "Partial", 4: "Clear", 5: "Significant" },
      standard: "Existing solutions are specifically named and their failure modes are evidenced, not just implied.",
    },
    {
      key: "ms",
      name: "Monetisation Signal",
      weight: 0.1,
      levels: { 1: "None", 2: "Weak", 3: "Partial", 4: "Strong", 5: "Verified" },
      standard: "Someone has already paid money (or equivalent) to solve this, which is proof that budget exists for a solution.",
    },
  ],
  role: "a B2B market validation expert specialising in finite, defined markets",
  extras: [
    {
      key: "validationMoves",
      label: "Next validation moves",
      ask: "Three to five concrete validation moves the team should make next, each one sentence, ordered by how much uncertainty it removes.",
      kind: "list",
    },
  ],
  seo: {
    title: "Market Problem Validator — Summit GTM Toolkit",
    description:
      "Stress-test whether the problem you are solving is real, urgent, and worth building against. A score out of 100, a grade from 1 to 5, a verdict and 6 scored dimensions.",
    about:
      "The Market Problem Validator stress-tests whether the problem your product solves is real, specific, urgent, and defensible enough to build a business against. It evaluates problem quality across six dimensions and delivers a score, a grade and a clear one-sentence verdict on whether the problem is worth pursuing at scale.",
    howItWorks: [
      "Describe the market problem you are solving",
      "The tool evaluates it across six problem-quality dimensions",
      "Receive a score out of 100, a grade from 1 to 5 and a one-sentence verdict",
      "Dimension-level feedback surfaces the specific weaknesses",
    ],
    faqs: [
      {
        q: "What makes a market problem worth building against?",
        a: "A buildable market problem is specific (affects a defined group), acute (causes real pain when unsolved), frequent (occurs regularly, not once), and currently solved poorly or expensively by existing options. The best problems are ones where the buyer is already spending money on a workaround.",
      },
      {
        q: "What is the difference between a real problem and a perceived problem?",
        a: "A real problem has observable symptoms: buyers can describe it, are already trying to solve it, and will pay to solve it better. A perceived problem is one the founder believes exists but which buyers do not actively feel pain from. The Market Problem Validator tests for evidence of real pain, not just logical reasoning.",
      },
      {
        q: "How do I know if my problem is urgent enough?",
        a: "Urgency is evidenced by buyers prioritising the problem unprompted, allocating existing budget to solve it, or experiencing measurable consequences when it goes unsolved. If buyers say 'yes, that is a problem' but do not act on it, the urgency is not sufficient to support a product business.",
      },
      {
        q: "Can the tool be used for early-stage startup validation?",
        a: "Yes. The Market Problem Validator is designed for exactly this use case. It is most useful before building, helping founders stress-test their problem hypothesis before investing in product development.",
      },
    ],
    canonical: "https://summitstrategyadvisory.com/tools/problem",
  },
  hidden: false,
  feeds: ["pain", "valueEvidence"],
  builtToScale: { problem: ["pain"], evidence: ["valueEvidence"], tamSize: [] },
  cta: {
    heading: "Need help validating your market?",
    body: "Summit works alongside small teams selling to enterprise: sharpening problem definition, refining targeting, and closing the gap between aspiration and pipeline reality.",
  },
  buttonLabel: "Validate My Problem",
};

const POSITIONING: ToolEntry = {
  slug: "positioning",
  number: "04",
  name: "Positioning Statement Grader",
  tagline: "Score your positioning across six dimensions. Find the gaps before a weak statement costs you deals in a finite market.",
  outputDescription: "Grade, overall score, 6 scored dimensions, suggested rewrite if needed.",
  inputs: [
    {
      key: "statement",
      label: "Positioning Statement",
      placeholder: "We help [customer] achieve [outcome] by [mechanism], unlike [alternative].",
      example:
        "We help UK housing associations with 5,000 to 30,000 homes cut repairs spend by 12 to 18 percent by routing every job through a single contractor marketplace with fixed prices, unlike the framework agreements and spreadsheets they rely on today.",
      maxLength: 4000,
      minLength: 20,
      required: true,
      kind: "textarea",
    },
    {
      key: "context",
      label: "Additional Context",
      placeholder: "e.g. Series B SaaS, selling to NHS trusts",
      example: "Seed stage, 9 customers, selling to housing associations in England",
      maxLength: 500,
      minLength: 0,
      required: false,
      kind: "text",
    },
  ],
  dimensions: [
    {
      key: "di",
      name: "Differentiation",
      weight: 0.25,
      levels: { 1: "Generic", 2: "Claimed", 3: "Partial", 4: "Clear", 5: "Undeniable" },
      standard: "Your claim is specific enough that it could not be made by any of your top 5 competitors without being obviously false.",
    },
    {
      key: "sp",
      name: "Specificity",
      weight: 0.22,
      levels: { 1: "Vague", 2: "Broad", 3: "Partial", 4: "Specific", 5: "Precise" },
      standard: "Named customer segment, named outcome, named mechanism. No generic language that could apply to any B2B vendor.",
    },
    {
      key: "mf",
      name: "Market Fit",
      weight: 0.18,
      levels: { 1: "Misaligned", 2: "Weak", 3: "Partial", 4: "Strong", 5: "Perfect" },
      standard: "The statement addresses real buying criteria that your specific market cares about, not generic benefits.",
    },
    {
      key: "cl",
      name: "Clarity",
      weight: 0.15,
      levels: { 1: "Unclear", 2: "Confused", 3: "Partial", 4: "Clear", 5: "Crystal" },
      standard: "A first-time reader understands exactly who you serve, what you do, and why it matters in under 10 seconds.",
    },
    {
      key: "cr",
      name: "Credibility",
      weight: 0.12,
      levels: { 1: "Absent", 2: "Weak", 3: "Partial", 4: "Strong", 5: "Verified" },
      standard: "Evidence or proof points are woven in: case study references, metrics, or verifiable claims.",
    },
    {
      key: "er",
      name: "Emotional Resonance",
      weight: 0.08,
      levels: { 1: "Flat", 2: "Weak", 3: "Moderate", 4: "Strong", 5: "Compelling" },
      standard: "It speaks to what the buyer actually cares about, not just features, connecting to real stakes and consequences.",
    },
  ],
  role: "a B2B positioning expert specialising in finite, defined markets of fewer than 5,000 accounts",
  extras: [
    {
      key: "rewrite",
      label: "Suggested rewrite",
      ask: "A rewritten positioning statement in the form \"We help [customer] achieve [outcome] by [mechanism], unlike [alternative]\" that fixes the weakest dimensions while keeping every true claim from the input. One or two sentences.",
      kind: "text",
    },
  ],
  seo: {
    title: "Positioning Statement Grader — Summit GTM Toolkit",
    description:
      "Find out if your positioning statement actually works or just sounds good. A score out of 100, a grade from 1 to 5 and a suggested rewrite.",
    about:
      "The Positioning Statement Grader evaluates whether your positioning statement clearly communicates who you are for, what you do, and why you are the better choice, or whether it is generic enough to apply to any competitor. It scores the statement out of 100 with a grade from 1 to 5, and the full view includes a suggested rewrite that fixes the weakest dimensions.",
    howItWorks: [
      "Paste in your positioning statement",
      "The tool evaluates it against six positioning criteria",
      "Receive a score out of 100 and a grade from 1 to 5 with dimension-level feedback",
      "Unlock the full view for per-dimension reasoning and a suggested rewrite",
    ],
    faqs: [
      {
        q: "What is a positioning statement?",
        a: "A positioning statement is a single sentence or short paragraph that defines who your product is for, what category it belongs to, what unique value it delivers, and why a buyer should choose it over alternatives. A strong positioning statement is specific enough that it could only describe your product, not your competitors.",
      },
      {
        q: "What makes a positioning statement weak?",
        a: "The most common weakness is generality: statements like 'the leading platform for teams that want to grow' apply to hundreds of products. Weak positioning fails to specify the exact buyer, the exact problem, or the specific mechanism of the advantage. If you replaced your company name with a competitor's, the statement should no longer be true.",
      },
      {
        q: "What is the difference between positioning and messaging?",
        a: "Positioning is the internal strategic foundation: the logic of why you win in your market. Messaging is the external expression of that positioning in language buyers respond to. You build positioning first, then derive messaging from it. The Positioning Statement Grader evaluates the strategic foundation.",
      },
      {
        q: "How specific should a positioning statement be?",
        a: "Specific enough that your target buyer reads it and thinks 'that is exactly us', and your non-target buyer reads it and thinks 'that is not for me'. Specificity that excludes the wrong buyers is a feature, not a flaw, especially in finite markets where sales efficiency matters.",
      },
    ],
    canonical: "https://summitstrategyadvisory.com/tools/positioning",
  },
  hidden: false,
  feeds: ["valueEvidence"],
  builtToScale: { statement: ["valueEvidence"], context: [] },
  cta: {
    heading: "Need help sharpening your positioning?",
    body: "Summit works alongside small teams selling to enterprise: refining positioning, building account strategies, and closing the gap between aspiration and pipeline reality.",
  },
  buttonLabel: "Grade My Positioning",
};

const MOAT: ToolEntry = {
  slug: "moat",
  number: "05",
  name: "Competitive Moat Rater",
  tagline: "Score your competitive moat across six dimensions. Most companies overestimate their defensibility. Find out where yours actually stands.",
  outputDescription: "Moat rating (Strong / Moderate / Thin / Exposed), score, 6 dimensions, 90-day priority.",
  inputs: [
    {
      key: "position",
      label: "Your Competitive Position",
      placeholder:
        "Describe what you do, what makes you different, and why customers choose you over alternatives. Be honest: this analysis is only as good as your input.",
      example:
        "We run the clinical trial supply chain for 40 mid-sized pharma sponsors. Our platform holds six years of shipment and temperature data that competitors cannot replicate, and switching means re-validating every depot under GxP, which takes a sponsor nine to twelve months. We are slower to ship features than Veeva's module but our customers renew at 96 percent because their QA teams have built SOPs around our audit trail. Pricing is per trial; we have held price through two renewal cycles. Our weak spot is brand: outside our customers nobody has heard of us.",
      maxLength: 6000,
      minLength: 50,
      required: true,
      kind: "textarea",
    },
    {
      key: "competitors",
      label: "Key Competitors",
      placeholder: "e.g. Salesforce, HubSpot, internal spreadsheets",
      example: "Veeva, Almac, internal spreadsheets",
      maxLength: 500,
      minLength: 0,
      required: false,
      kind: "text",
    },
  ],
  dimensions: [
    {
      key: "sc",
      name: "Switching Cost",
      weight: 0.25,
      levels: { 1: "None", 2: "Minimal", 3: "Moderate", 4: "Strong", 5: "Locked" },
      standard: "Customers are technically, contractually, or operationally locked in. Switching would require significant time, money, or risk.",
    },
    {
      key: "pd",
      name: "Product Differentiation",
      weight: 0.22,
      levels: { 1: "Generic", 2: "Weak", 3: "Partial", 4: "Clear", 5: "Unique" },
      standard: "You do something competitors cannot replicate in 6 months. Not just better UX, but a fundamentally different capability or approach.",
    },
    {
      key: "ne",
      name: "Network / Data Effect",
      weight: 0.18,
      levels: { 1: "None", 2: "Early", 3: "Building", 4: "Established", 5: "Dominant" },
      standard: "Each new customer makes the product more valuable for all existing customers, or you hold a data advantage that compounds over time.",
    },
    {
      key: "br",
      name: "Brand & Relationships",
      weight: 0.15,
      levels: { 1: "None", 2: "Minimal", 3: "Growing", 4: "Strong", 5: "Entrenched" },
      standard: "Customers buy you partly because of who you are, not just what you do. Reputation and relationships act as a barrier to entry.",
    },
    {
      key: "sd",
      name: "Speed & Execution",
      weight: 0.12,
      levels: { 1: "Slow", 2: "Below Avg", 3: "Average", 4: "Fast", 5: "Elite" },
      standard: "Your deployment and iteration speed is a demonstrable advantage. You ship faster, learn faster, and respond faster than alternatives.",
    },
    {
      key: "pr",
      name: "Price Defensibility",
      weight: 0.08,
      levels: { 1: "Exposed", 2: "Weak", 3: "Moderate", 4: "Strong", 5: "Protected" },
      standard: "You can hold your price under competitive pressure because the value delivered justifies it. You do not compete on cost.",
    },
  ],
  role: "a competitive strategy expert focused on B2B SaaS and enterprise software",
  extras: [
    {
      key: "priority",
      label: "90-day priority",
      ask: "The single most valuable thing the team could do in the next 90 days to strengthen the moat, in two or three sentences that name the dimension it moves and why it comes first.",
      kind: "text",
    },
  ],
  legacyLabel: { 5: "Strong", 4: "Moderate", 3: "Thin", 2: "Thin", 1: "Exposed" },
  seo: {
    title: "Competitive Moat Rater — Summit GTM Toolkit",
    description:
      "Understand how defensible your position really is and what threatens it. A score out of 100, a grade from 1 to 5 and a Strong, Moderate, Thin or Exposed rating.",
    about:
      "The Competitive Moat Rater evaluates how defensible your competitive position is across six dimensions of durable advantage: switching cost, product differentiation, network and data effects, brand and relationships, speed and execution, and price defensibility. It delivers a score out of 100, a grade from 1 to 5 and a four-level rating (Strong, Moderate, Thin or Exposed) with a breakdown of what is protecting you and what is not.",
    howItWorks: [
      "Describe your competitive position and key advantages",
      "The tool evaluates defensibility across six moat dimensions",
      "Receive a score out of 100, a grade from 1 to 5 and a rating of Strong, Moderate, Thin or Exposed",
      "The breakdown identifies which moat types are present and which are absent",
    ],
    faqs: [
      {
        q: "What is a competitive moat?",
        a: "A competitive moat is a durable structural advantage that makes it difficult for competitors to replicate your position or for customers to switch away. The term was popularised by Warren Buffett. In B2B markets, moats typically come from switching costs, proprietary data, network effects, brand trust, or cost advantages.",
      },
      {
        q: "What are the five types of competitive moat?",
        a: "The five main moat types in B2B software and services are: (1) switching costs, the time and expense of replacing your product; (2) network effects, value increasing as more users join; (3) proprietary data, unique data assets competitors cannot replicate; (4) brand, a trusted reputation that commands a premium; and (5) cost position, the ability to deliver at a lower cost than competitors.",
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
    canonical: "https://summitstrategyadvisory.com/tools/moat",
  },
  hidden: false,
  feeds: ["abilityToProtect"],
  builtToScale: { position: ["abilityToProtect"], competitors: [] },
  cta: {
    heading: "Need help building a stronger moat?",
    body: "Summit works alongside small teams selling to enterprise: sharpening competitive positioning, building account strategies, and closing the gap between aspiration and pipeline reality.",
  },
  buttonLabel: "Rate My Moat",
};

/**
 * Route to Buyer and Unit of Value shipped hidden in Release 2. Unit of
 * Value passed calibration and is public from Release 3a (Tool 06). Route to
 * Buyer failed three calibration cases on single dimension moves and stays
 * hidden (Tool 07) pending the owner's judgement of those cases; while hidden
 * it is absent from the Built to Scale? run and named as such in the
 * synthesis prompt. Flipping it is Anthony's call.
 */
const ROUTE_TO_BUYER: ToolEntry = {
  slug: "route-to-buyer",
  number: "07",
  name: "Route to Buyer",
  tagline: "Score how you reach the buyer across six dimensions. Find the one constraint between you and the people who can sign.",
  outputDescription: "Score, grade, six scored dimensions, the gatekeeper whose no costs most, and the first channel move.",
  inputs: [
    {
      key: "buyer",
      label: "Who the buyer is",
      placeholder:
        "Who signs, who influences and who can say no. Role, company type, the budget line the money comes from, and roughly how many such buyers exist.",
      example:
        "The buyer is the Director of Fleet Operations at Canadian municipalities with 150 to 900 vehicles. There are about 110 of them. The CFO approves anything over 75,000 CAD and the procurement office runs the tender. Budget comes from the fleet replacement line, set each autumn.",
      maxLength: 4000,
      minLength: 50,
      required: true,
      kind: "textarea",
    },
    {
      key: "route",
      label: "How you reach them today",
      placeholder:
        "How a first conversation starts now. Outbound, referrals, partners, tenders, events, inbound. Who does it and how much of it depends on the founder.",
      example:
        "Most conversations start when a fleet manager we already serve mentions us to a peer at the Canadian Public Fleet Managers conference. The founder does every first call. We answer public tenders when we see them, usually too late.",
      maxLength: 4000,
      minLength: 50,
      required: true,
      kind: "textarea",
    },
    {
      key: "cycle",
      label: "Typical sales cycle",
      placeholder: "First contact to signature: how long, and the steps in between.",
      example: "Nine to fourteen months: pilot on ten vehicles, council budget approval, tender, legal review.",
      maxLength: 600,
      minLength: 0,
      required: false,
      kind: "text",
    },
    {
      key: "channels",
      label: "Partners and channels",
      placeholder:
        "Any partner, association, marketplace, community or event that already gathers these buyers, and whether you have a place in it.",
      example:
        "We sponsor the fleet managers conference and sit on its vendor panel. Two telematics installers refer us when a municipality asks about reporting. No marketplace listing.",
      maxLength: 2000,
      minLength: 0,
      required: false,
      kind: "textarea",
    },
  ],
  dimensions: [
    {
      key: "bi",
      name: "Buyer Identifiable",
      weight: 0.2,
      levels: { 1: "Absent", 2: "Vague", 3: "Named", 4: "Specific", 5: "Listable" },
      standard: "You can name the buyer's role, the type of company they sit in and the budget line the purchase comes from, and you could list them by name.",
    },
    {
      key: "ch",
      name: "Channels That Gather Buyers",
      weight: 0.2,
      levels: { 1: "None", 2: "Possible", 3: "Present", 4: "Working", 5: "Owned" },
      standard: "Partners, organisers, marketplaces, communities or events already concentrate these buyers somewhere the company reaches today, and the company has a working place in that channel.",
    },
    {
      key: "gk",
      name: "Gatekeeper Dependence",
      weight: 0.15,
      levels: { 1: "Captive", 2: "Heavy", 3: "Present", 4: "Light", 5: "None" },
      standard: "No party sits between the company and the buyer whose single no can stop a sale, and a no from anyone else costs little.",
    },
    {
      key: "ba",
      name: "Buyer Attention",
      weight: 0.1,
      levels: { 1: "Wrong time", 2: "Unknown", 3: "Known", 4: "Timed", 5: "Triggered" },
      standard: "The company knows when the buyer is able to act and reaches them on that trigger, not when they are busiest.",
    },
    {
      key: "sc",
      name: "Sales Cycle",
      weight: 0.15,
      levels: { 1: "Open-ended", 2: "Long", 3: "Defined", 4: "Short", 5: "Transactional" },
      standard: "The steps from first contact to signature are few, defined and short enough to repeat many times a year.",
    },
    {
      key: "cw",
      name: "Cost to Win Against Deal Value",
      weight: 0.2,
      levels: { 1: "Founder heroics", 2: "Expensive", 3: "Covered", 4: "Repeatable", 5: "Efficient" },
      standard: "Acquisition effort and spend are small against first-year value, and winning repeats without the founder in the room.",
    },
  ],
  role: "a B2B go-to-market expert who has built sales motions for companies selling into finite, named-account markets",
  extras: [
    {
      key: "gatekeeperRisk",
      label: "Gatekeeper risk",
      ask: "One line naming the party whose no costs this company most on the way to the buyer, and what that no costs in time, money or lost accounts.",
      kind: "text",
    },
    {
      key: "channelMove",
      label: "First channel move",
      ask: "The one channel move to make first, one sentence, specific to this business and naming the channel.",
      kind: "text",
    },
  ],
  seo: {
    title: "Route to Buyer — Summit GTM Toolkit",
    description:
      "See whether you can name, reach and win your buyer without the founder in every deal. A score out of 100, a grade from 1 to 5 and six scored dimensions.",
    about:
      "The Route to Buyer scores how a company reaches the people who can sign: whether the buyer can be named, whether a channel already gathers them, how many gatekeepers sit in the way, whether the company reaches them when they can act, how long the cycle runs, and what it costs to win against what a deal is worth. It is built for teams selling into a finite market, where every buyer burned is one fewer to sell to.",
    howItWorks: [
      "Describe the buyer, how you reach them today, the typical cycle and any channels",
      "The tool scores the route across six weighted dimensions",
      "Receive a score out of 100, a grade from 1 to 5, a one-line verdict and the gatekeeper whose no costs most",
      "Free, no signup, results in under 30 seconds",
    ],
    faqs: [
      {
        q: "What is a route to buyer?",
        a: "A route to buyer is the path a first conversation takes from your company to the person who can sign: who starts it, which channel it runs through, who has to say yes on the way, and how long it takes. A strong route is one the company can repeat without the founder, through a channel that already gathers the buyers.",
      },
      {
        q: "Why does the route matter more in a finite market?",
        a: "When there are 110 buyers, not 110,000, every route that burns a buyer removes one you cannot replace. A route that depends on founder introductions or a gatekeeper's goodwill caps how many of those buyers you will ever reach. The check finds the constraint before you scale spend into it.",
      },
      {
        q: "What are the six dimensions in the Route to Buyer?",
        a: "Buyer Identifiable, Channels That Gather Buyers, Gatekeeper Dependence, Buyer Attention, Sales Cycle, and Cost to Win Against Deal Value. Each is scored from 1 to 5 and weighted into a score out of 100 and a grade from 1 to 5.",
      },
      {
        q: "Is the Route to Buyer free?",
        a: "Yes. It is free to use with no signup or account required. Results are generated in under 30 seconds.",
      },
    ],
    canonical: "https://summitstrategyadvisory.com/tools/route-to-buyer",
  },
  hidden: true,
  feeds: ["routeToBuyer"],
  builtToScale: { buyer: ["routeToBuyer", "pain"], route: ["routeToBuyer"], cycle: [], channels: [] },
  cta: {
    heading: "Need help reaching the buyer?",
    body: "Summit works alongside small teams selling to enterprise: finding the channels that gather buyers, shortening the cycle, and closing the gap between aspiration and pipeline reality.",
  },
  buttonLabel: "Check My Route",
};

const UNIT_OF_VALUE: ToolEntry = {
  slug: "unit-of-value",
  number: "06",
  name: "Unit of Value",
  tagline: "Score what one sale consumes and what caps it across six dimensions. See the revenue ceiling per head and the lever most likely to break it.",
  outputDescription: "Score, grade, six scored dimensions, the annual revenue ceiling per head with its assumptions, and the lever to break it.",
  inputs: [
    {
      key: "delivery",
      label: "What you deliver and what one sale consumes",
      placeholder:
        "What the customer buys, and what delivering one of them uses up: hours, people, slots, seats, servers. Numbers where you have them.",
      example:
        "We run incident response tabletop exercises for mid-sized hospitals. One exercise is a one-day on-site session led by one of our facilitators, with about two days of preparation and one day of write-up. Each facilitator runs one exercise a week, forty weeks a year.",
      maxLength: 4000,
      minLength: 50,
      required: true,
      kind: "textarea",
    },
    {
      key: "pricing",
      label: "How it is priced",
      placeholder: "Per what, at what price, in which currency. Tiers, usage, seats, retainers.",
      example: "Priced per exercise at 9,500 CAD. A three exercise programme is 25,000 CAD. No retainer, no subscription.",
      maxLength: 3000,
      minLength: 20,
      required: true,
      kind: "textarea",
    },
    {
      key: "cost",
      label: "What a delivery takes in people and time",
      placeholder: "Who does the work, how long it takes, and what it costs you to deliver one unit.",
      example:
        "A facilitator costs us about 140,000 CAD a year fully loaded. Preparation is mostly re-used templates now, so a new facilitator reaches full speed in six weeks.",
      maxLength: 3000,
      minLength: 0,
      required: false,
      kind: "textarea",
    },
    {
      key: "renewal",
      label: "How customers renew or expand",
      placeholder: "What share of customers buy again, how often, and whether they buy more each time.",
      example:
        "About half of hospitals book a second exercise within eighteen months, usually the same size. Two of thirty have bought a programme.",
      maxLength: 2000,
      minLength: 0,
      required: false,
      kind: "textarea",
    },
  ],
  dimensions: [
    {
      key: "ud",
      name: "Unit of Delivery",
      weight: 0.2,
      levels: { 1: "People-bound", 2: "Mostly people", 3: "Mixed", 4: "Mostly product", 5: "Product" },
      standard: "One sale consumes product capacity (seats, slots, servers) rather than people's hours.",
    },
    {
      key: "cu",
      name: "Capacity per Unit",
      weight: 0.2,
      levels: { 1: "One", 2: "Few", 3: "Many", 4: "Hundreds", 5: "Unbounded" },
      standard: "One unit of capacity serves an unbounded number of customers at the same time.",
    },
    {
      key: "mv",
      name: "Margin at Volume",
      weight: 0.2,
      levels: { 1: "Erodes", 2: "Flat and thin", 3: "Holds", 4: "Improves", 5: "Compounds" },
      standard: "Margin compounds as volume grows because each extra customer costs less to serve than the last.",
    },
    {
      key: "rr",
      name: "Repeat Revenue",
      weight: 0.15,
      levels: { 1: "None", 2: "Some", 3: "Partial", 4: "Majority", 5: "Compounding" },
      standard: "Most of next year's revenue already exists through renewals or usage, and it grows without a new sale.",
    },
    {
      key: "vg",
      name: "Value Growth per Unit",
      weight: 0.1,
      levels: { 1: "Fixed", 2: "Limited", 3: "Growing", 4: "Tiered", 5: "Expanding" },
      standard: "The value delivered per unit rises over time through tiers, usage or expansion rather than being fixed by the unit.",
    },
    {
      key: "cb",
      name: "Ceiling Breaker",
      weight: 0.15,
      levels: { 1: "None", 2: "Named", 3: "Started", 4: "Proven", 5: "Primary" },
      standard: "A credible lever (software, channel or pricing) that moves growth off headcount is already the primary engine of growth.",
    },
  ],
  role: "a B2B business model analyst who has scaled service and software companies",
  extras: [
    {
      key: "ceilingInputs",
      label: "Revenue ceiling per head",
      ask: "Where the text supports it, the three inputs to the annual revenue ceiling per head, each as a number with the assumption behind it: unitsPerPersonPerPeriod (how many units one person delivers in one period, for example clients per evaluator per show), pricePerUnit (the price of one unit, in the currency the text uses), periodsPerYear (how many periods there are in a year). Return null for any input the text does not give. Never estimate a missing one. The code computes the figure.",
      kind: "ceiling",
    },
    {
      key: "lever",
      label: "Ceiling breaker",
      ask: "The one lever most likely to break the ceiling on this business, one sentence, specific to this business and naming whether it is software, channel or pricing.",
      kind: "text",
    },
  ],
  seo: {
    title: "Unit of Value — Summit GTM Toolkit",
    description:
      "See what one sale consumes, what caps it, and the revenue ceiling per head. A score out of 100, a grade from 1 to 5 and six scored dimensions.",
    about:
      "The Unit of Value scores what a company sells as a unit: what one sale consumes, how many customers one unit of capacity serves, whether margin holds as volume grows, how much revenue repeats, whether value per unit can rise, and whether there is a credible lever to move growth off headcount. Where the input gives the numbers, it computes the annual revenue ceiling per head and shows the assumptions beside it.",
    howItWorks: [
      "Describe what you deliver, how it is priced, what a delivery takes and how customers renew",
      "The tool scores the unit across six weighted dimensions",
      "Receive a score out of 100, a grade from 1 to 5, a one-line verdict and, where the numbers allow, the revenue ceiling per head",
      "Free, no signup, results in under 30 seconds",
    ],
    faqs: [
      {
        q: "What is a unit of value?",
        a: "The unit of value is what a customer buys as one thing and what delivering it uses up: an hour, a day, a seat, a slot, a server. It decides whether revenue grows with headcount or without it. A business whose unit is people's time has a ceiling set by how many people it can hire and keep busy.",
      },
      {
        q: "What is the revenue ceiling per head?",
        a: "Units one person can deliver in a period, multiplied by the price of a unit, multiplied by the periods in a year. For a show-based business that is clients per evaluator per show, times price, times shows a year. The check computes it from the numbers in your input and never estimates a number you did not give.",
      },
      {
        q: "What are the six dimensions in the Unit of Value?",
        a: "Unit of Delivery, Capacity per Unit, Margin at Volume, Repeat Revenue, Value Growth per Unit, and Ceiling Breaker. Each is scored from 1 to 5 and weighted into a score out of 100 and a grade from 1 to 5.",
      },
      {
        q: "Is the Unit of Value free?",
        a: "Yes. It is free to use with no signup or account required. Results are generated in under 30 seconds.",
      },
    ],
    canonical: "https://summitstrategyadvisory.com/tools/unit-of-value",
  },
  hidden: false,
  feeds: ["unitOfValue"],
  builtToScale: { delivery: ["unitOfValue"], pricing: ["unitOfValue"], cost: [], renewal: [] },
  cta: {
    heading: "Need help moving growth off headcount?",
    body: "Summit works alongside small teams selling to enterprise: reshaping the unit, pricing for expansion, and closing the gap between aspiration and pipeline reality.",
  },
  buttonLabel: "Check My Unit",
};

/**
 * Account Intelligence is hidden site-wide: absent from the hub, routed to
 * 404, skipped by static params and blocked at the API. Its component owns
 * its own form, so the registry carries no inputs or dimensions for it.
 */
const ACCOUNT: ToolEntry = {
  slug: "account",
  number: "00",
  name: "Account Intelligence",
  tagline: "Get a full sales brief on any target account: signals, contacts, and an opening play.",
  outputDescription: "ICP fit, timing verdict, key contacts with LinkedIn searches, market signals, recommended opening.",
  inputs: [],
  dimensions: [],
  role: "an enterprise sales intelligence analyst",
  extras: [],
  seo: {
    title: "Account Intelligence — Summit GTM Toolkit",
    description:
      "Pull live signals on any target account and build a full sales brief: ICP fit, contacts, timing verdict, opening play.",
    about:
      "Account Intelligence pulls live signals on any target account and generates a full sales brief covering ICP fit score, key contacts, timing verdict, and a recommended opening play, saving hours of pre-call research.",
    howItWorks: [
      "Enter a target account domain or company name",
      "The tool pulls live signals across multiple data sources",
      "Receive ICP fit score, key contacts, timing verdict, and opening play",
    ],
    faqs: [
      {
        q: "What is account intelligence in B2B sales?",
        a: "Account intelligence is the process of gathering and synthesising information about a target account before outreach, including company context, recent signals, key decision-makers, and indicators of buying readiness. Strong account intelligence improves open rates, conversation quality, and close rates.",
      },
    ],
    canonical: "https://summitstrategyadvisory.com/tools/account",
  },
  hidden: true,
  feeds: [],
  builtToScale: {},
  cta: {
    heading: "Need help with account strategy?",
    body: "Summit works alongside small teams selling to enterprise: building account strategies and closing the gap between aspiration and pipeline reality.",
  },
  buttonLabel: "Build the Brief",
};

/** Every tool in number order. Hidden tools are included; use PUBLIC_TOOLS for the hub. */
export const TOOLS: readonly ToolEntry[] = [ICP, PERSONA, PROBLEM, POSITIONING, MOAT, UNIT_OF_VALUE, ROUTE_TO_BUYER, ACCOUNT];

export const TOOL_SLUGS = TOOLS.map((t) => t.slug) as readonly ToolSlug[];

export const PUBLIC_TOOLS: readonly ToolEntry[] = TOOLS.filter((t) => !t.hidden);

const COUNT_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

/** The word for a small count ("five"), or its digits above twelve. `capitalised` upper-cases the first letter. */
export function countWord(n: number, capitalised = false): string {
  const word = Number.isInteger(n) && n >= 0 && n < COUNT_WORDS.length ? COUNT_WORDS[n] : String(n);
  return capitalised ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

/** How many tools are public today. Copy reads this, never a literal. */
export const PUBLIC_TOOL_COUNT: number = PUBLIC_TOOLS.length;

export const PUBLIC_TOOL_COUNT_WORD: string = countWord(PUBLIC_TOOL_COUNT);

export const PUBLIC_TOOL_COUNT_WORD_CAPITALISED: string = countWord(PUBLIC_TOOL_COUNT, true);

export function isToolSlug(value: string): value is ToolSlug {
  return (TOOL_SLUGS as readonly string[]).includes(value);
}

export function getTool(slug: string): ToolEntry | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

export function isToolHidden(slug: ToolSlug): boolean {
  return getTool(slug)?.hidden ?? true;
}

/** True only if the slug is valid AND currently published. Use for routing. */
export function isToolPublic(value: string): value is ToolSlug {
  return isToolSlug(value) && !isToolHidden(value);
}
