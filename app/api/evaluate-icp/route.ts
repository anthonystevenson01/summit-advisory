import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getRedis } from "@/app/lib/redis";
import { getEvaluateLimiter, getClientIp } from "@/app/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIMENSION_KEYS = ["bca", "pa", "usp", "it", "cd", "nf", "fs"] as const;
const WEIGHTS: Record<string, number> = {
  bca: 0.25,
  pa: 0.18,
  usp: 0.15,
  it: 0.15,
  cd: 0.12,
  nf: 0.1,
  fs: 0.05,
};

type DimensionReasoning = {
  dim: string;
  score: number;
  reasoning: string;
};

type EvaluateResponse = {
  totalScore: number;
  scores: Record<string, number>;
  dimensionReasoning: DimensionReasoning[];
  recommendations: Array<{
    dim: string;
    score: number;
    gap: string;
    consequence: string;
    action: string;
  }>;
};

function extractParagraphText(para: Record<string, unknown>): string {
  const elements = para.elements as Array<Record<string, unknown>> | undefined;
  if (!elements) return "";
  const texts: string[] = [];
  for (const el of elements) {
    const tr = el.textRun as Record<string, unknown> | undefined;
    if (tr && typeof tr.content === "string") texts.push(tr.content);
  }
  return texts.join("");
}

