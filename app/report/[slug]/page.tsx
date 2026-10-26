import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import Scorecard from "@/app/components/toolkit/scorecard/Scorecard";
import ScorecardWorking from "@/app/components/toolkit/scorecard/ScorecardWorking";
import BookCallLink from "./BookCallLink";
import { BRAND } from "@/app/lib/brand";
import { validateSession } from "@/app/lib/auth";
import { track } from "@/app/lib/events";
import { getReport, recordOpen } from "@/app/lib/reports";
import { notifyReportEvent, originFromHeaders } from "@/app/lib/report-notify";
import { getCompositeRun, getToolRuns } from "@/app/lib/runs";
import { toCompositeFullView } from "@/app/lib/tools/built-to-scale";
import type { CompositeFullView } from "@/app/lib/tools/built-to-scale-method";
import {
  ACCESS_HEADING,
  ACCESS_LIMITED,
  ACCESS_PROMPT,
  ACCESS_WRONG,
  CAVEAT_LINE,
  WORKING_MISSING_LINE,
  isExpired,
  isPreviewFetcher,
  isValidSlug,
  longDateLabel,
  publicViewOf,
  type ReportRecord,
} from "@/app/lib/tools/report-model";
import { REPORT_ACCESS_COOKIE, getUnlockSecret, verifyReportAccessCookie } from "@/app/lib/unlock";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ access?: string }>;

const CONDENSED = "var(--font-barlow-condensed), sans-serif";
const SANS = "var(--font-dm-sans), sans-serif";
const BASE = "https://summitstrategyadvisory.com";

const h2Style: CSSProperties = { fontFamily: CONDENSED, fontSize: 26, fontWeight: 700, color: BRAND.darkGreen, margin: "0 0 12px", lineHeight: 1.15 };
const bodyStyle: CSSProperties = { fontSize: 17, lineHeight: 1.65, color: BRAND.dark, margin: "0 0 14px" };
const smallStyle: CSSProperties = { fontSize: 13, lineHeight: 1.55, color: BRAND.mid, margin: 0 };

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** The clock, read once per request outside the component body. */
function nowIso(): string {
  return new Date().toISOString();
}

async function loadReport(slug: string): Promise<ReportRecord | null> {
  if (!isValidSlug(slug)) return null;
  try {
    return await getReport(slug);
  } catch (err) {
    console.error("report page: report read failed", errorMessage(err));
    return null;
  }
}

/** Only a published, unexpired report reveals its company name to a crawler; everything else is a bare noindex title. */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const report = await loadReport(slug);
  const hidden: Metadata = { title: "Report", robots: { index: false, follow: false } };
  if (!report || report.state !== "published" || isExpired(report)) return hidden;
  const title = `${report.company}: Built to Scale? report`;
  const description = `${CAVEAT_LINE} As of ${longDateLabel(report.asOf)}.`;
  const url = `${BASE}/report/${report.slug}`;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "article", url },
    twitter: { card: "summary_large_image", title, description },
  };
}

function Header() {
  return (
    <div style={{ background: BRAND.darkGreen, padding: "16px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: CONDENSED, fontSize: 15, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: BRAND.white }}>
          Summit Strategy Advisory
        </span>
        <span style={{ fontFamily: CONDENSED, fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#6EBF8B" }}>
          Built to Scale? report
        </span>
      </div>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: BRAND.white, fontFamily: SANS, color: BRAND.dark }}>
      <Header />
      {children}
    </div>
  );
}

function Paragraphs({ items }: { items: string[] }) {
  return (
    <>
      {items.map((text, i) => (
        <p key={i} style={bodyStyle}>{text}</p>
      ))}
    </>
  );
}

function AccessForm({ slug, message }: { slug: string; message: string | null }) {
  const fieldStyle: CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 6,
    border: `1px solid ${BRAND.border}`,
    fontSize: 16,
    fontFamily: SANS,
    color: BRAND.dark,
    background: BRAND.white,
    boxSizing: "border-box",
  };
  return (
    <Shell>
      <main className="report-page">
        <h1 style={{ fontFamily: CONDENSED, fontSize: 32, fontWeight: 700, color: BRAND.darkGreen, margin: "0 0 10px", lineHeight: 1.1 }}>{ACCESS_HEADING}</h1>
        <p style={bodyStyle}>{ACCESS_PROMPT}</p>
        {message && <p style={{ ...bodyStyle, color: BRAND.red, fontSize: 15 }}>{message}</p>}
        <form method="POST" action={`/api/report/${slug}/access`} style={{ maxWidth: 420, marginTop: 20 }}>
          <label htmlFor="report-access-code" style={{ display: "block", fontSize: 13, fontWeight: 600, color: BRAND.darkGreen, marginBottom: 6 }}>
            Access code
          </label>
          <input id="report-access-code" name="code" type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} required style={fieldStyle} />
          <button
            type="submit"
            style={{ marginTop: 14, padding: "12px 28px", borderRadius: 6, border: "none", background: BRAND.brandGreen, color: BRAND.white, fontFamily: CONDENSED, fontWeight: 700, fontSize: 16, letterSpacing: "0.04em", cursor: "pointer" }}
          >
            Open the report
          </button>
        </form>
      </main>
    </Shell>
  );
}

