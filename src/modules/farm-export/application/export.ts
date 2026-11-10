import { z } from "zod";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { authorizeProductionFarm, parseProductionInput as parse, type ProductionFarmAccess } from "@/modules/enterprises-seasons/application/farm-access";
import { toCsv } from "@/modules/farm-accounting/application/reporting";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { EXPORT_FILES, PROFILE_FILE, exportReadme } from "../domain/catalog";
import { zip, type Deflate } from "../domain/zip";
import { PROFILE_COLUMNS, type ExportPhoto, type FarmExportRepository } from "../contracts/export";

export const PHOTO_PAGE = 50;
const photoQuery = z.object({ after: idSchema.optional() }).strict();
const encoder = new TextEncoder();
/** Byte-order mark so spreadsheet programs read the UTF-8 text (names, notes) correctly. */
const csvFile = (rows: readonly (readonly string[])[]) => encoder.encode("﻿" + toCsv(rows));
const slug = (name: string) => name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "farm";

/**
 * D-P09-013: everything on a farm, for any active member of it (every member is an owner), as one ZIP of CSV files
 * plus the farmer's own profile. Each export is audited; how often is limited by the proxy (3 a day, D-P09-014).
 */
export class FarmExportService {
  constructor(private readonly auth: RegistryAuthorization, private readonly farms: ProductionFarmAccess, private readonly repo: FarmExportRepository, private readonly now: () => Date = () => new Date(), private readonly deflate?: Deflate) {}

  async export(farmId: unknown): Promise<{ filename: string; bytes: Uint8Array }> {
    const { scope, farm } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    const snapshot = await this.repo.snapshot(scope, crypto.randomUUID());
    const at = this.now(), asOf = at.toISOString().slice(0, 19) + "Z";
    const counts = snapshot.tables.map(table => ({ file: table.file, rows: table.rows.length }));
    const entries = [
      { name: "README.txt", data: encoder.encode(exportReadme(farm.name, asOf, counts)) },
      { name: PROFILE_FILE, data: csvFile([[...PROFILE_COLUMNS], ...snapshot.profile]) },
      ...EXPORT_FILES.map(file => ({ name: file.file, data: csvFile([file.columns.map(column => column.header), ...(snapshot.tables.find(table => table.file === file.file)?.rows ?? [])]) })),
    ];
    return { filename: "myfarm-" + slug(farm.name) + "-" + asOf.slice(0, 10) + ".zip", bytes: zip(entries, at, this.deflate) };
  }

  /** The farm's photos, oldest first, a page at a time, to open one by one through the audited photo link. */
  async photos(farmId: unknown, input: unknown = {}): Promise<{ farmName: string; items: ExportPhoto[]; nextAfter: string | null }> {
    const { scope, farm } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    const query = parse(photoQuery, input);
    const rows = await this.repo.photos(scope, query.after ?? null, PHOTO_PAGE + 1);
    const items = rows.slice(0, PHOTO_PAGE);
    return { farmName: farm.name, items, nextAfter: rows.length > PHOTO_PAGE ? items.at(-1)!.photoId : null };
  }
}
