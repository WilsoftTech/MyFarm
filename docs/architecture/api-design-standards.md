# API design standards

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase02 closeout; content and status updated from verified evidence; no completion inferred from review alone.
- Implementation status: Phase01 scope COMPLETED — 100% (13/13 verified Phase01 tasks; PASS WITH CONDITIONS — LOCAL VERIFICATION); Phase02 scope COMPLETED — 100% (13/13 verified Phase02 tasks; PASS WITH CONDITIONS — LOCAL VERIFICATION); later-phase scope not counted.
- Last reviewed: 2026-10-18 (Africa/Nairobi), Phase03 T002 API verification.
- Related phase/task IDs: Phase01 MYF-P01-T001–T013; Phase02 MYF-P02-T001–T013.
- Verified completed work: Phase01 scope as previously verified; Phase02: farmer registry contracts/policies/migration/API/tests in this document's area verified (see the Phase 2 implementation section).
- Remaining work/blockers: Phase02 conditions where still applicable; Phase03 T002 APIs verified locally, T003–T013 and hosted provisioning remain pending. [T002 evidence](../reports/phase-03-t002-2026-10-18.md).
- Evidence/report links: [Phase02 closeout](../reports/phase-02-closeout-2026-10-09.md); [Phase02 every-document review](../reports/phase-02-document-review-2026-10-09.md); [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](../reports/phase-01-provider-verification-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

## Phase 3 T002 API subset — 2026-10-18

- `GET/POST /api/v1/farms/{farmId}/enterprises` and `/seasons`
- `GET /api/v1/farms/{farmId}/enterprises/{enterpriseId}` and `/seasons/{seasonId}`

Creates return 201 with `{ enterprise }` or `{ season }`; detail reads use the same wrapper. Lists return `{ items, nextCursor }`, default limit 20 and maximum 50. Farm/tenant authorization precedes command/query schema validation. Origin/content-type/JSON framing is checked at the HTTP boundary before the service. Actor, tenant and farm are never accepted in command bodies. Success responses are `private, no-store`; safe error envelopes use `no-store`. Unknown and foreign detail IDs return 403; unknown and foreign cursors return 400. Duplicate/unknown query keys are rejected by the strict page schema.

Identical normalized create retries replay the record; reused IDs with changed creation fields or a different farm return 409. Existing registry replay semantics are unchanged. No update, close, crop-detail, batch-detail or sync route was added. [Verification and deployment prerequisites](../reports/phase-03-t002-2026-10-18.md).

**Proposed contracts until phase approval.** Online UI/server actions and sync must call the same application commands. Do not maintain a weaker offline endpoint or authorize only in page loaders.

## Boundaries

/api/v1/farms and scoped farms/{farmId}/plots/enterprises/seasons/records/activities for authorized reads/commands; /api/v1/sync/push and /pull for stable replay/change cursor; /api/v1/media/prepare and /finalize for private uploads. Later assistant tools, partner callbacks/payment webhooks and organization orders live behind separate bounded adapters.

Command envelope example:

```json
{
  "schemaVersion": 1,
  "clientMutationId": "stable-uuid-for-this-intent",
  "deviceId": "registered-device-uuid",
  "operation": "expense.record",
  "entityId": "locally-generated-uuid",
  "baseVersion": null,
  "payload": {
    "farmId": "owned-farm-uuid",
    "enterpriseId": "owned-maize-uuid",
    "amount": "150000",
    "currency": "UGX",
    "occurredOn": "2027-03-01",
    "categoryId": "fertilizer-category-uuid"
  }
}
```

Actor/tenant resolved server-side; payload farm/related IDs checked within authorized scope. UUID labels above are explanatory; real requests require valid UUID format. Dates vs instants explicit; decimal/bigint serialize as strings. Validation errors refer to fields without leaking foreign resource metadata.

Response: requestId, outcome, entityId/version, committedAt and receipt ID for commits; conflict includes only permitted current version; permanent denial/validation leaves local evidence recoverable. 401 unauthenticated; 403 or consistently concealed 404 forbidden; 409 stale/key-payload collision; 422 domain validation; 429 rate limit; 5xx retryable only when safe receipt replay. Logging never includes credentials/raw sensitive payload.

Bounded page size/push count/upload size chosen with Q16/Q34. Cursor paging stable tie-break by id, scoped filters, no unbounded exports. Cookies require CSRF/origin controls; webhook uses provider signature and replay key, not browser session. Validate files by signature/type/size and private owner relationship. GET has no write side effects.

Version schema changes add compatibility window for offline clients; reject unsupported command with visible update/recovery path, never discard outbox. [Sync](offline-sync-architecture.md), [auth](authentication-authorization.md) and [testing](testing-strategy.md) define acceptance.


## Phase1 implemented evidence and limits

Phase1 health/session/scope/private-read endpoints and strict safe errors are implemented. Private-read POST requires same-origin JSON/UUID request, current membership and audit before grant. Changed retry payload returns409. No registration or financial/stock mutation endpoints.

[Closeout](../reports/phase-01-closeout-2026-10-08.md); [setup](../engineering/foundation-local-setup.md).

## Phase 2 implementation (2026-10-09)

Endpoints, all `private, no-store`, auth before validation:

- `GET/POST/PATCH /api/v1/farmer`
- `GET/POST /api/v1/farms` (cursor pagination, limit ≤ 50)
- `GET /api/v1/farms/{farmId}`
- `POST /api/v1/farms/{farmId}/plots`

Contract:

- **Commands:** same-origin JSON with a client `requestId` (UUID). An identical retry replays the original result; a new request for an existing registration returns 409; a stale profile `expectedVersion` returns 409.
- **Errors:** the Phase 1 envelope `{ error, requestId }` (401/403/400/409/429/503). Unknown and foreign IDs are both 403.
- **Planned extension:** replay-with-different-payload semantics are PROPOSED (D-P02-004) and are to be aligned with the Phase 7 sync contract ([closeout](../reports/phase-02-closeout-2026-10-09.md)).
