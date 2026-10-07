# Phase 15 Cooperative and Agribusiness Platform

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — status/applicability/structure/link review; no runtime or independent product validation.
- Implementation status: NOT STARTED — 0% (0/7 verified tasks).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase 00 session.
- Related phase/task IDs: Phase 15; MYF-P15-T001 through MYF-P15-T007; review session Phase 00.
- Verified completed work: No implementation tasks completed; existing specification/status/IDs reviewed only.
- Remaining work/blockers: All 7 implementation tasks pending; prior exit gates and explicit phase authorization required.
- Evidence/report links: [Phase 00 closeout](../reports/phase-00-closeout-2026-10-08.md); [every-document review](../reports/phase-00-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Status: **NOT STARTED**. Date: 2026-10-08. This is a specification, not implementation approval. Related: [architecture](../architecture/system-architecture.md), [security](../architecture/security-architecture.md), [testing](../architecture/testing-strategy.md), [decisions](../DECISION-LOG.md), [traceability](../REQUIREMENTS-TRACEABILITY.md).

## A. Phase Overview

Purpose/business problem: Coordinate organization membership and agricultural operations.

Target users: Cooperative managers/members/agents/permitted buyers. Expected outcomes: K's observable criteria. Classification: Post-MVP.

## B. Source Requirements

Source: P0745–P0769 in [complete extract](../reports/source-extract.md). Examples are illustrative. Exclusions: later phase features and any application implementation during this assignment. Source mentions payments/traceability before 17/21: bookkeeping/origin references now; execution/full custody later. Organization membership never absorbs private farmer data.

Ambiguities: Q24 organization-vs-farmer ownership/sharing/procurement/forecast. Resolve affected policy before dependent tasks; do not invent rules.

| Requirement | Source | Capability |
|---|---|---|
| MYF-P15-R001 | P0747–P0756 | Connect organization agents/farmers/buyers to operations. |
| MYF-P15-R002 | P0757–P0769 | Registry, members, mapping, forecasts, aggregation, procurement, payment records, inventory, traceability references, reports, agents. |

## C. Dependencies

Prerequisite phases: Phase 14 exit gate plus cumulative earlier gates.

Database inputs: earlier owned registry/production/transaction entities actually needed plus F proposals. Phase 0 is evidence documents only. Services: ManageMember, GrantFarmSharing, AggregateProduce, RecordProcurement, GenerateOrganizationReport. Infrastructure: authenticated Next.js, isolated PostgreSQL/Neon, private object storage; Dexie/PWA sync from Phase 7.

Integrations: approved auth/persistence/provider adapters; use fakes before reviewed provider contracts. [Cross-phase matrix](../MASTER-IMPLEMENTATION-ROADMAP.md) records forward extension points. Payment execution/full custody activate in 17/21; bookkeeping/origin references only now. No new infrastructure without measured need.

## D. Functional Requirements

### MYF-P15-R001

User story: as an authorized user named in A, I need this capability: Connect organization agents/farmers/buyers to operations. Business rules, validation and interaction: Explicit scope governs each relationship; buyers cannot see private farmer finances.

### MYF-P15-R002

User story: as an authorized user named in A, I need this capability: Registry, members, mapping, forecasts, aggregation, procurement, payment records, inventory, traceability references, reports, agents. Business rules, validation and interaction: Eleven capabilities scoped; forecasts labeled; 17/21 interfaces defer provider settlement/full custody.

Permissions: active farm membership or explicit organization/assignment/share grant; read/write/export separate; corrections and settlement require approved reviewer role. Admin has no automatic farm-data access.

## E. Technical Architecture

Proposed module: src/modules/cooperatives/ with contracts/, domain/, application/, infrastructure/. src/app/api/v1/ route handlers authenticate/validate then call services. Clients collect input/display; server owns authorization, authoritative computation and commits.

Services: ManageMember, GrantFarmSharing, AggregateProduce, RecordProcurement, GenerateOrganizationReport. Flow: intent → schema → current authorization → domain rules → transaction/repository → audit/receipt → scoped DTO. Projections rebuild from source histories. External network calls stay outside DB transactions.

Offline: see [sync](../architecture/offline-sync-architecture.md); Phases 1–6 prepare commands/IDs, full behavior Phase 7. Offline records remain pending until server acknowledgement. Provider/partner verification cannot be claimed offline. Operator cache shows as-of or explicitly requires network.

## F. Database Design

**Proposal until implementation approval. No migrations created now.**

OrganizationMembership(id UUID,organizationId UUID,userId UUID,role enum,status enum); FarmerOrganizationLink(organizationId UUID,farmerId UUID,consentId UUID,scope json,status enum); AggregationLot(id UUID,tenantId UUID,locationId UUID,itemId UUID,status enum); ProcurementRecord(id UUID,tenantId UUID,farmerId UUID,quantity numeric,unit text,grade text?,status enum); OrganizationReport(id UUID,tenantId UUID,type text,asOfSequence bigint).

Shared tenant-owned fields: id UUID, tenantId UUID, relevant farmId UUID, createdAt/updatedAt timestamptz, version integer >=1, createdBy UUID. Global catalogs, append histories and research evidence declare distinct ownership. Quantity uses numeric(18,6) plus unit; money numeric(20,4) plus currency pending precision approval. JSON evidence/contracts versioned and validated.

Relationships/constraints: enforce parent/child tenant/farm consistency through composite keys/FKs where applicable plus server policy; unique membership/occurrence/command/provider keys; restrict history deletion. Corrections append reasoned records; balance projections are never authority.

Indexes: tenantId/farmId/date/id for scoped lists, tenantId/parentId for joins, unique receipt/event keys, status/due for actual calendar/queue queries. Global catalog/research uses lookup key rather than fictitious farm scope.

Migration: approve cardinalities/questions; additive fields/backfills with row-count/orphan checks; rehearse isolated migration/restore; preserve API/IndexedDB compatibility. Later activity/provider/billing relations arrive only in their phase.

## G. UI/UX Requirements

Pages/dashboards/forms/navigation: Members/farm map/forecast/aggregation/procurement/inventory/reports/agent console. Show current farm/organization scope. Mobile: one-column input, large touch targets, readable money/units, optional-field disclosure. Consequential review shows amount/unit/date/scope.

Loading announced; recoverable errors retain input and safe retry. Empty states distinguish no data, denial and provider failure and offer permitted next action. Verify keyboard, labels, focus and screen-reader statuses. Offline shows cached vs pending vs confirmed records; never silently change scope.

## H. Implementation Tasks

Execute these small stages sequentially after authorization. Field/model/provider policies remain proposals until affected decisions are resolved. Each capability separates contract/domain work, authorized service/evidence work, and user-visible acceptance. All task IDs remain pending.

### MYF-P15-T001 — Specify and implement domain contract for MYF-P15-R001

- Description: For MYF-P15-R001, define validated DTO/value objects and deterministic rules for: Connect organization agents/farmers/buyers to operations. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: phase prerequisites and affected open Q/ADR decisions.
- Files/modules: src/modules/cooperatives/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Explicit scope governs each relationship; buyers cannot see private farmer finances. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P15-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Consent revocation, foreign membership and least privilege. Check unit/currency/date/scope types and constraints.

### MYF-P15-T002 — Implement authorized application service for MYF-P15-R001

- Description: Implement the scoped service/repository/adapter for MYF-P15-R001; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P15-T001.
- Files/modules: src/modules/cooperatives/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/cooperatives/integration/.
- Expected behavior: Explicit scope governs each relationship; buyers cannot see private farmer finances. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P15-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Consent revocation, foreign membership and least privilege.

### MYF-P15-T003 — Connect UI and verify acceptance for MYF-P15-R001

- Description: Connect the existing service contract to the phase G form/view for MYF-P15-R001; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P15-T002.
- Files/modules: src/app/ phase pages; src/modules/cooperatives/ UI components; tests/cooperatives/component/ and E2E/.
- Expected behavior: Explicit scope governs each relationship; buyers cannot see private farmer finances.
- Acceptance criteria: MYF-P15-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Consent revocation, foreign membership and least privilege.

### MYF-P15-T004 — Specify and implement domain contract for MYF-P15-R002

- Description: For MYF-P15-R002, define validated DTO/value objects and deterministic rules for: Registry, members, mapping, forecasts, aggregation, procurement, payment records, inventory, traceability references, reports, agents. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P15-T003.
- Files/modules: src/modules/cooperatives/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Eleven capabilities scoped; forecasts labeled; 17/21 interfaces defer provider settlement/full custody. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P15-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Membership, conservation, origin linkage and deferred-module contract tests. Check unit/currency/date/scope types and constraints.

### MYF-P15-T005 — Implement authorized application service for MYF-P15-R002

- Description: Implement the scoped service/repository/adapter for MYF-P15-R002; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P15-T004.
- Files/modules: src/modules/cooperatives/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/cooperatives/integration/.
- Expected behavior: Eleven capabilities scoped; forecasts labeled; 17/21 interfaces defer provider settlement/full custody. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P15-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Membership, conservation, origin linkage and deferred-module contract tests.

### MYF-P15-T006 — Connect UI and verify acceptance for MYF-P15-R002

- Description: Connect the existing service contract to the phase G form/view for MYF-P15-R002; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P15-T005.
- Files/modules: src/app/ phase pages; src/modules/cooperatives/ UI components; tests/cooperatives/component/ and E2E/.
- Expected behavior: Eleven capabilities scoped; forecasts labeled; 17/21 interfaces defer provider settlement/full custody.
- Acceptance criteria: MYF-P15-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Membership, conservation, origin linkage and deferred-module contract tests.

### MYF-P15-T007 — Audit and close phase

- Description: execute all applicable checks; audit implemented scope/AC/security/integrity, remediate findings, retest and issue evidence-backed verdict.
- Dependencies: MYF-P15-T001 through MYF-P15-T006.
- Files/modules: phase module/tests, docs/reports/ and docs/PROJECT-STATUS.md; [closeout template](../engineering/phase-closeout-template.md).
- Expected behavior: no blocker or failed mandatory gate closes the phase.
- Acceptance criteria: all K and L with evidence; approved nonblocking conditions have owner/deadline.
- Required tests: J plus [quality gates](../engineering/definition-of-done.md); Phase 0 evidence/document review and explicit N/A application commands.

## I. Security Requirements

Current authentication required online; expired/revoked session cannot commit. Authorize every operation, relation, export/file grant server-side. Derive tenant from verified membership/grant, never client actor/role/ownership claim. Validate schema/units/money/dates/parents server-side.

Minimize contacts/GPS/finance/media, use private short-lived scoped file grants, redact secrets/content from logs. Audit sensitive writes, grants, corrections/exports with actor/time/scope/request/command. Source mentions payments/traceability before 17/21: bookkeeping/origin references now; execution/full custody later. Organization membership never absorbs private farmer data.

## J. Testing Strategy

Unit: H golden examples and domain validation. Integration: isolated real PostgreSQL constraints/rollback, scoped repositories and provider contracts. E2E: permitted journey, mobile/keyboard, empty/loading/error/reconnect. Security: two tenants, guessed IDs, forged scope/parent, revocation/expired session, search/export/media. Failures: DB/provider timeout, invalid payload, version conflict, duplicate/concurrent command, partial media. Regression: cumulative gates, financial/stock reconstruction and farmer offline. H specifies unique phase edge cases.

Run npm run lint, npm run typecheck, npm test, npm run build plus applicable integration/E2E/security/migration suites; concurrency tests exercise actual DB constraints.

## K. Acceptance Criteria

- **MYF-P15-AC001**: Explicit scope governs each relationship; buyers cannot see private farmer finances. Verification: Consent revocation, foreign membership and least privilege.
- **MYF-P15-AC002**: Eleven capabilities scoped; forecasts labeled; 17/21 interfaces defer provider settlement/full custody. Verification: Membership, conservation, origin linkage and deferred-module contract tests.

## L. Phase Exit Gate

Proposed gate: consented organization operations reconcile; no cross-organization leak or premature provider payments. All K criteria have evidence, cumulative prerequisites hold, blocking security/integrity defects absent, required command results logged. PASS WITH CONDITIONS cannot waive failing mandatory tests; every nonblocking condition has owner/deadline. Later source-silent gates are proposed and need approval before execution.

## M. Risks and Limitations

Technical: concurrency, browser/provider compatibility and unbounded queries. Operational: support/training, shared-device privacy and recovery ownership. Integrity: wrong scope/unit/currency, missing history, duplicated retries, misunderstood metrics. Specific unknowns: Q24 organization-vs-farmer ownership/sharing/procurement/forecast. Deferred: later phases and unapproved provider capabilities; schemas/policies remain proposals.

## N. Deliverables

Reviewed phase module/mobile UI, approved/rehearsed migrations where needed, API/adapter contracts, tests/quality/security evidence, recovery notes and closeout report.

## O. Completion Checklist

- [ ] MYF-P15-T001 complete with evidence.
- [ ] MYF-P15-T002 complete with evidence.
- [ ] MYF-P15-T003 complete with evidence.
- [ ] MYF-P15-T004 complete with evidence.
- [ ] MYF-P15-T005 complete with evidence.
- [ ] MYF-P15-T006 complete with evidence.
- [ ] MYF-P15-T007 complete with evidence.
- [ ] Every K criterion verified.
- [ ] Security/integrity audit, remediation and retest complete.
- [ ] Applicable quality/E2E/integration/migration evidence recorded.
- [ ] L gate approved; closeout/status updated from evidence.
