/**
 * The words a farmer agrees to when joining the pilot (D-P09-006, D-P09-007, D-P09-009). A participation records
 * the version it was given under, so changing these words means a new version and a new cohort code.
 *
 * The owner approved the English words on 2026-11-10 (D-P09-015). Each translation must be checked by a real speaker
 * before farmers read it (AGENTS.md section 12); none is approved yet. Point 8 states the retention rule (D-P09-012).
 */
export const PILOT_CONSENT_VERSION = "pilot-consent-v1";

export const PILOT_CONSENT_POINTS: readonly string[] = Object.freeze([
  "You are helping the MyFarm team learn whether MyFarm is useful to farmers like you.",
  "Nothing about how you use MyFarm changes. Keep using it only if it helps you.",
  "The team will count how often you save records, for example how many expenses or harvests you enter each week.",
  "The team sees a code name for you, such as P-07, and those counts. They do not see your name, phone number, money amounts or records.",
  "A team member may call or visit you. They will note that they did, so it is clear when you used MyFarm on your own.",
  "You can leave the pilot at any time on this page. When you leave, the team stops counting anything about you, including what was counted before.",
  "Leaving the pilot does not change or delete your farm records.",
  "The team keeps the counts for up to a year after the pilot ends, then keeps only totals with no code names.",
]);
