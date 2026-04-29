import type { MetadataRoute } from "next";

const BASE = "https://summitstrategyadvisory.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: BASE, lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${BASE}/ai-studio`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/loyalty-retail-media`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/scale-up-advisory`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/tools`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/tools/icp`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/tools/persona`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/tools/problem`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/tools/positioning`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/tools/moat`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/newsletter`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
  ];
}
