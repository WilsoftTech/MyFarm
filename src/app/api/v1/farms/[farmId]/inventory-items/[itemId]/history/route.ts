import { reconstructionService } from "@/modules/harvest-inventory/infrastructure/services";
import { productionPageInput } from "@/modules/enterprises-seasons/infrastructure/http";
import { failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic="force-dynamic";
export async function GET(request:Request,context:{params:Promise<{farmId:string;itemId:string}>}) {
 try{const {farmId,itemId}=await context.params;return Response.json(await reconstructionService().history(farmId,itemId,productionPageInput(request)),{headers:privateHeaders});}
 catch(e){return failureResponse(e,crypto.randomUUID());}
}
