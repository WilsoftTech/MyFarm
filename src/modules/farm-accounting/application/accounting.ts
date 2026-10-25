import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { authorizeProductionFarm, parseProductionInput as parse, type ProductionFarmAccess } from "@/modules/enterprises-seasons/application/farm-access";
import { accountingPageSchema, categoryQuerySchema, recordExpenseSchema, recordIncomeSchema, recordPaymentSchema, recordPurchaseSchema, recordSaleSchema, reverseAccountingRecordSchema, type FarmAccountingRepository, type RecordCommand } from "../contracts/accounting";
import type { AccountingRecordKind } from "../domain/accounting";

const recordSchemas = { EXPENSE: recordExpenseSchema, INCOME: recordIncomeSchema, SALE: recordSaleSchema, PURCHASE: recordPurchaseSchema } as const;

/** Every call authorizes the current farm membership first; tenant, farm and actor never come from input. */
export class FarmAccountingService {
  constructor(private readonly authorization: RegistryAuthorization, private readonly farms: ProductionFarmAccess, private readonly repository: FarmAccountingRepository) {}
  private async scope(farmId: unknown) {
    return (await authorizeProductionFarm(this.authorization, this.farms, farmId)).scope;
  }
  async categories(farmId: unknown, input: unknown = {}) {
    const scope = await this.scope(farmId);
    return this.repository.categories(scope, parse(categoryQuerySchema, input));
  }
  async paymentMethods(farmId: unknown, input: unknown = {}) {
    const scope = await this.scope(farmId);
    return this.repository.paymentMethods(scope, parse(accountingPageSchema, input));
  }
  async records(farmId: unknown, input: unknown = {}) {
    const scope = await this.scope(farmId);
    return this.repository.records(scope, parse(accountingPageSchema, input));
  }
  async record(farmId: unknown, recordId: unknown) {
    const scope = await this.scope(farmId);
    const row = await this.repository.record(scope, parse(idSchema, recordId));
    if (!row) throw new FoundationError("FORBIDDEN");
    return row;
  }
  async recordTransaction<K extends AccountingRecordKind>(kind: K, farmId: unknown, input: unknown) {
    const scope = await this.scope(farmId);
    if (!Object.hasOwn(recordSchemas, kind)) throw new FoundationError("INVALID_INPUT");
    return this.repository.recordTransaction(scope, kind, parse(recordSchemas[kind], input) as RecordCommand<K>);
  }
  async payment(farmId: unknown, paymentId: unknown) {
    const scope = await this.scope(farmId);
    const row = await this.repository.payment(scope, parse(idSchema, paymentId));
    if (!row) throw new FoundationError("FORBIDDEN");
    return row;
  }
  async recordPayment(farmId: unknown, input: unknown) {
    const scope = await this.scope(farmId);
    return this.repository.recordPayment(scope, parse(recordPaymentSchema, input));
  }
  async reverse(farmId: unknown, input: unknown) {
    const scope = await this.scope(farmId);
    return this.repository.reverse(scope, parse(reverseAccountingRecordSchema, input));
  }
}
