# Phase 10 closeout - Farm Intelligence Engine - 2026-11-12

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED - Phase 10 specification, source P0568-P0600, D-P09-018 and D-P10-001 to D-P10-007, every T001-T006 report, the Phase 10 code and tests.
- Implementation status: COMPLETED - 100% (7/7 verified tasks); verdict PASS WITH CONDITIONS - LOCAL AND HOSTED CI VERIFICATION, owner accepted 2026-11-12 (D-P10-008); P10-C4 resolved locally (D-P10-009).
- Last reviewed: 2026-11-12 (Africa/Nairobi).
- Related phase/task IDs: MYF-P10-T001 through MYF-P10-T007; MYF-P10-R001, R002; MYF-P10-AC001, AC002; D-P09-018; D-P10-001 to D-P10-009.
- Verified completed work: Deterministic trend and threshold rules, insight storage and repeat rule, Alerts page, feed item per batch; AC001 and AC002 verified on desktop and mobile; clean-checkout run of every quality-workflow step; two audit findings fixed and retested.
- Remaining work/blockers: Conditions P10-C1 to P10-C5 below; Phase 10 schema not on hosted; nothing deployed.
- Evidence/report links: [T001](phase-10-t001-2026-11-12.md); [T002](phase-10-t002-2026-11-12.md); [T003](phase-10-t003-2026-11-12.md); [T004](phase-10-t004-2026-11-12.md); [T005](phase-10-t005-2026-11-12.md); [T006](phase-10-t006-2026-11-12.md); [Phase specification](../phases/phase-10-farm-intelligence.md).
<!-- MYFARM-STATUS-END -->

**Who this is for:** the project owner, who is asked to accept or reject the verdict, and reviewers.

## Phase identity and implementation scope

Farm Intelligence Engine. Africa/Nairobi. Built by the engineering agent under D-P10-001 (one commit per verified task, pushed). Commits: T001 `f748eff`, T002 `f68f784`, T003 `10acbca`, T004 `65de156`, T005 `8c91d18`, T006 `abb4903`, and the T007 audit commit that carries this report.

**Prerequisite.** The phase specification requires the Phase 9 exit gate. That gate was **waived by the owner, not met** (D-P09-018): no real farmer has joined the pilot, so there is no evidence of voluntary recurring use. Phase 10 rests on that waiver.

What exists now, all deterministic code running on the server from each farm's own records, with no LLM (P0598):

- **Trends (R001; D-P10-002, D-P10-004, D-P10-006).** For each active poultry batch, the last 28 complete farm days are compared with the 28 before them, per bird:
  - feed cost +20% or more;
  - eggs −10% or more;
  - deaths +1 percentage point or more.

  Each figure is judged only on 20 or more birds, with records on at least 4 days of every week. Feed cost rising while eggs fall is one Warning, the source's own example (P0587); any other trend alone is a Watch.
- **Thresholds (R002; D-P10-003, D-P10-005, D-P10-007), all Warnings:**
  - over 1% of birds at risk dead in the last 7 days;
  - the chosen feed item lasting under 7 days at the last 14 days' use;
  - cost per egg, per meat bird or per kg kept above the average price per unit sold, in one currency.
- **Evidence (AC001).** Every alert stores and shows its values, its period or periods, the coverage, and its rule with version. Figures that cannot be judged list their reasons instead of a guess.
- **Repeats.** Open alerts are not raised twice. An alert marked as seen returns only if its figure gets worse. An alert whose condition is judged gone is cleared.
- **Screens.** An Alerts page linked from the farm page and the production navigation, a mark-as-seen action, and "Feed for alerts" on the poultry batch page.

Engineering readings that the owner has not confirmed are listed in the T001 and T004 reports, and summarised in P10-C2.

## Changes and migrations

- **Module and screens:** module `src/modules/farm-intelligence/{contracts,domain,application,infrastructure}`; components `src/components/intelligence/`; pages `/farms/{farmId}/insights` and the feed section on `/farms/{farmId}/poultry-batches/{batchId}`.
- **Routes:**
  - `GET /api/v1/farms/{farmId}/insights`;
  - `POST /api/v1/farms/{farmId}/insights/{insightId}/acknowledge`;
  - `PUT /api/v1/farms/{farmId}/poultry-batches/{batchId}/feed-item`.
- **Full farm export:** `alerts.csv` and `batch-feed-items.csv` are added (T007 finding 2).

