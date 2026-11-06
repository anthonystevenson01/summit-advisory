"use client";

import type { CSSProperties } from "react";
import { BRAND } from "@/app/lib/brand";
import type { BriefState } from "@/app/lib/project-builder/brief";
import { DOCK, PROTOTYPE } from "@/app/lib/project-builder/copy";
import { prototypeHash, prototypeReadiness, readinessLine, type PrototypeContact, type PrototypeView } from "@/app/lib/project-builder/prototype";
import { DOCK_BODY, SANS, btn, btnDisabled, dockLabel, dockPanel } from "./builder-styles";
import PrototypeViewer from "./PrototypeViewer";

/** The staged loading line: reading the website, drawing the screens, then a longer wait line. */
export type PrototypeStage = "reading" | "drawing" | "long";

/** Everything the tab shows comes from the page; the dock holds no state of its own. */
export interface PrototypeDockProps {
  state: BriefState;
  /** The contact on the brief: its website or email domain can decide the house style, so it is part of the hash. */
  contact: PrototypeContact;
  prototype: PrototypeView | null;
  open: boolean;
  onToggle: () => void;
  saved: boolean;
  locked: boolean;
  busy: boolean;
  stage: PrototypeStage | null;
  /** The last success line from the server (with the style note when the look is plain). */
  note: string;
  error: string;
  runsLeft: number;
  onGenerate: () => void;
}

function when(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleString("en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

const STAGE_LINES: Record<PrototypeStage, string> = {
  reading: PROTOTYPE.stageReading,
  drawing: PROTOTYPE.stageDrawing,
  long: PROTOTYPE.stageLong,
};

interface ButtonState {
  show: boolean;
  label: string;
  enabled: boolean;
  line: string;
}

/** The design's button table, first match wins. */
function buttonState(p: PrototypeDockProps, current: boolean): ButtonState {
  const label = p.prototype ? PROTOTYPE.update : PROTOTYPE.create;
  const last = p.prototype ? PROTOTYPE.lastUpdated(when(p.prototype.updatedAt)) : "";
  if (p.locked) return { show: false, label, enabled: false, line: "" };
  if (p.busy) return { show: true, label, enabled: false, line: "" };
  const readiness = prototypeReadiness(p.state);
  if (!readiness.ready) return { show: true, label, enabled: false, line: readinessLine(readiness.missing) };
  if (current) return { show: true, label: PROTOTYPE.upToDate, enabled: false, line: last };
  if (p.runsLeft <= 0) return { show: true, label, enabled: false, line: PROTOTYPE.cap };
  if (!p.saved) return { show: true, label: PROTOTYPE.create, enabled: true, line: PROTOTYPE.saveFirst };
  return { show: true, label, enabled: true, line: last };
}

const lineStyle: CSSProperties = { margin: "8px 0 0", fontSize: 14, lineHeight: 1.45, color: DOCK_BODY };

/**
 * The "Prototype so far" tab under "Your blueprint": a bar with the status
 * word and Open or Close, and a panel with the one button (Create or Update,
 * disabled with a plain reason when it cannot run), the staged loading
 * line, the server's note, the error line, and the framed prototype. The
 * previous prototype stays on screen while a new one is drawn and when one
 * fails. Generation only ever happens on the button.
 */
export default function PrototypeDock(props: PrototypeDockProps) {
  const { prototype, open, onToggle, busy, stage, note, error, onGenerate } = props;
  const current = prototype !== null && prototype.hash === prototypeHash(props.state, props.contact);
  const barStatus = busy ? PROTOTYPE.barWorking : !prototype ? PROTOTYPE.barNone : current ? PROTOTYPE.barCurrent : PROTOTYPE.barStale;
  const b = buttonState(props, current);
  const shownNote = note || prototype?.styleNote || "";

  return (
    <section className="pb-dock-tab" aria-label={PROTOTYPE.tab} style={dockPanel}>
      <button type="button" className="pb-dock-bar" onClick={onToggle} aria-expanded={open} aria-controls="pb-proto">
        <span style={dockLabel}>{PROTOTYPE.tab}</span>
        <span style={{ flex: 1, minWidth: 0 }}>{barStatus}</span>
        <span style={{ color: BRAND.white, fontWeight: 700, whiteSpace: "nowrap" }}>{open ? `${DOCK.close} ▾` : `${DOCK.open} ▴`}</span>
      </button>
      {open && (
        <div id="pb-proto" className="pb-dock-panel pb-proto-panel">
          {b.show && (
            <div style={{ margin: "4px 0 14px" }}>
              <button
                type="button"
                onClick={onGenerate}
                disabled={!b.enabled}
                style={{ ...btn, background: BRAND.brandGreen, borderColor: BRAND.brandGreen, ...(b.enabled ? {} : btnDisabled) }}
              >
                {b.label}
              </button>
              {b.line && <p style={lineStyle}>{b.line}</p>}
            </div>
          )}
          <p role="status" aria-live="polite" style={{ ...lineStyle, margin: "0 0 10px", color: BRAND.white, fontFamily: SANS }}>
            {busy && stage ? STAGE_LINES[stage] : ""}
          </p>
          {!busy && shownNote && <p style={{ ...lineStyle, margin: "0 0 10px" }}>{shownNote}</p>}
          {error && (
            <p role="alert" style={{ ...lineStyle, margin: "0 0 10px", color: BRAND.white, fontWeight: 700 }}>
              {error}
            </p>
          )}
          {prototype ? <PrototypeViewer html={prototype.html} height="min(60vh, 560px)" onDark /> : <p style={{ ...lineStyle, fontStyle: "italic" }}>{PROTOTYPE.empty}</p>}
        </div>
      )}
    </section>
  );
}
