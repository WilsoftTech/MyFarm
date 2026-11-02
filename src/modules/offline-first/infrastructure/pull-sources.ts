import type { FarmerRegistryService } from "@/modules/farmer-registry/application/registry";
import type { CropCycleService } from "@/modules/enterprises-seasons/application/crop-cycle";
import type { ProductionService } from "@/modules/enterprises-seasons/application/production";
import type { FarmAccountingService } from "@/modules/farm-accounting/application/accounting";
import type { HarvestService } from "@/modules/harvest-inventory/application/harvest";
import type { ActivityService } from "@/modules/farm-activities/application/activity";
import type { PullSources } from "../application/sync";
import { PULL_LIMITS } from "../domain/commands";

export interface PullServices { registry: Pick<FarmerRegistryService, "listFarms">; production: Pick<ProductionService, "listEnterprises">; crops: Pick<CropCycleService, "list" | "plots">; accounting: Pick<FarmAccountingService, "categories" | "paymentMethods" | "records">; harvest: Pick<HarvestService, "list" | "locations">; activities: Pick<ActivityService, "list"> }
const shape = <T extends object>(page: { items: T[]; nextCursor: string | null }, id: (row: T) => string) => ({ items: page.items.map(row => ({ ...row, id: id(row) })), nextCursor: page.nextCursor });

/** Every section goes through the service farmers already use, so nothing new decides what they may read. */
export function pullSources(services: PullServices): PullSources {
  return {
    async farms() {
      const page = await services.registry.listFarms({ limit: PULL_LIMITS.maxFarms });
      return page.items.map(row => ({ farmId: row.farmId, name: row.name }));
    },
    page(section, farmId, cursor, limit) {
      const input = { limit, ...(cursor ? { cursor } : {}) };
      switch (section) {
        case "ENTERPRISES": return services.production.listEnterprises(farmId, input).then(page => shape(page, row => row.enterpriseId));
        case "PLOTS": return services.crops.plots(farmId, input).then(page => shape(page, row => row.plotId));
        case "CROP_CYCLES": return services.crops.list(farmId, input).then(page => shape(page, row => row.cycleId));
        case "STORES": return services.harvest.locations(farmId, input).then(page => shape(page, row => row.storageLocationId));
        case "COST_CATEGORIES": return services.accounting.categories(farmId, { ...input, kind: "COST" }).then(page => shape(page, row => row.categoryId));
        case "REVENUE_CATEGORIES": return services.accounting.categories(farmId, { ...input, kind: "REVENUE" }).then(page => shape(page, row => row.categoryId));
        case "PAYMENT_METHODS": return services.accounting.paymentMethods(farmId, input).then(page => shape(page, row => row.paymentMethodId));
        case "ACCOUNTING_RECORDS": return services.accounting.records(farmId, input).then(page => shape(page, row => row.recordId));
        case "HARVESTS": return services.harvest.list(farmId, input).then(page => shape(page, row => row.harvestId));
        case "ACTIVITIES": return services.activities.list(farmId, input).then(page => shape(page, row => row.activityId));
      }
    },
  };
}
