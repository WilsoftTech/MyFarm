import { loadPage } from "@/app/farmer/guard";
import { productionService, cropCycleService } from "@/modules/enterprises-seasons/infrastructure/services";
import { activityService } from "@/modules/farm-activities/infrastructure/services";
import { ProductionShell } from "@/components/production/shell";
import { WeatherForm } from "@/components/weather/weather-form";
import { ProductionPagination } from "@/components/production/pagination";
export const dynamic = "force-dynamic";
export const metadata = { title: "Weather tests" };
export default async function WeatherPage({ params, searchParams }: { params: Promise<{ farmId: string }>; searchParams: Promise<{ activity?: string; cursor?: string; cropCursor?: string }> }) {
  const { farmId } = await params; const { activity, cursor, cropCursor } = await searchParams;
  const farm = await loadPage(() => productionService().farmContext(farmId));
  const [activities, crops, selected] = await loadPage(() => Promise.all([activityService().list(farmId, { limit: 50, cursor }), cropCycleService().list(farmId, { limit: 50, cursor: cropCursor }), activity ? activityService().detail(farmId, activity) : null]));
  const choices = [...(selected && !activities.items.some(row => row.activityId === selected.activityId) ? [selected] : []), ...activities.items];
  const activityPath = `/farms/${farmId}/weather?` + new URLSearchParams({ ...(activity ? { activity } : {}), ...(cropCursor ? { cropCursor } : {}) });
  const cropPath = `/farms/${farmId}/weather?` + new URLSearchParams({ ...(activity ? { activity } : {}), ...(cursor ? { cursor } : {}) });
  return <ProductionShell farm={farm} active="weather" title="Weather tests"><WeatherForm key={`${activity}:${cursor}:${cropCursor}`} farmId={farmId} initialActivityId={selected?.activityId} activities={choices.map(row => ({ id: row.activityId, label: `${row.typeLabel} — ${row.dueOn} — ${[row.enterpriseName, row.plotName].filter(Boolean).join(", ") || "Whole farm"}` }))} crops={crops.items.map(row => ({ id: row.cycleId, label: `${row.cropName} — planted ${row.plantingDate}` }))} />
    {(cursor || activities.nextCursor) && <section aria-labelledby="weatherActivityPages"><h2 id="weatherActivityPages" className="mt-6 text-lg font-semibold">Activity choices</h2><ProductionPagination path={activityPath} cursor={cursor} nextCursor={activities.nextCursor} label="Activity choices pages" /></section>}
    {(cropCursor || crops.nextCursor) && <section aria-labelledby="weatherCropPages"><h2 id="weatherCropPages" className="mt-6 text-lg font-semibold">Crop choices</h2><ProductionPagination path={cropPath} cursor={cropCursor} nextCursor={crops.nextCursor} cursorKey="cropCursor" label="Crop choices pages" /></section>}
  </ProductionShell>;
}
