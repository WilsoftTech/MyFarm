# Phase 05 Harvest Production and Inventory

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED - T001 requirements, dependencies and affected architecture/contracts.
- Implementation status: PARTIALLY COMPLETE - 69.23% (9/13 verified tasks).
- Last reviewed: 2026-10-29 (Africa/Nairobi).
- Related phase/task IDs: MYF-P05-T001 through MYF-P05-T013; D-P05-001; Q12/Q13.
- Verified completed work: T001 harvest domain/DTO/repository contract verified; 56 focused and 742 cumulative unit/component tests pass. Full AC001 pending.
- Remaining work/blockers: T002 authorized persistence next; T003 UI and all later tasks pending. Q12/Q13 scope approved under D-P05-002/003; no schema applied.
- Evidence/report links: [T001 evidence](../reports/phase-05-t001-2026-10-29.md); [Start plan](../reports/phase-05-start-2026-10-29.md); [Phase 4 closeout](../reports/phase-04-closeout-2026-10-26.md).
<!-- MYFARM-STATUS-END -->

Status: **PARTIALLY COMPLETE - 69.23% (9/13 verified tasks)**. Date: 2026-10-29. Local start authorized by D-P05-001; Q12/Q13 scope approved under D-P05-002/003. T001 verified; T002 is next. Related: [architecture](../architecture/system-architecture.md), [security](../architecture/security-architecture.md), [testing](../architecture/testing-strategy.md), [decisions](../DECISION-LOG.md), [traceability](../REQUIREMENTS-TRACEABILITY.md).

## A. Phase Overview

Purpose/business problem: Connect harvest/flock records with reconstructable stock movements.

Target users: Farmers/managers/stock operators. Expected outcomes: K's observable criteria. Classification: MVP discovery/foundation.

## B. Source Requirements

Source: P0346–P0392 in [complete extract](../reports/source-extract.md). Examples are illustrative. Exclusions: later phase features and any application implementation during this assignment. Source 2,400/1,600/650/150 reconciliation and 2,400/1,000/200/50 ledger are different examples. Never merge them.

Ambiguities: Q12 conversions/negative stock/valuation; Q13 flock-vs-stock overlap and sale posting. D-P05-002/003 approve initial units, no negative stock, storage/losses and single sale effects. Valuation remains deferred; dependent correction/linking contracts still require specification.

| Requirement | Source | Capability |
|---|---|---|
| MYF-P05-R001 | P0348–P0363 | Record harvest date/crop/plot/quantity/unit/grade/storage/losses. |
| MYF-P05-R002 | P0364–P0373 | Track opening birds, purchases, mortality, eggs, bird sales, feed, medication and closing flock. |
| MYF-P05-R003 | P0374–P0390 | Use InventoryItem, StockMovement, StorageLocation, StockAdjustment and append-only ledger. |
| MYF-P05-R004 | P0391–P0392 | Reconstruct every stock balance from history. |

## C. Dependencies

Prerequisite phases: Phase 4 exit gate plus cumulative earlier gates.

Database inputs: earlier owned registry/production/transaction entities actually needed plus F proposals. Phase 0 is evidence documents only. Services: RecordHarvest, RecordProductionEvent, PostStockMovement, TransferInventory, AdjustStock, ReconstructBalance. Infrastructure: authenticated Next.js, isolated PostgreSQL/Supabase, private object storage; Dexie/PWA sync from Phase 7.

Integrations: approved auth/persistence/provider adapters; use fakes before reviewed provider contracts. [Cross-phase matrix](../MASTER-IMPLEMENTATION-ROADMAP.md) records forward extension points. Stable IDs, tenant context and version fields precede sync/institutional features. No new infrastructure without measured need.

## D. Functional Requirements

### MYF-P05-R001

User story: as an authorized user named in A, I need this capability: Record harvest date/crop/plot/quantity/unit/grade/storage/losses. Business rules, validation and interaction: 2,400 kg − 1,600 sold − 150 losses = 650 stored.

### MYF-P05-R002

User story: as an authorized user named in A, I need this capability: Track opening birds, purchases, mortality, eggs, bird sales, feed, medication and closing flock. Business rules, validation and interaction: 100 opening +20 purchased −5 deaths −10 sold =105 birds; eggs/feed do not affect flock count.

