# Phase 12 migration and push follow-up

On 2026-11-20 (Africa/Nairobi), the owner instructed: "RUM MIGRATIONS. COMMIT AND PUSH". This authorizes applying the existing reviewed migrations and ordered provider policies to the configured development database, recording the result, and pushing the completed Phase 12 work to `origin/main`. It does not authorize a production deployment, a new provider, or Phase 13.

The application work is already committed as `a6e57b9` (Complete Phase 12 expense review and voice test adapters). The working tree was clean before this follow-up. The remote main branch was verified at `34d1ce602b0b615b7d6fe1e02227c3cec80ba633` before pushing.

## Migration result: BLOCKED, no database changes

The configured target is the previously used Supabase development project `sudqhluwsaijvjjcegpv`, database `postgres`. No credentials are included in this report.

- `node node_modules/prisma/build/index.js migrate status`: FAIL to connect through the configured direct endpoint, including an unrestricted network retry.
- `Resolve-DnsName db.sudqhluwsaijvjjcegpv.supabase.co`: FAIL, DNS name does not exist.
- A read-only connection through the configured session pooler, using the existing migration-owner credentials and CA-verified TLS: FAIL, PostgreSQL code `XX000`, `(ENOTFOUND) tenant/user postgres.sudqhluwsaijvjjcegpv not found`.
- `prisma migrate deploy`: NOT RUN because the target could not be inspected or backed up.
- Ordered provider policy application, hosted drift comparison, runtime grants and data-preservation checks: NOT RUN for the same reason.

These results establish that the configured target is unavailable; they do not establish whether the project is paused, deleted or moved. No reset, history reconciliation, schema write, policy write, credential change or production deployment was performed. Existing Phase 12 local verification remains historical evidence as recorded in the closeout; no test suite was rerun or claimed as newly passing in this documentation-only follow-up. `git diff --check` passed before commit.

## Recovery and retry

Resume the existing project or supply its replacement connection configuration through local secret configuration. Once reachable: verify the actual target and applied migration history; take and verify a backup; apply the pending existing Prisma migrations; run every provider SQL file in `supabase/provisioning.json` order; verify schema drift, current runtime/browser privileges and preservation of existing records. Retain the additive schema and financial receipts on application rollback; do not use destructive down migrations. P12-C2 remains open, and hosted CI success is not claimed by a push alone.

Push status is reported in the task response after the actual Git operation; this report does not claim an unobserved remote result.

## Successful authorized retry - 2026-11-20

The owner requested "RETRY", then explicitly approved the full local backup and isolated restore after automatic approval review required specific authorization for the sensitive-data export. The same development project became reachable. The earlier connection failures above remain historical evidence. The implementation and first report were pushed successfully through `6ad820afdd10bbf34d3778fd7ce0d09720fa68ce`; [hosted quality run 44801801916](https://github.com/WilsoftTech/MyFarm/actions/runs/44801801916) completed successfully.

### Backup, migration and preservation

The private full custom-format backup is retained outside Git at `.cache/hosted-backups/phase12-20261120/before.dump` (712117 bytes; SHA-256 `6473847ac3c6fadb75302e723111d2a7967990db5b12cd26c10181acb440a503`). `pg_restore --list` passed. The application schemas (`public`, `myfarm_private`) restored successfully into a new isolated PostgreSQL 17 container with the existing test Supabase stand-in. All 43 pre-migration public-table counts and digests matched, including migration history. This verifies application-schema recovery, not a full hosted Auth/storage service restoration. The temporary restore container and its database volume were removed after verification; the approved backup remains private and ignored.

The migration command used the existing owner credentials over the session pooler with CA-verified TLS. All five pending migrations applied successfully:

| Migration | Applied SHA-256, exact repository bytes |
|---|---|
| `202611120001_farm_insights` | `f4176eee8ba1c655ecd2923985b76a079903ee0434d9534e03029d19f4f9877f` |
| `202611120002_threshold_insights` | `2bd7d66dfbfa2e076aa9cdc4f6d113f65916dd969f1cf984a81f4bf55b5a1fe1` |
| `202611120003_assistant_questions` | `66ad1f2a392ff0d2c570fbf4ac700f62599016781f260fcecde621ce9b76e275` |
| `202611130001_assistant_question_types` | `18c16177333c2d7e5a88400249e383e5c6fae457c9db2b0cf1bca90e87c1a7a2` |
| `202611190001_voice_expense_drafts` | `c068ac1472661399c0d5a9721d53fe1b879a19f8afec3033b1cc43a6d4771037` |

All 18 existing SQL policy files in `supabase/provisioning.json` were then applied successfully in manifest order. No dependency, application code, migration file or migration-history checksum was changed. Existing row counts and digests were unchanged, excluding migration-history additions and the new `TransactionCategory.metric` field. Its one expected change was verified separately: exactly the approved Feed cost category is marked `FEED`. Five new application tables are present. The historical CRLF checksum of the registry migration and the extra legacy poultry migration remain intact.

### Verification and remaining conditions

| Command / check | Observed result |
|---|---|
| `node .cache/phase12-hosted.mjs backup` | PASS: snapshot, full backup and readable archive |
| `node .cache/phase12-hosted.mjs restore` | PASS: 43 application-table digests match |
| `node .cache/phase12-hosted.mjs apply` | PASS: `prisma migrate deploy` and all 18 policy files |
| `node .cache/phase12-hosted.mjs verify` | Data, checksums, grants and RLS PASS; runner exits nonzero on the inherited drift below |
| `node .cache/phase12-hosted.mjs runtime` | PASS: actual restricted runtime login reads all five new tables; `anon` and `authenticated` each receive permission denied on all five |
| `node .cache/phase12-hosted.mjs schema` | Feed marker PASS; Prisma migration status exit 0, up to date; drift exit 2, legacy table only |

Every public table has RLS enabled; browser roles have no public table grants. The runtime role remains a nonsuperuser with no bypass-RLS, database-creation or role-creation rights. Draft reads/inserts and selected review updates are granted; deletion and actor reassignment are not. Server-side scoped queries remain essential for the shared runtime role. [Sanitized verification evidence](evidence/phase12-hosted-2026-11-20/verify.json) and [drift output](evidence/phase12-hosted-2026-11-20/drift.log) contain no backup records or credentials.

**Drift is not zero:** Prisma proposes removing the extra legacy `LivestockBatch` table and its two foreign keys. That table was already present in the pre-migration snapshot and is explicitly preserved by the [Phase 3 hosted repair](phase-03-runtime-permissions-2026-10-25.md). No other drift was reported. No destructive cleanup or history rewrite was performed. There are 27 hosted migration records: all 26 repository migrations plus the historical legacy entry.

The database-application portion of P12-C2 and inherited Phase 10/11 provisioning is now verified on hosted development. Full authenticated application journeys against hosted services were NOT RUN in this retry; production deployment, production recovery, real speech/providers, field acceptance and remaining release gates remain unclaimed. No local unit/build suite was rerun for this operations/documentation-only change; the successful hosted CI above covers the pushed implementation. Next: separately authorized hosted application verification and owner review of the remaining closeout conditions. Retain additive tables and immutable financial history on application rollback.
