# Phase closeout template

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase01 status, applicability and evidence/link review; affected content reconciled; no independent farmer validation or hosted verification.
- Implementation status: REFERENCE ONLY — N/A (navigation/protocol/template/decision/evidence record; no directly implementable scope).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase01 implementation session.
- Related phase/task IDs: Phase01 review session; MYF-P01-T001 through MYF-P01-T013; Phase00 owner acceptance where referenced.
- Verified completed work: Reference content/status/evidence links reviewed; document existence or review does not complete implementation tasks.
- Remaining work/blockers: Maintain alignment after Phase01 live verification; historical results stay historical and source body remains immutable.
- Evidence/report links: [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Copy into docs/reports/phase-NN-closeout-YYYY-MM-DD.md during actual implementation. Fill with observed evidence; do not manufacture results. All fields below are required.

## Phase identity and implementation scope

Record phase/name/date/time zone, owner/reviewer, repository commit/environment, approved requirement/task/AC IDs and ADR decisions. Describe concrete implemented behavior and deviations.

## Changes and migrations

List files changed; database schema/migration IDs/checksums; API endpoints/DTO changes; client/IndexedDB/server compatibility. Migration status: not required with reason, rehearsed, applied in named environment, failed or pending. Include rollback/restore and row-count/integrity evidence.

## Security review

Auth/current role, tenant/parent isolation, IDOR/export/media, input validation/secrets/audits, offline revocation, AI/provider protections where enabled. Link audit/findings, fixes and retests.

## Tests and quality evidence

| Command/suite | Environment/commit | Exit status / counts / skips | Evidence |
|---|---|---|---|
| npm run lint | Actual | Actual or NOT RUN with reason | Log |
| npm run typecheck | Actual | Actual or NOT RUN with reason | Log |
| npm test | Actual | Actual or NOT RUN with reason | Log |
| npm run build | Actual | Actual or NOT RUN with reason | Log |
| Applicable integration/E2E/security/migration/load | Actual | Actual or reasoned N/A | Log |

State TypeScript, lint and production-build statuses explicitly. Successful build alone does not prove readiness.

## Limitations, deferred work and verdict

List known limitations, deferred functionality, migration/operational status, open blockers and accepted nonblocking conditions with owner/deadline/approver. Evaluate every phase K acceptance and L exit criterion with evidence.

Verdict: **PASS / PASS WITH CONDITIONS / FAIL** per [definition of done](definition-of-done.md). Any blocker/failed mandatory test prevents closure. Record last verified milestone and next allowed action; update PROJECT-STATUS completed/pending tasks and evidence links only after review. No deployment/production change implied by closeout.

## Status-update evidence

Apply [document status policy](document-status-policy.md). Every-document review metadata and session inventory are required; compute progress from verified completed task IDs only. PARTIALLY COMPLETE can truthfully be 0% while preparation exists but no full task acceptance passes. Historical/template content is reference-only, not an implemented capability.
