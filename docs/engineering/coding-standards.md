# Coding standards

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — status/applicability/structure/link review; no runtime or independent product validation.
- Implementation status: REFERENCE ONLY — N/A (no directly implementable scope).
- Last reviewed: 2026-10-08 (Africa/Nairobi), Phase 00 session.
- Related phase/task IDs: Phase 00 session; MYF-P00-T001 through MYF-P00-T010; future phase references remain pending.
- Verified completed work: Reference/protocol/navigation/report review performed; no phase completion implied.
- Remaining work/blockers: Keep aligned with verified task/evidence changes; Phase 00 discovery gate still unmet.
- Evidence/report links: [Phase 00 closeout](../reports/phase-00-closeout-2026-10-08.md); [every-document review](../reports/phase-00-document-review-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Future implementation uses strict TypeScript with explicit DTOs/schema boundaries. Domain functions accept validated primitives/value objects and return deterministic results/errors; no React, provider HTTP or Prisma dependency in domain logic. Application services orchestrate authorization, transactions and adapters. Repositories require a verified access context and scoped parents, never optional tenant filters.

React components gather/display data and state; hooks do not calculate authoritative farm/wallet balances. Reuse accessible fields and Zod/RHF input rules, but server validation remains required. Use money decimal strings/currency and quantity/unit value objects; do not use JavaScript float arithmetic for authoritative finance. Do not use local timestamps to settle conflicts.

Proposed directories: src/app/ for pages/routes; src/modules/{phase-module}/contracts, domain, application, infrastructure; src/lib/ only shared technical primitives; tests/ for domain/component/integration/E2E/security. Exact module names need Phase 1 agreement; phase E paths are proposed.

Errors are typed by validation/conflict/denied/retryable/permanent; responses include correlation without secrets. No catch-and-ignore on sensitive writes. External calls outside transactions, with durable intent/status where needed. Keep query pagination bounded; validate file content/type/owner; log minimal metadata.

Name services by intent (RecordFarmExpense, RecordHarvest, TransferInventory) and tests by observable business outcome. Avoid speculative abstractions or unrelated cleanup. Comments explain invariants/reasons, not restate code. Versioned migrations/contracts require [migration policy](migration-policy.md). Run [quality checks](definition-of-done.md); respect [scope/agent rules](ai-agent-instructions.md).
