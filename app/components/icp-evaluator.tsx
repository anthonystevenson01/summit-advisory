"use client";

import { useState, useEffect, useRef } from "react";

const BRAND = {
  darkGreen: "#053030",
  teal: "#005A66",
  brandGreen: "#319A65",
  lightBg: "#F0F7F4",
  white: "#FFFFFF",
  dark: "#1A1A1A",
  mid: "#666666",
  border: "#D0D5D2",
  red: "#C0392B",
  amber: "#D4A017",
  lightTeal: "#E6F2F4",
};

const DIMENSIONS = [
  { key: "bca", name: "Buying Committee & Access Mapping", weight: 0.25, abbr: "BCA" },
  { key: "pa", name: "Pain Articulation Depth", weight: 0.18, abbr: "PA" },
  { key: "usp", name: "Universe Sizing & Account Intelligence", weight: 0.15, abbr: "USP" },
  { key: "it", name: "Intent / Trigger Definition", weight: 0.15, abbr: "IT" },
  { key: "cd", name: "Competitive Displacement Awareness", weight: 0.12, abbr: "CD" },
  { key: "nf", name: "Negative Filters", weight: 0.1, abbr: "NF" },
  { key: "fs", name: "Firmographic Specificity", weight: 0.05, abbr: "FS" },
] as const;

const LEVELS: Record<number, string> = {
  1: "Absent",
  2: "Minimal",
  3: "Partial",
  4: "Strong",
  5: "Elite",
};

const LEVEL_LABELS: Record<string, Record<number, string>> = {
  bca: { 1: "Absent", 2: "Minimal", 3: "Partial", 4: "Strong", 5: "Elite" },
  pa: { 1: "Absent", 2: "Generic", 3: "Named", 4: "Quantified", 5: "Segmented" },
  usp: { 1: "Absent", 2: "Awareness", 3: "Listed", 4: "Prioritised", 5: "Operationalised" },
  it: { 1: "Absent", 2: "Vague", 3: "Generic", 4: "Specific", 5: "Operationalised" },
  cd: { 1: "Absent", 2: "Aware", 3: "Categorised", 4: "Mapped", 5: "Strategic" },
  nf: { 1: "Absent", 2: "Minimal", 3: "Partial", 4: "Structured", 5: "Validated" },
  fs: { 1: "Absent", 2: "Vague", 3: "Basic", 4: "Detailed", 5: "Comprehensive" },
};

function getGrade(score: number) {
  if (score >= 85) return { label: "Elite ICP", color: "#27ae60", desc: "Every account pursuit is deliberate and evidence-based." };
  if (score >= 70) return { label: "Strong ICP", color: "#2ecc71", desc: "Solid foundation with 1-2 dimensions to deepen before scaling outbound." };
  if (score >= 50) return { label: "Developing ICP", color: BRAND.amber, desc: "Good starting point with clear opportunities to strengthen before outreach." };
  if (score >= 30) return { label: "Early-Stage ICP", color: "#e67e22", desc: "The foundations are here — focus on the priority dimensions to build confidence in your targeting." };
  return { label: "Starting Point", color: BRAND.red, desc: "Significant gaps to address before enterprise outreach — the recommendations below will guide you." };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function ScoreGauge({ score, size = 180, animated = true }: { score: number; size?: number; animated?: boolean }) {
  const [displayScore, setDisplayScore] = useState(0);
  const grade = getGrade(score);

  useEffect(() => {
    if (!animated) {
      setDisplayScore(score);
      return;
    }
    const duration = 1800;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * score));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [score, animated]);

  const radius = size * 0.38;
  const circumference = 2 * Math.PI * radius * 0.75;
  const offset = circumference - (displayScore / 100) * circumference;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={size} height={size * 0.85} viewBox={`0 0 ${size} ${size * 0.85}`}>
        <path
          d={describeArc(size / 2, size * 0.5, radius, -225, 45)}
          fill="none"
          stroke="#E8ECE9"
          strokeWidth={size * 0.06}
          strokeLinecap="round"
        />
        <path
          d={describeArc(size / 2, size * 0.5, radius, -225, 45)}
          fill="none"
          stroke={grade.color}
          strokeWidth={size * 0.06}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.1s ease" }}
        />
        <text x={size / 2} y={size * 0.45} textAnchor="middle" style={{ fontSize: size * 0.22, fontFamily: "'Oswald', sans-serif", fontWeight: 700, fill: BRAND.darkGreen }}>
          {displayScore}
        </text>
        <text x={size / 2} y={size * 0.58} textAnchor="middle" style={{ fontSize: size * 0.07, fontFamily: "'DM Sans', sans-serif", fill: BRAND.mid, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          out of 100
        </text>
      </svg>
      <div style={{ marginTop: 4, padding: "6px 18px", borderRadius: 24, background: grade.color + "18", border: `1px solid ${grade.color}40` }}>
        <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 15, color: grade.color, letterSpacing: "0.03em" }}>{grade.label}</span>
      </div>
    </div>
  );
}

