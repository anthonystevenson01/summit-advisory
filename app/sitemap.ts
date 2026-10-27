import type { MetadataRoute } from "next";
// Relative with the .ts extension: __tests__/scale-up-advisory.test.ts loads this file under plain Node.
import { PUBLIC_TOOLS } from "./lib/tools/registry.ts";

const BASE = "https://summitstrategyadvisory.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: BASE, lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${BASE}/ai-studio`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/loyalty-retail-media`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/scale-up-advisory`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/scale-up-advisory/fractional-executive`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/scale-up-advisory/outsourced-sales`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/tools`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    ...PUBLIC_TOOLS.map((tool) => ({
      url: tool.seo.canonical,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${BASE}/tools/built-to-scale`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/tools/built-to-scale/method`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/tools/ask-summit`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/newsletter`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
  ];
}
