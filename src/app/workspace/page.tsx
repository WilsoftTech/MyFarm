import Link from "next/link";
import { redirect } from "next/navigation";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { Button } from "@/components/ui/button";
import { signOutAction } from "../sign-in/actions";
export const dynamic = "force-dynamic";
export default async function WorkspacePage() {
let overview;
try { overview = await authorizationService().overview(); }
catch (error) {
if (error instanceof FoundationError && error.code === "UNAUTHENTICATED") redirect("/sign-in?reason=session-required");
if (error instanceof FoundationError && error.code === "FORBIDDEN") redirect("/forbidden");
throw new FoundationError("UNAVAILABLE");
}
return <section><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-sm text-primary">Your workspace</p><h1 className="mt-2 text-3xl font-bold">Welcome to MyFarm</h1></div><form action={signOutAction}><Button variant="outline">Sign out</Button></form></div>
<p className="mt-6 leading-7">Your account is verified. Choose an available workspace below.</p>
{overview.scopes.length === 0 ? <div className="mt-8 rounded-2xl border border-border bg-white p-6"><h2 className="font-semibold">No workspace assigned</h2><p className="mt-3 leading-7">Ask the project owner to assign access. Farm registration is coming in a later release.</p></div> :
<ul className="mt-8 grid gap-4 sm:grid-cols-2">{overview.scopes.map(scope => <li key={scope.organizationId} className="rounded-2xl border border-border bg-white p-6"><h2 className="text-xl font-semibold">{scope.name}</h2><p className="mt-2 text-sm">Access: {scope.role.toLowerCase()}</p><p className="mt-4 text-sm leading-6">Farm record tools are coming in later releases.</p>{scope.role === "AGENT" && <Link className="mt-4 block underline" href={"/agent?scope=" + scope.organizationId}>Open agent workspace</Link>}{scope.role === "ADMIN" && <Link className="mt-4 block underline" href={"/admin?scope=" + scope.organizationId}>Open administrator workspace</Link>}</li>)}</ul>}
</section>;
}
