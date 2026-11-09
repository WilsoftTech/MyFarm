import Link from "next/link";
import { redirect } from "next/navigation";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { RoleWorkspace } from "@/components/role-workspace";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
const scope = (await searchParams).scope;
try { await authorizationService().scope(scope, ["ADMIN"]); }
catch (error) {
if (error instanceof FoundationError && error.code === "UNAUTHENTICATED") redirect("/sign-in");
if (error instanceof FoundationError && (error.code === "FORBIDDEN" || error.code === "INVALID_INPUT")) redirect("/forbidden");
throw new FoundationError("UNAVAILABLE");
}
return <RoleWorkspace title="Administrator workspace"><Link href={"/admin/pilot?scope=" + encodeURIComponent(scope ?? "")} className="mt-6 inline-block rounded-xl border border-border px-5 py-3 font-semibold">Pilot cohorts</Link></RoleWorkspace>;
}