### MYF-P05-R003

User story: as an authorized user named in A, I need this capability: Use InventoryItem, StockMovement, StorageLocation, StockAdjustment and append-only ledger. Business rules, validation and interaction: 2,400−1,000−200−50=1,150 kg; transfer paired movements conserve stock.

### MYF-P05-R004

User story: as an authorized user named in A, I need this capability: Reconstruct every stock balance from history. Business rules, validation and interaction: Rebuilt projection equals display for all fixture item/location pairs.

Permissions: active farm membership or explicit organization/assignment/share grant; read/write/export separate; corrections and settlement require approved reviewer role. Admin has no automatic farm-data access.

## E. Technical Architecture

Proposed module: src/modules/harvest-inventory/ with contracts/, domain/, application/, infrastructure/. src/app/api/v1/ route handlers authenticate/validate then call services. Clients collect input/display; server owns authorization, authoritative computation and commits.

Services: RecordHarvest, RecordProductionEvent, PostStockMovement, TransferInventory, AdjustStock, ReconstructBalance. Flow: intent → schema → current authorization → domain rules → transaction/repository → audit/receipt → scoped DTO. Projections rebuild from source histories. External network calls stay outside DB transactions.

Offline: see [sync](../architecture/offline-sync-architecture.md); Phases 1–6 prepare commands/IDs, full behavior Phase 7. Offline records remain pending until server acknowledgement. Provider/partner verification cannot be claimed offline. Operator cache shows as-of or explicitly requires network.

## F. Database Design

**Proposal until implementation approval. No migrations created now.**

Harvest(id UUID,tenantId UUID,farmId UUID,cropCycleId UUID,plotId UUID,harvestDate date,quantity numeric(18,6),unit text,grade text?,storageLocationId UUID); ProductionEvent(id UUID,tenantId UUID,batchId UUID,type enum,quantity numeric,unit text,occurredOn date); InventoryItem(id UUID,tenantId UUID,farmId UUID,name text,baseUnit text,kind enum); StockMovement(id UUID,tenantId UUID,farmId UUID,itemId UUID,locationId UUID,quantityDelta numeric,reason enum,sourceId UUID?,transferId UUID?,occurredAt timestamptz); StorageLocation(id UUID,tenantId UUID,farmId UUID,name text); StockAdjustment(id UUID,movementId UUID,reason text,approvedBy UUID).

Shared tenant-owned fields: id UUID, tenantId UUID, relevant farmId UUID, createdAt/updatedAt timestamptz, version integer >=1, createdBy UUID. Global catalogs, append histories and research evidence declare distinct ownership. Quantity uses numeric(18,6) plus unit; money numeric(20,4) plus currency under D-P04-002; no monetary inventory valuation yet. JSON evidence/contracts versioned and validated.

Relationships/constraints: enforce parent/child tenant/farm consistency through composite keys/FKs where applicable plus server policy; unique membership/occurrence/command/provider keys; restrict history deletion. Corrections append reasoned records; balance projections are never authority.

Indexes: tenantId/farmId/date/id for scoped lists, tenantId/parentId for joins, unique receipt/event keys, status/due for actual calendar/queue queries. Global catalog/research uses lookup key rather than fictitious farm scope.

Migration: approve cardinalities/questions; additive fields/backfills with row-count/orphan checks; rehearse isolated migration/restore; preserve API/IndexedDB compatibility. Later activity/provider/billing relations arrive only in their phase.

## G. UI/UX Requirements

Pages/dashboards/forms/navigation: Harvest entry; poultry production/flock; stock balance/history; storage/adjustment views. Show current farm/organization scope. Mobile: one-column input, large touch targets, readable money/units, optional-field disclosure. Consequential review shows amount/unit/date/scope.

Loading announced; recoverable errors retain input and safe retry. Empty states distinguish no data, denial and provider failure and offer permitted next action. Verify keyboard, labels, focus and screen-reader statuses. Offline shows cached vs pending vs confirmed records; never silently change scope.

## H. Implementation Tasks

Execute these small stages sequentially after authorization. Field/model/provider policies remain proposals until affected decisions are resolved. Each capability separates contract/domain work, authorized service/evidence work, and user-visible acceptance. T001 is verified; T002-T013 remain pending.

