import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inventoryFixture } from "../support/inventory-fixture";
import { farmExportRepository } from "@/modules/farm-export/infrastructure/export-repository";
import { EXPORT_FILES } from "@/modules/farm-export/domain/catalog";
import { PROFILE_COLUMNS } from "@/modules/farm-export/contracts/export";

describe("full farm export under the restricted runtime role (D-P09-013)", () => {
  let mine: Awaited<ReturnType<typeof inventoryFixture>>, other: Awaited<ReturnType<typeof inventoryFixture>>;
  beforeAll(async () => {
    mine = await inventoryFixture(); other = await inventoryFixture();
    for (const f of [mine, other]) await f.harvest.record(f.scope.farmId, f.command());
    const farmer = await mine.owner.farmer.findFirstOrThrow({ where: { userId: mine.scope.actorId } });
    await mine.owner.farmerProfile.create({ data: { farmerId: farmer.id, name: "Kato, \"Senior\"", phone: "+256700000001", district: "Rukungiri", preferredLanguage: "en", ownershipType: "OWNED", mainActivities: ["CROPS", "POULTRY"], updatedBy: mine.scope.actorId } });
  }, 120_000);
  afterAll(async () => {
    const farmer = await mine.owner.farmer.findFirst({ where: { userId: mine.scope.actorId } });
    if (farmer) await mine.owner.farmerProfile.deleteMany({ where: { farmerId: farmer.id } });
    await mine.cleanup(); await other.cleanup();
  });

  it("reads every catalogued table and column, only this farm's rows, in one audited snapshot", async () => {
    const requestId = crypto.randomUUID();
    const snapshot = await farmExportRepository(mine.runtime).snapshot(mine.scope, requestId);
    expect(snapshot.tables.map(table => table.file)).toEqual(EXPORT_FILES.map(file => file.file));
    for (const table of snapshot.tables) for (const row of table.rows) expect(row).toHaveLength(EXPORT_FILES.find(file => file.file === table.file)!.columns.length);
    const rows = (file: string) => snapshot.tables.find(table => table.file === file)!.rows;
    expect(rows("farm.csv")).toEqual([[mine.scope.farmId, "Inventory farm", "Rukungiri", "", "", "", "OWNED", "CROPS", "", "", expect.stringMatching(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/)]]);
    expect(rows("harvests.csv")).toHaveLength(1);
    expect(rows("harvests.csv")[0].slice(1, 3)).toEqual(["2026-10-01", "Maize"]);
    expect(rows("harvests.csv")[0][7]).toBe("2400.000000");
    expect(rows("stock-movements.csv").length).toBeGreaterThan(0);
    expect(rows("crop-cycles.csv")).toHaveLength(1);
    // The other farm's harvest, cycle and farm row stay out.
    const everything = JSON.stringify(snapshot);
    expect(everything).not.toContain(other.scope.farmId);
    expect(everything).not.toContain(other.cycle.id);
    expect(snapshot.profile).toEqual([["Kato, \"Senior\"", "+256700000001", "", "Rukungiri", "", "", "en", "OWNED", "CROPS;POULTRY", expect.any(String), expect.any(String)]]);
    expect(snapshot.profile[0]).toHaveLength(PROFILE_COLUMNS.length);
    expect(await mine.owner.auditEvent.count({ where: { requestId, action: "FARM_EXPORTED", actorId: mine.scope.actorId, targetId: mine.scope.farmId } })).toBe(1);
  });

  it("refuses someone who is not an active member of the farm, and records nothing", async () => {
    const requestId = crypto.randomUUID();
    await expect(farmExportRepository(mine.runtime).snapshot({ ...mine.scope, actorId: other.scope.actorId }, requestId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await mine.owner.auditEvent.count({ where: { requestId } })).toBe(0);
  });

  it("lists no photos for a farm without any, and keeps another farm's photos apart", async () => {
    expect(await farmExportRepository(mine.runtime).photos(mine.scope, null, 10)).toEqual([]);
    expect(await farmExportRepository(mine.runtime).photos(mine.scope, crypto.randomUUID(), 10)).toEqual([]);
  });
});