| Additive migration | SHA-256 (committed LF) |
|---|---|
| 202611120001_farm_insights | f4176eee8ba1c655ecd2923985b76a079903ee0434d9534e03029d19f4f9877f |
| 202611120002_threshold_insights | 2bd7d66dfbfa2e076aa9cdc4f6d113f65916dd969f1cf984a81f4bf55b5a1fe1 |

Both migrations are single transactions that add tables, columns and checks:
- `FarmInsight`, `BatchFeedItem`, and the `CategoryMetric` marker on the approved Feed category;
- `FarmInsight.batchId` becomes nullable (existing values kept);
- three checks are widened.

The runtime policy `supabase/policies/farm-intelligence-runtime.sql` sits in the provisioning manifest before browser lockdown. **Applied only to disposable PostgreSQL 17 databases, not to hosted.**

## Security review

- **Access.** Every read and write needs an active farmer member of the farm, checked again inside each transaction. An insight or batch of another farm, or one reached through the farmer's other farm, is refused as forbidden. Tested in services and over HTTP with a second farmer.
- **Database rights (restricted app role).**
  - An insight can be added only open, on an active batch or crop cycle of the same farm.
  - Only status, acknowledgement, clearing and version can change; never the rule, version or evidence.
  - No deletes, and a cleared insight cannot be reopened.
  - A feed link can point only at a supply item of the same farm, set by an active farmer member for an active batch.
  - Browsers have no access.
- **Writes.** Acknowledgement and feed-item changes claim command receipts (retry-safe, audited) and check versions. Bodies are strict schemas, and the routes require the site's own origin.
- **No model or network** call in the rules: checked by a unit scan of the domain and contracts.
- **Feed link in its own table.** A new permissive update policy on `PoultryBatch` would combine with the batch-closure policies by OR and could weaken them; a separate table keeps them untouched.

**T007 audit findings, fixed and retested:**

1. **A crop alert's subject label could break the Alerts page.** The label is crop name plus season label, up to 242 characters, but the evidence schema allowed 120. Such an alert would fail validation while being built, and the page would show an error. Limit raised to 250; regression test added.
2. **The full farm export (D-P09-013) left out Phase 10's two farm tables.** Added `alerts.csv` (without who acknowledged) and `batch-feed-items.csv` (without who chose). Added a unit guard: every model scoped to a farm must be exported, except the membership list of other people's accounts. The guard fails if a later phase forgets.

## Tests and quality evidence

**Clean checkout of `abb4903`** (fresh clone, `npm ci`, fresh PostgreSQL 17 container, Windows); log `.cache/p10-evidence/clean-run.log` on the engineering machine:

