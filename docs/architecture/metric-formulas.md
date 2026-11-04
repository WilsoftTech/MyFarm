# Metric formula catalog

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED - owner-approved Q17 catalog.
- Implementation status: REFERENCE ONLY - N/A (approved rules; progress is in the phase specification).
- Last reviewed: 2026-11-04 (Africa/Nairobi).
- Related phase/task IDs: MYF-P08-R002, MYF-P08-AC002; D-P08-002 through D-P08-011.
- Verified completed work: Worked examples are unit test fixtures in `tests/unit/analytics-metrics.test.ts`.
- Remaining work/blockers: No accountant or agronomist has reviewed this catalog; that remains open for the Phase 9 field pilot.
- Evidence/report links: [Decisions](../DECISION-LOG.md#d-p08-011---q17-formula-catalog); [Phase specification](../phases/phase-08-analytics-profitability.md).
<!-- MYFARM-STATUS-END -->

These are the only definitions of MyFarm's calculated figures. Application code calculates them; an AI may explain them but never produce them. Everything is calculated exactly and rounded once, for display.

## General rules

- **Rounding:** half-up on the size of the number. Money per unit and kg per acre show up to 2 decimals, percentages up to 1. Trailing zeros are dropped.
- **Not available:** a zero or missing denominator gives "Not available" with a reason, never 0. A zero numerator is a real 0.
- **Currencies** are never combined or converted. Every money figure is per currency.
- **Basis:** figures follow the chosen view, accrual by default or cash.
- **Reversed records** are excluded: reversed money records, harvests, losses, deaths and purchases.
- **Entries not yet sent** are not counted.

## Farm and enterprises

| Figure | Formula |
|---|---|
| Gross margin (enterprise) | Revenue linked to it − costs linked to it |
| Gross margin % (enterprise) | Gross margin ÷ its revenue |
| Recorded surplus (farm) | All revenue − all costs, including costs linked to no enterprise |
| Margin (farm) | Recorded surplus ÷ revenue |
| Labour cost | Sum of costs in the labour group |
| Input cost | Sum of costs in the input group |

Labour group: Labour. Input group: Seeds, Feed, Fertilizer, Veterinary, Medication, Pesticides. Shared costs are never allocated to enterprises. Depreciation and loan costs are not recorded, so none of this is net profit.

Example: 8,400,000 − 5,150,000 = 3,250,000 UGX recorded surplus, a 38.7% margin.

## Crops

For one crop in an enterprise, in a season or across all records.

| Figure | Formula |
|---|---|
| Acres | Planted area of its cycles, converted exactly (1 acre = 4,046.8564224 m², 1 hectare = 10,000 m²) |
| Cost per acre | Linked costs ÷ acres |
| Revenue per acre | Linked revenue ÷ acres |
| Yield per acre | Gross harvested kg ÷ acres |
| Cost per kg, also the break-even price | Linked costs ÷ kg after recorded loss |

Not available when the enterprise has more than one crop in the view (D-P08-010), or in a date-range view. A date range holds only part of a cycle's costs but all of its acres, so the result would mislead; this is an engineering choice within D-P08-007. A cycle still active is labelled "so far".

Example: 2,100,000 UGX, 3 acres, 4,000 kg gross and 250 kg lost gives 700,000 UGX per acre, 1,333.33 kg per acre and 560 UGX per kg.

## Poultry

For one batch over its whole life, whichever season or dates are chosen.

| Figure | Formula |
|---|---|
| Birds started | Starting quantity + bird purchases |
| Mortality rate | Deaths ÷ birds started |
| Cost per bird | Costs linked to the batch ÷ birds started |
| Revenue per bird | Sales of its birds and eggs ÷ birds started |

Costs linked to the poultry enterprise but no batch are shown beside the batch, whose cost figures may then be incomplete (D-P08-003). A batch still active is labelled "so far".

Example: 100 started, 5 bought, 3 died and 525,000 UGX of costs gives 2.9% mortality and 5,000 UGX per bird.

## Stock

| Figure | Formula |
|---|---|
| Stock value (estimate) | Quantity in stock × the item's most recent sale price that has not been reversed |

Labelled an estimate with the sale date, in that sale's currency, and not available for an item never sold. It is kept out of surplus and margin, so unsold stock never counts as earnings. Totals add the rounded lines per currency. This is not a costing method.
