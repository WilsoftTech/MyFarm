# Phase 7 closeout - 2026-11-03

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED - Phase 7 requirements, implementation, security and verification evidence.
- Implementation status: COMPLETED - 100% (13/13 verified tasks), PASS WITH CONDITIONS - LOCAL VERIFICATION, awaiting owner acceptance.
- Last reviewed: 2026-11-03 (Africa/Nairobi).
- Related phase/task IDs: MYF-P07-T001 through MYF-P07-T013; MYF-P07-AC001 through MYF-P07-AC004; D-P07-001 through D-P07-008.
- Verified completed work: T001-T013 and AC001-AC004 verified from a clean checkout at 30f2aaf. Hosted CI has not run on this code.
- Remaining work/blockers: Owner acceptance of the conditions below, notably real-device measurement and hosted CI. Phase 8 not started.
- Evidence/report links: [Phase specification](../phases/phase-07-offline-first.md); [Plan](phase-07-start-2026-11-03.md); [Project status](../PROJECT-STATUS.md); [Document review](phase-07-document-review-2026-11-03.md).
<!-- MYFARM-STATUS-END -->

## Phase identity and implementation scope

Offline First Architecture, Africa/Nairobi, engineering agent under owner authorizations D-P07-001 and D-P07-006. Application commit `30f2aaffd6995d7abd5d8d450dc8588c77157697`.

A farmer who has opened MyFarm once while signed in can open `/offline` with no network and record expenses, income, harvests, activities and tasks, take photos, mark cached tasks done, and read saved farms and records. Entries wait on the phone with a visible status and send automatically on opening or reconnecting. A retry, lost response or second tab creates one record. A stale edit asks for review instead of overwriting newer work. Refused entries stay available to fix or discard. Unsent entries can be downloaded as a file.

Owner decisions: 14 days and 500 unsent entries (D-P07-002), per-account data with no PIN (D-P07-003), photos under an interim rule (D-P07-004), warnings and an unencrypted download with no promise of recovery (D-P07-005). D-P07-007 records why the proposed `MutationReceipt`, `ChangeLog` and `DeviceRegistration` tables were not built.

Not included: offline sale, device PIN, encrypted export, background delivery while the app is closed, and any Phase 8 or later capability. Existing online forms still disable saving when offline; offline work happens on `/offline`, and a signed-in page opened with no network goes there.

## Changes and migrations

New module `src/modules/offline-first/{contracts,domain,application,infrastructure,client}`, screens in `src/components/offline/` and `src/app/offline/`, hand-written `public/sw.js`, and routes `GET /api/v1/sync/account`, `POST /api/v1/sync/push`, `GET /api/v1/sync/pull`, `GET`/`POST /api/v1/farms/{farmId}/photos` and `POST .../photos/{photoId}/view`. Activity and money pages gain a photo section.

**Dependency:** `dexie` 4.4.7, exact, Apache-2.0, named by the source and the approved stack, loaded only where offline code runs. The lockfile change is limited to its entries, and Linux and hosted-version dry runs pass. No service-worker library was added.

| Additive migration | SHA-256 (committed LF) |
|---|---|
| 202611030001_record_photos | 05d3a0e7cafb8c7463e5d3e8339bfaf3a6fcf245d9241762531e82fdea23e98c |

Runtime provisioning: `supabase/policies/offline-photos-runtime.sql`, listed in the manifest. It also adds a tenant-prefixed storage insert policy. **Applied only to disposable PostgreSQL 17 databases, not to hosted.**

## Security review

- Commands run through the existing services, so current session, membership, validation, receipts and atomic writes all still apply. Client actor, tenant, status and completion fields are rejected. Device IDs are hints that grant nothing.
- Cached pulls reuse the authorized list services. A forged cursor reaches only what the account may already read, and a farm whose access ended is skipped and later dropped from the phone.
- A member revoked while offline cannot commit: entries are refused, kept visible, and create nothing. An ended session leaves entries queued and asks the farmer to sign in.
- The service worker stores only built assets and the data-free shell, never signed-in pages or API responses; a test inspects the cache. Local data is per account, and a shared-phone test confirms a second account sees none of the first's.
- Photos: bytes, size and digest are checked on the server, rows are append-only, and storage writes use the member's own session under a tenant-prefixed policy, so no privileged key enters the app. Viewing uses the existing audited short-lived link.
- **Accepted by D-P07-003:** anyone holding a signed-in phone can see its cached data. Local data is not encrypted, and neither is the download.

Findings fixed during the phase, each with a regression test unless noted:

1. A late account answer restored the account after sign-out.
2. Cached rows collided across farms, so a two-farm account lost its categories.
3. The same key on a different operation created a second effect.
4. "Nothing is waiting to send" could flash before the queue loaded.
5. Opening or reconnecting waited out a retry delay instead of sending.
6. Photos could be uploaded but not seen on online pages.

The fourth is covered only as a side effect of a timing-sensitive browser test.

## Tests and quality evidence

Clean clone of `30f2aaf`, no `.env.local`, fresh PostgreSQL 17, Windows. Logs are in ignored `.cache/p07-evidence/`.

