/**
 * Input and unlock validation, and the plain text rendering of inputs the
 * prompts use. Pure: no Redis, no network.
 */
import type { ToolEntry } from "./registry.ts";

export type ToolInputs = Record<string, string>;

export type InputValidation =
  | { ok: true; inputs: ToolInputs }
  | { ok: false; error: string };

const IGNORED_KEYS = new Set(["rubric", "systemPrompt"]);

/**
 * Validates a request body against the registry inputs. Unknown keys
 * (including `rubric` and `systemPrompt`) are dropped. Values are trimmed.
 */
export function validateInputs(entry: ToolEntry, body: unknown): InputValidation {
  const source = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const inputs: ToolInputs = {};
  for (const input of entry.inputs) {
    if (IGNORED_KEYS.has(input.key)) continue;
    const raw = source[input.key];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (input.required && value.length === 0) {
      return { ok: false, error: `${input.label} is required.` };
    }
    if (value.length > 0 && value.length < input.minLength) {
      return { ok: false, error: `${input.label} must be at least ${input.minLength} characters.` };
    }
    if (value.length > input.maxLength) {
      return { ok: false, error: `${input.label} must be under ${input.maxLength.toLocaleString("en-GB")} characters.` };
    }
    inputs[input.key] = value;
  }
  return { ok: true, inputs };
}

export type UnlockValidation =
  | { ok: true; name: string; email: string; company: string }
  | { ok: false; error: string };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateUnlock(body: unknown): UnlockValidation {
  const source = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const name = typeof source.name === "string" ? source.name.trim() : "";
  const email = typeof source.email === "string" ? source.email.trim() : "";
  const company = typeof source.company === "string" ? source.company.trim() : "";
  if (!name || !email || !company) {
    return { ok: false, error: "Name, email, and company are required." };
  }
  if (!EMAIL_REGEX.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  return { ok: true, name, email, company };
}

/** `Label:\nvalue` per non-empty input, blank line between. */
export function renderInputs(entry: ToolEntry, inputs: ToolInputs): string {
  const parts: string[] = [];
  for (const input of entry.inputs) {
    const value = (inputs[input.key] ?? "").trim();
    if (!value) continue;
    parts.push(`${input.label}:\n${value}`);
  }
  return parts.join("\n\n");
}
