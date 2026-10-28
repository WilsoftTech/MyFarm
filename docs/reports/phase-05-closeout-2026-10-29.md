# Phase 5 audit and closeout gate - 2026-10-29

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED - Phase 5 requirements, implementation, security and verification plan.
- Implementation status: PARTIALLY COMPLETE - 92.31% (12/13 verified tasks); T013 audit in progress.
- Last reviewed: 2026-10-29 (Africa/Nairobi).
- Related phase/task IDs: MYF-P05-T001 through MYF-P05-T013; D-P05-001 through D-P05-005.
- Verified completed work: T001-T012 committed separately. Local targeted domain, persistence and browser checks are linked in task reports.
- Remaining work/blockers: Required GitHub-hosted CI before T013/phase closure; clean-checkout local audit passed.
- Evidence/report links: [Phase specification](../phases/phase-05-harvest-inventory.md); [Project status](../PROJECT-STATUS.md).
<!-- MYFARM-STATUS-END -->

## Phase identity and implementation scope

Harvest Production and Inventory, Africa/Nairobi, engineering agent under owner authorization D-P05-004. T001-T012 implement validated harvest records, named stores, poultry event/flock records, immutable stock movements, unit-labelled supply items, owner-reviewed stock adjustments, transfers, atomic stock/accounting sales, coordinated reversals, paginated history and deterministic reconstruction. No Phase 6+, provider change, dependency addition, deployment or hosted migration is included.

Owner decisions D-P05-002/003 approve six-decimal quantities, KG crop harvests, whole birds/eggs, explicit units/no conversion, no negative stock, separate initial losses and deferred valuation. Bird sale effects occur once. Existing accounting-only sales are not automatically assigned stock effects. There is no retroactive linking UI in this phase.

D-P05-005 requires hosted CI before closure. Local success alone cannot complete T013. The owner authorized pushing after T001-T012 and the local audit pass so that hosted CI can execute. Phase 6 is not authorized.

## Changes and migrations

New module: `src/modules/harvest-inventory/{contracts,domain,application,infrastructure}`. Shared production UI composition and existing Field/Input/Button, farm shell, paged selectors, authorization, scoped receipts, exact arithmetic and accounting transaction rules are reused. Existing batch API/list/detail counts now derive from the movement ledger in bulk. Stock-linked sales cannot be independently reversed through accounting; payment corrections must precede coordinated stock/financial reversal.

Additive migrations: `202610290001_harvest_inventory`, `202610290002_harvest_scope`, `202610290003_poultry_production`, `202610290004_stock_operations`, `202610290005_stock_integrity`. Runtime provisioning: manifest-listed `supabase/policies/harvest-inventory-runtime.sql`, before browser lockdown. No existing migration was rewritten. New runtime histories are SELECT/INSERT only; browser/PUBLIC grants are revoked and RLS is enabled. Composite keys bind farm/tenant and harvest crop/plot/provenance; finite quantity and date checks protect ledger arithmetic.

Applied only to isolated loopback PostgreSQL 17. Hosted application is NOT PERFORMED. Before hosted use, review the committed LF migration checksums, take a verified backup and apply the canonical chain plus manifest provisioning under separate authorization. Rollback is restore/forward repair, not dropping ledger histories. Existing UI/API clients must deploy with their schema/policies; full IndexedDB/outbox behavior remains Phase 7.

## Security review and audit fixes

- Current FARMER tenant membership and active farm membership precede every service read/write. Nested IDs and pagination anchors are scoped to tenant/farm/item. ADMIN has no implicit farm access. Write authorization is rechecked after receipt/item/batch lock waits.
- Transaction receipts bind retries to actor, operation, normalized payload and farm. Effects, audit receipts, linked accounting records and stock movements commit or roll back together. Transaction-level batch/item locks serialize competing withdrawals and reversals; finance locks serialize settlement/corrections.
- Stock balances derive from immutable movements, not quantity overwrites. Effective-date closing balances cannot go negative. Transfers append paired movements; reversals append opposite entries once, preserve originals and reject corrections when stock has been used. Owner membership is the available reviewer role; adjustments retain approvedBy/reason.
- Opening birds enter stock once at the location selected for the first production event. Before placement the existing starting count is labelled separately. Eggs are separate items. Feed/medication are dated usage records with explicit units, not automatic supply-stock consumption or bird decrements.
- Audit fixes: finite numeric CHECKs reject PostgreSQL NaN; maximum-length batch labels remain valid for egg items; public harvest DTOs omit internal request hashes; full production-event history is paginated and reversed records are labelled; inventory summaries bound store previews and link to paginated reconstruction.
- No new secrets, external AI, payment integration, organization role system or offline success claim is introduced. Open-form offline drafts are retained in memory and writes are disabled until online; durable offline persistence/sync is Phase 7.

## Tests and quality evidence

Task-level verified results are recorded in T001-T012 reports. Primary tree: 760 unit/component tests passed; previous full integration checkpoint passed 173 tests; additional security, schema and correction regressions are now included. Migration rollback tests preserve prior rows and schema; native PostgreSQL dump/restore passes for exact stock, approvals, audits, uniqueness, RLS and grants. Actionlint passes for the expanded quality workflow.

Final clean-checkout results are recorded below; the exact hosted run remains pending. No passing result is inferred from a command that has not completed.

## Acceptance and exit gate

