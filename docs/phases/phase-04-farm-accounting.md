# Phase 04 Farm Accounting Engine

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase02 closeout status/link review; content unchanged; no completion inferred from review.
- Implementation status: NOT STARTED — 0% (0/16 verified tasks).
- Last reviewed: 2026-10-09 (Africa/Nairobi), Phase02 implementation and closeout session.
- Related phase/task IDs: Phase 04; MYF-P04-T001 through MYF-P04-T016; review session Phase01; Phase02 review session (MYF-P02-T001–T013).
- Verified completed work: No tasks implemented or verified in this phase; status/provider applicability reviewed only.
- Remaining work/blockers: All 16 tasks and their acceptance/exit gates pending; Phase01 completion and future phase authorization required.
- Evidence/report links: [Phase02 closeout](../reports/phase-02-closeout-2026-10-09.md); [Phase02 every-document review](../reports/phase-02-document-review-2026-10-09.md); [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](../reports/phase-01-provider-verification-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Status: **NOT STARTED**. Date: 2026-10-08. This is a specification, not implementation approval. Related: [architecture](../architecture/system-architecture.md), [security](../architecture/security-architecture.md), [testing](../architecture/testing-strategy.md), [decisions](../DECISION-LOG.md), [traceability](../REQUIREMENTS-TRACEABILITY.md).

## A. Phase Overview

Purpose/business problem: Create auditable financial records and deterministic farm/enterprise summaries.

Target users: Farmers, managers and authorized financial reviewers. Expected outcomes: K's observable criteria. Classification: MVP discovery/foundation.

## B. Source Requirements

Source: P0272–P0344 in [complete extract](../reports/source-extract.md). Examples are illustrative. Exclusions: later phase features and any application implementation during this assignment. Farm scope mandatory; optional analytical links. Activity FK arrives Phase 6. PaymentRecord records existing payment, not provider execution or wallet.

Ambiguities: Q09 cash/accrual/precision/tax; Q10 overhead/depreciation/finance timing; Q11 sales vs cash-income double counting. Resolve affected policy before dependent tasks; do not invent rules.

| Requirement | Source | Capability |
|---|---|---|
| MYF-P04-R001 | P0275–P0285 | Cover Expense, Income, Sale, Purchase, Receivable, Payable, Payment, TransactionCategory, PaymentMethod, Attachment. |
| MYF-P04-R002 | P0286–P0300 | Include seeds, feed, fertilizer, veterinary, labour, transport, fuel, equipment, rent, utilities, medication, pesticides and packaging categories. |
| MYF-P04-R003 | P0301–P0314 | Allow optional plot/enterprise/season/activity allocation, supplier/payment method; preserve 150,000 UGX maize fertilizer example. |
| MYF-P04-R004 | P0315–P0338 | Calculate revenue minus direct costs as gross margin deterministically; later deduct overhead/depreciation/finance for net income; AI only explains. |
| MYF-P04-R005 | P0339–P0344 | Show amount spent, spending categories, revenue earned and costliest enterprise. |

## C. Dependencies

Prerequisite phases: Phase 3 exit gate plus cumulative earlier gates.

Database inputs: earlier owned registry/production/transaction entities actually needed plus F proposals. Phase 0 is evidence documents only. Services: RecordFarmExpense, RecordFarmIncome, RecordSale, RecordPurchase, AllocatePayment, ReverseAccountingRecord, CalculateGrossMargin. Infrastructure: authenticated Next.js, isolated PostgreSQL/Supabase, private object storage; Dexie/PWA sync from Phase 7.

Integrations: approved auth/persistence/provider adapters; use fakes before reviewed provider contracts. [Cross-phase matrix](../MASTER-IMPLEMENTATION-ROADMAP.md) records forward extension points. Stable IDs, tenant context and version fields precede sync/institutional features. No new infrastructure without measured need.

## D. Functional Requirements

### MYF-P04-R001

User story: as an authorized user named in A, I need this capability: Cover Expense, Income, Sale, Purchase, Receivable, Payable, Payment, TransactionCategory, PaymentMethod, Attachment. Business rules, validation and interaction: One sale creates one revenue event; partial payment reduces obligation without recognizing revenue twice.

### MYF-P04-R002

User story: as an authorized user named in A, I need this capability: Include seeds, feed, fertilizer, veterinary, labour, transport, fuel, equipment, rent, utilities, medication, pesticides and packaging categories. Business rules, validation and interaction: All source categories available; archived categories remain readable in history.

### MYF-P04-R003

User story: as an authorized user named in A, I need this capability: Allow optional plot/enterprise/season/activity allocation, supplier/payment method; preserve 150,000 UGX maize fertilizer example. Business rules, validation and interaction: Exactly UGX 150,000 assigned to maize 2027A; wrong-farm links rejected.

### MYF-P04-R004

User story: as an authorized user named in A, I need this capability: Calculate revenue minus direct costs as gross margin deterministically; later deduct overhead/depreciation/finance for net income; AI only explains. Business rules, validation and interaction: 500,000 − 150,000 = 350,000 gross margin with no AI dependency.

### MYF-P04-R005

User story: as an authorized user named in A, I need this capability: Show amount spent, spending categories, revenue earned and costliest enterprise. Business rules, validation and interaction: Totals reconcile with basis/as-of labels; tied enterprises shown.

Permissions: active farm membership or explicit organization/assignment/share grant; read/write/export separate; corrections and settlement require approved reviewer role. Admin has no automatic farm-data access.

## E. Technical Architecture

Proposed module: src/modules/farm-accounting/ with contracts/, domain/, application/, infrastructure/. src/app/api/v1/ route handlers authenticate/validate then call services. Clients collect input/display; server owns authorization, authoritative computation and commits.

Services: RecordFarmExpense, RecordFarmIncome, RecordSale, RecordPurchase, AllocatePayment, ReverseAccountingRecord, CalculateGrossMargin. Flow: intent → schema → current authorization → domain rules → transaction/repository → audit/receipt → scoped DTO. Projections rebuild from source histories. External network calls stay outside DB transactions.

Offline: see [sync](../architecture/offline-sync-architecture.md); Phases 1–6 prepare commands/IDs, full behavior Phase 7. Offline records remain pending until server acknowledgement. Provider/partner verification cannot be claimed offline. Operator cache shows as-of or explicitly requires network.

## F. Database Design

**Proposal until implementation approval. No migrations created now.**

Expense/Income(id UUID,tenantId UUID,farmId UUID,plotId UUID?,enterpriseId UUID?,seasonId UUID?,activityId UUID?,amount numeric(20,4),currency char(3),occurredOn date,categoryId UUID,paymentMethodId UUID?,counterparty text,status enum); Sale/Purchase(id UUID,tenantId UUID,farmId UUID,total numeric,currency char(3),counterparty text); Receivable/Payable(id UUID,sourceId UUID,outstanding derived); PaymentRecord(id UUID,tenantId UUID,farmId UUID,amount numeric,currency char(3),methodId UUID,externalReference text?); PaymentAllocation(paymentId UUID,obligationId UUID,amount numeric); TransactionCategory(id UUID,tenantId UUID?,kind enum,name text); PaymentMethod(id UUID,code text); Attachment uses Document; AccountingCorrection(originalId UUID,replacementId UUID,reason text).

Shared tenant-owned fields: id UUID, tenantId UUID, relevant farmId UUID, createdAt/updatedAt timestamptz, version integer >=1, createdBy UUID. Global catalogs, append histories and research evidence declare distinct ownership. Quantity uses numeric(18,6) plus unit; money numeric(20,4) plus currency pending precision approval. JSON evidence/contracts versioned and validated.

Relationships/constraints: enforce parent/child tenant/farm consistency through composite keys/FKs where applicable plus server policy; unique membership/occurrence/command/provider keys; restrict history deletion. Corrections append reasoned records; balance projections are never authority.

Indexes: tenantId/farmId/date/id for scoped lists, tenantId/parentId for joins, unique receipt/event keys, status/due for actual calendar/queue queries. Global catalog/research uses lookup key rather than fictitious farm scope.

Migration: approve cardinalities/questions; additive fields/backfills with row-count/orphan checks; rehearse isolated migration/restore; preserve API/IndexedDB compatibility. Later activity/provider/billing relations arrive only in their phase.

## G. UI/UX Requirements

Pages/dashboards/forms/navigation: Expense/income entry, transaction/filter lists, obligations/payments and cost summary. Show current farm/organization scope. Mobile: one-column input, large touch targets, readable money/units, optional-field disclosure. Consequential review shows amount/unit/date/scope.

Loading announced; recoverable errors retain input and safe retry. Empty states distinguish no data, denial and provider failure and offer permitted next action. Verify keyboard, labels, focus and screen-reader statuses. Offline shows cached vs pending vs confirmed records; never silently change scope.

## H. Implementation Tasks

Execute these small stages sequentially after authorization. Field/model/provider policies remain proposals until affected decisions are resolved. Each capability separates contract/domain work, authorized service/evidence work, and user-visible acceptance. All task IDs remain pending.

### MYF-P04-T001 — Specify and implement domain contract for MYF-P04-R001

- Description: For MYF-P04-R001, define validated DTO/value objects and deterministic rules for: Cover Expense, Income, Sale, Purchase, Receivable, Payable, Payment, TransactionCategory, PaymentMethod, Attachment. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: phase prerequisites and affected open Q/ADR decisions.
- Files/modules: src/modules/farm-accounting/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: One sale creates one revenue event; partial payment reduces obligation without recognizing revenue twice. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P04-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Proposed accrual fixture: sale 200,000 and payment 80,000 leave 120,000 due; basis-dependent reporting blocked pending Q09. Check unit/currency/date/scope types and constraints.

### MYF-P04-T002 — Implement authorized application service for MYF-P04-R001

- Description: Implement the scoped service/repository/adapter for MYF-P04-R001; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P04-T001.
- Files/modules: src/modules/farm-accounting/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/farm-accounting/integration/.
- Expected behavior: One sale creates one revenue event; partial payment reduces obligation without recognizing revenue twice. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P04-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Proposed accrual fixture: sale 200,000 and payment 80,000 leave 120,000 due; basis-dependent reporting blocked pending Q09.

### MYF-P04-T003 — Connect UI and verify acceptance for MYF-P04-R001

- Description: Connect the existing service contract to the phase G form/view for MYF-P04-R001; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P04-T002.
- Files/modules: src/app/ phase pages; src/modules/farm-accounting/ UI components; tests/farm-accounting/component/ and E2E/.
- Expected behavior: One sale creates one revenue event; partial payment reduces obligation without recognizing revenue twice.
- Acceptance criteria: MYF-P04-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Proposed accrual fixture: sale 200,000 and payment 80,000 leave 120,000 due; basis-dependent reporting blocked pending Q09.

### MYF-P04-T004 — Specify and implement domain contract for MYF-P04-R002

- Description: For MYF-P04-R002, define validated DTO/value objects and deterministic rules for: Include seeds, feed, fertilizer, veterinary, labour, transport, fuel, equipment, rent, utilities, medication, pesticides and packaging categories. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P04-T003.
- Files/modules: src/modules/farm-accounting/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: All source categories available; archived categories remain readable in history. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P04-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Category ownership, archive and invalid-category tests. Check unit/currency/date/scope types and constraints.

### MYF-P04-T005 — Implement authorized application service for MYF-P04-R002

- Description: Implement the scoped service/repository/adapter for MYF-P04-R002; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P04-T004.
- Files/modules: src/modules/farm-accounting/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/farm-accounting/integration/.
- Expected behavior: All source categories available; archived categories remain readable in history. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P04-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Category ownership, archive and invalid-category tests.

### MYF-P04-T006 — Connect UI and verify acceptance for MYF-P04-R002

- Description: Connect the existing service contract to the phase G form/view for MYF-P04-R002; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P04-T005.
- Files/modules: src/app/ phase pages; src/modules/farm-accounting/ UI components; tests/farm-accounting/component/ and E2E/.
- Expected behavior: All source categories available; archived categories remain readable in history.
- Acceptance criteria: MYF-P04-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Category ownership, archive and invalid-category tests.

### MYF-P04-T007 — Specify and implement domain contract for MYF-P04-R003

- Description: For MYF-P04-R003, define validated DTO/value objects and deterministic rules for: Allow optional plot/enterprise/season/activity allocation, supplier/payment method; preserve 150,000 UGX maize fertilizer example. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P04-T006.
- Files/modules: src/modules/farm-accounting/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Exactly UGX 150,000 assigned to maize 2027A; wrong-farm links rejected. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P04-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Exact decimal round trip, duplicate command and scope mismatch tests. Check unit/currency/date/scope types and constraints.

### MYF-P04-T008 — Implement authorized application service for MYF-P04-R003

- Description: Implement the scoped service/repository/adapter for MYF-P04-R003; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P04-T007.
- Files/modules: src/modules/farm-accounting/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/farm-accounting/integration/.
- Expected behavior: Exactly UGX 150,000 assigned to maize 2027A; wrong-farm links rejected. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P04-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Exact decimal round trip, duplicate command and scope mismatch tests.

### MYF-P04-T009 — Connect UI and verify acceptance for MYF-P04-R003

- Description: Connect the existing service contract to the phase G form/view for MYF-P04-R003; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P04-T008.
- Files/modules: src/app/ phase pages; src/modules/farm-accounting/ UI components; tests/farm-accounting/component/ and E2E/.
- Expected behavior: Exactly UGX 150,000 assigned to maize 2027A; wrong-farm links rejected.
- Acceptance criteria: MYF-P04-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Exact decimal round trip, duplicate command and scope mismatch tests.

### MYF-P04-T010 — Specify and implement domain contract for MYF-P04-R004

- Description: For MYF-P04-R004, define validated DTO/value objects and deterministic rules for: Calculate revenue minus direct costs as gross margin deterministically; later deduct overhead/depreciation/finance for net income; AI only explains. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P04-T009.
- Files/modules: src/modules/farm-accounting/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: 500,000 − 150,000 = 350,000 gross margin with no AI dependency. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P04-AC004 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Reversal, duplicate prevention, currency separation and recomputation. Check unit/currency/date/scope types and constraints.

### MYF-P04-T011 — Implement authorized application service for MYF-P04-R004

- Description: Implement the scoped service/repository/adapter for MYF-P04-R004; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P04-T010.
- Files/modules: src/modules/farm-accounting/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/farm-accounting/integration/.
- Expected behavior: 500,000 − 150,000 = 350,000 gross margin with no AI dependency. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P04-AC004 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Reversal, duplicate prevention, currency separation and recomputation.

### MYF-P04-T012 — Connect UI and verify acceptance for MYF-P04-R004

- Description: Connect the existing service contract to the phase G form/view for MYF-P04-R004; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P04-T011.
- Files/modules: src/app/ phase pages; src/modules/farm-accounting/ UI components; tests/farm-accounting/component/ and E2E/.
- Expected behavior: 500,000 − 150,000 = 350,000 gross margin with no AI dependency.
- Acceptance criteria: MYF-P04-AC004 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Reversal, duplicate prevention, currency separation and recomputation.

### MYF-P04-T013 — Specify and implement domain contract for MYF-P04-R005

- Description: For MYF-P04-R005, define validated DTO/value objects and deterministic rules for: Show amount spent, spending categories, revenue earned and costliest enterprise. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P04-T012.
- Files/modules: src/modules/farm-accounting/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Totals reconcile with basis/as-of labels; tied enterprises shown. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P04-AC005 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Empty, date filter, ties, unauthorized export and correction refresh. Check unit/currency/date/scope types and constraints.

### MYF-P04-T014 — Implement authorized application service for MYF-P04-R005

- Description: Implement the scoped service/repository/adapter for MYF-P04-R005; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P04-T013.
- Files/modules: src/modules/farm-accounting/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/farm-accounting/integration/.
- Expected behavior: Totals reconcile with basis/as-of labels; tied enterprises shown. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P04-AC005 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Empty, date filter, ties, unauthorized export and correction refresh.

### MYF-P04-T015 — Connect UI and verify acceptance for MYF-P04-R005

- Description: Connect the existing service contract to the phase G form/view for MYF-P04-R005; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P04-T014.
- Files/modules: src/app/ phase pages; src/modules/farm-accounting/ UI components; tests/farm-accounting/component/ and E2E/.
- Expected behavior: Totals reconcile with basis/as-of labels; tied enterprises shown.
- Acceptance criteria: MYF-P04-AC005 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Empty, date filter, ties, unauthorized export and correction refresh.

### MYF-P04-T016 — Audit and close phase

- Description: execute all applicable checks; audit implemented scope/AC/security/integrity, remediate findings, retest and issue evidence-backed verdict.
- Dependencies: MYF-P04-T001 through MYF-P04-T015.
- Files/modules: phase module/tests, docs/reports/ and docs/PROJECT-STATUS.md; [closeout template](../engineering/phase-closeout-template.md).
- Expected behavior: no blocker or failed mandatory gate closes the phase.
- Acceptance criteria: all K and L with evidence; approved nonblocking conditions have owner/deadline.
- Required tests: J plus [quality gates](../engineering/definition-of-done.md); Phase 0 evidence/document review and explicit N/A application commands.

## I. Security Requirements

Current authentication required online; expired/revoked session cannot commit. Authorize every operation, relation, export/file grant server-side. Derive tenant from verified membership/grant, never client actor/role/ownership claim. Validate schema/units/money/dates/parents server-side.

Minimize contacts/GPS/finance/media, use private short-lived scoped file grants, redact secrets/content from logs. Audit sensitive writes, grants, corrections/exports with actor/time/scope/request/command. Farm scope mandatory; optional analytical links. Activity FK arrives Phase 6. PaymentRecord records existing payment, not provider execution or wallet.

## J. Testing Strategy

Unit: H golden examples and domain validation. Integration: isolated real PostgreSQL constraints/rollback, scoped repositories and provider contracts. E2E: permitted journey, mobile/keyboard, empty/loading/error/reconnect. Security: two tenants, guessed IDs, forged scope/parent, revocation/expired session, search/export/media. Failures: DB/provider timeout, invalid payload, version conflict, duplicate/concurrent command, partial media. Regression: cumulative gates, financial/stock reconstruction and farmer offline. H specifies unique phase edge cases.

Run npm run lint, npm run typecheck, npm test, npm run build plus applicable integration/E2E/security/migration suites; concurrency tests exercise actual DB constraints.

## K. Acceptance Criteria

- **MYF-P04-AC001**: One sale creates one revenue event; partial payment reduces obligation without recognizing revenue twice. Verification: Proposed accrual fixture: sale 200,000 and payment 80,000 leave 120,000 due; basis-dependent reporting blocked pending Q09.
- **MYF-P04-AC002**: All source categories available; archived categories remain readable in history. Verification: Category ownership, archive and invalid-category tests.
- **MYF-P04-AC003**: Exactly UGX 150,000 assigned to maize 2027A; wrong-farm links rejected. Verification: Exact decimal round trip, duplicate command and scope mismatch tests.
- **MYF-P04-AC004**: 500,000 − 150,000 = 350,000 gross margin with no AI dependency. Verification: Reversal, duplicate prevention, currency separation and recomputation.
- **MYF-P04-AC005**: Totals reconcile with basis/as-of labels; tied enterprises shown. Verification: Empty, date filter, ties, unauthorized export and correction refresh.

## L. Phase Exit Gate

Answer spending, categories, revenue and highest-cost enterprise with exact arithmetic and authorized histories. All K criteria have evidence, cumulative prerequisites hold, blocking security/integrity defects absent, required command results logged. PASS WITH CONDITIONS cannot waive failing mandatory tests; every nonblocking condition has owner/deadline. Later source-silent gates are proposed and need approval before execution.

## M. Risks and Limitations

Technical: concurrency, browser/provider compatibility and unbounded queries. Operational: support/training, shared-device privacy and recovery ownership. Integrity: wrong scope/unit/currency, missing history, duplicated retries, misunderstood metrics. Specific unknowns: Q09 cash/accrual/precision/tax; Q10 overhead/depreciation/finance timing; Q11 sales vs cash-income double counting. Deferred: later phases and unapproved provider capabilities; schemas/policies remain proposals.

## N. Deliverables

Reviewed phase module/mobile UI, approved/rehearsed migrations where needed, API/adapter contracts, tests/quality/security evidence, recovery notes and closeout report.

## O. Completion Checklist

- [ ] MYF-P04-T001 complete with evidence.
- [ ] MYF-P04-T002 complete with evidence.
- [ ] MYF-P04-T003 complete with evidence.
- [ ] MYF-P04-T004 complete with evidence.
- [ ] MYF-P04-T005 complete with evidence.
- [ ] MYF-P04-T006 complete with evidence.
- [ ] MYF-P04-T007 complete with evidence.
- [ ] MYF-P04-T008 complete with evidence.
- [ ] MYF-P04-T009 complete with evidence.
- [ ] MYF-P04-T010 complete with evidence.
- [ ] MYF-P04-T011 complete with evidence.
- [ ] MYF-P04-T012 complete with evidence.
- [ ] MYF-P04-T013 complete with evidence.
- [ ] MYF-P04-T014 complete with evidence.
- [ ] MYF-P04-T015 complete with evidence.
- [ ] MYF-P04-T016 complete with evidence.
- [ ] Every K criterion verified.
- [ ] Security/integrity audit, remediation and retest complete.
- [ ] Applicable quality/E2E/integration/migration evidence recorded.
- [ ] L gate approved; closeout/status updated from evidence.
