import "server-only";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { database } from "@/modules/engineering-foundation/infrastructure/database";
import { supabaseServer } from "@/modules/engineering-foundation/infrastructure/supabase";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { farmerRegistryService } from "@/modules/farmer-registry/infrastructure/services";
import { cropCycleService, poultryBatchService, productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { farmAccountingService } from "@/modules/farm-accounting/infrastructure/services";
import { harvestService } from "@/modules/harvest-inventory/infrastructure/services";
import { activityService } from "@/modules/farm-activities/infrastructure/services";
import { PhotoService } from "../application/photos";
import { PullService, PushService, type SyncCommandServices } from "../application/sync";
import { photoRepository } from "./photo-repository";
import { photoStorage } from "./photo-storage";
import { pullSources } from "./pull-sources";
import { receiptLookup } from "./receipts";
import { pilotUsageLog } from "@/modules/field-pilot/infrastructure/usage-log";

export function syncCommandServices(): SyncCommandServices {
  return {
    recordTransaction: (kind, farmId, input) => farmAccountingService().recordTransaction(kind, farmId, input),
    recordHarvest: (farmId, input) => harvestService().record(farmId, input),
    scheduleActivity: (farmId, input) => activityService().schedule(farmId, input),
    recordActivityDone: (farmId, input) => activityService().recordDone(farmId, input),
    completeActivity: (farmId, activityId, input) => activityService().complete(farmId, activityId, input),
    currentActivity: (farmId, activityId) => activityService().detail(farmId, activityId),
    priorReceiptActions: (farmId, requestId) => receiptLookup(authorizationService(), { farmScopeForMember: input => registryRepository(database()).farmScopeForMember(input) }, database()).priorActions(farmId, requestId),
  };
}
export function pushService() {
  return new PushService(authorizationService(), syncCommandServices(), {
    // D-P09-008: the pilot counts what reached the server from phones; built only when a push has entries.
    record: (actorId, entries) => pilotUsageLog(database(), { farmScopeForMember: input => registryRepository(database()).farmScopeForMember(input) }).record(actorId, entries),
  });
}
export function pullService() {
  return new PullService(authorizationService(), pullSources({ registry: farmerRegistryService(), production: productionService(), crops: cropCycleService(), poultry: poultryBatchService(), accounting: farmAccountingService(), harvest: harvestService(), activities: activityService() }));
}
export function photoService() {
  return new PhotoService(authorizationService(), { farmScopeForMember: input => registryRepository(database()).farmScopeForMember(input) }, {
    recordExists: (...args) => photoRepository(database()).recordExists(...args), photo: (...args) => photoRepository(database()).photo(...args),
    photos: (...args) => photoRepository(database()).photos(...args), record: (...args) => photoRepository(database()).record(...args), receiptActions: (...args) => photoRepository(database()).receiptActions(...args),
  }, async () => photoStorage(await supabaseServer(), process.env.SUPABASE_PRIVATE_BUCKET ?? "myfarm-private"));
}
