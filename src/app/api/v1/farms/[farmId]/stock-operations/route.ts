import { stockService } from "@/modules/harvest-inventory/infrastructure/services";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export async function POST(request:Request,context:{params:Promise<{farmId:string}>}) {
 try{return Response.json({result:await stockService().post((await context.params).farmId,await commandBody(request))},{status:201,headers:privateHeaders});}
 catch(e){return failureResponse(e,crypto.randomUUID());}
}

export async function GET(request:Request,context:{params:Promise<{farmId:string}>}) {
 try {const {productionPageInput}=await import("@/modules/enterprises-seasons/infrastructure/http"); return Response.json(await stockService().operations((await context.params).farmId,productionPageInput(request)),{headers:privateHeaders});}
 catch(e){return failureResponse(e,crypto.randomUUID());}
}
