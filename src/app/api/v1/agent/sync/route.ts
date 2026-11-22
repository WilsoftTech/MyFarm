import { officerEnvelopeSchema } from "@/modules/extension-officers/contracts/work";
import { officerServices } from "@/modules/extension-officers/infrastructure/services";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { commandBody, requireSameOrigin, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await authorizationService().account();
    const parsed = officerEnvelopeSchema.safeParse(await commandBody(request));
    if (!parsed.success) throw new FoundationError("INVALID_INPUT");
    const row = parsed.data, service = officerServices().work;
    let result;
    switch (row.operation) {
      case "OFFICER_PREPARE_REGISTRATION": result = await service.prepare(row.organizationId, row.payload); break;
      case "OFFICER_RECORD_VISIT": result = await service.recordVisit(row.organizationId, row.farmId, row.payload); break;
      case "OFFICER_FINISH_FOLLOW_UP": result = await service.finish(row.organizationId, row.farmId, "FOLLOW_UP", row.recordId, row.payload); break;
      case "OFFICER_RESOLVE_PROBLEM": result = await service.finish(row.organizationId, row.farmId, "PROBLEM", row.recordId, row.payload); break;
      default: throw new FoundationError("INVALID_INPUT");
    }
    return Response.json(result, { headers: privateHeaders });
  } catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
