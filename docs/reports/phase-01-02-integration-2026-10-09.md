# Phase 1 and Phase 2 integration — 2026-10-09

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — created 2026-10-09 from verified evidence; updated 2026-10-10 with the hosted application (§9).
- Implementation status: REFERENCE ONLY — N/A (integration, provisioning-hardening and verification record).
- Last reviewed: 2026-10-10 (Africa/Nairobi), hosted provisioning application and Phase 2 completion check.
- Related phase/task IDs: Phase01 (MYF-P01-T001–T013); Phase02 (MYF-P02-T001–T013); conditions P2-C1–P2-C8, INT-C1–INT-C7; decisions D-INT-001–D-INT-003, D-P03-001–D-P03-004.
- Verified completed work: main fast-forwarded to d85a773, then to 756f3c4 (Step B); provisioning hardening verified locally (5545257) and applied to hosted dev (9/9 read-only checks); public sign-up disabled; sign-in/sign-out 11/11 after the change; Supabase advisors run.
- Remaining work/blockers: No Phase 2 blocker. Open conditions: P2-C1, P2-C3–P2-C5, P2-C7, INT-C3–INT-C7. GitHub-hosted CI remains NOT VERIFIED. Phase 3 not started.
- Evidence/report links: [Evidence folder](evidence/integration-2026-10-09/); [hosted application](evidence/integration-2026-10-09/hosted-apply/); [Phase02 closeout](phase-02-closeout-2026-10-09.md); [decision log](../DECISION-LOG.md#d-int-001--phase-1-and-phase-2-integration-into-main).
<!-- MYFARM-STATUS-END -->

**Outcome.** Phase 1 and Phase 2 are on `main` at **`d85a773`**, integrated by fast-forward with no deployment triggered. The database provisioning hardening the owner required before Phase 3 is implemented on branch **`phase-02-provisioning-hardening` (`5545257`)** and verified locally: the clean-clone CI reproduction passes 11/11 steps. It is **not pushed, not merged and not applied to any hosted database**. GitHub-hosted CI remains **NOT VERIFIED** (billing lock), under a one-time owner exception for this integration.

**Update 2026-10-10.** Step B is on `main` (`756f3c4`, fast-forward, no deployment) and its provider files are **applied to hosted dev**: read-only verification 9/9 PASS, public sign-up off, sign-in/sign-out 11/11 PASS, Supabase advisors 0 ERROR. P2-C2, P2-C6, P2-C8, INT-C1 and INT-C2 are resolved. See [§9](#9-hosted-application--2026-10-10). The paragraph above is historical.

## 1. Authorizations

| Decision | Scope |
|---|---|
| [D-INT-001](../DECISION-LOG.md#d-int-001--phase-1-and-phase-2-integration-into-main) | Controlled fast-forward integration; one-time local-CI exception; screenshot fixtures accepted |
| [D-INT-002](../DECISION-LOG.md#d-int-002--database-provisioning-hardening-step-b) | Provisioning hardening in an isolated worktree and local test databases only |
| [D-P03-001](../DECISION-LOG.md#d-p03-001--phase-3-authorization-and-sequencing)–[004](../DECISION-LOG.md#d-p03-004--phase-3-local-ci-substitution) | Phase 3 authorized after Step B; Q07 and Q08 rules; local CI extended to Phase 3 |

Not authorized and not done: production deployment, any hosted database change by Claude, editing applied migrations or checksums, force-push or history rewrite, pushing Step B to `main`, and Phase 3 implementation work.

## 2. Pre-integration checks

| Check | Result |
|---|---|
| Reported commits | Phase 1 `e4ea43b`, Phase 2 `d85a773`, `main` `f159631`: all matched, locally and on origin |
| Ancestry | `f159631 → e4ea43b → d85a773` is one linear chain, 12 commits, 0 merge commits; Phase 2 sits exactly on the accepted Phase 1 head |
| Repository | **Public**; `main` has **no branch protection and no rulesets** (so only non-force, fast-forward pushes were used) |
| Deployment configuration | Vercel, Render and CodeRabbit GitHub Apps are installed. The local Vercel CLI token had expired (403), so the owner checked the Vercel and Render dashboards and confirmed no project or service was connected to the repository |
| Screenshots | Only the two Phase 2 screenshots exist, showing synthetic fixtures. Coordinates `-0.790123, 29.926745` resolve (OpenStreetMap) to a public primary road in Rukungiri town; the placeholder phone numbers could not be confirmed unallocated. Owner accepted them as-is (option 1) |
| Secrets | No real environment value in any tracked file or in any branch's history (value-based scan) |

## 3. Step A — integration

1. Pushed `phase-02-farmer-registry` (`d85a773`) to origin.
2. `git push origin e4ea43b:refs/heads/main` → `f159631..e4ea43b` (fast-forward).
3. `git push origin d85a773:refs/heads/main` → `e4ea43b..d85a773` (fast-forward); local `main` synced.

After each push, a ~2-minute watch of the GitHub API showed **no deployments, no commit statuses and no Vercel/Render check runs** (their check suites stayed `queued` with 0 runs). GitHub Actions ran and failed with “The job was not started because your account is locked due to a billing issue”: no step executed, so it says nothing about the code. The stale branch `worktree-phase-02` (`18cc422`, carrying the old `202610080002` migration) was never merged.

Evidence: [refs and settings](evidence/integration-2026-10-09/integration/00-refs-and-settings.log), deploy watches [1](evidence/integration-2026-10-09/integration/01-after-push-phase-02-branch.log), [2](evidence/integration-2026-10-09/integration/02-after-ff-main-to-e4ea43b.log), [3](evidence/integration-2026-10-09/integration/03-after-ff-main-to-d85a773.log).

## 4. Step B — database provisioning hardening

### 4.1 Review of hosted browser-role privileges (read-only, before any change)

| Finding in hosted dev `sudqhluwsaijvjjcegpv` | Disposition |
|---|---|
| All 9 application tables: no `anon`/`authenticated` privilege; RLS on | Kept |
| `_prisma_migrations`: `anon` and `authenticated` hold all table privileges (P2-C8) | Revoked by the new lockdown |
| Default privileges in `public` for `postgres` grant browser roles everything on new tables, sequences and functions | Revoked by the new lockdown (Phase 3 tables would otherwise inherit them) |
| Default privileges in `public` for `supabase_admin` do the same; `postgres` is not a member of `supabase_admin` | Cannot be changed by the project role; reported as a residual (owns nothing in `public` today) |
| Browser roles' `USAGE` on schema `public`; `service_role` privileges; `auth`, `storage`, `graphql`, `realtime` defaults | Kept: intended Supabase API and Auth behavior |

Evidence: [browser-role-grants.log](evidence/integration-2026-10-09/hosted-review/browser-role-grants.log).

### 4.2 Changes (commit `5545257`)

- **One order, one place:** [`supabase/provisioning.json`](../../supabase/provisioning.json): migrations, then `foundation-hardening`, `private-storage`, `runtime-role`, `farmer-registry-runtime`, `browser-role-lockdown`.
- **Transactional and re-runnable:** every provider file is one `BEGIN; … COMMIT;` block. `runtime-role.sql` (5 policies) and `private-storage.sql` (1 policy) now drop each policy before recreating it. End states are unchanged.
- **New [`browser-role-lockdown.sql`](../../supabase/policies/browser-role-lockdown.sql):**
  - For every role that creates objects in `public` and that the executing role may act for, it removes browser-role default privileges on tables, sequences and functions, plus the built-in EXECUTE-to-PUBLIC default for functions.
  - It revokes browser and PUBLIC access to every existing table, sequence and function in `public`, including `_prisma_migrations`.
  - It then checks its own postconditions and aborts the transaction if any browser access in `public` remains.
- **Tests run the real files:** the runtime-role integration suite no longer carries a hand-copied SQL subset. It now applies the actual provider files in the manifest's order on top of a test-only Supabase stand-in (`tests/support/supabase-emulation.sql`, modelled on the hosted catalog review).
- **Docs:** provisioning rules ([deployment](../architecture/deployment-infrastructure.md#provisioning-updated-2026-10-09-provisioning-hardening), [migration policy](../engineering/migration-policy.md#provider-sql-rules-2026-10-09-provisioning-hardening)), and [where tenant isolation is enforced](../architecture/multi-tenancy.md#where-tenant-isolation-is-enforced-2026-10-09). The `farmer-registry-runtime.sql` header no longer claims the policies stop a server writing outside the actor's scope; they check consistency, not caller identity.

No file under `prisma/migrations/` changed; applied migration history and checksums are untouched.

### 4.3 New provisioning suite (`tests/integration/provisioning.test.ts`, 9 tests)

| Test | What it proves |
|---|---|
| Order and transactions | Migrations come first, the lockdown last, and private storage before the runtime role. Every provider file is exactly one `BEGIN; … COMMIT;` |
| Fresh database | The full manifest provisions a new database. For each file, an injected failure just before `COMMIT` leaves the catalog byte-identical (atomic) |
| Browser roles | No `anon`/`authenticated`/PUBLIC privilege on any `public` object, including `_prisma_migrations`; RLS on every application table |
| Default privileges | No creator role's default privileges grant browser roles access; schema `USAGE` and `service_role` defaults are kept |
| Objects created later | Tables, sequences and functions created afterwards by **each** creator role (`postgres`, `supabase_admin`, the migrator) give browser roles nothing |
| Re-run | `migrate deploy` reports no pending migrations, and every file rerun leaves an identical catalog |
| Upgrade | A database provisioned without the lockdown (today's hosted dev state, with P2-C8 reproduced) upgrades to exactly the fresh end state |
| Session function | Only `myfarm_runtime` may call it; active session true, expired or mismatched false |
| Storage function | Active session and active membership of the object's organization only; malformed path, expired session and anon all denied |

**Mutation checks:** removing one `DROP POLICY IF EXISTS`, removing a `BEGIN`, or disabling either lockdown step each makes the suite fail; the unmutated suite passes 9/9 ([mutation-tests.log](evidence/integration-2026-10-09/provisioning/mutation-tests.log)).

**Supplementary run on the official Supabase Postgres image** (`supabase/postgres:17.6.1.166`, throwaway container): **20/20 PASS** ([run.log](evidence/integration-2026-10-09/supabase-image/run.log)). Everything MyFarm runs was executed as `postgres`, which is non-superuser and not a member of `supabase_admin`, as on hosted. The run checked:

- P2-C8 is reproduced before the lockdown and closed after it.
- New tables, sequences and functions created by `postgres` give browser roles nothing, while `service_role` keeps its defaults.
- The `supabase_admin` residual is reported as a WARNING.
- Rerunning everything leaves an identical state.

The image lacks GoTrue/Storage tables, so the stand-in supplied them, with hosted owners and grants. This is supplementary evidence, not proof of hosted behavior.

## 5. Sign-in incident (operational, no code change)

- **Symptom:** the owner could not sign in.
- **Root cause:** hosted dev had **0 Supabase Auth users**. The `MYFARM_TEST_EMAIL` account did not exist, so Supabase returned `400 invalid_credentials` and the app correctly showed its generic failure message. Reproduced in a local production build of `main` and directly against Supabase Auth.
- **Fix:** made by the owner in the dashboard. They created the Auth user, then its `public."User"` row; accounts are owner-provisioned, so without the row sign-in lands on `/forbidden`.
- **Verification:** sign-in and sign-out passed **11/11 checks** on the owner's `localhost:3000` (Phase 1 code) and on `main` (`d85a773`): redirect when anonymous, sign-in to the workspace, HttpOnly/SameSite=Lax cookie, server session active, sign-out to `/sign-in`, cookies cleared, **server sessions revoked**, workspace locked again, wrong password rejected generically, no browser errors.
- **Permission note:** Claude's own attempt to create the account was blocked by the Claude Code permission system, so all hosted changes in this incident were made by the owner.

Evidence: [journey.log](evidence/integration-2026-10-09/sign-in/journey.log).

## 6. Verification on the integrated code (`5545257` = `d85a773` + Step B)

| Gate | Result | Evidence |
|---|---|---|
| Clean-clone reproduction of every `quality.yml` step (fresh `postgres:17`, digest `sha256:67f41722…`, same as Phases 1–2) | **11/11 PASS** | [ci-run-5545257](evidence/integration-2026-10-09/ci-run-5545257/steps.json) |
| Lint | PASS, 0 warnings | [03-lint.log](evidence/integration-2026-10-09/ci-run-5545257/03-lint.log) |
| Typecheck / boundaries | PASS / PASS | [04](evidence/integration-2026-10-09/ci-run-5545257/04-typecheck.log), [05](evidence/integration-2026-10-09/ci-run-5545257/05-boundaries.log) |
| Unit and component | **117/117**, 15 files | [06-test.log](evidence/integration-2026-10-09/ci-run-5545257/06-test.log) |
| Migrations on a fresh database | 3/3 applied | [07-db-migrate.log](evidence/integration-2026-10-09/ci-run-5545257/07-db-migrate.log) |
| Integration (real PostgreSQL 17) | **42/42**, 4 files (33 existing + 9 provisioning) | [08-test-integration.log](evidence/integration-2026-10-09/ci-run-5545257/08-test-integration.log) |
| Production build | PASS | [09-build.log](evidence/integration-2026-10-09/ci-run-5545257/09-build.log) |
| Browser E2E (desktop Chrome + Pixel 7) | **24/24** | [11-test-e2e.log](evidence/integration-2026-10-09/ci-run-5545257/11-test-e2e.log) |
| Authentication and tenant isolation | Covered by the unchanged unit, integration (IDOR, revocation, administrator denial, runtime role) and E2E suites above, plus the live sign-in/sign-out journey (§5) | — |
| Dependency audit | 0 vulnerabilities (all and `--omit=dev`) | [npm-audit.log](evidence/integration-2026-10-09/security/npm-audit.log) |
| Secret scan | No real environment value in tracked files or any local branch's history | [secret-scan.log](evidence/integration-2026-10-09/security/secret-scan.log) |
| GitHub-hosted CI | **NOT VERIFIED** (billing lock; one-time exception D-INT-001) | [00-refs-and-settings.log](evidence/integration-2026-10-09/integration/00-refs-and-settings.log) |

Environment: Windows 11, Node 24.13.0, Docker 28.4.0. Harness copies are in [harness/](evidence/integration-2026-10-09/harness/); the CI harness is the Phase 2 [local-ci.mjs](evidence/phase-02-2026-10-09/harness/local-ci.mjs.txt).

## 7. Conditions

Status as of 2026-10-10 (§9); the 2026-10-09 wording is kept where nothing changed.

| ID | Status |
|---|---|
| P2-C1 Hosted CI | **Open.** Still billing-locked; NOT VERIFIED |
| P2-C2 Provider SQL outside the Prisma chain | **Resolved 2026-10-10.** Provisioning order recorded once, files transactional and re-runnable, tested as written on fresh, rerun and upgraded databases, and the updated files are applied to hosted dev (§9) |
| P2-C3 Mixed CRLF/LF checksums in hosted dev | Open, unchanged (checksums deliberately untouched); provider SQL now also pinned to LF |
| P2-C4 Proposed engineering defaults | Open, unchanged |
| P2-C5 Retention policy | Open, unchanged |
| P2-C6 Supabase advisors | **Resolved 2026-10-10.** Security and performance advisors run: 0 ERROR, 1 WARN (INT-C6), 4 INFO (one is INT-C7) |
| P2-C7 Revoked-but-unexpired JWT redirect | Open, unchanged |
| P2-C8 Browser roles on `_prisma_migrations` | **Resolved 2026-10-10.** `anon` and `authenticated` hold no privilege on it in hosted dev (§9) |

New conditions:

| ID | Condition | Owner | Deadline |
|---|---|---|---|
| INT-C1 | Apply the updated provider files (or at least `browser-role-lockdown.sql`) to hosted dev, as `postgres`, after the branch is approved | Project owner (authorization) / engineering | **Resolved 2026-10-10** (§9) |
| INT-C2 | Supabase Auth allows public sign-up (`disable_signup: false`) although MyFarm accounts are owner-provisioned; strangers can create Auth users (they reach `/forbidden`) | Project owner | **Resolved 2026-10-10:** the owner disabled sign-up; `disable_signup: true` confirmed |
| INT-C3 | `supabase_admin` default privileges in `public` still grant browser roles; not changeable by `postgres` | Engineering | Monitored by the lockdown on every run; raise with Supabase if `supabase_admin` ever creates objects in `public` |
| INT-C4 | Public repository with an unprotected `main` | Project owner | Before collaborators or production releases |
| INT-C5 | The owner's working tree `D:/Myfarm` is still on `codex/phase-01-closeout` (Phase 1 code) and holds an uncommitted one-line edit to `docs/reports/phase-01-local-verification.md` not made in this session | Project owner | Before using Phase 2 features locally |
| INT-C6 | Supabase advisor WARN: leaked-password protection (HaveIBeenPwned check) is disabled in Supabase Auth. It may depend on the Supabase plan | Project owner | Before any real user accounts |
| INT-C7 | Advisor INFO: the composite foreign keys `Farm(ownerFarmerId, tenantId)`, `FarmMember(farmId, tenantId)` and `Plot(farmId, tenantId)` have no index in key-column order | Engineering | Review in a future additive migration, before production; no applied migration is edited |

## 8. Phase 3 readiness

Phase 3 is **authorized** ([D-P03-001](../DECISION-LOG.md#d-p03-001--phase-3-authorization-and-sequencing)), and its blocking questions Q07 and Q08 are resolved by owner decision. Local CI is extended to Phase 3. Phase 3 is **NOT STARTED — 0%**: it begins from `phase-02-provisioning-hardening`. New Phase 3 tables are covered by the lockdown when the provisioning list is rerun after its migration.

**Next actions needing the owner:** approve pushing `phase-02-provisioning-hardening` and fast-forwarding `main` to it; authorize applying the updated provider files to hosted dev (INT-C1); disable public sign-up (INT-C2); restore GitHub Actions billing (P2-C1).

**Update 2026-10-10:** the first three are done (§9). Phase 3 remains **NOT STARTED — 0%**; per the owner's instruction of 2026-10-10 it was not started in this session. It now starts from `main` (`756f3c4` or later), with task MYF-P03-T001, when the owner says so.

## 9. Hosted application — 2026-10-10

**Push (2026-10-09).** `phase-02-provisioning-hardening` pushed and `main` fast-forwarded `d85a773 → 756f3c4` (no force). The ~2-minute GitHub watches show no deployments or commit statuses; Vercel/Render suites stayed `queued` with 0 runs, and Actions failed on the billing lock ([04](evidence/integration-2026-10-09/integration/04-after-push-provisioning-branch.log), [05](evidence/integration-2026-10-09/integration/05-after-ff-main-to-756f3c4.log)).

**Application (INT-C1, [D-INT-003](../DECISION-LOG.md#d-int-003--hosted-application-of-the-provisioning-files)).** The five provider files were run verbatim, in manifest order, against hosted dev `sudqhluwsaijvjjcegpv` as `postgres`. They were sent through the Supabase MCP server, whose OAuth grant is scoped to that project. The preflight confirmed the project, the role and 3/3 applied migrations, and no migration was touched. Every file returned success. The first `runtime-role.sql` call timed out without a response, so it was rerun (the file is re-runnable) and then succeeded ([apply.log](evidence/integration-2026-10-09/hosted-apply/apply.log)).

**Sign-up (INT-C2).** The owner turned off “Allow new users to sign up”; the public Auth settings now report `disable_signup: true`.

**Read-only verification** (`hosted-verify.mjs`, `BEGIN READ ONLY … ROLLBACK`; [harness](evidence/integration-2026-10-09/harness/hosted-verify.mjs.txt)): **9/9 PASS**, against 4/9 before.

| Check | Before | After |
|---|---|---|
| Connected as `postgres`, not superuser | PASS | PASS |
| No `anon`/`authenticated`/PUBLIC privilege on any `public` relation | FAIL (`_prisma_migrations`) | PASS |
| `anon` / `authenticated` cannot touch `_prisma_migrations` | FAIL / FAIL | PASS / PASS |
| `postgres` default privileges grant browser roles nothing | FAIL (tables, sequences, functions) | PASS |
| Only residual default-privilege grantor is `supabase_admin` (INT-C3) | FAIL (`postgres`, `supabase_admin`) | PASS |
| No browser EXECUTE on `public` functions | PASS | PASS |
| 18 runtime policies + 1 storage policy | PASS | PASS |
| `myfarm-private` bucket private | PASS | PASS |

Evidence: [verify-before](evidence/integration-2026-10-09/hosted-apply/verify-before.json), [verify-after](evidence/integration-2026-10-09/hosted-apply/verify-after.json).

**Nothing else changed** ([catalog-diff.log](evidence/integration-2026-10-09/hosted-apply/catalog-diff.log)):
- **Expected removals:** 16 `_prisma_migrations` grants to `anon`/`authenticated` were removed, and `postgres` default privileges in `public` now list only `postgres` and `service_role`.
- **Unchanged:** policies, column grants, bucket and application row counts.
- **Runtime role:** every `myfarm_runtime` grant, policy and function privilege is identical.
- **One checksum change:** the `myfarm_can_read_storage` body checksum changed only because hosted dev previously held a CRLF copy of the same text. It now holds the repository's LF copy; the logic is identical.

**Sign-in/sign-out after the change:** **11/11 PASS** against a local production build of `main`'s application code. `d85a773` and `756f3c4` differ only in SQL, tests and docs. Signing out revoked the test account's sessions, and 0 were left ([journey-after-apply.log](evidence/integration-2026-10-09/sign-in/journey-after-apply.log)).

**Supabase advisors (P2-C6):**
- **Security:** 1 WARN, leaked-password protection disabled (INT-C6), and 1 INFO, the intentional deny-all RLS on `_prisma_migrations`.
- **Performance:** 3 INFO for unindexed composite foreign keys (INT-C7) and 1 INFO for an unused index on a near-empty database.
- **Errors:** none ([advisors](evidence/integration-2026-10-09/hosted-apply/advisors-2026-10-10.json)).

**Permission note:** the auto-mode classifier blocked the first two write attempts; the files then ran under per-call owner approval.

**Phase 2 completion confirmed.** Phase 2 stays **COMPLETED — 100% (13/13)**, verdict **PASS WITH CONDITIONS — LOCAL VERIFICATION**. Its hosted provisioning conditions are now closed in hosted dev. The remaining conditions are nonblocking and owner-tracked: P2-C1, P2-C3, P2-C4, P2-C5, P2-C7 and INT-C3–INT-C7. GitHub-hosted CI is still **NOT VERIFIED**.
