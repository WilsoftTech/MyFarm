import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { authorizeProductionFarm, parseProductionInput as parse, type ProductionFarmAccess } from "@/modules/enterprises-seasons/application/farm-access";
import { editVoiceDraftSchema, executeVoiceDraftSchema, saveVoiceDraftSchema, type VoiceDraftRepository } from "../contracts/drafts";

export class VoiceDraftService {
  constructor(private readonly authorization: RegistryAuthorization, private readonly farms: ProductionFarmAccess, private readonly repository: VoiceDraftRepository) {}
  private async scope(farmId: unknown) { return (await authorizeProductionFarm(this.authorization, this.farms, farmId)).scope; }
  async create(farmId: unknown, input: unknown) {
    const scope = await this.scope(farmId);
    return this.repository.create(scope, parse(saveVoiceDraftSchema, input).review);
  }
  async read(farmId: unknown, draftId: unknown) {
    const scope = await this.scope(farmId);
    return this.repository.read(scope, parse(idSchema, draftId));
  }
  async outcome(farmId: unknown, draftId: unknown) {
    const scope = await this.scope(farmId);
    return this.repository.outcome(scope, parse(idSchema, draftId));
  }
  async edit(farmId: unknown, draftId: unknown, input: unknown) {
    const scope = await this.scope(farmId);
    return this.repository.edit(scope, parse(idSchema, draftId), parse(editVoiceDraftSchema, input));
  }
  async confirm(farmId: unknown, draftId: unknown, input: unknown) {
    const scope = await this.scope(farmId);
    return this.repository.confirm(scope, parse(idSchema, draftId), parse(executeVoiceDraftSchema, input));
  }
}
