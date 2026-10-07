import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { FoundationError } from "../domain/errors";
const globalDb = globalThis as unknown as { myfarmDatabase?: PrismaClient };
export function database() {
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new FoundationError("UNAVAILABLE");
if (!globalDb.myfarmDatabase) {
globalDb.myfarmDatabase = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000 }), log: [] });
}
return globalDb.myfarmDatabase;
}
