import { z } from "zod";
import { officerServices } from "@/modules/extension-officers/infrastructure/services";
import { auditService } from "@/modules/engineering-foundation/infrastructure/audit";
import { database } from "@/modules/engineering-foundation/infrastructure/database";
import { privateStorage } from "@/modules/engineering-foundation/infrastructure/private-storage";
import { supabaseServer } from "@/modules/engineering-foundation/infrastructure/supabase";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export async function POST(request: Request, context: { params: Promise<{ farmId: string; photoId: string }> }) {
  try {
    const body = z.object({ requestId: z.uuid() }).strict().safeParse(await commandBody(request));
    if (!body.success) throw new FoundationError("INVALID_INPUT");
    const { farmId, photoId } = await context.params;
    const photo = await officerServices().work.readable(new URL(request.url).searchParams.get("scope"), farmId, photoId);
    await auditService(database()).append({ actorId: photo.actorId, tenantId: photo.tenantId, action: "PRIVATE_FILE_READ", targetId: photoId, requestId: body.data.requestId });
    const storage = privateStorage(await supabaseServer(), process.env.SUPABASE_PRIVATE_BUCKET ?? "myfarm-private", "officer-visits");
    const url = await storage.signedRead({ actorId: photo.actorId, organizationId: photo.tenantId, role: photo.role }, photoId);
    return Response.json({ url, expiresInSeconds: 60 }, { headers: privateHeaders });
  } catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
