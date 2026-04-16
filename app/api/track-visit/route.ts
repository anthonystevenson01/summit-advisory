import { NextResponse } from "next/server";
import { getRedis } from "@/app/lib/redis";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const redis = getRedis();
    await redis.incr("page-visits");
  } catch (err) {
    console.error("Track visit error", err);
  }
  return NextResponse.json({ ok: true });
}
