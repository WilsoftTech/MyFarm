import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
export const metadata: Metadata = { title: { default: "MyFarm", template: "%s Â· MyFarm" }, description: "Your farm, clearly recorded.", manifest: "/manifest.webmanifest" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#245c3a" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
return <html lang="en"><body><a href="#main" className="sr-only focus:not-sr-only focus:block focus:p-4">Skip to content</a>
<header className="border-b border-border"><nav aria-label="Main navigation" className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
<Link href="/" className="text-2xl font-bold tracking-tight">MyFarm<span className="text-ring">.</span></Link><Link href="/sign-in" className="rounded-lg px-4 py-3 text-sm font-semibold focus-visible:outline-2">Sign in</Link>
</nav></header><main id="main" className="mx-auto max-w-5xl px-5 py-10 sm:py-16">{children}</main>
<footer className="mx-auto max-w-5xl px-5 py-8 text-sm text-foreground/65">MyFarm Â· Built around the farm.</footer></body></html>;
}
