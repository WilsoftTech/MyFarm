import { describe, expect, it } from "vitest";
import { pilotMeasures, weekOf, type Participant, type PilotFacts, type ReceiptFact } from "@/modules/field-pilot/domain/measures";

const id = () => crypto.randomUUID();
const window = { startOn: "2027-03-01", endOn: "2027-06-20" }; // 16 weeks, Monday 1 March to Sunday 20 June
const tenant = id();
/** Day `n` of week `w` (1-based), as a farm day. */
const on = (w: number, n = 0) => new Date(Date.UTC(2027, 2, 1 + (w - 1) * 7 + n)).toISOString().slice(0, 10);
const farmer = (pseudonym: string, overrides: Partial<Participant> = {}): Participant => ({ participationId: id(), userId: id(), pseudonym, status: "ENROLLED", enrolledOn: window.startOn, ...overrides });
const saved = (who: Participant, day: string, action = "ACCOUNTING_EXPENSE_RECORDED", requestId = id()): ReceiptFact => ({ tenantId: tenant, requestId, actorId: who.userId, action, day });
const facts = (overrides: Partial<PilotFacts>): PilotFacts => ({ window, today: "2027-07-01", participants: [], receipts: [], usage: [], prompts: [], incidents: [], ...overrides });
/** One record in each listed week. */
const weekly = (who: Participant, weeks: number[]) => weeks.map(week => saved(who, on(week, 2)));

describe("weeks (D-P09-002)", () => {
  it("week 1 is the cohort's first seven farm days; a day before the start has no week", () => {
    expect([weekOf(window, "2027-03-01"), weekOf(window, "2027-03-07"), weekOf(window, "2027-03-08"), weekOf(window, "2027-06-20")]).toEqual([1, 1, 2, 16]);
    expect(weekOf(window, "2027-02-28")).toBeNull();
    expect(() => weekOf(window, "1 March")).toThrow();
  });
  it("a cohort that has not started has no weeks yet, and no shares", () => {
    const a = farmer("P-01");
    const result = pilotMeasures(facts({ today: "2027-02-20", participants: [a] }));
    expect(result).toMatchObject({ currentWeek: 0, onboarded: 1, weeks: [], gates: { atWeek8: null, atEnd: null } });
  });
});

describe("MYF-P09-AC001 counting once, and only for consenting farmers", () => {
  it("a retried entry counts once: the same receipt or log row twice is one", () => {
    const a = farmer("P-01"), retry = saved(a, on(1), "HARVEST_RECORDED");
    const offline = { tenantId: tenant, requestId: id(), actorId: a.userId, kind: "OFFLINE_COMMITTED" as const, day: on(1) };
    const result = pilotMeasures(facts({ participants: [a], receipts: [retry, { ...retry }], usage: [offline, { ...offline }] }));
    expect(result).toMatchObject({ harvestsRecorded: 1, offlineTransactions: 1 });
    expect(result.weeks[0].records).toBe(1);
  });
  it("a withdrawn farmer is left out of every measure, past and future (D-P09-009)", () => {
    const a = farmer("P-01"), gone = farmer("P-02", { status: "WITHDRAWN" });
    const result = pilotMeasures(facts({
      participants: [a, gone],
      receipts: [...weekly(gone, [1, 2, 3, 4]), saved(gone, on(5), "CROP_CYCLE_CLOSED"), saved(a, on(1))],
      usage: [{ tenantId: tenant, requestId: id(), actorId: gone.userId, kind: "SYNC_REFUSED", day: on(1) }],
      prompts: [{ participationId: gone.participationId, day: on(2) }],
      incidents: [{ participationId: gone.participationId, openedOn: on(1), severity: "HIGH", status: "OPEN" }],
    }));
    expect(result).toMatchObject({ onboarded: 1, expensesRecorded: 1, syncFailures: 0, farmersCompletingCycle: 0, support: { total: 0 } });
    expect(result.participants.map(row => row.pseudonym)).toEqual(["P-01"]);
  });
  it("records before joining, outside the window, after today, or by someone not in the pilot do not count", () => {
    const late = farmer("P-01", { enrolledOn: on(3) }), stranger = { ...farmer("X"), userId: id() };
    const result = pilotMeasures(facts({ today: on(10), participants: [late], receipts: [saved(late, on(2)), saved(late, on(3)), saved(late, "2027-06-21"), saved(late, on(11)), saved(stranger, on(4))] }));
    expect(result.expensesRecorded).toBe(1);
    expect(result.participants[0]).toMatchObject({ joinedWeek: 3 });
    expect(result.participants[0].weeks[0]).toMatchObject({ week: 3, records: 1 });
  });
  it("setup, reversals and photos are not records; each named measure counts its own receipts", () => {
    const a = farmer("P-01");
    const result = pilotMeasures(facts({ participants: [a], receipts: [
      ...["FARM_CREATED", "SEASON_CREATED", "ACCOUNTING_RECORD_REVERSED", "RECORD_PHOTO_ADDED"].map(action => saved(a, on(1), action)),
      saved(a, on(2), "ACCOUNTING_PURCHASE_RECORDED"), saved(a, on(2), "ACTIVITY_COMPLETED"), saved(a, on(2), "ACTIVITY_RECORDED_DONE"), saved(a, on(2), "ACTIVITY_SCHEDULED"),
    ] }));
    expect(result.weeks[0]).toMatchObject({ records: 0, activeFarmers: 0 });
    expect(result.weeks[1]).toMatchObject({ records: 4, activeFarmers: 1 });
    expect(result).toMatchObject({ expensesRecorded: 1, tasksCompleted: 2, harvestsRecorded: 0 });
  });
});

