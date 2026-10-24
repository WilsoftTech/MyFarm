// Test-only Auth stand-in: used by Playwright, never imported by application code.
import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
const secret = process.env.MYFARM_BROWSER_AUTH_SECRET;
if (!secret) throw new Error("Fixture Auth secret required");
const server = createServer((request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.url === "/health") { response.end('{"status":"ok"}'); return; }
  try {
    const token = (request.headers.authorization ?? "").replace(/^Bearer /, "");
    const [header, payload, signature] = token.split(".");
    if (!header || !payload || !signature) throw new Error("Invalid fixture token");
    const expected = createHmac("sha256", secret).update(header + "." + payload).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("Invalid fixture signature");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const fixtures = JSON.parse(readFileSync(".cache/production-browser-fixtures.json", "utf8"));
    const account = Object.values(fixtures.accounts).find(value => value.subject === claims.sub);
    if (!account || claims.exp <= Date.now() / 1000) throw new Error("Expired fixture");
    if (request.method === "GET" && request.url === "/auth/v1/user") {
      response.end(JSON.stringify({ id: account.subject, email: account.email, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-10-18T00:00:00Z" })); return;
    }
  } catch { /* Fail closed for malformed/unknown fixtures. */ }
  response.writeHead(401); response.end('{"code":"bad_jwt","msg":"Invalid test session"}');
});
server.listen(3211, "127.0.0.1");
process.on("SIGTERM", () => server.close());
