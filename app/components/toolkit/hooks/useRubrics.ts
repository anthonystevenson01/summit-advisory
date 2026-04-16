"use client";

import { useEffect, useState } from "react";

const CACHE_KEY = "gtm-rubrics-v2";

export interface Rubrics {
  icp: string;
  persona: string;
  positioning: string;
  problem: string;
  moat: string;
}

const EMPTY_RUBRICS: Rubrics = {
  icp: "",
  persona: "",
  positioning: "",
  problem: "",
  moat: "",
};

export interface UseRubricsResult {
  rubrics: Rubrics;
  loading: boolean;
  source: "cache" | "api" | "fallback";
  error: string | null;
}

export function useRubrics(): UseRubricsResult {
  const [rubrics, setRubrics] = useState<Rubrics>(EMPTY_RUBRICS);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"cache" | "api" | "fallback">("fallback");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    const loadRubrics = async () => {
      // Check session cache first
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached && !cancelled) {
          const parsed = JSON.parse(cached) as Partial<Rubrics>;
          setRubrics({ ...EMPTY_RUBRICS, ...parsed });
          setSource("cache");
          setLoading(false);
          return;
        }
      } catch {
        // ignore sessionStorage errors
      }

      try {
        const r = await fetch("/api/gtm/rubrics");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as Partial<Rubrics>;
        if (!cancelled) {
          const merged = { ...EMPTY_RUBRICS, ...data };
          setRubrics(merged);
          setSource("api");
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
          } catch {
            // ignore
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
          setSource("fallback");
          // Keep empty rubrics — tools still work without them
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadRubrics();
    return () => { cancelled = true; };
  }, []);

  return { rubrics, loading, source, error };
}
