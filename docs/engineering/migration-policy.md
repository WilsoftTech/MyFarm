# Migration policy

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase01 status, applicability and evidence/link review; affected content reconciled; no independent farmer validation or hosted verification.
- Implementation status: REFERENCE ONLY — N/A (navigation/protocol/template/decision/evidence record; no directly implementable scope).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase01 implementation session.
- Related phase/task IDs: Phase01 review session; MYF-P01-T001 through MYF-P01-T013; Phase00 owner acceptance where referenced.
- Verified completed work: Reference content/status/evidence links reviewed; document existence or review does not complete implementation tasks.
- Remaining work/blockers: Maintain alignment after Phase01 live verification; historical results stay historical and source body remains immutable.
- Evidence/report links: [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Phase1 migration202610080001_foundation was created and rehearsed on an isolated local PostgreSQL17 database, including replay and synthetic restore. No hosted/shared/production migration applied. Later schema fields still require their approved phase scope/decisions.

Before migration: inspect actual schema/data/constraints; document affected tables/API/client versions, tenant boundaries, row counts/backfill plan, downtime risks and rollback/restore strategy. Protect financial/stock histories and local outbox compatibility. New activity/provider/billing relations arrive in their phase.

Prefer expand → deploy compatible readers/writers → idempotent scoped backfill → verify counts/orphans/domain totals → add constraints → retire old behavior after supported client window. Do not use destructive reset on shared/production DB. Data correction is reasoned/audited; posted financial history is not overwritten by a migration.

Rehearse fresh install and upgrade from supported prior snapshot in isolated DB; check tenant composite FKs, receipt uniqueness, concurrent writes and rebuilt balances/metrics. Verify storage/permissions and backup restoration. Prisma generate/build success alone does not prove migration safety.

Dexie upgrade is a separate reviewed migration: retain pending commands/photos, use atomic local conversion, support server schema version or surface recovery/update path. Test interrupted upgrade/reload, full quota, unsupported client and expired pull cursor. Never drop IndexedDB to “fix” sync.

Deployment separates schema change from app rollout; forward fixes usually safer than reversing data. Rollback plan must state code compatibility vs DB restore and provider-side actions requiring reconciliation. Record migration name/status/checksum, environment, evidence, restored/rebuilt totals, residual risks and approver in [closeout](phase-closeout-template.md). [DB](../architecture/database-architecture.md) and [sync](../architecture/offline-sync-architecture.md) supply invariants.
