import type { CSSProperties } from "react";
import type { CrawlStore } from "@/app/lib/ask-summit/crawl-rules";
import type { AskDocEntry, AskDraft, AskRequestRecord } from "@/app/lib/ask-summit/request-model";
import { BTS_PARTS, PART_MAX, PART_MIN } from "@/app/lib/tools/built-to-scale-method";
import type { Confidence } from "@/app/lib/tools/schema";
import { buttonStyle } from "../admin-report-ui";

export interface DraftedInputsProps {
  slug: string;
  request: AskRequestRecord | null;
  draft: AskDraft | null;
  pages: CrawlStore | null;
  docs: { files: AskDocEntry[] } | null;
}

const sectionStyle: CSSProperties = { background: "#fff", borderRadius: 10, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 };
const h2Style: CSSProperties = { fontFamily: "var(--font-oswald), sans-serif", fontSize: 16, fontWeight: 600, color: "#053030", margin: "0 0 14px" };
const h3Style: CSSProperties = { fontSize: 13, fontWeight: 600, color: "#053030", margin: "18px 0 8px", textTransform: "uppercase", letterSpacing: "0.04em" };
const fieldStyle: CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 6,
  border: "1px solid #D0D5D2",
  fontSize: 13,
  fontFamily: "var(--font-dm-sans), sans-serif",
  color: "#1A1A1A",
  background: "#fff",
  boxSizing: "border-box",
  lineHeight: 1.5,
  minHeight: 120,
  resize: "vertical",
};
const quoteStyle: CSSProperties = { fontSize: 12, color: "#666", margin: "0 0 4px 12px", paddingLeft: 10, borderLeft: "2px solid #D0D5D2", lineHeight: 1.5 };
const hintStyle: CSSProperties = { fontSize: 11, color: "#666", margin: "4px 0 0", lineHeight: 1.5 };
const lineStyle: CSSProperties = { fontSize: 13, color: "#1A1A1A", margin: "0 0 4px", lineHeight: 1.5 };
const linkStyle: CSSProperties = { color: "#005A66", fontWeight: 600, textDecoration: "none" };

const CONFIDENCE_COLOURS: Record<Confidence, string> = { high: "#319A65", medium: "#D4A017", low: "#C0392B" };

const RERUN_LINE =
  "This scores the parts again through every tool and the synthesis, points the report at the new run and resets the five rows to it. Grades and comments you edited are not kept; the sections you wrote are.";
const COUNTER_HINT = `${PART_MIN} to ${PART_MAX.toLocaleString("en-GB")} characters; blank means the placeholder is used.`;
const PAGE_LIST_FOLD = 10;

function ConfidenceChip({ level }: { level: Confidence }) {
  const colour = CONFIDENCE_COLOURS[level];
  return (
    <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 4, background: `${colour}18`, color: colour, marginLeft: 8 }}>
      {level}
    </span>
  );
}

function PageList({ pages }: { pages: CrawlStore }) {
  const items = pages.pages.map((page) => (
    <li key={page.url} style={lineStyle}>
      <a href={page.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>{page.title || page.path}</a>
      <span style={{ color: "#666", marginLeft: 8, fontSize: 12 }}>{page.chars.toLocaleString("en-GB")} chars</span>
    </li>
  ));
  const summary = `robots ${pages.robots}; skipped ${pages.skipped.disallowed} disallowed, ${pages.skipped.offHost} off host, ${pages.skipped.failed} failed, ${pages.skipped.timedOut} timed out, ${pages.skipped.notHtml} not HTML, ${pages.skipped.duplicate} duplicate${pages.truncated ? "; text cap reached" : ""}`;
  return (
    <div>
      {items.length > PAGE_LIST_FOLD ? (
        <details>
          <summary style={{ fontSize: 13, color: "#005A66", fontWeight: 600, cursor: "pointer" }}>{items.length} pages read</summary>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>{items}</ul>
        </details>
      ) : items.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 18 }}>{items}</ul>
      ) : (
        <p style={lineStyle}>No pages were stored.</p>
      )}
      <p style={hintStyle}>{summary}</p>
    </div>
  );
}

