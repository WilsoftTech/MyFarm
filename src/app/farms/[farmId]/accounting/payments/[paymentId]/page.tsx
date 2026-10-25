import Link from "next/link";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { farmAccountingService } from "@/modules/farm-accounting/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { AccountingShell } from "@/components/accounting/shell";
import { ReversalForm } from "@/components/accounting/reversal-form";
import { formatMoney, recordStatusLabels } from "@/components/accounting/labels";
import { reverseAccountingAction } from "../../actions";
export const dynamic = "force-dynamic";
export const metadata = { title: "Payment" };
export default async function PaymentPage({ params, searchParams }: { params: Promise<{ farmId: string; paymentId: string }>; searchParams: Promise<{ reversed?: string }> }) {
  const { farmId, paymentId } = await params;
  const farm = await loadPage(() => productionService().farmContext(farmId));
  const row = await loadPage(() => farmAccountingService().payment(farmId, paymentId));
  const methods = await loadPage(() => farmAccountingService().paymentMethods(farmId, { limit: 50 }));
  const method = methods.items.find(item => item.paymentMethodId === row.paymentMethodId)?.name ?? "Not available";
  const received = row.direction === "RECEIVED", base = "/farms/" + farm.farmId + "/accounting";
  return <AccountingShell farm={farm} title={(received ? "Money received: " : "Money paid: ") + formatMoney(row.amount, row.currency)}>
    {(await searchParams).reversed === "1" && <p role="status" className="mb-6 rounded-xl bg-muted p-4">Payment reversed. The amount is due again on the record it settled.</p>}
    <dl className="grid gap-5 rounded-2xl border border-border bg-white p-6 sm:grid-cols-2">
      <div><dt className="text-sm text-foreground/70">Amount</dt><dd className="mt-1 text-2xl font-semibold">{formatMoney(row.amount, row.currency)}</dd></div>
      <div><dt className="text-sm text-foreground/70">Status</dt><dd className="mt-1 font-semibold">{recordStatusLabels[row.status]}</dd></div>
      <div><dt className="text-sm text-foreground/70">{received ? "Date received" : "Date paid"}</dt><dd className="mt-1 font-semibold"><time dateTime={row.paidOn}>{row.paidOn}</time></dd></div>
      <div><dt className="text-sm text-foreground/70">{received ? "How it was received" : "How it was paid"}</dt><dd className="mt-1 font-semibold">{method}</dd></div>
      <div><dt className="text-sm text-foreground/70">Reference</dt><dd className="mt-1 break-words font-semibold">{row.externalReference ?? "Not recorded"}</dd></div>
    </dl>
    <section aria-labelledby="settlesHeading" className="mt-6 rounded-2xl border border-border bg-white p-6"><h2 id="settlesHeading" className="text-xl font-semibold">What this payment settles</h2>
      <ul className="mt-2 divide-y divide-border">{row.allocations.map(allocation => <li key={allocation.obligationId} className="py-3"><Link className="underline" href={base + "/records/" + allocation.obligationId}>{formatMoney(allocation.amount, row.currency)} towards a {received ? "sale" : "purchase"}</Link></li>)}</ul>
    </section>
    {row.reversal ? <section aria-labelledby="reversalHeading" className="mt-6 rounded-2xl border border-border bg-white p-6"><h2 id="reversalHeading" className="text-xl font-semibold">Reversed</h2><p className="mt-2 break-words leading-7">Reason: {row.reversal.reason}</p><p className="text-sm">On <time dateTime={row.reversal.reversedAt}>{row.reversal.reversedAt.slice(0, 10)}</time></p></section>
      : <ReversalForm label="this payment" note="The amount becomes due again on the record it settled." submit={reverseAccountingAction.bind(null, farm.farmId, "PAYMENT", row.paymentId)} />}
  </AccountingShell>;
}
