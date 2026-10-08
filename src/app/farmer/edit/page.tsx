import Link from "next/link";
import { redirect } from "next/navigation";
import { farmerRegistryService } from "@/modules/farmer-registry/infrastructure/services";
import { FarmerProfileForm } from "@/components/farmer-registry/farmer-profile-form";
import { updateProfileAction } from "../actions";
import { loadPage } from "../guard";
export const dynamic = "force-dynamic";
export const metadata = { title: "Edit profile" };
export default async function EditFarmerPage() {
const farmer = await loadPage(() => farmerRegistryService().currentFarmer());
if (!farmer) redirect("/farmer");
// Only editable fields reach the client form; identifiers stay server-side.
const defaults = { name: farmer.name, phone: farmer.phone, alternativePhone: farmer.alternativePhone ?? "", district: farmer.district, subcounty: farmer.subcounty ?? "", village: farmer.village ?? "", preferredLanguage: farmer.preferredLanguage, ownershipType: farmer.ownershipType, mainActivities: farmer.mainActivities };
return <section className="mx-auto max-w-xl"><Link href="/farmer" className="text-sm underline">Back to profile</Link><h1 className="mt-3 text-3xl font-bold">Edit your profile</h1>
<div className="mt-8 rounded-2xl border border-border bg-white p-6"><FarmerProfileForm submit={updateProfileAction} defaults={defaults} expectedVersion={farmer.version} /></div></section>;
}
