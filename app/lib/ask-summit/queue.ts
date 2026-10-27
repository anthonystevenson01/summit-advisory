/**
 * The only file that imports `@upstash/qstash`: one publish per request
 * and the signature check on the processing route. QSTASH_TOKEN and the two
 * signing keys are read here and nowhere else. `enqueueProcessing` never
 * throws: an unconfigured or failing queue is an outcome the submit route
 * stores on the record so nothing is lost.
 */
import { Client, Receiver } from "@upstash/qstash";
import { originFromHeaders } from "../report-notify.ts";

export const PROCESS_PATH = "/api/ask-summit/process";
const PUBLISH_RETRIES = 2;

export function isQueueConfigured(): boolean {
  return Boolean(process.env.QSTASH_TOKEN?.trim());
}

export type EnqueueResult = { ok: true; messageId: string } | { ok: false; error: string };

/** Publishes `{ requestId }` to the processing route with two retries; the bypass header lets QStash reach a protected preview. */
export async function enqueueProcessing(requestId: string, origin: string): Promise<EnqueueResult> {
  const token = process.env.QSTASH_TOKEN?.trim();
  if (!token) return { ok: false, error: "QSTASH_TOKEN is not set" };
  try {
    const client = new Client({ token });
    const headers: Record<string, string> = {};
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
    if (bypass) headers["x-vercel-protection-bypass"] = bypass;
    const response = await client.publishJSON({ url: `${origin}${PROCESS_PATH}`, body: { requestId }, retries: PUBLISH_RETRIES, headers });
    return { ok: true, messageId: response.messageId };
  } catch (err) {
    return { ok: false, error: (err instanceof Error ? err.message : String(err)).slice(0, 200) };
  }
}

export type SignatureVerdict = "ok" | "invalid" | "unconfigured";

/**
 * Verifies the `Upstash-Signature` header against the raw body and the
 * route's absolute URL with the current and next signing keys. A missing
 * key answers "unconfigured"; any failure, including a missing header,
 * answers "invalid".
 */
export async function verifyQueueSignature(req: Request, rawBody: string): Promise<SignatureVerdict> {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim();
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY?.trim();
  if (!currentSigningKey || !nextSigningKey) return "unconfigured";
  const signature = req.headers.get("upstash-signature");
  if (!signature) return "invalid";
  const url = `${originFromHeaders(req.headers)}${new URL(req.url).pathname}`;
  try {
    const receiver = new Receiver({ currentSigningKey, nextSigningKey });
    const valid = await receiver.verify({ signature, body: rawBody, url });
    return valid ? "ok" : "invalid";
  } catch {
    return "invalid";
  }
}
