# Product requirements

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — content/scope/status/structure/link review.
- Implementation status: PARTIALLY COMPLETE — 0% (related Phase 00: 0/10 verified tasks).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase 00 session.
- Related phase/task IDs: Phase 00; MYF-P00-T001 through MYF-P00-T009.
- Verified completed work: Source-aligned product/research preparation reviewed; district confirmed; no complete evidence-dependent task.
- Remaining work/blockers: Authentic consented farmer evidence, research setup and approved discovery decision.
- Evidence/report links: [Phase 00 closeout](../reports/phase-00-closeout-2026-10-08.md); [every-document review](../reports/phase-00-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Authority: source P0001–P1109 and pasted assignment. [Traceability](../REQUIREMENTS-TRACEABILITY.md) is the requirement inventory with source/task/AC/test/status; phase documents supply execution detail. Do not duplicate changing acceptance IDs here.

Functional groups: owned registry; crop/poultry cycles; deterministic accounting; production/stock ledger; calendar/recurrence; mandatory offline farmer workflows; deterministic profitability; pilot evidence; progressive intelligence/AI/voice/weather; delegated officers; cooperative operations; business procurement/payments; consented profiles/partner finance; uncertain image assessment; custody; longitudinal forecasting; commercial entitlements; hardening.

Nonfunctional requirements:

| Attribute | Required behavior | Verification |
|---|---|---|
| Security | Current server authorization, least privilege, no cross-farm/org leakage | Two-tenant/IDOR/export/media/revocation suites |
| Integrity | Exact money; reconstructable quantity/ledger; transactional idempotent effects | Golden arithmetic, concurrent writes, rebuild/reconciliation |
| Offline | Eight source actions, visible sync state, safe retry/conflict/recovery | Disconnection/reload/lost-response/quota/device tests |
| Accessibility/usability | Mobile-first understandable entry; keyboard/labels/status | Component/E2E plus farmer observation |
| Maintainability | Business logic outside UI; explicit service/repository boundaries | Dependency review and domain tests |
| Operability | Structured redacted logs, errors/audits/health/backups | Failure alert and restore evidence |
| Performance | Scoped indexed/paginated reads, pooling, bounded work | Query plans/load tests vs approved budgets |
| Privacy/AI | Minimal data, consented sharing, evidence/uncertainty, no autonomous money | Consent/retrieval/injection/voice-confirmation tests |

Q16/Q18/Q20/Q34 define measurable offline/pilot/AI/performance targets before applicable implementation; no unsupported uptime/accuracy promises. Global expansion uses catalogs/locale/currency/unit/provider adapters. [Decision log](../DECISION-LOG.md) distinguishes source/request constraints, proposals, assumptions and unknowns.

## Phase 0 research handoff — 2026-10-08

First district: **Rukungiri**, confirmed by the user. No language, device, priority pain or farmer-validation finding is inferred. Existing scope/personas/problems remain source-aligned proposals or hypotheses until actual evidence is accepted. Use [research operations](research-operations.md), [evidence register](research-evidence-register.md) and [discovery decision memo](discovery-decision.md). Phase 0 has no fully verified task yet; this document's preparation does not close its evidence-dependent requirements.
