# Foundation local setup and provider verification

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase02 closeout; content and status updated from verified evidence; no completion inferred from review alone.
- Implementation status: REFERENCE ONLY — N/A (navigation/protocol/template/decision/evidence record; no directly implementable scope).
- Last reviewed: 2026-10-09 (Africa/Nairobi), Phase1+2 integration and provisioning-hardening session.
- Related phase/task IDs: Phase01 review session; MYF-P01-T001 through MYF-P01-T013; Phase00 owner acceptance where referenced; Phase02 review session (MYF-P02-T001–T013).
- Verified completed work: Reference content/status/evidence links reviewed; document existence or review does not complete implementation tasks.
- Remaining work/blockers: Maintain alignment with the Phase02 closeout; historical sections stay historical; Phase3 not authorized.
- Evidence/report links: [Phase02 closeout](../reports/phase-02-closeout-2026-10-09.md); [Phase02 every-document review](../reports/phase-02-document-review-2026-10-09.md); [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](../reports/phase-01-provider-verification-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Phase 01, 2026-10-08. The user selected Supabase PostgreSQL + Supabase Auth and will configure .env.local. No hosted resources have been created or modified.

## Application

Node 24 is the verified local runtime. Install the lockfile with npm ci. Copy .env.example to .env.local only if no file already exists. Configure the isolated Supabase project URL and publishable key; DATABASE_URL uses a Supabase session pooler, DIRECT_URL uses direct/session pooling for migrations. Hosted connection URLs require SSL. Never use transaction pooling for migration DDL or silently disable certificate verification.

Run npm run dev. The public shell is at http://localhost:3000. /workspace, /agent and /admin are protected. Server actions validate credentials with Zod and Supabase handles passwords; the application never stores them. Self-registration/farm onboarding belongs to Phase 2.

Supabase identities are not automatically assigned access: the approved User.authSubject must match a provider user UUID, and an ACTIVE Membership must link that account to an explicit Organization. Creating provider test identities or memberships is an operator action in an isolated project, not a public onboarding endpoint. ADMIN has no automatic access to other tenants.

## Reviewed migration

Review prisma/migrations/202610080001_foundation/migration.sql. It creates only User, Organization, Membership, AuditEvent and their enums/constraints/indexes; RLS denies direct browser access. There are no financial, stock or farmer registry tables.

Confirm target database/project before npm run db:migrate. Do not apply this command to a shared/production DB without its authorized migration workflow. There is no previous app migration to upgrade; the local rehearsal starts from an empty disposable PostgreSQL17 database. A repeated deploy verifies no pending migrations. Rollback for this empty test environment is disposal/recreation; persistent/shared environments require backup and restore rather than table drops.

The Prisma runtime must use a server-only DB role with suitable privileges; provider role/SSL/pool compatibility requires live verification. Do not grant authenticated/anon direct access to application tables. No database URL or service-role key is exposed to clients.

## Private storage

Review supabase/policies/private-storage.sql before applying it to the intended isolated Supabase project. It creates a private myfarm-private bucket only if absent, rejects an existing public bucket and uses a locked-search-path SECURITY DEFINER membership check. Objects use organizationUUID/objectUUID paths. No browser upload/update/delete grant is introduced.

This script is separate from the portable PostgreSQL migration. Existing storage policies must be audited for broader grants before live verification. It is not a claim that a policy has been applied or a file uploaded.

POST /api/v1/scopes/{scopeId}/files/{objectId} requires same-origin JSON {requestId: UUID}, current membership and provider storage policy. It appends one audit per scoped request/action, rejects payload changes on retry, then issues a 60-second read URL. URLs may remain usable until expiry after revocation; new requests recheck current membership. No signed URL or credential is logged.

## Quality checks

Run npm run lint, npm run typecheck, npm test, npm run build and npm run check:boundaries. npm run test:integration requires TEST_DATABASE_URL pointing to localhost database named myfarm_phase01_test, with the migration already applied; the suite rejects other targets.

The Phase1 local verification container is named myfarm-phase01-verification, bound only to 127.0.0.1:55431. It was stopped after evidence collection; restart it with docker start myfarm-phase01-verification before rerunning integration checks. The restore script requires a fresh restore database and intentionally does not overwrite an existing one. .env.test.local and .cache/phase01-db.env contain disposable test credentials and are ignored. Never copy them into hosted settings.

npm run test:e2e starts its own production server on 127.0.0.1:3101. The browser suite uses an intentionally nonfunctional Supabase configuration fixture for public sign-in form validation; it does not represent a live provider. No real user credentials or farm data are required. Provider sign-in/revocation, private bucket access and hosted deployment remain separate checks.

.github/workflows/quality.yml defines PostgreSQL17-backed checks and browser verification on CI. A workflow file alone is not an executed CI run. Git main/remote now exist, but no verified hosted CI run is recorded.

## Deferred scope

No service worker, offline queue, IndexedDB or synchronization is enabled in Phase1. The manifest/icon are a shell foundation; offline operation is not advertised or tested as complete. Agent/admin pages are permission-guarded scaffolds. Recovery, supported languages/devices, region/budget, hosted deployment and production operations require their documented decisions/evidence.

## Provider session and trusted TLS

Protected requests validate getUser, verified JWT session_id/subject and auth.sessions existence/not_after on every request. Grant the server runtime role only the necessary session-column SELECT permissions; verify those in the isolated project. Browser roles receive no auth.sessions SELECT grant. The private storage helper lives in myfarm_private, which must not be exposed through Data API schemas.

Hosted connections always verify TLS certificates. Download the project CA from Supabase dashboard Database Settings and configure DATABASE_CA_CERT_PATH with its local PEM path when required. Never disable certificate verification. The direct endpoint currently fails local DNS; session pooler connectivity needs trusted CA verification before adoption. [Latest provider evidence](../reports/phase-01-provider-verification-2026-10-08.md).

Hosted configuration strips the pg ssl and uselibpqcompat URL options so the driver cannot replace explicit TLS verification or the trusted CA. A driver-level regression covers this override. If MCP registration is enabled but no tools appear, fully quit/reopen Codex before resuming the chat. [Resumed evidence](../reports/phase-01-provider-verification-2026-10-08.md).

## Current live verification and decision record

Phase 01 BLOCKED — 76.92% (10/13 verified task IDs). Verdict: FAIL. Completed T001–T010. Remaining T011–T013: hosted CI and dependency-gated final closure. Protected preview builds and live authenticated hosted verification succeeds; CI startup failure prevents completion.

**Superseded 2026-10-08 (local verification closeout):** Phase 01 COMPLETED — 100% (13/13). Verdict PASS WITH CONDITIONS — LOCAL VERIFICATION at `bd9fadc`; GitHub-hosted CI blocked by account billing lock and not verified (owner exception D-P01-LOCAL-CI-001, Phase 1 only). [local verification report](../reports/phase-01-local-verification.md).

Live Supabase Auth and private storage:28 checks PASS. Current membership/session revocation, tenant isolation, private downloads, secure cookies, concurrent idempotency and recovery token generation verified. Temporary test users/files/database fixtures removed. Lint/typecheck/build/boundaries PASS0;58 unit/component tests and11 PostgreSQL integration tests PASS. Rate limiter:30 distinct private-file grants/actor/minute, shared transaction advisory lock, identical retries free, database clock window; concurrent boundary and expired-window test PASS. Same-origin authority handling repaired after real browser verification exposed Next.js internal hostname normalization. TLS URL overrides stripped; verified client-to-pooler TLS and Supabase CA. Pooler-to-database pg_stat_ssl reports false; no end-to-end provider-managed transport claim.

Prisma migrations202610080001_foundation and202610080101_private_grant_rate_limit applied in isolated Supabase development project sudqhluwsaijvjjcegpv. Foundation applied via MCP then Prisma history reconciled; additive actor/time index generated by Prisma diff and deployed by Prisma CLI. Provider SQL artifacts in supabase/policies: private-storage, foundation-hardening and runtime-role. Five provider-specific MCP migrations recorded separately. Runtime role has SELECT foundation tables/INSERT audits, no direct auth.sessions read, no update/delete/DDL/bypass-RLS. LOGIN explicitly approved; password kept in ignored local configuration and explicitly approved preview secret. Auth frontend denied application tables; private session boolean restricted to backend role. Security advisors: no WARN/ERROR, only intentional deny-all _prisma_migrations RLS INFO. Performance: newly created tenant/date index unused INFO, no missing FK index. No new application dependencies; existing Supabase versions pinned exactly.

API change: same-origin private-file requests work with actual HTTP authority; excessive distinct grants return429 RATE_LIMITED. Offline sync, financial/stock writes, farmer registry and AI are NOT APPLICABLE to Phase1 and remain unimplemented. Restore/replay evidence from preceding isolated synthetic rehearsal remains applicable. Recovery email delivery and production operational settings are not claimed; production release must verify them. Source research remains absent despite Phase0 owner acceptance.

[Current closeout](../reports/phase-01-closeout-2026-10-08.md).

## Phase 2 implementation (2026-10-09)

Provision an isolated project in the order of [`supabase/provisioning.json`](../../supabase/provisioning.json) (updated 2026-10-09; [how to run it](../architecture/deployment-infrastructure.md#provisioning-updated-2026-10-09-provisioning-hardening)). Historically: after the Phase 1 provider SQL, apply `supabase/policies/farmer-registry-runtime.sql` (re-runnable) to the isolated project. Without it, the restricted runtime role cannot register farmers. Local integration tests apply it automatically to the local test DB. Migration SQL is checked out with LF endings on every OS (`.gitattributes`) ([closeout](../reports/phase-02-closeout-2026-10-09.md)).
