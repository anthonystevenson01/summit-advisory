"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BRAND } from "@/app/lib/brand";
import { PUBLIC_TOOLS, getTool } from "@/app/lib/tools/registry";
import {
  AUTOMATED_LABEL,
  BTS_PARTS,
  BUILT_TO_SCALE_TOOL,
  PART_MAX,
  PART_MIN,
  QUICK_BOX,
  expandPartsFromInputs,
  type BtsPartKey,
  type CompositeFreeView,
  type CompositeFullView,
  type CompositeRow,
} from "@/app/lib/tools/built-to-scale-method";
import CyclingLoader from "./shared/CyclingLoader";
import ErrMsg from "./shared/ErrMsg";
import ToolShareButtons from "./shared/ToolShareButtons";
import UnlockGate from "./shared/UnlockGate";
import PrefillLoader, { type PrefillPayload } from "./shared/PrefillLoader";
import Scorecard from "./scorecard/Scorecard";
import ScorecardWorking from "./scorecard/ScorecardWorking";

type Phase = "input" | "scoring" | "scored" | "unlocking" | "full" | "error";
type Mode = "five" | "quick";

type FreeResponse = CompositeFreeView & { unlocked?: boolean };
type FullResponse = CompositeFullView & { emailed?: boolean };

const UPDATING_MESSAGE = "This tool is being updated. Please try again in a few minutes.";
const GENERIC_MESSAGE = "Something went wrong. Please try again.";

const CONDENSED = "var(--font-barlow-condensed), sans-serif";
const SANS = "var(--font-dm-sans), sans-serif";

const fieldStyle = {
  width: "100%",
  padding: 16,
  borderRadius: 8,
  border: `1px solid ${BRAND.border}`,
  fontSize: 14,
  lineHeight: 1.6,
  fontFamily: SANS,
  color: BRAND.dark,
  background: BRAND.white,
  outline: "none",
  boxSizing: "border-box" as const,
  minHeight: 140,
  resize: "vertical" as const,
  transition: "border-color 0.2s",
};

const labelStyle = {
  fontSize: 14,
  fontWeight: 600 as const,
  color: BRAND.darkGreen,
  display: "block",
  marginBottom: 4,
  letterSpacing: "0.02em",
};

function emptyParts(): Record<BtsPartKey, string> {
  const parts = {} as Record<BtsPartKey, string>;
  for (const p of BTS_PARTS) parts[p.key] = "";
  return parts;
}

function lengthOk(value: string): boolean {
  const n = value.trim().length;
  return n >= PART_MIN && n <= PART_MAX;
}

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

function Counter({ value }: { value: string }) {
  const n = value.length;
  const colour = n > 0 && n < PART_MIN ? BRAND.red : n > 1800 ? BRAND.amber : BRAND.mid;
  return (
    <span style={{ fontSize: 12, color: colour }}>
      {n.toLocaleString("en-GB")} / {PART_MAX.toLocaleString("en-GB")}
      {n > 0 && n < PART_MIN ? ` (minimum ${PART_MIN})` : ""}
    </span>
  );
}

/**
 * The Built to Scale? page: the five-part form or the quick single box, the
 * loader, the dark scorecard, the unlock gate and the full view with the
 * working per row. Talks to /api/built-to-scale/score, /api/tools/built-to-scale/unlock
 * and /api/built-to-scale/details. Events are server side; the page sends none.
 */
