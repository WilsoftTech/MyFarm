# Phase 6 closeout - 2026-11-03

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED - Phase 6 requirements, implementation, security and verification evidence.
- Implementation status: COMPLETED - 100% (10/10 verified tasks), PASS WITH CONDITIONS - HOSTED CI VERIFIED.
- Last reviewed: 2026-11-03 (Africa/Nairobi).
- Related phase/task IDs: MYF-P06-T001 through MYF-P06-T010; MYF-P06-AC001 through MYF-P06-AC003; D-P06-001 through D-P06-009.
- Verified completed work: T001-T010 and AC001-AC003 verified in a clean checkout and in GitHub-hosted CI at 8d2e415, with attachments deferred by owner acceptance.
- Remaining work/blockers: No phase blocker. Conditions P6-C1 through P6-C5 and inherited production conditions remain. Phase 7 not started.
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

Applied only to disposable PostgreSQL 17 databases. **Not applied to hosted.** Rollback is restore or forward repair, not dropping activity history; the migration rollback test and the recovery rehearsal cover this.

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
| P6-C1: apply canonical Phase 4, 5 and 6 migrations and manifest policies to hosted development. Timing is not decided: the owner's reply to the timing question did not name one, so it is not treated as approval. | Project owner / engineering | Before hosted use of these workflows |
| P6-C2: attachments stay deferred under D-P04-005 and D-P06-008. | Project owner | When the retention/export policy is approved |
| P6-C3: milking is catalogued but unavailable, including its source recurrence. | Project owner | When a dairy workflow is approved |
| P6-C4: a completed activity has no correction flow; a mistake stays visible. | Project owner | Review after field use (Phase 9) |
| P6-C5: expansion runs when activity pages load because there is no background job, so a read page can write occurrences, and a series is generated only when a member opens one of those pages. It is idempotent, membership-checked and bounded. Measure before production scale. | Engineering | Before production-scale histories |

Inherited: P5-C2 reconstruction performance and P5-C3 retention, export and abuse controls before real farmer data. Durable offline behavior remains Phase 7: open forms keep input in memory and disable saving while offline, and retries are safe through request IDs.

### Hosted application steps for P6-C1

Hosted development currently lacks every Phase 4, 5 and 6 table, based on a read-only table list on 2026-11-02. The runtime role could not read migration history. These steps need owner approval and cannot be run from the current setup, because the runtime role cannot change the schema, the direct database host resolves only to IPv6 and is unreachable from this machine, and the Supabase connector is not authorized.

1. Take and verify a backup of project `sudqhluwsaijvjjcegpv`.
2. From an owner-level connection on the `main` checkout, run `npx prisma migrate status` to confirm what is pending, then `npx prisma migrate deploy`.
3. Run every SQL file listed in `supabase/provisioning.json`, in order, including `browser-role-lockdown.sql` last.
4. Verify: run `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`, compare the checksums above, confirm browser roles have no privileges on the new tables, and open the money, inventory and activity pages signed in.

## Status-update evidence

Each task has a commit and report, T001-T009 in order. T010 includes audit coverage `dac45f0`, fix `8d2e415` and this closeout. Progress: **10/10 = 100%**. Documentation-only commits after `8d2e415` do not change the application, schema or lockfile verified above. [Every-document review](phase-06-document-review-2026-11-03.md). Next allowed action: separately authorized hosted application, or owner authorization for Phase 7. No later phase is started automatically.
