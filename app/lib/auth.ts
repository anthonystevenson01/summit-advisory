import { cookies } from "next/headers";
import { getRedis } from "./redis";

const SESSION_COOKIE = "admin_session";
const SESSION_TTL = 86400; // 24 hours

export async function createSession(): Promise<string> {
  const token = crypto.randomUUID();
  const redis = getRedis();
  await redis.set(`admin:session:${token}`, "1", { ex: SESSION_TTL });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
  return token;
}

export async function validateSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const redis = getRedis();
  const exists = await redis.get(`admin:session:${token}`);
  return exists === "1";
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const redis = getRedis();
    await redis.del(`admin:session:${token}`);
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function verifyPassword(password: string): Promise<boolean> {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) return false;
  const encoded = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const hexDigest = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hexDigest === hash.toLowerCase();
}
