import { ImageResponse } from "next/og";
import { getRedis } from "@/app/lib/redis";
import { isExpired, isValidSlug, readReportHash, reportImageData, slideViewOf, type ReportSlideView } from "@/app/lib/tools/report-model";

export const runtime = "edge";
export const alt = "Built to Scale? report summary";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const DARK = "#053030";
const MINT = "#6EBF8B";
const GREEN = "#319A65";

/** The band label sits in a block sized for two lines at this size, so "A good idea with an engine still to build" can wrap without reaching the rows. */
const BAND_FONT_SIZE = 18;
const BAND_LINE_HEIGHT = 1.2;
const BAND_BLOCK_HEIGHT = Math.ceil(2 * BAND_FONT_SIZE * BAND_LINE_HEIGHT);

type Outcome = { kind: "slide"; data: ReportSlideView; company: string; asOfLabel: string } | { kind: "frame" } | { kind: "none" };

/**
 * The 1200 by 630 preview of a report. Import rule for the edge runtime: no
 * `node:` module anywhere in the graph, so it reads the raw report hash
 * through app/lib/redis.ts and the pure model only; never report-access.ts,
 * reports.ts, runs.ts or the registry. Three outcomes: a published,
 * unexpired report without an access code draws the three boxes; one with a
 * code (whose summary must not reach every mail client and social cache
 * that sees the link), or any Redis error, draws the fallback frame; a
 * draft, unpublished, expired, unknown or invalid slug is a plain 404.
 */
async function load(slug: string): Promise<Outcome> {
  if (!isValidSlug(slug)) return { kind: "none" };
  try {
    const hash = await getRedis().hgetall<Record<string, unknown>>(`report:${slug}`);
    const report = readReportHash(hash);
    if (!report || report.state !== "published" || isExpired(report)) return { kind: "none" };
    if (report.accessCode) return { kind: "frame" };
    const slide = slideViewOf(report);
    return { kind: "slide", data: reportImageData(slide), company: report.company, asOfLabel: slide.asOfLabel };
  } catch {
    return { kind: "frame" };
  }
}

const wordmark = (
  <div style={{ fontSize: 14, color: MINT, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase" }}>SUMMIT STRATEGY ADVISORY</div>
);

function Frame() {
  return (
    <div style={{ background: DARK, width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 80px 48px", color: "#ffffff" }}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {wordmark}
        <div style={{ fontSize: 40, fontWeight: 700, marginTop: 12 }}>Built to Scale? report</div>
      </div>
      <div style={{ fontSize: 22, color: "rgba(255,255,255,0.55)" }}>Open the link to read the report</div>
    </div>
  );
}

function Slide({ data, company, asOfLabel }: { data: ReportSlideView; company: string; asOfLabel: string }) {
  const boxStyle = { display: "flex", flexDirection: "column" as const, flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: "18px 20px", overflow: "hidden" as const };
  const titleStyle = { fontSize: 13, color: MINT, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 10 };
  return (
    <div style={{ background: DARK, width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "40px 56px 32px", color: "#ffffff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1 }}>{company}</div>
          <div style={{ fontSize: 18, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>{`Built to Scale? report, as of ${asOfLabel}`}</div>
        </div>
        {wordmark}
      </div>
      <div style={{ fontSize: 22, lineHeight: 1.4, marginTop: 18, display: "flex" }}>{data.opening}</div>
      <div style={{ display: "flex", flexDirection: "row", gap: 16, marginTop: 20, flex: 1 }}>
        {data.boxes.map((box) =>
          box.kind === "text" ? (
            <div key={box.title} style={boxStyle}>
              <div style={titleStyle}>{box.title}</div>
              <div style={{ fontSize: 18, lineHeight: 1.4, display: "flex" }}>{box.paragraphs.join(" ")}</div>
            </div>
          ) : (
            <div key={box.title} style={{ ...boxStyle, flex: 1.15 }}>
              <div style={titleStyle}>{box.title}</div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <span style={{ fontSize: 96, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.02em" }}>{box.total}</span>
                <span style={{ fontSize: 20, color: "rgba(255,255,255,0.55)", marginLeft: 10, marginBottom: 12 }}>of 25</span>
              </div>
              {/* A fixed two-line block: the longest band wraps, and Satori must not let a second line run into the rows. */}
              <div style={{ display: "flex", height: BAND_BLOCK_HEIGHT, overflow: "hidden", marginTop: 6 }}>
                <div style={{ fontSize: BAND_FONT_SIZE, lineHeight: BAND_LINE_HEIGHT, color: MINT, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700 }}>{box.band}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
                {box.rows.map((row) => (
                  <div key={row.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
                    <span style={{ fontSize: 16 }}>{row.name}</span>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      {row.dots.map((filled, i) => (
                        <div
                          key={i}
                          style={{ width: 12, height: 12, borderRadius: 6, marginLeft: 5, background: filled ? GREEN : "transparent", border: filled ? `2px solid ${GREEN}` : "2px solid rgba(255,255,255,0.35)" }}
                        />
                      ))}
                      <span style={{ fontSize: 18, fontWeight: 700, marginLeft: 12, width: 20, textAlign: "right" }}>{row.grade}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const outcome = await load(slug);
  if (outcome.kind === "none") return new Response(null, { status: 404 });
  return new ImageResponse(outcome.kind === "slide" ? <Slide data={outcome.data} company={outcome.company} asOfLabel={outcome.asOfLabel} /> : <Frame />, { ...size });
}
