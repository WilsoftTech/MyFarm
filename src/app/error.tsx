"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
const router = useRouter();
const [retrying, startTransition] = useTransition();
useEffect(() => { console.error(JSON.stringify({ event: "client_error", code: "UNAVAILABLE" })); }, []);
return <section><h1 className="text-3xl font-bold">We could not load this page</h1><p className="my-6 leading-7">Please check your connection and try again.</p>{retrying && <p role="status" className="mb-4">Trying again…</p>}<Button disabled={retrying} onClick={() => startTransition(() => { router.refresh(); reset(); })}>{retrying ? "Trying again…" : "Try again"}</Button></section>;
}
