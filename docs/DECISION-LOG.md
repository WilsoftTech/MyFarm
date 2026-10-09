# Decision log

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase02 closeout; content and status updated from verified evidence; no completion inferred from review alone.
- Implementation status: REFERENCE ONLY — N/A (navigation/protocol/template/decision/evidence record; no directly implementable scope).
- Last reviewed: 2026-10-10 (Africa/Nairobi), hosted provisioning application and Phase 2 completion check.
- Related phase/task IDs: Phase01 review session; MYF-P01-T001 through MYF-P01-T013; Phase00 owner acceptance where referenced; Phase02 review session (MYF-P02-T001–T013).
- Verified completed work: Reference content/status/evidence links reviewed; document existence or review does not complete implementation tasks.
- Remaining work/blockers: Phase3 authorized (D-P03-001), NOT STARTED; Step B is on main (756f3c4) and applied to hosted dev (D-INT-003); historical sections stay historical.
- Evidence/report links: [Phase1+2 integration report](reports/phase-01-02-integration-2026-10-09.md); [Phase02 closeout](reports/phase-02-closeout-2026-10-09.md); [Phase02 every-document review](reports/phase-02-document-review-2026-10-09.md); [Phase01 closeout](reports/phase-01-closeout-2026-10-08.md); [every-document review](reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](reports/phase-01-provider-verification-2026-10-08.md).
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
