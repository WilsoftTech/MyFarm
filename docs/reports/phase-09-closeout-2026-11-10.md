# Phase 9 closeout - 2026-11-10

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED - Phase 9 requirements, implementation, security and verification evidence.
- Implementation status: COMPLETED - 100% (7/7 verified tasks); EXIT GATE NOT MET - the real pilot has not run.
- Last reviewed: 2026-11-10 (Africa/Nairobi).
- Related phase/task IDs: MYF-P09-T001 through MYF-P09-T007; MYF-P09-AC001, MYF-P09-AC002; D-P09-001 through D-P09-010.
- Verified completed work: The pilot software (joining under consent, the ten measures, staff logs, observations, findings and go/no-go reviews) verified from a clean checkout on a fresh database.
- Remaining work/blockers: The exit gate needs recurring voluntary use by real farmers. That waits for the pilot-start checklist below, then about 16 weeks of pilot. Phase 10 must not start before it.
- Evidence/report links: [Phase specification](../phases/phase-09-field-pilot.md); [Plan](phase-09-start-2026-11-09.md); [Document review](phase-09-document-review-2026-11-10.md); [Project status](../PROJECT-STATUS.md).
<!-- MYFARM-STATUS-END -->

## Phase identity and implementation scope

Field Pilot and Product Validation, Africa/Nairobi, engineering agent under owner authorization D-P09-001 (build the tools, commit per task, push; no real farmer until the pilot-start checklist is cleared). Audited commit: `4bf7c69193e018b2f7fed7be232914fa2211b870`, with the test-only fix `ce00022` rerun on the same clean checkout.

What exists now:

- **Farmers** open "Pilot", read plain consent points, enter a cohort code and join under a code name (P-01…); they can leave at any time, and from then on count nowhere (D-P09-006, D-P09-009).
- **Pilot staff** (ADMIN of an organization) open cohorts and see the ten source measures live: farmers onboarded; farmers continuing unprompted (active in 3 of the last 4 weeks, D-P09-003); records per farmer per week; expenses; harvests; tasks completed; entries sent from phones; sync failures; support incidents; farmers who finished a crop or batch. Every count rests on a receipt or log row unique per request, so retries never inflate it. Staff see code names and counts only, never names, phone numbers, money or records (D-P09-007).
- **Staff logs:** reminders (a reminded week is not voluntary, D-P09-004), support incidents, paper consent references, dated observations of where farmers hesitate, findings that must cite those observations, and go/no-go reviews. A review is refused unless the evidence allows it, and it stores the server's own gate figures. Downloads are never an input.
- **Feature freeze (P0541):** no new farmer-facing capability beyond joining and leaving the pilot.

## Changes and migrations

Module `src/modules/field-pilot/{contracts,domain,application,infrastructure}`; pages `/pilot`, `/admin/pilot`, `/admin/pilot/{cohortId}` and `.../evidence`; 13 routes under `/api/v1/pilot/` and `/api/v1/scopes/{scopeId}/pilot/`; the push service logs phone entries once (D-P09-008).

| Additive migration | SHA-256 (committed LF) |
|---|---|
| 202611090001_field_pilot | 0d1b69726f530f263075d1ab5d380bf39e506182e3c6e31dadd6868651960a08 |
| 202611100001_pilot_evidence | 06dbcfac8b605d61bd2c4844fc1e4f30cf307750dc1ee20b27c1fe5bc993103d |

Runtime policy `supabase/policies/field-pilot-runtime.sql`, in the provisioning manifest before browser lockdown. **Applied only to disposable PostgreSQL 17 databases, not to hosted.** Both migrations are single transactions that only add tables; tests prove a failure leaves nothing behind.

## Security review

- Farmers act only on their own participation; staff only as ADMIN of the organization running the cohort; another organization's cohort looks missing. Tested in services, under the restricted database role, and over HTTP (anonymous 401, cross-origin 403, other farmer and other staff refused).
- The database enforces the same rules: only staff of a real organization open cohorts and write logs; only an active farmer joins, under the cohort's current consent; withdrawal, incident resolution and finding closure are one-way; reviews never change; a GO needs a met gate; nothing can be deleted by the application.
- A wrong, closed or ended code looks the same as a missing one. Codes are 8 characters from 32 symbols, but there is no rate limit on joining yet (P7-C6).
- Free text (incident summaries, observations) tells staff not to write names or phone numbers; this is guidance, not enforcement.

Findings fixed during the phase:

1. `/pilot` was missing from the proxy's protected pages, so anonymous visitors reached the page before being sent to sign-in (T003).
2. **Phase 7 defect:** pages opened while signed in waited out a retry delay before sending waiting offline entries, so a farmer signing back in on a shared phone could wait minutes. Fix 3a09e32; it caused hosted failures 42699598962 and the T003 run.
3. Staff forms kept the values just saved, so a second observation was silently about the same farmer (T006).

