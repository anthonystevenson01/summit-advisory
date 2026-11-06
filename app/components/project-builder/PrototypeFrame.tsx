import type { CSSProperties } from "react";
import { BRAND } from "@/app/lib/brand";
import { PROTOTYPE } from "@/app/lib/project-builder/copy";
import { PROTOTYPE_SANDBOX } from "@/app/lib/project-builder/prototype";

export interface PrototypeFrameProps {
  /** The served document: sanitised, CSP first in its head, the logo as a data URI. */
  html: string;
  height: string;
  title?: string;
}

/**
 * The one place a prototype is framed. No hooks and no "use client", so the
 * admin server pages and the builder's client components share it and the
 * sandbox is written once: scripts only, so the frame has an opaque origin
 * (no cookies, storage or DOM of this site), cannot submit forms, open
 * popups or navigate the top window. The document is passed as srcdoc, so
 * nothing is fetched to show it.
 */
export default function PrototypeFrame({ html, height, title = PROTOTYPE.frameTitle }: PrototypeFrameProps) {
  const style: CSSProperties = { display: "block", width: "100%", height, border: `1px solid ${BRAND.border}`, background: BRAND.white };
  return <iframe title={title} srcDoc={html} sandbox={PROTOTYPE_SANDBOX} referrerPolicy="no-referrer" allow="" loading="lazy" style={style} />;
}
