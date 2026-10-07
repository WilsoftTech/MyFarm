# MyFarm — AI Engineering Agent Instructions

> Applies to Codex, Claude Code, and other AI coding agents working in this repository. These instructions are subordinate to explicit user requests and the approved project documentation. Do not treat proposed designs as implemented facts.

## 1. Mission and scope

MyFarm is an offline-first agricultural operating system, initially for Ugandan crop and poultry farmers. Build reliable farm records, accounting, production management, inventory, and profitability before expanding into AI, marketplaces, payments, and financial integrations.

**Never implement a later phase simply because it is described in the roadmap.** Read `docs/PROJECT-STATUS.md`, `docs/MASTER-IMPLEMENTATION-ROADMAP.md`, the active `docs/phases/phase-XX-*.md`, and relevant `docs/architecture/` decisions before making changes. If those documents are missing, state the gap and ask for direction rather than inventing completed decisions. The authoritative source is the Farm Master Document and approved project documentation.

## 2. Mandatory working protocol

1. **Inspect:** Read the task, current phase, repository structure, package scripts, relevant source, tests, and git status. Check for uncommitted user work; never overwrite it.
2. **Understand:** Trace the existing feature end-to-end (UI → application service → domain → repository → database). Identify constraints, permissions, data ownership, and edge cases.
3. **Reuse:** Search for existing components, hooks, utilities, schemas, types, services, and design tokens before adding anything new.
4. **Plan:** For nontrivial work, provide a concise plan, affected files, risks, test strategy, and migration implications. Ask for approval for material scope or architecture changes.
5. **Implement:** Make the smallest coherent change that solves the task. Prefer incremental, reviewable edits. Avoid opportunistic refactors.
6. **Verify:** Run targeted tests, then relevant project-wide checks. Never claim a check passed unless it actually ran and passed.
7. **Audit:** Review diffs for regressions, security leaks, duplication, accessibility, mobile layout, performance, and unnecessary dependencies.
8. **Report:** Summarize what changed, tests/results, remaining risks, migration status, and the next step. Update status documents only with verified facts.

## 3. Component and code reuse — mandatory

- **Search before creating.** Reuse existing shadcn/ui primitives, shared UI components, form fields, dialog patterns, table wrappers, navigation, cards, feedback states, and design tokens.
- Do not duplicate a component merely to change its text, styling, or data source; extend it with clear props or composition when appropriate.
- Avoid premature abstraction: extract shared logic when there is genuine reuse or a stable domain boundary, not for a one-off line of code.
- Prefer existing hooks, validation schemas, formatting helpers, and API clients over parallel implementations.
- Keep common components generic and domain rules in domain/application services. Never place accounting calculations in React components.
- Avoid large monolithic components and deeply nested conditional JSX; split by meaningful responsibilities.
- Do not edit generated files, vendored code, or third-party package sources.
- Preserve existing behavior, accessibility, and responsive layouts when refactoring.

## 4. Dependency discipline

- **Do not install a package until you have checked whether existing dependencies or platform APIs can solve the problem.** Inspect `package.json` and the lockfile first.
- Prefer built-in JavaScript/TypeScript, browser, Node.js, React, Next.js, and installed libraries where appropriate.
- If a new dependency is justified, document its purpose, alternatives considered, bundle/runtime impact, maintenance/security status, licensing, and why existing options are insufficient.
- Ask for approval before introducing a major framework, ORM, authentication system, state-management library, queue, external SaaS, paid service, or architecture-changing dependency.
- Never install multiple libraries for the same concern without a documented reason.
- Do not use `--force`, `--legacy-peer-deps`, broad dependency upgrades, or lockfile regeneration to conceal conflicts.
- Pin or constrain versions according to the repository policy; commit lockfile changes with dependency changes.
- Do not add dependencies for trivial helpers (dates, IDs, formatting, basic validation) when existing tools suffice.

## 5. Architecture boundaries

Follow this separation unless an approved architecture decision explicitly changes it:

`UI → application services → domain logic → repository/data access → PostgreSQL`

