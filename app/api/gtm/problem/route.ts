import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getToolLimiter, getClientIp } from "@/app/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const limiter = getToolLimiter();
  if (limiter) {
    const ip = getClientIp(req);
    const { success } = await limiter.limit(ip);
    if (!success) {
      return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
    }
  }

  let body: { problem?: string; evidence?: string; tam_size?: string; systemPrompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { problem, evidence = "", tam_size = "Unknown", systemPrompt = "" } = body;
  if (!problem || problem.trim().length === 0) {
    return NextResponse.json({ error: "Problem description is required." }, { status: 400 });
  }
  if (problem.length > 4000) {
    return NextResponse.json({ error: "Problem description too long." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userPrompt = `Market problem to validate:

"${problem}"${evidence ? `\n\nEvidence/signals: ${evidence}` : ""}
TAM size: ${tam_size}

Respond with valid JSON only — no markdown fences, no commentary outside the JSON object. Use this exact shape:
{
  "verdict": "Worth Building Against"|"Validate Further"|"Not Yet"|"Abandon This Problem",
  "score": number (0-100),
  "verdict_reasoning": string,
  "fatal_flaw": string (only include if a fatal flaw exists),
  "strongest_signal": string,
  "question_youre_avoiding": string,
  "next_validation_moves": [string, string, string],
  "dimensions": [
    { "name": string, "label": string, "score": number (0-10), "observation": string, "fix": string (only if score < 8) }
  ]
}
Include exactly 6 dimensions covering: Problem Acuity, Market Evidence, Urgency, Addressability, Competitive Gap, Monetisation Signal.`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      system: systemPrompt || "You are a B2B market validation expert specialising in finite, defined markets. Evaluate market problems with rigour. Return only valid JSON.",
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = message.content.find((b) => b.type === "text")?.text ?? "";
    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
