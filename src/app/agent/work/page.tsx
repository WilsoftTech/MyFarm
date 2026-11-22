import { redirect } from "next/navigation";
import { VisitWork } from "@/components/officers/visit-work";
import { officerServices } from "@/modules/extension-officers/infrastructure/services";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ scope?: string; farmId?: string; assignmentId?: string }> }) {
  try { const query = await searchParams, actor = await authorizationService().scope(query.scope, ["AGENT"]);
    const rows = await officerServices().work.visits(actor.organizationId, query.farmId, query.assignmentId);
    return <VisitWork context={{ accountId: actor.actorId, scope: actor.organizationId, farmId: query.farmId ?? "", assignmentId: query.assignmentId ?? "" }} rows={rows} />;
  } catch (error) { if (error instanceof FoundationError) redirect(error.code === "UNAUTHENTICATED" ? "/sign-in" : "/forbidden"); throw error; }
}
