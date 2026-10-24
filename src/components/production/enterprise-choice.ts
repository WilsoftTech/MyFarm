import type { EnterpriseView } from "@/modules/enterprises-seasons/contracts/production";
import type { EnterpriseCapability } from "@/modules/enterprises-seasons/contracts/catalog";
import type { Choice } from "./choice-types";

/** Presentation of an already authorized service result, shared by initial, paged and preset choices. */
export function enterpriseChoice(
  row: Pick<EnterpriseView, "enterpriseId" | "name" | "status"> & Pick<EnterpriseCapability, "workflow">,
  expected: NonNullable<EnterpriseCapability["workflow"]>,
): Choice {
  const reason = row.workflow === null ? " — production records not available yet"
    : row.workflow !== expected ? (expected === "CROP_CYCLE" ? " — not a crop enterprise" : " — not a poultry enterprise")
    : row.status !== "ACTIVE" ? " — closed" : "";
  return { id: row.enterpriseId, label: row.name + reason, disabled: reason !== "" };
}
