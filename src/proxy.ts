import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { pushKeyText, REQUEST_LIMITED_HEADER, requestActionFor, requestKeyOf, retryAfterSeconds, type RequestAction } from "@/modules/engineering-foundation/domain/request-limits";
import { requestLimits } from "@/modules/engineering-foundation/infrastructure/request-limits";
import { database } from "@/modules/engineering-foundation/infrastructure/database";
import { logSafe } from "@/modules/engineering-foundation/infrastructure/logging";
export async function proxy(request: NextRequest) {
// Only this proxy may say a request is over its limit.
request.headers.delete(REQUEST_LIMITED_HEADER);
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
// Request limits (D-P09-014). Counted against the signed JWT's subject; a request with no session is refused
// later by the route itself, so it is not counted here.
const subject = requestKeyOf(claims?.sub);
const serverAction = request.headers.has("next-action");
const action = subject ? requestActionFor(request.method, request.nextUrl.pathname, serverAction) : null;
if (!subject || !action) return response;
let allowed: boolean;
try { allowed = await requestLimits(database()).take(subject, action, serverAction ? null : await requestKey(request, action)); }
catch {
logSafe({ event: "request_failed", requestId: crypto.randomUUID(), code: "UNAVAILABLE" });
return withCookies(NextResponse.json({ error: "UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } }), response);
}
if (allowed) return response;
logSafe({ event: "request_failed", requestId: crypto.randomUUID(), code: "RATE_LIMITED" });
if (!serverAction) {
return withCookies(NextResponse.json({ error: "RATE_LIMITED", requestId: crypto.randomUUID() }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(retryAfterSeconds(action)) } }), response);
}
// A form gets its usual message from the server action, with what the farmer typed still in place.
request.headers.set(REQUEST_LIMITED_HEADER, "1");
return withCookies(NextResponse.next({ request }), response);
}
const PROTECTED_PAGES = ["/workspace", "/admin", "/agent", "/farmer", "/farms", "/pilot"];
function isProtectedPage(pathname: string) {
return PROTECTED_PAGES.some(prefix => pathname === prefix || pathname.startsWith(prefix + "/"));
}
/** Keeps any refreshed session cookies on a response built after the refresh. */
function withCookies(target: NextResponse, source: NextResponse) {
for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
if (source.headers.get("Cache-Control")) target.headers.set("Cache-Control", "private, no-store");
return target;
}
// The route re-reads the body; the proxy only reads a copy, and never one larger than the route itself accepts.
const MAX_KEYED_BODY = 2 * 1024 * 1024 + 8192;
async function requestKey(request: NextRequest, action: RequestAction): Promise<string | null> {
const length = Number(request.headers.get("content-length") ?? NaN);
if (!Number.isFinite(length) || length <= 0 || length > MAX_KEYED_BODY) return null;
const type = request.headers.get("content-type") ?? "";
try {
if (action === "PHOTO_UPLOAD") return type.startsWith("multipart/form-data") ? requestKeyOf((await request.clone().formData()).get("requestId")) : null;
if (!type.startsWith("application/json")) return null;
const body: unknown = await request.clone().json();
if (action !== "SYNC_PUSH") return requestKeyOf((body as { requestId?: unknown } | null)?.requestId);
const text = pushKeyText(body);
if (!text) return null;
const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
return "push:" + Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
} catch { return null; }
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.svg|sw.js|offline|api/health).*)"] };
