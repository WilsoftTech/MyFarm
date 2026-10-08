# Technology stack

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase01 status, applicability and evidence/link review; affected content reconciled; no independent farmer validation or hosted verification.
- Implementation status: PARTIALLY COMPLETE — 30.77% of associated Phase01 dependency chain (4/13); full cross-phase scope has no claimed completion percentage.
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase01 implementation session.
- Related phase/task IDs: Phase01 foundation T001–T013 (4 verified); cross-phase requirements remain pending; Phase01 review session.
- Verified completed work: Foundation subset implemented/tested as described in the Phase01 closeout; no later feature/hosted provider completion inferred.
- Remaining work/blockers: Phase01 external auth/storage/CI/deployment evidence and later-phase architecture requirements pending.
- Evidence/report links: [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

| Layer | Requested/source baseline | Operational decision |
|---|---|---|
| Web | Next.js App Router, React, TypeScript | Pin compatible versions at Phase 1; do not infer latest from this blueprint |
| UI | Tailwind, shadcn/ui, React Hook Form, Zod | Accessible reusable inputs; same DTO validation server-side |
| Server | Next.js routes/server application, domain services | Node runtime compatibility to verify with selected DB/auth adapters |
| Persistence | PostgreSQL, Supabase, Prisma | Exact decimal, transactions, scoped composite relationships, pool tested |
| Offline | PWA, service worker, IndexedDB, Dexie | Custom commands/receipts/pull cursor; storage is best-effort without granted persistence |
| Tests | Vitest, React Testing Library, Playwright | DB integration/authorization/migration suites added to CI |
| Hosting/media | Vercel, Supabase private storage | Regions, price/limits and backup capabilities unresolved; no provisioning now |
| Ops | Logs, error tracking, audit, health | Choose minimal provider after redaction/cost review |

First-party technical references checked 2026-10-08: [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) describes manifest/service-worker setup; that does not supply MyFarm custom sync. [Prisma transactions](https://docs.prisma.io/docs/orm/v7/prisma-client/queries/transactions) documents transactional/idempotency/concurrency patterns; compatible version/API must be pinned. [MDN storage](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) documents quotas/eviction; no fixed universal quota assumed.

The approved stack has been installed/pinned for Phase1; no paid service created. Auth provider selected; hosted storage/region/connection-pool/hosting-limit verification remains pending under Q03/Q04. [Deployment](deployment-infrastructure.md), [decisions](../DECISION-LOG.md) and [testing](testing-strategy.md) capture evidence.


## Phase1 implemented evidence and limits

Exact stack versions are pinned in package.json/package-lock.json. Supabase PostgreSQL + Supabase Auth is approved. Local build/tests pass; hosted region/pool/SSL/private bucket and price/limits remain unverified. [Dependencies](../engineering/foundation-dependencies.md).

[Closeout](../reports/phase-01-closeout-2026-10-08.md); [setup](../engineering/foundation-local-setup.md).
