import "server-only";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { database } from "@/modules/engineering-foundation/infrastructure/database";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { ActivityService } from "../application/activity";
import { RecurrenceService } from "../application/recurrence";
import { activityRepository } from "./activity-repository";
import { recurrenceRepository } from "./recurrence-repository";

export function activityService() {
  return new ActivityService(authorizationService(), { farmScopeForMember: input => registryRepository(database()).farmScopeForMember(input) }, {
    activity: (...args) => activityRepository(database()).activity(...args), activities: (...args) => activityRepository(database()).activities(...args),
    recordDone: (...args) => activityRepository(database()).recordDone(...args), complete: (...args) => activityRepository(database()).complete(...args), cancel: (...args) => activityRepository(database()).cancel(...args),
    capabilities: (...args) => activityRepository(database()).capabilities(...args), schedule: (...args) => activityRepository(database()).schedule(...args),
  });
}
export function recurrenceService() {
  return new RecurrenceService(authorizationService(), { farmScopeForMember: input => registryRepository(database()).farmScopeForMember(input) }, {
    recurrence: (...args) => recurrenceRepository(database()).recurrence(...args), recurrences: (...args) => recurrenceRepository(database()).recurrences(...args),
    create: (...args) => recurrenceRepository(database()).create(...args), change: (...args) => recurrenceRepository(database()).change(...args),
    stop: (...args) => recurrenceRepository(database()).stop(...args), expand: (...args) => recurrenceRepository(database()).expand(...args),
  });
}
