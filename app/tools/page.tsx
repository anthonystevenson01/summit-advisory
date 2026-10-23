import type { Metadata } from "next";
import ToolkitHub from "@/app/components/toolkit/ToolkitHub";
import { PUBLIC_TOOLS } from "@/app/lib/tools/registry";

export const metadata: Metadata = {
  title: "Summit GTM Toolkit — Five Free Tools for Finite Markets",
  description:
    "Five free AI-powered GTM diagnostic tools for B2B teams selling into finite, named-account markets. ICP Evaluator, Positioning Grader, Moat Rater, and more. No signup required.",
  alternates: { canonical: "https://summitstrategyadvisory.com/tools" },
  openGraph: {
    title: "Summit GTM Toolkit — Five Free Tools for Finite Markets",
    description:
      "Five free AI-powered GTM diagnostic tools for B2B teams selling into finite, named-account markets. No signup required.",
    url: "https://summitstrategyadvisory.com/tools",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Summit GTM Toolkit — Five Free Tools for Finite Markets",
    description:
      "Five free AI-powered GTM diagnostic tools for B2B teams selling into finite markets. No signup.",
    images: ["/opengraph-image"],
  },
};

const itemListSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Summit GTM Toolkit",
  description:
    "Five free AI diagnostic tools for B2B teams selling into finite, named-account markets.",
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

export default function ToolsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <ToolkitHub />
    </>
  );
}
