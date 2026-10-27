# Phase 4 T016 audit and closeout

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — T016 audit, closeout content, status and evidence.
- Implementation status: COMPLETED - 100% (16/16); PASS WITH CONDITIONS - LOCAL VERIFICATION; owner accepted 2026-10-27.
- Last reviewed: 2026-10-27 (Africa/Nairobi), T016 audit and owner acceptance.
- Related phase/task IDs: MYF-P04-T001–T016; MYF-P04-R001–R005; MYF-P04-AC001–AC005.
- Verified completed work: T001–T016, AC001–AC005 and the local L gate in the working tree and a clean clone against a fresh PostgreSQL 17.
- Remaining work/blockers: No blocking local Phase 4 gate. Conditions below (hosted CI, hosted provisioning, inherited production gates) remain.
- Evidence/report links: [T006–T015](phase-04-t006-t015-2026-10-26.md); [T005](phase-04-t005-2026-10-26.md); [T001](phase-04-t001-2026-10-25.md).
<!-- MYFARM-STATUS-END -->

## Phase identity and implementation scope

Phase 04, Farm Accounting Engine. Implementer: Claude Code; product and approval owner: repository owner. Date and time zone: 2026-10-26, Africa/Nairobi. The baseline is pushed `origin/main` at `ac0a004` (T001–T005), plus the uncommitted T006–T016 working changes. Per the owner's instruction, these are committed once, after this closeout. The clean-clone verification applied exactly those changes, excluding the user's generated `next-env.d.ts` edit and local secrets. Logs are in `.cache/p04-evidence/`.

Authorization and rules: D-P04-001 (Phase 4 on `main`, local CI substitution), D-P04-002 to D-P04-004 (Q09–Q11), D-P04-005 to D-P04-006 (catalogs, persistence), and D-P04-007 to D-P04-011 (links, gross margin, export, filters, single commit).

Implemented scope:
- farm-owned expense, income, sale and purchase records with exact multi-currency money
- payments that only settle derived receivables and payables
- append-only reversals
- reviewed global categories and payment methods, with archived-category history
- optional plot, enterprise and season links with crop-cycle matching
- deterministic accrual and cash recognition
- enterprise gross margin
- the money summary (spent, spending by category, revenue, costliest enterprise with ties) and an audited CSV export
- mobile-first screens for all of the above

Not implemented by design: net farm income (Phase 8), tax, FX conversion, advances, activity links (Phase 6), attachments (retention policy), durable offline sync (Phase 7) and category administration screens.

## Changes and migrations

- **Module** `src/modules/farm-accounting/`:
  - domain: `money`, `accounting`, `catalog`, `reporting`
  - contracts: commands, views and ports
  - application: accounting and reporting services, CSV
  - infrastructure: record and report repositories, services, HTTP helpers
- **API:** 14 route files under `src/app/api/v1/farms/[farmId]/accounting/`.
- **Screens:** under `src/app/farms/[farmId]/accounting/` and `src/components/accounting/`.
- **Shared component:** `ChoiceField` gained optional `optional`/`hint` props; existing forms are unchanged.
- **Migration:** one additive migration, `202610250002_farm_accounting` (T002), SHA-256 `3720e866a6e9dd9a8f8a4261e3ae5f5a22afe45b1d327295f788c178f811e38d`. All nine migrations' checksums are in `.cache/p04-evidence/migration-checksums.json`.
  - Rehearsed on fresh install and on upgrade from the seven prior migrations, with injected-failure rollback.
  - Prisma drift: none.
  - Dump/restore rehearsal (`tests/support/farm-accounting-recovery.mjs`): PASS.
  - Rollback: revert application code; do not drop the tables.
- **Provider file:** `supabase/policies/farm-accounting-runtime.sql` (manifest-listed). It gives insert-only history and a status-only POSTED→REVERSED update guarded by a reversal row, and it rechecks membership, catalog kind, same-farm links and (T008) crop-cycle matching.
- **Hosted:** **NOT APPLIED** to hosted dev (`sudqhluwsaijvjjcegpv`) or any other environment. This needs separate owner authorization, as with D-P03-015. Until then, pushed accounting code paths would fail on hosted dev.
- **Dependencies:** none added or changed. `npm audit` reports zero vulnerabilities for both production and the full tree.

