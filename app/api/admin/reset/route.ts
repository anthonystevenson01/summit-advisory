import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/app/lib/redis";

// Emergency reset — deletes admin password so you can set up again
// Protected by a secret query param to prevent abuse
export async function POST(req: NextRequest) {
  const { secret } = (await req.json()) as { secret?: string };

  // Use UPSTASH_REDIS_REST_TOKEN as the reset secret (you already know it)
  const expectedSecret = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!secret || !expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
  }

  const redis = getRedis();
  await redis.del("admin:password");

  // Also clear any sessions
  const keys = await redis.keys("admin:session:*");
  if (keys.length > 0) {
    for (const key of keys) {
      await redis.del(key);
    }
  }

  return NextResponse.json({ ok: true, message: "Admin account reset. Visit /admin to set up a new password." });
}
