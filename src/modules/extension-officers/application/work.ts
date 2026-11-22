import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { photoProblem } from "@/modules/offline-first/domain/commands";
import type { PhotoStoragePort } from "@/modules/offline-first/contracts/photos";
import { prepareRegistrationSchema, acceptRegistrationSchema, recordVisitSchema, finishWorkSchema, visitPhotoSchema, type OfficerWorkRepository } from "../contracts/work";

function parse<T>(schema: { safeParse(input: unknown): { success: true; data: T } | { success: false } }, input: unknown): T {
  const value = schema.safeParse(input);
  if (!value.success) throw new FoundationError("INVALID_INPUT");
  return value.data;
}
export class OfficerWorkService {
  constructor(private readonly auth: RegistryAuthorization, private readonly repo: OfficerWorkRepository, private readonly storage: () => Promise<PhotoStoragePort>) {}
  async prepare(organizationId: unknown, input: unknown) {
    const scope = await this.auth.scope(organizationId, ["AGENT"]);
    return this.repo.prepare(scope.actorId, scope.organizationId, parse(prepareRegistrationSchema, input));
  }
  async draft(draftId: unknown) { const actor = await this.auth.account(); return this.repo.draft(actor.id, parse(idSchema, draftId)); }
  async accept(draftId: unknown, input: unknown) { const actor = await this.auth.account(); return this.repo.accept(actor.id, parse(idSchema, draftId), parse(acceptRegistrationSchema, input)); }
  async discard(draftId: unknown) { const actor = await this.auth.account(); return this.repo.discard(actor.id, parse(idSchema, draftId)); }
  async visits(organizationId: unknown, farmId: unknown, assignmentId: unknown) {
    const scope = await this.auth.scope(organizationId, ["AGENT"]);
    return this.repo.visits(scope.actorId, scope.organizationId, parse(idSchema, farmId), parse(idSchema, assignmentId));
  }
  async recordVisit(organizationId: unknown, farmId: unknown, input: unknown) {
    const scope = await this.auth.scope(organizationId, ["AGENT"]);
    return this.repo.recordVisit(scope.actorId, scope.organizationId, parse(idSchema, farmId), parse(recordVisitSchema, input));
  }
  async finish(organizationId: unknown, farmId: unknown, kind: "FOLLOW_UP" | "PROBLEM", id: unknown, input: unknown) {
    const scope = await this.auth.scope(organizationId, ["AGENT"]);
    return this.repo.finish(scope.actorId, scope.organizationId, parse(idSchema, farmId), kind, parse(idSchema, id), parse(finishWorkSchema, input));
  }
  async upload(organizationId: unknown, farmId: unknown, input: unknown, bytes: Uint8Array) {
    const scope = await this.auth.scope(organizationId, ["AGENT"]), farm = parse(idSchema, farmId), command = parse(visitPhotoSchema, input);
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.slice().buffer)), value => value.toString(16).padStart(2, "0")).join("");
    if (photoProblem(bytes, command.contentType) || bytes.length !== command.byteSize || digest !== command.sha256) throw new FoundationError("INVALID_INPUT");
    const pending = await this.repo.reservePhoto(scope.actorId, scope.organizationId, farm, command);
    if (!pending.uploaded) await (await this.storage()).put(pending.tenantId, command.requestId, bytes, command.contentType);
    return this.repo.publishPhoto(scope.actorId, scope.organizationId, farm, command);
  }
  async readable(organizationId: unknown, farmId: unknown, photoId: unknown) {
    const account = await this.auth.account(), photo = parse(idSchema, photoId);
    const organization = organizationId == null ? "" : parse(idSchema, organizationId);
    return { ...(await this.repo.readablePhoto(account.id, organization, parse(idSchema, farmId), photo)), actorId: account.id, photoId: photo };
  }
}
