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

/** Static: reads no searchParams; the resume link is read on the client under Suspense. */
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