### MYF-P05-T001 — Specify and implement domain contract for MYF-P05-R001

- Description: For MYF-P05-R001, define validated DTO/value objects and deterministic rules for: Record harvest date/crop/plot/quantity/unit/grade/storage/losses. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: phase prerequisites and affected open Q/ADR decisions.
- Files/modules: src/modules/harvest-inventory/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: 2,400 kg − 1,600 sold − 150 losses = 650 stored. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P05-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Source fixture, wrong plot and incompatible unit. Check unit/currency/date/scope types and constraints.

### MYF-P05-T002 — Implement authorized application service for MYF-P05-R001

- Description: Implement the scoped service/repository/adapter for MYF-P05-R001; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P05-T001.
- Files/modules: src/modules/harvest-inventory/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/harvest-inventory/integration/.
- Expected behavior: 2,400 kg − 1,600 sold − 150 losses = 650 stored. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P05-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Source fixture, wrong plot and incompatible unit.

### MYF-P05-T003 — Connect UI and verify acceptance for MYF-P05-R001

- Description: Connect the existing service contract to the phase G form/view for MYF-P05-R001; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P05-T002.
- Files/modules: src/app/ phase pages; src/modules/harvest-inventory/ UI components; tests/harvest-inventory/component/ and E2E/.
- Expected behavior: 2,400 kg − 1,600 sold − 150 losses = 650 stored.
- Acceptance criteria: MYF-P05-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Source fixture, wrong plot and incompatible unit.

### MYF-P05-T004 — Specify and implement domain contract for MYF-P05-R002

- Description: For MYF-P05-R002, define validated DTO/value objects and deterministic rules for: Track opening birds, purchases, mortality, eggs, bird sales, feed, medication and closing flock. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P05-T003.
- Files/modules: src/modules/harvest-inventory/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: 100 opening +20 purchased −5 deaths −10 sold =105 birds; eggs/feed do not affect flock count. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P05-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Flock reconstruction, excessive mortality and distinct bird/egg/feed units. Check unit/currency/date/scope types and constraints.

### MYF-P05-T005 — Implement authorized application service for MYF-P05-R002

- Description: Implement the scoped service/repository/adapter for MYF-P05-R002; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P05-T004.
- Files/modules: src/modules/harvest-inventory/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/harvest-inventory/integration/.
- Expected behavior: 100 opening +20 purchased −5 deaths −10 sold =105 birds; eggs/feed do not affect flock count. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P05-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Flock reconstruction, excessive mortality and distinct bird/egg/feed units.

### MYF-P05-T006 — Connect UI and verify acceptance for MYF-P05-R002

- Description: Connect the existing service contract to the phase G form/view for MYF-P05-R002; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P05-T005.
- Files/modules: src/app/ phase pages; src/modules/harvest-inventory/ UI components; tests/harvest-inventory/component/ and E2E/.
- Expected behavior: 100 opening +20 purchased −5 deaths −10 sold =105 birds; eggs/feed do not affect flock count.
- Acceptance criteria: MYF-P05-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Flock reconstruction, excessive mortality and distinct bird/egg/feed units.

### MYF-P05-T007 — Specify and implement domain contract for MYF-P05-R003

- Description: For MYF-P05-R003, define validated DTO/value objects and deterministic rules for: Use InventoryItem, StockMovement, StorageLocation, StockAdjustment and append-only ledger. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P05-T006.
- Files/modules: src/modules/harvest-inventory/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: 2,400−1,000−200−50=1,150 kg; transfer paired movements conserve stock. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P05-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Concurrent sales, rollback, duplicate command, reversal and transfer conservation. Check unit/currency/date/scope types and constraints.

### MYF-P05-T008 — Implement authorized application service for MYF-P05-R003

- Description: Implement the scoped service/repository/adapter for MYF-P05-R003; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P05-T007.
- Files/modules: src/modules/harvest-inventory/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/harvest-inventory/integration/.
- Expected behavior: 2,400−1,000−200−50=1,150 kg; transfer paired movements conserve stock. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P05-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Concurrent sales, rollback, duplicate command, reversal and transfer conservation.

### MYF-P05-T009 — Connect UI and verify acceptance for MYF-P05-R003

