/**
 * Copy, paths and JSON-LD for the three Product Studio pages:
 *   /product-studio              (hub: hero, two options, recent work)
 *   /product-studio/startups     (equity builds for early-stage founders)
 *   /product-studio/enterprise   (smart bespoke software, from the Oct 26 deck)
 *
 * Mirrors scale-up-content.ts so both practices present their two-way choice
 * the same way: a hub with two cards, each opening its own page. Plain data
 * only, no React or `@/` imports.
 */

// ── URLs ──

export const SITE_URL = "https://summitstrategyadvisory.com";
export const PRODUCT_STUDIO_PATH = "/product-studio";
export const STARTUPS_PATH = "/product-studio/startups";
export const ENTERPRISE_PATH = "/product-studio/enterprise";

// ── Hub ──

export const HERO = {
  eyebrow: "Product Studio",
  title: "Software built around you.",
  lead: "We build technology products for startups in exchange for equity, and smart bespoke software for enterprise teams. Senior AI native engineers, production code, and you own what we make.",
} as const;

export const HUB_OPTIONS_LABEL = "Two ways in";

export interface StudioOption {
  id: "startups" | "enterprise";
  title: string;
  body: string;
  href: string;
  cta: string;
}

export const OPTIONS: readonly StudioOption[] = [
  {
    id: "startups",
    title: "For startups",
    body: "We build your first product in exchange for equity. No large retainer, no handoffs. First version live in 4 weeks.",
    href: STARTUPS_PATH,
    cta: "See the equity model",
  },
  {
    id: "enterprise",
    title: "For enterprise",
    body: "Smart bespoke software for established teams. Built around your business, deployed in your environment, and yours to own.",
    href: ENTERPRISE_PATH,
    cta: "See how we build",
  },
];

export const RECENT_WORK = [
  { name: "Podbeat.ai", tag: "Podcast marketing", desc: "Give it a podcast episode. It finds the strongest moments, scores them with a clip-rating model, cuts them and sends them to TikTok, Spotify and YouTube.", outcomes: ["Built with a cohort of podcasters", "Ten-week beta"] },
  { name: "Canvas", tag: "Team visualisation", desc: "Paste a conversation, a document or nothing at all, and Canvas draws what the group is really comparing. Everyone edits the page by talking to it.", outcomes: ["canvas-app.ai", "Built for complex problems"] },
] as const;

// ── Startups ──

export const STARTUPS_HERO = {
  back: "Product Studio",
  eyebrow: "For Founders",
  title: "Built for equity.",
  lead: "We build technology products for early-stage founders in exchange for equity. No large retainer. No handoffs. First version live in 4 weeks.",
} as const;

export const STARTUP_STEPS = [
  { step: "01", title: "Discovery Sprint", duration: "Week 1", body: "We get under the hood of your idea. Market validation, competitive landscape, technical feasibility, and a clear articulation of the problem you're solving." },
  { step: "02", title: "Product Specification", duration: "Week 2", body: "A full product spec: user flows, feature prioritisation, tech stack selection, and a build roadmap. You own this doc regardless of what happens next." },
  { step: "03", title: "Build & Iterate", duration: "Weeks 3 to 4", body: "We build. Production-grade code, real infrastructure, proper testing. We ship in sprints and you're in the loop throughout. No black box." },
  { step: "04", title: "First Version Live", duration: "End of Week 4", body: "A working, deployed product in market by the end of week four. Not a prototype. A real product you can put in front of real users." },
] as const;

export const FOR_YOU = [
  "You have a clear problem you're trying to solve",
  "You're pre-seed or seed stage, or self-funded",
  "You don't yet have a full technical co-founder",
  "You want a product built, not a prototype",
  "You're comfortable with an equity-based arrangement",
] as const;

export const NOT_FOR_YOU = [
  "You need a fixed-price quote for a defined spec",
  "You already have a strong technical team",
  "You're looking for a build agency with no skin in the game",
] as const;

