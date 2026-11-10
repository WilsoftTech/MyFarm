import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { REQUEST_LIMITS, type RequestAction } from "../domain/request-limits";
import type { RequestLimitPort } from "../contracts/request-limits";

/** One statement per call on the database clock (D-P09-014). */
export function requestLimits(db: PrismaClient): RequestLimitPort {
  const call = async (subject: string, action: RequestAction, requestKey: string | null, record: boolean) => {
    const windows = REQUEST_LIMITS[action];
    const maxima = windows.map(window => window.max), seconds = windows.map(window => window.seconds);
    const rows = await db.$queryRaw<{ ok: boolean }[]>`SELECT myfarm_private.myfarm_take_request(${subject}::uuid, ${action}, ${requestKey}, ${maxima}::integer[], ${seconds}::integer[], ${record}) AS ok`;
    return rows[0]?.ok === true;
  };
  return {
    take: (subject, action, requestKey) => call(subject, action, requestKey, true),
    allowed: (subject, action) => call(subject, action, null, false),
    async note(subject, action, requestKey) { await db.$executeRaw`SELECT myfarm_private.myfarm_note_request(${subject}::uuid, ${action}, ${requestKey})`; },
  };
}
