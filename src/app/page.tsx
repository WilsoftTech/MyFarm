import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function Home() {
return <div className="grid gap-12 md:grid-cols-[1.2fr_1fr] md:items-center">
<section><p className="mb-5 text-xs font-bold uppercase tracking-[.2em] text-primary">MYFARM · UGANDA</p>
<h1 className="max-w-xl text-4xl leading-tight font-bold tracking-tight sm:text-6xl">A clearer picture<br />of your farm.</h1>
<p className="mt-6 max-w-lg text-lg leading-8 text-foreground/75">Keep your farm records together, one step at a time.</p>
<div className="mt-8"><Button asChild><Link href="/sign-in">Sign in to MyFarm <span aria-hidden="true" className="ml-3">→</span></Link></Button></div>
<p className="mt-5 text-sm text-foreground/65">Early access · Existing accounts only</p></section>
<aside className="rounded-3xl border border-border bg-white p-7 sm:p-10"><div className="mb-8 h-2 w-12 rounded-full bg-ring" />
<h2 className="text-2xl font-semibold">A foundation for better records</h2>
<p className="mt-4 leading-7 text-foreground/75">MyFarm is being introduced in stages. Farm registration and record entry are coming in later releases.</p>
<p className="mt-7 border-t border-border pt-6 text-sm leading-6">This early release provides secure account access. Farm records are not available yet.</p>
</aside></div>;
}
