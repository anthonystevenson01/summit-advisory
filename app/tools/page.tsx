import type { Metadata } from "next";
import ToolkitHub from "@/app/components/toolkit/ToolkitHub";
import { HUB_DESCRIPTION, HUB_DESCRIPTION_OG, HUB_DESCRIPTION_TWITTER, HUB_TITLE, itemListSchema } from "@/app/tools/hub-copy";

export const metadata: Metadata = {
  title: HUB_TITLE,
  description: HUB_DESCRIPTION,
  alternates: { canonical: "https://summitstrategyadvisory.com/tools" },
  openGraph: {
    title: HUB_TITLE,
    description: HUB_DESCRIPTION_OG,
    url: "https://summitstrategyadvisory.com/tools",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: HUB_TITLE,
    description: HUB_DESCRIPTION_TWITTER,
    images: ["/opengraph-image"],
  },
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
