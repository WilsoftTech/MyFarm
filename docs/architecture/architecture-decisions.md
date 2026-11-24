# Architecture decisions

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED - affected Phase 15 scope, ownership, current access, ledger and connectivity behavior; historical evidence retained below.
- Implementation status: Phase 15 COMPLETED - 7/7 software tasks locally verified; conditional phase acceptance pending.
- Last reviewed: 2026-11-24 (Africa/Nairobi).
- Related phase/task IDs: MYF-P15-T001 through T007; D-P15-001 and D-P15-002; earlier references retained in dated sections.
- Verified completed work: Phase 15 acceptance, cumulative local quality/browser/integration, zero drift and actual recovery checks pass; see closeout for counts and limits.
- Remaining work/blockers: P15-C1 through C4; owner acceptance, hosted CI/rollout and inherited release conditions remain separate.
- Evidence/report links: [Phase 15 closeout](../reports/phase-15-closeout-2026-11-24.md).
<!-- MYFARM-STATUS-END -->

[Decision log](../DECISION-LOG.md) is the canonical record of status/owner/blockers. This file supplies ADR reasoning. Baseline selected by request is different from approval of a proposed schema or provider.

| ADR | Decision / status | Reason and alternatives | Consequence / validation |
|---|---|---|---|
| ADR-01 | Modular Next.js app — request baseline | Low solo-developer overhead; microservices deferred | Import boundaries and isolated domain tests |
| ADR-02 | Personal/organization isolation workspace — implemented in the approved Phase 2/15 scope | Personal records remain farmer-owned; institutional roles and consent are separate under D-P15-002 | Q24 resolved for this scope; composite parent/consent/IDOR tests and local migration/recovery evidence in Phase 15 closeout |
| ADR-03 | Exact decimal money/typed units — proposed enforcement of required integrity | Avoid floats/unit ambiguity; precision remains Q09/Q12 | Golden round trip, currency/unit guards |
| ADR-04 | Append stock ledger and source-linked corrections — required principle, schema proposed | Mutable balances lose auditability | Rebuild/concurrent negative-stock tests |
| ADR-05 | Command receipt + custom push/pull sync — proposed contract | Retry-safe server authority; local-only DB not durable synchronization | Q16; replay/version/tombstone/eviction cases |
| ADR-06 | Bounded authorized read-only AI tools — required safety, contract proposed | Trusted context and deterministic arithmetic; no direct SQL/model writes | Q20; injection/groundedness/isolation corpus |
| ADR-07 | Exact-payload voice confirmation — required | Recognition errors must not commit money silently | Q21; hash/expiry/edit/replay tests |
| ADR-08 | Balanced immutable wallet journal — proposed stronger ledger design | Immutable derived balance is source requirement; balanced journal adds reconciliation proof | Q26/Q27; counteraccounts/fees/reversal tests |
| ADR-09 | Vercel/Supabase/private media — approved provider override, hosted configuration pending | Managed operation vs unnecessary infrastructure | Q04/Q34; compatibility/restore/load/cost proof |
| ADR-10 | Future entitlements separate from data grants — proposed enforcement | Paid plan is not consent or ownership | Q33; downgrade/cross-tenant tests |
| ADR-11 | Versioned projections with basis/coverage — proposed | Explain/rebuild analytics/profile after corrections | Q09/Q17/Q28; source reconciliation |
| ADR-12 | Current grants rechecked during sync — required server authority | Offline stale roles cannot authorize server writes | Q16/Q23; revoked assignment replay |

Decision changes must state source requirement affected, alternatives, security/integrity consequences, migration/client impact, tests and approval. No proposed decision is silently promoted by document existence. [Roadmap](../MASTER-IMPLEMENTATION-ROADMAP.md) records scope collisions (Phase 15 vs 17/21) and [status](../PROJECT-STATUS.md) records evidence.


## Phase1 implemented evidence and limits

ADR-P01-01 APPROVED: direct user selected Supabase PostgreSQL + Supabase Auth, superseding Neon source baseline. Foundation subset/schema only implemented; later personal/farm cardinalities remain proposals. [Canonical decision log](../DECISION-LOG.md).

[Closeout](../reports/phase-01-closeout-2026-10-08.md); [setup](../engineering/foundation-local-setup.md).
