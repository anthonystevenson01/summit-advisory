"use client";

import { useEffect, useState } from "react";
import { FALLBACK_PROMPTS } from "../data/fallbackPrompts";

const CACHE_KEY = "gtm-prompts-v1";

export interface Prompts {
  positioning: string;
  problem: string;
  persona: string;
  moat: string;
  account: string;
}

export interface UsePromptsResult {
  prompts: Prompts;
  loading: boolean;
  source: "cache" | "api" | "fallback";
  error: string | null;
}

export function usePrompts(): UsePromptsResult {
  const [prompts, setPrompts] = useState<Prompts>(FALLBACK_PROMPTS as unknown as Prompts);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"cache" | "api" | "fallback">("fallback");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // SSR guard — window is not available server-side
    if (typeof window === "undefined") return;

    let cancelled = false;

    const loadPrompts = async () => {
      // Check session cache first
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached && !cancelled) {
          const parsed = JSON.parse(cached) as Partial<Prompts>;
          setPrompts({ ...FALLBACK_PROMPTS, ...parsed } as unknown as Prompts);
          setSource("cache");
          setLoading(false);
          return;
        }
      } catch {
        // ignore sessionStorage errors
      }

      try {
        const r = await fetch("/api/prompts");
        const data = (await r.json()) as Partial<Prompts>;
        if (!cancelled) {
          const merged = { ...FALLBACK_PROMPTS, ...data } as unknown as Prompts;
          setPrompts(merged);
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
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPrompts();
    return () => { cancelled = true; };
  }, []);

  return { prompts, loading, source, error };
}
