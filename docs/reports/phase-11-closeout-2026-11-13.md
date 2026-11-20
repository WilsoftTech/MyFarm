# Phase 11 closeout - AI Farm Assistant - 2026-11-13

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED - Phase 11 specification, source P0602-P0645, Q20 and D-P11-001 to D-P11-006, every T001-T009 report, the Phase 11 code and tests.
- Implementation status: COMPLETED - 100% (10/10 verified tasks); verdict PASS WITH CONDITIONS - LOCAL AND HOSTED CI VERIFICATION, owner accepted 2026-11-18 (D-P11-007).
- Last reviewed: 2026-11-18 (Africa/Nairobi).
- Related phase/task IDs: MYF-P11-T001 through MYF-P11-T010; MYF-P11-R001 to R003; MYF-P11-AC001 to AC003; D-P10-008; D-P11-001 to D-P11-007.
- Verified completed work: The farm assistant answers eight kinds of question from each farm's own records, with every figure filled in by MyFarm and every statement labeled and checked; AC001 to AC003 verified on desktop and mobile; the D-P11-005 gate met on real records; clean-checkout run on a fresh database.
- Remaining work/blockers: Conditions P11-C1 to P11-C7 below; the explainer is a test stand-in (D-P11-002); Phase 11 schema not on hosted; nothing deployed.
- Evidence/report links: [T001](phase-11-t001-2026-11-12.md); [T002](phase-11-t002-2026-11-12.md); [T003](phase-11-t003-2026-11-12.md); [T004](phase-11-t004-2026-11-13.md); [T005](phase-11-t005-2026-11-13.md); [T006](phase-11-t006-2026-11-13.md); [T007](phase-11-t007-2026-11-13.md); [T008](phase-11-t008-2026-11-13.md); [T009](phase-11-t009-2026-11-13.md); [Phase specification](../phases/phase-11-ai-assistant.md).
<!-- MYFARM-STATUS-END -->

**Owner acceptance:** requested closure and advancement on 2026-11-18; expressly accepted the existing behaviors listed in P11-C4. Conditions unrelated to that confirmation remain. See the [transition report](phase-11-12-transition-2026-11-18.md).

## Phase identity and scope

AI Farm Assistant. Built by the engineering agent under D-P11-001 and D-P11-006: one commit per verified task, each pushed to `origin/main`.

| Task | Commit |
|---|---|
| T001 | `1de8aea` |
| T002 | `069e898` |
| T003 | `e678fed` |
| T004 | `fe63a40` |
| T005 | `72b94ea` |
| T006 | `58ff11b` |
| T007 | `a5c053b` |
| T008 | `072e981` |
| T009 | `34d1ce6` |
| T010 | this report |

**Prerequisite.** The Phase 10 verdict was accepted by the owner (D-P10-008). It carries the waived Phase 9 gate (P10-C1).

**What exists now:**

- **The Ask page.** A farmer asks a question about one farm and chooses a season or all records. The question box warns against typing names or phone numbers. It offers an example of each kind of question, a guide to the labels, and the farmer's own questions with delete.
- **Eight question types (R001, R002).** Each is a bounded, read-only tool that reads only through the owning module's own authorized service:
  - which enterprise made the most money;
  - the latest money records;
  - the recorded surplus;
  - this season against the one before;
  - a summary;
  - a farm report (which makes no file);
  - unusual costs (the approved Phase 10 cost rules);
  - work due and missed.

  Crop or animal advice gets an extension-officer referral, and anything else a sentence saying what can be asked.
- **Every figure is MyFarm's.** An explainer writes words around placeholders; MyFarm fills in every figure, name and period from its own calculation. Before anyone sees an answer it is checked. It is refused if it has:
  - digits or spelled amounts;
  - unknown references or links;
  - claims without evidence, or the wrong conclusion;
  - certainty outside facts, or predictions stated as facts;
  - advice outside "Not certain";
  - figures MyFarm's own checks disagree on stated as fact;
  - six or more words copied from the question.

  A refused, failed or slow explanation is replaced by MyFarm's own plain answer.
- **Labels (R003).** Each statement is a fact from your records, what this suggests, a suggestion or not certain, and the page explains each. Each answer says where it came from and when it was calculated, and links to the full page.
- **Q20 as decided (D-P11-002 to D-P11-005):**
  - **Provider:** a test stand-in explains answers; no AI provider, key or paid API.
  - **Privacy:** only the question and calculated figures would leave MyFarm, with names sent as references.
  - **Retention:** questions are private to the asker, kept 90 days, and deletable sooner.
  - **Cost:** 20 questions a day per person, with usage logged per farm.
  - **Knowledge:** the farm's own records only.

