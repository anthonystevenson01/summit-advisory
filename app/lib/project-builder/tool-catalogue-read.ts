/**
 * The read API over the generated requirement catalogue. Pure and
 * synchronous: it reads the committed data module and nothing else, so no
 * request ever touches docs/.
 *
 * There are exactly two doors to a category. `publishedCategories` and
 * `getCategory` return published categories only. The one way to reach an
 * unpublished category is `allCategoriesIncludingUnpublished`, named so that
 * a caller cannot show one by accident. Every other function takes a
 * category value.
 *
 * The categories a reader hands out are deeply frozen copies, made once when
 * the reader is created. This module is loaded once per server process, so a
 * consumer that changed a category would change it for every later request;
 * frozen, the attempt throws instead.
 */
import { TOOL_CATEGORIES } from "./tool-catalogue.generated.ts";
import {
  ALL_PRODUCTS,
  type CatalogueGroup,
  type CatalogueMark,
  type CatalogueProduct,
  type CatalogueRequirement,
  type ScreenPattern,
  type ToolCategory,
} from "./tool-catalogue.ts";

export interface CatalogueReader {
  publishedCategories(): readonly ToolCategory[];
  getCategory(type: string): ToolCategory | null;
  allCategoriesIncludingUnpublished(): readonly ToolCategory[];
}

/** A copy of plain data (objects, arrays and primitives) with every level frozen. The value passed in is left as it was. */
function frozenCopy<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map((item) => frozenCopy(item))) as T;
  if (typeof value === "object" && value !== null) {
    const copy: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) copy[key] = frozenCopy(child);
    return Object.freeze(copy) as T;
  }
  return value;
}

/**
 * The two doors over any data, in `type` order. The reader holds deeply
 * frozen copies, so the data passed in is not touched and what comes out
 * cannot be changed. The module level functions below are this reader over
 * the generated data.
 */
export function createCatalogueReader(categories: readonly ToolCategory[]): CatalogueReader {
  const all = Object.freeze(categories.map((category) => frozenCopy(category)).sort((a, b) => (a.type < b.type ? -1 : a.type > b.type ? 1 : 0)));
  const published = Object.freeze(all.filter((category) => category.published));
  return {
    publishedCategories: () => published,
    getCategory: (type) => published.find((category) => category.type === type) ?? null,
    allCategoriesIncludingUnpublished: () => all,
  };
}

const reader = createCatalogueReader(TOOL_CATEGORIES);

// Door 1: published only.

export function publishedCategories(): readonly ToolCategory[] {
  return reader.publishedCategories();
}

/** Null for an unknown type and for an unpublished one. */
export function getCategory(type: string): ToolCategory | null {
  return reader.getCategory(type);
}

// Door 2: the explicitly named one. Tests, admin and scripts only.

export function allCategoriesIncludingUnpublished(): readonly ToolCategory[] {
  return reader.allCategoriesIncludingUnpublished();
}

// Views of one category.

export interface RequirementWithGroup extends CatalogueRequirement {
  group: string;
}

/** Every requirement in group order, then row order, with its group's name. */
export function requirementsOf(category: ToolCategory): readonly RequirementWithGroup[] {
  return category.groups.flatMap((group) => group.requirements.map((requirement) => ({ ...requirement, group: group.name })));
}

export function baselineRequirementsOf(category: ToolCategory): readonly RequirementWithGroup[] {
  return requirementsOf(category).filter((requirement) => requirement.baseline);
}

export function groupsOf(category: ToolCategory): readonly CatalogueGroup[] {
  return category.groups;
}

export function screenPatternsOf(category: ToolCategory): readonly ScreenPattern[] {
  return category.patterns;
}

/** Marked products only; the names still to mark are not products yet. */
export function productsOf(category: ToolCategory): readonly CatalogueProduct[] {
  return category.products;
}

export interface ProductMark {
  mark: CatalogueMark;
  comment: string | null;
  evidence: string | null;
}

/**
 * A product's mark for one requirement, with the comment for that product
 * (or, failing that, the comment for every product) and the evidence row.
 * Null when the category has no coverage or the product or the id is
 * unknown. Matching is exact and case sensitive.
 */
export function productMark(category: ToolCategory, productName: string, requirementId: string): ProductMark | null {
  const coverage = category.coverage;
  if (!coverage) return null;
  const column = coverage.products.indexOf(productName);
  if (column < 0) return null;
  const row = coverage.rows.find((candidate) => candidate.id === requirementId);
  const mark = row?.marks[column];
  if (!mark) return null;
  const own = category.comments.find((comment) => comment.id === requirementId && comment.product === productName);
  const shared = category.comments.find((comment) => comment.id === requirementId && comment.product === ALL_PRODUCTS);
  const evidence = category.evidence.find((candidate) => candidate.id === requirementId && candidate.product === productName);
  return { mark, comment: own?.text ?? shared?.text ?? null, evidence: evidence?.text ?? null };
}
