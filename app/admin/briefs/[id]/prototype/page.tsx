import Link from "next/link";
import { getBrief, getBriefPrototype, getBriefStyle } from "@/app/lib/briefs";
import { isBriefId } from "@/app/lib/project-builder/brief";
import { projectName } from "@/app/lib/project-builder/requirements";
import { prototypeView } from "@/app/lib/project-builder/prototype-html";
import PrototypeFrame from "@/app/components/project-builder/PrototypeFrame";

export const dynamic = "force-dynamic";

/** The admin nav bar's height; the viewer fills the window below it. */
const NAV_HEIGHT = 56;
const HEADER_HEIGHT = 48;

/**
 * /admin/briefs/[id]/prototype: the brief's latest prototype filling the
 * window under the admin nav, in the same sandboxed frame the prospect
 * sees, with a link back to the brief. Server rendered, no client
 * JavaScript; the admin middleware covers it.
 */
export default async function BriefPrototypePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isBriefId(id)) return <p style={{ color: "#C0392B" }}>That brief id is not valid.</p>;

  let content: { name: string; html: string } | null = null;
  try {
    const [brief, prototype, style] = await Promise.all([getBrief(id), getBriefPrototype(id), getBriefStyle(id)]);
    if (brief && prototype) content = { name: projectName(brief.state), html: prototypeView(prototype, style).html };
  } catch (err) {
    console.error("Admin brief prototype Redis error", err instanceof Error ? err.message : err);
    return <p style={{ color: "#C0392B" }}>The brief store could not be read. Check the Upstash variables.</p>;
  }
  if (!content) {
    return (
      <p style={{ color: "#666" }}>
        No prototype for this brief. <Link href={`/admin/briefs/${id}`} style={{ color: "#005A66" }}>Back to the brief</Link>
      </p>
    );
  }

  return (
    <div style={{ position: "fixed", top: NAV_HEIGHT, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", background: "#F5F7F6", zIndex: 10 }}>
      <div style={{ height: HEADER_HEIGHT, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "0 16px", boxSizing: "border-box" }}>
        <span style={{ fontFamily: "var(--font-oswald), sans-serif", fontSize: 18, fontWeight: 600, color: "#053030" }}>{content.name}</span>
        <Link href={`/admin/briefs/${id}`} style={{ color: "#005A66", fontWeight: 600, fontSize: 13 }}>Back to the brief</Link>
      </div>
      <PrototypeFrame html={content.html} height={`calc(100vh - ${NAV_HEIGHT + HEADER_HEIGHT}px)`} />
    </div>
  );
}
