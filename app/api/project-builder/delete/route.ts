import { NextRequest, NextResponse } from "next/server";
import { BRAND } from "@/app/lib/brand";
import { deleteBriefsByEmail } from "@/app/lib/briefs";
import { track } from "@/app/lib/events";
import { verifyBriefDeleteToken } from "@/app/lib/unlock";
import { archiveBriefPage } from "@/app/lib/project-builder-notion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The delete-my-brief link from every builder email: GET renders a plain
 * confirmation page with one button; POST removes every brief, pasted
 * document and index entry under the email hash, archives the Notion pages
 * best effort, and renders a Done page. Both pages are static HTML strings
 * with inline BRAND styles and no script, in the exact pattern of the 1b
 * delete-my-data route. GET and POST both verify the token, which is bound
 * to the hash, so a link can only ever delete the briefs under its own
 * address. This flow has no cookie to clear.
 */

const HASH_PATTERN = /^[0-9a-f]{64}$/;
const DELETE_PATH = "/api/project-builder/delete";
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderPage({ title, body }: { title: string; body: string }): string {
  return [
    "<!doctype html>",
    `<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title></head>`,
    `<body style="margin:0;padding:0;background:${BRAND.lightBg};font-family:${FONT};color:${BRAND.dark};">`,
    `<div style="background:${BRAND.darkGreen};padding:18px 24px;"><span style="color:${BRAND.white};font-size:14px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Summit Strategy Advisory</span></div>`,
    `<main style="max-width:560px;margin:40px auto;padding:32px 28px;background:${BRAND.white};border:1px solid ${BRAND.border};border-radius:12px;">`,
    body,
    "</main>",
    "</body></html>",
  ].join("");
}

const h1 = (text: string) => `<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:${BRAND.darkGreen};">${text}</h1>`;
const p = (text: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${BRAND.dark};">${text}</p>`;
const backLink = `<p style="margin:20px 0 0;font-size:14px;"><a href="/tools/project-builder" style="color:${BRAND.teal};">Back to the Project Builder</a></p>`;

function htmlResponse(html: string, status: number): NextResponse {
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function invalidPage(): NextResponse {
  const body = h1("This link is not valid") + p("The delete link in your email could not be verified. Please open the link exactly as it appears in the email.") + backLink;
  return htmlResponse(renderPage({ title: "Link not valid", body }), 400);
}

function errorPage(): NextResponse {
  const body = h1("Something went wrong") + p("Something went wrong. Please try the link again in a few minutes.") + backLink;
  return htmlResponse(renderPage({ title: "Something went wrong", body }), 500);
}

function confirmPage(emailHash: string, token: string): NextResponse {
  const body =
    h1("Delete my brief") +
    p("This removes every project brief, every pasted document and every saved link under your email address. The emails already sent to you are not recalled, and a page Anthony has already written in his own notes is archived, not erased.") +
    `<form method="POST" action="${DELETE_PATH}" style="margin:24px 0 0;">` +
    `<input type="hidden" name="e" value="${escapeHtml(emailHash)}">` +
    `<input type="hidden" name="t" value="${escapeHtml(token)}">` +
    `<button type="submit" style="padding:12px 28px;border:none;border-radius:6px;background:${BRAND.red};color:${BRAND.white};font-size:15px;font-weight:600;cursor:pointer;">Delete my brief</button>` +
    "</form>";
  return htmlResponse(renderPage({ title: "Delete my brief", body }), 200);
}

function donePage(count: number): NextResponse {
  const line = count === 0 ? "Done. There was nothing stored under this address." : `Done. ${count} brief${count === 1 ? "" : "s"} deleted.`;
  const body = h1("Done") + p(line) + backLink;
  return htmlResponse(renderPage({ title: "Done", body }), 200);
}

function verified(emailHash: unknown, token: unknown): { emailHash: string; token: string } | null {
  if (typeof emailHash !== "string" || !HASH_PATTERN.test(emailHash)) return null;
  if (typeof token !== "string" || token.length === 0) return null;
  if (!verifyBriefDeleteToken(token, emailHash)) return null;
  return { emailHash, token };
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const ok = verified(params.get("e"), params.get("t"));
  if (!ok) return invalidPage();
  return confirmPage(ok.emailHash, ok.token);
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return invalidPage();
  }
  const ok = verified(form.get("e"), form.get("t"));
  if (!ok) return invalidPage();

  let count: number;
  let notionPageIds: string[] = [];
  try {
    ({ count, notionPageIds } = await deleteBriefsByEmail(ok.emailHash));
  } catch (err) {
    console.error("project-builder delete: brief deletion failed", err instanceof Error ? err.message : err);
    return errorPage();
  }
  for (const pageId of notionPageIds) {
    try {
      await archiveBriefPage(pageId);
    } catch {
      // best effort
    }
  }
  void track("brief_deleted", { count });
  return donePage(count);
}
