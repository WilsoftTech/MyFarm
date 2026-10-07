import "server-only";
import { AuthorizationService } from "../application/authorization";
import { sessions } from "./sessions";
import { database } from "./database";
import { identityRepository } from "./repository";
export function authorizationService() {
// Lazy DB: anonymous access must fail before DB is requested.
return new AuthorizationService(sessions, {
accountBySubject: subject => identityRepository(database()).accountBySubject(subject),
scopesForUser: userId => identityRepository(database()).scopesForUser(userId),
scopeForUser: (userId, scopeId) => identityRepository(database()).scopeForUser(userId, scopeId),
});
}
