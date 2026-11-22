import { officerEnvelopeSchema, type OfficerEnvelope } from "../contracts/work";
import { deviceId, type LocalDatabase } from "@/modules/offline-first/client/local-database";
import { saveLocally } from "@/modules/offline-first/client/storage-status";
import { claim, recover, settle, outcomeFor, type SyncResult } from "@/modules/offline-first/client/sync-engine";
import { readyEntries } from "@/modules/offline-first/domain/sync-state";
import type { OutboxEntry } from "@/modules/offline-first/domain/records";
import { photoProblem } from "@/modules/offline-first/domain/commands";

export async function queueOfficer(db: LocalDatabase, input: Record<string, unknown>, photo?: Blob, dependsOn: string | null = null) {
  const time = new Date().toISOString();
  const parsed = officerEnvelopeSchema.safeParse({ ...input, schemaVersion: 1, deviceId: await deviceId(db), clientMutationId: typeof input.payload === "object" && input.payload !== null && "requestId" in input.payload ? input.payload.requestId : null, createdAt: time, updatedAt: time, version: 1, syncStatus: "PENDING" });
  if (!parsed.success) return { saved: false, message: "Check the details before saving." } as const;
  return persist(db, parsed.data, photo, dependsOn);
}
async function persist(db: LocalDatabase, envelope: OfficerEnvelope, photo: Blob | undefined, dependsOn: string | null) {
  if (envelope.operation === "OFFICER_ATTACH_PHOTO") {
    if (!photo || photoProblem(new Uint8Array(await photo.arrayBuffer()), photo.type)) return { saved: false, message: "Choose a PNG, JPEG or WebP photo of at most 2 MB." } as const;
  }
  const row: OutboxEntry = { clientMutationId: envelope.clientMutationId, deviceId: envelope.deviceId, farmId: "farmId" in envelope ? envelope.farmId : envelope.organizationId, operation: envelope.operation, payload: { envelope }, baseVersion: null, dependsOn, createdAt: envelope.createdAt, updatedAt: envelope.updatedAt, syncStatus: "PENDING", version: 1, attemptCount: 0, nextAttemptAt: null, leaseUntil: null, lastError: null, result: null };
  const saved = await saveLocally(db, () => db.transaction("rw", db.outbox, db.photos, async () => {
    await db.outbox.add(row);
    if (photo && envelope.operation === "OFFICER_ATTACH_PHOTO") await db.photos.add({ photoId: row.clientMutationId, clientMutationId: row.clientMutationId, blob: photo, contentType: photo.type, byteSize: photo.size, sha256: envelope.payload.sha256, createdAt: row.createdAt });
  }));
  return saved.saved ? { saved: true, message: "Saved on this phone. Waiting to send.", mutationId: row.clientMutationId } as const : { saved: false, message: "Could not save on this phone. Keep the details and try again." } as const;
}
async function run(db: LocalDatabase, keepGoing: () => boolean, force: boolean, exclusive: boolean): Promise<SyncResult> {
  await recover(db, new Date(), force, exclusive);
  for (;;) {
    if (!keepGoing()) return "DONE";
    const rows = await db.outbox.toArray();
    const ready = readyEntries(rows, new Date()).filter(row => row.operation.startsWith("OFFICER_"));
    if (!ready.length) return "DONE";
    const [row] = await claim(db, [ready[0]]);
    if (!row) continue;
    const parsed = officerEnvelopeSchema.safeParse(row.payload.envelope);
    if (!parsed.success) { await settle(db, [{ row, outcome: { status: "INVALID" } }]); continue; }
    const envelope = parsed.data;
    let response: Response;
    try {
      if (envelope.operation === "OFFICER_ATTACH_PHOTO") {
        const photo = await db.photos.get(row.clientMutationId);
        if (!photo) { await settle(db, [{ row, outcome: { status: "INVALID" } }]); continue; }
        const form = new FormData(); form.set("photo", photo.blob); form.set("visitId", envelope.payload.visitId); form.set("sha256", photo.sha256); form.set("requestId", row.clientMutationId);
        response = await fetch(`/api/v1/farms/${envelope.farmId}/officer-photos?scope=${envelope.organizationId}`, { method: "POST", body: form });
      } else response = await fetch("/api/v1/agent/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(envelope) });
      if (response.ok) { const result: Record<string, unknown> = await response.json(); await settle(db, [{ row, outcome: { status: "COMMITTED", result } }]); continue; }
    } catch { await settle(db, [{ row, outcome: { status: "RETRYABLE" } }]); return "OFFLINE"; }
    const failure = outcomeFor(response.status);
    await settle(db, [{ row, outcome: failure === "SIGNED_OUT" ? { status: "RETRYABLE" } : failure }]);
    if (failure === "SIGNED_OUT") return "SIGNED_OUT";
    if (failure.status === "RETRYABLE") return "OFFLINE";
  }
}
export async function syncOfficer(db: LocalDatabase, keepGoing: () => boolean = () => true, force = false): Promise<SyncResult> {
  if (!navigator.locks) return run(db, keepGoing, force, false);
  return navigator.locks.request("sync:" + db.name, { ifAvailable: true }, lock => lock ? run(db, keepGoing, force, true) : "BUSY");
}
