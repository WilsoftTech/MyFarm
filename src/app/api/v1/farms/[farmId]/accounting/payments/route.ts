import { farmCommandRoute } from "@/modules/farm-accounting/infrastructure/http";
export const dynamic = "force-dynamic";
export const POST = farmCommandRoute("payment", (service, farmId, body) => service.recordPayment(farmId, body));
