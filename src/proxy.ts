import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function proxy(request: NextRequest) {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let response = NextResponse.next({ request });
if (!url || !key) return response;
const client = createServerClient(url, key, { cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" }, cookies: {
getAll: () => request.cookies.getAll(),
setAll(values) {
for (const { name, value } of values) request.cookies.set(name, value);
response = NextResponse.next({ request });
for (const { name, value, options } of values) response.cookies.set(name, value, options);
response.headers.set("Cache-Control", "private, no-store");
},
} });
try {
await client.auth.getClaims(); // Refresh only; protected routes additionally call auth.getUser().
} catch {
return NextResponse.json({ error: "UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.svg|api/health).*)"] };
