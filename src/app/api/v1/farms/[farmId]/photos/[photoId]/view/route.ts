import { z } from "zod";
import { photoService } from "@/modules/offline-first/infrastructure/services";
import { supabaseServer } from "@/modules/engineering-foundation/infrastructure/supabase";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { database } from "@/modules/engineering-foundation/infrastructure/database";
import { auditService } from "@/modules/engineering-foundation/infrastructure/audit";
import { privateStorage } from "@/modules/engineering-foundation/infrastructure/private-storage";
import { PrivateFileService } from "@/modules/engineering-foundation/application/private-files";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
const payload = z.object({ requestId: z.uuid() }).strict();
/** A short-lived, audited link, issued only after this farm is confirmed to hold the photo. */
export async function POST(request: Request, context: { params: Promise<{ farmId: string; photoId: string }> }) {
  try {
    const body = payload.safeParse(await commandBody(request));
    if (!body.success) throw new FoundationError("INVALID_INPUT");
    const { farmId, photoId } = await context.params;
    const photo = await photoService().readable(farmId, photoId);
    const files = new PrivateFileService(authorizationService(), privateStorage(await supabaseServer(), process.env.SUPABASE_PRIVATE_BUCKET ?? "myfarm-private"), auditService(database()));
    return Response.json({ url: await files.read(photo.tenantId, photo.photoId, body.data.requestId), expiresInSeconds: 60 }, { headers: privateHeaders });
  } catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
