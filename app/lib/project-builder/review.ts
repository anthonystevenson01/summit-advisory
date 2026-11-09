/**
 * The senior review of a plan: gaps the plan misses and at most five
 * recommendations, each marked apply or suggest. Pure: the parse and cap of
 * the model's answer, and the merge the server runs before building. The
 * merge only ever appends components, screens and coverage entries, so no
 * recommendation can add an integration, a role or a requirement to the
 * brief; ideas the prospect turned down are dropped before anything is
 * merged.
 */
import { SchemaError } from "../tools/schema.ts";
import { PROTOTYPE_SCREENS_MAX } from "./prototype.ts";
import {
  cleanSlug,
  parseComponent,
  parseScreen,
  type CoverageItem,
  type PlanComponent,
  type PlanScreen,
  type PrototypePlan,
} from "./plan.ts";

export type ReviewMode = "apply" | "suggest";

export interface ReviewGap {
  text: string;
  /** A coverage item id, or "" when the gap is general. */
  itemId: string;
  /** A planned slug, or "" when no one screen is meant. */
  screen: string;
}

export interface ReviewRecommendation {
  title: string;
  why: string;
  /** The brief line or profile fact it rests on; never empty. */
  basedOn: string;
  mode: ReviewMode;
  screen: string;
  component: PlanComponent | null;
  newScreen: PlanScreen | null;
}

export interface PlanReview {
  builtAt: string;
  model: string;
  gaps: ReviewGap[];
  recommendations: ReviewRecommendation[];
}

export const REVIEW_GAPS_CAP = 8;
export const REVIEW_RECOMMENDATIONS_CAP = 5;
export const REVIEW_TEXT_CHARS = 300;
export const REVIEW_TITLE_CHARS = 80;
export const TURNED_DOWN_SUFFIX = " (turned down, not applied)";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, cap: number): string {
  return typeof value === "string" ? value.replace(/\s*[–—]\s*/g, ", ").replace(/\s+/g, " ").trim().slice(0, cap) : "";
}

/**
 * The parser: at most eight gaps and five recommendations; `basedOn` must be
 * given; a recommendation whose screen is not a planned slug and whose new
 * screen is empty is kept as `suggest` whatever it said.
 */
export function parseReviewAnswer(raw: unknown, plan: PrototypePlan, items: readonly CoverageItem[], meta: { model: string; builtAt?: string }): PlanReview {
  if (!isRecord(raw)) throw new SchemaError("answer is not an object");
  const slugs = new Set(plan.screens.map((s) => s.slug));
  const ids = new Set(items.map((i) => i.id));
  const gaps: ReviewGap[] = [];
  for (const g of Array.isArray(raw.gaps) ? raw.gaps : []) {
    if (!isRecord(g)) continue;
    const text = cleanString(g.text, REVIEW_TEXT_CHARS);
    if (!text) continue;
    const itemId = typeof g.itemId === "string" && ids.has(g.itemId.trim()) ? g.itemId.trim() : "";
    const screen = cleanSlug(g.screen);
    gaps.push({ text, itemId, screen: slugs.has(screen) ? screen : "" });
    if (gaps.length >= REVIEW_GAPS_CAP) break;
  }
  const recommendations: ReviewRecommendation[] = [];
  for (const r of Array.isArray(raw.recommendations) ? raw.recommendations : []) {
    if (!isRecord(r)) continue;
    const title = cleanString(r.title, REVIEW_TITLE_CHARS);
    const basedOn = cleanString(r.basedOn, REVIEW_TEXT_CHARS);
    if (!title || !basedOn) continue;
    const screenSlug = cleanSlug(r.screen);
    const screen = slugs.has(screenSlug) ? screenSlug : "";
    const component = parseComponent(r.component);
    let newScreen = parseScreen(r.newScreen);
    if (newScreen && slugs.has(newScreen.slug)) newScreen = { ...newScreen, slug: `${newScreen.slug.slice(0, 20)}-new` };
    let mode: ReviewMode = r.mode === "apply" ? "apply" : "suggest";
    if (!screen && !newScreen) mode = "suggest";
    recommendations.push({ title, why: cleanString(r.why, REVIEW_TEXT_CHARS), basedOn, mode, screen, component, newScreen });
    if (recommendations.length >= REVIEW_RECOMMENDATIONS_CAP) break;
  }
  return { builtAt: meta.builtAt ?? new Date().toISOString(), model: meta.model, gaps, recommendations };
}

