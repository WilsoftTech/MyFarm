# Requirements traceability

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase01 status, applicability and evidence/link review; affected content reconciled; no independent farmer validation or hosted verification.
- Implementation status: REFERENCE ONLY — N/A (navigation/protocol/template/decision/evidence record; no directly implementable scope).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase01 implementation session.
- Related phase/task IDs: Phase01 review session; MYF-P01-T001 through MYF-P01-T013; Phase00 owner acceptance where referenced.
- Verified completed work: Reference content/status/evidence links reviewed; document existence or review does not complete implementation tasks.
- Remaining work/blockers: Maintain alignment after Phase01 live verification; historical results stay historical and source body remains immutable.
- Evidence/report links: [Phase01 closeout](reports/phase-01-closeout-2026-10-08.md); [every-document review](reports/phase-01-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Status date: 2026-10-08. Grouped explicit capabilities map to unique requirements/tasks/acceptance tests below. Phase0 is COMPLETED100% by owner acceptance, without empirical research verification. Phase1 is BLOCKED30.77% (4/13 verified tasks); Phases2–24 remain NOT STARTED0%. Proposed safeguards/schema are identified in phase F and [decisions](DECISION-LOG.md). Paragraph locators refer to [complete normalized source](reports/source-extract.md), not guessed page numbers.

## Phase 00 Product Discovery and Scope Definition

| ID | Source | Requirement | Phase/task | Acceptance | Test expectation | Status |
|---|---|---|---|---|---|---|
| MYF-P00-R001 | P0031–P0057 | Prioritize individual farmers, then managers/officers; investigate poultry and crops; defer institutions. | [Phase 0](phases/phase-00-product-discovery.md) / MYF-P00-T001, MYF-P00-T002, MYF-P00-T003 | MYF-P00-AC001: Scope names segments/enterprises and cites real interview evidence. | Compare segment choice with interviews; distinguish requested focus from validated demand. | COMPLETED — owner accepted; research AC not empirically verified; see owner-approval report |
| MYF-P00-R002 | P0058–P0073 | Research expenses, costs, profit, existing/forgotten records, manager, planning, sales, SACCO information, phones, internet, language, typing/voice and mobile-money frequency. | [Phase 0](phases/phase-00-product-discovery.md) / MYF-P00-T004, MYF-P00-T005, MYF-P00-T006 | MYF-P00-AC002: Interview guide covers all fourteen topics; consent and evidence provenance recorded. | Guide completeness review and independent synthesis-to-notes comparison. | COMPLETED — owner accepted; research AC not empirically verified; see owner-approval report |
| MYF-P00-R003 | P0074–P0085 | Deliver vision, personas, problems, research, MVP scope, non-goals and glossary; close discovery gate. | [Phase 0](phases/phase-00-product-discovery.md) / MYF-P00-T007, MYF-P00-T008, MYF-P00-T009 | MYF-P00-AC003: Seven source product documents and approved research-backed gate memo exist. | Reject unsupported findings and unapproved scope. | COMPLETED — owner accepted; research AC not empirically verified; see owner-approval report |

## Phase 01 Engineering Foundation

| ID | Source | Requirement | Phase/task | Acceptance | Test expectation | Status |
|---|---|---|---|---|---|---|
| MYF-P01-R001 | P0089–P0110 | Use Next.js App Router, React, TypeScript, Tailwind, shadcn/ui, Zod and React Hook Form with farmer PWA and agent/admin boundaries. | [Phase 1](phases/phase-01-engineering-foundation.md) / MYF-P01-T001, MYF-P01-T002, MYF-P01-T003 | MYF-P01-AC001: Validated typed form works; UI cannot directly call persistence. | Invalid form input, component behavior and import-boundary review. | COMPLETED — 100% of linked T001–T003; AC001 passes locally; [evidence](reports/phase-01-closeout-2026-10-08.md) |
| MYF-P01-R002 | P0111–P0126 | Use PostgreSQL/Supabase, Prisma, Vercel, private object-storage interface; Vitest, React Testing Library, Playwright; structured logs/errors/audits/health. | [Phase 1](phases/phase-01-engineering-foundation.md) / MYF-P01-T004, MYF-P01-T005, MYF-P01-T006 | MYF-P01-AC002: Isolated DB connects; private storage and redacted diagnostics demonstrated. | Connectivity, health degradation, private file and secret-log tests. | BLOCKED — 33.33% (T004 of T004–T006); hosted storage/provider AC pending; [evidence](reports/phase-01-closeout-2026-10-08.md) |
| MYF-P01-R003 | P0130–P0147 | Separate UI → application → domain → repository → database; plan recordFarmExpense, calculateEnterpriseProfit, recordHarvest, closeSeason, transferInventory. | [Phase 1](phases/phase-01-engineering-foundation.md) / MYF-P01-T007, MYF-P01-T008, MYF-P01-T009 | MYF-P01-AC003: Domain functions test without browser/DB; future interfaces do not implement later scope. | Domain unit test and dependency review. | PARTIALLY COMPLETE — 0% of linked tasks (upstream chain pending); local boundary tests pass; [evidence](reports/phase-01-closeout-2026-10-08.md) |
| MYF-P01-R004 | P0148–P0164 | Provide lint, typecheck, test, build, CI, migration workflow, auth, error handling and basic security. | [Phase 1](phases/phase-01-engineering-foundation.md) / MYF-P01-T010, MYF-P01-T011, MYF-P01-T012 | MYF-P01-AC004: All four commands exit zero with logs; expired session denied; migration rehearsed. | CI run, clean migration, authentication and error integration tests. | BLOCKED — 0% of linked tasks; local four gates pass, hosted CI/auth pending; [evidence](reports/phase-01-closeout-2026-10-08.md) |

## Phase 02 Farmer Identity and Farm Registry

| ID | Source | Requirement | Phase/task | Acceptance | Test expectation | Status |
|---|---|---|---|---|---|---|
| MYF-P02-R001 | P0169–P0179 | Model User, Organization, Farmer, FarmerProfile, Farm, Plot, FarmMember, Address, Contact and Document. | [Phase 2](phases/phase-02-farmer-registry.md) / MYF-P02-T001, MYF-P02-T002, MYF-P02-T003 | MYF-P02-AC001: Farmer/farm ownership bound to authenticated actor; foreign-tenant plot link rejected. | Cross-tenant relationship and orphan creation tests. | NOT STARTED |
| MYF-P02-R002 | P0186–P0197 | Capture name, phone/alternative phone, district/subcounty/village, preferred language, ownership and main activities; minimize data. | [Phase 2](phases/phase-02-farmer-registry.md) / MYF-P02-T004, MYF-P02-T005, MYF-P02-T006 | MYF-P02-AC002: Optionality approved; extra sensitive data requires purpose before collection. | Phone/location validation and minimization review. | NOT STARTED |
| MYF-P02-R003 | P0198–P0204 | Capture farm name/location, approximate acreage, ownership, activity and optional GPS. | [Phase 2](phases/phase-02-farmer-registry.md) / MYF-P02-T007, MYF-P02-T008, MYF-P02-T009 | MYF-P02-AC003: Nonnegative acreage; valid complete coordinate pair when supplied. | Absent GPS, out-of-range coordinates and negative area tests. | NOT STARTED |
| MYF-P02-R004 | P0205–P0216 | Authorize every query; isolate farms, transactions, harvests, financial records and documents. | [Phase 2](phases/phase-02-farmer-registry.md) / MYF-P02-T010, MYF-P02-T011, MYF-P02-T012 | MYF-P02-AC004: Two farmers cannot list/read/edit/delete/export each other’s data or obtain file grants. | IDOR suite across search/export/signed file URLs. | NOT STARTED |

## Phase 03 Enterprises Crops Livestock and Seasons

| ID | Source | Requirement | Phase/task | Acceptance | Test expectation | Status |
|---|---|---|---|---|---|---|
| MYF-P03-R001 | P0220–P0237 | Model farm/plot/enterprise/cycle or season, including maize, coffee and poultry batches. | [Phase 3](phases/phase-03-enterprises-seasons.md) / MYF-P03-T001, MYF-P03-T002, MYF-P03-T003 | MYF-P03-AC001: Two farms and multiple cycles maintain separate histories/totals. | Wrong-farm/cycle links and multi-enterprise journey. | NOT STARTED |
| MYF-P03-R002 | P0238–P0247 | Record crop, variety, plot, planted area, planting/expected harvest dates, season/status. | [Phase 3](phases/phase-03-enterprises-seasons.md) / MYF-P03-T004, MYF-P03-T005, MYF-P03-T006 | MYF-P03-AC002: Dates and units explicit; excess plot area requires approved exception. | Date ordering, missing optional variety and area boundaries. | NOT STARTED |
| MYF-P03-R003 | P0248–P0256 | Record animal type/breed, starting/current quantity, batch, acquisition and purpose. | [Phase 3](phases/phase-03-enterprises-seasons.md) / MYF-P03-T007, MYF-P03-T008, MYF-P03-T009 | MYF-P03-AC003: Starting quantity nonnegative integer; current quantity provenance shown. | Fractional/negative birds and batch identity tests. | NOT STARTED |
| MYF-P03-R004 | P0257–P0270 | Keep extensible enterprise types and avoid hard-coding maize. | [Phase 3](phases/phase-03-enterprises-seasons.md) / MYF-P03-T010, MYF-P03-T011, MYF-P03-T012 | MYF-P03-AC004: New catalog crop needs no maize-specific code; unsupported enterprise workflow clearly unavailable. | Catalog crop and unsupported type tests. | NOT STARTED |

## Phase 04 Farm Accounting Engine

| ID | Source | Requirement | Phase/task | Acceptance | Test expectation | Status |
|---|---|---|---|---|---|---|
| MYF-P04-R001 | P0275–P0285 | Cover Expense, Income, Sale, Purchase, Receivable, Payable, Payment, TransactionCategory, PaymentMethod, Attachment. | [Phase 4](phases/phase-04-farm-accounting.md) / MYF-P04-T001, MYF-P04-T002, MYF-P04-T003 | MYF-P04-AC001: One sale creates one revenue event; partial payment reduces obligation without recognizing revenue twice. | Proposed accrual fixture: sale 200,000 and payment 80,000 leave 120,000 due; basis-dependent reporting blocked pending Q09. | NOT STARTED |
| MYF-P04-R002 | P0286–P0300 | Include seeds, feed, fertilizer, veterinary, labour, transport, fuel, equipment, rent, utilities, medication, pesticides and packaging categories. | [Phase 4](phases/phase-04-farm-accounting.md) / MYF-P04-T004, MYF-P04-T005, MYF-P04-T006 | MYF-P04-AC002: All source categories available; archived categories remain readable in history. | Category ownership, archive and invalid-category tests. | NOT STARTED |
| MYF-P04-R003 | P0301–P0314 | Allow optional plot/enterprise/season/activity allocation, supplier/payment method; preserve 150,000 UGX maize fertilizer example. | [Phase 4](phases/phase-04-farm-accounting.md) / MYF-P04-T007, MYF-P04-T008, MYF-P04-T009 | MYF-P04-AC003: Exactly UGX 150,000 assigned to maize 2027A; wrong-farm links rejected. | Exact decimal round trip, duplicate command and scope mismatch tests. | NOT STARTED |
| MYF-P04-R004 | P0315–P0338 | Calculate revenue minus direct costs as gross margin deterministically; later deduct overhead/depreciation/finance for net income; AI only explains. | [Phase 4](phases/phase-04-farm-accounting.md) / MYF-P04-T010, MYF-P04-T011, MYF-P04-T012 | MYF-P04-AC004: 500,000 − 150,000 = 350,000 gross margin with no AI dependency. | Reversal, duplicate prevention, currency separation and recomputation. | NOT STARTED |
| MYF-P04-R005 | P0339–P0344 | Show amount spent, spending categories, revenue earned and costliest enterprise. | [Phase 4](phases/phase-04-farm-accounting.md) / MYF-P04-T013, MYF-P04-T014, MYF-P04-T015 | MYF-P04-AC005: Totals reconcile with basis/as-of labels; tied enterprises shown. | Empty, date filter, ties, unauthorized export and correction refresh. | NOT STARTED |

## Phase 05 Harvest Production and Inventory

| ID | Source | Requirement | Phase/task | Acceptance | Test expectation | Status |
|---|---|---|---|---|---|---|
| MYF-P05-R001 | P0348–P0363 | Record harvest date/crop/plot/quantity/unit/grade/storage/losses. | [Phase 5](phases/phase-05-harvest-inventory.md) / MYF-P05-T001, MYF-P05-T002, MYF-P05-T003 | MYF-P05-AC001: 2,400 kg − 1,600 sold − 150 losses = 650 stored. | Source fixture, wrong plot and incompatible unit. | NOT STARTED |
| MYF-P05-R002 | P0364–P0373 | Track opening birds, purchases, mortality, eggs, bird sales, feed, medication and closing flock. | [Phase 5](phases/phase-05-harvest-inventory.md) / MYF-P05-T004, MYF-P05-T005, MYF-P05-T006 | MYF-P05-AC002: 100 opening +20 purchased −5 deaths −10 sold =105 birds; eggs/feed do not affect flock count. | Flock reconstruction, excessive mortality and distinct bird/egg/feed units. | NOT STARTED |
| MYF-P05-R003 | P0374–P0390 | Use InventoryItem, StockMovement, StorageLocation, StockAdjustment and append-only ledger. | [Phase 5](phases/phase-05-harvest-inventory.md) / MYF-P05-T007, MYF-P05-T008, MYF-P05-T009 | MYF-P05-AC003: 2,400−1,000−200−50=1,150 kg; transfer paired movements conserve stock. | Concurrent sales, rollback, duplicate command, reversal and transfer conservation. | NOT STARTED |
| MYF-P05-R004 | P0391–P0392 | Reconstruct every stock balance from history. | [Phase 5](phases/phase-05-harvest-inventory.md) / MYF-P05-T010, MYF-P05-T011, MYF-P05-T012 | MYF-P05-AC004: Rebuilt projection equals display for all fixture item/location pairs. | Corrupted projection rebuild and archive-history regression. | NOT STARTED |

## Phase 06 Production Activities and Farm Calendar

| ID | Source | Requirement | Phase/task | Acceptance | Test expectation | Status |
|---|---|---|---|---|---|---|
| MYF-P06-R001 | P0396–P0408 | Include planting, irrigation, weeding, spraying, fertilizing, vaccination, feeding, harvesting, pruning, milking, inspection. | [Phase 6](phases/phase-06-farm-activities.md) / MYF-P06-T001, MYF-P06-T002, MYF-P06-T003 | MYF-P06-AC001: All activity catalog values retained; crop/poultry MVP behavior explicit. | Catalog and unsupported enterprise tests. | NOT STARTED |
| MYF-P06-R002 | P0409–P0426 | Record farm/enterprise/plot/date/worker/cost/notes/attachments/status; show upcoming/today/completed/missed/cancelled. | [Phase 6](phases/phase-06-farm-activities.md) / MYF-P06-T004, MYF-P06-T005, MYF-P06-T006 | MYF-P06-AC002: Plot B fertilizer due tomorrow appears upcoming; completion records permitted worker/time. | Timezone/overdue/cancelled/foreign worker/private attachment tests. | NOT STARTED |
| MYF-P06-R003 | P0427–P0436 | Recur feeding, milking, cleaning, vaccination and inspection. | [Phase 6](phases/phase-06-farm-activities.md) / MYF-P06-T007, MYF-P06-T008, MYF-P06-T009 | MYF-P06-AC003: Repeated expansion creates one occurrence; approved cancellation policy stops future entries. | Duplicate expansion, date boundaries, recurrence edits and offline replay. | NOT STARTED |

## Phase 07 Offline First Architecture

| ID | Source | Requirement | Phase/task | Acceptance | Test expectation | Status |
|---|---|---|---|---|---|---|
| MYF-P07-R001 | P0441–P0455 | Use PWA, IndexedDB/Dexie, service worker and custom sync; local browser storage is not guaranteed durable. | [Phase 7](phases/phase-07-offline-first.md) / MYF-P07-T001, MYF-P07-T002, MYF-P07-T003 | MYF-P07-AC001: Cached shell reopens disconnected; denied persistence/quota error visible without false save success. | Offline cold start after bootstrap, quota and eviction recovery. | NOT STARTED |
| MYF-P07-R002 | P0456–P0465 | Offline expense/income/harvest/activity/task entry, photo capture and cached farms/records. | [Phase 7](phases/phase-07-offline-first.md) / MYF-P07-T004, MYF-P07-T005, MYF-P07-T006 | MYF-P07-AC002: All eight source actions persist locally with pending status; photo retry retains metadata. | Eight-action E2E, tab reload, storage failure and media recovery. | NOT STARTED |
| MYF-P07-R003 | P0466–P0479 | Use clientMutationId/deviceId/timestamps/status/version and LOCAL_ONLY/PENDING/SYNCING/SYNCED/CONFLICT/FAILED states. | [Phase 7](phases/phase-07-offline-first.md) / MYF-P07-T007, MYF-P07-T008, MYF-P07-T009 | MYF-P07-AC003: Stale version conflicts; transient failures retry; permanent validation retained for repair. | Crash during SYNCING, missing dependencies, stale edits and invalid payload. | NOT STARTED |
| MYF-P07-R004 | P0480–P0490 | Reconnect/retry produces one expense, with idempotency and no corruption. | [Phase 7](phases/phase-07-offline-first.md) / MYF-P07-T010, MYF-P07-T011, MYF-P07-T012 | MYF-P07-AC004: Same key/payload returns stored receipt; different payload rejects; lost acknowledgement produces one effect. | Concurrent replay, multi-device conflict, revoked user, pull pagination and expired cursor. | NOT STARTED |

## Phase 08 Farm Analytics and Profitability Engine

| ID | Source | Requirement | Phase/task | Acceptance | Test expectation | Status |
|---|---|---|---|---|---|---|
| MYF-P08-R001 | P0494–P0513 | Display revenue/expenses/profit/margin and enterprise comparison. | [Phase 8](phases/phase-08-analytics-profitability.md) / MYF-P08-T001, MYF-P08-T002, MYF-P08-T003 | MYF-P08-AC001: 8,400,000−5,150,000=3,250,000 UGX; margin rounded to 38.7%; enterprise totals match. | Source dashboard fixture, filters/ties/empty/corrections. | NOT STARTED |
| MYF-P08-R002 | P0514–P0528 | Compute cost/acre, cost/kg, revenue/acre, yield/acre, gross/profit margin, labour/input cost, break-even, inventory value, mortality, cost/bird and revenue/bird. | [Phase 8](phases/phase-08-analytics-profitability.md) / MYF-P08-T004, MYF-P08-T005, MYF-P08-T006 | MYF-P08-AC002: Each metric has numerator/denominator/unit/currency/missing outcome; unknown valuation is unavailable. | Golden metrics, zero area/yield/revenue, mixed units/currencies and missing flock denominator. | NOT STARTED |
| MYF-P08-R003 | P0529–P0533 | Calculate trend variance deterministically before any explanation. | [Phase 8](phases/phase-08-analytics-profitability.md) / MYF-P08-T007, MYF-P08-T008, MYF-P08-T009 | MYF-P08-AC003: Feed 100,000→118,000 gives +18%; absent/zero baseline unavailable. | Variance and incomparable-cycle fixtures. | NOT STARTED |
| MYF-P08-R004 | P0534–P0538 | MVP ends with registry, management, accounting, inventory, offline and profitability before field testing. | [Phase 8](phases/phase-08-analytics-profitability.md) / MYF-P08-T010, MYF-P08-T011, MYF-P08-T012 | MYF-P08-AC004: All 0–8 gates evidenced; source farmer journey passes; future functionality absent. | Full regression with offline financial/harvest command replay. | NOT STARTED |

## Phase 09 Field Pilot and Product Validation

| ID | Source | Requirement | Phase/task | Acceptance | Test expectation | Status |
|---|---|---|---|---|---|---|
| MYF-P09-R001 | P0541–P0554 | Freeze major features; measure onboarded/active farmers, records/week, expenses, harvests, tasks, offline transactions, sync failures, support and completed cycles. | [Phase 9](phases/phase-09-field-pilot.md) / MYF-P09-T001, MYF-P09-T002, MYF-P09-T003 | MYF-P09-AC001: Ten metrics have defined numerator/denominator and events reconcile without retry inflation. | Consent exclusion, event dedupe, cohort and complete-cycle definitions. | NOT STARTED |
| MYF-P09-R002 | P0555–P0566 | Observe hesitation, test understandable expense wording and prove recurring voluntary use. | [Phase 9](phases/phase-09-field-pilot.md) / MYF-P09-T004, MYF-P09-T005, MYF-P09-T006 | MYF-P09-AC002: Dated evidence supports recurring-use gate; findings link to observations, not downloads. | Evidence review, opt-out removal and go/no-go audit. | NOT STARTED |

## Phase 10 Farm Intelligence Engine

| ID | Source | Requirement | Phase/task | Acceptance | Test expectation | Status |
|---|---|---|---|---|---|---|
| MYF-P10-R001 | P0569–P0587 | Records→metrics→rules→insights; identify rising feed, falling eggs and rising mortality. | [Phase 10](phases/phase-10-farm-intelligence.md) / MYF-P10-T001, MYF-P10-T002, MYF-P10-T003 | MYF-P10-AC001: Alert shows values, comparison window, formula/rule versions and coverage. | Feed +24%, eggs −12%, qualified mortality change; sparse inputs suppress. | NOT STARTED |
| MYF-P10-R002 | P0588–P0600 | Warn high mortality, production unit cost above selling unit price and inventory below expected requirement. | [Phase 10](phases/phase-10-farm-intelligence.md) / MYF-P10-T004, MYF-P10-T005, MYF-P10-T006 | MYF-P10-AC002: Thresholds and demand assumptions explicit; comparable units required. | Threshold boundaries, wrong units, missing demand and no-LLM execution. | NOT STARTED |

## Phase 11 AI Farm Assistant

| ID | Source | Requirement | Phase/task | Acceptance | Test expectation | Status |
|---|---|---|---|---|---|---|
| MYF-P11-R001 | P0604–P0624 | Intent→authorization→farm retrieval→deterministic calculation→knowledge→LLM explanation. | [Phase 11](phases/phase-11-ai-assistant.md) / MYF-P11-T001, MYF-P11-T002, MYF-P11-T003 | MYF-P11-AC001: Highest-profit answer cites exact period/scope/result; missing evidence yields no conclusion. | Two-tenant retrieval, prompt injection, fake scope and numeric mismatch. | NOT STARTED |
| MYF-P11-R002 | P0625–P0633 | Ask records, explain profit, compare seasons, summarize, identify unusual costs, explain tasks and generate reports. | [Phase 11](phases/phase-11-ai-assistant.md) / MYF-P11-T004, MYF-P11-T005, MYF-P11-T006 | MYF-P11-AC002: Seven intents have bounded read-only contracts and report provenance. | Seven-intent corpus, stale context, denied exports and provider outage. | NOT STARTED |
| MYF-P11-R003 | P0634–P0645 | Distinguish FACT, INFERENCE, RECOMMENDATION, UNCERTAINTY. | [Phase 11](phases/phase-11-ai-assistant.md) / MYF-P11-T007, MYF-P11-T008, MYF-P11-T009 | MYF-P11-AC003: Factual values match evidence; agronomic uncertainty explicitly labeled. | Groundedness, contradictory sources and unsafe-certainty evaluation. | NOT STARTED |

## Phase 12 Voice First Farmer Experience

| ID | Source | Requirement | Phase/task | Acceptance | Test expectation | Status |
|---|---|---|---|---|---|---|
| MYF-P12-R001 | P0649–P0662 | Parse two bags of chicken feed for 180,000 as feed expense; confirm before writing. | [Phase 12](phases/phase-12-voice-experience.md) / MYF-P12-T001, MYF-P12-T002, MYF-P12-T003 | MYF-P12-AC001: Unconfirmed draft makes zero records; confirmed UGX 180,000 creates one. | No/ambiguous yes, mistaken number, edits and duplicate confirmation. | NOT STARTED |
| MYF-P12-R002 | P0663–P0682 | Speech→intent→schema→confirmation→domain→DB; never LLM direct write. | [Phase 12](phases/phase-12-voice-experience.md) / MYF-P12-T004, MYF-P12-T005, MYF-P12-T006 | MYF-P12-AC002: Confirmation binds actor/scope/payload hash/expiry and normal idempotency. | Wrong actor, expired draft, changed amount/farm and replay. | NOT STARTED |
| MYF-P12-R003 | P0683–P0690 | Provider-independent language adapters for English, Runyankore/Rukiga, Luganda, Swahili and future languages. | [Phase 12](phases/phase-12-voice-experience.md) / MYF-P12-T007, MYF-P12-T008, MYF-P12-T009 | MYF-P12-AC003: Advertised languages require measured accuracy; unsupported offers text fallback. | Adapter/language corpus, offline and denied microphone. | NOT STARTED |

## Phase 13 Weather and Agronomic Intelligence

| ID | Source | Requirement | Phase/task | Acceptance | Test expectation | Status |
|---|---|---|---|---|---|---|
| MYF-P13-R001 | P0693–P0709 | Combine location/weather/crop/growth stage/planned activity, e.g. rain before spraying. | [Phase 13](phases/phase-13-weather-intelligence.md) / MYF-P13-T001, MYF-P13-T002, MYF-P13-T003 | MYF-P13-AC001: Warning names affected task/time; missing stage/location reduces specificity. | Rain/spraying, stale forecasts, absent GPS/timezone. | NOT STARTED |
| MYF-P13-R002 | P0710–P0716 | Forecasts, rain alerts, planting windows, spraying warnings, irrigation and extreme-weather alerts. | [Phase 13](phases/phase-13-weather-intelligence.md) / MYF-P13-T004, MYF-P13-T005, MYF-P13-T006 | MYF-P13-AC002: Six capabilities use reviewed rules; rescheduling requires confirmation. | Thresholds, provider failure, duplicate alerts and confirmed change. | NOT STARTED |

## Phase 14 Extension Officer and Field Agent Platform

| ID | Source | Requirement | Phase/task | Acceptance | Test expectation | Status |
|---|---|---|---|---|---|---|
| MYF-P14-R001 | P0719–P0731 | Dashboard assigned farmers, visits today, follow-ups and problems. | [Phase 14](phases/phase-14-extension-officers.md) / MYF-P14-T001, MYF-P14-T002, MYF-P14-T003 | MYF-P14-AC001: Counts use permitted assignments only; 248/12/8/5 not live facts. | Scoped counts, reassignment and denied search/export. | NOT STARTED |
| MYF-P14-R002 | P0732–P0743 | Register farmer/farm, visits/GPS/observations/recommendations/photos/follow-ups; offline then sync. | [Phase 14](phases/phase-14-extension-officers.md) / MYF-P14-T004, MYF-P14-T005, MYF-P14-T006 | MYF-P14-AC002: Visit/media belongs to assigned farm; revocation denies upload visibly and preserves recoverable draft. | Registration, absent GPS, photo retry, revoked offline replay and follow-up. | NOT STARTED |

## Phase 15 Cooperative and Agribusiness Platform

| ID | Source | Requirement | Phase/task | Acceptance | Test expectation | Status |
|---|---|---|---|---|---|---|
| MYF-P15-R001 | P0747–P0756 | Connect organization agents/farmers/buyers to operations. | [Phase 15](phases/phase-15-cooperatives.md) / MYF-P15-T001, MYF-P15-T002, MYF-P15-T003 | MYF-P15-AC001: Explicit scope governs each relationship; buyers cannot see private farmer finances. | Consent revocation, foreign membership and least privilege. | NOT STARTED |
| MYF-P15-R002 | P0757–P0769 | Registry, members, mapping, forecasts, aggregation, procurement, payment records, inventory, traceability references, reports, agents. | [Phase 15](phases/phase-15-cooperatives.md) / MYF-P15-T004, MYF-P15-T005, MYF-P15-T006 | MYF-P15-AC002: Eleven capabilities scoped; forecasts labeled; 17/21 interfaces defer provider settlement/full custody. | Membership, conservation, origin linkage and deferred-module contract tests. | NOT STARTED |

## Phase 16 Buyer and Market Linkages

| ID | Source | Requirement | Phase/task | Acceptance | Test expectation | Status |
|---|---|---|---|---|---|---|
| MYF-P16-R001 | P0773–P0800 | Show produce quantity/grade/date and demand quantity/district/min grade; aggregate supply. | [Phase 16](phases/phase-16-market-linkages.md) / MYF-P16-T001, MYF-P16-T002, MYF-P16-T003 | MYF-P16-AC001: 1,250 kg=1.25 t against 20-tonne demand; count only eligible unreserved stock. | Unit conversion, expired offers, reservations and buyer visibility. | NOT STARTED |
| MYF-P16-R002 | P0801–P0811 | RFQs/offers/orders/collection/weights/grading/digital receipts/buyer history. | [Phase 16](phases/phase-16-market-linkages.md) / MYF-P16-T004, MYF-P16-T005, MYF-P16-T006 | MYF-P16-AC002: Acceptance reserves atomically; receipt shows agreed measured quality/quantity. | Concurrent acceptance, cancellation, disputes, receipt replay and order access. | NOT STARTED |

## Phase 17 Payments and Farmer Wallet Ledger

| ID | Source | Requirement | Phase/task | Acceptance | Test expectation | Status |
|---|---|---|---|---|---|---|
| MYF-P17-R001 | P0814–P0823 | After commerce integrate Payment, PaymentAttempt, Payout, Settlement, Refund, Wallet, LedgerEntry with provider adapter. | [Phase 17](phases/phase-17-payments-wallet.md) / MYF-P17-T001, MYF-P17-T002, MYF-P17-T003 | MYF-P17-AC001: Sandbox order transitions use verified provider status; unknown remains pending. | Timeout, declined payment, missing webhook, payout/refund failure. | NOT STARTED |
| MYF-P17-R002 | P0824–P0832 | Never use mutable balance as authority; derive from immutable entries. | [Phase 17](phases/phase-17-payments-wallet.md) / MYF-P17-T004, MYF-P17-T005, MYF-P17-T006 | MYF-P17-AC002: +100,000 sale −20,000 withdrawal=80,000; corrections append compensating entries. | Webhook replay/reorder, changed-key payload, journal balance, reversal/reconciliation. | NOT STARTED |

## Phase 18 Farmer Economic Profile

| ID | Source | Requirement | Phase/task | Acceptance | Test expectation | Status |
|---|---|---|---|---|---|---|
| MYF-P18-R001 | P0837–P0854 | Profile years operating, seasons, annual revenue, margin, yield, transaction/repayment history, production consistency. | [Phase 18](phases/phase-18-economic-profile.md) / MYF-P18-T001, MYF-P18-T002, MYF-P18-T003 | MYF-P18-AC001: Example values not seeded as facts; missing/incomplete history clearly labeled. | Partial-year, seasons, absent repayment and reproducible snapshots. | NOT STARTED |
| MYF-P18-R002 | P0855–P0863 | Explicit consent for SACCO/bank/input/equipment financier/insurance interaction; call Farm Economic Profile. | [Phase 18](phases/phase-18-economic-profile.md) / MYF-P18-T004, MYF-P18-T005, MYF-P18-T006 | MYF-P18-AC002: Recipient sees approved fields only until expiry; revoke denies future fetch. | Wrong recipient, consent revoke/expiry, guessed link and disclosure audit. | NOT STARTED |

## Phase 19 Financing and Insurance Integrations

| ID | Source | Requirement | Phase/task | Acceptance | Test expectation | Status |
|---|---|---|---|---|---|---|
| MYF-P19-R001 | P0866–P0876 | Farmer→MyFarm→partner→offer→farmer accepts; MyFarm initially not lender. | [Phase 19](phases/phase-19-financing-insurance.md) / MYF-P19-T001, MYF-P19-T002, MYF-P19-T003 | MYF-P19-AC001: Submission shares only consented fields; acceptance binds exact terms/actor. | Unauthorized disclosure, expired offer, duplicate submit/accept and outage. | NOT STARTED |
| MYF-P19-R002 | P0877–P0884 | Possible input/equipment financing, seasonal loan, crop/livestock insurance, savings. | [Phase 19](phases/phase-19-financing-insurance.md) / MYF-P19-T004, MYF-P19-T005, MYF-P19-T006 | MYF-P19-AC002: Only partner-supported reviewed products advertised; unavailable products not promised. | Capability flags, missing disclosure, unsupported product and event replay. | NOT STARTED |

## Phase 20 Image Based Crop Intelligence

| ID | Source | Requirement | Phase/task | Acceptance | Test expectation | Status |
|---|---|---|---|---|---|---|
| MYF-P20-R001 | P0888–P0893 | Accept leaf, fruit, plant, animal and pest photos. | [Phase 20](phases/phase-20-image-intelligence.md) / MYF-P20-T001, MYF-P20-T002, MYF-P20-T003 | MYF-P20-AC001: Validate file signature/type/size/quality and subject before inference. | Dark/corrupt/huge/wrong subject/upload attack/foreign image. | NOT STARTED |
| MYF-P20-R002 | P0894–P0911 | Quality→vision candidates→knowledge→risk→human escalation; possible condition and confidence/verification. | [Phase 20](phases/phase-20-image-intelligence.md) / MYF-P20-T004, MYF-P20-T005, MYF-P20-T006 | MYF-P20-AC002: Risk/uncertainty visible; model/knowledge versions recorded; escalation available. | False-confidence corpus, unfamiliar crop, provider outage and human-review audit. | NOT STARTED |

## Phase 21 Traceability

| ID | Source | Requirement | Phase/task | Acceptance | Test expectation | Status |
|---|---|---|---|---|---|---|
| MYF-P21-R001 | P0914–P0919 | Accommodate coffee, cocoa, dairy, export and certified supply-chain use cases. | [Phase 21](phases/phase-21-traceability.md) / MYF-P21-T001, MYF-P21-T002, MYF-P21-T003 | MYF-P21-AC001: Generic lots support products; certification needs separate evidence. | Unit/product variation and missing certificate. | NOT STARTED |
| MYF-P21-R002 | P0920–P0950 | Farmer→farm→plot→harvest→batch→collection center→processor→buyer. | [Phase 21](phases/phase-21-traceability.md) / MYF-P21-T004, MYF-P21-T005, MYF-P21-T006 | MYF-P21-AC002: 100 kg split 60/40 preserves mass; merged origin links remain traversable. | Split/merge conservation, cycle prevention, missing custody and buyer privacy. | NOT STARTED |

## Phase 22 Advanced Agriculture Intelligence

| ID | Source | Requirement | Phase/task | Acceptance | Test expectation | Status |
|---|---|---|---|---|---|---|
| MYF-P22-R001 | P0953–P0963 | Evaluate yield/disease risk, production/input/procurement forecasts, prices, benchmarks, anomaly and climate risk. | [Phase 22](phases/phase-22-advanced-intelligence.md) / MYF-P22-T001, MYF-P22-T002, MYF-P22-T003 | MYF-P22-AC001: Nine candidates have data needs, baseline, uncertainty and activation criteria. | Temporal leakage, held-out farms, small cohort privacy, bias/drift. | NOT STARTED |
| MYF-P22-R002 | P0964–P0967 | Plan satellite, remote sensing, IoT as optional advanced adapters. | [Phase 22](phases/phase-22-advanced-intelligence.md) / MYF-P22-T004, MYF-P22-T005, MYF-P22-T006 | MYF-P22-AC002: Licensed source, consented location and secure device identity precede ingestion. | Stale/bad/revoked sensor, unit compatibility and license review. | NOT STARTED |

## Phase 23 SaaS and Multi Tenant Commercialization

| ID | Source | Requirement | Phase/task | Acceptance | Test expectation | Status |
|---|---|---|---|---|---|---|
| MYF-P23-R001 | P0971–P0982 | Consider Farmer Free/Pro, Cooperative, Agribusiness, NGO/Project and Enterprise plans. | [Phase 23](phases/phase-23-saas-commercialization.md) / MYF-P23-T001, MYF-P23-T002, MYF-P23-T003 | MYF-P23-AC001: Names/prices/limits approved before advertising. | Plan matrix and unpublished-plan denial. | NOT STARTED |
| MYF-P23-R002 | P0983–P0991 | Support Organization, Membership, Role, Permission, Tenant, Subscription, FeatureFlag; add billing now. | [Phase 23](phases/phase-23-saas-commercialization.md) / MYF-P23-T004, MYF-P23-T005, MYF-P23-T006 | MYF-P23-AC002: Server enforces both permission and entitlement; hidden button insufficient. | Expired subscription, webhook replay, downgrade/quota race/cross-tenant flag. | NOT STARTED |

## Phase 24 Production Hardening and Scale

| ID | Source | Requirement | Phase/task | Acceptance | Test expectation | Status |
|---|---|---|---|---|---|---|
| MYF-P24-R001 | P0995–P1005 | RBAC, IDOR, isolation, rate limits, validation, audits, encryption, secrets, sessions and backup strategy. | [Phase 24](phases/phase-24-production-hardening.md) / MYF-P24-T001, MYF-P24-T002, MYF-P24-T003 | MYF-P24-AC001: Adversarial tenant suite and session/secret controls pass; provider encryption verified. | IDOR/rate abuse/log redaction/key rotation/session revoke. | NOT STARTED |
| MYF-P24-R002 | P1006–P1014 | Backups/restores/retries/idempotency/observability/health/queue/offline conflict reliability. | [Phase 24](phases/phase-24-production-hardening.md) / MYF-P24-T004, MYF-P24-T005, MYF-P24-T006 | MYF-P24-AC002: Restore meets approved RPO/RTO; failed jobs visible with retries or escalation. | Restore drill, queue crash/dead-letter, outage and offline chaos. | NOT STARTED |
| MYF-P24-R003 | P1015–P1020 | Immutable ledgers/reconciliation/no duplicate payments/transactional writes/audits. | [Phase 24](phases/phase-24-production-hardening.md) / MYF-P24-T007, MYF-P24-T008, MYF-P24-T009 | MYF-P24-AC003: Settlements reconcile or exceptions assigned; posted history cannot mutate. | Financial rebuild/webhook replay/rollback/audit atomicity. | NOT STARTED |
| MYF-P24-R004 | P1021–P1027 | Indexes/slow queries/cache/pagination/pooling/load tests. | [Phase 24](phases/phase-24-production-hardening.md) / MYF-P24-T010, MYF-P24-T011, MYF-P24-T012 | MYF-P24-AC004: Peak traffic meets approved latency/errors without cache leaks/unbounded reads. | Tenant-skew load, query plans, cursor boundaries, connection exhaustion. | NOT STARTED |

## Global source and user controls

| ID | Source | Requirement | Phase/tasks | Acceptance | Tests | Status |
|---|---|---|---|---|---|---|
| MYF-G-R001 | P0001–P0026; P1029–P1067 | Vision, evolution, milestones, MVP at 8 | P00 scope task; every phase audit task | No AI/commerce/lending in MVP | Release/scope comparison | NOT STARTED |
| MYF-G-R002 | P1069–P1102 | Implement/test/audit/remediate/retest/close with evidence and verdict | Every phase final task | No failed mandatory checks/blockers at closure | Closeout evidence review | NOT STARTED |
| MYF-G-R003 | P1103–P1109 | Prioritize 0→1→2→3→4 and trusted farm/financial records | P00 scope and sequential gates | Initial records path preserved | Dependency audit | NOT STARTED |
| MYF-U-R001 | Pasted request §§1–2 | Whole source, MyFarm, Uganda/global, poultry/crop, assumptions separately | P00 tasks; source/decision reports | Complete extract, no invented research | Source/terminology comparison | NOT STARTED |
| MYF-U-R002 | Pasted request §§3–5,8 | Required files and A–O phase specs with proposed schemas/tasks | Every phase final task | 61 required files; 25 A–O specs | File/section/ID/link audit | NOT STARTED |
| MYF-U-R003 | Pasted request §6 | Deterministic money/stock, idempotent sync, authorization and safe AI | P04/P05/P07/P11/P12/P17 feature tasks | Invariants defined with objective test oracles | Money/stock/replay/IDOR/confirmation tests | NOT STARTED |
| MYF-U-R004 | Pasted request §§7,15 | Documentation-only now; future scope outside MVP | Every phase final task | Only Markdown documentation written | Workspace scope inspection | REFERENCE ONLY — historical documentation-only assignment superseded by explicit Phase1 authorization |
| MYF-U-R005 | Pasted request §§9–11 | Agent protocol, four commands, verified status and closeout | P01 quality task and all audit tasks | Truthful command evidence; initial NOT STARTED | CI/status/closeout review | NOT STARTED |
| MYF-U-R006 | Pasted request §§12–16 | Traceability/audit/final report | Documentation audit; all phase final tasks | Requirements map to task/AC/test/status | Source/dependency/coverage audit | NOT STARTED |

These statuses describe implementation. Authored docs do not complete phase tasks. Policy context links/numerical examples in the source are not validated research or regulatory approvals.

## Phase 0 session evidence — 2026-10-08

[Research register](product/research-evidence-register.md) contains planning facts only, no accepted farmer evidence. District is Rukungiri. [Interim closeout](reports/phase-00-closeout-2026-10-08.md) maps T001–T010 and all three ACs; none passes in full yet. Source/user control rows remain implementation pending; updated metadata does not claim later tasks completed.

Phase0 closure exception: [owner acceptance](reports/phase-00-owner-approval-2026-10-08.md). Phase1 current evidence is in [closeout](reports/phase-01-closeout-2026-10-08.md); T001–T004 verified complete, T005–T013 partial/unverified.
