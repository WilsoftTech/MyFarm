# Authentication and authorization

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — status/applicability/structure/link review; no runtime or independent product validation.
- Implementation status: NOT STARTED — 0% (runtime implementation not verified).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase 00 session.
- Related phase/task IDs: Future Phases 01–24 as referenced; session review Phase 00; MYF-P01-T001 through MYF-P01-T013.
- Verified completed work: Architecture reference reviewed for current applicability; no runtime implementation completed.
- Remaining work/blockers: Affected future tasks/decisions and phase authorization; no database/app/deployment present.
- Evidence/report links: [Phase 00 closeout](../reports/phase-00-closeout-2026-10-08.md); [every-document review](../reports/phase-00-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Authentication provider and credential/recovery method are undecided (Q03). Investigate farmer phone availability, shared devices and language; do not assume email-only accounts. Session security needs secure/HttpOnly cookies, appropriate SameSite, expiry/rotation/revocation and CSRF/origin protections for cookie-authenticated mutations.

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
