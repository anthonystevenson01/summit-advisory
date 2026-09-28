/**
 * Copy, option definitions, tool-to-stage map, FAQs and JSON-LD for the three
 * Scale-Up Advisory pages:
 *   /scale-up-advisory                       (hub: hero, two options, free tools)
 *   /scale-up-advisory/fractional-executive  (hire a fractional executive)
 *   /scale-up-advisory/outsourced-sales      (outsource your sales: pitch summary)
 *
 * Keep this module free of runtime imports (`import type` only). The tests in
 * __tests__/scale-up-advisory.test.ts load it directly with Node's type
 * stripping, which cannot resolve the `@/` alias or pull in React/Next.
 */
import type { ToolSlug } from "@/app/tools/[tool]/toolSlugs";

// ── URLs and dates ──

export const SITE_URL = "https://summitstrategyadvisory.com";
export const SCALE_UP_PATH = "/scale-up-advisory";
export const FRACTIONAL_EXEC_PATH = "/scale-up-advisory/fractional-executive";
export const OUTSOURCED_SALES_PATH = "/scale-up-advisory/outsourced-sales";
export const TOOLS_HUB_PATH = "/tools";
export const BOOK_URL =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ35rKsxptXY-OfUDUjC4G9jWqVTFtPcCPApotrNSNzoQoEvN-HAegmAab4E5jxQ7NAgSF89ollu?gv=true";

export const LAST_REVIEWED_LABEL = "September 2026";
export const DATE_MODIFIED = "2026-09-28";

// ── Top level: hero and the two options ──

export const HERO = {
  eyebrow: "For B2B Scale-Ups",
  title: "Grow without the gamble.",
  lead: "Summit builds, runs and leads your commercial function. Fractional talent, guided by your intelligence, enabled by AI.",
} as const;

export type OptionId = "fractional-executive" | "outsource-sales";

export interface ScaleUpOption {
  id: OptionId;
  title: string;
  body: string;
  href: string;
  cta: string;
}

/**
 * The two option cards on /scale-up-advisory. Each links to its own page,
 * built from the path constants above so the cards cannot drift from the
 * pages they point at.
 */
export const OPTIONS: readonly ScaleUpOption[] = [
  {
    id: "fractional-executive",
    title: "Hire a fractional executive",
    body: "Senior commercial leadership, part-time. Summit has experienced commercial people you can bring in as your CRO, CCO or CMO. They own the function and answer for the results.",
    href: FRACTIONAL_EXEC_PATH,
    cta: "Meet the model",
  },
  {
    id: "outsource-sales",
    title: "Outsource your sales",
    body: "Hand over as much or as little of sales as you need. Fixed-price packages, fractional people to run them, and an engine built on your intelligence. You own all of it.",
    href: OUTSOURCED_SALES_PATH,
    cta: "See how it works",
  },
];

// ── Hub-only copy ──

export const HUB_OPTIONS_LABEL = "Two ways in";

/**
 * The hub's free tools section. The cards reuse TOOL_STAGE_MAP but carry the
 * constant `cardTag` rather than "{stage} package" because no page explains
 * the package stages any more (the outsourced page only says "from MAP to
 * GROW"). The test requires heading + body to mention AI and free.
 */
export const HUB_TOOLS = {
  label: "Free GTM tools",
  heading: "We know AI. We've built free tools to help you.",
  body: "Summit uses AI every day, in our own sales and in the engines we build for clients. Along the way we've built five free GTM tools that put some of that to work for you: score your ICP, validate the problem, pressure-test a persona, grade your positioning, rate your moat. No sign-up. Try them before you talk to us.",
  cardTag: "Free tool",
  cardCta: "Try it free",
  hubLink: "See all five tools",
} as const;

// ── Outsource your sales: pitch summary (the deck narrative is on main at 0912fd5) ──

