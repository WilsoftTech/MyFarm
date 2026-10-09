# Observability

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase02 closeout status/link review; content unchanged; no completion inferred from review.
- Implementation status: Phase01 scope COMPLETED — 100% (13/13 verified Phase01 tasks; PASS WITH CONDITIONS — LOCAL VERIFICATION); later-phase scope not counted.
- Last reviewed: 2026-10-09 (Africa/Nairobi), Phase02 implementation and closeout session.
- Related phase/task IDs: Phase01 foundation T001–T013 (10 verified); cross-phase requirements remain pending; Phase01 review session; Phase02 review session (MYF-P02-T001–T013).
- Verified completed work: T001–T010; live Supabase verification and local quality/security gates PASS; see current closeout.
- Remaining work/blockers: T011–T013 hosted CI/preview/final review pending.
- Evidence/report links: [Phase02 closeout](../reports/phase-02-closeout-2026-10-09.md); [Phase02 every-document review](../reports/phase-02-document-review-2026-10-09.md); [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](../reports/phase-01-provider-verification-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Source requires structured logging, error tracking, audit events and health monitoring. Vendor choice and SLOs remain unresolved; no telemetry service has been configured.

Structured log fields: timestamp, level, event, requestId, commandId, service/module, environment, codeVersion, errorCode, duration. Use opaque tenant/actor references only when necessary. Never log phone/GPS/finance payload, session/auth headers, connection strings, raw audio/images or unrestricted prompts.

Separate operational logs from append audit history. Audit fields: actor/scope/action/target/time/request/command and minimal reason/changed-field metadata; sensitive corrections may retain controlled before/after references, not public text dumps. Audit/receipt/domain financial write is atomic or safely reconciled; no silent dropped audit on successful sensitive mutation.

| Signal | Meaning | Action/verification |
|---|---|---|
| API error/latency | Failed or slow allowed requests | Inspect redacted correlation; use approved budget |
| DB/pool errors/slow query | Connection contention or unbounded work | Query plan/index/pool analysis |
| Pending sync age/reject/conflict | Farmer work unacknowledged | Safe retry/remediation, not duplicate resubmission |
| Outbox/job age/retries | Provider work stuck | Reconcile unknown status; dead-letter with owner |
| Payment mismatch | Ledger/provider disagree | Freeze affected settlement action, open exception |
| Backup/restore drill | Recovery capability | Alert missing backups/failed restoration |
| Pilot usage | Consented recurring use | Cohort aggregate, no sensitive payload telemetry |

Health endpoints: public minimal liveness; restricted readiness for dependency failures without secrets/tenant details. Provider outage should degrade relevant capability, not leak diagnostic internals. Monitor synthetic scope-safe main flow where approved.

Set actionable thresholds/owner/escalation in Q34 before production. Pilot metrics definition Q18 distinguishes attempt vs committed transaction; never inflate use by retries. Incident report records start/end, impact, recovery, root cause and retest. [Security](security-architecture.md), [testing](testing-strategy.md) and [reports](../reports/README.md) define evidence.


## Phase1 implemented evidence and limits

Structured allowlisted logs and safe failures, public liveness and authenticated DB readiness are implemented/tested. No farmer payload/raw exception/secret serialization. Hosted error/telemetry delivery remains unconfigured.

[Closeout](../reports/phase-01-closeout-2026-10-08.md); [setup](../engineering/foundation-local-setup.md).
