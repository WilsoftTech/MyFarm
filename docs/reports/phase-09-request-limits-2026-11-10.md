# Phase 9 pilot-start: request limits (P7-C6, P4-C4, P5-C3) and approved consent words

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED - pilot-start pack section 3 and 5, proxy, server actions, sync client, pilot join.
- Implementation status: COMPLETE - built and verified locally; schema applied to hosted development.
- Last reviewed: 2026-11-11 (Africa/Nairobi).
- Related phase/task IDs: D-P09-012 to D-P09-016; P7-C6, P4-C4, P5-C3; MYF-P09 pilot-start checklist.
- Verified completed work: per-person limits on every write, phone push and pull, photo upload, money export, the coming full farm export, pilot staff work and refused pilot codes; consent version `pilot-consent-v1` with point 8.
- Remaining work/blockers: none for the build; applied to hosted development 2026-11-10 (below). The full signed-in suite passed 186 of 186 locally with the farm export task, but failed 27 of 186 in GitHub-hosted CI because counts carried between tests; fixed in the test harness 2026-11-11 (below). The code is pushed, not deployed. Translations of the consent words, with checking speakers, are still needed.
- Evidence/report links: [Pilot-start pack](phase-09-pilot-start-pack-2026-11-10.md); [Decision log](../DECISION-LOG.md#d-p09-014---abuse-and-rate-controls-p7-c6-p4-c4-p5-c3).
<!-- MYFARM-STATUS-END -->

**Who this is for:** the project owner and the engineer who applies this to hosted development.

## Owner decisions recorded

On 2026-11-10 the owner chose the recommended option on all four pilot-start questions:

| Decision | What it says |
|---|---|
| D-P09-012 | The retention table in the pack, as written (P7-C4 policy). Deletions stay reviewed operations, never an unattended job. |
| D-P09-013 | Build the full farm export before the pilot. |
| D-P09-014 | The limit method and every number in the pack. |
| D-P09-015 | The English consent words 1 to 8, as version `pilot-consent-v1`. |
| D-P09-016 | Phone pull raised from 60 to 600 pages a minute, after the problem below was found. |

## What changed

**Consent.** The version is now `pilot-consent-v1`, and point 8 says the team keeps the counts for up to a year after the pilot, then only totals with no code names. No pilot rows exist on hosted development, so no farmer is affected. A cohort made under the draft cannot be joined; staff make a new one. Translations are still needed, each checked by a real speaker.

**Limits.** One new table, `RequestCount`, holds one row per counted request: who, which kind of request, its request ID when it has one, and the database time. One SQL function, `myfarm_take_request`, does the whole check in a single statement: it locks that person's counter for that kind of request, lets a retry with an already-counted request ID through free, refuses when any window is full, otherwise counts the request, and removes up to 100 counts older than a day.

| Where | How |
|---|---|
| `src/proxy.ts` | Runs before every page and API request. For a signed-in person (the subject of the verified session token) it works out which limit applies, takes the count, and answers an API request that is over its limit with HTTP 429, `{"error":"RATE_LIMITED"}` and `Retry-After`. Requests without a session are not counted; the route refuses them anyway. If the count cannot be taken, the request is refused with 503 rather than let through. |
| Form saves (server actions) | The proxy counts the save and, when over the limit, marks the request with a header only it can set. `runServerCommand` then returns the existing message, "Too many attempts. Wait a minute, then try again. Your details are still here.", and what the farmer typed stays on the form. |
| Pilot join | Counted inside the pilot service, only when a code is refused: 5 in 15 minutes and 20 a day. Over that, even the right code is turned away without looking it up. This covers the API and the form alike. |
| Phones | Unchanged: the sync engine already treats 429 as "try later", so every entry stays queued. |

| Kind of request | Limit | Request ID used for free retries |
|---|---|---|
| Any other save (API write or form) | 120 a minute | API: the body's `requestId`. Forms: none, every submission counts |
| Phone push | 30 a minute | A hash of the entries' IDs, so the same batch retried is free |
| Phone pull | 600 a minute (D-P09-016) | None |
| Photo upload | 30 an hour and 200 a day | The form's `requestId` |
| Money summary export | 10 an hour | None |
| Full farm export | 3 a day | None |
| Pilot staff work (API and pages) | 60 a minute | API: the body's `requestId` |
| Refused pilot code | 5 in 15 minutes, 20 a day | The join's `requestId` |
| Private-file reads | 30 a minute, unchanged | Existing audit-trail count |

Sign-in and sign-out are not counted here; they belong to Supabase Auth and Phase 1 C4.

**Database rights.** The app's role may read and add counts, and delete only counts more than a day old; it cannot change a count, backdate one, or empty the table. Browsers have no access to the table or the functions. The table has row security on.

## Found while building: the approved pull limit was too tight

The first signed-in browser run passed 160 of 182 tests. All 22 failures were offline and sync tests, and the server log showed the pull limit refusing them. The cause is in the app, not the tests: every signed-in page open refreshes the phone's saved copies, and a refresh costs at least 12 pull pages per farm (one per section). A farmer opening about 5 pages a minute would reach 60, their refresh would stop, and the phone could say "Could not reach MyFarm" while online. The owner raised the limit to 600 a minute (D-P09-016). After the change the same four spec files passed 60 of 60. The busiest test user peaked at 294 pulls, 93 saves, 6 pushes and 2 photo uploads in one minute.

## Verification

Disposable PostgreSQL 17 on Windows; all migrations applied, including `202611100002_request_limits`.

| Check | Result |
|---|---|
| Lint, typecheck, boundaries | PASS |
| `npm test` | PASS, 1210 unit/component tests (20 new: limits, proxy, form refusal, join limit, consent) |
| `npm run test:integration` | PASS, 358 tests in 35 files (11 new in `request-limits.test.ts`) |
| `prisma migrate diff` against the migrated database | No difference |
| Fixture build, full signed-in suite, pull limit at 60 | 160 passed, 22 failed (the finding above) |
| Fixture build, pull limit at 600: offline-sync, offline-replay, offline-actions and analytics-dashboard specs | PASS, 60 of 60 |

The integration tests run under the app's restricted role. They check:
- Exactly the limit is allowed, and a refusal is not counted.
- A retry with a counted key is free at the limit, but a new key is not.
- People and kinds of request do not share counts.
- Both photo windows apply.
- Counts leave the window on the database clock, and only counts older than a day are deleted.
- 8 concurrent exports from one person give exactly 3 successes.
- The app's role cannot change, backdate or empty counts, and browsers have no access.
- A malformed limit raises an error instead of allowing everything.
- The migration rolls back atomically and adds one table with row security.

The proxy unit tests check:
- A 429 with `Retry-After` for API requests.
- A flagged pass-through for forms, and a browser cannot forge the flag.
- No counting and no database use without a session.
- A 503 rather than a skipped limit when counting fails.
- No body is read past the route's size limit.
- The push and photo keys.

## Limits of this work

- Form saves have no request ID the proxy can read, so a farmer's retry of the same form counts again. At 120 a minute this does not affect a person.
- A retry with an already-counted request ID is free, as approved. Such a retry writes nothing new, because every save is already idempotent by request ID, but it still reaches the database. These limits stop runaway phones and scripts from one account; they are not protection against a flood from many accounts or none. That is platform protection (Phase 1 C4, production hosting).
- The counts use the session token's subject before the route re-checks the session. A signed-out but unexpired token still counts against its own person, which harms nobody else.

## Hosted CI finding - 2026-11-11

GitHub-hosted CI failed on the two pushes that carried the limits (runs 42895564298 at 6304543 and 42898136444 at 90e8640). Every other step passed (1217 unit/component, 361 integration, 200 non-UTC, 66 anonymous browser tests); the signed-in browser suite failed 27 of 186, each with an unexpected 429.

**Cause: the tests, not the app.** The signed-in suite reuses three test users across all 21 spec files and both desktop and mobile. Their counts carried from one test into the next, and the hosted runner is fast enough to fit more than 120 saves from one user into a minute, which the local machine was not. No single test comes near a limit.

**Fix.** `tests/support/browser-test.ts` gives every browser test a fresh allowance: a Playwright fixture that runs before each test and empties `RequestCount` in the disposable test database. All 21 specs import `test` from it instead of `@playwright/test`. No application code or limit changed. The limits stay checked where they are meant to be: `tests/integration/request-limits.test.ts`, `tests/unit/request-limits.test.ts`, and the farm-export browser test, which still gets a 429 on its fourth export of the day.

| Check (fresh PostgreSQL 17 container, Windows, fixture build) | Result |
|---|---|
| Lint and typecheck | PASS |
| Full signed-in suite, desktop and mobile | PASS, 186 of 186 (14.1 min) |
| `RATE_LIMITED` in the server log | 2, both from the intended export-limit test (desktop and mobile) |
| GitHub-hosted CI after push | PASS, run 43091452503 at 652bdc6 (every step) |

What is no longer covered: the browser suite will not show limits building up across a long session, as the pull limit did before D-P09-016. That case is a matter of numbers and is covered by the busiest-user figures above; recheck it if a limit is lowered.

## Hosted development - 2026-11-10

Applied under D-P09-014 with the D-P09-011 backup-then-apply method (`.cache/p09b-hosted.mjs`, engineering machine only).

| Step | Result |
|---|---|
| Snapshot before | PostgreSQL 17.11; 42 public tables, 80 rows; 21 migrations, all finished, last `202611100001_pilot_evidence` |
| Backup | `pg_dump -Fc`, 704,311 bytes, kept only on the engineering machine for 30 days (D-P09-012) |
| Restore check | Restored into a throwaway PostgreSQL 17 container with the `public` and `myfarm_private` schemas: no errors, all 42 tables match row for row. A first attempt restored `public` alone and reported 7 errors for policies that call `myfarm_private` functions; the data still matched |
| Apply | `prisma migrate deploy` applied `202611100002_request_limits`; all 15 provisioning SQL files PASS, in manifest order |
| Verify | Every existing table unchanged except `_prisma_migrations` (+1 row); `RequestCount` added, empty; 22 migrations, none unfinished; 0 browser grants; every public table has row security |
| App's role | `myfarm_runtime` may read, add and delete (old rows only, by policy), never update or truncate. As the app's own connection, a check-only call returns true and counts nothing, and an update is refused (`42501`) |

No hosted page was signed in to, and no application code was deployed: hosted development has the table, and the limits take effect when this code is deployed.
