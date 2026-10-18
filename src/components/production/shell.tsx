import Link from "next/link";
import type { ReactNode } from "react";

export function ProductionShell({ farm, active, title, children }: { farm: { farmId: string; name: string }; active: "enterprises" | "seasons"; title: string; children: ReactNode }) {
  return <section>
    <Link href={"/farms/" + farm.farmId} className="inline-block py-2 text-sm underline">Back to farm</Link>
    <p className="mt-3 break-words text-sm text-primary">Farm: {farm.name}</p>
    <h1 className="mt-2 break-words text-3xl font-bold">{title}</h1>
    <nav aria-label="Farm production" className="my-6 flex flex-wrap gap-x-6 gap-y-2 border-b border-border pb-3">
      {(["enterprises", "seasons"] as const).map(value => <Link key={value} href={"/farms/" + farm.farmId + "/" + value} aria-current={value === active ? "location" : undefined} className="inline-flex min-h-12 items-center py-2 underline underline-offset-4">{value === "enterprises" ? "Enterprises" : "Seasons"}</Link>)}
    </nav>
    {children}
  </section>;
}
