/**
 * Per-person request limits (D-P09-014; closes P7-C6, P4-C4 and P5-C3 once on hosted). Each limit is a number of
 * requests in a window of seconds; every window must have room. Private-file reads keep their own limit (30 a minute,
 * counted from the audit trail) and sign-in limits belong to Supabase Auth (Phase 1 C4).
 */
export interface RequestWindow { readonly max: number; readonly seconds: number }

export const REQUEST_LIMITS = Object.freeze({
  /** Any other save: far above a person typing; stops scripts. */
  SAVE: [{ max: 120, seconds: 60 }],
  /** 20 entries a request, so 600 entries a minute; a full 500-entry queue needs 25 requests. */
  SYNC_PUSH: [{ max: 30, seconds: 60 }],
  /** D-P09-016: every signed-in page open refreshes saved copies, at least 12 pages per farm. */
  SYNC_PULL: [{ max: 600, seconds: 60 }],
  PHOTO_UPLOAD: [{ max: 30, seconds: 3600 }, { max: 200, seconds: 86_400 }],
  MONEY_EXPORT: [{ max: 10, seconds: 3600 }],
  FARM_EXPORT: [{ max: 3, seconds: 86_400 }],
  PILOT_STAFF: [{ max: 60, seconds: 60 }],
  /** Counted only when a code is refused, so a farmer who mistypes is not blocked for long. */
  PILOT_JOIN_REFUSED: [{ max: 5, seconds: 900 }, { max: 20, seconds: 86_400 }],
  /**
   * D-P10-009 (closes P10-C4): each Alerts open or GET .../insights runs every rule on the farm's records and stores
   * the results. Counted by the service, not here, so the page and the API share one count.
   */
  INSIGHTS_EVALUATE: [{ max: 30, seconds: 60 }],
} satisfies Record<string, readonly RequestWindow[]>);

export type RequestAction = keyof typeof REQUEST_LIMITS;

const WRITES = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const FARM = "^/api/v1/farms/[^/]+";
const MONEY_EXPORT = new RegExp(FARM + "/accounting/summary/export$");
const FARM_EXPORT = new RegExp(FARM + "/export$");
const PHOTO_UPLOAD = new RegExp(FARM + "/photos$");
const PRIVATE_FILE_READ = [new RegExp(FARM + "/photos/[^/]+/view$"), /^\/api\/v1\/scopes\/[^/]+\/files\//];
const PILOT_STAFF_API = /^\/api\/v1\/scopes\/[^/]+\/pilot\//;
const under = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(prefix + "/");

/**
 * Which limit a request counts against, or null when it is not limited here. A server action is a POST to the page
 * that holds the form; signing in and out are left to Supabase Auth.
 */
export function requestActionFor(method: string, pathname: string, serverAction: boolean): RequestAction | null {
  const verb = method.toUpperCase();
  if (serverAction) {
    if (verb !== "POST" || under(pathname, "/sign-in")) return null;
    return under(pathname, "/admin/pilot") ? "PILOT_STAFF" : "SAVE";
  }
  if (!pathname.startsWith("/api/v1/")) return null;
  if (verb === "GET") {
    if (pathname === "/api/v1/sync/pull") return "SYNC_PULL";
    if (MONEY_EXPORT.test(pathname)) return "MONEY_EXPORT";
    if (FARM_EXPORT.test(pathname)) return "FARM_EXPORT";
    return null;
  }
  if (!WRITES.has(verb) || pathname === "/api/v1/session") return null;
  if (PRIVATE_FILE_READ.some(pattern => pattern.test(pathname))) return null;
  if (pathname === "/api/v1/sync/push") return "SYNC_PUSH";
  if (PHOTO_UPLOAD.test(pathname)) return "PHOTO_UPLOAD";
  if (PILOT_STAFF_API.test(pathname)) return "PILOT_STAFF";
  return "SAVE";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The request's own ID, so a retry of the same request is not counted twice. Anything else gives no key. */
export function requestKeyOf(value: unknown): string | null {
  return typeof value === "string" && UUID.test(value) ? value.toLowerCase() : null;
}

/** A phone push is the same request when it carries the same entries; the caller hashes this text. */
export function pushKeyText(body: unknown): string | null {
  if (!body || typeof body !== "object" || !Array.isArray((body as { commands?: unknown }).commands)) return null;
  const ids = (body as { commands: unknown[] }).commands.map(command => requestKeyOf((command as { clientMutationId?: unknown } | null)?.clientMutationId));
  if (ids.length === 0 || ids.length > 20 || ids.some(value => value === null)) return null;
  return "push:" + [...ids].sort().join(",");
}

/** How long the person should wait, in seconds, before trying again: the shortest window. */
export function retryAfterSeconds(action: RequestAction): number {
  return Math.min(...REQUEST_LIMITS[action].map(window => window.seconds));
}

/** Set by the proxy, and only by it, when a form save is over its limit; the server action then refuses it. */
export const REQUEST_LIMITED_HEADER = "x-myfarm-request-limited";
