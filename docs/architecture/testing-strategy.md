# Testing strategy

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED - Phase 5 task-relevant contracts, implementation, status and evidence; historical sections preserved.
- Implementation status: Phase 1-4 accepted with documented conditions; Phase 5 T001-T012 locally verified, T013/hosted CI pending. No whole-architecture completion percentage claimed.
- Last reviewed: 2026-10-29 (Africa/Nairobi), Phase 5 T013 audit.
- Related phase/task IDs: Phase01 MYF-P01-T001–T013; Phase02 MYF-P02-T001–T013.
- Verified completed work: Phase01 scope as previously verified; Phase02: farmer registry contracts/policies/migration/API/tests in this document's area verified (see the Phase 2 implementation section).
- Remaining work/blockers: Required hosted CI before Phase 5 closes; hosted migrations/provisioning and inherited production conditions remain separate gates.
- Evidence/report links: [Current Phase 5 audit](../reports/phase-05-closeout-2026-10-29.md); [document review](../reports/phase-05-document-review-2026-10-29.md). Historical task evidence remains linked below.
<!-- MYFARM-STATUS-END -->

Testing is phase-specific evidence, not a successful build alone. Source Vitest/React Testing Library/Playwright baseline is preserved. No tests have been run: application does not exist.

| Suite | Purpose | Required examples |
|---|---|---|
| Unit/domain | Deterministic business rules and validation | Exact money, stock/flock rebuild, metrics denominators, rule thresholds |
| Component | Mobile entry/error/confirmation/accessibility | Retained inputs, status announcements, keyboard, scope display |
| Integration | Real DB/auth/service/provider contracts | Composite FKs, atomic audit/receipt, rollback, concurrent dedupe/stock |
| E2E | Actual source journeys | Register→farm→cycle→expense/harvest→profit; offline reload/reconnect |
| Security | Scope/privilege failures | Two tenants, guessed IDs/parent, search/export/files/AI/grants |
| Migration/recovery | Safe evolution and restore | Backfill/orphans, version skew, pending outbox, backup restore |
| Provider/AI evaluation | Untrusted/failing integrations | Signature/replay/outage, numeric grounding, prompt injection, language/image uncertainty |
| Load/resilience | Measured budgets under failures | Pool exhaustion, pagination, hot tenant, queue crash, provider uncertainty |

Mandatory scripts each engineering closeout: npm run lint, npm run typecheck, npm test, npm run build. Proposed definitions: explicit ESLint CLI; tsc --noEmit; Vitest run; next build. Exact commands/config depend on pinned versions; no deprecated framework lint assumption. Additional npm run test:integration, test:e2e, test:security, test:migrations and test:load scripts are proposed when applicable; default npm test cannot secretly skip critical integration coverage.

Use isolated seeded tenants/farms; never production data/secrets. Provider fakes cover contracts, sandbox covers authenticity/end-to-end when approved. Mock-only tests cannot prove transaction concurrency/constraints. Record environment, commit, command, exit status, pass/fail/skips, logs and artifact pointers; absence/skipped tests cannot be called PASS.

Golden source fixtures: UGX150,000 expense; 2,400/1,600/150/650 harvest; separate 1,150 stock ledger; 8.4M/5.15M/3.25M/38.7%; feed +18%; wallet80,000. Negative cases include zero denominators, incomplete records, mixed currencies/units, ties, revoked membership while offline and same id/different payload.

Every phase H/K binds test oracle. Run tests, audit, remediate and retest relevant regressions; failed mandatory checks/blockers prevent closure. Phase 0 has research/document reviews and explicitly N/A app scripts until foundation exists. [Definition of done](../engineering/definition-of-done.md) and [closeout](../engineering/phase-closeout-template.md) govern evidence.


## Phase1 implemented evidence and limits

Phase1 has40 unit/component,10 real PostgreSQL integration and14 desktop/mobile E2E passing tests. Lint/typecheck/build/migration/restore pass locally. Hosted CI/provider checks pending. Offline/financial/stock/load checks are N/A for current implemented scope.

[Closeout](../reports/phase-01-closeout-2026-10-08.md); [setup](../engineering/foundation-local-setup.md).

## Phase 2 implementation (2026-10-09)

