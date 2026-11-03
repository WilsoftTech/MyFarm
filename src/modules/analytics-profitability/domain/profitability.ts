import type { RecognitionEvent } from "@/modules/farm-accounting/domain/accounting";
import { moneyString, moneyUnits, signedMoneyString } from "@/modules/farm-accounting/domain/money";
import { grossMargin, type EnterpriseMargin, type MarginLine } from "@/modules/farm-accounting/domain/reporting";
import { available, percentString, unavailable, type MetricValue } from "./metric";

/**
 * The season dashboard (R001). Application code computes; AI may only explain these results. Builds on the
 * Phase 4 enterprise gross margin, so both screens always agree. Recorded surplus deducts every recognized
 * cost, including costs linked to no enterprise (D-P08-002). Depreciation and loans are not recorded, so
 * nothing here is net profit. Amounts in different currencies are never combined (D-P04-002).
 */
export interface EnterpriseName { enterpriseId: string; name: string }
export interface EnterpriseComparison extends EnterpriseMargin { name: string; marginPercent: MetricValue }
export interface CurrencyDashboard {
  currency: string;
  revenue: string;
  expenses: string;
  recordedSurplus: string;
  /** Recorded surplus ÷ revenue: the source's "Margin". */
  surplusMargin: MetricValue;
  /** Highest gross margin first; ties by name, so the order is stable. */
  enterprises: EnterpriseComparison[];
  /** Every enterprise tied for the highest gross margin. */
  topEnterpriseIds: string[];
  allEnterprises: MarginLine;
  /** Linked to no enterprise: deducted from the surplus, never shared out among enterprises (D-P08-002). */
  unassigned: { revenue: string; costs: string };
}

const marginOf = (revenue: bigint, costs: bigint): MetricValue => revenue === 0n ? unavailable("NO_REVENUE") : available(percentString(revenue - costs, revenue));
const unitsOf = (line: MarginLine) => ({ revenue: moneyUnits(line.revenue), costs: moneyUnits(line.directCosts) });

export function farmDashboard(events: readonly RecognitionEvent[], names: readonly EnterpriseName[]): CurrencyDashboard[] {
  const nameOf = new Map(names.map(row => [row.enterpriseId, row.name]));
  return grossMargin(events).map(currency => {
    const rows = currency.enterprises.map(line => {
      const { revenue, costs } = unitsOf(line);
      return { margin: revenue - costs, line: { ...line, name: nameOf.get(line.enterpriseId) ?? "", marginPercent: marginOf(revenue, costs) } };
    }).sort((a, b) => a.margin === b.margin ? a.line.name.localeCompare(b.line.name) || a.line.enterpriseId.localeCompare(b.line.enterpriseId) : a.margin > b.margin ? -1 : 1);
    const all = unitsOf(currency.farm);
    const revenue = all.revenue + moneyUnits(currency.unassigned.revenue), expenses = all.costs + moneyUnits(currency.unassigned.costs);
    return {
      currency: currency.currency, revenue: moneyString(revenue), expenses: moneyString(expenses), recordedSurplus: signedMoneyString(revenue - expenses), surplusMargin: marginOf(revenue, expenses),
      enterprises: rows.map(row => row.line), topEnterpriseIds: rows.filter(row => row.margin === rows[0].margin).map(row => row.line.enterpriseId).sort(),
      allEnterprises: currency.farm, unassigned: currency.unassigned,
    };
  });
}

/** Amounts in a currency linked to no season, shown beside a season view (D-P08-008). */
export interface UnlinkedAmounts { currency: string; revenue: string; costs: string }
export interface SeasonEvents { events: RecognitionEvent[]; notLinkedToSeason: UnlinkedAmounts[] }

/**
 * A season counts only records linked to it, never records that merely fall within its dates, because seasons
 * may overlap (D-P03-002, D-P08-008). Records linked to another season belong to that season alone.
 */
export function seasonEvents(events: readonly RecognitionEvent[], seasonId: string): SeasonEvents {
  const unlinked = new Map<string, { revenue: bigint; costs: bigint }>();
  for (const event of events) {
    if (event.seasonId) continue;
    const sums = unlinked.get(event.currency) ?? { revenue: 0n, costs: 0n };
    if (event.effect === "REVENUE") sums.revenue += moneyUnits(event.amount); else sums.costs += moneyUnits(event.amount);
    unlinked.set(event.currency, sums);
  }
  return {
    events: events.filter(event => event.seasonId === seasonId),
    notLinkedToSeason: [...unlinked.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([currency, sums]) => ({ currency, revenue: moneyString(sums.revenue), costs: moneyString(sums.costs) })),
  };
}

export interface SeasonChoice { seasonId: string; status: "ACTIVE" | "CLOSED"; startDate: string }

/** The default view: the active season that started most recently, or none when no season is active (D-P08-008). */
export function latestActiveSeason<T extends SeasonChoice>(seasons: readonly T[]): T | null {
  return seasons.filter(season => season.status === "ACTIVE").sort((a, b) => b.startDate.localeCompare(a.startDate) || a.seasonId.localeCompare(b.seasonId))[0] ?? null;
}
