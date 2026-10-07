// Extension contracts only. No accounting, stock, registry or sync implementation in Phase 1.
export interface CommandContext { clientMutationId: string; farmId: string; expectedVersion: number }
export interface MoneyInput { amount: string; currency: string }
export interface QuantityInput { quantity: string; unit: string }
export interface FutureFarmCommands {
recordFarmExpense(context: CommandContext, expense: MoneyInput): Promise<unknown>;
calculateEnterpriseProfit(enterpriseId: string): Promise<unknown>;
recordHarvest(context: CommandContext, harvest: QuantityInput): Promise<unknown>;
closeSeason(context: CommandContext, seasonId: string): Promise<unknown>;
transferInventory(context: CommandContext, destinationId: string, quantity: QuantityInput): Promise<unknown>;
}
