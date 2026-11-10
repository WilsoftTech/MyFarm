# Phase 9 pilot-start pack: hosted schema evidence and proposals for the owner

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED - prepared from the Phase 4, 5, 7 and 9 closeouts, the decision log and the code.
- Implementation status: PARTIALLY COMPLETE - one checklist item done (hosted schema); three proposals await owner decisions.
- Last reviewed: 2026-11-10 (Africa/Nairobi).
- Related phase/task IDs: D-P09-005; D-P09-011; P7-C1; P7-C4; P7-C6; P4-C4; P5-C3; MYF-P09-R001.
- Verified completed work: Pilot migrations 202611090001 and 202611100001 and the full provisioning list applied to hosted development after a verified backup; existing data unchanged.
- Remaining work/blockers: Sections 2, 3 and 5 decided 2026-11-10 (D-P09-012 to D-P09-016); section 4 (real phone) and translations await the owner; Phase 1 C4, P8-C2 and recruitment stay with the owner. No real farmer joins yet.
- Evidence/report links: [Phase 9 closeout](phase-09-closeout-2026-11-10.md); [Decision log](../DECISION-LOG.md#d-p09-011---pilot-start-checklist-work); [Project status](../PROJECT-STATUS.md).
<!-- MYFARM-STATUS-END -->

**Who this is for:** the project owner. Each section ends with the choice needed. Nothing here lets a real farmer join; that still waits for every checklist row to be cleared (D-P09-005).

## Checklist position

| Item (D-P09-005) | State on 2026-11-10 |
|---|---|
| Hosted schema for the pilot (`202611090001`, `202611100001`, provisioning list) | **DONE** - section 1 |
| P7-C4 retention and export policy | **Policy approved** (D-P09-012); full farm export built locally ([evidence](phase-09-farm-export-2026-11-10.md)); qualified local review still advised |
| P7-C6, P4-C4, P5-C3 abuse and rate controls | **Approved and built** (D-P09-014, D-P09-016; [evidence](phase-09-request-limits-2026-11-10.md)); table on hosted development 2026-11-10; code not yet deployed |
| P7-C1 real low-cost Android phone, 14 days and 500 entries | Test plan ready - section 4; needs a phone and a hosted address |
| Consent words approved, in each language, checked by real speakers | **English approved** as `pilot-consent-v1` (D-P09-015); languages and checking speakers not yet named |
| Phase 1 C4 production sign-in, recovery email, TLS | Owner / operations; not started |
| P8-C2 accountant and agronomist sign-off | [Review pack](phase-08-formula-review-pack-2026-11-09.md) awaits reviewers |
| Recruit about 25 farmers and name pilot staff | Owner |

## 1. Hosted development schema - done

Applied 2026-11-10 under D-P09-011 with the same backup-then-apply method used for D-P06-010 and D-P08-015.

| Step | Result |
|---|---|
| Snapshot before | PostgreSQL 17.11; 33 public tables, 78 rows; 19 migrations, all finished, last `202611040001_metric_links` |
| Backup | `pg_dump -Fc`, 642,455 bytes, kept only on the engineering machine (contains real hosted data; not committed) |
| Restore check | Restored into a throwaway PostgreSQL 17 container: no restore errors, all 33 tables match the snapshot row for row |
| Apply | `prisma migrate deploy` applied `202611090001_field_pilot` and `202611100001_pilot_evidence`; all 14 provisioning SQL files PASS, in manifest order |
| Verify | Every existing table unchanged except `_prisma_migrations` (+2 rows); 9 pilot tables added, empty; 21 migrations, none unfinished |
| Runtime role | `myfarm_runtime` can log in, is not superuser and does not bypass row security; it may read and add to every pilot table, never delete or truncate. Reading as the app's own connection works; a delete is refused (`42501`) |
| Browser roles | 0 table grants to `anon` or `authenticated`; every public table has row security on; `anon` cannot run the pilot staff check |

Hosted pages were not signed in to: the one hosted account's password is not stored with engineering (same limit as Phase 8).

## 2. P7-C4: how long data is kept, and how a farmer gets it out

Today the only rule is the interim photo rule (D-P07-004: a photo lives as long as its record). Records, audit rows and pilot rows have no end date, and a farmer can export only the money summary CSV. Real farmers' personal data needs a stated rule before they join.

Uganda's Data Protection and Privacy Act, 2019 probably applies. MyFarm makes no compliance claim; a qualified local reviewer should read the approved policy before the pilot.

**Recommended policy:**

| Data | Kept for | Then |
|---|---|---|
| Farmer profile, farm details, GPS | While the account is open | Deleted within 30 days of a confirmed closure request |
| Farm records: money, harvests, stock, activities, poultry, photos | While the account is open | Deleted with the account; the farmer is offered an export first |
| Audit trail (sign-in and private-file reads) | 24 months | Deleted |
| Pilot usage counts, reminders, incidents | Until the pilot decision plus 12 months | Row-level rows deleted; only cohort totals with no code names kept |
| Pilot observations, findings, reviews | Until the pilot decision plus 12 months | Kept only as the closeout report, which holds no names |
| Withdrawn pilot farmer | Excluded from every measure at once (D-P09-009) | Their pilot rows deleted at the end-of-pilot clean-up, not before, so totals already reported can be explained |
| Entries waiting on the phone | Until sent; sent entries kept 7 days (P7-C5) | Removed from the phone |
| Engineering copies of hosted data (backups made before schema changes) | 30 days after the change is verified | Deleted; stored only on the engineering machine meanwhile |

**Export:** the farmer can download everything on their farm as files they can open in a spreadsheet: one CSV per record type plus their photos. This needs building (about one task). It is a data right rather than a new farming feature, so it fits the feature freeze (P0541); please confirm.

**Consent:** add one point to the consent words: "The team keeps the counts for up to a year after the pilot ends, then keeps only totals with no code names."

> **Choice needed:** approve the table as written, or change any period. Confirm that the full export is built before the pilot. Confirm the added consent point.

## 3. P7-C6, P4-C4, P5-C3: limits against abuse and runaway phones

Today only private-file reads are limited: 30 a minute per person, counted on the database clock, with retries of the same request free. Every other route is limited only by request size (for example, 20 entries per phone push). A buggy or stolen phone, or a script, could otherwise write or export without limit.

**Proposed method:** reuse the private-file approach for every listed action. Count each person's requests per action in one small table, on the database clock; a retry of the same request is free; when the limit is hit, the app answers HTTP 429 with the existing message "Too many attempts. Wait a minute, then try again. Your details are still here." Phones already treat 429 as "try later" (`src/modules/offline-first/client/sync-engine.ts`): every entry stays queued and the phone shows "Could not reach MyFarm. It will try again.", so no entry is lost. Count rows are deleted after a day. Sign-in limits belong to Supabase Auth and are part of Phase 1 C4.

| Action | Proposed limit per person | Why this size |
|---|---|---|
| Join a pilot with a code | 5 wrong codes in 15 minutes, 20 a day | A 6-character code has about 2 billion values, so guessing is hopeless at this rate; a farmer mistyping is not blocked for long. Staff should use 8-character codes |
| Phone push (sync) | 30 requests a minute | 600 entries a minute; a phone clearing a full 500-entry queue needs 25 requests |
| Phone pull (sync) | 60 pages a minute | A full refresh of 50 farms fits in a few minutes |
| Photo upload | 30 an hour, 200 a day | A busy farm day is under 30 photos; each is at most 2 MB |
| Photo view, private files | 30 a minute (existing) | Unchanged |
| Money summary export (P4-C4) | 10 an hour | Exports are heavy; nobody needs more than a few |
| Full farm export (section 2) | 3 a day | Same reason |
| Any other save from a form | 120 a minute | Far above a person typing; stops scripts |
| Pilot staff logs and reviews | 60 a minute | Same reason |

Building this is one engineering task with tests for each limit, the free retry, two people not sharing a count, and the phone's handling of 429. It adds one table (additive migration) and no new package.

> **Choice needed:** approve the method and the numbers, or change any of them. On approval, engineering builds it, commits, pushes and applies the table to hosted development the same way as section 1.

## 4. P7-C1: real-phone test plan

Phase 7 proved offline work in a desktop browser with a simulated full phone, simulated 14-day-old entries and 500 seeded entries. This plan measures the same things on a real, cheap phone.

**Needs from the owner:** one low-cost Android phone of the kind pilot farmers own (for example 2 GB memory, 32 GB storage, Android Go or Android 11 to 13, current Chrome); a hosted address of the app that reaches hosted development (the Vercel preview link is still unverified, see integration risks); and a test account on hosted development whose password the tester knows.

**Procedure:**

1. Day 0: open the app on Wi-Fi, sign in, open each section once, then turn on airplane mode. Record phone model, Android and Chrome versions, free storage.
2. Days 1 to 14, offline: enter about 36 entries a day across all eight offline actions, with at least 20 photos in total. Note the count each day.
3. Day 10: confirm the "not sent for 10 days" warning shows. At about 400 entries, confirm the warning shows.
4. Storage pressure: fill the phone until under 200 MB is free (large videos). Confirm the app warns and never shows "Saved" for an entry it could not keep.
5. Eviction: clear Chrome's storage for a different site, close Chrome, reopen the app offline; confirm all entries are still there.
6. Day 14: turn on Wi-Fi with the app open. Time how long sending takes.
7. Check on the server: exactly 500 entries, each once; every photo opens; the pilot "entries sent from phones" count rises by exactly the number sent.
8. Turn the network off halfway through a second, smaller send; confirm reconnecting finishes it with no duplicates.

**Evidence to keep:** daily screenshots, the timing, the server counts (engineering runs the check), and any message the farmer would not understand. Pass if steps 3 to 8 hold with no lost or doubled entry.

> **Choice needed:** provide the phone, the hosted address and the test account, and name who carries the phone for 14 days.

## 5. Consent words for approval

Draft version `pilot-consent-v1-draft`, as farmers see it today (`src/modules/field-pilot/domain/consent.ts`):

1. You are helping the MyFarm team learn whether MyFarm is useful to farmers like you.
2. Nothing about how you use MyFarm changes. Keep using it only if it helps you.
3. The team will count how often you save records, for example how many expenses or harvests you enter each week.
4. The team sees a code name for you, such as P-07, and those counts. They do not see your name, phone number, money amounts or records.
5. A team member may call or visit you. They will note that they did, so it is clear when you used MyFarm on your own.
6. You can leave the pilot at any time on this page. When you leave, the team stops counting anything about you, including what was counted before.
7. Leaving the pilot does not change or delete your farm records.
8. *(Proposed, section 2)* The team keeps the counts for up to a year after the pilot ends, then keeps only totals with no code names.

On approval, engineering renames the version to `pilot-consent-v1` and adds the approved translations. Each language needs a real speaker to check it before farmers read it.

> **Choice needed:** approve or edit the English words; name the languages; name the speaker who checks each translation.