/**
 * A plain substring match on the idea's title: the prompt already tells the
 * reviewer not to recommend turned down ideas, so this is the code side of
 * the same rule, and a title the reviewer repeats word for word is the case
 * worth catching. A reworded recommendation can pass; it is still only
 * advice to the builder, never a requirement.
 */
function namesTurnedDown(rec: ReviewRecommendation, turnedDown: readonly string[]): boolean {
  const text = `${rec.title} ${rec.basedOn} ${rec.why}`.toLowerCase();
  return turnedDown.some((idea) => {
    const needle = idea.trim().toLowerCase();
    return needle.length > 0 && text.includes(needle);
  });
}

export interface MergeResult {
  plan: PrototypePlan;
  /** The review as merged: a recommendation demoted by the screen cap shows as `suggest`. */
  review: PlanReview;
  /** Titles dropped because they named an idea the prospect turned down. */
  dropped: string[];
}

/**
 * Apply items change the plan: a component is appended to its screen, a new
 * screen is appended while the count stays at or under the cap (else it is
 * demoted to suggest), and a gap with an item and a screen adds a coverage
 * entry. Suggest items change nothing. A recommendation naming a turned
 * down idea is dropped before anything is merged and listed with a suffix.
 */
export function mergeReviewIntoPlan(plan: PrototypePlan, review: PlanReview, turnedDown: readonly string[]): MergeResult {
  const screens = plan.screens.map((s) => ({ ...s, components: s.components.slice(), entities: s.entities.slice() }));
  const coverage = plan.coverage.slice();
  const applied: string[] = [];
  const suggested: string[] = [];
  const dropped: string[] = [];
  const kept: ReviewRecommendation[] = [];

  for (const rec of review.recommendations) {
    if (namesTurnedDown(rec, turnedDown)) {
      dropped.push(rec.title);
      suggested.push(`${rec.title}${TURNED_DOWN_SUFFIX}`);
      continue;
    }
    let mode = rec.mode;
    if (mode === "apply") {
      let done = false;
      if (rec.newScreen) {
        if (screens.length < PROTOTYPE_SCREENS_MAX && !screens.some((s) => s.slug === rec.newScreen!.slug)) {
          screens.push(rec.newScreen);
          done = true;
        }
      } else if (rec.component && rec.screen) {
        const target = screens.find((s) => s.slug === rec.screen);
        if (target) {
          target.components.push(rec.component);
          done = true;
        }
      } else if (rec.screen) {
        // An apply item with a screen but no component changes nothing structural; it still counts as applied advice for the builder.
        done = true;
      }
      if (!done) mode = "suggest";
    }
    kept.push({ ...rec, mode });
    (mode === "apply" ? applied : suggested).push(rec.title);
  }

  const slugs = new Set(screens.map((s) => s.slug));
  for (const gap of review.gaps) {
    if (!gap.itemId || !gap.screen || !slugs.has(gap.screen)) continue;
    if (coverage.some((c) => c.id === gap.itemId && c.screen === gap.screen)) continue;
    coverage.push({ id: gap.itemId, screen: gap.screen, component: "" });
  }

  return {
    plan: { ...plan, screens, coverage, reviewApplied: [...plan.reviewApplied, ...applied], reviewSuggested: [...plan.reviewSuggested, ...suggested] },
    review: { ...review, recommendations: kept },
    dropped,
  };
}

/** The suggest only recommendations as `title: why` lines for the Notion page. */
export function suggestionLines(review: PlanReview | null | undefined): string[] {
  if (!review) return [];
  return review.recommendations.filter((r) => r.mode === "suggest").map((r) => (r.why ? `${r.title}: ${r.why}` : r.title));
}