/**
 * The private report page. Order: slug check, read, state (drafts 404
 * unless the admin session is present, which gets a preview banner),
 * expiry (a redirect to the 410 page), the access code (the form when the
 * cookie does not verify), the working from the stored run, then the open
 * counting (skipped for the admin and for link preview fetchers) and the
 * first-open alert inside `after()` so the render never waits on SMTP.
 *
 * Nothing of the report renders before the gate: the access form returns
 * before the run is read, so a visitor without the cookie sees no company
 * name, no grades and no working, and a draft or unpublished slug is
 * indistinguishable from an unknown one. `generateMetadata` is the one
 * read ahead of the gate and names the company only for a published,
 * unexpired report, which is what a link preview needs.
 *
 * Opens are counted after the gate and only for a real reader. The admin
 * session is skipped because Anthony previews every report before and after
 * sending it, and each preview would count and the first one would email
 * him about himself. Link preview fetchers (Gmail's image proxy, LinkedIn,
 * Slack) request the page when a link is pasted or delivered and would
 * trigger the first-open alert before the prospect has read anything; the
 * user-agent skip is a heuristic, so `openCount` is an upper bound.
 */
export default async function ReportPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { slug } = await params;
  const { access } = await searchParams;
  const report = await loadReport(slug);
  if (!report) notFound();

  const admin = await validateSession();
  if (report.state !== "published" && !admin) notFound();

  if (isExpired(report)) redirect(`/report/${report.slug}/expired`);

  if (report.accessCode) {
    const cookieStore = await cookies();
    const prefix = report.accessCode.hash.slice(0, 8);
    const ok = verifyReportAccessCookie(cookieStore.get(REPORT_ACCESS_COOKIE)?.value, report.slug, prefix);
    if (!ok) {
      if (!getUnlockSecret()) console.warn("report page: UNLOCK_SECRET is not set, so no access cookie can verify");
      const message = access === "wrong" ? ACCESS_WRONG : access === "limited" ? ACCESS_LIMITED : null;
      return <AccessForm slug={report.slug} message={message} />;
    }
  }

  let composite: CompositeFullView | null = null;
  try {
    const run = await getCompositeRun(report.runId);
    if (run) {
      const children = await getToolRuns(Object.values(run.children));
      composite = toCompositeFullView(run, children);
    }
  } catch (err) {
    console.error("report page: run read failed", errorMessage(err));
  }

  const view = publicViewOf(report, composite);

  const headerList = await headers();
  if (!admin && !isPreviewFetcher(headerList.get("user-agent"))) {
    const origin = originFromHeaders(headerList);
    try {
      const { first, openCount } = await recordOpen(report.slug, nowIso());
      void track("report_opened", { slug: report.slug });
      if (first) after(() => notifyReportEvent({ kind: "opened", report, origin, openCount }));
    } catch (err) {
      console.error("report page: open counting failed", errorMessage(err));
    }
  }

  const rowsByKey = new Map(view.scorecard.rows.map((row) => [row.key, row]));
  const asOfLine = `As of ${view.asOfLabel}. ${view.caveat}`;

  return (
    <Shell>
      {admin && report.state !== "published" && (
        <div style={{ background: BRAND.amber, color: BRAND.dark, padding: "10px 24px", fontSize: 13, fontWeight: 600, textAlign: "center" }}>
          Draft preview. Only you can see this page.
        </div>
      )}
      <main className="report-page">
        <h1 style={{ fontFamily: CONDENSED, fontSize: 40, fontWeight: 700, color: BRAND.darkGreen, margin: "0 0 8px", lineHeight: 1.05 }}>{view.company}</h1>
        <p style={{ ...smallStyle, marginBottom: 28 }}>{asOfLine}</p>

        <Paragraphs items={view.opening} />

        <section className="report-section" aria-label="Scorecard">
          <Scorecard view={view.scorecard} label={view.label} compact />
        </section>

        <section className="report-section">
          <h2 style={h2Style}>Product thoughts</h2>
          <Paragraphs items={view.productThoughts} />
        </section>

        <section className="report-section">
          <h2 style={h2Style}>Moonshot</h2>
          <Paragraphs items={view.moonshot} />
        </section>

        <section className="report-section">
          <h2 style={h2Style}>The working</h2>
          {view.workingAvailable ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {view.working.map((row) => {
                if (row.entries.length === 0) return null;
                const scorecardRow = rowsByKey.get(row.key);
                return (
                  <div key={row.key}>
                    <h3 style={{ fontFamily: CONDENSED, fontSize: 18, fontWeight: 700, color: BRAND.teal, margin: "0 0 8px", letterSpacing: "0.02em" }}>
                      {row.name}, {row.grade} of 5
                    </h3>
                    <div className="report-working">
                      {scorecardRow ? <ScorecardWorking row={scorecardRow} parentRunId={report.runId} reportSlug={report.slug} /> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={bodyStyle}>{WORKING_MISSING_LINE}</p>
          )}
        </section>

        <section className="report-section">
          <p style={{ ...bodyStyle, fontSize: 15 }}>
            {view.correction}{" "}
            <a href={`mailto:${view.contactEmail}`} style={{ color: BRAND.teal, fontWeight: 600, textDecoration: "none" }}>{view.contactEmail}</a>
          </p>
        </section>

        <section className="report-section report-cta">
          <h2 style={{ ...h2Style, marginBottom: 8 }}>Talk it through with Summit</h2>
          <p style={{ ...smallStyle, fontSize: 14, marginBottom: 18 }}>Thirty minutes on what the scorecard says and what to do first.</p>
          <BookCallLink href={view.ctaUrl} slug={report.slug} label={view.ctaLabel} />
        </section>

        <footer style={{ marginTop: 40, paddingTop: 16, borderTop: `1px solid ${BRAND.border}` }}>
          <p style={smallStyle}>{asOfLine}</p>
        </footer>
      </main>
    </Shell>
  );
}
