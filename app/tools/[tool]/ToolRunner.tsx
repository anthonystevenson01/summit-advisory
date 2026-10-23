"use client";

import Link from "next/link";
import SiteNav from "@/app/components/SiteNav";
import ToolkitFooter from "@/app/components/toolkit/ToolkitFooter";
import ToolPage from "@/app/components/toolkit/ToolPage";
import AccountIntelTool from "@/app/components/toolkit/tools/AccountIntelTool";
import { isToolPublic, type ToolSlug } from "@/app/lib/tools/registry";

/**
 * Renders a single GTM tool inside the standard toolkit chrome
 * (site nav + back row + footer). Back link is a real anchor so the
 * browser back button and open-in-new-tab work natively.
 *
 * Every public registry tool renders through ToolPage. Account Intelligence
 * is hidden and keeps its own component; its route falls back to its own
 * default prompt when the string is empty.
 *
 * Accepts optional children rendered between the tool and the footer
 * (for example the server-side FAQ section from the parent page).
 */
export default function ToolRunner({ slug, children }: { slug: ToolSlug; children?: React.ReactNode }) {
  return (
    <>
      <SiteNav activePage="tools" />
      <div className="page">
        <div
          style={{
            background: "var(--forest)",
            padding: "14px 48px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <Link href="/tools" className="inner-back" style={{ marginBottom: 0 }}>
            ← All GTM Tools
          </Link>
        </div>

        {isToolPublic(slug) && <ToolPage slug={slug} />}
        {slug === "account" && <AccountIntelTool systemPrompt="" />}

        {children}
        <ToolkitFooter />
      </div>
    </>
  );
}
