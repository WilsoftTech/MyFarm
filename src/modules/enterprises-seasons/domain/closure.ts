import { FoundationError } from "@/modules/engineering-foundation/domain/errors";

export function assertProductionClosure(current: { status: "ACTIVE" | "CLOSED"; version: number }, expectedVersion: number, activeCycles = 0) {
  if (current.status !== "ACTIVE" || current.version !== expectedVersion || activeCycles > 0) throw new FoundationError("CONFLICT");
}
