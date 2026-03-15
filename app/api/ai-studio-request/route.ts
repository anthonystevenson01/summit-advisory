import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import nodemailer from "nodemailer";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TeamMember = {
  name: string;
  linkedin: string;
};

type AiStudioRequest = {
  name: string;
  email: string;
  website: string;
  teamMembers: TeamMember[];
  product: string;
  problem: string;
  stage: string;
  extra: string;
  receivedAt: string;
};

export async function POST(req: NextRequest) {
  let body: Partial<AiStudioRequest>;
  try {
    body = (await req.json()) as Partial<AiStudioRequest>;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body. Please try again." },
      { status: 400 },
    );
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Invalid request body. Please try again." },
      { status: 400 },
    );
  }

  try {
    const name = (body.name || "").trim();
    const email = (body.email || "").trim();

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required." },
        { status: 400 },
      );
    }

    const record: AiStudioRequest = {
      name,
      email,
      website: (body.website || "").trim(),
      teamMembers: Array.isArray(body.teamMembers)
        ? body.teamMembers
            .filter((m): m is Record<string, unknown> => m != null && typeof m === "object")
            .map((m) => ({
              name: String(m.name ?? "").trim(),
              linkedin: String(m.linkedin ?? "").trim(),
            }))
        : [],
      product: (body.product || "").trim(),
      problem: (body.problem || "").trim(),
      stage: (body.stage || "").trim(),
      extra: (body.extra || "").trim(),
      receivedAt: new Date().toISOString(),
    };

    // Persistent storage: Upstash Redis (support both direct Upstash and Vercel KV env names)
    const redisUrl =
      process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
    const redisToken =
      process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
    if (redisUrl && redisToken) {
      try {
        const redis = new Redis({ url: redisUrl, token: redisToken });
        await redis.rpush("ai-studio-requests", JSON.stringify(record));
      } catch (redisErr) {
        console.error("AI Studio request: Redis persist failed", redisErr);
      }
    }

    // Local/dev only: JSONL file (skip on Vercel – read-only fs)
    if (!process.env.VERCEL) {
      try {
        const dataDir = path.join(process.cwd(), "data");
        const filePath = path.join(dataDir, "ai-studio-requests.jsonl");
        await fs.mkdir(dataDir, { recursive: true });
        await fs.appendFile(filePath, JSON.stringify(record) + "\n", "utf8");
      } catch {
        // ignore
      }
    }

    // Email notification (configure SMTP + notify email via env)
    const {
      SMTP_HOST,
      SMTP_PORT,
      SMTP_USER,
      SMTP_PASS,
      NOTIFY_EMAIL,
    } = process.env;

    if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && NOTIFY_EMAIL) {
      try {
        const transporter = nodemailer.createTransport({
          host: SMTP_HOST,
          port: Number(SMTP_PORT),
          secure: Number(SMTP_PORT) === 465,
          auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
          },
        });

        const teamSummary =
          record.teamMembers.length === 0
            ? "None provided"
            : record.teamMembers
                .map(
                  (m, idx) =>
                    `${idx + 1}. ${m.name || "(no name)"} – ${m.linkedin || "(no LinkedIn)"}`,
                )
                .join("\n");

        const text = [
          "New AI Product Studio request",
          "",
          `Received at: ${record.receivedAt}`,
          "",
          `Name: ${record.name}`,
          `Email: ${record.email}`,
          `Website: ${record.website || "(none)"}`,
          "",
          "Founding team:",
          teamSummary,
          "",
          `Product (one sentence):`,
          record.product || "(none)",
          "",
          "Problem it solves:",
          record.problem || "(none)",
          "",
          `Current stage: ${record.stage || "(none)"}`,
          "",
          "Anything else:",
          record.extra || "(none)",
        ].join("\n");

        await transporter.sendMail({
          from: NOTIFY_EMAIL,
          to: NOTIFY_EMAIL,
          subject: `New AI Studio request from ${record.name}`,
          text,
        });
      } catch (mailErr) {
        console.error("AI Studio request: email failed", mailErr);
        // Still return success so the user sees confirmation; check Vercel logs for delivery issues
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("AI Studio request error", message, stack);
    return NextResponse.json(
      {
        error: "Something went wrong submitting your idea.",
        ...(process.env.NODE_ENV === "development" && { debug: message }),
      },
      { status: 500 },
    );
  }
}

