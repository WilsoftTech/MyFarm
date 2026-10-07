# System architecture

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — content/scope/status/structure/link review.
- Implementation status: NOT STARTED — 0% (runtime implementation not verified).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase 00 session.
- Related phase/task IDs: Future Phases 01–24 as referenced; session review Phase 00; MYF-P01-T001 through MYF-P01-T013.
- Verified completed work: Architecture reference reviewed for current applicability; no runtime implementation completed.
- Remaining work/blockers: Affected future tasks/decisions and phase authorization; no database/app/deployment present.
- Evidence/report links: [Phase 00 closeout](../reports/phase-00-closeout-2026-10-08.md); [every-document review](../reports/phase-00-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Baseline required by source/request: Next.js App Router/React/TypeScript PWA, server application services/domain/repositories, Prisma and PostgreSQL/Neon, Vercel, private object storage, Dexie/IndexedDB and custom sync. Proposed deployment is one modular application, not microservices.

```mermaid
flowchart TD
  Farmer["Farmer PWA"] --> Local["Dexie cache and outbox"]
  Local --> API["Authenticated command/read/sync routes"]
  Operator["Assigned officer / organization UI"] --> API
  API --> Policy["Current authorization and schema validation"]
  Policy --> Service["Application services"]
  Service --> Domain["Deterministic domain rules"]
  Service --> Repo["Scoped repositories / unit of work"]
  Repo --> DB["PostgreSQL / Neon via Prisma"]
  Service --> Media["Private object storage"]
  Service --> Audit["Audit and structured telemetry"]
  Service --> Adapter["Later weather / AI / payment adapters"]
```

Client owns entry, offline drafts, status and display. Server owns authority, tenant scope, calculations, version checks, atomic domain effects, receipt/audit/change-log. Database is authoritative; local data is cached or unacknowledged. Service worker caches the public app shell, not indiscriminate personalized server responses.

Proposed modules: identity/policy, registry, production, accounting, inventory, activities, sync, analytics, then later intelligence/assistant/voice/weather, officers/organizations/commerce/payments/profile/partners/vision/trace/forecasts/subscriptions/operations. Phase-specific slug directories are proposals; module ownership must be agreed before code. Modules expose application interfaces, not cross-module table access from UI.

Example expense flow: form schema → command with stable mutation ID → server auth/current FarmMember → validate enterprise/season scope → exact decimal rules → atomically expense + receipt + audit + change log → scoped result. Online and offline replay use the same command service.

Long external calls use durable intent/outbox plus reconciliation; no promise of in-memory background work completing after a serverless request. Add a durable worker/queue only where enabled provider workload needs one. [Stack](technology-stack.md), [database](database-architecture.md), [sync](offline-sync-architecture.md) and [ADRs](architecture-decisions.md) provide contracts.