describe("active and retained (D-P09-003, D-P09-004)", () => {
  it("retained needs voluntary activity in 3 of the last 4 weeks, and is not measured before 4 weeks", () => {
    const a = farmer("P-01");
    const [series] = pilotMeasures(facts({ participants: [a], receipts: weekly(a, [1, 2, 4, 7]) })).participants;
    expect(series.weeks.slice(0, 7).map(row => row.retained)).toEqual([null, null, null, true, false, false, false]);
  });
  it("a week in which staff prompted the farmer is active but not voluntary", () => {
    const a = farmer("P-01");
    const [series] = pilotMeasures(facts({ participants: [a], receipts: weekly(a, [1, 2, 3, 4]), prompts: [{ participationId: a.participationId, day: on(3, 1) }] })).participants;
    expect(series.weeks[2]).toMatchObject({ active: true, prompted: true, voluntary: false });
    expect(series.weeks[3].retained).toBe(true);
    const [twice] = pilotMeasures(facts({ participants: [a], receipts: weekly(a, [1, 2, 3, 4]), prompts: [{ participationId: a.participationId, day: on(3) }, { participationId: a.participationId, day: on(4) }] })).participants;
    expect(twice.weeks[3].retained).toBe(false);
  });
  it("records per farmer divide by farmers joined by that week", () => {
    const a = farmer("P-01"), b = farmer("P-02", { enrolledOn: on(2) });
    const { weeks } = pilotMeasures(facts({ participants: [a, b], receipts: [saved(a, on(1)), saved(a, on(2)), saved(a, on(2, 1)), saved(b, on(2))] }));
    expect(weeks[0]).toMatchObject({ joined: 1, records: 1, recordsPerFarmer: { status: "AVAILABLE", value: "1" } });
    expect(weeks[1]).toMatchObject({ joined: 2, records: 3, recordsPerFarmer: { status: "AVAILABLE", value: "1.5" } });
  });
});

describe("the recurring-use gate (D-P09-004)", () => {
  const four = ["P-01", "P-02", "P-03", "P-04"].map(name => farmer(name));
  const steady = (who: Participant) => weekly(who, [5, 6, 7, 8]);
  it("is met at exactly half retained voluntarily at week 8, and not below", () => {
    const met = pilotMeasures(facts({ participants: four, receipts: [...steady(four[0]), ...steady(four[1])] }));
    expect(met.gates.atWeek8).toEqual({ week: 8, retainedVoluntarily: 2, onboarded: 4, met: true });
    expect(met.weeks[7].retainedShare).toEqual({ status: "AVAILABLE", value: "50" });
    const short = pilotMeasures(facts({ participants: four, receipts: steady(four[0]) }));
    expect(short.gates.atWeek8).toMatchObject({ retainedVoluntarily: 1, met: false });
  });
  it("is not judged before week 8 has ended, and is judged again at the end of the window", () => {
    expect(pilotMeasures(facts({ today: on(8, 3), participants: four, receipts: steady(four[0]) })).gates).toEqual({ atWeek8: null, atEnd: null });
    const end = pilotMeasures(facts({ participants: four, receipts: four.flatMap(who => weekly(who, [13, 14, 15, 16])) }));
    expect(end.gates.atEnd).toEqual({ week: 16, retainedVoluntarily: 4, onboarded: 4, met: true });
    expect(end.gates.atWeek8).toMatchObject({ met: false });
  });
  it("with nobody onboarded the gate is not met and shares say why", () => {
    const empty = pilotMeasures(facts({}));
    expect(empty.gates.atWeek8).toMatchObject({ onboarded: 0, met: false });
    expect(empty.weeks[0].retainedShare).toEqual({ status: "UNAVAILABLE", reason: "NO_FARMERS" });
    expect(empty.syncFailureShare).toEqual({ status: "UNAVAILABLE", reason: "NO_PHONE_ENTRIES" });
  });
});

describe("the other measures", () => {
  it("sync failures as a share of entries from phones, support by severity, and farmers completing a cycle", () => {
    const a = farmer("P-01"), b = farmer("P-02");
    const log = (kind: "OFFLINE_COMMITTED" | "SYNC_REFUSED") => ({ tenantId: tenant, requestId: id(), actorId: a.userId, kind, day: on(2) });
    const result = pilotMeasures(facts({
      participants: [a, b],
      usage: [log("OFFLINE_COMMITTED"), log("OFFLINE_COMMITTED"), log("OFFLINE_COMMITTED"), log("SYNC_REFUSED")],
      receipts: [saved(a, on(12), "CROP_CYCLE_CLOSED"), saved(a, on(14), "POULTRY_BATCH_CLOSED")],
      incidents: [{ participationId: a.participationId, openedOn: on(1), severity: "HIGH", status: "OPEN" }, { participationId: null, openedOn: on(3), severity: "LOW", status: "RESOLVED" }, { participationId: null, openedOn: "2027-02-01", severity: "LOW", status: "OPEN" }],
    }));
    expect(result).toMatchObject({ offlineTransactions: 3, syncFailures: 1, syncFailureShare: { status: "AVAILABLE", value: "25" }, farmersCompletingCycle: 1, completingCycleShare: { status: "AVAILABLE", value: "50" } });
    expect(result.support).toEqual({ total: 2, open: 1, bySeverity: { LOW: 1, MEDIUM: 0, HIGH: 1 } });
  });
  it("labels the current week so far, and refuses a window that ends before it starts", () => {
    const result = pilotMeasures(facts({ today: on(3, 2), participants: [farmer("P-01")] }));
    expect(result.weeks.map(row => [row.week, row.soFar])).toEqual([[1, false], [2, false], [3, true]]);
    expect(() => pilotMeasures(facts({ window: { startOn: "2027-03-01", endOn: "2027-02-01" } }))).toThrow();
  });
});
