# Phase 12 closeout - Voice-first farmer experience

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED - approved staged scope, source, implementation, acceptance and actual verification evidence.
- Implementation status: COMPLETED - 100% (10/10), test-adapter/text-fallback scope; PASS WITH CONDITIONS - LOCAL VERIFICATION.
- Last reviewed: 2026-11-20 (Africa/Nairobi).
- Related phase/task IDs: MYF-P12-T001 through T010; MYF-P12-AC001 through AC003; D-P12-001 through D-P12-003.
- Verified completed work: Reviewed expense UI, exact authorized confirmation, bounded provider-independent adapters, language readiness/fallback and full local audit.
- Remaining work/blockers: Real speech release, reviewed language accuracy, hosted provisioning/CI and inherited release conditions remain; owner acceptance of this verdict is pending.
- Evidence/report links: [Check records](evidence/phase12-closeout-2026-11-20/checks.json); [document review](phase-12-document-review-2026-11-20.md).
<!-- MYFARM-STATUS-END -->

## Phase identity and implementation scope

**Phase 12 software: COMPLETED, 10/10, PASS WITH CONDITIONS - LOCAL VERIFICATION, within D-P12-001's approved test-adapter/text-fallback scope.** Date/time zone: 2026-11-20, Africa/Nairobi. Owner: the requesting product owner; engineering implementation/review: this coding session. The owner explicitly requested T003-T010 and a commit after completion (D-P12-003). Owner acceptance of the final verdict and Phase 13 authorization are not inferred.

Candidate source was the working tree on parent `34d1ce602b0b615b7d6fe1e02227c3cec80ba633`. It included the earlier uncommitted, verified Phase 11 transition/security/offline corrections and Phase 12 T001/T002; those prerequisites were preserved and are included in the tested tree to be committed. No unrelated work was discarded. There is no production deployment or hosted verification claim.

The source's exact P0650 sentence, "Today I bought two bags of chicken feed for one hundred eighty thousand.", and the earlier shorthand fixture both yield a proposed total UGX 180000 and two descriptive bags. No date, catalog ID, weight conversion, inventory movement or confirmation is inferred. The user chooses category/date and reviews every consequential field before a distinct confirmation request.

This is not a claim of real speech recognition or translation. The reusable synthetic speech adapter accepts only explicit marker bytes, never real audio; the default speech registry is empty. English, Runyankore/Rukiga, Luganda and Swahili are preference/capability choices with speech unavailable. The English interface and manual expense entry remain available; unrecognized wording and unsupported languages offer manual text entry.

## Task and acceptance evidence

| Task | Delivered and verified |
|---|---|
| T001 | Existing strict feed-expense review contract retained; exact P0650 source sentence added as a second documented fixture; no general-language accuracy claim |
| T002 | Existing persisted private drafts, 30-minute validity, atomic expense/confirmation/receipt retained; reference labels and private outcome reads added without a migration |
| T003 | `/farms/{farmId}/voice`, navigation, shared expense form, accessible exact review, separate unchecked consent, explicit confirm, discard and saved-record receipt; desktop/mobile source oracle |
| T004 | Pure versioned canonical payload and confirmation rules bind actor/tenant/farm/request/version/hash/expiry; preserves T002 hash representation; exact-boundary unit tests |
| T005 | Repository reuses these domain rules under existing transaction/lock/current-membership checks; authoritative selected names, current account/organization revocation, private pending/completed/expired outcome reads and real DB tests |
| T006 | Editing requires a fresh review/unchecked confirmation; expired reviews cannot execute; access/session revocation refuses writes; lost responses retry one grant or resume its receipt after refresh; conflicting windows cannot turn an already committed review into a duplicate |
| T007 | Provider-independent speech/intent contracts, bounded measured-corpus model, word-error evaluator and trusted approval binding to provider/model/language/corpus; unreviewed/unsafe/mismatched evidence never advertises speech |
| T008 | Authorized, bounded read-only input pipeline; strict unknown output validation; permission/consent/offline/timeout/language fallbacks; synthetic adapter and corpus evaluation; no accounting/draft write capability in this service |
| T009 | Four language choices with honest speech-unavailable messaging, example/manual text entry, preservation of selected category/date, source total/bags readback, offline fallback to existing Offline work; desktop/mobile acceptance |
| T010 | Full local checks, security/dependency remediation, three actual dump/restore rehearsals, visual review, diff audit and evidence-backed closeout |

