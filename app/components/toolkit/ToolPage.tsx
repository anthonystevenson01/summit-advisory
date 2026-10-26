"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BOOK_CALL_URL, BRAND } from "@/app/lib/brand";
import { getTool, type ToolSlug } from "@/app/lib/tools/registry";
import GtmDimensionBar from "./shared/GtmDimensionBar";
import ToolShareButtons from "./shared/ToolShareButtons";
import CyclingLoader from "./shared/CyclingLoader";
import ErrMsg from "./shared/ErrMsg";
import ResultBlock, { type ConfidenceLevel } from "./shared/ResultBlock";
import UnlockGate from "./shared/UnlockGate";
import PrefillLoader, { type PrefillPayload } from "./shared/PrefillLoader";
import { renderExtra, type ExtraValue } from "./shared/extras";

type Phase = "input" | "scoring" | "scored" | "unlocking" | "full" | "error";

interface FreeView {
  runId: string;
  tool: string;
  score: number;
  grade: number;
  gradeLabel: string;
  gradeDescription: string;
  legacyLabel?: string;
  verdict: string;
  confidence: ConfidenceLevel;
  confidenceReason: string;
  scores: Record<string, number>;
  /** True when the request carried a valid unlock cookie, so the gate is skipped. */
  unlocked?: boolean;
}

interface Recommendation {
  dim: string;
  name: string;
  score: number;
  gap: string;
  consequence: string;
  action: string;
}

interface FullView extends FreeView {
  reasoning: Record<string, string>;
  recommendations: Recommendation[];
  extras: Record<string, ExtraValue>;
  /** True only when this request sent the result email. */
  emailed?: boolean;
}

const RUN_ID_PATTERN = /^run_[0-9a-f]{16}$/;

const UPDATING_MESSAGE = "This tool is being updated. Please try again in a few minutes.";
const GENERIC_MESSAGE = "Something went wrong. Please try again.";

const fieldStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 6,
  border: `1px solid ${BRAND.border}`,
  fontSize: 14,
  fontFamily: "var(--font-dm-sans), sans-serif",
  color: BRAND.dark,
  background: BRAND.white,
  outline: "none",
  boxSizing: "border-box" as const,
  transition: "border-color 0.2s",
};

const labelStyle = {
  fontSize: 13,
  fontWeight: 600 as const,
  color: BRAND.darkGreen,
  display: "block",
  marginBottom: 6,
  letterSpacing: "0.02em",
};

const h3Style = {
  fontFamily: "var(--font-oswald), sans-serif",
  fontSize: 16,
  fontWeight: 600 as const,
  color: BRAND.darkGreen,
  marginBottom: 16,
  marginTop: 0,
};

const panelHeadingStyle = {
  fontFamily: "var(--font-oswald), sans-serif",
  fontSize: 14,
  fontWeight: 600 as const,
  color: BRAND.teal,
  margin: "0 0 14px",
  letterSpacing: "0.04em",
  textTransform: "uppercase" as const,
};

async function readError(res: Response): Promise<string> {
  if (res.status === 503) return UPDATING_MESSAGE;
  try {
    const data = (await res.json()) as { error?: string };
    if (data.error) return data.error;
  } catch {
    // no JSON body
  }
  return GENERIC_MESSAGE;
}

async function fetchDetails(slug: string, runId: string, token?: string): Promise<Response> {
  return fetch(`/api/tools/${slug}/details`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(token ? { runId, token } : { runId }),
  });
}

/**
 * Reads `run` and `t` from the query string and, when both are present,
 * requests the saved full view with the token. Lives in its own component
 * under Suspense so useSearchParams does not opt the static tool page out of
 * static rendering. State is handed back only in the async continuation; on
 * any failure nothing happens and the normal page shows.
 */
