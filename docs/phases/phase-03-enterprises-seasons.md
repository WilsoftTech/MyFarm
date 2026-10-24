# Phase 03 Enterprises Crops Livestock and Seasons

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — T013 task-relevant content, status and evidence.
- Implementation status: COMPLETED - 100% (13/13), PASS WITH CONDITIONS - LOCAL VERIFICATION.
- Last reviewed: 2026-10-25 (Africa/Nairobi), T013 audit.
- Related phase/task IDs: Phase 03; MYF-P03-T001 through MYF-P03-T013; review session Phase01; Phase02 review session (MYF-P02-T001–T013).
- Verified completed work: T001-T006 (crop cycles end to end; MYF-P03-AC002 verified locally) plus T007-T009 poultry batches end to end (D-P03-010; MYF-P03-AC003 verified locally). [T009 evidence](../reports/phase-03-t009-2026-10-19.md); T010 workflow registry and reviewed catalog release rule under D-P03-012 ([T010 evidence](../reports/phase-03-t010-2026-10-19.md)); T011 approved crop release and authorized enterprise capabilities ([T011 evidence](../reports/phase-03-t011-2026-10-25.md)); T012 capability UI and full local AC004 acceptance ([T012 evidence](../reports/phase-03-t012-2026-10-25.md)). T013 audit, lifecycle/security remediation and owner-accepted closeout are verified ([closeout](../reports/phase-03-closeout-2026-10-25.md)).
- Remaining work/blockers: No blocking Phase 3 local gate. Hosted closure policy applied and verified under owner approval. Inherited hosted CI/production conditions remain; Phase 4 requires separate authorization. [Closeout](../reports/phase-03-closeout-2026-10-25.md).
- Evidence/report links: [Phase02 closeout](../reports/phase-02-closeout-2026-10-09.md); [Phase02 every-document review](../reports/phase-02-document-review-2026-10-09.md); [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](../reports/phase-01-provider-verification-2026-10-08.md). [T013 audit](../reports/phase-03-closeout-2026-10-25.md).
<!-- MYFARM-STATUS-END -->

