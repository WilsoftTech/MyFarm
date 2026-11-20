import "server-only";
import { createHash } from "node:crypto";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { database } from "@/modules/engineering-foundation/infrastructure/database";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { activityService } from "@/modules/farm-activities/infrastructure/services";
import { cropCycleService } from "@/modules/enterprises-seasons/infrastructure/services";
import { WeatherService } from "../application/weather";
import { testForecastAdapter } from "./test-adapter";
import { weatherWriter } from "./writer";
export const weatherDigest = (value: object) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function weatherService() {
  return new WeatherService(authorizationService(), { farmScopeForMember: input => registryRepository(database()).farmScopeForMember(input) }, {
    farm: scope => database().farm.findFirst({ where: { id: scope.farmId, tenantId: scope.tenantId }, select: { district: true } }),
    activity: (farmId, id) => activityService().detail(farmId, id), crop: (farmId, id) => cropCycleService().cycle(farmId, id),
  }, scenario => testForecastAdapter(scenario, () => new Date()), {
    replay: (...args) => weatherWriter(database()).replay(...args), move: (...args) => weatherWriter(database()).move(...args),
  }, weatherDigest);
}
