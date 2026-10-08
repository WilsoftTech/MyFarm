import Link from "next/link";
import { farmerRegistryService } from "@/modules/farmer-registry/infrastructure/services";
import { FarmerProfileForm } from "@/components/farmer-registry/farmer-profile-form";
import { activityLabels, languageLabels, ownershipLabels } from "@/components/farmer-registry/labels";
import { Button } from "@/components/ui/button";
import { registerFarmerAction } from "./actions";
import { loadPage } from "./guard";
export const dynamic = "force-dynamic";
export const metadata = { title: "Farmer profile" };
export default async function FarmerPage({ searchParams }: { searchParams: Promise<{ updated?: string }> }) {
const farmer = await loadPage(() => farmerRegistryService().currentFarmer());
if (!farmer) return <section className="mx-auto max-w-xl"><p className="text-sm font-semibold text-primary">Step 1 of 3</p><h1 className="mt-2 text-3xl font-bold">Register as a farmer</h1>
<p className="mt-4 leading-7 text-foreground/75">We only ask for what is needed to keep your farm records. You can change these details later.</p>
<div className="mt-8 rounded-2xl border border-border bg-white p-6"><FarmerProfileForm submit={registerFarmerAction} /></div></section>;
const updated = (await searchParams).updated === "1";
const location = [farmer.village, farmer.subcounty, farmer.district].filter(Boolean).join(", ");
return <section className="mx-auto max-w-xl"><p className="text-sm text-primary">Your farmer profile</p><h1 className="mt-2 text-3xl font-bold">{farmer.name}</h1>
{updated && <p role="status" className="mt-4 rounded-xl bg-muted p-4">Your profile was saved.</p>}
<dl className="mt-8 grid gap-4 rounded-2xl border border-border bg-white p-6">
<div><dt className="text-sm text-foreground/70">Phone</dt><dd className="font-semibold">{farmer.phone}{farmer.alternativePhone && " · " + farmer.alternativePhone}</dd></div>
<div><dt className="text-sm text-foreground/70">Location</dt><dd className="font-semibold">{location}</dd></div>
<div><dt className="text-sm text-foreground/70">Preferred language</dt><dd className="font-semibold">{languageLabels[farmer.preferredLanguage]}</dd></div>
<div><dt className="text-sm text-foreground/70">Land</dt><dd className="font-semibold">{ownershipLabels[farmer.ownershipType]}</dd></div>
<div><dt className="text-sm text-foreground/70">Main activities</dt><dd className="font-semibold">{farmer.mainActivities.map(a => activityLabels[a]).join(", ")}</dd></div>
</dl>
<div className="mt-6 flex flex-wrap gap-3"><Button asChild><Link href="/farms">View my farms</Link></Button><Button asChild variant="outline"><Link href="/farmer/edit">Edit profile</Link></Button></div>
</section>;
}
