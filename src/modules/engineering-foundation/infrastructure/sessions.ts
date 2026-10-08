import "server-only";
import type { SessionPort } from "../contracts/identity";
import { supabaseServer } from "./supabase";
import { authConfiguration } from "./environment";
import { FoundationError } from "../domain/errors";
import { z } from "zod";
import { database } from "./database";
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
if (!data.user) return null;
// A valid JWT can outlive sign-out. Verify the corresponding server session too.
const claims = await client.auth.getClaims();
if (claims.error) {
if (claims.error.status === 400 || claims.error.status === 401 || claims.error.status === 403) return null;
throw new FoundationError("UNAVAILABLE");
}
const sessionId = z.uuid().safeParse(claims.data?.claims.session_id);
if (!sessionId.success || claims.data?.claims.sub !== data.user.id) return null;
try {
const rows = await database().$queryRaw<{ active: boolean }[]>`
SELECT myfarm_private.myfarm_session_is_active(${sessionId.data}::uuid, ${data.user.id}::uuid) AS active`;
return rows[0]?.active ? { authSubject: data.user.id } : null;
} catch {
throw new FoundationError("UNAVAILABLE");
}
},
};
