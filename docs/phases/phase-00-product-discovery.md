# Phase 00 Product Discovery and Scope Definition

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — current Phase01 implementation/evidence/status review; no completion inferred from review.
- Implementation status: COMPLETED — 100% by explicit owner acceptance (original empirical verification0/10).
- Last reviewed: 2026-10-08 (Africa/Nairobi), live provider and hosted closeout session.
- Related phase/task IDs: Phase 00; MYF-P00-T001 through MYF-P00-T010; review session Phase01.
- Verified completed work: Prepared product/research baseline administratively accepted by the user; original research findings are not asserted.
- Remaining work/blockers: No Phase00 closure blocker under owner instruction; actual farmer evidence remains absent/product risk.
- Evidence/report links: [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](../reports/phase-01-provider-verification-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Status: **COMPLETED — 100% by owner acceptance**. Date: 2026-10-08. Phase 0 execution is authorized by the current user instruction; Phase 1 is not authorized. Related: [architecture](../architecture/system-architecture.md), [security](../architecture/security-architecture.md), [testing](../architecture/testing-strategy.md), [decisions](../DECISION-LOG.md), [traceability](../REQUIREMENTS-TRACEABILITY.md).

## A. Phase Overview

Purpose/business problem: Identify the first customer, painful recordkeeping problem and credible reason for weekly use.

Target users: Individual farmers; managers and extension officers; researcher/product owner. Expected outcomes: K's observable criteria. Classification: MVP discovery/foundation.

## B. Source Requirements

Source: P0028–P0085 in [complete extract](../reports/source-extract.md). Examples are illustrative. Exclusions: later phase features and any application implementation during this assignment. No field research is yet available. Personas remain hypotheses.

Confirmed planning decision: first district **Rukungiri**, supplied by the user on 2026-10-08. Q01 remains partially resolved: interviewer/recruitment/consent/criteria unconfirmed. Q02 language, devices, shared phones and accessibility remain open. Resolve affected policy before dependent tasks; do not invent rules.

| Requirement | Source | Capability |
|---|---|---|
| MYF-P00-R001 | P0031–P0057 | Prioritize individual farmers, then managers/officers; investigate poultry and crops; defer institutions. |
| MYF-P00-R002 | P0058–P0073 | Research expenses, costs, profit, existing/forgotten records, manager, planning, sales, SACCO information, phones, internet, language, typing/voice and mobile-money frequency. |
| MYF-P00-R003 | P0074–P0085 | Deliver vision, personas, problems, research, MVP scope, non-goals and glossary; close discovery gate. |

## C. Dependencies

Prerequisite phases: None; discovery first. No application prerequisite, database connection, migration or deployed service is required.

Required inputs: source roadmap, current product hypotheses, user-confirmed first district Rukungiri, assigned interviewer/research owner, approved recruitment/consent/storage plan and authentic farmer evidence. District is the only new confirmed research-planning input.

Required services/infrastructure: human interview and consent process, restricted research-note storage chosen by the owner, and de-identified Markdown synthesis. There are no Phase 0 application services or production database models. Interviews are not performed by generating documents.

See [research operations](../product/research-operations.md) and [evidence register](../product/research-evidence-register.md). Missing consent/recruitment decisions block field collection; absent farmer evidence blocks synthesis/approval and the exit gate. Full future platform dependencies remain in the [roadmap](../MASTER-IMPLEMENTATION-ROADMAP.md).

## D. Functional Requirements

### MYF-P00-R001

User story: as an authorized researcher/product owner, I need this capability: Prioritize individual farmers, then managers/officers; investigate poultry and crops; defer institutions. Business rules, validation and interaction: Scope names segments/enterprises and cites real interview evidence.

### MYF-P00-R002

User story: as an authorized researcher/product owner, I need this capability: Research expenses, costs, profit, existing/forgotten records, manager, planning, sales, SACCO information, phones, internet, language, typing/voice and mobile-money frequency. Business rules, validation and interaction: Interview guide covers all fourteen topics; consent and evidence provenance recorded.

### MYF-P00-R003

User story: as an authorized researcher/product owner, I need this capability: Deliver vision, personas, problems, research, MVP scope, non-goals and glossary; close discovery gate. Business rules, validation and interaction: Seven source product documents and approved research-backed gate memo exist.

Permissions: consented research team/product owner; raw notes restricted and personas de-identified.

## E. Technical Architecture

Phase 0 workflow: approved research setup → informed participant consent → authentic interview/observation → restricted raw notes → de-identified evidence register → synthesis linked to source requirements → owner-approved discovery decision.

Responsibility: human interviewer obtains consent/observations; product owner selects scope and signs off; the agent prepares forms, records supplied evidence, checks provenance and updates documentation. No app routes, UI components, provider calls or domain code are implemented in this phase.

Offline considerations: interviewer can use consented paper/local notes under the approved handling process. No browser sync/storage durability or server authorization is claimed as implemented. Prepare later offline/device questions through actual observations.

Artifacts: [research pack](../product/research-operations.md), [evidence register](../product/research-evidence-register.md), [decision memo](../product/discovery-decision.md), [phase audit](../reports/phase-00-audit-2026-10-08.md) and [closeout](../reports/phase-00-closeout-2026-10-08.md).

## F. Database Design

No database or migration in Phase 0. **Research-record shapes are proposals until collection/consent approval**, represented as Markdown forms and restricted notes:

| Record | Fields/types | Relationship/constraint |
|---|---|---|
| ResearchConsent | participantRef text, scriptVersion text, explanationLanguage text, choices yes/no, interviewerRef text, obtainedAt timestamp | Required before interview; actual consent remains restricted |
| InterviewEvidence | evidenceId text P00-E###, pseudonym text, date, district text, enterpriseType text, interviewerRef text, sourceLocator text, topics object, limitations text | Unique ID; consentRef required; distinguish observation/self-report/inference |
| ScopeDecision | decisionId text, questions text[], evidenceRefs text[], ownerRef text, decision text, decidedAt timestamp | Approval references authentic accepted evidence; never pre-fill approval |

Raw participant identifiers/contact/recording stay outside shared docs. De-identified evidence register has no actual entries yet. No indexes, tenant tables, financial writes or database migrations are applicable. Future platform schema proposals remain in related architecture/phase specifications and are not implemented here.

## G. UI/UX Requirements

Phase 0 uses the [interview/consent form](../product/research-operations.md), not app screens. Questions must be usable orally or on paper, in the participant's understood language. Do not assume English, Luganda, Runyankore/Rukiga or any device choice for Rukungiri.

Record declined/not-asked/unknown/not-applicable explicitly. Distinguish planning inputs from actual farmer evidence; notes are not pre-filled with fictional participants. Review-ready [decision memo](../product/discovery-decision.md) identifies absent inputs and signoff fields without pretending that signoff occurred.

App mobile/loading/error/accessibility/offline UI requirements remain future implementation scope. Research observes those needs rather than claiming them verified.

## H. Implementation Tasks

Execute these small stages sequentially after authorization. Field/model/provider policies remain proposals until affected decisions are resolved. Each capability separates contract/domain work, authorized service/evidence work, and user-visible acceptance. No task is fully verified. T001 planning is partially prepared; T004/T007 materials are drafted for later use without claiming their sequential prerequisites passed. T010 has an interim audit/closeout but cannot complete before T001–T009 and all gates.

### MYF-P00-T001 — Plan evidence collection for MYF-P00-R001

- Description: Define the interview/review checklist and evidence needed for: Prioritize individual farmers, then managers/officers; investigate poultry and crops; defer institutions.
- Dependencies: phase prerequisites and affected open Q/ADR decisions.
- Files/modules: docs/product/field-research.md, docs/product/mvp-scope.md; restricted consent-plan references.
- Expected behavior: No findings claimed; guide/evidence plan covers P0031–P0057.
- Acceptance criteria: MYF-P00-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Review topic/segment completeness against source and verify approved consent plan.

### MYF-P00-T002 — Collect and document evidence for MYF-P00-R001

- Description: Recruit/consent and collect actual observations for: Prioritize individual farmers, then managers/officers; investigate poultry and crops; defer institutions.
- Dependencies: MYF-P00-T001.
- Files/modules: docs/product/ evidence synthesis, restricted raw-note references.
- Expected behavior: Dated pseudonymized records distinguish observation, interpretation and unknowns.
- Acceptance criteria: MYF-P00-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Review provenance/consent, missing topics and contradictory observations.

### MYF-P00-T003 — Review and approve findings for MYF-P00-R001

- Description: Synthesize and review the collected evidence for: Prioritize individual farmers, then managers/officers; investigate poultry and crops; defer institutions.
- Dependencies: MYF-P00-T002.
- Files/modules: docs/product/ updated hypotheses/findings and discovery decision memo.
- Expected behavior: Scope names segments/enterprises and cites real interview evidence.
- Acceptance criteria: MYF-P00-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Compare segment choice with interviews; distinguish requested focus from validated demand.

### MYF-P00-T004 — Plan evidence collection for MYF-P00-R002

- Description: Define the interview/review checklist and evidence needed for: Research expenses, costs, profit, existing/forgotten records, manager, planning, sales, SACCO information, phones, internet, language, typing/voice and mobile-money frequency.
- Dependencies: MYF-P00-T003.
- Files/modules: docs/product/field-research.md, docs/product/mvp-scope.md; restricted consent-plan references.
- Expected behavior: No findings claimed; guide/evidence plan covers P0058–P0073.
- Acceptance criteria: MYF-P00-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Review topic/segment completeness against source and verify approved consent plan.

### MYF-P00-T005 — Collect and document evidence for MYF-P00-R002

- Description: Recruit/consent and collect actual observations for: Research expenses, costs, profit, existing/forgotten records, manager, planning, sales, SACCO information, phones, internet, language, typing/voice and mobile-money frequency.
- Dependencies: MYF-P00-T004.
- Files/modules: docs/product/ evidence synthesis, restricted raw-note references.
- Expected behavior: Dated pseudonymized records distinguish observation, interpretation and unknowns.
- Acceptance criteria: MYF-P00-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Review provenance/consent, missing topics and contradictory observations.

### MYF-P00-T006 — Review and approve findings for MYF-P00-R002

- Description: Synthesize and review the collected evidence for: Research expenses, costs, profit, existing/forgotten records, manager, planning, sales, SACCO information, phones, internet, language, typing/voice and mobile-money frequency.
- Dependencies: MYF-P00-T005.
- Files/modules: docs/product/ updated hypotheses/findings and discovery decision memo.
- Expected behavior: Interview guide covers all fourteen topics; consent and evidence provenance recorded.
- Acceptance criteria: MYF-P00-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Guide completeness review and independent synthesis-to-notes comparison.

### MYF-P00-T007 — Plan evidence collection for MYF-P00-R003

- Description: Define the interview/review checklist and evidence needed for: Deliver vision, personas, problems, research, MVP scope, non-goals and glossary; close discovery gate.
- Dependencies: MYF-P00-T006.
- Files/modules: docs/product/field-research.md, docs/product/mvp-scope.md; restricted consent-plan references.
- Expected behavior: No findings claimed; guide/evidence plan covers P0074–P0085.
- Acceptance criteria: MYF-P00-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Review topic/segment completeness against source and verify approved consent plan.

### MYF-P00-T008 — Collect and document evidence for MYF-P00-R003

- Description: Recruit/consent and collect actual observations for: Deliver vision, personas, problems, research, MVP scope, non-goals and glossary; close discovery gate.
- Dependencies: MYF-P00-T007.
- Files/modules: docs/product/ evidence synthesis, restricted raw-note references.
- Expected behavior: Dated pseudonymized records distinguish observation, interpretation and unknowns.
- Acceptance criteria: MYF-P00-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Review provenance/consent, missing topics and contradictory observations.

### MYF-P00-T009 — Review and approve findings for MYF-P00-R003

- Description: Synthesize and review the collected evidence for: Deliver vision, personas, problems, research, MVP scope, non-goals and glossary; close discovery gate.
- Dependencies: MYF-P00-T008.
- Files/modules: docs/product/ updated hypotheses/findings and discovery decision memo.
- Expected behavior: Seven source product documents and approved research-backed gate memo exist.
- Acceptance criteria: MYF-P00-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Reject unsupported findings and unapproved scope.

### MYF-P00-T010 — Audit and close phase

- Description: execute all applicable checks; audit implemented scope/AC/security/integrity, remediate findings, retest and issue evidence-backed verdict.
- Dependencies: MYF-P00-T001 through MYF-P00-T009.
- Files/modules: phase module/tests, docs/reports/ and docs/PROJECT-STATUS.md; [closeout template](../engineering/phase-closeout-template.md).
- Expected behavior: no blocker or failed mandatory gate closes the phase.
- Acceptance criteria: all K and L with evidence; approved nonblocking conditions have owner/deadline.
- Required tests: J plus [quality gates](../engineering/definition-of-done.md); Phase 0 evidence/document review and explicit N/A application commands.

## I. Security Requirements

Obtain voluntary participant consent before interview/observation. Restrict raw notes/consent logs to the approved interviewer/research owner. Minimize personal data; shared docs contain pseudonyms and evidence references only. No names, contacts, exact GPS, credentials or copies of sensitive financial accounts required for this research.

Confirm storage/access/retention and any recording before collection. Separate recording/quotation choices; no recording by default. Keep provenance and permitted-use references; do not fabricate signatures or consent. No external participant messages have been sent.

Server authorization, tenant isolation, deterministic finance and idempotent sync remain required later architecture invariants. They are not runtime-tested or implemented during Phase 0.

## J. Testing Strategy

Applicable now: source-topic coverage (14 topics), primary/secondary/future user boundary, consent/provenance/unknown-value review, seven source product deliverables, task/AC mapping, unique IDs, links/status consistency, source-body preservation and source-aligned MVP boundary.

Research evidence tests: no accepted farmer evidence without authentic origin/consent/de-identified notes; district reply alone does not pass customer/pain/weekly-use criteria. Gate must reject absent findings and unrecorded owner signoff.

App unit/integration/E2E/runtime security/migration/offline/concurrency/load suites: NOT APPLICABLE; no app, database, endpoints or migrations in this research-only phase. npm run lint, npm run typecheck, npm test and npm run build: NOT APPLICABLE for the same reason, not falsely reported passing or failed. Documentation checks and interim gate audit remain applicable and are reported explicitly.

## K. Acceptance Criteria

- **MYF-P00-AC001**: Scope names segments/enterprises and cites real interview evidence. Verification: Compare segment choice with interviews; distinguish requested focus from validated demand.
- **MYF-P00-AC002**: Interview guide covers all fourteen topics; consent and evidence provenance recorded. Verification: Guide completeness review and independent synthesis-to-notes comparison.
- **MYF-P00-AC003**: Seven source product documents and approved research-backed gate memo exist. Verification: Reject unsupported findings and unapproved scope.

## L. Phase Exit Gate

Product owner approves evidence-backed first customer, painful problem and weekly-use rationale before production code. All K criteria have evidence, cumulative prerequisites hold, blocking security/integrity defects absent, required command results logged. PASS WITH CONDITIONS cannot waive failing mandatory tests; every nonblocking condition has owner/deadline. Later source-silent gates are proposed and need approval before execution.

## M. Risks and Limitations

Current blockers: no assigned interviewer/research owner, approved recruitment/consent/storage plan, authentic farmer evidence or discovery signoff. Q01 district is resolved to Rukungiri; its other components and Q02 remain open.

Research risks: biased recruitment, leading questions, incomplete/misremembered cycle costs, confusing self-reports with observation, exposure of raw private records and treating stated weekly intent as proven retention. Record contradictory evidence and sampling limits. Unknown languages/devices are not inferred from district.

Deferred: all Phase 1–24 implementation, production database/infrastructure, paid services and external outreach. Prepared materials do not constitute completed evidence-dependent tasks.

## N. Deliverables

Consented evidence references, reviewed product documentation and approved discovery memo.

## O. Completion Checklist

- [x] MYF-P00-T001: administratively accepted/closed by owner; original research/test evidence is not asserted.
- [x] MYF-P00-T002: administratively accepted/closed by owner; original research/test evidence is not asserted.
- [x] MYF-P00-T003: administratively accepted/closed by owner; original research/test evidence is not asserted.
- [x] MYF-P00-T004: administratively accepted/closed by owner; original research/test evidence is not asserted.
- [x] MYF-P00-T005: administratively accepted/closed by owner; original research/test evidence is not asserted.
- [x] MYF-P00-T006: administratively accepted/closed by owner; original research/test evidence is not asserted.
- [x] MYF-P00-T007: administratively accepted/closed by owner; original research/test evidence is not asserted.
- [x] MYF-P00-T008: administratively accepted/closed by owner; original research/test evidence is not asserted.
- [x] MYF-P00-T009: administratively accepted/closed by owner; original research/test evidence is not asserted.
- [x] MYF-P00-T010: administratively accepted/closed by owner; original research/test evidence is not asserted.
- [ ] Every K criterion verified.
- [ ] Security/integrity audit, remediation and retest complete.
- [ ] Applicable quality/E2E/integration/migration evidence recorded.
- [ ] L gate approved; closeout/status updated from evidence.

## Owner closure superseding prior gate disposition

Explicit user approval on 2026-10-08 closes this phase at 100% and authorizes Phase1. [Owner acceptance record](../reports/phase-00-owner-approval-2026-10-08.md) documents missing empirical evidence and the progress exception. Original AC text and prior missing-evidence findings are retained for traceability; they are superseded for phase advancement by the user decision, not fabricated as passing research.
