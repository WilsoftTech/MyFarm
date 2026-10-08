# Authentication and authorization

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase01 status, applicability and evidence/link review; affected content reconciled; no independent farmer validation or hosted verification.
- Implementation status: PARTIALLY COMPLETE — 30.77% of associated Phase01 dependency chain (4/13); full cross-phase scope has no claimed completion percentage.
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase01 implementation session.
- Related phase/task IDs: Phase01 foundation T001–T013 (4 verified); cross-phase requirements remain pending; Phase01 review session.
- Verified completed work: Foundation subset implemented/tested as described in the Phase01 closeout; no later feature/hosted provider completion inferred.
- Remaining work/blockers: Phase01 external auth/storage/CI/deployment evidence and later-phase architecture requirements pending.
- Evidence/report links: [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md).
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
