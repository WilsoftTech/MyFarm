import { farmCommandRoute } from "@/modules/farm-accounting/infrastructure/http";
export const dynamic = "force-dynamic";
export const POST = farmCommandRoute("reversal", (service, farmId, body) => service.reverse(farmId, body));