export default function BuiltToScalePage() {
  const [phase, setPhase] = useState<Phase>("input");
  const [mode, setMode] = useState<Mode>("five");
  const [parts, setParts] = useState<Record<BtsPartKey, string>>(emptyParts);
  const [description, setDescription] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [free, setFree] = useState<FreeResponse | null>(null);
  const [full, setFull] = useState<FullResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorReturn, setErrorReturn] = useState<Phase>("input");
  const [emailed, setEmailed] = useState(false);
  const [prefilledFrom, setPrefilledFrom] = useState<{ tool: string; name: string } | null>(null);
  const resultsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (phase === "scored" || phase === "full") {
      const t = setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const inputsLocked = phase !== "input" && phase !== "error";
  const resultVisible = phase === "scored" || phase === "unlocking" || phase === "full";
  const formValid = mode === "five" ? BTS_PARTS.every((p) => lengthOk(parts[p.key])) : lengthOk(description);

  const fail = (message: string, returnTo: Phase) => {
    setError(message);
    setErrorReturn(returnTo);
    setPhase("error");
  };

  const requestDetails = async (runId: string, returnTo: Phase) => {
    try {
      const res = await fetch("/api/built-to-scale/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });
      if (!res.ok) {
        if (res.status === 403) {
          setPhase(returnTo);
          return;
        }
        fail(await readError(res), returnTo);
        return;
      }
      const data = (await res.json()) as FullResponse;
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
      const body = mode === "five" ? { parts, website: honeypot } : { description, website: honeypot };
      const res = await fetch("/api/built-to-scale/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        fail(await readError(res), "input");
        return;
      }
      const data = (await res.json()) as Partial<FreeResponse>;
      if (!data.runId || typeof data.total !== "number" || !Array.isArray(data.rows)) {
        fail(GENERIC_MESSAGE, "input");
        return;
      }
      setFree(data as FreeResponse);
      if (data.unlocked) {
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
      const res = await fetch(`/api/tools/${BUILT_TO_SCALE_TOOL}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: free.runId, name, email, company, website: honeypot }),
      });
      if (!res.ok) {
        fail(await readError(res), "scored");
        return;
      }
    } catch {
      fail(GENERIC_MESSAGE, "scored");
      return;
    }
    await requestDetails(free.runId, "scored");
  };

  const handleScoreAgain = () => {
    setFree(null);
    setFull(null);
    setError(null);
    setEmailed(false);
    setPhase("input");
  };

  const handlePrefill = useCallback((payload: PrefillPayload) => {
    const entry = getTool(payload.tool);
    if (!entry) return;
    const expanded = expandPartsFromInputs(entry, payload.inputs);
    setParts((prev) => {
      const next = { ...prev };
      for (const p of BTS_PARTS) if (expanded[p.key]) next[p.key] = expanded[p.key];
      return next;
    });
    setMode("five");
    setPrefilledFrom({ tool: entry.slug, name: entry.name });
  }, []);

  const setPart = (key: BtsPartKey, value: string) => {
    setParts((prev) => ({ ...prev, [key]: value.slice(0, PART_MAX) }));
  };

  const view = full ?? free;
  const runId = view?.runId ?? "";
  const resultPath = runId ? `/tools/built-to-scale/r/${runId}` : "/tools/built-to-scale";

  const toggleStyle = (active: boolean) => ({
    padding: "10px 18px",
    borderRadius: 6,
    border: `1px solid ${active ? BRAND.brandGreen : BRAND.border}`,
    background: active ? BRAND.brandGreen : BRAND.white,
    color: active ? BRAND.white : BRAND.darkGreen,
    fontFamily: CONDENSED,
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: "0.04em",
    cursor: inputsLocked ? "not-allowed" : "pointer",
  });

  return (
    <div style={{ minHeight: "100vh", background: BRAND.white, fontFamily: SANS }}>
      <Suspense fallback={null}>
        <PrefillLoader param="from" via="tool" onLoaded={handlePrefill} />
      </Suspense>

      {/* HERO */}
      <section style={{ background: `linear-gradient(135deg, ${BRAND.darkGreen} 0%, ${BRAND.teal} 100%)`, padding: "40px 24px 48px", textAlign: "center" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 20, background: "rgba(49,154,101,0.25)", border: "1px solid rgba(49,154,101,0.4)", marginBottom: 20 }}>
            <span style={{ color: BRAND.brandGreen, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Summit GTM Toolkit</span>
          </div>
          <h1 style={{ fontFamily: CONDENSED, fontSize: 46, fontWeight: 700, color: BRAND.white, lineHeight: 1.1, margin: "0 0 16px" }}>Built to Scale?</h1>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.85)", lineHeight: 1.65, margin: "0 0 14px" }}>
            One form, five dimensions, a score out of 25 for how well your business model can scale.
          </p>
          <Link href="/tools/built-to-scale/method" style={{ color: BRAND.brandGreen, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
            How this is scored
          </Link>
        </div>
      </section>

      {/* AUTOMATED LABEL */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px 0" }}>
        <div style={{ padding: "16px 20px", background: BRAND.lightBg, borderRadius: 10, border: `1px solid ${BRAND.border}` }}>
          <p style={{ fontSize: 13, color: BRAND.mid, lineHeight: 1.65, margin: 0 }}>{AUTOMATED_LABEL}</p>
        </div>
      </section>

      {/* FORM */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "24px 24px 8px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <button type="button" onClick={() => !inputsLocked && setMode("five")} disabled={inputsLocked} style={toggleStyle(mode === "five")} aria-pressed={mode === "five"}>
            Five parts
          </button>
          <button type="button" onClick={() => !inputsLocked && setMode("quick")} disabled={inputsLocked} style={toggleStyle(mode === "quick")} aria-pressed={mode === "quick"}>
            Quick check
          </button>
        </div>

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

        {prefilledFrom && mode === "five" && (
          <p style={{ fontSize: 13, color: BRAND.teal, margin: "0 0 16px", lineHeight: 1.5 }}>
            Your {prefilledFrom.name} answers are in the parts they feed. Fill the rest and score the whole model.
          </p>
        )}

        {mode === "five" ? (
          <div className="bts-form-grid">
            {BTS_PARTS.map((part) => {
              const value = parts[part.key];
              return (
                <div key={part.key}>
                  <label htmlFor={`bts-${part.key}`} style={labelStyle}>
                    {part.label} <span style={{ color: BRAND.red }}>*</span>
                  </label>
                  <p style={{ fontSize: 12, color: BRAND.mid, margin: "0 0 8px", lineHeight: 1.5 }}>{part.prompt}</p>
                  <textarea
                    id={`bts-${part.key}`}
                    value={value}
                    onChange={(e) => setPart(part.key, e.target.value)}
                    disabled={inputsLocked}
                    style={fieldStyle}
                    onFocus={(e) => (e.target.style.borderColor = BRAND.teal)}
                    onBlur={(e) => (e.target.style.borderColor = BRAND.border)}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                    {!inputsLocked ? (
                      <button
                        type="button"
                        onClick={() => setPart(part.key, part.example)}
                        style={{ background: "none", border: "none", padding: 0, color: BRAND.teal, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: SANS }}
                      >
                        Show an example
                      </button>
                    ) : (
                      <span />
                    )}
                    <Counter value={value} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            <label htmlFor="bts-description" style={labelStyle}>
              {QUICK_BOX.label} <span style={{ color: BRAND.red }}>*</span>
            </label>
            <p style={{ fontSize: 12, color: BRAND.mid, margin: "0 0 8px", lineHeight: 1.5 }}>{QUICK_BOX.prompt}</p>
            <textarea
              id="bts-description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, PART_MAX))}
              disabled={inputsLocked}
              style={{ ...fieldStyle, minHeight: 220 }}
              onFocus={(e) => (e.target.style.borderColor = BRAND.teal)}
              onBlur={(e) => (e.target.style.borderColor = BRAND.border)}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              {!inputsLocked ? (
                <button
                  type="button"
                  onClick={() => setDescription(QUICK_BOX.example)}
                  style={{ background: "none", border: "none", padding: 0, color: BRAND.teal, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: SANS }}
                >
                  Show an example
                </button>
              ) : (
                <span />
              )}
              <Counter value={description} />
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
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
                fontFamily: CONDENSED,
                fontWeight: 700,
                fontSize: 16,
                letterSpacing: "0.04em",
                cursor: formValid ? "pointer" : "not-allowed",
                transition: "all 0.2s",
              }}
            >
              Score my model
            </button>
          )}
        </div>

        {phase === "scoring" && (
          <div style={{ padding: "32px 0" }}>
            <CyclingLoader dark={false} messages={[`Scoring ${PUBLIC_TOOLS.length} tools`, "Reading the results together", "Writing the scorecard"]} />
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

      {/* RESULT */}
      {resultVisible && view && (
        <section ref={resultsRef} style={{ maxWidth: 960, margin: "0 auto", padding: "24px 24px 48px" }}>
          <div style={{ background: BRAND.darkGreen, borderRadius: 12 }}>
            <Scorecard view={view} renderWorking={full ? (row: CompositeRow) => <ScorecardWorking row={row} parentRunId={runId} /> : undefined} />
            <div style={{ padding: "0 28px 20px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <ToolShareButtons slug={BUILT_TO_SCALE_TOOL} path={resultPath} title="Built to Scale? scorecard: Summit Strategy Advisory" align="start" />
              {phase !== "unlocking" && (
                <button
                  type="button"
                  onClick={handleScoreAgain}
                  style={{ background: "none", border: "none", padding: 0, color: BRAND.brandGreen, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: SANS, marginTop: 24 }}
                >
                  Score again
                </button>
              )}
            </div>
          </div>

          {phase === "full" && emailed && (
            <p style={{ fontSize: 13, color: BRAND.teal, textAlign: "center", margin: "16px 0 0" }}>
              A copy of this result is on its way to your inbox, with a saved link and a delete-my-data link.
            </p>
          )}

          {phase === "scored" && (
            <div style={{ marginTop: 24 }}>
              <UnlockGate idPrefix={BUILT_TO_SCALE_TOOL} onSubmit={handleUnlock} />
            </div>
          )}

          {phase === "unlocking" && (
            <div style={{ marginTop: 24, padding: "24px 0" }}>
              <CyclingLoader dark={false} messages={["Unlocking the scorecard", "Writing the working for each tool", "Sending your copy"]} />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