function DimensionBar({
  dim,
  score,
  locked,
}: {
  dim: (typeof DIMENSIONS)[number];
  score: number;
  locked: boolean;
}) {
  const [width, setWidth] = useState(0);
  const level = (LEVEL_LABELS[dim.key] as Record<number, string>)?.[score] ?? LEVELS[score];
  const pct = (score / 5) * 100;
  const barColor = score >= 4 ? BRAND.brandGreen : score === 3 ? BRAND.amber : BRAND.red;

  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 100);
    return () => clearTimeout(t);
  }, [pct]);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "baseline" }}>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: BRAND.darkGreen }}>{dim.name}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {!locked && (
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: BRAND.mid, textTransform: "uppercase", letterSpacing: "0.06em" }}>{level}</span>
          )}
          <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 600, color: locked ? BRAND.mid : BRAND.darkGreen }}>{locked ? "?" : `${score}/5`}</span>
        </div>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: "#E8ECE9", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            borderRadius: 4,
            background: locked ? BRAND.border : barColor,
            width: locked ? "40%" : `${width}%`,
            transition: "width 1.2s cubic-bezier(0.22, 1, 0.36, 1)",
            filter: locked ? "blur(4px)" : "none",
          }}
        />
      </div>
    </div>
  );
}

type EvaluationResult = {
  totalScore: number;
  scores: Record<string, number>;
  dimensionReasoning: Array<{ dim: string; score: number; reasoning: string }>;
  recommendations: Array<{ dim: string; score: number; gap: string; consequence: string; action: string }>;
  rubricLoaded: boolean;
  rubricSource: string;
};

