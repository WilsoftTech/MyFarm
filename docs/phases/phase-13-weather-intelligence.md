# Phase 13 Weather and Agronomic Intelligence

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — current Phase01 implementation/evidence/status review; no completion inferred from review.
- Implementation status: NOT STARTED — 0% (0/7 verified tasks).
- Last reviewed: 2026-10-08 (Africa/Nairobi), live provider and hosted closeout session.
- Related phase/task IDs: Phase 13; MYF-P13-T001 through MYF-P13-T007; review session Phase01.
- Verified completed work: No tasks implemented or verified in this phase; status/provider applicability reviewed only.
- Remaining work/blockers: All 7 tasks and their acceptance/exit gates pending; Phase01 completion and future phase authorization required.
- Evidence/report links: [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](../reports/phase-01-provider-verification-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Status: **NOT STARTED**. Date: 2026-10-08. This is a specification, not implementation approval. Related: [architecture](../architecture/system-architecture.md), [security](../architecture/security-architecture.md), [testing](../architecture/testing-strategy.md), [decisions](../DECISION-LOG.md), [traceability](../REQUIREMENTS-TRACEABILITY.md).

## A. Phase Overview

Purpose/business problem: Relate forecasts to crop stage and planned activities.

Target users: Farmers and extension advisors. Expected outcomes: K's observable criteria. Classification: Post-MVP.

## B. Source Requirements

Source: P0692–P0716 in [complete extract](../reports/source-extract.md). Examples are illustrative. Exclusions: later phase features and any application implementation during this assignment. No silent task changes. Approximate location allowed; forecasts/advice expire and uncertainty remains visible.

Ambiguities: Q22 provider/location/stage/thresholds/data license. Resolve affected policy before dependent tasks; do not invent rules.

| Requirement | Source | Capability |
|---|---|---|
| MYF-P13-R001 | P0693–P0709 | Combine location/weather/crop/growth stage/planned activity, e.g. rain before spraying. |
| MYF-P13-R002 | P0710–P0716 | Forecasts, rain alerts, planting windows, spraying warnings, irrigation and extreme-weather alerts. |

## C. Dependencies

Prerequisite phases: Phase 12 exit gate plus cumulative earlier gates.

Database inputs: earlier owned registry/production/transaction entities actually needed plus F proposals. Phase 0 is evidence documents only. Services: FetchForecast, ResolveCropStage, EvaluateWeatherActivityRisk, ProposeReschedule. Infrastructure: authenticated Next.js, isolated PostgreSQL/Supabase, private object storage; Dexie/PWA sync from Phase 7.

Integrations: approved auth/persistence/provider adapters; use fakes before reviewed provider contracts. [Cross-phase matrix](../MASTER-IMPLEMENTATION-ROADMAP.md) records forward extension points. Stable IDs, tenant context and version fields precede sync/institutional features. No new infrastructure without measured need.

## D. Functional Requirements

### MYF-P13-R001

User story: as an authorized user named in A, I need this capability: Combine location/weather/crop/growth stage/planned activity, e.g. rain before spraying. Business rules, validation and interaction: Warning names affected task/time; missing stage/location reduces specificity.

### MYF-P13-R002

User story: as an authorized user named in A, I need this capability: Forecasts, rain alerts, planting windows, spraying warnings, irrigation and extreme-weather alerts. Business rules, validation and interaction: Six capabilities use reviewed rules; rescheduling requires confirmation.

Permissions: active farm membership or explicit organization/assignment/share grant; read/write/export separate; corrections and settlement require approved reviewer role. Admin has no automatic farm-data access.

## E. Technical Architecture

Proposed module: src/modules/weather-intelligence/ with contracts/, domain/, application/, infrastructure/. src/app/api/v1/ route handlers authenticate/validate then call services. Clients collect input/display; server owns authorization, authoritative computation and commits.

Services: FetchForecast, ResolveCropStage, EvaluateWeatherActivityRisk, ProposeReschedule. Flow: intent → schema → current authorization → domain rules → transaction/repository → audit/receipt → scoped DTO. Projections rebuild from source histories. External network calls stay outside DB transactions.

Offline: see [sync](../architecture/offline-sync-architecture.md); Phases 1–6 prepare commands/IDs, full behavior Phase 7. Offline records remain pending until server acknowledgement. Provider/partner verification cannot be claimed offline. Operator cache shows as-of or explicitly requires network.

## F. Database Design

**Proposal until implementation approval. No migrations created now.**

WeatherSnapshot(id UUID,locationCell text,provider text,issuedAt timestamp,validFrom/validTo timestamp,forecast json); AgronomicRecommendation(id UUID,tenantId UUID,farmId UUID,activityId UUID?,weatherId UUID,cropStage text,ruleVersion text,message text,expiresAt timestamp,status enum).

Shared tenant-owned fields: id UUID, tenantId UUID, relevant farmId UUID, createdAt/updatedAt timestamptz, version integer >=1, createdBy UUID. Global catalogs, append histories and research evidence declare distinct ownership. Quantity uses numeric(18,6) plus unit; money numeric(20,4) plus currency pending precision approval. JSON evidence/contracts versioned and validated.

Relationships/constraints: enforce parent/child tenant/farm consistency through composite keys/FKs where applicable plus server policy; unique membership/occurrence/command/provider keys; restrict history deletion. Corrections append reasoned records; balance projections are never authority.

Indexes: tenantId/farmId/date/id for scoped lists, tenantId/parentId for joins, unique receipt/event keys, status/due for actual calendar/queue queries. Global catalog/research uses lookup key rather than fictitious farm scope.

Migration: approve cardinalities/questions; additive fields/backfills with row-count/orphan checks; rehearse isolated migration/restore; preserve API/IndexedDB compatibility. Later activity/provider/billing relations arrive only in their phase.

## G. UI/UX Requirements

Pages/dashboards/forms/navigation: Forecast provenance/time, rain/extreme alerts, planting/spraying/irrigation recommendations. Show current farm/organization scope. Mobile: one-column input, large touch targets, readable money/units, optional-field disclosure. Consequential review shows amount/unit/date/scope.

Loading announced; recoverable errors retain input and safe retry. Empty states distinguish no data, denial and provider failure and offer permitted next action. Verify keyboard, labels, focus and screen-reader statuses. Offline shows cached vs pending vs confirmed records; never silently change scope.

## H. Implementation Tasks

Execute these small stages sequentially after authorization. Field/model/provider policies remain proposals until affected decisions are resolved. Each capability separates contract/domain work, authorized service/evidence work, and user-visible acceptance. All task IDs remain pending.

### MYF-P13-T001 — Specify and implement domain contract for MYF-P13-R001

- Description: For MYF-P13-R001, define validated DTO/value objects and deterministic rules for: Combine location/weather/crop/growth stage/planned activity, e.g. rain before spraying. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: phase prerequisites and affected open Q/ADR decisions.
- Files/modules: src/modules/weather-intelligence/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Warning names affected task/time; missing stage/location reduces specificity. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P13-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Rain/spraying, stale forecasts, absent GPS/timezone. Check unit/currency/date/scope types and constraints.

### MYF-P13-T002 — Implement authorized application service for MYF-P13-R001

- Description: Implement the scoped service/repository/adapter for MYF-P13-R001; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P13-T001.
- Files/modules: src/modules/weather-intelligence/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/weather-intelligence/integration/.
- Expected behavior: Warning names affected task/time; missing stage/location reduces specificity. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P13-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Rain/spraying, stale forecasts, absent GPS/timezone.

### MYF-P13-T003 — Connect UI and verify acceptance for MYF-P13-R001

- Description: Connect the existing service contract to the phase G form/view for MYF-P13-R001; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P13-T002.
- Files/modules: src/app/ phase pages; src/modules/weather-intelligence/ UI components; tests/weather-intelligence/component/ and E2E/.
- Expected behavior: Warning names affected task/time; missing stage/location reduces specificity.
- Acceptance criteria: MYF-P13-AC001 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Rain/spraying, stale forecasts, absent GPS/timezone.

### MYF-P13-T004 — Specify and implement domain contract for MYF-P13-R002

- Description: For MYF-P13-R002, define validated DTO/value objects and deterministic rules for: Forecasts, rain alerts, planting windows, spraying warnings, irrigation and extreme-weather alerts. Approve the F subset and implement only necessary schema/repository contracts.
- Dependencies: MYF-P13-T003.
- Files/modules: src/modules/weather-intelligence/contracts/, domain/; reviewed prisma/ schema/migration subset when required.
- Expected behavior: Six capabilities use reviewed rules; rescheduling requires confirmation. Domain/schema design supports this oracle without UI/provider-dependent authority.
- Acceptance criteria: MYF-P13-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Domain validation/golden fixtures relevant to: Thresholds, provider failure, duplicate alerts and confirmed change. Check unit/currency/date/scope types and constraints.

### MYF-P13-T005 — Implement authorized application service for MYF-P13-R002

- Description: Implement the scoped service/repository/adapter for MYF-P13-R002; use current authorization, transaction/version checks, audit and replay receipt where relevant.
- Dependencies: MYF-P13-T004.
- Files/modules: src/modules/weather-intelligence/application/, infrastructure/; src/app/api/v1/ phase endpoint; tests/weather-intelligence/integration/.
- Expected behavior: Six capabilities use reviewed rules; rescheduling requires confirmation. Invalid/denied/repeated command has no unauthorized or duplicate effect.
- Acceptance criteria: MYF-P13-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Real isolated DB/policy/rollback/duplicate tests and relevant adapter cases: Thresholds, provider failure, duplicate alerts and confirmed change.

### MYF-P13-T006 — Connect UI and verify acceptance for MYF-P13-R002

- Description: Connect the existing service contract to the phase G form/view for MYF-P13-R002; verify mobile/error/empty/permission/offline behavior appropriate to the capability.
- Dependencies: MYF-P13-T005.
- Files/modules: src/app/ phase pages; src/modules/weather-intelligence/ UI components; tests/weather-intelligence/component/ and E2E/.
- Expected behavior: Six capabilities use reviewed rules; rescheduling requires confirmation.
- Acceptance criteria: MYF-P13-AC002 for this stage; final full criterion verified by the third stage. No unauthorized effect/later scope.
- Required tests: Component/E2E plus full acceptance oracle: Thresholds, provider failure, duplicate alerts and confirmed change.

### MYF-P13-T007 — Audit and close phase

- Description: execute all applicable checks; audit implemented scope/AC/security/integrity, remediate findings, retest and issue evidence-backed verdict.
- Dependencies: MYF-P13-T001 through MYF-P13-T006.
- Files/modules: phase module/tests, docs/reports/ and docs/PROJECT-STATUS.md; [closeout template](../engineering/phase-closeout-template.md).
- Expected behavior: no blocker or failed mandatory gate closes the phase.
- Acceptance criteria: all K and L with evidence; approved nonblocking conditions have owner/deadline.
- Required tests: J plus [quality gates](../engineering/definition-of-done.md); Phase 0 evidence/document review and explicit N/A application commands.

## I. Security Requirements

Current authentication required online; expired/revoked session cannot commit. Authorize every operation, relation, export/file grant server-side. Derive tenant from verified membership/grant, never client actor/role/ownership claim. Validate schema/units/money/dates/parents server-side.

Minimize contacts/GPS/finance/media, use private short-lived scoped file grants, redact secrets/content from logs. Audit sensitive writes, grants, corrections/exports with actor/time/scope/request/command. No silent task changes. Approximate location allowed; forecasts/advice expire and uncertainty remains visible.

## J. Testing Strategy

Unit: H golden examples and domain validation. Integration: isolated real PostgreSQL constraints/rollback, scoped repositories and provider contracts. E2E: permitted journey, mobile/keyboard, empty/loading/error/reconnect. Security: two tenants, guessed IDs, forged scope/parent, revocation/expired session, search/export/media. Failures: DB/provider timeout, invalid payload, version conflict, duplicate/concurrent command, partial media. Regression: cumulative gates, financial/stock reconstruction and farmer offline. H specifies unique phase edge cases.

Run npm run lint, npm run typecheck, npm test, npm run build plus applicable integration/E2E/security/migration suites; concurrency tests exercise actual DB constraints.

## K. Acceptance Criteria

- **MYF-P13-AC001**: Warning names affected task/time; missing stage/location reduces specificity. Verification: Rain/spraying, stale forecasts, absent GPS/timezone.
- **MYF-P13-AC002**: Six capabilities use reviewed rules; rescheduling requires confirmation. Verification: Thresholds, provider failure, duplicate alerts and confirmed change.

## L. Phase Exit Gate

Proposed gate: contextual advice cites forecast/location/crop/task; approved rules/freshness/failure handling pass. All K criteria have evidence, cumulative prerequisites hold, blocking security/integrity defects absent, required command results logged. PASS WITH CONDITIONS cannot waive failing mandatory tests; every nonblocking condition has owner/deadline. Later source-silent gates are proposed and need approval before execution.

## M. Risks and Limitations

Technical: concurrency, browser/provider compatibility and unbounded queries. Operational: support/training, shared-device privacy and recovery ownership. Integrity: wrong scope/unit/currency, missing history, duplicated retries, misunderstood metrics. Specific unknowns: Q22 provider/location/stage/thresholds/data license. Deferred: later phases and unapproved provider capabilities; schemas/policies remain proposals.

## N. Deliverables

Reviewed phase module/mobile UI, approved/rehearsed migrations where needed, API/adapter contracts, tests/quality/security evidence, recovery notes and closeout report.

## O. Completion Checklist

- [ ] MYF-P13-T001 complete with evidence.
- [ ] MYF-P13-T002 complete with evidence.
- [ ] MYF-P13-T003 complete with evidence.
- [ ] MYF-P13-T004 complete with evidence.
- [ ] MYF-P13-T005 complete with evidence.
- [ ] MYF-P13-T006 complete with evidence.
- [ ] MYF-P13-T007 complete with evidence.
- [ ] Every K criterion verified.
- [ ] Security/integrity audit, remediation and retest complete.
- [ ] Applicable quality/E2E/integration/migration evidence recorded.
- [ ] L gate approved; closeout/status updated from evidence.
