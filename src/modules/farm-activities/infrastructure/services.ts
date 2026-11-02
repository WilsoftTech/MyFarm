import "server-only";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { database } from "@/modules/engineering-foundation/infrastructure/database";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { ActivityService } from "../application/activity";
import { activityRepository } from "./activity-repository";

export function activityService() {
  return new ActivityService(authorizationService(), { farmScopeForMember: input => registryRepository(database()).farmScopeForMember(input) }, {
    activity: (...args) => activityRepository(database()).activity(...args), activities: (...args) => activityRepository(database()).activities(...args),
    capabilities: (...args) => activityRepository(database()).capabilities(...args), schedule: (...args) => activityRepository(database()).schedule(...args),
  });
}
