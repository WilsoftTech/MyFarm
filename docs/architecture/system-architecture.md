# System architecture

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase02 closeout; content and status updated from verified evidence; no completion inferred from review alone.
- Implementation status: Phase01 scope COMPLETED — 100% (13/13 verified Phase01 tasks; PASS WITH CONDITIONS — LOCAL VERIFICATION); Phase02 scope COMPLETED — 100% (13/13 verified Phase02 tasks; PASS WITH CONDITIONS — LOCAL VERIFICATION); later-phase scope not counted.
- Last reviewed: 2026-10-09 (Africa/Nairobi), Phase02 implementation and closeout session.
- Related phase/task IDs: Phase01 MYF-P01-T001–T013; Phase02 MYF-P02-T001–T013.
- Verified completed work: Phase01 scope as previously verified; Phase02: farmer registry contracts/policies/migration/API/tests in this document's area verified (see the Phase 2 implementation section).
- Remaining work/blockers: Phase02 conditions P2-C1–P2-C8 where applicable; later-phase scope pending authorization.
- Evidence/report links: [Phase02 closeout](../reports/phase-02-closeout-2026-10-09.md); [Phase02 every-document review](../reports/phase-02-document-review-2026-10-09.md); [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](../reports/phase-01-provider-verification-2026-10-08.md).
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

## Phase 2 implementation (2026-10-09)

Added module `src/modules/farmer-registry/` (domain rules → contracts/ports → `FarmerRegistryService` → Prisma repository), API routes under `src/app/api/v1/`, and pages `/farmer`, `/farms` with a signed-in registry navigation. It follows the Phase 1 layering and boundary check; no new dependency ([closeout](../reports/phase-02-closeout-2026-10-09.md)).

## Phase 3 T003 UI (2026-10-18)

Enterprise/Season list, create and detail pages are server-rendered within the named farm scope. Server actions reuse the authorized production application service; shared safe command feedback redirects only after commit. Client forms reuse existing UI, React Hook Form and Zod. Request IDs survive interrupted responses while the open form retains its normalized payload; changed payloads start a new intent. Offline saving is disabled, with explicit in-memory retention limits. No durable outbox or new dependency is introduced. Full cycle acceptance remains deferred under D-P03-007. [Evidence](../reports/phase-03-t003-2026-10-18.md).

## Phase 3 T005 backend (2026-10-18)

CropCycleService reuses extracted production farm authorization; its lazy repository adapter keeps anonymous requests ahead of database client creation. Crop writes claim the existing audit receipt, serialize capacity per plot inside the transaction, recheck rights and commit the validated cycle atomically. Private JSON list/detail/catalog/start routes use the established HTTP wrappers. Catalog reference data is global; farm records remain scoped and browser roles have no direct data grants. No new dependency or external service is introduced. [Evidence](../reports/phase-03-t005-2026-10-18.md).

## Phase 3 T012 capability presentation (2026-10-25)

Enterprise list/detail screens and both production selectors consume the authorized T011 workflow capability. `EnterpriseWorkflow` contains presentation for supported workflow IDs; it does not map enterprise types to workflows. `enterpriseChoice` shares labels and disabled states across initial, paginated and preset choices. Unsupported or closed presets are visible but not preselected for submission. Existing page guards, server actions and start-service authorization remain authoritative; form drafts, retries and feedback reuse the existing production components. No application-service, persistence, provider, dependency or schema change is required. [Implementation and acceptance evidence](../reports/phase-03-t012-2026-10-25.md).
