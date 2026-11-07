import type { ReconcileCheck, Reconciliation } from "@/modules/analytics-profitability/domain/reconcile";
import { formatMoney } from "@/components/accounting/labels";

const checkText: Record<ReconcileCheck, string> = {
  SURPLUS: "Recorded surplus is not money earned minus money spent",
  REVENUE_ADDS_UP: "Money earned does not match the enterprises plus money not linked to one",
  COSTS_ADD_UP: "Money spent does not match the enterprises plus costs not linked to one",
  COST_GROUPS_ADD_UP: "Labour, inputs and other costs do not add up to money spent",
  CROP_MONEY_MATCHES: "A crop's money does not match its enterprise",
};

/** R004: shown only when the service's checks fail, so a wrong figure is never relied on silently. Nothing is recalculated here. */
export function ReconcileNotice({ reconciliation }: { reconciliation: Reconciliation }) {
  if (reconciliation.reconciled) return null;
  return <section aria-labelledby="reconcileTitle" className="mb-6 rounded-xl border-2 border-foreground bg-white p-4 leading-7">
    <h2 id="reconcileTitle" className="text-lg font-semibold">These figures do not add up</h2>
    <p className="mt-1">Do not rely on the figures on this page for now. Your records are not changed. Please tell the MyFarm team what you see here.</p>
    <ul className="mt-2 list-disc pl-5">{reconciliation.failures.map((failure, index) => <li key={index}>
      {checkText[failure.check]}: {formatMoney(failure.expected, failure.currency)} expected, {formatMoney(failure.found, failure.currency)} found.
    </li>)}</ul>
  </section>;
}
