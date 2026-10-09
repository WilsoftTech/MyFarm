# Phase 24 Production Hardening and Scale

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase02 closeout status/link review; content unchanged; no completion inferred from review.
- Implementation status: NOT STARTED — 0% (0/13 verified tasks).
- Last reviewed: 2026-10-09 (Africa/Nairobi), Phase02 implementation and closeout session.
- Related phase/task IDs: Phase 24; MYF-P24-T001 through MYF-P24-T013; review session Phase01; Phase02 review session (MYF-P02-T001–T013).
- Verified completed work: No tasks implemented or verified in this phase; status/provider applicability reviewed only.
- Remaining work/blockers: All 13 tasks and their acceptance/exit gates pending; Phase01 completion and future phase authorization required.
- Evidence/report links: [Phase02 closeout](../reports/phase-02-closeout-2026-10-09.md); [Phase02 every-document review](../reports/phase-02-document-review-2026-10-09.md); [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](../reports/phase-01-provider-verification-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Status: **NOT STARTED**. Date: 2026-10-08. This is a specification, not implementation approval. Related: [architecture](../architecture/system-architecture.md), [security](../architecture/security-architecture.md), [testing](../architecture/testing-strategy.md), [decisions](../DECISION-LOG.md), [traceability](../REQUIREMENTS-TRACEABILITY.md).

## A. Phase Overview

Purpose/business problem: Prove security/recovery/financial integrity/performance before scale.

Target users: All users; operations/security reviewers. Expected outcomes: K's observable criteria. Classification: Post-MVP.

## B. Source Requirements

Source: P0993–P1027 in [complete extract](../reports/source-extract.md). Examples are illustrative. Exclusions: later phase features and any application implementation during this assignment. Earlier phases require baseline security/backups; Phase 24 hardens/validates scale. No extra infrastructure without need.

Ambiguities: Q34 SLO/RPO/RTO/load/budgets/on-call/recovery/security-review depth. Resolve affected policy before dependent tasks; do not invent rules.

| Requirement | Source | Capability |
|---|---|---|
| MYF-P24-R001 | P0995–P1005 | RBAC, IDOR, isolation, rate limits, validation, audits, encryption, secrets, sessions and backup strategy. |
| MYF-P24-R002 | P1006–P1014 | Backups/restores/retries/idempotency/observability/health/queue/offline conflict reliability. |
| MYF-P24-R003 | P1015–P1020 | Immutable ledgers/reconciliation/no duplicate payments/transactional writes/audits. |
| MYF-P24-R004 | P1021–P1027 | Indexes/slow queries/cache/pagination/pooling/load tests. |

## C. Dependencies

Prerequisite phases: Phase 23 exit gate plus cumulative earlier gates.

Database inputs: earlier owned registry/production/transaction entities actually needed plus F proposals. Phase 0 is evidence documents only. Services: RunRestoreDrill, ReconcileFinancialHistory, MonitorSLO, ExecuteRetryableJob, InspectTenantIsolation. Infrastructure: authenticated Next.js, isolated PostgreSQL/Supabase, private object storage; Dexie/PWA sync from Phase 7.

Integrations: approved auth/persistence/provider adapters; use fakes before reviewed provider contracts. [Cross-phase matrix](../MASTER-IMPLEMENTATION-ROADMAP.md) records forward extension points. Stable IDs, tenant context and version fields precede sync/institutional features. No new infrastructure without measured need.

## D. Functional Requirements

### MYF-P24-R001

User story: as an authorized user named in A, I need this capability: RBAC, IDOR, isolation, rate limits, validation, audits, encryption, secrets, sessions and backup strategy. Business rules, validation and interaction: Adversarial tenant suite and session/secret controls pass; provider encryption verified.

### MYF-P24-R002

User story: as an authorized user named in A, I need this capability: Backups/restores/retries/idempotency/observability/health/queue/offline conflict reliability. Business rules, validation and interaction: Restore meets approved RPO/RTO; failed jobs visible with retries or escalation.

### MYF-P24-R003

User story: as an authorized user named in A, I need this capability: Immutable ledgers/reconciliation/no duplicate payments/transactional writes/audits. Business rules, validation and interaction: Settlements reconcile or exceptions assigned; posted history cannot mutate.

### MYF-P24-R004

User story: as an authorized user named in A, I need this capability: Indexes/slow queries/cache/pagination/pooling/load tests. Business rules, validation and interaction: Peak traffic meets approved latency/errors without cache leaks/unbounded reads.

Permissions: active farm membership or explicit organization/assignment/share grant; read/write/export separate; corrections and settlement require approved reviewer role. Admin has no automatic farm-data access.

## E. Technical Architecture

Proposed module: src/modules/production-hardening/ with contracts/, domain/, application/, infrastructure/. src/app/api/v1/ route handlers authenticate/validate then call services. Clients collect input/display; server owns authorization, authoritative computation and commits.

Services: RunRestoreDrill, ReconcileFinancialHistory, MonitorSLO, ExecuteRetryableJob, InspectTenantIsolation. Flow: intent → schema → current authorization → domain rules → transaction/repository → audit/receipt → scoped DTO. Projections rebuild from source histories. External network calls stay outside DB transactions.

Offline: see [sync](../architecture/offline-sync-architecture.md); Phases 1–6 prepare commands/IDs, full behavior Phase 7. Offline records remain pending until server acknowledgement. Provider/partner verification cannot be claimed offline. Operator cache shows as-of or explicitly requires network.

## F. Database Design

**Proposal until implementation approval. No migrations created now.**

OperationalRun(id UUID,kind enum,environment text,startedAt timestamp,evidenceRef text,verdict enum); ReconciliationException(id UUID,tenantId UUID,source text,reference text,severity enum,status enum); JobExecution(id UUID,jobKey text unique,state enum,attempts integer,lastErrorCode text?); reuse AuditEvent/ledger.

Shared tenant-owned fields: id UUID, tenantId UUID, relevant farmId UUID, createdAt/updatedAt timestamptz, version integer >=1, createdBy UUID. Global catalogs, append histories and research evidence declare distinct ownership. Quantity uses numeric(18,6) plus unit; money numeric(20,4) plus currency pending precision approval. JSON evidence/contracts versioned and validated.

Relationships/constraints: enforce parent/child tenant/farm consistency through composite keys/FKs where applicable plus server policy; unique membership/occurrence/command/provider keys; restrict history deletion. Corrections append reasoned records; balance projections are never authority.

Indexes: tenantId/farmId/date/id for scoped lists, tenantId/parentId for joins, unique receipt/event keys, status/due for actual calendar/queue queries. Global catalog/research uses lookup key rather than fictitious farm scope.

Migration: approve cardinalities/questions; additive fields/backfills with row-count/orphan checks; rehearse isolated migration/restore; preserve API/IndexedDB compatibility. Later activity/provider/billing relations arrive only in their phase.

## G. UI/UX Requirements

Pages/dashboards/forms/navigation: Restricted operations/incident/reconciliation console; recovery/error UX. Show current farm/organization scope. Mobile: one-column input, large touch targets, readable money/units, optional-field disclosure. Consequential review shows amount/unit/date/scope.

Loading announced; recoverable errors retain input and safe retry. Empty states distinguish no data, denial and provider failure and offer permitted next action. Verify keyboard, labels, focus and screen-reader statuses. Offline shows cached vs pending vs confirmed records; never silently change scope.

## H. Implementation Tasks

Execute these small stages sequentially after authorization. Field/model/provider policies remain proposals until affected decisions are resolved. Each capability separates contract/domain work, authorized service/evidence work, and user-visible acceptance. All task IDs remain pending.

### MYF-P24-T001 — Specify and implement domain contract for MYF-P24-R001

- Description: For MYF-P24-R001, define validated DTO/value objects and deterministic rules for: RBAC, IDOR, isolation, rate limits, validation, audits, encryption, secrets, sessions and backup strategy. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: phase prerequisites and affected open Q/ADR decisions.
- Files/modules: src/modules/production-hardening/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Adversarial tenant suite and session/secret controls pass; provider encryption verified. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P24-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: IDOR/rate abuse/log redaction/key rotation/session revoke. Check unit/currency/date/scope types and constraints.

### MYF-P24-T002 — Implement authorized application service for MYF-P24-R001

- Description: Implement the scoped service/repository/adapter for MYF-P24-R001; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P24-T001.
- Files/modules: src/modules/production-hardening/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/production-hardening/integration/.
- Expected behavior: Adversarial tenant suite and session/secret controls pass; provider encryption verified. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P24-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: IDOR/rate abuse/log redaction/key rotation/session revoke.

### MYF-P24-T003 — Connect UI and verify acceptance for MYF-P24-R001

- Description: Connect the existing service contract to the phase G form/view for MYF-P24-R001; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P24-T002.
- Files/modules: src/app/ phase pages; src/modules/production-hardening/ UI components; tests/production-hardening/component/ and E2E/.
- Expected behavior: Adversarial tenant suite and session/secret controls pass; provider encryption verified.
- Acceptance criteria: MYF-P24-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: IDOR/rate abuse/log redaction/key rotation/session revoke.

### MYF-P24-T004 — Specify and implement domain contract for MYF-P24-R002

- Description: For MYF-P24-R002, define validated DTO/value objects and deterministic rules for: Backups/restores/retries/idempotency/observability/health/queue/offline conflict reliability. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P24-T003.
- Files/modules: src/modules/production-hardening/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Restore meets approved RPO/RTO; failed jobs visible with retries or escalation. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P24-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Restore drill, queue crash/dead-letter, outage and offline chaos. Check unit/currency/date/scope types and constraints.

### MYF-P24-T005 — Implement authorized application service for MYF-P24-R002

- Description: Implement the scoped service/repository/adapter for MYF-P24-R002; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P24-T004.
- Files/modules: src/modules/production-hardening/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/production-hardening/integration/.
- Expected behavior: Restore meets approved RPO/RTO; failed jobs visible with retries or escalation. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P24-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Restore drill, queue crash/dead-letter, outage and offline chaos.

### MYF-P24-T006 — Connect UI and verify acceptance for MYF-P24-R002

- Description: Connect the existing service contract to the phase G form/view for MYF-P24-R002; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P24-T005.
- Files/modules: src/app/ phase pages; src/modules/production-hardening/ UI components; tests/production-hardening/component/ and E2E/.
- Expected behavior: Restore meets approved RPO/RTO; failed jobs visible with retries or escalation.
- Acceptance criteria: MYF-P24-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Restore drill, queue crash/dead-letter, outage and offline chaos.

### MYF-P24-T007 — Specify and implement domain contract for MYF-P24-R003

- Description: For MYF-P24-R003, define validated DTO/value objects and deterministic rules for: Immutable ledgers/reconciliation/no duplicate payments/transactional writes/audits. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P24-T006.
- Files/modules: src/modules/production-hardening/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Settlements reconcile or exceptions assigned; posted history cannot mutate. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P24-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Financial rebuild/webhook replay/rollback/audit atomicity. Check unit/currency/date/scope types and constraints.

### MYF-P24-T008 — Implement authorized application service for MYF-P24-R003

- Description: Implement the scoped service/repository/adapter for MYF-P24-R003; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P24-T007.
- Files/modules: src/modules/production-hardening/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/production-hardening/integration/.
- Expected behavior: Settlements reconcile or exceptions assigned; posted history cannot mutate. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P24-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Financial rebuild/webhook replay/rollback/audit atomicity.

### MYF-P24-T009 — Connect UI and verify acceptance for MYF-P24-R003

- Description: Connect the existing service contract to the phase G form/view for MYF-P24-R003; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P24-T008.
- Files/modules: src/app/ phase pages; src/modules/production-hardening/ UI components; tests/production-hardening/component/ and E2E/.
- Expected behavior: Settlements reconcile or exceptions assigned; posted history cannot mutate.
- Acceptance criteria: MYF-P24-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Financial rebuild/webhook replay/rollback/audit atomicity.

### MYF-P24-T010 — Specify and implement domain contract for MYF-P24-R004

- Description: For MYF-P24-R004, define validated DTO/value objects and deterministic rules for: Indexes/slow queries/cache/pagination/pooling/load tests. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P24-T009.
- Files/modules: src/modules/production-hardening/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Peak traffic meets approved latency/errors without cache leaks/unbounded reads. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P24-AC004 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Tenant-skew load, query plans, cursor boundaries, connection exhaustion. Check unit/currency/date/scope types and constraints.

### MYF-P24-T011 — Implement authorized application service for MYF-P24-R004

- Description: Implement the scoped service/repository/adapter for MYF-P24-R004; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P24-T010.
- Files/modules: src/modules/production-hardening/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/production-hardening/integration/.
- Expected behavior: Peak traffic meets approved latency/errors without cache leaks/unbounded reads. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P24-AC004 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Tenant-skew load, query plans, cursor boundaries, connection exhaustion.

### MYF-P24-T012 — Connect UI and verify acceptance for MYF-P24-R004

- Description: Connect the existing service contract to the phase G form/view for MYF-P24-R004; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P24-T011.
- Files/modules: src/app/ phase pages; src/modules/production-hardening/ UI components; tests/production-hardening/component/ and E2E/.
- Expected behavior: Peak traffic meets approved latency/errors without cache leaks/unbounded reads.
- Acceptance criteria: MYF-P24-AC004 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Tenant-skew load, query plans, cursor boundaries, connection exhaustion.

### MYF-P24-T013 — Audit and close phase

- Description: execute all applicable checks; audit implemented scope/AC/security/integrity, remediate findings, retest and issue evidence-backed verdict.
- Dependencies: MYF-P24-T001 through MYF-P24-T012.
- Files/modules: phase module/tests, docs/reports/ and docs/PROJECT-STATUS.md; [closeout template](../engineering/phase-closeout-template.md).
- Expected behavior: no blocker or failed mandatory gate closes the phase.
- Acceptance criteria: all K and L with evidence; approved nonblocking conditions have owner/deadline.
- Required tests: J plus [quality gates](../engineering/definition-of-done.md); Phase 0 evidence/document review and explicit N/A application commands.

## I. Security Requirements

Current authentication required online; expired/revoked session cannot commit. Authorize every operation, relation, export/file grant server-side. Derive tenant from verified membership/grant, never client actor/role/ownership claim. Validate schema/units/money/dates/parents server-side.

Minimize contacts/GPS/finance/media, use private short-lived scoped file grants, redact secrets/content from logs. Audit sensitive writes, grants, corrections/exports with actor/time/scope/request/command. Earlier phases require baseline security/backups; Phase 24 hardens/validates scale. No extra infrastructure without need.

## J. Testing Strategy

Unit: H golden examples and domain validation. Integration: isolated real PostgreSQL constraints/rollback, scoped repositories and provider contracts. E2E: permitted journey, mobile/keyboard, empty/loading/error/reconnect. Security: two tenants, guessed IDs, forged scope/parent, revocation/expired session, search/export/media. Failures: DB/provider timeout, invalid payload, version conflict, duplicate/concurrent command, partial media. Regression: cumulative gates, financial/stock reconstruction and farmer offline. H specifies unique phase edge cases.

Run npm run lint, npm run typecheck, npm test, npm run build plus applicable integration/E2E/security/migration suites; concurrency tests exercise actual DB constraints.

## K. Acceptance Criteria

- **MYF-P24-AC001**: Adversarial tenant suite and session/secret controls pass; provider encryption verified. Verification: IDOR/rate abuse/log redaction/key rotation/session revoke.
- **MYF-P24-AC002**: Restore meets approved RPO/RTO; failed jobs visible with retries or escalation. Verification: Restore drill, queue crash/dead-letter, outage and offline chaos.
- **MYF-P24-AC003**: Settlements reconcile or exceptions assigned; posted history cannot mutate. Verification: Financial rebuild/webhook replay/rollback/audit atomicity.
- **MYF-P24-AC004**: Peak traffic meets approved latency/errors without cache leaks/unbounded reads. Verification: Tenant-skew load, query plans, cursor boundaries, connection exhaustion.

## L. Phase Exit Gate

Proposed explicit gate based on source hardening intent: All source controls demonstrated against approved measurable targets; blockers fixed/retested. All K criteria have evidence, cumulative prerequisites hold, blocking security/integrity defects absent, required command results logged. PASS WITH CONDITIONS cannot waive failing mandatory tests; every nonblocking condition has owner/deadline. Later source-silent gates are proposed and need approval before execution.

## M. Risks and Limitations

Technical: concurrency, browser/provider compatibility and unbounded queries. Operational: support/training, shared-device privacy and recovery ownership. Integrity: wrong scope/unit/currency, missing history, duplicated retries, misunderstood metrics. Specific unknowns: Q34 SLO/RPO/RTO/load/budgets/on-call/recovery/security-review depth. Deferred: later phases and unapproved provider capabilities; schemas/policies remain proposals.

## N. Deliverables

Reviewed phase module/mobile UI, approved/rehearsed migrations where needed, API/adapter contracts, tests/quality/security evidence, recovery notes and closeout report.

## O. Completion Checklist

- [ ] MYF-P24-T001 complete with evidence.
- [ ] MYF-P24-T002 complete with evidence.
- [ ] MYF-P24-T003 complete with evidence.
- [ ] MYF-P24-T004 complete with evidence.
- [ ] MYF-P24-T005 complete with evidence.
- [ ] MYF-P24-T006 complete with evidence.
- [ ] MYF-P24-T007 complete with evidence.
- [ ] MYF-P24-T008 complete with evidence.
- [ ] MYF-P24-T009 complete with evidence.
- [ ] MYF-P24-T010 complete with evidence.
- [ ] MYF-P24-T011 complete with evidence.
- [ ] MYF-P24-T012 complete with evidence.
- [ ] MYF-P24-T013 complete with evidence.
- [ ] Every K criterion verified.
- [ ] Security/integrity audit, remediation and retest complete.
- [ ] Applicable quality/E2E/integration/migration evidence recorded.
- [ ] L gate approved; closeout/status updated from evidence.
