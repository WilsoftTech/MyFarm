# Security architecture

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED - Phase 12 task-relevant implementation, security/offline boundaries and evidence; historical sections preserved.
- Implementation status: REFERENCE ONLY - architecture record; Phase 12 test/text implementation verified locally below, with release conditions.
- Last reviewed: 2026-11-20 (Africa/Nairobi), Phase 12 task-relevant implementation review.
- Related phase/task IDs: MYF-P12-T003 through T010; D-P12-001 through D-P12-003; historical task references retained in the body.
- Verified completed work: Phase 12 approved test-adapter/text-fallback software and relevant exact-confirmation boundaries verified locally; no real speech or hosted claim.
- Remaining work/blockers: P12-C1 through C6 and inherited release conditions; real speech/language accuracy, hosted work and owner acceptance remain.
- Evidence/report links: [Phase 12 closeout](../reports/phase-12-closeout-2026-11-20.md); historical reports remain linked in their dated sections.
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

**Update 2026-10-10:** both resolved. Browser roles hold no privilege on any `public` object in hosted dev, including `_prisma_migrations`, and get no default privileges from `postgres`. The `supabase_admin` residual is INT-C3. The advisors show 0 ERROR and 1 WARN, leaked-password protection off (INT-C6). [Integration report §9](../reports/phase-01-02-integration-2026-10-09.md#9-hosted-application--2026-10-10).

## Where tenant isolation is enforced (2026-10-09)

The application is the primary isolation layer; the database is defense in depth. Read isolation between tenants and the caller's identity are enforced only by the application, because one shared runtime role serves every user and its SELECT policies are `USING (true)`. Browser roles have no access to any object in `public` ([browser-role lockdown](deployment-infrastructure.md#provisioning-updated-2026-10-09-provisioning-hardening)). Full breakdown: [multi-tenancy](multi-tenancy.md#where-tenant-isolation-is-enforced-2026-10-09).

## Phase 5 verification scope - 2026-10-29

Phase 5 reuses current session/FARMER/farm checks, scoped nested IDs and strict command DTOs. New stock histories are append-only to the runtime and inaccessible to browser roles; transaction locks and receipt checks cover replay, overselling, revocation during waits and coordinated financial corrections. Real two-tenant/same-tenant-farm/ADMIN/revocation tests pass. Shared backend SELECT policies remain defense-in-depth, not a replacement for application read isolation. [Current audit](../reports/phase-05-closeout-2026-10-29.md).

Final Phase 5 audit: T001-T013 and the hosted quality workflow pass at f999449 ([run](https://github.com/WilsoftTech/MyFarm/actions/runs/40783651036)); [closeout](../reports/phase-05-closeout-2026-10-29.md). This supersedes the earlier pending-CI checkpoint, without claiming hosted Supabase application or later-phase implementation.

Phase 6 reuses current session, FARMER and farm checks, scoped nested IDs and strict commands. Runtime updates are limited to lifecycle and series-progress columns while a record is open, browser roles have no access, and foreign records are refused with no receipt. Final Phase 6 audit: [hosted run 41524090703](https://github.com/WilsoftTech/MyFarm/actions/runs/41524090703); [closeout](../reports/phase-06-closeout-2026-11-03.md).

Phase 7 keeps server authorization on every synced command. The service worker never stores signed-in pages or API responses. Local data is per account but not encrypted, and anyone holding a signed-in phone can see its cache (D-P07-003). [Closeout](../reports/phase-07-closeout-2026-11-03.md).

## Phase 12 staged implementation - 2026-11-20

Voice uses scoped private draft/receipt reads, strict untrusted suggestion schemas and a separate exact actor/farm/version/hash/expiry confirmation. Current account, role and farm membership are checked again inside the transaction after waits. Conflicting-window and lost-response recovery returns the existing receipt before permitting another intent. Text/synthetic adapters have no financial write capability; trusted measured provider/model/language/corpus approval gates speech advertising. Default speech is unavailable, no raw transcript/audio is retained, and microphone Permissions-Policy remains disabled. [Closeout and limitations](../reports/phase-12-closeout-2026-11-20.md).


## Phase 13 staged weather implementation - 2026-11-21

Six ephemeral synthetic forecast capabilities reuse current authorized farm/activity/crop services and approximate district context, never GPS or inferred stage. The weather page does not cache private responses or queue weather changes offline. A separately reviewed exact one-off spraying date change is server-validated, versioned and atomically audited, with current access checks after locks and DB-clock expiry. Dates and a payload digest remain in the existing immutable audit receipt; raw stage/forecast does not. Successful retries recover the same receipt; changed replays conflict. The additive manifest-listed weather runtime policy/trigger permits only the guarded scheduled date move and remains unapplied to hosted. Existing offline activity commands still use their original versions, so a stale version cannot silently overwrite the moved task. No new application table, external provider, paid service or live agronomic rule is introduced. [Closeout](../reports/phase-13-closeout-2026-11-21.md).
