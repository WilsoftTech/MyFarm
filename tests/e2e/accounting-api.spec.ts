import { expect, test } from "@playwright/test";
const farm = "11111111-1111-4111-8111-111111111111", record = "22222222-2222-4222-8222-222222222222";
const base = `/api/v1/farms/${farm}/accounting`;
const origin = { origin: "http://127.0.0.1:3101" };
const writes = ["expenses", "income", "sales", "purchases", "payments", "reversals"];

test("accounting reads deny anonymous callers before query or ID validation (P04-T002)", async ({ request }) => {
  for (const path of ["records", "records/" + record, "records/bad", "payments/" + record, "payments/bad", "categories", "categories?kind=TAX", "payment-methods"]) {
    for (const suffix of ["", path.includes("?") ? "&limit=no" : "?limit=no", path.includes("?") ? "&tenantId=forged" : "?tenantId=forged"]) {
      const response = await request.get(`${base}/${path}${suffix}`);
      expect(response.status()).toBe(401); expect(response.headers()["cache-control"]).toContain("no-store");
      expect((await response.json()).error).toBe("UNAUTHENTICATED");
    }
  }
});
test("accounting writes require a session and fail without leaking data (P04-T002)", async ({ request }) => {
  for (const resource of writes) {
    const response = await request.post(`${base}/${resource}`, { headers: origin, data: { requestId: record, amount: "150000", currency: "UGX" } });
    expect(response.status()).toBe(401); expect(response.headers()["cache-control"]).toContain("no-store");
    expect(await response.json()).toEqual({ error: "UNAUTHENTICATED", requestId: expect.any(String) });
  }
});
test("accounting writes reject cross-origin, missing-origin and malformed JSON (P04-T002)", async ({ request }) => {
  for (const resource of writes) {
    const path = `${base}/${resource}`;
    const origins: Record<string, string>[] = [{ origin: "https://untrusted.test" }, {}];
    for (const headers of origins) {
      const response = await request.post(path, { headers, data: {} });
      expect(response.status()).toBe(403); expect((await response.json()).error).toBe("FORBIDDEN");
    }
    const malformed = await request.post(path, { headers: { ...origin, "content-type": "application/json" }, data: Buffer.from("{", "utf8") });
    expect(malformed.status()).toBe(400); expect((await malformed.json()).error).toBe("INVALID_INPUT");
  }
});
test("accounting records are not writable or removable through unsupported methods (P04-T002)", async ({ request }) => {
  for (const response of [await request.put(`${base}/records/${record}`, { headers: origin, data: {} }), await request.delete(`${base}/records/${record}`, { headers: origin }), await request.post(`${base}/records`, { headers: origin, data: {} })]) {
    expect(response.status()).toBe(405);
  }
});