- Description: Connect the existing service contract to the phase G form/view for MYF-P05-R003; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P05-T008.
- Files/modules: src/app/ phase pages; src/modules/harvest-inventory/ UI components; tests/harvest-inventory/component/ and E2E/.
- Expected behavior: 2,400−1,000−200−50=1,150 kg; transfer paired movements conserve stock.
- Acceptance criteria: MYF-P05-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Concurrent sales, rollback, duplicate command, reversal and transfer conservation.

### MYF-P05-T010 — Specify and implement domain contract for MYF-P05-R004

- Description: For MYF-P05-R004, define validated DTO/value objects and deterministic rules for: Reconstruct every stock balance from history. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P05-T009.
- Files/modules: src/modules/harvest-inventory/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Rebuilt projection equals display for all fixture item/location pairs. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P05-AC004 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Corrupted projection rebuild and archive-history regression. Check unit/currency/date/scope types and constraints.

### MYF-P05-T011 — Implement authorized application service for MYF-P05-R004

- Description: Implement the scoped service/repository/adapter for MYF-P05-R004; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P05-T010.
- Files/modules: src/modules/harvest-inventory/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/harvest-inventory/integration/.
- Expected behavior: Rebuilt projection equals display for all fixture item/location pairs. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P05-AC004 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Corrupted projection rebuild and archive-history regression.

### MYF-P05-T012 — Connect UI and verify acceptance for MYF-P05-R004

- Description: Connect the existing service contract to the phase G form/view for MYF-P05-R004; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P05-T011.
- Files/modules: src/app/ phase pages; src/modules/harvest-inventory/ UI components; tests/harvest-inventory/component/ and E2E/.
- Expected behavior: Rebuilt projection equals display for all fixture item/location pairs.
- Acceptance criteria: MYF-P05-AC004 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Corrupted projection rebuild and archive-history regression.

### MYF-P05-T013 — Audit and close phase

- Description: execute all applicable checks; audit implemented scope/AC/security/integrity, remediate findings, retest and issue evidence-backed verdict.
- Dependencies: MYF-P05-T001 through MYF-P05-T012.
- Files/modules: phase module/tests, docs/reports/ and docs/PROJECT-STATUS.md; [closeout template](../engineering/phase-closeout-template.md).
- Expected behavior: no blocker or failed mandatory gate closes the phase.
- Acceptance criteria: all K and L with evidence; approved nonblocking conditions have owner/deadline.
- Required tests: J plus [quality gates](../engineering/definition-of-done.md); Phase 0 evidence/document review and explicit N/A application commands.

## I. Security Requirements

Current authentication required online; expired/revoked session cannot commit. Authorize every operation, relation, export/file grant server-side. Derive tenant from verified membership/grant, never client actor/role/ownership claim. Validate schema/units/money/dates/parents server-side.

Minimize contacts/GPS/finance/media, use private short-lived scoped file grants, redact secrets/content from logs. Audit sensitive writes, grants, corrections/exports with actor/time/scope/request/command. Source 2,400/1,600/650/150 reconciliation and 2,400/1,000/200/50 ledger are different examples. Never merge them.

## J. Testing Strategy

Unit: H golden examples and domain validation. Integration: isolated real PostgreSQL constraints/rollback, scoped repositories and provider contracts. E2E: permitted journey, mobile/keyboard, empty/loading/error/reconnect. Security: two tenants, guessed IDs, forged scope/parent, revocation/expired session, search/export/media. Failures: DB/provider timeout, invalid payload, version conflict, duplicate/concurrent command, partial media. Regression: cumulative gates, financial/stock reconstruction and farmer offline. H specifies unique phase edge cases.

Run npm run lint, npm run typecheck, npm test, npm run build plus applicable integration/E2E/security/migration suites; concurrency tests exercise actual DB constraints.

## K. Acceptance Criteria

- **MYF-P05-AC001**: 2,400 kg − 1,600 sold − 150 losses = 650 stored. Verification: Source fixture, wrong plot and incompatible unit.
- **MYF-P05-AC002**: 100 opening +20 purchased −5 deaths −10 sold =105 birds; eggs/feed do not affect flock count. Verification: Flock reconstruction, excessive mortality and distinct bird/egg/feed units.
- **MYF-P05-AC003**: 2,400−1,000−200−50=1,150 kg; transfer paired movements conserve stock. Verification: Concurrent sales, rollback, duplicate command, reversal and transfer conservation.
- **MYF-P05-AC004**: Rebuilt projection equals display for all fixture item/location pairs. Verification: Corrupted projection rebuild and archive-history regression.

