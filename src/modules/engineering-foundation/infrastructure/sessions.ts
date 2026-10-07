import "server-only";
import type { SessionPort } from "../contracts/identity";
import { supabaseServer } from "./supabase";
import { authConfiguration } from "./environment";
import { FoundationError } from "../domain/errors";
export const sessions: SessionPort = {
async currentIdentity() {
if (!authConfiguration()) return null;
const client = await supabaseServer();
// Auth server validation checks current user; never trust client role or getSession().
const { data, error } = await client.auth.getUser();
if (error) {
if (error.status === 400 || error.status === 401 || error.status === 403 || error.name === "AuthSessionMissingError") return null;
throw new FoundationError("UNAVAILABLE");
}
return data.user ? { authSubject: data.user.id } : null;
},
};
