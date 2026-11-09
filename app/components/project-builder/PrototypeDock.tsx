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
  /** The change request box: how many requests this brief has left, whether one is running, its text and the handlers. */
  requestsLeft: number;
  requestBusy: boolean;
  requestText: string;
  onRequestTextChange: (text: string) => void;
  onRequestSend: () => void;
}

/** The request box's limit, mirrored from the server. */
const REQUEST_MAX_LENGTH = 600;

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
 * mockup label, the framed prototype filling the rest of the panel, and
 * under it the one text box "What would you like changed?" with Send. The
 * Create or Update button lives in the top row beside Save. The previous
 * prototype stays on screen while a new one is drawn and when one fails.
 * Nothing from the request is rendered as HTML; the text is only posted.
 */
export default function PrototypeDock({ state, prototype, open, onToggle, button, busy, stage, note, error, requestsLeft, requestBusy, requestText, onRequestTextChange, onRequestSend }: PrototypeDockProps) {
  const working = busy || requestBusy;
  const barStatus = working ? PROTOTYPE.barWorking : !prototype ? PROTOTYPE.barNone : button.current ? PROTOTYPE.barCurrent : PROTOTYPE.barStale;
  const shownNote = note || prototype?.styleNote || "";
  // Enabled only when a prototype from the staged build exists, nothing is generating and requests remain. An older
  // prototype (planVersion 0) needs an Update first; the server says so too.
  const canRequest = prototype !== null && prototype.planVersion > 0 && !working && requestsLeft > 0;
  const requestLine = prototype !== null && prototype.planVersion === 0 ? PROTOTYPE.requestNeedsPrototype : requestsLeft <= 0 ? PROTOTYPE.requestCap : "";
  const inputStyle: CSSProperties = { ...lineStyle, margin: 0, flex: 1, minWidth: 0, padding: "8px 10px", border: "1px solid rgba(255,255,255,0.5)", borderRadius: 6, background: BRAND.white, color: BRAND.dark, fontFamily: SANS };
  const sendStyle: CSSProperties = { fontFamily: SANS, fontWeight: 700, fontSize: 14, padding: "8px 16px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.7)", background: canRequest ? BRAND.white : "transparent", color: canRequest ? BRAND.teal : BRAND.white, cursor: canRequest ? "pointer" : "not-allowed", opacity: canRequest ? 1 : 0.6 };

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
              {working && stage ? STAGE_LINES[stage] : ""}
            </p>
            {!working && shownNote && <p style={lineStyle}>{shownNote}</p>}
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
              <div style={{ flex: "none", paddingTop: 10 }}>
                <label htmlFor="pb-proto-request" style={{ ...lineStyle, display: "block", margin: "0 0 6px", color: BRAND.white, fontWeight: 700 }}>
                  {PROTOTYPE.requestLabel}
                </label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    id="pb-proto-request"
                    type="text"
                    value={requestText}
                    maxLength={REQUEST_MAX_LENGTH}
                    placeholder={PROTOTYPE.requestPlaceholder}
                    disabled={working}
                    onChange={(e) => onRequestTextChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canRequest && requestText.trim()) {
                        e.preventDefault();
                        onRequestSend();
                      }
                    }}
                    style={inputStyle}
                  />
                  <button type="button" disabled={!canRequest || !requestText.trim()} onClick={onRequestSend} style={sendStyle}>
                    {PROTOTYPE.requestSend}
                  </button>
                </div>
                {requestLine && <p style={{ ...lineStyle, margin: "6px 0 0" }}>{requestLine}</p>}
              </div>
            </>
          ) : (
            !working && <p style={{ ...lineStyle, fontStyle: "italic" }}>{prototypeEmptyLine(state)}</p>
          )}
        </div>
      )}
    </section>
  );
}
