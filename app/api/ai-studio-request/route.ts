import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import nodemailer from "nodemailer";

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
  try {
    const body = (await req.json()) as Partial<AiStudioRequest>;

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
        ? body.teamMembers.map((m) => ({
            name: (m.name || "").trim(),
            linkedin: (m.linkedin || "").trim(),
          }))
        : [],
      product: (body.product || "").trim(),
      problem: (body.problem || "").trim(),
      stage: (body.stage || "").trim(),
      extra: (body.extra || "").trim(),
      receivedAt: new Date().toISOString(),
    };

    // Persist to a JSONL file (simple structured log)
    const dataDir = path.join(process.cwd(), "data");
    await fs.mkdir(dataDir, { recursive: true });
    const filePath = path.join(dataDir, "ai-studio-requests.jsonl");
    await fs.appendFile(filePath, JSON.stringify(record) + "\n", "utf8");

    // Email notification (configure SMTP + notify email via env)
    const {
      SMTP_HOST,
      SMTP_PORT,
      SMTP_USER,
      SMTP_PASS,
      NOTIFY_EMAIL,
    } = process.env;

    if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && NOTIFY_EMAIL) {
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
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error handling AI Studio request", err);
    return NextResponse.json(
      { error: "Something went wrong submitting your idea." },
      { status: 500 },
    );
  }
}