| Criterion / exit gate | Result and practical scope |
|---|---|
| AC001: unconfirmed makes zero records; confirmed total UGX 180000 makes one | PASS: unit, DB and desktop/mobile UI/HTTP; ambiguous/negative confirmation refused, mistaken amount re-reviewed, discard makes no expense, duplicates create one ordinary expense |
| AC002: current actor/scope/exact payload/expiry/idempotency | PASS: wrong actor/farm/tenant/parent, changed amount/currency/date/version/hash, expiry at boundary and after lock waits, revoked memberships/account/session, late rollback, lost response, refresh and conflicting windows |
| AC003: advertised languages require measured accuracy; unsupported offers text | PASS for the authorized staged scope: approval/evidence binding and synthetic evaluation are tested; no real speech language is advertised; all four choices and unknown languages fall back. No real-language accuracy is claimed |
| L: explicit currently authorized exact confirmation before financial commit | PASS locally for the test/text pipeline; every authoritative write goes through ordinary deterministic accounting, its receipt and current access checks in one transaction. No mandatory failing test is waived |

## Changes and migrations

The main files are `src/components/voice/`, `src/app/farms/[farmId]/voice/`, `src/app/api/v1/farms/[farmId]/voice/`, and `src/modules/voice-experience/`. Shared `TransactionForm`, `ProductionShell`, farm navigation, paged choice loaders, labels, validation, formatter, private HTTP wrappers, SAVE limits, existing authorization, accounting writer and receipt logic are reused. New optional expense-form props preserve its ordinary save behavior. No competing component, test stack, state manager, speech SDK, paid service or direct application dependency was added.

API additions: authenticated GET voice/capabilities; same-origin POST voice/intent (suggestion only); private GET voice/drafts/{draftId}/status (pending/completed/expired). Existing draft/patch/confirm endpoints remain. Review responses now include authorized human-readable names. A URL query stores only the draft ID, never words or confirmation consent. Refresh recovers a private pending review or completed receipt; pending confirmation must be checked again. A 409 checks the saved outcome before offering another intent, preventing duplicate expenses after another window commits.

**T003-T010 require no new database migration or IndexedDB/sync schema.** The earlier additive migration `202611190001_voice_expense_drafts` remains the sole Phase 12 migration, with SHA-256 `c068ac1472661399c0d5a9721d53fe1b879a19f8afec3033b1cc43a6d4771037`. All 26 migrations and full provisioning were verified on synthetic PostgreSQL 17, container `myfarm-voice-20261119`, loopback port 55479, database `myfarm_phase01_test`; drift is zero. Runtime tests use the actual restricted `myfarm_runtime` role and real provisioning SQL with provider emulation. Nothing was applied to hosted development/production.

Dump/restore rehearsals preserve stock and activity invariants and the new voice fixture's exact expense, actor/farm binding, review/hash/expiry, immutable confirmation, audit receipt uniqueness, row security and browser/runtime grants. The voice rehearsal seeds synthetic history to test restoration; financial service behavior is verified separately by the real service tests. All temporary restore databases and fixture rows are removed by their guarded teardown.

Rollout requires separately authorized backups/recovery and the complete ordered migrations/provider policy list before code deployment. Farm export queries the draft table, so code must not precede its schema. There is no destructive down migration: roll back application code while retaining financial records, additive draft history and immutable receipts. No deployed app, production setting, shared database, audio bucket or provider account was changed.

## Security review and findings

