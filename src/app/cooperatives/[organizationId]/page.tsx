import Link from "next/link";
import { cooperativeService } from "@/modules/cooperatives/infrastructure/services";
import { farmerRegistryService } from "@/modules/farmer-registry/infrastructure/services";
import { CommandForm } from "@/components/cooperatives/command-form";
import { CooperativeRecords } from "@/components/cooperatives/records";
import { CooperativeReport } from "@/components/cooperatives/report";
import { cooperativePage } from "../guard";
export const dynamic = "force-dynamic";
export default async function Page({ params, searchParams }: { params: Promise<{ organizationId: string }>; searchParams: Promise<{ section?: string; cursor?: string; farmCursor?: string }> }) {
  const { organizationId } = await params, query = await searchParams;
  const view = await cooperativePage(() => cooperativeService().read(organizationId, query.section ?? "members", query.cursor ?? null));
  const registry = farmerRegistryService();
  const hasFarmerProfile = view.role === "FARMER" && view.section === "farms" ? await cooperativePage(() => registry.currentFarmer()) : null;
  const ownFarms = hasFarmerProfile ? await cooperativePage(() => registry.listFarms(query.farmCursor ? { cursor: query.farmCursor } : {})) : null;
  const sections = view.role === "BUYER" ? ["lots"] : view.role === "AGENT" ? ["farms", "forecasts"] : view.role === "FARMER" ? ["farms", "forecasts", "lots", "entries"] : ["members", "farms", "forecasts", "lots", "entries"];
  const labels: Record<string, string> = { members: "Members", farms: "Shared farms", forecasts: "Production estimates", lots: "Accepted produce", entries: "Stock and payment history" };
  return <section className="break-words"><p className="text-sm text-primary">Organization workspace · {view.role.toLowerCase()}</p><h1 className="mt-2 text-3xl font-bold">{view.name}</h1>
    <p className="mt-4 leading-7">Private farm finances remain private. Organization stock and payments belong to this organization.</p>
    <nav aria-label="Organization sections" className="mt-6 flex flex-wrap gap-4">{sections.map(section => <Link key={section} aria-current={view.section === section ? "page" : undefined} className="min-h-12 rounded-xl border px-4 py-3 underline" href={"/cooperatives/" + organizationId + "?section=" + section}>{labels[section]}</Link>)}</nav>
    <h2 className="mt-6 text-2xl font-semibold">{labels[view.section]}</h2>
    {view.role === "FARMER" && view.section === "farms" && !hasFarmerProfile && <p className="mt-4">You have accepted organization membership. <Link className="underline" href="/farmer">Set up your farmer profile</Link> before choosing a farm to share. No private farm access is granted by membership.</p>}
    {view.role === "MANAGER" && view.section === "members" && <CommandForm actorId={view.actorId} title="Invite an existing MyFarm user" endpoint={"/api/v1/cooperatives/" + organizationId + "/relationships"} fixed={{ type: "INVITE" }} fields={[{ name: "userId", label: "Their MyFarm account ID" }, { name: "role", label: "Organization role", options: ["MANAGER", "FARMER", "AGENT", "BUYER"].map(value => ({ value, label: value.toLowerCase() })) }]} notice="Ask the person to share their account ID directly. They must accept. A role does not give access to private farm finances." />}
    {ownFarms && <><CommandForm actorId={view.actorId} title="Share one of my farms" endpoint={"/api/v1/cooperatives/" + organizationId + "/relationships"} fixed={{ type: "SHARE" }} fields={[{ name: "farmId", label: "My farm", options: ownFarms.items.map(farm => ({ value: farm.farmId, label: farm.name })) }, { name: "shareLocation", label: "Share its optional coordinates", type: "checkbox" }, { name: "shareProduction", label: "Share production estimates and permit procurement records", type: "checkbox" }]} notice="Share the farm name and district with this organization. Choose any additional sharing below. No private finance, phone number or ownership is shared. You can withdraw consent." />{ownFarms.nextCursor && <p className="mt-3">Only your first page of farms is shown. <Link className="underline" href={"/cooperatives/" + organizationId + "?section=farms&farmCursor=" + ownFarms.nextCursor}>More of my farms</Link>.</p>}</>}
    <CooperativeRecords view={view} /><CooperativeReport view={view} />
    {view.role === "AGENT" && <p className="mt-6">Visits and follow-ups still require a named officer assignment. <Link href="/workspace" className="underline">Open your assigned agent workspace</Link>.</p>}
    <Link href="/cooperatives" className="mt-8 inline-block underline">All my organizations and invitations</Link>
  </section>;
}