/**
 * Hero for the outsourced page. `eyebrow` is the shared HERO.eyebrow rather
 * than "Scale-Up Advisory" because the back link directly above it already
 * says that. `lead` only restates claims made further down the page.
 */
export const OUTSOURCED_HERO = {
  back: "Scale-Up Advisory",
  eyebrow: HERO.eyebrow,
  title: "Outsource your sales",
  lead: "Hand over as much or as little of sales as you need. Summit builds the engine on your intelligence, supplies the fractional people to run it, and charges a fixed price for each package. You own everything we build.",
} as const;

/**
 * The one-paragraph pitch. It spells out PACKAGE_COUNT ("Nineteen") and spans
 * PACKAGE_STAGES first to last ("from MAP to GROW"); the test checks both, so
 * change them together.
 */
export const WHAT_SUMMIT_IS = {
  label: "What Summit is",
  body: "The convenience of outsourcing. The ownership of insourcing. Nineteen fixed-price packages cover the whole sales process, from MAP to GROW, taken up piece by piece as you grow. Each one is two things: an engine built on your intelligence, and the fractional people to run it.",
} as const;

export const THESIS = {
  label: "Summit's thesis",
  heading: "Four things are true at once.",
  points: [
    {
      title: "Fractional is the saving.",
      body: "Senior sales skill for the days you need it, at a fraction of the cost of a full-time team.",
    },
    {
      title: "The Summit Engine ties it all together.",
      body: "Your intelligence, in front of the seller, guides them. It speeds up onboarding and reduces the risk of sales people going rogue. The Engine learns as you go, so it keeps getting smarter.",
    },
    {
      title: "AI is the multiplier.",
      body: "Using AI for the right jobs lets a small team cover the ground of a big one.",
    },
    {
      title: "Everything it produces is yours.",
      body: "No platform, no licence. The IP and the tools we build for your operation are yours.",
    },
  ],
  /** Rendered under the four cards, inside the band: what survives of the cut Why Summit section. */
  closer: "Summit runs on the same engine. If we end up on a call, it probably booked it.",
} as const;

export const HOW_WE_CHARGE_TITLE = "How we charge";

export const HOW_WE_CHARGE: readonly string[] = [
  "Packages are fixed-price pieces of work.",
  "People are a monthly rate that flexes with the plan.",
  "No platform fee, no licence, nothing per seat.",
  "You own everything we build.",
];

export type PackageStageId = "MAP" | "REACH" | "WIN" | "ONBOARD" | "KEEP" | "GROW";

export const PACKAGE_STAGES: readonly { id: PackageStageId; body: string }[] = [
  { id: "MAP", body: "Market, ICP, prospect universe. Defined and scored." },
  { id: "REACH", body: "Outbound, content, events, partners, warm network." },
  { id: "WIN", body: "Playbook, process, execution. Deals closed properly." },
  { id: "ONBOARD", body: "Handover done well. First value, fast." },
  { id: "KEEP", body: "Success, retention, renewal. Churn seen early." },
  { id: "GROW", body: "Expansion, cross-sell, and winning back the lost." },
];

/** Source of truth for the package count. WHAT_SUMMIT_IS.body spells it out ("Nineteen"). */
export const PACKAGE_COUNT = 19;

// ── Free tools (hub cards) ──

export interface ToolStage {
  slug: ToolSlug;
  name: string;
  stage: PackageStageId;
  href: string;
  /** What the tool does, in one sentence. The hub cards show this. */
  summary: string;
  /**
   * How it ties to the package stage. No page renders it since the outsourced
   * page became a pitch summary (September 2026); kept with `stage` as the
   * documented tool-to-stage map, and the test still requires it to name
   * `stage`.
   */
  stageNote: string;
}

/**
 * Each public free tool, tied to the package stage it demonstrates. Names are
 * hardcoded (not imported from toolSlugs/toolConfig) to keep this module free
 * of runtime imports. The test guards against drift: names must match
 * TOOL_SEO titles, every slug must be public, and every public tool must be
 * mapped here, so publishing a new tool fails `npm test` until it is added.
 */
