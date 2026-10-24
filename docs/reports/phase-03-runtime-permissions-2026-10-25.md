# Phase 3 runtime permission repair

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — T013 metadata/status scope and evidence-link relevance; historical and future-phase facts unchanged.
- Implementation status: REFERENCE ONLY — N/A (review/evidence record).
- Last reviewed: 2026-10-25 (Africa/Nairobi), T013 audit.
- Related phase/task IDs: MYF-P03-T013.
- Verified completed work: Document inventory, review depth and source-preservation checks recorded.
- Remaining work/blockers: See the current phase closeout; this review does not complete a task.
- Evidence/report links: [T013 closeout](phase-03-closeout-2026-10-25.md).
<!-- MYFARM-STATUS-END -->

Date: 2026-10-25 (Africa/Nairobi). Scope: enterprise, season, crop and poultry page failures following T012. Hosted development provisioning is repaired. Signed-in browser verification and phase closure are not claimed.

## Cause and repair

The restricted application role lacked Phase 3 table privileges. A verified-TLS read-only probe reproduced PostgreSQL 42501 on Enterprise. After the additive poultry migration, PoultryBatch and AnimalTypeCatalog also lacked runtime access. The page guard correctly converts storage failures into UNAVAILABLE; the client console event reports the same failure. Neither guard nor error boundary was suppressed or weakened.

Applied the existing reviewed production-runtime.sql, crop-cycle-runtime.sql and poultry-batch-runtime.sql provider policies to hosted development project sudqhluwsaijvjjcegpv. Permission/policy snapshots were captured before changes; the permission repairs were transactional. No new dependency, policy design or migration file was introduced. The application continues to use myfarm_runtime, not an administrator connection. Updated DIRECT_URL credentials are preserved; operations used the same project's verified session pooler in memory because the direct hostname fails DNS on this machine. TLS certificate verification remained enabled.

Automatic review rejected the broader hosted permission rewrite. A read-only audit then established that browser roles already had zero existing public table, sequence and function privileges. The narrower two-table poultry repair was approved and applied; no global browser/default-privilege rewrite was needed. This resolves the earlier approval blocker without bypassing it.

Final hosted read-only verification:

| Relation | Runtime SELECT | Runtime INSERT |
|---|---|---|
| Enterprise | Yes | Yes |
| Season | Yes | Yes |
| CropCatalog | Yes | No |
| CropCycle | Yes | Yes |
| AnimalTypeCatalog | Yes | No |
| PoultryBatch | Yes | Yes |

All six actual runtime SELECT queries passed using LIMIT 0, without fetching farmer records. RLS stays enabled, runtime UPDATE/DELETE remain denied, and catalogs remain read-only. Existing public browser object privileges are zero; this does not claim a new audit of every future default privilege or private schema.

## Migrations and preservation

Following the owner's instruction "approved. apply migrations", Prisma migrate deploy applied:

- 202610190001_poultry_batches: adds canonical AnimalTypeCatalog and PoultryBatch.
- 202610250001_crop_catalog_release: adds the 12 approved crop entries.

Before deployment, a disposable PostgreSQL 17 rehearsal recreated the hosted six-migration history, applied both pending migrations, repeated deployment with nothing pending and preserved a sentinel row. Existing checksums matched exact files or known LF/CRLF variants.

All seven local migrations are now applied. The extra legacy 202610240001_poultry_batches migration and its empty LivestockBatch table remain intact. No migration history was rewritten and no table or farmer record was deleted. Existing application/audit aggregate counts and original reference rows were preserved. Catalog totals are 14 crops and four animal types; canonical PoultryBatch has zero rows. Metadata/reference snapshots are not a full database backup.

Ignored local evidence under .cache/runtime-repair/: hosted-before-migrations.json, history-upgrade-rehearsal.json, hosted-migrate-deploy.log, hosted-after-migrations.json and hosted-permissions-before-*.json. No credentials are included in this report.

## Regression and checks

Extended tests/integration/production-service.test.ts to revoke privileges on all six tables in disposable PostgreSQL, reproduce enterprise/season/poultry/catalog service failures, apply the three actual provider files and verify successful reads. The same test confirms cross-user denial, catalog write denial, no poultry DELETE/browser access and an unchanged audit count. Existing production, crop, poultry, provisioning and migration tests also ran.

Target: disposable container myfarm-runtime-global-20261025, loopback port 55445, database myfarm_phase01_test, PostgreSQL 17. No integration tests ran against hosted data.

| Command/check | Result |
|---|---|
| prisma migrate deploy (disposable database) | PASS, seven migrations |
| npm.cmd run test:integration | PASS, 113 tests |
| npm.cmd test | PASS, 468 unit/component tests |
| npm.cmd run lint | PASS |
| npm.cmd run typecheck | PASS |
| npm.cmd run check:boundaries | PASS |
| npm.cmd run build, NODE_ENV=production | PASS, Next.js 16.4.3 |
| git diff --check | PASS |
| Hosted restricted-role queries | PASS, six tables |
| Signed-in hosted browser retry / browser suite | NOT RUN in this repair |

The pre-existing next-env.d.ts modification is preserved outside this task. No application deployment or push was performed. Phase 3 remains 12/13 tasks; T013 audit, full AC001 and remaining exit gates are separate work. Restart the existing dev server after environment/client changes and retry the affected pages.

Reference: [Supabase Observability](https://supabase.com/docs/guides/observability).

After verification the disposable test container was removed. The generated next-env.d.ts was restored byte-for-byte to its pre-build state.
