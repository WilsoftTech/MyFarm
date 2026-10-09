# Phase 01 hosted verification — 2026-10-08

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase02 closeout status/link review; content unchanged; no completion inferred from review.
- Implementation status: REFERENCE ONLY — N/A
- Last reviewed: 2026-10-09 (Africa/Nairobi), Phase02 implementation and closeout session.
- Related phase/task IDs: MYF-P01-T001–T013; Phase02 review session (MYF-P02-T001–T013).
- Verified completed work: Evidence-linked session report; not implementation scope.
- Remaining work/blockers: See current phase verdict.
- Evidence/report links: [Phase02 closeout](phase-02-closeout-2026-10-09.md); [Phase02 every-document review](phase-02-document-review-2026-10-09.md); [Closeout](phase-01-closeout-2026-10-08.md).
<!-- MYFARM-STATUS-END -->

Phase1 only. GitHub branch codex/phase-01-closeout in WilsoftTech/MyFarm and isolated Vercel project williskarugaba-wilsoft/myfarm-phase01-preview explicitly approved. Restricted database credential upload separately approved after automatic review rejected the initial upload; no bypass occurred. Administrator credentials and Supabase service-role key stayed local.

## Actual hosted results

| Check | Actual result | Evidence |
|---|---|---|
| vercel deploy --target preview --yes | PASS0; READY, actual inspected target preview, Next.js16.4/Node24 | [Record](evidence/phase-01-2026-10-08-mcp/preview-deployment.json) |
| node --use-system-ca .cache/preview-check.mjs | PASS0;12 hosted checks: real Auth, scoped session, restricted database health/TLS, workspace, IDOR denial, private download, HTTP429, retry and revocation | [Results](evidence/phase-01-2026-10-08-mcp/preview-tests.json), [executed source](evidence/phase-01-2026-10-08-mcp/preview-harness.txt) |
| node --use-system-ca .cache/live-browser-check.mjs | PASS0;28 live provider/browser checks | [Results](evidence/phase-01-2026-10-08-mcp/provider-tests.json), [executed source](evidence/phase-01-2026-10-08-mcp/live-provider-harness.txt) |
| npm run test:e2e | PASS0;14 desktop/mobile tests | [Log](evidence/phase-01-2026-10-08-mcp/e2e.log) |
| actionlint1.7.12 -shellcheck= .github/workflows/quality.yml | PASS0; official archive checksum matched 6e7241b51e6817ea6a047693d8e6fed13b31819c9a0dd6c5a726e1592d22f6e9 | [Log](evidence/phase-01-2026-10-08-mcp/actionlint.log) |
| GitHub CI push/manual workflow_dispatch | FAIL/startup_failure; zero jobs/check runs created; no remote test/build executed | [Run records](evidence/phase-01-2026-10-08-mcp/github-runs.json), [manual run](https://github.com/WilsoftTech/MyFarm/actions/runs/37712242305) |

[Protected preview](https://myfarm-phase01-preview-2agd46ome-williskarugaba-wilsoft.vercel.app), deployment dpl_6zxhdqsioES8idqQaDMT5mbcekPR. Vercel CLI generated its normal protection-bypass token for authenticated verification; it was not published or logged. Application authorization remained required.

GitHub repository Actions is enabled/all actions allowed. The actual quality workflow remains active; failed synthetic workflow has empty name, path BuildFailed, state deleted. Push on a212ee7 and push/manual dispatch on543b828 failed before jobs. The account/platform root cause is unverified. Billing API unavailable with existing OAuth scope. User asked to inspect displayed reason/Actions availability. No paid upgrade, OAuth scope expansion or visibility change attempted.

## Remediation and cleanup

CLI attempts on main unexpectedly reported production target, including explicit preview flag. Both owned isolated deployments were removed (dpl_27fLyPFYnJbLK9raurHPWBWCsx69 and dpl_3bvt168Jy7Vrw3egheGdVbDuLZRt). The second also failed due to unset framework. Explicit Next.js configuration and deployment from approved non-main branch produced verified preview target. No existing production project changed. No MyFarm secret uploaded to production environment. [Official framework configuration](https://vercel.com/docs/project-configuration/vercel-json), [upstream target issue](https://github.com/vercel/vercel/issues/17069).

Windows Playwright teardown stalled. Only this session's verified port3101 test server was stopped; runner then exited0 with14 passes. Playwright starts Next directly instead of nested npm. Unrelated phase02 worktree/server preserved.

Temporary Auth users/files/application fixtures removed after live and hosted tests; local isolated PostgreSQL container stopped. Existing accounts preserved. Public URL/key, trusted CA and bucket configured only for preview; DATABASE_URL is preview-only Vercel secret. Official actionlint tool remains in ignored cache, no application dependency.

Harnesses require ignored development/admin fixture configuration and explicitly created disposable fixtures. They are executed evidence, not unattended CI setup. Outputs exclude credentials, JWTs, emails and signed URLs. No farmer research generated.

## Task verdict

T001–T010 verified complete; T011–T013 dependency/exit-gate blocked by mandatory hosted CI. Progress10/13 ×100 =76.92%; **BLOCKED**, verdict **FAIL**. Preview/local success cannot substitute for CI. Resolve GitHub startup availability, rerun branch quality workflow, then finish final audit. Do not begin Phase2.

## Re-verification after handover (Claude Code, 2026-10-08 04:25 local)

The owner stopped Codex and handed Phase1 finalisation to Claude Code. During the handover a Claude debug run reused credentials after Codex had deleted its temporary fixtures, overwriting the uncommitted preview-tests.json with a spurious FAIL (`invalid_credentials`). Separately, running the harness from Git Bash without `MSYS_NO_PATHCONV=1` converts `/api/...` into a Windows path and makes `vercel curl` fail with "URL rejected"; this is a harness environment issue, not an application defect.

Re-run on the same deployment with fresh disposable fixtures: `provider-fixtures.mjs setup` → `provider-db-fixtures.mjs setup` → `MSYS_NO_PATHCONV=1 node --use-system-ca .cache/preview-check.mjs` (**12/12 PASS**, exit 0) → database and provider cleanup PASS (2 temporary users and 2 private files deleted). [Results](evidence/phase-01-2026-10-08-mcp/preview-tests.json). GitHub CI remains `startup_failure`; task verdict above is unchanged.

## Final closure — local verification (2026-10-08)

This report remains the historical record of earlier sessions. Phase 1 final closure, with all quality.yml steps reproduced locally and the owner-approved GitHub CI exception, is recorded in [Phase01 local verification and final closeout](phase-01-local-verification.md): PASS WITH CONDITIONS — LOCAL VERIFICATION, 13/13, verified code commit `bd9fadc`. GitHub-hosted CI remains unverified.
