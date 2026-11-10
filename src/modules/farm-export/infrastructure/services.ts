import "server-only";
import { deflateRawSync } from "node:zlib";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { database } from "@/modules/engineering-foundation/infrastructure/database";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { FarmExportService } from "../application/export";
import { farmExportRepository } from "./export-repository";

export function farmExportService() {
  // Anonymous requests fail before a database client is built.
  return new FarmExportService(authorizationService(), {
    farmScopeForMember: input => registryRepository(database()).farmScopeForMember(input),
  }, {
    snapshot: (scope, requestId) => farmExportRepository(database()).snapshot(scope, requestId),
    photos: (scope, after, limit) => farmExportRepository(database()).photos(scope, after, limit),
  }, undefined, data => new Uint8Array(deflateRawSync(data, { level: 9 })));
}
