# Phase 13 staged software closeout - 2026-11-21

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED - Phase 13 T002-T007 staged implementation and local audit.
- Implementation status: COMPLETED - 7/7, PASS WITH CONDITIONS - LOCAL VERIFICATION.
- Last reviewed: 2026-11-21 (Africa/Nairobi).
- Related phase/task IDs: MYF-P13-T001 through T007; D-P13-001 through D-P13-004.
- Verified completed work: All seven software tasks verified in the approved synthetic-forecast scope; no live weather or reviewed agronomic thresholds claimed.
- Remaining work/blockers: P13-C1 through C5, inherited release conditions and owner acceptance; Phase 14 not authorized.
- Evidence/report links: [Phase 13 closeout](phase-13-closeout-2026-11-21.md).
<!-- MYFARM-STATUS-END -->

## Phase identity and implementation scope

Work began on 2026-11-20 and closed locally on 2026-11-21 (Africa/Nairobi), on the Phase 13 candidate based on predecessor `fe546db`. The final commit identifier is reported after the Git operation.

Verdict: **PASS WITH CONDITIONS - LOCAL VERIFICATION, synthetic-forecast scope**. The owner authorized T002-T007 and the final commit/push, then explicitly approved unpersisted test forecasts/stages, six synthetic capabilities and an exact separately confirmed real one-off activity-date change (D-P13-003/004). This is not a live-weather or agronomic release. Phase 14 is not authorized. Phase 12's inherited field, privacy and hosted application-journey conditions remain.

The farmer opens Weather tests on an authorized farm, optionally selects a crop and enters its observed stage, checks a named synthetic scenario, and sees approximate district, provenance, issue/validity/expiry times, six test capabilities and any affected spraying task/date. Missing context and unavailable/stale signals reduce or prevent assessment. No no-rain result asserts suitability. A one-off spraying activity may be moved only through a separate exact date review and initially unchecked consent. Editing invalidates review; a lost response retries the identical confirmation and recovers its receipt. Recurring work remains in the existing series workflow. No weather/stage is persisted, no task is automatically changed, and offline checks or moves are not queued or represented as saved.

| Task | Verified implementation |
|---|---|
| T001 | Strict bounded synthetic forecast/context contract, existing farm calendar and pure rain/spraying evaluation; original task report preserved |
| T002 | Current farm/actor authorization, existing authorized activity/crop service reads, parent consistency, coarse-place-only bounded adapter, strict output and post-provider access recheck |
| T003 | Farm weather page/navigation and activity link, explicit test/expiry/uncertainty presentation, missing context, mobile/error/offline behavior; source example in real browser |
| T004 | Six versioned synthetic fixture capabilities; deterministic selection without invented numerical agronomic thresholds, stage inference or treatment instructions |
| T005 | Exact current review/payload/version/date/expiry confirmation; actor/request serialization, row locking, repeated current-access checks, atomic date/version update and immutable audit receipt |
| T006 | Separate initially unchecked review, edit/discard/expiry handling, retry-safe lost responses, paged choices retaining older selected activities, real confirmed browser date changes |
| T007 | Full quality/security/integrity audit, failure remediation, fresh provisioning/drift, three recovery rehearsals, visual inspection and this evidence-backed staged verdict |

AC001 and AC002 pass in the explicitly approved staged scope: contextual task/time/provenance, missing GPS/stage/timezone, six synthetic capabilities, provider failures, no duplicate results/effects and confirmed date changes. The L invariant holds for these test signals and exact writes. Expert operational rules and real forecasts remain P13-C1, not an implicitly satisfied live gate.

## Changes and migrations

Main files: src/modules/weather-intelligence/{contracts,domain,application,infrastructure}, src/components/weather/weather-form.tsx, farm weather page/loading and three private POST routes (weather/check, review, confirm). Existing ProductionShell, ProductionPagination (optional cursor key/accessible label), activity/crop services, farm authorization, identity/date/types/labels, FoundationError, private HTTP wrappers, same-origin/SAVE limits, audit model and PostgreSQL locking are reused. No application dependency was added or upgraded; no external provider request/account/secret, new queue or ORM was introduced. Existing T001 changes are included in the final cohesive commit.

