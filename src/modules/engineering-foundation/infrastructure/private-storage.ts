import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PrivateStoragePort } from "../contracts/storage";
import { FoundationError } from "../domain/errors";
export function privateStorage(client: SupabaseClient, bucket: string): PrivateStoragePort {
return { async signedRead(scope, objectId) {
// Opaque UUID path is derived from authorized membership; no user-supplied path/bucket.
const path = scope.organizationId + "/" + objectId;
const { data, error } = await client.storage.from(bucket).createSignedUrl(path, 60);
if (error || !data?.signedUrl) throw new FoundationError("UNAVAILABLE");
return data.signedUrl;
} };
}
