import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getRedis } from "@/app/lib/redis";
import { adminExists } from "@/app/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { email } = (await req.json()) as { email?: string };
    const allowedEmail = process.env.ADMIN_ALLOWED_EMAIL;

    // Always return success to avoid revealing whether email is valid
    if (!email || !allowedEmail || email.toLowerCase() !== allowedEmail.toLowerCase()) {
      return NextResponse.json({ ok: true });
    }

    const exists = await adminExists();
    if (!exists) {
      return NextResponse.json({ ok: true });
    }

    // Generate reset token (valid 15 min)
    const token = crypto.randomUUID();
    const redis = getRedis();
    await redis.set(`admin:reset:${token}`, "1", { ex: 900 });

    const origin = req.nextUrl.origin;
    const resetLink = `${origin}/admin/reset?token=${token}`;

    // Send email
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });

      await transporter.sendMail({
        from: SMTP_USER,
        to: allowedEmail,
        subject: "Summit Admin — Password Reset",
        text: [
          "You requested a password reset for the Summit Strategy Advisory admin console.",
          "",
          `Reset link (expires in 15 minutes):`,
          resetLink,
          "",
          "If you didn't request this, ignore this email.",
        ].join("\n"),
        html: `
          <p>You requested a password reset for the Summit Strategy Advisory admin console.</p>
          <p><a href="${resetLink}" style="background:#319A65;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">Reset Password</a></p>
          <p style="color:#666;font-size:13px;">Link expires in 15 minutes. If you didn't request this, ignore this email.</p>
        `,
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // Always succeed to avoid leaking info
  }
}
