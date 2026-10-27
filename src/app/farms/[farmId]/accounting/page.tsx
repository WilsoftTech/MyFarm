import Link from "next/link";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { farmAccountingService } from "@/modules/farm-accounting/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { AccountingShell } from "@/components/accounting/shell";
import { ProductionPagination } from "@/components/production/pagination";
import { formatMoney, outstandingLabels, recordKindLabels, recordKindSlugs, recordStatusLabels, settlementLabels, type RecordKindSlug } from "@/components/accounting/labels";
import { Button } from "@/components/ui/button";
export const dynamic = "force-dynamic";
export const metadata = { title: "Money records" };
export default async function AccountingPage({ params, searchParams }: { params: Promise<{ farmId: string }>; searchParams: Promise<{ cursor?: string | string[] }> }) {
  const { farmId } = await params, { cursor } = await searchParams;
  const farm = await loadPage(() => productionService().farmContext(farmId));
  const page = await loadPage(() => farmAccountingService().records(farmId, cursor === undefined ? {} : { cursor }));
  const path = "/farms/" + farm.farmId + "/accounting";
  return <AccountingShell farm={farm} title="Money records"><p className="mb-5 leading-7">Money spent and earned on this farm. Newest records first. Amounts in different currencies are never added together.</p>
    <div className="flex flex-wrap gap-3">{(Object.keys(recordKindSlugs) as RecordKindSlug[]).map(slug => <Button key={slug} asChild variant={slug === "expense" ? "default" : "outline"}><Link href={path + "/new/" + slug}>{"Add " + recordKindLabels[recordKindSlugs[slug]].toLowerCase()}</Link></Button>)}</div>
    {page.items.length === 0 ? <div className="mt-6 rounded-2xl border border-border bg-white p-6"><h2 className="text-xl font-semibold">{cursor ? "No more money records" : "No money records yet"}</h2><p className="mt-3 leading-7">{cursor ? "You have reached the end of this list." : "Add an expense, a sale, a purchase or other income to start your farm accounts."}</p></div>
      : <ul aria-label="Money records on this farm" className="mt-6 grid gap-4 sm:grid-cols-2">{page.items.map(row => <li key={row.recordId} className="min-w-0"><Link href={path + "/records/" + row.recordId} className="block rounded-2xl border border-border bg-white p-6 hover:border-primary focus-visible:outline-2 focus-visible:outline-ring">
        <p className="text-sm text-foreground/75">{recordKindLabels[row.kind]} · <time dateTime={row.occurredOn}>{row.occurredOn}</time></p>
        <h2 className="mt-1 break-words text-xl font-semibold">{formatMoney(row.amount, row.currency)}</h2>
        <p className="mt-2 break-words leading-7">{row.category.name}{row.category.archived ? " (no longer offered)" : ""}{row.counterparty ? " — " + row.counterparty : ""}</p>
        {row.enterpriseName && <p className="break-words text-sm leading-6">Enterprise: {row.enterpriseName}{row.seasonLabel ? " · " + row.seasonLabel : ""}</p>}
        {row.balance && (row.kind === "SALE" || row.kind === "PURCHASE") && row.status === "POSTED" && <p className="leading-7">{row.balance.settlement === "SETTLED" ? settlementLabels[row.kind].SETTLED : outstandingLabels[row.kind] + ": " + formatMoney(row.balance.outstanding, row.currency)}</p>}
        <p className="text-sm">{recordStatusLabels[row.status]}</p></Link></li>)}</ul>}
    <ProductionPagination path={path} cursor={typeof cursor === "string" ? cursor : undefined} nextCursor={page.nextCursor} />
  </AccountingShell>;
}
