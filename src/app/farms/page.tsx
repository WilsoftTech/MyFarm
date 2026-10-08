import Link from "next/link";
import { redirect } from "next/navigation";
import { farmerRegistryService } from "@/modules/farmer-registry/infrastructure/services";
import { activityLabels } from "@/components/farmer-registry/labels";
import { Button } from "@/components/ui/button";
import { loadPage } from "../farmer/guard";
export const dynamic = "force-dynamic";
export const metadata = { title: "My farms" };
export default async function FarmsPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
const { cursor } = await searchParams;
const service = farmerRegistryService();
const farmer = await loadPage(() => service.currentFarmer());
if (!farmer) redirect("/farmer");
const page = await loadPage(() => service.listFarms(cursor ? { cursor } : {}));
return <section><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-primary">{farmer.name}</p><h1 className="mt-2 text-3xl font-bold">My farms</h1></div>
<Button asChild><Link href="/farms/new">Add a farm</Link></Button></div>
{page.items.length === 0 ? <div className="mt-8 rounded-2xl border border-border bg-white p-6"><h2 className="font-semibold">{cursor ? "No more farms" : "No farms yet"}</h2><p className="mt-3 leading-7">{cursor ? "You have seen all your farms." : "Add your first farm, then divide it into plots."}</p></div> :
<ul className="mt-8 grid gap-4 sm:grid-cols-2">{page.items.map(farm => <li key={farm.farmId}><Link href={"/farms/" + farm.farmId} className="block rounded-2xl border border-border bg-white p-6 hover:border-primary focus-visible:outline-2 focus-visible:outline-ring">
<h2 className="text-xl font-semibold">{farm.name}</h2><p className="mt-2 text-sm">{farm.district} · {activityLabels[farm.primaryActivity]}</p>
<p className="mt-3 text-sm text-foreground/75">{farm.plotCount === 1 ? "1 plot" : farm.plotCount + " plots"}{farm.approximateAcreage && " · about " + farm.approximateAcreage + " acres"}</p></Link></li>)}</ul>}
<div className="mt-6 flex gap-4">{cursor && <Link href="/farms" className="underline">First page</Link>}{page.nextCursor && <Link href={"/farms?cursor=" + page.nextCursor} className="underline">More farms</Link>}</div>
<Link href="/farmer" className="mt-8 inline-block underline">My farmer profile</Link>
</section>;
}
