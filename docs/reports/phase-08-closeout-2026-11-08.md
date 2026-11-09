# Phase 8 closeout - 2026-11-08

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED - Phase 8 requirements, implementation, security and verification evidence.
- Implementation status: COMPLETED - 100% (13/13 verified tasks), PASS WITH CONDITIONS - HOSTED CI VERIFIED, owner accepted 2026-11-09 (D-P08-014).
- Last reviewed: 2026-11-08 (Africa/Nairobi).
- Related phase/task IDs: MYF-P08-T001 through MYF-P08-T013; MYF-P08-AC001 through MYF-P08-AC004; D-P08-001 through D-P08-013.
- Verified completed work: T001-T013 and AC001-AC004 verified from a clean checkout of af8defd on a fresh database, and by hosted CI run 42415795028 at 430dd8a.
- Remaining work/blockers: Conditions P8-C1 to P8-C5 below stay open, notably the hosted schema step. Phase 9 not started.
- Evidence/report links: [Phase specification](../phases/phase-08-analytics-profitability.md); [Plan and T001](phase-08-start-2026-11-03.md); [Formula catalog](../architecture/metric-formulas.md); [Document review](phase-08-document-review-2026-11-08.md); [Project status](../PROJECT-STATUS.md).
<!-- MYFARM-STATUS-END -->

## Phase identity and implementation scope

Farm Analytics and Profitability Engine, Africa/Nairobi, engineering agent under owner authorizations D-P08-001 (start, commit per task) and D-P08-012 (finish and push). Audited application commit `af8defd230fd5a71d42a0f68cfe8c1900752a454`.

"How the farm is doing" (`/farms/{farmId}/accounting/how-the-farm-is-doing`) shows, for a season (the latest active one by default), all records or chosen dates, in the accrual or cash view:

- **R001:** money earned, money spent, **recorded surplus** and margin per currency, an enterprise comparison by gross margin, and amounts linked to no enterprise or season (D-P08-002, D-P08-008). Nothing is called net profit.
- **R002:** per crop, acres, yield per acre, cost and revenue per acre, and cost per kg as the break-even price. Per poultry batch, birds started, mortality, and cost and revenue per bird. Also labour and input costs, and stock value as a labelled estimate kept out of the surplus (D-P08-003 to D-P08-006, D-P08-009 to D-P08-011).
- **R003:** "Compared with before": each crop against its most recent earlier season, each batch against the previous batch of the same animal, with earlier figure, current figure and change. A missing or zero baseline is "Not available" with a reason, never 0 (D-P08-007).
- **R004:** the screen's figures are checked to add up by independent paths, and a plain warning appears if they ever do not. The source farmer journey passes with offline entry and replay, and later-phase capabilities are absent.

Every figure is calculated live on the server from source records with integer arithmetic and rounded once, for display. The proposed `MetricSnapshot` and `ReportDefinition` tables were not built (D-P08-008). Expenses and purchases gained an optional poultry batch, online and offline (D-P08-003).

Not included: net income, allocation of shared costs, a costing method for stock, explanations of trends (left to later phases), offline viewing of the farm screen, and anything from Phase 9 onward.

## Changes and migrations

Module `src/modules/analytics-profitability/{contracts,domain,application,infrastructure}`; screens in `src/components/analytics/` and the page above; batch fields on the accounting forms and offline expense form. Read-only routes, each authenticating and validating before it reads, with private no-store headers: `GET /api/v1/farms/{farmId}/profitability`, `.../profitability/metrics`, `.../profitability/trends`.

| Additive migration | SHA-256 (committed LF) |
|---|---|
| 202611040001_metric_links | 4aaf149e0c5126a533c13f069adeaa18a77e88482527362bd49a7ffb41d920d7 |

