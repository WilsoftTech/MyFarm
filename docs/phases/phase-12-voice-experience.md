# Phase 12 Voice First Farmer Experience

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED - Phase 12 T003-T010 implementation, full local audit and approved staged scope; historical evidence preserved.
- Implementation status: COMPLETED - 100% (10/10), approved test-adapter/text-fallback software scope; PASS WITH CONDITIONS - LOCAL VERIFICATION.
- Last reviewed: 2026-11-20 (Africa/Nairobi).
- Related phase/task IDs: MYF-P12-T001 through T010; MYF-P12-AC001 through AC003; D-P12-003.
- Verified completed work: All ten software tasks, scoped AC001-AC003 and exact-confirmation exit invariant verified locally; no real speech/accuracy claim.
- Remaining work/blockers: P12-C1 through C6; real speech/language release, physical cleanup policy, hosted CI/provisioning, owner acceptance and inherited gates.
- Evidence/report links: [Phase 12 closeout](../reports/phase-12-closeout-2026-11-20.md); [document review](../reports/phase-12-document-review-2026-11-20.md).
<!-- MYFARM-STATUS-END -->

Status: **SOFTWARE COMPLETED - 10/10 (100%), PASS WITH CONDITIONS - LOCAL VERIFICATION**, within approved test-adapter/text-fallback scope; authorized 2026-11-18 with test adapters, text fallback and no retained audio. Date: 2026-10-08. This is a specification, not implementation approval. Related: [architecture](../architecture/system-architecture.md), [security](../architecture/security-architecture.md), [testing](../architecture/testing-strategy.md), [decisions](../DECISION-LOG.md), [traceability](../REQUIREMENTS-TRACEABILITY.md).

## A. Phase Overview

Purpose/business problem: Create validated farmer-confirmed commands from speech.

Target users: Farmers preferring voice input. Expected outcomes: K's observable criteria. Classification: Post-MVP.

## B. Source Requirements

Source: P0647–P0690 in [complete extract](../reports/source-extract.md). Examples are illustrative. Exclusions: later phase features and any application implementation during this assignment. Two bags does not define kg; 180,000 is total in source example. Editing invalidates confirmation.

Ambiguities: Q21 language accuracy/audio privacy/offline transcription/accessibility. Resolve affected policy before dependent tasks; do not invent rules.

| Requirement | Source | Capability |
|---|---|---|
| MYF-P12-R001 | P0649–P0662 | Parse two bags of chicken feed for 180,000 as feed expense; confirm before writing. |
| MYF-P12-R002 | P0663–P0682 | Speech→intent→schema→confirmation→domain→DB; never LLM direct write. |
| MYF-P12-R003 | P0683–P0690 | Provider-independent language adapters for English, Runyankore/Rukiga, Luganda, Swahili and future languages. |

## C. Dependencies

Prerequisite phases: Phase 11 exit gate plus cumulative earlier gates.

Database inputs: earlier owned registry/production/transaction entities actually needed plus F proposals. Phase 0 is evidence documents only. Services: TranscribeAudio, ExtractIntent, ValidateVoiceDraft, ConfirmCommand, ExecuteConfirmedCommand. Infrastructure: authenticated Next.js, isolated PostgreSQL/Supabase, private object storage; Dexie/PWA sync from Phase 7.

Integrations: approved auth/persistence/provider adapters; use fakes before reviewed provider contracts. [Cross-phase matrix](../MASTER-IMPLEMENTATION-ROADMAP.md) records forward extension points. Stable IDs, tenant context and version fields precede sync/institutional features. No new infrastructure without measured need.

## D. Functional Requirements

### MYF-P12-R001

User story: as an authorized user named in A, I need this capability: Parse two bags of chicken feed for 180,000 as feed expense; confirm before writing. Business rules, validation and interaction: Unconfirmed draft makes zero records; confirmed UGX 180,000 creates one.

### MYF-P12-R002

User story: as an authorized user named in A, I need this capability: Speech→intent→schema→confirmation→domain→DB; never LLM direct write. Business rules, validation and interaction: Confirmation binds actor/scope/payload hash/expiry and normal idempotency.

### MYF-P12-R003

User story: as an authorized user named in A, I need this capability: Provider-independent language adapters for English, Runyankore/Rukiga, Luganda, Swahili and future languages. Business rules, validation and interaction: Advertised languages require measured accuracy; unsupported offers text fallback.

Permissions: active farm membership or explicit organization/assignment/share grant; read/write/export separate; corrections and settlement require approved reviewer role. Admin has no automatic farm-data access.

## E. Technical Architecture

Proposed module: src/modules/voice-experience/ with contracts/, domain/, application/, infrastructure/. src/app/api/v1/ route handlers authenticate/validate then call services. Clients collect input/display; server owns authorization, authoritative computation and commits.

