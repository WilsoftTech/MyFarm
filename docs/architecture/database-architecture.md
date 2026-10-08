# Database architecture

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — current Phase01 implementation/evidence/status review; no completion inferred from review.
- Implementation status: Phase01 scope COMPLETED — 100% (13/13 verified Phase01 tasks; PASS WITH CONDITIONS — LOCAL VERIFICATION); later-phase scope not counted.
- Last reviewed: 2026-10-08 (Africa/Nairobi), live provider and hosted closeout session.
- Related phase/task IDs: Phase01 foundation T001–T013 (10 verified); cross-phase requirements remain pending; Phase01 review session.
- Verified completed work: T001–T010; live Supabase verification and local quality/security gates PASS; see current closeout.
- Remaining work/blockers: T011–T013 hosted CI/preview/final review pending.
- Evidence/report links: [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](../reports/phase-01-provider-verification-2026-10-08.md).
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


## Phase1 implemented evidence and limits

Implemented only User/Organization/Membership/AuditEvent with restricted FKs, unique memberships/audit request actions and RLS deny for browser roles. Prisma7 adapter-pg, scoped bounded repositories, transaction rollback/concurrency and synthetic restore tested. Later farm/money/quantity schemas remain proposed.

[Closeout](../reports/phase-01-closeout-2026-10-08.md); [setup](../engineering/foundation-local-setup.md).

## Phase 1 security follow-up

Current code verifies provider session existence/expiry and fails closed, hosted PostgreSQL TLS is strictly verified, and the unapplied storage policy helper uses a private schema and current session/membership checks. Local regression tests pass; hosted schema/role/Auth/Storage verification remains pending. [Follow-up evidence](../reports/phase-01-provider-verification-2026-10-08.md).
