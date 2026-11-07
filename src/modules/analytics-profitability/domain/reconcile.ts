import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import type { CostGroupTotals, CropMetrics } from "./metrics";
import type { CurrencyDashboard } from "./profitability";

/**
 * Reconciliation (R004, L gate "metrics reconcile"): independent checks that the figures on one screen add up,
 * per currency, before a farmer relies on them. Each check compares totals reached by different paths, so a
 * regression in one calculation shows as a failed check instead of a silently wrong figure. It reads only results,
 * never source records, and never corrects anything.
 */
export const RECONCILE_CHECKS = ["SURPLUS", "REVENUE_ADDS_UP", "COSTS_ADD_UP", "COST_GROUPS_ADD_UP", "CROP_MONEY_MATCHES"] as const;
export type ReconcileCheck = typeof RECONCILE_CHECKS[number];
export interface ReconcileFailure { check: ReconcileCheck; currency: string; expected: string; found: string; enterpriseId?: string }
export interface Reconciliation { reconciled: boolean; checked: number; failures: ReconcileFailure[] }

/** Exact 0.0001 units of a signed result. Totals may pass the size of one stored amount, so there is no digit limit. */
function units(value: string): bigint {
  const match = /^(-?)(\d{1,100})(?:\.(\d{1,4}))?$/.exec(value);
  if (!match) throw new FoundationError("INVALID_INPUT");
  const size = BigInt(match[2]) * 10_000n + BigInt((match[3] ?? "").padEnd(4, "0"));
  return match[1] ? -size : size;
}
function text(value: bigint): string {
  const size = value < 0n ? -value : value, fraction = (size % 10_000n).toString().padStart(4, "0").replace(/0+$/, "");
  return (value < 0n ? "-" : "") + (size / 10_000n).toString() + (fraction ? "." + fraction : "");
}
const sum = (values: readonly string[]) => values.reduce((total, value) => total + units(value), 0n);

/** `currencies`, `costGroups` and `crops` must all come from one view of one farm. */
export function reconcile(currencies: readonly CurrencyDashboard[], costGroups: readonly CostGroupTotals[], crops: readonly Pick<CropMetrics, "enterpriseId" | "currencies">[]): Reconciliation {
  const failures: ReconcileFailure[] = [];
  let checked = 0;
  const check = (check: ReconcileCheck, currency: string, expected: bigint, found: bigint, enterpriseId?: string) => {
    checked += 1;
    if (expected !== found) failures.push({ check, currency, expected: text(expected), found: text(found), ...(enterpriseId ? { enterpriseId } : {}) });
  };
  const byCurrency = new Map(currencies.map(row => [row.currency, row]));
  for (const row of currencies) {
    const revenue = units(row.revenue), expenses = units(row.expenses);
    check("SURPLUS", row.currency, revenue - expenses, units(row.recordedSurplus));
    check("REVENUE_ADDS_UP", row.currency, revenue, sum(row.enterprises.map(line => line.revenue)) + units(row.unassigned.revenue));
    check("COSTS_ADD_UP", row.currency, expenses, sum(row.enterprises.map(line => line.directCosts)) + units(row.unassigned.costs));
    const groups = costGroups.find(group => group.currency === row.currency);
    check("COST_GROUPS_ADD_UP", row.currency, expenses, groups ? sum([groups.labour, groups.inputs, groups.other]) : 0n);
  }
  // Cost groups in a currency the dashboard does not show are money the dashboard lost.
  for (const groups of costGroups) if (!byCurrency.has(groups.currency)) check("COST_GROUPS_ADD_UP", groups.currency, 0n, sum([groups.labour, groups.inputs, groups.other]));
  for (const crop of crops) for (const money of crop.currencies) {
    const line = byCurrency.get(money.currency)?.enterprises.find(row => row.enterpriseId === crop.enterpriseId);
    check("CROP_MONEY_MATCHES", money.currency, line ? units(line.directCosts) : 0n, units(money.costs), crop.enterpriseId);
    check("CROP_MONEY_MATCHES", money.currency, line ? units(line.revenue) : 0n, units(money.revenue), crop.enterpriseId);
  }
  return { reconciled: failures.length === 0, checked, failures };
}
