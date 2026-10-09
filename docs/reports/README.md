# Reports and evidence

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase02 closeout; content and status updated from verified evidence; no completion inferred from review alone.
- Implementation status: REFERENCE ONLY — N/A (navigation/protocol/template/decision/evidence record; no directly implementable scope).
- Last reviewed: 2026-10-09 (Africa/Nairobi), Phase1+2 integration and provisioning-hardening session.
- Related phase/task IDs: Phase01 review session; MYF-P01-T001 through MYF-P01-T013; Phase00 owner acceptance where referenced; Phase02 review session (MYF-P02-T001–T013).
- Verified completed work: Reference content/status/evidence links reviewed; document existence or review does not complete implementation tasks.
- Remaining work/blockers: Maintain alignment with the Phase02 closeout; historical sections stay historical; Phase3 not authorized.
- Evidence/report links: [Phase1+2 integration](phase-01-02-integration-2026-10-09.md); [Phase02 closeout](phase-02-closeout-2026-10-09.md); [Phase02 every-document review](phase-02-document-review-2026-10-09.md); [Phase01 closeout](phase-01-closeout-2026-10-08.md); [every-document review](phase-01-document-review-2026-10-08.md); [latest provider/security report](phase-01-provider-verification-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Current reports: [source extract](source-extract.md), [source analysis](source-analysis.md) and [documentation audit](documentation-audit.md). These establish documentation evidence only, not implemented product capabilities.

Future report names: phase-NN-audit-YYYY-MM-DD.md, phase-NN-closeout-YYYY-MM-DD.md, incident-YYYY-MM-DD.md and restore-drill-YYYY-MM-DD.md. Use [audit](../engineering/phase-audit-template.md) and [closeout](../engineering/phase-closeout-template.md). Store redacted logs/artifact references with environment/commit/time/command/exit status; raw sensitive evidence remains access controlled, not public docs.

Never fabricate results, farmer interviews or approvals. A report lists requirement/task/AC coverage, files/schema/API, security, tests and migration status, limitations/deferred work, verdict and owners. Blocking defects prevent closure. Update [status](../PROJECT-STATUS.md) only after verification.

## Phase 0 execution reports — 2026-10-08

[Interim phase audit](phase-00-audit-2026-10-08.md), [closeout](phase-00-closeout-2026-10-08.md), and [document review register](phase-00-document-review-2026-10-08.md) record preparation, Rukungiri selection, truthful 0/10 progress and missing research/approval. The original [documentation audit](documentation-audit.md) is historical blueprint evidence, not proof of Phase 0 implementation completion.

## Current Phase1 evidence

**Final closure:** [Phase01 local verification and final closeout](phase-01-local-verification.md) — PASS WITH CONDITIONS — LOCAL VERIFICATION, 13/13, verified code commit `bd9fadc`; [evidence folder](evidence/phase-01-local-verification/). GitHub-hosted CI not verified (D-P01-LOCAL-CI-001). Entries below are historical.

[Closeout](phase-01-closeout-2026-10-08.md), [audit](phase-01-audit-2026-10-08.md), [document review](phase-01-document-review-2026-10-08.md), [exact checks](evidence/phase-01-2026-10-08/checks.json). Phase1 BLOCKED30.77%;54 unit/component/browser tests plus10 real DB tests pass. No hosted provider/CI/deployment proof.

Phase0 is now [owner-accepted100%](phase-00-owner-approval-2026-10-08.md); earlier zero-research/FAIL reports remain historical and are not rewritten as passing empirical evidence.

Latest evidence: [provider/security follow-up](phase-01-provider-verification-2026-10-08.md),48 unit/component,10 integration,14 browser tests and all mandatory local gates PASS. Live provider/CI/deployment gates remain incomplete.

Resumed Phase1 evidence:51 unit/component tests and mandatory local gates PASS; active MCP tools and trusted-CA provider verification remain unavailable. Phase remains BLOCKED30.77%. [Resumed evidence](phase-01-provider-verification-2026-10-08.md).

## Current live verification and decision record

Phase 01 BLOCKED — 76.92% (10/13 verified task IDs). Verdict: FAIL. Completed T001–T010. Remaining T011–T013: hosted CI and dependency-gated final closure. Protected preview builds and live authenticated hosted verification succeeds; CI startup failure prevents completion.

**Superseded 2026-10-08 (local verification closeout):** Phase 01 COMPLETED — 100% (13/13). Verdict PASS WITH CONDITIONS — LOCAL VERIFICATION at `bd9fadc`; GitHub-hosted CI blocked by account billing lock and not verified (owner exception D-P01-LOCAL-CI-001, Phase 1 only). [local verification report](phase-01-local-verification.md).

Live Supabase Auth and private storage:28 checks PASS. Current membership/session revocation, tenant isolation, private downloads, secure cookies, concurrent idempotency and recovery token generation verified. Temporary test users/files/database fixtures removed. Lint/typecheck/build/boundaries PASS0;58 unit/component tests and11 PostgreSQL integration tests PASS. Rate limiter:30 distinct private-file grants/actor/minute, shared transaction advisory lock, identical retries free, database clock window; concurrent boundary and expired-window test PASS. Same-origin authority handling repaired after real browser verification exposed Next.js internal hostname normalization. TLS URL overrides stripped; verified client-to-pooler TLS and Supabase CA. Pooler-to-database pg_stat_ssl reports false; no end-to-end provider-managed transport claim.

Prisma migrations202610080001_foundation and202610080101_private_grant_rate_limit applied in isolated Supabase development project sudqhluwsaijvjjcegpv. Foundation applied via MCP then Prisma history reconciled; additive actor/time index generated by Prisma diff and deployed by Prisma CLI. Provider SQL artifacts in supabase/policies: private-storage, foundation-hardening and runtime-role. Five provider-specific MCP migrations recorded separately. Runtime role has SELECT foundation tables/INSERT audits, no direct auth.sessions read, no update/delete/DDL/bypass-RLS. LOGIN explicitly approved; password kept in ignored local configuration and explicitly approved preview secret. Auth frontend denied application tables; private session boolean restricted to backend role. Security advisors: no WARN/ERROR, only intentional deny-all _prisma_migrations RLS INFO. Performance: newly created tenant/date index unused INFO, no missing FK index. No new application dependencies; existing Supabase versions pinned exactly.

API change: same-origin private-file requests work with actual HTTP authority; excessive distinct grants return429 RATE_LIMITED. Offline sync, financial/stock writes, farmer registry and AI are NOT APPLICABLE to Phase1 and remain unimplemented. Restore/replay evidence from preceding isolated synthetic rehearsal remains applicable. Recovery email delivery and production operational settings are not claimed; production release must verify them. Source research remains absent despite Phase0 owner acceptance.

[Current closeout](phase-01-closeout-2026-10-08.md).

## Current Phase2 evidence (2026-10-09)

Phase 02 **COMPLETED — 100% (13/13 verified task IDs)**, verdict **PASS WITH CONDITIONS — LOCAL VERIFICATION** (2026-10-09). The farmer registry is implemented, with live verification against real Supabase Auth and the restricted runtime DB role in the isolated dev project ([D-P02-005](../DECISION-LOG.md#d-p02-005--hosted-development-verification-for-phase-2)):

- **Journey:** register → farm → plots → profile verified in a real mobile browser.
- **Local CI reproduction** under [D-P02-006](../DECISION-LOG.md#d-p02-006--phase-2-local-ci-substitution): lint 0 warnings, typecheck, 117 unit/component, 33 PostgreSQL integration, build and 24 E2E tests PASS.
- **Database:** 10/10 checks incl. restore.
- **Live and probes:** 48/48 live and 49/49 anonymous production probes PASS.
- **Hygiene:** npm audit 0; no secrets found.

Phase 1 conditions C3 (migration order) and C5 (anonymous streamed redirect) are resolved. **GitHub-hosted CI remains NOT VERIFIED.** Conditions P2-C1–P2-C8 are listed in the [closeout](../reports/phase-02-closeout-2026-10-09.md#6-conditions-nonblocking-owner-tracked-limitations-and-deferred-work). Phase 3 is NOT STARTED and not authorized.

[Phase2 closeout](phase-02-closeout-2026-10-09.md), [every-document review](phase-02-document-review-2026-10-09.md), [evidence folder](evidence/phase-02-2026-10-09/) (ci-run-e065e7a, ci-run-final, database, hosted, security, harness). The [interim 2026-10-08 Phase2 closeout](phase-02-closeout-2026-10-08.md) (BLOCKED 15.38%, FAIL) is historical and superseded.

## Phase 1+2 integration and provisioning hardening (2026-10-09)

[Integration report](phase-01-02-integration-2026-10-09.md), [evidence folder](evidence/integration-2026-10-09/): integration refs and deploy watches, read-only hosted browser-role review, clean-clone CI run on `5545257`, provisioning mutation checks, Supabase-image run, sign-in journey, npm audit and secret scan. GitHub-hosted CI remains NOT VERIFIED.