export const TOOL_STAGE_MAP: readonly ToolStage[] = [
  {
    slug: "problem",
    name: "Market Problem Validator",
    stage: "MAP",
    href: "/tools/problem",
    summary: "Tests whether the problem you solve is real and urgent.",
    stageNote: "It's the first question in any MAP package.",
  },
  {
    slug: "icp",
    name: "ICP Evaluator",
    stage: "MAP",
    href: "/tools/icp",
    summary: "Scores your ideal customer profile.",
    stageNote: "In a MAP package we score and rank your whole prospect universe.",
  },
  {
    slug: "persona",
    name: "Buyer Persona Quality Check",
    stage: "REACH",
    href: "/tools/persona",
    summary: "Pressure-tests a buyer persona.",
    stageNote: "REACH depends on getting to the right people, in the right order.",
  },
  {
    slug: "positioning",
    name: "Positioning Statement Grader",
    stage: "REACH",
    href: "/tools/positioning",
    summary: "Grades your positioning and suggests a rewrite.",
    stageNote: "REACH only works with the right message.",
  },
  {
    slug: "moat",
    name: "Competitive Moat Rater",
    stage: "WIN",
    href: "/tools/moat",
    summary: "Rates how defensible you are.",
    stageNote: "In WIN, that becomes battlecards and competitive handling.",
  },
];

// ── Where to start: the AI Lead Engine Build ──

export const LEAD_ENGINE = {
  label: "Where to start",
  strap: "Generate consistent leads every month.",
  name: "The AI Lead Engine Build",
  summary:
    "An AI-powered acquisition engine, installed in eight weeks. Live conversations by week five, predictable pipeline every month after.",
  factsTitle: "The shape of it",
  facts: [
    "Fixed price.",
    "Eight weeks.",
    "Live conversations by week five.",
    "Predictable pipeline every month after.",
    "You own every asset at the end.",
  ],
  ctaTitle: "Start with the Lead Engine Build",
  ctaBody: "Book a 30-minute call. No obligation.",
  ctaButton: "Book a 30-Minute Call",
} as const;

/**
 * Rendered by the outsourced page as `{lead} <Link to TOOLS_HUB_PATH>{link}</Link>.`
 * with the full stop supplied by the page: the same pattern as
 * FRACTIONAL_CROSS_SELL.toolsLead / toolsLink.
 */
export const OUTSOURCED_TOOLS_LINE = {
  lead: "Not ready to talk? Start with our",
  link: "free GTM tools",
} as const;

export const SCALE_UP_CTA = {
  label: "Start a conversation",
  title: "Worth 30 minutes?",
  body: "See what the first package looks like for your business. No obligation, no pitch deck.",
  button: "Book a 30-Minute Call →",
} as const;

// ── FAQs ──

export interface Faq {
  q: string;
  a: string;
}

export const OUTSOURCED_FAQS: readonly Faq[] = [
  {
    q: "What is an outsourced sales team?",
    a: "It's a sales function you don't have to hire. Summit builds the engine behind it (the intelligence library, the playbooks and the AI tools) and supplies fractional sales people to run it. You get a working sales capability without recruiting a team, and you can scale it up or down as the plan changes.",
  },
  {
    q: "Is it cheaper than hiring an SDR?",
    a: "For most scale-ups, yes. You pay for the days you need rather than a full-time salary, and you skip the ramp. A full sales hire is expensive and slow to get going, and the wrong hire costs you two quarters. Summit's people arrive experienced, the engine gets them productive quickly, and there's no platform fee, licence or per-seat charge on top.",
  },
  {
    q: "Who owns what Summit builds?",
    a: "You do. The intelligence library, the playbooks, the IP and any tools we build for your operation are yours. There's no platform to rent and no licence to renew.",
  },
  {
    q: "How is this different from a lead-gen agency?",
    a: "An agency rents you its process and keeps the know-how. Summit builds the engine inside your business, runs it with people who learn your world, and hands you everything we build. It's the convenience of outsourcing with the ownership of insourcing.",
  },
];

