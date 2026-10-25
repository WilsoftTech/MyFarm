import "server-only";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
import { productionPageInput } from "@/modules/enterprises-seasons/infrastructure/http";
import type { AccountingRecordKind } from "../domain/accounting";
import { farmAccountingService } from "./services";

type FarmContext = { params: Promise<{ farmId: string }> };
type Service = ReturnType<typeof farmAccountingService>;

/** Farm-scoped list reads; query keys are validated strictly by the service after authentication. */
export function farmListRoute(read: (service: Service, farmId: string, input: Record<string, unknown>) => Promise<unknown>) {
  return async (request: Request, context: FarmContext) => {
    const requestId = crypto.randomUUID();
    try { return Response.json(await read(farmAccountingService(), (await context.params).farmId, productionPageInput(request)), { headers: privateHeaders }); }
    catch (error) { return failureResponse(error, requestId); }
  };
}
/** Same-origin JSON command; origin and body checks precede authentication, as for other modules. */
export function farmCommandRoute(key: string, write: (service: Service, farmId: string, body: unknown) => Promise<unknown>) {
  return async (request: Request, context: FarmContext) => {
    const requestId = crypto.randomUUID();
    try {
      const body = await commandBody(request);
      return Response.json({ [key]: await write(farmAccountingService(), (await context.params).farmId, body) }, { status: 201, headers: privateHeaders });
    } catch (error) { return failureResponse(error, requestId); }
  };
}
export const recordCommandRoute = (kind: AccountingRecordKind) => farmCommandRoute("record", (service, farmId, body) => service.recordTransaction(kind, farmId, body));
