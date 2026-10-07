import type { AuthorizedScope } from "./identity";
export interface PrivateStoragePort {
signedRead(scope: AuthorizedScope, objectId: string): Promise<string>;
}
export interface AuditInput { actorId: string; tenantId: string; action: "PRIVATE_FILE_READ"; targetId: string; requestId: string }
export interface AuditPort { append(input: AuditInput): Promise<void> }
export interface UnitOfWork { run<T>(work: (audit: AuditPort) => Promise<T>): Promise<T> }
