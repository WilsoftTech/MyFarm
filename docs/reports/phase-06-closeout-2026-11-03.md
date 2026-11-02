# Phase 6 closeout - 2026-11-03

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED - Phase 6 requirements, implementation, security and verification evidence.
- Implementation status: COMPLETED - 100% (10/10 verified tasks), PASS WITH CONDITIONS - HOSTED CI VERIFIED.
- Last reviewed: 2026-11-03 (Africa/Nairobi).
- Related phase/task IDs: MYF-P06-T001 through MYF-P06-T010; MYF-P06-AC001 through MYF-P06-AC003; D-P06-001 through D-P06-009.
- Verified completed work: T001-T010 and AC001-AC003 verified in a clean checkout and in GitHub-hosted CI at 8d2e415, with attachments deferred by owner acceptance.
- Remaining work/blockers: No phase blocker. P6-C1 is resolved; conditions P6-C2 through P6-C5 and inherited production conditions remain. Phase 7 not started.
- Evidence/report links: [Phase specification](../phases/phase-06-farm-activities.md); [Project status](../PROJECT-STATUS.md); [Document review](phase-06-document-review-2026-11-03.md).
<!-- MYFARM-STATUS-END -->

## Phase identity and implementation scope

Production Activities and Farm Calendar, Africa/Nairobi, engineering agent under owner authorizations D-P06-001 and D-P06-007. Application commit `8d2e415ececed92f73dc3b8c929adac0d8ef5c0d`.

A farmer can schedule any available activity for the whole farm or an enterprise, see it under Today, Upcoming, Missed, Completed or Cancelled and on a month calendar, mark it done with an optional worker name, link an existing expense or purchase, and cancel it with a reason. Feeding, cleaning, vaccination and inspection can repeat every N days, weeks or months. Each due date generates one activity, which can be skipped, and a series can be changed from a date or stopped. This meets the exit gate: the farmer sees what happened, what is happening and what comes next.

Owner decisions D-P06-002 to D-P06-005 resolve Q14 and Q15. D-P06-008 accepts the activity rules, the attachment deferral, no correction after completion, and early completion. Not included: attachments, worker accounts, notifications, activity-created expenses, per-farm timezones, durable offline sync, and any Phase 7 or later capability.

## Changes and migrations

New module `src/modules/farm-activities/{contracts,domain,application,infrastructure}`; screens under `src/app/farms/[farmId]/activities`; API under `/api/v1/farms/{farmId}/activities` and `/activity-series`. Reused: `RecordForm`, `ChoiceField`, `ProductionShell`, pagination, the retry-safe submit hook, farm authorization, scoped command receipts and existing date validation. No dependency change. `next.config.ts` sets `agentRules: false` so `next dev` no longer rewrites `AGENTS.md`.

The specification's `FarmActivity` name was already used by an existing enum, so the model is `ProductionActivity`. Its `TaskOccurrence` proposal is replaced by `ProductionActivity` rows linked to `ActivityRecurrence`, which gives every occurrence the normal lifecycle. Runtime provisioning: `supabase/policies/farm-activities-runtime.sql`, listed in the manifest before browser lockdown.

| Additive migration | SHA-256 (committed LF) |
|---|---|
| 202611020001_production_activities | 2665164e6ac407cfe007d75bfb7da31374cb4982f4a2196651a596bfd09f8796 |
| 202611020002_activity_completion | 0b88cc64158712e25d5910a9c350cff677580ed3113829ea4b0abd56791199a4 |
| 202611020003_activity_recurrence | 74f216d78f8008c6d05b1d0ff5f897a6f2d81982aed4f2c95689ff9d3946b097 |

At closure these were applied only to disposable PostgreSQL 17 databases; they were applied to hosted development afterwards, as recorded below. Rollback is restore or forward repair, not dropping activity history; the migration rollback test and the recovery rehearsal cover this.

## Security review

