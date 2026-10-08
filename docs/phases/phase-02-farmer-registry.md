# Phase 02 Farmer Identity and Farm Registry

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase01 status, applicability and evidence/link review; affected content reconciled; no independent farmer validation or hosted verification.
- Implementation status: NOT STARTED — 0% (0/13 verified tasks).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase01 implementation session.
- Related phase/task IDs: Phase 02; MYF-P02-T001 through MYF-P02-T013; review session Phase01.
- Verified completed work: No tasks implemented or verified in this phase; status/provider applicability reviewed only.
- Remaining work/blockers: All 13 tasks and their acceptance/exit gates pending; Phase01 completion and future phase authorization required.
- Evidence/report links: [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Status: **NOT STARTED**. Date: 2026-10-08. This is a specification, not implementation approval. Related: [architecture](../architecture/system-architecture.md), [security](../architecture/security-architecture.md), [testing](../architecture/testing-strategy.md), [decisions](../DECISION-LOG.md), [traceability](../REQUIREMENTS-TRACEABILITY.md).

## A. Phase Overview

Purpose/business problem: Create an owned agricultural identity/registry with minimal personal data.

Target users: Farmers and authorized managers. Expected outcomes: K's observable criteria. Classification: MVP discovery/foundation.

## B. Source Requirements

Source: P0166–P0216 in [complete extract](../reports/source-extract.md). Examples are illustrative. Exclusions: later phase features and any application implementation during this assignment. GPS optional; contact phone is not an authorization credential.

Ambiguities: Q05 identity cardinality/phone/location/ownership transfer; Q06 document purpose/retention. Resolve affected policy before dependent tasks; do not invent rules.

| Requirement | Source | Capability |
|---|---|---|
| MYF-P02-R001 | P0169–P0179 | Model User, Organization, Farmer, FarmerProfile, Farm, Plot, FarmMember, Address, Contact and Document. |
| MYF-P02-R002 | P0186–P0197 | Capture name, phone/alternative phone, district/subcounty/village, preferred language, ownership and main activities; minimize data. |
| MYF-P02-R003 | P0198–P0204 | Capture farm name/location, approximate acreage, ownership, activity and optional GPS. |
| MYF-P02-R004 | P0205–P0216 | Authorize every query; isolate farms, transactions, harvests, financial records and documents. |

## C. Dependencies

Prerequisite phases: Phase 1 exit gate plus cumulative earlier gates.

Database inputs: earlier owned registry/production/transaction entities actually needed plus F proposals. Phase 0 is evidence documents only. Services: RegisterFarmer, CreateFarm, CreatePlot, UpdateProfile, FarmAccessPolicy. Infrastructure: authenticated Next.js, isolated PostgreSQL/Supabase, private object storage; Dexie/PWA sync from Phase 7.

Integrations: approved auth/persistence/provider adapters; use fakes before reviewed provider contracts. [Cross-phase matrix](../MASTER-IMPLEMENTATION-ROADMAP.md) records forward extension points. Stable IDs, tenant context and version fields precede sync/institutional features. No new infrastructure without measured need.

## D. Functional Requirements

### MYF-P02-R001

User story: as an authorized user named in A, I need this capability: Model User, Organization, Farmer, FarmerProfile, Farm, Plot, FarmMember, Address, Contact and Document. Business rules, validation and interaction: Farmer/farm ownership bound to authenticated actor; foreign-tenant plot link rejected.

### MYF-P02-R002

User story: as an authorized user named in A, I need this capability: Capture name, phone/alternative phone, district/subcounty/village, preferred language, ownership and main activities; minimize data. Business rules, validation and interaction: Optionality approved; extra sensitive data requires purpose before collection.

### MYF-P02-R003

User story: as an authorized user named in A, I need this capability: Capture farm name/location, approximate acreage, ownership, activity and optional GPS. Business rules, validation and interaction: Nonnegative acreage; valid complete coordinate pair when supplied.

### MYF-P02-R004

User story: as an authorized user named in A, I need this capability: Authorize every query; isolate farms, transactions, harvests, financial records and documents. Business rules, validation and interaction: Two farmers cannot list/read/edit/delete/export each other’s data or obtain file grants.

Permissions: active farm membership or explicit organization/assignment/share grant; read/write/export separate; corrections and settlement require approved reviewer role. Admin has no automatic farm-data access.

## E. Technical Architecture

Proposed module: src/modules/farmer-registry/ with contracts/, domain/, application/, infrastructure/. src/app/api/v1/ route handlers authenticate/validate then call services. Clients collect input/display; server owns authorization, authoritative computation and commits.

Services: RegisterFarmer, CreateFarm, CreatePlot, UpdateProfile, FarmAccessPolicy. Flow: intent → schema → current authorization → domain rules → transaction/repository → audit/receipt → scoped DTO. Projections rebuild from source histories. External network calls stay outside DB transactions.

Offline: see [sync](../architecture/offline-sync-architecture.md); Phases 1–6 prepare commands/IDs, full behavior Phase 7. Offline records remain pending until server acknowledgement. Provider/partner verification cannot be claimed offline. Operator cache shows as-of or explicitly requires network.

## F. Database Design

**Proposal until implementation approval. No migrations created now.**

Farmer(id UUID,userId UUID,tenantId UUID); FarmerProfile(farmerId UUID unique,name text,phone text,alternativePhone text?,district text,subcounty text,village text,preferredLanguage text,ownershipType enum,mainActivities text[]); Farm(id UUID,tenantId UUID,ownerFarmerId UUID,name text,acreage numeric?,ownershipType enum,primaryActivity text,latitude numeric?,longitude numeric?); Plot(id UUID,tenantId UUID,farmId UUID,name text,area numeric?,areaUnit text); FarmMember(farmId UUID,userId UUID,role enum,status enum); Address/Contact(id UUID,farmerId UUID,type enum,value text); Document(id UUID,tenantId UUID,farmId UUID,objectKey text,mediaType text). Reuse User/Organization.

Shared tenant-owned fields: id UUID, tenantId UUID, relevant farmId UUID, createdAt/updatedAt timestamptz, version integer >=1, createdBy UUID. Global catalogs, append histories and research evidence declare distinct ownership. Quantity uses numeric(18,6) plus unit; money numeric(20,4) plus currency pending precision approval. JSON evidence/contracts versioned and validated.

Relationships/constraints: enforce parent/child tenant/farm consistency through composite keys/FKs where applicable plus server policy; unique membership/occurrence/command/provider keys; restrict history deletion. Corrections append reasoned records; balance projections are never authority.

Indexes: tenantId/farmId/date/id for scoped lists, tenantId/parentId for joins, unique receipt/event keys, status/due for actual calendar/queue queries. Global catalog/research uses lookup key rather than fictitious farm scope.

Migration: approve cardinalities/questions; additive fields/backfills with row-count/orphan checks; rehearse isolated migration/restore; preserve API/IndexedDB compatibility. Later activity/provider/billing relations arrive only in their phase.

## G. UI/UX Requirements

Pages/dashboards/forms/navigation: Onboarding/profile; farm list/detail; plot editor; membership/document views. Show current farm/organization scope. Mobile: one-column input, large touch targets, readable money/units, optional-field disclosure. Consequential review shows amount/unit/date/scope.

Loading announced; recoverable errors retain input and safe retry. Empty states distinguish no data, denial and provider failure and offer permitted next action. Verify keyboard, labels, focus and screen-reader statuses. Offline shows cached vs pending vs confirmed records; never silently change scope.

## H. Implementation Tasks

Execute these small stages sequentially after authorization. Field/model/provider policies remain proposals until affected decisions are resolved. Each capability separates contract/domain work, authorized service/evidence work, and user-visible acceptance. All task IDs remain pending.

### MYF-P02-T001 — Specify and implement domain contract for MYF-P02-R001

- Description: For MYF-P02-R001, define validated DTO/value objects and deterministic rules for: Model User, Organization, Farmer, FarmerProfile, Farm, Plot, FarmMember, Address, Contact and Document. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: phase prerequisites and affected open Q/ADR decisions.
- Files/modules: src/modules/farmer-registry/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Farmer/farm ownership bound to authenticated actor; foreign-tenant plot link rejected. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P02-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Cross-tenant relationship and orphan creation tests. Check unit/currency/date/scope types and constraints.

### MYF-P02-T002 — Implement authorized application service for MYF-P02-R001

- Description: Implement the scoped service/repository/adapter for MYF-P02-R001; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P02-T001.
- Files/modules: src/modules/farmer-registry/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/farmer-registry/integration/.
- Expected behavior: Farmer/farm ownership bound to authenticated actor; foreign-tenant plot link rejected. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P02-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Cross-tenant relationship and orphan creation tests.

### MYF-P02-T003 — Connect UI and verify acceptance for MYF-P02-R001

- Description: Connect the existing service contract to the phase G form/view for MYF-P02-R001; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P02-T002.
- Files/modules: src/app/ phase pages; src/modules/farmer-registry/ UI components; tests/farmer-registry/component/ and E2E/.
- Expected behavior: Farmer/farm ownership bound to authenticated actor; foreign-tenant plot link rejected.
- Acceptance criteria: MYF-P02-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Cross-tenant relationship and orphan creation tests.

### MYF-P02-T004 — Specify and implement domain contract for MYF-P02-R002

- Description: For MYF-P02-R002, define validated DTO/value objects and deterministic rules for: Capture name, phone/alternative phone, district/subcounty/village, preferred language, ownership and main activities; minimize data. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P02-T003.
- Files/modules: src/modules/farmer-registry/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Optionality approved; extra sensitive data requires purpose before collection. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P02-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Phone/location validation and minimization review. Check unit/currency/date/scope types and constraints.

### MYF-P02-T005 — Implement authorized application service for MYF-P02-R002

- Description: Implement the scoped service/repository/adapter for MYF-P02-R002; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P02-T004.
- Files/modules: src/modules/farmer-registry/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/farmer-registry/integration/.
- Expected behavior: Optionality approved; extra sensitive data requires purpose before collection. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P02-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Phone/location validation and minimization review.

### MYF-P02-T006 — Connect UI and verify acceptance for MYF-P02-R002

- Description: Connect the existing service contract to the phase G form/view for MYF-P02-R002; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P02-T005.
- Files/modules: src/app/ phase pages; src/modules/farmer-registry/ UI components; tests/farmer-registry/component/ and E2E/.
- Expected behavior: Optionality approved; extra sensitive data requires purpose before collection.
- Acceptance criteria: MYF-P02-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Phone/location validation and minimization review.

### MYF-P02-T007 — Specify and implement domain contract for MYF-P02-R003

- Description: For MYF-P02-R003, define validated DTO/value objects and deterministic rules for: Capture farm name/location, approximate acreage, ownership, activity and optional GPS. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P02-T006.
- Files/modules: src/modules/farmer-registry/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Nonnegative acreage; valid complete coordinate pair when supplied. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P02-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Absent GPS, out-of-range coordinates and negative area tests. Check unit/currency/date/scope types and constraints.

### MYF-P02-T008 — Implement authorized application service for MYF-P02-R003

- Description: Implement the scoped service/repository/adapter for MYF-P02-R003; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P02-T007.
- Files/modules: src/modules/farmer-registry/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/farmer-registry/integration/.
- Expected behavior: Nonnegative acreage; valid complete coordinate pair when supplied. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P02-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Absent GPS, out-of-range coordinates and negative area tests.

### MYF-P02-T009 — Connect UI and verify acceptance for MYF-P02-R003

- Description: Connect the existing service contract to the phase G form/view for MYF-P02-R003; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P02-T008.
- Files/modules: src/app/ phase pages; src/modules/farmer-registry/ UI components; tests/farmer-registry/component/ and E2E/.
- Expected behavior: Nonnegative acreage; valid complete coordinate pair when supplied.
- Acceptance criteria: MYF-P02-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Absent GPS, out-of-range coordinates and negative area tests.

### MYF-P02-T010 — Specify and implement domain contract for MYF-P02-R004

- Description: For MYF-P02-R004, define validated DTO/value objects and deterministic rules for: Authorize every query; isolate farms, transactions, harvests, financial records and documents. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P02-T009.
- Files/modules: src/modules/farmer-registry/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Two farmers cannot list/read/edit/delete/export each other’s data or obtain file grants. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P02-AC004 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: IDOR suite across search/export/signed file URLs. Check unit/currency/date/scope types and constraints.

### MYF-P02-T011 — Implement authorized application service for MYF-P02-R004

- Description: Implement the scoped service/repository/adapter for MYF-P02-R004; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P02-T010.
- Files/modules: src/modules/farmer-registry/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/farmer-registry/integration/.
- Expected behavior: Two farmers cannot list/read/edit/delete/export each other’s data or obtain file grants. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P02-AC004 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: IDOR suite across search/export/signed file URLs.

### MYF-P02-T012 — Connect UI and verify acceptance for MYF-P02-R004

- Description: Connect the existing service contract to the phase G form/view for MYF-P02-R004; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P02-T011.
- Files/modules: src/app/ phase pages; src/modules/farmer-registry/ UI components; tests/farmer-registry/component/ and E2E/.
- Expected behavior: Two farmers cannot list/read/edit/delete/export each other’s data or obtain file grants.
- Acceptance criteria: MYF-P02-AC004 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: IDOR suite across search/export/signed file URLs.

### MYF-P02-T013 — Audit and close phase

- Description: execute all applicable checks; audit implemented scope/AC/security/integrity, remediate findings, retest and issue evidence-backed verdict.
- Dependencies: MYF-P02-T001 through MYF-P02-T012.
- Files/modules: phase module/tests, docs/reports/ and docs/PROJECT-STATUS.md; [closeout template](../engineering/phase-closeout-template.md).
- Expected behavior: no blocker or failed mandatory gate closes the phase.
- Acceptance criteria: all K and L with evidence; approved nonblocking conditions have owner/deadline.
- Required tests: J plus [quality gates](../engineering/definition-of-done.md); Phase 0 evidence/document review and explicit N/A application commands.

## I. Security Requirements

Current authentication required online; expired/revoked session cannot commit. Authorize every operation, relation, export/file grant server-side. Derive tenant from verified membership/grant, never client actor/role/ownership claim. Validate schema/units/money/dates/parents server-side.

Minimize contacts/GPS/finance/media, use private short-lived scoped file grants, redact secrets/content from logs. Audit sensitive writes, grants, corrections/exports with actor/time/scope/request/command. GPS optional; contact phone is not an authorization credential.

## J. Testing Strategy

Unit: H golden examples and domain validation. Integration: isolated real PostgreSQL constraints/rollback, scoped repositories and provider contracts. E2E: permitted journey, mobile/keyboard, empty/loading/error/reconnect. Security: two tenants, guessed IDs, forged scope/parent, revocation/expired session, search/export/media. Failures: DB/provider timeout, invalid payload, version conflict, duplicate/concurrent command, partial media. Regression: cumulative gates, financial/stock reconstruction and farmer offline. H specifies unique phase edge cases.

Run npm run lint, npm run typecheck, npm test, npm run build plus applicable integration/E2E/security/migration suites; concurrency tests exercise actual DB constraints.

## K. Acceptance Criteria

- **MYF-P02-AC001**: Farmer/farm ownership bound to authenticated actor; foreign-tenant plot link rejected. Verification: Cross-tenant relationship and orphan creation tests.
- **MYF-P02-AC002**: Optionality approved; extra sensitive data requires purpose before collection. Verification: Phone/location validation and minimization review.
- **MYF-P02-AC003**: Nonnegative acreage; valid complete coordinate pair when supplied. Verification: Absent GPS, out-of-range coordinates and negative area tests.
- **MYF-P02-AC004**: Two farmers cannot list/read/edit/delete/export each other’s data or obtain file grants. Verification: IDOR suite across search/export/signed file URLs.

## L. Phase Exit Gate

Register → create farm → create plots → view owned profile; tenant isolation tests pass. All K criteria have evidence, cumulative prerequisites hold, blocking security/integrity defects absent, required command results logged. PASS WITH CONDITIONS cannot waive failing mandatory tests; every nonblocking condition has owner/deadline. Later source-silent gates are proposed and need approval before execution.

## M. Risks and Limitations

Technical: concurrency, browser/provider compatibility and unbounded queries. Operational: support/training, shared-device privacy and recovery ownership. Integrity: wrong scope/unit/currency, missing history, duplicated retries, misunderstood metrics. Specific unknowns: Q05 identity cardinality/phone/location/ownership transfer; Q06 document purpose/retention. Deferred: later phases and unapproved provider capabilities; schemas/policies remain proposals.

## N. Deliverables

Reviewed phase module/mobile UI, approved/rehearsed migrations where needed, API/adapter contracts, tests/quality/security evidence, recovery notes and closeout report.

## O. Completion Checklist

- [ ] MYF-P02-T001 complete with evidence.
- [ ] MYF-P02-T002 complete with evidence.
- [ ] MYF-P02-T003 complete with evidence.
- [ ] MYF-P02-T004 complete with evidence.
- [ ] MYF-P02-T005 complete with evidence.
- [ ] MYF-P02-T006 complete with evidence.
- [ ] MYF-P02-T007 complete with evidence.
- [ ] MYF-P02-T008 complete with evidence.
- [ ] MYF-P02-T009 complete with evidence.
- [ ] MYF-P02-T010 complete with evidence.
- [ ] MYF-P02-T011 complete with evidence.
- [ ] MYF-P02-T012 complete with evidence.
- [ ] MYF-P02-T013 complete with evidence.
- [ ] Every K criterion verified.
- [ ] Security/integrity audit, remediation and retest complete.
- [ ] Applicable quality/E2E/integration/migration evidence recorded.
- [ ] L gate approved; closeout/status updated from evidence.