Authorization remains server-side and current: anonymous calls fail before scoped data validation; every draft/outcome lookup binds the actual actor and farm; parent links are checked under that farm. Membership/account checks repeat after lock/receipt waits. Browser roles have no direct table privileges. The trusted backend DB role has the application's existing broad reads; privacy depends on scoped server queries, not a false per-farmer RLS claim for that shared role.

The input service receives only bounded words or internal ephemeral bytes and a language identifier, not actor/farm IDs or write handles. Unknown provider fields, scope/confirmation injection, mismatched languages and malformed output are rejected. A 1.5-second stage deadline aborts provider calls; typed text/transcripts are bounded to 500 characters and internal audio to 1 MiB. Corpus evaluation is bounded to 30 supplied cases. Measurements alone are not approval; trusted matching provider/model/language/corpus review is required. Default production configuration has no speech registrations and microphone Permissions-Policy stays disabled. No microphone/browser audio endpoint, audio storage, raw transcript persistence or new local storage was added.

The review UI uses exact money strings and display-only formatting. Bags do not define kg or multiply the total. Consent is a dedicated boolean in a separate exact-grant request; a transcript saying yes cannot confirm. Pending/failed details stay on the open page, reviews can resume from the server, and response uncertainty locks edits until the existing result is recovered. Offline users are told to reconnect or use the already implemented Offline work; voice confirmation is not silently queued or represented as saved offline.

Findings remediated during this work:

1. Review labels initially could have missed later pages of choices. They now come from authorized server lookups of the selected records, including the batch's resolved enterprise.
2. A success announcement replaced the heading role. Success now uses a live region while retaining its heading. Browser selectors were scoped to distinguish app errors/offline messages from the existing navigation and Next.js announcer; the expiry test installs its clock before timer creation.
3. Refresh after a lost response could lose the outcome on screen. An actor-scoped outcome read and draft-ID URL resume recover pending reviews or completed receipts without posting again. Conflicts first recover an already committed expense; conflicting pending reviews replace both displayed and edit details and clear consent.
4. Source review found the exact P0650 sentence uses spelled-out numbers. The test adapter now recognizes that exact sentence as well as its earlier shorthand; both remain bounded fixtures, not a general parser. Today and category selection remain explicit farmer inputs.
5. The dependency audit found a new high-severity chain rooted in Effect's template-literal regex issue. The [upstream advisory](https://github.com/advisories/GHSA-7589-6fvf-x4pw) identifies 3.22.1 as patched. A narrowed `@prisma/config` override changes only `effect` 3.20.0 to 3.22.1; Prisma stays 7.10.0, and all direct dependency versions stay as they were at this task's start. npm's proposed major Prisma downgrade and a broad audit-fix upgrade were rejected. The replacement remains MIT-licensed, introduces no new concern/library and has no new farmer-facing bundle import. No application use of the vulnerable Effect schema API was found. Full checks were rerun on the patched tree; the final production audit reports zero vulnerabilities. Existing nine moderate development-tool findings remain explicitly unclaimed as fixed.

6. A final regression test reproduced losing a later-page selected enterprise when example words remounted the form, and on reopening the saved review. Prefills now reset form values while retaining loaded choices; editing adds the server-authorized selected label to the initial choices. Pending conflicts remount with the recovered authorized choices, while expired edits retain the choices on the open form. The regression and affected expense/voice journeys pass.
7. The combined post-fix browser run exposed accounting-fixture cleanup deleting an expense still referenced by a preceding voice test. Fixture cleanup now deletes synthetic voice drafts before accounting records, preserving the production FK. The failed run (26 pass, 6 setup failures) and successful complete rerun are both retained as evidence; no assertion or production constraint was weakened.

The working tree also contains the earlier verified Next.js 16.4.6 security patch and offline lease-recovery corrections. They were preserved and revalidated by this complete candidate audit, not introduced as unrelated refactors here.

## Tests and quality evidence