export const STARTUP_FAQS = [
  { q: "What is an equity-based product studio?", a: "A studio that builds technology products in exchange for an ownership stake rather than upfront fees. Summit's Product Studio typically takes 15 to 30% equity and delivers a production-grade first version within 4 weeks, so our incentives line up with the founder's." },
  { q: "How much equity does Summit take?", a: "Typically between 15 and 30%, depending on scope, complexity and stage. The stake is agreed upfront and documented in a simple agreement. No surprises or scope adjustments after work begins." },
  { q: "How long does it take to build a product with Summit?", a: "A first working product within 4 weeks: Discovery Sprint in week 1, Product Specification in week 2, Build and Iterate in weeks 3 to 4, and First Version Live by the end of week 4. It's a deployed product, not a prototype." },
  { q: "What types of products does the studio build?", a: "AI-native products, where models, agents and embeddings are part of how the software works rather than add-ons. Examples include SaaS tools, automation platforms and workflow products. Podbeat.ai, an AI podcast tool with multi-platform distribution, was built this way." },
  { q: "Who is the startup model best suited for?", a: "Pre-seed or seed-stage founders with a clear problem to solve, no full technical co-founder yet, and comfort with an equity arrangement. It isn't suited to teams that need a fixed-price quote, already have a strong technical team, or want a build agency with no skin in the game." },
] as const;

// ── Enterprise ──

export const ENTERPRISE_HERO = {
  back: "Product Studio",
  eyebrow: "For Enterprise Teams",
  title: "Smart bespoke software.",
  lead: "Built around your business, deployed in your environment, and yours to own.",
} as const;

export const SHIFTS = [
  { title: "Paying monthly, using 30% or less", body: "Subscriptions for tools where most features go unused, and no say over the roadmap." },
  { title: "Building is faster and cheaper than ever", body: "What took a dev team months now takes a small senior team days." },
  { title: "Tools can now be smart", body: "Software doesn't just store and display any more. It reads, sorts, drafts and recommends." },
  { title: "Business keeps getting more complex", body: "More systems, more data, more channels. Off-the-shelf tools were built for everyone, not for you." },
] as const;

export const BUILT_SMART = [
  { title: "Reads and remembers everything", body: "Makes sense of large volumes of data quickly and keeps the context over time." },
  { title: "Organises without being told", body: "Finds the patterns, then sorts, classifies and prioritises." },
  { title: "Simulates outcomes at scale", body: "Models many variations quickly, so planning and resourcing decisions rest on more than a guess." },
  { title: "Has an opinion", body: "Weighs the evidence, recommends a course and surfaces ideas you hadn't asked for." },
] as const;

export const BUILT_AROUND_YOU = [
  { title: "Shaped to how you work", body: "Your process, your language, your odd exceptions. Not the vendor's." },
  { title: "Connects to whatever you run", body: "We build the connectors and transformation layers, however awkward the system." },
  { title: "Lives in your environment", body: "Deployed in your cloud with your security. Your data never leaves." },
  { title: "You own what we make", body: "The code and the roadmap. No licence, no waiting for someone else's release." },
] as const;

export const ENTERPRISE_STEPS = [
  { step: "01", title: "Problem", get: "A clear problem statement", body: "What's slowing you down, and whether software is the fix." },
  { step: "02", title: "Shape", get: "Prototype and signed-off spec", body: "Requirements captured, prototyped live in the Project Builder, then sorted and signed off together." },
  { step: "03", title: "Quote", get: "The numbers", body: "A fixed price and a timeline for the build, before we start." },
  { step: "04", title: "Build", get: "Working features", body: "Short cycles. Working software in front of you every week." },
  { step: "05", title: "Deploy", get: "A live product you own", body: "Live in your environment, on your accounts. The code is yours." },
] as const;

export const BUILDER_STEPS = [
  { step: "01", title: "Describe it, or upload what you have", body: "A sentence is enough. So is a ten-year-old requirements doc or screenshots of the spreadsheet." },
  { step: "02", title: "Watch it take shape", body: "Six short steps. It suggests the features, integrations and guardrails we'd ask about, and you tap to agree or change them." },
  { step: "03", title: "Get a quote", body: "Your team signs off the spec and a fixed price comes back against it." },
] as const;

export const WHY_US = [
  { title: "Deep product and technical knowledge", body: "We know why, not just how. We've owned the product, the roadmap, the architecture and the results." },
  { title: "Experienced with enterprise", body: "We've shipped into banks, grocers and telcos, and wired into the big systems they run." },
  { title: "Easy to work with", body: "Outcome-driven, at the frontier, and working in short cycles so you see value early." },
] as const;

// ── JSON-LD ──

const provider = { "@type": "Organization", name: "Summit Strategy Advisory", url: SITE_URL } as const;

export const hubSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Product Studio",
  provider,
  description: HERO.lead,
  areaServed: "Worldwide",
  serviceType: "Product Development",
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Product Studio",
    itemListElement: OPTIONS.map((o) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: o.title, url: `${SITE_URL}${o.href}` },
    })),
  },
};

export const startupFaqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: STARTUP_FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};
