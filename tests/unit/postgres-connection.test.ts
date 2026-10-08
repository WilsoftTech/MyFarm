import { afterEach, expect, it, vi } from "vitest";
import { postgresConnectionOptions } from "@/modules/engineering-foundation/infrastructure/postgres-connection";
import { Client } from "pg";

afterEach(() => vi.unstubAllEnvs());
it("uses the hosted CA value without depending on a developer machine path", () => {
vi.stubEnv("DATABASE_URL", "postgresql://test:password@db.example.test:5432/test");
vi.stubEnv("DATABASE_CA_CERT", "trusted-ca-pem");
vi.stubEnv("DATABASE_CA_CERT_PATH", "D:/Myfarm/.cache/nonexistent-ca.pem");
expect(postgresConnectionOptions().ssl).toEqual({ rejectUnauthorized: true, ca: "trusted-ca-pem" });
});
it.each(["ssl=0", "ssl=true", "uselibpqcompat=true&sslmode=require"])("preserves verified TLS after pg parses hosted URL options (%s)", query => {
vi.stubEnv("DATABASE_URL", `postgresql://test:password@db.example.test:5432/test?${query}`);
vi.stubEnv("DATABASE_CA_CERT_PATH", "");
const client = new Client(postgresConnectionOptions());
expect(client.ssl).toMatchObject({ rejectUnauthorized: true });
});
it("requires verified TLS for a hosted database even when the URL requests weaker TLS", () => {
vi.stubEnv("DATABASE_URL", "postgresql://test:password@db.example.test:5432/test?sslmode=no-verify");
vi.stubEnv("DATABASE_CA_CERT_PATH", "");
const options = postgresConnectionOptions();
expect(options.ssl).toEqual({ rejectUnauthorized: true });
expect(options.connectionString).not.toContain("sslmode");
});
it("permits isolated loopback PostgreSQL without TLS", () => {
vi.stubEnv("DATABASE_URL", "postgresql://test:password@127.0.0.1:55431/test");
expect(postgresConnectionOptions().ssl).toBeUndefined();
});
it("fails safely when a configured CA cannot be read", () => {
vi.stubEnv("DATABASE_URL", "postgresql://test:password@db.example.test:5432/test");
vi.stubEnv("DATABASE_CA_CERT_PATH", "D:/Myfarm/.cache/nonexistent-ca.pem");
expect(() => postgresConnectionOptions()).toThrow(expect.objectContaining({ code: "UNAVAILABLE" }));
});
