/**
 * The research stage, server side: the pages the house style crawler reads
 * (same robots rules, same page cap, same host only; reused when the caller
 * crawled them in the same press), the Brandfetch description and industry
 * from the cached or live lookup, and one model call on
 * `builder-prototype-research`. Never throws: any failure, a blocked site
 * or nothing to read gives an empty profile, so research never fails a
 * build and spends nothing when there is nothing to read.
 *
 * The call takes the crawl result and the brand record and nothing from the
 * brief or the contact (AC 7); the host comes from the already resolved
 * website target.
 */
import { LlmNotConfiguredError, callModel } from "../llm.ts";
import { track } from "../events.ts";
import { crawlSite, crawlerUserAgent, fetchRobots } from "../ask-summit/crawler.ts";
import type { BrandData } from "./brand-data.ts";
import { lookupBrand } from "./brandfetch.ts";
import type { PrototypeWebsite } from "./prototype.ts";
import { PROTOTYPE_ROUTING_KEYS } from "./prototype.ts";
import { researchPrompt } from "./prompts.ts";
import { emptyProfile, parseResearch, profileFromParts, researchInputText, type CompanyProfile, type ResearchPage } from "./research.ts";
import { researchSchema } from "./schemas.ts";

// The crawl and the brand lookup take the same shares as the style read, so a
// profile built on its own (the background path) costs the same wall time as
// one built from a press that already crawled. The call cap is the AC 20
// figure for research; under MIN_CALL_MS left the call is skipped rather
// than started with no chance of finishing.
const CRAWL_BUDGET_MS = 14_000;
const BRAND_BUDGET_MS = 4_500;
const CALL_CAP_MS = 30_000;
const CALL_HEADROOM_MS = 5_000;
const MIN_CALL_MS = 15_000;
const PAGE_CAP = 3;
// Low, not zero: the profile should read naturally, but it must not invent.
const TEMPERATURE = 0.2;

export interface BuildProfileOptions {
  /** Epoch ms the whole build must finish by. */
  deadlineAt: number;
  /** Pages already crawled in this press; absent means one crawl here. */
  pageTexts?: ResearchPage[];
  /** The brand record the style read found; absent means a cache first lookup here. */
  brand?: BrandData | null;
  /** The brief id for the call log; null from the background save path before it has one. */
  briefId?: string | null;
}

/** Everything the build touches outside itself, so a test could run it with fakes. */
export interface ResearchDeps {
  crawl: (target: PrototypeWebsite, deadlineAt: number) => Promise<ResearchPage[]>;
  brand: (host: string, deadlineAt: number) => Promise<BrandData | null>;
  call: typeof callModel;
  now: () => number;
}

async function crawlPages(target: PrototypeWebsite, deadlineAt: number): Promise<ResearchPage[]> {
  const userAgent = crawlerUserAgent();
  const origin = new URL(target.url).origin;
  const robots = await fetchRobots(origin, userAgent);
  const store = await crawlSite(target.url, { deadlineAt, userAgent, maxPages: PAGE_CAP, robots });
  return store.pages.map((p) => ({ url: p.url, title: p.title, text: p.text }));
}

async function brandRecord(host: string, deadlineAt: number): Promise<BrandData | null> {
  const lookup = await lookupBrand(host, { deadlineAt });
  return lookup.data;
}

const realDeps: ResearchDeps = { crawl: crawlPages, brand: brandRecord, call: callModel, now: () => Date.now() };

/**
 * The company profile for the target. Order: no target gives an empty
 * profile with no call; the pages (passed in or crawled under 14 s); the
 * brand record (passed in or from the per domain cache first); no pages and
 * no brand text gives an empty profile with no call; else one research call
 * under the smaller of 30 s and the time left less 5 s.
 */
export async function buildCompanyProfile(target: PrototypeWebsite | null, opts: BuildProfileOptions, overrides: Partial<ResearchDeps> = {}): Promise<CompanyProfile> {
  const deps: ResearchDeps = { ...realDeps, ...overrides };
  if (!target) return emptyProfile(null);
  const host = target.host;
  const started = deps.now();

  let pages: ResearchPage[] = opts.pageTexts ?? [];
  if (!opts.pageTexts) {
    try {
      pages = await deps.crawl(target, Math.min(opts.deadlineAt, deps.now() + CRAWL_BUDGET_MS));
    } catch (err) {
      console.error("project-builder research: crawl failed", err instanceof Error ? err.message.slice(0, 200) : err);
      pages = [];
    }
  }

  let brand: BrandData | null = opts.brand ?? null;
  if (opts.brand === undefined) {
    try {
      brand = await deps.brand(host, Math.min(opts.deadlineAt, deps.now() + BRAND_BUDGET_MS));
    } catch {
      brand = null;
    }
  }
  const brandText = brand && (brand.description || brand.industry) ? { description: brand.description ?? "", industry: brand.industry ?? "" } : null;
  const input = researchInputText(pages, brandText);
  const sources = { pages: Math.min(pages.length, PAGE_CAP), brandfetch: brandText !== null };
  if (!input.trim()) {
    void track("builder_prototype_research", { ok: true, empty: true, pages: sources.pages, brand: sources.brandfetch, ms: deps.now() - started });
    return { ...emptyProfile(host), sources };
  }

  const remaining = opts.deadlineAt - deps.now();
  if (remaining < MIN_CALL_MS) {
    void track("builder_prototype_research", { ok: false, reason: "time", ms: deps.now() - started });
    return { ...emptyProfile(host), sources };
  }

  try {
    const prompt = researchPrompt(input);
    const result = await deps.call({
      routingKey: PROTOTYPE_ROUTING_KEYS.research,
      runId: opts.briefId ?? null,
      system: prompt.system,
      user: prompt.user,
      schema: researchSchema(),
      parse: parseResearch,
      temperature: TEMPERATURE,
      timeoutMs: Math.min(CALL_CAP_MS, remaining - CALL_HEADROOM_MS),
      tag: "research",
    });
    const profile = profileFromParts(result.data, { host, model: result.model, sources });
    void track("builder_prototype_research", { ok: true, empty: profile.empty, pages: sources.pages, brand: sources.brandfetch, model: result.model, ms: result.ms });
    return profile;
  } catch (err) {
    if (err instanceof LlmNotConfiguredError) throw err;
    console.error("project-builder research: call failed", err instanceof Error ? err.message.slice(0, 200) : err);
    void track("builder_prototype_research", { ok: false, reason: "model", ms: deps.now() - started });
    return { ...emptyProfile(host), sources };
  }
}
