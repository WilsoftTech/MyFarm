# MyFarm engineering implementation blueprint

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase01 status, applicability and evidence/link review; affected content reconciled; no independent farmer validation or hosted verification.
- Implementation status: REFERENCE ONLY — N/A (navigation/protocol/template/decision/evidence record; no directly implementable scope).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase01 implementation session.
- Related phase/task IDs: Phase01 review session; MYF-P01-T001 through MYF-P01-T013; Phase00 owner acceptance where referenced.
- Verified completed work: Reference content/status/evidence links reviewed; document existence or review does not complete implementation tasks.
- Remaining work/blockers: Maintain alignment after Phase01 live verification; historical results stay historical and source body remains immutable.
- Evidence/report links: [Phase01 closeout](reports/phase-01-closeout-2026-10-08.md); [every-document review](reports/phase-01-document-review-2026-10-08.md).
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
  reports/          11 Markdown documents
```

[Product requirements](product/product-requirements.md), [MVP scope](product/mvp-scope.md), [field research](product/field-research.md), [system architecture](architecture/system-architecture.md), [financial integrity](architecture/financial-integrity.md), [sync](architecture/offline-sync-architecture.md), [auth](architecture/authentication-authorization.md), [testing](architecture/testing-strategy.md) and [done policy](engineering/definition-of-done.md) are the core references. Roadmap links every phase; audit inventories every required file.

## Milestones and immediate start

MVP Phase0–8 is registry, farm/production/accounting/inventory/calendar/offline/profitability. Phase9 pilots real recurring use. Intelligence, AI/voice/weather, institutions, commerce/payments, partner finance, vision/trace/forecasts and commercial scale follow.

Immediate path is Phase0 →1 →2 →3 →4. Phase0 was explicitly accepted by the user; finish Phase1 provider/CI/deployment evidence before requesting the next phase. Missing farmer research remains a product risk. No customer interviews/results, regulatory approvals, live provider support or passing application tests are fabricated.

## Historical Phase0 preparation session

First district **Rukungiri**, confirmed by the user. Prepared [research pack](product/research-operations.md), [empty evidence register](product/research-evidence-register.md), [pending decision memo](product/discovery-decision.md), [status policy](engineering/document-status-policy.md), [interim audit](reports/phase-00-audit-2026-10-08.md), [closeout](reports/phase-00-closeout-2026-10-08.md) and [every-document review register](reports/phase-00-document-review-2026-10-08.md). That earlier preparation session had71 Markdown files and no Phase1 implementation. Current inventory is77 documents; Phase1 local implementation/evidence is linked below.

## Current owner authorization

Phase0 is **COMPLETED — 100% by explicit owner acceptance**, with no empirical farmer research claimed. Phase1 is authorized immediately. This supersedes earlier Phase0-only/advance-gate restrictions in this document. Read [owner approval](reports/phase-00-owner-approval-2026-10-08.md). Later-phase implementation and technical-check waivers are not implied.


## Phase1 session navigation

[Closeout](reports/phase-01-closeout-2026-10-08.md), [audit](reports/phase-01-audit-2026-10-08.md), [every-document review](reports/phase-01-document-review-2026-10-08.md), [dependencies](engineering/foundation-dependencies.md), [setup](engineering/foundation-local-setup.md). Directory counts are maintained in the session review inventory.