- Current FARMER tenant membership and active farm membership are checked before every read and write, and again inside write transactions and after lock waits. ADMIN has no implicit farm access. Client actor, tenant, status, completion and worker-user fields are rejected by strict contracts.
- Foreign farms, activities, series, parents, cost records and page anchors are refused, and failed writes leave no receipt. Optional parents use single-column keys, so runtime policies also bind them to the activity's farm.
- The runtime role has no DELETE. It can update only lifecycle columns on a scheduled activity and only progress columns on an unstopped series, so finished records cannot be reopened or rewritten by the application role. A database check keeps status and its who/when columns consistent. Browser roles have no privileges and RLS is enabled.
- Retries replay one result and changed retries conflict. A unique key on series and due date prevents duplicate occurrences, and a per-series lock keeps a concurrent stop and expansion from leaving work scheduled past the stop date.
- Financial integrity: an activity stores no money. Its cost is read from the accounting record, only that record counts in totals, and reversals show on the activity. No activity command creates or changes an accounting record.
- Audit: schedule, complete, cancel and series create, change and stop commit an audit receipt. Generated occurrences and cancellations cascaded from a stop or change have no individual receipt; the series command records them.

Audit fixes: expansion changed `updatedAt`, so a replayed create returned a different record (T008); paused series could fill the bounded expansion batch and block active series (T010). Both have regression tests. The second test was not separately run against the unfixed code.

## Tests and quality evidence

Both environments ran on `8d2e415`. The local run was a clean clone with no `.env.local` and a fresh PostgreSQL 17 database. Logs are in ignored `.cache/p06-evidence/`.

