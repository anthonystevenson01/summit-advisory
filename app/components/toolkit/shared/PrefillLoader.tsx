"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { SLUG_PATTERN } from "@/app/lib/tools/report-model";

const RUN_ID_PATTERN = /^run_[0-9a-f]{16}$/;

export interface PrefillPayload {
  runId: string;
  tool: string;
  inputs: Record<string, string>;
  /** The prospect report slug when the link came from a report's working (`via=report`). */
  report?: string;
}

export interface PrefillLoaderProps {
  /** The query parameter that carries the run id: `from` on the Built to Scale? page, `prefill` on a tool page. */
  param: "from" | "prefill";
  /** Which hand-off this is, for the event the endpoint records. The URL's own `via=report` and `report` override it. */
  via: "tool" | "scorecard" | "report";
  onLoaded: (payload: PrefillPayload) => void;
}

/**
 * Reads the named query parameter and, when it is a run id, fetches that
 * run's inputs once from the prefill endpoint and hands them to the owner.
 * Lives under Suspense in its parent so useSearchParams does not opt the
 * page out of static rendering. State is handed back only in the async
 * continuation; the ref guards strict mode's double effect; any failure
 * does nothing and the normal page shows. When the URL itself says
 * `via=report` with a well formed `report` slug, the fetch carries both and
 * the slug is handed back so the next score counts on that report.
 */
export default function PrefillLoader({ param, via, onLoaded }: PrefillLoaderProps) {
  const searchParams = useSearchParams();
  const started = useRef(false);

  useEffect(() => {
    const runId = searchParams.get(param) ?? "";
    if (started.current || !RUN_ID_PATTERN.test(runId)) return;
    started.current = true;
    const reportParam = searchParams.get("report") ?? "";
    const report = searchParams.get("via") === "report" && SLUG_PATTERN.test(reportParam) ? reportParam : null;
    const query = report ? `via=report&report=${encodeURIComponent(report)}` : `via=${via}`;
    fetch(`/api/built-to-scale/prefill?runId=${encodeURIComponent(runId)}&${query}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as Partial<PrefillPayload>;
        if (!data.runId || typeof data.tool !== "string" || typeof data.inputs !== "object" || data.inputs === null) return;
        onLoaded({ runId: data.runId, tool: data.tool, inputs: data.inputs, ...(report ? { report } : {}) });
      })
      .catch(() => {
        // an unknown or expired run shows the normal page
      });
  }, [searchParams, param, via, onLoaded]);

  return null;
}
