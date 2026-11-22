import { redirect } from "next/navigation";
import { PrepareRegistration } from "@/components/officers/registration";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  try { const { scope } = await searchParams; const actor = await authorizationService().scope(scope, ["AGENT"]); return <PrepareRegistration accountId={actor.actorId} scope={actor.organizationId} />; }
  catch (error) { if (error instanceof FoundationError) redirect(error.code === "UNAUTHENTICATED" ? "/sign-in" : "/forbidden"); throw error; }
}