/**
 * The editor's "Drafted inputs" section for a report made from an Ask
 * Summit request: the five drafted parts with confidence and evidence,
 * each in a textarea, the pages read, the documents, and the "Re-run with
 * these inputs" form. Its own form, after the main editor form, because a
 * form cannot nest. No client state.
 */
export default function DraftedInputs({ slug, request, draft, pages, docs }: DraftedInputsProps) {
  if (!request) {
    return (
      <div style={sectionStyle}>
        <h2 style={h2Style}>Drafted inputs</h2>
        <p style={lineStyle}>The Ask Summit request behind this report is gone.</p>
      </div>
    );
  }
  return (
    <form method="POST" action="/api/admin/ask-summit/rerun">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="askRequestId" value={request.id} />
      <div style={sectionStyle}>
        <h2 style={h2Style}>Drafted inputs</h2>
        <p style={{ ...lineStyle, color: "#666", marginBottom: 12 }}>
          <a href={request.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>{request.host}</a>, {request.state}, {request.attempts} {request.attempts === 1 ? "attempt" : "attempts"}
          {draft ? `, drafted by ${draft.model}` : ", no draft stored"}
          {(request.pdfDropped || draft?.pdfDropped) && <span style={{ color: "#D4A017", fontWeight: 600 }}>. A PDF was not sent to the model</span>}
          {request.dataDeleted && <span style={{ color: "#C0392B", fontWeight: 600 }}>. The uploads and pages were deleted</span>}
        </p>
        {draft && draft.summary && (
          <p style={{ ...lineStyle, color: "#666", fontStyle: "italic", marginBottom: 16 }}>{draft.summary}</p>
        )}

        {BTS_PARTS.map((part) => {
          const drafted = draft?.parts[part.key];
          const value = drafted ? (drafted.editedText ?? drafted.text) : "";
          return (
            <div key={part.key} style={{ borderTop: "1px solid #E8ECE9", padding: "14px 0" }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#053030", margin: "0 0 6px" }}>
                {part.label}
                {drafted && <ConfidenceChip level={drafted.confidence} />}
                {drafted && drafted.reason && <span style={{ fontSize: 12, color: "#666", fontWeight: 400, marginLeft: 8 }}>{drafted.reason}</span>}
                {drafted?.editedText !== undefined && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: "#D4A017" }}>edited</span>}
              </p>
              {drafted && drafted.evidence.length > 0 ? (
                drafted.evidence.map((quote, i) => <p key={i} style={quoteStyle}>{quote}</p>)
              ) : (
                <p style={{ ...quoteStyle, fontStyle: "italic" }}>No evidence quoted</p>
              )}
              <textarea name={`part:${part.key}`} defaultValue={value} style={{ ...fieldStyle, marginTop: 8 }} />
              <p style={hintStyle}>{COUNTER_HINT}</p>
            </div>
          );
        })}

        <h3 style={h3Style}>Pages read</h3>
        {pages ? <PageList pages={pages} /> : <p style={lineStyle}>{request.dataDeleted ? "Deleted." : "No pages stored."}</p>}

        <h3 style={h3Style}>Documents</h3>
        {docs && docs.files.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {docs.files.map((doc) => (
              <li key={doc.pathname} style={lineStyle}>
                {doc.name}, {doc.type}, {doc.status}
                {doc.status === "text" && `, ${doc.chars.toLocaleString("en-GB")} chars${doc.parts && doc.parts > 1 ? `, ${doc.parts} slides` : ""}${doc.truncated ? ", cut at the cap" : ""}`}
                {doc.reason ? `: ${doc.reason}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p style={lineStyle}>{request.files.length === 0 ? "No documents were given." : request.dataDeleted ? "Deleted." : request.files.map((f) => f.name).join(", ")}</p>
        )}

        <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <button type="submit" disabled={!draft} style={{ ...buttonStyle, background: "#053030" }}>Re-run with these inputs</button>
          <p style={{ ...hintStyle, margin: 0, maxWidth: 640 }}>{RERUN_LINE}</p>
        </div>
      </div>
    </form>
  );
}
