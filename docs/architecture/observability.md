# Observability

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — status/applicability/structure/link review; no runtime or independent product validation.
- Implementation status: NOT STARTED — 0% (runtime implementation not verified).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase 00 session.
- Related phase/task IDs: Future Phases 01–24 as referenced; session review Phase 00; MYF-P01-T001 through MYF-P01-T013.
- Verified completed work: Architecture reference reviewed for current applicability; no runtime implementation completed.
- Remaining work/blockers: Affected future tasks/decisions and phase authorization; no database/app/deployment present.
- Evidence/report links: [Phase 00 closeout](../reports/phase-00-closeout-2026-10-08.md); [every-document review](../reports/phase-00-document-review-2026-10-08.md).
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
