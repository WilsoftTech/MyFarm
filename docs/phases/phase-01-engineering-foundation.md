# Phase 01 Engineering Foundation

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — status/applicability/structure/link review; no runtime or independent product validation.
- Implementation status: NOT STARTED — 0% (0/13 verified tasks).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase 00 session.
- Related phase/task IDs: Phase 01; MYF-P01-T001 through MYF-P01-T013; review session Phase 00.
- Verified completed work: No implementation tasks completed; existing specification/status/IDs reviewed only.
- Remaining work/blockers: All 13 implementation tasks pending; prior exit gates and explicit phase authorization required.
- Evidence/report links: [Phase 00 closeout](../reports/phase-00-closeout-2026-10-08.md); [every-document review](../reports/phase-00-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Status: **NOT STARTED**. Date: 2026-10-08. This is a specification, not implementation approval. Related: [architecture](../architecture/system-architecture.md), [security](../architecture/security-architecture.md), [testing](../architecture/testing-strategy.md), [decisions](../DECISION-LOG.md), [traceability](../REQUIREMENTS-TRACEABILITY.md).

## A. Phase Overview

Purpose/business problem: Establish secure modular engineering foundations.

Target users: Engineering owner; future farmer/agent/admin users. Expected outcomes: K's observable criteria. Classification: MVP discovery/foundation.

## B. Source Requirements

Source: P0087–P0164 in [complete extract](../reports/source-extract.md). Examples are illustrative. Exclusions: later phase features and any application implementation during this assignment. Prepare tenant context, stable command IDs and future interfaces; no billing, AI or agent workflow now.

Ambiguities: Q03 auth provider/recovery; Q04 pinned versions, region, object storage and budget. Resolve affected policy before dependent tasks; do not invent rules.

| Requirement | Source | Capability |
|---|---|---|
| MYF-P01-R001 | P0089–P0110 | Use Next.js App Router, React, TypeScript, Tailwind, shadcn/ui, Zod and React Hook Form with farmer PWA and agent/admin boundaries. |
| MYF-P01-R002 | P0111–P0126 | Use PostgreSQL/, Prisma, Vercel, private object-storage interface; Vitest, React Testing Library, Playwright; structured logs/errors/audits/health. |
| MYF-P01-R003 | P0130–P0147 | Separate UI → application → domain → repository → database; plan recordFarmExpense, calculateEnterpriseProfit, recordHarvest, closeSeason, transferInventory. |
| MYF-P01-R004 | P0148–P0164 | Provide lint, typecheck, test, build, CI, migration workflow, auth, error handling and basic security. |

## C. Dependencies

Prerequisite phases: Phase 0 exit gate plus cumulative earlier gates.

Database inputs: earlier owned registry/production/transaction entities actually needed plus F proposals. Phase 0 is evidence documents only. Services: SessionService, AuthorizationService, AuditService, UnitOfWork, HealthService. Infrastructure: authenticated Next.js, isolated PostgreSQL/Supabase, private object storage; Dexie/PWA sync from Phase 7.

Integrations: approved auth/persistence/provider adapters; use fakes before reviewed provider contracts. [Cross-phase matrix](../MASTER-IMPLEMENTATION-ROADMAP.md) records forward extension points. Stable IDs, tenant context and version fields precede sync/institutional features. No new infrastructure without measured need.

## D. Functional Requirements

### MYF-P01-R001

User story: as an authorized user named in A, I need this capability: Use Next.js App Router, React, TypeScript, Tailwind, shadcn/ui, Zod and React Hook Form with farmer PWA and agent/admin boundaries. Business rules, validation and interaction: Validated typed form works; UI cannot directly call persistence.

### MYF-P01-R002

User story: as an authorized user named in A, I need this capability: Use PostgreSQL/Supabase, Prisma, Vercel, private object-storage interface; Vitest, React Testing Library, Playwright; structured logs/errors/audits/health. Business rules, validation and interaction: Isolated DB connects; private storage and redacted diagnostics demonstrated.

### MYF-P01-R003

User story: as an authorized user named in A, I need this capability: Separate UI → application → domain → repository → database; plan recordFarmExpense, calculateEnterpriseProfit, recordHarvest, closeSeason, transferInventory. Business rules, validation and interaction: Domain functions test without browser/DB; future interfaces do not implement later scope.

### MYF-P01-R004

User story: as an authorized user named in A, I need this capability: Provide lint, typecheck, test, build, CI, migration workflow, auth, error handling and basic security. Business rules, validation and interaction: All four commands exit zero with logs; expired session denied; migration rehearsed.

Permissions: active farm membership or explicit organization/assignment/share grant; read/write/export separate; corrections and settlement require approved reviewer role. Admin has no automatic farm-data access.

## E. Technical Architecture

Proposed module: src/modules/engineering-foundation/ with contracts/, domain/, application/, infrastructure/. src/app/api/v1/ route handlers authenticate/validate then call services. Clients collect input/display; server owns authorization, authoritative computation and commits.

Services: SessionService, AuthorizationService, AuditService, UnitOfWork, HealthService. Flow: intent → schema → current authorization → domain rules → transaction/repository → audit/receipt → scoped DTO. Projections rebuild from source histories. External network calls stay outside DB transactions.

Offline: see [sync](../architecture/offline-sync-architecture.md); Phases 1–6 prepare commands/IDs, full behavior Phase 7. Offline records remain pending until server acknowledgement. Provider/partner verification cannot be claimed offline. Operator cache shows as-of or explicitly requires network.

## F. Database Design

**Proposal until implementation approval. No migrations created now.**

User(id UUID,authSubject text unique,status enum); Organization(id UUID,name text,kind enum); Membership(userId UUID,organizationId UUID,role enum,status enum,unique pair); AuditEvent(id UUID,actorId UUID?,tenantId UUID?,action text,targetId UUID?,requestId text,occurredAt timestamptz).

Shared tenant-owned fields: id UUID, tenantId UUID, relevant farmId UUID, createdAt/updatedAt timestamptz, version integer >=1, createdBy UUID. Global catalogs, append histories and research evidence declare distinct ownership. Quantity uses numeric(18,6) plus unit; money numeric(20,4) plus currency pending precision approval. JSON evidence/contracts versioned and validated.

Relationships/constraints: enforce parent/child tenant/farm consistency through composite keys/FKs where applicable plus server policy; unique membership/occurrence/command/provider keys; restrict history deletion. Corrections append reasoned records; balance projections are never authority.

Indexes: tenantId/farmId/date/id for scoped lists, tenantId/parentId for joins, unique receipt/event keys, status/due for actual calendar/queue queries. Global catalog/research uses lookup key rather than fictitious farm scope.

Migration: approve cardinalities/questions; additive fields/backfills with row-count/orphan checks; rehearse isolated migration/restore; preserve API/IndexedDB compatibility. Later activity/provider/billing relations arrive only in their phase.

## G. UI/UX Requirements

Pages/dashboards/forms/navigation: Sign-in, farmer shell, role dashboard scaffolds, forbidden/session-expired/error pages. Show current farm/organization scope. Mobile: one-column input, large touch targets, readable money/units, optional-field disclosure. Consequential review shows amount/unit/date/scope.

Loading announced; recoverable errors retain input and safe retry. Empty states distinguish no data, denial and provider failure and offer permitted next action. Verify keyboard, labels, focus and screen-reader statuses. Offline shows cached vs pending vs confirmed records; never silently change scope.

## H. Implementation Tasks

Execute these small stages sequentially after authorization. Field/model/provider policies remain proposals until affected decisions are resolved. Each capability separates contract/domain work, authorized service/evidence work, and user-visible acceptance. All task IDs remain pending.

### MYF-P01-T001 — Specify and implement domain contract for MYF-P01-R001

- Description: For MYF-P01-R001, define validated DTO/value objects and deterministic rules for: Use Next.js App Router, React, TypeScript, Tailwind, shadcn/ui, Zod and React Hook Form with farmer PWA and agent/admin boundaries. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: phase prerequisites and affected open Q/ADR decisions.
- Files/modules: src/modules/engineering-foundation/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Validated typed form works; UI cannot directly call persistence. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P01-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Invalid form input, component behavior and import-boundary review. Check unit/currency/date/scope types and constraints.

### MYF-P01-T002 — Implement authorized application service for MYF-P01-R001

- Description: Implement the scoped service/repository/adapter for MYF-P01-R001; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P01-T001.
- Files/modules: src/modules/engineering-foundation/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/engineering-foundation/integration/.
- Expected behavior: Validated typed form works; UI cannot directly call persistence. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P01-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Invalid form input, component behavior and import-boundary review.

### MYF-P01-T003 — Connect UI and verify acceptance for MYF-P01-R001

- Description: Connect the existing service contract to the phase G form/view for MYF-P01-R001; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P01-T002.
- Files/modules: src/app/ phase pages; src/modules/engineering-foundation/ UI components; tests/engineering-foundation/component/ and E2E/.
- Expected behavior: Validated typed form works; UI cannot directly call persistence.
- Acceptance criteria: MYF-P01-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Invalid form input, component behavior and import-boundary review.

### MYF-P01-T004 — Specify and implement domain contract for MYF-P01-R002

- Description: For MYF-P01-R002, define validated DTO/value objects and deterministic rules for: Use PostgreSQL/Supabase, Prisma, Vercel, private object-storage interface; Vitest, React Testing Library, Playwright; structured logs/errors/audits/health. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P01-T003.
- Files/modules: src/modules/engineering-foundation/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Isolated DB connects; private storage and redacted diagnostics demonstrated. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P01-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Connectivity, health degradation, private file and secret-log tests. Check unit/currency/date/scope types and constraints.

### MYF-P01-T005 — Implement authorized application service for MYF-P01-R002

- Description: Implement the scoped service/repository/adapter for MYF-P01-R002; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P01-T004.
- Files/modules: src/modules/engineering-foundation/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/engineering-foundation/integration/.
- Expected behavior: Isolated DB connects; private storage and redacted diagnostics demonstrated. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P01-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Connectivity, health degradation, private file and secret-log tests.

### MYF-P01-T006 — Connect UI and verify acceptance for MYF-P01-R002

- Description: Connect the existing service contract to the phase G form/view for MYF-P01-R002; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P01-T005.
- Files/modules: src/app/ phase pages; src/modules/engineering-foundation/ UI components; tests/engineering-foundation/component/ and E2E/.
- Expected behavior: Isolated DB connects; private storage and redacted diagnostics demonstrated.
- Acceptance criteria: MYF-P01-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Connectivity, health degradation, private file and secret-log tests.

### MYF-P01-T007 — Specify and implement domain contract for MYF-P01-R003

- Description: For MYF-P01-R003, define validated DTO/value objects and deterministic rules for: Separate UI → application → domain → repository → database; plan recordFarmExpense, calculateEnterpriseProfit, recordHarvest, closeSeason, transferInventory. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P01-T006.
- Files/modules: src/modules/engineering-foundation/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Domain functions test without browser/DB; future interfaces do not implement later scope. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P01-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Domain unit test and dependency review. Check unit/currency/date/scope types and constraints.

### MYF-P01-T008 — Implement authorized application service for MYF-P01-R003

- Description: Implement the scoped service/repository/adapter for MYF-P01-R003; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P01-T007.
- Files/modules: src/modules/engineering-foundation/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/engineering-foundation/integration/.
- Expected behavior: Domain functions test without browser/DB; future interfaces do not implement later scope. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P01-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Domain unit test and dependency review.

### MYF-P01-T009 — Connect UI and verify acceptance for MYF-P01-R003

- Description: Connect the existing service contract to the phase G form/view for MYF-P01-R003; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P01-T008.
- Files/modules: src/app/ phase pages; src/modules/engineering-foundation/ UI components; tests/engineering-foundation/component/ and E2E/.
- Expected behavior: Domain functions test without browser/DB; future interfaces do not implement later scope.
- Acceptance criteria: MYF-P01-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Domain unit test and dependency review.

### MYF-P01-T010 — Specify and implement domain contract for MYF-P01-R004

- Description: For MYF-P01-R004, define validated DTO/value objects and deterministic rules for: Provide lint, typecheck, test, build, CI, migration workflow, auth, error handling and basic security. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P01-T009.
- Files/modules: src/modules/engineering-foundation/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: All four commands exit zero with logs; expired session denied; migration rehearsed. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P01-AC004 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: CI run, clean migration, authentication and error integration tests. Check unit/currency/date/scope types and constraints.

### MYF-P01-T011 — Implement authorized application service for MYF-P01-R004

- Description: Implement the scoped service/repository/adapter for MYF-P01-R004; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P01-T010.
- Files/modules: src/modules/engineering-foundation/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/engineering-foundation/integration/.
- Expected behavior: All four commands exit zero with logs; expired session denied; migration rehearsed. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P01-AC004 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: CI run, clean migration, authentication and error integration tests.

### MYF-P01-T012 — Connect UI and verify acceptance for MYF-P01-R004

- Description: Connect the existing service contract to the phase G form/view for MYF-P01-R004; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P01-T011.
- Files/modules: src/app/ phase pages; src/modules/engineering-foundation/ UI components; tests/engineering-foundation/component/ and E2E/.
- Expected behavior: All four commands exit zero with logs; expired session denied; migration rehearsed.
- Acceptance criteria: MYF-P01-AC004 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: CI run, clean migration, authentication and error integration tests.

### MYF-P01-T013 — Audit and close phase

- Description: execute all applicable checks; audit implemented scope/AC/security/integrity, remediate findings, retest and issue evidence-backed verdict.
- Dependencies: MYF-P01-T001 through MYF-P01-T012.
- Files/modules: phase module/tests, docs/reports/ and docs/PROJECT-STATUS.md; [closeout template](../engineering/phase-closeout-template.md).
- Expected behavior: no blocker or failed mandatory gate closes the phase.
- Acceptance criteria: all K and L with evidence; approved nonblocking conditions have owner/deadline.
- Required tests: J plus [quality gates](../engineering/definition-of-done.md); Phase 0 evidence/document review and explicit N/A application commands.

## I. Security Requirements

Current authentication required online; expired/revoked session cannot commit. Authorize every operation, relation, export/file grant server-side. Derive tenant from verified membership/grant, never client actor/role/ownership claim. Validate schema/units/money/dates/parents server-side.

Minimize contacts/GPS/finance/media, use private short-lived scoped file grants, redact secrets/content from logs. Audit sensitive writes, grants, corrections/exports with actor/time/scope/request/command. Prepare tenant context, stable command IDs and future interfaces; no billing, AI or agent workflow now.

## J. Testing Strategy

Unit: H golden examples and domain validation. Integration: isolated real PostgreSQL constraints/rollback, scoped repositories and provider contracts. E2E: permitted journey, mobile/keyboard, empty/loading/error/reconnect. Security: two tenants, guessed IDs, forged scope/parent, revocation/expired session, search/export/media. Failures: DB/provider timeout, invalid payload, version conflict, duplicate/concurrent command, partial media. Regression: cumulative gates, financial/stock reconstruction and farmer offline. H specifies unique phase edge cases.

Run npm run lint, npm run typecheck, npm test, npm run build plus applicable integration/E2E/security/migration suites; concurrency tests exercise actual DB constraints.

## K. Acceptance Criteria

- **MYF-P01-AC001**: Validated typed form works; UI cannot directly call persistence. Verification: Invalid form input, component behavior and import-boundary review.
- **MYF-P01-AC002**: Isolated DB connects; private storage and redacted diagnostics demonstrated. Verification: Connectivity, health degradation, private file and secret-log tests.
- **MYF-P01-AC003**: Domain functions test without browser/DB; future interfaces do not implement later scope. Verification: Domain unit test and dependency review.
- **MYF-P01-AC004**: All four commands exit zero with logs; expired session denied; migration rehearsed. Verification: CI run, clean migration, authentication and error integration tests.

## L. Phase Exit Gate

Authenticated app builds/deploys in an isolated environment; database, migrations, CI, errors, logs, health and baseline security pass. All K criteria have evidence, cumulative prerequisites hold, blocking security/integrity defects absent, required command results logged. PASS WITH CONDITIONS cannot waive failing mandatory tests; every nonblocking condition has owner/deadline. Later source-silent gates are proposed and need approval before execution.

## M. Risks and Limitations

Technical: concurrency, browser/provider compatibility and unbounded queries. Operational: support/training, shared-device privacy and recovery ownership. Integrity: wrong scope/unit/currency, missing history, duplicated retries, misunderstood metrics. Specific unknowns: Q03 auth provider/recovery; Q04 pinned versions, region, object storage and budget. Deferred: later phases and unapproved provider capabilities; schemas/policies remain proposals.

## N. Deliverables

Reviewed phase module/mobile UI, approved/rehearsed migrations where needed, API/adapter contracts, tests/quality/security evidence, recovery notes and closeout report.

## O. Completion Checklist

- [ ] MYF-P01-T001 complete with evidence.
- [ ] MYF-P01-T002 complete with evidence.
- [ ] MYF-P01-T003 complete with evidence.
- [ ] MYF-P01-T004 complete with evidence.
- [ ] MYF-P01-T005 complete with evidence.
- [ ] MYF-P01-T006 complete with evidence.
- [ ] MYF-P01-T007 complete with evidence.
- [ ] MYF-P01-T008 complete with evidence.
- [ ] MYF-P01-T009 complete with evidence.
- [ ] MYF-P01-T010 complete with evidence.
- [ ] MYF-P01-T011 complete with evidence.
- [ ] MYF-P01-T012 complete with evidence.
- [ ] MYF-P01-T013 complete with evidence.
- [ ] Every K criterion verified.
- [ ] Security/integrity audit, remediation and retest complete.
- [ ] Applicable quality/E2E/integration/migration evidence recorded.
- [ ] L gate approved; closeout/status updated from evidence.
