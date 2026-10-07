import Link from "next/link";
export function RoleWorkspace({ title }: { title: string }) {
return <section><p className="text-sm text-primary">Assigned access</p><h1 className="mt-3 text-3xl font-bold">{title}</h1><p className="mt-6 leading-7">Your access to this workspace is verified. Tools will be introduced in later releases.</p><Link href="/workspace" className="mt-8 inline-block rounded-xl border border-border px-5 py-3 font-semibold">Back to my workspaces</Link></section>;
}
