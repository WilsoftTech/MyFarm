# Phase audit template

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — content/scope/status/structure/link review.
- Implementation status: REFERENCE ONLY — N/A (no directly implementable scope).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase 00 session.
- Related phase/task IDs: Phase 00 session; MYF-P00-T001 through MYF-P00-T010; future phase references remain pending.
- Verified completed work: Reference/protocol/navigation/report review performed; no phase completion implied.
- Remaining work/blockers: Keep aligned with verified task/evidence changes; Phase 00 discovery gate still unmet.
- Evidence/report links: [Phase 00 closeout](../reports/phase-00-closeout-2026-10-08.md); [every-document review](../reports/phase-00-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Use for an actual implementation review. This unfilled template is not audit evidence.

## Identification and scope

Record phase/task IDs, source/AC IDs, reviewer, date/time zone, repository commit, environment and approved ADR versions. Compare implemented scope to phase B exclusions and later-phase boundaries. List files/API/schema changed and deviations requiring a decision.

## Evidence matrix

| Requirement/AC | Observed behavior and test/command evidence | Result | Finding/owner |
|---|---|---|---|
| Enter actual ID | Link exact artifact/log; no assumed pass | PASS / FAIL / NOT VERIFIED / N/A with reason | Actual defect or nonblocking limitation |

Review domain money/unit/stock/ledger invariants, duplicate/concurrency/version cases, auth/IDOR/export/media/AI scope, mobile/accessibility/offline states, provider outages/revocation and migration/restore compatibility. Identify missing tests and unsupported claims.

## Finding record

Each finding: stable report-specific ID, severity, requirement/AC affected, reproduction, expected/observed behavior, consequence, fix owner, blocking decision and retest proof. Data loss, cross-tenant leakage, wrong money/stock, duplicate settlement and failed mandatory checks are blockers.

## Remediation and verdict

Record fixes and exact retest commands/results. Re-run affected regression/security/migration suites; no “looks fine” signoff. Verdict PASS / PASS WITH CONDITIONS / FAIL follows [done policy](definition-of-done.md). Conditions require explicit nonblocking rationale/approver/owner/deadline. Closeout links this audit and updates [status](../PROJECT-STATUS.md) only with verified evidence.

## Status-update evidence

Apply [document status policy](document-status-policy.md). Every-document review metadata and session inventory are required; compute progress from verified completed task IDs only. PARTIALLY COMPLETE can truthfully be 0% while preparation exists but no full task acceptance passes. Historical/template content is reference-only, not an implemented capability.
