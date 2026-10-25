import Link from "next/link";
import { notFound } from "next/navigation";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { farmAccountingService } from "@/modules/farm-accounting/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { AccountingShell } from "@/components/accounting/shell";
import { PaymentForm } from "@/components/accounting/payment-form";
import { formatMoney, paymentActionLabels, recordKindLabels } from "@/components/accounting/labels";
import { settleRecordAction } from "../../../../actions";
export const dynamic = "force-dynamic";
export const metadata = { title: "Record a payment" };
export default async function NewPaymentPage({ params }: { params: Promise<{ farmId: string; recordId: string }> }) {
  const { farmId, recordId } = await params;
  const farm = await loadPage(() => productionService().farmContext(farmId));
  const row = await loadPage(() => farmAccountingService().record(farmId, recordId));
  if ((row.kind !== "SALE" && row.kind !== "PURCHASE") || !row.balance) notFound();
  const kind = row.kind, back = "/farms/" + farm.farmId + "/accounting/records/" + row.recordId;
  const open = row.status === "POSTED" && row.balance.outstanding !== "0";
  const methods = open ? await loadPage(() => farmAccountingService().paymentMethods(farmId, { limit: 50 })) : { items: [] };
  return <AccountingShell farm={farm} title={paymentActionLabels[kind]}>
    <p className="mb-5 max-w-2xl break-words leading-7">For the {recordKindLabels[kind].toLowerCase()} of {formatMoney(row.amount, row.currency)} on <time dateTime={row.occurredOn}>{row.occurredOn}</time> ({row.categoryName}{row.counterparty ? ", " + row.counterparty : ""}). <Link className="underline" href={back}>Back to the record</Link></p>
    <div className="max-w-2xl rounded-2xl border border-border bg-white p-5 sm:p-6">{open
      ? <PaymentForm kind={kind} outstanding={row.balance.outstanding} currency={row.currency} paymentMethods={methods.items.map(item => ({ id: item.paymentMethodId, label: item.name }))} submit={settleRecordAction.bind(null, farm.farmId, row.recordId)} />
      : <p className="leading-7">{row.status === "REVERSED" ? "This record was reversed, so no payment can be recorded against it." : "Nothing is still due on this record."}</p>}</div>
  </AccountingShell>;
}
