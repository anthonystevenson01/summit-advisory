import { ImageResponse } from "next/og";
import { getRedis } from "@/app/lib/redis";
import { IMAGE_LINE, readCompositeSummary, scorecardImageData, type ScorecardImageData } from "@/app/lib/tools/built-to-scale-image";

export const runtime = "edge";
export const alt = "Built to Scale? scorecard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Duplicated from runs.ts, which this edge function cannot import.
const RUN_ID_PATTERN = /^run_[0-9a-f]{16}$/;

/**
 * The 1200 by 630 score card image. Import rule for the edge runtime: no
 * `node:` module anywhere in the graph, so it reads the raw run hash through
 * the Upstash client in app/lib/redis.ts (runs.ts uses node:crypto) and the
 * pure image module, never the registry or the orchestration. It draws the
 * total, the band and the five rows with their dots, the free view's
 * fields only. A missing, expired or non-composite run, or a Redis error,
 * draws the same frame with the title and the line only, never an error
 * image, so a stale share link still shows a Summit card.
 */
async function loadData(id: string): Promise<ScorecardImageData | null> {
  if (!RUN_ID_PATTERN.test(id)) return null;
  try {
    const hash = await getRedis().hgetall<Record<string, unknown>>(`run:${id}`);
    const summary = readCompositeSummary(hash);
    return summary ? scorecardImageData(summary) : null;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadData(id);

  return new ImageResponse(
    (
      <div
        style={{
          background: "#053030",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 80px 48px",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 14, color: "#6EBF8B", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase" }}>
            SUMMIT STRATEGY ADVISORY
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, marginTop: 12 }}>Built to Scale?</div>
        </div>

        {data ? (
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", flex: 1, marginTop: 8 }}>
            <div style={{ display: "flex", flexDirection: "column", width: 420 }}>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <span style={{ fontSize: 160, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.02em" }}>{data.total}</span>
                <span style={{ fontSize: 28, color: "rgba(255,255,255,0.55)", marginLeft: 12, marginBottom: 22 }}>of 25</span>
              </div>
              <div style={{ fontSize: 30, color: "#6EBF8B", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, marginTop: 8, lineHeight: 1.2 }}>
                {data.band}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", width: 560 }}>
              {data.rows.map((row) => (
                <div key={row.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                  <span style={{ fontSize: 24 }}>{row.name}</span>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    {row.dots.map((filled, i) => (
                      <div
                        key={i}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          marginLeft: 8,
                          background: filled ? "#319A65" : "transparent",
                          border: filled ? "2px solid #319A65" : "2px solid rgba(255,255,255,0.35)",
                        }}
                      />
                    ))}
                    <span style={{ fontSize: 28, fontWeight: 700, marginLeft: 18, width: 36, textAlign: "right" }}>{row.grade}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex" }} />
        )}

        <div style={{ fontSize: 20, color: "rgba(255,255,255,0.55)" }}>{data ? data.line : IMAGE_LINE}</div>
      </div>
    ),
    { ...size },
  );
}
