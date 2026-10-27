import type { ReportLabels } from "@/modules/farm-accounting/contracts/accounting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export const basisLabels = { ACCRUAL: "When sold or bought (accrual)", CASH: "When money moved (cash)" } as const;

/** Plain GET form: works without JavaScript and keeps the filters in the address for sharing or reload. */
export function ReportFilters({ action, labels, error }: { action: string; labels: Pick<ReportLabels, "basis" | "from" | "to">; error?: string }) {
  return <form method="get" action={action} aria-label="Report filters" className="mb-6 grid gap-4 rounded-2xl border border-border bg-white p-5 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
    <div><label htmlFor="reportFrom" className="field-label">From</label><Input id="reportFrom" name="from" type="date" min="0001-01-01" max="9999-12-31" defaultValue={labels.from ?? ""} /></div>
    <div><label htmlFor="reportTo" className="field-label">To</label><Input id="reportTo" name="to" type="date" min="0001-01-01" max="9999-12-31" defaultValue={labels.to ?? ""} /></div>
    <div><label htmlFor="reportBasis" className="field-label">Count money</label><Select id="reportBasis" name="basis" defaultValue={labels.basis}>{(Object.keys(basisLabels) as (keyof typeof basisLabels)[]).map(basis => <option key={basis} value={basis}>{basisLabels[basis]}</option>)}</Select></div>
    <Button type="submit" className="w-full sm:w-auto">Show</Button>
    {error && <p role="alert" className="field-error sm:col-span-4">{error}</p>}
  </form>;
}

/** Every report states its basis, dates and when it was calculated (D-P04-002, D-P04-010). */
export function ReportLabelsNote({ labels }: { labels: ReportLabels }) {
  const dates = labels.from || labels.to ? (labels.from ? "from " + labels.from : "from the first record") + " to " + (labels.to ?? "the latest record") : "all records";
  return <p className="mb-6 leading-7 text-foreground/80">Counted {labels.basis === "CASH" ? "when money moved (cash)" : "when sold or bought (accrual)"}, {dates}. Calculated <time dateTime={labels.asOf}>{labels.asOf.slice(0, 16).replace("T", " ")} UTC</time>. Different currencies are shown separately and never added together.</p>;
}

export function reportHref(path: string, labels: Pick<ReportLabels, "basis" | "from" | "to">): string {
  const query = new URLSearchParams({ basis: labels.basis, ...(labels.from ? { from: labels.from } : {}), ...(labels.to ? { to: labels.to } : {}) });
  return path + "?" + query.toString();
}
