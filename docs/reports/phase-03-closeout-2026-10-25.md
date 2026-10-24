# Phase 3 T013 audit and closeout

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — T013 task-relevant content, status and evidence.
- Implementation status: COMPLETED - 100% (13/13); PASS WITH CONDITIONS - LOCAL VERIFICATION; owner accepted.
- Last reviewed: 2026-10-25 (Africa/Nairobi), T013 audit.
- Related phase/task IDs: MYF-P03-T001–T013; MYF-P03-AC001–AC004.
- Verified completed work: T001-T013, AC001-AC004 and the local L gate; owner approval and hosted closure policy application verified.
- Remaining work/blockers: No blocking local Phase 3 gate. Inherited hosted CI/production conditions remain; signed-in hosted closure is not claimed.
- Evidence/report links: [Runtime repair](phase-03-runtime-permissions-2026-10-25.md); [T012](phase-03-t012-2026-10-25.md).
<!-- MYFARM-STATUS-END -->

## Phase identity and implementation scope

Phase 03, Enterprises, Crops, Livestock and Seasons. Reviewer: Codex; product/approval owner: repository owner. Date/time zone: 2026-10-25, Africa/Nairobi. Root baseline `9d6bf7c` plus the preserved runtime-repair changes; verification uses a separate local clone with committed candidate snapshots under `.cache/t013-clean`. No local secrets or the user's generated `next-env.d.ts` modification were copied into that clone. Final source/test candidate `d4b5f14` and command records are retained in `.cache/t013-evidence/`.

Authorization: D-P03-001–D-P03-014, especially the Phase 3 local CI substitution (D-P03-004), task commits (D-P03-006), deferred full AC001 proof (D-P03-007), selected catalog implementation (D-P03-010–013) and the owner's T013 clarification that active crop cycles block season closure (D-P03-014).

Implemented scope: scoped enterprise/season/crop/poultry creation, paginated histories and detail pages; catalog-driven workflows; final crop-cycle and season closure with confirmation and optimistic versions. Closed cycles remain in history and release active plot capacity. A season cannot close while any cycle remains active. No reopening, cascading closure, poultry movements, financial reporting or durable offline sync is introduced. Bird quantities retain the explicit STARTING_COUNT provenance until Phase 5.

## Changes and migrations

- Reused farm authorization, strict Zod boundaries, command receipts, scoped repositories, transaction/plot locks, command feedback, buttons and production submit/draft behavior.
- Added closure contract/domain/service/repository, two POST close routes, bound server actions and one shared confirmation form on season/cycle detail pages. No Prisma schema or migration change.
- Added `production-closure-runtime.sql` to the actual provisioning manifest. It grants only UPDATE of status/version/updatedAt for Season/CropCycle; RLS permits ACTIVE → CLOSED and denies reopening. Season policy also rejects active children. No table-wide UPDATE, record-field rewrite, DELETE, browser grant or security-definer function is introduced.
- Added a season transaction lock to crop starts; closures use the same lock before the existing plot lock. Authorization is rechecked after waits. Failed commands roll back both status and audit receipt; retries bind actor, target, farm and expected version.
- Fixed the reproduced non-UTC foundation rate-limit fault by pinning application PostgreSQL sessions to UTC while preserving role options and strict hosted TLS. No hosted database setting is changed. Direct test clients using arbitrary adapters do not automatically inherit the application helper.
- Updated only existing dependencies: Zod 4.3.6 → 4.6.7, fast-uri 3.1.8 → 3.1.9 and undici 7.30.0 → 7.30.1. No dependency addition, broad update or lockfile regeneration. Zod remains the shared validation library; fast-uri and undici are transitive. Existing licenses/usage remain unchanged.

The seven existing migrations were applied/replayed against disposable PostgreSQL 17; exact SHA-256 checksums are in `.cache/t013-evidence/migration-checksums.json`. Closure requires provider SQL only. Hosted development previously received the canonical poultry/catalog migrations and creation grants, preserving its extra empty legacy LivestockBatch table/history ([repair evidence](phase-03-runtime-permissions-2026-10-25.md)). That historical divergence is retained, not silently rewritten.

New hosted closure policy: **APPLIED AND VERIFIED**, after the owner explicitly selected "Approve policy and local closeout" on 2026-10-25. The exact reviewed file was applied in one transaction to development project `sudqhluwsaijvjjcegpv` over the verified session pooler and trusted TLS. Table/column ACLs and policies were captured first in `.cache/t013-evidence/hosted-closure-before.json`. Independent read-only verification in `hosted-closure-after.log` confirms lifecycle-column updates only, no table-wide UPDATE, record-field update, DELETE or browser access. RLS stays enabled and runtime LIMIT 0 reads pass without retrieving farmer rows. No farmer records or migration history were changed. No application deployment or push was performed. If permission rollback is authorized, restore the captured prior ACL/policy state and retain records/audit history; do not drop tables or reopen closed records.

