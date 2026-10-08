import { describe, expect, it } from "vitest";
import { commandBody } from "@/modules/farmer-registry/infrastructure/http";

const post = (headers: Record<string, string>, body = "{\"a\":1}") => new Request("http://localhost:3000/api/v1/farms", { method: "POST", headers: { "content-type": "application/json", ...headers }, body });

describe("registry command origin check", () => {
it("accepts the browser's own host even when request.url says localhost", async () => {
await expect(commandBody(post({ origin: "http://127.0.0.1:3101", host: "127.0.0.1:3101" }))).resolves.toEqual({ a: 1 });
await expect(commandBody(post({ origin: "https://myfarm.example", host: "internal:8080", "x-forwarded-host": "myfarm.example" }))).resolves.toEqual({ a: 1 });
});
it.each([
["cross-site origin", { origin: "https://untrusted.test", host: "myfarm.example" }],
["missing origin", { host: "myfarm.example" }],
["different port", { origin: "https://myfarm.example:8443", host: "myfarm.example" }],
["malformed origin", { origin: "null", host: "myfarm.example" }],
])("rejects %s", async (_name, headers) => {
await expect(commandBody(post(headers))).rejects.toMatchObject({ code: "FORBIDDEN" });
});
it("rejects non-JSON and malformed bodies", async () => {
await expect(commandBody(post({ origin: "https://a.example", host: "a.example", "content-type": "text/plain" }))).rejects.toMatchObject({ code: "INVALID_INPUT" });
await expect(commandBody(post({ origin: "https://a.example", host: "a.example" }, "{"))).rejects.toMatchObject({ code: "INVALID_INPUT" });
});
});
