import { idSchema } from "../contracts/identity";
import type { AuditPort, PrivateStoragePort } from "../contracts/storage";
import { AuthorizationService } from "./authorization";
import { FoundationError } from "../domain/errors";
export class PrivateFileService {
constructor(private readonly authorization: AuthorizationService, private readonly storage: PrivateStoragePort, private readonly audit: AuditPort) {}
async read(organizationId: unknown, objectId: unknown, requestId: unknown) {
const object = idSchema.safeParse(objectId), request = idSchema.safeParse(requestId);
if (!object.success || !request.success) throw new FoundationError("INVALID_INPUT");
const scope = await this.authorization.scope(organizationId);
// Audit must succeed before granting access. No signed URL is persisted or logged.
await this.audit.append({ actorId: scope.actorId, tenantId: scope.organizationId, action: "PRIVATE_FILE_READ", targetId: object.data, requestId: request.data });
return this.storage.signedRead(scope, object.data);
}
}
