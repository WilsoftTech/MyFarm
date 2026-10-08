import * as React from "react";
import { cn } from "@/lib/utils";
// Native select: accessible and light on low-cost devices; styled to match Input.
export function Select({ className, ...props }: React.ComponentProps<"select">) {
return <select className={cn("min-h-12 w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50", className)} {...props} />;
}
