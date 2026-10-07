import { HealthService } from "@/modules/engineering-foundation/application/health";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { database } from "@/modules/engineering-foundation/infrastructure/database";
import { failureResponse } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
export async function GET() {
const requestId = crypto.randomUUID();
try {
const service = new HealthService(authorizationService(), { async ping() { await database().$queryRaw`SELECT 1`; } });
return Response.json(await service.readiness(), { headers: { "Cache-Control": "private, no-store" } });
} catch (error) { return failureResponse(error, requestId); }
}