New verification patterns ([closeout §4](../reports/phase-02-closeout-2026-10-09.md#4-tests-and-quality-evidence)):

- **Restricted-role integration:** an integration suite runs application services through a connection bound to `myfarm_runtime`, with the provider SQL applied verbatim. A policy mutation proves the suite detects regressions.
- **Live harness:** production `next start`, real Supabase Auth, disposable users, verified cleanup.
- **Database checks:** migration replay/drift/second-DB/restore.
- **Anonymous probes:** production probe suite.

Totals: 117 unit/component, 33 integration and 24 E2E tests. Hosted CI remains unverified (P2-C1).

## Phase 3 T003 browser evidence (2026-10-18)

`playwright.production.config.ts` adds a separate signed-in desktop/mobile suite against a guarded, isolated loopback test database. It uses real application authorization, services, PostgreSQL transactions and `myfarm_runtime`, plus a test-only local Auth HTTP server and signed synthetic session cookies. The fake provider is not hosted Supabase verification; application source has no authentication bypass. Fixture setup applies the actual migration/provisioning chain, seeds synthetic identities and returns cleanup. The stand-in grants Auth-session ownership access to its Auth schema for FK cleanup, without changing production grants.

The production build must use the same loopback public Auth URL as the suite because Next.js compiles public environment values. See the [T003 report](../reports/phase-03-t003-2026-10-18.md) for commands and limitations. Results: 204 unit/component, 61 isolated integration, 34 anonymous and 18 signed-in browser checks PASS. These are working-tree checks, not clean-clone CI substitution or a phase closeout. Cycle/batch acceptance and durable offline reload remain pending.

## Phase 3 T004 domain evidence (2026-10-18)

The crop-cycle suite adds 65 command/relationship/date/precision/capacity cases; the full unit/component suite passes 269/269. Lint, typecheck, boundaries and production build pass. Exact intercropping tests include 0.1 + 0.2 = 0.3, one-millionth excess and large areas beyond floating-point precision. Runtime auth, transaction locking, retries, rollback and database constraints are T005 obligations, not proved by pure tests. No integration/browser or migration suite was rerun for this contract-only task. [Evidence](../reports/phase-03-t004-2026-10-18.md).

## Phase 3 T005 evidence (2026-10-18)

Final local results: 279 unit/component, 83 integration, 36 anonymous browser and 24 signed-in browser checks PASS. New database cases cover same-plot competing starts, concurrent duplicates, exact decimal round trips, all allocations beyond one list page, receipt/plot wait revocation, rollback, IDOR, runtime privileges, migration failure and upgrade preservation. The actual provisioning manifest (including new grants) passes fresh/rerun/failure tests. `tests/support/crop-cycle-recovery.mjs` rehearse dump/restore with an explicit loopback test URL and disposable T005 container; cycle, audit and grant boundaries reconcile. Full crop UI acceptance is T006; local Auth fixtures are not hosted Supabase verification. [Evidence](../reports/phase-03-t005-2026-10-18.md).

## Phase 3 T007–T008 evidence (2026-10-19)

T007 adds 81 poultry contract cases. Final T008 local results: 388 unit/component, 103 integration, 36 anonymous and 46 signed-in browser checks PASS. New database cases cover competing requests for one batch label, concurrent duplicates, 0/maximum counts, label case/spacing and closed-batch conflicts, replay snapshots, revocation during a receipt wait, constraints and forged runtime inserts. A dump/restore rehearsal also passes. [T008 evidence](../reports/phase-03-t008-2026-10-19.md).

## Phase 4 T001–T002 evidence (2026-10-25)

T001 adds 108 accounting contract cases; T002 adds 16 service unit, 19 integration, 8 anonymous and 6 signed-in browser cases. Final T002 local results: 599 unit/component, 138 integration, 46 anonymous and 78 signed-in browser checks PASS. Database cases cover the AC001 sale/partial-payment oracle on the restricted runtime role, concurrent payments against one balance, concurrent reversal, exact decimal round trips, replay/changed-replay, foreign links, forbidden direct edits/deletes and non-UTC runs; a dump/restore rehearsal also passes. [T002 evidence](../reports/phase-04-t002-2026-10-25.md).

## Phase 4 T003 evidence (2026-10-26)

T003 adds 15 accounting form component cases, 8 action/settle unit cases, 2 integration cases, 12 signed-in browser cases (AC001 journey, expense/purchase, overpayment and lost response, reversal order, offline, access/revocation/expiry on desktop and mobile) and 2 anonymous page cases. Final local results: 622 unit/component, 140 integration, 48 anonymous and 90 signed-in browser checks PASS. [T003 evidence](../reports/phase-04-t003-2026-10-26.md).

## Phase 4 T006–T016 evidence (2026-10-26)

New cases: 29 report/link domain, 4 report service, 1 link action and 1 link component unit cases; 11 integration cases (links, gross margin, summary, export, access); 8 signed-in browser cases (AC002–AC005 screens, CSV download, denial). Final clean-clone results: 686 unit/component, 154 integration, 44 non-UTC, 48 anonymous and 100 signed-in browser checks PASS; drift and dump/restore PASS. [Closeout](../reports/phase-04-closeout-2026-10-26.md).

## Phase 5 verification scope - 2026-10-29

Phase 5 task reports link 760 unit/component tests, real PostgreSQL concurrency/rollback/provenance/security/reconstruction suites and signed-in desktop/mobile journeys. The expanded quality workflow includes non-UTC checks, migration drift, real dump/restore and signed-in acceptance. Final clean-checkout and hosted results are recorded in the audit; local success alone does not satisfy the owner-required hosted CI gate. [Current audit](../reports/phase-05-closeout-2026-10-29.md).
