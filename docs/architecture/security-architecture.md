# Security architecture

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — current Phase01 implementation/evidence/status review; no completion inferred from review.
- Implementation status: PARTIALLY COMPLETE — 76.92% (10/13 verified Phase01 tasks; later scope not counted).
- Last reviewed: 2026-10-08 (Africa/Nairobi), live provider and hosted closeout session.
- Related phase/task IDs: Phase01 foundation T001–T013 (10 verified); cross-phase requirements remain pending; Phase01 review session.
- Verified completed work: T001–T010; live Supabase verification and local quality/security gates PASS; see current closeout.
- Remaining work/blockers: T011–T013 hosted CI/preview/final review pending.
- Evidence/report links: [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](../reports/phase-01-provider-verification-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Baseline security starts Phase 1; Phase 24 validates scale/recovery. Threats include cross-farm IDOR, shared-device leakage, privilege changes, malicious uploads, prompt injection, forged/replayed provider events, duplicate financial writes, stolen sessions/secrets and accidental backup exposure.

Trust boundaries: browser/local cache is untrusted and may be lost; API authenticates and validates; services/repositories constrain tenant/farm/related objects; private object storage requires scoped grants; providers may fail/replay; retrieved knowledge/user content cannot grant AI permissions.

Controls: server least privilege and current membership, composite scope constraints, CSRF/origin/session policy, exact schema/unit/money validation, bounded requests/rate controls, private files/upload validation, append audits, TLS and provider-verified storage encryption, scoped jobs/tool identities, secrets outside code/client/logs, dependency/security review. Record security-sensitive grants/exports/corrections with redacted audit evidence; audit is not full financial payload dumping.

AI is read-only Phase 11. Treat tool and retrieved text as data, restrict tool names/scopes, compute money deterministically and evaluate groundedness. Voice requires explicit payload-hash confirmation. Images show possible conditions and escalate risk. Consent controls profiles/location/audio/partner disclosures; collection/retention/erasure decisions are unresolved and require competent local review when applicable.

No regulatory compliance, certification or licensed finance approval is asserted. Legal/provider responsibilities in Q26/Q29 must be resolved before activation, using current official rules/qualified review. Avoid unnecessary personal data in MVP.

Incident procedure proposal: detect/classify → stop affected access/payment/sync safely → preserve redacted evidence → revoke keys/grants → reconcile authoritative history → restore/verify → communicate through approved owner process → remediate/retest. Breach-notification duties and escalation contacts require policy approval; no external messaging sent now.

Test auth/IDOR through list/search/export/media/AI/jobs; adversarial upload/prompt/webhook; real retry/rollback/concurrency; secret/log scan; session revocation and shared-cache isolation. [Checklist](../engineering/security-checklist.md), [auth](authentication-authorization.md), [multi-tenancy](multi-tenancy.md), [ops](observability.md) and [decisions](../DECISION-LOG.md) govern closeout.


## Phase1 implemented evidence and limits

Current account/membership checks, role isolation, server-only persistence, private file contract, RLS and safe logs tested locally. Live Supabase cookie/recovery/rate-limit/storage policy verification remains pending. No production security certification.

[Closeout](../reports/phase-01-closeout-2026-10-08.md); [setup](../engineering/foundation-local-setup.md).

## Phase 1 security follow-up

Current code verifies provider session existence/expiry and fails closed, hosted PostgreSQL TLS is strictly verified, and the unapplied storage policy helper uses a private schema and current session/membership checks. Local regression tests pass; hosted schema/role/Auth/Storage verification remains pending. [Follow-up evidence](../reports/phase-01-provider-verification-2026-10-08.md).