// ── Hire a fractional executive: page copy ──

/**
 * `eyebrow` is shared with the hub for the same reason as OUTSOURCED_HERO:
 * the back link above it already reads "Scale-Up Advisory".
 */
export const FRACTIONAL_HERO = {
  back: "Scale-Up Advisory",
  eyebrow: HERO.eyebrow,
  title: "Hire a fractional executive",
  lead: "Senior commercial leadership, part-time. Summit has a bench of experienced commercial executives, Anthony among them, who step in as your CRO, CCO or CMO. They own the function and are accountable for the outcomes, not just the recommendations.",
} as const;

export const FRACTIONAL_FEATURES: readonly { title: string; body: string }[] = [
  {
    title: "Own your GTM, part-time",
    body: "Senior-level ownership of your go-to-market function: sales process, channel strategy and pipeline development, without the full-time salary.",
  },
  {
    title: "North America entry: first revenue in 6–12 months",
    body: "A proven playbook for European technology companies entering North America, from ICP definition and channel selection through to first referenceable customer.",
  },
  {
    title: "Market entry & positioning",
    body: "Competitive positioning, ICP definition, pricing architecture and launch sequencing for new markets and new products.",
  },
  {
    title: "In the room on critical deals",
    body: "Direct involvement in the deals that matter most. Strategy, stakeholder mapping and live negotiation support from a senior executive from Summit's bench, not a junior consultant.",
  },
];

export const FRACTIONAL_WHY = {
  label: "Why Fractional",
  heading: "Executive-level thinking without the full-time hire.",
  paragraphs: [
    "Most growing companies don't need a full-time CRO or CMO. They need the thinking and execution that role provides, for a defined period, against a specific challenge. Fractional CXO engagements typically cost 20–40% of a full-time executive salary for the same level of strategic input.",
    "European companies that enter North America without a localised GTM model and ICP fail in their first 18 months at a rate exceeding 70%. Summit's North America expansion playbook is built from direct experience taking B2B SaaS companies through this transition.",
  ],
  stats: [
    { num: "20–40%", label: "Of full-time exec cost" },
    { num: "3–12 mo", label: "Typical engagement length" },
    { num: "$500K–$20M", label: "Typical client ARR range" },
  ],
} as const;

export const FRACTIONAL_CROSS_SELL = {
  lead: "Need the sales work done as well as led?",
  link: "See how Summit runs outsourced sales →",
  toolsLead: "Or start with our",
  toolsLink: "free GTM tools",
} as const;

export const FRACTIONAL_CTA = {
  label: "Explore an Engagement",
  title: "Tell us what you're trying to grow.",
  body: "A 30-minute call is enough to understand the challenge and whether there's a fit. No obligation, no pitch deck.",
  button: "Book a 30-Minute Call →",
} as const;

