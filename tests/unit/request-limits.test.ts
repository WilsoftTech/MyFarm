import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { pushKeyText, REQUEST_LIMITED_HEADER, REQUEST_LIMITS, requestActionFor, requestKeyOf, retryAfterSeconds } from "@/modules/engineering-foundation/domain/request-limits";

const farm = "/api/v1/farms/" + crypto.randomUUID();

describe("approved limits (D-P09-014, D-P09-016)", () => {
  it("match the owner's numbers exactly", () => {
    expect(REQUEST_LIMITS).toEqual({
      SAVE: [{ max: 120, seconds: 60 }],
      SYNC_PUSH: [{ max: 30, seconds: 60 }],
      SYNC_PULL: [{ max: 600, seconds: 60 }],
      PHOTO_UPLOAD: [{ max: 30, seconds: 3600 }, { max: 200, seconds: 86_400 }],
      MONEY_EXPORT: [{ max: 10, seconds: 3600 }],
      FARM_EXPORT: [{ max: 3, seconds: 86_400 }],
      PILOT_STAFF: [{ max: 60, seconds: 60 }],
      PILOT_JOIN_REFUSED: [{ max: 5, seconds: 900 }, { max: 20, seconds: 86_400 }],
      // D-P10-009, counted by the farm intelligence service rather than by the proxy.
      INSIGHTS_EVALUATE: [{ max: 30, seconds: 60 }],
    });
    expect(retryAfterSeconds("SAVE")).toBe(60);
    expect(retryAfterSeconds("PHOTO_UPLOAD")).toBe(3600);
  });
});

describe("which limit a request counts against", () => {
  it("phones, photos, exports and pilot staff have their own limits", () => {
    expect(requestActionFor("POST", "/api/v1/sync/push", false)).toBe("SYNC_PUSH");
    expect(requestActionFor("GET", "/api/v1/sync/pull", false)).toBe("SYNC_PULL");
    expect(requestActionFor("POST", farm + "/photos", false)).toBe("PHOTO_UPLOAD");
    expect(requestActionFor("GET", farm + "/accounting/summary/export", false)).toBe("MONEY_EXPORT");
    expect(requestActionFor("GET", farm + "/export", false)).toBe("FARM_EXPORT");
    expect(requestActionFor("POST", "/api/v1/scopes/" + crypto.randomUUID() + "/pilot/cohorts", false)).toBe("PILOT_STAFF");
  });
  it("every other write is a save, whatever its verb", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "post"]) expect(requestActionFor(method, farm + "/accounting/expenses", false)).toBe("SAVE");
    expect(requestActionFor("POST", "/api/v1/pilot/participations", false)).toBe("SAVE");
    expect(requestActionFor("POST", "/api/v1/farms", false)).toBe("SAVE");
  });
  it("reads, private-file reads (own audit limit), sign-out and non-API pages are not counted here", () => {
    expect(requestActionFor("GET", farm + "/accounting/records", false)).toBeNull();
    expect(requestActionFor("GET", farm + "/photos", false)).toBeNull();
    expect(requestActionFor("POST", farm + "/photos/" + crypto.randomUUID() + "/view", false)).toBeNull();
    expect(requestActionFor("POST", "/api/v1/scopes/a/files/b", false)).toBeNull();
    expect(requestActionFor("DELETE", "/api/v1/session", false)).toBeNull();
    expect(requestActionFor("POST", "/farms/x/accounting", false)).toBeNull();
    expect(requestActionFor("HEAD", farm + "/export", false)).toBeNull();
    expect(requestActionFor("GET", farm + "/insights", false)).toBeNull(); // counted once by the service (D-P10-009)
  });
  it("form saves are counted by the page that holds the form; signing in is left to Supabase Auth", () => {
    expect(requestActionFor("POST", "/farms/x/accounting/expenses/new", true)).toBe("SAVE");
    expect(requestActionFor("POST", "/pilot", true)).toBe("SAVE");
    expect(requestActionFor("POST", "/admin/pilot", true)).toBe("PILOT_STAFF");
    expect(requestActionFor("POST", "/admin/pilot/" + crypto.randomUUID() + "/evidence", true)).toBe("PILOT_STAFF");
    expect(requestActionFor("POST", "/admin/pilotx", true)).toBe("SAVE");
    expect(requestActionFor("POST", "/sign-in", true)).toBeNull();
    expect(requestActionFor("GET", "/farms", true)).toBeNull();
  });
});

describe("retry keys", () => {
  it("only a request ID shaped like one is a key", () => {
    const value = crypto.randomUUID();
    expect(requestKeyOf(value.toUpperCase())).toBe(value);
    for (const bad of [undefined, null, 7, "", "x".repeat(36), value + "x", { value }]) expect(requestKeyOf(bad)).toBeNull();
  });
  it("a push is the same request when it carries the same entries, in any order", () => {
    const a = crypto.randomUUID(), b = crypto.randomUUID();
    const first = pushKeyText({ commands: [{ clientMutationId: a }, { clientMutationId: b }] });
    expect(first).toBe(pushKeyText({ commands: [{ clientMutationId: b }, { clientMutationId: a }] }));
    expect(first).not.toBe(pushKeyText({ commands: [{ clientMutationId: a }] }));
    for (const bad of [null, {}, { commands: [] }, { commands: [{ clientMutationId: "x" }] }, { commands: [null] }, { commands: Array.from({ length: 21 }, () => ({ clientMutationId: crypto.randomUUID() })) }]) expect(pushKeyText(bad)).toBeNull();
  });
});

