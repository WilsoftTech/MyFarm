# Domain model

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — current Phase01 implementation/evidence/status review; no completion inferred from review.
- Implementation status: NOT STARTED — 0% (direct feature scope unimplemented).
- Last reviewed: 2026-10-08 (Africa/Nairobi), live provider and hosted closeout session.
- Related phase/task IDs: Future phase architecture as referenced; Phase01 review session T001–T013.
- Verified completed work: Scope/status/provider applicability reviewed; no financial/offline/farm-domain runtime implementation verified.
- Remaining work/blockers: Associated future tasks, business decisions and exit gates pending; no phase advancement.
- Evidence/report links: [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](../reports/phase-01-provider-verification-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

**Proposed relationships and bounded domains.** Source entities/fields are preserved in the relevant phase F; support rows such as receipts, assignments and consent grants are recommendations.

```mermaid
erDiagram
  User ||--o{ FarmMember : authorized
  Farmer ||--o{ Farm : owns
  Organization ||--o{ Membership : contains
  Farm ||--o{ Plot : contains
  Farm ||--o{ Enterprise : operates
  Farm ||--o{ Season : schedules
  Enterprise ||--o{ CropCycle : runs
  Enterprise ||--o{ LivestockBatch : runs
  Plot ||--o{ CropCycle : grows
  Season ||--o{ CropCycle : groups
  Farm ||--o{ Expense : records
  Enterprise o|--o{ Expense : allocates
  Farm ||--o{ InventoryItem : stores
  InventoryItem ||--o{ StockMovement : changes
  Farm ||--o{ FarmActivity : schedules
  CropCycle ||--o{ Harvest : yields
```

User is authenticated principal; Farmer is agricultural identity/profile. Cardinality and agent-assisted onboarding remain Q05/Q23. FarmMember grants farm access; Organization Membership alone never grants private farmer history. Explicit sharing/assignment records control institutional use.

EnterpriseType is generic; a plot-linked CropCycle models seasonal/perennial crop choices after Q07. Poultry batch need not attach to a land plot. Current flock = opening + acquisitions − mortality − bird sales ± approved adjustments; eggs/feed tracked in separate units/events. Never decrement birds twice through production and inventory.

Accounting uses farm-required records with optional plot/enterprise/season/activity links. Sale revenue and PaymentRecord collections must not double-count. Receivable/Payable derives from obligation and allocations; future provider Payment is a different lifecycle. Stock source references link harvest/sales to one posting.

Later domains: organization procurement/order/reservation/collection; immutable wallet journal; consented economic snapshots/partner offers; private image assessment; lot lineage/custody; evaluated forecasts; entitlements. Add their tables in their phases, not because this diagram is written. [Phases](../MASTER-IMPLEMENTATION-ROADMAP.md), [multi-tenancy](multi-tenancy.md) and [financial rules](financial-integrity.md) govern ownership/integrity.
