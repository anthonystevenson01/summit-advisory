import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { email } = body;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!email || !emailRegex.test(email.trim())) {
    return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
  }
  if (email.length > 320) {
    return NextResponse.json({ error: "Email too long." }, { status: 400 });
  }

  const endpoint = process.env.NEWSLETTER_ENDPOINT;
  if (!endpoint) {
    return NextResponse.json({ status: "coming_soon" });
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Signup failed. Please try again." }, { status: 502 });
    }

    return NextResponse.json({ status: "subscribed" });
  } catch {
    return NextResponse.json({ error: "Signup failed. Please try again." }, { status: 502 });
  }
}
