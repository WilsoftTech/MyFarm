# Database architecture

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — T013 metadata/status scope and evidence-link relevance; historical and future-phase facts unchanged.
- Implementation status: Phase01 scope COMPLETED — 100% (13/13 verified Phase01 tasks; PASS WITH CONDITIONS — LOCAL VERIFICATION); Phase02 scope COMPLETED — 100% (13/13 verified Phase02 tasks; PASS WITH CONDITIONS — LOCAL VERIFICATION); later-phase scope not counted.
- Last reviewed: 2026-10-25 (Africa/Nairobi), T013 audit.
- Related phase/task IDs: Phase01 MYF-P01-T001–T013; Phase02 MYF-P02-T001–T013.
- Verified completed work: Phase01 scope as previously verified; Phase02: farmer registry contracts/policies/migration/API/tests in this document's area verified (see the Phase 2 implementation section).
- Remaining work/blockers: Phase02 conditions where still applicable; Phase03 T001-T005 verified at their stages locally; T006-T013 and hosted application remain pending. [T005 evidence](../reports/phase-03-t005-2026-10-18.md).
- Evidence/report links: [Phase02 closeout](../reports/phase-02-closeout-2026-10-09.md); [Phase02 every-document review](../reports/phase-02-document-review-2026-10-09.md); [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](../reports/phase-01-provider-verification-2026-10-08.md). [T013 audit](../reports/phase-03-closeout-2026-10-25.md).
<!-- MYFARM-STATUS-END -->

## Phase 3 foundation subset — 2026-10-18

**T002 update:** `production-runtime.sql` is now listed after registry runtime grants and before browser lockdown. It grants SELECT/INSERT only on Enterprise/Season, verifies active creator memberships and initial state, and is tested transactionally and on rerun. Repositories scope reads by tenant/farm and commit creation with its audit receipt. Account/membership rechecks also run after receipt waits. No new schema migration or hosted application was performed in T002. [Evidence and limitations](../reports/phase-03-t002-2026-10-18.md).

Migration `202610180001_enterprises_seasons` adds Enterprise and Season without modifying prior migrations or rows. It enforces farm/tenant composite keys, creator references, positive versions, nonempty labels and bounded, ordered calendar dates. FK indexes support parent checks; scoped list indexes match the repository port's tenant/farm pagination. The migration itself enables RLS without policies; T002's provider file layers the reviewed runtime policies afterward. Fresh provisioning, upgrade preservation, migration failure rollback and schema comparison passed on isolated PostgreSQL 17. No hosted application or full Phase 3 completion is claimed. [Foundation report](../reports/phase-03-start-2026-10-18.md).

**Proposed logical/physical schema, not an approved migration.** PostgreSQL is authoritative; Prisma repositories expose domain-specific operations. All tenant-owned records carry explicit tenant scope and relevant farm scope. A farmer personal workspace and organization workspace share isolation abstractions without implementing billing in MVP.

Identifier: UUID generated before offline creation where needed. Time: timestamptz for instants; agricultural/business dates use date plus named farm time zone. Version: positive integer, incremented server-side. Unit quantity: numeric(18,6) proposed; money numeric(20,4) proposed with currency and approved rounding metadata. Serialize decimal/large sequence values as strings to clients; avoid binary-float authoritative arithmetic.

## Relationships and constraints

Use composite unique (tenantId,id) and scoped child FKs. Where both plot and enterprise links exist, verify common farm and correct cycle; a valid independent FK is insufficient. Farm ownership required on operational records. The source's optional farm attribution is interpreted as optional analytical selection, not an unowned financial record; Q05/Q09 must confirm this before code.

Unique membership pairs; mutation receipt (tenantId,actorId,clientMutationId); provider event (provider,eventId); recurrence occurrence (recurrenceId,dueOn); order reservation/posting source keys. Stock/journal source IDs prevent one event posting twice. Restrict deletes of referenced history; append correction/reversal rather than overwrite posted records.

## Transactions and queries

Validate current rights in the same authoritative write boundary where feasible. Expense/stock/receipt/audit/change-log commit together or rollback. Optimistic version checks for editable records; critical quantity/available-money checks require row locking or serializable transactional enforcement with bounded retry. Do not assume read-check-write is safe concurrently.

Index tenant/farm/date/id lists and parent relations; use stable keyset pagination and bounded scope/date queries. Index foreign keys with query evidence. Projection snapshots/cache rebuild from source ledgers. Do not join records across tenants without an explicit sharing/bilateral access projection.

## Evolution/recovery

Phase F enumerates entity fields; [domain model](domain-model.md) covers relationships. Apply [migration policy](../engineering/migration-policy.md), test staged backfill/constraints and offline schema compatibility. Managed backups do not prove restoration: rehearse recoveries and reconcile pending receipts/provider state. RPO/RTO, retention and erasure policies remain Q06/Q16/Q34. [Financial](financial-integrity.md) and [sync](offline-sync-architecture.md) impose extra invariants.


## Phase1 implemented evidence and limits

Implemented only User/Organization/Membership/AuditEvent with restricted FKs, unique memberships/audit request actions and RLS deny for browser roles. Prisma7 adapter-pg, scoped bounded repositories, transaction rollback/concurrency and synthetic restore tested. Later farm/money/quantity schemas remain proposed.

[Closeout](../reports/phase-01-closeout-2026-10-08.md); [setup](../engineering/foundation-local-setup.md).

## Phase 1 security follow-up

Current code verifies provider session existence/expiry and fails closed, hosted PostgreSQL TLS is strictly verified, and the unapplied storage policy helper uses a private schema and current session/membership checks. Local regression tests pass; hosted schema/role/Auth/Storage verification remains pending. [Follow-up evidence](../reports/phase-01-provider-verification-2026-10-08.md).