It adds nullable `AccountingRecord.batchId` (same-farm composite foreign key, index) and nullable `TransactionCategory.costGroup` with the seven approved groups seeded by ID. `supabase/policies/farm-accounting-runtime.sql` allows a batch link only on an expense or purchase naming the batch's own enterprise. **Applied only to disposable PostgreSQL 17 databases, not to hosted.** The migration is one transaction and both columns are nullable, so earlier code keeps working; rollback is restore from backup, as for earlier phases. No dependency was added.

The offline cache gained a `POULTRY_BATCHES` section, added last so pull cursors already issued stay valid.

## Security review

- Every service call derives tenant and farm from current membership. A farm of another tenant, a season of another farm and a guessed season are refused the same way before any record is read. Forged tenant or unknown filters are rejected. Tested in the service, the database under the restricted runtime role, and over HTTP for all three routes, including another farmer, an administrator and an ended session.
- The batch link is checked in the service and again by the database policy, so a forged link from the runtime role is refused (T005 test).
- Reading writes nothing: tests confirm no audit or receipt rows appear and repeated reads are identical.
- Offline money and harvest replays go through the existing push service: a lost reply, racing retries and an interrupted batch produce exactly one effect each, and another farm's entry is denied with no effect (T011).
- No AI, payment provider, messaging or lending code or package exists; a source guard enforces this (T010).

Findings during the phase, each fixed:

1. T006: a batch paired with a different enterprise was refused without saying why; the form now explains it.
2. **T009 audit: a Phase 7 race on `/offline`.** A load that started before the farmer chose a farm could finish afterwards and put the earlier farm back, so entries could be offered for the wrong farm. Found as a 1-in-6 browser failure; fixed in add2d13 so only the newest load applies. The fix is covered by the existing browser test (8 further runs pass), not a dedicated unit test.
3. T013 audit: a double type cast on the accounting form lacked the explanation AGENTS.md requires. A comment now explains it (comment only, after the audited commit). The server validates every command regardless.

## Tests and quality evidence

Clean clone of `af8defd`, no `.env.local`, fresh PostgreSQL 17 container, Windows. Logs are in ignored `.cache/p08-evidence/`.