| Command/suite | Result |
|---|---|
| `npm run lint` | PASS, 0 warnings |
| `npm run typecheck` | PASS |
| `npm run check:boundaries` | PASS |
| `npm test` | PASS, 1253 tests in 71 files |
| `prisma migrate deploy` on the fresh database | 23 migrations applied |
| `npm run test:integration` | PASS, 379 tests in 37 files |
| Non-UTC step (`TZ=Africa/Nairobi`, 16 files incl. farm intelligence) | PASS, 218 tests |
| `prisma migrate diff --exit-code` | No difference |
| Stock and activity recovery rehearsals (real dump/restore) | PASS, both |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npm run build` and anonymous browser suite | PASS, 66 tests |
| Fixture build and signed-in browser suite, desktop and mobile | PASS, 196 tests |

**After the audit fixes (working tree on the same database):**

| Check | Result |
|---|---|
| Lint, typecheck | PASS |
| `npm test` | PASS, 1255 tests (2 new) |
| `npm run test:integration` | PASS, 379 tests |
| Fixture build, export and Alerts browser specs | PASS, 14 of 14 |

**GitHub-hosted CI:** PASS for T001 to T006 (runs 43099940155, 43102893053, 43108644633, 43109478011, 43113261429, 43115761012). The T007 commit's run is recorded after push.

## Acceptance and exit gate

| Item | Evidence | Status |
|---|---|---|
| MYF-P10-AC001: values, comparison window, rule versions and coverage; feed +24%, eggs −12%, qualified mortality change; sparse inputs suppress | Golden unit tests (T001); integration on real records (T002); browser on desktop and mobile (T003) | Verified |
| MYF-P10-AC002: thresholds and demand explicit; comparable units; threshold boundaries, wrong units, missing demand, no-LLM execution | Unit boundary and unit tests and no-LLM scan (T004); integration (T005); browser (T006) | Verified |
| L: meaningful, traceable insights from approved deterministic rules without an LLM | The rules are the owner's Q19 answers in versioned code; every alert carries its evidence | Met for the software |
| L: cumulative prerequisites hold | Phase 9 exit gate waived, not met (D-P09-018) | **Not met; waived by the owner** (P10-C1) |
| L: no blocking security or integrity defect; command results logged | Review above; two findings fixed and retested | Met |

## Conditions, limitations and verdict

| Condition | Owner | By |
|---|---|---|
| **P10-C1** The Phase 9 exit gate (voluntary recurring use by real farmers) was waived, not met. Whether these alerts help farmers is unproven until real farmers use them | Product owner | Before Phase 10 alerts are relied on with real farmers |
| **P10-C2** Agronomist review of the numbers (1% in 7 days, 20% / 10% / 1 point, 7 days of feed) and owner confirmation of the engineering readings in T001 (severity mapping, clearing) and T004 (birds bought at risk, shared feed, bird loss for meat batches only, egg-loss costs, no coverage for loss) | Owner with an agronomist, as P8-C2 | Before real farmers see alerts |
| **P10-C3** Migrations 202611120001 and 202611120002 and the provisioning list are not on hosted development | Owner instruction (D-P10-001 needs its own instruction) | Before any hosted use |
| **P10-C4** ~~Opening the Alerts page or `GET .../insights` evaluates and stores: bounded (50 batches, 50 crop cycles) but not counted by the request limits~~ **Resolved locally 2026-11-12 (D-P10-009)**: 30 evaluations a minute per person; on hosted with P10-C3 | Engineering | Done |
| **P10-C5** Inherited open items: Phase 1 C4, P7-C1 real phone, P8-C2, consent translations, the pilot-start checklist | Owner | As recorded |

**Limitations:**
- Crop loss is not judged when an enterprise has more than one crop cycle in a season, because its costs cannot be split.
- Crop cycles past 50 active ones are not checked, and the page does not say so.
- Alerts need a connection; they are not kept offline.
- The wording of the next steps is plain and neutral, and only the high-mortality step was approved word for word (D-P10-003).

**Verdict: PASS WITH CONDITIONS - LOCAL AND HOSTED CI VERIFICATION.** Every task, both acceptance criteria and the security review are complete with evidence, and no mandatory test fails. The conditions above are not blocking for the software, but **P10-C1 means the phase rests on a waived prerequisite**. The owner is asked to accept or reject (D-P10-008 PROPOSED). Phase 11 (AI assistant) must not start until the owner accepts, and its own prerequisites and Q20 are decided.

## Status-update evidence

Progress from verified task IDs: T001-T007, 7 of 7. Updated: this report, the Phase 10 specification, `docs/PROJECT-STATUS.md` and `docs/DECISION-LOG.md` (D-P10-008 PROPOSED).

## Owner acceptance and P10-C4 fix - 2026-11-12

The owner accepted the verdict ("Accept, fix C4 first", D-P10-008). Hosted CI also passed for this closeout commit (run 43119206600 at 99d6962), so all seven tasks pass hosted CI.

**P10-C4 (D-P10-009).** Each Alerts evaluation now counts against a per-person limit, `INSIGHTS_EVALUATE`, of 30 a minute, using the D-P09-014 table and database function (no schema change, no new package). The farm intelligence service takes it after authorizing the farm, so the page and the API share one count and a farm the person cannot see is not counted. Over the limit nothing is evaluated or stored: the API answers 429 `RATE_LIMITED`, and the Alerts page says to wait a minute instead of failing. Marking an alert as seen stays under the save limit.

| Check (local, disposable PostgreSQL 17 `myfarm-p10-dev`) | Result |
|---|---|
| Lint (0 warnings), typecheck, import boundaries | PASS |
| Unit/component | 1255 passed |
| Integration (new: evaluations are counted, refusals store nothing, a forbidden farm is not counted) | 380 passed |
| Signed-in browser, desktop and mobile (new: the page message, API 429, refusals not counted, another farmer unaffected) | 198 passed (13.8 min) |

The first browser run of the new test failed on its own locator, which also matched Next.js's hidden route announcer (`role="alert"`); the test now selects the message by its text. No application code changed for that.

Still open: P10-C1, C2, C3 and C5. Phase 11 waits for Q20.
