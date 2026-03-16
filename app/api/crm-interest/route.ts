import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getRedis } from "@/app/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CRMInterestRequest = {
  email: string;
  crms: string;
  receivedAt: string;
};

export async function POST(req: NextRequest) {
  let body: Partial<CRMInterestRequest>;
  try {
    body = (await req.json()) as Partial<CRMInterestRequest>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const email = (body.email || "").trim();
    const crms = (body.crms || "").trim();

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const record: CRMInterestRequest = {
      email,
      crms,
      receivedAt: new Date().toISOString(),
    };

    // Persist to Redis
    try {
      const redis = getRedis();
      await redis.rpush("crm-interest", JSON.stringify(record));
    } catch (redisErr) {
      console.error("CRM interest: Redis persist failed", redisErr);
    }

    // Email notification
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, NOTIFY_EMAIL } = process.env;
    const smtpConfigured = SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && NOTIFY_EMAIL;

    if (smtpConfigured) {
      try {
        const transporter = nodemailer.createTransport({
          host: SMTP_HOST,
          port: Number(SMTP_PORT),
          secure: Number(SMTP_PORT) === 465,
          auth: { user: SMTP_USER, pass: SMTP_PASS },
        });

        const text = [
          "New CRM Integration Interest",
          "",
          `Received at: ${record.receivedAt}`,
          "",
          `Email: ${record.email}`,
          "",
          "CRMs requested:",
          record.crms || "(none specified)",
        ].join("\n");

        await transporter.sendMail({
          from: NOTIFY_EMAIL,
          to: NOTIFY_EMAIL,
          subject: `CRM Interest from ${record.email}`,
          text,
        });
      } catch (mailErr) {
        console.error("CRM interest: email failed", mailErr);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("CRM interest error", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
