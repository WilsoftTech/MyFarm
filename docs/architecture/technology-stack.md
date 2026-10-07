# Technology stack

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — status/applicability/structure/link review; no runtime or independent product validation.
- Implementation status: NOT STARTED — 0% (runtime implementation not verified).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase 00 session.
- Related phase/task IDs: Future Phases 01–24 as referenced; session review Phase 00; MYF-P01-T001 through MYF-P01-T013.
- Verified completed work: Architecture reference reviewed for current applicability; no runtime implementation completed.
- Remaining work/blockers: Affected future tasks/decisions and phase authorization; no database/app/deployment present.
- Evidence/report links: [Phase 00 closeout](../reports/phase-00-closeout-2026-10-08.md); [every-document review](../reports/phase-00-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

| Layer | Requested/source baseline | Operational decision |
|---|---|---|
| Web | Next.js App Router, React, TypeScript | Pin compatible versions at Phase 1; do not infer latest from this blueprint |
| UI | Tailwind, shadcn/ui, React Hook Form, Zod | Accessible reusable inputs; same DTO validation server-side |
| Server | Next.js routes/server application, domain services | Node runtime compatibility to verify with selected DB/auth adapters |
| Persistence | PostgreSQL, Supabase, Prisma | Exact decimal, transactions, scoped composite relationships, pool tested |
| Offline | PWA, service worker, IndexedDB, Dexie | Custom commands/receipts/pull cursor; storage is best-effort without granted persistence |
| Tests | Vitest, React Testing Library, Playwright | DB integration/authorization/migration suites added to CI |
| Hosting/media | Vercel, Neon, suitable object store | Regions, price/limits and backup capabilities unresolved; no provisioning now |
| Ops | Logs, error tracking, audit, health | Choose minimal provider after redaction/cost review |

First-party technical references checked 2026-10-08: [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) describes manifest/service-worker setup; that does not supply MyFarm custom sync. [Prisma transactions](https://docs.prisma.io/docs/orm/v7/prisma-client/queries/transactions) documents transactional/idempotency/concurrency patterns; compatible version/API must be pinned. [MDN storage](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) documents quotas/eviction; no fixed universal quota assumed.

Do not install or create paid services during this assignment. Version, auth, storage, regional latency, connection-pool and hosting-limit verification are Phase 1 decisions Q03/Q04. [Deployment](deployment-infrastructure.md), [decisions](../DECISION-LOG.md) and [testing](testing-strategy.md) capture evidence.
