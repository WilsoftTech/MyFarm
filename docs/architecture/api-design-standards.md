# API design standards

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — status/applicability/structure/link review; no runtime or independent product validation.
- Implementation status: NOT STARTED — 0% (runtime implementation not verified).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase 00 session.
- Related phase/task IDs: Future Phases 01–24 as referenced; session review Phase 00; MYF-P01-T001 through MYF-P01-T013.
- Verified completed work: Architecture reference reviewed for current applicability; no runtime implementation completed.
- Remaining work/blockers: Affected future tasks/decisions and phase authorization; no database/app/deployment present.
- Evidence/report links: [Phase 00 closeout](../reports/phase-00-closeout-2026-10-08.md); [every-document review](../reports/phase-00-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

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