- UI components display state and collect input; domain services enforce business rules.
- Validate untrusted inputs at server boundaries with existing Zod schemas or approved equivalents.
- Server-side authorization is mandatory; hiding a button is not authorization.
- Keep secrets and privileged database access server-side. Do not expose private environment variables through client bundles.
- Use TypeScript strictly; avoid `any`, unchecked casts, and suppressed errors. If unavoidable, explain and isolate them.
- Keep modules cohesive and public interfaces minimal. Prefer explicit contracts over magic strings and hidden side effects.
- Follow existing folder conventions; do not restructure the repository without approval.
- Avoid speculative scalability layers, microservices, event buses, or caching before demonstrated need.

## 6. Database and migration safety

- Inspect the current Prisma schema and migration history before proposing schema changes.
- Prefer additive, backward-compatible migrations. Document data migration and rollback/restore considerations.
- **Never run destructive migrations, reset databases, drop tables, or execute `prisma db push` against shared/production data without explicit approval and a verified recovery plan.**
- Never point migration shadow databases at production or shared application databases.
- Do not assume local and production schemas are identical; verify the target environment.
- Use transactions for multi-record operations requiring atomicity; design idempotency for retried mutations.
- Index access paths based on actual queries; avoid speculative indexes.
- Never log credentials, financial secrets, or sensitive farmer records.

## 7. Authorization, privacy, and multi-tenancy

- Every farm, plot, enterprise, transaction, harvest, inventory movement, document, and report access must enforce the authenticated user's authorized scope.
- Do not trust client-supplied `userId`, `farmId`, `organizationId`, role, or tenant identifier without server-side ownership/membership verification.
- Test cross-user, cross-farm, cross-tenant, and nested IDOR scenarios for sensitive endpoints.
- Enforce least privilege for farmers, managers, agents, administrators, and future organizations.
- Collect only necessary personal data; make precise GPS optional unless explicitly required and approved.
- Add audit events for consequential financial, permission, and administrative changes.
- Apply rate limiting and abuse controls to sensitive endpoints using approved infrastructure.

## 8. Accounting and financial integrity

- Authoritative figures are computed by deterministic, tested application code — **never by an LLM**.
- Use decimal-safe arithmetic or integer minor units as defined in the approved accounting design; never rely on floating-point arithmetic for money.
- Distinguish revenue, expenses, direct costs, overhead, cash flow, receivables, payables, and profit; do not silently equate cash movements with profit.
- Associate records with authorized farm/enterprise/season dimensions; avoid accidental double counting.
- Corrections must preserve an audit trail; do not silently rewrite posted financial history.
- Future wallet/payment balances must derive from immutable ledger entries, not mutable balance fields as the source of truth.
- Financial writes must be atomic and idempotent where retries are possible. Test rounding, duplicate requests, partial failure, and reconciliation.

## 9. Inventory, livestock, and production integrity

- Stock balances derive from append-only stock movements, not untracked quantity overwrites.
- Model units explicitly and validate conversions (e.g., kg vs bags); never silently mix units.
- Preserve provenance of harvests, sales, losses, transfers, adjustments, and poultry mortality.
- Enforce nonnegative stock rules where applicable; define explicit exceptions rather than silently permitting invalid balances.
- Use deterministic calculations for flock counts, production yields, margins, and inventory balances.
- Test concurrent movements, retries, reversals, and season boundaries.

## 10. Offline-first reliability

- Design farmer-facing workflows for intermittent connectivity; avoid making the UI appear successful before local persistence succeeds.
- Use IndexedDB/Dexie and service workers only as approved by the phase architecture.
- Every offline mutation must have a stable `clientMutationId`, device identity, timestamps, version, and sync status as specified by the sync contract.
- Retries must not create duplicate expenses, harvests, activities, or stock movements.
- Define conflict behavior explicitly; never silently overwrite financial or inventory data with last-write-wins.
- Show meaningful pending, synced, conflict, and failed states. Preserve queued data through transient network errors.
- Treat browser storage as potentially evictable; document persistence, recovery, and export options.
- Test offline creation → reconnect → retry → exactly one authoritative record, including interrupted sync.

## 11. AI and agronomic safety

