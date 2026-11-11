/**
 * What the full farm export holds (D-P09-012, D-P09-013): one CSV per kind of record on the farm, the farm itself and
 * the requesting farmer's own profile. Internal keys (tenant, request IDs, hashes, versions) and other people's user
 * IDs are left out. Record IDs are kept so files can be matched to each other. Every identifier here is fixed in code;
 * nothing a person sends reaches the SQL.
 */
export type ExportColumnKind = "text" | "time";
export interface ExportColumn { header: string; sql: string; kind?: ExportColumnKind }
export interface ExportFile { file: string; table: string; /** How rows are found: by farm, or by the farm's own id. */ scope: "farm" | "self"; description: string; columns: readonly ExportColumn[] }

const col = (header: string, sql = header, kind: ExportColumnKind = "text"): ExportColumn => ({ header, sql: '"' + sql + '"', kind });
const time = (header: string, sql = header) => col(header, sql, "time");
const created = time("createdAt");

export const EXPORT_FILES: readonly ExportFile[] = Object.freeze([
  { file: "farm.csv", table: "Farm", scope: "self", description: "The farm's details", columns: [col("farmId", "id"), col("name"), col("district"), col("subcounty"), col("village"), col("approximateAcreage"), col("ownershipType"), col("primaryActivity"), col("latitude"), col("longitude"), created] },
  { file: "plots.csv", table: "Plot", scope: "farm", description: "Plots", columns: [col("plotId", "id"), col("name"), col("area"), col("areaUnit"), created] },
  { file: "enterprises.csv", table: "Enterprise", scope: "farm", description: "Enterprises such as maize or poultry", columns: [col("enterpriseId", "id"), col("name"), col("type"), col("status"), created] },
  { file: "seasons.csv", table: "Season", scope: "farm", description: "Seasons", columns: [col("seasonId", "id"), col("label"), col("startDate"), col("endDate"), col("status"), created] },
  { file: "crop-cycles.csv", table: "CropCycle", scope: "farm", description: "Crops planted", columns: [col("cropCycleId", "id"), col("enterpriseId"), col("seasonId"), col("plotId"), col("cropName"), col("variety"), col("areaPlanted"), col("areaUnit"), col("plantingDate"), col("expectedHarvest"), col("areaExceptionReason"), col("status"), created] },
  { file: "poultry-batches.csv", table: "PoultryBatch", scope: "farm", description: "Poultry batches", columns: [col("batchId", "id"), col("enterpriseId"), col("batchLabel"), col("animalType", "animalTypeName"), col("breed"), col("startingQuantity"), col("acquisitionDate"), col("purpose"), col("status"), created] },
  { file: "money-records.csv", table: "AccountingRecord", scope: "farm", description: "Expenses, income, sales and purchases", columns: [col("recordId", "id"), col("kind"), col("occurredOn"), col("amount"), col("currency"), col("category", "categoryName"), col("counterparty"), col("paymentMethodId"), col("enterpriseId"), col("seasonId"), col("plotId"), col("batchId"), col("status"), created] },
  { file: "payments.csv", table: "PaymentRecord", scope: "farm", description: "Payments made and received", columns: [col("paymentId", "id"), col("direction"), col("paidOn"), col("amount"), col("currency"), col("paymentMethodId"), col("externalReference"), col("status"), created] },
  { file: "payment-links.csv", table: "PaymentAllocation", scope: "farm", description: "Which payment settled which record", columns: [col("paymentId"), col("recordId", "obligationId"), col("amount"), created] },
  { file: "reversals.csv", table: "AccountingReversal", scope: "farm", description: "Records and payments reversed, and why", columns: [col("reversalId", "id"), col("recordId"), col("paymentId"), col("reason"), created] },
  { file: "storage-locations.csv", table: "StorageLocation", scope: "farm", description: "Stores", columns: [col("locationId", "id"), col("name"), created] },
  { file: "stock-items.csv", table: "InventoryItem", scope: "farm", description: "Things kept in stock", columns: [col("itemId", "id"), col("name"), col("kind"), col("unit"), col("cropCycleId"), col("batchId"), created] },
  { file: "harvests.csv", table: "Harvest", scope: "farm", description: "Harvests", columns: [col("harvestId", "id"), col("harvestDate"), col("cropName"), col("cropCycleId"), col("plotId"), col("store", "storageLocationName"), col("itemId"), col("quantity"), col("unit"), col("grade"), col("lossQuantity"), created] },
  { file: "stock-movements.csv", table: "StockMovement", scope: "farm", description: "Every change in stock", columns: [col("movementId", "id"), col("occurredOn"), col("itemId"), col("locationId"), col("quantityChange", "quantityDelta"), col("reason"), col("harvestId"), col("poultryProductionId", "productionEventId"), col("stockOperationId"), col("openingBatchId"), col("reversalOfId"), created] },
  { file: "poultry-production.csv", table: "ProductionEvent", scope: "farm", description: "Eggs, birds and other poultry production", columns: [col("poultryProductionId", "id"), col("batchId"), col("occurredOn"), col("type"), col("quantity"), col("unit"), col("locationId"), col("note"), col("recordId", "accountingRecordId"), created] },
  { file: "stock-operations.csv", table: "StockOperation", scope: "farm", description: "Stock used, sold, moved or counted", columns: [col("stockOperationId", "id"), col("type"), col("occurredOn"), col("itemId"), col("locationId"), col("destinationLocationId"), col("quantity"), col("unit"), col("direction"), col("reason"), col("targetType"), col("targetId"), col("recordId", "accountingRecordId"), created] },
  { file: "stock-adjustments.csv", table: "StockAdjustment", scope: "farm", description: "Stock count corrections", columns: [col("adjustmentId", "id"), col("stockOperationId", "operationId"), col("reason"), created] },
  { file: "activities.csv", table: "ProductionActivity", scope: "farm", description: "Farm work planned and done", columns: [col("activityId", "id"), col("type"), col("dueOn"), col("status"), col("enterpriseId"), col("plotId"), col("workerName"), col("notes"), col("costRecordId"), col("seriesId", "recurrenceId"), time("completedAt"), time("cancelledAt"), col("cancelReason"), created] },
  { file: "activity-series.csv", table: "ActivityRecurrence", scope: "farm", description: "Repeating farm work", columns: [col("seriesId", "id"), col("type"), col("frequency"), col("interval"), col("startOn"), col("endOn"), col("stoppedFrom"), col("enterpriseId"), col("plotId"), col("workerName"), col("notes"), col("previousSeriesId", "previousId"), created] },
  { file: "photos.csv", table: "RecordPhoto", scope: "farm", description: "Photos, and the record each belongs to", columns: [col("photoId", "id"), col("activityId"), col("recordId", "accountingRecordId"), col("contentType"), col("byteSize"), col("sha256"), created] },
  // Phase 10 (D-P10-001 to D-P10-007): alerts and their evidence, and the feed item chosen for each batch. Who acknowledged or chose is left out.
  { file: "alerts.csv", table: "FarmInsight", scope: "farm", description: "Alerts the farm's records raised, with what each was worked out from", columns: [col("alertId", "id"), col("batchId"), col("cropCycleId"), col("rule", "ruleKey"), col("ruleVersion"), col("level", "severity"), col("status"), col("currency"), col("evaluatedOn"), col("evidence"), time("seenAt", "acknowledgedAt"), col("clearedOn"), created] },
  { file: "batch-feed-items.csv", table: "BatchFeedItem", scope: "farm", description: "The stock item each poultry batch is fed from", columns: [col("batchId"), col("itemId"), time("changedAt", "updatedAt"), created] },
]);

export const PROFILE_FILE = "my-profile.csv";

export function exportReadme(farmName: string, asOf: string, counts: readonly { file: string; rows: number }[]): string {
  const lines = [
    "MyFarm farm export",
    "Farm: " + farmName,
    "Made: " + asOf + " (UTC)",
    "",
    "Each file opens in a spreadsheet. Dates are year-month-day. Times are UTC. Amounts are exact, with their currency;",
    "amounts in different currencies are never added together. IDs let you match a row in one file to a row in another.",
    "Photos are listed in photos.csv; open each one from the farm's export page in MyFarm.",
    "",
    PROFILE_FILE + " - your own profile",
    ...EXPORT_FILES.map(file => file.file + " - " + file.description + " (" + (counts.find(count => count.file === file.file)?.rows ?? 0) + " rows)"),
  ];
  return lines.join("\r\n") + "\r\n";
}
