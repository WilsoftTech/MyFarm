# Definition of done

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase02 closeout status/link review; content unchanged; no completion inferred from review.
- Implementation status: REFERENCE ONLY — N/A (navigation/protocol/template/decision/evidence record; no directly implementable scope).
- Last reviewed: 2026-10-09 (Africa/Nairobi), Phase02 implementation and closeout session.
- Related phase/task IDs: Phase01 review session; MYF-P01-T001 through MYF-P01-T013; Phase00 owner acceptance where referenced; Phase02 review session (MYF-P02-T001–T013).
- Verified completed work: Reference content/status/evidence links reviewed; document existence or review does not complete implementation tasks.
- Remaining work/blockers: Maintain alignment after Phase01 live verification; historical results stay historical and source body remains immutable.
- Evidence/report links: [Phase02 closeout](../reports/phase-02-closeout-2026-10-09.md); [Phase02 every-document review](../reports/phase-02-document-review-2026-10-09.md); [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](../reports/phase-01-provider-verification-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Task done: approved scope, correct behavior tied to source/AC, appropriate tests, authorization/integrity review, no undocumented changed policy, operational/client/migration notes and evidence. Documentation existence does not complete implementation.

Each engineering phase must run and record:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Expected Phase 1 scripts: lint runs configured ESLint CLI; typecheck runs tsc --noEmit; test runs Vitest run; build runs next build. Pin compatible versions/config first. Proposed additional scripts: test:integration for isolated DB constraints/auth/transactions; test:e2e for Playwright; test:security for authorization/adversarial cases; test:migrations for fresh/upgrade/restore; test:load when performance gate applies. CI must run applicable suites, not merely list them. Exact commands/results retained.

Phase 0 is research/document approval and has no app scripts; record N/A with reason rather than fake passes. Once application exists, mandatory command failure blocks closeout. Skipped/unavailable applicable suite is not passing evidence.

Phase done: all H/K complete with evidence, L/cumulative gates met, tests/audit/remediation/retest, migration/API/client compatibility verified, status and closeout written truthfully.

| Verdict | Conditions |
|---|---|
| PASS | All mandatory/applicable gates pass, no blocking defects |
| PASS WITH CONDITIONS | All mandatory gates pass; only explicitly approved nonblocking limitations, owner/deadline recorded |
| FAIL | Failed/missing mandatory gate or blocking security/integrity/scope defect |

Build alone does not prove readiness. No failing mandatory tests, fabricated logs, later-scope work or unresolved authoritative financial policies can be waived with conditions. [Audit](phase-audit-template.md), [closeout](phase-closeout-template.md) and [agent protocol](ai-agent-instructions.md) define process.

## Status-update evidence

Apply [document status policy](document-status-policy.md). Every-document review metadata and session inventory are required; compute progress from verified completed task IDs only. PARTIALLY COMPLETE can truthfully be 0% while preparation exists but no full task acceptance passes. Historical/template content is reference-only, not an implemented capability.
