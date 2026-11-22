import { redirect } from "next/navigation";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { RoleWorkspace } from "@/components/role-workspace";
import { OfficerDashboard } from "@/components/officers/dashboard";
import { officerServices } from "@/modules/extension-officers/infrastructure/services";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ scope?: string; cursor?: string }> }) {
const query = await searchParams;
let view;
try { view = await officerServices().dashboard.read(query.scope, query.cursor ?? null); }
catch (error) {
if (error instanceof FoundationError && error.code === "UNAUTHENTICATED") redirect("/sign-in");
if (error instanceof FoundationError && (error.code === "FORBIDDEN" || error.code === "INVALID_INPUT")) redirect("/forbidden");
throw new FoundationError("UNAVAILABLE");
}
return <RoleWorkspace title="Agent workspace"><OfficerDashboard view={view} scope={query.scope ?? ""} /></RoleWorkspace>;
}
