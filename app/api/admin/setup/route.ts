import { NextRequest, NextResponse } from "next/server";
import { setupAdmin, createSessionToken, adminExists } from "@/app/lib/auth";

export async function GET() {
  try {
    const exists = await adminExists();
    return NextResponse.json({ adminExists: exists });
  } catch {
    return NextResponse.json({ error: "Failed to check admin status" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const exists = await adminExists();
    if (exists) {
      return NextResponse.json({ error: "Admin account already exists. Please log in." }, { status: 400 });
    }

    const { password } = (await req.json()) as { password?: string };
    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    await setupAdmin(password);
    const token = await createSessionToken();
    return NextResponse.json({ ok: true, token });
  } catch {
    return NextResponse.json({ error: "Setup failed" }, { status: 500 });
  }
}