function SavedResultLoader({ slug, onLoaded }: { slug: ToolSlug; onLoaded: (full: FullView) => void }) {
  const searchParams = useSearchParams();
  const started = useRef(false);

  useEffect(() => {
    const runId = searchParams.get("run") ?? "";
    const token = searchParams.get("t") ?? "";
    if (started.current || !RUN_ID_PATTERN.test(runId) || !token) return;
    started.current = true;
    fetchDetails(slug, runId, token)
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as Partial<FullView>;
        if (!data.runId || typeof data.score !== "number" || !data.reasoning) return;
        onLoaded(data as FullView);
      })
      .catch(() => {
        // an invalid or expired link shows the normal page
      });
  }, [searchParams, slug, onLoaded]);

  return null;
}

/**
 * Renders any public registry entry: hero, intro, the two panels, the input
 * form, the result block, dimension bars, the unlock form and the full view.
 * Talks only to /api/tools/{slug}/score, /unlock and /details.
 */
export default function ToolPage({ slug }: { slug: ToolSlug }) {
  const entry = getTool(slug);
  const [phase, setPhase] = useState<Phase>("input");
  const [values, setValues] = useState<Record<string, string>>({});
  const [free, setFree] = useState<FreeView | null>(null);
  const [full, setFull] = useState<FullView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorReturn, setErrorReturn] = useState<Phase>("input");
  const [honeypot, setHoneypot] = useState("");
  const [rerunOf, setRerunOf] = useState<string | null>(null);
  const [savedMode, setSavedMode] = useState(false);
  const [emailed, setEmailed] = useState(false);
  const [prefilledFrom, setPrefilledFrom] = useState<string | null>(null);
  // The prospect report the re-run link came from, kept across "Score again"
  // so a second run from the same page still counts on the report.
  const [reportSlug, setReportSlug] = useState<string | null>(null);
  const resultsRef = useRef<HTMLElement>(null);

  // The re-run hand-off from a Built to Scale? scorecard row or a report's
  // working: the child run's inputs fill the form and the next score records
  // `re_run` with `rerunOf` (and `report` when the link named one).
  const handlePrefill = useCallback((payload: PrefillPayload) => {
    if (payload.tool !== slug) return;
    const current = getTool(slug);
    if (!current) return;
    const next: Record<string, string> = {};
    for (const input of current.inputs) {
      const value = payload.inputs[input.key];
      if (typeof value === "string" && value.length > 0) next[input.key] = value.slice(0, input.maxLength);
    }
    setValues((prev) => ({ ...prev, ...next }));
    setRerunOf(payload.runId);
    setPrefilledFrom(payload.runId);
    setReportSlug(payload.report ?? null);
  }, [slug]);

  useEffect(() => {
    if (phase === "scored" || phase === "full") {
      const t = setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      return () => clearTimeout(t);
    }
  }, [phase]);

  if (!entry || entry.hidden) return null;

  const inputsLocked = phase !== "input" && phase !== "error";
  const resultVisible = phase === "scored" || phase === "unlocking" || phase === "full";

  const formValid = entry.inputs.every((input) => {
    const value = (values[input.key] ?? "").trim();
    if (input.required && value.length < Math.max(1, input.minLength)) return false;
    if (value.length > 0 && value.length < input.minLength) return false;
    return value.length <= input.maxLength;
  });

  const fail = (message: string, returnTo: Phase) => {
    setError(message);
    setErrorReturn(returnTo);
    setPhase("error");
  };

  /**
   * Requests the full view. `returnTo` is where a 403 lands: the gate when
   * the cookie turned out invalid, or the gate again after a form unlock.
   */
  const requestDetails = async (runId: string, returnTo: Phase, token?: string) => {
    try {
      const detailsRes = await fetchDetails(entry.slug, runId, token);
      if (!detailsRes.ok) {
        if (detailsRes.status === 403) {
          setPhase(returnTo);
          return;
        }
        fail(await readError(detailsRes), returnTo);
        return;
      }
      const data = (await detailsRes.json()) as FullView;
      setFull(data);
      setEmailed(data.emailed === true);
      setPhase("full");
    } catch {
      fail(GENERIC_MESSAGE, returnTo);
    }
  };

  const handleScore = async () => {
    if (!formValid || phase === "scoring") return;
    setPhase("scoring");
    setError(null);
    setFree(null);
    setFull(null);
    setEmailed(false);
    try {
      const res = await fetch(`/api/tools/${entry.slug}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: values, website: honeypot, ...(rerunOf ? { rerunOf } : {}), ...(rerunOf && reportSlug ? { report: reportSlug } : {}) }),
      });
      if (!res.ok) {
        fail(await readError(res), "input");
        return;
      }
      const data = (await res.json()) as Partial<FreeView>;
      if (!data.runId || typeof data.score !== "number") {
        fail(GENERIC_MESSAGE, "input");
        return;
      }
      setFree(data as FreeView);
      if (data.unlocked) {
        // A valid unlock cookie: skip the gate and request details directly.
        setPhase("unlocking");
        await requestDetails(data.runId, "scored");
        return;
      }
      setPhase("scored");
    } catch {
      fail(GENERIC_MESSAGE, "input");
    }
  };

  const handleUnlock = async (email: string, name: string, company: string) => {
    if (!free) return;
    setPhase("unlocking");
    setError(null);
    try {
      const unlockRes = await fetch(`/api/tools/${entry.slug}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: free.runId, name, email, company, website: honeypot }),
      });
      if (!unlockRes.ok) {
        fail(await readError(unlockRes), "scored");
        return;
      }
    } catch {
      fail(GENERIC_MESSAGE, "scored");
      return;
    }
    await requestDetails(free.runId, "scored");
  };

  const handleSavedResult = (saved: FullView) => {
    setFree(saved);
    setFull(saved);
    setEmailed(false);
    setError(null);
    setSavedMode(true);
    setPhase("full");
  };

  const handleScoreAgain = () => {
    if (free) setRerunOf(free.runId);
    setFree(null);
    setFull(null);
    setError(null);
    setEmailed(false);
    setSavedMode(false);
    setPhase("input");
  };

  const setValue = (key: string, value: string, max: number) => {
    setValues((prev) => ({ ...prev, [key]: value.slice(0, max) }));
  };

  const view = full ?? free;

  return (
    <div style={{ minHeight: "100vh", background: BRAND.white, fontFamily: "var(--font-dm-sans), sans-serif" }}>
      <Suspense fallback={null}>
        <SavedResultLoader slug={entry.slug} onLoaded={handleSavedResult} />
        <PrefillLoader param="prefill" via="scorecard" onLoaded={handlePrefill} />
      </Suspense>

      {/* HERO */}
      <section style={{ background: `linear-gradient(135deg, ${BRAND.darkGreen} 0%, ${BRAND.teal} 100%)`, padding: "40px 32px 56px", textAlign: "center" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 20, background: "rgba(49,154,101,0.25)", border: "1px solid rgba(49,154,101,0.4)", marginBottom: 24 }}>
            <span style={{ color: BRAND.brandGreen, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Tool {entry.number} GTM Toolkit
            </span>
          </div>
          <h1 style={{ fontFamily: "var(--font-oswald), sans-serif", fontSize: 46, fontWeight: 700, color: BRAND.white, lineHeight: 1.12, margin: "0 0 20px" }}>
            {entry.name}
          </h1>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.85)", lineHeight: 1.65, margin: 0 }}>{entry.tagline}</p>
          <ToolShareButtons slug={entry.slug} title={`${entry.name}: Summit Strategy Advisory`} />
        </div>
      </section>

      {/* INTRO */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "48px 24px 16px" }}>
        {entry.intro?.map((item, i) => (
          <div key={i}>
            {item.heading && (
              <h2 style={{ fontFamily: "var(--font-oswald), sans-serif", fontSize: 22, fontWeight: 600, color: BRAND.darkGreen, lineHeight: 1.3, margin: "28px 0 16px" }}>
                {item.heading}
              </h2>
            )}
            <p style={{ fontSize: 15, color: BRAND.dark, lineHeight: 1.7, margin: "0 0 14px" }}>{item.text}</p>
          </div>
        ))}

        <div className="gtm-tool-grid" style={{ margin: `${entry.intro ? 28 : 0}px 0 24px`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={{ padding: "20px 24px", background: BRAND.lightBg, borderRadius: 10, border: `1px solid ${BRAND.border}` }}>
            <h3 style={panelHeadingStyle}>What we evaluate</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {entry.dimensions.map((d) => (
                <div key={d.key} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: BRAND.brandGreen, flexShrink: 0, marginTop: 4 }} />
                  <span style={{ fontSize: 13, color: BRAND.dark, lineHeight: 1.4 }}>{d.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: "20px 24px", background: BRAND.white, borderRadius: 10, border: `1px solid ${BRAND.border}` }}>
            <h3 style={panelHeadingStyle}>What the highest standard looks like</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {entry.dimensions.map((d) => (
                <div key={d.key} style={{ fontSize: 12, color: BRAND.mid, lineHeight: 1.55 }}>
                  <span style={{ fontWeight: 600, color: BRAND.darkGreen }}>{d.name}:</span> {d.standard}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* INPUT: hidden while a saved result is shown, until "Score again" */}
      {!savedMode && (
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "8px 24px" }}>
        {prefilledFrom && phase === "input" && (
          <p style={{ fontSize: 13, color: BRAND.teal, margin: "0 0 16px", lineHeight: 1.5 }}>
            {reportSlug
              ? "Inputs loaded from the Summit report. Edit anything and score again."
              : "Inputs loaded from your Built to Scale? run. Edit anything and score again."}
          </p>
        )}
        <input
          type="text"
          name="website"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          aria-hidden="true"
          style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
          autoComplete="off"
        />

        {entry.inputs.map((input) => {
          const value = values[input.key] ?? "";
          const nearLimit = value.length > input.maxLength * 0.9;
          const belowMin = input.minLength > 0 && value.length > 0 && value.length < input.minLength;
          return (
            <div key={input.key} style={{ marginBottom: 16 }}>
              <label htmlFor={`${entry.slug}-${input.key}`} style={labelStyle}>
                {input.label}{" "}
                {input.required ? (
                  <span style={{ color: BRAND.red }}>*</span>
                ) : (
                  <span style={{ color: BRAND.mid, fontWeight: 400 }}>(optional)</span>
                )}
              </label>
              {input.kind === "textarea" ? (
                <textarea
                  id={`${entry.slug}-${input.key}`}
                  value={value}
                  onChange={(e) => setValue(input.key, e.target.value, input.maxLength)}
                  placeholder={input.placeholder}
                  disabled={inputsLocked}
                  style={{ ...fieldStyle, minHeight: input.required ? 200 : 120, padding: 16, borderRadius: 8, lineHeight: 1.6, resize: "vertical" }}
                  onFocus={(e) => (e.target.style.borderColor = BRAND.teal)}
                  onBlur={(e) => (e.target.style.borderColor = BRAND.border)}
                />
              ) : (
                <input
                  id={`${entry.slug}-${input.key}`}
                  type="text"
                  value={value}
                  onChange={(e) => setValue(input.key, e.target.value, input.maxLength)}
                  placeholder={input.placeholder}
                  disabled={inputsLocked}
                  style={fieldStyle}
                  onFocus={(e) => (e.target.style.borderColor = BRAND.teal)}
                  onBlur={(e) => (e.target.style.borderColor = BRAND.border)}
                />
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                {!inputsLocked ? (
                  <button
                    type="button"
                    onClick={() => setValue(input.key, input.example, input.maxLength)}
                    style={{ background: "none", border: "none", padding: 0, color: BRAND.teal, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-dm-sans), sans-serif" }}
                  >
                    Show an example
                  </button>
                ) : (
                  <span />
                )}
                {input.kind === "textarea" && (
                  <span style={{ fontSize: 12, color: belowMin ? BRAND.red : nearLimit ? BRAND.amber : BRAND.mid }}>
                    {value.length.toLocaleString()} / {input.maxLength.toLocaleString()}
                    {belowMin && ` (minimum ${input.minLength})`}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          {!inputsLocked && (
            <button
              type="button"
              onClick={handleScore}
              disabled={!formValid}
              style={{
                padding: "12px 28px",
                borderRadius: 6,
                border: "none",
                background: formValid ? BRAND.brandGreen : BRAND.border,
                color: BRAND.white,
                fontFamily: "var(--font-oswald), sans-serif",
                fontWeight: 600,
                fontSize: 15,
                letterSpacing: "0.04em",
                cursor: formValid ? "pointer" : "not-allowed",
                transition: "all 0.2s",
              }}
            >
              {entry.buttonLabel}
            </button>
          )}
        </div>

        {phase === "scoring" && (
          <div style={{ padding: "32px 0" }}>
            <CyclingLoader dark={false} messages={["Reading your input", `Scoring ${entry.dimensions.length} dimensions`, "Writing the verdict"]} />
          </div>
        )}

        {phase === "error" && error && (
          <div style={{ padding: "24px 0" }}>
            <ErrMsg
              msg={error}
              dark={false}
              retry={() => {
                setError(null);
                setPhase(errorReturn);
              }}
            />
          </div>
        )}
      </section>
      )}

      {/* RESULTS */}
      {resultVisible && view && (
        <section ref={resultsRef} style={{ maxWidth: 960, margin: "0 auto", padding: `${savedMode ? 32 : 0}px 24px 48px` }}>
          {savedMode && (
            <p style={{ fontSize: 13, color: BRAND.mid, margin: "0 0 14px", textAlign: "center" }}>
              This is your saved result. Score again to run a fresh evaluation.
            </p>
          )}
          <div style={{ background: BRAND.lightBg, borderRadius: 12, padding: "32px 28px", border: `1px solid ${BRAND.border}` }}>
            <ResultBlock
              score={view.score}
              grade={view.grade}
              label={view.gradeLabel}
              legacyLabel={view.legacyLabel}
              verdict={view.verdict}
              confidence={view.confidence}
              confidenceReason={view.confidenceReason}
            />
            {phase === "full" && emailed && (
              <p style={{ fontSize: 13, color: BRAND.teal, textAlign: "center", margin: "-12px 0 24px" }}>
                A copy of this result is on its way to your inbox, with a saved link and a delete-my-data link.
              </p>
            )}

            <div style={{ borderTop: `1px solid ${BRAND.border}`, paddingTop: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
                <h3 style={{ ...h3Style, marginBottom: 0 }}>Dimension breakdown</h3>
                {phase !== "unlocking" && (
                  <button
                    type="button"
                    onClick={handleScoreAgain}
                    style={{ background: "none", border: "none", padding: 0, color: BRAND.teal, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-dm-sans), sans-serif" }}
                  >
                    Score again
                  </button>
                )}
              </div>
              {entry.dimensions.map((dim) => {
                const score = view.scores[dim.key] ?? 0;
                const level = dim.levels[score as 1 | 2 | 3 | 4 | 5] ?? "";
                const reasoning = full?.reasoning?.[dim.key];
                return (
                  <div key={dim.key}>
                    <GtmDimensionBar name={dim.name} score={score} levelLabel={level} locked={phase !== "full"} />
                    {phase === "full" && reasoning && (
                      <div style={{ marginTop: -8, marginBottom: 20, marginLeft: 2, padding: "10px 14px", background: BRAND.white, borderRadius: 6, borderLeft: `2px solid ${BRAND.teal}40` }}>
                        <p style={{ fontSize: 12, color: BRAND.mid, lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>{reasoning}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {(phase === "scored" || phase === "full") && (
              <p style={{ fontSize: 13, color: BRAND.mid, margin: "4px 0 0", lineHeight: 1.55 }}>
                Take this result into Built to Scale? and score all five dimensions.{" "}
                <Link href={`/tools/built-to-scale?from=${encodeURIComponent(view.runId)}`} style={{ color: BRAND.teal, fontWeight: 600, textDecoration: "none" }}>
                  Score the whole model
                </Link>
              </p>
            )}

            {phase === "scored" && (
              <div style={{ marginTop: 24, borderTop: `1px solid ${BRAND.border}`, paddingTop: 24 }}>
                <UnlockGate idPrefix={entry.slug} onSubmit={handleUnlock} />
              </div>
            )}

            {phase === "unlocking" && (
              <div style={{ marginTop: 24, borderTop: `1px solid ${BRAND.border}`, paddingTop: 24 }}>
                <CyclingLoader dark={false} messages={["Unlocking your report", "Writing the reasoning", "Drafting recommendations"]} />
              </div>
            )}

            {phase === "full" && full && (
              <>
                {entry.extras.length > 0 && (
                  <div style={{ marginTop: 28, borderTop: `1px solid ${BRAND.border}`, paddingTop: 24 }}>
                    {entry.extras.map((x) => {
                      const value = full.extras?.[x.key];
                      if (value === undefined || (Array.isArray(value) && value.length === 0) || value === "") return null;
                      return renderExtra(x.key, x.label, value);
                    })}
                  </div>
                )}

                <div style={{ marginTop: 28, borderTop: `1px solid ${BRAND.border}`, paddingTop: 24 }}>
                  <h3 style={h3Style}>Recommendations</h3>
                  {full.recommendations.length === 0 ? (
                    <p style={{ fontSize: 13, color: BRAND.mid, textAlign: "center", padding: "16px 0" }}>All dimensions scored 4 or above. No recommendations needed.</p>
                  ) : (
                    full.recommendations.map((rec, i) => (
                      <div key={i} style={{ background: BRAND.white, borderRadius: 8, padding: 20, marginBottom: 12, borderLeft: `3px solid ${rec.score <= 2 ? BRAND.red : BRAND.amber}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <span style={{ fontFamily: "var(--font-oswald), sans-serif", fontWeight: 600, fontSize: 14, color: BRAND.darkGreen }}>{rec.name}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 12, background: rec.score <= 2 ? "#FFEBEE" : "#FFF8E1", color: rec.score <= 2 ? BRAND.red : BRAND.amber }}>
                            {rec.score}/5
                          </span>
                        </div>
                        <p style={{ fontSize: 13, color: BRAND.dark, lineHeight: 1.55, margin: "0 0 8px" }}><strong>Gap:</strong> {rec.gap}</p>
                        <p style={{ fontSize: 13, color: BRAND.mid, lineHeight: 1.55, margin: "0 0 8px" }}><strong style={{ color: BRAND.dark }}>Consequence:</strong> {rec.consequence}</p>
                        <p style={{ fontSize: 13, color: BRAND.teal, lineHeight: 1.55, margin: 0 }}><strong>Next action:</strong> {rec.action}</p>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ marginTop: 32, background: BRAND.darkGreen, borderRadius: 10, padding: "28px 24px", textAlign: "center" }}>
                  <h3 style={{ fontFamily: "var(--font-oswald), sans-serif", fontSize: 18, fontWeight: 600, color: BRAND.white, margin: "0 0 8px" }}>{entry.cta.heading}</h3>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", margin: "0 0 18px" }}>{entry.cta.body}</p>
                  <a
                    href={BOOK_CALL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "inline-block", padding: "12px 32px", borderRadius: 6, background: BRAND.brandGreen, color: BRAND.white, fontFamily: "var(--font-oswald), sans-serif", fontWeight: 600, fontSize: 15, cursor: "pointer", letterSpacing: "0.03em", textDecoration: "none" }}
                  >
                    Book a Call
                  </a>
                </div>

                <p style={{ textAlign: "center", fontSize: 11, color: BRAND.mid, marginTop: 24, fontStyle: "italic" }}>
                  Evaluated using Summit Strategy Advisory&apos;s GTM Quality Framework for Constrained-Universe Enterprise Selling.
                </p>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
