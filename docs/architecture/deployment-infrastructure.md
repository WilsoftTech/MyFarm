# Deployment and infrastructure

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase02 closeout; content and status updated from verified evidence; no completion inferred from review alone.
- Implementation status: Phase01 scope COMPLETED — 100% (13/13 verified Phase01 tasks; PASS WITH CONDITIONS — LOCAL VERIFICATION); Phase02 scope COMPLETED — 100% (13/13 verified Phase02 tasks; PASS WITH CONDITIONS — LOCAL VERIFICATION); later-phase scope not counted.
- Last reviewed: 2026-10-09 (Africa/Nairobi), Phase02 implementation and closeout session.
- Related phase/task IDs: Phase01 MYF-P01-T001–T013; Phase02 MYF-P02-T001–T013.
- Verified completed work: Phase01 scope as previously verified; Phase02: farmer registry contracts/policies/migration/API/tests in this document's area verified (see the Phase 2 implementation section).
- Remaining work/blockers: Phase02 conditions P2-C1–P2-C8 where applicable; later-phase scope pending authorization.
- Evidence/report links: [Phase02 closeout](../reports/phase-02-closeout-2026-10-09.md); [Phase02 every-document review](../reports/phase-02-document-review-2026-10-09.md); [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](../reports/phase-01-provider-verification-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Baseline target: Vercel application, Supabase PostgreSQL, suitable private object storage. **Local foundation build/test environment verified; no hosted or external paid service created.** Regions/versions/cost/quotas/auth/media provider unresolved in Q03/Q04/Q34.

Environments: local development with isolated DB; CI test DB; preview app with synthetic data and separate credentials; staging provider sandbox; production only after approved phase gates and deployment authorization. Preview must never default to production connection strings, buckets or payment callbacks.

Pin runtime/ORM versions and test chosen adapter on server hosting runtime. Application DB connections use an appropriate tested pooled configuration; migrations/maintenance use the provider-supported connection path. Pool/session/transaction behavior must be measured, not assumed. Do not log connection strings. Secrets injected via environment management, scoped by environment and rotated.

Private media upload/download grants enforce owner and expiry; retention/orphan cleanup policy and media quotas approved first. Build/deploy CI uses least privilege, verifies quality/migrations and smoke health checks. Database migration is reviewed/rehearsed separately; schema deploy and app rollback compatibility are explicit.

Serverless requests do not guarantee indefinite background tasks. MVP sync is bounded foreground work. Enabled payment/AI/forecast workloads needing durable jobs use persistent outbox/state with safe worker trigger and reconciliation; select extra execution service only when runtime/job evidence requires it.

Backups/restore tests start with persistent sensitive data, not Phase 24 only. Record provider capability, retention, protected backup access, RPO/RTO and drill evidence. Rollback/recovery distinguishes code rollback from restored DB and lost provider-side effects; reconcile receipt/payment histories after restore.

Capacity/cost model proposal: active farmers × records/day and offline backlog burst; storage bytes/media retention; DB query/connection peaks; later AI/audio/image calls and provider fee volume. No fabricated price estimate. Review Uganda latency/region/data obligations and current provider documentation before deployment. [DB](database-architecture.md), [observability](observability.md), [migration policy](../engineering/migration-policy.md) and [decisions](../DECISION-LOG.md) govern operation.


## Phase1 implemented evidence and limits

Local production build/browser server and PostgreSQL17 test container verified. Vercel remains target; hosted preview/CI/provider credentials not present. Supabase PG/Auth selected. No hosted or paid resource provisioned.

[Closeout](../reports/phase-01-closeout-2026-10-08.md); [setup](../engineering/foundation-local-setup.md).

## Current live verification and decision record

Phase 01 BLOCKED — 76.92% (10/13 verified task IDs). Verdict: FAIL. Completed T001–T010. Remaining T011–T013: hosted CI and dependency-gated final closure. Protected preview builds and live authenticated hosted verification succeeds; CI startup failure prevents completion.

**Superseded 2026-10-08 (local verification closeout):** Phase 01 COMPLETED — 100% (13/13). Verdict PASS WITH CONDITIONS — LOCAL VERIFICATION at `bd9fadc`; GitHub-hosted CI blocked by account billing lock and not verified (owner exception D-P01-LOCAL-CI-001, Phase 1 only). [local verification report](../reports/phase-01-local-verification.md).

Live Supabase Auth and private storage:28 checks PASS. Current membership/session revocation, tenant isolation, private downloads, secure cookies, concurrent idempotency and recovery token generation verified. Temporary test users/files/database fixtures removed. Lint/typecheck/build/boundaries PASS0;58 unit/component tests and11 PostgreSQL integration tests PASS. Rate limiter:30 distinct private-file grants/actor/minute, shared transaction advisory lock, identical retries free, database clock window; concurrent boundary and expired-window test PASS. Same-origin authority handling repaired after real browser verification exposed Next.js internal hostname normalization. TLS URL overrides stripped; verified client-to-pooler TLS and Supabase CA. Pooler-to-database pg_stat_ssl reports false; no end-to-end provider-managed transport claim.

Prisma migrations202610080001_foundation and202610080101_private_grant_rate_limit applied in isolated Supabase development project sudqhluwsaijvjjcegpv. Foundation applied via MCP then Prisma history reconciled; additive actor/time index generated by Prisma diff and deployed by Prisma CLI. Provider SQL artifacts in supabase/policies: private-storage, foundation-hardening and runtime-role. Five provider-specific MCP migrations recorded separately. Runtime role has SELECT foundation tables/INSERT audits, no direct auth.sessions read, no update/delete/DDL/bypass-RLS. LOGIN explicitly approved; password kept in ignored local configuration and explicitly approved preview secret. Auth frontend denied application tables; private session boolean restricted to backend role. Security advisors: no WARN/ERROR, only intentional deny-all _prisma_migrations RLS INFO. Performance: newly created tenant/date index unused INFO, no missing FK index. No new application dependencies; existing Supabase versions pinned exactly.

API change: same-origin private-file requests work with actual HTTP authority; excessive distinct grants return429 RATE_LIMITED. Offline sync, financial/stock writes, farmer registry and AI are NOT APPLICABLE to Phase1 and remain unimplemented. Restore/replay evidence from preceding isolated synthetic rehearsal remains applicable. Recovery email delivery and production operational settings are not claimed; production release must verify them. Source research remains absent despite Phase0 owner acceptance.

[Current closeout](../reports/phase-01-closeout-2026-10-08.md).

## Phase 2 implementation (2026-10-09)

Isolated dev project `sudqhluwsaijvjjcegpv`: `prisma migrate deploy` applied `202610090001_farmer_registry`, then `supabase/policies/farmer-registry-runtime.sql` was applied in one transaction ([D-P02-005](../DECISION-LOG.md#d-p02-005--hosted-development-verification-for-phase-2)).

Provisioning order for any new environment:

1. Prisma migrations.
2. `foundation-hardening.sql`, `private-storage.sql`, `runtime-role.sql`.
3. `farmer-registry-runtime.sql`.

No push, preview redeploy or production change was made in Phase 2 ([closeout](../reports/phase-02-closeout-2026-10-09.md)).
