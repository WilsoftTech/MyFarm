import type { IdentityRepository, Role, SessionPort } from "../contracts/identity";
import { idSchema } from "../contracts/identity";
import { requireAccount, authorizeScope } from "../domain/policy";
import { FoundationError } from "../domain/errors";
export class AuthorizationService {
constructor(private readonly sessions: SessionPort, private readonly repository: IdentityRepository) {}
async account() {
const identity = await this.sessions.currentIdentity();
if (!identity) throw new FoundationError("UNAUTHENTICATED");
return requireAccount(await this.repository.accountBySubject(identity.authSubject));
}
async overview() {
const account = await this.account();
const scopes = (await this.repository.scopesForUser(account.id)).filter(scope => scope.status === "ACTIVE");
return { accountId: account.id, scopes };
}
async scope(organizationId: unknown, roles?: readonly Role[]) {
const parsed = idSchema.safeParse(organizationId);
if (!parsed.success) throw new FoundationError("INVALID_INPUT");
const account = await this.account();
return authorizeScope(account, await this.repository.scopeForUser(account.id, parsed.data), roles);
}
}
