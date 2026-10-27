import Link from "next/link";
import type { ReactNode } from "react";
import { recordKindLabels, recordKindSlugs, type RecordKindSlug } from "./labels";

export function AccountingShell({ farm, title, children }: { farm: { farmId: string; name: string }; title: string; children: ReactNode }) {
  const base = "/farms/" + farm.farmId + "/accounting";
  return <section>
    <Link href={"/farms/" + farm.farmId} className="inline-block py-2 text-sm underline">Back to farm</Link>
    <p className="mt-3 break-words text-sm text-primary">Farm: {farm.name}</p>
    <h1 className="mt-2 break-words text-3xl font-bold">{title}</h1>
    <nav aria-label="Farm money" className="my-6 flex flex-wrap gap-x-6 gap-y-2 border-b border-border pb-3">
      <Link href={base} className="inline-flex min-h-12 items-center py-2 underline underline-offset-4">Money records</Link>
      <Link href={base + "/summary"} className="inline-flex min-h-12 items-center py-2 underline underline-offset-4">Summary</Link>
      <Link href={base + "/gross-margin"} className="inline-flex min-h-12 items-center py-2 underline underline-offset-4">Gross margin</Link>
      {(Object.keys(recordKindSlugs) as RecordKindSlug[]).map(slug => <Link key={slug} href={base + "/new/" + slug} className="inline-flex min-h-12 items-center py-2 underline underline-offset-4">{"Add " + recordKindLabels[recordKindSlugs[slug]].toLowerCase()}</Link>)}
    </nav>
    {children}
  </section>;
}
