import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getRedis } from "@/app/lib/redis";
import { getDetailsLimiter, getClientIp } from "@/app/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOOL = "positioning";

const DIM_NAMES: Record<string, string> = {
  di: "Differentiation",
  sp: "Specificity",
  mf: "Market Fit",
  cl: "Clarity",
  cr: "Credibility",
  er: "Emotional Resonance",
};

type DimensionReasoning = { dim: string; score: number; reasoning: string };
type Recommendation = { dim: string; score: number; gap: string; consequence: string; action: string };

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set." }, { status: 500 });
  }

  let body: { id?: string; scores?: Record<string, number>; rubric?: string };
  try {
    body = (await req.json()) as { id?: string; scores?: Record<string, number>; rubric?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const submissionId = body.id;
  const scores = body.scores;
  const rubric = typeof body.rubric === "string" ? body.rubric : "";

  if (!submissionId || !scores) {
    return NextResponse.json({ error: "id and scores are required." }, { status: 400 });
  }

  const redis = getRedis();

  // Read-through cache: if we've already paid for this analysis, serve it for free.
  // Checked BEFORE rate limit so refreshes (back button, share link reopen) don't burn the user's hourly quota.
  try {
    const cached = await redis.get(`gtm-details:${TOOL}:${submissionId}`);
    if (cached) {
      const parsed = typeof cached === "string" ? JSON.parse(cached) : cached;
      return NextResponse.json(parsed);
    }
  } catch {
    // fall through to regenerate
  }

  const limiter = getDetailsLimiter();
  if (limiter) {
    const ip = getClientIp(req);
    const { success } = await limiter.limit(`${ip}:${TOOL}-details`);
    if (!success) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }
  }

  const inputText = await redis.get(`gtm-text:${submissionId}`);
  if (!inputText || typeof inputText !== "string") {
    return NextResponse.json({ error: "Input text not found. It may have expired." }, { status: 404 });
  }

  const dimKeys = Object.keys(DIM_NAMES).join(", ");
  const systemPrompt = `You are a B2B positioning expert. Reply with only valid JSON, no markdown or extra text.

The positioning has already been scored. Provide detailed reasoning and recommendations.

The scores are: ${JSON.stringify(scores)}

Provide your response as JSON with two arrays:

1. "dimensionReasoning" — an entry for EACH of the ${Object.keys(DIM_NAMES).length} dimensions (${dimKeys}):
- "dim": the dimension key
- "score": the pre-assigned score
- "reasoning": 2-3 sentences explaining what evidence you found (or didn't find) in the positioning. Quote specific phrases where possible.

2. "recommendations" — an entry for EACH dimension scoring 3 or below:
- "dim": the full dimension name (e.g. "${Object.values(DIM_NAMES)[0]}")
- "score": the score
- "gap": 1-2 sentences describing the specific gap — reference concrete details from the input
- "consequence": 1 sentence on what this gap means for enterprise selling
- "action": 1 concrete next step tailored to their market

TONE: Constructive and advisory. Focus on what to improve and how.

${rubric ? rubric : ""}`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: `Provide detailed reasoning and recommendations for this positioning statement.\n\n---\n\n${inputText}` }],
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

    // Cache the result so refreshes don't re-run Sonnet. 24h TTL matches icp-details.
    try {
      await redis.set(
        `gtm-details:${TOOL}:${submissionId}`,
        JSON.stringify({ dimensionReasoning, recommendations }),
        { ex: 86400 }
      );
    } catch {
      // non-fatal — response still goes out
    }

    return NextResponse.json({ dimensionReasoning, recommendations });
  } catch (err) {
    console.error(`${TOOL} details error`, err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Details generation failed.", debug: msg }, { status: 500 });
  }
}
