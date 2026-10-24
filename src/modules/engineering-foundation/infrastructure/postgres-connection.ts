import "server-only";
import { readFileSync } from "node:fs";
import type { PoolConfig } from "pg";
import { FoundationError } from "../domain/errors";

export function postgresConnectionOptions(connectionString = process.env.DATABASE_URL): PoolConfig {
if (!connectionString) throw new FoundationError("UNAVAILABLE");
try {
const url = new URL(connectionString);
if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") throw new Error("Invalid protocol");
// Prisma encodes timestamp parameters without an offset. Keep their interpretation
// consistent with JavaScript UTC dates, including the database-clock rate window.
url.searchParams.set("options", [url.searchParams.get("options"), "-c timezone=UTC"].filter(Boolean).join(" "));
const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
if (local) return { connectionString: url.toString() };
// pg parses URL TLS options after PoolConfig; remove them so they cannot weaken verification.
for (const key of ["ssl", "sslmode", "sslcert", "sslkey", "sslrootcert", "uselibpqcompat"]) url.searchParams.delete(key);
const path = process.env.DATABASE_CA_CERT_PATH;
const ca = process.env.DATABASE_CA_CERT || (path ? readFileSync(path, "utf8") : undefined);
return { connectionString: url.toString(), ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) } };
} catch {
throw new FoundationError("UNAVAILABLE");
}
}
