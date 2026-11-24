import { redirect } from "next/navigation";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
export async function cooperativePage<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); }
  catch (error) {
    if (error instanceof FoundationError && error.code === "UNAUTHENTICATED") redirect("/sign-in?reason=session-required");
    if (error instanceof FoundationError && (error.code === "FORBIDDEN" || error.code === "INVALID_INPUT")) redirect("/forbidden");
    throw new FoundationError("UNAVAILABLE");
  }
}
