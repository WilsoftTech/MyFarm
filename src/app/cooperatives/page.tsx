import Link from "next/link";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { cooperativeService } from "@/modules/cooperatives/infrastructure/services";
import { CommandForm } from "@/components/cooperatives/command-form";
import { cooperativePage } from "./guard";
export const dynamic = "force-dynamic";
export default async function Page() {
  const account = await cooperativePage(() => authorizationService().account());
  const rows = await cooperativePage(() => cooperativeService().list());
  return <section className="break-words"><h1 className="text-3xl font-bold">Cooperatives and agribusinesses</h1><p className="mt-4 leading-7">Organization records stay separate from your private farm records. Joining does not share any farm automatically.</p>
    {rows.length === 0 && <p className="mt-5">No organization memberships or invitations yet.</p>}
    <ul className="mt-5 space-y-4">{rows.map(row => <li key={row.id} className="rounded-xl border p-4"><h2 className="text-xl font-semibold">{row.name}</h2><p>{row.member.role.toLowerCase()} · {row.member.status.toLowerCase()}</p>
      {row.member.status === "INVITED" ? <CommandForm actorId={account.id} title="Accept membership" endpoint={"/api/v1/cooperatives/" + row.id + "/relationships"} fixed={{ type: "ACCEPT", memberId: row.member.id, expectedVersion: row.member.version }} notice={"Accept the " + row.member.role.toLowerCase() + " role in " + row.name + ". This does not share private farm records."} />
        : <Link className="mt-3 inline-block underline" href={"/cooperatives/" + row.id + "?section=" + (row.member.role === "BUYER" ? "lots" : row.member.role === "AGENT" || row.member.role === "FARMER" ? "farms" : "members")}>Open organization</Link>}
    </li>)}</ul>
    <CommandForm actorId={account.id} title="Create an organization" endpoint="/api/v1/cooperatives" fields={[{ name: "name", label: "Organization name" }]} notice="You become the first manager. Invite existing MyFarm users; each must accept their role." />
    <Link className="mt-6 inline-block underline" href="/workspace">My workspaces</Link>
  </section>;
}
