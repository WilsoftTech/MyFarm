import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/sign-in/actions";

/** Signed-in navigation for registry pages; each page still authorizes its own data server-side. */
export function RegistryNav() {
return <nav aria-label="Farm records" className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border pb-4 text-sm">
<Link href="/farms" className="py-2 underline-offset-4 hover:underline">My farms</Link>
<Link href="/farmer" className="py-2 underline-offset-4 hover:underline">My profile</Link>
<Link href="/workspace" className="py-2 underline-offset-4 hover:underline">Workspace</Link>
<form action={signOutAction} className="ml-auto"><Button variant="outline">Sign out</Button></form>
</nav>;
}