export default function ICPEvaluator({ onBack, onBookCall }: { onBack: () => void; onBookCall: () => void }) {
  const [icpText, setIcpText] = useState("");
  const [isScoring, setIsScoring] = useState(false);
  const [scoreRevealed, setScoreRevealed] = useState(false);
  const [evalResult, setEvalResult] = useState<EvaluationResult | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [showCRM, setShowCRM] = useState(false);
  const [crmRequest, setCrmRequest] = useState("");
  const [crmSubmitted, setCrmSubmitted] = useState(false);
  const [crmSubmitting, setCrmSubmitting] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const charCount = icpText.length;
  const resultsRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const handleEvaluate = async () => {
    if (charCount < 50) return;
    setIsScoring(true);
    setEvalError(null);
    setEvalResult(null);
    try {
      const res = await fetch("/api/evaluate-icp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icpText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEvalError(data.error || "Evaluation failed. Please try again.");
        setScoreRevealed(true);
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        return;
      }
      setEvalResult(data as EvaluationResult);
      if (data.id) setSubmissionId(data.id as string);
      setScoreRevealed(true);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {
      setEvalError("Something went wrong. Please try again.");
      setScoreRevealed(true);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } finally {
      setIsScoring(false);
    }
  };

  const handleUnlock = async () => {
    if (!name || !email || !company || !evalResult) return;
    setUnlocked(true);
    setLoadingDetails(true);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);

    // Persist unlock data (fire-and-forget)
    fetch("/api/icp-unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: submissionId, name, email, company }),
    }).catch(() => {});

    // Fetch detailed reasoning + recommendations from Sonnet
    try {
      const res = await fetch("/api/evaluate-icp-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: submissionId, scores: evalResult.scores }),
      });
      if (res.ok) {
        const details = await res.json();
        setEvalResult((prev) =>
          prev
            ? {
                ...prev,
                dimensionReasoning: details.dimensionReasoning || [],
                recommendations: details.recommendations || [],
                rubricLoaded: details.rubricLoaded ?? prev.rubricLoaded,
                rubricSource: details.rubricLoaded ? "rubric_loaded" : prev.rubricSource,
              }
            : prev
        );
      }
    } catch {
      // Details failed — user still sees scores and dimension bars
    } finally {
      setLoadingDetails(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: BRAND.white, fontFamily: "'DM Sans', sans-serif" }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
        @media (max-width: 700px) { .icp-eval-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* Back button */}
      <div style={{ padding: "16px 32px 0", maxWidth: 1060, margin: "0 auto" }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "none",
            border: "none",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            fontWeight: 600,
            color: BRAND.teal,
            cursor: "pointer",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 7H2M6 3L2 7l4 4" />
          </svg>
          Resources
        </button>
      </div>

      {/* HERO */}
      <section style={{ background: `linear-gradient(135deg, ${BRAND.darkGreen} 0%, ${BRAND.teal} 100%)`, padding: "40px 32px 56px", textAlign: "center" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div
            style={{
              display: "inline-block",
              padding: "4px 14px",
              borderRadius: 20,
              background: "rgba(49,154,101,0.25)",
              border: "1px solid rgba(49,154,101,0.4)",
              marginBottom: 24,
            }}
          >
            <span style={{ color: BRAND.brandGreen, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Free Tool — Resources</span>
          </div>
          <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 46, fontWeight: 700, color: BRAND.white, lineHeight: 1.12, margin: "0 0 20px" }}>
            ICP Evaluator for Enterprise Scale-Ups
          </h1>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.85)", lineHeight: 1.65, margin: "0 0 24px" }}>
            Score your ICP across seven dimensions weighted for your situation. Find the gaps. Fix them before they cost you accounts you can&apos;t replace.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                const shareUrl = `${window.location.origin}?tool=icp-evaluator`;
                navigator.clipboard.writeText(shareUrl);
                setShareCopied(true);
                setTimeout(() => setShareCopied(false), 2000);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 18px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.3)",
                background: "rgba(255,255,255,0.1)",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
                fontWeight: 600,
                color: BRAND.white,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              {shareCopied ? "Link copied!" : "Copy link"}
            </button>
            {canNativeShare && (
              <button
                type="button"
                onClick={() => {
                  navigator.share({ title: "ICP Evaluator — Summit Strategy Advisory", url: `${window.location.origin}?tool=icp-evaluator` }).catch(() => {});
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 18px",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.3)",
                  background: "rgba(255,255,255,0.1)",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  color: BRAND.white,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                Share
              </button>
            )}
          </div>
        </div>
      </section>

      {/* INTRO NARRATIVE */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "48px 24px 16px" }}>
        <p style={{ fontSize: 15, color: BRAND.dark, lineHeight: 1.7, margin: "0 0 14px" }}>
          If you&apos;re a small team selling to enterprise, you already know the dynamics are different. But most ICP frameworks are built for companies with 10,000 accounts and an SDR army. Yours has maybe 150 accounts. Three things make selling in this world fundamentally different, and your ICP needs to address all of them.
        </p>
        <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, fontWeight: 600, color: BRAND.darkGreen, lineHeight: 1.3, margin: "28px 0 16px" }}>
          The Math Is Different When Every Account Is a Named Account
        </h2>
        <p style={{ fontSize: 15, color: BRAND.dark, lineHeight: 1.7, margin: "0 0 14px" }}>
          Your universe is finite. The challenge isn&apos;t finding accounts — it&apos;s choosing which 30 to pursue first, knowing how to get access, and making every touch count. When you burn an account — wrong person, wrong timing, wrong message — that account is closed to you for 12–18 months. There&apos;s no volume to hide behind. Your real competitor isn&apos;t the other vendor — it&apos;s &ldquo;do nothing.&rdquo; Enterprise organisations have enormous inertia, and most of your target accounts are defaulting to the status quo right now. Your ICP needs to distinguish between accounts that have an active reason to change and accounts that are sitting comfortably — because pursuing the comfortable ones with the same intensity burns your limited capacity on deals that will stall. And you carry a trust tax that incumbents don&apos;t. Every enterprise buyer evaluating a small vendor is doing a private risk calculation that has nothing to do with your product — and your ICP needs to account for which accounts have champions willing to take that bet.
        </p>
        <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, fontWeight: 600, color: BRAND.darkGreen, lineHeight: 1.3, margin: "28px 0 16px" }}>
          As Machines Run Playbooks, Inputs Matter a Lot More
        </h2>
        <p style={{ fontSize: 15, color: BRAND.dark, lineHeight: 1.7, margin: "0 0 14px" }}>
          This is why your ICP is an important document in your GTM stack. And it&apos;s becoming more critical, not less — sequencing tools, intent platforms, and agentic SDRs can reach more accounts faster than ever. But every one of those machines takes its direction from the same source. A weak ICP fed into a powerful automation stack just produces high-velocity waste aimed at the wrong accounts, with the wrong message, at the wrong time.
        </p>
        <p style={{ fontSize: 15, color: BRAND.dark, lineHeight: 1.7, margin: "0 0 14px" }}>
          This evaluator is built for these dynamics — and gives you specific, actionable recommendations for every gap it finds.
        </p>

        <div className="icp-eval-grid" style={{ margin: "28px 0 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={{ padding: "20px 24px", background: BRAND.lightBg, borderRadius: 10, border: `1px solid ${BRAND.border}` }}>
            <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 600, color: BRAND.teal, margin: "0 0 14px", letterSpacing: "0.04em", textTransform: "uppercase" }}>What we evaluate</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                "Buying Committee & Access Mapping",
                "Pain Articulation Depth",
                "Universe Sizing & Account Intelligence",
                "Intent / Trigger Definition",
                "Competitive Displacement Awareness",
                "Negative Filters",
                "Firmographic Specificity",
              ].map((name) => (
                <div key={name} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: BRAND.brandGreen, flexShrink: 0, marginTop: 4 }} />
                  <span style={{ fontSize: 13, color: BRAND.dark, lineHeight: 1.4 }}>{name}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: "20px 24px", background: BRAND.white, borderRadius: 10, border: `1px solid ${BRAND.border}` }}>
            <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 600, color: BRAND.teal, margin: "0 0 14px", letterSpacing: "0.04em", textTransform: "uppercase" }}>What the highest standard looks like</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { dim: "Buying Committee & Access", tip: "Full buying committee mapped with roles, influence levels, access paths, and internal champions identified per account." },
                { dim: "Pain Articulation", tip: "Pain quantified in business terms, segmented by persona, with evidence of how it manifests differently across account tiers." },
                { dim: "Universe Sizing", tip: "Named accounts ranked into pursuit tiers with intelligence standards defined for each tier." },
                { dim: "Intent & Triggers", tip: "Specific, observable triggers mapped to outreach timing — not just broad market trends." },
                { dim: "Competitive Displacement", tip: "Incumbent solutions mapped per account with displacement strategies and competitive positioning documented." },
                { dim: "Negative Filters", tip: "Validated exclusion criteria that protect your pipeline from accounts that look right but won't close." },
                { dim: "Firmographics", tip: "Precise firmographic boundaries that narrow without over-constraining your finite universe." },
              ].map((t) => (
                <div key={t.dim} style={{ fontSize: 12, color: BRAND.mid, lineHeight: 1.55 }}>
                  <span style={{ fontWeight: 600, color: BRAND.darkGreen }}>{t.dim}:</span> {t.tip}
                </div>
              ))}
            </div>
          </div>
        </div>

        <p style={{ fontSize: 15, color: BRAND.dark, lineHeight: 1.7, margin: "0 0 6px" }}>
          Paste your ICP below. Be as detailed as you can — the more you give us, the more specific the evaluation.
        </p>
      </section>

      {/* INPUT */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "8px 24px" }}>
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: BRAND.darkGreen, letterSpacing: "0.02em" }}>Your ICP Description</label>
        </div>
        <textarea
          value={icpText}
          onChange={(e) => setIcpText(e.target.value)}
          placeholder={`Paste your ICP description here. Include as much detail as you have:

• Who you target (industry, size, geography)
• What problems they face
• How they typically buy (roles, process)
• What you're displacing (competitor, internal process)
• Who you don't sell to
• How many target accounts exist`}
          style={{
            width: "100%",
            minHeight: 200,
            padding: 16,
            borderRadius: 8,
            border: `1px solid ${BRAND.border}`,
            fontSize: 14,
            fontFamily: "'DM Sans', sans-serif",
            color: BRAND.dark,
            lineHeight: 1.6,
            resize: "vertical",
            outline: "none",
            boxSizing: "border-box",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => (e.target.style.borderColor = BRAND.teal)}
          onBlur={(e) => (e.target.style.borderColor = BRAND.border)}
          disabled={scoreRevealed}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <span style={{ fontSize: 12, color: charCount < 50 ? BRAND.red : BRAND.mid }}>
            {charCount} / 10,000 characters {charCount < 50 && "(minimum 50)"}
          </span>
          {!scoreRevealed && (
            <button
              type="button"
              onClick={handleEvaluate}
              disabled={charCount < 50 || isScoring}
              style={{
                padding: "12px 28px",
                borderRadius: 6,
                border: "none",
                background: charCount < 50 ? BRAND.border : BRAND.brandGreen,
                color: BRAND.white,
                fontFamily: "'Oswald', sans-serif",
                fontWeight: 600,
                fontSize: 15,
                letterSpacing: "0.04em",
                cursor: charCount < 50 ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                opacity: isScoring ? 0.7 : 1,
              }}
            >
              {isScoring ? "Evaluating..." : "Evaluate My ICP"}
            </button>
          )}
        </div>

        {isScoring && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: BRAND.brandGreen,
                    animation: "pulse 1.2s ease-in-out infinite",
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </div>
            <p style={{ color: BRAND.teal, fontSize: 14, fontWeight: 500 }}>Scoring across 7 dimensions...</p>
          </div>
        )}
      </section>

      {/* RESULTS */}
      {scoreRevealed && (
        <section ref={resultsRef} style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 48px" }}>
          <div style={{ background: BRAND.lightBg, borderRadius: 12, padding: "32px 28px", border: `1px solid ${BRAND.border}` }}>
            {evalError ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <p style={{ fontSize: 15, color: BRAND.red, marginBottom: 16 }}>{evalError}</p>
                <button
                  type="button"
                  onClick={() => { setScoreRevealed(false); setEvalError(null); }}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 6,
                    border: `1px solid ${BRAND.teal}`,
                    background: BRAND.white,
                    color: BRAND.teal,
                    fontFamily: "'Oswald', sans-serif",
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Try again
                </button>
              </div>
            ) : evalResult ? (
              <>
                <div style={{ textAlign: "center", marginBottom: 28 }}>
                  <ScoreGauge score={evalResult.totalScore} size={200} />
                  <p style={{ fontSize: 14, color: BRAND.mid, marginTop: 12, lineHeight: 1.5, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>{getGrade(evalResult.totalScore).desc}</p>
                </div>

                {/* Only show rubric warning after details have loaded and rubric still wasn't available */}
                {unlocked && !loadingDetails && evalResult.dimensionReasoning.length > 0 && !evalResult.rubricLoaded && (
                  <div style={{ background: "#FFF8E1", border: `1px solid ${BRAND.amber}40`, borderRadius: 8, padding: "12px 16px", marginBottom: 20, display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 16, lineHeight: 1 }}>&#9888;</span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: BRAND.dark, margin: "0 0 4px" }}>Scoring rubric not loaded</p>
                      <p style={{ fontSize: 12, color: BRAND.mid, margin: 0, lineHeight: 1.5 }}>
                        The detailed scoring rubric from Google Docs could not be loaded. Scores were generated using a standard prompt.
                      </p>
                    </div>
                  </div>
                )}

                <div style={{ borderTop: `1px solid ${BRAND.border}`, paddingTop: 24 }}>
                  <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 600, color: BRAND.darkGreen, marginBottom: 16, marginTop: 0 }}>Dimension Breakdown</h3>
                  {DIMENSIONS.map((dim) => {
                    const reasoning = evalResult.dimensionReasoning?.find((r) => r.dim === dim.key);
                    return (
                      <div key={dim.key}>
                        <DimensionBar dim={dim} score={evalResult.scores[dim.key] ?? 0} locked={!unlocked} />
                        {unlocked && reasoning?.reasoning && (
                          <div style={{ marginTop: -8, marginBottom: 20, marginLeft: 2, padding: "10px 14px", background: BRAND.white, borderRadius: 6, borderLeft: `2px solid ${BRAND.teal}40` }}>
                            <p style={{ fontSize: 12, color: BRAND.mid, lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>
                              {reasoning.reasoning}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

            {!unlocked ? (
              <div ref={formRef} style={{ marginTop: 24, borderTop: `1px solid ${BRAND.border}`, paddingTop: 24 }}>
                <div style={{ background: BRAND.white, borderRadius: 8, padding: 24, border: `1px solid ${BRAND.teal}30` }}>
                  <div style={{ textAlign: "center", marginBottom: 20 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        background: `${BRAND.teal}15`,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 12,
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={BRAND.teal} strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                    </div>
                    <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 18, fontWeight: 600, color: BRAND.darkGreen, margin: "0 0 6px" }}>Unlock Your Full Report</h3>
                    <p style={{ fontSize: 13, color: BRAND.mid, margin: 0 }}>Get per-dimension scores, level labels, and specific recommendations for every weak area.</p>
                  </div>
                  {[
                    { label: "Name", value: name, set: setName, placeholder: "Your name" },
                    { label: "Email", value: email, set: setEmail, placeholder: "you@company.com" },
                    { label: "Company", value: company, set: setCompany, placeholder: "Your company" },
                  ].map((f) => (
                    <div key={f.label} style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: BRAND.darkGreen, display: "block", marginBottom: 4 }}>{f.label}</label>
                      <input
                        type={f.label === "Email" ? "email" : "text"}
                        value={f.value}
                        onChange={(e) => f.set(e.target.value)}
                        placeholder={f.placeholder}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 6,
                          border: `1px solid ${BRAND.border}`,
                          fontSize: 14,
                          fontFamily: "'DM Sans', sans-serif",
                          color: BRAND.dark,
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                        onFocus={(e) => (e.target.style.borderColor = BRAND.teal)}
                        onBlur={(e) => (e.target.style.borderColor = BRAND.border)}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleUnlock}
                    disabled={!name || !email || !company}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: 6,
                      border: "none",
                      background: !name || !email || !company ? BRAND.border : BRAND.brandGreen,
                      color: BRAND.white,
                      fontFamily: "'Oswald', sans-serif",
                      fontWeight: 600,
                      fontSize: 15,
                      letterSpacing: "0.04em",
                      marginTop: 8,
                      cursor: !name || !email || !company ? "not-allowed" : "pointer",
                    }}
                  >
                    Unlock Full Report
                  </button>
                  <p style={{ fontSize: 11, color: BRAND.mid, textAlign: "center", marginTop: 10, marginBottom: 0 }}>We respect your inbox. No spam. Unsubscribe anytime.</p>
                </div>
              </div>
            ) : (
              <>
                <div style={{ marginTop: 28, borderTop: `1px solid ${BRAND.border}`, paddingTop: 24 }}>
                  <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 600, color: BRAND.darkGreen, marginBottom: 16, marginTop: 0 }}>Recommendations</h3>
                  {loadingDetails ? (
                    <div style={{ textAlign: "center", padding: "32px 0" }}>
                      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 16 }}>
                        {[0, 1, 2].map((i) => (
                          <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: BRAND.teal, animation: "pulse 1.2s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />
                        ))}
                      </div>
                      <p style={{ color: BRAND.teal, fontSize: 13, fontWeight: 500, margin: 0 }}>Generating detailed analysis...</p>
                    </div>
                  ) : evalResult.recommendations.length === 0 ? (
                    <p style={{ fontSize: 13, color: BRAND.mid, textAlign: "center", padding: "16px 0" }}>All dimensions scored 4 or above — no recommendations needed.</p>
                  ) : evalResult.recommendations.map((rec, i) => (
                    <div
                      key={i}
                      style={{
                        background: BRAND.white,
                        borderRadius: 8,
                        padding: 20,
                        marginBottom: 12,
                        borderLeft: `3px solid ${rec.score <= 2 ? BRAND.red : BRAND.amber}`,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 14, color: BRAND.darkGreen }}>{rec.dim}</span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 10px",
                            borderRadius: 12,
                            background: rec.score <= 2 ? "#FFEBEE" : "#FFF8E1",
                            color: rec.score <= 2 ? BRAND.red : BRAND.amber,
                          }}
                        >
                          {rec.score}/5
                        </span>
                      </div>
                      <p style={{ fontSize: 13, color: BRAND.dark, lineHeight: 1.55, margin: "0 0 8px" }}>
                        <strong>Gap:</strong> {rec.gap}
                      </p>
                      <p style={{ fontSize: 13, color: BRAND.mid, lineHeight: 1.55, margin: "0 0 8px" }}>
                        <strong style={{ color: BRAND.dark }}>Consequence:</strong> {rec.consequence}
                      </p>
                      <p style={{ fontSize: 13, color: BRAND.teal, lineHeight: 1.55, margin: 0 }}>
                        <strong>Next action:</strong> {rec.action}
                      </p>
                    </div>
                  ))}
                </div>

                {!showCRM ? (
                  <div style={{ marginTop: 28, borderTop: `1px solid ${BRAND.border}`, paddingTop: 24, textAlign: "center" }}>
                    <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 18, fontWeight: 600, color: BRAND.darkGreen, margin: "0 0 8px" }}>Want to know if your ICP matches reality?</h3>
                    <p style={{ fontSize: 13, color: BRAND.mid, margin: "0 0 20px" }}>Connect your CRM for a one-time analysis comparing your stated ICP against actual deal data.</p>
                    <button
                      type="button"
                      onClick={() => setShowCRM(true)}
                      style={{
                        padding: "12px 28px",
                        borderRadius: 6,
                        border: `1px solid ${BRAND.teal}`,
                        background: BRAND.white,
                        color: BRAND.teal,
                        fontFamily: "'Oswald', sans-serif",
                        fontWeight: 600,
                        fontSize: 14,
                        cursor: "pointer",
                        letterSpacing: "0.03em",
                      }}
                    >
                      Unlock Tier 2: CRM Reality Check
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: 28, borderTop: `1px solid ${BRAND.border}`, paddingTop: 24 }}>
                    <div style={{ textAlign: "center", marginBottom: 24 }}>
                      <div style={{ display: "inline-block", padding: "6px 16px", borderRadius: 20, background: `${BRAND.amber}20`, border: `1px solid ${BRAND.amber}40`, marginBottom: 16 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: BRAND.amber, letterSpacing: "0.06em", textTransform: "uppercase" }}>Coming Soon</span>
                      </div>
                      <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 18, fontWeight: 600, color: BRAND.darkGreen, margin: "0 0 8px" }}>CRM Reality Check</h3>
                      <p style={{ fontSize: 13, color: BRAND.mid, margin: "0 0 20px", maxWidth: 500, marginLeft: "auto", marginRight: "auto", lineHeight: 1.6 }}>
                        We&apos;re building one-click CRM integrations to compare your stated ICP against your actual deal data. Planned integrations include:
                      </p>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
                      {[
                        { name: "HubSpot", color: "#FF7A59", icon: "H" },
                        { name: "Salesforce", color: "#00A1E0", icon: "SF" },
                        { name: "Twenty CRM", color: "#1A1A1A", icon: "20" },
                        { name: "Pipedrive", color: "#017737", icon: "P" },
                        { name: "Attio", color: "#5B5FC7", icon: "A" },
                        { name: "Close", color: "#5551FF", icon: "C" },
                      ].map((crm, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: BRAND.white, borderRadius: 8, border: `1px solid ${BRAND.border}` }}>
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: crm.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <span style={{ color: BRAND.white, fontWeight: 700, fontSize: 11 }}>{crm.icon}</span>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: BRAND.darkGreen }}>{crm.name}</span>
                        </div>
                      ))}
                    </div>

                    {crmSubmitted ? (
                      <div style={{ textAlign: "center", padding: "20px 0" }}>
                        <p style={{ fontSize: 14, color: BRAND.brandGreen, fontWeight: 600, margin: "0 0 4px" }}>Thanks for your input!</p>
                        <p style={{ fontSize: 12, color: BRAND.mid, margin: 0 }}>We&apos;ll notify you when CRM integrations launch.</p>
                      </div>
                    ) : (
                      <div style={{ background: BRAND.lightBg, borderRadius: 8, padding: 20, border: `1px solid ${BRAND.border}` }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: BRAND.darkGreen, display: "block", marginBottom: 6 }}>
                          Which CRM(s) would you like us to add?
                        </label>
                        <textarea
                          value={crmRequest}
                          onChange={(e) => setCrmRequest(e.target.value)}
                          placeholder="e.g. HubSpot, Salesforce — or tell us about a CRM not listed above"
                          style={{
                            width: "100%",
                            minHeight: 70,
                            padding: 12,
                            borderRadius: 6,
                            border: `1px solid ${BRAND.border}`,
                            fontSize: 13,
                            fontFamily: "'DM Sans', sans-serif",
                            color: BRAND.dark,
                            lineHeight: 1.5,
                            resize: "vertical",
                            outline: "none",
                            boxSizing: "border-box",
                          }}
                        />
                        <button
                          type="button"
                          disabled={crmSubmitting}
                          onClick={async () => {
                            setCrmSubmitting(true);
                            try {
                              await fetch("/api/crm-interest", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ email: email || "(not provided)", crms: crmRequest }),
                              });
                              setCrmSubmitted(true);
                            } catch {
                              // silent fail
                            } finally {
                              setCrmSubmitting(false);
                            }
                          }}
                          style={{
                            marginTop: 10,
                            padding: "10px 24px",
                            borderRadius: 6,
                            border: "none",
                            background: BRAND.brandGreen,
                            color: BRAND.white,
                            fontFamily: "'Oswald', sans-serif",
                            fontWeight: 600,
                            fontSize: 13,
                            cursor: crmSubmitting ? "not-allowed" : "pointer",
                            letterSpacing: "0.03em",
                            opacity: crmSubmitting ? 0.7 : 1,
                          }}
                        >
                          {crmSubmitting ? "Sending..." : "Submit Request"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: 32, background: BRAND.darkGreen, borderRadius: 10, padding: "28px 24px", textAlign: "center" }}>
                  <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 18, fontWeight: 600, color: BRAND.white, margin: "0 0 8px" }}>Need help building a better ICP?</h3>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", margin: "0 0 18px" }}>
                    Summit works alongside small teams selling to enterprise — refining targeting, building account strategies, and closing the gap between aspiration and pipeline reality.
                  </p>
                  <button
                    type="button"
                    onClick={onBookCall}
                    style={{
                      padding: "12px 32px",
                      borderRadius: 6,
                      border: "none",
                      background: BRAND.brandGreen,
                      color: BRAND.white,
                      fontFamily: "'Oswald', sans-serif",
                      fontWeight: 600,
                      fontSize: 15,
                      cursor: "pointer",
                      letterSpacing: "0.03em",
                    }}
                  >
                    Book a Call
                  </button>
                </div>

                <p style={{ textAlign: "center", fontSize: 11, color: BRAND.mid, marginTop: 24, fontStyle: "italic" }}>
                  Evaluated using Summit Strategy Advisory&apos;s ICP Quality Framework for Constrained-Universe Enterprise Selling.
                </p>
              </>
            )}
              </>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}
