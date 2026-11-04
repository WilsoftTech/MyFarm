/**
 * The shape of every calculated figure (R002, D-P08-007): a value, or a stated reason it cannot be
 * calculated. A missing or zero denominator is never shown as 0.
 */
export const UNAVAILABLE_REASONS = ["NO_REVENUE", "NO_AREA", "NO_HARVEST", "MORE_THAN_ONE_CROP", "DATE_RANGE", "NO_BIRDS", "NEVER_SOLD"] as const;
export type UnavailableReason = typeof UNAVAILABLE_REASONS[number];
export type MetricValue = { status: "AVAILABLE"; value: string } | { status: "UNAVAILABLE"; reason: UnavailableReason };

export const available = (value: string): MetricValue => ({ status: "AVAILABLE", value });
export const unavailable = (reason: UnavailableReason): MetricValue => ({ status: "UNAVAILABLE", reason });

/**
 * numerator ÷ denominator, rounded half-up on its size to at most `decimals` places, without trailing zeros
 * ("560", "1333.33", "-5.5"). Integer arithmetic only, so no result depends on binary floating point, and a
 * value that rounds to nothing is "0", never "-0". The caller handles a zero denominator.
 */
export function ratioString(numerator: bigint, denominator: bigint, decimals: number): string {
  if (denominator <= 0n) throw new RangeError("A ratio needs a positive denominator");
  const size = numerator < 0n ? -numerator : numerator, scale = 10n ** BigInt(decimals);
  const scaled = (size * scale * 2n + denominator) / (2n * denominator);
  const fraction = decimals === 0 ? "" : (scaled % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  const text = (scaled / scale).toString() + (fraction ? "." + fraction : "");
  return numerator < 0n && scaled > 0n ? "-" + text : text;
}

/** numerator ÷ denominator as a percentage to one decimal ("38.7", "18", "-5.5"). */
export function percentString(numerator: bigint, denominator: bigint): string {
  return ratioString(numerator * 100n, denominator, 1);
}
