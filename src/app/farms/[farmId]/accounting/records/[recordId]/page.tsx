import Link from "next/link";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { farmAccountingService } from "@/modules/farm-accounting/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { AccountingShell } from "@/components/accounting/shell";
import { ReversalForm } from "@/components/accounting/reversal-form";
import { counterpartyLabels, formatMoney, outstandingLabels, paymentActionLabels, recordKindLabels, recordStatusLabels, settledLabels, settlementLabels } from "@/components/accounting/labels";
import { Button } from "@/components/ui/button";
import { reverseAccountingAction } from "../../actions";
export const dynamic = "force-dynamic";
export const metadata = { title: "Money record" };
const notices = { saved: "Record saved.", paid: "Payment saved.", reversed: "Record reversed. It stays in your history and no longer counts." } as const;
export default async function AccountingRecordPage({ params, searchParams }: { params: Promise<{ farmId: string; recordId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { farmId, recordId } = await params, query = await searchParams;
  const farm = await loadPage(() => productionService().farmContext(farmId));
  const row = await loadPage(() => farmAccountingService().record(farmId, recordId));
  const methods = row.paymentMethodId ? await loadPage(() => farmAccountingService().paymentMethods(farmId, { limit: 50 })) : null;
  const method = methods?.items.find(item => item.paymentMethodId === row.paymentMethodId)?.name;
  const base = "/farms/" + farm.farmId + "/accounting";
  const obligation = row.kind === "SALE" || row.kind === "PURCHASE" ? row.kind : null;
  const postedPayments = row.payments.filter(payment => payment.status === "POSTED");
  const notice = (Object.keys(notices) as (keyof typeof notices)[]).find(key => query[key] === "1");
  return <AccountingShell farm={farm} title={recordKindLabels[row.kind] + ": " + formatMoney(row.amount, row.currency)}>
    {notice && <p role="status" className="mb-6 rounded-xl bg-muted p-4">{notices[notice]}</p>}
    <dl className="grid gap-5 rounded-2xl border border-border bg-white p-6 sm:grid-cols-2">
      <div><dt className="text-sm text-foreground/70">Amount</dt><dd className="mt-1 text-2xl font-semibold">{formatMoney(row.amount, row.currency)}</dd></div>
      <div><dt className="text-sm text-foreground/70">Status</dt><dd className="mt-1 font-semibold">{recordStatusLabels[row.status]}</dd></div>
      <div><dt className="text-sm text-foreground/70">Category</dt><dd className="mt-1 break-words font-semibold">{row.categoryName}</dd></div>
      <div><dt className="text-sm text-foreground/70">Date</dt><dd className="mt-1 font-semibold"><time dateTime={row.occurredOn}>{row.occurredOn}</time></dd></div>
      <div><dt className="text-sm text-foreground/70">{counterpartyLabels[row.kind]}</dt><dd className="mt-1 break-words font-semibold">{row.counterparty ?? "Not recorded"}</dd></div>
      {!obligation && <div><dt className="text-sm text-foreground/70">{row.kind === "INCOME" ? "How it was received" : "How it was paid"}</dt><dd className="mt-1 font-semibold">{method ?? "Not recorded"}</dd></div>}
    </dl>
    {obligation && row.balance && <section aria-labelledby="balanceHeading" className="mt-6 rounded-2xl border border-border bg-white p-6">
      <h2 id="balanceHeading" className="text-xl font-semibold">{obligation === "SALE" ? "Money for this sale" : "Payments for this purchase"}</h2>
      <p className="mt-2 leading-7">{settlementLabels[obligation][row.balance.settlement]}. Payments reduce what is still due; they are not counted as {obligation === "SALE" ? "another sale" : "another purchase"}.</p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <div><dt className="text-sm text-foreground/70">{obligation === "SALE" ? "Sale amount" : "Purchase amount"}</dt><dd className="mt-1 font-semibold">{formatMoney(row.balance.amount, row.currency)}</dd></div>
        <div><dt className="text-sm text-foreground/70">{settledLabels[obligation]}</dt><dd className="mt-1 font-semibold">{formatMoney(row.balance.settled, row.currency)}</dd></div>
        <div><dt className="text-sm text-foreground/70">{outstandingLabels[obligation]}</dt><dd className="mt-1 text-xl font-semibold">{formatMoney(row.balance.outstanding, row.currency)}</dd></div>
      </dl>
      {row.status === "POSTED" && row.balance.outstanding !== "0" && <Button asChild className="mt-5"><Link href={base + "/records/" + row.recordId + "/payments/new"}>{paymentActionLabels[obligation]}</Link></Button>}
      {row.payments.length > 0 && <><h3 className="mt-6 text-lg font-semibold">Payments</h3><ul aria-label="Payments for this record" className="mt-2 divide-y divide-border">{row.payments.map(payment => <li key={payment.paymentId} className="py-3"><Link className="underline" href={base + "/payments/" + payment.paymentId}>{formatMoney(payment.amount, row.currency)} on <time dateTime={payment.paidOn}>{payment.paidOn}</time></Link> · {recordStatusLabels[payment.status]}</li>)}</ul></>}
    </section>}
    {row.reversal ? <section aria-labelledby="reversalHeading" className="mt-6 rounded-2xl border border-border bg-white p-6"><h2 id="reversalHeading" className="text-xl font-semibold">Reversed</h2><p className="mt-2 break-words leading-7">Reason: {row.reversal.reason}</p><p className="text-sm">On <time dateTime={row.reversal.reversedAt}>{row.reversal.reversedAt.slice(0, 10)}</time></p></section>
      : postedPayments.length > 0 ? <p className="mt-6 rounded-2xl border border-border bg-white p-6 leading-7">To reverse this {recordKindLabels[row.kind].toLowerCase()}, first reverse each payment listed above.</p>
      : <ReversalForm label={"this " + recordKindLabels[row.kind].toLowerCase()} note="" submit={reverseAccountingAction.bind(null, farm.farmId, row.kind, row.recordId)} />}
  </AccountingShell>;
}