## L. Phase Exit Gate

Every stock balance reconstructs from transaction history; transfers atomic and negative-stock policy protected under concurrency. All K criteria have evidence, cumulative prerequisites hold, blocking security/integrity defects absent, required command results logged. PASS WITH CONDITIONS cannot waive failing mandatory tests; every nonblocking condition has owner/deadline. Later source-silent gates are proposed and need approval before execution.

## M. Risks and Limitations

Technical: concurrency, browser/provider compatibility and unbounded queries. Operational: support/training, shared-device privacy and recovery ownership. Integrity: wrong scope/unit/currency, missing history, duplicated retries, misunderstood metrics. Specific unknowns: Q12 conversions/negative stock/valuation; Q13 flock-vs-stock overlap and sale posting. Deferred: later phases and unapproved provider capabilities; schemas/policies remain proposals.

## N. Deliverables

Reviewed phase module/mobile UI, approved/rehearsed migrations where needed, API/adapter contracts, tests/quality/security evidence, recovery notes and closeout report.

## O. Completion Checklist

- [x] MYF-P05-T001 complete with [evidence](../reports/phase-05-t001-2026-10-29.md).
- [x] MYF-P05-T002 complete with [evidence](../reports/phase-05-t002-2026-10-29.md).
- [x] MYF-P05-T003 complete with [evidence](../reports/phase-05-t003-2026-10-29.md).
- [x] MYF-P05-T004 complete with [evidence](../reports/phase-05-t004-2026-10-29.md).
- [x] MYF-P05-T005 complete with [evidence](../reports/phase-05-t005-2026-10-29.md).
- [x] MYF-P05-T006 complete with [evidence](../reports/phase-05-t006-2026-10-29.md).
- [x] MYF-P05-T007 complete with [evidence](../reports/phase-05-t007-2026-10-29.md).
- [x] MYF-P05-T008 complete with [evidence](../reports/phase-05-t008-2026-10-29.md).
- [x] MYF-P05-T009 complete with [evidence](../reports/phase-05-t009-2026-10-29.md).
- [ ] MYF-P05-T010 complete with evidence.
- [ ] MYF-P05-T011 complete with evidence.
- [ ] MYF-P05-T012 complete with evidence.
- [ ] MYF-P05-T013 complete with evidence.
- [ ] Every K criterion verified.
- [ ] Security/integrity audit, remediation and retest complete.
- [ ] Applicable quality/E2E/integration/migration evidence recorded.
- [ ] L gate approved; closeout/status updated from evidence.

## T001 implemented subset - 2026-10-29

Harvest domain and strict DTO/repository contracts are implemented without a migration. Gross kilograms and separate initial loss use exact six-decimal arithmetic; crop-cycle/plot/storage references must match the authorized farm. Closed historical references do not reopen production; harvest date cannot precede planting. Reuses existing UUID/date/farm/decimal helpers and adds no dependencies. T002 must prove authorization, atomic effects, replay and rollback in PostgreSQL; T003/full AC001 remain pending. [Evidence](../reports/phase-05-t001-2026-10-29.md).

### T002 checkpoint

Authorized harvest persistence and API. PASS: lint, typecheck, 742 unit/component tests, production build; 16 focused PostgreSQL/migration/provisioning tests. Additive migrations 202610290001 and 202610290002 applied only to isolated PostgreSQL 17. Concurrent replay creates one harvest with gross/loss movements; failed parents roll back receipts. Composite foreign keys preserve scope/provenance. Runtime SELECT/INSERT only and browser grants denied. Full UI/AC001 remains pending T003 and dependent stock-sale acceptance. [Report](../reports/phase-05-t002-2026-10-29.md).

### T003 checkpoint

