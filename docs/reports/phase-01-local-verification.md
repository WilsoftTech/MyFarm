# Phase 01 local verification and final closeout

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase01 local CI substitution, verification evidence and final audit.
- Implementation status: REFERENCE ONLY — N/A (evidence and closeout record).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase01 local verification closeout session (Claude Code).
- Related phase/task IDs: MYF-P01-T001–T013; MYF-P01-AC001–AC004; decision D-P01-LOCAL-CI-001.
- Verified completed work: All quality.yml steps reproduced locally and PASS at bd9fadc; database, real Supabase auth, production-mode and security checks PASS.
- Remaining work/blockers: No blocker. Conditions C1–C5 below (hosted CI unverified, provider SQL outside migration chain, Phase2 migration ordering, recovery email/production settings, streamed redirect status).
- Evidence/report links: [Evidence folder](evidence/phase-01-local-verification/); [decision](../DECISION-LOG.md#d-p01-local-ci-001--phase-1-local-ci-substitution); [prior hosted report](phase-01-hosted-verification-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

**Verdict: PASS WITH CONDITIONS — LOCAL VERIFICATION.** Phase 1 is COMPLETED — 100% (13/13 verified task IDs) under owner decision [D-P01-LOCAL-CI-001](../DECISION-LOG.md#d-p01-local-ci-001--phase-1-local-ci-substitution). **GitHub-hosted CI has not passed and is not claimed.**

## 1. Identity

| Item | Value |
|---|---|
| Repository / branch | WilsoftTech/MyFarm, `codex/phase-01-closeout` |
| Starting commit | `d9ef30b213a66ad1a42a5b08a362cc0d5a84fde0` |
| Verified code commit | `bd9fadcaa98ccb1ff02e70995cb407e91adc6a56` (defect fix below); the documentation commit that adds this report changes docs only |
| Executor | Claude Code, owner-authorized Phase 1 finalisation |
| Date | 2026-10-08 (Africa/Nairobi) |
| Phase 2 | Separate worktree `worktree-phase-02` — inspected read-only, not modified |

## 2. GitHub CI exception

GitHub Actions run [37743343360](https://github.com/WilsoftTech/MyFarm/actions/runs/37743343360) (workflow_dispatch on `d9ef30b`) concluded `failure` with zero executed steps. GitHub's job annotation reads: *"The job was not started because your account is locked due to a billing issue."* The owner authorized equivalent local verification for Phase 1 only ([D-P01-LOCAL-CI-001](../DECISION-LOG.md#d-p01-local-ci-001--phase-1-local-ci-substitution)). Hosted CI remains **NOT VERIFIED** and must be revisited before any production release. GitHub also notes `ubuntu-latest` migrates to Ubuntu 26 from 2026-10-19; re-check the workflow when CI is restored.

## 3. Environment

| Component | quality.yml | Local reproduction |
|---|---|---|
| Runner OS | ubuntu-latest | Windows 11 Pro 10.0.26200 (deviation, see §9) |
| Node.js | `setup-node` 24 | 24.13.0, npm 11.6.2 |
| Checkout | actions/checkout@v4 | `git clone --no-hardlinks` of the branch into an empty scratch directory — no `.env.local`, no `node_modules`, no `.next` |
| Database service | postgres:17, user `myfarm`, db `myfarm_phase01_test`, port 55431, pg_isready health check | Docker 28.4.0 `postgres:17` (PostgreSQL 17.11, digest `sha256:67f41722…ad5675`), identical user/password/db/port and health check, **new container per run** (`myfarm-phase01-localci`) bound to 127.0.0.1 |
| Env vars | DATABASE_URL, DIRECT_URL, TEST_DATABASE_URL | Identical values; `CI=true`; all Supabase variables removed from the environment |
| Browser | `playwright install --with-deps chromium` | Playwright 1.64.0 chromium (`--with-deps` installs Linux packages only) |

Runner: [harness/local-ci.mjs.txt](evidence/phase-01-local-verification/harness/local-ci.mjs.txt) executes each step in order and, like Actions, stops at the first failure.

## 4. Workflow reproduction results

Baseline at `d9ef30b`: all 11 steps exit 0 ([steps.json](evidence/phase-01-local-verification/ci-baseline-d9ef30b/steps.json)). Final run at `bd9fadc` on a fresh clone and fresh database:

| # | quality.yml step | Exit | Result | Log |
|---|---|---|---|---|
| 1 | `npm ci` | 0 | PASS | [log](evidence/phase-01-local-verification/ci-run-bd9fadc/01-npm-ci.log) |
| 2 | `npm run db:generate` | 0 | PASS | [log](evidence/phase-01-local-verification/ci-run-bd9fadc/02-db-generate.log) |
| 3 | `npm run lint` (`--max-warnings=0`) | 0 | PASS, 0 warnings | [log](evidence/phase-01-local-verification/ci-run-bd9fadc/03-lint.log) |
| 4 | `npm run typecheck` | 0 | PASS | [log](evidence/phase-01-local-verification/ci-run-bd9fadc/04-typecheck.log) |
| 5 | `npm run check:boundaries` | 0 | PASS | [log](evidence/phase-01-local-verification/ci-run-bd9fadc/05-boundaries.log) |
| 6 | `npm test` (unit + component) | 0 | **59/59 PASS**, 11 files, 0 skipped | [log](evidence/phase-01-local-verification/ci-run-bd9fadc/06-test.log) |
| 7 | `npm run db:migrate` (fresh DB) | 0 | 2/2 migrations applied | [log](evidence/phase-01-local-verification/ci-run-bd9fadc/07-db-migrate.log) |
| 8 | `npm run test:integration` (real PostgreSQL) | 0 | **11/11 PASS** | [log](evidence/phase-01-local-verification/ci-run-bd9fadc/08-test-integration.log) |
| 9 | `npm run build` (production) | 0 | PASS | [log](evidence/phase-01-local-verification/ci-run-bd9fadc/09-build.log) |
| 10 | `npx playwright install chromium` | 0 | PASS | [log](evidence/phase-01-local-verification/ci-run-bd9fadc/10-playwright-install.log) |
| 11 | `npm run test:e2e` (production `next start`) | 0 | **14/14 PASS** (7 desktop Chrome + 7 Pixel 7 mobile) | [log](evidence/phase-01-local-verification/ci-run-bd9fadc/11-test-e2e.log) |
| — | `upload-artifact` on failure | — | N/A (no failure) | — |

## 5. Database verification (isolated container, `bd9fadc`)

| Check | Result | Evidence |
|---|---|---|
| Fresh migration on empty DB | PASS (CI step 7) | [log](evidence/phase-01-local-verification/ci-run-bd9fadc/07-db-migrate.log) |
| Replay `migrate deploy` on migrated DB | PASS — "No pending migrations" | [log](evidence/phase-01-local-verification/database/01-replay.log) |
| `migrate status` | PASS — up to date | [log](evidence/phase-01-local-verification/database/02-status.log) |
| Drift: migrated DB vs `schema.prisma` | PASS — "No difference detected" | [log](evidence/phase-01-local-verification/database/03-drift.log) |
| Second fresh DB: migrate + drift | PASS / PASS | [log](evidence/phase-01-local-verification/database/04-fresh-second-db.log), [log](evidence/phase-01-local-verification/database/05-fresh-drift.log) |
| Schema-only dumps of both DBs | IDENTICAL | [log](evidence/phase-01-local-verification/database/06-schema-compare.log) |
| Constraints / indexes | 4 PKs, 2 unique (User.authSubject, AuditEvent tenant+request+action), 4 FKs all ON DELETE RESTRICT, 3 secondary indexes | [constraints](evidence/phase-01-local-verification/database/11-catalog-constraints.log), [indexes](evidence/phase-01-local-verification/database/10-catalog-indexes-rls.log) |
| RLS | Enabled on User/Organization/Membership/AuditEvent, zero policies (deny-all to non-owner roles); browser-equivalent role reads 0 rows (integration test) | same |
| Backup/restore rehearsal | PASS — synthetic record and RLS restored via pg_dump/pg_restore | [log](evidence/phase-01-local-verification/database/07-restore.log) |
| Hosted dev DB (read-only, Supabase MCP) | Exactly the repo's 2 Prisma migrations applied; RLS on all 4 tables; security advisor: only the known intentional INFO (`_prisma_migrations` RLS with no policy) | §7 |

`prisma migrate diff --from-migrations` requires a shadow-database config that the repository does not define; the equivalent is covered by migrating two fresh databases and diffing both against the schema and each other. No hosted data was migrated, reset or deleted except this session's own temporary fixtures.

## 6. Production-mode verification

Production build of the fixed working tree (source identical to `bd9fadc`) using the real development configuration, served by `next start` locally.

| Suite | Result | Evidence |
|---|---|---|
| Production build | PASS | [log](evidence/phase-01-local-verification/production/01-build.log) |
| Real Supabase Auth + storage + DB (isolated project `sudqhluwsaijvjjcegpv`, restricted `myfarm_runtime` role, 2 disposable users, 3 disposable tenants, 2 private files) | **28/28 PASS** | [log](evidence/phase-01-local-verification/production/02-live-provider.log), [results](evidence/phase-01-local-verification/provider-tests.json), [harness](evidence/phase-01-local-verification/harness/live-provider.mjs.txt) |
| Anonymous production probes (headers, sensitive files, input validation, fail-closed APIs, protected pages, forged cookie, log hygiene) | **33/33 PASS** | [log](evidence/phase-01-local-verification/production/03-anonymous-probe.log), [harness](evidence/phase-01-local-verification/harness/prod-probe.mjs.txt) |

The 28 live checks cover verified TLS to the pooler, real mobile browser sign-in, Secure/HttpOnly/SameSite=Lax auth cookies, session API, guessed cross-tenant scope denial, farmer denied admin route, admin/agent assigned workspaces, administrator has no global tenant bypass, concurrent private-file grants with exactly one audit, audit payload collision 409, cross-tenant grant denial, anonymous and direct cross-tenant storage denial, membership revocation (API and storage), recovery token generation, global sign-out, revoked-JWT denial and revoked browser redirect. Cleanup: 2 users and 2 files deleted by the harness; an independent read-only query afterwards found 0 temporary auth users, 0 temporary organizations, 0 private objects and 0 application users/memberships.

The first probe run reported 3 FAILs ([initial log](evidence/phase-01-local-verification/production/03a-anonymous-probe-initial.log)) because it expected an HTTP 3xx for anonymous `/workspace`, `/admin`, `/agent`. Inspection showed the root `loading.tsx` makes Next.js stream a `200` shell with `Cache-Control: no-store` containing an in-stream `NEXT_REDIRECT …/sign-in;307` and meta refresh; no protected content is rendered or sent (authorization runs first). The probe expectation was corrected to assert no content, redirect target and no-store; recorded as condition C5, not as a pass of the original expectation.

## 7. Security audit

| Area | Verdict | Basis |
|---|---|---|
| Authentication | PASS | Server `getUser()` plus provider session check (`myfarm_session_is_active`); expired/revoked token denied (unit + live); forged cookie → 401 |
| Authorization / tenant isolation / IDOR | PASS | Scope derived from current membership on every request; guessed IDs 403; admin has no automatic cross-tenant access; revocation effective next request (unit, integration, live) |
| Protected routes | PASS | Anonymous APIs 401 + no-store, no stack; pages redirect without content |
| Session and cookies | PASS | HttpOnly, Secure (production), SameSite=Lax, path `/`; global sign-out revokes server session |
| Input validation | PASS | UUID params 400; strict Zod body (unknown field 400); content-type and malformed JSON 400; same-origin required for grants (403 without/with foreign Origin); path traversal rejected |
| Secrets handling | PASS | No secret patterns in any commit; no `.env.local`/admin/runtime credential value in tracked files or committed evidence; 16 client chunks contain no server secret (Supabase is server-only); logs allowlisted |
| Sensitive file access | PASS | `/.env*`, `/.git/config`, prisma, source, `.next/server`, encoded traversal, `.cache` → 404 |
| Headers | PASS | nosniff, X-Frame-Options DENY, CSP frame-ancestors 'none', Referrer-Policy, Permissions-Policy; no X-Powered-By |
| Dependencies | PASS | `npm audit` 0 vulnerabilities (all and `--omit=dev`); 424 registry signatures and 166 attestations verified |
| Rate limiting / audit | PASS | 30 distinct grants/actor/minute with advisory lock; retries idempotent (integration + prior live) |

No critical or high finding remains. Hosted Supabase security advisor: one INFO only (intentional).

## 8. Defect found and fixed

**Double-encoded UTF-8 in user-facing text (medium, user-visible).** The home page (`MYFARM Â· UGANDA`, `â†’`), layout footer and title template (`Â·`), loading status (`Loading MyFarmâ€¦`, announced by screen readers) and sign-in button (`Signing inâ€¦`) rendered mojibake. Root cause: files saved after a Windows-1252 misdecode. The component test asserted the corrupted label, so the suite locked the defect in.

Fix in `bd9fadc`: restored `·`, `→`, `…` in `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/loading.tsx`, `src/components/sign-in-form.tsx`; corrected the test expectation; added `tests/unit/text-encoding.test.ts` (scans `src/` and `tests/`; verified to FAIL on `d9ef30b` naming exactly the 5 affected files, PASS on `bd9fadc`) and an E2E assertion that rendered text/title contain no mojibake. `scripts/rehearse-restore.mjs` gained an optional `MYFARM_TEST_CONTAINER` override (default unchanged). No API, schema or dependency change.

## 9. Not reproduced / deviations

| Item | Status | Reason / impact |
|---|---|---|
| Linux runner (ubuntu-latest) | NOT VERIFIED | Local host is Windows. Mitigation: PostgreSQL runs in the same Linux `postgres:17` image; Node major matches. Case-sensitive path or Linux-only native-module issues would not surface locally |
| `--with-deps` system packages | NOT APPLICABLE | Linux apt packages only |
| `actions/setup-node` npm cache | NOT REPRODUCED | Performance only; `npm ci` ran from lockfile |
| GitHub-hosted execution | NOT VERIFIED | Account billing lock (§2) |
| `migrate diff --from-migrations` | Substituted | Requires shadow DB config; covered by two-fresh-DB diff (§5) |

## 10. Acceptance criteria and exit gate

| Criterion | Evidence | Result |
|---|---|---|
| AC001 validated typed form; UI cannot call persistence | Component tests (invalid input, failure retention, double-submit), E2E invalid sign-in, boundary check | PASS |
| AC002 isolated DB connects; private storage; redacted diagnostics | Integration 11/11, live private storage, logging unit tests, log hygiene probe | PASS |
| AC003 domain tests without browser/DB; no later scope | Unit suite; future-command contracts are interfaces only | PASS |
| AC004 four commands exit 0 with logs; expired session denied; migration rehearsed; **CI run** | Lint/typecheck/test/build logs; expired/revoked session unit + live; fresh/replay/drift/restore; CI requirement met by **approved replacement criterion** D-P01-LOCAL-CI-001 | PASS (with condition C1) |
| L: authenticated app builds/deploys in isolated environment | Production build here; protected Vercel preview with 12/12 hosted checks ([hosted report](phase-01-hosted-verification-2026-10-08.md)) | PASS |
| L: database, migrations, errors, logs, health, baseline security | §5–§7 | PASS |
| L: CI | Local substitution only | PASS WITH CONDITION C1 |

Tasks: T001–T010 previously verified. T011 (R004 service: CI/migration/auth/error integration) and T012 (R004 UI acceptance: session-expired/forbidden/error behaviour) now satisfy their acceptance criteria under the approved replacement criterion; T013 (audit and close) is this report. **13/13 × 100 = 100%.**

## 11. Conditions (nonblocking, owner-tracked)

| ID | Condition | Owner | Deadline |
|---|---|---|---|
| C1 | GitHub-hosted CI unverified; resolve billing lock and obtain a green `Phase 1 quality` run on the branch head | Project owner | Before any production release; recommended before merging Phase 1 to `main` |
| C2 | Provider SQL (`supabase/policies/*.sql`, incl. `myfarm_private.myfarm_session_is_active` required by `sessions.ts`) is applied outside the Prisma migration chain; a new environment built only with `prisma migrate deploy` would fail session checks closed (UNAVAILABLE) | Engineering | Before provisioning any new environment (staging/production) |
| C3 | Phase 2 migration `202610080002_farmer_registry` sorts between Phase 1 migrations `…0001` and `…0101`; out-of-order relative to the hosted dev DB history | Phase 2 engineering | Rename to a timestamp after `202610080101` before Phase 2 merges or deploys |
| C4 | Recovery email delivery, production auth/rate-limit settings and pooler-to-database TLS (pg_stat_ssl false) not verified | Project owner / operations | Before production release |
| C5 | Anonymous protected pages return a streamed `200` with in-stream redirect (no content leak). Non-browser clients see 200 | Engineering | Review in Phase 2 UI work; low severity |

## 12. Phase 2 integration readiness

Phase 2 (`worktree-phase-02`) is 1 commit ahead of merge-base `f159631`; Phase 1 is 6 commits ahead of it (7 including this documentation commit). Phase 2 does not touch the files changed in `bd9fadc`, so the merge is expected to be clean, but it must be rebased/merged onto the closed Phase 1 head, resolve C3, and re-run this local verification (or hosted CI if restored). READY WITH CONDITIONS.

## 13. Cleanup

Temporary Supabase users/files and database fixtures removed (verified). The local container `myfarm-phase01-localci` and scratch clones are disposable and isolated. No push, merge, deploy or production change was made in this session. Docker Desktop was started for this verification; unrelated containers that auto-started with it were not touched.
