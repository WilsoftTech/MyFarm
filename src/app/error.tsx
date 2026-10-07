"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
useEffect(() => { console.error(JSON.stringify({ event: "client_error", code: "UNAVAILABLE" })); }, []);
return <section><h1 className="text-3xl font-bold">We could not load this page</h1><p className="my-6 leading-7">Please check your connection and try again.</p><Button onClick={reset}>Try again</Button></section>;
}
