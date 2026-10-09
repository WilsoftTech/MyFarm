# Phase 02 closeout — 2026-10-09

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase02 implementation, verification and closeout record.
- Implementation status: REFERENCE ONLY — N/A (evidence and closeout record).
- Last reviewed: 2026-10-09 (Africa/Nairobi), Phase02 implementation and closeout session.
- Related phase/task IDs: MYF-P02-T001–T013; MYF-P02-AC001–AC004; decisions D-P02-001–D-P02-008.
- Verified completed work: 13/13 Phase02 tasks verified; local CI reproduction, database, live Supabase, anonymous production and security checks PASS.
- Remaining work/blockers: No blocker. As of 2026-10-10, P2-C2, P2-C6 and P2-C8 are resolved; P2-C1, P2-C3–P2-C5 and P2-C7 remain open (§6), nonblocking, with owner and deadline.
- Evidence/report links: [Evidence folder](evidence/phase-02-2026-10-09/); [every-document review](phase-02-document-review-2026-10-09.md); [Phase 2 specification](../phases/phase-02-farmer-registry.md); [superseded interim closeout](phase-02-closeout-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

**Verdict: PASS WITH CONDITIONS — LOCAL VERIFICATION.** Phase 02 is **COMPLETED — 100% (13/13 verified task IDs)**. GitHub-hosted CI is billing-locked and **not claimed**; the owner extended the local-CI substitution to Phase 2 only ([D-P02-006](../DECISION-LOG.md#d-p02-006--phase-2-local-ci-substitution)).

## 1. Phase identity and implementation scope

| Item | Value |
|---|---|
| Phase | 02 — Farmer Identity and Farm Registry ([specification](../phases/phase-02-farmer-registry.md)) |
| Date / time zone | 2026-10-09, Africa/Nairobi |
| Owner / executor | Project owner (decisions); Claude Code (implementation and verification) |
| Repository / branch | WilsoftTech/MyFarm, local branch `phase-02-farmer-registry` in worktree `.claude/worktrees/phase-02`, based on the closed Phase 1 head `e4ea43b` |
| Commits | `ba27b3b` (port of the 2026-10-08 Phase 2 commit `18cc422`), `b095c89` (integration and hardening), `e065e7a` (signed-in navigation), `2c53ad6` (`.gitattributes`), plus this documentation commit |
| Prerequisites | Phase 0 COMPLETED by owner acceptance; Phase 1 COMPLETED, PASS WITH CONDITIONS — LOCAL VERIFICATION (2026-10-08) |
| Not pushed / not merged / not deployed | Nothing was pushed, merged or deployed to any hosting; no production system touched |

**Owner decisions applied.**

| Decision | Status | Effect |
|---|---|---|
| [D-P02-001](../DECISION-LOG.md#d-p02-001--phase2-started-before-the-phase1-exit-gate) | Sequencing override, now moot (Phase 1 closed) | — |
| [D-P02-002](../DECISION-LOG.md#d-p02-002--q05-identity-model) (Q05) | Approved | 1 user = 1 farmer in a PERSONAL organization; many farms; plots |
| [D-P02-003](../DECISION-LOG.md#d-p02-003--q06-data-minimization) (Q06) | Approved | Minimal fields; Document deferred |
| [D-P02-004](../DECISION-LOG.md#d-p02-004--phase2-engineering-defaults-proposed-owner-may-change) | PROPOSED | Engineering defaults |
| [D-P02-005](../DECISION-LOG.md#d-p02-005--hosted-development-verification-for-phase-2) | Approved | Hosted dev verification |
| [D-P02-006](../DECISION-LOG.md#d-p02-006--phase-2-local-ci-substitution) | Approved | Local CI for Phase 2 |
| [D-P02-007](../DECISION-LOG.md#d-p02-007--runtime-role-privileges-for-registry-writes) | Implemented | Runtime-role grants |
| [D-P02-008](../DECISION-LOG.md#d-p02-008--phase-1-condition-c5-resolved-for-anonymous-visitors) | Implemented | Phase 1 condition C5 |

**Delivered behavior.** A signed-in, owner-provisioned account registers once as a farmer. This creates a PERSONAL organization, a FARMER membership, the Farmer and a FarmerProfile atomically. The farmer then creates farms (optional acreage and GPS pair) and plots (optional area with unit), lists and views only their own farms, and edits their profile with optimistic versioning.

- **Authorization:** FarmAccessPolicy requires an ACTIVE FarmMember row **and** an ACTIVE FARMER membership of the farm's tenant, re-checked on every request. Organization ADMIN/AGENT roles grant no farm-data access.
- **Idempotency:** every write carries a client request ID recorded as an audit receipt; retries replay.
- **API:** `GET/POST/PATCH /api/v1/farmer`, `GET/POST /api/v1/farms` (cursor pagination, ≤ 50), `GET /api/v1/farms/{farmId}`, `POST /api/v1/farms/{farmId}/plots`; all `private, no-store`.
- **Pages:** `/farmer`, `/farmer/edit`, `/farms`, `/farms/new`, `/farms/{farmId}`, with a signed-in registry navigation (My farms, My profile, Workspace, Sign out).

**Changes made this session on top of the 2026-10-08 Phase 2 commit:**

1. **Phase 1 condition C3 resolved:** migration renamed `202610080002_farmer_registry` → `202610090001_farmer_registry`, so it sorts after `202610080101`.
2. **Security defect fixed:** registry commands used a private origin check that trusted `X-Forwarded-Host`, diverging from Phase 1's shared `requireSameOrigin` (Host only). Registry commands now reuse the shared policy; a regression test covers the forwarded-host case.
3. **Idempotency gap fixed:** a registration retried with the *same* request ID returned 409. It now replays, including for the loser of a concurrent race; a new request ID still conflicts.
4. **Merge-integration defect fixed:** Phase 1 added the `RATE_LIMITED` error code after Phase 2 was written, so the server-action message map was non-exhaustive (`npm run typecheck` failed on the integrated tree). The map is now typed `Record<FoundationError["code"], string>`.
5. **New `supabase/policies/farmer-registry-runtime.sql`** ([D-P02-007](../DECISION-LOG.md#d-p02-007--runtime-role-privileges-for-registry-writes)): least-privilege runtime grants with RLS write checks, plus an integration suite that runs the registry *as* `myfarm_runtime`. Before this, the Phase 2 code had never run under the hosted restricted role, which had no grants on the new tables.
6. **Phase 1 condition C5 resolved for anonymous visitors:** the proxy returns a real 307 for protected pages.
7. **UX defect from visual review:** the shared header showed "Sign in" to signed-in farmers, and registry pages had no sign-out. Fixed with "My account" and the registry navigation.
8. **Line-ending fix:** `.gitattributes` pins migration SQL to LF (§2).

**Not delivered, by decision:** Document upload/storage and separate Address/Contact tables (D-P02-003); ownership transfer, agent- or manager-assisted registration and location catalogs (D-P02-002); farm/plot edit or delete; search; export; offline sync (Phase 7).

## 2. Changes and migrations

**Files (vs Phase 1 head `e4ea43b`, excluding generated Prisma client):** 39 source/test/schema files, +1,793/−4 lines.

- `src/modules/farmer-registry/` — `domain/rules.ts`, `contracts/registry.ts`, `application/registry.ts`, `infrastructure/{repository,services,http}.ts`
- `src/app/api/v1/farmer/route.ts`, `src/app/api/v1/farms/route.ts`, `src/app/api/v1/farms/[farmId]/route.ts`, `src/app/api/v1/farms/[farmId]/plots/route.ts`
- `src/app/farmer/{page,edit/page,actions,guard,layout}.tsx|ts`, `src/app/farms/{page,new/page,[farmId]/page,layout}.tsx`
- `src/components/farmer-registry/*` (forms, field, labels, registry-nav), `src/components/ui/select.tsx`
- Modified: `src/proxy.ts`, `src/app/layout.tsx`, `src/app/workspace/page.tsx`
- `prisma/schema.prisma`, `prisma/migrations/202610090001_farmer_registry/migration.sql`, `supabase/policies/farmer-registry-runtime.sql`, `.gitattributes`
- Tests: `tests/unit/farmer-registry-{http,rules,service}.test.ts`, `tests/component/farmer-registry-forms.test.tsx`, `tests/integration/farmer-registry.test.ts`, `tests/integration/farmer-registry-runtime-role.test.ts`, `tests/e2e/farmer-registry.spec.ts`

No dependency was added or changed. Reused from Phase 1: AuthorizationService, the identity repository, FoundationError, `failureResponse`, `requireSameOrigin`, `logSafe`, the database client, Button/Input and the RHF/Zod pattern.

**Migration `202610090001_farmer_registry`.** SHA-256 of the committed LF file: `9288d81e…b672f4e`. The content is identical to the 2026-10-08 file; only the directory name changed.

- **Schema:** enums LandOwnership, FarmActivity, AreaUnit, FarmMemberRole; tables Farmer, FarmerProfile, Farm, Plot, FarmMember.
- **Integrity:** composite `(id, tenantId)` foreign keys; CHECK constraints for acreage/area ≥ 0, coordinate pair and range, area/unit pair, ≥ 1 activity, distinct phones, version ≥ 1; RLS enabled.
- **Compatibility:** purely additive; Phase 1 tables are only referenced, never altered.

| Environment | Status | Evidence |
|---|---|---|
| Local isolated `postgres:17` (CI reproduction) | Fresh apply PASS; replay "No pending migrations"; status up to date; drift none; second fresh DB drift none; schema IDENTICAL | [database/](evidence/phase-02-2026-10-09/database/) |
| Backup/restore rehearsal | PASS: synthetic rows in all 5 registry tables restored with identical counts and exact decimals (`0.750000`, `-0.790123`, `2.5000`); RLS, composite tenant FK and CHECK constraint restored and enforced | [10-restore.log](evidence/phase-02-2026-10-09/database/10-restore.log) |
| Hosted **development** project `sudqhluwsaijvjjcegpv` (D-P02-005) | **Applied 2026-10-09** with `prisma migrate deploy` (postgres role, session pooler, verified TLS). Before: exactly Phase 1's 2 migrations, 0 application rows. After: up to date | [hosted/01–03](evidence/phase-02-2026-10-09/hosted/) |
| Hosted dev provider SQL | `farmer-registry-runtime.sql` applied in one transaction. Verified: 18 runtime policies; runtime INSERT/SELECT only on registry tables; column-limited FarmerProfile UPDATE (12 columns); no DELETE; `anon`/`authenticated` hold no privilege on registry tables; RLS on every table | [04-runtime-policy.json](evidence/phase-02-2026-10-09/hosted/04-runtime-policy.json) |
| Production | NOT APPLIED — not authorized and not provisioned | — |

**Rollback.** Before any farmer data exists, drop the five registry tables and four enums, and the Phase 2 policies/grants, in an isolated environment. Once farmer data exists, restore from backup rather than dropping. No production RPO/RTO is established.

**Finding — mixed migration checksums** ([11-migration-checksums.log](evidence/phase-02-2026-10-09/database/11-migration-checksums.log)). Prisma records the raw byte checksum. With `core.autocrlf=true` and no `.gitattributes`, Windows and Linux checkouts differ:

- Hosted dev already recorded `foundation` as CRLF and `private_grant_rate_limit` as LF (Phase 1).
- This session's Windows deploy recorded `farmer_registry` as CRLF.

`migrate deploy` and `migrate status` are unaffected (tested with an LF checkout); `migrate dev` and checksum audits would flag the files as modified. `.gitattributes` now pins migration SQL to LF; the recorded hosted checksums were left untouched (condition P2-C3).

## 3. Security review

| Area | Verdict | Basis |
|---|---|---|
| Authentication | PASS | Every service method authenticates before validating input (unit). Anonymous APIs 401 with no detail, anonymous pages a real 307 (E2E, probe). Revoked provider session → API 401 and browser redirected (live) |
| Tenant/parent isolation, IDOR | PASS | Tenant and farm are always derived server-side. Strict schemas reject client `tenantId`/`farmerId`/`ownerFarmerId` (unit, integration, live 400). Second farmer cannot read, list or add plots to another farm; guessed and foreign IDs are indistinguishable 403 (integration, live). Composite FKs reject cross-tenant rows (integration, restore) |
| Administrator access | PASS | ADMIN membership of the farmer's tenant gets no profile, no farm list (403) and no farm detail (403/forbidden page) (integration, live) |
| Revocation | PASS | Revoked FarmMember or tenant membership denies the next request; restoring re-grants (integration, live) |
| Database least privilege | PASS | Runtime-role suite proves the role completes the journey but cannot join or escalate memberships, create non-PERSONAL organizations, write rows for another farmer/farm, update farms/plots/identifiers, or delete anything. Browser roles are denied. Policy mutation (plot `WITH CHECK (true)`) makes the suite fail, so it detects regressions |
| File grants | PASS | A second farmer cannot obtain a private-file grant in another farmer's tenant (integration, live) |
| Export/search | NOT APPLICABLE | No export or search exists in Phase 2; nothing to leak. Re-test when introduced |
| Input validation | PASS | Strict Zod schemas; phone normalization; decimal strings never parsed to float; coordinate pair/range; area/unit pair; UUID params; JSON content type; same-origin required (shared Phase 1 policy) |
| Idempotency/concurrency | PASS | Concurrent identical farm commands → exactly one farm and one audit (integration, live ×3). Concurrent identical registrations → one farmer. Stale profile version → 409. A failed duplicate plot leaves no receipt |
| Audit | PASS | Registration, profile update, farm and plot writes audited once with actor/tenant/target/request (integration, live) |
| Secrets and logs | PASS | No secret in the client bundle (20 files), the 52 changed files, branch history or evidence ([secret-scan.json](evidence/phase-02-2026-10-09/security/secret-scan.json)). Server logs contain no name, phone, village or coordinates (live) |
| Headers / sensitive paths | PASS | 49/49 anonymous production probes, including new provider SQL and harness paths → 404 ([anonymous-probe.log](evidence/phase-02-2026-10-09/security/anonymous-probe.log)) |
| Dependencies | PASS | `npm audit` 0 vulnerabilities (all and `--omit=dev`) ([npm-audit.json](evidence/phase-02-2026-10-09/security/npm-audit.json)) |
| Offline revocation | NOT APPLICABLE | No offline data in Phase 2 (Phase 7) |
| Supabase security/performance advisors | NOT RUN | The Supabase MCP server is unauthenticated in this session. Equivalent catalog checks above (RLS, grants, policies) were run directly (P2-C6) |

Residual risks:

- **Replay semantics (D-P02-004):** a request ID replayed with a *different* payload returns the original record rather than 409.
- **C5 residual:** a revoked-but-unexpired JWT still receives the in-stream redirect, with no content rendered.
- **`_prisma_migrations` privileges:** in hosted dev, `anon`/`authenticated` retain table privileges on `_prisma_migrations`. RLS denies all rows; this is pre-existing from Phase 1 (P2-C8).

## 4. Tests and quality evidence

**Local CI reproduction ([D-P02-006](../DECISION-LOG.md#d-p02-006--phase-2-local-ci-substitution)).** A clean `git clone --no-hardlinks` of the branch at `e065e7a` (no `.env.local`, `node_modules` or `.next`) ran every `quality.yml` step against a **new** `postgres:17` container (`myfarm-phase02-localci`, digest `sha256:67f41722…`, identical to Phase 1's run) with the workflow's environment and no Supabase variables. Environment: Windows 11, Node 24.13.0, Docker 28.4.0. Harness: [local-ci.mjs.txt](evidence/phase-02-2026-10-09/harness/local-ci.mjs.txt).

| # | Step | Result | Log |
|---|---|---|---|
| 1 | `npm ci` | PASS | [log](evidence/phase-02-2026-10-09/ci-run-e065e7a/01-npm-ci.log) |
| 2 | `npm run db:generate` | PASS | [log](evidence/phase-02-2026-10-09/ci-run-e065e7a/02-db-generate.log) |
| 3 | `npm run lint` (`--max-warnings=0`) | **PASS, 0 warnings** | [log](evidence/phase-02-2026-10-09/ci-run-e065e7a/03-lint.log) |
| 4 | `npm run typecheck` | **PASS** | [log](evidence/phase-02-2026-10-09/ci-run-e065e7a/04-typecheck.log) |
| 5 | `npm run check:boundaries` | PASS | [log](evidence/phase-02-2026-10-09/ci-run-e065e7a/05-boundaries.log) |
| 6 | `npm test` | **PASS, 117/117, 15 files, 0 skipped** (59 Phase 1 + 58 Phase 2) | [log](evidence/phase-02-2026-10-09/ci-run-e065e7a/06-test.log) |
| 7 | `npm run db:migrate` (fresh DB) | PASS, 3/3 migrations | [log](evidence/phase-02-2026-10-09/ci-run-e065e7a/07-db-migrate.log) |
| 8 | `npm run test:integration` (real PostgreSQL 17) | **PASS, 33/33, 3 files** (11 Phase 1 + 22 Phase 2) | [log](evidence/phase-02-2026-10-09/ci-run-e065e7a/08-test-integration.log) |
| 9 | `npm run build` (production) | **PASS** | [log](evidence/phase-02-2026-10-09/ci-run-e065e7a/09-build.log) |
| 10 | `npx playwright install chromium` | PASS | [log](evidence/phase-02-2026-10-09/ci-run-e065e7a/10-playwright-install.log) |
| 11 | `npm run test:e2e` (production `next start`) | **PASS, 24/24** (12 desktop Chrome + 12 Pixel 7) | [log](evidence/phase-02-2026-10-09/ci-run-e065e7a/11-test-e2e.log) |

Steps per [steps.json](evidence/phase-02-2026-10-09/ci-run-e065e7a/steps.json). A final re-run on the documentation head `9c99aa1` also passed 11/11 (§7).

| Suite | Environment | Result | Evidence |
|---|---|---|---|
| Live: real Supabase Auth, restricted `myfarm_runtime` DB role, production `next start` (dev configuration), 3 disposable users | Isolated dev project | **48/48 PASS**; cleanup returned every application table and temporary auth users to 0 (the empty baseline) | [live-results.json](evidence/phase-02-2026-10-09/hosted/live-results.json), [run log](evidence/phase-02-2026-10-09/hosted/06-live-run.log), [harness](evidence/phase-02-2026-10-09/harness/p2-live.mjs.txt) |
| Anonymous production probes | Production build, dev configuration | **49/49 PASS** | [log](evidence/phase-02-2026-10-09/security/anonymous-probe.log) |
| Database: replay/status/drift/second DB/schema/catalog/restore | Local CI container | **10/10 PASS** | [database.json](evidence/phase-02-2026-10-09/database/database.json) |
| Runtime-role policy mutation test | Local DB | Mutation detected (2 failures), restored suite passes | This report §3 |
| Visual review (mobile, authenticated) | Chromium Pixel 7 | Reviewed; one UX defect found and fixed (§1 item 7) | [farm detail](evidence/phase-02-2026-10-09/hosted/farm-detail-mobile.png), [profile](evidence/phase-02-2026-10-09/hosted/farmer-profile-mobile.png) |
| Dependency audit / secret scan | — | PASS / PASS | [security/](evidence/phase-02-2026-10-09/security/) |
| GitHub-hosted CI | — | **NOT VERIFIED** (billing lock, run 37893530528) | P2-C1 |
| Linux runner, real low-end Android device | — | NOT VERIFIED | P2-C1; Phase 9 pilot |
| Offline/sync tests | — | NOT APPLICABLE (Phase 7) | — |
| Load tests | — | NOT APPLICABLE (no performance gate in Phase 2) | — |

The 48 live checks cover:

- real mobile sign-in;
- accessible errors on an empty registration;
- registration;
- a farm form prefilled from the profile;
- half-GPS rejection;
- farm creation;
- two plots, plus a duplicate-name message that keeps the input;
- farm list plot count;
- profile with normalized phone, and a profile edit;
- the state-neutral header and registry navigation;
- Secure/HttpOnly/SameSite=Lax cookies;
- the API contract;
- concurrent idempotent farm creation;
- forged `tenantId` and cross-origin rejection;
- second-farmer registration and replay/conflict, and its IDOR denials (read, plot, list, guessed and malformed ID, scope, private-file grant, forbidden page);
- registry sign-out;
- administrator denials;
- farm and tenant membership revocation and restore;
- persisted integrity and audit counts;
- provider global sign-out with API and browser denial;
- log hygiene.

**Explicit status of the four mandatory commands:** lint PASS (0 warnings), TypeScript typecheck PASS, `npm test` PASS (117/117), production build PASS.

## 5. Acceptance criteria and exit gate

| Criterion | Evidence | Result |
|---|---|---|
| **AC001** Farmer/farm ownership bound to authenticated actor; foreign-tenant plot link rejected | Integration: journey, forged FK inserts (plot→foreign farm, orphan plot, foreign owner, foreign member) rejected. Runtime-role RLS rejects foreign writes. Live: one farmer, PERSONAL tenant, OWNER membership, tenant-consistent plots; second farmer's plot → 403. Restore keeps the composite FK | **PASS** |
| **AC002** Optionality approved; extra sensitive data requires purpose | Field list per owner decision D-P02-003; strict schemas reject undeclared fields; phone/location validation (unit, component, live); no identity numbers or documents collected | **PASS** |
| **AC003** Nonnegative acreage; complete valid coordinate pair | Unit boundary tables; DB CHECKs (integration, restore); component form; live half-pair rejected and full pair stored exactly | **PASS** |
| **AC004** Two farmers cannot list/read/edit/delete/export each other's data or obtain file grants | List, read, add-plot and profile-hijack denied (integration, live). Delete: no endpoint exists and the runtime role has no DELETE privilege (verified). Export/search: not implemented in Phase 2. File grants denied (integration, live) | **PASS** for every implemented operation |
| **L** Register → create farm → create plots → view owned profile; tenant isolation tests pass | Live real-browser journey on mobile with real Supabase Auth and the restricted DB role; all isolation suites pass | **PASS** |
| **L** Cumulative prerequisites | Phase 0 owner-accepted; Phase 1 PASS WITH CONDITIONS; Phase 1 conditions C3 and C5 (anonymous) resolved here | **PASS** |
| **L** Required command results logged; no blocking defect | §4; all findings fixed and retested | **PASS** (CI under D-P02-006) |

| Task | Evidence | Status |
|---|---|---|
| T001 | R001 contract/schema: domain + DB composite FK/orphan tests | VERIFIED |
| T002 | R001 service/API: ownership, cross-tenant, rollback, concurrency, runtime-role | VERIFIED |
| T003 | R001 UI: live register → farm → plots journey; anonymous 307 | VERIFIED |
| T004 | R002 contract: phone/location/minimization rules, strict schemas | VERIFIED |
| T005 | R002 service: register/update, optimistic version, replay | VERIFIED |
| T006 | R002 UI: profile form errors, optional fields, live edit | VERIFIED |
| T007 | R003 contract: acreage/GPS/area rules + DB CHECKs | VERIFIED |
| T008 | R003 service: farm create/list/view, pagination, idempotency | VERIFIED |
| T009 | R003 UI: farm form with optional GPS disclosure, live half-pair rejection | VERIFIED |
| T010 | R004 contract: FarmAccessPolicy, scoped repository, runtime-role policies | VERIFIED |
| T011 | R004 service: IDOR, admin-no-access, revocation, file-grant denial, least-privilege DB role | VERIFIED |
| T012 | R004 UI: live cross-farmer/admin forbidden pages, sign-out, session revocation | VERIFIED |
| T013 | Audit, remediation (§1 items 2–8), retest and this closeout | VERIFIED |

**Progress = 13/13 × 100 = 100%.**

## 6. Conditions (nonblocking, owner-tracked), limitations and deferred work

| ID | Condition | Owner | Deadline |
|---|---|---|---|
| P2-C1 | GitHub-hosted CI unverified (billing lock); Linux runner not verified | Project owner | Before any production release; recommended before merging to `main` |
| P2-C2 | Provider SQL (`runtime-role.sql`, `foundation-hardening.sql`, `private-storage.sql`, now `farmer-registry-runtime.sql`) lives outside the Prisma chain (extends Phase 1 C2) | Engineering | Before provisioning any new environment |
| P2-C3 | Hosted dev migration history mixes CRLF and LF checksums; `.gitattributes` prevents recurrence | Engineering / owner | Reconcile or accept before production; build production from an LF checkout |
| P2-C4 | D-P02-004 engineering defaults remain PROPOSED: enums, language codes, phone normalization, replay-with-different-payload semantics | Product owner | Owner review before the Phase 9 field pilot; replay semantics with the Phase 7 sync contract |
| P2-C5 | Q06 retention/erasure/export/backup policy open; Document upload deferred | Product/privacy owner | Before any Document work or real farmer data in production |
| P2-C6 | Supabase security/performance advisors not run (MCP unauthenticated) | Engineering | Next session with MCP authorized; before production |
| P2-C7 | Revoked-but-unexpired JWT receives an in-stream redirect (no content); non-browser clients see 200 for that case (Phase 1 C5 residual) | Engineering | Phase 24 hardening, or earlier if API clients rely on page status |
| P2-C8 | `anon`/`authenticated` hold table privileges on `_prisma_migrations` in hosted dev (RLS deny-all; pre-existing) | Engineering | Revoke before production |

**Status update 2026-10-09 (integration):** P2-C2 resolved locally and P2-C8 fix ready (hosted dev still pending); see the [integration report](phase-01-02-integration-2026-10-09.md#7-conditions). The rest of this closeout is historical.

**Status update 2026-10-10 (hosted application):** the provider files are applied to hosted dev and the Supabase advisors were run, so **P2-C2, P2-C6 and P2-C8 are resolved**. P2-C1, P2-C3, P2-C4, P2-C5 and P2-C7 stay open. Phase 2 completion is reconfirmed: COMPLETED — 100% (13/13), PASS WITH CONDITIONS — LOCAL VERIFICATION. See the [integration report §9](phase-01-02-integration-2026-10-09.md#9-hosted-application--2026-10-10).

**Limitations:**

- The interface is English only; the preferred language is stored but no translation is implied.
- Visual review covered Chromium mobile emulation, not a real low-end Android device.
- No farmer research supports the field choices (Phase 0 limitation).
- Phase 2 adds no self sign-up; accounts remain owner-provisioned (Phase 1).

**Pre-existing items observed and not changed:**

- `@supabase/*` versions, flagged as caret ranges on 2026-10-08, are now exact pins (Phase 1).
- Unused `src/lib/{client,server,middleware}.ts` boilerplate remains.
- The original `worktree-phase-02` branch (`18cc422`) is kept unchanged for history.

**Verdict: PASS WITH CONDITIONS — LOCAL VERIFICATION.** All mandatory gates pass and there is no blocking defect. The conditions above are nonblocking and have owners and deadlines. **Next allowed action:** owner review of this closeout; then push/merge the branch when authorized, and restore hosted CI (P2-C1). Phase 3 must not start without explicit authorization.

## 7. Status-update evidence

- **Every-document review:** all 83 Markdown documents under `docs/` were reviewed, with metadata updated per the [status policy](../engineering/document-status-policy.md); see the [register](phase-02-document-review-2026-10-09.md).
- **Updated content:**
  - [PROJECT-STATUS](../PROJECT-STATUS.md);
  - the [Phase 2 specification](../phases/phase-02-farmer-registry.md) status and checklist;
  - [REQUIREMENTS-TRACEABILITY](../REQUIREMENTS-TRACEABILITY.md) P02 rows;
  - [DECISION-LOG](../DECISION-LOG.md) D-P02-005–008;
  - the [roadmap](../MASTER-IMPLEMENTATION-ROADMAP.md) and [docs README](../README.md);
  - the [reports index](README.md);
  - the affected architecture and engineering specifications;
  - the [interim 2026-10-08 closeout](phase-02-closeout-2026-10-08.md), now marked superseded.
- **Source extract:** body untouched; metadata only.
- **Final local CI re-run on the documentation head `9c99aa1`:** fresh clone and a new `postgres:17` container. All 11 `quality.yml` steps PASS: lint 0 warnings, typecheck, boundaries, 117/117 unit/component, 3/3 migrations, 33/33 integration, build, 24/24 E2E ([steps.json](evidence/phase-02-2026-10-09/ci-run-final/steps.json), [logs](evidence/phase-02-2026-10-09/ci-run-final/)). The fresh Windows clone checked out every migration with LF endings, confirming the `.gitattributes` fix. This evidence-only commit follows it.
