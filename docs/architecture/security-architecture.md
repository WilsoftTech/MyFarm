# Security architecture

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — content/scope/status/structure/link review.
- Implementation status: NOT STARTED — 0% (runtime implementation not verified).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase 00 session.
- Related phase/task IDs: Future Phases 01–24 as referenced; session review Phase 00; MYF-P01-T001 through MYF-P01-T013.
- Verified completed work: Architecture reference reviewed for current applicability; no runtime implementation completed.
- Remaining work/blockers: Affected future tasks/decisions and phase authorization; no database/app/deployment present.
- Evidence/report links: [Phase 00 closeout](../reports/phase-00-closeout-2026-10-08.md); [every-document review](../reports/phase-00-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Baseline security starts Phase 1; Phase 24 validates scale/recovery. Threats include cross-farm IDOR, shared-device leakage, privilege changes, malicious uploads, prompt injection, forged/replayed provider events, duplicate financial writes, stolen sessions/secrets and accidental backup exposure.

Trust boundaries: browser/local cache is untrusted and may be lost; API authenticates and validates; services/repositories constrain tenant/farm/related objects; private object storage requires scoped grants; providers may fail/replay; retrieved knowledge/user content cannot grant AI permissions.

Controls: server least privilege and current membership, composite scope constraints, CSRF/origin/session policy, exact schema/unit/money validation, bounded requests/rate controls, private files/upload validation, append audits, TLS and provider-verified storage encryption, scoped jobs/tool identities, secrets outside code/client/logs, dependency/security review. Record security-sensitive grants/exports/corrections with redacted audit evidence; audit is not full financial payload dumping.

AI is read-only Phase 11. Treat tool and retrieved text as data, restrict tool names/scopes, compute money deterministically and evaluate groundedness. Voice requires explicit payload-hash confirmation. Images show possible conditions and escalate risk. Consent controls profiles/location/audio/partner disclosures; collection/retention/erasure decisions are unresolved and require competent local review when applicable.

No regulatory compliance, certification or licensed finance approval is asserted. Legal/provider responsibilities in Q26/Q29 must be resolved before activation, using current official rules/qualified review. Avoid unnecessary personal data in MVP.

Incident procedure proposal: detect/classify → stop affected access/payment/sync safely → preserve redacted evidence → revoke keys/grants → reconcile authoritative history → restore/verify → communicate through approved owner process → remediate/retest. Breach-notification duties and escalation contacts require policy approval; no external messaging sent now.

Test auth/IDOR through list/search/export/media/AI/jobs; adversarial upload/prompt/webhook; real retry/rollback/concurrency; secret/log scan; session revocation and shared-cache isolation. [Checklist](../engineering/security-checklist.md), [auth](authentication-authorization.md), [multi-tenancy](multi-tenancy.md), [ops](observability.md) and [decisions](../DECISION-LOG.md) govern closeout.