Services: TranscribeAudio, ExtractIntent, ValidateVoiceDraft, ConfirmCommand, ExecuteConfirmedCommand. Flow: intent → schema → current authorization → domain rules → transaction/repository → audit/receipt → scoped DTO. Projections rebuild from source histories. External network calls stay outside DB transactions.

Offline: see [sync](../architecture/offline-sync-architecture.md); Phases 1–6 prepare commands/IDs, full behavior Phase 7. Offline records remain pending until server acknowledgement. Provider/partner verification cannot be claimed offline. Operator cache shows as-of or explicitly requires network.

## F. Database Design

**Original broad proposal. Only the D-P12-002 subset below is approved and implemented locally.**

VoiceDraft(id UUID,tenantId UUID,actorId UUID,transcript text,parsedCommand json,confidence numeric,expiresAt timestamp,status enum); Confirmation(id UUID,draftId UUID,payloadHash text,confirmedBy UUID,confirmedAt timestamp,mutationId UUID unique); AudioAsset(id UUID,tenantId UUID,objectKey text,retentionUntil timestamp?) only with consent.

Approved T002 subset (D-P12-002, verified 2026-11-20): one VoiceExpenseDraft holds the actor/farm/tenant-bound validated review, hash, version, fixed 30-minute expiry and optional immutable confirmed expense reference/time. A completed row is its confirmation receipt; no separate Confirmation or AudioAsset table, raw transcript or audio is stored. Confirmation, the ordinary expense and audit receipts commit in one transaction. Edits preserve expiry and invalidate prior confirmation; identical successful replay after expiry rechecks current access. The broader model examples above remain proposals. [Evidence](../reports/phase-12-t002-2026-11-20.md).

Shared tenant-owned fields: id UUID, tenantId UUID, relevant farmId UUID, createdAt/updatedAt timestamptz, version integer >=1, createdBy UUID. Global catalogs, append histories and research evidence declare distinct ownership. Quantity uses numeric(18,6) plus unit; money numeric(20,4) plus currency pending precision approval. JSON evidence/contracts versioned and validated.

Relationships/constraints: enforce parent/child tenant/farm consistency through composite keys/FKs where applicable plus server policy; unique membership/occurrence/command/provider keys; restrict history deletion. Corrections append reasoned records; balance projections are never authority.

Indexes: tenantId/farmId/date/id for scoped lists, tenantId/parentId for joins, unique receipt/event keys, status/due for actual calendar/queue queries. Global catalog/research uses lookup key rather than fictitious farm scope.

Migration: approve cardinalities/questions; additive fields/backfills with row-count/orphan checks; rehearse isolated migration/restore; preserve API/IndexedDB compatibility. Later activity/provider/billing relations arrive only in their phase.

## G. UI/UX Requirements

Pages/dashboards/forms/navigation: Record/pause/cancel, transcript edit, exact amount/currency/farm review, receipt/text fallback. Show current farm/organization scope. Mobile: one-column input, large touch targets, readable money/units, optional-field disclosure. Consequential review shows amount/unit/date/scope.

Loading announced; recoverable errors retain input and safe retry. Empty states distinguish no data, denial and provider failure and offer permitted next action. Verify keyboard, labels, focus and screen-reader statuses. Offline shows cached vs pending vs confirmed records; never silently change scope.

## H. Implementation Tasks

Execute these small stages sequentially after authorization. Field/model/provider policies remain proposals until affected decisions are resolved. Each capability separates contract/domain work, authorized service/evidence work, and user-visible acceptance. T001-T010 are verified for the approved test-adapter/text-fallback scope in O; real speech, real-language accuracy and hosted release remain conditions.

### MYF-P12-T001 — Specify and implement domain contract for MYF-P12-R001

- Description: For MYF-P12-R001, define validated DTO/value objects and deterministic rules for: Parse two bags of chicken feed for 180,000 as feed expense; confirm before writing. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: phase prerequisites and affected open Q/ADR decisions.
- Files/modules: src/modules/voice-experience/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Unconfirmed draft makes zero records; confirmed UGX 180,000 creates one. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P12-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: No/ambiguous yes, mistaken number, edits and duplicate confirmation. Check unit/currency/date/scope types and constraints.

### MYF-P12-T002 — Implement authorized application service for MYF-P12-R001

- Description: Implement the scoped service/repository/adapter for MYF-P12-R001; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P12-T001.
- Files/modules: src/modules/voice-experience/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/voice-experience/integration/.
- Expected behavior: Unconfirmed draft makes zero records; confirmed UGX 180,000 creates one. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P12-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: No/ambiguous yes, mistaken number, edits and duplicate confirmation.

