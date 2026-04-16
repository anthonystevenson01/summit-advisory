import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface NotionRichText {
  plain_text: string;
}

interface NotionBlock {
  type: string;
  paragraph?: { rich_text: NotionRichText[] };
  heading_1?: { rich_text: NotionRichText[] };
  heading_2?: { rich_text: NotionRichText[] };
  heading_3?: { rich_text: NotionRichText[] };
  bulleted_list_item?: { rich_text: NotionRichText[] };
  numbered_list_item?: { rich_text: NotionRichText[] };
  quote?: { rich_text: NotionRichText[] };
}

function extractRichText(arr: NotionRichText[]): string {
  return arr.map((rt) => rt.plain_text).join("");
}

function notionBlocksToText(blocks: NotionBlock[]): string {
  const lines: string[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case "paragraph":
        if (block.paragraph) lines.push(extractRichText(block.paragraph.rich_text));
        break;
      case "heading_1":
        if (block.heading_1) lines.push(`# ${extractRichText(block.heading_1.rich_text)}`);
        break;
      case "heading_2":
        if (block.heading_2) lines.push(`## ${extractRichText(block.heading_2.rich_text)}`);
        break;
      case "heading_3":
        if (block.heading_3) lines.push(`### ${extractRichText(block.heading_3.rich_text)}`);
        break;
      case "bulleted_list_item":
        if (block.bulleted_list_item) lines.push(`• ${extractRichText(block.bulleted_list_item.rich_text)}`);
        break;
      case "numbered_list_item":
        if (block.numbered_list_item) lines.push(extractRichText(block.numbered_list_item.rich_text));
        break;
      case "quote":
        if (block.quote) lines.push(`> ${extractRichText(block.quote.rich_text)}`);
        break;
    }
  }
  return lines.filter(Boolean).join("\n");
}

interface NotionBlocksResponse {
  results: NotionBlock[];
}

async function fetchNotionPage(pageId: string, token: string): Promise<string> {
  const url = `https://api.notion.com/v1/blocks/${pageId}/children`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
    },
  });
  if (!res.ok) throw new Error(`Notion API error ${res.status} for page ${pageId}`);
  const data = (await res.json()) as NotionBlocksResponse;
  return notionBlocksToText(data.results ?? []);
}

// In-memory cache, 10 min TTL
let rubricCache: {
  icp: string;
  persona: string;
  positioning: string;
  problem: string;
  moat: string;
  cachedAt: number;
} | null = null;
const CACHE_TTL = 10 * 60 * 1000;

const CACHE_HEADERS = { "Cache-Control": "s-maxage=600, stale-while-revalidate=120" } as const;

export async function GET() {
  // Serve from cache if fresh
  if (rubricCache && Date.now() - rubricCache.cachedAt < CACHE_TTL) {
    const { cachedAt: _c, ...rubrics } = rubricCache;
    return NextResponse.json(rubrics, { headers: CACHE_HEADERS });
  }

  const token = process.env.NOTION_TOKEN;
  if (!token) {
    return NextResponse.json(
      { icp: "", persona: "", positioning: "", problem: "", moat: "" },
      { headers: CACHE_HEADERS },
    );
  }

  const ids = {
    icp: process.env.NOTION_ICP_RUBRIC_ID ?? "34408aa9920381b88bafc4ac9681e2b5",
    persona: process.env.NOTION_PERSONA_RUBRIC_ID ?? "34408aa9920381fcae6ef99e7ab00e3a",
    positioning: process.env.NOTION_POSITIONING_RUBRIC_ID ?? "34408aa9920381e59ad5cf43002708b3",
    problem: process.env.NOTION_PROBLEM_RUBRIC_ID ?? "34408aa9920381d68541d20ed1f9ab99",
    moat: process.env.NOTION_MOAT_RUBRIC_ID ?? "34408aa99203810a9c44cb74431fcf6c",
  };

  const results = await Promise.allSettled([
    fetchNotionPage(ids.icp, token),
    fetchNotionPage(ids.persona, token),
    fetchNotionPage(ids.positioning, token),
    fetchNotionPage(ids.problem, token),
    fetchNotionPage(ids.moat, token),
  ]);

  const [icpR, personaR, positioningR, problemR, moatR] = results;

  const rubrics = {
    icp: icpR.status === "fulfilled" ? icpR.value : "",
    persona: personaR.status === "fulfilled" ? personaR.value : "",
    positioning: positioningR.status === "fulfilled" ? positioningR.value : "",
    problem: problemR.status === "fulfilled" ? problemR.value : "",
    moat: moatR.status === "fulfilled" ? moatR.value : "",
  };

  rubricCache = { ...rubrics, cachedAt: Date.now() };
  return NextResponse.json(rubrics, { headers: CACHE_HEADERS });
}
