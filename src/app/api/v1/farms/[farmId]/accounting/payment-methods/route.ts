import { farmListRoute } from "@/modules/farm-accounting/infrastructure/http";
export const dynamic = "force-dynamic";
export const GET = farmListRoute((service, farmId, input) => service.paymentMethods(farmId, input));
