# Authentication and authorization

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED - Phase 14 affected architecture and local evidence; historical sections retained.
- Implementation status: REFERENCE ONLY - architecture record; Phase 14 locally verified with release conditions.
- Last reviewed: 2026-11-22 (Africa/Nairobi).
- Related phase/task IDs: MYF-P14-T001 through T007; earlier references retained in dated sections.
- Verified completed work: Phase 14 local software acceptance, security, compatibility and recovery checks pass; see dated section.
- Remaining work/blockers: P14-C1 through C4 and inherited release conditions; hosted rollout/owner acceptance pending.
- Evidence/report links: [Phase 14 closeout](../reports/phase-14-closeout-2026-11-22.md); historical reports retained below.
<!-- MYFARM-STATUS-END -->

Authentication provider is Supabase Auth (approved by user); existing-account email/password foundation implemented. Recovery and final credential/shared-device policy remain Q03. Investigate farmer phone availability, shared devices and language; do not assume email-only accounts. Session security needs secure/HttpOnly cookies, appropriate SameSite, expiry/rotation/revocation and CSRF/origin protections for cookie-authenticated mutations.

## Proposed permission matrix

| Role/context | Read | Write | Restricted operations |
|---|---|---|---|
| Farm owner | Own scoped farm/history | Own records/tasks | Membership, correction/adjustment per approved policy |
| Farm manager | Granted farm scope | Explicit delegated records/tasks | No grant expansion or provider settlement by default |
| Worker | Assigned tasks only | Complete assigned work | No default financial/profile export |
| Officer | Consented active farmer assignment | Visits and granted assistance | No global farm registry or private finance by role |
| Org operator | Shared member fields/org operations | Own procurement/member duties | Cannot absorb private farm records |
| Buyer | Published offer/agreed order fields | Own RFQ/order actions | No seller private history |
| Partner | Consent-approved profile fields | Own application/offer events | No direct farm mutation |
| Platform operator | Operational metadata | Operational remediation | Explicit audited support grant for customer records |

Validate session → resolve actor → load current membership/grant → authorize action → constrain resource lookup → validate related IDs → domain write. Never authorize from role/tenantId submitted by browser. Route middleware can redirect but cannot replace service/repository policy. Background jobs and AI tools also need scoped service identities.

Example: User A submits User B's expense ID. Repository query includes A's permitted tenant/farm; zero match returns denied/not found without metadata leakage. Signed media URL requires the same policy before issue. Revoking manager/officer invalidates future commits, including queued offline commands; retain drafts with visible denied state and owner remediation path.

Test every list/detail/create/update/delete/search/export/download and privilege-change path with two tenants, including forged parents and AI retrieval. [Multi-tenancy](multi-tenancy.md), [security checklist](../engineering/security-checklist.md) and [sync](offline-sync-architecture.md) extend this policy.


## Phase1 implemented evidence and limits

Supabase Auth selected; existing-account email/password server action validates Zod, getUser checks server identity, proxy refreshes cookies with getClaims. No client role/grant is trusted. Recovery/rate-limit/shared-device policy and live provider expiry/revoke tests remain pending.

[Closeout](../reports/phase-01-closeout-2026-10-08.md); [setup](../engineering/foundation-local-setup.md).

## Phase 1 security follow-up

Current code verifies provider session existence/expiry and fails closed, hosted PostgreSQL TLS is strictly verified, and the unapplied storage policy helper uses a private schema and current session/membership checks. Local regression tests pass; hosted schema/role/Auth/Storage verification remains pending. [Follow-up evidence](../reports/phase-01-provider-verification-2026-10-08.md).

## Current live verification and decision record

Phase 01 BLOCKED — 76.92% (10/13 verified task IDs). Verdict: FAIL. Completed T001–T010. Remaining T011–T013: hosted CI and dependency-gated final closure. Protected preview builds and live authenticated hosted verification succeeds; CI startup failure prevents completion.

**Superseded 2026-10-08 (local verification closeout):** Phase 01 COMPLETED — 100% (13/13). Verdict PASS WITH CONDITIONS — LOCAL VERIFICATION at `bd9fadc`; GitHub-hosted CI blocked by account billing lock and not verified (owner exception D-P01-LOCAL-CI-001, Phase 1 only). [local verification report](../reports/phase-01-local-verification.md).

