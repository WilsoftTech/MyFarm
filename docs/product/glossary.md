# Glossary

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase01 status, applicability and evidence/link review; affected content reconciled; no independent farmer validation or hosted verification.
- Implementation status: REFERENCE ONLY — N/A (navigation/protocol/template/decision/evidence record; no directly implementable scope).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase01 implementation session.
- Related phase/task IDs: Phase01 review session; MYF-P01-T001 through MYF-P01-T013; Phase00 owner acceptance where referenced.
- Verified completed work: Reference content/status/evidence links reviewed; document existence or review does not complete implementation tasks.
- Remaining work/blockers: Maintain alignment after Phase01 live verification; historical results stay historical and source body remains immutable.
- Evidence/report links: [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

| Term | Meaning in MyFarm |
|---|---|
| Farmer | Agricultural person/profile, distinct from authenticated User |
| Farm | Owned production scope; every operational financial record belongs to a farm |
| Plot | Land subdivision with explicit area/unit |
| Enterprise | Economic farming activity, e.g. maize or poultry |
| Season / production cycle | Time-scoped production activity; perennial and livestock rules need approval |
| Poultry batch | Cohort of birds with opening and movement-derived closing quantity |
| Tenant | Isolation workspace, personal farmer or organization proposal |
| Organization membership | Role in an organization; does not grant private farmer records without sharing |
| FarmMember | Scoped farm permission relationship |
| Gross margin | Recognized revenue minus approved direct production costs |
| Net farm income | Gross margin minus overhead/depreciation/finance costs; timing/basis unresolved |
| PaymentRecord | Phase 4 bookkeeping of a payment made; no provider execution |
| Payment | Phase 17 provider-domain payment lifecycle |
| StockMovement | Signed quantity change with reason/source; authoritative stock history |
| LedgerEntry | Immutable monetary posting; wallet balance derived from postings |
| Client mutation ID | Stable ID for one intent across retries; not reused for altered payload |
| Receipt | Server evidence of committed command and replay result |
| Cached / pending / confirmed | Previously fetched state / local unacknowledged intent / server-acknowledged records |
| Conflict | Expected version differs; requires defined resolution |
| Fact / inference / recommendation / uncertainty | Explicit AI answer categories |
| Farm Economic Profile | Recorded economic history/coverage, not credit score |
| Exit gate | Evidence/approval needed before next sequential phase |
| PASS WITH CONDITIONS | No blockers/failed mandatory tests; tracked nonblocking conditions only |

[Domain model](../architecture/domain-model.md) and [financial integrity](../architecture/financial-integrity.md) resolve technical meaning; new terms must be added here.

## Phase 0 research handoff — 2026-10-08

First district: **Rukungiri**, confirmed by the user. No language, device, priority pain or farmer-validation finding is inferred. Existing scope/personas/problems remain source-aligned proposals or hypotheses until actual evidence is accepted. Use [research operations](research-operations.md), [evidence register](research-evidence-register.md) and [discovery decision memo](discovery-decision.md). Phase 0 has no fully verified task yet; this document's preparation does not close its evidence-dependent requirements.
