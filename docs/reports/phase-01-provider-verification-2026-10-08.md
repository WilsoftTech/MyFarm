# Phase 01 provider verification follow-up - 2026-10-08

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — current Phase01 implementation/evidence/status review; no completion inferred from review.
- Implementation status: REFERENCE ONLY - N/A (evidence report).
- Last reviewed: 2026-10-08 (Africa/Nairobi), live provider and hosted closeout session.
- Related phase/task IDs: Phase01; MYF-P01-T001 through MYF-P01-T013.
- Verified completed work: Local security fixes and exact executed check results recorded below; no hosted completion claimed.
- Remaining work/blockers: Reload authenticated MCP; complete live provider and hosted CI/deployment gates.
- Evidence/report links: [Phase01 closeout](phase-01-closeout-2026-10-08.md); [latest provider/security report](phase-01-provider-verification-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Phase verdict **FAIL: exit gate remains incomplete**. Verified completion **30.77% (4/13)**, T001-T004 complete; T005-T013 partial/unverified. This report supplements the [closeout](phase-01-closeout-2026-10-08.md). No Phase 2 work was performed by this session.

## Implemented and audited

- Protected requests now verify the JWT session ID and subject against auth.sessions, including not_after expiry, after Supabase getUser validation. Missing/revoked/mismatched sessions deny access; unavailable verification fails closed. A server database role needs SELECT on auth.sessions(id,user_id,not_after); privileges must be verified before live acceptance.
- Private-storage setup now places its locked-search-path SECURITY DEFINER helper in myfarm_private, outside the exposed public schema. Authenticated execution is explicitly granted; public/anon execution is revoked. Reads require a current provider session and active account/membership. The script remains unapplied; existing hosted policies and exposed schemas must be inspected first.
- Hosted PostgreSQL connections enforce certificate verification. DATABASE_CA_CERT_PATH optionally supplies the provider's trusted CA from the dashboard. URL TLS flags cannot override verification. Loopback test databases remain supported. No TLS bypass was introduced.
- Supabase dependency versions are exactly pinned in package and lockfile. Root lint ignores separate managed worktrees; their implementation was not changed.

Changed code: sessions.ts, database.ts, postgres-connection.ts, private-storage.sql, sessions.test.ts, postgres-connection.test.ts, eslint.config.mjs, package.json/package-lock.json and .env.example. No schema migration was added or applied to Supabase. No API shape changed. No production settings, hosted application, Git commit or push was created by this session.

## Verification results

| Command | Final result | Evidence |
|---|---|---|
| npm run lint | PASS, exit 0 | [log](evidence/phase-01-2026-10-08-followup/lint.log) |
| npm run typecheck | PASS, exit 0 | [log](evidence/phase-01-2026-10-08-followup/typecheck.log) |
| npm test | PASS, exit 0, 48 tests / 9 files | [log](evidence/phase-01-2026-10-08-followup/tests.log) |
| npm run build | PASS, exit 0, sequential rerun | [log](evidence/phase-01-2026-10-08-followup/build.log) |
| npm run check:boundaries | PASS, exit 0 | [log](evidence/phase-01-2026-10-08-followup/boundaries.log) |
| npm run test:integration | PASS, exit 0, 10 tests | [log](evidence/phase-01-2026-10-08-followup/integration.log) |
| npm run test:e2e | PASS, exit 0, 14 desktop/mobile tests | [log](evidence/phase-01-2026-10-08-followup/e2e.log) |

[Command records](evidence/phase-01-2026-10-08-followup/checks.json). Initial lint scanned a separate nested worktree and failed; scope exclusions fixed it. One overlapping build refused to run; the sequential rerun passed. Initial integration invocation had no TEST_DATABASE_URL and refused to run before tests; rerun used the existing verified loopback container and passed. No hosted credentials were substituted into integration tests. Earlier migration/replay/restore and dependency-audit results remain historical in the closeout; those checks were not rerun because no database schema or installed dependency versions changed.

The eight added tests verify revoked/missing/mismatched session handling, verification outage, required hosted TLS and safe failure on unreadable CA. Provider behavior itself is still NOT VERIFIED. Browser checks cover anonymous/public flows, not a successful live sign-in.

## Actual provider evidence and blockers

The configured project reference is sudqhluwsaijvjjcegpv. URL and publishable key matched during the safe configuration check. Auth settings responded HTTP 200: email auth enabled, signup enabled, email auto-confirm disabled. These settings do not prove successful sign-in or recovery.

Direct PostgreSQL connectivity failed with ENOTFOUND. The session-pooler probe reached TLS but failed SELF_SIGNED_CERT_IN_CHAIN with strict certificate verification. No hosted SQL statement succeeded. Download the trusted CA from the project dashboard for application connectivity; direct/session migration connectivity and a least-privilege runtime role still need verification. Existing configured runtime URL uses transaction port 6543; compatibility/pooling choices remain unverified.

Codex registered the project-scoped Supabase MCP and OAuth completed successfully. A fresh app-server catalogue reported authStatus oAuth and tools including list_tables, execute_sql, apply_migration, get_advisors and search_docs. The active chat has no Supabase tool namespace. Calling through a separate app-server could not reuse this task: resume refused because the task already has an active writer, and direct tool call reported thread not found. No task was created, no writer interrupted and no OAuth token read or printed. **Reload Codex and resume this chat to load the authenticated connection.** Authentication does not need to be repeated unless the provider requests it.

Live migration, schema/RLS/advisor audit, test identities/sign-in/revocation, private-storage isolation, role/SSL/pool verification and recovery/rate-limit checks remain NOT RUN/UNVERIFIED. The MCP catalogue exposes publishable keys, not an Auth Admin key or user-creation tool; it cannot be assumed to replace a test account or admin authorization. Inspect actual capabilities after reload before deciding how to obtain synthetic authenticated test evidence.

A Git repository now exists: branch main, remote WilsoftTech/MyFarm, inspected HEAD f159631977b5670dcdf230396b1371e1d6c4e587. GitHub CLI is not authenticated; the available connector returned 404 for this repository, which does not establish whether it exists or is private. Hosted CI and Vercel preview have no verified run/deployment evidence. Do not equate workflow files or a local production build with those exit gates.

## Next action

Reload Codex and resume Phase 1 in this same chat. Inspect the isolated project's schema and policies via Supabase MCP, resolve trusted-CA/runtime-role connectivity, run real auth/storage journeys, then establish CI and isolated deployment evidence. Count subsequent tasks only when their prerequisite acceptance and tests are verified. Phase 2 remains outside this session's scope.

## Resumed session - 2026-10-08

The user requested Resume Phase 1. The active tool catalogue still contains zero Supabase tools. Codex CLI confirms the project-scoped MCP is enabled; registration is not a successful live database call. No auth token was read or printed. A full Codex quit/reopen and project database CA download to .cache/supabase-ca.crt were requested; neither tool availability nor the CA file was present at verification time.

A new read-only probe with Node --use-system-ca preserved strict TLS verification. Auth settings again returned 200. Direct DB still failed ENOTFOUND and session pooler still failed SELF_SIGNED_CERT_IN_CHAIN. [Exact observations](evidence/phase-01-2026-10-08-resume/provider-probe.json). No hosted migration, SQL query, storage change, identity creation, push or deployment occurred.

Security audit reproduced a URL-parser flaw with the installed pg driver: ssl=0 disabled TLS, and ssl=true replaced the explicit verification/CA configuration. The fix removes ssl and uselibpqcompat alongside the existing URL TLS options before creating the hosted client. Parameterized driver tests reproduced two failures before the fix; all six TLS tests passed after it, including libpq compatibility flags. This strengthens the prior fix without changing the API or schema.

Current mandatory checks: npm run lint PASS0; npm run typecheck PASS0; npm test PASS0 (51 tests/9 files); npm run build PASS0; npm run check:boundaries PASS0. [Command records](evidence/phase-01-2026-10-08-resume/checks.json), [lint](evidence/phase-01-2026-10-08-resume/lint.log), [typecheck](evidence/phase-01-2026-10-08-resume/typecheck.log), [tests](evidence/phase-01-2026-10-08-resume/tests.log), [build](evidence/phase-01-2026-10-08-resume/build.log), [boundaries](evidence/phase-01-2026-10-08-resume/boundaries.log). The preceding 10 PostgreSQL integration and14 browser tests remain the latest results for those suites; not rerun for this URL-only configuration change. Migrations/restore were not rerun: no schema change. Live provider, CI and deployment checks remain NOT RUN/UNVERIFIED.

Verdict **FAIL**, phase **BLOCKED30.77% (4/13)**. T001-T004 remain verified complete; T005-T013 still await dependency and exit-gate evidence. Phase2 was not started. Next required actions: fully quit/reopen Codex and resume this same chat with MCP tools loaded; supply the trusted project CA locally. Successful live authentication/storage and hosted CI/deployment evidence are still required before closure.

## Current live verification and decision record

Phase 01 BLOCKED — 76.92% (10/13 verified task IDs). Verdict: FAIL. Completed T001–T010. Remaining T011–T013: hosted CI and dependency-gated final closure. Protected preview builds and live authenticated hosted verification succeeds; CI startup failure prevents completion.

Live Supabase Auth and private storage:28 checks PASS. Current membership/session revocation, tenant isolation, private downloads, secure cookies, concurrent idempotency and recovery token generation verified. Temporary test users/files/database fixtures removed. Lint/typecheck/build/boundaries PASS0;58 unit/component tests and11 PostgreSQL integration tests PASS. Rate limiter:30 distinct private-file grants/actor/minute, shared transaction advisory lock, identical retries free, database clock window; concurrent boundary and expired-window test PASS. Same-origin authority handling repaired after real browser verification exposed Next.js internal hostname normalization. TLS URL overrides stripped; verified client-to-pooler TLS and Supabase CA. Pooler-to-database pg_stat_ssl reports false; no end-to-end provider-managed transport claim.

Prisma migrations202610080001_foundation and202610080101_private_grant_rate_limit applied in isolated Supabase development project sudqhluwsaijvjjcegpv. Foundation applied via MCP then Prisma history reconciled; additive actor/time index generated by Prisma diff and deployed by Prisma CLI. Provider SQL artifacts in supabase/policies: private-storage, foundation-hardening and runtime-role. Five provider-specific MCP migrations recorded separately. Runtime role has SELECT foundation tables/INSERT audits, no direct auth.sessions read, no update/delete/DDL/bypass-RLS. LOGIN explicitly approved; password kept in ignored local configuration and explicitly approved preview secret. Auth frontend denied application tables; private session boolean restricted to backend role. Security advisors: no WARN/ERROR, only intentional deny-all _prisma_migrations RLS INFO. Performance: newly created tenant/date index unused INFO, no missing FK index. No new application dependencies; existing Supabase versions pinned exactly.

API change: same-origin private-file requests work with actual HTTP authority; excessive distinct grants return429 RATE_LIMITED. Offline sync, financial/stock writes, farmer registry and AI are NOT APPLICABLE to Phase1 and remain unimplemented. Restore/replay evidence from preceding isolated synthetic rehearsal remains applicable. Recovery email delivery and production operational settings are not claimed; production release must verify them. Source research remains absent despite Phase0 owner acceptance.

[Current closeout](phase-01-closeout-2026-10-08.md).