## Tests and quality evidence

Clean clone, no `.env.local`, fresh PostgreSQL 17 container, Windows. Logs are in ignored `.cache/p09-evidence/`.

| Command/suite | Result |
|---|---|
| `npm ci`, `npm run db:generate` | PASS |
| `npm run lint`, `npm run typecheck`, `npm run check:boundaries` | PASS |
| `npm test` | PASS, 1190 tests in 65 files |
| `npm run db:migrate` | PASS, 20 migrations on a fresh database |
| `npm run test:integration` at 4bf7c69 | **346 of 347**: the staff-view privacy check matched "500" by chance inside an ID or timestamp |
| `npm run test:integration` at ce00022, same checkout | PASS, 347 tests in 34 files, after the check was fixed to look at JSON values |
| `TZ=Africa/Nairobi` stock, accounting, activity, offline, analytics and pilot suites | PASS, 200 tests in 15 files |
| Prisma migration drift | PASS, no difference |
| `phase05-recovery.mjs`, `phase06-recovery.mjs` | PASS |
| `npm run build`, ordinary and fixture | PASS |
| `npm run test:e2e` anonymous | PASS, 66 tests |
| Signed-in desktop and mobile suite | PASS, 182 tests |
| `npm audit --omit=dev` | PASS, 0 vulnerabilities |
| `actionlint` on `quality.yml` | PASS |
| GitHub-hosted CI | PASS at c8cda29, [run 42716201821](https://github.com/WilsoftTech/MyFarm/actions/runs/42716201821); every push since fix 3a09e32 passed. T002 and T003 had failed on the Phase 7 timing defect that 3a09e32 fixed |

The CI non-UTC step now includes the two pilot service suites.

## Acceptance and exit gate

| Criterion | Evidence | State |
|---|---|---|
| AC001: ten measures defined with numerator and denominator; events reconcile without retry inflation | Golden fixtures; real receipts and phone logs counted once; browser journey with an expense saved twice counted once; consent exclusion, cohort and completed-cycle rules | PASS locally |
| AC002: dated evidence supports the recurring-use gate; findings link to observations, not downloads | Observation and finding rules; opt-out removal; decisions refused when the evidence does not allow them; reviews record server figures; browser journey | PASS locally |
| L: recurring unforced use evidenced against approved criteria | **No real farmer has used the pilot.** The tools to measure it exist; the evidence does not | **NOT MET** |
| L: data-loss and sync blockers fixed before intelligence | Fix 3a09e32; offline suites pass; real-phone measurement P7-C1 still open | Partly: P7-C1 open |

## Verdict

**Phase 9 is not closed.** All seven tasks and both acceptance criteria pass, so the software is complete. The exit gate is a fact about real farmers' behaviour over weeks, and the source is explicit: "We prove recurring usage." A test cannot prove it. Recommended status: **IMPLEMENTATION COMPLETE, EXIT GATE PENDING THE REAL PILOT** (D-P09-010, accepted 2026-11-10). Phase 10 ("only after reliable data exists", P0569) must not start until the gate is met.

## Pilot-start checklist (D-P09-005)

| Item | Owner | Why it blocks real farmers |
|---|---|---|
| Approve the consent words, in every language farmers will read, checked by real speakers | Project owner | The draft (`pilot-consent-v1-draft`) has not been approved |
| ~~Apply `202611090001`, `202611100001` and the provisioning list to hosted, with a verified backup~~ **Done 2026-11-10** (D-P09-011, [pilot-start pack](phase-09-pilot-start-pack-2026-11-10.md)) | Project owner / engineering | The pilot runs on hosted |
| P7-C4 retention and export policy, including pilot data after the pilot | Project owner | Real personal data |
| P7-C6, P4-C4, P5-C3 abuse and rate controls, including joining | Project owner / security | Real accounts and codes |
| Phase 1 C4: production sign-in, recovery email, TLS | Project owner / operations | Real sign-ins |
| P7-C1: 14 days and 500 entries on a real low-cost Android phone | Project owner / engineering | Farmers work offline |
| P8-C2: accountant and agronomist sign the figures | Project owner | Before the pilot relies on the figures |
| Recruit about 25 consenting farmers and name the pilot staff | Project owner | D-P09-002 |

After that, the pilot runs about 16 weeks; staff record reminders, incidents and observations; at week 8 and at the end, staff record a decision. Phase 9 closes on that evidence.

## Status-update evidence

Each of T001-T006 has a commit and report; T007 adds the CI change 4bf7c69, the test fix ce00022, this closeout and the [document review](phase-09-document-review-2026-11-10.md). Progress: **7/7 tasks = 100%**; exit gate not met.