| Command/suite | Clean clone, Windows | [Hosted run 41524090703](https://github.com/WilsoftTech/MyFarm/actions/runs/41524090703), Ubuntu |
|---|---|---|
| `npm ci`, `npm run db:generate` | PASS | PASS |
| `npm run lint`, `npm run typecheck`, `npm run check:boundaries` | PASS | PASS |
| `npm test` | PASS, 867 | PASS, 867 |
| `npm run db:migrate` | PASS, 16 migrations | PASS |
| `npm run test:integration` | PASS, 233 | PASS, 233 |
| `TZ=Africa/Nairobi` stock, accounting and activity suites | PASS, 96 | PASS, 96 |
| Prisma migration drift | PASS, no difference | PASS, no difference |
| `phase05-recovery.mjs`, `phase06-recovery.mjs` (real dump/restore) | PASS | PASS |
| `npm run build`, ordinary and fixture | PASS | PASS |
| `npm run test:e2e` anonymous | PASS, 52 | PASS, 52 |
| Signed-in desktop and mobile suite | PASS, 110 | PASS, 110 |
| `npm audit --omit=dev` | PASS, 0 vulnerabilities | NOT RUN, not a workflow step |
| `actionlint` on `quality.yml` | PASS | NOT RUN, not a workflow step |

Hosted Supabase, field use and real low-end devices are NOT RUN. All fixtures are synthetic.

## Acceptance and exit gate

| Criterion | Evidence | State |
|---|---|---|
| AC001: catalog retained; crop and poultry behavior explicit | Unit matrix, PostgreSQL refusals, desktop/mobile journey | PASS |
| AC002: Plot B fertilizer due tomorrow is upcoming; completion records permitted worker and time | Kampala boundary tests, lifecycle tests, desktop/mobile journey | PASS, attachments deferred by owner under D-P06-008 |
| AC003: repeated expansion creates one occurrence; cancellation policy stops future entries | Date tests, sequential and concurrent expansion, stop, change, replay, desktop/mobile journey | PASS for feeding, cleaning, vaccination and inspection; milking unavailable by owner decision |
| L: farmer sees what happened, is happening and comes next | Lists, calendar and all suites above | PASS |

## Limitations, deferred work and verdict

**Verdict: PASS WITH CONDITIONS - HOSTED CI VERIFIED.** All 10 tasks, three acceptance criteria and the exit gate pass, and no mandatory test is waived. This closes the Phase 6 implementation, not a production release.

| Condition | Owner | Deadline |
|---|---|---|
| P6-C1: apply canonical Phase 4, 5 and 6 migrations and manifest policies to hosted development. **Resolved 2026-11-03**, see below. | Project owner / engineering | Done |
| P6-C2: attachments stay deferred under D-P04-005 and D-P06-008. | Project owner | When the retention/export policy is approved |
| P6-C3: milking is catalogued but unavailable, including its source recurrence. | Project owner | When a dairy workflow is approved |
| P6-C4: a completed activity has no correction flow; a mistake stays visible. | Project owner | Review after field use (Phase 9) |
| P6-C5: expansion runs when activity pages load because there is no background job, so a read page can write occurrences, and a series is generated only when a member opens one of those pages. It is idempotent, membership-checked and bounded. Measure before production scale. | Engineering | Before production-scale histories |

Inherited: P5-C2 reconstruction performance and P5-C3 retention, export and abuse controls before real farmer data. Durable offline behavior remains Phase 7: open forms keep input in memory and disable saving while offline, and retries are safe through request IDs.

### Hosted application steps planned for P6-C1

These were the steps planned at closure. The next section records how they were run.

1. Take and verify a backup of project `sudqhluwsaijvjjcegpv`.
2. From an owner-level connection on the `main` checkout, run `npx prisma migrate status` to confirm what is pending, then `npx prisma migrate deploy`.
3. Run every SQL file listed in `supabase/provisioning.json`, in order, including `browser-role-lockdown.sql` last.
4. Verify: run `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`, compare the checksums above, confirm browser roles have no privileges on the new tables, and open the money, inventory and activity pages signed in.

## Status-update evidence

Each task has a commit and report, T001-T009 in order. T010 includes audit coverage `dac45f0`, fix `8d2e415` and this closeout. Progress: **10/10 = 100%**. Documentation-only commits after `8d2e415` do not change the application, schema or lockfile verified above. [Every-document review](phase-06-document-review-2026-11-03.md). Next allowed action: separately authorized hosted application, or owner authorization for Phase 7. No later phase is started automatically.

## Hosted application - 2026-11-03

Owner instruction: "now", answering when to apply the schema to hosted development (D-P06-010). Target: development project `sudqhluwsaijvjjcegpv` from `main` at `d4e9338`. This also resolves P4-C2 and P5-C1. No production system or deployment was changed.

**Connection:** the direct database host still does not resolve from this machine, so the owner credential already configured as `DIRECT_URL` was used through the same project's session pooler, with TLS verified against the project CA. The Supabase connector was not used.

**Backup:** full `pg_dump` taken first and stored in git-ignored `.cache/hosted-backups/`: `pre-phase-06-2026-11-02T21-25-07-318Z.dump`, 466,388 bytes, SHA-256 `0efd128c882a12f7a8c18f755220a4ba0e09ef5414dc6199e96514d793eaec07`. Restoring its public schema into a disposable PostgreSQL 17 container gave no errors, and all 17 public tables matched by row digest. The auth and storage schemas are in the dump, but their restore was not rehearsed. The file holds real account data, including auth tables, and exists only on this machine.

**Applied:** `prisma migrate deploy` applied the 9 pending migrations (`202610250002_farm_accounting`, five `20261029` harvest and stock migrations, three `20261102` activity migrations). All 12 SQL files in `supabase/provisioning.json` then ran in order, ending with browser lockdown.

| Check | Result |
|---|---|
| Data in the 16 existing tables, by row digest before and after | Unchanged |
| New tables | 15 created; 0 rows except the seeded 17 categories and 3 payment methods |
| Pending or unfinished migrations | None |
| Browser-role grants on public tables | 0 before and after |
| Tables without RLS | None |
| Runtime role | Can log in; not superuser; no RLS bypass; can read every application table; cannot delete activities or money records, rewrite a due date or update stock movements |
| Runtime policy writes, in a transaction rolled back afterwards | Series, activity, completion and store accepted; reopening a completed activity changed 0 rows; 0 rows kept |
| Signed-in test account against hosted, production build on local host, mobile viewport | 12 farm, money, inventory, harvest, store, enterprise, poultry and activity pages returned 200 with no page errors |

**Known differences, not caused by this change:**

- Drift reports only the legacy `LivestockBatch` table and its two foreign keys. That empty table and its `202610240001_poultry_batches` history entry are deliberately preserved from Phase 3.
- One checksum differs: `202610090001_farmer_registry`. The recorded value equals the local file with CRLF line endings, and the mismatch predates this change. This is open condition P2-C3.

**Not verified:** Pages were only read, so no record was saved through the app against hosted, and accounts with several farms or other roles were not exercised. The hosted Auth configuration was not reviewed. The sign-in created one additional Auth session for the test account, which was left to expire because signing out revokes all of that account's sessions.
