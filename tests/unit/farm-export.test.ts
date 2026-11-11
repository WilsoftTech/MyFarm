import { describe, expect, it, vi } from "vitest";
import { deflateRawSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { readZip } from "../support/zip-reader";
import { crc32, zip } from "@/modules/farm-export/domain/zip";
import { EXPORT_FILES, PROFILE_FILE } from "@/modules/farm-export/domain/catalog";
import { FarmExportService, PHOTO_PAGE } from "@/modules/farm-export/application/export";
import type { FarmExportRepository } from "@/modules/farm-export/contracts/export";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";

const deflate = (data: Uint8Array) => new Uint8Array(deflateRawSync(data));

describe("ZIP writer (D-P09-013)", () => {
  it("matches the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });
  it("writes stored and deflated entries that read back exactly, keeping tiny entries stored", () => {
    const big = "date,amount\r\n" + "2026-03-01,1000\r\n".repeat(500), text = "Ekitabo kya MyFarm: ñ é ✓";
    for (const compress of [undefined, deflate]) {
      const bytes = zip([{ name: "a.csv", data: new TextEncoder().encode(big) }, { name: "b.txt", data: new TextEncoder().encode(text) }, { name: "empty.csv", data: new Uint8Array() }], new Date("2026-11-10T09:30:42Z"), compress);
      expect(readZip(bytes)).toEqual(new Map([["a.csv", big], ["b.txt", text], ["empty.csv", ""]]));
      if (compress) expect(bytes.byteLength).toBeLessThan(big.length / 5);
    }
  });
  it("stamps the UTC date and time in MS-DOS form", () => {
    const view = new DataView(zip([{ name: "a.txt", data: new Uint8Array([1]) }], new Date("2026-11-10T09:30:42Z")).buffer);
    expect(view.getUint16(12, true)).toBe(((2026 - 1980) << 9) | (11 << 5) | 10);
    expect(view.getUint16(10, true)).toBe((9 << 11) | (30 << 5) | 21);
  });
  it("refuses names that could escape a folder, and duplicates", () => {
    for (const name of ["../x.csv", "/x.csv", "a/b.csv", "", ".hidden", "a\\b.csv"]) expect(() => zip([{ name, data: new Uint8Array() }], new Date())).toThrow();
    expect(() => zip([{ name: "a.csv", data: new Uint8Array() }, { name: "a.csv", data: new Uint8Array() }], new Date())).toThrow();
  });
});

describe("farm export service (D-P09-013)", () => {
  const farmId = crypto.randomUUID(), tenantId = crypto.randomUUID(), actorId = crypto.randomUUID();
  function fixture() {
    const auth = { account: vi.fn(async () => ({ id: actorId, status: "ACTIVE" })), scope: vi.fn(async () => ({ actorId, organizationId: tenantId, role: "FARMER" })) };
    const farms = { farmScopeForMember: vi.fn(async () => ({ farmId, tenantId, name: "Kato's Farm, Rukungiri" })) };
    const repo = {
      snapshot: vi.fn(async () => ({ profile: [["Kato", "+256700000000", "", "Rukungiri", "", "", "en", "OWNED", "CROPS;POULTRY", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"]],
        tables: [{ file: "money-records.csv", rows: [[crypto.randomUUID(), "EXPENSE", "2026-03-01", "1000.00", "UGX", "Fertilizer", "=HYPERLINK(\"x\")", "", "", "", "", "", "ACTIVE", "2026-03-01T08:00:00Z"]] }] })),
      photos: vi.fn(async () => []),
    } satisfies FarmExportRepository;
    return { auth, farms, repo, service: new FarmExportService(auth as never, farms, repo, () => new Date("2026-11-10T09:30:42Z"), deflate) };
  }
  it("checks the farmer's access to the farm before reading anything", async () => {
    const { auth, repo, service } = fixture();
    auth.account.mockRejectedValueOnce(new FoundationError("UNAUTHENTICATED"));
    await expect(service.export(farmId)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    const other = fixture();
    other.farms.farmScopeForMember.mockResolvedValueOnce(null as never);
    await expect(other.service.export(farmId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(fixture().service.export("not-an-id")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(repo.snapshot).not.toHaveBeenCalled();
  });
  it("gives one ZIP with a note, the profile and a CSV for every kind of record, headed and safe for spreadsheets", async () => {
    const { repo, service } = fixture();
    const { filename, bytes } = await service.export(farmId);
    expect(filename).toBe("myfarm-kato-s-farm-rukungiri-2026-11-10.zip");
    expect(repo.snapshot).toHaveBeenCalledWith({ farmId, tenantId, actorId }, expect.stringMatching(/^[0-9a-f-]{36}$/));
    const files = readZip(bytes);
    expect([...files.keys()]).toEqual(["README.txt", PROFILE_FILE, ...EXPORT_FILES.map(file => file.file)]);
    for (const file of EXPORT_FILES) expect(files.get(file.file)!.startsWith("﻿" + file.columns.map(column => column.header).join(",") + "\r\n")).toBe(true);
    expect(files.get("money-records.csv")).toContain(",UGX,Fertilizer,\"'=HYPERLINK(\"\"x\"\")\",");
    // A leading + is guarded like a formula, which also keeps the phone number as text.
    expect(files.get(PROFILE_FILE)).toContain("Kato,'+256700000000");
    expect(files.get("README.txt")).toContain("Farm: Kato's Farm, Rukungiri");
    expect(files.get("README.txt")).toContain("money-records.csv - Expenses, income, sales and purchases (1 rows)");
    expect(files.get("README.txt")).toContain("plots.csv - Plots (0 rows)");
  });
  it("pages photos and refuses a bad cursor", async () => {
    const { repo, service } = fixture();
    const rows = Array.from({ length: PHOTO_PAGE + 1 }, (_, i) => ({ photoId: crypto.randomUUID(), createdAt: "2026-03-0" + (1 + (i % 9)) + "T00:00:00.000Z", target: "ACTIVITY" as const, recordId: crypto.randomUUID() }));
    repo.photos.mockResolvedValueOnce(rows as never);
    const page = await service.photos(farmId);
    expect(page.items).toHaveLength(PHOTO_PAGE);
    expect(page.nextAfter).toBe(rows[PHOTO_PAGE - 1].photoId);
    expect(repo.photos).toHaveBeenCalledWith({ farmId, tenantId, actorId }, null, PHOTO_PAGE + 1);
    await expect(service.photos(farmId, { after: "x" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    repo.photos.mockResolvedValueOnce([]);
    expect((await service.photos(farmId, { after: rows[0].photoId })).nextAfter).toBeNull();
  });
});

describe("the full farm export keeps up with the schema (D-P09-013, Phase 10 audit)", () => {
  it("exports every model scoped to a farm, except the membership list of other people's accounts", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const farmScoped = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].filter(([, , body]) => /^\s+farmId String/m.test(body)).map(([, name]) => name);
    const excluded = new Map([["FarmMember", "lists other people's accounts on the farm"]]);
    expect(farmScoped.length).toBeGreaterThan(20);
    expect(farmScoped.filter(name => !excluded.has(name) && !EXPORT_FILES.some(file => file.table === name))).toEqual([]);
  });
});
