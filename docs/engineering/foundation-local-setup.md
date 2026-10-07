# Foundation local setup and provider verification

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

The Phase1 local verification container is named myfarm-phase01-verification, bound only to 127.0.0.1:55431. .env.test.local and .cache/phase01-db.env contain disposable test credentials and are ignored. Never copy them into hosted settings.

npm run test:e2e starts its own production server on 127.0.0.1:3101. The browser suite uses an intentionally nonfunctional Supabase configuration fixture for public sign-in form validation; it does not represent a live provider. No real user credentials or farm data are required. Provider sign-in/revocation, private bucket access and hosted deployment remain separate checks.

.github/workflows/quality.yml defines PostgreSQL17-backed checks and browser verification on CI. A workflow file alone is not an executed CI run. No Git repository/remote was present, so hosted CI execution is pending.

## Deferred scope

No service worker, offline queue, IndexedDB or synchronization is enabled in Phase1. The manifest/icon are a shell foundation; offline operation is not advertised or tested as complete. Agent/admin pages are permission-guarded scaffolds. Recovery, supported languages/devices, region/budget, hosted deployment and production operations require their documented decisions/evidence.
