"use client";

import { BRAND } from "@/app/lib/brand";
import { EXAMPLES, PATHS, type PathKey } from "@/app/lib/project-builder/catalogue";
import type { BriefState } from "@/app/lib/project-builder/brief";
import { HERO_TITLE, PASTE_NOTICE, PRIVACY_LABEL, PRIVACY_URL, START } from "@/app/lib/project-builder/copy";
import { CONDENSED, SANS, btn, btnDisabled, field, fieldWrap, h2, hint, label, lede, path as pathStyle, pathTitle, status, textarea } from "./builder-styles";
import Starters, { selectBlank } from "./Starters";
import ReplaceSystem from "./ReplaceSystem";

export interface StepStartProps {
  state: BriefState;
  source: string;
  busy: boolean;
  readNote: string;
  repNote: string;
  update: (patch: Partial<BriefState>) => void;
  setSource: (text: string) => void;
  onFile: (file: File) => void;
  onRead: () => void;
  onLookup: (name: string) => void;
  onBuild: () => void;
}

/**
 * Step 1: the hero title, the project name, the business section (website
 * and notes, no example text), the four starting points and the per path
 * block: the paste box with the file input and the notice (doc and built),
 * the one sentence field with the examples (idea), or the replace route.
 */
export default function StepStart({ state, source, busy, readNote, repNote, update, setSource, onFile, onRead, onLookup, onBuild }: StepStartProps) {
  const p = state.path;
  const docLike = p === "doc" || p === "built";
  return (
    <div>
      <h1 style={{ fontFamily: CONDENSED, fontWeight: 700, color: BRAND.darkGreen, fontSize: "clamp(34px, 5.2vw, 62px)", lineHeight: 1.05, margin: "0 0 28px" }}>{HERO_TITLE}</h1>

      <div style={{ ...fieldWrap, marginBottom: 26 }}>
        <label htmlFor="pb-name" style={{ ...label, fontFamily: CONDENSED, fontWeight: 600, fontSize: 26, lineHeight: 1.15 }}>{START.nameLabel}</label>
        <p style={hint}>{START.nameHint}</p>
        <input id="pb-name" type="text" name="projectName" value={state.name} onChange={(e) => update({ name: e.target.value })} placeholder={START.namePlaceholder} style={{ ...field, fontSize: 19, padding: "13px 14px" }} />
      </div>

      <h2 style={{ ...h2, marginTop: 34 }}>{START.bizTitle}</h2>
      <p style={lede}>{START.bizLede}</p>
      <div style={fieldWrap}>
        <label htmlFor="pb-biz-web" style={label}>{START.websiteLabel}</label>
        <input id="pb-biz-web" type="text" name="businessWebsite" value={state.biz.website} onChange={(e) => update({ biz: { ...state.biz, website: e.target.value } })} placeholder={START.websitePlaceholder} autoComplete="url" style={field} />
      </div>
      <div style={fieldWrap}>
        <label htmlFor="pb-biz-notes" style={label}>{START.notesLabel}</label>
        <p style={hint}>{START.notesHint}</p>
        <textarea id="pb-biz-notes" value={state.biz.notes} onChange={(e) => update({ biz: { ...state.biz, notes: e.target.value } })} style={textarea} />
      </div>

      <h2 style={{ ...h2, marginTop: 34 }}>{START.pathTitle}</h2>
      <p style={lede}>{START.pathLede}</p>
      <div className="pb-paths" role="group" aria-label="Starting point">
        {PATHS.map((x) => (
          <button key={x.key} type="button" onClick={() => update({ path: x.key as PathKey })} aria-pressed={p === x.key} style={pathStyle(p === x.key)}>
            <strong style={pathTitle(p === x.key)}>{x.title}</strong>
            {x.body}
          </button>
        ))}
      </div>

      {docLike && (
        <>
          <div style={fieldWrap}>
            <label htmlFor="pb-source" style={label}>{p === "doc" ? START.docLabel : START.builtLabel}</label>
            <p style={hint}>{START.fileHint}</p>
            <textarea id="pb-source" value={source} onChange={(e) => setSource(e.target.value)} placeholder={p === "doc" ? START.docPlaceholder : START.builtPlaceholder} style={{ ...textarea, minHeight: 170 }} />
            <p style={{ fontSize: 13, color: BRAND.mid, margin: "8px 0 0", fontFamily: SANS, lineHeight: 1.5 }}>
              {PASTE_NOTICE} <a href={PRIVACY_URL} style={{ color: BRAND.teal }}>{PRIVACY_LABEL}</a>.
            </p>
          </div>
          <div style={fieldWrap}>
            <label htmlFor="pb-file" style={label}>{START.fileLabel}</label>
            <input
              id="pb-file"
              type="file"
              accept=".txt,.md,.markdown,.csv,text/plain,text/markdown,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
              style={{ fontFamily: SANS, fontSize: 15, color: BRAND.darkGreen }}
            />
          </div>
          <button type="button" onClick={onRead} disabled={busy} style={{ ...btn, ...(busy ? btnDisabled : {}) }}>
            <span aria-hidden="true" style={{ marginRight: 6 }}>&#10022;</span>
            {p === "doc" ? START.readDoc : START.readNotes}
          </button>
          <p style={status} role="status">{readNote}</p>
        </>
      )}

      {p === "idea" && (
        <div style={fieldWrap}>
          <label htmlFor="pb-idea" style={label}>{START.ideaLabel}</label>
          <input id="pb-idea" type="text" name="idea" value={state.idea} onChange={(e) => update({ idea: e.target.value })} placeholder={START.ideaPlaceholder} style={field} />
          <p style={{ ...hint, marginTop: 10 }}>{START.ideaHint}</p>
          <Starters
            list={EXAMPLES}
            onPick={(v) => {
              update({ idea: v });
              requestAnimationFrame(() => selectBlank(document.getElementById("pb-idea") as HTMLInputElement | null, v));
            }}
          />
        </div>
      )}

      {p === "replace" && <ReplaceSystem state={state} busy={busy} note={repNote} update={update} onLookup={onLookup} onBuild={onBuild} />}
    </div>
  );
}
