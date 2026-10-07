# Security checklist

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — status/applicability/structure/link review; no runtime or independent product validation.
- Implementation status: REFERENCE ONLY — N/A (no directly implementable scope).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase 00 session.
- Related phase/task IDs: Phase 00 session; MYF-P00-T001 through MYF-P00-T010; future phase references remain pending.
- Verified completed work: Reference/protocol/navigation/report review performed; no phase completion implied.
- Remaining work/blockers: Keep aligned with verified task/evidence changes; Phase 00 discovery gate still unmet.
- Evidence/report links: [Phase 00 closeout](../reports/phase-00-closeout-2026-10-08.md); [every-document review](../reports/phase-00-document-review-2026-10-08.md).
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
