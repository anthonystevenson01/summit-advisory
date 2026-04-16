import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface NotionTextContent {
  plain_text: string;
}

interface NotionProperty {
  type: string;
  rich_text?: NotionTextContent[];
  title?: NotionTextContent[];
}

interface NotionPage {
  properties: Record<string, NotionProperty>;
}

function extractText(prop: NotionProperty | undefined): string {
  if (!prop) return "";
  const arr = prop.rich_text ?? prop.title ?? [];
  return arr.map((t) => t.plain_text).join("");
}

export async function GET() {
  try {
    const token = process.env.NOTION_TOKEN;
    const dbId = process.env.NOTION_PROMPTS_DB_ID;

    if (!token || !dbId) {
      return NextResponse.json({}, {
        headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" },
      });
    }

    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ page_size: 20 }),
    });

    if (!res.ok) {
      return NextResponse.json({}, {
        headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" },
      });
    }

    const data = await res.json();
    const pages: NotionPage[] = data.results ?? [];

    const prompts: Record<string, string> = {};
    for (const page of pages) {
      const props = page.properties;
      const toolKey = extractText(props["Tool Key"]).toLowerCase().trim();
      const prompt = extractText(props["Prompt"]);
      if (toolKey && prompt) {
        prompts[toolKey] = prompt;
      }
    }

    const result = {
      positioning: prompts["positioning"] ?? "",
      problem: prompts["problem"] ?? "",
      persona: prompts["persona"] ?? "",
      moat: prompts["moat"] ?? "",
      account: prompts["account"] ?? "",
    };

    return NextResponse.json(result, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" },
    });
  } catch {
    return NextResponse.json({}, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" },
    });
  }
}
