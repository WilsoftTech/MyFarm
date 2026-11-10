import Link from "next/link";
import { farmExportService } from "@/modules/farm-export/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ViewPhotoButton } from "@/components/offline/view-photo-button";
import { Button } from "@/components/ui/button";
export const dynamic = "force-dynamic";
export const metadata = { title: "Download farm data" };
const PHOTO_OF = { ACTIVITY: "Farm work", ACCOUNTING_RECORD: "Money record" } as const;
type Search = Promise<{ after?: string | string[] }>;
/** D-P09-013: everything on the farm in one file the farmer can open in a spreadsheet; photos open one at a time. */
export default async function FarmExportPage({ params, searchParams }: { params: Promise<{ farmId: string }>; searchParams: Search }) {
  const { farmId } = await params, { after } = await searchParams;
  const page = await loadPage(() => farmExportService().photos(farmId, typeof after === "string" ? { after } : {}));
  const base = "/farms/" + farmId;
  return <section className="max-w-3xl">
    <Link href={base} className="text-sm underline">Back to {page.farmName}</Link>
    <h1 className="mt-3 text-3xl font-bold">Download farm data</h1>
    <p className="mt-4 leading-7">Get a copy of everything recorded on this farm: plots, enterprises, seasons, crops, poultry, money records and payments, harvests, stock and farm work, with your own profile. It comes as one ZIP file holding a spreadsheet file (CSV) for each kind of record, and a note explaining them.</p>
    <p className="mt-3 leading-7">You can download it 3 times a day. Keep the file safe: it holds your phone number and your farm&apos;s money records.</p>
    <div className="mt-5"><Button asChild><a href={"/api/v1/farms/" + farmId + "/export"} download>Download farm data (ZIP)</a></Button></div>
    <section aria-labelledby="photosHeading" className="mt-10 rounded-2xl border border-border bg-white p-6">
      <h2 id="photosHeading" className="text-xl font-semibold">Photos</h2>
      <p className="mt-3 leading-7">Photos are not in the ZIP file. Open each one here to save it; the file photos.csv lists them all.</p>
      {page.items.length === 0 ? <p className="mt-4">{after ? "No more photos." : "No photos on this farm yet."}</p>
        : <ul className="mt-4 space-y-3">{page.items.map(photo => <li key={photo.photoId} className="flex flex-wrap items-center gap-3"><span>{(photo.target ? PHOTO_OF[photo.target] : "Photo") + ", added " + photo.createdAt.slice(0, 10)}</span><ViewPhotoButton farmId={farmId} photoId={photo.photoId} label="Open photo" /></li>)}</ul>}
      {page.nextAfter && <p className="mt-5"><Link className="inline-flex min-h-12 items-center underline" href={base + "/export?after=" + page.nextAfter}>More photos</Link></p>}
    </section>
  </section>;
}