function extractTextFromDocBody(content: unknown[]): string {
  const parts: string[] = [];
  for (const node of content) {
    if (!node || typeof node !== "object") continue;
    const n = node as Record<string, unknown>;

    // Paragraphs (including list items)
    if (n.paragraph) {
      const text = extractParagraphText(n.paragraph as Record<string, unknown>);
      if (text) parts.push(text);
    }

    // Tables
    if (n.table) {
      const table = n.table as Record<string, unknown>;
      const rows = table.tableRows as Array<Record<string, unknown>> | undefined;
      if (rows) {
        for (const row of rows) {
          const cells = row.tableCells as Array<Record<string, unknown>> | undefined;
          if (!cells) continue;
          const cellTexts: string[] = [];
          for (const cell of cells) {
            const cellContent = cell.content as unknown[] | undefined;
            if (cellContent) {
              for (const cellNode of cellContent) {
                if (!cellNode || typeof cellNode !== "object") continue;
                const cn = cellNode as Record<string, unknown>;
                if (cn.paragraph) {
                  const t = extractParagraphText(cn.paragraph as Record<string, unknown>);
                  if (t.trim()) cellTexts.push(t.trim());
                }
              }
            }
          }
          if (cellTexts.length) parts.push(cellTexts.join(" | ") + "\n");
        }
      }
    }
  }
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

async function fetchGoogleDoc(docId: string, apiKey: string): Promise<string> {
  const errors: string[] = [];

  // Method 1: Drive API alt=media (works for uploaded files like .docx shared publicly)
  try {
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(docId)}?alt=media&key=${encodeURIComponent(apiKey)}`;
    const driveRes = await fetch(driveUrl);
    if (driveRes.ok) {
      const text = (await driveRes.text()).trim();
      if (text) {
        console.log(`Google Doc ${docId}: downloaded ${text.length} chars via Drive alt=media`);
        return text;
      }
    } else {
      const t = await driveRes.text();
      errors.push(`Drive alt=media: ${driveRes.status} ${t.slice(0, 150)}`);
    }
  } catch (e) {
    errors.push(`Drive alt=media: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Method 2: Drive API export as text (works for native Google Docs)
  try {
    const exportUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(docId)}/export?mimeType=text/plain&key=${encodeURIComponent(apiKey)}`;
    const exportRes = await fetch(exportUrl);
    if (exportRes.ok) {
      const text = (await exportRes.text()).trim();
      if (text) {
        console.log(`Google Doc ${docId}: exported ${text.length} chars via Drive export`);
        return text;
      }
    } else {
      const t = await exportRes.text();
      errors.push(`Drive export: ${exportRes.status} ${t.slice(0, 150)}`);
    }
  } catch (e) {
    errors.push(`Drive export: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Method 3: Public Google Docs export URL (no API key, native docs only)
  try {
    const pubUrl = `https://docs.google.com/document/d/${encodeURIComponent(docId)}/export?format=txt`;
    const pubRes = await fetch(pubUrl, { redirect: "follow" });
    if (pubRes.ok) {
      const text = (await pubRes.text()).trim();
      if (text) {
        console.log(`Google Doc ${docId}: exported ${text.length} chars via public URL`);
        return text;
      }
    } else {
      const t = await pubRes.text();
      errors.push(`Public export: ${pubRes.status} ${t.slice(0, 150)}`);
    }
  } catch (e) {
    errors.push(`Public export: ${e instanceof Error ? e.message : String(e)}`);
  }

  throw new Error(`All fetch methods failed for doc ${docId}: ${errors.join(" | ")}`);
}

// In-memory rubric cache — survives across requests in the same serverless instance
let rubricCache: { prompt: string; rubricLoaded: boolean; rubricSource: string; debug?: Record<string, unknown>; cachedAt: number } | null = null;
const RUBRIC_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function loadSkillsFromDrive(): Promise<{ prompt: string; rubricLoaded: boolean; rubricSource: string; debug?: Record<string, unknown> }> {
  if (rubricCache && Date.now() - rubricCache.cachedAt < RUBRIC_CACHE_TTL) {
    return rubricCache;
  }
  const apiKey = process.env.GOOGLE_API_KEY;
  const skillId = process.env.SKILL_DOC_ID;
  const recId = process.env.RECOMMENDATIONS_DOC_ID;
  const debug: Record<string, unknown> = {
    hasApiKey: !!apiKey,
    apiKeyPrefix: apiKey ? apiKey.slice(0, 8) + "..." : null,
    skillId: skillId ?? null,
    recId: recId ?? null,
  };
  if (!apiKey || !skillId) {
    return {
      prompt: "Score the ICP on seven dimensions: bca (25%), pa (18%), usp (15%), it (15%), cd (12%), nf (10%), fs (5%). Each 1-5. Return JSON: { totalScore, scores: { bca, pa, usp, it, cd, nf, fs }, dimensionReasoning: [{ dim, score, reasoning }], recommendations: [{ dim, score, gap, consequence, action }] }.",
      rubricLoaded: false,
      rubricSource: apiKey ? "missing SKILL_DOC_ID" : "missing GOOGLE_API_KEY",
      debug,
    };
  }
  const parts: string[] = [];
  const sources: string[] = [];
  try {
    const skillText = await fetchGoogleDoc(skillId, apiKey);
    debug.skillDocChars = skillText.length;
    debug.skillDocPreview = skillText.slice(0, 100) || "(empty)";
    if (skillText) {
      parts.push(skillText);
      sources.push("skill_doc");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Failed to fetch SKILL_DOC_ID", e);
    sources.push("skill_doc_failed");
    debug.skillDocError = msg;
  }
  if (recId && apiKey) {
    try {
      const recText = await fetchGoogleDoc(recId, apiKey);
      debug.recDocChars = recText.length;
      debug.recDocPreview = recText.slice(0, 100) || "(empty)";
      if (recText) {
        parts.push("--- Recommendations rubric ---\n" + recText);
        sources.push("recommendations_doc");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Failed to fetch RECOMMENDATIONS_DOC_ID", e);
      sources.push("recommendations_doc_failed");
      debug.recDocError = msg;
    }
  }
  const combined = parts.filter(Boolean).join("\n\n---\n\n");
  if (!combined) {
    const result = {
      prompt: "Return JSON with totalScore (0-100), scores (bca, pa, usp, it, cd, nf, fs each 1-5), dimensionReasoning array with dim, score, reasoning, and recommendations array with dim, score, gap, consequence, action.",
      rubricLoaded: false,
      rubricSource: "docs_fetched_but_empty",
      debug,
    };
    // Don't cache failures
    return result;
  }
  const result = { prompt: combined, rubricLoaded: true, rubricSource: sources.join("+"), debug };
  rubricCache = { ...result, cachedAt: Date.now() };
  return result;
}

function parseJsonFromResponse(text: string): EvaluateResponse | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}") + 1;
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(trimmed.slice(start, end)) as EvaluateResponse;
    if (typeof parsed.totalScore !== "number" || typeof parsed.scores !== "object" || !Array.isArray(parsed.recommendations))
      return null;
    const scores: Record<string, number> = {};
    for (const k of DIMENSION_KEYS) {
      const v = parsed.scores[k];
      scores[k] = typeof v === "number" && v >= 1 && v <= 5 ? Math.round(v) : 3;
    }
    const dimensionReasoning: DimensionReasoning[] = Array.isArray(parsed.dimensionReasoning)
      ? parsed.dimensionReasoning.filter(
          (r: { dim?: string; score?: number; reasoning?: string }) =>
            r &&
            typeof r.dim === "string" &&
            typeof r.score === "number" &&
            typeof r.reasoning === "string"
        )
      : [];
    return {
      totalScore: Math.min(100, Math.max(0, Math.round(parsed.totalScore))),
      scores,
      dimensionReasoning,
      recommendations: parsed.recommendations.filter(
        (r: { dim?: string; score?: number; gap?: string; consequence?: string; action?: string }) =>
          r &&
          typeof r.dim === "string" &&
          typeof r.score === "number" &&
          typeof r.gap === "string" &&
          typeof r.consequence === "string" &&
          typeof r.action === "string"
      ),
    };
  } catch {
    return null;
  }
}