export const FRACTIONAL_FAQS: readonly Faq[] = [
  {
    q: "What is a fractional CXO?",
    a: "A fractional CXO is a senior executive, such as a Chief Revenue Officer, Chief Marketing Officer or Chief Commercial Officer, who works part-time with a company rather than as a full-time hire. They own a specific function, set strategy and drive execution at a fraction of the cost of a full-time appointment. Fractional CXO engagements typically cost 20–40% of a full-time executive salary for the same level of strategic input.",
  },
  {
    q: "When should a company hire a fractional CXO?",
    a: "Fractional CXO leadership is most effective for companies between $500K and $20M ARR who need senior GTM leadership but aren't ready to justify a full-time executive salary. It's also common for specific projects: market entry into a new geography, fundraising preparation, plugging a leadership gap during a transition, or adding execution horsepower to a specific growth initiative.",
  },
  {
    q: "How does Summit help European B2B companies enter North America?",
    a: "Summit's North America expansion service covers ICP definition for the US and Canadian market, channel selection and partner strategy, pricing localisation, hiring sequencing, and a first-revenue playbook. The engagement is structured as a monthly retainer and typically runs 6–12 months from first hire to first referenceable customer. European companies that enter North America without a localised ICP or GTM model fail at a rate of over 70% in the first 18 months.",
  },
  {
    q: "What does a fractional executive engagement with Summit involve?",
    a: "Summit's fractional executive engagements run as monthly retainers against a defined set of objectives. Typical scope includes GTM strategy, sales process design, channel selection, pipeline development and direct involvement in critical deals. You work directly with a senior executive from Summit's bench (Anthony among them), not a junior consultant.",
  },
  {
    q: "What is the difference between fractional advisory and a consulting firm?",
    a: "A consulting firm delivers analysis and recommendations. A fractional executive owns the function and drives execution. Summit embeds at the leadership level, attends board meetings, leads sales calls, and is accountable for outcomes, not just outputs. The engagement model is retainer-based and outcome-oriented, not project-billed.",
  },
];

// ── JSON-LD ──

const provider = {
  "@type": "Organization",
  name: "Summit Strategy Advisory",
  url: SITE_URL,
} as const;

/**
 * Builds FAQPage JSON-LD from the same array the page renders, so the
 * structured data always matches the visible FAQ text.
 */
function faqPageSchema(faqs: readonly Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/**
 * Hub: the practice as a whole, with the two options as its offer catalog.
 * Structured data describes the page it sits on, and the hub no longer
 * carries the outsourced narrative or FAQs, so those schemas moved to the
 * outsourced page under their own names below. No prices or availability.
 */
export const scaleUpServiceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Scale-Up Advisory",
  serviceType: "Fractional executive leadership and outsourced sales",
  url: `${SITE_URL}${SCALE_UP_PATH}`,
  dateModified: DATE_MODIFIED,
  provider,
  areaServed: ["Canada", "United States", "United Kingdom", "Europe", "Australia"],
  description:
    "Summit builds, runs and leads the commercial function for B2B scale-ups. Clients hire a fractional CRO, CCO or CMO from Summit's bench, or outsource their sales: fixed-price packages, fractional sales people to run them, and an AI-enabled engine built on the client's own intelligence.",
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Ways to work with Summit",
    itemListElement: OPTIONS.map((o) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: o.title, description: o.body, url: `${SITE_URL}${o.href}` },
    })),
  },
};

/** Outsourced sales page: the packaged offer, with the six package stages as its offer catalog. */
export const outsourcedServiceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Outsourced Sales for B2B Scale-Ups",
  serviceType: "Outsourced sales and business development",
  url: `${SITE_URL}${OUTSOURCED_SALES_PATH}`,
  dateModified: DATE_MODIFIED,
  provider,
  areaServed: ["Canada", "United States", "United Kingdom", "Europe", "Australia"],
  description:
    "Summit builds, runs and leads the commercial function for B2B scale-ups. Fixed-price packages across the sales lifecycle, fractional sales people to run them, and an AI-enabled engine built on the client's own intelligence. The client owns everything Summit builds.",
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Summit packages",
    itemListElement: PACKAGE_STAGES.map((s) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: `${s.id} packages`, description: s.body },
    })),
  },
};

export const outsourcedFaqSchema = faqPageSchema(OUTSOURCED_FAQS);

export const fractionalServiceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Fractional Executive Leadership",
  serviceType: "Fractional executive leadership",
  url: `${SITE_URL}${FRACTIONAL_EXEC_PATH}`,
  dateModified: DATE_MODIFIED,
  provider,
  areaServed: ["Canada", "United States", "Europe"],
  description:
    "Part-time senior commercial leadership for growing businesses. A fractional CRO, CCO or CMO from Summit's bench owns the function, sets GTM strategy and is accountable for outcomes.",
};

export const fractionalFaqSchema = faqPageSchema(FRACTIONAL_FAQS);
