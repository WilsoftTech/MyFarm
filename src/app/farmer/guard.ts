import "server-only";
import { notFound, redirect } from "next/navigation";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";

/** Page loader: send anonymous users to sign-in and denied users to the access page, matching the workspace page. */
export async function loadPage<T>(load: () => Promise<T>): Promise<T> {
try { return await load(); }
catch (error) {
if (error instanceof FoundationError && error.code === "UNAUTHENTICATED") redirect("/sign-in?reason=session-required");
if (error instanceof FoundationError && error.code === "FORBIDDEN") redirect("/forbidden");
if (error instanceof FoundationError && error.code === "INVALID_INPUT") notFound();
throw new FoundationError("UNAVAILABLE");
}
}
