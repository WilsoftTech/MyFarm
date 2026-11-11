# Decision log

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — T013 task-relevant content, status and evidence.
- Implementation status: REFERENCE ONLY — N/A (navigation/protocol/template/decision/evidence record; no directly implementable scope).
- Last reviewed: 2026-10-25 (Africa/Nairobi), T013 audit.
- Related phase/task IDs: Phase01 review session; MYF-P01-T001 through MYF-P01-T013; Phase00 owner acceptance where referenced; Phase02 review session (MYF-P02-T001–T013).
- Verified completed work: Reference content/status/evidence links reviewed; document existence or review does not complete implementation tasks.
- Remaining work/blockers: Phase3 T001/T002 verified; T003–T013 and full acceptance remain. [T002 report](reports/phase-03-t002-2026-10-18.md). Historical sections stay historical.
- Evidence/report links: [Phase1+2 integration report](reports/phase-01-02-integration-2026-10-09.md); [Phase02 closeout](reports/phase-02-closeout-2026-10-09.md); [Phase02 every-document review](reports/phase-02-document-review-2026-10-09.md); [Phase01 closeout](reports/phase-01-closeout-2026-10-08.md); [every-document review](reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](reports/phase-01-provider-verification-2026-10-08.md). [T013 audit](reports/phase-03-closeout-2026-10-25.md).
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
| Q05 | RESOLVED for Phase2 by owner 2026-10-08 ([D-P02-002](#d-p02-002--q05-identity-model)): one farmer per user in a PERSONAL organization; many farms; no ownership transfer; free-text location. Agent-assisted onboarding and location catalogs remain open | Product/domain/security owner | 2 | Approved entity/policy mapping and isolation tests |
| Q06 | PARTIALLY RESOLVED by owner 2026-10-08 ([D-P02-003](#d-p02-003--q06-data-minimization)): minimal contact/location fields, optional GPS, no identity numbers, documents deferred. Retention, erasure/export and backup policy remain open | Product/privacy owner | 2 | Reviewed data inventory/retention policy; no compliance claim assumed |
| Q07 | RESOLVED for Phase3 by owner 2026-10-09 ([D-P03-002](#d-p03-002--q07-seasons-and-crop-cycles)): seasons are farm-level labels and may overlap; one plot and one season per crop cycle; intercropping up to plot area (excess needs a reason); perennials have no expected end; closing is final, reopening deferred | Agricultural/product owner | 3 | Owner decision recorded; field validation still pending (Phase 9) |
| Q08 | RESOLVED for Phase3 by owner 2026-10-09 ([D-P03-003](#d-p03-003--q08-units-and-enterprise-types)): planted area reuses the Phase2 AreaUnit (no conversions in Phase3); whole-number bird counts; six recordable enterprise types, workflows for CROP/POULTRY only; crops from a data catalog | Agricultural/domain owner | 3–5 | Owner decision recorded; unit conversions and rounding revisit in Phase4/5 |
| Q09 | RESOLVED for Phase4 by owner 2026-10-25 ([D-P04-002](#d-p04-002--q09-basis-money-and-corrections)): accrual default with a labelled cash-basis view; any ISO 4217 currency stored with numeric(20,4), never aggregated or converted; tax out of scope; corrections append reversals. Display rounding and reporting periods remain open | Accounting/product owner | 4 | Owner decision recorded; golden fixtures in [T001](reports/phase-04-t001-2026-10-25.md) |
| Q10 | RESOLVED for Phase8 by owner 2026-11-03 ([D-P08-002](#d-p08-002---q10-recorded-surplus)): farm shows recorded surplus, shared costs are not allocated, and depreciation and finance are stated as not included; net income stays unbuilt. Earlier deferral: [D-P04-004](#d-p04-004--q10-net-income-deferred) | Accounting/product owner | 4/8 | Treatment approved before Phase 8 net income; gross margin never labelled net profit |
| Q11 | RESOLVED for Phase4 by owner 2026-10-25 ([D-P04-003](#d-p04-003--q11-recognition-and-double-count-prevention)): a sale/purchase is the single revenue/cost event; payments only settle receivables/payables; standalone income/expense only for other items | Accounting/domain owner | 4 | Owner decision recorded; allocation invariants verified in [T001](reports/phase-04-t001-2026-10-25.md) |
| Q12 | Valuation RESOLVED for Phase8 by owner 2026-11-03 ([D-P08-004](#d-p08-004---q12-stock-value)): labelled estimate at last sale price, kept out of surplus. Formal costing not approved. Earlier parts: [D-P05-002](#d-p05-002---q12-quantities-storage-and-valuation) | Accounting/agricultural owner | 5/8 | Costing policy approved or value unavailable; concurrency proof |
| Q13 | Production/flock vs stock movements and atomic sale/harvest accounting links | Domain owner | 5 | One source event per effect and conservation fixtures |
| Q14 | RESOLVED for Phase6 by owner 2026-11-02 ([D-P06-002](#d-p06-002---q14-missed-definition), [D-P06-003](#d-p06-003---q14-recurrence), [D-P06-004](#d-p06-004---q14-worker-and-notifications)): missed after the due date in Africa/Kampala; daily/weekly/monthly recurrence; free-text worker; no notifications | Product owner | 6 | Approved |
| Q15 | RESOLVED for Phase6 by owner 2026-11-02 ([D-P06-005](#d-p06-005---q15-activity-cost-link)): link an existing same-farm expense or purchase; the activity holds no money | Accounting/product owner | 6 | Approved |
| Q16 | RESOLVED for Phase7 by owner 2026-11-03 ([D-P07-002](#d-p07-002---q16-support-limits), [D-P07-003](#d-p07-003---q16-shared-phones), [D-P07-005](#d-p07-005---q16-lost-entries)): 14 days and 500 unsent entries; per-account data with no PIN; warnings plus an unencrypted download. Real-device measurement stays open | Product/security/engineering owner | 1/7 | Approved; measurement pending |
| Q17 | RESOLVED for Phase8 by owner 2026-11-03 and 2026-11-04 ([D-P08-005](#d-p08-005---q17-crop-formulas) to [D-P08-011](#d-p08-011---q17-formula-catalog)); [formula catalog](architecture/metric-formulas.md) and golden fixtures approved | Accounting/agricultural owner | 8 | Formula catalog and golden fixtures approved |
| Q18 | RESOLVED prospectively by owner 2026-11-09 ([D-P09-002](#d-p09-002---q18-cohort-and-window) to [D-P09-004](#d-p09-004---q18-gono-go-threshold)): about 25 farmers for one season; active = one record a week, retained = 3 of 4 weeks; 50% retained voluntarily at week 8. Real cohort evidence still pending | Product/research owner | 9 | Prospective criteria then real cohort evidence |
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

## D-P01-005 - MCP authorization and security remediation

APPROVED direct user instruction: use Supabase MCP; user confirmed OAuth authorization completed. OBSERVED: authenticated tool catalogue available to a fresh app-server, unavailable to the active chat until reload; no hosted database tool call succeeded. IMPLEMENTED/LOCALLY TESTED: current provider-session verification, private-schema storage helper, strict hosted TLS and exact Supabase pins. Latest gates pass with 48 unit/component tests, 10 DB integration and 14 browser tests. Phase status stays BLOCKED30.77%; [provider report](reports/phase-01-provider-verification-2026-10-08.md) records unverified gates. No provider capability or phase completion inferred from OAuth alone.

D-P01-006 - Observed resumed verification: MCP enabled but no tools in active session; Windows/system CA probe did not resolve certificate failure. Reproduced pg ssl=0 URL override and repaired it;51 unit/component tests and all mandatory local gates PASS. No hosted completion inferred. [Resumed evidence](reports/phase-01-provider-verification-2026-10-08.md).

## Current live verification and decision record

Phase 01 BLOCKED — 76.92% (10/13 verified task IDs). Verdict: FAIL. Completed T001–T010. Remaining T011–T013: hosted CI and dependency-gated final closure. Protected preview builds and live authenticated hosted verification succeeds; CI startup failure prevents completion.

Live Supabase Auth and private storage:28 checks PASS. Current membership/session revocation, tenant isolation, private downloads, secure cookies, concurrent idempotency and recovery token generation verified. Temporary test users/files/database fixtures removed. Lint/typecheck/build/boundaries PASS0;58 unit/component tests and11 PostgreSQL integration tests PASS. Rate limiter:30 distinct private-file grants/actor/minute, shared transaction advisory lock, identical retries free, database clock window; concurrent boundary and expired-window test PASS. Same-origin authority handling repaired after real browser verification exposed Next.js internal hostname normalization. TLS URL overrides stripped; verified client-to-pooler TLS and Supabase CA. Pooler-to-database pg_stat_ssl reports false; no end-to-end provider-managed transport claim.

Prisma migrations202610080001_foundation and202610080101_private_grant_rate_limit applied in isolated Supabase development project sudqhluwsaijvjjcegpv. Foundation applied via MCP then Prisma history reconciled; additive actor/time index generated by Prisma diff and deployed by Prisma CLI. Provider SQL artifacts in supabase/policies: private-storage, foundation-hardening and runtime-role. Five provider-specific MCP migrations recorded separately. Runtime role has SELECT foundation tables/INSERT audits, no direct auth.sessions read, no update/delete/DDL/bypass-RLS. LOGIN explicitly approved; password kept in ignored local configuration and explicitly approved preview secret. Auth frontend denied application tables; private session boolean restricted to backend role. Security advisors: no WARN/ERROR, only intentional deny-all _prisma_migrations RLS INFO. Performance: newly created tenant/date index unused INFO, no missing FK index. No new application dependencies; existing Supabase versions pinned exactly.

API change: same-origin private-file requests work with actual HTTP authority; excessive distinct grants return429 RATE_LIMITED. Offline sync, financial/stock writes, farmer registry and AI are NOT APPLICABLE to Phase1 and remain unimplemented. Restore/replay evidence from preceding isolated synthetic rehearsal remains applicable. Recovery email delivery and production operational settings are not claimed; production release must verify them. Source research remains absent despite Phase0 owner acceptance.

[Current closeout](reports/phase-01-closeout-2026-10-08.md).

## D-P01-LOCAL-CI-001 — Phase 1 Local CI Substitution

APPROVED, direct owner instruction 2026-10-08 (Africa/Nairobi). Scope: **Phase 1 only**.

- **Context:** GitHub Actions cannot run for WilsoftTech/MyFarm. Run [37743343360](https://github.com/WilsoftTech/MyFarm/actions/runs/37743343360) on `d9ef30b` executed zero steps; GitHub's annotation states "The job was not started because your account is locked due to a billing issue."
- **Decision:** The owner authorizes equivalent local verification as the replacement criterion for the Phase 1 "CI run" requirement (MYF-P01-AC004, exit gate L, T011–T013).
- **Requirements of the substitution:** every applicable `.github/workflows/quality.yml` step is reproduced locally from a clean checkout against an isolated `postgres:17` service with the workflow's environment; all applicable mandatory quality gates (static, unit/component, integration, E2E desktop/mobile, migration, real-auth, security, production-mode) run; every result is recorded with evidence; anything not reproducible is recorded NOT VERIFIED with a reason.
- **Limits:** GitHub-hosted CI remains **unverified** and is not claimed to have passed. This exception does not apply to Phase 2 or any later phase, and does not remove CI requirements generally. Hosted CI must be revisited and pass before any future production release.
- **Outcome:** All 11 workflow steps PASS locally at `bd9fadc`; database, real Supabase auth, production-mode and security verification PASS. Phase 1 closed **PASS WITH CONDITIONS — LOCAL VERIFICATION**, 13/13. [Report and evidence](reports/phase-01-local-verification.md).

## D-P01-007 — Phase 1 closeout conditions

OBSERVED/RECORDED 2026-10-08. Nonblocking conditions carried from Phase 1 closure, each with owner and deadline in the [local verification report](reports/phase-01-local-verification.md#11-conditions-nonblocking-owner-tracked): C1 hosted CI unverified; C2 provider SQL (`supabase/policies/`, including the session-check function) sits outside the Prisma migration chain; C3 Phase 2 migration `202610080002_farmer_registry` must be renamed after `202610080101` before merge; C4 recovery email/production auth settings/pooler-to-database TLS unverified; C5 anonymous protected pages return a streamed 200 with in-stream redirect (no content leak). A user-visible double-encoded UTF-8 defect found during verification was fixed with regression tests in `bd9fadc`.

## D-P02-001 — Phase2 started before the Phase1 exit gate

APPROVED, direct user answer 2026-10-08: “phase 01 is being completed by codex. start phase 2 now”. The owner authorizes Phase2 implementation while Phase1 remains BLOCKED. This is an explicit sequencing override, not a waiver of Phase1 tasks or of the Phase2 L requirement that cumulative prerequisites hold: Phase2 cannot close until Phase1 closes. Phase2 work was done on branch `worktree-phase-02`, isolated from the concurrent Phase1 session.

## D-P02-002 — Q05 identity model

APPROVED, owner answer 2026-10-08 (“1 user = 1 farmer, many farms”). A signed-in active account registers one Farmer, which creates a new PERSONAL Organization and FARMER Membership in the same transaction; the farmer owns many Farms; each Farm has Plots. Farm access requires an ACTIVE FarmMember row **and** an ACTIVE FARMER membership in the farm's organization; organization ADMIN/AGENT roles grant no farm-data access. No ownership transfer, manager-registers-many-farmers flow or location catalog in Phase2. Accounts are still owner-provisioned (Phase1); Phase2 adds no self sign-up.

## D-P02-003 — Q06 data minimization

APPROVED, owner answer 2026-10-08 (“Minimal; defer documents”). Profile: name, phone, optional alternative phone, district, optional subcounty/village, preferred language, land ownership type, main activities. Farm: name, district, optional subcounty/village, optional approximate acreage, ownership, primary activity, optional GPS pair. Strict schemas reject undeclared fields (e.g. identity numbers). Phone is contact only, never a credential. **Document** upload/storage is deferred until a retention/erasure policy exists. Address and Contact are held as profile/farm columns rather than separate tables because Phase2 stores exactly one location and up to two phones; separate tables return when multiple addresses/contacts are approved.

## D-P02-004 — Phase2 engineering defaults (PROPOSED, owner may change)

Source P0186–P0204 names fields but not values. Engineering defaults, recorded for review rather than claimed as farmer findings:

- Land ownership: OWNED, RENTED, FAMILY, COMMUNAL, OTHER. Activities: CROPS, POULTRY, OTHER_LIVESTOCK, OTHER. Plot area units: ACRE, HECTARE, SQUARE_METRE.
- Preferred language is a stored preference code (en, lg, nyn); the interface remains English and no translation is implied.
- Phones: Ugandan mobile forms (07…, 256…, +256…) normalize to +2567XXXXXXXX; other numbers must already be E.164.
- Acreage numeric(12,4) ≥ 0, plot area numeric(18,6) ≥ 0 with a required unit; coordinates numeric(9,6) within ±90/±180 and only as a complete pair. Values stay decimal strings end to end.
- Composite (id, tenantId) foreign keys make cross-tenant plot/farm/member links impossible in the database, plus CHECK constraints mirroring the domain rules and RLS on all new tables.
- Idempotency: each create/update command carries a client request ID recorded as an audit receipt (unique tenant/request/action); a replay returns the original record. Profile updates use optimistic `version`. A request ID reused with a different payload replays the original rather than returning 409 (narrower than Phase1's file-grant check); revisit with the Phase7 sync contract.
- Plot names are unique per farm.

**Update 2026-10-09 to D-P02-001:** Phase 1 closed 2026-10-08 (D-P01-LOCAL-CI-001), so the sequencing override is no longer needed. The Phase 2 commit was ported, without rewriting history, onto the closed Phase 1 head as branch `phase-02-farmer-registry` (cherry-pick of `18cc422`; the original `worktree-phase-02` branch is kept unchanged).

**Update 2026-10-09 to D-P02-004:** a farmer registration retried with the **same** request ID now replays the committed registration (including the loser of a concurrent race); a new request ID for an already-registered user still returns 409. All other D-P02-004 defaults are unchanged and remain PROPOSED for owner review.

## D-P02-005 — Hosted development verification for Phase 2

APPROVED, owner answer 2026-10-09 (“Authorize dev changes”). Scope: the isolated Supabase **development** project `sudqhluwsaijvjjcegpv` only; never production. Authorized: apply the additive migration `202610090001_farmer_registry`; apply the Phase 2 provider grants `supabase/policies/farmer-registry-runtime.sql` to `myfarm_runtime`; create and delete disposable test users/fixtures, with cleanup verified. Outcome: applied 2026-10-09; 48/48 live checks PASS; the project returned to its empty baseline. [Closeout](reports/phase-02-closeout-2026-10-09.md).

## D-P02-006 — Phase 2 local CI substitution

APPROVED, owner answer 2026-10-09 (“Extend local CI to Phase 2”). GitHub Actions remains billing-locked (run [37893530528](https://github.com/WilsoftTech/MyFarm/actions/runs/37893530528), 2026-10-09: “The job was not started because your account is locked due to a billing issue.”). The rules of [D-P01-LOCAL-CI-001](#d-p01-local-ci-001--phase-1-local-ci-substitution) apply to **Phase 2 only**: every `quality.yml` step is reproduced from a clean clone against a fresh isolated `postgres:17`, and every result is recorded. GitHub-hosted CI stays **NOT VERIFIED**, is not claimed, and must pass before any production release. Phase 3 and later need a new owner decision.

## D-P02-007 — Runtime role privileges for registry writes

IMPLEMENTED 2026-10-09 (engineering decision within the approved D-P02-002 model; owner may review). Phase 1 deliberately gave `myfarm_runtime` no Organization/Membership mutation. Phase 2 registration must create the actor's PERSONAL organization and FARMER membership, so `supabase/policies/farmer-registry-runtime.sql` grants the narrowest form of this:

- **Organization:** INSERT only with `kind = 'PERSONAL'`.
- **Membership:** INSERT only as the first, ACTIVE, FARMER-role member of a PERSONAL organization. The role can never join an existing tenant, grant ADMIN/AGENT, update or revoke.
- **Registry tables:** SELECT and INSERT, with RLS write checks that tie each row to the actor:
  - a Farmer requires the user's own FARMER membership;
  - a Farm requires its creator to be the owning farmer;
  - a FarmMember must be the farm owner;
  - a Plot requires an active FarmMember as creator.
- **FarmerProfile:** column-limited UPDATE (no identifier changes) by the farmer's own user.
- **No grants for:** DELETE; Farm/Plot UPDATE; browser roles (`anon`, `authenticated`, which are explicitly revoked).

Application services remain the primary authorization layer; these policies are defense in depth. Like Phase 1's provider SQL (condition C2), the file lives outside the Prisma migration chain and must be applied when any new environment is provisioned.

## D-P02-008 — Phase 1 condition C5 resolved for anonymous visitors

IMPLEMENTED 2026-10-09. The proxy now returns a real `307` (relative `Location: /sign-in?reason=session-required`, `private, no-store`) for anonymous requests to `/workspace`, `/admin`, `/agent`, `/farmer` and `/farms`. Every page and API still verifies the session server-side. A signed-in user whose server session was revoked while their JWT is still unexpired still gets the in-stream redirect (no content is rendered). The shared header link changed from “Sign in” to the state-neutral “My account” (`/workspace`), and the registry pages gained a signed-in navigation with Sign out, after visual review showed signed-in farmers being offered “Sign in”.

## D-INT-001 — Phase 1 and Phase 2 integration into main

APPROVED and EXECUTED 2026-10-09 (owner instructions “controlled integration of Phase 1 and Phase 2” and “push the Phase 2 branch, then fast-forward main”).

- **One-time CI exception:** GitHub Actions is billing-locked, so the verified local quality gates (D-P01-LOCAL-CI-001, D-P02-006) stand in for hosted CI for this integration only. Hosted CI stays **NOT VERIFIED**.
- **Method:** fast-forward only, no force, no squash or rebase: `main` moved `f159631 → e4ea43b` (Phase 1) `→ d85a773` (Phase 2); `phase-02-farmer-registry` pushed to origin. The stale branch `worktree-phase-02` (`18cc422`) was never merged.
- **Deployment safety:** the owner confirmed the Vercel and Render dashboards (no project connected to the repository) before the push; after each push, GitHub showed no deployments, no commit statuses and no Vercel/Render check runs.
- **Published test fixtures:** the owner accepted the synthetic screenshot fixtures (option 1). The coordinates resolve to a public road in Rukungiri town; the placeholder phone numbers could not be confirmed unallocated.

[Integration report](reports/phase-01-02-integration-2026-10-09.md).

## D-INT-002 — Database provisioning hardening (Step B)

APPROVED by the owner 2026-10-09 in an isolated local worktree and test databases; IMPLEMENTED on branch `phase-02-provisioning-hardening`. Constraints set by the owner: provider SQL transactional and re-runnable; tests execute the real files on fresh and previously provisioned databases; default privileges verified for every object-creating role; browser-role grants reviewed before revoking, keeping intended Supabase API and Auth behavior; emulation is supplementary evidence only; no hosted database change; no edit to applied migrations or their checksums; no push/merge to `main` without separate approval.

Outcome: `supabase/provisioning.json` is the single provisioning order; every provider file is one transaction and re-runnable; new `browser-role-lockdown.sql` removes browser-role access to public objects (including `_prisma_migrations`, P2-C8) and to objects created later. **Not applied to hosted dev**; that needs a separate owner authorization. [Integration report](reports/phase-01-02-integration-2026-10-09.md#4-step-b--database-provisioning-hardening).

Update: pushed and `main` fast-forwarded to `756f3c4` on 2026-10-09; applied to hosted dev on 2026-10-10 under [D-INT-003](#d-int-003--hosted-application-of-the-provisioning-files).

## D-INT-003 — Hosted application of the provisioning files

APPROVED by the owner and EXECUTED 2026-10-10 (“approved. use mcp”). The five provider files in `supabase/provisioning.json` were applied verbatim to hosted dev `sudqhluwsaijvjjcegpv` as `postgres` through the project-scoped Supabase MCP server. Every call needed the owner's approval. No migration was applied or edited. The owner disabled public sign-up in the Supabase dashboard (INT-C2). Read-only verification passes 9/9 (4/9 before); the runtime role and its policies are unchanged; sign-in/sign-out passes 11/11. Resolves INT-C1, INT-C2, P2-C2 and P2-C8 in hosted dev; the advisor run resolves P2-C6. Phase 3 was not started. [Integration report §9](reports/phase-01-02-integration-2026-10-09.md#9-hosted-application--2026-10-10).

## D-P03-001 — Phase 3 authorization and sequencing

APPROVED, owner 2026-10-09 (“check for phase completeness and move to next phase”; sequencing answer “Step B first”). Phase 3 (enterprises, crops, livestock and seasons) is authorized. It starts from the provisioning-hardening branch once Step B is complete; pushing that branch to `main` still needs separate approval.

## D-P03-002 — Q07 seasons and crop cycles

APPROVED, owner 2026-10-09 (accepted the proposed rules):

- A season is a farm-level label (for example “2026 Season A”); seasons on one farm may overlap.
- A crop cycle belongs to exactly one plot and one season. An enterprise (for example “Maize”) spans plots through several cycles.
- Several cycles may run on one plot at the same time (intercropping) while their total planted area is at most the plot area; exceeding it requires an explicit, recorded reason.
- A perennial crop (for example coffee) is a cycle with no expected end.
- Closing a cycle or season is final in Phase 3; reopening is deferred.

## D-P03-003 — Q08 units and enterprise types

APPROVED, owner 2026-10-09 (accepted the proposed rules):

- Planted area reuses the Phase 2 `AreaUnit` (ACRE, HECTARE, SQUARE_METRE); no unit conversions in Phase 3.
- Bird counts are whole numbers.
- All six enterprise types (CROP, POULTRY, DAIRY, LIVESTOCK, FISH, OTHER) can be recorded; only CROP and POULTRY have workflows, and the others show that their workflow is not yet available.
- Crops come from a data catalog, not code.

## D-P03-004 — Phase 3 local CI substitution

APPROVED, owner 2026-10-09 (“Yes, extend to Phase 3”). The D-P01-LOCAL-CI-001 rules apply to Phase 3: every `quality.yml` step reproduced from a clean clone against a fresh isolated `postgres:17`. GitHub-hosted CI stays **NOT VERIFIED** and must pass before any production release. Later phases need a new decision.

## D-P03-005 — Phase 3 implementation started

APPROVED, direct user instruction 2026-10-18: “begin Phase 3”. This activates the existing authorization from local `main` at `35cacdf`. T001 implements the necessary Enterprise/Season foundation subset of phase F, domain contracts and relationship rules under the approved Q07/Q08 decisions. The migration adds tables/constraints and deny-all RLS; it does not grant runtime access or add user-facing workflows. Crop-cycle and batch detail remain in their dependent tasks. This records local implementation authorization, not permission to push, deploy or change hosted databases. [T001 verification and remaining work](reports/phase-03-start-2026-10-18.md).

## D-P03-006 — T002 and task-by-task commits

APPROVED, direct user instruction 2026-10-18: “proceed to T002. commit on every finish of task”. Completed T001 was committed separately as `18605b3`; each completed task is to receive its own local commit, preserving unrelated work. This does not authorize pushes, deployment or hosted changes. T002 implements create/list/detail services for the reviewed enterprise/season subset, reusing current authorization and transactional audit receipts. Production retries bind the receipt to the original normalized creation fields and farm; changed payloads/scope conflict. This leaves Phase 2 retry semantics unchanged and does not implement the full Phase 7 sync contract. [T002 evidence](reports/phase-03-t002-2026-10-18.md).

## D-P03-007 — T003 UI acceptance and deferred cycle proof

APPROVED, owner 2026-10-18, following "proceed to next T003." The owner selected "Complete enterprise/season UI; defer full cycle acceptance (Recommended)" when asked whether to pull crop-cycle/poultry-batch workflows forward from T004-T009. T003 closes on the connected Enterprise/Season UI and verified mobile, empty, failure, permission, offline-open-form and retry behavior. Full MYF-P03-AC001 multi-cycle histories/totals remain required after the dependent cycle/batch tasks and before phase closure. R001 therefore remains partially complete. This adjusts task acceptance sequencing only; it authorizes no later-phase features, database architecture changes, hosted operations or deployment. [T003 evidence](reports/phase-03-t003-2026-10-18.md).

## D-P03-008 — T004 domain scope and conservative validation

IMPLEMENTED 2026-10-18 within the direct user instruction to proceed with T004, using approved D-P03-002/D-P03-003 policies. The domain stage adds strict crop-cycle contracts, exact six-decimal area rules and a T005 repository port. No Prisma/schema/provider/runtime change is needed for this pure stage. Engineering validation details: planted area is positive; unknown plot capacity and mismatched units fail; all ACTIVE allocations reserve plot area until explicit closure; forecast harvest never releases capacity; every excess start needs its own recorded reason. Season labels do not impose unapproved date containment. Crop selection references a data catalog UUID, with no hard-coded crop names or catalog administration implementation. These are implementation details within the approved rules, not a new owner approval or stronger runtime guarantee. T005 must implement and verify authorized, serialized, atomic persistence with the minimal additive schema/catalog lookup subset; full AC002 remains pending T005/T006. [Evidence](reports/phase-03-t004-2026-10-18.md).

## D-P03-009 — T005 crop persistence and initial catalog

APPROVED local implementation by direct user instruction to proceed with T005 (2026-10-18). When asked about initial reference data, the owner selected "Include maize and coffee from the project examples". The additive migration includes stable Maize/Coffee catalog rows and crop-cycle storage within the T004 contract/Q07/Q08 rules. The runtime has catalog read access and cycle SELECT/INSERT only; catalog administration remains T010-T012. Starts use existing atomic receipts and a transaction-level plot advisory lock, with active membership rechecks and exact aggregate area validation. This is local implementation authorization, not a hosted migration/seed/grants, push or deployment approval. T006 and full AC002 remain pending. [Evidence](reports/phase-03-t005-2026-10-18.md).

## D-P03-010 — T007 poultry batch fields

APPROVED, owner 2026-10-19, after the instruction "push all commits and proceed to T007". The owner chose the recommended option for each open R003 field:

- **Animal type:** a global data catalog like crops, seeded with Chicken, Duck, Turkey and Guinea fowl. No names are hard-coded; breed is optional free text.
- **Production purpose:** fixed list — Eggs (layers), Meat (broilers), Dual purpose, Breeding.
- **Batch identity:** a farmer-entered label (for example "Batch #004"), unique per farm across open and closed batches, ignoring case and whitespace differences.
- **Acquisition:** acquisition date only; purchase cost belongs to Phase 4 accounting.

Engineering details within these rules: starting quantity is a whole number from 0 to 2,147,483,647 (AC003 says nonnegative, so 0 is allowed). The current count equals the starting count, labelled as such, until Phase 5 flock movements exist. No future-date limit is imposed on acquisition, matching crop planting dates. T007 adds contracts and rules only; catalog storage, seeds and the uniqueness constraint are T008 scope. This is local implementation authorization, not a hosted change or deployment approval. [Evidence](reports/phase-03-t007-2026-10-19.md).

## D-P03-011 — T008 poultry persistence

APPROVED local implementation by direct user instruction "proceed to T008" (2026-10-19), within D-P03-010. Additive migration `202610190001_poultry_batches` adds the approved animal-type catalog seeds (Chicken, Duck, Turkey, Guinea fowl), a fixed purpose enum and batch storage. Farm-wide label uniqueness across all statuses is a database unique index on an application-normalized key. The runtime has catalog read access and batch SELECT/INSERT only; catalog administration, batch closure and flock movements remain later scope. This is local implementation authorization, not a hosted migration/seed/grants, push or deployment approval. T009 and full AC003 remain pending. [Evidence](reports/phase-03-t008-2026-10-19.md).

## D-P03-012 — R004 catalog changes by reviewed data release

APPROVED, owner 2026-10-19, after the instruction "proceed to T010". Two questions were asked, and the owner chose the recommended option for both:

- **Catalog changes:** crops and animal types change only through small, reviewed, audited data releases (migrations), never through code. Releases add entries with new stable IDs and names that are unique ignoring case and whitespace, including inactive entries. Entries are deactivated, never deleted or reused. No in-app catalog editor or platform-operator role is added in Phase 3, and runtime roles keep read-only catalog access. This supersedes the expectation in D-P03-009 that catalog administration would land in T010–T012; an editor is deferred until a platform-operator role is approved.
- **Initial crop list:** the first release adds Beans, Bananas (matooke), Cassava, Sweet potatoes, Irish potatoes, Groundnuts, Sorghum, Millet, Sunflower, Tea, Tomatoes and Cabbage beside Maize and Coffee. It doubles as the R004 proof that a new catalog crop needs no crop-specific code.

T010 adds the single enterprise-type → workflow registry, the release rule and their tests; T011 ships the crop release as data. Local implementation authorization only, not a hosted change or deployment approval. [Evidence](reports/phase-03-t010-2026-10-19.md).

## D-P03-013 — Merge resolution and T011 authorization

APPROVED by direct owner instruction 2026-10-25 (Africa/Nairobi): preserve the local T010 implementation and approved catalog rules, integrate the incoming security update, resolve the merge, then proceed with T011. The selected production baseline is local commit `59ebbfc`, retaining D-P03-010 through D-P03-012, the animal-type catalog, fixed purposes, farm-unique normalized batch labels, T009 screens and the T010 registry. Incoming `498d18b`'s alternate free-text/non-unique poultry implementation and `202610240001_poultry_batches` migration are not selected; they must not be applied alongside the local `202610190001_poultry_batches` migration. Incoming T007/T008 reports remain historical evidence of that alternate implementation, not the current schema or task checkpoint. The incoming Next.js 16.4.3 manifest, lockfile, security-upgrade config and report are retained. No shared database reconciliation, hosted migration, push or deployment is authorized or performed by this resolution.


## D-P03-014 - T013 final season and crop-cycle closure

APPROVED owner clarification 2026-10-25 (Africa/Nairobi), during the instruction to proceed to T013: "Block season closure until its crop cycles are closed (Recommended)". This resolves the missing lifecycle behavior found by the audit, within D-P03-002 final closure/no reopening. Crop cycles retain history when closed and stop reserving active plot area. A season closes only after all its cycles are closed; no cascading closure, reopening, poultry movements or financial totals are introduced. Commands require explicit confirmation, current farm authorization, expected version and atomic audit receipts. Season-level transaction locks serialize crop starts against season closure; crop closure also takes the existing plot lock. UPDATE is limited to lifecycle status/version/updatedAt columns, with ACTIVE-to-CLOSED RLS policies. Prepared provider file `supabase/policies/production-closure-runtime.sql` is local-only pending separately authorized hosted application. [T013 audit](reports/phase-03-closeout-2026-10-25.md).


## D-P03-015 - T013 closeout acceptance and hosted closure policy

APPROVED owner 2026-10-25 (Africa/Nairobi), explicitly selecting "Approve policy and local closeout" after reviewing the concrete T013 report and exact provider file. Phase 3 is COMPLETED - 100% (13/13), PASS WITH CONDITIONS - LOCAL VERIFICATION, under D-P03-004 and the inherited production conditions in the closeout. Applied only `supabase/policies/production-closure-runtime.sql` to development project `sudqhluwsaijvjjcegpv` in one transaction, after capturing prior table/column ACLs and policies. Independent read-only checks confirm runtime UPDATE only for status/version/updatedAt on Season/CropCycle, no table-wide UPDATE, record-field update, DELETE or browser grants; RLS remains enabled. No farmer records, migration history, production settings or application deployment were changed. This does not authorize Phase 4, a push or a production release. [Closeout](reports/phase-03-closeout-2026-10-25.md).

## D-P04-001 — Phase 4 authorization and local CI

APPROVED, owner 2026-10-25 ("proceed to next task", then selecting "Start Phase 4 (Recommended)"). Phase 4 (farm accounting) is authorized on `main` directly from `8c373d1`, with one local commit per completed task. The D-P01-LOCAL-CI-001 substitution extends to Phase 4 as in D-P03-004; GitHub-hosted CI stays **NOT VERIFIED** and must pass before any production release. This does not authorize pushes, deployment, hosted database changes or a production release.

## D-P04-002 — Q09 basis, money and corrections

APPROVED, owner 2026-10-25 (selected "Accrual + cash view" and "Multi-currency, no tax"):

- Accrual is the default reporting basis; a cash-basis view is also available, and every report labels the basis it used.
- Money is an exact decimal amount (numeric(20,4)) with its ISO 4217 currency. Amounts in different currencies are never added together and there is no conversion.
- Tax (VAT, withholding) is out of scope for Phase 4.
- Posted records are never edited; a correction appends a reversal with a reason (and, where needed, a new record).

## D-P04-003 — Q11 recognition and double-count prevention

APPROVED, owner 2026-10-25 (selected "No double count; defer net (Recommended)"):

- A sale or purchase is the single revenue or cost event and opens a receivable or payable.
- Payments only settle receivables and payables; they never create revenue or cost.
- Standalone income and expense records are only for items that are not sales or purchases.

T001 interpretation recorded for owner review: income and expenses are settled when recorded, so anything on credit is a sale or purchase; Phase 4 payments are fully allocated and do not predate the record they settle (no advances). [T001 evidence](reports/phase-04-t001-2026-10-25.md).

## D-P04-004 — Q10 net income deferred

APPROVED, owner 2026-10-25, with D-P04-003. Overhead, depreciation and finance costs, and therefore net farm income, are deferred to Phase 8. Phase 4 computes and shows only figures labelled gross margin (revenue minus direct costs).

## D-P04-005 — T002 catalogs and confirmed interpretations

APPROVED, owner 2026-10-25 ("implement next T002", then selecting "Cash, Mobile Money, Bank (Recommended)", "Confirm all three (Recommended)" and "Crop, Livestock, Eggs, Other (Recommended)"):

- Payment methods: Cash, Mobile Money, Bank transfer.
- Transaction categories: the 13 source cost categories (Seeds, Feed, Fertilizer, Veterinary, Labour, Transport, Fuel, Equipment, Rent, Utilities, Medication, Pesticides, Packaging) and revenue categories Crop sales, Livestock sales, Egg sales and Other income.
- Both catalogs are global reviewed data; like crops (D-P03-012) they change only by a reviewed data-release migration, with no in-app editor in Phase 4.
- The T001 interpretations in D-P04-003 are confirmed: income and expenses are settled when recorded; payments are fully allocated and not dated before what they settle (no advances); attachments wait for the retention/export policy.

## D-P04-006 — T002 accounting persistence

APPROVED by the owner instruction above. T002 adds the additive `202610250002_farm_accounting` migration, the manifest-listed `supabase/policies/farm-accounting-runtime.sql`, the scoped service and the accounting API. Posted history is append-only: the runtime role can insert, and can update only status/version/updatedAt from POSTED to REVERSED when a reversal row exists; there is no DELETE. Applied only to a disposable local container; hosted dev application needs separate authorization. [T002 evidence](reports/phase-04-t002-2026-10-25.md).

## D-P04-007 — R003 crop-cycle matched links

APPROVED, owner 2026-10-26 ("implement T006 -T016. COMMIT AFTER PHASE 04 COMPLETE", then selecting "Same farm + crop-cycle match (Recommended)"). Plot, enterprise and season links must be on the record's farm. A CROP enterprise linked together with a plot and/or season must match one of its crop cycles (any status, so late bills still link). Poultry and other enterprises, and records without an enterprise, need same-farm links only. Activity links remain Phase 6. Enforced by the service and the runtime INSERT policy. [Evidence](reports/phase-04-t006-t015-2026-10-26.md).

## D-P04-008 — R004 enterprise gross margin

APPROVED, owner 2026-10-26 (selected "Enterprise-linked costs (Recommended)"). Enterprise gross margin = revenue linked to the enterprise − costs linked to it. The farm figure is the sum of enterprise margins. Revenue and costs not linked to an enterprise are shown separately and never deducted; overhead, depreciation and finance remain Phase 8 (D-P04-004). Results are per currency and labelled "gross margin", never profit.

## D-P04-009 — R005 CSV export

APPROVED, owner 2026-10-26 (selected "CSV export for farm members"). The money summary can be downloaded as CSV by active farm members only; other users, admins without farm membership and revoked members are denied. Each export is audited (`ACCOUNTING_SUMMARY_EXPORTED`) before the file is returned; formula-like cells are neutralized.

## D-P04-010 — Report filters

APPROVED, owner 2026-10-26 (selected "Date range + basis (Recommended)"). Gross margin and the money summary filter by an inclusive from/to date (either end open) and by basis (accrual default, or cash). Every report states its basis, date range and as-of time; currencies are reported separately.

## D-P04-011 — T006–T016 delivery and single commit

APPROVED by the same owner instruction. T006–T016 are implemented together and committed once after the phase audit, unlike the per-task commits of T001–T005. The T016 closeout records PASS WITH CONDITIONS - LOCAL VERIFICATION and requests owner acceptance; pushing, hosted application of the Phase 4 schema/policy (condition P4-C2) and Phase 5 each need explicit instruction. [Closeout](reports/phase-04-closeout-2026-10-26.md).

## D-P04-012 — Phase 4 closeout acceptance

APPROVED, owner 2026-10-27 (Africa/Nairobi), selecting "Accept and commit (Recommended)" after reviewing the T016 verdict and conditions. Phase 4 is COMPLETED - 100% (16/16), PASS WITH CONDITIONS - LOCAL VERIFICATION under D-P04-001. Conditions: P4-C1 GitHub-hosted CI before any production release; P4-C2 hosted application of migration `202610250002_farm_accounting` and `farm-accounting-runtime.sql` with separate authorization before hosted use of the money screens; P4-C3 report projections/pagination for large histories (Phase 8); P4-C4 export rate limits before real farmer production data. T006–T016 are committed once, locally. This does not authorize a push, hosted changes, a production release or Phase 5. [Closeout](reports/phase-04-closeout-2026-10-26.md).


## D-P05-001 - Phase 5 local start authorization

AUTHORIZED by direct owner instruction 2026-10-29 (Africa/Nairobi): "resume the previus task and proceed with phase progress". Phase 4 is already accepted and locally committed at `b389090`; proceed with Phase 5 planning and sequential local implementation, starting T001. Q12/Q13 business-policy proposals remain pending owner answers; this instruction does not approve those proposals, extend the Phase 4 local-CI closure exception, or authorize pushes, hosted changes or deployment. No Phase 5 task is complete at this checkpoint. [Plan and pending decisions](reports/phase-05-start-2026-10-29.md).

## D-P05-002 - Q12 quantities, storage and valuation

APPROVED, owner 2026-10-29 (Africa/Nairobi), selecting the recommended rules for both quantity and harvest questions: exact decimal quantities up to six places, kilograms for crop harvests, whole birds/eggs, no bag conversion and no negative stock. Require a named same-farm storage location, optional free-text grade and loss separate from gross harvested quantity. Inventory monetary value remains unavailable until an approved Phase 8 costing policy. T001 uses numeric(18,6)-compatible strings, like existing crop areas, without creating a schema. Initial loss may be zero or the full gross harvest; later losses append events. This does not authorize hosted changes or a costing method.

## D-P05-003 - Q13 single stock and accounting sale

APPROVED, owner 2026-10-29, selecting "Approve this approach (Recommended)": a stock-linked sale uses one atomic command for its stock movement and Phase 4 sale; bird sales affect flock count once. Existing accounting-only sales remain unchanged unless explicitly linked. Dependent tasks must specify and test replay, reversal and linking behavior before implementation; T001 adds no sale posting or flock movement.


## D-P05-004 - Complete Phase 5 and task commits

AUTHORIZED by direct owner instruction 2026-10-29: complete T001-T013, commit every completed task, and push after the phase is complete. Commit the already verified T001 first, then continue sequentially. This authorizes the final push of phase commits, but not hosted migrations, deployment or production settings. The existing Phase 4 hosted-CI condition remains; Phase 5 closure must report its own actual verification and any unmet gates.


## D-P05-005 - Hosted CI required before closure

Owner decision 2026-10-29: "Require hosted CI before Phase 5 closes". No Phase 5 local-CI substitution is approved. After the dependency was explained, the owner selected "Allow the verification push after local audit (Recommended)": push after T001-T012 and the local T013 audit pass, then close Phase 5 only after hosted CI passes. This supersedes D-P05-004 push timing only. Failed or unavailable hosted CI keeps T013/phase closure incomplete. No deployment or hosted database mutation is authorized.


## D-P05-006 - Verified Phase 5 closure

IMPLEMENTATION/AUDIT RECORD, 2026-10-29 (Africa/Nairobi), within the owner's D-P05-004 complete-all-tasks instruction and D-P05-005 hosted-CI requirement. T001-T013 and AC001-AC004 pass; Phase 5 is COMPLETED - 100% (13/13), PASS WITH CONDITIONS - HOSTED CI VERIFIED. [Run 40783651036](https://github.com/WilsoftTech/MyFarm/actions/runs/40783651036) succeeds on f999449 after two missing, already-required optional WASM lock entries were restored without changing any existing package version or direct dependency. No local-CI waiver is used. P5-C1 hosted application, P5-C2 large-history measurement and inherited P5-C3 production controls remain; see [closeout](reports/phase-05-closeout-2026-10-29.md). Commits and the verification push are completed under owner authorization. This does not authorize hosted migrations/deployment or Phase 6.

## D-P06-001 - Phase 6 local start authorization

AUTHORIZED by direct owner instruction 2026-11-02 (Africa/Nairobi): "check phase progress and continue. debug and fix errors first". Following D-P05-001, this authorizes starting Phase 6 locally after the regression audit. It does not authorize commits, pushes, deployment or hosted database changes. [T001 report](reports/phase-06-t001-2026-11-02.md).

## D-P06-002 - Q14 missed definition

APPROVED, owner 2026-11-02: an activity is missed once its due date has passed in Africa/Kampala and it is neither completed nor cancelled. It can still be completed late, and the real completion time is recorded. No per-farm timezone in Phase 6.

## D-P06-003 - Q14 recurrence

APPROVED, owner 2026-11-02: every N days, weeks or months with an optional end date, generated about 30 days ahead with one occurrence per due date. A farmer can skip one occurrence or stop the series from a date. Edits affect future occurrences only and history is kept.

## D-P06-004 - Q14 worker and notifications

APPROVED, owner 2026-11-02: an optional free-text worker name, and the signed-in member is always recorded as who completed the activity. No worker role, invitations, worker logins or notifications in Phase 6.

## D-P06-005 - Q15 activity cost link

APPROVED, owner 2026-11-02: an activity can link to an existing same-farm expense or purchase and shows its amount, but holds no money. Only the accounting record counts in totals, and reversals show on the activity. Activities do not create expenses.

## D-P06-006 - T001 activity catalog interpretation

APPROVED by owner 2026-11-03 under D-P06-008; first recorded as an engineering interpretation on 2026-11-02. The catalog keeps the 11 R001 values plus Cleaning from R003. Crop: planting, irrigation, weeding, spraying, fertilizing, harvesting, pruning, inspection. Poultry: vaccination, feeding, cleaning, inspection. Farm-level work may use every value except milking. Enterprise types without a workflow (D-P03-003) offer none. Milking stays in the catalog but is unavailable until a dairy workflow exists, so its R003 recurrence cannot be used in the MVP.

## D-P06-007 - Complete Phase 6 and task commits

AUTHORIZED by direct owner instruction 2026-11-02: commit this work and continue with T002-T010, committing after each task. This does not authorize pushes, deployment or hosted database changes. D-P06-006 was then awaiting owner review; D-P06-008 records the outcome. A later owner instruction, "commit and push", authorized pushing the Phase 6 commits to origin/main; hosted database changes and deployment stay unauthorized.

## D-P06-008 - Owner review of Phase 6 interpretations

APPROVED, owner 2026-11-03 ("yes to all"), answering four questions. Accepted: the activity rules in D-P06-006, including milking being unavailable until a dairy workflow exists; attachments staying deferred under D-P04-005; no correction flow for a completed activity; and allowing completion before the due date. The fourth question asked when to apply the schema to hosted development. The reply names no time, so it is not recorded as approval of any hosted change, and that question stays open as P6-C1.

## D-P06-009 - Verified Phase 6 closure

IMPLEMENTATION/AUDIT RECORD, 2026-11-03 (Africa/Nairobi), within D-P06-007 and D-P06-008. T001-T010 and AC001-AC003 pass in a clean checkout and in [hosted run 41524090703](https://github.com/WilsoftTech/MyFarm/actions/runs/41524090703) at 8d2e415. Phase 6 is COMPLETED - 100% (10/10), PASS WITH CONDITIONS - HOSTED CI VERIFIED. No mandatory test is waived. Conditions P6-C1 to P6-C5 and inherited production conditions remain; see [closeout](reports/phase-06-closeout-2026-11-03.md). Phase 7 is not started.

## D-P06-010 - Hosted development schema application

AUTHORIZED by direct owner instruction 2026-11-03: "now", answering when to apply the Phase 4, 5 and 6 schema to hosted development. Applied after a verified backup, resolving P6-C1, P4-C2 and P5-C1. This covers hosted development project sudqhluwsaijvjjcegpv only, not production or deployment. [Evidence](reports/phase-06-closeout-2026-11-03.md#hosted-application---2026-11-03).

## D-P07-001 - Phase 7 local start authorization

AUTHORIZED by direct owner instruction 2026-11-03: "commit and start next phase", after Phase 6 closed. Authorizes starting Phase 7 locally. It does not authorize pushes, deployment or hosted database changes. [Plan](reports/phase-07-start-2026-11-03.md).

## D-P07-002 - Q16 support limits

APPROVED, owner 2026-11-03: MyFarm supports 14 days offline and up to 500 unsent entries per device, warning as limits approach. Retry records are already permanent, so replay safety outlasts the limit. The limits must be measured on a real device.

## D-P07-003 - Q16 shared phones

APPROVED, owner 2026-11-03: each account's local data is separate and there is no device PIN. Sign-out clears cached farm data but keeps unsent entries, hidden until that account signs in again. Anyone holding a phone that is still signed in can see its cached data.

## D-P07-004 - Photos under an interim rule

APPROVED, owner 2026-11-03: offline photos are built in Phase 7. They attach to an activity or money record, are private to farm members, are images of at most 2 MB after compression, and are kept as long as the record. A full retention policy still comes later. This supersedes the D-P04-005 and D-P06-008 attachment deferral for these photos only.

## D-P07-005 - Q16 lost entries

APPROVED, owner 2026-11-03: request persistent storage, show unsent counts and last sync, warn clearly, and allow downloading unsent entries as a file. The file is not encrypted and the farmer is told so. MyFarm does not claim guaranteed recovery.

## D-P07-006 - Complete Phase 7 and task commits

AUTHORIZED by direct owner instruction 2026-11-03: "commit T001 and continue with T002-T013", committing after each task. This does not authorize pushes, deployment or hosted database changes.

## D-P07-007 - Sync persistence design

ENGINEERING DECISION 2026-11-03, within D-P07-006, reversing proposals in the Phase 7 specification with reasons. No `MutationReceipt` table: existing receipts in `AuditEvent`, unique per tenant, request and action and held permanently, already give replay, and a check now refuses the same key on a different operation. No `ChangeLog` or tombstones: records are only appended or change status, so pull reuses the authorized list services and cannot skip a late commit. No `DeviceRegistration`: the device ID is a local hint and grants nothing, so it stays on the phone. Each has a concrete trigger to revisit: hard deletes, a need to sync much more than the bounded recent rows, or device-level revocation.

## D-P07-008 - Phase 7 implementation record

IMPLEMENTATION/AUDIT RECORD, 2026-11-03 (Africa/Nairobi), within D-P07-006. T001-T013 and AC001-AC004 pass from a clean checkout at 30f2aaf. Recommended verdict: PASS WITH CONDITIONS - LOCAL VERIFICATION, awaiting owner acceptance. The approved duration has not been measured on a real device and hosted CI has not run, because nothing has been pushed. No hosted database or deployment changed. See [closeout](reports/phase-07-closeout-2026-11-03.md).

## D-P07-009 - Phase 7 owner acceptance and hosted CI repair

APPROVED, owner 2026-11-03 (Africa/Nairobi), selecting "Accept, push fix, start (Recommended)". Phase 7 is accepted as PASS WITH CONDITIONS, with P7-C1 and P7-C3 to P7-C6 still open. The owner had pushed the Phase 7 commits, and hosted run [41585234003](https://github.com/WilsoftTech/MyFarm/actions/runs/41585234003) at 2c7714b failed: 145 of 146 signed-in browser tests passed, and D-P07-003 on desktop timed out after 120 seconds. The downloaded trace shows every assertion passed by 15 seconds. The rest was spent in `server.stop()`, which waited on `exit` with no limit while `next start` handled SIGTERM by waiting for connections the open page held. Windows `kill()` is immediate, so local audits could not see it. Fix 0298f20 stops the test server with SIGKILL and skips one that has already exited; no assertion changed. The owner authorized pushing this fix. Hosted run [41589795797](https://github.com/WilsoftTech/MyFarm/actions/runs/41589795797) at 0298f20 passed: 990 unit/component, 272 integration, 135 non-UTC, 60 anonymous and 146 signed-in browser tests. **P7-C2 is resolved.** The signed-in suite fell from 13.7 to 7.6 minutes.

## D-P08-001 - Phase 8 start and task commits

AUTHORIZED, owner 2026-11-03: "proceed to next phase", then "Commit per task, no push (Recommended)". Phase 8 starts locally with one commit per verified task. This does not authorize further pushes, deployment or hosted database changes.

## D-P08-002 - Q10 recorded surplus

APPROVED, owner 2026-11-03, selecting "Recorded surplus, no split (Recommended)". Each enterprise shows gross margin as defined by D-P04-008. The farm shows **recorded surplus**: all recognized revenue minus all recognized costs, including those linked to no enterprise, so overhead cannot disappear. Shared costs are shown separately and are not allocated to enterprises. Screens state that depreciation and loan costs are not included. Nothing is labelled net profit, and net income stays unbuilt. The source's "Margin" is recorded surplus divided by revenue.

## D-P08-003 - Optional batch link on costs

APPROVED, owner 2026-11-03, selecting "Add optional batch link (Recommended)". Expenses and purchases gain an optional poultry batch, online and offline, through an additive schema change. This enables cost per bird and previous-batch trends. Older or unlinked costs show as not linked to a batch, and that batch's cost figures say they may be incomplete. Hosted use needs a separate owner step.

## D-P08-004 - Q12 stock value

APPROVED, owner 2026-11-03, selecting "Estimate at last sale price (Recommended)". Stock value is the quantity in stock multiplied by that item's most recent sale price that has not been reversed, labelled as an estimate with the sale date, in that sale's currency. It is not available for an item never sold. It is kept out of surplus and margin, so unsold stock never counts as earnings. This is not a costing method.

## D-P08-005 - Q17 crop formulas

APPROVED, owner 2026-11-03, selecting "Convert to acres; net kg (Recommended)". All area converts to acres with exact factors (1 acre = 4,046.8564224 square metres; 1 hectare = 10,000 square metres), adding each crop cycle's planted area once. Yield per acre uses gross harvested kg. Cost per kg and break-even price (costs divided by kg) use kg after recorded loss. A cycle still active is labelled "so far".

## D-P08-006 - Q17 bird formulas

APPROVED, owner 2026-11-03, selecting "Birds started (Recommended)". Birds started is the batch's starting quantity plus later bird purchases. Mortality rate, cost per bird and revenue per bird all divide by it. An active batch is labelled "so far".

## D-P08-007 - Q17 missing values and trends

APPROVED, owner 2026-11-03, selecting "Not available, like with like (Recommended)". A zero or missing denominator or baseline shows "Not available" with a plain reason, never 0. Trends compare only the same crop in an earlier season, or the same animal type's earlier batch, in the same currency and unit. Percentages round half-up to one decimal (100,000 to 118,000 is +18%). A trend warns when either side has unlinked costs.

## D-P08-008 - Q17 season scope and freshness

APPROVED, owner 2026-11-03, selecting "Linked records, live (Recommended)". A season view counts only records linked to that season and shows the amount linked to no season, so nothing is guessed from dates or counted twice. It defaults to the latest active season, and a date-range view stays available. Figures are calculated live from records with an as-of time, so the proposed `MetricSnapshot` and `ReportDefinition` tables are not built. With no connection the dashboard says it needs a connection and points to offline work. Entries not yet sent are not counted.

## D-P08-009 - Labour and input cost groups

APPROVED, owner 2026-11-04, selecting "Labour + 6 inputs (Recommended)". Labour is Labour. Inputs are Seeds, Feed, Fertilizer, Veterinary, Medication and Pesticides. Transport, Fuel, Equipment, Rent, Utilities and Packaging belong to neither group and still count as costs everywhere else. Groups are stored on the category as reference data, changed only by reviewed release.

## D-P08-010 - Enterprises with more than one crop

APPROVED, owner 2026-11-04, selecting "Not available, say why (Recommended)". When an enterprise has more than one crop in the view, per-acre and per-kg figures show "Not available" with that reason, because costs link to the enterprise and season rather than to one crop. Gross margin still shows.

## D-P08-011 - Q17 formula catalog

APPROVED, owner 2026-11-04, selecting "Approve as listed (Recommended)". The [formula catalog](architecture/metric-formulas.md) and its worked examples are approved and are the test fixtures. Figures are calculated exactly and rounded only for display. Money per unit and kg per acre show up to two decimals, rounded half-up. Cost per kg and break-even price are one calculation, shown as one figure with both names. No accountant or agronomist has reviewed the catalog, so that review stays open for the field pilot.

## D-P08-012 - Finish and push Phase 8

AUTHORIZED, owner 2026-11-07: "complete phase 8. and push it". Work continues from T007 with one commit per verified task, and the Phase 8 commits may be pushed to `origin/main` so hosted CI can run. This does not authorize applying migration `202611040001` or any runtime policy to the hosted database, or any deployment change; those stay separate owner steps.

## D-P08-013 - Phase 8 closeout recommendation

PROPOSED, engineering agent 2026-11-08, AWAITING OWNER ACCEPTANCE. Phase 8 is recommended as PASS WITH CONDITIONS - LOCAL VERIFICATION: T001-T013 and AC001-AC004 pass from a clean checkout of af8defd on a fresh database ([closeout](reports/phase-08-closeout-2026-11-08.md)). Conditions P8-C1 (hosted schema step, needed before hosted use of this code) to P8-C5 need the owner's acceptance. The commits were pushed under D-P08-012 (0298f20..430dd8a), and hosted run [42415795028](https://github.com/WilsoftTech/MyFarm/actions/runs/42415795028) passed, so the recommendation is now PASS WITH CONDITIONS - HOSTED CI VERIFIED. Nothing was applied to the hosted database.

## D-P08-014 - Phase 8 owner acceptance

APPROVED, owner 2026-11-09: "approved", in reply to the Phase 8 closeout. Phase 8 is accepted as PASS WITH CONDITIONS - HOSTED CI VERIFIED ([closeout](reports/phase-08-closeout-2026-11-08.md)), with P8-C1 to P8-C5 open. This does not authorize applying migration `202611040001` to the hosted database (P8-C1) or starting Phase 9; each needs its own instruction. Hosted run 42416834117 on the docs-only commit 2a8a423 failed on a timing assumption in a Phase 7 browser test; the test now waits for the send to settle, with no application change.

## D-P08-015 - Hosted schema for Phases 7 and 8

AUTHORIZED, owner 2026-11-09: "IMPLEMENT P8-C1-C5", then "Apply both, with backup (Recommended)". Prisma applies pending migrations in order, so P8-C1 also applies the Phase 7 photo migration (P7-C3). Apply `202611030001_record_photos` and `202611040001_metric_links` to hosted development and rerun the full `supabase/provisioning.json` list, after a full backup whose restore is checked. No production system or deployment change.

## D-P08-016 - Season on offline money entries (P8-C3)

APPROVED, owner 2026-11-09, selecting "Optional, blank by default (Recommended)". Phones cache the farm's seasons, and the offline expense and income forms offer an optional season that starts blank. Left blank, the entry is "not linked to a season", as online, so nothing is guessed (D-P08-008). The seasons section is added last to the pull list, so cursors already on phones keep their meaning.

## D-P08-017 - Trend and warning choices (P8-C5)

APPROVED, owner 2026-11-09, selecting "Most recent earlier (Recommended)" and "Accept all as built (Recommended)". A crop is compared with the most recent earlier season that grew it, whatever time of year; two batches started on the same day are not compared; crop trends need a season and are not shown for a date range; the reconciliation warning keeps its wording. These are no longer engineering choices awaiting review. The accountant and agronomist review (P8-C2) may still raise them.

## D-P09-001 - Phase 9 start, commits and pushes

AUTHORIZED, owner 2026-11-09: "commit push and proceed to next phase", then "Build tools now, gate real farmers (Recommended)". Phase 9 software is built with one commit per verified task, and the commits may be pushed to `origin/main`. **No real farmer is enrolled** until the pilot-start checklist is cleared: P7-C4 retention and export policy, P7-C6, P4-C4 and P5-C3 abuse and rate controls, Phase 1 C4 production sign-in and TLS settings, and P7-C1 real-phone measurement; P8-C2 before the pilot relies on the figures. Hosted database changes and deployment still need their own instruction.

## D-P09-002 - Q18 cohort and window

APPROVED, owner 2026-11-09, selecting "~25 farmers, one season (Recommended)". About 25 consenting farmers, crop and poultry mixed, followed for one main season of about 16 weeks so that complete production cycles can be observed.

## D-P09-003 - Q18 active and retained

APPROVED, owner 2026-11-09, selecting "1 record/week; 3 of 4 weeks (Recommended)". An active week is one in which the farmer saved at least one record, counted once by its server receipt so retries never inflate it. A farmer is retained in a week when active in at least 3 of the last 4 weeks.

## D-P09-004 - Q18 go/no-go threshold

APPROVED, owner 2026-11-09, selecting "50% retained at week 8 (Recommended)". The recurring-use gate passes when at least half of onboarded farmers are retained voluntarily at week 8 and again at the end of the window. Staff prompts are logged, and a week in which staff prompted a farmer does not count as voluntary for that farmer.

## D-P09-005 - Pilot-start gate

APPROVED, owner 2026-11-09, as part of D-P09-001: the conditions listed there must be cleared before any real farmer joins. This is the Phase 9 pilot-start checklist.

## D-P09-006 - Enrolment and consent

APPROVED, owner 2026-11-09, selecting "Farmer joins in-app with a code (Recommended)". Pilot staff give a farmer the cohort's code; the signed-in farmer reads plain consent text and joins, and can withdraw at any time in the app. Staff record the paper consent reference.

## D-P09-007 - What pilot staff see

APPROVED, owner 2026-11-09, selecting "Aggregates and pseudonyms (Recommended)". ADMIN members of the organization running the cohort see the measures for the cohort and, per participant, only a pseudonym with weekly activity counts. They never see names, phone numbers, money amounts or farm records; ADMIN still has no automatic farm-data access.

## D-P09-008 - Offline and sync measures

APPROVED, owner 2026-11-09, selecting "Server-side, counted once (Recommended)". The push service logs each entry it commits from a phone and each it refuses, once per entry. Attempts that never reached the server are not counted, and reports say so. The sync contract does not change.

## D-P09-009 - Withdrawal

APPROVED, owner 2026-11-09, selecting "Excluded from every measure (Recommended)". From the moment a farmer withdraws, none of their activity counts in any measure, past or future, and their pseudonym disappears from staff views. Their own farm records are untouched.

## D-P09-010 - Phase 9 status after the build

ACCEPTED, owner 2026-11-10, selecting "Clear checklist (Recommended)" when asked to continue to the next phase. Proposed by the engineering agent 2026-11-10. The Phase 9 software is complete: T001-T007 and AC001-AC002 pass from a clean checkout ([closeout](reports/phase-09-closeout-2026-11-10.md)). The exit gate, recurring unforced use by real farmers (P0566), is **not met**, because no real farmer has used the pilot; the tools exist and the evidence does not. Recommended status: implementation complete, exit gate pending the real pilot. Phase 9 stays open and Phase 10 must not start (P0569). The pilot may start only after the checklist in D-P09-005 and the closeout is cleared.

## D-P09-011 - Pilot-start checklist work

AUTHORIZED, owner 2026-11-10, selecting "Clear checklist (Recommended)" after being told Phase 10 cannot start before the Phase 9 exit gate. Scope: apply the two pilot migrations and the provisioning list to hosted development after a verified backup; prepare proposals for P7-C4 retention and export and for P7-C6, P4-C4 and P5-C3 rate controls, and a real-phone test plan for P7-C1. Phase 10 stays blocked. Done the same day: hosted development now has 21 migrations with existing data unchanged; the proposals await owner decisions. [Pilot-start pack](reports/phase-09-pilot-start-pack-2026-11-10.md).

## D-P09-012 - Retention policy (P7-C4)

APPROVED, owner 2026-11-10, selecting "Approve as written (Recommended)" for section 2 of the [pilot-start pack](reports/phase-09-pilot-start-pack-2026-11-10.md#2-p7-c4-how-long-data-is-kept-and-how-a-farmer-gets-it-out). Farmer profile, farm details, GPS and farm records are kept while the account is open and deleted within 30 days of a confirmed closure request, after the farmer is offered an export. The audit trail is kept for 24 months. Pilot usage counts, reminders, incidents, observations, findings and reviews are kept until the pilot decision plus 12 months, after which only cohort totals with no code names remain (in the closeout report). A withdrawn farmer is excluded from every measure at once and their pilot rows are deleted at the end-of-pilot clean-up. Entries sent from a phone are kept on the phone for 7 days. Engineering copies of hosted data are deleted 30 days after the change they protected is verified. The policy replaces the interim photo rule (D-P07-004): a photo still lives as long as its record. MyFarm makes no legal compliance claim; a qualified local reviewer should read the policy before the pilot. Deletions are carried out as reviewed operations, never by an unattended job, until the owner approves automation.

## D-P09-013 - Full farm export before the pilot

APPROVED, owner 2026-11-10, selecting "Build it before pilot (Recommended)". A farm owner can download everything on their farm: one CSV per record type plus their photos. It is a data right under D-P09-012, not a new farming feature, so the feature freeze (P0541) holds. Built as one engineering task with tests; committed and pushed under D-P09-001.

## D-P09-014 - Abuse and rate controls (P7-C6, P4-C4, P5-C3)

APPROVED, owner 2026-11-10, selecting "Approve and build (Recommended)" for section 3 of the [pilot-start pack](reports/phase-09-pilot-start-pack-2026-11-10.md#3-p7-c6-p4-c4-p5-c3-limits-against-abuse-and-runaway-phones). Each person's requests are counted per action in one table on the database clock; a retry of the same request is free; over the limit the app answers HTTP 429 with the existing message, and phones keep their entries queued. Limits: join with a code 5 wrong codes in 15 minutes and 20 a day; phone push 30 a minute; phone pull 60 a minute; photo upload 30 an hour and 200 a day; private-file reads 30 a minute (unchanged); money summary export 10 an hour; full farm export 3 a day; any other form save 120 a minute; pilot staff logs and reviews 60 a minute. Count rows older than a day are removed. One additive migration, no new package; applied to hosted development after a verified backup, as D-P09-011.

## D-P09-015 - Consent words, English

APPROVED, owner 2026-11-10, selecting "Approve English 1-8". The seven draft points and the added point 8 ("The team keeps the counts for up to a year after the pilot ends, then keeps only totals with no code names.") become version `pilot-consent-v1`. Languages and the real speaker who checks each translation are not yet named; no translation may be shown to farmers until it is checked (AGENTS.md section 12). Cohorts made under the draft version cannot be joined; staff make new cohorts.

## D-P09-016 - Phone pull limit raised to 600 a minute

APPROVED, owner 2026-11-10, selecting "Raise to 600 a minute (Recommended)". While building D-P09-014, engineering found that every signed-in page open refreshes the phone's saved copies, at least 12 pull pages per farm, so the approved 60 a minute stopped a farmer opening about 5 pages a minute; the signed-in browser suite failed 22 offline tests on it. The phone pull limit is now 600 pages a minute; phone behavior is unchanged and every other D-P09-014 number stands.

## D-P09-017 - Phase 9 closes on its exit gate; Phase 10 held

DECIDED, owner 2026-11-11. Asked how to close Phase 9 and whether to build Phase 10 ahead of the pilot, the owner answered "close phase 9 when complete and implement next phase" and selected "Hold Phase 10". Phase 9 is not closed now: it closes only when its exit gate is met by the real pilot (D-P09-003, D-P09-005), with the closeout committed and pushed then. Phase 10 does not start until that closure; the pilot's feature freeze (P0541) stays in force. Until then, work continues on the pilot-start checklist.
