import Link from "next/link";
import { redirect } from "next/navigation";
import { farmerRegistryService } from "@/modules/farmer-registry/infrastructure/services";
import { FarmForm } from "@/components/farmer-registry/farm-form";
import { createFarmAction } from "../../farmer/actions";
import { loadPage } from "../../farmer/guard";
export const dynamic = "force-dynamic";
export const metadata = { title: "Add a farm" };
export default async function NewFarmPage() {
const farmer = await loadPage(() => farmerRegistryService().currentFarmer());
if (!farmer) redirect("/farmer");
return <section className="mx-auto max-w-xl"><Link href="/farms" className="text-sm underline">Back to my farms</Link><p className="mt-4 text-sm font-semibold text-primary">Step 2 of 3</p><h1 className="mt-2 text-3xl font-bold">Add a farm</h1>
<div className="mt-8 rounded-2xl border border-border bg-white p-6"><FarmForm submit={createFarmAction} defaults={{ district: farmer.district, subcounty: farmer.subcounty ?? "", village: farmer.village ?? "", ownershipType: farmer.ownershipType }} /></div></section>;
}
