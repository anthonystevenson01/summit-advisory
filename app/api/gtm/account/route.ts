import { NextRequest, NextResponse } from "next/server";
import { getAccountIntelLimiter, getClientIp } from "@/app/lib/ratelimit";
import { isToolHidden } from "@/app/lib/tools/registry";
import { callModel, LlmNotConfiguredError } from "@/app/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const DEFAULT_SYSTEM_PROMPT =
  "You are an enterprise sales intelligence analyst. Research target accounts thoroughly using web search and produce actionable sales briefs. Return only valid JSON.";

// The account brief shape the component renders. Kept as a schema so the
// answer arrives as structured output rather than text to be parsed.
const ACCOUNT_BRIEF_SCHEMA = {
  name: "account_brief",
  strict: true as const,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "account_name", "description", "strategic_context", "icp_fit", "timing", "fit_reasoning",
      "contacts", "signals", "recommended_opening", "timing_verdict",
    ],
    properties: {
      account_name: { type: "string" },
      description: { type: "string" },
      strategic_context: { type: "string" },
      icp_fit: {
        type: "object",
        additionalProperties: false,
        required: ["rating", "score"],
        properties: {
          rating: { type: "string", enum: ["Strong", "Moderate", "Weak", "Unknown"] },
          score: { type: "number", minimum: 0, maximum: 100 },
        },
      },
      timing: { type: "string", enum: ["Now", "Watch", "Not Yet"] },
      fit_reasoning: { type: "string" },
      contacts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["role", "why_relevant", "signal", "title_variants", "linkedin_search"],
          properties: {
            role: { type: "string" },
            why_relevant: { type: "string" },
            signal: { type: "string", description: "Empty when there is no specific signal." },
            title_variants: { type: "array", items: { type: "string" } },
            linkedin_search: { type: "string" },
          },
        },
      },
      signals: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["type", "finding", "implication"],
          properties: {
            type: { type: "string", enum: ["Hiring", "Leadership", "Technology", "News", "Financial", "Regulatory"] },
            finding: { type: "string" },
            implication: { type: "string" },
          },
        },
      },
      recommended_opening: { type: "string" },
      timing_verdict: { type: "string" },
    },
  },
};

export async function POST(req: NextRequest) {
  // Respect the site-wide hidden-tool flag. Blocks direct POSTs even though
  // the UI no longer links here. Set hidden: false in the registry to re-enable.
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

  const userPrompt = `Research this target account and produce a sales intelligence brief:

Account name: ${account_name}${website ? `\nWebsite: ${website}` : ""}${icp_context ? `\n\nICP context: ${icp_context}` : ""}${persona_context ? `\n\nPersona context: ${persona_context}` : ""}

Use web search to find current information about this company. Include 3 to 5 contacts and 3 to 6 signals. Base signals on actual search findings where possible. Leave a contact's signal empty when there is no specific signal. Return the JSON object only.`;

  try {
    const result = await callModel({
      routingKey: "extraction",
      runId: null,
      system: systemPrompt || DEFAULT_SYSTEM_PROMPT,
      user: userPrompt,
      schema: ACCOUNT_BRIEF_SCHEMA,
      parse: (raw) => {
        if (typeof raw !== "object" || raw === null || typeof (raw as { account_name?: unknown }).account_name !== "string") {
          throw new Error("model returned an unusable answer");
        }
        return raw as Record<string, unknown>;
      },
      maxTokens: 2000,
      web: true,
    });
    return NextResponse.json(result.data);
  } catch (err) {
    if (err instanceof LlmNotConfiguredError) {
      return NextResponse.json({ error: "model provider not configured" }, { status: 503 });
    }
    const msg = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