// Phase 1: Fast scores-only endpoint — uses Haiku for speed (~2-3s)
export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set." }, { status: 500 });
  }

  let body: { icpText?: string };
  try {
    body = (await req.json()) as { icpText?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const icpText = typeof body.icpText === "string" ? body.icpText.trim() : "";
  if (icpText.length < 50) {
    return NextResponse.json({ error: "ICP text must be at least 50 characters." }, { status: 400 });
  }
  if (icpText.length > 8000) {
    return NextResponse.json({ error: "ICP text must be under 8,000 characters. Please trim your submission." }, { status: 400 });
  }

  // Rate limiting — 5 evaluations per IP per hour
  const limiter = getEvaluateLimiter();
  if (limiter) {
    const ip = getClientIp(req);
    const { success, limit, remaining } = await limiter.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: `Too many evaluations. You've used ${limit} of ${limit} allowed per hour. Please try again later.` },
        { status: 429, headers: { "Retry-After": "3600", "X-RateLimit-Remaining": String(remaining) } }
      );
    }
  }

  try {
    // Start rubric fetch + Anthropic client init in parallel
    const rubricPromise = loadSkillsFromDrive().catch((e) => {
      console.error("Rubric fetch failed, proceeding without:", e);
      return { prompt: "", rubricLoaded: false, rubricSource: "fetch_error" } as const;
    });
    const anthropic = new Anthropic({ apiKey });

    // Wait for rubric, then fire the scoring call
    const rubric = await rubricPromise;

    // For Phase 1, only include scoring criteria from rubric (not recommendations)
    // to keep the prompt focused and output small
    let rubricScoring = "";
    if (rubric.rubricLoaded && rubric.prompt) {
      // Extract just the scoring section (before any recommendations rubric)
      const recSplit = rubric.prompt.indexOf("--- Recommendations rubric ---");
      rubricScoring = recSplit > 0 ? rubric.prompt.slice(0, recSplit).trim() : rubric.prompt.slice(0, 3000);
    }

    const scoringPrompt = `You are an expert at evaluating Ideal Customer Profiles for B2B enterprise sales.

Score the ICP across these 7 dimensions, each 1-5:
- bca: Buying Committee & Access Mapping (weight 25%)
- pa: Pain Articulation Depth (weight 18%)
- usp: Universe Sizing & Account Intelligence (weight 15%)
- it: Intent / Trigger Definition (weight 15%)
- cd: Competitive Displacement Awareness (weight 12%)
- nf: Negative Filters (weight 10%)
- fs: Firmographic Specificity (weight 5%)

Score accurately — a missing dimension should score 1, not 3. A vague mention scores 2. Specific detail scores 3-4. Comprehensive with evidence scores 5.

${rubricScoring ? `Use these scoring criteria:\n\n${rubricScoring}\n\n` : ""}Reply with ONLY this JSON format, nothing else: { "scores": { "bca": 2, "pa": 3, "usp": 1, "it": 2, "cd": 1, "nf": 3, "fs": 4 } }`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: scoringPrompt,
      messages: [{ role: "user", content: `Score this ICP. Return JSON only.\n\n---\n\n${icpText}` }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text : "";

    const trimmed = text.trim();

    // Try to parse full JSON first; if that fails, extract just the scores object
    let parsed: { scores?: Record<string, number> } | null = null;
    try {
      const start = trimmed.indexOf("{");
      const end = trimmed.lastIndexOf("}") + 1;
      if (start !== -1 && end > start) {
        parsed = JSON.parse(trimmed.slice(start, end)) as { scores?: Record<string, number> };
      }
    } catch {
      // Full parse failed — try to extract just {"scores": {...}} via regex
      const scoresMatch = trimmed.match(/"scores"\s*:\s*\{([^}]+)\}/);
      if (scoresMatch) {
        try {
          parsed = JSON.parse(`{"scores":{${scoresMatch[1]}}}`);
        } catch { /* give up */ }
      }
    }
    if (!parsed?.scores || typeof parsed.scores !== "object") {
      return NextResponse.json({ error: "Could not parse scoring response.", raw: trimmed.slice(0, 500) }, { status: 502 });
    }

    const scores: Record<string, number> = {};
    for (const k of DIMENSION_KEYS) {
      const v = parsed.scores[k];
      scores[k] = typeof v === "number" && v >= 1 && v <= 5 ? Math.round(v) : 3;
    }

    const weightedTotal =
      (DIMENSION_KEYS.reduce((sum, k) => sum + (scores[k] ?? 3) * (WEIGHTS[k] ?? 0), 0) / 5) * 100;
    const totalScore = Math.round(weightedTotal);

    // Persist scores to Redis; store ICP text for later details call (parallel)
    const submissionId = crypto.randomUUID();
    try {
      const redis = getRedis();
      const icpSlice = icpText.slice(0, 5000);
      await Promise.all([
        redis.rpush(
          "icp-submissions",
          JSON.stringify({
            id: submissionId,
            icpText: icpSlice,
            totalScore,
            scores,
            dimensionReasoning: [],
            recommendations: [],
            rubricLoaded: rubric.rubricLoaded,
            rubricSource: rubric.rubricSource,
            submittedAt: new Date().toISOString(),
          })
        ),
        redis.set(`icp-text:${submissionId}`, icpSlice, { ex: 21600 }), // 6h TTL
      ]);
    } catch (redisErr) {
      console.error("ICP submission: Redis persist failed", redisErr);
    }

    return NextResponse.json({ totalScore, scores, dimensionReasoning: [], recommendations: [], id: submissionId, rubricLoaded: rubric.rubricLoaded, rubricSource: rubric.rubricSource });
  } catch (err) {
    console.error("evaluate-icp error", err);
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack?.slice(0, 300) : undefined;
    return NextResponse.json({ error: "Evaluation failed.", debug: msg, stack }, { status: 500 });
  }
}
