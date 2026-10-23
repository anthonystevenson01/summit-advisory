/**
 * The revenue ceiling per head: units one person delivers in a period,
 * multiplied by the price of a unit, multiplied by the periods in a year.
 *
 * Pure and dependency free (no imports, no Node built-ins, no Intl currency
 * style), so it is safe in client components, server components, tests and
 * scripts. The details model returns the three inputs with the assumption
 * behind each; this module computes the figure. It never estimates a missing
 * input: when any input is null, zero, negative or not finite the result is
 * null and the caller says which inputs the text did not support.
 */

export type CeilingInputKey = "unitsPerPersonPerPeriod" | "pricePerUnit" | "periodsPerYear";

/** The three keys in the order the schema, the parser, the calculator and the renderer use. */
export const CEILING_INPUT_KEYS: readonly CeilingInputKey[] = [
  "unitsPerPersonPerPeriod",
  "pricePerUnit",
  "periodsPerYear",
];

export const CEILING_INPUT_LABELS: Record<CeilingInputKey, string> = {
  unitsPerPersonPerPeriod: "Units per person per period",
  pricePerUnit: "Price per unit",
  periodsPerYear: "Periods per year",
};

export interface CeilingInput {
  value: number | null;
  assumption: string;
}

/** What the model returns, what the run stores, and what the renderer reads. */
export type CeilingInputs = Record<CeilingInputKey, CeilingInput>;

export interface CeilingAssumption {
  key: CeilingInputKey;
  label: string;
  value: number;
  text: string;
}

export interface CeilingResult {
  value: number;
  currency: string;
  formatted: string;
  /** Always three entries, in CEILING_INPUT_KEYS order. */
  assumptions: CeilingAssumption[];
}

export const DEFAULT_CURRENCY = "CAD";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True when the value has all three inputs, each with a number or null value and a string assumption. */
export function isCeilingInputs(value: unknown): value is CeilingInputs {
  if (!isRecord(value)) return false;
  for (const key of CEILING_INPUT_KEYS) {
    const input = value[key];
    if (!isRecord(input)) return false;
    if (input.value !== null && typeof input.value !== "number") return false;
    if (typeof input.assumption !== "string") return false;
  }
  return true;
}

/**
 * True only for a finite number greater than zero. Zero is unsupported
 * because a zero input means the text gave nothing usable, not a zero ceiling.
 */
export function isSupportedCeilingValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** The keys, in order, whose value cannot feed the calculation. Empty when the figure can be computed. */
export function unsupportedCeilingInputs(inputs: CeilingInputs): CeilingInputKey[] {
  return CEILING_INPUT_KEYS.filter((key) => !isSupportedCeilingValue(inputs[key]?.value));
}

function normaliseCurrency(currency: string | undefined): string {
  const code = (currency ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : DEFAULT_CURRENCY;
}

/**
 * Multiplies the three inputs and rounds to the nearest whole unit of
 * currency. Returns null when any input is unsupported; there is no default
 * and no partial result.
 */
export function computeCeiling(inputs: CeilingInputs, currency?: string): CeilingResult | null {
  if (unsupportedCeilingInputs(inputs).length > 0) return null;
  const units = inputs.unitsPerPersonPerPeriod.value as number;
  const price = inputs.pricePerUnit.value as number;
  const periods = inputs.periodsPerYear.value as number;
  const value = Math.round(units * price * periods);
  const code = normaliseCurrency(currency);
  return {
    value,
    currency: code,
    formatted: `${code} ${value.toLocaleString("en-GB")}`,
    assumptions: CEILING_INPUT_KEYS.map((key) => ({
      key,
      label: CEILING_INPUT_LABELS[key],
      value: inputs[key].value as number,
      text: inputs[key].assumption.trim(),
    })),
  };
}
