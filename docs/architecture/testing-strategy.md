# Testing strategy

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — current Phase01 implementation/evidence/status review; no completion inferred from review.
- Implementation status: Phase01 scope COMPLETED — 100% (13/13 verified Phase01 tasks; PASS WITH CONDITIONS — LOCAL VERIFICATION); later-phase scope not counted.
- Last reviewed: 2026-10-08 (Africa/Nairobi), live provider and hosted closeout session.
- Related phase/task IDs: Phase01 foundation T001–T013 (10 verified); cross-phase requirements remain pending; Phase01 review session.
- Verified completed work: T001–T010; live Supabase verification and local quality/security gates PASS; see current closeout.
- Remaining work/blockers: T011–T013 hosted CI/preview/final review pending.
- Evidence/report links: [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](../reports/phase-01-provider-verification-2026-10-08.md).
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