| Criterion | Evidence to finalize in T013 | State |
|---|---|---|
| AC001: 2400-1600-150=650 kg; wrong plot/unit rejected | Domain, real DB and desktop/mobile harvest-sale journey | Locally verified in T009/T012 |
| AC002: 100+20-5-10=105 birds; eggs/feed independent | Domain, real DB and desktop/mobile production journey | Locally verified in T006 |
| AC003: 2400-1000-200-50=1150; transfer conservation | Real DB source ledger, concurrent withdrawals, paired transfers and reversal browser journey | Locally verified in T008/T009 |
| AC004: reconstruction equals display for every item/store | Corrupt-projection domain regression, repeatable-read DB comparison, closed-cycle history and desktop/mobile recalculation/history | Locally verified in T010-T012 |
| L: all balances rebuild; concurrency/recovery/security and cumulative gates | Final clean-checkout audit plus GitHub-hosted quality workflow | PENDING |

## Limitations, deferred work and verdict

**Phase not closed; no PASS verdict yet.** Hosted CI is a blocking requirement under D-P05-005. T013 cannot be checked complete until it passes. No local waiver is approved.

Inherited production conditions remain: canonical hosted migrations/policies, retention/export controls and export rate limiting before real farmer production data. Inventory monetary valuation remains unavailable until Phase 8. No bag conversions, stock reservations, automatic accounting-only sale linking, durable offline outbox or later-phase activities/analytics are implemented. Ledger reconstruction reads full internal history for a selected item; response lists are paginated, but large-history performance still requires measurement before production scale. No production readiness claim is made.

## Status-update evidence

T001-T012 each have a separate local commit and linked task report. Final audit will update current phase/status/traceability/architecture summaries and record a per-document status/link review. Historical checkpoints remain historical and the source-extract body is preserved. Next allowed action: finish clean local verification, make the authorized verification push, inspect the exact hosted workflow and only then evaluate closure.

## Clean-checkout verification checkpoint

Application candidate `c6fb24f`, then test-only fixture correction `8c2f66a`, checked out separately at `.cache/p05-clean` with no `.env.local`. Fresh PostgreSQL **17.11** on isolated loopback port 55466, database timezone Africa/Nairobi. No production/provider credentials are used. Logs are retained under ignored `.cache/p05-evidence/`.

| Command/suite | Result | Evidence file |
|---|---|---|
| `npm ci --cache D:/Myfarm/.cache/npm --prefer-offline --no-audit` | PASS, exact lockfile; no dependency change | checks-0.log |
| `npm run db:generate` | PASS | checks-1.log |
| `npm run lint` | PASS | checks-2.log |
| `npm run typecheck` | PASS | checks-3.log |
| `npm run check:boundaries` | PASS | checks-4.log |
| `npm test` | PASS, 760 tests / 41 files | checks-5.log |
| `npm run db:migrate` | PASS, 13 migrations on a fresh database | checks-6.log |
| `npm run test:integration` | PASS, 179 tests / 21 files | checks-7.log |
| `TZ=Africa/Nairobi` selected stock/accounting integration suites | PASS, 43 tests | nonutc-0.log |
| Prisma migration drift (`migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`) | PASS, no difference | checks-8.log |
| `node tests/support/phase05-recovery.mjs` | PASS, real dump/restore | checks-9.log |
| Ordinary production build | PASS | anonymous-0.log |
| `npx playwright install chromium` | PASS | anonymous-1.log |
| `npm run test:e2e` | PASS, 48 anonymous desktop/mobile tests | anonymous-2.log |
| Fixture-auth production build | PASS | signed-0.log |
| Full signed-in desktop/mobile suite | PASS, 104 tests on corrected fixture commit 8c2f66a | signed-1.log |
| `npm audit --omit=dev` | PASS, 0 production dependency vulnerabilities | primary session output |
| Actionlint, diff whitespace and document targets | PASS | session output / document review |
| GitHub-hosted quality | PENDING authorized verification push; required for closure | to be recorded |

The first full signed-in run passed all 100 legacy checks but failed the four new cases because preceding tests intentionally expired fixture sessions. Commit `8c2f66a` resets only those generated fixture sessions/memberships and clears linked stock/accounting fixtures in dependency order. No assertion or application authorization check was weakened. Initial failed evidence is retained as `signed-initial-failed.log` and `signed-initial.json`; the whole suite is rerun.

Committed LF migration SHA-256 checksums, independently matched against the clean database history:

| Migration | SHA-256 |
|---|---|
| 202610290001_harvest_inventory | b79ff352641e3ea3f3c34071535ad4107b757a58f78516c5b9931dfd95365bb5 |
| 202610290002_harvest_scope | 848cff97a7354a16638d00d768628594f7f4d82e20283e9e0820666b76afdc67 |
| 202610290003_poultry_production | f5207d6ffffad2d033e1bce5e014b718a0a5c56d70c33aae1249f9a2cbe578e3 |
| 202610290004_stock_operations | 3f1b5835ccaf20f972b4aaa731aa0a18e1ea94818a3b8d161f8bba7552341ca8 |
| 202610290005_stock_integrity | 46c800b3a911bbd332d8598f3d785049d5caaaae2023e5c7d7f42ae7a365c9b2 |

The pre-existing `next-env.d.ts` dev-route imports are preserved and excluded from phase commits. No source-extract body or package manifest/lockfile changed. [Every-document review](phase-05-document-review-2026-10-29.md).

Local audit verdict: **PASS** at application candidate `c6fb24f` plus test-only correction `8c2f66a`. The corrected full signed-in suite passes 104/104. All four acceptance criteria are locally verified; the final implementation tree has no failing local quality gate. Phase verdict remains **PENDING hosted CI**, not closed, under D-P05-005. The authorized verification push is the next step.
