import "server-only";
import { cropCycleService, productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { enterpriseTypeLabels } from "@/components/production/labels";
import type { ChoicePage } from "@/components/production/choice-types";

export type AccountingChoiceKind = "enterprises" | "seasons" | "plots";
export const ACCOUNTING_CHOICE_KINDS: readonly AccountingChoiceKind[] = ["enterprises", "seasons", "plots"];

/**
 * Optional analytical links (R003). Every enterprise type and closed records stay selectable so late bills
 * keep their link; the server checks same-farm and crop-cycle matching (D-P04-007) when saving.
 */
export async function loadAccountingChoices(farmId: string, kind: AccountingChoiceKind, cursor?: string): Promise<ChoicePage> {
  const page = { cursor };
  if (kind === "enterprises") {
    const result = await productionService().listEnterprises(farmId, page);
    return { ...result, items: result.items.map(row => ({ id: row.enterpriseId, label: row.name + " — " + enterpriseTypeLabels[row.type] + (row.status !== "ACTIVE" ? " (closed)" : "") })) };
  }
  if (kind === "seasons") {
    const result = await productionService().listSeasons(farmId, page);
    return { ...result, items: result.items.map(row => ({ id: row.seasonId, label: row.label + (row.status !== "ACTIVE" ? " (closed)" : "") })) };
  }
  const result = await cropCycleService().plots(farmId, page);
  return { ...result, items: result.items.map(row => ({ id: row.plotId, label: row.name })) };
}
