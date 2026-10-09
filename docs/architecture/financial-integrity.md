# Financial and inventory integrity

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase02 closeout status/link review; content unchanged; no completion inferred from review.
- Implementation status: NOT STARTED — 0% (direct feature scope unimplemented).
- Last reviewed: 2026-10-09 (Africa/Nairobi), Phase02 implementation and closeout session.
- Related phase/task IDs: Future phase architecture as referenced; Phase01 review session T001–T013; Phase02 review session (MYF-P02-T001–T013).
- Verified completed work: Scope/status/provider applicability reviewed; no financial/offline/farm-domain runtime implementation verified.
- Remaining work/blockers: Associated future tasks, business decisions and exit gates pending; no phase advancement.
- Evidence/report links: [Phase02 closeout](../reports/phase-02-closeout-2026-10-09.md); [Phase02 every-document review](../reports/phase-02-document-review-2026-10-09.md); [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](../reports/phase-01-provider-verification-2026-10-08.md).
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
