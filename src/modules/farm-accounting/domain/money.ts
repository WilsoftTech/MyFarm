import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { isNonNegativeDecimal } from "@/modules/farmer-registry/domain/rules";

/** Stored as numeric(20,4) with an ISO 4217 code (D-P04-002). Amounts in different currencies are never combined. */
export const MONEY_INTEGER_DIGITS = 16;
export const MONEY_FRACTION_DIGITS = 4;
const scale = 10_000n;

export interface Money { amount: string; currency: string }

/** The runtime's ISO 4217 list; the server's list is authoritative. A runtime without the API accepts well-formed codes. */
const knownCurrencies: ReadonlySet<string> | null = typeof Intl.supportedValuesOf === "function" ? new Set(Intl.supportedValuesOf("currency")) : null;

/** Trimmed, uppercased three-letter ISO 4217 code, or null. No conversion between currencies exists (D-P04-002). */
export function normalizeCurrency(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) && (knownCurrencies === null || knownCurrencies.has(code)) ? code : null;
}

/** Exact fixed-point units (1 unit = 0.0001); decimal strings never pass through binary floating point. */
export function moneyUnits(amount: string): bigint {
  if (!isNonNegativeDecimal(amount, MONEY_INTEGER_DIGITS, MONEY_FRACTION_DIGITS)) throw new FoundationError("INVALID_INPUT");
  const [whole, fraction = ""] = amount.split(".");
  return BigInt(whole) * scale + BigInt(fraction.padEnd(MONEY_FRACTION_DIGITS, "0"));
}
/** Canonical decimal string: no leading zeros, no trailing fraction zeros ("150000", "0.5"). */
export function moneyString(units: bigint): string {
  if (units < 0n) throw new FoundationError("INVALID_INPUT");
  const fraction = (units % scale).toString().padStart(MONEY_FRACTION_DIGITS, "0").replace(/0+$/, "");
  return (units / scale).toString() + (fraction ? "." + fraction : "");
}

/**
 * Form digit strings ("150000", "0150000.50") or JSON safe integers; result is canonical and > 0.
 * Signs, exponents, separators ("150,000"), fractional numbers, more than 4 decimals or 16 whole digits fail.
 */
export function normalizePositiveAmount(value: unknown): string | null {
  const text = typeof value === "number" ? (Number.isSafeInteger(value) && value >= 0 ? String(value) : "") : typeof value === "string" ? value.trim() : "";
  if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
  const trimmed = text.replace(/^0+(?=\d)/, "");
  if (!isNonNegativeDecimal(trimmed, MONEY_INTEGER_DIGITS, MONEY_FRACTION_DIGITS)) return null;
  const units = moneyUnits(trimmed);
  return units > 0n ? moneyString(units) : null;
}
