"use client";

import type { CSSProperties } from "react";
import { BRAND } from "@/app/lib/brand";
import type { BriefState } from "@/app/lib/project-builder/brief";
import { DOCK, PROTOTYPE } from "@/app/lib/project-builder/copy";
import { prototypeEmptyLine, type PrototypeButtonState, type PrototypeView } from "@/app/lib/project-builder/prototype";
import { CONDENSED, DOCK_BODY, SANS } from "./builder-styles";
import PrototypeFrame from "./PrototypeFrame";

/** The staged loading line: reading the website, drawing the screens, then a longer wait line. */
export type PrototypeStage = "reading" | "drawing" | "long";

/** Everything the tab shows comes from the page; the dock holds no state of its own. */
export interface PrototypeDockProps {
  state: BriefState;
  prototype: PrototypeView | null;
  open: boolean;
  onToggle: () => void;
  /** The top row button's state: its line is the reason it is disabled, shown here too. */
  button: PrototypeButtonState;
  busy: boolean;
  stage: PrototypeStage | null;
  /** The last success line from the server (with the style note when the look is plain). */
  note: string;
  error: string;
}

const STAGE_LINES: Record<PrototypeStage, string> = {
  reading: PROTOTYPE.stageReading,
  drawing: PROTOTYPE.stageDrawing,
  long: PROTOTYPE.stageLong,
};

/** Teal, so the tab reads as different from the dark green blueprint. White and the light body colour both pass AA on it. */
const tabStyle: CSSProperties = { background: BRAND.teal, color: DOCK_BODY, fontFamily: SANS };
const labelStyle: CSSProperties = { fontFamily: CONDENSED, fontWeight: 500, color: BRAND.white, fontSize: 14, letterSpacing: 2, textTransform: "uppercase" };
const lineStyle: CSSProperties = { margin: "0 0 8px", fontSize: 14, lineHeight: 1.45, color: DOCK_BODY };

/**
 * The "Prototype so far" tab under "Your blueprint": a bar with the status
 * word and Open or Close, and a tall panel with the reason or last updated
 * line, the staged loading line, the server's note, the error line, the
 * mockup label and the framed prototype filling the rest of the panel. The
 * Create or Update button lives in the top row beside Save. The previous
 * prototype stays on screen while a new one is drawn and when one fails.
 */
export default function PrototypeDock({ state, prototype, open, onToggle, button, busy, stage, note, error }: PrototypeDockProps) {
  const barStatus = busy ? PROTOTYPE.barWorking : !prototype ? PROTOTYPE.barNone : button.current ? PROTOTYPE.barCurrent : PROTOTYPE.barStale;
  const shownNote = note || prototype?.styleNote || "";

  return (
    <section className="pb-dock-tab" aria-label={PROTOTYPE.tab} style={tabStyle}>
      <button type="button" className="pb-dock-bar" onClick={onToggle} aria-expanded={open} aria-controls="pb-proto">
        <span style={labelStyle}>{PROTOTYPE.tab}</span>
        <span style={{ flex: 1, minWidth: 0, color: BRAND.white }}>{barStatus}</span>
        <span style={{ color: BRAND.white, fontWeight: 700, whiteSpace: "nowrap" }}>{open ? `${DOCK.close} ▾` : `${DOCK.open} ▴`}</span>
      </button>
      {open && (
        <div id="pb-proto" className="pb-proto-panel">
          <div style={{ flex: "none" }}>
            {button.show && !busy && button.line && <p style={lineStyle}>{button.line}</p>}
            <p role="status" aria-live="polite" style={{ ...lineStyle, color: BRAND.white, fontWeight: 700 }}>
              {busy && stage ? STAGE_LINES[stage] : ""}
            </p>
            {!busy && shownNote && <p style={lineStyle}>{shownNote}</p>}
            {error && (
              <p role="alert" style={{ ...lineStyle, color: BRAND.white, fontWeight: 700 }}>
                {error}
              </p>
            )}
          </div>
          {prototype ? (
            <>
              <p style={{ ...lineStyle, flex: "none", color: BRAND.white }}>{PROTOTYPE.mockup}</p>
              <div style={{ flex: 1, minHeight: 0 }}>
                <PrototypeFrame html={prototype.html} height="100%" />
              </div>
            </>
          ) : (
            !busy && <p style={{ ...lineStyle, fontStyle: "italic" }}>{prototypeEmptyLine(state)}</p>
          )}
        </div>
      )}
    </section>
  );
}
