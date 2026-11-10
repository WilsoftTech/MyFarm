# Phase 9 pilot-start: full farm export (D-P09-013)

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED - D-P09-012, D-P09-013, D-P09-014; accounting export, photo access, farm access.
- Implementation status: COMPLETE LOCALLY - export built and verified on a disposable database. No schema change.
- Last reviewed: 2026-11-10 (Africa/Nairobi).
- Related phase/task IDs: D-P09-013; P7-C4 (export part); MYF-P09 pilot-start checklist.
- Verified completed work: a farm member downloads everything on the farm, with their own profile, as one ZIP of CSV files; photos open one at a time from the same page; each export is audited and limited to 3 a day.
- Remaining work/blockers: none for the build. Not pushed or deployed. A qualified local review of the policy is still advised. Photos are opened one by one rather than packed into the ZIP (see below).
- Evidence/report links: [Request limits and decisions](phase-09-request-limits-2026-11-10.md); [Pilot-start pack](phase-09-pilot-start-pack-2026-11-10.md).
<!-- MYFARM-STATUS-END -->

**Who this is for:** the project owner, and the reviewer who checks the retention and export policy before the pilot.

## What the farmer sees

The farm page has a new "Your data" section with "Download farm data". That page:
- Explains what the file holds and that it can be downloaded 3 times a day.
- Warns that the file holds the farmer's phone number and money records.
- Offers "Download farm data (ZIP)".
- Lists the farm's photos 50 at a time, each with "Open photo".

The ZIP holds:
- `README.txt`: the farm, the time it was made, what each file is and its row count.
- `my-profile.csv`: the farmer's own profile.
- One CSV for each of 20 kinds of record: farm, plots, enterprises, seasons, crop cycles, poultry batches, money records, payments, payment links, reversals, stores, stock items, harvests, stock movements, poultry production, stock operations, stock adjustments, farm work, repeating farm work, and the photo list.

Every CSV:
- Has a header row and starts with a UTF-8 marker, so spreadsheet programs show local names correctly.
- Uses the money export's protection: text a spreadsheet would run as a formula (for example `=cmd`, or a phone number starting with `+`) gets a leading `'`.
- Writes amounts exactly as stored, dates as year-month-day and times in UTC.
- Keeps record IDs, so files can be matched to each other.
- Leaves out internal keys (tenant, request IDs, hashes, versions) and other people's user IDs.

## Photos are not inside the ZIP

The approved wording was "one CSV per record type plus their photos". Photos stay outside the ZIP, opened one by one through the existing audited photo link. Two reasons:
- Photos can reach hundreds of megabytes per farm, and a single server response on common hosting is limited to a few megabytes.
- Building the ZIP needs every photo read from private storage in one request.

The photo list (`photos.csv`) is in the ZIP, and the page lists every photo. A single archive with photos would need a background job and a temporary file. That can be built later if the owner wants it.

## How it works

`src/modules/farm-export`:
- The export is checked with the farm-access rule every farm screen uses: an active farmer member of the farm (every member is an owner).
- All 20 tables and the profile are read in one repeatable-read transaction, so the files agree with each other.
- The export is recorded in the audit trail as `FARM_EXPORTED`.
- The SQL is built only from a fixed list of tables and columns in code; the farm and tenant are bound parameters.
- The ZIP is written by a small built-in writer with Node's own compression, so there is no new package.
- The download is `GET /api/v1/farms/{farmId}/export`, limited to 3 a day per person by the proxy (D-P09-014).

## Verification

Disposable PostgreSQL 17 on Windows, with every migration applied. This run also covers the request limits with the pull limit at 600 (D-P09-016).

| Check | Result |
|---|---|
| Lint, typecheck, boundaries | PASS |
| `npm test` | PASS, 1217 unit/component tests in 67 files (7 new) |
| `npm run test:integration` | PASS, 361 tests in 36 files (3 new) |
| `prisma migrate diff` | No difference |
| Fixture build, full signed-in suite, desktop and mobile | PASS, 186 of 186 (4 new) |
| Ordinary build, anonymous suite | PASS, 66 of 66 |

The unit tests read the ZIP back with an independent reader that checks every CRC. They also check:
- The standard CRC-32 value.
- Stored and compressed entries.
- The UTC date stamp.
- Names that could escape a folder are refused.
- Access is checked before anything is read.
- The file list, headers and UTF-8 marker.
- Formula protection.
- Photo pages.

The integration tests run under the app's restricted role. They check:
- Every catalogued table and column, which proves each query is valid.
- Exactly this farm's rows; another farm's harvest, crop cycle and farm row are absent.
- The profile, with a comma and quotes in the name.
- The `FARM_EXPORTED` audit row.
- A non-member is refused, and nothing is recorded.

The integration run also found one real bug: two profile time columns had the same automatic name, so one value was dropped. Every profile column is now named.

In the browser, signed in as farmer A:
- An expense whose payee is `=cmd` shows up in `money-records.csv` as `'=cmd`.
- Farm B's ID is nowhere in the ZIP, and the audit row is written.
- The page has no sideways scroll on desktop and mobile.
- The fourth export in a day gets 429 with `Retry-After: 86400`.
- Farmer B gets 403, an anonymous request gets 401, and the anonymous page goes to sign-in.

## Limits of this work

- Very large farms: everything is built in memory in one request. CSV text compresses about tenfold, so a farm would need hundreds of thousands of records to reach a hosting response limit. That is far beyond the pilot.
- Account closure and deletion (D-P09-012) remain reviewed operations, with no screen. The export is what the farmer is offered first.
- A qualified local reviewer should still read the retention and export policy before the pilot (D-P09-012).
