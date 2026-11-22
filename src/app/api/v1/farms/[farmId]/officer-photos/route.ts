import { officerServices } from "@/modules/extension-officers/infrastructure/services";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { requireSameOrigin, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export async function POST(request: Request, context: { params: Promise<{ farmId: string }> }) {
  try {
    requireSameOrigin(request);
    await authorizationService().scope(new URL(request.url).searchParams.get("scope"), ["AGENT"]);
    const length = Number(request.headers.get("content-length"));
    if (!Number.isFinite(length) || length <= 0 || length > 2 * 1024 * 1024 + 8192) throw new FoundationError("INVALID_INPUT");
    const form = await request.formData(), photo = form.get("photo");
    if (!(photo instanceof File) || photo.size > 2 * 1024 * 1024) throw new FoundationError("INVALID_INPUT");
    const command = { requestId: form.get("requestId"), visitId: form.get("visitId"), sha256: form.get("sha256"), contentType: photo.type, byteSize: photo.size };
    return Response.json(await officerServices().work.upload(new URL(request.url).searchParams.get("scope"), (await context.params).farmId, command, new Uint8Array(await photo.arrayBuffer())), { headers: privateHeaders });
  } catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
