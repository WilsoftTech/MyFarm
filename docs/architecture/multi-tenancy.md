# Multi tenancy

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — status/applicability/structure/link review; no runtime or independent product validation.
- Implementation status: NOT STARTED — 0% (runtime implementation not verified).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase 00 session.
- Related phase/task IDs: Future Phases 01–24 as referenced; session review Phase 00; MYF-P01-T001 through MYF-P01-T013.
- Verified completed work: Architecture reference reviewed for current applicability; no runtime implementation completed.
- Remaining work/blockers: Affected future tasks/decisions and phase authorization; no database/app/deployment present.
- Evidence/report links: [Phase 00 closeout](../reports/phase-00-closeout-2026-10-08.md); [every-document review](../reports/phase-00-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Source requires farm ownership from Phase 2 and foundational Organization/Membership/Role/Permission/Tenant support, with commercial billing only Phase 23. **Proposal:** one isolation workspace for an individual farmer and another for an organization, represented through a tenant/organization abstraction. Exact schema/cardinality remains ADR-02/Q05/Q24.

All operational records require tenant scope and farm scope where meaningful. Active membership determines permitted workspace; explicit farm grants narrow actions further. Personal farmer records stay in farmer ownership; joining a cooperative creates a scoped consent/grant relation, not silent migration or broad access.

An organization’s own procurement/stock/payment history belongs to its tenant. Cross-party orders identify seller/buyer participants; expose agreed order fields through a bilateral DTO, not unrestricted cross-tenant joins. Traceability/shared profiles disclose only agreed origin fields. Recipient grants expire/revoke and are audited.

Isolation covers DB predicates/relationships, API caches, object keys/grants, local IndexedDB partition, service-worker cache, logs/traces, jobs, AI retrieval, search/report/export and metrics. Cache key includes tenant/farm/user grant context or avoids personalized sharing; invalidation follows permission changes. Public offers use an explicit publication projection.

Shared-phone logout/tenant switch locks or removes cached view. Pending edits must be safely synced/exported under approved recovery policy before destructive cache purge; never sync another user's queue under current credentials. Offline revocation is unknowable until reconnection; document this residual privacy risk and choose local unlock/TTL policy Q16.

Server-scoped repositories/composite FKs are baseline. PostgreSQL row-level security is a proposed defense-in-depth evaluation, not assumed active; connection/session behavior must be proved before adoption. [Auth](authentication-authorization.md), [DB](database-architecture.md), [sync](offline-sync-architecture.md) and [decisions](../DECISION-LOG.md) provide boundaries.
