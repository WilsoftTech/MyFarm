# System architecture

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase01 status, applicability and evidence/link review; affected content reconciled; no independent farmer validation or hosted verification.
- Implementation status: PARTIALLY COMPLETE — 30.77% of associated Phase01 dependency chain (4/13); full cross-phase scope has no claimed completion percentage.
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase01 implementation session.
- Related phase/task IDs: Phase01 foundation T001–T013 (4 verified); cross-phase requirements remain pending; Phase01 review session.
- Verified completed work: Foundation subset implemented/tested as described in the Phase01 closeout; no later feature/hosted provider completion inferred.
- Remaining work/blockers: Phase01 external auth/storage/CI/deployment evidence and later-phase architecture requirements pending.
- Evidence/report links: [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Baseline required by source/request: Next.js App Router/React/TypeScript PWA, server application services/domain/repositories, Prisma and PostgreSQL/Supabase, Vercel, private object storage, Dexie/IndexedDB and custom sync. Proposed deployment is one modular application, not microservices.

```mermaid
flowchart TD
  Farmer["Farmer PWA"] --> Local["Dexie cache and outbox"]
  Local --> API["Authenticated command/read/sync routes"]
  Operator["Assigned officer / organization UI"] --> API
  API --> Policy["Current authorization and schema validation"]
  Policy --> Service["Application services"]
  Service --> Domain["Deterministic domain rules"]
  Service --> Repo["Scoped repositories / unit of work"]
  Repo --> DB["PostgreSQL / Supabase via Prisma"]
  Service --> Media["Private object storage"]
  Service --> Audit["Audit and structured telemetry"]
  Service --> Adapter["Later weather / AI / payment adapters"]
```

Client owns entry, offline drafts, status and display. Server owns authority, tenant scope, calculations, version checks, atomic domain effects, receipt/audit/change-log. Database is authoritative; local data is cached or unacknowledged. Service worker caches the public app shell, not indiscriminate personalized server responses.

Proposed modules: identity/policy, registry, production, accounting, inventory, activities, sync, analytics, then later intelligence/assistant/voice/weather, officers/organizations/commerce/payments/profile/partners/vision/trace/forecasts/subscriptions/operations. Phase-specific slug directories are proposals; module ownership must be agreed before code. Modules expose application interfaces, not cross-module table access from UI.

Example expense flow: form schema → command with stable mutation ID → server auth/current FarmMember → validate enterprise/season scope → exact decimal rules → atomically expense + receipt + audit + change log → scoped result. Online and offline replay use the same command service.

Long external calls use durable intent/outbox plus reconciliation; no promise of in-memory background work completing after a serverless request. Add a durable worker/queue only where enabled provider workload needs one. [Stack](technology-stack.md), [database](database-architecture.md), [sync](offline-sync-architecture.md) and [ADRs](architecture-decisions.md) provide contracts.


## Phase1 implemented evidence and limits

Phase1 source implements UI → application → domain/contracts → scoped Prisma repository. Independent domain/provider boundary tests pass. Supabase auth/PG selected. Future accounting/stock functions are type-only interfaces; Dexie/service-worker/custom sync is not implemented.

[Closeout](../reports/phase-01-closeout-2026-10-08.md); [setup](../engineering/foundation-local-setup.md).
