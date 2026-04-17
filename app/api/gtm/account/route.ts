import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Message } from "@anthropic-ai/sdk/resources/messages/messages";
import { getAccountIntelLimiter, getClientIp } from "@/app/lib/ratelimit";
import { isToolHidden } from "@/app/tools/[tool]/toolSlugs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  // Respect the site-wide hidden-tool flag — blocks direct POSTs even though
  // the UI no longer links here. Remove "account" from HIDDEN_TOOL_SLUGS to re-enable.
  if (isToolHidden("account")) {
    return NextResponse.json({ error: "This tool is not available." }, { status: 404 });
  }

  const limiter = getAccountIntelLimiter();
  if (limiter) {
    const ip = getClientIp(req);
    const { success } = await limiter.limit(ip);
    if (!success) {
      return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
    }
  }

  let body: {
    account_name?: string;
    website?: string;
    icp_context?: string;
    persona_context?: string;
    systemPrompt?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { account_name, website = "", icp_context = "", persona_context = "", systemPrompt = "" } = body;
  if (!account_name || account_name.trim().length === 0) {
    return NextResponse.json({ error: "Account name is required." }, { status: 400 });
  }
  if (account_name.length > 200) {
    return NextResponse.json({ error: "Account name too long." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userPrompt = `Research this target account and produce a sales intelligence brief:

Account name: ${account_name}${website ? `\nWebsite: ${website}` : ""}${icp_context ? `\n\nICP context: ${icp_context}` : ""}${persona_context ? `\n\nPersona context: ${persona_context}` : ""}

Use web search to find current information about this company. Then respond with valid JSON only — no markdown fences, no commentary outside the JSON object. Use this exact shape:
{
  "account_name": string,
  "description": string,
  "strategic_context": string,
  "icp_fit": { "rating": "Strong"|"Moderate"|"Weak"|"Unknown", "score": number (0-100) },
  "timing": "Now"|"Watch"|"Not Yet",
  "fit_reasoning": string,
  "contacts": [
    {
      "role": string,
      "why_relevant": string,
      "signal": string (optional, only if there is a specific signal),
      "title_variants": [string],
      "linkedin_search": string
    }
  ],
  "signals": [
    {
      "type": "Hiring"|"Leadership"|"Technology"|"News"|"Financial"|"Regulatory",
      "finding": string,
      "implication": string
    }
  ],
  "recommended_opening": string,
  "timing_verdict": string
}
Include 3-5 contacts and 3-6 signals. Base signals on actual search findings where possible.`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      system: systemPrompt || "You are an enterprise sales intelligence analyst. Research target accounts thoroughly using web search and produce actionable sales briefs. Return only valid JSON.",
      messages: [{ role: "user", content: userPrompt }],
    } as Parameters<typeof client.messages.create>[0]) as Message;

    // Parse multi-block content: iterate from end, find last text block
    let text = "";
    for (let i = message.content.length - 1; i >= 0; i--) {
      const block = message.content[i];
      if (block.type === "text" && block.text.trim().length > 0) {
        text = block.text;
        break;
      }
    }

    if (!text) {
      return NextResponse.json({ error: "No response from AI." }, { status: 500 });
    }

    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
