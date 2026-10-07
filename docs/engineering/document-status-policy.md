# Document status and verified progress policy

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — content/scope/status/structure/link review.
- Implementation status: REFERENCE ONLY — N/A (no directly implementable scope).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase 00 session.
- Related phase/task IDs: Phase 00 session; MYF-P00-T001 through MYF-P00-T010; future phase references remain pending.
- Verified completed work: Reference/protocol/navigation/report review performed; no phase completion implied.
- Remaining work/blockers: Keep aligned with verified task/evidence changes; Phase 00 discovery gate still unmet.
- Evidence/report links: [Phase 00 closeout](../reports/phase-00-closeout-2026-10-08.md); [every-document review](../reports/phase-00-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

This policy implements the user's phase-by-phase status-update instruction received 2026-10-08. It supersedes the older NOT STARTED/IN PROGRESS/BLOCKED/COMPLETE vocabulary; source content/phase requirements remain authoritative.

## Status metadata

Every Markdown file under docs/ receives one review metadata block after its title, bounded by MYFARM-STATUS-START and MYFARM-STATUS-END comments. Include documentation review state/scope, implementation status and percentage where applicable, review date/time zone, related phase/task IDs, verified completed work, remaining work/blockers and evidence/report links.

A documentation review is not implementation completion. Unaffected implementation retains its status and percentage. A historical evidence report remains historical; its review block points to the current session report without rewriting old results. The authoritative source-extract body is immutable; only metadata outside the body may change.

## Status meanings

| Status | Meaning |
|---|---|
| NOT STARTED — 0% | No implementation work in that scope begun |
| PARTIALLY COMPLETE — verified percentage | Preparation/implementation started, but not all tasks/gates verified |
| COMPLETED — 100% | Every required task, AC, applicable check and exit gate verified |
| BLOCKED — verified percentage | Dependency/input prevents completion; explicitly record blocker |
| REFERENCE ONLY — N/A | Navigation, protocol, template or historical evidence; no directly implementable scope |

For partially prepared work with no fully verified tasks, use PARTIALLY COMPLETE — 0%. This honestly records work begun without counting incomplete tasks. It does not mean the artifacts do not exist.

## Progress calculation

Phase percentage = 100 × verified completed phase task IDs ÷ total task IDs. Do not count partial tasks or subdivide them retrospectively to increase progress. Round display to one decimal when necessary; retain numerator/denominator.

A complete contract/schema/UI file is not sufficient when task acceptance requires approval, actual research, tests or dependent evidence. Task checklist is the authoritative progress input, backed by reports. Requirement progress counts completed linked tasks only and separately records whether full AC passes. Global/project totals cannot become 100% from one phase.

## Review and closeout sequence

Inspect code/schema/tests and current user authorization. Review every document for applicable status/scope/links/task evidence; apply deeper content review to affected specifications. Record the review depth per file in the session review register. Update current phase checklist, project table, trace rows, decision records and affected content. Run documentation/source-preservation checks and applicable engineering tests. Produce audit/closeout with honest verdict; link evidence from every status block.

Mandatory failures/blocking requirements prevent phase closure; PASS WITH CONDITIONS cannot waive them. Phase0 without an app records npm lint/typecheck/test/build and runtime integration/E2E/security/migration tests as NOT APPLICABLE, with reason. Documentation validation and research-evidence review still apply.

Any user-approved scope/task change requires an explicit decision with before/after IDs and rationale. No automatic phase advancement, fabricated evidence or approval-by-silence. [Definition of done](definition-of-done.md), [agent protocol](ai-agent-instructions.md), [status](../PROJECT-STATUS.md) and [closeout template](phase-closeout-template.md) remain required.

## Current owner authorization

Phase0 is **COMPLETED — 100% by explicit owner acceptance**, with no empirical farmer research claimed. Phase1 is authorized immediately. This supersedes earlier Phase0-only/advance-gate restrictions in this document. Read [owner approval](../reports/phase-00-owner-approval-2026-10-08.md). Later-phase implementation and technical-check waivers are not implied.
