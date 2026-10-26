import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import PrintButton from "./PrintButton";
import { BRAND } from "@/app/lib/brand";
import { validateSession } from "@/app/lib/auth";
import { getReport } from "@/app/lib/reports";
import { isExpired, isValidSlug, slideViewOf, type ReportRecord, type ReportSlideBox } from "@/app/lib/tools/report-model";
import { REPORT_ACCESS_COOKIE, verifyReportAccessCookie } from "@/app/lib/unlock";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

async function loadReport(slug: string): Promise<ReportRecord | null> {
  if (!isValidSlug(slug)) return null;
  try {
    return await getReport(slug);
  } catch (err) {
    console.error("report slide: report read failed", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const report = await loadReport(slug);
  const hidden: Metadata = { title: "Report summary", robots: { index: false, follow: false } };
  if (!report || report.state !== "published" || isExpired(report)) return hidden;
  return { title: `${report.company}: Built to Scale? summary`, robots: { index: false, follow: false } };
}

function Box({ box }: { box: ReportSlideBox }) {
  if (box.kind === "text") {
    return (
      <div className="rs-box">
        <p className="rs-box-title">{box.title}</p>
        {box.paragraphs.map((text, i) => (
          <p key={i} className="rs-box-text">{text}</p>
        ))}
      </div>
    );
  }
  return (
    <div className="rs-box">
      <p className="rs-box-title">{box.title}</p>
      <div className="rs-total">
        <span className="rs-total-n">{box.total}</span>
        <span className="rs-total-of">of 25</span>
      </div>
      <p className="rs-band">{box.band}</p>
      <div className="rs-rows">
        {box.rows.map((row) => (
          <div key={row.name} className="rs-row">
            <span>{row.name}</span>
            <span className="rs-row-right">
              <span className="rs-dots" role="img" aria-label={`${row.grade} of 5`}>
                {row.dots.map((on, i) => (
                  <span key={i} className={on ? "rs-dot rs-dot-on" : "rs-dot"} />
                ))}
              </span>
              <span className="rs-grade" aria-hidden="true">{row.grade}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The one-slide summary: the same gate as the report page (404, the
 * expired redirect, a redirect to the report when an access code is set
 * and the cookie does not verify, the admin preview for a draft), no open
 * counting, then the slide from `slideViewOf`. The `@page` rule lives here
 * so landscape applies to this page only.
 */
export default async function SlidePage({ params }: { params: Params }) {
  const { slug } = await params;
  const report = await loadReport(slug);
  if (!report) notFound();
  const admin = await validateSession();
  if (report.state !== "published" && !admin) notFound();
  if (isExpired(report)) redirect(`/report/${report.slug}/expired`);
  if (report.accessCode) {
    const cookieStore = await cookies();
    const ok = verifyReportAccessCookie(cookieStore.get(REPORT_ACCESS_COOKIE)?.value, report.slug, report.accessCode.hash.slice(0, 8));
    if (!ok) redirect(`/report/${report.slug}`);
  }

  const slide = slideViewOf(report);

  return (
    <div className="rs-page" style={{ fontFamily: "var(--font-dm-sans), sans-serif", color: BRAND.dark }}>
      <style>{"@page { size: landscape; margin: 10mm; }"}</style>
      <div className="rs-chrome">
        <Link href={`/report/${report.slug}`} style={{ color: BRAND.teal, fontWeight: 600, textDecoration: "none", fontSize: 14 }}>
          Back to the report
        </Link>
        <PrintButton />
      </div>
      <div className="rs-stage">
        <div className="rs-slide">
          <div className="rs-head">
            <div>
              <h1 className="rs-company">{slide.company}</h1>
              <p className="rs-sub">Built to Scale? report, as of {slide.asOfLabel}</p>
            </div>
            <p className="rs-mark">{slide.mark}</p>
          </div>
          <p className="rs-opening">{slide.opening}</p>
          <div className="rs-boxes">
            {slide.boxes.map((box) => (
              <Box key={box.title} box={box} />
            ))}
          </div>
          <p className="rs-foot">{slide.caveat}</p>
        </div>
      </div>
    </div>
  );
}
