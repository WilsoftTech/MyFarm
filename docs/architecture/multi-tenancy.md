# Multi tenancy

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase01 status, applicability and evidence/link review; affected content reconciled; no independent farmer validation or hosted verification.
- Implementation status: PARTIALLY COMPLETE — 30.77% of associated Phase01 dependency chain (4/13); full cross-phase scope has no claimed completion percentage.
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase01 implementation session.
- Related phase/task IDs: Phase01 foundation T001–T013 (4 verified); cross-phase requirements remain pending; Phase01 review session.
- Verified completed work: Foundation subset implemented/tested as described in the Phase01 closeout; no later feature/hosted provider completion inferred.
- Remaining work/blockers: Phase01 external auth/storage/CI/deployment evidence and later-phase architecture requirements pending.
- Evidence/report links: [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Source requires farm ownership from Phase 2 and foundational Organization/Membership/Role/Permission/Tenant support, with commercial billing only Phase 23. **Proposal:** one isolation workspace for an individual farmer and another for an organization, represented through a tenant/organization abstraction. Exact schema/cardinality remains ADR-02/Q05/Q24.

All operational records require tenant scope and farm scope where meaningful. Active membership determines permitted workspace; explicit farm grants narrow actions further. Personal farmer records stay in farmer ownership; joining a cooperative creates a scoped consent/grant relation, not silent migration or broad access.

An organization’s own procurement/stock/payment history belongs to its tenant. Cross-party orders identify seller/buyer participants; expose agreed order fields through a bilateral DTO, not unrestricted cross-tenant joins. Traceability/shared profiles disclose only agreed origin fields. Recipient grants expire/revoke and are audited.

Isolation covers DB predicates/relationships, API caches, object keys/grants, local IndexedDB partition, service-worker cache, logs/traces, jobs, AI retrieval, search/report/export and metrics. Cache key includes tenant/farm/user grant context or avoids personalized sharing; invalidation follows permission changes. Public offers use an explicit publication projection.

Shared-phone logout/tenant switch locks or removes cached view. Pending edits must be safely synced/exported under approved recovery policy before destructive cache purge; never sync another user's queue under current credentials. Offline revocation is unknowable until reconnection; document this residual privacy risk and choose local unlock/TTL policy Q16.

Server-scoped repositories/composite FKs are baseline. PostgreSQL row-level security is a proposed defense-in-depth evaluation, not assumed active; connection/session behavior must be proved before adoption. [Auth](authentication-authorization.md), [DB](database-architecture.md), [sync](offline-sync-architecture.md) and [decisions](../DECISION-LOG.md) provide boundaries.


## Phase1 implemented evidence and limits

Phase1 organization membership scopes are implemented/current-server-checked. Tests deny another tenant, revoked membership and unassigned admin access; browser-equivalent DB reads blocked by RLS. Farm ownership/sharing/assignment models remain Phase2+ proposals.

[Closeout](../reports/phase-01-closeout-2026-10-08.md); [setup](../engineering/foundation-local-setup.md).