## Security review and findings

| ID | Finding / consequence | Remediation and retest | Status |
|---|---|---|---|
| P3-A01 | Required cycle/season closure absent despite lifecycle statuses; no final close workflow | Added confirmed, scoped, versioned, atomic closure; active-child rule and start/close serialization; cross-user/farm/ADMIN, duplicate, stale version, revocation-wait and forced-update rollback tests | FIXED; local tests and hosted grants PASS |
| P3-A02 | Under Nairobi session time, both private grants succeeded at the 30/minute boundary | Reproduced against disposable database; central connection helper pins UTC. Final non-UTC run passes all 12 foundation DB tests, including clock alignment and the original limiter oracle | FIXED |
| P3-A03 | npm scan found high-severity Zod and undici advisories and moderate fast-uri findings | Narrow dependency updates; repeated production and full-tree audit both return zero vulnerabilities | FIXED |
| P3-A04 | Hosted development provisioning differs from the selected local history | Existing canonical migrations/grants verified in preceding repair; empty legacy table/history retained; no destructive reconciliation | Known development deviation; production must use the canonical chain |
| P3-A05 | Hosted CI and live signed-in provider behavior are not established by local checks | Existing D-P03-004 substitution remains local-only; no hosted readiness claim | OPEN operational gates |

Audit boundaries: application services authenticate and authorize the current FARMER membership and farm before repository access. All farm records and nested IDs/cursors constrain tenant and farm. Strict input schemas reject supplied actor/tenant fields. Server writes use same-origin JSON checks or the existing Next server-action boundary. Catalogs remain read-only, unsupported workflows unavailable. The runtime is a shared trusted backend role; its broad SELECT policies are not per-user database isolation, and SQL credentials must stay server-side. The new lifecycle policy does not create a browser Data API.

Tests exercise competing writes, receipt/season/plot waits, repeated and changed commands, rollback, mismatched parents, decimal capacity, integer flock counts, revoked membership and provider failures. No financial arithmetic, stock mutation, export/media endpoint or AI provider was added. Existing private-file checks remain cumulative. Current live Supabase advisors, real-device testing and hosted signed-in closure were not claimed.

