import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/app/components/SiteNav";
import ToolkitFooter from "@/app/components/toolkit/ToolkitFooter";
import AskSummitPage from "@/app/components/toolkit/AskSummitPage";
import { isPaused } from "@/app/lib/ask-summit/admin";
import { PAGE_DESCRIPTION } from "@/app/lib/ask-summit/copy";

export const dynamic = "force-dynamic";

const CANONICAL = "https://summitstrategyadvisory.com/tools/ask-summit";
const TITLE = "Ask Summit to score it: a reviewed Built to Scale? report";

export const metadata: Metadata = {
  title: TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: TITLE,
    description: PAGE_DESCRIPTION,
    type: "website",
    url: CANONICAL,
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

/** Dynamic: reads the pause switch. A Redis error renders the form; the submit route is the authority. */
export default async function AskSummitRoute() {
  let paused = false;
  try {
    paused = await isPaused();
  } catch (err) {
    console.error("ask-summit page: pause read failed", err instanceof Error ? err.message : err);
  }
  return (
    <>
      <SiteNav activePage="tools" />
      <div className="page">
        <div style={{ background: "var(--forest)", padding: "14px 48px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Link href="/tools" className="inner-back" style={{ marginBottom: 0 }}>
            ← All GTM Tools
          </Link>
        </div>
        <AskSummitPage paused={paused} />
        <ToolkitFooter />
      </div>
    </>
  );
}
