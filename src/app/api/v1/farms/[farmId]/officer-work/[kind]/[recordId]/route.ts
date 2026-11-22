import { officerServices } from "@/modules/extension-officers/infrastructure/services";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export async function POST(request: Request, context: { params: Promise<{ farmId: string; kind: string; recordId: string }> }) {
  try { const { farmId, kind, recordId } = await context.params;
    if (kind !== "follow-up" && kind !== "problem") throw new FoundationError("INVALID_INPUT");
    return Response.json(await officerServices().work.finish(new URL(request.url).searchParams.get("scope"), farmId, kind === "follow-up" ? "FOLLOW_UP" : "PROBLEM", recordId, await commandBody(request)), { headers: privateHeaders });
  } catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
