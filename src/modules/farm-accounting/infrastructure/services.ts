import "server-only";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { database } from "@/modules/engineering-foundation/infrastructure/database";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { FarmAccountingService } from "../application/accounting";
import type { FarmAccountingRepository, FarmReportRepository } from "../contracts/accounting";
import { farmAccountingRepository } from "./repository";
import { FarmReportService } from "../application/reporting";
import { farmReportRepository } from "./report-repository";

export function farmAccountingService() {
  // Anonymous requests must fail before constructing a database client.
  const repository = () => farmAccountingRepository(database());
  const lazy: FarmAccountingRepository = {
    categories: (scope, query) => repository().categories(scope, query),
    paymentMethods: (scope, page) => repository().paymentMethods(scope, page),
    record: (scope, id) => repository().record(scope, id),
    records: (scope, page) => repository().records(scope, page),
    payment: (scope, id) => repository().payment(scope, id),
    recordTransaction: (scope, kind, command) => repository().recordTransaction(scope, kind, command),
    recordPayment: (scope, command) => repository().recordPayment(scope, command),
    reverse: (scope, command) => repository().reverse(scope, command),
  };
  return new FarmAccountingService(authorizationService(), {
    farmScopeForMember: input => registryRepository(database()).farmScopeForMember(input),
  }, lazy);
}

export function farmReportService() {
  const reports = () => farmReportRepository(database());
  const lazy: FarmReportRepository = {
    reportSources: (scope, query) => reports().reportSources(scope, query),
    recordExport: (scope, requestId) => reports().recordExport(scope, requestId),
  };
  return new FarmReportService(authorizationService(), {
    farmScopeForMember: input => registryRepository(database()).farmScopeForMember(input),
  }, lazy);
}
