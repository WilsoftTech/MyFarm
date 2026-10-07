import Link from "next/link";
export default function ForbiddenPage() { return <section><h1 className="text-3xl font-bold">Access unavailable</h1><p className="mt-5 leading-7">Your account does not have active access to this workspace. Contact the project owner if you need access.</p><Link href="/sign-in" className="mt-6 inline-block underline">Return to sign-in</Link></section>; }
