import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import type { ProductionWriteScope } from "./production";

export const closureKindSchema = z.enum(["SEASON", "CROP_CYCLE"]);
export const closeProductionSchema = z.object({ requestId: idSchema, expectedVersion: z.number().int().positive().max(2147483646), confirmed: z.literal(true) }).strict();
export type CloseProduction = z.output<typeof closeProductionSchema>;
export type ClosureKind = "SEASON" | "CROP_CYCLE";
export interface ClosureResult { recordId: string; status: "CLOSED"; version: number }
export interface ClosureRepository {
  close(scope: ProductionWriteScope, kind: ClosureKind, recordId: string, input: CloseProduction): Promise<ClosureResult>;
}
