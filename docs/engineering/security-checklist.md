# Security checklist

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase01 status, applicability and evidence/link review; affected content reconciled; no independent farmer validation or hosted verification.
- Implementation status: REFERENCE ONLY — N/A (navigation/protocol/template/decision/evidence record; no directly implementable scope).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase01 implementation session.
- Related phase/task IDs: Phase01 review session; MYF-P01-T001 through MYF-P01-T013; Phase00 owner acceptance where referenced.
- Verified completed work: Reference content/status/evidence links reviewed; document existence or review does not complete implementation tasks.
- Remaining work/blockers: Maintain alignment after Phase01 live verification; historical results stay historical and source body remains immutable.
- Evidence/report links: [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Apply relevant items every phase; Phase 24 verifies cumulative scale controls. Mark N/A only with reason and reviewer; no unchecked blocking risk can pass.

- [ ] Current session/expiry/revoke verified; credential/recovery flow reviewed.
- [ ] Server action/route/service/job/AI tool authorizes current scope.
- [ ] Tenant/farm/parent consistency enforced; two-tenant IDOR tested.
- [ ] List/search/report/export/file paths scoped; cache and local partitions isolated.
- [ ] Membership/share/assignment revocation tested, including offline reconnect.
- [ ] Schema/date/unit/money/file signature/type/size validation server-side.
- [ ] CSRF/origin, cookie session and rate-limits reviewed/tested.
- [ ] Credentials/PII/GPS/financial payloads absent from client bundles/logs.
- [ ] Private media grants short-lived and authorized; orphan cleanup safe.
- [ ] Sensitive grant/write/correction/export audit captured reliably.
- [ ] Financial/stock writes transactional and idempotent under concurrency.
- [ ] Corrections append history; posted ledger cannot be edited.
- [ ] Provider webhooks verified, deduplicated and reconciled where enabled.
- [ ] AI grounded/authorized; prompt injection cannot grant rights/write.
- [ ] Voice exact payload confirmed; images show uncertainty/escalation.
- [ ] Consent/purpose/retention/erasure and shared-device handling approved.
- [ ] Encryption/secrets rotation and protected backups verified.
- [ ] Restore/degraded-service response tested to approved targets.
- [ ] Dependency/security review and residual risks assigned.

Use [security architecture](../architecture/security-architecture.md), [auth](../architecture/authentication-authorization.md), [financial integrity](../architecture/financial-integrity.md) and [audit template](phase-audit-template.md) for evidence.


## Phase1 implemented evidence and limits

Session checklist application: auth/role/scope/RLS/validation/log/origin/audit/retry boundaries tested locally. Live provider session/recovery/rate-limit/bucket/SSL and hosted operational checks pending. Later financial/stock/AI/offline checks N/A in current foundation. [Audit](../reports/phase-01-audit-2026-10-08.md).

[Closeout](../reports/phase-01-closeout-2026-10-08.md); [setup](../engineering/foundation-local-setup.md).