## Phase 2 implementation (2026-10-09)

Migration `202610090001_farmer_registry` (additive):

- **Tables:** Farmer, FarmerProfile, Farm, Plot, FarmMember; enums LandOwnership, FarmActivity, AreaUnit, FarmMemberRole.
- **Tenant integrity:** composite `(id, tenantId)` foreign keys make cross-tenant farm/plot/member links impossible.
- **Domain CHECK constraints:** acreage/area ≥ 0; coordinate pair and range; area/unit pair; ≥ 1 activity; distinct phones; version ≥ 1.
- **Precision:** acreage numeric(12,4), area numeric(18,6), coordinates numeric(9,6).
- **RLS:** enabled on all new tables.

Provider SQL `supabase/policies/farmer-registry-runtime.sql` sits outside the Prisma chain (condition P2-C2). `.gitattributes` pins migration SQL to LF because Prisma stores raw byte checksums (P2-C3).

Verification: fresh/replay/drift/second-DB/restore rehearsal PASS. Applied to the isolated dev project 2026-10-09 ([closeout](../reports/phase-02-closeout-2026-10-09.md)).

## Phase 3 T005 persistence (2026-10-18)

Migration `202610180002_crop_cycles` adds CropCatalog and CropCycle, approved Maize/Coffee reference seeds, composite parent keys and matching FK/query indexes. CHECK constraints enforce positive finite area, ordered supported dates, versions and text bounds. Existing rows and migration files are preserved. The new `crop-cycle-runtime.sql` sits before browser lockdown in the manifest: catalog SELECT, cycle SELECT/INSERT, active creator/parent/catalog consistency checks, no browser grants or UPDATE/DELETE.

Starts use the existing audit receipt and a transaction-level advisory lock keyed by `myfarm:crop-plot:<UUID>`; Read Committed capacity reads after acquiring it observe prior committed starts. All active plot allocations across enterprise/season are checked by the exact T004 domain rule; receipt replay returns before capacity allocation. No Plot UPDATE privilege is added. Future allocation writers/closures/plot-area edits must coordinate with the same lock. Raw shared-role SQL is not covered by this application lock protocol. [Evidence, migration/recovery and limitations](../reports/phase-03-t005-2026-10-18.md).

## Phase 3 T008 persistence (2026-10-19)

Migration `202610190001_poultry_batches` adds the `PoultryPurpose` enum, `AnimalTypeCatalog` with the approved Chicken/Duck/Turkey/Guinea fowl seeds, and `PoultryBatch`. Batches use the composite `(enterpriseId, farmId, tenantId)` FK, a creation-time animal-type name snapshot, an integer starting count (CHECK >= 0) and a unique `(tenantId, farmId, batchLabelKey)` index. The key is application-normalized (NFC, whitespace collapsed, lowercase) and covers all statuses (D-P03-010). Deny-all RLS ships in the migration; `supabase/policies/poultry-batch-runtime.sql` grants runtime catalog SELECT and batch SELECT/INSERT. The current count is derived from the starting count until Phase 5 movements. [T008 evidence](../reports/phase-03-t008-2026-10-19.md).

## Phase 3 T011 reference release (2026-10-25)

Migration `202610250001_crop_catalog_release` adds the 12 crops approved in D-P03-012, with stable UUIDs. A transaction and catalog write lock protect the release; primary-key/exact-name conflicts and normalized-name collisions (including inactive entries) abort the entire release. Existing rows and cycle snapshots are preserved. There is no schema or runtime grant change. The alternate incoming `202610240001_poultry_batches` migration is excluded by owner decision D-P03-013; a database that applied it requires a separate reconciliation plan. [Migration, rollback and verification evidence](../reports/phase-03-t011-2026-10-25.md).

## Phase 4 T002 persistence (2026-10-25)

Migration `202610250002_farm_accounting` adds global `TransactionCategory`/`PaymentMethod` catalogs (D-P04-005), `AccountingRecord` (numeric(20,4) amount with ISO currency, category-name snapshot, optional plot/enterprise/season links), `PaymentRecord`, `PaymentAllocation` (composite same-farm FKs to payment and obligation) and `AccountingReversal` (exactly one unique target). Optional links are single-column FKs because Prisma cannot model optional composite relations over required scope columns; same-farm consistency is enforced by the service and the runtime INSERT policy. Balances are derived, never stored. Deny-all RLS precedes the manifest-listed `farm-accounting-runtime.sql`. [T002 evidence](../reports/phase-04-t002-2026-10-25.md).

## Phase 4 T008 crop-cycle link backstop (2026-10-26)

No new migration. `farm-accounting-runtime.sql` adds to the AccountingRecord INSERT policy that a CROP enterprise linked with a plot and/or season must match a CropCycle of that enterprise on the same farm (D-P04-007). Report reads are date-filtered queries over POSTED rows; projections for large histories remain Phase 8 (P4-C3). [Closeout](../reports/phase-04-closeout-2026-10-26.md).

## Phase 5 implementation and audit - 2026-10-29

Five additive 20261029 migrations add harvest/storage/movement scope keys, poultry events, stock operations/adjustments and finite-quantity/date checks. Manifest-listed harvest-inventory-runtime.sql grants SELECT/INSERT only to the backend, with membership/owner checks for writes. RLS is enabled and browser/PUBLIC grants revoked. No hosted application is performed. Real rollback, dump/restore, uniqueness and grants are tested in isolated PostgreSQL 17. [Audit and required hosted gate](../reports/phase-05-closeout-2026-10-29.md). Phase 5 closure is pending T013/hosted CI.
