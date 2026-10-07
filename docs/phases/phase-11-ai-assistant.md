# Phase 11 AI Farm Assistant

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — status/applicability/structure/link review; no runtime or independent product validation.
- Implementation status: NOT STARTED — 0% (0/10 verified tasks).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase 00 session.
- Related phase/task IDs: Phase 11; MYF-P11-T001 through MYF-P11-T010; review session Phase 00.
- Verified completed work: No implementation tasks completed; existing specification/status/IDs reviewed only.
- Remaining work/blockers: All 10 implementation tasks pending; prior exit gates and explicit phase authorization required.
- Evidence/report links: [Phase 00 closeout](../reports/phase-00-closeout-2026-10-08.md); [every-document review](../reports/phase-00-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Status: **NOT STARTED**. Date: 2026-10-08. This is a specification, not implementation approval. Related: [architecture](../architecture/system-architecture.md), [security](../architecture/security-architecture.md), [testing](../architecture/testing-strategy.md), [decisions](../DECISION-LOG.md), [traceability](../REQUIREMENTS-TRACEABILITY.md).

## A. Phase Overview

Purpose/business problem: Explain authorized farm evidence through bounded AI retrieval.

Target users: Farmers and permitted managers. Expected outcomes: K's observable criteria. Classification: Post-MVP.

## B. Source Requirements

Source: P0602–P0645 in [complete extract](../reports/source-extract.md). Examples are illustrative. Exclusions: later phase features and any application implementation during this assignment. Prompt/retrieved material untrusted; no DB credentials, unrestricted SQL or writes given to LLM.

Ambiguities: Q20 provider/cost/privacy/retention/knowledge/evaluation criteria. Resolve affected policy before dependent tasks; do not invent rules.

| Requirement | Source | Capability |
|---|---|---|
| MYF-P11-R001 | P0604–P0624 | Intent→authorization→farm retrieval→deterministic calculation→knowledge→LLM explanation. |
| MYF-P11-R002 | P0625–P0633 | Ask records, explain profit, compare seasons, summarize, identify unusual costs, explain tasks and generate reports. |
| MYF-P11-R003 | P0634–P0645 | Distinguish FACT, INFERENCE, RECOMMENDATION, UNCERTAINTY. |

## C. Dependencies

Prerequisite phases: Phase 10 exit gate plus cumulative earlier gates.

Database inputs: earlier owned registry/production/transaction entities actually needed plus F proposals. Phase 0 is evidence documents only. Services: DetectIntent, RetrieveAuthorizedFarmContext, RunMetricTool, RetrieveKnowledge, ExplainWithLLM. Infrastructure: authenticated Next.js, isolated PostgreSQL/Neon, private object storage; Dexie/PWA sync from Phase 7.

Integrations: approved auth/persistence/provider adapters; use fakes before reviewed provider contracts. [Cross-phase matrix](../MASTER-IMPLEMENTATION-ROADMAP.md) records forward extension points. Stable IDs, tenant context and version fields precede sync/institutional features. No new infrastructure without measured need.

## D. Functional Requirements

### MYF-P11-R001

User story: as an authorized user named in A, I need this capability: Intent→authorization→farm retrieval→deterministic calculation→knowledge→LLM explanation. Business rules, validation and interaction: Highest-profit answer cites exact period/scope/result; missing evidence yields no conclusion.

### MYF-P11-R002

User story: as an authorized user named in A, I need this capability: Ask records, explain profit, compare seasons, summarize, identify unusual costs, explain tasks and generate reports. Business rules, validation and interaction: Seven intents have bounded read-only contracts and report provenance.

### MYF-P11-R003

User story: as an authorized user named in A, I need this capability: Distinguish FACT, INFERENCE, RECOMMENDATION, UNCERTAINTY. Business rules, validation and interaction: Factual values match evidence; agronomic uncertainty explicitly labeled.

Permissions: active farm membership or explicit organization/assignment/share grant; read/write/export separate; corrections and settlement require approved reviewer role. Admin has no automatic farm-data access.

## E. Technical Architecture

Proposed module: src/modules/ai-assistant/ with contracts/, domain/, application/, infrastructure/. src/app/api/v1/ route handlers authenticate/validate then call services. Clients collect input/display; server owns authorization, authoritative computation and commits.

Services: DetectIntent, RetrieveAuthorizedFarmContext, RunMetricTool, RetrieveKnowledge, ExplainWithLLM. Flow: intent → schema → current authorization → domain rules → transaction/repository → audit/receipt → scoped DTO. Projections rebuild from source histories. External network calls stay outside DB transactions.

Offline: see [sync](../architecture/offline-sync-architecture.md); Phases 1–6 prepare commands/IDs, full behavior Phase 7. Offline records remain pending until server acknowledgement. Provider/partner verification cannot be claimed offline. Operator cache shows as-of or explicitly requires network.

## F. Database Design

**Proposal until implementation approval. No migrations created now.**

AssistantConversation(id UUID,tenantId UUID,actorId UUID,retentionUntil timestamp); AssistantMessage(id UUID,conversationId UUID,role enum,content text,evidenceRefs json,modelVersion text?); KnowledgeDocument(id UUID,sourceUrl text,reviewedAt timestamp,region text,language text); AIUsage(id UUID,tenantId UUID,provider text,tokens integer,costEstimate numeric).

Shared tenant-owned fields: id UUID, tenantId UUID, relevant farmId UUID, createdAt/updatedAt timestamptz, version integer >=1, createdBy UUID. Global catalogs, append histories and research evidence declare distinct ownership. Quantity uses numeric(18,6) plus unit; money numeric(20,4) plus currency pending precision approval. JSON evidence/contracts versioned and validated.

Relationships/constraints: enforce parent/child tenant/farm consistency through composite keys/FKs where applicable plus server policy; unique membership/occurrence/command/provider keys; restrict history deletion. Corrections append reasoned records; balance projections are never authority.

Indexes: tenantId/farmId/date/id for scoped lists, tenantId/parentId for joins, unique receipt/event keys, status/due for actual calendar/queue queries. Global catalog/research uses lookup key rather than fictitious farm scope.

Migration: approve cardinalities/questions; additive fields/backfills with row-count/orphan checks; rehearse isolated migration/restore; preserve API/IndexedDB compatibility. Later activity/provider/billing relations arrive only in their phase.

## G. UI/UX Requirements

Pages/dashboards/forms/navigation: Question chat, scope selector, evidence/answer labels, uncertainty and reports. Show current farm/organization scope. Mobile: one-column input, large touch targets, readable money/units, optional-field disclosure. Consequential review shows amount/unit/date/scope.

Loading announced; recoverable errors retain input and safe retry. Empty states distinguish no data, denial and provider failure and offer permitted next action. Verify keyboard, labels, focus and screen-reader statuses. Offline shows cached vs pending vs confirmed records; never silently change scope.

## H. Implementation Tasks

Execute these small stages sequentially after authorization. Field/model/provider policies remain proposals until affected decisions are resolved. Each capability separates contract/domain work, authorized service/evidence work, and user-visible acceptance. All task IDs remain pending.

### MYF-P11-T001 — Specify and implement domain contract for MYF-P11-R001

- Description: For MYF-P11-R001, define validated DTO/value objects and deterministic rules for: Intent→authorization→farm retrieval→deterministic calculation→knowledge→LLM explanation. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: phase prerequisites and affected open Q/ADR decisions.
- Files/modules: src/modules/ai-assistant/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Highest-profit answer cites exact period/scope/result; missing evidence yields no conclusion. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P11-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Two-tenant retrieval, prompt injection, fake scope and numeric mismatch. Check unit/currency/date/scope types and constraints.

### MYF-P11-T002 — Implement authorized application service for MYF-P11-R001

- Description: Implement the scoped service/repository/adapter for MYF-P11-R001; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P11-T001.
- Files/modules: src/modules/ai-assistant/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/ai-assistant/integration/.
- Expected behavior: Highest-profit answer cites exact period/scope/result; missing evidence yields no conclusion. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P11-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Two-tenant retrieval, prompt injection, fake scope and numeric mismatch.

### MYF-P11-T003 — Connect UI and verify acceptance for MYF-P11-R001

- Description: Connect the existing service contract to the phase G form/view for MYF-P11-R001; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P11-T002.
- Files/modules: src/app/ phase pages; src/modules/ai-assistant/ UI components; tests/ai-assistant/component/ and E2E/.
- Expected behavior: Highest-profit answer cites exact period/scope/result; missing evidence yields no conclusion.
- Acceptance criteria: MYF-P11-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Two-tenant retrieval, prompt injection, fake scope and numeric mismatch.

### MYF-P11-T004 — Specify and implement domain contract for MYF-P11-R002

- Description: For MYF-P11-R002, define validated DTO/value objects and deterministic rules for: Ask records, explain profit, compare seasons, summarize, identify unusual costs, explain tasks and generate reports. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P11-T003.
- Files/modules: src/modules/ai-assistant/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Seven intents have bounded read-only contracts and report provenance. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P11-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Seven-intent corpus, stale context, denied exports and provider outage. Check unit/currency/date/scope types and constraints.

### MYF-P11-T005 — Implement authorized application service for MYF-P11-R002

- Description: Implement the scoped service/repository/adapter for MYF-P11-R002; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P11-T004.
- Files/modules: src/modules/ai-assistant/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/ai-assistant/integration/.
- Expected behavior: Seven intents have bounded read-only contracts and report provenance. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P11-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Seven-intent corpus, stale context, denied exports and provider outage.

### MYF-P11-T006 — Connect UI and verify acceptance for MYF-P11-R002

- Description: Connect the existing service contract to the phase G form/view for MYF-P11-R002; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P11-T005.
- Files/modules: src/app/ phase pages; src/modules/ai-assistant/ UI components; tests/ai-assistant/component/ and E2E/.
- Expected behavior: Seven intents have bounded read-only contracts and report provenance.
- Acceptance criteria: MYF-P11-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Seven-intent corpus, stale context, denied exports and provider outage.

### MYF-P11-T007 — Specify and implement domain contract for MYF-P11-R003

- Description: For MYF-P11-R003, define validated DTO/value objects and deterministic rules for: Distinguish FACT, INFERENCE, RECOMMENDATION, UNCERTAINTY. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P11-T006.
- Files/modules: src/modules/ai-assistant/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Factual values match evidence; agronomic uncertainty explicitly labeled. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P11-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Groundedness, contradictory sources and unsafe-certainty evaluation. Check unit/currency/date/scope types and constraints.

### MYF-P11-T008 — Implement authorized application service for MYF-P11-R003

- Description: Implement the scoped service/repository/adapter for MYF-P11-R003; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P11-T007.
- Files/modules: src/modules/ai-assistant/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/ai-assistant/integration/.
- Expected behavior: Factual values match evidence; agronomic uncertainty explicitly labeled. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P11-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Groundedness, contradictory sources and unsafe-certainty evaluation.

### MYF-P11-T009 — Connect UI and verify acceptance for MYF-P11-R003

- Description: Connect the existing service contract to the phase G form/view for MYF-P11-R003; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P11-T008.
- Files/modules: src/app/ phase pages; src/modules/ai-assistant/ UI components; tests/ai-assistant/component/ and E2E/.
- Expected behavior: Factual values match evidence; agronomic uncertainty explicitly labeled.
- Acceptance criteria: MYF-P11-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Groundedness, contradictory sources and unsafe-certainty evaluation.

### MYF-P11-T010 — Audit and close phase

- Description: execute all applicable checks; audit implemented scope/AC/security/integrity, remediate findings, retest and issue evidence-backed verdict.
- Dependencies: MYF-P11-T001 through MYF-P11-T009.
- Files/modules: phase module/tests, docs/reports/ and docs/PROJECT-STATUS.md; [closeout template](../engineering/phase-closeout-template.md).
- Expected behavior: no blocker or failed mandatory gate closes the phase.
- Acceptance criteria: all K and L with evidence; approved nonblocking conditions have owner/deadline.
- Required tests: J plus [quality gates](../engineering/definition-of-done.md); Phase 0 evidence/document review and explicit N/A application commands.

## I. Security Requirements

Current authentication required online; expired/revoked session cannot commit. Authorize every operation, relation, export/file grant server-side. Derive tenant from verified membership/grant, never client actor/role/ownership claim. Validate schema/units/money/dates/parents server-side.

Minimize contacts/GPS/finance/media, use private short-lived scoped file grants, redact secrets/content from logs. Audit sensitive writes, grants, corrections/exports with actor/time/scope/request/command. Prompt/retrieved material untrusted; no DB credentials, unrestricted SQL or writes given to LLM.

## J. Testing Strategy

Unit: H golden examples and domain validation. Integration: isolated real PostgreSQL constraints/rollback, scoped repositories and provider contracts. E2E: permitted journey, mobile/keyboard, empty/loading/error/reconnect. Security: two tenants, guessed IDs, forged scope/parent, revocation/expired session, search/export/media. Failures: DB/provider timeout, invalid payload, version conflict, duplicate/concurrent command, partial media. Regression: cumulative gates, financial/stock reconstruction and farmer offline. H specifies unique phase edge cases.

Run npm run lint, npm run typecheck, npm test, npm run build plus applicable integration/E2E/security/migration suites; concurrency tests exercise actual DB constraints.

## K. Acceptance Criteria

- **MYF-P11-AC001**: Highest-profit answer cites exact period/scope/result; missing evidence yields no conclusion. Verification: Two-tenant retrieval, prompt injection, fake scope and numeric mismatch.
- **MYF-P11-AC002**: Seven intents have bounded read-only contracts and report provenance. Verification: Seven-intent corpus, stale context, denied exports and provider outage.
- **MYF-P11-AC003**: Factual values match evidence; agronomic uncertainty explicitly labeled. Verification: Groundedness, contradictory sources and unsafe-certainty evaluation.

## L. Phase Exit Gate

Farm answers ground in authorized real records; no invented financial/operational values or cross-farm disclosure. All K criteria have evidence, cumulative prerequisites hold, blocking security/integrity defects absent, required command results logged. PASS WITH CONDITIONS cannot waive failing mandatory tests; every nonblocking condition has owner/deadline. Later source-silent gates are proposed and need approval before execution.

## M. Risks and Limitations

Technical: concurrency, browser/provider compatibility and unbounded queries. Operational: support/training, shared-device privacy and recovery ownership. Integrity: wrong scope/unit/currency, missing history, duplicated retries, misunderstood metrics. Specific unknowns: Q20 provider/cost/privacy/retention/knowledge/evaluation criteria. Deferred: later phases and unapproved provider capabilities; schemas/policies remain proposals.

## N. Deliverables

Reviewed phase module/mobile UI, approved/rehearsed migrations where needed, API/adapter contracts, tests/quality/security evidence, recovery notes and closeout report.

## O. Completion Checklist

- [ ] MYF-P11-T001 complete with evidence.
- [ ] MYF-P11-T002 complete with evidence.
- [ ] MYF-P11-T003 complete with evidence.
- [ ] MYF-P11-T004 complete with evidence.
- [ ] MYF-P11-T005 complete with evidence.
- [ ] MYF-P11-T006 complete with evidence.
- [ ] MYF-P11-T007 complete with evidence.
- [ ] MYF-P11-T008 complete with evidence.
- [ ] MYF-P11-T009 complete with evidence.
- [ ] MYF-P11-T010 complete with evidence.
- [ ] Every K criterion verified.
- [ ] Security/integrity audit, remediation and retest complete.
- [ ] Applicable quality/E2E/integration/migration evidence recorded.
- [ ] L gate approved; closeout/status updated from evidence.
