# Git workflow

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — current Phase01 implementation/evidence/status review; no completion inferred from review.
- Implementation status: REFERENCE ONLY — N/A (navigation/protocol/template/decision/evidence record; no directly implementable scope).
- Last reviewed: 2026-10-08 (Africa/Nairobi), live provider and hosted closeout session.
- Related phase/task IDs: Phase01 review session; MYF-P01-T001 through MYF-P01-T013; Phase00 owner acceptance where referenced.
- Verified completed work: Reference content/status/evidence links reviewed; document existence or review does not complete implementation tasks.
- Remaining work/blockers: Maintain alignment after Phase01 live verification; historical results stay historical and source body remains immutable.
- Evidence/report links: [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](../reports/phase-01-provider-verification-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Workspace had no Git repository when inspected. This assignment creates documentation only and does not initialize Git, commits or remotes.

Proposed engineering workflow after authorization: inspect repository and applicable instructions/status; choose one approved phase/task; branch from verified intended base; preserve unrelated user changes; make a cohesive diff with tests and documentation evidence. Commit/PR/push follow user/repository authorization, never inferred from this plan alone.

Review compares implementation against requirement/task/AC and ADR status; include schema/API/security/client compatibility and quality evidence. Do not combine later-phase feature work with foundation commits. CI mirrors mandatory scripts and applicable additional suites; failed required checks block merge and phase closure.

Suggested branch pattern phase-04-accounting/{short-task-description} and commit message with task ID are proposals, not mandatory tooling choices. Secrets/real farm data must not enter Git. Update reports/status after evidence; retain known limitations and owners for nonblocking conditions.

PR description leads with concrete problem/result and relevant validation; reviewers unfamiliar with conversation can trace source IDs. Avoid claiming deployment/test completion without logs. [Agent protocol](ai-agent-instructions.md), [definition of done](definition-of-done.md) and [closeout](phase-closeout-template.md) define closure.
