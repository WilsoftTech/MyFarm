# MyFarm engineering implementation blueprint

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — current Phase01 implementation/evidence/status review; no completion inferred from review.
- Implementation status: REFERENCE ONLY — N/A (navigation/protocol/template/decision/evidence record; no directly implementable scope).
- Last reviewed: 2026-10-08 (Africa/Nairobi), live provider and hosted closeout session.
- Related phase/task IDs: Phase01 review session; MYF-P01-T001 through MYF-P01-T013; Phase00 owner acceptance where referenced.
- Verified completed work: Reference content/status/evidence links reviewed; document existence or review does not complete implementation tasks.
- Remaining work/blockers: Maintain alignment after Phase01 live verification; historical results stay historical and source body remains immutable.
- Evidence/report links: [Phase01 closeout](reports/phase-01-closeout-2026-10-08.md); [every-document review](reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](reports/phase-01-provider-verification-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Start here. Phase0 is COMPLETED — 100% by explicit owner acceptance; no empirical farmer research is claimed. The user authorized Phase1 and selected Supabase PostgreSQL + Supabase Auth. Phase1 foundation is implemented locally and BLOCKED — 30.77% (4/13 verified task IDs), pending live provider/CI/deployment evidence. Phases2–24 remain NOT STARTED — 0%. See [Phase1 closeout](reports/phase-01-closeout-2026-10-08.md) and [local setup](engineering/foundation-local-setup.md).

## Reading and execution order

Read [status](PROJECT-STATUS.md), [roadmap](MASTER-IMPLEMENTATION-ROADMAP.md), [traceability](REQUIREMENTS-TRACEABILITY.md), [decisions](DECISION-LOG.md), then relevant product/architecture and phase A–O. Future coding agents follow [agent protocol](engineering/ai-agent-instructions.md). Documentation is not approval of proposed schemas/providers or proof of discovery.

Source is retained as [complete paragraph-located extract](reports/source-extract.md), with original file hash and normalized product name. [Source analysis](reports/source-analysis.md) explains collisions, gaps and recommendations. [Audit](reports/documentation-audit.md) records actual documentation verification, separate from unrun app checks.

## Directory map

```text
docs/
  README.md
  MASTER-IMPLEMENTATION-ROADMAP.md
  PROJECT-STATUS.md
  DECISION-LOG.md
  REQUIREMENTS-TRACEABILITY.md
  product/          11 Markdown documents
  architecture/     14 Markdown documents
  phases/           25 phase-00 through phase-24 specifications
  engineering/      11 Markdown documents
  reports/          12 Markdown documents
```

[Product requirements](product/product-requirements.md), [MVP scope](product/mvp-scope.md), [field research](product/field-research.md), [system architecture](architecture/system-architecture.md), [financial integrity](architecture/financial-integrity.md), [sync](architecture/offline-sync-architecture.md), [auth](architecture/authentication-authorization.md), [testing](architecture/testing-strategy.md) and [done policy](engineering/definition-of-done.md) are the core references. Roadmap links every phase; audit inventories every required file.

## Milestones and immediate start

MVP Phase0–8 is registry, farm/production/accounting/inventory/calendar/offline/profitability. Phase9 pilots real recurring use. Intelligence, AI/voice/weather, institutions, commerce/payments, partner finance, vision/trace/forecasts and commercial scale follow.

Immediate path is Phase0 →1 →2 →3 →4. Phase0 was explicitly accepted by the user; finish Phase1 provider/CI/deployment evidence before requesting the next phase. Missing farmer research remains a product risk. No customer interviews/results, regulatory approvals, live provider support or passing application tests are fabricated.

## Historical Phase0 preparation session

First district **Rukungiri**, confirmed by the user. Prepared [research pack](product/research-operations.md), [empty evidence register](product/research-evidence-register.md), [pending decision memo](product/discovery-decision.md), [status policy](engineering/document-status-policy.md), [interim audit](reports/phase-00-audit-2026-10-08.md), [closeout](reports/phase-00-closeout-2026-10-08.md) and [every-document review register](reports/phase-00-document-review-2026-10-08.md). That earlier preparation session had71 Markdown files and no Phase1 implementation. Current inventory is78 documents; Phase1 local implementation/evidence is linked below.

## Current owner authorization

Phase0 is **COMPLETED — 100% by explicit owner acceptance**, with no empirical farmer research claimed. Phase1 is authorized immediately. This supersedes earlier Phase0-only/advance-gate restrictions in this document. Read [owner approval](reports/phase-00-owner-approval-2026-10-08.md). Later-phase implementation and technical-check waivers are not implied.


## Phase1 session navigation

[Closeout](reports/phase-01-closeout-2026-10-08.md), [audit](reports/phase-01-audit-2026-10-08.md), [every-document review](reports/phase-01-document-review-2026-10-08.md), [dependencies](engineering/foundation-dependencies.md), [setup](engineering/foundation-local-setup.md). Directory counts are maintained in the session review inventory.

Latest Phase1 work: [provider verification and security remediation](reports/phase-01-provider-verification-2026-10-08.md). OAuth succeeded; reload the chat to load MCP tools. Local checks pass; Phase1 remains BLOCKED30.77%.

Resumed Phase1:51 unit/component tests and all mandatory local checks pass. Live connectivity and MCP-tool availability remain blocked; Phase1 is30.77% verified. [Resumed evidence](reports/phase-01-provider-verification-2026-10-08.md).

## Current live verification and decision record

Phase 01 BLOCKED — 76.92% (10/13 verified task IDs). Verdict: FAIL. Completed T001–T010. Remaining T011–T013: hosted CI and dependency-gated final closure. Protected preview builds and live authenticated hosted verification succeeds; CI startup failure prevents completion.

Live Supabase Auth and private storage:28 checks PASS. Current membership/session revocation, tenant isolation, private downloads, secure cookies, concurrent idempotency and recovery token generation verified. Temporary test users/files/database fixtures removed. Lint/typecheck/build/boundaries PASS0;58 unit/component tests and11 PostgreSQL integration tests PASS. Rate limiter:30 distinct private-file grants/actor/minute, shared transaction advisory lock, identical retries free, database clock window; concurrent boundary and expired-window test PASS. Same-origin authority handling repaired after real browser verification exposed Next.js internal hostname normalization. TLS URL overrides stripped; verified client-to-pooler TLS and Supabase CA. Pooler-to-database pg_stat_ssl reports false; no end-to-end provider-managed transport claim.

Prisma migrations202610080001_foundation and202610080101_private_grant_rate_limit applied in isolated Supabase development project sudqhluwsaijvjjcegpv. Foundation applied via MCP then Prisma history reconciled; additive actor/time index generated by Prisma diff and deployed by Prisma CLI. Provider SQL artifacts in supabase/policies: private-storage, foundation-hardening and runtime-role. Five provider-specific MCP migrations recorded separately. Runtime role has SELECT foundation tables/INSERT audits, no direct auth.sessions read, no update/delete/DDL/bypass-RLS. LOGIN explicitly approved; password kept in ignored local configuration and explicitly approved preview secret. Auth frontend denied application tables; private session boolean restricted to backend role. Security advisors: no WARN/ERROR, only intentional deny-all _prisma_migrations RLS INFO. Performance: newly created tenant/date index unused INFO, no missing FK index. No new application dependencies; existing Supabase versions pinned exactly.

API change: same-origin private-file requests work with actual HTTP authority; excessive distinct grants return429 RATE_LIMITED. Offline sync, financial/stock writes, farmer registry and AI are NOT APPLICABLE to Phase1 and remain unimplemented. Restore/replay evidence from preceding isolated synthetic rehearsal remains applicable. Recovery email delivery and production operational settings are not claimed; production release must verify them. Source research remains absent despite Phase0 owner acceptance.

[Current closeout](reports/phase-01-closeout-2026-10-08.md).
