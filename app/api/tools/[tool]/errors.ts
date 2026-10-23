/**
 * One mapping from pipeline error classes to a status and a visitor-safe
 * message, shared by the three generic tool routes. Debug detail is logged
 * server side, never returned.
 */
import { NextResponse } from "next/server";
import { LlmNotConfiguredError } from "@/app/lib/llm";
import { RubricNotPublishedError } from "@/app/lib/rubrics";
import { SchemaError } from "@/app/lib/tools/schema";
import {
  InputError,
  RunNotFoundError,
  ToolNotFoundError,
  UnlockRequiredError,
} from "@/app/lib/tools/pipeline";

export function errorResponse(err: unknown, context: string): NextResponse {
  if (err instanceof ToolNotFoundError) {
    return NextResponse.json({ error: "This tool is not available." }, { status: 404 });
  }
  if (err instanceof RunNotFoundError) {
    return NextResponse.json({ error: "Run not found. It may have expired." }, { status: 404 });
  }
  if (err instanceof InputError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof UnlockRequiredError) {
    return NextResponse.json({ error: "Unlock this run to see the full view." }, { status: 403 });
  }
  if (err instanceof RubricNotPublishedError) {
    console.error(`${context}: ${err.message}`);
    return NextResponse.json({ error: "rubric not published" }, { status: 503 });
  }
  if (err instanceof LlmNotConfiguredError) {
    console.error(`${context}: ${err.message}`);
    return NextResponse.json({ error: "model provider not configured" }, { status: 503 });
  }
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof SchemaError || /unusable answer|empty answer/.test(message)) {
    console.error(`${context}: ${message}`);
    return NextResponse.json({ error: "The model returned an unusable answer. Please try again." }, { status: 502 });
  }
  console.error(`${context}: ${message}`);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export const RATE_LIMIT_MESSAGE = (limit: number) =>
  `Too many evaluations. You have used ${limit} of ${limit} allowed per hour. Please try again later.`;