Results: **1360 unit/component**, **425 real-database integration**, **49 non-UTC targeted integration**, **78 anonymous desktop/mobile**, and **238 full signed-in desktop/mobile tests**, all PASS. The full signed-in suite preceded the final selected-choice correction; **32 affected voice/accounting desktop/mobile tests** passed after that correction, along with refreshed unit/component, lint, TypeScript, boundaries and both builds. Unchanged backend integration, drift, three recovery rehearsals and production audit remain passing. These are local results, not hosted CI or field measurements.

| Exact command | Final result | Evidence |
|---|---|---|
| `npm run lint` | PASS, exit 0 | [log](evidence/phase12-closeout-2026-11-20/lint.log) |
| `npm run typecheck` | PASS, exit 0 | [log](evidence/phase12-closeout-2026-11-20/typecheck.log) |
| `npm run check:boundaries` | PASS, exit 0 | [log](evidence/phase12-closeout-2026-11-20/boundaries.log) |
| `npm test` | PASS, exit 0 | [log](evidence/phase12-closeout-2026-11-20/unit-component.log) |
| `npm run db:migrate` | PASS, exit 0 | [log](evidence/phase12-closeout-2026-11-20/migrate.log) |
| `npm run test:integration` | PASS, exit 0 | [log](evidence/phase12-closeout-2026-11-20/integration.log) |
| `npm run test:integration -- tests/integration/voice-drafts.test.ts tests/integration/voice-input.test.ts tests/integration/farm-accounting-service.test.ts` | PASS, exit 0 | [log](evidence/phase12-closeout-2026-11-20/non-utc.log) |
| `node node_modules/prisma/build/index.js migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` | PASS, exit 0 | [log](evidence/phase12-closeout-2026-11-20/drift.log) |
| `node tests/support/phase05-recovery.mjs` | PASS, exit 0 | [log](evidence/phase12-closeout-2026-11-20/stock-recovery.log) |
| `node tests/support/phase06-recovery.mjs` | PASS, exit 0 | [log](evidence/phase12-closeout-2026-11-20/activity-recovery.log) |
| `node tests/support/phase12-recovery.mjs` | PASS, exit 0 | [log](evidence/phase12-closeout-2026-11-20/voice-recovery.log) |
| `npm audit --omit=dev --json --fetch-retries=1 --fetch-timeout=20000` | PASS, exit 0 | [log](evidence/phase12-closeout-2026-11-20/production-audit-retry.log) |
| `npm run build` | PASS, exit 0 | [log](evidence/phase12-closeout-2026-11-20/build.log) |
| `npm run test:e2e -- --reporter=line` | PASS, exit 0 | [log](evidence/phase12-closeout-2026-11-20/anonymous-browser.log) |
| `npm run build` | PASS, exit 0 | [log](evidence/phase12-closeout-2026-11-20/fixture-build.log) |
| `npm run test:e2e -- --config playwright.production.config.ts --reporter=line` | PASS, exit 0 | [log](evidence/phase12-closeout-2026-11-20/signed-in-browser.log) |
| `npm run test:e2e -- --config playwright.production.config.ts tests/browser/voice-ui.spec.ts tests/browser/farm-accounting-ui.spec.ts --reporter=line` | PASS, exit 0 | [log](evidence/phase12-closeout-2026-11-20/post-fix-browser.log) |
| `git diff --check` | PASS, exit 0 | [log](evidence/phase12-closeout-2026-11-20/diff.log) |
| `npm run lint` | PASS, exit 0 | [log](evidence/phase12-closeout-2026-11-20/final-lint.log) |
| `npm run typecheck` | PASS, exit 0 | [log](evidence/phase12-closeout-2026-11-20/final-typecheck.log) |
| `npm test -- tests/component/voice-expense.test.tsx` | PASS, exit 0 | [log](evidence/phase12-closeout-2026-11-20/final-voice-component.log) |

