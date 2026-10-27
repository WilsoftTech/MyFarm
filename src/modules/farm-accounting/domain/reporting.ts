import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { isCalendarDate } from "@/modules/enterprises-seasons/domain/production";
import { RECOGNITION_BASES, type RecognitionBasis, type RecognitionEvent } from "./accounting";
import { moneyString, moneyUnits, signedMoneyString } from "./money";

/**
 * Deterministic report arithmetic over recognizedEvents() output (R004/R005). Application code computes;
 * AI may only explain these results. Amounts are grouped per currency and never combined or converted
 * (D-P04-002). Only "gross margin" is computed: overhead, depreciation and finance costs, and therefore net
 * farm income, are Phase 8 (D-P04-004).
 */
export interface ReportRange { from?: string; to?: string }
export interface ReportScope extends ReportRange { basis: RecognitionBasis }

/** Inclusive calendar-date range; either end may be open. */
export function assertReportScope(scope: ReportScope): void {
  if (!RECOGNITION_BASES.includes(scope.basis)) throw new FoundationError("INVALID_INPUT");
  for (const date of [scope.from, scope.to]) if (date !== undefined && !isCalendarDate(date)) throw new FoundationError("INVALID_INPUT");
  if (scope.from && scope.to && scope.from > scope.to) throw new FoundationError("INVALID_INPUT");
}
/** Events of the requested basis whose recognition date falls in the range. */
export function eventsInScope(events: readonly RecognitionEvent[], scope: ReportScope): RecognitionEvent[] {
  assertReportScope(scope);
  return events.filter(event => {
    if (event.basis !== scope.basis) throw new FoundationError("INVALID_INPUT");
    return (!scope.from || event.recognizedOn >= scope.from) && (!scope.to || event.recognizedOn <= scope.to);
  });
}

interface Sums { revenue: bigint; costs: bigint }
const zero = (): Sums => ({ revenue: 0n, costs: 0n });
function add(sums: Sums, event: RecognitionEvent) {
  if (event.effect === "REVENUE") sums.revenue += moneyUnits(event.amount); else sums.costs += moneyUnits(event.amount);
}
function byCurrency(events: readonly RecognitionEvent[]) {
  const groups = new Map<string, RecognitionEvent[]>();
  for (const event of events) groups.set(event.currency, [...(groups.get(event.currency) ?? []), event]);
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export interface MarginLine { revenue: string; directCosts: string; grossMargin: string }
export interface EnterpriseMargin extends MarginLine { enterpriseId: string }
export interface CurrencyMargin {
  currency: string;
  enterprises: EnterpriseMargin[];
  /** Sum of enterprise margins only (D-P04-008). */
  farm: MarginLine;
  /** Revenue/costs not linked to an enterprise: shown, never deducted (overhead is Phase 8). */
  unassigned: { revenue: string; costs: string };
}
const margin = (sums: Sums): MarginLine => ({ revenue: moneyString(sums.revenue), directCosts: moneyString(sums.costs), grossMargin: signedMoneyString(sums.revenue - sums.costs) });

/** Enterprise gross margin = linked revenue − linked costs; farm = Σ enterprises (D-P04-008). */
export function grossMargin(events: readonly RecognitionEvent[]): CurrencyMargin[] {
  return byCurrency(events).map(([currency, rows]) => {
    const enterprises = new Map<string, Sums>(), unassigned = zero(), farm = zero();
    for (const event of rows) {
      if (!event.enterpriseId) { add(unassigned, event); continue; }
      const sums = enterprises.get(event.enterpriseId) ?? zero();
      add(sums, event); add(farm, event); enterprises.set(event.enterpriseId, sums);
    }
    return {
      currency,
      enterprises: [...enterprises.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([enterpriseId, sums]) => ({ enterpriseId, ...margin(sums) })),
      farm: margin(farm),
      unassigned: { revenue: moneyString(unassigned.revenue), costs: moneyString(unassigned.costs) },
    };
  });
}

export interface CategoryTotal { categoryId: string | null; categoryName: string; amount: string }
export interface CurrencySummary {
  currency: string;
  /** "How much money have I spent?" — all cost events in scope. */
  spent: string;
  /** "What did I spend it on?" — largest first, then by name. */
  spending: CategoryTotal[];
  /** "How much revenue have I earned?" */
  revenue: string;
  /** "Which enterprise is costing me the most?" — every enterprise tied for the highest linked costs; empty if none. */
  costliest: { enterpriseIds: string[]; costs: string };
  unassignedCosts: string;
}
const UNNAMED = "Uncategorised";

export function moneySummary(events: readonly RecognitionEvent[]): CurrencySummary[] {
  return byCurrency(events).map(([currency, rows]) => {
    let spent = 0n, revenue = 0n, unassignedCosts = 0n;
    const categories = new Map<string, { categoryId: string | null; categoryName: string; units: bigint }>(), enterprises = new Map<string, bigint>();
    for (const event of rows) {
      const units = moneyUnits(event.amount);
      if (event.effect === "REVENUE") { revenue += units; continue; }
      spent += units;
      const key = event.categoryId ?? "";
      const category = categories.get(key) ?? { categoryId: event.categoryId, categoryName: event.categoryName ?? UNNAMED, units: 0n };
      category.units += units; categories.set(key, category);
      if (event.enterpriseId) enterprises.set(event.enterpriseId, (enterprises.get(event.enterpriseId) ?? 0n) + units);
      else unassignedCosts += units;
    }
    const highest = [...enterprises.values()].reduce((max, units) => units > max ? units : max, 0n);
    return {
      currency, spent: moneyString(spent), revenue: moneyString(revenue), unassignedCosts: moneyString(unassignedCosts),
      spending: [...categories.values()].sort((a, b) => (a.units === b.units ? 0 : a.units > b.units ? -1 : 1) || a.categoryName.localeCompare(b.categoryName) || (a.categoryId ?? "").localeCompare(b.categoryId ?? ""))
        .map(({ categoryId, categoryName, units }) => ({ categoryId, categoryName, amount: moneyString(units) })),
      costliest: { enterpriseIds: highest > 0n ? [...enterprises.entries()].filter(([, units]) => units === highest).map(([id]) => id).sort() : [], costs: moneyString(highest) },
    };
  });
}