| Command/suite | Result |
|---|---|
| `npm ci`, `npm run db:generate` | PASS |
| `npm run lint`, `npm run typecheck`, `npm run check:boundaries` | PASS |
| `npm test` | PASS, 990 tests in 49 files |
| `npm run db:migrate` | PASS, 17 migrations on a fresh database |
| `npm run test:integration` | PASS, 272 tests in 26 files |
| `TZ=Africa/Nairobi` stock, accounting, activity and offline suites | PASS, 135 tests |
| Prisma migration drift | PASS, no difference |
| `phase05-recovery.mjs`, `phase06-recovery.mjs` (real dump/restore, now with photo rows) | PASS |
| `npm run build`, ordinary and fixture | PASS |
| `npm run test:e2e` anonymous | PASS, 60 tests |
| Signed-in desktop and mobile suite, including every offline journey | PASS, 146 tests |
| `npm audit --omit=dev` | PASS, 0 vulnerabilities |
| `actionlint` on `quality.yml` | PASS |
| GitHub-hosted CI | **NOT RUN**: this code has not been pushed |
| Real low-cost Android device | **NOT RUN**: none available here |

Browser journeys create real disconnection by stopping a dedicated app server, because Playwright's offline emulation also blocks navigations a service worker should answer. These run in Chromium only.

**Simulated rather than measured:** a full phone is simulated by making the browser's storage call raise a real `QuotaExceededError`. Entry age is simulated by moving its stored date back, so 14 real days have not elapsed. 500 entries are seeded directly. Object storage in tests is a fixture, not Supabase Storage.

## Acceptance and exit gate

| Criterion | Evidence | State |
|---|---|---|
| AC001: shell reopens disconnected; denied persistence or quota error visible without false save success | Cold start with server stopped, warnings, simulated full phone, deleted database | PASS locally |
| AC002: all eight actions persist locally with pending status; photo retry retains metadata | Eight-action journey, reload, blob and digest kept, parent link | PASS locally |
| AC003: stale version conflicts; transient failures retry; permanent validation kept for repair | Crash during send, blocked child, stale edit, passing failure, repair | PASS locally |
| AC004: same key and payload replays; different payload rejects; lost acknowledgement gives one effect | The source's critical test, racing retries, two tabs, two phones, revocation, pagination, expired cursor | PASS locally |
| L: eight actions pass approved duration; no corruption or duplication | All of the above. Duration is simulated, not measured | **PASS WITH CONDITION** |

## Limitations, deferred work and verdict

**Recommended verdict: PASS WITH CONDITIONS - LOCAL VERIFICATION.** All 13 tasks and four acceptance criteria pass from a clean checkout, and no mandatory automated test is waived. Two exit-gate items need the owner's acceptance because they cannot be finished here: the approved duration has not been measured on a real device, and hosted CI has not run. Phase 7 should not be treated as accepted until the owner says so. This closes implementation, not a production release.

| Condition | Owner | Deadline |
|---|---|---|
| P7-C1: measure 14 days and 500 entries, plus real storage pressure and browser eviction, on an approved low-cost Android phone | Project owner / engineering | Before the Phase 9 field pilot |
| P7-C2: run hosted CI by pushing these commits | Project owner | Before relying on this baseline |
| P7-C3: apply `202611030001_record_photos` and `offline-photos-runtime.sql` to hosted development, with a backup. Until then, photo upload fails there; record pages show a message instead of failing. Real Supabase Storage upload is also unproven until then | Project owner / engineering | Before hosted use of photos |
| P7-C4: replace the interim photo rule with a full retention and export policy | Project owner | Before real farmer production data |
| P7-C5: review engineering choices within the approved limits: warnings at 10 days, 400 entries and 50 MB; 200 cached rows per section and 50 farms; retries capped at 15 minutes; a 2-minute lease; sent entries kept 7 days | Project owner | Before the Phase 9 field pilot |
| P7-C6: abuse and rate controls on push, pull and photo routes, inherited from P5-C3 | Project owner / security | Before real farmer production data |

Known limits: a phone must connect once while signed in before offline work is possible. Saved copies are the newest 200 rows per section, so older records are online only. Completion time on an offline task is when the server accepted it, because client clocks are not trusted; the due date carries the farmer's date. `LOCAL_ONLY` is defined but entries do not rest in it. The downloaded copy leaves out photos. The reused-key check reads before writing, so a faulty client racing itself across different operations could slip past it, while each operation's own receipt still stops repeats. The Web Locks API prevents double sending between tabs; browsers without it rely on leases and receipts, which were not separately exercised.

## After this report

The owner pushed these commits and accepted the phase with its conditions on 2026-11-03 (D-P07-009). Hosted run 41585234003 at 2c7714b failed: one test hung while stopping its test server on Linux, after all its assertions had passed. The fix is 0298f20, and P7-C2 depends on the hosted run at that commit. The statements below that nothing was pushed and that hosted CI had not run describe the moment this report was written.

## Status-update evidence

Each of T001-T012 has a commit and report, T013 adds fix `30f2aaf` and this closeout. Progress: **13/13 = 100%**. Nothing in Phase 7 has been pushed, and `2886978` from Phase 6 is also local. [Every-document review](phase-07-document-review-2026-11-03.md). Next allowed actions: owner acceptance, a push to run hosted CI, hosted application of the photo schema, or authorization for Phase 8. No later phase is started automatically.
