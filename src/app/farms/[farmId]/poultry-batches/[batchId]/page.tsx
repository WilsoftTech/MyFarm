import Link from "next/link";
import { productionService, poultryBatchService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { birdCount, currentQuantitySourceLabels, poultryPurposeLabels, productionStatusLabels } from "@/components/production/labels";
import { farmIntelligenceService } from "@/modules/farm-intelligence/infrastructure/services";
import { stockService } from "@/modules/harvest-inventory/infrastructure/services";
import { FeedItemForm, type SupplyChoice } from "@/components/intelligence/feed-item-form";
import { saveFeedItem } from "./actions";

/** Supply items of the farm, newest first, from up to four pages of stock items. */
async function supplies(farmId: string): Promise<{ items: SupplyChoice[]; more: boolean }> {
  const items: SupplyChoice[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 4; page++) {
    const result = await stockService().items(farmId, { limit: 50, ...(cursor ? { cursor } : {}) });
    items.push(...result.items.filter(row => row.kind === "SUPPLY").map(row => ({ itemId: row.itemId, name: row.name, unit: row.unit })));
    if (!result.nextCursor) return { items, more: false };
    cursor = result.nextCursor;
  }
  return { items, more: true };
}
export const dynamic = "force-dynamic";
export const metadata = { title: "Poultry batch" };
export default async function PoultryBatchPage({ params, searchParams }: { params: Promise<{ farmId: string; batchId: string }>; searchParams: Promise<{ saved?: string; feed?: string }> }) {
  const { farmId, batchId } = await params;
  const farm = await loadPage(() => productionService().farmContext(farmId));
  const row = await loadPage(() => poultryBatchService().batch(farmId, batchId));
  const enterprise = await loadPage(() => productionService().enterprise(farmId, row.enterpriseId));
  const feed = await loadPage(() => farmIntelligenceService().feedItem(farmId, batchId));
  const choices = row.status === "ACTIVE" ? await loadPage(() => supplies(farmId)) : { items: [], more: false };
  const search = await searchParams;
  return <ProductionShell farm={farm} active="poultry-batches" title={row.batchLabel}>
    {search.saved === "1" && <p role="status" className="mb-6 rounded-xl bg-muted p-4">Poultry batch saved.</p>}
    {search.feed === "saved" && <p role="status" className="mb-6 rounded-xl bg-muted p-4">Feed item saved.</p>}
    <Link className="inline-block min-h-12 py-3 underline" href={"/farms/" + farmId + "/poultry-production/" + batchId}>Production and flock history</Link>
    <dl className="grid gap-5 rounded-2xl border border-border bg-white p-6 sm:grid-cols-2">
      <div className="sm:col-span-2"><dt className="text-sm text-foreground/70">Current number of birds</dt><dd className="mt-1 text-2xl font-semibold">{birdCount(row.currentQuantity)}</dd><dd className="mt-1 text-sm leading-6 text-foreground/75">{currentQuantitySourceLabels[row.currentQuantitySource]}</dd></div>
      <div><dt className="text-sm text-foreground/70">Starting number of birds</dt><dd className="mt-1 font-semibold">{birdCount(row.startingQuantity)}</dd></div>
      <div><dt className="text-sm text-foreground/70">Acquisition date</dt><dd className="mt-1 font-semibold"><time dateTime={row.acquisitionDate}>{row.acquisitionDate}</time></dd></div>
      <div><dt className="text-sm text-foreground/70">Enterprise</dt><dd className="mt-1 break-words font-semibold"><Link className="underline" href={"/farms/" + farm.farmId + "/enterprises/" + enterprise.enterpriseId}>{enterprise.name}</Link></dd></div>
      <div><dt className="text-sm text-foreground/70">Animal type</dt><dd className="mt-1 break-words font-semibold">{row.animalTypeName}</dd></div>
      <div><dt className="text-sm text-foreground/70">Breed</dt><dd className="mt-1 break-words font-semibold">{row.breed ?? "Not recorded"}</dd></div>
      <div><dt className="text-sm text-foreground/70">Production purpose</dt><dd className="mt-1 font-semibold">{poultryPurposeLabels[row.purpose]}</dd></div>
      <div><dt className="text-sm text-foreground/70">Status</dt><dd className="mt-1 font-semibold">{productionStatusLabels[row.status]}</dd></div>
    </dl>
    <section aria-labelledby="feedHeading" className="mt-8 rounded-2xl border border-border bg-white p-6">
      <h2 id="feedHeading" className="text-xl font-semibold">Feed for alerts</h2>
      <p className="mt-2 leading-7">{feed ? "Fed from: " + feed.itemName + " (" + feed.unit + ")." : "No feed item chosen. Alerts cannot say when this batch's feed is running low."}</p>
      {row.status !== "ACTIVE" ? <p className="mt-2 text-sm">This batch is closed, so its feed item cannot change.</p>
        : choices.items.length === 0 ? <p className="mt-2 leading-7">No supply items yet. <Link className="underline" href={"/farms/" + farm.farmId + "/inventory/items/new"}>Add the feed you buy as a stock item</Link>, then come back.</p>
        : <>
          <FeedItemForm key={(feed?.itemId ?? "none") + ":" + (feed?.version ?? 0)} supplies={choices.items} current={feed?.itemId ?? null} version={feed?.version ?? null} submit={saveFeedItem.bind(null, farm.farmId, batchId, feed?.version ?? null)} />
          {choices.more && <p className="mt-2 text-sm">Showing supply items from the newest 200 stock items.</p>}
        </>}
    </section>
  </ProductionShell>;
}
