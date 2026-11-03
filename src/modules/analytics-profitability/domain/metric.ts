/**
 * The shape of every calculated figure (R002, D-P08-007): a value, or a stated reason it cannot be
 * calculated. A missing or zero denominator is never shown as 0.
 */
export const UNAVAILABLE_REASONS = ["NO_REVENUE"] as const;
export type UnavailableReason = typeof UNAVAILABLE_REASONS[number];
export type MetricValue = { status: "AVAILABLE"; value: string } | { status: "UNAVAILABLE"; reason: UnavailableReason };

export const available = (value: string): MetricValue => ({ status: "AVAILABLE", value });
export const unavailable = (reason: UnavailableReason): MetricValue => ({ status: "UNAVAILABLE", reason });

/**
 * numerator ÷ denominator as a percentage, rounded half-up on its size to one decimal ("38.7", "18", "-5.5").
 * Integer arithmetic only, so no result depends on binary floating point. The caller handles a zero denominator.
 */
export function percentString(numerator: bigint, denominator: bigint): string {
  if (denominator <= 0n) throw new RangeError("A percentage needs a positive denominator");
  const size = numerator < 0n ? -numerator : numerator;
  const tenths = (size * 2000n + denominator) / (2n * denominator);
  const text = (tenths / 10n).toString() + (tenths % 10n === 0n ? "" : "." + (tenths % 10n).toString());
  return numerator < 0n && tenths > 0n ? "-" + text : text;
}
