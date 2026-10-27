import { NextRequest, NextResponse } from "next/server";
import { BRAND } from "@/app/lib/brand";
import { deleteRunsByEmail } from "@/app/lib/runs";
import { deleteBlobs } from "@/app/lib/ask-summit/blobs";
import { deleteAskRequestsByEmail, listAskRequestsByEmail } from "@/app/lib/ask-summit/store";
import { track } from "@/app/lib/events";
import { UNLOCK_COOKIE, unlockCookieOptions, verifyDeleteToken, verifyUnlockCookie } from "@/app/lib/unlock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The delete-my-data link from the emailed result: GET renders a plain
 * confirmation page with one button; POST removes every run stored under
 * the email hash and renders a Done page. Both pages are static HTML strings
 * with inline BRAND styles and no script, built here as a route handler
 * rather than a React page so the form works with nothing on the client.
 *
 * GET and POST both verify the token. GET verifies so a mistyped or forged
 * link shows "not valid" instead of a delete button; POST verifies again
 * because the hidden fields come back from the browser and are not trusted,
 * so a POST built by hand without a valid token deletes nothing. The token
 * is bound to the hash, so a link can only ever delete the data under its
 * own address, and a leaked link cannot touch anyone else's.
 *
 * What is removed: `run:{id}` for every id in `runs:by-email:{hash}`, those
 * ids from `runs:by-time`, and the per-email set itself. What is not:
 * `gtm-unlocks`, the list the daily digest reads. The spec limits deletion
 * to the run store and its indexes, and removing entries from that list
 * would need an LREM scan over a growing list; whether a delete request
 * should also drop the digest entries is flagged for the owner to decide
 * separately. Nothing is appended to `gtm-unlocks`; the event carries a
 * count only, never the hash.
 */

const HASH_PATTERN = /^[0-9a-f]{64}$/;
const DELETE_PATH = "/api/tools/data/delete";
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
const backLink = `<p style="margin:20px 0 0;font-size:14px;"><a href="/tools" style="color:${BRAND.teal};">Back to the GTM tools</a></p>`;

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
    h1("Delete my data") +
    p("This removes every result stored under your email address from Summit's tools. The emails already sent to you are not recalled.") +
    `<form method="POST" action="${DELETE_PATH}" style="margin:24px 0 0;">` +
    `<input type="hidden" name="e" value="${escapeHtml(emailHash)}">` +
    `<input type="hidden" name="t" value="${escapeHtml(token)}">` +
    `<button type="submit" style="padding:12px 28px;border:none;border-radius:6px;background:${BRAND.red};color:${BRAND.white};font-size:15px;font-weight:600;cursor:pointer;">Delete my data</button>` +
    "</form>";
  return htmlResponse(renderPage({ title: "Delete my data", body }), 200);
}

function donePage(count: number, requests: number): NextResponse {
  let line: string;
  if (count === 0 && requests === 0) line = "Done. There was nothing stored under this address.";
  else if (requests > 0) line = `Done. ${count} result${count === 1 ? "" : "s"} and ${requests} request${requests === 1 ? "" : "s"} deleted.`;
  else line = `Done. ${count} result${count === 1 ? "" : "s"} deleted.`;
  const body = h1("Done") + p(line) + backLink;
  return htmlResponse(renderPage({ title: "Done", body }), 200);
}

/** Both params present, the hash well formed, and the token signed for that hash. Shared by GET and POST so neither can drift. */
function verified(emailHash: unknown, token: unknown): { emailHash: string; token: string } | null {
  if (typeof emailHash !== "string" || !HASH_PATTERN.test(emailHash)) return null;
  if (typeof token !== "string" || token.length === 0) return null;
  if (!verifyDeleteToken(token, emailHash)) return null;
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
  let requests: string[] = [];
  try {
    count = await deleteRunsByEmail(ok.emailHash);
    // Ask Summit requests under the hash: the blobs first (a failure is
    // logged and the sweep catches them later), then the records, their
    // data keys and both index entries. The composite runs and the reports
    // built from them are not touched.
    const askRecords = await listAskRequestsByEmail(ok.emailHash);
    const urls = askRecords.flatMap((r) => (r.dataDeleted ? [] : r.files.map((f) => f.url)));
    try {
      await deleteBlobs(urls);
    } catch (err) {
      console.error("data delete: blob deletion failed", err instanceof Error ? err.message.slice(0, 200) : err);
    }
    requests = await deleteAskRequestsByEmail(ok.emailHash);
  } catch (err) {
    console.error("data delete: run deletion failed", err instanceof Error ? err.message : err);
    return errorPage();
  }
  void track("data_deleted", { count, requests: requests.length });
  for (const requestId of requests) void track("ask_data_deleted", { requestId, reason: "delete-link" });

  const res = donePage(count, requests.length);
  // A visitor who deletes their data should not keep a cookie whose hash now
  // points at nothing: their next details request would silently re-index
  // them. Only a cookie carrying this hash is cleared, so a different
  // visitor's cookie on the same browser is left alone.
  const cookie = verifyUnlockCookie(req.cookies.get(UNLOCK_COOKIE)?.value);
  if (cookie && cookie.emailHash === ok.emailHash) {
    res.cookies.set(UNLOCK_COOKIE, "", { ...unlockCookieOptions(), maxAge: 0 });
  }
  return res;
}
