# Decision log

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase01 status, applicability and evidence/link review; affected content reconciled; no independent farmer validation or hosted verification.
- Implementation status: REFERENCE ONLY — N/A (navigation/protocol/template/decision/evidence record; no directly implementable scope).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase01 implementation session.
- Related phase/task IDs: Phase01 review session; MYF-P01-T001 through MYF-P01-T013; Phase00 owner acceptance where referenced.
- Verified completed work: Reference content/status/evidence links reviewed; document existence or review does not complete implementation tasks.
- Remaining work/blockers: Maintain alignment after Phase01 live verification; historical results stay historical and source body remains immutable.
- Evidence/report links: [Phase01 closeout](reports/phase-01-closeout-2026-10-08.md); [every-document review](reports/phase-01-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Date: 2026-10-08, Africa/Nairobi. Human owner roles below are **unassigned**, not invented personnel. No field research has been verified. Phase1 local engineering/test evidence is in the current closeout. [ADRs](architecture/architecture-decisions.md) explain tradeoffs.

## Confirmed source/request constraints

MyFarm naming; Uganda first/global extensibility; initial poultry/crops; source phase order 0–24; MVP closes 8 and pilot 9; Next.js/React/TypeScript/Tailwind/shadcn/RHF/Zod, server domain services, Prisma/PostgreSQL/Supabase, Vercel/private storage, Dexie/PWA/custom sync, Vitest/RTL/Playwright; deterministic finance, stock/wallet histories, server authorization and safe AI/voice. Current user authorization closes Phase0 by owner acceptance and authorizes Phase1. Supabase PostgreSQL + Supabase Auth is selected. Production/paid services and later phases are not implied.

## Proposals, assumptions and scope interpretations

| ID | Type / status | Interpretation and consequence | Validation |
|---|---|---|---|
| A01 | Assumption, unresolved | Personal farmer workspace and organization workspace share tenant abstraction | Q05/Q24, ADR-02 |
| A02 | Interpretation, needs confirmation | Financial record always owned by farm; source optional Farm attribution means analytical selection optional, never unowned money | Q05/Q09, security requirement |
| A03 | Proposal | Exact decimal schema precision 20,4 and quantity18,6; configurable currency/unit rounding | Q08/Q09/Q12 |
| A04 | Proposal | Immutable posted accounting corrections and balanced wallet journals | Q09/Q27; source immutable wallet minimum preserved |
| A05 | Proposal | Command receipts, hashes, server sequence/cursor/tombstones, staged media | Q16; lost-ack/concurrency proof |
| A06 | Sequencing interpretation | Offline extension points in 1–6; full sync in7; complete farmer offline mandatory by8 | Source says core requirement, not optional later optimization |
| A07 | Sequencing interpretation | Cooperative payment records/origin links in15; provider execution17/full custody21 | Source lists forward capabilities; no phase reorder |
| A08 | Proposal | Label Phase8 source “Farm Profit” gross margin/recorded surplus until net-income policy approved | Q09/Q10/Q17 |
| A09 | Proposal | Unknown storage/valuation/repayment/model data is unavailable, not zero or verified claim | Q12/Q17/Q28/Q32 |
| A10 | Proposal | Source-silent later exit gates and measurable quality thresholds require owner approval | Phase L; Q18/Q20/Q34 |
| A11 | Assumption, to verify | Hosting/runtime/pool/media configuration can support approved workload at sustainable cost | Q04/Q34; no current capability/price asserted |
| A12 | Proposal | Minimal new infrastructure; durable outbox/job runner only if enabled external work requires it | ADR-01/09; deployment evidence |

## Open questions

Q01 is **PARTIALLY RESOLVED**: user selected Rukungiri. Remaining components and Q02–Q34 are **OPEN**. Resolve affected decisions before dependent implementation; independent authorized documentation/research may proceed. No “timeout equals approval” rule.

| ID | Decision needed | Proposed owner role | Phase | Evidence/closure condition |
|---|---|---|---|---|
| Q01 | First district confirmed: Rukungiri (user, 2026-10-08). Remaining: interviewer, segment validation, recruitment size/window/route, consent/storage and evidence threshold | Product/research owner | 0 | Approve sampling/consent and real evidence-backed scope before engineering |
| Q02 | Languages, literacy/accessibility, shared devices, supported phone/browser and charging | Product/research owner | 0–1 | Observe actual devices/users; prioritize supported UI and recovery choices |
| Q03 | PARTIALLY RESOLVED: Supabase Auth selected; email/password existing-account foundation implemented, live recovery/session/rate-limit policy pending | Engineering/security owner | 1 | Threat/cost/accessibility review and provider contract tests |
| Q04 | PARTIALLY RESOLVED: stack pinned, Supabase PG selected/private-storage adapter prepared; region/plan/cost/hosted validation pending | Engineering/operations owner | 1 | Current official docs plus compatibility/latency/private-media test |
| Q05 | User–Farmer cardinality, personal tenant, membership, ownership transfer, location catalogs | Product/domain/security owner | 2 | Approved entity/policy mapping and isolation tests |
| Q06 | Document/contact/GPS purpose, retention, erasure/export, backups and history preservation | Product/privacy owner | 2 | Reviewed data inventory/retention policy; no compliance claim assumed |
| Q07 | Overlapping seasons, perennial crops, multi-plot enterprise, close/reopen rules | Agricultural/product owner | 3 | Domain examples for crop/poultry lifecycle validated with farmers |
| Q08 | Unit catalog/conversions and unsupported enterprise type UX | Agricultural/domain owner | 3–5 | Approved unit definitions, rounding and catalog extensibility |
| Q09 | Cash/accrual recognition, monetary precision/currency, allocation, tax and correction policy | Accounting/product owner | 4 | Approved numeric fixtures; no authoritative basis-dependent report before decision |
| Q10 | Phase/treatment of overhead, depreciation and finance costs for net farm income | Accounting/product owner | 4/8 | Explicitly defer or approve treatment; gross margin never mislabeled net profit |
| Q11 | Sale/income/purchase/expense recognition and partial-payment double-count prevention | Accounting/domain owner | 4 | Approved source-link/allocation invariants and cash/accrual examples |
| Q12 | Inventory valuation, grade/storage, negative-stock exceptions and conversion | Accounting/agricultural owner | 5/8 | Costing policy approved or value unavailable; concurrency proof |
| Q13 | Production/flock vs stock movements and atomic sale/harvest accounting links | Domain owner | 5 | One source event per effect and conservation fixtures |
| Q14 | Recurrence exceptions, missed definition, worker invitation and notifications | Product owner | 6 | Approve recurrence/timezone/cancellation examples; notifications not presumed |
| Q15 | Activity cost link vs expense creation/correction workflow | Accounting/product owner | 6 | Choose no-double-count cost linkage |
| Q16 | Meaningful offline duration, device/storage limits, local unlock, sync retention/recovery | Product/security/engineering owner | 1/7 | Approve measured support envelope, tombstone/receipt window and explicit unsynced-loss policy |
| Q17 | Metric denominators, overhead allocations, absent/zero values, snapshot freshness | Accounting/agricultural owner | 8 | Formula catalog and golden fixtures approved |
| Q18 | Pilot cohort/window, active/retained definition, thresholds, support/cycle completion | Product/research owner | 9 | Prospective criteria then real cohort evidence |
| Q19 | Rule mortality thresholds, percent vs points, data coverage, severity/suppression | Agronomic/product owner | 10 | Reviewed rules, comparison units and sparse-data behavior |
| Q20 | AI provider/cost, data processing/retention, knowledge licenses and groundedness criteria | Product/security/AI owner | 11 | Approved tool contracts, consent/provider policy and adversarial evaluation |
| Q21 | Speech/language accuracy, confirmation/accessibility, audio retention/offline provider | Product/AI/privacy owner | 12 | Measured language support and exact-payload confirmation |
| Q22 | Weather source/license, accuracy/location, growth-stage input, agronomic thresholds | Agronomic/product owner | 13 | Reviewed provider/rule/freshness contracts |
| Q23 | Officer assignment/on-behalf onboarding/consent and offline revocation | Product/security owner | 14 | Current scoped grant model and denial/recovery tests |
| Q24 | Organization vs private farmer ownership/sharing, procurement and forecasts | Product/domain/security owner | 15 | Consent scope and ledger/forecast semantics approved |
| Q25 | Order reserve/expiry, delivery, buyer verification, weight/grade disputes | Commerce/product owner | 16 | State machine, stock reservation and bilateral access contract |
| Q26 | Payment provider, custody/legal role, KYC responsibility, fees/refunds/settlement/region | Product/legal/accounting owner | 17 | Current official/qualified review and sandbox evidence before activation |
| Q27 | Wallet chart/counteraccounts, pending/available/settled balances and reconciliation | Accounting owner | 17 | Balanced journal/state machine proposal reviewed |
| Q28 | Economic profile windows/coverage, verified years/repayment history, sharing expiry | Product/accounting/privacy owner | 18 | Reproducible profile and field-scoped consent |
| Q29 | Licensed finance/insurance/savings partners, contracts/disclosures/disputes | Product/legal owner | 19 | Reviewed partner responsibilities/terms before advertising products |
| Q30 | Regional image model/calibration, reviewer capacity, escalation SLA and treatment safety | Agronomic/AI/product owner | 20 | Approved field evaluation and escalation process |
| Q31 | Custody attestation, processing yields/loss, lot IDs/standards/certification evidence | Supply-chain/product owner | 21 | Conservation/lineage examples and evidence requirements |
| Q32 | Longitudinal readiness, held-out baselines/bias/drift, licenses/IoT identity/cost | AI/product/security owner | 22 | Per-capability data readiness and evaluation before activation |
| Q33 | Plans/pricing, billing/tax, grace/downgrade/export and tenant quotas | Product/commercial owner | 23 | Reviewed commercial matrix, no data rights by subscription |
| Q34 | SLO/latency/load, RPO/RTO, backup retention, on-call/recovery/security-review depth | Operations/security owner | 1/24 | Approved budgets before deployment and measured drills/load proof |

## Proposed enhancements, separate from confirmed requirements

Balanced per-currency wallet journals, explicit receipt payload-hash collision detection, tenant-composite DB constraints, consent expiry/revoke audit, numeric metric provenance, scoped private upload finalize and baseline/drift evaluation strengthen source safety. PostgreSQL RLS and durable worker service require compatibility/need evidence before selection. No enhancement is implemented or automatically approved.

## Update protocol

Record decision ID/status (OPEN, PROPOSED, APPROVED, SUPERSEDED), source/requirement IDs, options/tradeoffs, human approver/date, schema/client/operational consequences and tests. Preserve historical decisions; link superseding record. Do not promote proposals merely because a phase document exists. [Status](PROJECT-STATUS.md) records verified implementation; [source analysis](reports/source-analysis.md) records ambiguities.

## Phase 0 session decisions — 2026-10-08

| ID | Status/origin | Decision and limits | Evidence |
|---|---|---|---|
| D-P00-001 | APPROVED direct user instruction | First research district Rukungiri; no language/device/pain conclusion implied | [Planning register](product/research-evidence-register.md), P00-PLAN-001 |
| D-P00-002 | APPROVED direct user instruction | Implement Phase 0 only, update every document's truthful status and calculate completed-task percentage | [Status policy](engineering/document-status-policy.md), P00-PLAN-002 |
| D-P00-003 | PROPOSED operational draft | Research pack and consent script ready for review; interviewer/recruitment/storage/retention and participant consent not yet approved | [Research pack](product/research-operations.md) |
| D-P00-004 | OBSERVED gate disposition | No task fully verified; 0/10 = 0%; preparation partial and discovery gate not passed | [Phase 0 closeout](reports/phase-00-closeout-2026-10-08.md) |

No source requirement/task/dependency was waived. Independent preparation of later task materials does not check off their tasks or alter sequence. Completion requires actual evidence and owner approval.

## D-P00-005 — approved owner closure and Phase1 authorization

APPROVED, direct user instruction 2026-10-08: Phase0 COMPLETED 100% by owner acceptance; proceed Phase1 immediately. Original research verification remains absent. [Approval record](reports/phase-00-owner-approval-2026-10-08.md) records accepted risk and percentage exception. No fabricated approvals, participants or passing research tests.

## D-P01-001 — Supabase provider selection

APPROVED, direct user answer2026-10-08: “Supabase PostgreSQL + Supabase Auth”. Supersedes source-baseline Neon for active architecture/roadmap/specifications; authoritative source extract is preserved. No hosted resource or capability is assumed. [Dependencies](engineering/foundation-dependencies.md), [setup](engineering/foundation-local-setup.md).

## D-P01-002 — Foundation subset and defaults

IMPLEMENTED within authorized Phase1: User/Organization/Membership/AuditEvent only, no farmer provisioning/registry. Existing-account email/password flow, current server getUser verification, scoped membership, private read TTL60seconds, audited retry collision checks, server-only Prisma and RLS-denied browser tables. Ordinary defaults require live recovery/role/pool/bucket validation before closure. Later domain models remain proposed.

## D-P01-003 — Session audit outcome

OBSERVED: local lint/typecheck/test/build pass;40 unit/component,10 DB integration,14 E2E tests pass; migration/restore pass; npm audit zero. Phase1 BLOCKED30.77% (T001–T004 complete, T005–T013 remain). Independent later groundwork does not bypass task dependencies. [Closeout](reports/phase-01-closeout-2026-10-08.md). No hosted CI/provider/deployment success is invented.

## D-P01-004 — Development configuration

User replied “I’ll configure .env.local”. No secret requested in chat. .env.example documents isolated project settings. Hosted migration/storage setup is not applied automatically; confirm isolated target first. No Phase2 execution authorized.