Status: **COMPLETED - 100% (13/13), PASS WITH CONDITIONS - LOCAL VERIFICATION**. [R004 contract evidence](../reports/phase-03-t010-2026-10-19.md); [Poultry UI evidence](../reports/phase-03-t009-2026-10-19.md); [Poultry backend evidence](../reports/phase-03-t008-2026-10-19.md); [Poultry contract evidence](../reports/phase-03-t007-2026-10-19.md); [Crop UI evidence](../reports/phase-03-t006-2026-10-19.md); [Foundation evidence](../reports/phase-03-start-2026-10-18.md); [backend evidence](../reports/phase-03-t002-2026-10-18.md). [UI evidence](../reports/phase-03-t003-2026-10-18.md). Full MYF-P03-AC001 is now verified locally by T013; phase exit is owner-accepted and the hosted closure policy is applied. Authorization: [D-P03-001](../DECISION-LOG.md#d-p03-001--phase-3-authorization-and-sequencing); Q07/Q08 resolved by [D-P03-002](../DECISION-LOG.md#d-p03-002--q07-seasons-and-crop-cycles) and [D-P03-003](../DECISION-LOG.md#d-p03-003--q08-units-and-enterprise-types). Specification date: 2026-10-08. Related: [architecture](../architecture/system-architecture.md), [security](../architecture/security-architecture.md), [testing](../architecture/testing-strategy.md), [decisions](../DECISION-LOG.md), [traceability](../REQUIREMENTS-TRACEABILITY.md).

## A. Phase Overview

Purpose/business problem: Represent production enterprises and cycles across farms.

Target users: Farmers and managers. Expected outcomes: K's observable criteria. Classification: MVP discovery/foundation.

## B. Source Requirements

Source: P0218–P0270 in [complete extract](../reports/source-extract.md). Examples are illustrative. Exclusions: later phase features and any application implementation during this assignment. EnterpriseType includes CROP, POULTRY, DAIRY, LIVESTOCK, FISH, OTHER; only crop/poultry workflows MVP.

Ambiguities: Q07 overlap/perennials/multi-plot/reopening; Q08 units/non-MVP types. Resolve affected policy before dependent tasks; do not invent rules.

| Requirement | Source | Capability |
|---|---|---|
| MYF-P03-R001 | P0220–P0237 | Model farm/plot/enterprise/cycle or season, including maize, coffee and poultry batches. |
| MYF-P03-R002 | P0238–P0247 | Record crop, variety, plot, planted area, planting/expected harvest dates, season/status. |
| MYF-P03-R003 | P0248–P0256 | Record animal type/breed, starting/current quantity, batch, acquisition and purpose. |
| MYF-P03-R004 | P0257–P0270 | Keep extensible enterprise types and avoid hard-coding maize. |

## C. Dependencies

Prerequisite phases: Phase 2 exit gate plus cumulative earlier gates.

Database inputs: earlier owned registry/production/transaction entities actually needed plus F proposals. Phase 0 is evidence documents only. Services: CreateEnterprise, StartCropCycle, StartLivestockBatch, CloseSeason. Infrastructure: authenticated Next.js, isolated PostgreSQL/Supabase, private object storage; Dexie/PWA sync from Phase 7.

Integrations: approved auth/persistence/provider adapters; use fakes before reviewed provider contracts. [Cross-phase matrix](../MASTER-IMPLEMENTATION-ROADMAP.md) records forward extension points. Stable IDs, tenant context and version fields precede sync/institutional features. No new infrastructure without measured need.

## D. Functional Requirements

### MYF-P03-R001

User story: as an authorized user named in A, I need this capability: Model farm/plot/enterprise/cycle or season, including maize, coffee and poultry batches. Business rules, validation and interaction: Two farms and multiple cycles maintain separate histories/totals.

### MYF-P03-R002

User story: as an authorized user named in A, I need this capability: Record crop, variety, plot, planted area, planting/expected harvest dates, season/status. Business rules, validation and interaction: Dates and units explicit; excess plot area requires approved exception.

### MYF-P03-R003

User story: as an authorized user named in A, I need this capability: Record animal type/breed, starting/current quantity, batch, acquisition and purpose. Business rules, validation and interaction: Starting quantity nonnegative integer; current quantity provenance shown.

### MYF-P03-R004

User story: as an authorized user named in A, I need this capability: Keep extensible enterprise types and avoid hard-coding maize. Business rules, validation and interaction: New catalog crop needs no maize-specific code; unsupported enterprise workflow clearly unavailable.

Permissions: active farm membership or explicit organization/assignment/share grant; read/write/export separate; corrections and settlement require approved reviewer role. Admin has no automatic farm-data access.

## E. Technical Architecture

Proposed module: src/modules/enterprises-seasons/ with contracts/, domain/, application/, infrastructure/. src/app/api/v1/ route handlers authenticate/validate then call services. Clients collect input/display; server owns authorization, authoritative computation and commits.

Services: CreateEnterprise, StartCropCycle, StartLivestockBatch, CloseSeason. Flow: intent → schema → current authorization → domain rules → transaction/repository → audit/receipt → scoped DTO. Projections rebuild from source histories. External network calls stay outside DB transactions.

Offline: see [sync](../architecture/offline-sync-architecture.md); Phases 1–6 prepare commands/IDs, full behavior Phase 7. Offline records remain pending until server acknowledgement. Provider/partner verification cannot be claimed offline. Operator cache shows as-of or explicitly requires network.

## F. Database Design

**Full-phase design proposal.** The T001 subset (Enterprise and Season identity/lifecycle fields) is implemented in the additive `202610180001_enterprises_seasons` migration. T002's runtime grants are now verified locally ([report](../reports/phase-03-t002-2026-10-18.md)). T005 adds CropCycle/CropCatalog persistence, seed data and runtime grants verified locally ([report](../reports/phase-03-t005-2026-10-18.md)). T006 adds the crop-cycle UI with no schema change ([report](../reports/phase-03-t006-2026-10-19.md)). T007 defines the poultry batch contract with no schema change; poultry field choices are recorded in D-P03-010 ([report](../reports/phase-03-t007-2026-10-19.md)). T008 adds AnimalTypeCatalog/PoultryBatch persistence, seeds and runtime grants verified locally (migration `202610190001_poultry_batches`, [report](../reports/phase-03-t008-2026-10-19.md)); the proposal's LivestockBatch is implemented as PoultryBatch for the approved POULTRY workflow. T009 adds the poultry UI with no schema change ([report](../reports/phase-03-t009-2026-10-19.md)). The canonical creation migrations/provider grants and final closure policy are now applied to hosted development; the full proposal below still does not assert later-phase behavior.

Enterprise(id UUID,tenantId UUID,farmId UUID,type enum,name text,status enum); Season(id UUID,tenantId UUID,farmId UUID,label text,startDate date,endDate date?,status enum); CropCycle(id UUID,enterpriseId UUID,plotId UUID,seasonId UUID,crop text,variety text?,areaPlanted numeric,areaUnit text,plantingDate date,expectedHarvest date?,status enum); LivestockBatch(id UUID,enterpriseId UUID,animalType text,breed text?,startingQuantity integer,acquisitionDate date,purpose text,status enum). Current flock becomes movement-derived in Phase 5.

Shared tenant-owned fields: id UUID, tenantId UUID, relevant farmId UUID, createdAt/updatedAt timestamptz, version integer >=1, createdBy UUID. Global catalogs, append histories and research evidence declare distinct ownership. Quantity uses numeric(18,6) plus unit; money numeric(20,4) plus currency pending precision approval. JSON evidence/contracts versioned and validated.

Relationships/constraints: enforce parent/child tenant/farm consistency through composite keys/FKs where applicable plus server policy; unique membership/occurrence/command/provider keys; restrict history deletion. Corrections append reasoned records; balance projections are never authority.

Indexes: tenantId/farmId/date/id for scoped lists, tenantId/parentId for joins, unique receipt/event keys, status/due for actual calendar/queue queries. Global catalog/research uses lookup key rather than fictitious farm scope.

Migration: approve cardinalities/questions; additive fields/backfills with row-count/orphan checks; rehearse isolated migration/restore; preserve API/IndexedDB compatibility. Later activity/provider/billing relations arrive only in their phase.

## G. UI/UX Requirements

Pages/dashboards/forms/navigation: Enterprise/season lists, crop cycle form, poultry batch form, closure confirmation. Show current farm/organization scope. Mobile: one-column input, large touch targets, readable money/units, optional-field disclosure. Consequential review shows amount/unit/date/scope.

Loading announced; recoverable errors retain input and safe retry. Empty states distinguish no data, denial and provider failure and offer permitted next action. Verify keyboard, labels, focus and screen-reader statuses. Offline shows cached vs pending vs confirmed records; never silently change scope.

## H. Implementation Tasks

Execute these small stages sequentially after authorization. Field/model/provider policies remain proposals until affected decisions are resolved. Each capability separates contract/domain work, authorized service/evidence work, and user-visible acceptance. T001 foundation, T002 backend, T003 enterprise/season UI, T004 crop-cycle domain contract, T005 crop backend, T006 crop UI, T007 poultry contract, T008 poultry backend, T009 poultry UI, T010 R004 contract and T011 catalog release/capability backend and T012 capability UI/AC004 acceptance are verified; T013 is now verified with owner-accepted closeout. D-P03-007 adjusts T003 acceptance sequencing; the full phase acceptance gate remains required. Commit each completed task per the owner's 2026-10-18 instruction.

### MYF-P03-T001 — Specify and implement domain contract for MYF-P03-R001

- Description: For MYF-P03-R001, define validated DTO/value objects and deterministic rules for: Model farm/plot/enterprise/cycle or season, including maize, coffee and poultry batches. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: phase prerequisites and affected open Q/ADR decisions.
- Files/modules: src/modules/enterprises-seasons/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Two farms and multiple cycles maintain separate histories/totals. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P03-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Wrong-farm/cycle links and multi-enterprise journey. Check unit/currency/date/scope types and constraints.

### MYF-P03-T002 — Implement authorized application service for MYF-P03-R001

- Description: Implement the scoped service/repository/adapter for MYF-P03-R001; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P03-T001.
- Files/modules: src/modules/enterprises-seasons/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/enterprises-seasons/integration/.
- Expected behavior: Two farms and multiple cycles maintain separate histories/totals. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P03-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Wrong-farm/cycle links and multi-enterprise journey.

### MYF-P03-T003 — Connect UI and verify acceptance for MYF-P03-R001

- Description: Connect the existing service contract to the phase G form/view for MYF-P03-R001; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P03-T002.
- Files/modules: src/app/ phase pages; src/modules/enterprises-seasons/ UI components; tests/enterprises-seasons/component/ and E2E/.
- Expected behavior: Two farms and multiple cycles maintain separate histories/totals.
- Acceptance criteria: MYF-P03-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Wrong-farm/cycle links and multi-enterprise journey.

**Approved T003 acceptance adjustment (2026-10-18):** The owner selected "Complete enterprise/season UI; defer full cycle acceptance (Recommended)". T003 verifies scoped enterprise/season creation, lists/details, retries and permission/error/mobile behavior. Full MYF-P03-AC001 cycle/batch histories and totals remain required after T004-T009 and before phase closure. No crop/poultry commands were pulled forward. [D-P03-007](../DECISION-LOG.md#d-p03-007--t003-ui-acceptance-and-deferred-cycle-proof).

### MYF-P03-T004 — Specify and implement domain contract for MYF-P03-R002

- Description: For MYF-P03-R002, define validated DTO/value objects and deterministic rules for: Record crop, variety, plot, planted area, planting/expected harvest dates, season/status. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P03-T003.
- Files/modules: src/modules/enterprises-seasons/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Dates and units explicit; excess plot area requires approved exception. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P03-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Date ordering, missing optional variety and area boundaries. Check unit/currency/date/scope types and constraints.

**T004 verified subset (2026-10-18):** Strict crop-cycle commands, scoped views/repository port and deterministic parent/date/area rules are implemented. Crop selection uses a data-catalog ID; no crop names are hard-coded. Exact six-decimal area sums include all active cycles on the plot; unknown area or mismatched units fail, and excess requires a recorded reason. There is no crop database table, runtime service or UI yet; the minimal additive persistence subset is reviewed with T005. [Evidence](../reports/phase-03-t004-2026-10-18.md).

### MYF-P03-T005 — Implement authorized application service for MYF-P03-R002

- Description: Implement the scoped service/repository/adapter for MYF-P03-R002; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P03-T004.
- Files/modules: src/modules/enterprises-seasons/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/enterprises-seasons/integration/.
- Expected behavior: Dates and units explicit; excess plot area requires approved exception. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P03-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Date ordering, missing optional variety and area boundaries.

**T005 verified subset (2026-10-18):** Scoped crop start/list/detail and active catalog endpoints, additive CropCycle/CropCatalog migration, approved Maize/Coffee seed, serialized plot capacity checks, atomic audit retries and restricted runtime grants are verified on isolated PostgreSQL. No crop UI or hosted change yet. [Evidence](../reports/phase-03-t005-2026-10-18.md).

### MYF-P03-T006 — Connect UI and verify acceptance for MYF-P03-R002

- Description: Connect the existing service contract to the phase G form/view for MYF-P03-R002; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P03-T005.
- Files/modules: src/app/ phase pages; src/modules/enterprises-seasons/ UI components; tests/enterprises-seasons/component/ and E2E/.
- Expected behavior: Dates and units explicit; excess plot area requires approved exception.
- Acceptance criteria: MYF-P03-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Date ordering, missing optional variety and area boundaries.

### MYF-P03-T007 — Specify and implement domain contract for MYF-P03-R003

- Description: For MYF-P03-R003, define validated DTO/value objects and deterministic rules for: Record animal type/breed, starting/current quantity, batch, acquisition and purpose. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P03-T006.
- Files/modules: src/modules/enterprises-seasons/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Starting quantity nonnegative integer; current quantity provenance shown. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P03-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Fractional/negative birds and batch identity tests. Check unit/currency/date/scope types and constraints.

### MYF-P03-T008 — Implement authorized application service for MYF-P03-R003

- Description: Implement the scoped service/repository/adapter for MYF-P03-R003; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P03-T007.
- Files/modules: src/modules/enterprises-seasons/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/enterprises-seasons/integration/.
- Expected behavior: Starting quantity nonnegative integer; current quantity provenance shown. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P03-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Fractional/negative birds and batch identity tests.

### MYF-P03-T009 — Connect UI and verify acceptance for MYF-P03-R003

- Description: Connect the existing service contract to the phase G form/view for MYF-P03-R003; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P03-T008.
- Files/modules: src/app/ phase pages; src/modules/enterprises-seasons/ UI components; tests/enterprises-seasons/component/ and E2E/.
- Expected behavior: Starting quantity nonnegative integer; current quantity provenance shown.
- Acceptance criteria: MYF-P03-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Fractional/negative birds and batch identity tests.

### MYF-P03-T010 — Specify and implement domain contract for MYF-P03-R004

- Description: For MYF-P03-R004, define validated DTO/value objects and deterministic rules for: Keep extensible enterprise types and avoid hard-coding maize. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P03-T009.
- Files/modules: src/modules/enterprises-seasons/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: New catalog crop needs no maize-specific code; unsupported enterprise workflow clearly unavailable. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P03-AC004 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Catalog crop and unsupported type tests. Check unit/currency/date/scope types and constraints.

### MYF-P03-T011 — Implement authorized application service for MYF-P03-R004

- Description: Implement the scoped service/repository/adapter for MYF-P03-R004; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P03-T010.
- Files/modules: src/modules/enterprises-seasons/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/enterprises-seasons/integration/.
- Expected behavior: New catalog crop needs no maize-specific code; unsupported enterprise workflow clearly unavailable. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P03-AC004 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Catalog crop and unsupported type tests.

**T011 verified backend subset (2026-10-25):** The reviewed additive migration releases the 12 approved crop entries; the existing authorized enterprise service/API derives workflow capabilities on create/replay, detail and paginated list. Real PostgreSQL tests verify release rollback/collision behavior, read-only runtime catalog access, newly released crop starts/retries, unsupported types and farm isolation. Full AC004 UI acceptance is now verified by T012 below. [Evidence](../reports/phase-03-t011-2026-10-25.md).

### MYF-P03-T012 — Connect UI and verify acceptance for MYF-P03-R004

- Description: Connect the existing service contract to the phase G form/view for MYF-P03-R004; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P03-T011.
- Files/modules: src/app/ phase pages; src/modules/enterprises-seasons/ UI components; tests/enterprises-seasons/component/ and E2E/.
- Expected behavior: New catalog crop needs no maize-specific code; unsupported enterprise workflow clearly unavailable.
- Acceptance criteria: MYF-P03-AC004 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Catalog crop and unsupported type tests.

**T012 verified UI subset (2026-10-25):** Enterprise detail/list and both production selectors consume authorized workflow capabilities, sharing presentation across paged and preset choices. Unsupported/closed presets are disabled and not preselected. The same form plants all 12 approved crop additions; all four unsupported types show clear limits. Desktop/mobile browser, component and cumulative checks verify local MYF-P03-AC004, including scope isolation, drafts/retries and failure states. [Evidence](../reports/phase-03-t012-2026-10-25.md). T013 and full phase acceptance remain pending.

### MYF-P03-T013 — Audit and close phase

- Description: execute all applicable checks; audit implemented scope/AC/security/integrity, remediate findings, retest and issue evidence-backed verdict.
- Dependencies: MYF-P03-T001 through MYF-P03-T012.
- Files/modules: phase module/tests, docs/reports/ and docs/PROJECT-STATUS.md; [closeout template](../engineering/phase-closeout-template.md).
- Expected behavior: no blocker or failed mandatory gate closes the phase.
- Acceptance criteria: all K and L with evidence; approved nonblocking conditions have owner/deadline.
- Required tests: J plus [quality gates](../engineering/definition-of-done.md); Phase 0 evidence/document review and explicit N/A application commands.

## I. Security Requirements

Current authentication required online; expired/revoked session cannot commit. Authorize every operation, relation, export/file grant server-side. Derive tenant from verified membership/grant, never client actor/role/ownership claim. Validate schema/units/money/dates/parents server-side.

Minimize contacts/GPS/finance/media, use private short-lived scoped file grants, redact secrets/content from logs. Audit sensitive writes, grants, corrections/exports with actor/time/scope/request/command. EnterpriseType includes CROP, POULTRY, DAIRY, LIVESTOCK, FISH, OTHER; only crop/poultry workflows MVP.

## J. Testing Strategy

Unit: H golden examples and domain validation. Integration: isolated real PostgreSQL constraints/rollback, scoped repositories and provider contracts. E2E: permitted journey, mobile/keyboard, empty/loading/error/reconnect. Security: two tenants, guessed IDs, forged scope/parent, revocation/expired session, search/export/media. Failures: DB/provider timeout, invalid payload, version conflict, duplicate/concurrent command, partial media. Regression: cumulative gates, financial/stock reconstruction and farmer offline. H specifies unique phase edge cases.

Run npm run lint, npm run typecheck, npm test, npm run build plus applicable integration/E2E/security/migration suites; concurrency tests exercise actual DB constraints.

## K. Acceptance Criteria

- **MYF-P03-AC001**: Two farms and multiple cycles maintain separate histories/totals. Verification: Wrong-farm/cycle links and multi-enterprise journey.
- **MYF-P03-AC002**: Dates and units explicit; excess plot area requires approved exception. Verification: Date ordering, missing optional variety and area boundaries.
- **MYF-P03-AC003**: Starting quantity nonnegative integer; current quantity provenance shown. Verification: Fractional/negative birds and batch identity tests.
- **MYF-P03-AC004**: New catalog crop needs no maize-specific code; unsupported enterprise workflow clearly unavailable. Verification: Catalog crop and unsupported type tests.

## L. Phase Exit Gate

Manage multiple enterprises across farms/seasons with correctly owned relationships. All K criteria have evidence, cumulative prerequisites hold, blocking security/integrity defects absent, required command results logged. PASS WITH CONDITIONS cannot waive failing mandatory tests; every nonblocking condition has owner/deadline. Later source-silent gates are proposed and need approval before execution.

## M. Risks and Limitations

Technical: concurrency, browser/provider compatibility and unbounded queries. Operational: support/training, shared-device privacy and recovery ownership. Integrity: wrong scope/unit/currency, missing history, duplicated retries, misunderstood metrics. Specific unknowns: Q07 overlap/perennials/multi-plot/reopening; Q08 units/non-MVP types. Deferred: later phases and unapproved provider capabilities; schemas/policies remain proposals.

## N. Deliverables

Reviewed phase module/mobile UI, approved/rehearsed migrations where needed, API/adapter contracts, tests/quality/security evidence, recovery notes and closeout report.

## O. Completion Checklist

- [x] MYF-P03-T001 complete with [evidence](../reports/phase-03-start-2026-10-18.md); full AC001 remains pending the cycle/batch tasks.
- [x] MYF-P03-T002 complete with [backend evidence](../reports/phase-03-t002-2026-10-18.md); full AC001 remains pending.
- [x] MYF-P03-T003 enterprise/season UI complete with [evidence](../reports/phase-03-t003-2026-10-18.md), under D-P03-007; full cycle acceptance remains pending T004-T009.
- [x] MYF-P03-T004 domain/contract stage complete with [evidence](../reports/phase-03-t004-2026-10-18.md); full AC002 pending T005/T006.
- [x] MYF-P03-T005 backend stage complete with [evidence](../reports/phase-03-t005-2026-10-18.md); full AC002 pending T006.
- [x] MYF-P03-T006 crop-cycle UI complete with [evidence](../reports/phase-03-t006-2026-10-19.md); MYF-P03-AC002 verified locally.
- [x] MYF-P03-T007 poultry domain/contract stage complete with [evidence](../reports/phase-03-t007-2026-10-19.md); full AC003 pending T008/T009.
- [x] MYF-P03-T008 poultry backend stage complete with [evidence](../reports/phase-03-t008-2026-10-19.md); full AC003 pending T009.
- [x] MYF-P03-T009 poultry UI complete with [evidence](../reports/phase-03-t009-2026-10-19.md); MYF-P03-AC003 verified locally.
- [x] MYF-P03-T010 R004 domain/contract stage complete with [evidence](../reports/phase-03-t010-2026-10-19.md); full AC004 verified locally by T012.
- [x] MYF-P03-T011 catalog release and authorized capability backend complete with [evidence](../reports/phase-03-t011-2026-10-25.md); full AC004 verified locally by T012.
- [x] MYF-P03-T012 capability UI and local MYF-P03-AC004 acceptance complete with [evidence](../reports/phase-03-t012-2026-10-25.md).
- [x] MYF-P03-T013 complete with [owner-accepted closeout](../reports/phase-03-closeout-2026-10-25.md).
- [x] Every K criterion verified locally: [T013 audit](../reports/phase-03-closeout-2026-10-25.md).
- [x] Security/integrity audit, local remediation and retest complete; hosted closure policy applied and verified.
- [x] Applicable local quality/E2E/integration/migration/restore evidence recorded in the T013 audit.
- [x] L gate approved by owner 2026-10-25; closeout/status updated from evidence (D-P03-015).

## T013 audit checkpoint - 2026-10-25

Final cycle/season closure is implemented and verified locally under D-P03-014. Active cycles block season closure; closure is final and preserves history. Commands use current membership, version checks, atomic audit receipts and season/plot locks. All four K criteria and local quality/recovery gates pass. The owner accepted the L gate and approved the reviewed two-table closure policy, now applied and verified in hosted development. Phase 3 is complete locally (13/13), under inherited production conditions. [Closeout](../reports/phase-03-closeout-2026-10-25.md). No schema migration is added and no later phase is started.
