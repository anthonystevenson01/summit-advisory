import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

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

type EvaluateResponse = {
  totalScore: number;
  scores: Record<string, number>;
  recommendations: Array<{
    dim: string;
    score: number;
    gap: string;
    consequence: string;
    action: string;
  }>;
};

function extractTextFromDocBody(content: unknown[]): string {
  const parts: string[] = [];
  for (const node of content) {
    if (!node || typeof node !== "object") continue;
    const n = node as Record<string, unknown>;
    if (n.paragraph) {
      const para = n.paragraph as Record<string, unknown>;
      const elements = para.elements as Array<Record<string, unknown>> | undefined;
      if (elements) {
        for (const el of elements) {
          const tr = el.textRun as Record<string, unknown> | undefined;
          if (tr && typeof tr.content === "string") parts.push(tr.content);
        }
      }
    }
  }
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

async function fetchGoogleDoc(docId: string, apiKey: string): Promise<string> {
  const url = `https://docs.googleapis.com/v1/documents/${encodeURIComponent(docId)}?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Google Docs API: ${res.status} ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as { body?: { content?: unknown[] } };
  const content = data.body?.content;
  if (!Array.isArray(content)) return "";
  return extractTextFromDocBody(content);
}

async function loadSkillsFromDrive(): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const skillId = process.env.SKILL_DOC_ID;
  const recId = process.env.RECOMMENDATIONS_DOC_ID;
  if (!apiKey || !skillId) {
    return "Score the ICP on seven dimensions: bca (25%), pa (18%), usp (15%), it (15%), cd (12%), nf (10%), fs (5%). Each 1-5. Return JSON: { totalScore, scores: { bca, pa, usp, it, cd, nf, fs }, recommendations: [{ dim, score, gap, consequence, action }] }.";
  }
  const parts: string[] = [];
  try {
    parts.push(await fetchGoogleDoc(skillId, apiKey));
  } catch (e) {
    console.error("Failed to fetch SKILL_DOC_ID", e);
  }
  if (recId && apiKey) {
    try {
      const recText = await fetchGoogleDoc(recId, apiKey);
      if (recText) parts.push("--- Recommendations rubric ---\n" + recText);
    } catch (e) {
      console.error("Failed to fetch RECOMMENDATIONS_DOC_ID", e);
    }
  }
  const combined = parts.filter(Boolean).join("\n\n---\n\n");
  return combined || "Return JSON with totalScore (0-100), scores (bca, pa, usp, it, cd, nf, fs each 1-5), and recommendations array with dim, score, gap, consequence, action.";
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
    return {
      totalScore: Math.min(100, Math.max(0, Math.round(parsed.totalScore))),
      scores,
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

  const skillsPrompt = await loadSkillsFromDrive();
  const systemPrompt = `You are an expert at evaluating Ideal Customer Profiles for B2B enterprise sales. Use the following rubric and dimensions. Reply with only valid JSON, no markdown or extra text.\n\n${skillsPrompt}`;
  const userPrompt = `Evaluate this ICP document and return the JSON object only.\n\n---\n\n${icpText}`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text : "";
    const result = parseJsonFromResponse(text);
    if (!result) {
      return NextResponse.json({ error: "Could not parse evaluation response." }, { status: 502 });
    }

    const weightedTotal =
      (DIMENSION_KEYS.reduce((sum, k) => sum + (result.scores[k] ?? 3) * (WEIGHTS[k] ?? 0), 0) / 5) * 100;
    result.totalScore = Math.round(weightedTotal);

    return NextResponse.json(result);
  } catch (err) {
    console.error("evaluate-icp error", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Evaluation failed.", debug: message }, { status: 500 });
  }
}