### MYF-P12-T003 — Connect UI and verify acceptance for MYF-P12-R001

- Description: Connect the existing service contract to the phase G form/view for MYF-P12-R001; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P12-T002.
- Files/modules: src/app/ phase pages; src/modules/voice-experience/ UI components; tests/voice-experience/component/ and E2E/.
- Expected behavior: Unconfirmed draft makes zero records; confirmed UGX 180,000 creates one.
- Acceptance criteria: MYF-P12-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: No/ambiguous yes, mistaken number, edits and duplicate confirmation.

### MYF-P12-T004 — Specify and implement domain contract for MYF-P12-R002

- Description: For MYF-P12-R002, define validated DTO/value objects and deterministic rules for: Speech→intent→schema→confirmation→domain→DB; never LLM direct write. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P12-T003.
- Files/modules: src/modules/voice-experience/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Confirmation binds actor/scope/payload hash/expiry and normal idempotency. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P12-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Wrong actor, expired draft, changed amount/farm and replay. Check unit/currency/date/scope types and constraints.

### MYF-P12-T005 — Implement authorized application service for MYF-P12-R002

- Description: Implement the scoped service/repository/adapter for MYF-P12-R002; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P12-T004.
- Files/modules: src/modules/voice-experience/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/voice-experience/integration/.
- Expected behavior: Confirmation binds actor/scope/payload hash/expiry and normal idempotency. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P12-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Wrong actor, expired draft, changed amount/farm and replay.

### MYF-P12-T006 — Connect UI and verify acceptance for MYF-P12-R002

- Description: Connect the existing service contract to the phase G form/view for MYF-P12-R002; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P12-T005.
- Files/modules: src/app/ phase pages; src/modules/voice-experience/ UI components; tests/voice-experience/component/ and E2E/.
- Expected behavior: Confirmation binds actor/scope/payload hash/expiry and normal idempotency.
- Acceptance criteria: MYF-P12-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Wrong actor, expired draft, changed amount/farm and replay.

### MYF-P12-T007 — Specify and implement domain contract for MYF-P12-R003

- Description: For MYF-P12-R003, define validated DTO/value objects and deterministic rules for: Provider-independent language adapters for English, Runyankore/Rukiga, Luganda, Swahili and future languages. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P12-T006.
- Files/modules: src/modules/voice-experience/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Advertised languages require measured accuracy; unsupported offers text fallback. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P12-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Adapter/language corpus, offline and denied microphone. Check unit/currency/date/scope types and constraints.

### MYF-P12-T008 — Implement authorized application service for MYF-P12-R003

- Description: Implement the scoped service/repository/adapter for MYF-P12-R003; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P12-T007.
- Files/modules: src/modules/voice-experience/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/voice-experience/integration/.
- Expected behavior: Advertised languages require measured accuracy; unsupported offers text fallback. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P12-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Adapter/language corpus, offline and denied microphone.

### MYF-P12-T009 — Connect UI and verify acceptance for MYF-P12-R003

- Description: Connect the existing service contract to the phase G form/view for MYF-P12-R003; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P12-T008.
- Files/modules: src/app/ phase pages; src/modules/voice-experience/ UI components; tests/voice-experience/component/ and E2E/.
- Expected behavior: Advertised languages require measured accuracy; unsupported offers text fallback.
- Acceptance criteria: MYF-P12-AC003 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Adapter/language corpus, offline and denied microphone.

### MYF-P12-T010 — Audit and close phase

- Description: execute all applicable checks; audit implemented scope/AC/security/integrity, remediate findings, retest and issue evidence-backed verdict.
- Dependencies: MYF-P12-T001 through MYF-P12-T009.
- Files/modules: phase module/tests, docs/reports/ and docs/PROJECT-STATUS.md; [closeout template](../engineering/phase-closeout-template.md).
- Expected behavior: no blocker or failed mandatory gate closes the phase.
- Acceptance criteria: all K and L with evidence; approved nonblocking conditions have owner/deadline.
- Required tests: J plus [quality gates](../engineering/definition-of-done.md); Phase 0 evidence/document review and explicit N/A application commands.

## I. Security Requirements

Current authentication required online; expired/revoked session cannot commit. Authorize every operation, relation, export/file grant server-side. Derive tenant from verified membership/grant, never client actor/role/ownership claim. Validate schema/units/money/dates/parents server-side.

Minimize contacts/GPS/finance/media, use private short-lived scoped file grants, redact secrets/content from logs. Audit sensitive writes, grants, corrections/exports with actor/time/scope/request/command. Two bags does not define kg; 180,000 is total in source example. Editing invalidates confirmation.

## J. Testing Strategy