- AI may explain validated farm data, but must not fabricate financial metrics, weather observations, crop diagnoses, or farmer records.
- Separate **FACT**, **INFERENCE**, **RECOMMENDATION**, and **UNCERTAINTY** in AI-generated outputs.
- Retrieve only data the current user is authorized to see; enforce authorization before retrieval, not just in prompts.
- Validate structured model outputs against schemas; never let model text write directly to financial or inventory records.
- Voice-extracted mutations require user confirmation before committing.
- Image-based crop/livestock assessments are possible conditions, not definitive diagnoses; provide appropriate uncertainty and escalation guidance.
- Avoid introducing AI providers or paid APIs before their approved phase and explicit authorization.

## 12. UX, accessibility, and performance

- Build mobile-first for low-cost Android devices, variable bandwidth, and intermittent connectivity.
- Use simple farmer-facing language and actionable labels; do not expose accounting jargon when plain language is clearer.
- Reuse the existing visual system: typography, spacing, color tokens, shadcn/ui components, and interaction patterns.
- Every interactive control must have working behavior, accessible names, keyboard support, and appropriate loading/error/empty states.
- Use responsive layouts, sensible touch targets, and clear validation feedback.
- Avoid unnecessary animation, heavy client-side dependencies, and large images; optimize for slow networks.
- Keep server components by default where appropriate in Next.js; add client boundaries only for genuine interactivity.
- Avoid unnecessary network calls, N+1 database queries, broad data fetching, and unbounded lists; use pagination where needed.
- Do not invent translations. Make localization extensible, and validate language quality with real speakers before release.

## 13. Tests and quality gates

- Add tests for new domain rules and regressions. Test both expected behavior and failure modes.
- Use existing Vitest, React Testing Library, and Playwright setup; do not introduce a competing test stack.
- Run the repository's actual scripts, normally:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

- Run targeted tests while iterating and broader suites before declaring a phase complete.
- For data-sensitive changes, include authorization/IDOR, tenant isolation, idempotency, concurrent-write, and rollback tests as relevant.
- Do not delete or weaken failing tests to achieve a green build.
- If a test cannot run due to missing infrastructure or credentials, report **NOT RUN**, explain why, and do not claim PASS.
- A passing build does not replace security, migration, or functional verification.

## 14. Git, scope control, and communication

- Check `git status` before editing. Never discard unrelated or uncommitted changes.
- Make small, cohesive commits only when requested or permitted by the user's workflow.
- Do not push, deploy, merge, modify production settings, or run destructive operations without explicit authorization.
- Avoid formatting unrelated files or broad automated rewrites.
- If a request conflicts with approved requirements, highlight the conflict and seek a decision before implementing.
- When debugging, reproduce the issue, locate the root cause, add a regression test, and fix the cause rather than suppressing the error.
- Never claim that code is production-ready solely because it compiles.

## 15. Definition of done and closeout

A task is complete only when:

- [ ] The approved requirement is implemented without scope creep.
- [ ] Existing components and utilities were reused where appropriate.
- [ ] No unnecessary dependency or duplicate abstraction was introduced.
- [ ] Security and authorization boundaries were verified.
- [ ] Relevant tests were added and executed.
- [ ] Lint, typecheck, tests, and build results are reported accurately.
- [ ] Database/migration impacts and deployment risks are documented.
- [ ] Relevant documentation is updated.
- [ ] Known limitations and deferred work are explicit.

For every substantial task, report:

1. **Scope delivered** — concise description and important files.
2. **Reuse/dependencies** — what was reused and any dependency additions.
3. **Verification** — exact commands and PASS/FAIL/NOT RUN results.
4. **Security/data integrity** — checks performed and unresolved risks.
5. **Migrations/deployment** — whether required, applied, or explicitly not performed.
6. **Next action** — what should happen next.

For phase closure, follow `docs/engineering/phase-closeout-template.md` and record a justified verdict: **PASS**, **PASS WITH CONDITIONS**, or **FAIL**. Do not mark a phase closed when blocking issues remain.

## 16. Decision hierarchy

When instructions conflict, prioritize: explicit current user authorization and safety constraints → approved project requirements and architecture decisions → active phase specification → established repository conventions → these general engineering guidelines. Surface substantive conflicts rather than silently choosing.

**Core rule: inspect → reuse → plan → implement → test → audit → report. Build only what is needed, preserve what already works, and protect farmer data.**
