import { notFound } from "next/navigation";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { farmAccountingService } from "@/modules/farm-accounting/infrastructure/services";
import { RECORD_CATEGORY_KIND } from "@/modules/farm-accounting/domain/accounting";
import { loadPage } from "@/app/farmer/guard";
import { AccountingShell } from "@/components/accounting/shell";
import { TransactionForm } from "@/components/accounting/transaction-form";
import { recordKindFromSlug, recordKindHelp, recordKindTitles } from "@/components/accounting/labels";
import { recordTransactionAction } from "../../actions";
export const dynamic = "force-dynamic";
export const metadata = { title: "Add money record" };
export default async function NewAccountingRecordPage({ params }: { params: Promise<{ farmId: string; kind: string }> }) {
  const { farmId, kind: slug } = await params;
  const farm = await loadPage(() => productionService().farmContext(farmId));
  const kind = recordKindFromSlug(slug);
  if (!kind) notFound();
  // The approved catalogs are small (17 categories, 3 methods): one bounded page each.
  const [categories, methods] = await loadPage(() => Promise.all([
    farmAccountingService().categories(farmId, { kind: RECORD_CATEGORY_KIND[kind], limit: 50 }),
    kind === "EXPENSE" || kind === "INCOME" ? farmAccountingService().paymentMethods(farmId, { limit: 50 }) : Promise.resolve({ items: [], nextCursor: null }),
  ]));
  return <AccountingShell farm={farm} title={recordKindTitles[kind]}><p className="mb-5 max-w-2xl leading-7">{recordKindHelp[kind]}</p><div className="max-w-2xl rounded-2xl border border-border bg-white p-5 sm:p-6">
    <TransactionForm kind={kind} categories={categories.items.map(row => ({ id: row.categoryId, label: row.name }))} paymentMethods={methods.items.map(row => ({ id: row.paymentMethodId, label: row.name }))} submit={recordTransactionAction.bind(null, farm.farmId, kind)} />
  </div></AccountingShell>;
}
