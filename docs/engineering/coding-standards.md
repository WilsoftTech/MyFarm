# Coding standards

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase02 closeout status/link review; content unchanged; no completion inferred from review.
- Implementation status: REFERENCE ONLY — N/A (navigation/protocol/template/decision/evidence record; no directly implementable scope).
- Last reviewed: 2026-10-09 (Africa/Nairobi), Phase02 implementation and closeout session.
- Related phase/task IDs: Phase01 review session; MYF-P01-T001 through MYF-P01-T013; Phase00 owner acceptance where referenced; Phase02 review session (MYF-P02-T001–T013).
- Verified completed work: Reference content/status/evidence links reviewed; document existence or review does not complete implementation tasks.
- Remaining work/blockers: Maintain alignment after Phase01 live verification; historical results stay historical and source body remains immutable.
- Evidence/report links: [Phase02 closeout](../reports/phase-02-closeout-2026-10-09.md); [Phase02 every-document review](../reports/phase-02-document-review-2026-10-09.md); [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](../reports/phase-01-provider-verification-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Future implementation uses strict TypeScript with explicit DTOs/schema boundaries. Domain functions accept validated primitives/value objects and return deterministic results/errors; no React, provider HTTP or Prisma dependency in domain logic. Application services orchestrate authorization, transactions and adapters. Repositories require a verified access context and scoped parents, never optional tenant filters.

React components gather/display data and state; hooks do not calculate authoritative farm/wallet balances. Reuse accessible fields and Zod/RHF input rules, but server validation remains required. Use money decimal strings/currency and quantity/unit value objects; do not use JavaScript float arithmetic for authoritative finance. Do not use local timestamps to settle conflicts.

Proposed directories: src/app/ for pages/routes; src/modules/{phase-module}/contracts, domain, application, infrastructure; src/lib/ only shared technical primitives; tests/ for domain/component/integration/E2E/security. Exact module names need Phase 1 agreement; phase E paths are proposed.

Errors are typed by validation/conflict/denied/retryable/permanent; responses include correlation without secrets. No catch-and-ignore on sensitive writes. External calls outside transactions, with durable intent/status where needed. Keep query pagination bounded; validate file content/type/owner; log minimal metadata.

Name services by intent (RecordFarmExpense, RecordHarvest, TransferInventory) and tests by observable business outcome. Avoid speculative abstractions or unrelated cleanup. Comments explain invariants/reasons, not restate code. Versioned migrations/contracts require [migration policy](migration-policy.md). Run [quality checks](definition-of-done.md); respect [scope/agent rules](ai-agent-instructions.md).
