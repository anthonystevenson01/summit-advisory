import type { Metadata } from "next";
import SiteNav from "@/app/components/SiteNav";
import ToolkitFooter from "@/app/components/toolkit/ToolkitFooter";
import ProjectBuilderPage from "@/app/components/project-builder/ProjectBuilderPage";
import { PROJECT_BUILDER_PATH } from "@/app/lib/project-builder/copy";

const CANONICAL = `https://summitstrategyadvisory.com${PROJECT_BUILDER_PATH}`;
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
 * /project-builder: the public builder on a page of its own, with its own
 * chrome (SiteNav with the Project Builder item active, ToolkitFooter), the
 * same metadata shape as the tool pages and a WebApplication ld+json block.
 * The .toolkit wrapper comes from the layout beside this page.
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
      <SiteNav activePage="project-builder" />
      <div className="page">
        <ProjectBuilderPage />
        <ToolkitFooter />
      </div>
    </>
  );
}
