import type { FarmScope } from "@/modules/enterprises-seasons/domain/production";
import type { ProductionPage, ProductionPageInput, ProductionWriteScope } from "@/modules/enterprises-seasons/contracts/production";
export interface ReconstructedBalance { locationId: string; locationName: string; quantity: string }
export interface ReconstructionView {
  itemId: string; name: string; unit: string; asOf: string; matches: boolean;
  balances: ReconstructedBalance[]; nextCursor: string | null;
}
export interface MovementView { unit: string; itemName: string; movementId: string; locationId: string; locationName: string; quantityDelta: string; reason: string; occurredOn: string; createdAt: string }
/** Scoped repeatable-read reconciliation; page output, never truncate authoritative calculations. */
export interface ReconstructionRepository {
  reconstruct(scope: ProductionWriteScope, itemId: string, page: ProductionPageInput): Promise<ReconstructionView>;
  history(scope: FarmScope, itemId: string, page: ProductionPageInput): Promise<ProductionPage<MovementView>>;
}