## Security review and findings

| ID | Area / finding | Evidence or remediation | Status |
|---|---|---|---|
| P4-A01 | Tenant/farm isolation and IDOR | Every service call authorizes the current farm membership before parsing input. Reads constrain tenant and farm (including nested IDs and cursors). Tests cover other tenants, admins, sibling farms, foreign links and revoked members. | PASS |
| P4-A02 | Double counting / retries | One sale is one revenue event. Payments only settle. Identical retries replay, changed retries CONFLICT, and lost-response UI retries record once. | PASS |
| P4-A03 | Concurrency | Per-obligation advisory locks: of two concurrent payments only one fits the balance, and a concurrent second reversal conflicts. The unique reversal target index is the final backstop. | PASS |
| P4-A04 | History integrity | No UPDATE except status/version/updatedAt and no DELETE for runtime. RLS refuses direct edits, deletes, status changes without a reversal row, archived categories, and mismatched crop-cycle links. | PASS |
| P4-A05 | Export | The CSV is for active members only. It is audited before return (actor/time/tenant/farm/request), private/no-store with `nosniff`, and has a server-built filename. Formula-like cells are neutralized (tested with an enterprise named `=HYPERLINK(...)`). | PASS |
| P4-A06 | Input validation | Strict Zod contracts. Money never passes through floats. Dates are calendar-valid. Forged tenant/farm/actor/kind/status fields are rejected. Report filters are validated before reading. | PASS |
| P4-A07 | Report scalability | Report sources are SQL-filtered by date but not paginated. This suits Phase 4 farm sizes; rebuildable projections belong to Phase 8. | CONDITION |
| P4-A08 | Export abuse | Exports are audited but not rate-limited. The approved rate-limit infrastructure covers private-file grants only. | CONDITION |

No blocking finding was found, so no remediation was required before closure.

## Tests and quality evidence

The local CI substitution follows D-P04-001: every `quality.yml` step ran from a separate clone of `ac0a004` with the exact working changes applied. It used a fresh `postgres:17` container, `myfarm-t016-20261026` (loopback 55463, `myfarm_phase01_test`), on Windows with Node 24.13.0.

| Command/suite | Result | Evidence `.cache/p04-evidence/` |
|---|---|---|
| `npm ci --no-audit --no-fund` | PASS | npm-ci.log |
| `npm run db:generate` | PASS | db-generate.log |
| `npm run lint` | PASS (zero warnings) | lint.log |
| `npm run typecheck` | PASS | typecheck.log |
| `npm run check:boundaries` | PASS | boundaries.log |
| `npm test` | PASS — 686 tests, 36 files | test.log |
| `npm run db:migrate` | PASS — nine migrations on a fresh database | db-migrate.log |
| `npm run test:integration` | PASS — 154 tests, 14 files | test-integration.log |
| Non-UTC (`TZ=Africa/Nairobi`) foundation + accounting + reports integration | PASS — 44 tests | non-utc.log |
| `npm run build` | PASS | build.log |
| `npx playwright install chromium` + `npm run test:e2e` (anonymous) | PASS — 48 | test-e2e.log |
| Fixture-Auth build + signed-in desktop/mobile suite | PASS — 100 | fixture-build.log, signed-in.log |
| Prisma drift (`migrate diff --from-config-datasource --exit-code`) | PASS — no difference | drift.log |
| Dump/restore rehearsal | PASS | recovery.log |
| `npm audit --omit=dev` / `npm audit` | PASS — 0 vulnerabilities | session record |
| GitHub-hosted CI | NOT VERIFIED — D-P04-001 local substitution | — |
| Hosted dev application / signed-in hosted checks | NOT RUN — Phase 4 schema not applied to hosted | — |