**No new Prisma migration, table or IndexedDB/sync schema.** One additive provider file, supabase/policies/weather-runtime.sql (SHA-256 `cb160e782d22f4b2888ee4191e497823eea7bff19ed1002798d65d7b99049da3`), is ordered before browser-role-lockdown in supabase/provisioning.json (19 SQL files total). It grants the backend date column and adds a narrow scheduled one-off spraying policy plus a trigger guarding same-status updates: only due date, version increment and update time may change, while finished/recurring work stays protected. The shared backend role is trusted to enforce current actor/farm access; this is not per-person RLS isolation.

All 26 existing migrations and the entire provisioning manifest pass on fresh synthetic PostgreSQL 17, container myfarm-p13-audit-20261120, loopback port 55482, database myfarm_phase01_test. Drift is zero there. **The new policy was NOT applied to hosted development or production.** Apply the complete manifest with separately authorized backup/recovery before enabling date changes on hosted code. Existing hosted legacy LivestockBatch drift is unaffected. Rolling application code back is compatible with the additive policy/guard; retain all date-change audits and activity history. No destructive migration, reset, hosted setting or deployment command was executed.

## Security review

Anonymous/forged-scope requests, cross-tenant and same-tenant cross-farm nested IDs, revoked membership/session, unknown input/provider fields and malformed/stale evidence are refused. Providers receive only a coarse synthetic place key and abort signal, not actor/farm/crop/task data. Calls have a 1.5-second deadline and cancellation; callbacks that fail or ignore cancellation produce an unavailable report. Stage stays in the open request/page only; an irreversible payload digest, dates, actor and target are retained in the existing audit receipt, not raw stage or forecast content.

The confirmation digest binds current server actor/farm scope, exact task/version/old and new dates, scenario/stage/crop, current forecast and expiry. The receipt additionally binds the normalized entire confirmation, so changed replays conflict. Identical successful retries can recover the same historical receipt after forecast expiry, only after current authorization. Writes recheck current account/memberships after advisory and activity-row waits, compare parents/district/version and check expiry using the DB clock, including in the conditional UPDATE. Expiry/revocation after a row-lock wait rolls back receipt and date. Distinct concurrent moves serialize against the version; only one succeeds. Full online session checks precede each request; instantaneous session revocation during an already executing DB transaction is not claimed to be serialized with that transaction.

The UI validates every displayed response field, clears consent/review after edits, locks uncertain submissions to their original payload and links to the saved activity for checking an unresolved result. No financial/stock figure or record is computed or modified. Audit/dependency/bundle boundaries expose no new secrets. A newly added runtime trigger closes a potential privilege expansion that would otherwise have allowed edits to other scheduled task fields.

## Tests and quality evidence

All final checks pass: **1384 unit/component, 439 integration, 43 non-UTC, 82 anonymous, 20 focused weather and 258 full signed-in desktop/mobile tests**. Both normal production and signed-in fixture builds pass, as do lint, TypeScript, boundaries, fresh migrations/provisioning, zero fresh-schema drift, stock/activity/voice recovery and production dependency audit (0 vulnerabilities). Integration tests use the real restricted runtime role. The activity restore now verifies exact weather move receipts, guarded dates, RLS and grants alongside earlier activity/series/photo/cost invariants. Its seeded history tests restoration; service behavior is independently tested through actual transactions.

