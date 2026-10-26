import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/app/components/SiteNav";
import ToolkitFooter from "@/app/components/toolkit/ToolkitFooter";
import RubricBlocks from "./RubricBlocks";
import { BRAND } from "@/app/lib/brand";
import { getRubricBlocks, type RubricBlocks as LoadedBlocks } from "@/app/lib/rubrics";
import { AUTOMATED_LABEL, BUILT_TO_SCALE_TOOL } from "@/app/lib/tools/built-to-scale-method";

export const dynamic = "force-dynamic";

const CANONICAL = "https://summitstrategyadvisory.com/tools/built-to-scale/method";
const TITLE = "The Built to Scale? method: how a business model is scored out of 25";
const DESCRIPTION =
  "The five dimensions, what a 1 and a 5 look like, the bands and how the score is written. The same Summit rubric the scoring reads.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", url: CANONICAL, images: [{ url: "/opengraph-image", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/opengraph-image"] },
};

const UPDATING_MESSAGE = "The method page is being updated. The tool itself is unaffected; check back shortly.";
const CONDENSED = "var(--font-barlow-condensed), sans-serif";
const SANS = "var(--font-dm-sans), sans-serif";

function formatDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Renders the Notion `built-to-scale` row's body as the public method, from
 * the same cached read the synthesis is prompted from, so the definition a
 * visitor reads is the one the model is held to. A Draft row or any read
 * error shows a short message and a 200, never a 404 or 500.
 */
export default async function MethodPage() {
  let loaded: LoadedBlocks | null = null;
  try {
    loaded = await getRubricBlocks(BUILT_TO_SCALE_TOOL);
  } catch (err) {
    console.error("built-to-scale method page:", err instanceof Error ? err.message : String(err));
  }

  const cta = (
    <div style={{ background: BRAND.lightBg, border: `1px solid ${BRAND.border}`, borderRadius: 12, padding: "28px 24px", textAlign: "center", marginTop: 32 }}>
      <h2 style={{ fontFamily: CONDENSED, fontSize: 26, fontWeight: 700, color: BRAND.darkGreen, margin: "0 0 8px" }}>Score your own model</h2>
      <p style={{ fontSize: 14, color: BRAND.mid, margin: "0 0 18px" }}>One form, five dimensions, a score out of 25. Free, no account.</p>
      <Link
        href="/tools/built-to-scale"
        style={{ display: "inline-block", padding: "12px 28px", borderRadius: 6, background: BRAND.brandGreen, color: BRAND.white, fontFamily: CONDENSED, fontWeight: 700, fontSize: 16, letterSpacing: "0.04em", textDecoration: "none" }}
      >
        Score my model
      </Link>
    </div>
  );

  return (
    <>
      <SiteNav activePage="tools" />
      <div className="page">
        <div style={{ background: "var(--forest)", padding: "14px 48px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Link href="/tools/built-to-scale" className="inner-back" style={{ marginBottom: 0 }}>
            ← Built to Scale?
          </Link>
        </div>

        <div style={{ background: BRAND.white, fontFamily: SANS }}>
          <section style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px 48px" }}>
            <p style={{ fontFamily: CONDENSED, fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: BRAND.brandGreen, margin: "0 0 8px" }}>
              The method
            </p>
            <h1 style={{ fontFamily: CONDENSED, fontSize: 40, fontWeight: 700, color: BRAND.darkGreen, lineHeight: 1.1, margin: "0 0 16px" }}>
              How Built to Scale? scores a business model
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: BRAND.dark, margin: "0 0 20px", maxWidth: 680 }}>
              Five dimensions, each scored 1 to 5, totalling 25. The definitions below are the ones the scoring reads; they come from the same Summit rubric, so what you read here is what the model is held to.
            </p>
            <div style={{ padding: "16px 20px", background: BRAND.lightBg, borderRadius: 10, border: `1px solid ${BRAND.border}`, marginBottom: 28 }}>
              <p style={{ fontSize: 13, color: BRAND.mid, lineHeight: 1.65, margin: 0 }}>{AUTOMATED_LABEL}</p>
            </div>

            {loaded ? (
              <>
                <RubricBlocks blocks={loaded.blocks} />
                <p style={{ fontSize: 12, color: BRAND.mid, margin: "24px 0 0" }}>
                  Version {loaded.version}, updated from the rubric on {formatDate(loaded.fetchedAt)}.
                </p>
              </>
            ) : (
              <p style={{ fontSize: 15, lineHeight: 1.6, color: BRAND.dark, margin: 0 }}>{UPDATING_MESSAGE}</p>
            )}

            {cta}
          </section>
        </div>
        <ToolkitFooter />
      </div>
    </>
  );
}
