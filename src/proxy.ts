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
let claims;
try {
claims = (await client.auth.getClaims()).data?.claims; // Refresh; protected routes additionally call auth.getUser().
} catch {
return NextResponse.json({ error: "UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
// Early, non-streamed redirect for pages that need a session. A present claim is not trusted here:
// every page and API still verifies the session and membership server-side on each request.
if (!claims && isProtectedPage(request.nextUrl.pathname)) {
// Same-origin target: Next.js sends it as a relative Location, so its internal localhost authority never leaks.
const target = request.nextUrl.clone();
target.pathname = "/sign-in"; target.search = "?reason=session-required";
const redirect = NextResponse.redirect(target, 307);
redirect.headers.set("Cache-Control", "private, no-store");
for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
return redirect;
}
return response;
}
const PROTECTED_PAGES = ["/workspace", "/admin", "/agent", "/farmer", "/farms"];
function isProtectedPage(pathname: string) {
return PROTECTED_PAGES.some(prefix => pathname === prefix || pathname.startsWith(prefix + "/"));
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.svg|api/health).*)"] };