| Exact command | Result | Evidence |
|---|---|---|
| `npm run lint` | PASS, exit 0 | [lint](evidence/phase13-closeout-2026-11-21/lint.log) |
| `npm run typecheck` | PASS, exit 0 | [typecheck](evidence/phase13-closeout-2026-11-21/typecheck.log) |
| `npm run check:boundaries` | PASS, exit 0 | [boundaries](evidence/phase13-closeout-2026-11-21/boundaries.log) |
| `npm test` | PASS, exit 0 | [unit](evidence/phase13-closeout-2026-11-21/unit.log) |
| `npm run db:migrate` | PASS, exit 0 | [migrate](evidence/phase13-closeout-2026-11-21/migrate.log) |
| `npm run test:integration` | PASS, exit 0 | [integration](evidence/phase13-closeout-2026-11-21/integration.log) |
| `npm run test:integration -- tests/integration/weather-service.test.ts tests/integration/activity-service.test.ts tests/integration/activity-lifecycle.test.ts` | PASS, exit 0 | [non-utc](evidence/phase13-closeout-2026-11-21/non-utc.log) |
| `node node_modules/prisma/build/index.js migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` | PASS, exit 0 | [drift](evidence/phase13-closeout-2026-11-21/drift.log) |
| `node tests/support/phase05-recovery.mjs` | PASS, exit 0 | [stock-recovery](evidence/phase13-closeout-2026-11-21/stock-recovery.log) |
| `node tests/support/phase06-recovery.mjs` | PASS, exit 0 | [activity-recovery](evidence/phase13-closeout-2026-11-21/activity-recovery.log) |
| `node tests/support/phase12-recovery.mjs` | PASS, exit 0 | [voice-recovery](evidence/phase13-closeout-2026-11-21/voice-recovery.log) |
| `npm audit --omit=dev --json` | PASS, exit 0 | [audit](evidence/phase13-closeout-2026-11-21/audit.log) |
| `npm run test:e2e -- --reporter=line` | PASS, exit 0 | [anonymous-browser](evidence/phase13-closeout-2026-11-21/anonymous-browser.log) |
| `npm run build` | PASS, exit 0 | [fixture-build](evidence/phase13-closeout-2026-11-21/fixture-build.log) |
| `npm run test:e2e -- --config playwright.production.config.ts tests/browser/weather-ui.spec.ts --reporter=line` | PASS, exit 0 | [weather-browser](evidence/phase13-closeout-2026-11-21/weather-browser.log) |
| `npm run test:e2e -- --config playwright.production.config.ts --reporter=line` | PASS, exit 0 | [signed-in-browser](evidence/phase13-closeout-2026-11-21/signed-in-browser.log) |
| `npm run lint` | PASS, exit 0 | [final-lint](evidence/phase13-closeout-2026-11-21/final-lint.log) |
| `npm run typecheck` | PASS, exit 0 | [final-typecheck](evidence/phase13-closeout-2026-11-21/final-typecheck.log) |
| `npm test` | PASS, exit 0 | [final-unit](evidence/phase13-closeout-2026-11-21/final-unit.log) |
| `npm run build` | PASS, exit 0 | [final-build](evidence/phase13-closeout-2026-11-21/final-build.log) |
| `npm run test:integration` | PASS, exit 0 | [post-audit-integration](evidence/phase13-closeout-2026-11-21/post-audit-integration.log) |
| `npm run test:integration -- tests/integration/weather-service.test.ts tests/integration/activity-service.test.ts tests/integration/activity-lifecycle.test.ts` | PASS, exit 0 | [post-audit-non-utc](evidence/phase13-closeout-2026-11-21/post-audit-non-utc.log) |
| `npm run test:integration -- tests/integration/weather-service.test.ts` | PASS, exit 0 | [post-context-integration](evidence/phase13-closeout-2026-11-21/post-context-integration.log) |
| `npm run build` | PASS, exit 0 | [post-ui-fixture-build](evidence/phase13-closeout-2026-11-21/post-ui-fixture-build.log) |
| `npm run test:e2e -- --config playwright.production.config.ts tests/browser/weather-ui.spec.ts --reporter=line` | PASS, exit 0 | [post-ui-weather-browser](evidence/phase13-closeout-2026-11-21/post-ui-weather-browser.log) |
| `npm run build` | PASS, exit 0 | [post-ui-default-build](evidence/phase13-closeout-2026-11-21/post-ui-default-build.log) |

