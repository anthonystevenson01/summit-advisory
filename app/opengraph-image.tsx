import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Summit Strategy Advisory — Vision. Action. Growth.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#053030",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px 100px",
        }}
      >
        <div
          style={{
            fontSize: 14,
            color: "#6EBF8B",
            fontWeight: 700,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            marginBottom: 32,
          }}
        >
          SUMMIT STRATEGY ADVISORY
        </div>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 0.92, marginBottom: 40 }}>
          <span style={{ fontSize: 108, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.01em" }}>
            Vision.
          </span>
          <span style={{ fontSize: 108, fontWeight: 900, color: "#6EBF8B", letterSpacing: "-0.01em" }}>
            Action.
          </span>
          <span style={{ fontSize: 108, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.01em" }}>
            Growth.
          </span>
        </div>
        <div
          style={{
            fontSize: 22,
            color: "rgba(255,255,255,0.55)",
            maxWidth: 680,
            lineHeight: 1.55,
          }}
        >
          AI products for founders. Retail media for large retailers.
          GTM leadership for B2B scale-ups.
        </div>
      </div>
    ),
    { ...size }
  );
}
