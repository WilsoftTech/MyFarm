import {poultryProductionService} from "@/modules/harvest-inventory/infrastructure/services";
import {productionPageInput} from "@/modules/enterprises-seasons/infrastructure/http";
import {failureResponse,privateHeaders} from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic="force-dynamic";
export async function GET(request:Request,context:{params:Promise<{farmId:string;batchId:string}>}){try{const {farmId,batchId}=await context.params;return Response.json(await poultryProductionService().events(farmId,batchId,productionPageInput(request)),{headers:privateHeaders});}catch(e){return failureResponse(e,crypto.randomUUID());}}