The first focused integration attempt was denied loopback access by the sandbox; the unrestricted retry passed. The first component fixture used an unrealistic 2099 expiry that overflowed the browser timer; it was corrected to an actual short test validity without weakening assertions. The first full integration run had 434 pass/4 setup skips because the historical Phase 3 catalog fixture applied the new weather policy before ProductionActivity existed; adding it to the fixture's existing later-phase exclusion list fixed the setup. The fresh-database complete rerun passed 438. Browser tests then exposed select accessible-name/premature retry-label defects, a navigation-wait race, and weather fixture rows crowding the next mobile calendar test. The UI states and labels were fixed; the new test waits for the committed page, and each weather test removes only its own seeded activities/audits. Failed full attempts were stopped and preserved before restarting; no calendar assertion was changed. The final full browser run passes. Final API review also canonicalized UUID letter case for exact grant/replay consistency. A separate complete integration run on the independent synthetic myfarm-voice-20261119 database at loopback 55479 passed 439, including that new regression; the corresponding non-UTC run passed 43. Failed logs are retained with the successful results; no assertion or production integrity rule was removed.

Visual evidence: [desktop](evidence/phase13-closeout-2026-11-21/review-desktop.png), [mobile](evidence/phase13-closeout-2026-11-21/review-mobile.png). Touch/keyboard controls, separate consent, no horizontal overflow and screen-reader status/error feedback were exercised. These are synthetic sessions/records, not field or native-speaker evidence. No new hosted CI result is claimed until the final pushed commit is actually checked.

The final review also added authoritative enterprise/plot labels to the activity choices and exact date review, bound those labels into the review digest, and labeled the two pagination groups visibly. After this display/context addition, all 14 affected database tests and all 20 weather desktop/mobile checks passed again, and both fixture and normal builds passed. The final 1384 unit/component tests, lint and TypeScript checks include this addition. The preceding complete 258-test browser and 439-test integration results remain recorded separately rather than being described as a newly repeated full run after that addition.

Console captures are decoded from their original UTF-8 (Node) or UTF-16LE (PowerShell) encoding and archived as UTF-8. ANSI styling and trailing whitespace were normalized; synthetic cookie/authorization header values in failure traces were redacted. Failure messages and outcomes are retained. `git diff --check` passed during closeout and is checked again on the staged commit.

## Limitations, deferred work and verdict

| Condition | Owner | Required before |
|---|---|---|
| P13-C1 Real provider/license, location mapping, measured forecast quality, live freshness and expert-reviewed agronomic thresholds remain absent; all six signals are fixtures, and no treatment/safety advice is given | Product/agronomic/privacy owners | Any live weather or agronomic release; staged deferral approved D-P13-002/004 |
| P13-C2 New weather runtime policy/guard and actual hosted application verification remain unapplied/unverified | Infrastructure owner | Hosted activity-date changes; separate backup/provisioning and verification |
| P13-C3 Only one-off spraying activities are rescheduled; recurring work uses existing series controls; forecasts/stages remain unpersisted, and no background alert delivery, persistent recommendation history or offline weather queue is claimed | Product owner | Any expansion of the staged scope or retention; D-P13-004 |
| P13-C4 Inherited pilot, real-device, expert, privacy/retention, production recovery and Phase 12 release conditions remain | Earlier closeout owners | Their dependent farmer/production release gates |
| P13-C5 Final owner acceptance and final-commit hosted CI status remain separate from local verification | Owner/engineering | Phase 14 start or relying on that CI run |

No failed mandatory software check is waived. This verdict covers all seven software tasks in the owner's explicitly approved synthetic scope, not empirical agronomic suitability. Next: owner review of this closeout and separately authorized hosted policy rollout/verification; Phase 14 requires its own authorization.

## Status-update evidence

Phase checklist, roadmap, project checkpoint, requirements traceability, decisions and affected architecture notes are updated from these results. The [document review inventory](phase-13-document-review-2026-11-21.md) distinguishes deeper task review from metadata scans; historical source/phase evidence is preserved. The final commit/push result is reported after the observed Git operation; no unobserved deployment is claimed here.
