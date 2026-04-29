import type { Metadata } from "next";
import ToolkitHub from "@/app/components/toolkit/ToolkitHub";

export const metadata: Metadata = {
  title: "Summit GTM Toolkit — Five Free Tools for Finite Markets",
  description:
    "Five free AI-powered GTM diagnostic tools for B2B teams selling into finite, named-account markets. ICP Evaluator, Positioning Grader, Moat Rater, and more. No signup required.",
  alternates: { canonical: "https://summitadvisory.com/tools" },
  openGraph: {
    title: "Summit GTM Toolkit — Five Free Tools for Finite Markets",
    description:
      "Five free AI-powered GTM diagnostic tools for B2B teams selling into finite, named-account markets. No signup required.",
    url: "https://summitadvisory.com/tools",
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
  url: "https://summitadvisory.com/tools",
  numberOfItems: 5,
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "ICP Evaluator",
      description: "Score your Ideal Customer Profile across seven weighted dimensions.",
      url: "https://summitadvisory.com/tools/icp",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Buyer Persona Quality Check",
      description: "See whether your buyer persona is specific enough to actually drive sales decisions. Letter grade + 6 scored dimensions.",
      url: "https://summitadvisory.com/tools/persona",
    },
    {
      "@type": "ListItem",
      position: 3,
      name: "Market Problem Validator",
      description: "Stress-test whether the problem you're solving is real, urgent, and worth building against.",
      url: "https://summitadvisory.com/tools/problem",
    },
    {
      "@type": "ListItem",
      position: 4,
      name: "Positioning Statement Grader",
      description: "Find out if your positioning statement actually works — or just sounds good. Letter grade A–F with a suggested rewrite.",
      url: "https://summitadvisory.com/tools/positioning",
    },
    {
      "@type": "ListItem",
      position: 5,
      name: "Competitive Moat Rater",
      description: "Understand how defensible your position really is — and what threatens it. Strong / Moderate / Thin / Exposed rating.",
      url: "https://summitadvisory.com/tools/moat",
    },
  ],
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
