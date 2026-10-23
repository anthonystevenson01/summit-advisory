import ModelsClient from "./ModelsClient";

export const dynamic = "force-dynamic";

export default function ModelsPage() {
  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-oswald), sans-serif", fontSize: 28, fontWeight: 600, color: "#053030", margin: "0 0 8px" }}>
        Models
      </h1>
      <p style={{ fontSize: 13, color: "#666", margin: "0 0 20px", maxWidth: 760, lineHeight: 1.6 }}>
        Which OpenRouter model handles each kind of call. Changes apply within 30 seconds and need no deploy.
        Changing a scoring or synthesis model marks that row uncalibrated until <code>npm run calibrate</code> passes against it.
      </p>
      <ModelsClient />
    </div>
  );
}
