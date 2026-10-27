import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { authorizeProductionFarm, parseProductionInput as parse, type ProductionFarmAccess } from "@/modules/enterprises-seasons/application/farm-access";
import { reportQuerySchema, type FarmReportRepository, type GrossMarginView, type MoneySummaryView, type ReportLabels } from "../contracts/accounting";
import { recognizedEvents } from "../domain/accounting";
import { eventsInScope, grossMargin, moneySummary } from "../domain/reporting";

/** One CSV cell; text that a spreadsheet would run as a formula is prefixed so it stays text. */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) && !/^-\d+(\.\d+)?$/.test(value) ? "'" + value : value;
  return /[",\r\n]/.test(safe) ? '"' + safe.replaceAll('"', '""') + '"' : safe;
}
export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** R004/R005 reports: authorize the farm first; every result is labelled with basis, range and as-of time. */
export class FarmReportService {
  constructor(private readonly authorization: RegistryAuthorization, private readonly farms: ProductionFarmAccess, private readonly reports: FarmReportRepository, private readonly now: () => Date = () => new Date()) {}
  private async events(farmId: unknown, input: unknown) {
    const { scope, farm } = await authorizeProductionFarm(this.authorization, this.farms, farmId);
    const query = parse(reportQuerySchema, input);
    const sources = await this.reports.reportSources(scope, query);
    const events = eventsInScope(recognizedEvents(query.basis, sources.records, sources.payments), query);
    const labels: ReportLabels = { basis: query.basis, from: query.from ?? null, to: query.to ?? null, asOf: this.now().toISOString() };
    return { scope, farm, query, events, labels, enterprises: sources.enterprises };
  }
  async grossMargin(farmId: unknown, input: unknown = {}): Promise<GrossMarginView> {
    const { events, labels, enterprises } = await this.events(farmId, input);
    return { ...labels, currencies: grossMargin(events), enterprises };
  }
  async summary(farmId: unknown, input: unknown = {}): Promise<MoneySummaryView> {
    const { events, labels, enterprises } = await this.events(farmId, input);
    return { ...labels, currencies: moneySummary(events), enterprises };
  }
  /** CSV for active farm members only (D-P04-009); the export is audited before the file is returned. */
  async exportSummary(farmId: unknown, input: unknown = {}): Promise<{ filename: string; csv: string }> {
    const { scope, farm, query, events, labels, enterprises } = await this.events(farmId, input);
    await this.reports.recordExport(scope, crypto.randomUUID());
    const names = new Map(enterprises.map(row => [row.enterpriseId, row.name]));
    const rows: string[][] = [
      ["MyFarm money summary"], ["Farm", farm.name], ["Basis", query.basis === "CASH" ? "Cash (when money moved)" : "Accrual (when sold or bought)"],
      ["From", labels.from ?? "Start of records"], ["To", labels.to ?? "Latest record"], ["As of", labels.asOf],
      ["Note", "Amounts in different currencies are never added together. Gross margin only; overhead is not deducted."], [],
      ["Section", "Currency", "Item", "Amount"],
    ];
    for (const currency of moneySummary(events)) {
      rows.push(["Money spent", currency.currency, "All spending", currency.spent], ["Revenue earned", currency.currency, "All revenue", currency.revenue]);
      for (const category of currency.spending) rows.push(["Spending by category", currency.currency, category.categoryName, category.amount]);
      for (const id of currency.costliest.enterpriseIds) rows.push(["Costliest enterprise", currency.currency, names.get(id) ?? id, currency.costliest.costs]);
      rows.push(["Spending not linked to an enterprise", currency.currency, "", currency.unassignedCosts]);
    }
    for (const currency of grossMargin(events)) {
      for (const line of currency.enterprises) rows.push(["Gross margin", currency.currency, names.get(line.enterpriseId) ?? line.enterpriseId, line.grossMargin]);
      rows.push(["Gross margin", currency.currency, "All enterprises", currency.farm.grossMargin]);
    }
    const period = (labels.from ?? "start") + "_" + (labels.to ?? "latest");
    return { filename: "myfarm-money-summary-" + query.basis.toLowerCase() + "-" + period + ".csv", csv: toCsv(rows) };
  }
}
