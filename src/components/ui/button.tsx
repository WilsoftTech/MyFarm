import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const buttonVariants = cva("inline-flex min-h-12 items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50", {
variants: { variant: { default: "bg-primary text-primary-foreground hover:bg-primary/90", outline: "border border-border bg-background hover:bg-muted" } },
defaultVariants: { variant: "default" },
});
function Button({ className, variant, asChild = false, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
const Comp = asChild ? Slot : "button"; return <Comp className={cn(buttonVariants({ variant, className }))} {...props} />;
}
export { Button, buttonVariants };
