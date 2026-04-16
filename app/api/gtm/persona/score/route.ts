import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getRedis } from "@/app/lib/redis";
import { getEvaluateLimiter, getClientIp } from "@/app/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOOL = "persona";

const DIMS = [
  { key: "pc", name: "Pain Clarity", weight: 0.25 },
  { key: "da", name: "Decision Authority", weight: 0.20 },
  { key: "sp", name: "Specificity", weight: 0.18 },
  { key: "re", name: "Reachability", weight: 0.15 },
  { key: "jf", name: "Job-to-be-Done Fit", weight: 0.12 },
  { key: "fm", name: "Finite Market Alignment", weight: 0.10 },
] as const;

type DimKey = (typeof DIMS)[number]["key"];

function calcScore(scores: Record<string, number>): number {
  const weighted = DIMS.reduce((sum, d) => sum + (scores[d.key] ?? 3) * d.weight, 0);
  return Math.round((weighted / 5) * 100);
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set." }, { status: 500 });
  }

  let body: { inputText?: string; rubric?: string };
  try {
    body = (await req.json()) as { inputText?: string; rubric?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const inputText = typeof body.inputText === "string" ? body.inputText.trim() : "";
  if (inputText.length < 50) {
    return NextResponse.json({ error: "Input text must be at least 50 characters." }, { status: 400 });
  }
  if (inputText.length > 6000) {
    return NextResponse.json({ error: "Input text must be under 6,000 characters." }, { status: 400 });
  }
  const rubric = typeof body.rubric === "string" ? body.rubric : "";

  const limiter = getEvaluateLimiter();
  if (limiter) {
    const ip = getClientIp(req);
    const { success, limit, remaining } = await limiter.limit(`${ip}:${TOOL}-score`);
    if (!success) {
      return NextResponse.json(
        { error: `Too many evaluations. You've used ${limit} of ${limit} allowed per hour. Please try again later.` },
        { status: 429, headers: { "Retry-After": "3600", "X-RateLimit-Remaining": String(remaining) } }
      );
    }
  }

  const dimLines = DIMS.map(
    (d) => `- ${d.key}: ${d.name} (weight ${Math.round(d.weight * 100)}%)`
  ).join("\n");

  const scoringPrompt = `You are a B2B buyer persona expert evaluating persona definitions for enterprise sales into finite markets.

Score the persona across these ${DIMS.length} dimensions, each 1–5:
${dimLines}

Scoring guide: 1 = absent/missing, 2 = vague/minimal, 3 = partial/named, 4 = solid/specific, 5 = exceptional/evidenced.
Score accurately — missing elements should score 1, not 3. Vague mentions score 2. Be strict.

${rubric ? `Use these scoring criteria:\n\n${rubric}\n\n` : ""}Reply with ONLY this JSON format, nothing else: { "scores": { "pc": 2, "da": 3, "sp": 1, "re": 2, "jf": 1, "fm": 3 } }`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: scoringPrompt,
      messages: [{ role: "user", content: `Score this persona. Return JSON only.\n\n---\n\n${inputText}` }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text : "";
    const trimmed = text.trim();

    let parsed: { scores?: Record<string, number> } | null = null;
    try {
      const start = trimmed.indexOf("{");
      const end = trimmed.lastIndexOf("}") + 1;
      if (start !== -1 && end > start) {
        parsed = JSON.parse(trimmed.slice(start, end)) as { scores?: Record<string, number> };
      }
    } catch {
      const scoresMatch = trimmed.match(/"scores"\s*:\s*\{([^}]+)\}/);
      if (scoresMatch) {
        try { parsed = JSON.parse(`{"scores":{${scoresMatch[1]}}}`); } catch { /* give up */ }
      }
    }

    if (!parsed?.scores || typeof parsed.scores !== "object") {
      return NextResponse.json({ error: "Could not parse scoring response.", raw: trimmed.slice(0, 500) }, { status: 502 });
    }

    const scores: Record<string, number> = {};
    for (const d of DIMS) {
      const v = parsed.scores[d.key as DimKey];
      scores[d.key] = typeof v === "number" && v >= 1 && v <= 5 ? Math.round(v) : 3;
    }

    const totalScore = calcScore(scores);
    const submissionId = crypto.randomUUID();

    try {
      const redis = getRedis();
      const inputSlice = inputText.slice(0, 5000);
      await Promise.all([
        redis.rpush("gtm-submissions", JSON.stringify({
          id: submissionId,
          tool: TOOL,
          inputText: inputSlice,
          totalScore,
          scores,
          submittedAt: new Date().toISOString(),
        })),
        redis.set(`gtm-text:${submissionId}`, inputSlice, { ex: 21600 }),
      ]);
    } catch (redisErr) {
      console.error(`${TOOL} score: Redis persist failed`, redisErr);
    }

    return NextResponse.json({ totalScore, scores, id: submissionId });
  } catch (err) {
    console.error(`${TOOL} score error`, err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Scoring failed.", debug: msg }, { status: 500 });
  }
}
