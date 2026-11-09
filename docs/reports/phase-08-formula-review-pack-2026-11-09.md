# MyFarm figures: review pack for an accountant and an agronomist

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED - prepared from the approved formula catalog and the code's golden fixtures.
- Implementation status: REFERENCE ONLY - N/A (review request; condition P8-C2 stays open until both sign-offs are recorded).
- Last reviewed: 2026-11-09 (Africa/Nairobi).
- Related phase/task IDs: P8-C2; D-P08-011; MYF-P08-R001 to MYF-P08-R003.
- Verified completed work: Every worked example below is checked by an automated test that passes.
- Remaining work/blockers: Needs a named accountant and a named agronomist to review and sign below.
- Evidence/report links: [Formula catalog](../architecture/metric-formulas.md); [Phase 8 closeout](phase-08-closeout-2026-11-08.md).
<!-- MYFARM-STATUS-END -->

**Who this is for:** a practising accountant and an agronomist who know smallholder crop and poultry farming in Uganda. You do not need to read code. Please mark each item **Agree**, **Change** (say how) or **Not my area**, and answer the questions at the end.

**What MyFarm is:** a phone app where a farmer records money in and out, crops planted and harvested, poultry batches, and stock. It then shows the figures below. The owner has approved these definitions, but no accountant or agronomist has checked them yet. Farmers in the Phase 9 pilot will make decisions from these numbers, so we want them right before then.

**How figures are worked out:** exactly, from the farmer's records, and rounded only for display. Money per unit and kg per acre show 2 decimals, and percentages show 1, rounded half-up. A figure that cannot be worked out, for example cost per acre with no planted area, shows "Not available" and a reason, never 0. Different currencies are never added together or converted. A record the farmer reversed is left out.

## A. Money (accountant)

| # | Figure | How it is worked out | Worked example | Your view |
|---|---|---|---|---|
| A1 | Recorded surplus (farm) | All money earned − all money spent, including costs linked to no enterprise | 8,400,000 − 5,150,000 = 3,250,000 UGX | |
| A2 | Margin (farm) | Recorded surplus ÷ money earned | 3,250,000 ÷ 8,400,000 = 38.7% | |
| A3 | Gross margin (enterprise) | Money earned linked to the enterprise − costs linked to it. Shared costs are not divided among enterprises | Maize 3,800,000 − 2,100,000 = 1,700,000 UGX | |
| A4 | Accrual and cash views | Accrual: a sale or purchase counts on its date, paid or not. Cash: only when payment moves | A 59,000 unpaid feed purchase counts in accrual, not in cash | |
| A5 | Labour cost / input cost | Costs in the Labour category / in Seeds, Feed, Fertilizer, Veterinary, Medication, Pesticides. Transport, fuel, equipment, rent, utilities and packaging are in neither | | |
| A6 | Stock value (estimate) | Quantity in stock × that item's most recent sale price not reversed. Kept out of surplus and margin. Not available if never sold | 3,650 kg × 1,200 UGX = 4,380,000 UGX | |
| A7 | What is left out | No depreciation of tools or equipment and no loan costs are recorded, so nothing is called "net profit" | | |

## B. Crops (agronomist, with A for money)

| # | Figure | How it is worked out | Worked example | Your view |
|---|---|---|---|---|
| B1 | Acres | Planted area of the crop's cycles, converted exactly: 1 acre = 4,046.8564224 m², 1 hectare = 10,000 m² | 1 ha = 2.47 acres | |
| B2 | Yield per acre | **Gross** harvested kg ÷ acres | 4,000 kg ÷ 3 acres = 1,333.33 kg | |
| B3 | Cost per acre / revenue per acre | Costs (money earned) linked to the enterprise and season ÷ acres | 2,100,000 ÷ 3 = 700,000 UGX | |
| B4 | Cost per kg, also the break-even price | Costs ÷ kg **kept after recorded loss** | 2,100,000 ÷ 3,750 = 560 UGX | |
| B5 | Enterprise with two crops | Per-acre and per-kg figures not available, because costs are linked to the enterprise, not to one crop | | |
| B6 | Crop still growing | Figures shown and labelled "so far" | | |

## C. Poultry (agronomist or animal-health adviser, with A)

| # | Figure | How it is worked out | Worked example | Your view |
|---|---|---|---|---|
| C1 | Birds started | Starting birds + birds bought later | 100 + 5 = 105 | |
| C2 | Mortality rate | Deaths ÷ birds started | 3 ÷ 105 = 2.9% | |
| C3 | Cost per bird / revenue per bird | Costs (sales of birds and eggs) linked to the batch ÷ birds started, over the batch's whole life | 525,000 ÷ 105 = 5,000 UGX | |
| C4 | Costs not linked to a batch | Shown beside the batch with a warning that its cost per bird may be too low | | |

## D. Trends

| # | Rule | Example | Your view |
|---|---|---|---|
| D1 | A crop is compared with the most recent earlier season that grew it, whatever time of year | Maize 2027A against maize 2026B | |
| D2 | A batch is compared with the previous batch of the same kind of bird; batches started the same day are not compared | | |
| D3 | Change = (now − before) ÷ before, with its sign; no percentage when "before" is 0 or missing | Feed 100,000 → 118,000 UGX = +18% | |

## Questions

1. **Accountant:** is "recorded surplus" a fair and understandable name for A1, and is it right not to divide shared costs among enterprises at this stage?
2. **Accountant:** is the last-sale-price estimate (A6) reasonable for a smallholder, given that it is labelled as an estimate and kept out of surplus?
3. **Agronomist:** should yield per acre use gross harvest (B2) and cost per kg use kg kept after loss (B4)? Or should both use the same?
4. **Agronomist:** should a crop be compared with the last season of any kind (D1), or should first and second rains each be compared with their own kind?
5. **Both:** is any figure missing that a Ugandan smallholder or extension worker would expect before the pilot?

## Sign-off

| Role | Name | Organisation | Date | Agree with all / changes listed |
|---|---|---|---|---|
| Accountant | | | | |
| Agronomist | | | | |

When both rows are filled, record the result in the decision log; P8-C2 then closes. Any change goes through the owner and a reviewed release of the catalog.
