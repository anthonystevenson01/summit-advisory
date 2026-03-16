import { NextRequest, NextResponse } from "next/server";
import { setupAdmin, createSessionToken, sessionCookieOptions, adminExists } from "@/app/lib/auth";

export async function GET() {
  try {
    const exists = await adminExists();
    return NextResponse.json({ adminExists: exists });
  } catch {
    return NextResponse.json({ error: "Failed to check admin status" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";

  try {
    const exists = await adminExists();
    if (exists) {
      return NextResponse.redirect(new URL("/admin/login?error=" + encodeURIComponent("Admin account already exists. Please log in."), req.url));
    }

    let password: string | undefined;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      password = formData.get("password") as string | undefined;
    } else {
      const body = (await req.json()) as { password?: string };
      password = body.password;
    }

    if (!password || password.length < 8) {
      return NextResponse.redirect(new URL("/admin/login?error=" + encodeURIComponent("Password must be at least 8 characters"), req.url));
    }

    await setupAdmin(password);
    const token = await createSessionToken();
    const opts = sessionCookieOptions();
    const response = NextResponse.redirect(new URL("/admin", req.url));
    response.cookies.set(opts.name, token, {
      httpOnly: opts.httpOnly,
      secure: opts.secure,
      sameSite: opts.sameSite,
      path: opts.path,
      maxAge: opts.maxAge,
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/admin/login?error=" + encodeURIComponent("Setup failed"), req.url));
  }
}