The [runner](evidence/phase12-closeout-2026-11-20/verify.mjs) records the explicit loopback environment, per-command exit status and full output. [Final check records](evidence/phase12-closeout-2026-11-20/checks.json) incorporate the separately recorded successful audit retry. The first security failure, subsequent npm endpoint failure and successful retry are preserved; endpoint failure was not called PASS. Archived terminal logs have trailing spaces/tabs and terminal blank lines normalized for the staged whitespace check; their messages, failures and results are preserved ([hash manifest](evidence/phase12-closeout-2026-11-20/log-whitespace-normalization.json)). Original captures remain in the ignored local cache. No mandatory test/assertion is waived. Production audit metadata has zero findings; this does not claim development dependencies are all clean.

Visual QA: [desktop review](evidence/phase12-closeout-2026-11-20/review-desktop.png), [mobile review](evidence/phase12-closeout-2026-11-20/review-mobile.png); touch/keyboard controls, live error/status feedback, exact labels and horizontal-overflow checks were exercised. Browser tests use synthetic sessions and the restricted DB role, not actual farmers, actual speech or a hosted provider.

## Limitations, conditions and verdict

| Condition | Owner | Deadline / approval basis |
|---|---|---|
| P12-C1 Real speech, record/pause/cancel controls, microphone/consent integration, provider processing terms and native-speaker corpora/accuracy thresholds remain unimplemented/unmeasured. No real language is advertised | Product/AI/privacy owner and qualified language reviewers | Before enabling any actual microphone/speech use; staged deferral is explicit D-P12-001 |
| P12-C2 Voice and inherited Phase 10/11 hosted migrations/policies, provider/runtime grants and live verification | Infrastructure owner, separately authorized by owner | Before hosted use; backup/recovery and provisioning order required |
| P12-C3 Physical cleanup/retention of expired unconfirmed selected accounting fields is undecided. Expiry means confirmation invalidity, not deletion; completed receipts follow the approved accounting audit policy | Product/privacy owner | Before retaining real farmers' unconfirmed reviews; D-P12-002 does not invent an erasure policy |
| P12-C4 Inherited real-phone, pilot, expert/financial/agronomic sign-off, retention/production operations and release gates remain | Owners in earlier closeouts | As recorded in P11-C7 and predecessors; no evidence/gate is waived here |
| P12-C5 Nine moderate development-tool dependency findings remain; only the known production Effect chain was patched | Engineering/maintainers | Before production hardening; no all-dependencies-clean claim |
| P12-C6 New hosted CI is not run because this task commits locally without an authorized push; owner acceptance and later phase authorization remain pending | Owner/engineering | Before relying on hosted CI or starting Phase 13; current instruction authorizes the local commit only |

**Verdict: PASS WITH CONDITIONS - LOCAL VERIFICATION, test-adapter/text-fallback scope.** All ten software tasks and all K/L invariants for that explicitly approved scope have passing evidence and no known blocking defect. Real speech, real-language accuracy, deployment and empirical farmer acceptance are not represented as complete. Their conditions precede the dependent real-use capabilities and do not waive failing software tests. No Phase 13 work has started or been authorized by this closeout.

## Status-update evidence

Hosted follow-up, 2026-11-20: under D-P12-004 and explicit local backup/restore approval, all pending Phase 10-12 migrations and ordered provider policies were applied to hosted development. Backup/application-schema restore, record preservation, new checksums, RLS and runtime/browser checks pass; migration status is up to date. Only the documented Phase 3 legacy table drift remains. Hosted CI passed at `6ad820a`. This advances the schema/policy and CI portions of P12-C2/C6; full hosted application verification, owner acceptance and other conditions remain. Earlier local-only statements above describe the original audit. [Detailed outcome and evidence](phase-12-migration-push-2026-11-20.md#successful-authorized-retry---2026-11-20).

Progress is 10 verified task IDs out of 10, not a whole-project percentage. Project status, active phase checklist, roadmap checkpoint, requirements traceability, decision log and affected architecture notes are updated with verified local facts. The [document review inventory](phase-12-document-review-2026-11-20.md) distinguishes deeper task-relevant review from metadata-only scanning; unrelated historical claims and the immutable source extract were not rewritten.
