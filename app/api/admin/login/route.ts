import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, createSessionToken } from "@/app/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { password } = (await req.json()) as { password?: string };
    if (!password) {
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }

    const valid = await verifyPassword(password);
    if (!valid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const token = await createSessionToken();
    return NextResponse.json({ ok: true, token });
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
