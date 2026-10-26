/**
 * Re-export shim. The registry at app/lib/tools/registry.ts is the single
 * description of every tool; new code imports it directly. This file stays
 * only because scale-up-content.ts and __tests__/scale-up-advisory.test.ts
 * import it.
 */
// Relative with the .ts extension: the untouched scale-up test loads this
// file under plain Node, where the @/ alias does not resolve.
import {
  PUBLIC_TOOL_COUNT,
  PUBLIC_TOOL_COUNT_WORD,
  TOOLS,
  TOOL_SLUGS,
  isToolHidden,
  isToolPublic,
  isToolSlug,
} from "../../lib/tools/registry.ts";
import type { ToolFaq, ToolSeo, ToolSlug } from "../../lib/tools/registry.ts";

export { PUBLIC_TOOL_COUNT, PUBLIC_TOOL_COUNT_WORD, TOOL_SLUGS, isToolHidden, isToolPublic, isToolSlug };
export type { ToolFaq, ToolSlug };

export const TOOL_SEO: Record<ToolSlug, ToolSeo> = Object.fromEntries(
  TOOLS.map((t) => [t.slug, t.seo]),
) as Record<ToolSlug, ToolSeo>;
