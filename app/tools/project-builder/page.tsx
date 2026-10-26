import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/app/components/SiteNav";
import ToolkitFooter from "@/app/components/toolkit/ToolkitFooter";
import ProjectBuilderPage from "@/app/components/project-builder/ProjectBuilderPage";

const CANONICAL = "https://summitstrategyadvisory.com/tools/project-builder";
const TITLE = "Project Builder: define your software project and get a brief from Summit";
const DESCRIPTION =
  "Define a software project in six steps, with a one tap suggestion on every step. Save it, come back on any device, and submit it. Anthony sends you the project brief within two working days.";

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
  name: "Project Builder",
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

/**
 * /tools/project-builder: the public builder inside the toolkit chrome
 * (SiteNav, the back link to /tools, ToolkitFooter) with the same metadata
 * shape as the tool pages and a WebApplication ld+json block.
 *
 * Static on purpose: this page reads no searchParams, so the resume link's
 * `b` and `t` and the `src` tag are read on the client by a loader under
 * Suspense inside ProjectBuilderPage. A server read of the query would make
 * every visit dynamic for the sake of the few that arrive from an email.
 * The ld+json is the one `dangerouslySetInnerHTML` in the feature and holds
 * a constant, never prospect or model text.
 */
export default function ProjectBuilderRoute() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }} />
      <SiteNav activePage="tools" />
      <div className="page">
        <div style={{ background: "var(--forest)", padding: "14px 48px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Link href="/tools" className="inner-back" style={{ marginBottom: 0 }}>
            &larr; All GTM Tools
          </Link>
        </div>
        <ProjectBuilderPage />
        <ToolkitFooter />
      </div>
    </>
  );
}
