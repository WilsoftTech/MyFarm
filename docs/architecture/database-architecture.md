# Database architecture

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — status/applicability/structure/link review; no runtime or independent product validation.
- Implementation status: NOT STARTED — 0% (runtime implementation not verified).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase 00 session.
- Related phase/task IDs: Future Phases 01–24 as referenced; session review Phase 00; MYF-P01-T001 through MYF-P01-T013.
- Verified completed work: Architecture reference reviewed for current applicability; no runtime implementation completed.
- Remaining work/blockers: Affected future tasks/decisions and phase authorization; no database/app/deployment present.
- Evidence/report links: [Phase 00 closeout](../reports/phase-00-closeout-2026-10-08.md); [every-document review](../reports/phase-00-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

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
