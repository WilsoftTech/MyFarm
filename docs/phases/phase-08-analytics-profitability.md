# Phase 08 Farm Analytics and Profitability Engine

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase01 status, applicability and evidence/link review; affected content reconciled; no independent farmer validation or hosted verification.
- Implementation status: NOT STARTED — 0% (0/13 verified tasks).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase01 implementation session.
- Related phase/task IDs: Phase 08; MYF-P08-T001 through MYF-P08-T013; review session Phase01.
- Verified completed work: No tasks implemented or verified in this phase; status/provider applicability reviewed only.
- Remaining work/blockers: All 13 tasks and their acceptance/exit gates pending; Phase01 completion and future phase authorization required.
- Evidence/report links: [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Status: **NOT STARTED**. Date: 2026-10-08. This is a specification, not implementation approval. Related: [architecture](../architecture/system-architecture.md), [security](../architecture/security-architecture.md), [testing](../architecture/testing-strategy.md), [decisions](../DECISION-LOG.md), [traceability](../REQUIREMENTS-TRACEABILITY.md).

## A. Phase Overview

Purpose/business problem: Provide reconciled deterministic profitability/production metrics and close MVP.

Target users: Farmers and authorized managers. Expected outcomes: K's observable criteria. Classification: MVP discovery/foundation.

## B. Source Requirements

Source: P0492–P0538 in [complete extract](../reports/source-extract.md). Examples are illustrative. Exclusions: later phase features and any application implementation during this assignment. Source “Farm Profit” must be labeled gross margin/recorded surplus until approved net-income treatment; overhead cannot silently disappear.

Ambiguities: Q09/Q12 basis/valuation; Q17 denominators/allocation/missing values/freshness. Resolve affected policy before dependent tasks; do not invent rules.

| Requirement | Source | Capability |
|---|---|---|
| MYF-P08-R001 | P0494–P0513 | Display revenue/expenses/profit/margin and enterprise comparison. |
| MYF-P08-R002 | P0514–P0528 | Compute cost/acre, cost/kg, revenue/acre, yield/acre, gross/profit margin, labour/input cost, break-even, inventory value, mortality, cost/bird and revenue/bird. |
| MYF-P08-R003 | P0529–P0533 | Calculate trend variance deterministically before any explanation. |
| MYF-P08-R004 | P0534–P0538 | MVP ends with registry, management, accounting, inventory, offline and profitability before field testing. |

## C. Dependencies

Prerequisite phases: Phase 7 exit gate plus cumulative earlier gates.

Database inputs: earlier owned registry/production/transaction entities actually needed plus F proposals. Phase 0 is evidence documents only. Services: CalculateEnterpriseProfit, CalculateProductionMetrics, CompareCycles, ReconcileDashboard. Infrastructure: authenticated Next.js, isolated PostgreSQL/Supabase, private object storage; Dexie/PWA sync from Phase 7.

Integrations: approved auth/persistence/provider adapters; use fakes before reviewed provider contracts. [Cross-phase matrix](../MASTER-IMPLEMENTATION-ROADMAP.md) records forward extension points. Stable IDs, tenant context and version fields precede sync/institutional features. No new infrastructure without measured need.

## D. Functional Requirements

### MYF-P08-R001

User story: as an authorized user named in A, I need this capability: Display revenue/expenses/profit/margin and enterprise comparison. Business rules, validation and interaction: 8,400,000−5,150,000=3,250,000 UGX; margin rounded to 38.7%; enterprise totals match.

### MYF-P08-R002

User story: as an authorized user named in A, I need this capability: Compute cost/acre, cost/kg, revenue/acre, yield/acre, gross/profit margin, labour/input cost, break-even, inventory value, mortality, cost/bird and revenue/bird. Business rules, validation and interaction: Each metric has numerator/denominator/unit/currency/missing outcome; unknown valuation is unavailable.

### MYF-P08-R003

User story: as an authorized user named in A, I need this capability: Calculate trend variance deterministically before any explanation. Business rules, validation and interaction: Feed 100,000→118,000 gives +18%; absent/zero baseline unavailable.

### MYF-P08-R004

User story: as an authorized user named in A, I need this capability: MVP ends with registry, management, accounting, inventory, offline and profitability before field testing. Business rules, validation and interaction: All 0–8 gates evidenced; source farmer journey passes; future functionality absent.

Permissions: active farm membership or explicit organization/assignment/share grant; read/write/export separate; corrections and settlement require approved reviewer role. Admin has no automatic farm-data access.

## E. Technical Architecture

Proposed module: src/modules/analytics-profitability/ with contracts/, domain/, application/, infrastructure/. src/app/api/v1/ route handlers authenticate/validate then call services. Clients collect input/display; server owns authorization, authoritative computation and commits.

Services: CalculateEnterpriseProfit, CalculateProductionMetrics, CompareCycles, ReconcileDashboard. Flow: intent → schema → current authorization → domain rules → transaction/repository → audit/receipt → scoped DTO. Projections rebuild from source histories. External network calls stay outside DB transactions.

Offline: see [sync](../architecture/offline-sync-architecture.md); Phases 1–6 prepare commands/IDs, full behavior Phase 7. Offline records remain pending until server acknowledgement. Provider/partner verification cannot be claimed offline. Operator cache shows as-of or explicitly requires network.

## F. Database Design

**Proposal until implementation approval. No migrations created now.**

MetricSnapshot(id UUID,tenantId UUID,farmId UUID,scopeType enum,scopeId UUID?,asOfSequence bigint,formulaVersion text,basis enum,currency char(3),values json,computedAt timestamp); ReportDefinition(key text,formulaVersion text,unit text). Snapshots rebuild from source records.

Shared tenant-owned fields: id UUID, tenantId UUID, relevant farmId UUID, createdAt/updatedAt timestamptz, version integer >=1, createdBy UUID. Global catalogs, append histories and research evidence declare distinct ownership. Quantity uses numeric(18,6) plus unit; money numeric(20,4) plus currency pending precision approval. JSON evidence/contracts versioned and validated.

Relationships/constraints: enforce parent/child tenant/farm consistency through composite keys/FKs where applicable plus server policy; unique membership/occurrence/command/provider keys; restrict history deletion. Corrections append reasoned records; balance projections are never authority.

Indexes: tenantId/farmId/date/id for scoped lists, tenantId/parentId for joins, unique receipt/event keys, status/due for actual calendar/queue queries. Global catalog/research uses lookup key rather than fictitious farm scope.

Migration: approve cardinalities/questions; additive fields/backfills with row-count/orphan checks; rehearse isolated migration/restore; preserve API/IndexedDB compatibility. Later activity/provider/billing relations arrive only in their phase.

## G. UI/UX Requirements

Pages/dashboards/forms/navigation: Season dashboard, enterprise comparison, cost/yield/bird/area cards, trends/drill-down. Show current farm/organization scope. Mobile: one-column input, large touch targets, readable money/units, optional-field disclosure. Consequential review shows amount/unit/date/scope.

Loading announced; recoverable errors retain input and safe retry. Empty states distinguish no data, denial and provider failure and offer permitted next action. Verify keyboard, labels, focus and screen-reader statuses. Offline shows cached vs pending vs confirmed records; never silently change scope.

## H. Implementation Tasks

Execute these small stages sequentially after authorization. Field/model/provider policies remain proposals until affected decisions are resolved. Each capability separates contract/domain work, authorized service/evidence work, and user-visible acceptance. All task IDs remain pending.

### MYF-P08-T001 — Specify and implement domain contract for MYF-P08-R001

- Description: For MYF-P08-R001, define validated DTO/value objects and deterministic rules for: Display revenue/expenses/profit/margin and enterprise comparison. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: phase prerequisites and affected open Q/ADR decisions.
- Files/modules: src/modules/analytics-profitability/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: 8,400,000−5,150,000=3,250,000 UGX; margin rounded to 38.7%; enterprise totals match. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P08-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Source dashboard fixture, filters/ties/empty/corrections. Check unit/currency/date/scope types and constraints.

### MYF-P08-T002 — Implement authorized application service for MYF-P08-R001

- Description: Implement the scoped service/repository/adapter for MYF-P08-R001; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P08-T001.
- Files/modules: src/modules/analytics-profitability/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/analytics-profitability/integration/.
- Expected behavior: 8,400,000−5,150,000=3,250,000 UGX; margin rounded to 38.7%; enterprise totals match. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P08-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Source dashboard fixture, filters/ties/empty/corrections.

### MYF-P08-T003 — Connect UI and verify acceptance for MYF-P08-R001

- Description: Connect the existing service contract to the phase G form/view for MYF-P08-R001; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P08-T002.
- Files/modules: src/app/ phase pages; src/modules/analytics-profitability/ UI components; tests/analytics-profitability/component/ and E2E/.
- Expected behavior: 8,400,000−5,150,000=3,250,000 UGX; margin rounded to 38.7%; enterprise totals match.
- Acceptance criteria: MYF-P08-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Source dashboard fixture, filters/ties/empty/corrections.

### MYF-P08-T004 — Specify and implement domain contract for MYF-P08-R002

- Description: For MYF-P08-R002, define validated DTO/value objects and deterministic rules for: Compute cost/acre, cost/kg, revenue/acre, yield/acre, gross/profit margin, labour/input cost, break-even, inventory value, mortality, cost/bird and revenue/bird. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P08-T003.
- Files/modules: src/modules/analytics-profitability/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Each metric has numerator/denominator/unit/currency/missing outcome; unknown valuation is unavailable. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P08-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Golden metrics, zero area/yield/revenue, mixed units/currencies and missing flock denominator. Check unit/currency/date/scope types and constraints.

### MYF-P08-T005 — Implement authorized application service for MYF-P08-R002

- Description: Implement the scoped service/repository/adapter for MYF-P08-R002; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P08-T004.
- Files/modules: src/modules/analytics-profitability/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/analytics-profitability/integration/.
- Expected behavior: Each metric has numerator/denominator/unit/currency/missing outcome; unknown valuation is unavailable. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P08-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Golden metrics, zero area/yield/revenue, mixed units/currencies and missing flock denominator.

### MYF-P08-T006 — Connect UI and verify acceptance for MYF-P08-R002

- Description: Connect the existing service contract to the phase G form/view for MYF-P08-R002; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P08-T005.
- Files/modules: src/app/ phase pages; src/modules/analytics-profitability/ UI components; tests/analytics-profitability/component/ and E2E/.
- Expected behavior: Each metric has numerator/denominator/unit/currency/missing outcome; unknown valuation is unavailable.
- Acceptance criteria: MYF-P08-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Golden metrics, zero area/yield/revenue, mixed units/currencies and missing flock denominator.

### MYF-P08-T007 — Specify and implement domain contract for MYF-P08-R003

- Description: For MYF-P08-R003, define validated DTO/value objects and deterministic rules for: Calculate trend variance deterministically before any explanation. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P08-T006.
- Files/modules: src/modules/analytics-profitability/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Feed 100,000→118,000 gives +18%; absent/zero baseline unavailable. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P08-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Variance and incomparable-cycle fixtures. Check unit/currency/date/scope types and constraints.

### MYF-P08-T008 — Implement authorized application service for MYF-P08-R003

- Description: Implement the scoped service/repository/adapter for MYF-P08-R003; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P08-T007.
- Files/modules: src/modules/analytics-profitability/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/analytics-profitability/integration/.
- Expected behavior: Feed 100,000→118,000 gives +18%; absent/zero baseline unavailable. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P08-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Variance and incomparable-cycle fixtures.

### MYF-P08-T009 — Connect UI and verify acceptance for MYF-P08-R003

- Description: Connect the existing service contract to the phase G form/view for MYF-P08-R003; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P08-T008.
- Files/modules: src/app/ phase pages; src/modules/analytics-profitability/ UI components; tests/analytics-profitability/component/ and E2E/.
- Expected behavior: Feed 100,000→118,000 gives +18%; absent/zero baseline unavailable.
- Acceptance criteria: MYF-P08-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Variance and incomparable-cycle fixtures.

### MYF-P08-T010 — Specify and implement domain contract for MYF-P08-R004

- Description: For MYF-P08-R004, define validated DTO/value objects and deterministic rules for: MVP ends with registry, management, accounting, inventory, offline and profitability before field testing. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P08-T009.
- Files/modules: src/modules/analytics-profitability/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: All 0–8 gates evidenced; source farmer journey passes; future functionality absent. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P08-AC004 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Full regression with offline financial/harvest command replay. Check unit/currency/date/scope types and constraints.

### MYF-P08-T011 — Implement authorized application service for MYF-P08-R004

- Description: Implement the scoped service/repository/adapter for MYF-P08-R004; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P08-T010.
- Files/modules: src/modules/analytics-profitability/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/analytics-profitability/integration/.
- Expected behavior: All 0–8 gates evidenced; source farmer journey passes; future functionality absent. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P08-AC004 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Full regression with offline financial/harvest command replay.

### MYF-P08-T012 — Connect UI and verify acceptance for MYF-P08-R004

- Description: Connect the existing service contract to the phase G form/view for MYF-P08-R004; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P08-T011.
- Files/modules: src/app/ phase pages; src/modules/analytics-profitability/ UI components; tests/analytics-profitability/component/ and E2E/.
- Expected behavior: All 0–8 gates evidenced; source farmer journey passes; future functionality absent.
- Acceptance criteria: MYF-P08-AC004 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Full regression with offline financial/harvest command replay.

### MYF-P08-T013 — Audit and close phase

- Description: execute all applicable checks; audit implemented scope/AC/security/integrity, remediate findings, retest and issue evidence-backed verdict.
- Dependencies: MYF-P08-T001 through MYF-P08-T012.
- Files/modules: phase module/tests, docs/reports/ and docs/PROJECT-STATUS.md; [closeout template](../engineering/phase-closeout-template.md).
- Expected behavior: no blocker or failed mandatory gate closes the phase.
- Acceptance criteria: all K and L with evidence; approved nonblocking conditions have owner/deadline.
- Required tests: J plus [quality gates](../engineering/definition-of-done.md); Phase 0 evidence/document review and explicit N/A application commands.

## I. Security Requirements

Current authentication required online; expired/revoked session cannot commit. Authorize every operation, relation, export/file grant server-side. Derive tenant from verified membership/grant, never client actor/role/ownership claim. Validate schema/units/money/dates/parents server-side.

Minimize contacts/GPS/finance/media, use private short-lived scoped file grants, redact secrets/content from logs. Audit sensitive writes, grants, corrections/exports with actor/time/scope/request/command. Source “Farm Profit” must be labeled gross margin/recorded surplus until approved net-income treatment; overhead cannot silently disappear.

## J. Testing Strategy

Unit: H golden examples and domain validation. Integration: isolated real PostgreSQL constraints/rollback, scoped repositories and provider contracts. E2E: permitted journey, mobile/keyboard, empty/loading/error/reconnect. Security: two tenants, guessed IDs, forged scope/parent, revocation/expired session, search/export/media. Failures: DB/provider timeout, invalid payload, version conflict, duplicate/concurrent command, partial media. Regression: cumulative gates, financial/stock reconstruction and farmer offline. H specifies unique phase edge cases.

Run npm run lint, npm run typecheck, npm test, npm run build plus applicable integration/E2E/security/migration suites; concurrency tests exercise actual DB constraints.

## K. Acceptance Criteria

- **MYF-P08-AC001**: 8,400,000−5,150,000=3,250,000 UGX; margin rounded to 38.7%; enterprise totals match. Verification: Source dashboard fixture, filters/ties/empty/corrections.
- **MYF-P08-AC002**: Each metric has numerator/denominator/unit/currency/missing outcome; unknown valuation is unavailable. Verification: Golden metrics, zero area/yield/revenue, mixed units/currencies and missing flock denominator.
- **MYF-P08-AC003**: Feed 100,000→118,000 gives +18%; absent/zero baseline unavailable. Verification: Variance and incomparable-cycle fixtures.
- **MYF-P08-AC004**: All 0–8 gates evidenced; source farmer journey passes; future functionality absent. Verification: Full regression with offline financial/harvest command replay.

## L. Phase Exit Gate

Metrics reconcile and complete farmer workflow works offline/reconnect; no AI, marketplace, payments or lending in MVP. All K criteria have evidence, cumulative prerequisites hold, blocking security/integrity defects absent, required command results logged. PASS WITH CONDITIONS cannot waive failing mandatory tests; every nonblocking condition has owner/deadline. Later source-silent gates are proposed and need approval before execution.

## M. Risks and Limitations

Technical: concurrency, browser/provider compatibility and unbounded queries. Operational: support/training, shared-device privacy and recovery ownership. Integrity: wrong scope/unit/currency, missing history, duplicated retries, misunderstood metrics. Specific unknowns: Q09/Q12 basis/valuation; Q17 denominators/allocation/missing values/freshness. Deferred: later phases and unapproved provider capabilities; schemas/policies remain proposals.

## N. Deliverables

Reviewed phase module/mobile UI, approved/rehearsed migrations where needed, API/adapter contracts, tests/quality/security evidence, recovery notes and closeout report.

## O. Completion Checklist

- [ ] MYF-P08-T001 complete with evidence.
- [ ] MYF-P08-T002 complete with evidence.
- [ ] MYF-P08-T003 complete with evidence.
- [ ] MYF-P08-T004 complete with evidence.
- [ ] MYF-P08-T005 complete with evidence.
- [ ] MYF-P08-T006 complete with evidence.
- [ ] MYF-P08-T007 complete with evidence.
- [ ] MYF-P08-T008 complete with evidence.
- [ ] MYF-P08-T009 complete with evidence.
- [ ] MYF-P08-T010 complete with evidence.
- [ ] MYF-P08-T011 complete with evidence.
- [ ] MYF-P08-T012 complete with evidence.
- [ ] MYF-P08-T013 complete with evidence.
- [ ] Every K criterion verified.
- [ ] Security/integrity audit, remediation and retest complete.
- [ ] Applicable quality/E2E/integration/migration evidence recorded.
- [ ] L gate approved; closeout/status updated from evidence.
