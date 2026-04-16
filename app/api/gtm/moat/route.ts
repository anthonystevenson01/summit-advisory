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

  let body: { position?: string; competitors?: string; systemPrompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { position, competitors = "", systemPrompt = "" } = body;
  if (!position || position.trim().length === 0) {
    return NextResponse.json({ error: "Product/competitive position is required." }, { status: 400 });
  }
  if (position.length > 6000) {
    return NextResponse.json({ error: "Position description too long." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userPrompt = `Competitive position to evaluate:

"${position}"${competitors ? `\n\nPrimary competitors: ${competitors}` : ""}

Respond with valid JSON only — no markdown fences, no commentary outside the JSON object. Use this exact shape:
{
  "moat_rating": "Strong"|"Moderate"|"Thin"|"Exposed",
  "score": number (0-100),
  "summary": string,
  "strongest_dimension": string,
  "weakest_dimension": string,
  "thing_not_saying": string,
  "priority_90_day": string,
  "threat_18_month": string,
  "dimensions": [
    { "name": string, "label": string, "score": number (0-10), "observation": string, "fix": string (only if score < 8) }
  ]
}
Include exactly 6 dimensions covering: Switching Cost, Product Differentiation, Data/Network Effect, Brand/Relationships, Speed of Delivery, Price Defensibility.`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      system: systemPrompt || "You are a competitive strategy expert focused on B2B SaaS and enterprise software. Evaluate competitive moats with candour. Return only valid JSON.",
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
