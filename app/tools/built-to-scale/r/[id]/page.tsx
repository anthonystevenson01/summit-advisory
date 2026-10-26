import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import SiteNav from "@/app/components/SiteNav";
import ToolkitFooter from "@/app/components/toolkit/ToolkitFooter";
import ToolShareButtons from "@/app/components/toolkit/shared/ToolShareButtons";
import Scorecard from "@/app/components/toolkit/scorecard/Scorecard";
import ScorecardWorking from "@/app/components/toolkit/scorecard/ScorecardWorking";
import OpenFullView from "./OpenFullView";
import { BRAND } from "@/app/lib/brand";
import { getCompositeRun, getToolRuns, isRunId } from "@/app/lib/runs";
import { toCompositeFreeView, toCompositeFullView } from "@/app/lib/tools/built-to-scale";
import { AUTOMATED_LABEL, BUILT_TO_SCALE_TOOL, type CompositeRow } from "@/app/lib/tools/built-to-scale-method";
import { plainDashes } from "@/app/lib/tools/result-email";
import { UNLOCK_COOKIE, verifySavedLinkToken, verifyUnlockCookie } from "@/app/lib/unlock";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ t?: string }>;

const BASE = "https://summitstrategyadvisory.com";
const CONDENSED = "var(--font-barlow-condensed), sans-serif";
const SANS = "var(--font-dm-sans), sans-serif";

async function loadRun(id: string) {
  if (!isRunId(id)) return null;
  try {
    return await getCompositeRun(id);
  } catch (err) {
    console.error("built-to-scale result page: run read failed", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const run = await loadRun(id);
  if (!run) return { title: "Built to Scale? scorecard" };
  const title = `Built to Scale? ${run.total} of 25: ${run.band}`;
  const description = plainDashes(run.verdict);
  const url = `${BASE}/tools/built-to-scale/r/${run.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: false },
    openGraph: { title, description, type: "website", url },
    twitter: { card: "summary_large_image", title, description },
  };
}

function formatDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * The shareable result page: the free view for anyone with the link, the
 * full view when the run is unlocked on record and the visitor holds the
 * unlock cookie, or when the saved-link token verifies for this run. Never
 * calls a model; the one client button asks the details route to produce
 * the working and refreshes. The token is read once here and never echoed.
 * Public here means the free view only (total, band, grades, verdict,
 * strongest, weakest); the page is noindex and its OpenGraph image shows
 * the same fields and nothing more.
 */
export default async function ResultPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { id } = await params;
  const { t } = await searchParams;
  const run = await loadRun(id);
  if (!run) notFound();

  // A stranger holding the link to an unlocked run sees the free view only:
  // the full view needs the cookie together with the unlock on record and
  // the stored working, or the saved-link token signed for this run. A
  // cookie or a verified link with no stored working gets the button, which
  // asks the details route (where the cookie unlock is recorded) and refreshes.
  const cookieStore = await cookies();
  const viaCookie = verifyUnlockCookie(cookieStore.get(UNLOCK_COOKIE)?.value) !== null;
  const linkVerified = verifySavedLinkToken(t, run.id);
  const authorised = viaCookie || linkVerified;
  const showFull = Boolean(run.detailsAt) && ((viaCookie && run.unlock !== null) || linkVerified);

  let body: React.ReactNode;
  if (showFull) {
    const children = await getToolRuns(Object.values(run.children));
    const full = toCompositeFullView(run, children);
    body = <Scorecard view={full} label={AUTOMATED_LABEL} renderWorking={(row: CompositeRow) => <ScorecardWorking row={row} parentRunId={run.id} />} />;
  } else if (authorised) {
    body = (
      <>
        <Scorecard view={toCompositeFreeView(run)} label={AUTOMATED_LABEL} />
        <OpenFullView runId={run.id} token={linkVerified ? t : undefined} />
      </>
    );
  } else {
    body = <Scorecard view={toCompositeFreeView(run)} label={AUTOMATED_LABEL} />;
  }

  const path = `/tools/built-to-scale/r/${run.id}`;

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
          <section style={{ maxWidth: 960, margin: "0 auto", padding: "40px 24px 16px" }}>
            <p style={{ fontFamily: CONDENSED, fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: BRAND.brandGreen, margin: "0 0 6px" }}>
              Scorecard
            </p>
            <p style={{ fontSize: 13, color: BRAND.mid, margin: "0 0 20px" }}>Scored on {formatDate(run.createdAt)}</p>
            {body}
          </section>

          <section style={{ maxWidth: 960, margin: "0 auto", padding: "16px 24px 48px" }}>
            <div style={{ background: BRAND.lightBg, border: `1px solid ${BRAND.border}`, borderRadius: 12, padding: "28px 24px", textAlign: "center" }}>
              <h2 style={{ fontFamily: CONDENSED, fontSize: 26, fontWeight: 700, color: BRAND.darkGreen, margin: "0 0 8px" }}>Score your own model</h2>
              <p style={{ fontSize: 14, color: BRAND.mid, margin: "0 0 18px" }}>One form, five dimensions, a score out of 25. Free, no account.</p>
              <Link
                href="/tools/built-to-scale"
                style={{ display: "inline-block", padding: "12px 28px", borderRadius: 6, background: BRAND.brandGreen, color: BRAND.white, fontFamily: CONDENSED, fontWeight: 700, fontSize: 16, letterSpacing: "0.04em", textDecoration: "none" }}
              >
                Score my model
              </Link>
              <p style={{ fontSize: 13, margin: "14px 0 0" }}>
                <Link href="/tools/built-to-scale/method" style={{ color: BRAND.teal, fontWeight: 600, textDecoration: "none" }}>How this is scored</Link>
              </p>
            </div>
            <div style={{ background: BRAND.darkGreen, borderRadius: 12, padding: "4px 24px 20px", marginTop: 16 }}>
              <ToolShareButtons slug={BUILT_TO_SCALE_TOOL} path={path} title="Built to Scale? scorecard: Summit Strategy Advisory" />
            </div>
          </section>
        </div>
        <ToolkitFooter />
      </div>
    </>
  );
}
