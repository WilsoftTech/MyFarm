import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { authConfiguration } from "./environment";
import { FoundationError } from "../domain/errors";
export async function supabaseServer() {
const configuration = authConfiguration();
if (!configuration) throw new FoundationError("UNAVAILABLE");
const jar = await cookies();
return createServerClient(configuration.url, configuration.key, { cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" }, cookies: {
getAll: () => jar.getAll(),
setAll: values => {
try { for (const { name, value, options } of values) jar.set(name, value, options); }
catch { /* Server components cannot set cookies; proxy performs refresh. */ }
},
} });
}
