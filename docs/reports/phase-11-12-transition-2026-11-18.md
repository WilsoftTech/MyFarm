# Phase 11 closure and Phase 12 start - 2026-11-18

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED - actual implementation, owner decisions and verification evidence.
- Implementation status: REFERENCE ONLY - N/A (evidence report).
- Last reviewed: 2026-11-18 (Africa/Nairobi).
- Related phase/task IDs: MYF-P11-T010; MYF-P12-T001; D-P11-007; D-P11-008; D-P12-001.
- Verified completed work: Phase 11 closeout and Phase 12 domain start verified as described below.
- Remaining work/blockers: Real-provider, hosted, pilot and expert-review conditions remain; Phase 12 T002-T010 pending.
- Evidence/report links: [Project status](../PROJECT-STATUS.md); [Phase 11 closeout](phase-11-closeout-2026-11-13.md).
<!-- MYFARM-STATUS-END -->

## Scope, authorization and verdict

**Phase 11: COMPLETED - 100% (10/10), PASS WITH CONDITIONS, owner accepted. Phase 12: PARTIALLY COMPLETE - 10% (1/10).** The owner requested completion and advancement, selected test adapters/text fallback/no retained audio, and explicitly accepted the existing P11-C4 behaviors. D-P11-007 and D-P12-001 record these decisions. No field-pilot evidence, production deployment, real model accuracy or hosted database change is claimed.

