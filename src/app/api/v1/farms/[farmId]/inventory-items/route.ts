import { stockService } from "@/modules/harvest-inventory/infrastructure/services";
import { productionPageInput } from "@/modules/enterprises-seasons/infrastructure/http";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export async function POST(request:Request,context:{params:Promise<{farmId:string}>}) {
 try{return Response.json({result:await stockService().createItem((await context.params).farmId,await commandBody(request))},{status:201,headers:privateHeaders});}
 catch(e){return failureResponse(e,crypto.randomUUID());}
}
export async function GET(request:Request,context:{params:Promise<{farmId:string}>}) {
 try{return Response.json(await stockService().items((await context.params).farmId,productionPageInput(request)),{headers:privateHeaders});}
 catch(e){return failureResponse(e,crypto.randomUUID());}
}
