import { stockService } from "@/modules/harvest-inventory/infrastructure/services";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export async function POST(request:Request,context:{params:Promise<{farmId:string}>}) {
 try{return Response.json({result:await stockService().reverse((await context.params).farmId,await commandBody(request))},{status:201,headers:privateHeaders});}
 catch(e){return failureResponse(e,crypto.randomUUID());}
}
