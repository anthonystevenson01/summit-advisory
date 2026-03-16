import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, createSessionToken, sessionCookieOptions } from "@/app/lib/auth";

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";

  try {
    let password: string | undefined;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      password = formData.get("password") as string | undefined;
    } else {
      const body = (await req.json()) as { password?: string };
      password = body.password;
    }

    if (!password) {
      return redirectWithError(req, "Password required");
    }

    const valid = await verifyPassword(password);
    if (!valid) {
      return redirectWithError(req, "Invalid password");
    }

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
    return redirectWithError(req, "Login failed");
  }
}

function redirectWithError(req: NextRequest, error: string) {
  return NextResponse.redirect(new URL(`/admin/login?error=${encodeURIComponent(error)}`, req.url));
}
