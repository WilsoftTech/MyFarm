# Phase 9 pilot-start: request limits (P7-C6, P4-C4, P5-C3) and approved consent words

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED - pilot-start pack section 3 and 5, proxy, server actions, sync client, pilot join.
- Implementation status: COMPLETE LOCALLY - limits built and verified on a disposable database; hosted step below.
- Last reviewed: 2026-11-10 (Africa/Nairobi).
- Related phase/task IDs: D-P09-012 to D-P09-016; P7-C6, P4-C4, P5-C3; MYF-P09 pilot-start checklist.
- Verified completed work: per-person limits on every write, phone push and pull, photo upload, money export, the coming full farm export, pilot staff work and refused pilot codes; consent version `pilot-consent-v1` with point 8.
- Remaining work/blockers: apply migration `202611100002_request_limits` and `request-limits-runtime.sql` to hosted development with a verified backup (authorized by D-P09-014); the full signed-in browser suite is re-run with the farm export task. Translations of the consent words, with checking speakers, are still needed.
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
