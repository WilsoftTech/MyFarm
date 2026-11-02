import { photoService } from "@/modules/offline-first/infrastructure/services";
import { OFFLINE_SUPPORT } from "@/modules/offline-first/domain/storage";
import { productionPageInput } from "@/modules/enterprises-seasons/infrastructure/http";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { failureResponse, privateHeaders, requireSameOrigin } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ farmId: string }> };
export async function GET(request: Request, context: Context) {
  try { return Response.json({ items: await photoService().list((await context.params).farmId, productionPageInput(request)) }, { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
/** Multipart so bytes stay binary on slow networks. The declared length is checked before the body is read. */
export async function POST(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    if (Number(request.headers.get("content-length") ?? 0) > OFFLINE_SUPPORT.maxPhotoBytes + 8192) throw new FoundationError("INVALID_INPUT");
    let form: FormData;
    try { form = await request.formData(); } catch { throw new FoundationError("INVALID_INPUT"); }
    const file = form.get("photo");
    if (!(file instanceof Blob)) throw new FoundationError("INVALID_INPUT");
    const { requestId, target, recordId, sha256 } = Object.fromEntries(form);
    const photo = await photoService().upload((await context.params).farmId, { requestId, target, recordId, sha256, contentType: file.type }, new Uint8Array(await file.arrayBuffer()));
    return Response.json({ photo }, { status: 201, headers: privateHeaders });
  } catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
