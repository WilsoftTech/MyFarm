import Link from "next/link";
import { farmerRegistryService } from "@/modules/farmer-registry/infrastructure/services";
import { PlotForm } from "@/components/farmer-registry/plot-form";
import { activityLabels, areaUnitLabels, ownershipLabels } from "@/components/farmer-registry/labels";
import { createPlotAction } from "../../farmer/actions";
import { loadPage } from "../../farmer/guard";
export const dynamic = "force-dynamic";
export const metadata = { title: "Farm" };
export default async function FarmPage({ params, searchParams }: { params: Promise<{ farmId: string }>; searchParams: Promise<{ plot?: string }> }) {
const { farmId } = await params;
const farm = await loadPage(() => farmerRegistryService().farm(farmId));
const added = (await searchParams).plot === "added";
const location = [farm.village, farm.subcounty, farm.district].filter(Boolean).join(", ");
return <section><Link href="/farms" className="text-sm underline">Back to my farms</Link><h1 className="mt-3 text-3xl font-bold">{farm.name}</h1>
<dl className="mt-6 grid gap-4 rounded-2xl border border-border bg-white p-6 sm:grid-cols-2">
<div><dt className="text-sm text-foreground/70">Location</dt><dd className="font-semibold">{location}</dd></div>
<div><dt className="text-sm text-foreground/70">Main activity</dt><dd className="font-semibold">{activityLabels[farm.primaryActivity]}</dd></div>
<div><dt className="text-sm text-foreground/70">Land</dt><dd className="font-semibold">{ownershipLabels[farm.ownershipType]}</dd></div>
<div><dt className="text-sm text-foreground/70">Approximate size</dt><dd className="font-semibold">{farm.approximateAcreage ? farm.approximateAcreage + " acres" : "Not recorded"}</dd></div>
<div><dt className="text-sm text-foreground/70">GPS location</dt><dd className="font-semibold">{farm.latitude && farm.longitude ? farm.latitude + ", " + farm.longitude : "Not recorded"}</dd></div>
</dl>
<h2 className="mt-10 text-2xl font-semibold">Plots</h2>
{added && <p role="status" className="mt-4 rounded-xl bg-muted p-4">Plot added.</p>}
{farm.plots.length === 0 ? <p className="mt-4 leading-7">No plots yet. Add the parts of this farm you manage separately.</p> :
<ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-white">{farm.plots.map(plot => <li key={plot.plotId} className="flex justify-between gap-4 p-4"><span className="font-semibold">{plot.name}</span><span className="text-sm text-foreground/75">{plot.area && plot.areaUnit ? plot.area + " " + areaUnitLabels[plot.areaUnit].toLowerCase() : "Size not recorded"}</span></li>)}</ul>}
{farm.plotsTruncated && <p className="mt-3 text-sm">Showing the first {farm.plots.length} plots.</p>}
<div className="mt-8 rounded-2xl border border-border bg-white p-6"><h3 className="mb-4 text-lg font-semibold">Add a plot</h3>
{/* Remount after each saved plot so the next one gets a fresh request ID. */}
<PlotForm key={farm.plots.length} submit={createPlotAction.bind(null, farm.farmId)} /></div>
</section>;
}
