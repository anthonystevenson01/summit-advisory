/**
 * Every hub string that states how many tools there are, derived from the
 * registry so flipping `hidden` on a tool changes no copy, plus the three
 * path cards, the hero lead and the How It Works steps. Pure, one relative
 * `.ts` import, so __tests__/gtm-toolkit.test.ts can load it under plain Node.
 * House rules: British spelling, no dashes, no hype.
 */
import { PUBLIC_TOOLS, PUBLIC_TOOL_COUNT_WORD_CAPITALISED } from "../lib/tools/registry.ts";
import { CONTACT_EMAIL } from "../lib/brand.ts";
import { HUB_CTA } from "../lib/ask-summit/copy.ts";

const COUNT = PUBLIC_TOOL_COUNT_WORD_CAPITALISED;

export const HUB_TITLE = `Summit GTM Toolkit — ${COUNT} Free Tools for Finite Markets`;

export const HUB_DESCRIPTION = `${COUNT} free AI-powered GTM diagnostic tools for B2B teams selling into finite, named-account markets. ICP Evaluator, Positioning Grader, Moat Rater, and more. No signup required.`;

export const HUB_DESCRIPTION_OG = `${COUNT} free AI-powered GTM diagnostic tools for B2B teams selling into finite, named-account markets. No signup required.`;

export const HUB_DESCRIPTION_TWITTER = `${COUNT} free AI-powered GTM diagnostic tools for B2B teams selling into finite markets. No signup.`;

export const HUB_ITEM_LIST_DESCRIPTION = `${COUNT} free AI diagnostic tools for B2B teams selling into finite, named-account markets.`;

export const HUB_LEAD = `${COUNT} free diagnostics and one score for the whole model. Each one reads what you tell it against the rubrics Summit uses in client work and tells you what to fix first. No signup, a result in under a minute.`;

export const HUB_TAG = `${COUNT} Free Tools`;

export const HUB_INTRO = "Three steps. No account. A result in under a minute.";

export const HOW_IT_WORKS: readonly { num: string; title: string; body: string }[] = [
  {
    num: "01",
    title: "Pick a path",
    body: "Use one tool to check one part of your model, score the whole model in one form, or ask Summit to score it for you.",
  },
  {
    num: "02",
    title: "Get scored against the rubrics",
    body: "A model reads what you wrote against Summit's rubrics, the ones we use in client work, and returns a score, a grade and a verdict. It reads what you give it and cannot check your claims.",
  },
  {
    num: "03",
    title: "Fix the right thing first",
    body: "Every result names the constraint, what it costs in a finite market and the one change to make first. The full working arrives by email.",
  },
];

/** The address in the site's Organization schema; one value with the report pages, held in brand.ts. */
export { CONTACT_EMAIL };

export interface EntryPath {
  title: string;
  body: string;
  href: string;
  cta: string;
  /** Shown with a "Coming next" tag. No card carries it since Release 3b; kept for the next path that needs it. */
  comingNext?: boolean;
}

/** The three path cards at the top of /tools (plan updates, section 7.2). */
export const ENTRY_PATHS: readonly EntryPath[] = [
  {
    title: "Use a tool",
    body: `${COUNT} diagnostics, one question each. Pain, buyer, positioning, moat and more. Free, no account, a score and verdict in under a minute, the full working on email.`,
    href: "#tools",
    cta: "See the tools",
  },
  {
    title: "Score your own model",
    body: "One form, five dimensions, a score out of 25 for how well your business model can scale. Scored automatically against Summit's rubrics, the same ones we use in client work. It is a machine's reading of what you tell it, so it is only as good as your input, and it is not advice.",
    href: "/tools/built-to-scale",
    cta: "Score my model",
  },
  {
    title: "Ask Summit to score it",
    body: "Give us your website and a deck. We run the same tools, then a person reads the output, checks it against what we know, edits the scores and writes the commentary. You get a reviewed report, a one-slide summary and a call to walk through it. Usually within two working days.",
    href: "/tools/ask-summit",
    cta: HUB_CTA,
  },
];

/**
 * The schema.org ItemList for /tools. It lives here rather than in
 * app/tools/page.tsx so __tests__/gtm-toolkit.test.ts can check numberOfItems
 * against PUBLIC_TOOLS without loading a Next page.
 */
export const itemListSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Summit GTM Toolkit",
  description: HUB_ITEM_LIST_DESCRIPTION,
  url: "https://summitstrategyadvisory.com/tools",
  numberOfItems: PUBLIC_TOOLS.length,
  itemListElement: PUBLIC_TOOLS.map((tool, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: tool.name,
    description: tool.seo.description,
    url: tool.seo.canonical,
  })),
};
