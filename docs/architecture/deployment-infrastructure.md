# Deployment and infrastructure

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — status/applicability/structure/link review; no runtime or independent product validation.
- Implementation status: NOT STARTED — 0% (runtime implementation not verified).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase 00 session.
- Related phase/task IDs: Future Phases 01–24 as referenced; session review Phase 00; MYF-P01-T001 through MYF-P01-T013.
- Verified completed work: Architecture reference reviewed for current applicability; no runtime implementation completed.
- Remaining work/blockers: Affected future tasks/decisions and phase authorization; no database/app/deployment present.
- Evidence/report links: [Phase 00 closeout](../reports/phase-00-closeout-2026-10-08.md); [every-document review](../reports/phase-00-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Baseline target: Vercel application, Neon PostgreSQL, suitable private object storage. **Design only; no resources, deployment or external paid service created.** Regions/versions/cost/quotas/auth/media provider unresolved in Q03/Q04/Q34.

Environments: local development with isolated DB; CI test DB; preview app with synthetic data and separate credentials; staging provider sandbox; production only after approved phase gates and deployment authorization. Preview must never default to production connection strings, buckets or payment callbacks.

Pin runtime/ORM versions and test chosen adapter on server hosting runtime. Application DB connections use an appropriate tested pooled configuration; migrations/maintenance use the provider-supported connection path. Pool/session/transaction behavior must be measured, not assumed. Do not log connection strings. Secrets injected via environment management, scoped by environment and rotated.

Private media upload/download grants enforce owner and expiry; retention/orphan cleanup policy and media quotas approved first. Build/deploy CI uses least privilege, verifies quality/migrations and smoke health checks. Database migration is reviewed/rehearsed separately; schema deploy and app rollback compatibility are explicit.

Serverless requests do not guarantee indefinite background tasks. MVP sync is bounded foreground work. Enabled payment/AI/forecast workloads needing durable jobs use persistent outbox/state with safe worker trigger and reconciliation; select extra execution service only when runtime/job evidence requires it.

Backups/restore tests start with persistent sensitive data, not Phase 24 only. Record provider capability, retention, protected backup access, RPO/RTO and drill evidence. Rollback/recovery distinguishes code rollback from restored DB and lost provider-side effects; reconcile receipt/payment histories after restore.

Capacity/cost model proposal: active farmers × records/day and offline backlog burst; storage bytes/media retention; DB query/connection peaks; later AI/audio/image calls and provider fee volume. No fabricated price estimate. Review Uganda latency/region/data obligations and current provider documentation before deployment. [DB](database-architecture.md), [observability](observability.md), [migration policy](../engineering/migration-policy.md) and [decisions](../DECISION-LOG.md) govern operation.
