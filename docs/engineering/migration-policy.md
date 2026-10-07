# Migration policy

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — status/applicability/structure/link review; no runtime or independent product validation.
- Implementation status: REFERENCE ONLY — N/A (no directly implementable scope).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase 00 session.
- Related phase/task IDs: Phase 00 session; MYF-P00-T001 through MYF-P00-T010; future phase references remain pending.
- Verified completed work: Reference/protocol/navigation/report review performed; no phase completion implied.
- Remaining work/blockers: Keep aligned with verified task/evidence changes; Phase 00 discovery gate still unmet.
- Evidence/report links: [Phase 00 closeout](../reports/phase-00-closeout-2026-10-08.md); [every-document review](../reports/phase-00-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

No migrations created in this documentation assignment. Proposed schema fields require approved phase scope, relevant Q decisions and reviewed design.

Before migration: inspect actual schema/data/constraints; document affected tables/API/client versions, tenant boundaries, row counts/backfill plan, downtime risks and rollback/restore strategy. Protect financial/stock histories and local outbox compatibility. New activity/provider/billing relations arrive in their phase.

Prefer expand → deploy compatible readers/writers → idempotent scoped backfill → verify counts/orphans/domain totals → add constraints → retire old behavior after supported client window. Do not use destructive reset on shared/production DB. Data correction is reasoned/audited; posted financial history is not overwritten by a migration.

Rehearse fresh install and upgrade from supported prior snapshot in isolated DB; check tenant composite FKs, receipt uniqueness, concurrent writes and rebuilt balances/metrics. Verify storage/permissions and backup restoration. Prisma generate/build success alone does not prove migration safety.

Dexie upgrade is a separate reviewed migration: retain pending commands/photos, use atomic local conversion, support server schema version or surface recovery/update path. Test interrupted upgrade/reload, full quota, unsupported client and expired pull cursor. Never drop IndexedDB to “fix” sync.

Deployment separates schema change from app rollout; forward fixes usually safer than reversing data. Rollback plan must state code compatibility vs DB restore and provider-side actions requiring reconciliation. Record migration name/status/checksum, environment, evidence, restored/rebuilt totals, residual risks and approver in [closeout](phase-closeout-template.md). [DB](../architecture/database-architecture.md) and [sync](../architecture/offline-sync-architecture.md) supply invariants.
