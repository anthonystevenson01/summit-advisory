/**
 * One mapping from error classes to a status and a prospect safe message
 * for the Project Builder routes. Debug detail is logged server side, never
 * returned.
 */
import { NextResponse } from "next/server";
import { LlmNotConfiguredError } from "@/app/lib/llm";
import { SchemaError } from "@/app/lib/tools/schema";
import { BriefStateError } from "@/app/lib/project-builder/brief";

export const BRIEF_LOCKED_MESSAGE = "This brief has been submitted. Ask to change something from your brief page and Anthony will reopen it.";
export const UNUSABLE_MESSAGE = "The helper returned an unusable answer. Fill this step by hand or try again.";
export const RATE_LIMIT_MESSAGE = "Too many requests from this connection. Please try again later.";
export const GENERIC_MESSAGE = "Something went wrong. Please try again.";

/** A validation failure a route raises itself; answered 400 with its message. */
export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

export function builderErrorResponse(err: unknown, context: string): NextResponse {
  if (err instanceof BriefStateError || err instanceof InputError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof LlmNotConfiguredError) {
    console.error(`${context}: ${err.message}`);
    return NextResponse.json({ error: "model provider not configured" }, { status: 503 });
  }
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof SchemaError || /unusable answer|empty answer|ran out of tokens/.test(message)) {
    console.error(`${context}: ${message}`);
    return NextResponse.json({ error: UNUSABLE_MESSAGE }, { status: 502 });
  }
  console.error(`${context}: ${message}`);
  return NextResponse.json({ error: GENERIC_MESSAGE }, { status: 500 });
}
