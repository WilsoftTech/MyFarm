import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import type { FarmScope } from "@/modules/enterprises-seasons/domain/production";
import type { ProductionWriteScope } from "@/modules/enterprises-seasons/contracts/production";
import { PHOTO_TARGETS, type PhotoTarget } from "../domain/commands";

/** requestId doubles as the stored object's ID, so a retried upload lands on the same object. */
export const uploadPhotoSchema = z.object({ requestId: idSchema, target: z.enum(PHOTO_TARGETS), recordId: idSchema, contentType: z.string().max(40), sha256: z.string().regex(/^[0-9a-f]{64}$/) }).strict();
export type UploadPhoto = z.output<typeof uploadPhotoSchema>;
export const photoListSchema = z.object({ target: z.enum(PHOTO_TARGETS), recordId: idSchema }).strict();
export interface PhotoView extends FarmScope { photoId: string; target: PhotoTarget; recordId: string; contentType: string; byteSize: number; createdBy: string; createdAt: string }
/** Every query constrains tenant and farm. Photos are append-only: no update or delete exists. */
export interface PhotoRepository {
  recordExists(scope: FarmScope, target: PhotoTarget, recordId: string): Promise<boolean>;
  photo(scope: FarmScope, photoId: string): Promise<(PhotoView & { sha256: string }) | null>;
  photos(scope: FarmScope, target: PhotoTarget, recordId: string): Promise<PhotoView[]>;
  record(scope: ProductionWriteScope, command: UploadPhoto, byteSize: number): Promise<PhotoView>;
}
export interface PhotoStoragePort { put(tenantId: string, objectId: string, bytes: Uint8Array, contentType: string): Promise<void> }
