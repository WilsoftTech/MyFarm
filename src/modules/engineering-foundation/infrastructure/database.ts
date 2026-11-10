import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { FoundationError } from "../domain/errors";
import { postgresConnectionOptions } from "./postgres-connection";
const globalDb = globalThis as unknown as { myfarmDatabase?: PrismaClient };
export function database() {
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new FoundationError("UNAVAILABLE");
if (!globalDb.myfarmDatabase) {
// A new TLS connection through the hosted pooler takes 7-8 round trips: about 4.5 s on a 0.5 s link, such as
// development from Uganda to the eu-central-1 database. Allow 15 s to connect, and keep idle connections for a minute
// so ordinary page loads reuse one instead of paying that handshake again.
globalDb.myfarmDatabase = new PrismaClient({ adapter: new PrismaPg({ ...postgresConnectionOptions(), max: 5, connectionTimeoutMillis: 15_000, idleTimeoutMillis: 60_000 }), log: [] });
}
return globalDb.myfarmDatabase;
}
