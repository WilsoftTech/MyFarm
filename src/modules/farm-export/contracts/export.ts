import type { ProductionWriteScope } from "@/modules/enterprises-seasons/contracts/production";

/** One CSV's worth of rows, already as text, in the column order of its catalog entry. */
export interface ExportTable { file: string; rows: string[][] }
export interface FarmSnapshot { tables: ExportTable[]; profile: string[][] }
export interface ExportPhoto { photoId: string; createdAt: string; target: "ACTIVITY" | "ACCOUNTING_RECORD" | null; recordId: string | null }

/** Every query constrains tenant and farm; the snapshot is read in one repeatable-read transaction and audited. */
export interface FarmExportRepository {
  snapshot(scope: ProductionWriteScope, requestId: string): Promise<FarmSnapshot>;
  photos(scope: ProductionWriteScope, after: string | null, limit: number): Promise<ExportPhoto[]>;
}

export const PROFILE_COLUMNS = ["name", "phone", "alternativePhone", "district", "subcounty", "village", "preferredLanguage", "ownershipType", "mainActivities", "createdAt", "updatedAt"] as const;
