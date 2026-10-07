import * as React from "react";
import { cn } from "@/lib/utils";
export function Input({ className, ...props }: React.ComponentProps<"input">) {
return <input className={cn("min-h-12 w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50", className)} {...props} />;
}
