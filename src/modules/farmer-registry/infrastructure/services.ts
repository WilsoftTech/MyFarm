import "server-only";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { database } from "@/modules/engineering-foundation/infrastructure/database";
import { FarmerRegistryService } from "../application/registry";
import type { RegistryRepository } from "../contracts/registry";
import { registryRepository } from "./repository";

export function farmerRegistryService() {
// Lazy DB, as in Phase1: an anonymous request fails authentication before any database client is created.
const repository = () => registryRepository(database());
const lazy: RegistryRepository = {
farmerForUser: userId => repository().farmerForUser(userId),
registerFarmer: input => repository().registerFarmer(input),
updateProfile: input => repository().updateProfile(input),
farmsForMember: input => repository().farmsForMember(input),
farmForMember: input => repository().farmForMember(input),
createFarm: input => repository().createFarm(input),
createPlot: input => repository().createPlot(input),
};
return new FarmerRegistryService(authorizationService(), lazy);
}
