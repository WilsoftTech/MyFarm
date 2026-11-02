import { expect, test } from "@playwright/test";
const farm = "11111111-1111-4111-8111-111111111111", record = "22222222-2222-4222-8222-222222222222";
test("closure commands require authentication, same-origin JSON and private failures", async ({ request }) => {
  for (const resource of ["seasons", "crop-cycles"]) {
    const path = `/api/v1/farms/${farm}/${resource}/${record}/close`;
    const response = await request.post(path, { headers: { origin: "http://127.0.0.1:3101" }, data: { requestId: record, expectedVersion: 1, confirmed: true } });
    expect(response.status()).toBe(401); expect(response.headers()["cache-control"]).toContain("no-store");
    expect((await response.json()).error).toBe("UNAUTHENTICATED");
    const invalidOrigins: Record<string, string>[] = [{ origin: "https://untrusted.test" }, {}];
    for (const headers of invalidOrigins) expect((await request.post(path, { headers, data: {} })).status()).toBe(403);
    const malformed = await request.post(path, { headers: { origin: "http://127.0.0.1:3101", "content-type": "application/json" }, data: Buffer.from("{") });
    expect(malformed.status()).toBe(400);
  }
});
test("production reads deny anonymous callers before query or ID validation", async ({ request }) => {
  for (const resource of ["enterprises", "seasons", "crop-cycles", "poultry-batches", "activities"]) {
    for (const suffix of ["", "/" + record, "/bad", "?limit=no", "?tenantId=forged"]) {
      const response = await request.get(`/api/v1/farms/${farm}/${resource}${suffix}`);
      expect(response.status()).toBe(401);
      expect(response.headers()["cache-control"]).toContain("no-store");
      expect((await response.json()).error).toBe("UNAUTHENTICATED");
    }
  }
});
test("production writes require a session and fail without leaking data", async ({ request }) => {
  for (const resource of ["enterprises", "seasons", "crop-cycles", "poultry-batches", "activities"]) {
    const response = await request.post(`/api/v1/farms/${farm}/${resource}`, { headers: { origin: "http://127.0.0.1:3101" }, data: { requestId: record } });
    expect(response.status()).toBe(401); expect(response.headers()["cache-control"]).toContain("no-store");
    expect(await response.json()).toEqual({ error: "UNAUTHENTICATED", requestId: expect.any(String) });
  }
});
test("production writes reject cross-origin, missing-origin and malformed JSON", async ({ request }) => {
  for (const resource of ["enterprises", "seasons", "crop-cycles", "poultry-batches", "activities"]) {
    const path = `/api/v1/farms/${farm}/${resource}`;
    const origins: Record<string, string>[] = [{ origin: "https://untrusted.test" }, {}];
    for (const headers of origins) {
      const response = await request.post(path, { headers, data: {} });
      expect(response.status()).toBe(403); expect((await response.json()).error).toBe("FORBIDDEN");
    }
    const response = await request.post(path, { headers: { origin: "http://127.0.0.1:3101", "content-type": "application/json" }, data: Buffer.from("{", "utf8") });
    expect(response.status()).toBe(400); expect((await response.json()).error).toBe("INVALID_INPUT");
  }
});

test("crop and animal-type catalog reads require farm authorization and remain private", async ({ request }) => {
  for (const catalog of ["crops", "animal-types"]) {
    for (const suffix of ["", "?limit=no", "?tenantId=forged"]) {
      const response = await request.get(`/api/v1/farms/${farm}/${catalog}${suffix}`);
      expect(response.status()).toBe(401); expect(response.headers()["cache-control"]).toContain("no-store");
      expect((await response.json()).error).toBe("UNAUTHENTICATED");
    }
  }
});
test("activity reads and writes deny anonymous callers without leaking data", async ({ request }) => {
  for (const path of ["activities/capabilities", "activities/" + record, "activity-series", "activity-series/" + record]) {
    const response = await request.get(`/api/v1/farms/${farm}/${path}`);
    expect(response.status()).toBe(401); expect(response.headers()["cache-control"]).toContain("no-store");
    expect((await response.json()).error).toBe("UNAUTHENTICATED");
  }
  for (const path of ["activities/" + record + "/complete", "activities/" + record + "/cancel", "activity-series", "activity-series/expand", "activity-series/" + record + "/change", "activity-series/" + record + "/stop"]) {
    const url = `/api/v1/farms/${farm}/${path}`;
    const response = await request.post(url, { headers: { origin: "http://127.0.0.1:3101" }, data: { requestId: record } });
    expect(response.status()).toBe(401); expect(response.headers()["cache-control"]).toContain("no-store");
    expect(await response.json()).toEqual({ error: "UNAUTHENTICATED", requestId: expect.any(String) });
    const invalidOrigins: Record<string, string>[] = [{ origin: "https://untrusted.test" }, {}];
    for (const headers of invalidOrigins) expect((await request.post(url, { headers, data: {} })).status()).toBe(403);
  }
});
