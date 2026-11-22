import "server-only";
import { database } from "@/modules/engineering-foundation/infrastructure/database";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { OfficerAssignmentService, OfficerDashboardService } from "../application/dashboard";
import { officerRepository } from "./repository";
import { OfficerWorkService } from "../application/work";
import { officerRegistrationRepository } from "./registration-repository";
import { officerVisitRepository } from "./visit-repository";
import { photoStorage } from "@/modules/offline-first/infrastructure/photo-storage";
import { supabaseServer } from "@/modules/engineering-foundation/infrastructure/supabase";

export function officerServices() {
  const auth = authorizationService();
  return {
    dashboard: new OfficerDashboardService(auth, { dashboard: (...args) => officerRepository(database()).dashboard(...args) }),
    work: new OfficerWorkService(auth, {
      prepare: (...args) => officerRegistrationRepository(database()).prepare(...args),
      draft: (...args) => officerRegistrationRepository(database()).draft(...args),
      accept: (...args) => officerRegistrationRepository(database()).accept(...args),
      discard: (...args) => officerRegistrationRepository(database()).discard(...args),
      recordVisit: (...args) => officerVisitRepository(database()).recordVisit(...args),
      visits: (...args) => officerVisitRepository(database()).visits(...args),
      finish: (...args) => officerVisitRepository(database()).finish(...args),
      reservePhoto: (...args) => officerVisitRepository(database()).reservePhoto(...args),
      publishPhoto: (...args) => officerVisitRepository(database()).publishPhoto(...args),
      readablePhoto: (...args) => officerVisitRepository(database()).readablePhoto(...args),
    }, async () => photoStorage(await supabaseServer(), process.env.SUPABASE_PRIVATE_BUCKET ?? "myfarm-private", "officer-visits")),
    assignments: new OfficerAssignmentService(auth, {
      assignments: (...args) => officerRepository(database()).assignments(...args),
      grant: (...args) => officerRepository(database()).grant(...args),
      revoke: (...args) => officerRepository(database()).revoke(...args),
    }),
  };
}
