import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import type { PhotoStoragePort } from "../contracts/photos";

/** Writes with the member's own session under the storage policy, so no privileged key enters the app. */
export function photoStorage(client: SupabaseClient, bucket: string): PhotoStoragePort {
  return { async put(tenantId, objectId, bytes, contentType) {
    const { error } = await client.storage.from(bucket).upload(tenantId + "/" + objectId, bytes, { contentType, upsert: false });
    // An object already here comes from an interrupted earlier attempt at this same request, which retries the same stored bytes.
    if (error && !/exists|duplicate/i.test(error.message)) throw new FoundationError("UNAVAILABLE");
  } };
}
