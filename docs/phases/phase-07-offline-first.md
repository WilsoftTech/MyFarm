# Phase 07 Offline First Architecture

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase01 status, applicability and evidence/link review; affected content reconciled; no independent farmer validation or hosted verification.
- Implementation status: NOT STARTED — 0% (0/13 verified tasks).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase01 implementation session.
- Related phase/task IDs: Phase 07; MYF-P07-T001 through MYF-P07-T013; review session Phase01.
- Verified completed work: No tasks implemented or verified in this phase; status/provider applicability reviewed only.
- Remaining work/blockers: All 13 tasks and their acceptance/exit gates pending; Phase01 completion and future phase authorization required.
- Evidence/report links: [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Status: **NOT STARTED**. Date: 2026-10-08. This is a specification, not implementation approval. Related: [architecture](../architecture/system-architecture.md), [security](../architecture/security-architecture.md), [testing](../architecture/testing-strategy.md), [decisions](../DECISION-LOG.md), [traceability](../REQUIREMENTS-TRACEABILITY.md).

## A. Phase Overview

Purpose/business problem: Make disconnected farmer recording useful and reconnect safe.

Target users: Farmers on supported mobile/shared devices. Expected outcomes: K's observable criteria. Classification: MVP discovery/foundation.

## B. Source Requirements

Source: P0438–P0490 in [complete extract](../reports/source-extract.md). Examples are illustrative. Exclusions: later phase features and any application implementation during this assignment. Phase 1–6 prepare commands/IDs; full sync in 7. Offline writes cannot grant authority or guarantee current stock availability.

Ambiguities: Q16 offline duration/browser/device/storage/receipt and tombstone retention/shared unlock/recovery. Resolve affected policy before dependent tasks; do not invent rules.

| Requirement | Source | Capability |
|---|---|---|
| MYF-P07-R001 | P0441–P0455 | Use PWA, IndexedDB/Dexie, service worker and custom sync; local browser storage is not guaranteed durable. |
| MYF-P07-R002 | P0456–P0465 | Offline expense/income/harvest/activity/task entry, photo capture and cached farms/records. |
| MYF-P07-R003 | P0466–P0479 | Use clientMutationId/deviceId/timestamps/status/version and LOCAL_ONLY/PENDING/SYNCING/SYNCED/CONFLICT/FAILED states. |
| MYF-P07-R004 | P0480–P0490 | Reconnect/retry produces one expense, with idempotency and no corruption. |

## C. Dependencies

Prerequisite phases: Phase 6 exit gate plus cumulative earlier gates.

Database inputs: earlier owned registry/production/transaction entities actually needed plus F proposals. Phase 0 is evidence documents only. Services: EnqueueCommand, PushMutations, PullChanges, ResolveConflict, UploadPendingPhoto, RecoverLocalQueue. Infrastructure: authenticated Next.js, isolated PostgreSQL/Supabase, private object storage; Dexie/PWA sync from Phase 7.

Integrations: approved auth/persistence/provider adapters; use fakes before reviewed provider contracts. [Cross-phase matrix](../MASTER-IMPLEMENTATION-ROADMAP.md) records forward extension points. Stable IDs, tenant context and version fields precede sync/institutional features. No new infrastructure without measured need.

## D. Functional Requirements

### MYF-P07-R001

User story: as an authorized user named in A, I need this capability: Use PWA, IndexedDB/Dexie, service worker and custom sync; local browser storage is not guaranteed durable. Business rules, validation and interaction: Cached shell reopens disconnected; denied persistence/quota error visible without false save success.

### MYF-P07-R002

User story: as an authorized user named in A, I need this capability: Offline expense/income/harvest/activity/task entry, photo capture and cached farms/records. Business rules, validation and interaction: All eight source actions persist locally with pending status; photo retry retains metadata.

### MYF-P07-R003

User story: as an authorized user named in A, I need this capability: Use clientMutationId/deviceId/timestamps/status/version and LOCAL_ONLY/PENDING/SYNCING/SYNCED/CONFLICT/FAILED states. Business rules, validation and interaction: Stale version conflicts; transient failures retry; permanent validation retained for repair.

### MYF-P07-R004

User story: as an authorized user named in A, I need this capability: Reconnect/retry produces one expense, with idempotency and no corruption. Business rules, validation and interaction: Same key/payload returns stored receipt; different payload rejects; lost acknowledgement produces one effect.

Permissions: active farm membership or explicit organization/assignment/share grant; read/write/export separate; corrections and settlement require approved reviewer role. Admin has no automatic farm-data access.

## E. Technical Architecture

Proposed module: src/modules/offline-first/ with contracts/, domain/, application/, infrastructure/. src/app/api/v1/ route handlers authenticate/validate then call services. Clients collect input/display; server owns authorization, authoritative computation and commits.

Services: EnqueueCommand, PushMutations, PullChanges, ResolveConflict, UploadPendingPhoto, RecoverLocalQueue. Flow: intent → schema → current authorization → domain rules → transaction/repository → audit/receipt → scoped DTO. Projections rebuild from source histories. External network calls stay outside DB transactions.

Offline: see [sync](../architecture/offline-sync-architecture.md); Phases 1–6 prepare commands/IDs, full behavior Phase 7. Offline records remain pending until server acknowledgement. Provider/partner verification cannot be claimed offline. Operator cache shows as-of or explicitly requires network.

## F. Database Design

**Proposal until implementation approval. No migrations created now.**

Client EntityCache(entityType,id,tenantId,farmId,version,payload); Outbox(clientMutationId UUID,deviceId UUID,tenantId UUID,operation text,payload json,baseVersion integer,createdAt/updatedAt timestamp,syncStatus enum,attemptCount integer); BlobQueue(id UUID,mutationId UUID,blob bytes,state enum). Server MutationReceipt(tenantId UUID,actorId UUID,clientMutationId UUID,requestHash text,result json,committedAt timestamp,unique tenant/actor/mutation); ChangeLog(tenantId UUID,sequence bigint,entityType text,entityId UUID,version integer,tombstone boolean); DeviceRegistration(id UUID,userId UUID,status enum).

Shared tenant-owned fields: id UUID, tenantId UUID, relevant farmId UUID, createdAt/updatedAt timestamptz, version integer >=1, createdBy UUID. Global catalogs, append histories and research evidence declare distinct ownership. Quantity uses numeric(18,6) plus unit; money numeric(20,4) plus currency pending precision approval. JSON evidence/contracts versioned and validated.

Relationships/constraints: enforce parent/child tenant/farm consistency through composite keys/FKs where applicable plus server policy; unique membership/occurrence/command/provider keys; restrict history deletion. Corrections append reasoned records; balance projections are never authority.

Indexes: tenantId/farmId/date/id for scoped lists, tenantId/parentId for joins, unique receipt/event keys, status/due for actual calendar/queue queries. Global catalog/research uses lookup key rather than fictitious farm scope.

Migration: approve cardinalities/questions; additive fields/backfills with row-count/orphan checks; rehearse isolated migration/restore; preserve API/IndexedDB compatibility. Later activity/provider/billing relations arrive only in their phase.

## G. UI/UX Requirements

Pages/dashboards/forms/navigation: Offline banner, per-record status, sync center, retry/conflict resolution, storage warning/photo queue. Show current farm/organization scope. Mobile: one-column input, large touch targets, readable money/units, optional-field disclosure. Consequential review shows amount/unit/date/scope.

Loading announced; recoverable errors retain input and safe retry. Empty states distinguish no data, denial and provider failure and offer permitted next action. Verify keyboard, labels, focus and screen-reader statuses. Offline shows cached vs pending vs confirmed records; never silently change scope.

## H. Implementation Tasks

Execute these small stages sequentially after authorization. Field/model/provider policies remain proposals until affected decisions are resolved. Each capability separates contract/domain work, authorized service/evidence work, and user-visible acceptance. All task IDs remain pending.

### MYF-P07-T001 — Specify and implement domain contract for MYF-P07-R001

- Description: For MYF-P07-R001, define validated DTO/value objects and deterministic rules for: Use PWA, IndexedDB/Dexie, service worker and custom sync; local browser storage is not guaranteed durable. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: phase prerequisites and affected open Q/ADR decisions.
- Files/modules: src/modules/offline-first/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Cached shell reopens disconnected; denied persistence/quota error visible without false save success. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P07-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Offline cold start after bootstrap, quota and eviction recovery. Check unit/currency/date/scope types and constraints.

### MYF-P07-T002 — Implement authorized application service for MYF-P07-R001

- Description: Implement the scoped service/repository/adapter for MYF-P07-R001; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P07-T001.
- Files/modules: src/modules/offline-first/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/offline-first/integration/.
- Expected behavior: Cached shell reopens disconnected; denied persistence/quota error visible without false save success. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P07-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Offline cold start after bootstrap, quota and eviction recovery.

### MYF-P07-T003 — Connect UI and verify acceptance for MYF-P07-R001

- Description: Connect the existing service contract to the phase G form/view for MYF-P07-R001; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P07-T002.
- Files/modules: src/app/ phase pages; src/modules/offline-first/ UI components; tests/offline-first/component/ and E2E/.
- Expected behavior: Cached shell reopens disconnected; denied persistence/quota error visible without false save success.
- Acceptance criteria: MYF-P07-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Offline cold start after bootstrap, quota and eviction recovery.

### MYF-P07-T004 — Specify and implement domain contract for MYF-P07-R002

- Description: For MYF-P07-R002, define validated DTO/value objects and deterministic rules for: Offline expense/income/harvest/activity/task entry, photo capture and cached farms/records. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P07-T003.
- Files/modules: src/modules/offline-first/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: All eight source actions persist locally with pending status; photo retry retains metadata. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P07-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Eight-action E2E, tab reload, storage failure and media recovery. Check unit/currency/date/scope types and constraints.

### MYF-P07-T005 — Implement authorized application service for MYF-P07-R002

- Description: Implement the scoped service/repository/adapter for MYF-P07-R002; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P07-T004.
- Files/modules: src/modules/offline-first/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/offline-first/integration/.
- Expected behavior: All eight source actions persist locally with pending status; photo retry retains metadata. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P07-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Eight-action E2E, tab reload, storage failure and media recovery.

### MYF-P07-T006 — Connect UI and verify acceptance for MYF-P07-R002

- Description: Connect the existing service contract to the phase G form/view for MYF-P07-R002; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P07-T005.
- Files/modules: src/app/ phase pages; src/modules/offline-first/ UI components; tests/offline-first/component/ and E2E/.
- Expected behavior: All eight source actions persist locally with pending status; photo retry retains metadata.
- Acceptance criteria: MYF-P07-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Eight-action E2E, tab reload, storage failure and media recovery.

### MYF-P07-T007 — Specify and implement domain contract for MYF-P07-R003

- Description: For MYF-P07-R003, define validated DTO/value objects and deterministic rules for: Use clientMutationId/deviceId/timestamps/status/version and LOCAL_ONLY/PENDING/SYNCING/SYNCED/CONFLICT/FAILED states. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P07-T006.
- Files/modules: src/modules/offline-first/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Stale version conflicts; transient failures retry; permanent validation retained for repair. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P07-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Crash during SYNCING, missing dependencies, stale edits and invalid payload. Check unit/currency/date/scope types and constraints.

### MYF-P07-T008 — Implement authorized application service for MYF-P07-R003

- Description: Implement the scoped service/repository/adapter for MYF-P07-R003; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P07-T007.
- Files/modules: src/modules/offline-first/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/offline-first/integration/.
- Expected behavior: Stale version conflicts; transient failures retry; permanent validation retained for repair. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P07-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Crash during SYNCING, missing dependencies, stale edits and invalid payload.

### MYF-P07-T009 — Connect UI and verify acceptance for MYF-P07-R003

- Description: Connect the existing service contract to the phase G form/view for MYF-P07-R003; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P07-T008.
- Files/modules: src/app/ phase pages; src/modules/offline-first/ UI components; tests/offline-first/component/ and E2E/.
- Expected behavior: Stale version conflicts; transient failures retry; permanent validation retained for repair.
- Acceptance criteria: MYF-P07-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Crash during SYNCING, missing dependencies, stale edits and invalid payload.

### MYF-P07-T010 — Specify and implement domain contract for MYF-P07-R004

- Description: For MYF-P07-R004, define validated DTO/value objects and deterministic rules for: Reconnect/retry produces one expense, with idempotency and no corruption. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P07-T009.
- Files/modules: src/modules/offline-first/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Same key/payload returns stored receipt; different payload rejects; lost acknowledgement produces one effect. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P07-AC004 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Concurrent replay, multi-device conflict, revoked user, pull pagination and expired cursor. Check unit/currency/date/scope types and constraints.

### MYF-P07-T011 — Implement authorized application service for MYF-P07-R004

- Description: Implement the scoped service/repository/adapter for MYF-P07-R004; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P07-T010.
- Files/modules: src/modules/offline-first/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/offline-first/integration/.
- Expected behavior: Same key/payload returns stored receipt; different payload rejects; lost acknowledgement produces one effect. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P07-AC004 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Concurrent replay, multi-device conflict, revoked user, pull pagination and expired cursor.

### MYF-P07-T012 — Connect UI and verify acceptance for MYF-P07-R004

- Description: Connect the existing service contract to the phase G form/view for MYF-P07-R004; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P07-T011.
- Files/modules: src/app/ phase pages; src/modules/offline-first/ UI components; tests/offline-first/component/ and E2E/.
- Expected behavior: Same key/payload returns stored receipt; different payload rejects; lost acknowledgement produces one effect.
- Acceptance criteria: MYF-P07-AC004 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Concurrent replay, multi-device conflict, revoked user, pull pagination and expired cursor.

### MYF-P07-T013 — Audit and close phase

- Description: execute all applicable checks; audit implemented scope/AC/security/integrity, remediate findings, retest and issue evidence-backed verdict.
- Dependencies: MYF-P07-T001 through MYF-P07-T012.
- Files/modules: phase module/tests, docs/reports/ and docs/PROJECT-STATUS.md; [closeout template](../engineering/phase-closeout-template.md).
- Expected behavior: no blocker or failed mandatory gate closes the phase.
- Acceptance criteria: all K and L with evidence; approved nonblocking conditions have owner/deadline.
- Required tests: J plus [quality gates](../engineering/definition-of-done.md); Phase 0 evidence/document review and explicit N/A application commands.

## I. Security Requirements

Current authentication required online; expired/revoked session cannot commit. Authorize every operation, relation, export/file grant server-side. Derive tenant from verified membership/grant, never client actor/role/ownership claim. Validate schema/units/money/dates/parents server-side.

Minimize contacts/GPS/finance/media, use private short-lived scoped file grants, redact secrets/content from logs. Audit sensitive writes, grants, corrections/exports with actor/time/scope/request/command. Phase 1–6 prepare commands/IDs; full sync in 7. Offline writes cannot grant authority or guarantee current stock availability.

## J. Testing Strategy

Unit: H golden examples and domain validation. Integration: isolated real PostgreSQL constraints/rollback, scoped repositories and provider contracts. E2E: permitted journey, mobile/keyboard, empty/loading/error/reconnect. Security: two tenants, guessed IDs, forged scope/parent, revocation/expired session, search/export/media. Failures: DB/provider timeout, invalid payload, version conflict, duplicate/concurrent command, partial media. Regression: cumulative gates, financial/stock reconstruction and farmer offline. H specifies unique phase edge cases.

Run npm run lint, npm run typecheck, npm test, npm run build plus applicable integration/E2E/security/migration suites; concurrency tests exercise actual DB constraints.

## K. Acceptance Criteria

- **MYF-P07-AC001**: Cached shell reopens disconnected; denied persistence/quota error visible without false save success. Verification: Offline cold start after bootstrap, quota and eviction recovery.
- **MYF-P07-AC002**: All eight source actions persist locally with pending status; photo retry retains metadata. Verification: Eight-action E2E, tab reload, storage failure and media recovery.
- **MYF-P07-AC003**: Stale version conflicts; transient failures retry; permanent validation retained for repair. Verification: Crash during SYNCING, missing dependencies, stale edits and invalid payload.
- **MYF-P07-AC004**: Same key/payload returns stored receipt; different payload rejects; lost acknowledgement produces one effect. Verification: Concurrent replay, multi-device conflict, revoked user, pull pagination and expired cursor.

## L. Phase Exit Gate

Eight offline actions pass approved duration; replay/lost acknowledgements/conflicts/revocation/quota cases do not corrupt or duplicate records. All K criteria have evidence, cumulative prerequisites hold, blocking security/integrity defects absent, required command results logged. PASS WITH CONDITIONS cannot waive failing mandatory tests; every nonblocking condition has owner/deadline. Later source-silent gates are proposed and need approval before execution.

## M. Risks and Limitations

Technical: concurrency, browser/provider compatibility and unbounded queries. Operational: support/training, shared-device privacy and recovery ownership. Integrity: wrong scope/unit/currency, missing history, duplicated retries, misunderstood metrics. Specific unknowns: Q16 offline duration/browser/device/storage/receipt and tombstone retention/shared unlock/recovery. Deferred: later phases and unapproved provider capabilities; schemas/policies remain proposals.

## N. Deliverables

Reviewed phase module/mobile UI, approved/rehearsed migrations where needed, API/adapter contracts, tests/quality/security evidence, recovery notes and closeout report.

## O. Completion Checklist

- [ ] MYF-P07-T001 complete with evidence.
- [ ] MYF-P07-T002 complete with evidence.
- [ ] MYF-P07-T003 complete with evidence.
- [ ] MYF-P07-T004 complete with evidence.
- [ ] MYF-P07-T005 complete with evidence.
- [ ] MYF-P07-T006 complete with evidence.
- [ ] MYF-P07-T007 complete with evidence.
- [ ] MYF-P07-T008 complete with evidence.
- [ ] MYF-P07-T009 complete with evidence.
- [ ] MYF-P07-T010 complete with evidence.
- [ ] MYF-P07-T011 complete with evidence.
- [ ] MYF-P07-T012 complete with evidence.
- [ ] MYF-P07-T013 complete with evidence.
- [ ] Every K criterion verified.
- [ ] Security/integrity audit, remediation and retest complete.
- [ ] Applicable quality/E2E/integration/migration evidence recorded.
- [ ] L gate approved; closeout/status updated from evidence.
