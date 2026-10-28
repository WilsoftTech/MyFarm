# Financial and inventory integrity

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED - Phase 5 task-relevant contracts, implementation, status and evidence; historical sections preserved.
- Implementation status: Phase 1-4 accepted with documented conditions; Phase 5 T001-T012 locally verified, T013/hosted CI pending. No whole-architecture completion percentage claimed.
- Last reviewed: 2026-10-29 (Africa/Nairobi), Phase 5 T013 audit.
- Related phase/task IDs: Future phase architecture as referenced; Phase01 review session T001–T013; Phase02 review session (MYF-P02-T001–T013).
- Verified completed work: Scope/status/provider applicability reviewed; no financial/offline/farm-domain runtime implementation verified.
- Remaining work/blockers: Required hosted CI before Phase 5 closes; hosted migrations/provisioning and inherited production conditions remain separate gates.
- Evidence/report links: [Current Phase 5 audit](../reports/phase-05-closeout-2026-10-29.md); [document review](../reports/phase-05-document-review-2026-10-29.md). Historical task evidence remains linked below.
<!-- MYFARM-STATUS-END -->

All authoritative money/quantity calculations are deterministic application/domain services. AI may explain returned values; it cannot invent balances, recognize revenue or post financial entries. Money uses exact decimals plus currency, explicit rounding and approved basis (Q09). Do not aggregate currencies or confuse household consumption, transfers and income.

## Accounting proposals requiring decisions

Choose cash/accrual basis, direct-cost allocation, shared overhead/depreciation/finance timing, corrections, tax scope, currency precision and reporting periods before authoritative reports. Source defines gross margin = revenue − direct costs; later net farm income = gross margin − overhead − depreciation − finance costs. Phase 8 source “Farm Profit” alone is insufficient to claim net income.

Expense/income belongs to owned farm; plot/enterprise/season/activity links optional and scope-consistent. Category/provider-method changes do not rewrite historical meaning. Posted records are corrected with linked reversal/replacement plus reason/audit; draft editing policy separate.

Example proposed accrual: sale UGX 200,000, collection 80,000 → receivable 120,000; collection is settlement, not another 80,000 revenue. Cash-basis view differs and must label recognition method. Cash expense UGX 150,000 fertilizer linked to maize season counts once whether recorded via task, purchase, voice or offline replay. Activity cost references source expense.

## Stock/flock invariants

Balance(item/location)=sum approved quantityDelta in compatible base unit. Harvest 2,400−sales 1,600−loss 150=stored 650 kg. Separate ledger fixture 2,400−1,000−200−50=1,150 kg. Never combine source examples.

Transfer appends paired out/in movements atomically; quantities conserved. Source event uniqueness prevents double harvest/sale. Negative stock prohibited unless explicitly approved by item/workflow policy. Concurrent sale enforcement uses locked/serializable transaction plus bounded retry, not prior UI balance check.

Poultry: opening100+purchase20−mortality5−sale10=closing105. Eggs/feed/medication quantities use independent types/units; no bird double decrement between production and stock modules. Mortality denominator/window is Q17. Inventory value needs approved costing method (Q12); until then unavailable, not invented average or zero.

## Future wallet/settlement

Phase 17 source requires immutable LedgerEntry and derived balance. **Proposal:** balanced journals per currency, append-only posted debit/credit entries, unique provider event and business posting keys. A sale credit100,000 and withdrawal20,000 yields wallet80,000; journal counterpart accounts prevent unbalanced value creation. Distinguish pending/available/settled funds and fees. No assumption that MyFarm may hold customer funds.

Webhook authenticity, duplicate/reordered events, provider timeout, refund/reversal and payout concurrency need explicit state machine. Persist intent before provider call with stable key; verified event processing and journal/audit/receipt are atomic. DB cannot atomically commit external provider action: reconcile unknown states before retrying payout.

Dashboard/profiles are rebuildable snapshots with as-of sequence/formula/basis/coverage. Golden tests, ledger rebuild, reconciliation, replay, scope, decimals/zero/missing/unit/currency and real concurrent stock/money writes are mandatory. [DB](database-architecture.md), [payments phase](../phases/phase-17-payments-wallet.md), [analytics](../phases/phase-08-analytics-profitability.md) and [decisions](../DECISION-LOG.md) retain unresolved policy.

## Phase 4 implementation (2026-10-26)

Implemented locally under D-P04-002–010: exact numeric(20,4) money per ISO currency (never combined or converted), accrual default with a labelled cash view, one revenue/cost event per sale/purchase, payments that only settle derived balances, append-only reversals, and deterministic enterprise gross margin and money summaries. Net farm income, tax and FX remain out of scope. [Closeout](../reports/phase-04-closeout-2026-10-26.md).

## Phase 5 implementation and audit - 2026-10-29

Stock-linked crop/egg/bird sales post their one stock effect and one sale atomically, reusing the accounting transaction writer. Payments do not add revenue or stock effects. Independent accounting reversal of linked sales is rejected; coordinated stock reversal first requires posted payments to be reversed, appends opposite stock entries and preserves originals. KG and whole bird/egg quantities remain exact; effective-date stock cannot be negative. Inventory valuation stays unavailable until Phase 8. [Audit and required hosted gate](../reports/phase-05-closeout-2026-10-29.md). Phase 5 closure is pending T013/hosted CI.