Advisory sources checked: [Zod collection memory exhaustion](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), [fast-uri host confusion](https://github.com/advisories/GHSA-wjr9-j795-jxcr), [undici EventSource memory exhaustion](https://github.com/advisories/GHSA-4qv8-2p9j-2685). The owner explicitly approved sending dependency names/versions/metadata to npm's public advisory service after automatic review initially rejected the scan; no environment values or farmer records were sent.

## Tests and quality evidence

Node 24.13.0, Windows; fresh disposable `postgres:17` container `myfarm-t013-20261025`, loopback 55446, `myfarm_phase01_test`. Production browser fixtures use the existing synthetic loopback Auth server and real restricted-role PostgreSQL application services. They do not establish hosted Supabase Auth behavior. CI-equivalent commands run in the separate committed checkout, not against hosted farmer data. Offline testing covers open-form retention/reconnect only; full durable sync remains Phase 7.

| Command/suite | Observed result | Evidence under `.cache/t013-evidence/` |
|---|---|---|
| `npm ci --no-audit --no-fund` | PASS, exact patched lockfile in clone | tool transcript; lockfile snapshot |
| `npm run db:generate` | PASS | checks-0.log |
| `npm run lint` | PASS | checks-1.log |
| `npm run typecheck` | PASS | checks-2.log |
| `npm run check:boundaries` | PASS | checks-3.log |
| `npm test` | PASS, 475 tests | checks-4.log |
| `npm run db:migrate` | PASS, seven local migrations applied | checks-5.log; migration-checksums.json |
| `npm run test:integration` | PASS, 119 tests | checks-6.log |
| Non-UTC foundation integration run | PASS, 12 tests | non-utc.log |
| `npm run build` with fixture Auth | PASS, Next.js 16.4.3 | fixture-0.log |
| Full signed-in desktop/mobile browser suite | PASS, 72 tests; final rebuilt AC001 rerun PASS, 2 tests with per-season totals | signed-0.log; focused logs |
| Ordinary production build and anonymous browser suite | PASS, 38 tests; Chromium installation check PASS | ordinary logs |
| Prisma schema drift / crop and poultry dump-restore | PASS, no drift; both restore rehearsals pass, including closed histories and lifecycle column grants | recovery logs |
| `npm audit --omit=dev --json` / full `npm audit --json` | PASS, zero vulnerabilities in each after fixes | ../t013-audit-*-after.json |
| `git diff --check`, source preservation and document review | PASS; 102 documents, zero broken local links; source body preserved with Git LF normalization | [review inventory](phase-03-document-review-2026-10-25.md) |
| GitHub-hosted CI / live hosted signed-in closure | NOT VERIFIED / NOT RUN | D-P03-004; policy/grants verified, no real farmer closure performed |

Initial verification failures were investigated: the local runner incorrectly forced production React into component tests, then was corrected to CI's unset NODE_ENV; new-test typing issues were fixed. The first full signed-in run had 70 passes and two failures caused by a new unscoped alert selector matching Next's route announcer. The application showed the expected validation; the selector now targets the named closure form. No business assertion, timeout or security boundary was weakened.

## Acceptance, limitations and verdict

| Criterion | Evidence / scope | Result |
|---|---|---|
| AC001: separate farm and cycle histories/totals | New two-farm browser journey creates multiple crop enterprises, overlapping seasons, annual/perennial cycles and poultry batches; repeats commands, rejects wrong-farm parents/nested IDs and other users; checks preserved lists and exact unit-qualified source area/bird sums without a multiplying join. Closure remains historical and audited | PASS locally |
| AC002: dates, explicit units and area exceptions | Domain, integration, component and desktop/mobile crop suites; decimal aggregation and capacity locks across seasons/enterprises | PASS locally |
| AC003: whole birds, batch identity and count provenance | Contract/repository/UI/API suites; unique normalized farm labels and STARTING_COUNT provenance | PASS locally |
| AC004: catalog extension and unavailable workflows | Approved 14-crop catalog, same form for all 12 additions, capability-based unsupported states and source guard | PASS locally |
| L: owned relationships, cumulative gates, no blocking failures | All local command, recovery and documentation gates pass; owner accepted the closeout; hosted closure policy applied and verified | PASS locally, accepted under D-P03-015 |

Verdict: **PASS WITH CONDITIONS - LOCAL VERIFICATION**, accepted by the owner on 2026-10-25 under existing D-P03-004 and the inherited owner-tracked limits below. All 13 tasks and all four ACs are verified locally; the hosted closure policy is applied and independently checked. No failing mandatory test is waived. Phase 4 is NOT STARTED; no automatic advancement, production readiness or live signed-in hosted closure is claimed.

Inherited owner-tracked limits remain: GitHub/Linux CI before production (project owner, D-P03-004); hosted history/canonical fresh production provisioning (engineering/owner, before production); retention/export policy before Document work or real farmer production data (product/privacy owner); proposed registry defaults before the field pilot and Phase 7 retry policy (product owner); streamed page redirect status for non-browser clients (engineering, Phase 24 or before those clients depend on status). Previously resolved provider/browser-role conditions are not reopened by this report. Real low-cost Android testing belongs to the field pilot. No new nonblocking exception or owner deadline is invented.

Next action: restart an existing dev process to use the updated connection setup, then retry the farmer workflows. Phase 4 requires separate authorization. Restore GitHub-hosted CI and meet inherited production gates before any production release. The user's unrelated generated-file change is preserved; no push or application deployment.

## Status-update evidence

The session document inventory records the actual review depth per file. Affected phase/status/traceability/decisions/setup/architecture content is reviewed deeply; historical and future-phase documents receive metadata/link relevance review only, without changing their historical facts, approved source bodies or implementation completion. Source-extract preservation is checked against the baseline. Local evidence artifacts contain synthetic test data and operational metadata, not credentials.

Desktop/mobile closure screenshots in `.cache/t013-clean/.cache/t013-visual/` were inspected: confirmation, active-child feedback and closed-season history are readable without overflow. The crop recovery harness now permits the explicitly named T013 task container in addition to T005 while retaining loopback/database/container guards; it verifies closed cycle/season versions, three receipts and restored column ACLs. Its initial T005-only guard correctly refused the T013 container before this explicit reuse change.

Adapter diagnosis: installed `@prisma/adapter-pg` `mapArg` routes Date values to `formatDateTime`, which formats UTC components without a time-zone suffix (index.mjs lines 331-356). PostgreSQL therefore interprets those values in the session zone. The repair pins the application session to UTC rather than rewriting historical timestamps or changing hosted defaults.

Final cleanup: synthetic User/Farm/Enterprise/Season/CropCycle/PoultryBatch/AuditEvent counts were all zero; 14 crops and four animal types remained. The exact verified disposable container was removed. All 214 source/test/provisioning/package files match candidate `d4b5f148e7796e921e8d534e03411875e4f22a0f` after Git LF normalization. The user's generated-file bytes remain unchanged. Browser server teardown completed normally; no user dev server was stopped. Evidence and the disposable clean checkout remain ignored local artifacts.
