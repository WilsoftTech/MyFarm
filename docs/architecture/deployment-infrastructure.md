# Deployment and infrastructure

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — current Phase01 implementation/evidence/status review; no completion inferred from review.
- Implementation status: PARTIALLY COMPLETE — 76.92% (10/13 verified Phase01 tasks; later scope not counted).
- Last reviewed: 2026-10-08 (Africa/Nairobi), live provider and hosted closeout session.
- Related phase/task IDs: Phase01 foundation T001–T013 (10 verified); cross-phase requirements remain pending; Phase01 review session.
- Verified completed work: T001–T010; live Supabase verification and local quality/security gates PASS; see current closeout.
- Remaining work/blockers: T011–T013 hosted CI/preview/final review pending.
- Evidence/report links: [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](../reports/phase-01-provider-verification-2026-10-08.md).
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

Phase 01 PARTIALLY COMPLETE — 76.92% (10/13 verified task IDs). Verdict: FAIL. Completed T001–T010. Remaining T011–T013: hosted CI, preview and final audit evidence pending.

Live Supabase Auth and private storage:28 checks PASS. Current membership/session revocation, tenant isolation, private downloads, secure cookies, concurrent idempotency and recovery token generation verified. Temporary test users/files/database fixtures removed. Lint/typecheck/build/boundaries PASS0;58 unit/component tests and11 PostgreSQL integration tests PASS. Rate limiter:30 distinct private-file grants/actor/minute, shared transaction advisory lock, identical retries free, database clock window; concurrent boundary and expired-window test PASS. Same-origin authority handling repaired after real browser verification exposed Next.js internal hostname normalization. TLS URL overrides stripped; verified client-to-pooler TLS and Supabase CA. Pooler-to-database pg_stat_ssl reports false; no end-to-end provider-managed transport claim.

Prisma migrations202610080001_foundation and202610080101_private_grant_rate_limit applied in isolated Supabase development project sudqhluwsaijvjjcegpv. Foundation applied via MCP then Prisma history reconciled; additive actor/time index generated by Prisma diff and deployed by Prisma CLI. Provider SQL artifacts in supabase/policies: private-storage, foundation-hardening and runtime-role. Five provider-specific MCP migrations recorded separately. Runtime role has SELECT foundation tables/INSERT audits, no direct auth.sessions read, no update/delete/DDL/bypass-RLS. LOGIN explicitly approved; password kept in ignored local configuration and explicitly approved preview secret. Auth frontend denied application tables; private session boolean restricted to backend role. Security advisors: no WARN/ERROR, only intentional deny-all _prisma_migrations RLS INFO. Performance: newly created tenant/date index unused INFO, no missing FK index. No new application dependencies; existing Supabase versions pinned exactly.

API change: same-origin private-file requests work with actual HTTP authority; excessive distinct grants return429 RATE_LIMITED. Offline sync, financial/stock writes, farmer registry and AI are NOT APPLICABLE to Phase1 and remain unimplemented. Restore/replay evidence from preceding isolated synthetic rehearsal remains applicable. Recovery email delivery and production operational settings are not claimed; production release must verify them. Source research remains absent despite Phase0 owner acceptance.

[Current closeout](../reports/phase-01-closeout-2026-10-08.md).

## Current live verification and decision record

Phase 01 PARTIALLY COMPLETE — 76.92% (10/13 verified task IDs). Verdict: FAIL. Completed T001–T010. Remaining T011–T013: hosted CI, preview and final audit evidence pending.

Live Supabase Auth and private storage:28 checks PASS. Current membership/session revocation, tenant isolation, private downloads, secure cookies, concurrent idempotency and recovery token generation verified. Temporary test users/files/database fixtures removed. Lint/typecheck/build/boundaries PASS0;58 unit/component tests and11 PostgreSQL integration tests PASS. Rate limiter:30 distinct private-file grants/actor/minute, shared transaction advisory lock, identical retries free, database clock window; concurrent boundary and expired-window test PASS. Same-origin authority handling repaired after real browser verification exposed Next.js internal hostname normalization. TLS URL overrides stripped; verified client-to-pooler TLS and Supabase CA. Pooler-to-database pg_stat_ssl reports false; no end-to-end provider-managed transport claim.

Prisma migrations202610080001_foundation and202610080101_private_grant_rate_limit applied in isolated Supabase development project sudqhluwsaijvjjcegpv. Foundation applied via MCP then Prisma history reconciled; additive actor/time index generated by Prisma diff and deployed by Prisma CLI. Provider SQL artifacts in supabase/policies: private-storage, foundation-hardening and runtime-role. Five provider-specific MCP migrations recorded separately. Runtime role has SELECT foundation tables/INSERT audits, no direct auth.sessions read, no update/delete/DDL/bypass-RLS. LOGIN explicitly approved; password kept in ignored local configuration and explicitly approved preview secret. Auth frontend denied application tables; private session boolean restricted to backend role. Security advisors: no WARN/ERROR, only intentional deny-all _prisma_migrations RLS INFO. Performance: newly created tenant/date index unused INFO, no missing FK index. No new application dependencies; existing Supabase versions pinned exactly.

API change: same-origin private-file requests work with actual HTTP authority; excessive distinct grants return429 RATE_LIMITED. Offline sync, financial/stock writes, farmer registry and AI are NOT APPLICABLE to Phase1 and remain unimplemented. Restore/replay evidence from preceding isolated synthetic rehearsal remains applicable. Recovery email delivery and production operational settings are not claimed; production release must verify them. Source research remains absent despite Phase0 owner acceptance.

[Current closeout](../reports/phase-01-closeout-2026-10-08.md).
