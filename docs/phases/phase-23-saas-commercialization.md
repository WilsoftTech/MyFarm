# Phase 23 SaaS and Multi Tenant Commercialization

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase02 closeout status/link review; content unchanged; no completion inferred from review.
- Implementation status: NOT STARTED — 0% (0/7 verified tasks).
- Last reviewed: 2026-10-09 (Africa/Nairobi), Phase02 implementation and closeout session.
- Related phase/task IDs: Phase 23; MYF-P23-T001 through MYF-P23-T007; review session Phase01; Phase02 review session (MYF-P02-T001–T013).
- Verified completed work: No tasks implemented or verified in this phase; status/provider applicability reviewed only.
- Remaining work/blockers: All 7 tasks and their acceptance/exit gates pending; Phase01 completion and future phase authorization required.
- Evidence/report links: [Phase02 closeout](../reports/phase-02-closeout-2026-10-09.md); [Phase02 every-document review](../reports/phase-02-document-review-2026-10-09.md); [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](../reports/phase-01-provider-verification-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Status: **NOT STARTED**. Date: 2026-10-08. This is a specification, not implementation approval. Related: [architecture](../architecture/system-architecture.md), [security](../architecture/security-architecture.md), [testing](../architecture/testing-strategy.md), [decisions](../DECISION-LOG.md), [traceability](../REQUIREMENTS-TRACEABILITY.md).

## A. Phase Overview

Purpose/business problem: Formalize commercial plans/subscriptions on existing isolation.

Target users: Farmers/cooperatives/agribusiness/NGOs/tenant admins. Expected outcomes: K's observable criteria. Classification: Post-MVP.

## B. Source Requirements

Source: P0969–P0991 in [complete extract](../reports/source-extract.md). Examples are illustrative. Exclusions: later phase features and any application implementation during this assignment. Source plans are candidates, not approved prices. Billing never confers farm-data rights.

Ambiguities: Q33 pricing/provider/tax/trial/grace/downgrade/export/quotas. Resolve affected policy before dependent tasks; do not invent rules.

| Requirement | Source | Capability |
|---|---|---|
| MYF-P23-R001 | P0971–P0982 | Consider Farmer Free/Pro, Cooperative, Agribusiness, NGO/Project and Enterprise plans. |
| MYF-P23-R002 | P0983–P0991 | Support Organization, Membership, Role, Permission, Tenant, Subscription, FeatureFlag; add billing now. |

## C. Dependencies

Prerequisite phases: Phase 22 exit gate plus cumulative earlier gates.

Database inputs: earlier owned registry/production/transaction entities actually needed plus F proposals. Phase 0 is evidence documents only. Services: ResolveEntitlements, ChangeSubscription, EnforcePlanLimit, ReconcileBillingEvent. Infrastructure: authenticated Next.js, isolated PostgreSQL/Supabase, private object storage; Dexie/PWA sync from Phase 7.

Integrations: approved auth/persistence/provider adapters; use fakes before reviewed provider contracts. [Cross-phase matrix](../MASTER-IMPLEMENTATION-ROADMAP.md) records forward extension points. Stable IDs, tenant context and version fields precede sync/institutional features. No new infrastructure without measured need.

## D. Functional Requirements

### MYF-P23-R001

User story: as an authorized user named in A, I need this capability: Consider Farmer Free/Pro, Cooperative, Agribusiness, NGO/Project and Enterprise plans. Business rules, validation and interaction: Names/prices/limits approved before advertising.

### MYF-P23-R002

User story: as an authorized user named in A, I need this capability: Support Organization, Membership, Role, Permission, Tenant, Subscription, FeatureFlag; add billing now. Business rules, validation and interaction: Server enforces both permission and entitlement; hidden button insufficient.

Permissions: active farm membership or explicit organization/assignment/share grant; read/write/export separate; corrections and settlement require approved reviewer role. Admin has no automatic farm-data access.

## E. Technical Architecture

Proposed module: src/modules/saas-commercialization/ with contracts/, domain/, application/, infrastructure/. src/app/api/v1/ route handlers authenticate/validate then call services. Clients collect input/display; server owns authorization, authoritative computation and commits.

Services: ResolveEntitlements, ChangeSubscription, EnforcePlanLimit, ReconcileBillingEvent. Flow: intent → schema → current authorization → domain rules → transaction/repository → audit/receipt → scoped DTO. Projections rebuild from source histories. External network calls stay outside DB transactions.

Offline: see [sync](../architecture/offline-sync-architecture.md); Phases 1–6 prepare commands/IDs, full behavior Phase 7. Offline records remain pending until server acknowledgement. Provider/partner verification cannot be claimed offline. Operator cache shows as-of or explicitly requires network.

## F. Database Design

**Proposal until implementation approval. No migrations created now.**

Subscription(id UUID,tenantId UUID,planId UUID,status enum,currentPeriodEnd timestamp,providerReference text?); Plan(id UUID,code text,version text,limits json); FeatureFlag(id UUID,key text,tenantId UUID?,enabled boolean); Entitlement(tenantId UUID,featureKey text,limit numeric?,effectiveAt timestamp); Role/Permission/Membership reuse policies; Tenant references personal or organization workspace.

Shared tenant-owned fields: id UUID, tenantId UUID, relevant farmId UUID, createdAt/updatedAt timestamptz, version integer >=1, createdBy UUID. Global catalogs, append histories and research evidence declare distinct ownership. Quantity uses numeric(18,6) plus unit; money numeric(20,4) plus currency pending precision approval. JSON evidence/contracts versioned and validated.

Relationships/constraints: enforce parent/child tenant/farm consistency through composite keys/FKs where applicable plus server policy; unique membership/occurrence/command/provider keys; restrict history deletion. Corrections append reasoned records; balance projections are never authority.

Indexes: tenantId/farmId/date/id for scoped lists, tenantId/parentId for joins, unique receipt/event keys, status/due for actual calendar/queue queries. Global catalog/research uses lookup key rather than fictitious farm scope.

Migration: approve cardinalities/questions; additive fields/backfills with row-count/orphan checks; rehearse isolated migration/restore; preserve API/IndexedDB compatibility. Later activity/provider/billing relations arrive only in their phase.

## G. UI/UX Requirements

Pages/dashboards/forms/navigation: Plan/usage/billing/role settings, changes and quota explanations. Show current farm/organization scope. Mobile: one-column input, large touch targets, readable money/units, optional-field disclosure. Consequential review shows amount/unit/date/scope.

Loading announced; recoverable errors retain input and safe retry. Empty states distinguish no data, denial and provider failure and offer permitted next action. Verify keyboard, labels, focus and screen-reader statuses. Offline shows cached vs pending vs confirmed records; never silently change scope.

## H. Implementation Tasks

Execute these small stages sequentially after authorization. Field/model/provider policies remain proposals until affected decisions are resolved. Each capability separates contract/domain work, authorized service/evidence work, and user-visible acceptance. All task IDs remain pending.

### MYF-P23-T001 — Specify and implement domain contract for MYF-P23-R001

- Description: For MYF-P23-R001, define validated DTO/value objects and deterministic rules for: Consider Farmer Free/Pro, Cooperative, Agribusiness, NGO/Project and Enterprise plans. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: phase prerequisites and affected open Q/ADR decisions.
- Files/modules: src/modules/saas-commercialization/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Names/prices/limits approved before advertising. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P23-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Plan matrix and unpublished-plan denial. Check unit/currency/date/scope types and constraints.

### MYF-P23-T002 — Implement authorized application service for MYF-P23-R001

- Description: Implement the scoped service/repository/adapter for MYF-P23-R001; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P23-T001.
- Files/modules: src/modules/saas-commercialization/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/saas-commercialization/integration/.
- Expected behavior: Names/prices/limits approved before advertising. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P23-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Plan matrix and unpublished-plan denial.

### MYF-P23-T003 — Connect UI and verify acceptance for MYF-P23-R001

- Description: Connect the existing service contract to the phase G form/view for MYF-P23-R001; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P23-T002.
- Files/modules: src/app/ phase pages; src/modules/saas-commercialization/ UI components; tests/saas-commercialization/component/ and E2E/.
- Expected behavior: Names/prices/limits approved before advertising.
- Acceptance criteria: MYF-P23-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Plan matrix and unpublished-plan denial.

### MYF-P23-T004 — Specify and implement domain contract for MYF-P23-R002

- Description: For MYF-P23-R002, define validated DTO/value objects and deterministic rules for: Support Organization, Membership, Role, Permission, Tenant, Subscription, FeatureFlag; add billing now. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P23-T003.
- Files/modules: src/modules/saas-commercialization/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Server enforces both permission and entitlement; hidden button insufficient. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P23-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Expired subscription, webhook replay, downgrade/quota race/cross-tenant flag. Check unit/currency/date/scope types and constraints.

### MYF-P23-T005 — Implement authorized application service for MYF-P23-R002

- Description: Implement the scoped service/repository/adapter for MYF-P23-R002; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P23-T004.
- Files/modules: src/modules/saas-commercialization/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/saas-commercialization/integration/.
- Expected behavior: Server enforces both permission and entitlement; hidden button insufficient. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P23-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Expired subscription, webhook replay, downgrade/quota race/cross-tenant flag.

### MYF-P23-T006 — Connect UI and verify acceptance for MYF-P23-R002

- Description: Connect the existing service contract to the phase G form/view for MYF-P23-R002; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P23-T005.
- Files/modules: src/app/ phase pages; src/modules/saas-commercialization/ UI components; tests/saas-commercialization/component/ and E2E/.
- Expected behavior: Server enforces both permission and entitlement; hidden button insufficient.
- Acceptance criteria: MYF-P23-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Expired subscription, webhook replay, downgrade/quota race/cross-tenant flag.

### MYF-P23-T007 — Audit and close phase

- Description: execute all applicable checks; audit implemented scope/AC/security/integrity, remediate findings, retest and issue evidence-backed verdict.
- Dependencies: MYF-P23-T001 through MYF-P23-T006.
- Files/modules: phase module/tests, docs/reports/ and docs/PROJECT-STATUS.md; [closeout template](../engineering/phase-closeout-template.md).
- Expected behavior: no blocker or failed mandatory gate closes the phase.
- Acceptance criteria: all K and L with evidence; approved nonblocking conditions have owner/deadline.
- Required tests: J plus [quality gates](../engineering/definition-of-done.md); Phase 0 evidence/document review and explicit N/A application commands.

## I. Security Requirements

Current authentication required online; expired/revoked session cannot commit. Authorize every operation, relation, export/file grant server-side. Derive tenant from verified membership/grant, never client actor/role/ownership claim. Validate schema/units/money/dates/parents server-side.

Minimize contacts/GPS/finance/media, use private short-lived scoped file grants, redact secrets/content from logs. Audit sensitive writes, grants, corrections/exports with actor/time/scope/request/command. Source plans are candidates, not approved prices. Billing never confers farm-data rights.

## J. Testing Strategy

Unit: H golden examples and domain validation. Integration: isolated real PostgreSQL constraints/rollback, scoped repositories and provider contracts. E2E: permitted journey, mobile/keyboard, empty/loading/error/reconnect. Security: two tenants, guessed IDs, forged scope/parent, revocation/expired session, search/export/media. Failures: DB/provider timeout, invalid payload, version conflict, duplicate/concurrent command, partial media. Regression: cumulative gates, financial/stock reconstruction and farmer offline. H specifies unique phase edge cases.

Run npm run lint, npm run typecheck, npm test, npm run build plus applicable integration/E2E/security/migration suites; concurrency tests exercise actual DB constraints.

## K. Acceptance Criteria

- **MYF-P23-AC001**: Names/prices/limits approved before advertising. Verification: Plan matrix and unpublished-plan denial.
- **MYF-P23-AC002**: Server enforces both permission and entitlement; hidden button insufficient. Verification: Expired subscription, webhook replay, downgrade/quota race/cross-tenant flag.

## L. Phase Exit Gate

Proposed gate: approved commercial policy; server enforcement/replay/downgrade safe without historical data loss. All K criteria have evidence, cumulative prerequisites hold, blocking security/integrity defects absent, required command results logged. PASS WITH CONDITIONS cannot waive failing mandatory tests; every nonblocking condition has owner/deadline. Later source-silent gates are proposed and need approval before execution.

## M. Risks and Limitations

Technical: concurrency, browser/provider compatibility and unbounded queries. Operational: support/training, shared-device privacy and recovery ownership. Integrity: wrong scope/unit/currency, missing history, duplicated retries, misunderstood metrics. Specific unknowns: Q33 pricing/provider/tax/trial/grace/downgrade/export/quotas. Deferred: later phases and unapproved provider capabilities; schemas/policies remain proposals.

## N. Deliverables

Reviewed phase module/mobile UI, approved/rehearsed migrations where needed, API/adapter contracts, tests/quality/security evidence, recovery notes and closeout report.

## O. Completion Checklist

- [ ] MYF-P23-T001 complete with evidence.
- [ ] MYF-P23-T002 complete with evidence.
- [ ] MYF-P23-T003 complete with evidence.
- [ ] MYF-P23-T004 complete with evidence.
- [ ] MYF-P23-T005 complete with evidence.
- [ ] MYF-P23-T006 complete with evidence.
- [ ] MYF-P23-T007 complete with evidence.
- [ ] Every K criterion verified.
- [ ] Security/integrity audit, remediation and retest complete.
- [ ] Applicable quality/E2E/integration/migration evidence recorded.
- [ ] L gate approved; closeout/status updated from evidence.
