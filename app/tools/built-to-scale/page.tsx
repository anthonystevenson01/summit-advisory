import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/app/components/SiteNav";
import ToolkitFooter from "@/app/components/toolkit/ToolkitFooter";
import BuiltToScalePage from "@/app/components/toolkit/BuiltToScalePage";

const CANONICAL = "https://summitstrategyadvisory.com/tools/built-to-scale";
const TITLE = "Built to Scale? Score your business model out of 25: Summit GTM Toolkit";
const DESCRIPTION =
  "One form, five dimensions, a score out of 25 for how well your business model can scale. Scored automatically against Summit's rubrics. Free, no account.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: CANONICAL,
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

const webAppSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Built to Scale?",
  description: DESCRIPTION,
  url: CANONICAL,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  provider: {
    "@type": "Organization",
    name: "Summit Strategy Advisory",
    url: "https://summitstrategyadvisory.com",
  },
};

/** Static: reads no searchParams; the `from` hand-off is read on the client under Suspense. */
export default function BuiltToScaleRoute() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }} />
      <SiteNav activePage="tools" />
      <div className="page">
        <div style={{ background: "var(--forest)", padding: "14px 48px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Link href="/tools" className="inner-back" style={{ marginBottom: 0 }}>
            ← All GTM Tools
          </Link>
        </div>
        <BuiltToScalePage />
        <ToolkitFooter />
      </div>
    </>
  );
}