const proxyMocks = vi.hoisted(() => ({ claims: null as Record<string, unknown> | null, take: vi.fn(), database: vi.fn(() => ({})) }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getClaims: async () => ({ data: proxyMocks.claims ? { claims: proxyMocks.claims } : null }) } }) }));
vi.mock("@/modules/engineering-foundation/infrastructure/request-limits", () => ({ requestLimits: () => ({ take: proxyMocks.take }) }));
vi.mock("@/modules/engineering-foundation/infrastructure/database", () => ({ database: proxyMocks.database }));

describe("the proxy applies the limits", () => {
  const subject = crypto.randomUUID();
  const origin = "http://localhost:3000";
  const call = async (path: string, init: { method?: string; headers?: Record<string, string>; body?: BodyInit } = {}) => {
    const { proxy } = await import("@/proxy");
    return proxy(new NextRequest(origin + path, { method: init.method ?? "GET", headers: init.headers, body: init.body }));
  };
  const json = (body: unknown) => { const text = JSON.stringify(body); return { method: "POST", headers: { "content-type": "application/json", "content-length": String(text.length) }, body: text }; };
  const forwarded = (response: Response, name: string) => response.headers.get("x-middleware-request-" + name);
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:3211"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "fixture-publishable-key");
    proxyMocks.claims = { sub: subject }; proxyMocks.take.mockReset(); proxyMocks.take.mockResolvedValue(true);
  });

  it("counts a save against the signed-in subject with its request ID, and lets it through", async () => {
    const requestId = crypto.randomUUID();
    const response = await call(farm + "/accounting/expenses", json({ requestId }));
    expect(proxyMocks.take).toHaveBeenCalledWith(subject, "SAVE", requestId);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
  it("answers an API request over its limit with 429, the usual error shape and when to retry", async () => {
    proxyMocks.take.mockResolvedValue(false);
    const response = await call("/api/v1/sync/push", json({ commands: [{ clientMutationId: crypto.randomUUID() }] }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ error: "RATE_LIMITED" });
    expect(proxyMocks.take).toHaveBeenCalledWith(subject, "SYNC_PUSH", expect.stringMatching(/^push:[0-9a-f]{64}$/));
  });
  it("lets an over-limit form save reach its server action, flagged, so the form keeps what was typed", async () => {
    proxyMocks.take.mockResolvedValue(false);
    const response = await call("/farms/x/accounting/expenses/new", { method: "POST", headers: { "next-action": "abc" } });
    expect(proxyMocks.take).toHaveBeenCalledWith(subject, "SAVE", null);
    expect(response.status).toBe(200);
    expect(forwarded(response, REQUEST_LIMITED_HEADER)).toBe("1");
  });
  it("never forwards a flag the browser sent itself", async () => {
    const response = await call("/farms/x/accounting/expenses/new", { method: "POST", headers: { "next-action": "abc", [REQUEST_LIMITED_HEADER]: "1" } });
    expect(forwarded(response, REQUEST_LIMITED_HEADER)).toBeNull();
  });
  it("does not count requests without a session or with an unusable subject, and never opens the database for them", async () => {
    proxyMocks.claims = null;
    expect((await call(farm + "/accounting/expenses", json({ requestId: crypto.randomUUID() }))).status).toBe(200);
    proxyMocks.claims = { sub: "not-a-uuid" };
    expect((await call(farm + "/accounting/expenses", json({ requestId: crypto.randomUUID() }))).status).toBe(200);
    expect(proxyMocks.take).not.toHaveBeenCalled();
    expect(proxyMocks.database).not.toHaveBeenCalled();
  });
  it("does not count page loads or reads", async () => {
    await call("/farms"); await call(farm + "/accounting/records");
    expect(proxyMocks.take).not.toHaveBeenCalled();
  });
  it("refuses with 503 rather than skip the limit when the count cannot be taken", async () => {
    proxyMocks.take.mockRejectedValue(new Error("connection refused"));
    const response = await call(farm + "/accounting/expenses", json({ requestId: crypto.randomUUID() }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "UNAVAILABLE" });
  });
  it("does not read a body larger than the route accepts, so no key is taken from it", async () => {
    await call(farm + "/accounting/expenses", { method: "POST", headers: { "content-type": "application/json", "content-length": String(3 * 1024 * 1024) }, body: JSON.stringify({ requestId: crypto.randomUUID() }) });
    expect(proxyMocks.take).toHaveBeenCalledWith(subject, "SAVE", null);
  });
  it("takes a photo's request ID from its form", async () => {
    const requestId = crypto.randomUUID();
    const form = new FormData(); form.set("requestId", requestId); form.set("photo", new Blob([new Uint8Array(10)], { type: "image/jpeg" }));
    const encoded = new Request("http://x", { method: "POST", body: form });
    const bytes = await encoded.arrayBuffer();
    await call(farm + "/photos", { method: "POST", headers: { "content-type": encoded.headers.get("content-type")!, "content-length": String(bytes.byteLength) }, body: bytes });
    expect(proxyMocks.take).toHaveBeenCalledWith(subject, "PHOTO_UPLOAD", requestId);
  });
});