## Changes and migrations

| Migration | Change |
|---|---|
| `202611120003_assistant_questions` | `AssistantQuestion`, one row per question, private to the asker. Both times are set by the database and the kept-until time is fixed at 90 days. The app's role may add, read and delete, never change; it may add only for an active farmer member, asked in the last minute. `AssistantUsage` holds cost per farm, add-only, with no question text. Row security on, browser access none, policy file `supabase/policies/ai-assistant-runtime.sql` in `provisioning.json` |
| `202611130001_assistant_question_types` | The seven question types added to the question-type list (additive enum values) |

Both are additive. Neither is applied to hosted development.

Other shared changes:
- `ASSISTANT_QUESTION` request limit: 20 in any 24 hours.
- `runServerCommand` takes an optional message for limits counted over a longer window.
- The full farm export gains `my-assistant-questions.csv` (the exporter's own, unexpired) and `assistant-usage.csv`.
- The farm navigation gains "Ask".
- The Phase 8 scope guard allows Phase 11 names but still forbids AI provider packages and secrets.

## Security review

| Area | Finding |
|---|---|
| Authorization | Every route, page and server action authorizes the farm from current membership before anything else; the question cannot carry a farm, tenant, actor or role. Each tool re-authorizes through its module's own service. Another farmer gets 403 or the forbidden page; a removed member gets nothing (tests T002, T003, T005) |
| Writes | POST needs same-origin JSON; DELETE needs same origin; both are counted by the per-minute save limit. Questions are also counted against 20 a day, with a retry of the same request free; concurrent retries make one question, one count and one usage row |
| Provider boundary | The explainer receives only the explain request: refs and kinds, figures, dates, the question. It gets no names, IDs, database, SQL or way to write. Its output is untrusted, schema-checked and rule-checked, and it runs under a 20-second timeout outside database transactions |
| Prompt injection | Six attack kinds (repeating the instruction, invented figure, other farm's figure, link, advice, certainty) are all refused on real records; the question is shown as text and markup never runs |
| Privacy and retention | No name, label, farm or record ID appears in any explain request (unit tests for every tool). Questions are private to the asker; past 90 days they are hidden at once and deleted when the asker next asks (no unattended job, D-P09-012). The module logs nothing, so question text never reaches logs |
| Exports | The assistant makes no file and creates no export receipt or export count. Its report points to the existing downloads, which keep their own limits and audit |
| Provider packages | None installed; a guard test forbids them and their secrets |
| Anonymous access | The new routes return 401 with `no-store`; cross-origin and missing-origin writes return 403; the Ask page redirects to sign-in (anonymous suite, added in T010) |

No blocking security or integrity defect is open.

## Tests and quality evidence

**Clean checkout** of `34d1ce6` on a fresh PostgreSQL 17 (`myfarm-p11-audit`), every quality-workflow step (`.cache/p11-verify.ps1`, log `.cache/p11-evidence/clean-run.log`):

| Check | Historical clean checkout result (2026-11-13) |
|---|---|
| npm run lint / npm run typecheck / npm run check:boundaries | PASS; exit 0 for lint/typecheck |
| npm test | PASS: 1,299 tests / 76 files |
| Fresh migrations / schema drift | PASS: 25 migrations; drift exit 0 |
| npm run test:integration | PASS: 400 tests / 38 files |
| Non-UTC integration selection | PASS: 242 tests / 18 files |
| Stock and activity recovery | PASS: both exit 0 |
| npm audit --omit=dev | Historical PASS: 0 vulnerabilities; superseded by the November 18 audit and patch |
| Ordinary and fixture builds | PASS: both exit 0 |
| Anonymous / signed-in desktop and mobile browser | PASS: 66 / 214 |

The preserved historical log is [here](evidence/phase-transition-2026-11-18/p11-historical-clean-run.log). Its shell wrapper did not retain an exit code for every individual command; the current fail-fast revalidation and full results are in the [transition report](phase-11-12-transition-2026-11-18.md).

**Hosted CI** passed for T001 to T008 (T001 after a re-run of one failure in a Phase 3 test, see T002). T009 also passed: [run 43317152834](https://github.com/WilsoftTech/MyFarm/actions/runs/43317152834), at `34d1ce602b0b615b7d6fe1e02227c3cec80ba633`, verified on 2026-11-18. This verifies the committed T009 code, not the current uncommitted audit, dependency patch or Phase 12 additions.

**The D-P11-005 gate on real records (T008):** every figure shown matches a fresh calculation (over 50 figures across both test farms and all eight question types), 0 cross-farm leaks, and 6 of 6 injection attempts refused. **Met**, for the test stand-in and for providers built to misbehave.

## Acceptance and exit gate

| Criterion | Evidence | Result |
|---|---|---|
| MYF-P11-AC001: highest-profit answer cites exact period, scope and result; missing evidence yields no conclusion | Golden source example (poultry UGX 1,420,000) in unit, integration and browser; two tenants, injection, fake scope, numeric mismatch | PASS |
| MYF-P11-AC002: seven intents have bounded read-only contracts and report provenance | Seven tools with version, bound and source; question corpus; real records; stale context; refused exports; provider outage; browser on desktop and mobile | PASS |
| MYF-P11-AC003: factual values match evidence; agronomic uncertainty explicitly labeled | Groundedness gate met on real records; contradictory sources; unsafe-certainty rules; advice only as "Not certain"; browser matches the farm screen's own surplus | PASS |
| Exit gate (P0645): AI answers farm-specific questions without inventing financial or operational data | Every figure is filled by MyFarm; explanations cannot contain figures; no cross-farm disclosure | PASS for the stand-in; a real provider must pass the same corpus and gate first (P11-C1) |

## Conditions, limitations and verdict

| Condition | Owner | By |
|---|---|---|
| **P11-C1** Answers are worded by a test stand-in (D-P11-002). Before any farmer sees an answer, the owner chooses a provider whose terms forbid training on or keeping what is sent (D-P11-003). It must pass the T005 question corpus and the D-P11-005 gate with the T008 evaluation | Owner | Before farmers use the assistant |
| **P11-C2** Migrations `202611120003` and `202611130001` and `ai-assistant-runtime.sql` are not on hosted development (with Phase 10's P10-C3) | Owner instruction | Before any hosted use |
| **P11-C3** Questions of a person who never asks again are hidden after 90 days but stay in the table until a reviewed clean-up or approved automation removes them (D-P09-012) | Owner | Before real farmers' questions are kept |
| **P11-C4 RESOLVED 2026-11-18** Owner explicitly accepted the existing behaviors. T002: two tables, private to the asker, deletion when the asker next asks, "a day" as any 24 hours. T004: seasons compared by start date; "unusual" means the alert rules; the report is not a file. T005: the fake's keywords. T008: the six-word echo rule | Owner | Resolved before Phase 12 contract verification |
| **P11-C5 RESOLVED 2026-11-18 - existing alert evaluation explicitly accepted** "Unusual costs" runs the Phase 10 alert evaluation, as opening the Alerts page does. It can raise or clear alerts and counts against the Alerts limit, but changes no farm record | Owner to accept or ask for a stored-alerts read | Before farmers use the assistant |
| **P11-C6** Asking and deleting a question are not written to the audit trail. Questions are the asker's own notes, not farm records | Owner | Before production hardening |
| **P11-C7** Inherited items: P10-C1 (Phase 9 gate waived), P10-C2 (agronomist review), P10-C3 (hosted schema), P10-C5. Also a Phase 10 check found in T002: `FarmInsight_evidence_check` accepts a missing version key (NULL passes); only the server writes there | Owner / engineering | As recorded |

**Limitations:**
- The assistant understands only what the fake's keywords catch until a provider is chosen.
- Answers need a connection; nothing is answered offline.
- The question corpus is English only.
- The record list shows the latest 8 money records, with no search.
- Comparing seasons uses the season that started just before the chosen one.

**Verdict: PASS WITH CONDITIONS - LOCAL AND HOSTED CI VERIFICATION.** All ten tasks, all three acceptance criteria and the security review are complete with evidence. No mandatory test fails and no blocking defect is open. **P11-C1 means no farmer should see assistant answers until a real provider passes the same gate.** The owner accepted advancement and the P11-C4 behaviors on 2026-11-18 (D-P11-007). Phase 12 is authorized with test adapters, text fallback and no retained audio (D-P12-001); no real-provider, language-accuracy, production or hosted approval is inferred.

## Status-update evidence

Progress from verified task IDs: T001-T010, 10 of 10. Updated:
- this report;
- the Phase 11 specification;
- `docs/PROJECT-STATUS.md`;
- `docs/DECISION-LOG.md` (D-P11-007 PROPOSED);
- `docs/REQUIREMENTS-TRACEABILITY.md` (Phase 10 and 11 rows).

## Revalidation and transition - 2026-11-18

The [transition report](phase-11-12-transition-2026-11-18.md) supersedes the unfinished audit placeholders and records current verification, the security patch and Phase 12 T001. Hosted migrations and farmer-release conditions above remain open.
