# Phase 06 Production Activities and Farm Calendar

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — status/applicability/structure/link review; no runtime or independent product validation.
- Implementation status: NOT STARTED — 0% (0/10 verified tasks).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase 00 session.
- Related phase/task IDs: Phase 06; MYF-P06-T001 through MYF-P06-T010; review session Phase 00.
- Verified completed work: No implementation tasks completed; existing specification/status/IDs reviewed only.
- Remaining work/blockers: All 10 implementation tasks pending; prior exit gates and explicit phase authorization required.
- Evidence/report links: [Phase 00 closeout](../reports/phase-00-closeout-2026-10-08.md); [every-document review](../reports/phase-00-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Status: **NOT STARTED**. Date: 2026-10-08. This is a specification, not implementation approval. Related: [architecture](../architecture/system-architecture.md), [security](../architecture/security-architecture.md), [testing](../architecture/testing-strategy.md), [decisions](../DECISION-LOG.md), [traceability](../REQUIREMENTS-TRACEABILITY.md).

## A. Phase Overview

Purpose/business problem: Show past/current/upcoming work with recurring livestock activities.

Target users: Farmers/managers/assigned workers. Expected outcomes: K's observable criteria. Classification: MVP discovery/foundation.

## B. Source Requirements

Source: P0394–P0436 in [complete extract](../reports/source-extract.md). Examples are illustrative. Exclusions: later phase features and any application implementation during this assignment. Propose costRecordId linking accounting so activity cost is not double-counted.

Ambiguities: Q14 recurrence/missed/worker/notifications; Q15 cost linkage vs expense creation. Resolve affected policy before dependent tasks; do not invent rules.

| Requirement | Source | Capability |
|---|---|---|
| MYF-P06-R001 | P0396–P0408 | Include planting, irrigation, weeding, spraying, fertilizing, vaccination, feeding, harvesting, pruning, milking, inspection. |
| MYF-P06-R002 | P0409–P0426 | Record farm/enterprise/plot/date/worker/cost/notes/attachments/status; show upcoming/today/completed/missed/cancelled. |
| MYF-P06-R003 | P0427–P0436 | Recur feeding, milking, cleaning, vaccination and inspection. |

## C. Dependencies

Prerequisite phases: Phase 5 exit gate plus cumulative earlier gates.

Database inputs: earlier owned registry/production/transaction entities actually needed plus F proposals. Phase 0 is evidence documents only. Services: ScheduleActivity, CompleteActivity, CancelActivity, ExpandRecurrence, GetFarmCalendar. Infrastructure: authenticated Next.js, isolated PostgreSQL/Neon, private object storage; Dexie/PWA sync from Phase 7.

Integrations: approved auth/persistence/provider adapters; use fakes before reviewed provider contracts. [Cross-phase matrix](../MASTER-IMPLEMENTATION-ROADMAP.md) records forward extension points. Stable IDs, tenant context and version fields precede sync/institutional features. No new infrastructure without measured need.

## D. Functional Requirements

### MYF-P06-R001

User story: as an authorized user named in A, I need this capability: Include planting, irrigation, weeding, spraying, fertilizing, vaccination, feeding, harvesting, pruning, milking, inspection. Business rules, validation and interaction: All activity catalog values retained; crop/poultry MVP behavior explicit.

### MYF-P06-R002

User story: as an authorized user named in A, I need this capability: Record farm/enterprise/plot/date/worker/cost/notes/attachments/status; show upcoming/today/completed/missed/cancelled. Business rules, validation and interaction: Plot B fertilizer due tomorrow appears upcoming; completion records permitted worker/time.

### MYF-P06-R003

User story: as an authorized user named in A, I need this capability: Recur feeding, milking, cleaning, vaccination and inspection. Business rules, validation and interaction: Repeated expansion creates one occurrence; approved cancellation policy stops future entries.

Permissions: active farm membership or explicit organization/assignment/share grant; read/write/export separate; corrections and settlement require approved reviewer role. Admin has no automatic farm-data access.

## E. Technical Architecture

Proposed module: src/modules/farm-activities/ with contracts/, domain/, application/, infrastructure/. src/app/api/v1/ route handlers authenticate/validate then call services. Clients collect input/display; server owns authorization, authoritative computation and commits.

Services: ScheduleActivity, CompleteActivity, CancelActivity, ExpandRecurrence, GetFarmCalendar. Flow: intent → schema → current authorization → domain rules → transaction/repository → audit/receipt → scoped DTO. Projections rebuild from source histories. External network calls stay outside DB transactions.

Offline: see [sync](../architecture/offline-sync-architecture.md); Phases 1–6 prepare commands/IDs, full behavior Phase 7. Offline records remain pending until server acknowledgement. Provider/partner verification cannot be claimed offline. Operator cache shows as-of or explicitly requires network.

## F. Database Design

**Proposal until implementation approval. No migrations created now.**

FarmActivity(id UUID,tenantId UUID,farmId UUID,enterpriseId UUID?,plotId UUID?,type enum,dueOn date,completedAt timestamptz?,workerUserId UUID?,costRecordId UUID?,notes text?,status enum); TaskRecurrence(id UUID,tenantId UUID,templateId UUID,frequency enum,interval integer,timeZone text,endOn date?); TaskOccurrence(id UUID,recurrenceId UUID,dueOn date,unique(recurrenceId,dueOn)); attachments use Document.

Shared tenant-owned fields: id UUID, tenantId UUID, relevant farmId UUID, createdAt/updatedAt timestamptz, version integer >=1, createdBy UUID. Global catalogs, append histories and research evidence declare distinct ownership. Quantity uses numeric(18,6) plus unit; money numeric(20,4) plus currency pending precision approval. JSON evidence/contracts versioned and validated.

Relationships/constraints: enforce parent/child tenant/farm consistency through composite keys/FKs where applicable plus server policy; unique membership/occurrence/command/provider keys; restrict history deletion. Corrections append reasoned records; balance projections are never authority.

Indexes: tenantId/farmId/date/id for scoped lists, tenantId/parentId for joins, unique receipt/event keys, status/due for actual calendar/queue queries. Global catalog/research uses lookup key rather than fictitious farm scope.

Migration: approve cardinalities/questions; additive fields/backfills with row-count/orphan checks; rehearse isolated migration/restore; preserve API/IndexedDB compatibility. Later activity/provider/billing relations arrive only in their phase.

## G. UI/UX Requirements

Pages/dashboards/forms/navigation: Today/upcoming/completed/missed/cancelled; calendar; task/recurrence forms. Show current farm/organization scope. Mobile: one-column input, large touch targets, readable money/units, optional-field disclosure. Consequential review shows amount/unit/date/scope.

Loading announced; recoverable errors retain input and safe retry. Empty states distinguish no data, denial and provider failure and offer permitted next action. Verify keyboard, labels, focus and screen-reader statuses. Offline shows cached vs pending vs confirmed records; never silently change scope.

## H. Implementation Tasks

Execute these small stages sequentially after authorization. Field/model/provider policies remain proposals until affected decisions are resolved. Each capability separates contract/domain work, authorized service/evidence work, and user-visible acceptance. All task IDs remain pending.

### MYF-P06-T001 — Specify and implement domain contract for MYF-P06-R001

- Description: For MYF-P06-R001, define validated DTO/value objects and deterministic rules for: Include planting, irrigation, weeding, spraying, fertilizing, vaccination, feeding, harvesting, pruning, milking, inspection. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: phase prerequisites and affected open Q/ADR decisions.
- Files/modules: src/modules/farm-activities/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: All activity catalog values retained; crop/poultry MVP behavior explicit. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P06-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Catalog and unsupported enterprise tests. Check unit/currency/date/scope types and constraints.

### MYF-P06-T002 — Implement authorized application service for MYF-P06-R001

- Description: Implement the scoped service/repository/adapter for MYF-P06-R001; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P06-T001.
- Files/modules: src/modules/farm-activities/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/farm-activities/integration/.
- Expected behavior: All activity catalog values retained; crop/poultry MVP behavior explicit. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P06-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Catalog and unsupported enterprise tests.

### MYF-P06-T003 — Connect UI and verify acceptance for MYF-P06-R001

- Description: Connect the existing service contract to the phase G form/view for MYF-P06-R001; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P06-T002.
- Files/modules: src/app/ phase pages; src/modules/farm-activities/ UI components; tests/farm-activities/component/ and E2E/.
- Expected behavior: All activity catalog values retained; crop/poultry MVP behavior explicit.
- Acceptance criteria: MYF-P06-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Catalog and unsupported enterprise tests.

### MYF-P06-T004 — Specify and implement domain contract for MYF-P06-R002

- Description: For MYF-P06-R002, define validated DTO/value objects and deterministic rules for: Record farm/enterprise/plot/date/worker/cost/notes/attachments/status; show upcoming/today/completed/missed/cancelled. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P06-T003.
- Files/modules: src/modules/farm-activities/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Plot B fertilizer due tomorrow appears upcoming; completion records permitted worker/time. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P06-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Timezone/overdue/cancelled/foreign worker/private attachment tests. Check unit/currency/date/scope types and constraints.

### MYF-P06-T005 — Implement authorized application service for MYF-P06-R002

- Description: Implement the scoped service/repository/adapter for MYF-P06-R002; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P06-T004.
- Files/modules: src/modules/farm-activities/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/farm-activities/integration/.
- Expected behavior: Plot B fertilizer due tomorrow appears upcoming; completion records permitted worker/time. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P06-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Timezone/overdue/cancelled/foreign worker/private attachment tests.

### MYF-P06-T006 — Connect UI and verify acceptance for MYF-P06-R002

- Description: Connect the existing service contract to the phase G form/view for MYF-P06-R002; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P06-T005.
- Files/modules: src/app/ phase pages; src/modules/farm-activities/ UI components; tests/farm-activities/component/ and E2E/.
- Expected behavior: Plot B fertilizer due tomorrow appears upcoming; completion records permitted worker/time.
- Acceptance criteria: MYF-P06-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Timezone/overdue/cancelled/foreign worker/private attachment tests.

### MYF-P06-T007 — Specify and implement domain contract for MYF-P06-R003

- Description: For MYF-P06-R003, define validated DTO/value objects and deterministic rules for: Recur feeding, milking, cleaning, vaccination and inspection. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P06-T006.
- Files/modules: src/modules/farm-activities/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Repeated expansion creates one occurrence; approved cancellation policy stops future entries. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P06-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Duplicate expansion, date boundaries, recurrence edits and offline replay. Check unit/currency/date/scope types and constraints.

### MYF-P06-T008 — Implement authorized application service for MYF-P06-R003

- Description: Implement the scoped service/repository/adapter for MYF-P06-R003; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P06-T007.
- Files/modules: src/modules/farm-activities/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/farm-activities/integration/.
- Expected behavior: Repeated expansion creates one occurrence; approved cancellation policy stops future entries. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P06-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Duplicate expansion, date boundaries, recurrence edits and offline replay.

### MYF-P06-T009 — Connect UI and verify acceptance for MYF-P06-R003

- Description: Connect the existing service contract to the phase G form/view for MYF-P06-R003; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P06-T008.
- Files/modules: src/app/ phase pages; src/modules/farm-activities/ UI components; tests/farm-activities/component/ and E2E/.
- Expected behavior: Repeated expansion creates one occurrence; approved cancellation policy stops future entries.
- Acceptance criteria: MYF-P06-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Duplicate expansion, date boundaries, recurrence edits and offline replay.

### MYF-P06-T010 — Audit and close phase

- Description: execute all applicable checks; audit implemented scope/AC/security/integrity, remediate findings, retest and issue evidence-backed verdict.
- Dependencies: MYF-P06-T001 through MYF-P06-T009.
- Files/modules: phase module/tests, docs/reports/ and docs/PROJECT-STATUS.md; [closeout template](../engineering/phase-closeout-template.md).
- Expected behavior: no blocker or failed mandatory gate closes the phase.
- Acceptance criteria: all K and L with evidence; approved nonblocking conditions have owner/deadline.
- Required tests: J plus [quality gates](../engineering/definition-of-done.md); Phase 0 evidence/document review and explicit N/A application commands.

## I. Security Requirements

Current authentication required online; expired/revoked session cannot commit. Authorize every operation, relation, export/file grant server-side. Derive tenant from verified membership/grant, never client actor/role/ownership claim. Validate schema/units/money/dates/parents server-side.

Minimize contacts/GPS/finance/media, use private short-lived scoped file grants, redact secrets/content from logs. Audit sensitive writes, grants, corrections/exports with actor/time/scope/request/command. Propose costRecordId linking accounting so activity cost is not double-counted.

## J. Testing Strategy

Unit: H golden examples and domain validation. Integration: isolated real PostgreSQL constraints/rollback, scoped repositories and provider contracts. E2E: permitted journey, mobile/keyboard, empty/loading/error/reconnect. Security: two tenants, guessed IDs, forged scope/parent, revocation/expired session, search/export/media. Failures: DB/provider timeout, invalid payload, version conflict, duplicate/concurrent command, partial media. Regression: cumulative gates, financial/stock reconstruction and farmer offline. H specifies unique phase edge cases.

Run npm run lint, npm run typecheck, npm test, npm run build plus applicable integration/E2E/security/migration suites; concurrency tests exercise actual DB constraints.

## K. Acceptance Criteria

- **MYF-P06-AC001**: All activity catalog values retained; crop/poultry MVP behavior explicit. Verification: Catalog and unsupported enterprise tests.
- **MYF-P06-AC002**: Plot B fertilizer due tomorrow appears upcoming; completion records permitted worker/time. Verification: Timezone/overdue/cancelled/foreign worker/private attachment tests.
- **MYF-P06-AC003**: Repeated expansion creates one occurrence; approved cancellation policy stops future entries. Verification: Duplicate expansion, date boundaries, recurrence edits and offline replay.

## L. Phase Exit Gate

Farmer sees what happened/is happening/comes next; recurrence expands once per due date. All K criteria have evidence, cumulative prerequisites hold, blocking security/integrity defects absent, required command results logged. PASS WITH CONDITIONS cannot waive failing mandatory tests; every nonblocking condition has owner/deadline. Later source-silent gates are proposed and need approval before execution.

## M. Risks and Limitations

Technical: concurrency, browser/provider compatibility and unbounded queries. Operational: support/training, shared-device privacy and recovery ownership. Integrity: wrong scope/unit/currency, missing history, duplicated retries, misunderstood metrics. Specific unknowns: Q14 recurrence/missed/worker/notifications; Q15 cost linkage vs expense creation. Deferred: later phases and unapproved provider capabilities; schemas/policies remain proposals.

## N. Deliverables

Reviewed phase module/mobile UI, approved/rehearsed migrations where needed, API/adapter contracts, tests/quality/security evidence, recovery notes and closeout report.

## O. Completion Checklist

- [ ] MYF-P06-T001 complete with evidence.
- [ ] MYF-P06-T002 complete with evidence.
- [ ] MYF-P06-T003 complete with evidence.
- [ ] MYF-P06-T004 complete with evidence.
- [ ] MYF-P06-T005 complete with evidence.
- [ ] MYF-P06-T006 complete with evidence.
- [ ] MYF-P06-T007 complete with evidence.
- [ ] MYF-P06-T008 complete with evidence.
- [ ] MYF-P06-T009 complete with evidence.
- [ ] MYF-P06-T010 complete with evidence.
- [ ] Every K criterion verified.
- [ ] Security/integrity audit, remediation and retest complete.
- [ ] Applicable quality/E2E/integration/migration evidence recorded.
- [ ] L gate approved; closeout/status updated from evidence.
