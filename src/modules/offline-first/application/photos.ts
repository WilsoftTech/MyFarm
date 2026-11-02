import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { authorizeProductionFarm, parseProductionInput as parse, type ProductionFarmAccess } from "@/modules/enterprises-seasons/application/farm-access";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { photoListSchema, uploadPhotoSchema, type PhotoRepository, type PhotoStoragePort } from "../contracts/photos";
import { photoProblem } from "../domain/commands";

const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, "0")).join("");

export class PhotoService {
  constructor(private readonly auth: RegistryAuthorization, private readonly farms: ProductionFarmAccess, private readonly repo: PhotoRepository, private readonly storage: () => Promise<PhotoStoragePort>) {}
  /** The network upload stays outside the database transaction. A failure after it leaves a harmless object that the retry reuses. */
  async upload(farmId: unknown, input: unknown, bytes: Uint8Array) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    const command = parse(uploadPhotoSchema, input);
    if (photoProblem(bytes, command.contentType)) throw new FoundationError("INVALID_INPUT");
    const digest = hex(await crypto.subtle.digest("SHA-256", bytes.slice().buffer));
    if (digest !== command.sha256) throw new FoundationError("INVALID_INPUT");
    const existing = await this.repo.photo(scope, command.requestId);
    if (existing) {
      const { sha256, ...view } = existing;
      if (sha256 !== command.sha256 || view.recordId !== command.recordId || view.target !== command.target || view.createdBy !== scope.actorId) throw new FoundationError("CONFLICT");
      return view;
    }
    if (!(await this.repo.recordExists(scope, command.target, command.recordId))) throw new FoundationError("FORBIDDEN");
    await (await this.storage()).put(scope.tenantId, command.requestId, bytes, command.contentType);
    return this.repo.record(scope, command, bytes.length);
  }
  async list(farmId: unknown, input: unknown) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    const query = parse(photoListSchema, input);
    return this.repo.photos(scope, query.target, query.recordId);
  }
  /** Confirms this farm holds the photo; the caller then uses the audited private file grant. */
  async readable(farmId: unknown, photoId: unknown) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    const row = await this.repo.photo(scope, parse(idSchema, photoId));
    if (!row) throw new FoundationError("FORBIDDEN");
    return { tenantId: scope.tenantId, photoId: row.photoId };
  }
}