Live Supabase Auth and private storage:28 checks PASS. Current membership/session revocation, tenant isolation, private downloads, secure cookies, concurrent idempotency and recovery token generation verified. Temporary test users/files/database fixtures removed. Lint/typecheck/build/boundaries PASS0;58 unit/component tests and11 PostgreSQL integration tests PASS. Rate limiter:30 distinct private-file grants/actor/minute, shared transaction advisory lock, identical retries free, database clock window; concurrent boundary and expired-window test PASS. Same-origin authority handling repaired after real browser verification exposed Next.js internal hostname normalization. TLS URL overrides stripped; verified client-to-pooler TLS and Supabase CA. Pooler-to-database pg_stat_ssl reports false; no end-to-end provider-managed transport claim.

Prisma migrations202610080001_foundation and202610080101_private_grant_rate_limit applied in isolated Supabase development project sudqhluwsaijvjjcegpv. Foundation applied via MCP then Prisma history reconciled; additive actor/time index generated by Prisma diff and deployed by Prisma CLI. Provider SQL artifacts in supabase/policies: private-storage, foundation-hardening and runtime-role. Five provider-specific MCP migrations recorded separately. Runtime role has SELECT foundation tables/INSERT audits, no direct auth.sessions read, no update/delete/DDL/bypass-RLS. LOGIN explicitly approved; password kept in ignored local configuration and explicitly approved preview secret. Auth frontend denied application tables; private session boolean restricted to backend role. Security advisors: no WARN/ERROR, only intentional deny-all _prisma_migrations RLS INFO. Performance: newly created tenant/date index unused INFO, no missing FK index. No new application dependencies; existing Supabase versions pinned exactly.

API change: same-origin private-file requests work with actual HTTP authority; excessive distinct grants return429 RATE_LIMITED. Offline sync, financial/stock writes, farmer registry and AI are NOT APPLICABLE to Phase1 and remain unimplemented. Restore/replay evidence from preceding isolated synthetic rehearsal remains applicable. Recovery email delivery and production operational settings are not claimed; production release must verify them. Source research remains absent despite Phase0 owner acceptance.

[Current closeout](../reports/phase-01-closeout-2026-10-08.md).

## Phase 2 implementation (2026-10-09)

Implemented and verified ([closeout](../reports/phase-02-closeout-2026-10-09.md)):

- **FarmAccessPolicy:** farm data requires an ACTIVE `FarmMember` row **and** an ACTIVE FARMER membership of the farm's tenant, re-checked on every request. Unknown and foreign farm IDs both return 403.
- **No role bypass:** organization ADMIN/AGENT roles grant no farm-data access (verified live).
- **Server-derived scope:** registration derives the actor from the verified session. Tenant, farmer and farm are always server-derived; strict schemas reject client scope claims.
- **Early redirect:** the proxy now returns a real 307 for anonymous requests to protected pages ([D-P02-008](../DECISION-LOG.md#d-p02-008--phase-1-condition-c5-resolved-for-anonymous-visitors)). Pages and APIs still verify the session server-side.
- **Database layer:** the restricted `myfarm_runtime` role gains only the registry grants in [D-P02-007](../DECISION-LOG.md#d-p02-007--runtime-role-privileges-for-registry-writes), with RLS write checks as defense in depth.

## Phase 14 local implementation - 2026-11-22

Named owner consent grants farm-specific officer permissions independently of FarmMember. Farmer-confirmed assisted registration commits exact reviewed records, assignment and audit receipts atomically. Current session/assignment/parent checks apply to visits, follow-ups, private namespaced media and sync. The existing account-partitioned outbox preserves denied work, with visible offline readiness and no IndexedDB version change. Six additive officer tables, column-limited guarded writes and composite parent constraints retain the shared runtime-role architecture; application queries enforce actor isolation. Local checks and recovery pass; hosted SQL/storage/application rollout and owner acceptance remain pending. [Scope, migrations, security evidence and limits](../reports/phase-14-closeout-2026-11-22.md).
