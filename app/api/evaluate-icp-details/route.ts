import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getRedis } from "@/app/lib/redis";
import { getDetailsLimiter, getClientIp } from "@/app/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIMENSION_KEYS = ["bca", "pa", "usp", "it", "cd", "nf", "fs"] as const;

type DimensionReasoning = { dim: string; score: number; reasoning: string };
type Recommendation = { dim: string; score: number; gap: string; consequence: string; action: string };

// In-memory rubric cache (shared with evaluate-icp via module-level)
let rubricCache: { prompt: string; cachedAt: number } | null = null;
const RUBRIC_CACHE_TTL = 10 * 60 * 1000;

async function fetchGoogleDoc(docId: string, apiKey: string): Promise<string> {
  const errors: string[] = [];
  // Method 1: Drive API alt=media
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(docId)}?alt=media&key=${encodeURIComponent(apiKey)}`);
    if (res.ok) { const t = (await res.text()).trim(); if (t) return t; }
    else errors.push(`alt=media: ${res.status}`);
  } catch (e) { errors.push(`alt=media: ${e instanceof Error ? e.message : String(e)}`); }
  // Method 2: Drive export
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(docId)}/export?mimeType=text/plain&key=${encodeURIComponent(apiKey)}`);
    if (res.ok) { const t = (await res.text()).trim(); if (t) return t; }
    else errors.push(`export: ${res.status}`);
  } catch (e) { errors.push(`export: ${e instanceof Error ? e.message : String(e)}`); }
  // Method 3: Public URL
  try {
    const res = await fetch(`https://docs.google.com/document/d/${encodeURIComponent(docId)}/export?format=txt`, { redirect: "follow" });
    if (res.ok) { const t = (await res.text()).trim(); if (t) return t; }
    else errors.push(`public: ${res.status}`);
  } catch (e) { errors.push(`public: ${e instanceof Error ? e.message : String(e)}`); }
  throw new Error(`All methods failed: ${errors.join(" | ")}`);
}

async function loadRubric(): Promise<string> {
  if (rubricCache && Date.now() - rubricCache.cachedAt < RUBRIC_CACHE_TTL) {
    return rubricCache.prompt;
  }
  const apiKey = process.env.GOOGLE_API_KEY;
  const skillId = process.env.SKILL_DOC_ID;
  const recId = process.env.RECOMMENDATIONS_DOC_ID;
  if (!apiKey || !skillId) return "";
  const parts: string[] = [];
  try { parts.push(await fetchGoogleDoc(skillId, apiKey)); } catch { /* skip */ }
  if (recId) {
    try { parts.push("--- Recommendations rubric ---\n" + await fetchGoogleDoc(recId, apiKey)); } catch { /* skip */ }
  }
  const combined = parts.filter(Boolean).join("\n\n---\n\n");
  if (combined) rubricCache = { prompt: combined, cachedAt: Date.now() };
  return combined;
}

// Phase 2: Detailed reasoning + recommendations — uses Sonnet for quality
export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set." }, { status: 500 });
  }

  let body: { id?: string; scores?: Record<string, number> };
  try {
    body = (await req.json()) as { id?: string; scores?: Record<string, number> };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const submissionId = body.id;
  const scores = body.scores;
  if (!submissionId || !scores) {
    return NextResponse.json({ error: "id and scores are required." }, { status: 400 });
  }

  // Rate limiting — 10 unlocks per IP per hour
  const limiter = getDetailsLimiter();
  if (limiter) {
    const ip = getClientIp(req);
    const { success } = await limiter.limit(ip);
    if (!success) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }
  }

  // Retrieve ICP text + rubric in parallel
  const redis = getRedis();
  const [icpText, rubricPrompt] = await Promise.all([
    redis.get(`icp-text:${submissionId}`),
    loadRubric(),
  ]);
  if (!icpText || typeof icpText !== "string") {
    return NextResponse.json({ error: "ICP text not found. It may have expired." }, { status: 404 });
  }

  const systemPrompt = `You are an expert at evaluating Ideal Customer Profiles for B2B enterprise sales. Reply with only valid JSON, no markdown or extra text.

The ICP has already been scored. Your job is to provide detailed reasoning and recommendations for each dimension.

The scores are: ${JSON.stringify(scores)}

Provide your response as JSON with two arrays:

1. "dimensionReasoning" — an entry for EACH of the 7 dimensions (bca, pa, usp, it, cd, nf, fs):
- "dim": the dimension key
- "score": the pre-assigned score
- "reasoning": 2-3 sentences explaining what evidence you found (or didn't find) in the ICP text. Quote specific phrases where possible.

2. "recommendations" — an entry for EACH dimension scoring 3 or below:
- "dim": the full dimension name (e.g. "Buying Committee & Access Mapping")
- "score": the score
- "gap": 1-2 sentences describing the specific gap — reference concrete details from the input
- "consequence": 1 sentence on what this gap means for enterprise outreach
- "action": 1 concrete next step tailored to their industry/market

TONE: Constructive and advisory. Focus on what to improve and how. Avoid harsh language like "fails to", "weak", "poor". Frame gaps as opportunities.

${rubricPrompt}`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: `Provide detailed reasoning and recommendations for this ICP.\n\n---\n\n${icpText}` }],
    });
    const message = await stream.finalMessage();

    const textBlock = message.content.find((b) => b.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text : "";

    const trimmed = text.trim();
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}") + 1;
    if (start === -1 || end <= start) {
      return NextResponse.json({ error: "Could not parse details response." }, { status: 502 });
    }

    const parsed = JSON.parse(trimmed.slice(start, end)) as {
      dimensionReasoning?: DimensionReasoning[];
      recommendations?: Recommendation[];
    };

    const dimensionReasoning: DimensionReasoning[] = Array.isArray(parsed.dimensionReasoning)
      ? parsed.dimensionReasoning.filter(
          (r) => r && typeof r.dim === "string" && typeof r.score === "number" && typeof r.reasoning === "string"
        )
      : [];

    const recommendations: Recommendation[] = Array.isArray(parsed.recommendations)
      ? parsed.recommendations.filter(
          (r) =>
            r &&
            typeof r.dim === "string" &&
            typeof r.score === "number" &&
            typeof r.gap === "string" &&
            typeof r.consequence === "string" &&
            typeof r.action === "string"
        )
      : [];

    // Store details separately by submission ID (fast, no list scan)
    try {
      await redis.set(
        `icp-details:${submissionId}`,
        JSON.stringify({ dimensionReasoning, recommendations, rubricLoaded: !!rubricPrompt }),
        { ex: 86400 }
      );
    } catch (redisErr) {
      console.error("ICP details: Redis persist failed", redisErr);
    }

    return NextResponse.json({ dimensionReasoning, recommendations, rubricLoaded: !!rubricPrompt });
  } catch (err) {
    console.error("evaluate-icp-details error", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Details generation failed.", debug: msg }, { status: 500 });
  }
}
