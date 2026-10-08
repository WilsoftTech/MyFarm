import { expect, it } from "vitest";
import { requireSameOrigin } from "@/modules/engineering-foundation/infrastructure/http";

it("accepts the actual authority when Next normalizes its internal hostname", () => {
const request = new Request("http://localhost:3101/api/file", { headers: { host: "127.0.0.1:3101", origin: "http://127.0.0.1:3101" } });
expect(() => requireSameOrigin(request)).not.toThrow();
});
const headerCases: Record<string, string>[] = [
{ host: "myfarm.example", origin: "https://attacker.example" },
{ host: "myfarm.example", origin: "http://myfarm.example" },
{ host: "myfarm.example" },
{ host: "myfarm.example/path", origin: "https://myfarm.example" },
{ host: "myfarm.example", origin: "https://attacker.example", "x-forwarded-host": "attacker.example" },
];
it.each(headerCases)("rejects hostile, missing or malformed origins/authorities", headers => {
const request = new Request("https://localhost/api/file", { headers });
expect(() => requireSameOrigin(request)).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
});
