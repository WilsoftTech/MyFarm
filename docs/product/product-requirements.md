# Product requirements

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — current Phase01 implementation/evidence/status review; no completion inferred from review.
- Implementation status: COMPLETED — 100% of Phase00 document baseline by owner acceptance; downstream product implementation not implied.
- Last reviewed: 2026-10-08 (Africa/Nairobi), live provider and hosted closeout session.
- Related phase/task IDs: Phase00 product baseline; MYF-P00-T001 through MYF-P00-T010; Phase01 review session.
- Verified completed work: Prepared source-aligned product baseline accepted by explicit user closure; no empirical farmer findings verified.
- Remaining work/blockers: No baseline closure blocker under owner decision; research/language/device/pain validation remains a product risk and later follow-up.
- Evidence/report links: [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](../reports/phase-01-provider-verification-2026-10-08.md).
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