Baseline: main at 34d1ce602b0b615b7d6fe1e02227c3cec80ba633. Existing uncommitted decision/traceability changes, anonymous assistant tests and the closeout draft were preserved and completed; no unrelated work was discarded. The T009 [hosted quality run](https://github.com/WilsoftTech/MyFarm/actions/runs/43317152834) passed. Current changes have local verification; they have not been committed, pushed or verified in hosted CI.

Phase 11 AC001-AC003 remain satisfied: exact farm-specific figures and period/provenance; bounded authorized tools; labels, contradictory-source handling and agronomic uncertainty. The historical clean-checkout log is preserved alongside current working-tree evidence. Phase 12 T001 is domain validation only; none of its three full acceptance criteria is marked complete.

## Audit findings and remediation

1. The closeout contained unfinished audit/CI placeholders and status still said 9/10. Filled them from the existing clean-checkout log, verified T009 CI, and revalidated the current working tree. Updated Phase 11 task checkboxes and the current project/roadmap/traceability records. Historical checkpoints remain historical.
2. The initial PowerShell runner interpreted Prisma's normal stderr diagnostics as a terminating error. Fixed the wrapper to check native exit codes. Its initial run is not recorded as a passing typecheck.
3. Next.js 16.4.3 stopped the build with a security notice. npm audit confirmed two moderate cache-disclosure advisories: [GHSA-mfr8-8qww-v76h](https://github.com/vercel/next.js/security/advisories/GHSA-mfr8-8qww-v76h) and [GHSA-vc7v-qv4w-wrv8](https://github.com/vercel/next.js/security/advisories/GHSA-vc7v-qv4w-wrv8), patched in 16.4.5. Updated only the existing Next.js family to pinned 16.4.6. No affected use-cache/unstable-cache API was found in application code. The production audit passed with zero vulnerabilities after the patch (preserved in the initial postpatch log). An unnecessary repeat after the client-only fix could not reach the npm endpoint; it is recorded as NOT RUN to completion, not PASS. Dependencies were unchanged between these attempts. [Network failure](evidence/phase-transition-2026-11-18/production-audit-network-error.log). npm also reported nine moderate development-tool vulnerabilities; broad development-tool upgrades were not performed and no all-dependencies-clean claim is made.
4. Build diagnostics also contained null bytes. Preserved the generated diagnostic file in ignored local evidence and let the build regenerate it. No source or database reset was used. Both builds passed afterward.

Dependency rationale: this is a same-minor MIT-licensed framework security patch, not a new framework or service. Existing helpers cannot remediate vulnerable framework internals; leaving the pinned vulnerable version was rejected. package.json and package-lock.json agree; Next.js env/compiler variants move with it. npm refreshed peer metadata but no unrelated package versions were upgraded. No force, legacy peer mode or broad upgrade was used. Install reported a locked old compiler cleanup directory; the active compiler and Next.js both report 16.4.6, and the old ignored directory was left intact.

## Verification

Current working tree on Windows, PostgreSQL 17 container myfarm-transition-20261118, loopback port 55476, explicitly synthetic database myfarm_phase01_test. Test setup provisions emulated provider policies and a restricted runtime role. No hosted credentials were used for database tests.

| Exact command | Result |
|---|---|
| npm run lint | PASS, exit 0 after patch |
| npm run typecheck | PASS, Prisma generate and TypeScript, exit 0 after patch |
| npm run check:boundaries | PASS after patch |
| npm test | PASS: 1321 unit/component tests after patch, 21 new voice cases |
| npm run db:migrate | PASS: 25 existing migrations applied to the fresh local database before patch; no migration file changed |
| npm run test:integration | PASS: 400 tests after patch |
| TZ=Africa/Nairobi npm run test:integration -- tests/integration/ai-assistant-service.test.ts tests/integration/farm-export.test.ts | PASS: 23 tests before framework patch; historical clean checkout also passed 242 non-UTC tests |
| node node_modules/prisma/build/index.js migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code | PASS: no difference, exit 0; schema untouched afterward |
| node tests/support/phase05-recovery.mjs | PASS: actual local dump/restore; balances, provenance, uniqueness and grants preserved |
| node tests/support/phase06-recovery.mjs | PASS: actual local dump/restore; activities, recurrence, links, receipts and grants preserved |
| npm run build | PASS after patch |
| npm run test:e2e -- --reporter=line | PASS: 70 anonymous desktop/mobile tests, including the pre-existing uncommitted assistant security tests |
| NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3211 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=fixture-publishable-key npm run build | PASS: fixture build after patch |
| npm run test:e2e -- --config playwright.production.config.ts tests/browser/offline-actions-ui.spec.ts tests/browser/offline-replay-ui.spec.ts tests/browser/offline-shell-ui.spec.ts tests/browser/offline-sync-ui.spec.ts --reporter=line | PASS: 38 focused offline desktop/mobile tests after fix. The initial full run passed 213/214; its one failure was fixed and is included in this passing rerun |
| npm audit --omit=dev --json | PASS after patch: 0 production vulnerabilities, in postpatch-before-offline-fix.log. Later repeat failed to reach npm; dependencies unchanged |

The environment-setting syntax above is explanatory; the exact Windows commands are retained in the [postpatch runner](evidence/phase-transition-2026-11-18/verify-postpatch.ps1). Logs: [initial runner](evidence/phase-transition-2026-11-18/verification.log), [prepatch checks and build failure](evidence/phase-transition-2026-11-18/verification-rest.log), [final postpatch checks](evidence/phase-transition-2026-11-18/postpatch.log), [historical clean checkout](evidence/phase-transition-2026-11-18/p11-historical-clean-run.log).

## Security and data integrity

Existing real-database tests exercise current membership/revocation, cross-farm denial, restricted runtime permissions, concurrent requests, rollback, private question retention and groundedness against adversarial explainers. Browser tests cover anonymous and cross-origin denial and the authorized farmer journeys. No authorization boundary was loosened.

Voice intent output is unknown and strictly parsed. It cannot supply IDs, actor, farm, tenant, dates or confirmation. The farmer's selection reuses the expense DTO; amount/currency come from exact validated strings. Two bags is descriptive and causes no unit conversion or stock movement. The reviewed total is UGX 180000, not 360000. Wrong totals may be corrected and re-reviewed; a typed yes is not confirmation. No provider has a database/write capability. T001 does not yet provide an execution route or persisted confirmation, so there is no new production financial-write surface.

The initial full signed-in run on Next.js 16.4.6 finished with 213 passed and one failed (21.3 minutes). That failure exposed a reload leaving an unexpired SYNCING lease behind; acquiring the exclusive browser lock did not recover it until its two-minute expiry. The fix passes exclusive lock ownership into recovery, allowing immediate replay only when no prior browser sender can remain. The fallback without Web Locks still waits for expiry, and server receipts retain duplicate protection. One deterministic unit regression and a desktop/mobile browser regression were added. All four affected offline suites were rerun after rebuilding, including the original failing test, simultaneous-tab tests and the new unexpired-lease case. The entire 216-test signed-in suite was NOT rerun after this client-only fix; unrelated tests retain their passing baseline evidence. The first focused run passed all 38 assertions but failed global fixture teardown: PilotUsageEvent rows were missing from the fixture-only delete order. Added their scoped deletion before Organization/User, preserving the loopback-only test guard and all runtime constraints. The complete focused suite was rerun with cleanup after this one-line harness correction. No remaining failing test or teardown error is waived. [Fixture failure](evidence/phase-transition-2026-11-18/postpatch-offline-fixture-failure.log); [cleanup follow-up runner](evidence/phase-transition-2026-11-18/verify-fixture-cleanup.ps1). [Initial full run](evidence/phase-transition-2026-11-18/postpatch-before-offline-fix.log).

## Migrations, limitations and next action

No new schema, migration, hosted policy, IndexedDB version, production setting or deployment. The local test container remains available for inspecting evidence. Existing Phase 10/11 hosted migrations remain unapplied; their prior recovery and release requirements remain.

P11-C4 and P11-C5 are resolved. P11-C1/C2/C3/C6/C7 remain with their original owners and deadlines: a reviewed real assistant provider before farmer use; hosted provisioning before hosted use; abandoned-user question cleanup before retaining real questions; question audit policy before production hardening; inherited pilot/expert/hosted conditions. The acceptance of existing alert behavior does not make the assistant purely free of alert lifecycle effects. Inherited real-phone, expert-signoff and pilot gaps are not represented as verified.

Next is Phase 12 T002 after resolving the minimal persisted draft/confirmation model and expiry: current actor and farm binding, exact payload identity, edit invalidation, atomic confirmation/receipt/expense, concurrent duplicate and lost-response replay, authorization recheck and rollback. The existing accounting service and Phase 7 command receipt pattern should be reused. Later UI must address the current microphone=() Permissions-Policy deliberately. Actual transcription, audio capture/storage, offline speech, language accuracy, provider accounts and Phase 13 remain outside this delivery. Text fallback is approved, not yet a delivered voice UI.

[Document review inventory](phase-11-12-document-review-2026-11-18.md) records metadata scanning versus deeper review; source extract content was not edited.
