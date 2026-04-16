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

  let body: { persona?: string; tam_size?: string; systemPrompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { persona, tam_size = "Unknown", systemPrompt = "" } = body;
  if (!persona || persona.trim().length === 0) {
    return NextResponse.json({ error: "Persona definition is required." }, { status: 400 });
  }
  if (persona.length > 6000) {
    return NextResponse.json({ error: "Persona definition too long." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userPrompt = `Buyer persona to evaluate:

"${persona}"
TAM size: ${tam_size}

Respond with valid JSON only — no markdown fences, no commentary outside the JSON object. Use this exact shape:
{
  "grade": "A"|"B"|"C"|"D"|"F",
  "overall_score": number (0-100),
  "summary": string,
  "best_thing": string,
  "biggest_gap": string,
  "question_to_answer": string,
  "dimensions": [
    { "name": string, "label": string, "score": number (0-10), "observation": string, "fix": string (only if score < 8) }
  ]
}
Include exactly 6 dimensions covering: Specificity, Pain Clarity, Decision Authority, Reachability, Job-to-be-Done Fit, Finite Market Alignment.`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      system: systemPrompt || "You are a B2B persona expert specialising in enterprise and finite-market buyers. Evaluate buyer personas rigorously. Return only valid JSON.",
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
