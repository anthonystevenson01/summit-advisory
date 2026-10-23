/**
 * Every hub string that states how many tools there are, derived from the
 * registry so flipping `hidden` on a tool changes no copy. Pure, one relative
 * `.ts` import, so __tests__/gtm-toolkit.test.ts can load it under plain Node.
 */
import { PUBLIC_TOOLS, PUBLIC_TOOL_COUNT_WORD_CAPITALISED } from "../lib/tools/registry.ts";

const COUNT = PUBLIC_TOOL_COUNT_WORD_CAPITALISED;

export const HUB_TITLE = `Summit GTM Toolkit — ${COUNT} Free Tools for Finite Markets`;

export const HUB_DESCRIPTION = `${COUNT} free AI-powered GTM diagnostic tools for B2B teams selling into finite, named-account markets. ICP Evaluator, Positioning Grader, Moat Rater, and more. No signup required.`;

export const HUB_DESCRIPTION_OG = `${COUNT} free AI-powered GTM diagnostic tools for B2B teams selling into finite, named-account markets. No signup required.`;

export const HUB_DESCRIPTION_TWITTER = `${COUNT} free AI-powered GTM diagnostic tools for B2B teams selling into finite markets. No signup.`;

export const HUB_ITEM_LIST_DESCRIPTION = `${COUNT} free AI diagnostic tools for B2B teams selling into finite, named-account markets.`;

export const HUB_LEAD = `${COUNT} free AI diagnostic tools for teams selling into finite, named-account markets. No signup. Results in under 30 seconds.`;

export const HUB_TAG = `${COUNT} Free Tools`;

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