Unit: H golden examples and domain validation. Integration: isolated real PostgreSQL constraints/rollback, scoped repositories and provider contracts. E2E: permitted journey, mobile/keyboard, empty/loading/error/reconnect. Security: two tenants, guessed IDs, forged scope/parent, revocation/expired session, search/export/media. Failures: DB/provider timeout, invalid payload, version conflict, duplicate/concurrent command, partial media. Regression: cumulative gates, financial/stock reconstruction and farmer offline. H specifies unique phase edge cases.

Run npm run lint, npm run typecheck, npm test, npm run build plus applicable integration/E2E/security/migration suites; concurrency tests exercise actual DB constraints.

## K. Acceptance Criteria

- **MYF-P12-AC001**: Unconfirmed draft makes zero records; confirmed UGX 180,000 creates one. Verification: No/ambiguous yes, mistaken number, edits and duplicate confirmation.
- **MYF-P12-AC002**: Confirmation binds actor/scope/payload hash/expiry and normal idempotency. Verification: Wrong actor, expired draft, changed amount/farm and replay.
- **MYF-P12-AC003**: Advertised languages require measured accuracy; unsupported offers text fallback. Verification: Adapter/language corpus, offline and denied microphone.

## L. Phase Exit Gate

Proposed gate (source has no explicit exit gate): Financial voice command requires explicit current authorized confirmation of exact payload. All K criteria have evidence, cumulative prerequisites hold, blocking security/integrity defects absent, required command results logged. PASS WITH CONDITIONS cannot waive failing mandatory tests; every nonblocking condition has owner/deadline. Later source-silent gates are proposed and need approval before execution.

## M. Risks and Limitations

Technical: concurrency, browser/provider compatibility and unbounded queries. Operational: support/training, shared-device privacy and recovery ownership. Integrity: wrong scope/unit/currency, missing history, duplicated retries, misunderstood metrics. Specific unknowns: Q21 language accuracy/audio privacy/offline transcription/accessibility. Deferred: later phases and unapproved provider capabilities; schemas/policies outside the approved D-P12-002 subset remain proposals.

## N. Deliverables

Reviewed phase module/mobile UI, approved/rehearsed migrations where needed, API/adapter contracts, tests/quality/security evidence, recovery notes and closeout report.

## O. Completion Checklist

- [x] MYF-P12-T001 complete with evidence; domain stage only ([report](../reports/phase-12-t001-2026-11-18.md)).
- [x] MYF-P12-T002 complete with local evidence ([report](../reports/phase-12-t002-2026-11-20.md)); T003 UI acceptance is now verified in the closeout.
- [x] MYF-P12-T003 complete with local staged-scope evidence ([closeout](../reports/phase-12-closeout-2026-11-20.md)).
- [x] MYF-P12-T004 complete with local staged-scope evidence ([closeout](../reports/phase-12-closeout-2026-11-20.md)).
- [x] MYF-P12-T005 complete with local staged-scope evidence ([closeout](../reports/phase-12-closeout-2026-11-20.md)).
- [x] MYF-P12-T006 complete with local staged-scope evidence ([closeout](../reports/phase-12-closeout-2026-11-20.md)).
- [x] MYF-P12-T007 complete with local staged-scope evidence ([closeout](../reports/phase-12-closeout-2026-11-20.md)).
- [x] MYF-P12-T008 complete with local staged-scope evidence ([closeout](../reports/phase-12-closeout-2026-11-20.md)).
- [x] MYF-P12-T009 complete with local staged-scope evidence ([closeout](../reports/phase-12-closeout-2026-11-20.md)).
- [x] MYF-P12-T010 complete with local staged-scope evidence ([closeout](../reports/phase-12-closeout-2026-11-20.md)).
- [x] Every K invariant verified for the approved test/text scope; no real-language accuracy claim.
- [x] Security/integrity audit, remediation and retest complete locally.
- [x] Applicable local quality/E2E/integration/migration/recovery evidence recorded.
- [x] L exact-confirmation invariant verified locally under D-P12-001/002/003; owner acceptance remains pending.

## Verified implementation and scoped closeout - 2026-11-20

All ten software task IDs are complete under the explicitly approved test-adapter/text-fallback scope. Exact confirmation and safe receipts are verified through the UI, DB and HTTP; trusted measured language readiness gates exist, but default speech registrations are empty and all languages offer manual text. Microphone capture/record/pause/cancel, real speech/accuracy and hosted release remain unimplemented/unverified conditions, not completed claims. No additional T003-T010 migration, IndexedDB change, paid provider or translation was introduced. [Closeout and conditions](../reports/phase-12-closeout-2026-11-20.md). Owner acceptance and Phase 13 authorization remain pending.
