import "server-only";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { database } from "@/modules/engineering-foundation/infrastructure/database";
import { CooperativeService } from "../application/cooperative";
import type { CooperativeRepository } from "../contracts/cooperative";
import { cooperativeRepository } from "./repository";
export function cooperativeService() {
  const repo = () => cooperativeRepository(database());
  const lazy: CooperativeRepository = {
    list: actor => repo().list(actor), create: (actor, cmd) => repo().create(actor, cmd),
    relationship: (actor, org, cmd) => repo().relationship(actor, org, cmd),
    operation: (actor, org, cmd) => repo().operation(actor, org, cmd),
    read: (actor, org, section, cursor) => repo().read(actor, org, section, cursor),
  };
  return new CooperativeService(authorizationService(), lazy);
}
