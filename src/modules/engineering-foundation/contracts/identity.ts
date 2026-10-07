import { z } from "zod";
export const idSchema = z.uuid();
export const signInSchema = z.object({
email: z.email("Enter a valid email address.").max(254),
password: z.string().min(1, "Enter your password.").max(128),
}).strict();
export type SignInInput = z.infer<typeof signInSchema>;
export type Role = "FARMER" | "AGENT" | "ADMIN";
export interface VerifiedIdentity { authSubject: string }
export interface Account { id: string; authSubject: string; status: "ACTIVE" | "SUSPENDED" }
export interface Scope { organizationId: string; name: string; role: Role; status: "ACTIVE" | "REVOKED" }
export interface SessionPort { currentIdentity(): Promise<VerifiedIdentity | null> }
export interface IdentityRepository {
accountBySubject(subject: string): Promise<Account | null>;
scopesForUser(userId: string): Promise<Scope[]>;
scopeForUser(userId: string, organizationId: string): Promise<Scope | null>;
}
export interface AuthorizedScope { actorId: string; organizationId: string; role: Role }