The same suites also passed in the working tree before the clean-clone run. TypeScript, lint and production build are all green. A green build alone does not establish production readiness.

Earlier task-level failures, all fixed in tests with no weakened assertion:
- T002: a fixture-helper call without a user, and a historical migration fixture that applied a later provider file
- T003: a 404 expectation for a streamed `notFound()` page
- T004: a T003 component case that timed out under load, and an over-broad source guard

None occurred in the final runs.

## Acceptance, limitations and verdict

| Criterion | Evidence | Result |
|---|---|---|
| AC001 — one sale, partial payment, no double revenue | T001 oracle; T002 DB/HTTP; T003 UI (UGX 200,000 sale, UGX 80,000 received, UGX 120,000 still to receive, one record) | PASS (local) |
| AC002 — source categories available; archived readable | T004 shipped-seed check; T005 DB/HTTP archive proof; T006 UI note and picker | PASS (local) |
| AC003 — UGX 150,000 to maize 2027A; wrong-farm rejected | T007 rule; T008 DB exact round trip, replay, mismatch and RLS; T009 UI | PASS (local) |
| AC004 — 500,000 − 150,000 = 350,000, no AI dependency | T010 domain; T011 service on the restricted role; T012 page | PASS (local) |
| AC005 — totals with basis/as-of labels; ties shown | T013 domain; T014 DB including empty, date filter, ties, unauthorized export and correction refresh; T015 page and CSV | PASS (local) |
| L gate — spending, categories, revenue and highest-cost enterprise answered with exact arithmetic and authorized histories | Money summary and gross margin pages and API; all K evidence; cumulative suites green | PASS (local) |

Conditions (nonblocking, owner-tracked):

| # | Condition | Owner | When |
|---|---|---|---|
| P4-C1 | GitHub-hosted CI must pass (D-P04-001) | Project owner | Before any production release |
| P4-C2 | Apply migration `202610250002` and `farm-accounting-runtime.sql` to hosted dev with separate authorization, then verify grants/policies read-only, as in D-P03-015 | Project owner / engineering | Before hosted use of the money screens |
| P4-C3 | Report projections or pagination for large histories (P4-A07) | Engineering | Phase 8 |
| P4-C4 | Rate-limit policy for exports (P4-A08) | Engineering / security | Before real farmer production data |

Inherited conditions carry forward unchanged:
- retention/export and attachment policy, before Document work or real farmer production data
- streamed-page redirect status for non-browser clients (Phase 24)
- registry defaults before the field pilot
- canonical hosted provisioning before production

Deferred by decision: net farm income (Phase 8, D-P04-004), tax and FX (D-P04-002), activity links (Phase 6), advances (D-P04-003), and category administration (D-P04-005).

Verdict: **PASS WITH CONDITIONS - LOCAL VERIFICATION**. All 16 tasks, all five acceptance criteria and the local exit gate are verified; no failing mandatory test is waived. The owner accepted this verdict and the conditions above on 2026-10-27 by selecting "Accept and commit (Recommended)" ([D-P04-012](../DECISION-LOG.md#d-p04-012--phase-4-closeout-acceptance)). No deployment, hosted change or production readiness is claimed.

Next allowed action: the single local Phase 4 commit (D-P04-011), made after acceptance. Pushing it and applying P4-C2 each need explicit instruction. Phase 5 needs separate authorization.

## Status-update evidence

Progress is computed from verified task IDs only: 16/16 = 100%. Updated together with this report:
- the phase document (status, H/F notes, O checklist)
- `PROJECT-STATUS.md`
- `MASTER-IMPLEMENTATION-ROADMAP.md`
- `REQUIREMENTS-TRACEABILITY.md` (R001–R005)
- `DECISION-LOG.md` (D-P04-007 to D-P04-011)
- the architecture notes (API, database, domain model, testing, migration policy, financial integrity)

A relative-link and decision-anchor check over every document under `docs/` reports no broken links. Historical reports remain historical, and the source extract is unchanged.
