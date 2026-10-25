# Migration policy

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — T013 metadata/status scope and evidence-link relevance; historical and future-phase facts unchanged.
- Implementation status: REFERENCE ONLY — N/A (navigation/protocol/template/decision/evidence record; no directly implementable scope).
- Last reviewed: 2026-10-25 (Africa/Nairobi), T013 audit.
- Related phase/task IDs: Phase01 review session; MYF-P01-T001 through MYF-P01-T013; Phase00 owner acceptance where referenced; Phase02 review session (MYF-P02-T001–T013).
- Verified completed work: Reference content/status/evidence links reviewed; document existence or review does not complete implementation tasks.
- Remaining work/blockers: Maintain alignment with the Phase02 closeout; historical sections stay historical; Phase3 authorized (D-P03-001), NOT STARTED.
- Evidence/report links: [Phase02 closeout](../reports/phase-02-closeout-2026-10-09.md); [Phase02 every-document review](../reports/phase-02-document-review-2026-10-09.md); [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](../reports/phase-01-provider-verification-2026-10-08.md). [T013 audit](../reports/phase-03-closeout-2026-10-25.md).
<!-- MYFARM-STATUS-END -->

Phase1 migration202610080001_foundation was created and rehearsed on an isolated local PostgreSQL17 database, including replay and synthetic restore. No hosted/shared/production migration applied. Later schema fields still require their approved phase scope/decisions.

Before migration: inspect actual schema/data/constraints; document affected tables/API/client versions, tenant boundaries, row counts/backfill plan, downtime risks and rollback/restore strategy. Protect financial/stock histories and local outbox compatibility. New activity/provider/billing relations arrive in their phase.

Prefer expand → deploy compatible readers/writers → idempotent scoped backfill → verify counts/orphans/domain totals → add constraints → retire old behavior after supported client window. Do not use destructive reset on shared/production DB. Data correction is reasoned/audited; posted financial history is not overwritten by a migration.

Rehearse fresh install and upgrade from supported prior snapshot in isolated DB; check tenant composite FKs, receipt uniqueness, concurrent writes and rebuilt balances/metrics. Verify storage/permissions and backup restoration. Prisma generate/build success alone does not prove migration safety.

Dexie upgrade is a separate reviewed migration: retain pending commands/photos, use atomic local conversion, support server schema version or surface recovery/update path. Test interrupted upgrade/reload, full quota, unsupported client and expired pull cursor. Never drop IndexedDB to “fix” sync.

Deployment separates schema change from app rollout; forward fixes usually safer than reversing data. Rollback plan must state code compatibility vs DB restore and provider-side actions requiring reconciliation. Record migration name/status/checksum, environment, evidence, restored/rebuilt totals, residual risks and approver in [closeout](phase-closeout-template.md). [DB](../architecture/database-architecture.md) and [sync](../architecture/offline-sync-architecture.md) supply invariants.

## Phase 2 implementation (2026-10-09)

- **Naming:** new migration directories must sort after the latest applied migration. Phase 2's migration was renamed to `202610090001_farmer_registry` for this reason.
- **Checksums:** Prisma records raw byte checksums, so migration SQL is pinned to LF via `.gitattributes`. Existing hosted dev history mixes CRLF/LF checksums (condition P2-C3).
- **Out-of-chain SQL:** provider-specific SQL outside the Prisma chain must be listed in the deployment provisioning order ([closeout](../reports/phase-02-closeout-2026-10-09.md)).

## Provider SQL rules (2026-10-09, provisioning hardening)

- **Listed once:** every provider SQL file appears in [`supabase/provisioning.json`](../../supabase/provisioning.json), in run order.
- **Transactional:** each file is a single `BEGIN; … COMMIT;` block, so a failure leaves nothing behind.
- **Re-runnable:** `CREATE POLICY` is always preceded by `DROP POLICY IF EXISTS`; roles, schemas and rows are created only when missing; functions use `CREATE OR REPLACE`. Rerunning the whole list must leave an identical catalog.
- **Tested as written:** tests execute the real files (never a copied subset) on a fresh database, on rerun, and on a database provisioned before the latest file. A test-only Supabase stand-in (`tests/support/supabase-emulation.sql`) supplies the platform objects plain PostgreSQL lacks; it is supplementary evidence, not proof of hosted behavior.
- **Never** edit an applied Prisma migration or its checksum; add a new migration instead.

## Phase 3 T005 rehearsal (2026-10-18)

Additive migration `202610180002_crop_cycles` and the new manifest-listed runtime file passed fresh installation, upgrade preservation, transaction-failure rollback, provider rerun, Prisma drift comparison and synthetic dump/restore on isolated PostgreSQL 17. Composite parent indexes require a lock/size review before shared rollout. Existing app code can run with the additive schema; roll back code while retaining recorded histories rather than dropping tables. Hosted application and production backup/reconciliation require separate authorization. [Task evidence](../reports/phase-03-t005-2026-10-18.md).

## Phase 3 T008 rehearsal (2026-10-19)

Additive migration `202610190001_poultry_batches` and the new manifest-listed `poultry-batch-runtime.sql` passed fresh install, upgrade from the five prior migrations with row preservation, injected-failure rollback, provider rerun, Prisma drift comparison and a synthetic dump/restore (`tests/support/poultry-batch-recovery.mjs`) on isolated PostgreSQL 17. Roll back application code rather than dropping the tables. Not applied to hosted dev. [T008 evidence](../reports/phase-03-t008-2026-10-19.md).

## Phase 4 T002 rehearsal (2026-10-25)

Additive migration `202610250002_farm_accounting` and the manifest-listed `farm-accounting-runtime.sql` passed fresh install, upgrade from the seven prior migrations with row preservation, injected-failure rollback, provider rerun, Prisma drift comparison and a synthetic dump/restore (`tests/support/farm-accounting-recovery.mjs`) on isolated PostgreSQL 17. Roll back application code rather than dropping the tables. Not applied to hosted dev. [T002 evidence](../reports/phase-04-t002-2026-10-25.md).
