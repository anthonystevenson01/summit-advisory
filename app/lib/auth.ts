import { cookies } from "next/headers";
import { getRedis } from "./redis";

const SESSION_COOKIE = "admin_session";
const SESSION_TTL = 86400; // 24 hours
const ADMIN_PASSWORD_KEY = "admin:password";

async function hashPassword(password: string): Promise<string> {
  const encoded = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function adminExists(): Promise<boolean> {
  const redis = getRedis();
  const hash = await redis.get(ADMIN_PASSWORD_KEY);
  return !!hash;
}

export async function setupAdmin(password: string): Promise<void> {
  const redis = getRedis();
  const exists = await redis.get(ADMIN_PASSWORD_KEY);
  if (exists) throw new Error("Admin account already exists");
  const hash = await hashPassword(password);
  await redis.set(ADMIN_PASSWORD_KEY, hash);
}

/** Create session in Redis and return the token. Caller must set the cookie on the response. */
export async function createSessionToken(): Promise<string> {
  const token = crypto.randomUUID();
  const redis = getRedis();
  await redis.set(`admin:session:${token}`, "1", { ex: SESSION_TTL });
  return token;
}

export function sessionCookieOptions() {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL,
  };
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
  const redis = getRedis();
  const storedHash = await redis.get(ADMIN_PASSWORD_KEY);
  if (!storedHash || typeof storedHash !== "string") return false;
  const inputHash = await hashPassword(password);
  return inputHash === storedHash.toLowerCase();
}
