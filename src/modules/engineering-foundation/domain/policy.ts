import type { Account, AuthorizedScope, Role, Scope } from "../contracts/identity";
import { FoundationError } from "./errors";
export function requireAccount(account: Account | null): Account {
if (!account || account.status !== "ACTIVE") throw new FoundationError("FORBIDDEN");
return account;
}
export function authorizeScope(account: Account, scope: Scope | null, permittedRoles?: readonly Role[]): AuthorizedScope {
requireAccount(account);
if (!scope || scope.status !== "ACTIVE" || (permittedRoles && !permittedRoles.includes(scope.role))) throw new FoundationError("FORBIDDEN");
return { actorId: account.id, organizationId: scope.organizationId, role: scope.role };
}