Harvest and store screens. PASS: lint, typecheck, production build; 2 component tests and 2 signed-in desktop/mobile browser tests. Reuses RecordForm composition, Field/Input/Button, paged ChoiceField, ProductionShell and existing stable-request/offline feedback. Browser proves 2400 gross minus 150 initial loss gives 2250 initially stored; offline-open draft survives and cross-farm detail is denied. No schema change. Full 650 kg harvest/sale oracle is deferred to T008/T009 because stock sale posting belongs there; no full AC001 claimed yet. [Report](../reports/phase-05-t003-2026-10-29.md).

### T004 checkpoint

Poultry event and flock domain contract. PASS: 8 focused domain tests and lint. Reuses exact quantity validation, shared dates and Phase 4 sale amount/category schemas. Proves 100+20-5-10=105; eggs/feed/medication do not affect flock counts, bird/egg counts are whole, excessive mortality and count overflow fail. Feed uses KG; medication retains an explicit farmer-entered unit and does not silently convert or reduce birds. No migration or runtime posting in this stage. [Report](../reports/phase-05-t004-2026-10-29.md).

### T005 checkpoint

Authorized poultry events and atomic bird sales. PASS: lint and 27 focused poultry/accounting PostgreSQL tests. Additive migration 202610290003 applied only to isolated PostgreSQL 17. Batch locks serialize mortality and identical retries; opening birds enter stock once, eggs are separate items, feed/medication events do not decrement birds. Bird sale plus stock effect, audit and receipt commit atomically via the existing accounting writer. Independent accounting reversal of a stock-linked bird sale is blocked pending coordinated reversal. Failed category validation rolls back all effects. Existing accounting tests remain green. Full UI/AC002 remains T006. [Report](../reports/phase-05-t005-2026-10-29.md).

### T006 checkpoint

Poultry production screens and reconstructed batch counts. PASS: lint, typecheck and production build; 4 signed-in desktop/mobile harvest/poultry browser tests. AC002 source journey yields 105 birds with one bird sale. Existing batch list/detail APIs now derive counts in bounded bulk queries from all bird stock movements, with explicit source labels. No schema change. Reuses paged choices, RecordForm and offline/error/retry feedback. Browser runners complete successfully outside the Windows sandbox; the earlier sandbox runs hung during process teardown despite passing assertions. [Report](../reports/phase-05-t006-2026-10-29.md).

### T007 checkpoint

Stock operation and reconstruction contracts. PASS: 5 focused domain tests, lint and typecheck. Separate inventory fixture 2400-1000-200-50=1150; exact transfer conservation; negative effective-date closing balances rejected even if future receipts would hide them. Same-date gross/loss effects group atomically. Strict sale/transfer/adjustment shapes, explicit units and confirmed reasoned reversals. No schema change in T007. Runtime locks, finance coordination and stock concurrency proof belong to T008. [Report](../reports/phase-05-t007-2026-10-29.md).

### T008 checkpoint

Atomic stock operations, transfers and coordinated reversals. PASS: lint, typecheck, boundaries and production build; 37 focused PostgreSQL stock/poultry/accounting/historical-migration tests after fixing the historical provider-file fixture. Earlier broad run: 166 pass and one setup failure, fixed and rerun. Additive migration 202610290004 applied only locally. Scoped item/store checks, unit checks, owner-reviewed adjustments, per-item/batch locks, single-source sales, effective-date nonnegative checks and atomic opposite-entry reversals are implemented. Reversal of paid sales requires payment reversals first. Runtime histories remain SELECT/INSERT only. Source harvest 650 kg and separate stock ledger 1150 kg oracles, concurrent withdrawal loser rollback and transfer reversal conservation pass in PostgreSQL. [Report](../reports/phase-05-t008-2026-10-29.md).

### T009 checkpoint

Stock entry, balances, transfers and confirmed reversal screens. PASS: lint and production build (including TypeScript), 7 focused domain/component tests and 4 signed-in desktop/mobile browser tests. AC001 full source journey now shows 650 kg after harvest/loss/sale; browser transfer shows 500 plus 150 kg and confirmed reversal restores 650 kg. AC003 ledger 1150 kg and concurrency/conservation remain verified in T008 DB tests. Reuses generic RecordForm, paged selectors, farm shell and feedback. No migration or dependency change. Reversal review displays original quantity/unit/date and requires confirmation. [Report](../reports/phase-05-t009-2026-10-29.md).
