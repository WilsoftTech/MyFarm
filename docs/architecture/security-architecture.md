# Security architecture

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase02 closeout; content and status updated from verified evidence; no completion inferred from review alone.
- Implementation status: Phase01 scope COMPLETED — 100% (13/13 verified Phase01 tasks; PASS WITH CONDITIONS — LOCAL VERIFICATION); Phase02 scope COMPLETED — 100% (13/13 verified Phase02 tasks; PASS WITH CONDITIONS — LOCAL VERIFICATION); later-phase scope not counted.
- Last reviewed: 2026-10-09 (Africa/Nairobi), Phase02 implementation and closeout session.
- Related phase/task IDs: Phase01 MYF-P01-T001–T013; Phase02 MYF-P02-T001–T013.
- Verified completed work: Phase01 scope as previously verified; Phase02: farmer registry contracts/policies/migration/API/tests in this document's area verified (see the Phase 2 implementation section).
- Remaining work/blockers: Phase02 conditions P2-C1–P2-C8 where applicable; later-phase scope pending authorization.
- Evidence/report links: [Phase02 closeout](../reports/phase-02-closeout-2026-10-09.md); [Phase02 every-document review](../reports/phase-02-document-review-2026-10-09.md); [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](../reports/phase-01-provider-verification-2026-10-08.md).
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

## Phase 2 implementation (2026-10-09)

Phase 2 security controls ([closeout §3](../reports/phase-02-closeout-2026-10-09.md#3-security-review)):

- **Same-origin:** registry commands reuse the Phase 1 `requireSameOrigin` policy (Host only, never X-Forwarded-Host).
- **Strict schemas:** reject undeclared personal data.
- **Idempotency:** request-ID audit receipts make retries idempotent.
- **Least privilege:** the runtime role has no DELETE, and browser roles are revoked from the registry tables.
- **Log hygiene:** logs carry no names, phones or coordinates.
- **Probes:** 49/49 anonymous production probes and 48/48 live checks PASS.

Open: Supabase advisors not run this session (P2-C6); `_prisma_migrations` browser-role grants (P2-C8).
