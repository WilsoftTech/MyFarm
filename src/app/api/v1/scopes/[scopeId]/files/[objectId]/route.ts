import { z } from "zod";
import { supabaseServer } from "@/modules/engineering-foundation/infrastructure/supabase";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { database } from "@/modules/engineering-foundation/infrastructure/database";
import { auditService } from "@/modules/engineering-foundation/infrastructure/audit";
import { privateStorage } from "@/modules/engineering-foundation/infrastructure/private-storage";
import { PrivateFileService } from "@/modules/engineering-foundation/application/private-files";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { failureResponse, requireSameOrigin } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
const payload = z.object({ requestId: z.uuid() }).strict();
export async function POST(request: Request, context: { params: Promise<{ scopeId: string; objectId: string }> }) {
const requestId = crypto.randomUUID();
try {
requireSameOrigin(request);
if (!request.headers.get("content-type")?.startsWith("application/json")) throw new FoundationError("INVALID_INPUT");
let body: unknown;
try { body = await request.json(); } catch { throw new FoundationError("INVALID_INPUT"); }
const parsed = payload.safeParse(body);
if (!parsed.success) throw new FoundationError("INVALID_INPUT");
const { scopeId, objectId } = await context.params;
const authorization = authorizationService();
await authorization.scope(scopeId); // Fail closed before constructing any privileged adapter.
const client = await supabaseServer();
const service = new PrivateFileService(authorization, privateStorage(client, process.env.SUPABASE_PRIVATE_BUCKET ?? "myfarm-private"), auditService(database()));
const url = await service.read(scopeId, objectId, parsed.data.requestId);
return Response.json({ url, expiresInSeconds: 60 }, { headers: { "Cache-Control": "private, no-store" } });
} catch (error) { return failureResponse(error, requestId); }
}
