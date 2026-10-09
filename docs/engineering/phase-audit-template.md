# Phase audit template

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase02 closeout status/link review; content unchanged; no completion inferred from review.
- Implementation status: REFERENCE ONLY — N/A (navigation/protocol/template/decision/evidence record; no directly implementable scope).
- Last reviewed: 2026-10-09 (Africa/Nairobi), Phase02 implementation and closeout session.
- Related phase/task IDs: Phase01 review session; MYF-P01-T001 through MYF-P01-T013; Phase00 owner acceptance where referenced; Phase02 review session (MYF-P02-T001–T013).
- Verified completed work: Reference content/status/evidence links reviewed; document existence or review does not complete implementation tasks.
- Remaining work/blockers: Maintain alignment after Phase01 live verification; historical results stay historical and source body remains immutable.
- Evidence/report links: [Phase02 closeout](../reports/phase-02-closeout-2026-10-09.md); [Phase02 every-document review](../reports/phase-02-document-review-2026-10-09.md); [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](../reports/phase-01-provider-verification-2026-10-08.md).
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