| Command/suite | Result |
|---|---|
| `npm ci`, `npm run db:generate` | PASS |
| `npm run lint`, `npm run typecheck`, `npm run check:boundaries` | PASS |
| `npm test` | PASS, 1145 tests in 59 files |
| `npm run db:migrate` | PASS, 18 migrations on a fresh database |
| `npm run test:integration` | PASS, 318 tests in 31 files |
| `TZ=Africa/Nairobi` stock, accounting, activity, offline and analytics suites | PASS, 180 tests in 13 files |
| Prisma migration drift | PASS, no difference |
| `phase05-recovery.mjs`, `phase06-recovery.mjs` (real dump and restore) | PASS |
| `npm run build`, ordinary and fixture | PASS |
| `npm run test:e2e` anonymous | PASS, 60 tests |
| Signed-in desktop and mobile suite | PASS, 176 tests |
| `npm audit --omit=dev` | PASS, 0 vulnerabilities (the full tree including dev tools reports 9 moderate) |
| `actionlint` on `quality.yml` | PASS |
| GitHub-hosted CI, run [42415795028](https://github.com/WilsoftTech/MyFarm/actions/runs/42415795028) at 430dd8a | PASS: 1145 unit/component, 318 integration, 180 non-UTC, 60 anonymous and 176 signed-in browser tests, drift and recovery rehearsals |

The CI workflow's non-UTC step now includes the four Phase 8 integration suites.

## Acceptance and exit gate

| Criterion | Evidence | State |
|---|---|---|
| AC001: 8,400,000 − 5,150,000 = 3,250,000 UGX; margin 38.7%; enterprise totals match | Source dashboard fixture in domain, database and browser; filters, ties, empty states, corrections | PASS locally |
| AC002: each metric has numerator, denominator, unit, currency and missing outcome; unknown valuation unavailable | Approved catalog examples (700,000 per acre, 560 per kg, 2.9% mortality, 5,000 per bird); zero area, harvest and flock; mixed currencies; never-sold stock | PASS locally |
| AC003: feed 100,000 → 118,000 is +18%; absent or zero baseline unavailable | Exact-figure fixtures; crop and batch trends on real records and on screen; incomparable crops, animals and seasons | PASS locally |
| AC004: gates 0-8 evidenced; source farmer journey passes; future functionality absent | [Gate register](phase-08-t010-2026-11-07.md#gate-register-phases-0-to-8); offline replay regression and browser journey; scope guard and 404 routes | PASS locally, with the Phase 0 note below |
| L: metrics reconcile; farmer workflow works offline and on reconnect; no AI, marketplace, payments or lending | Reconciliation in every view on the journey; all of the above | PASS locally |

**Phase 0 note:** the register shows every gate from 0 to 8 with a recorded verdict and evidence. Phase 0 was closed by owner acceptance without empirical farmer evidence; that evidence is what the Phase 9 field pilot is for. AC004 is met as written, but that gap is not hidden.

## Limitations, deferred work and verdict

**Recommended verdict: PASS WITH CONDITIONS - HOSTED CI VERIFIED.** All 13 tasks and four acceptance criteria pass from a clean checkout, and no mandatory test is waived. The conditions below need owner acceptance. This closes the MVP build, not a production release.

| Condition | Owner | Deadline |
|---|---|---|
| P8-C1: apply `202611040001_metric_links` and rerun `farm-accounting-runtime.sql` on hosted development, with a verified backup. Until then, hosted pages that read money records will fail, because the code reads the new column | Project owner / engineering | Before any hosted use of this code |
| P8-C2: have an accountant and an agronomist review the formula catalog (open since D-P08-011) | Project owner | Before the Phase 9 pilot relies on the figures |
| P8-C3: decide whether offline expense and income forms should offer a season. Today, money recorded offline shows as "not linked to a season" in a season view until edited online | Project owner | Before the Phase 9 field pilot |
| P8-C4: scale. Trends compare within the newest 100 seasons and 100 batches, and the farm screen reads the farm's records three times per request. Inherits P5-C2 | Engineering | Before real farmer production data at scale |
| P8-C5: review engineering choices: the most recent earlier season or batch as the baseline, same-day batches not compared, no crop trends in a date view, and the reconciliation warning wording | Project owner | Before the Phase 9 field pilot |

Open conditions from earlier phases carry forward unchanged, including P7-C1 (real-device measurement) and P7-C3 (hosted photo schema).

## After the push

Under D-P08-012 the commits were pushed (0298f20..430dd8a). Hosted run [42415795028](https://github.com/WilsoftTech/MyFarm/actions/runs/42415795028) at 430dd8a passed every step with the same counts as the local audit. No GitHub deployment was created; the Vercel and Render check suites have never run on this repository. Nothing was applied to the hosted database, so P8-C1 stands.

The docs-only push 2a8a423 then failed hosted run [42416834117](https://github.com/WilsoftTech/MyFarm/actions/runs/42416834117) on one Phase 7 test, `MYF-P07-AC003 entries saved offline send on reconnecting`, on desktop and mobile, with identical application code. The test read the phone's outbox as soon as "Could not reach MyFarm" showed, but that message can still be on screen from the send made when the page opened, so the test could read it while the new send still held its entries. A test-only fix waits for the send to settle; the spec then passed 40 of 40 runs locally. The application was not changed.

The owner approved the closeout on 2026-11-09 (D-P08-014).

## Status-update evidence

Each of T001-T012 has a commit and report; T013 adds fix add2d13, the CI change af8defd, this closeout and the [document review](phase-08-document-review-2026-11-08.md). Progress: **13/13 = 100%**. Next allowed actions: the hosted schema step, or authorization for Phase 9. No later phase is started automatically.
