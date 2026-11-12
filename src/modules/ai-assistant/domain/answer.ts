/**
 * MYF-P11-R001 / R003: the shape of an answer and the rules it must pass before anyone sees it.
 *
 * The explainer (an AI later, a fake now: D-P11-002) never writes a number, a name or a date. It writes plain words
 * with placeholders - {F1} for a figure, {E1} for an enterprise, {P} for the period - and MyFarm fills them in from
 * its own calculation. So a figure in an answer cannot differ from the calculation (P0645, AGENTS.md: figures are
 * computed by tested code, never by an LLM). Everything the explainer returns is untrusted and checked here.
 */
export const STATEMENT_KINDS = ["FACT", "INFERENCE", "RECOMMENDATION", "UNCERTAINTY"] as const;
export type StatementKind = typeof STATEMENT_KINDS[number];

export interface Statement { kind: StatementKind; text: string; refs: string[] }
export interface Answer { statements: Statement[] }

export const MAX_STATEMENTS = 12, MAX_STATEMENT_LENGTH = 400, MAX_REFS = 12;
/** The period placeholder, always available. */
export const PERIOD_REF = "P";
const PLACEHOLDER = /\{([A-Z][0-9]{0,3})\}/g;

export type AnswerProblem =
  | "EMPTY"
  | "TOO_LONG"
  | "DIGIT_IN_TEXT"
  | "LINK_IN_TEXT"
  | "UNKNOWN_REF"
  | "PLACEHOLDER_NOT_CITED"
  | "BAD_BRACES"
  | "CLAIM_WITHOUT_FIGURE"
  | "CLAIM_WITHOUT_EVIDENCE"
  | "CONCLUSION_NOT_CITED"
  | "UNSAFE_CERTAINTY"
  | "FUTURE_AS_FACT"
  | "AGRONOMY_NOT_UNCERTAIN"
  | "CONFLICT_STATED_AS_FACT"
  | "CONFLICT_NOT_DISCLOSED";

/**
 * MYF-P11-R003. A FACT is what the records say; an INFERENCE or RECOMMENDATION is never certain; crop and animal advice
 * is only ever UNCERTAINTY with a referral (D-P11-005, P0643). These word lists are deliberately broad: a refused
 * explanation costs nothing, because MyFarm's own plain answer is shown instead.
 */
export const CERTAINTY_WORDS = /\b(definitely|certainly|surely|guarantee[sd]?|always|never fails?|for sure|without (?:a |any )?doubt|no doubt|undoubtedly|proven|clearly will|absolutely)\b/i;
export const FUTURE_WORDS = /\b(will|going to|next (?:season|year|month|week)|expect(?:ed|s)?|forecast\w*|predict\w*|likely to)\b/i;
export const AGRONOMY_WORDS = /\b(spray\w*|fertili[sz]\w*|pesticides?|herbicides?|fungicides?|insecticides?|vaccin\w*|deworm\w*|antibiotics?|medicines?|medication|drugs?|doses?|dosage|treat(?:s|ed|ing|ment)?|chemicals?|seed rate|manure|lime|irrigat\w*|plant (?:more|now|earlier|later|less))\b/i;

/** What an answer may cite, and what it must say when it answers. */
export interface AnswerRules {
  /** Figure refs (F1...) and label refs (E1, C1, A1...) the evidence holds. */
  figureRefs: readonly string[];
  labelRefs: readonly string[];
  /**
   * When the evidence allows a conclusion, the refs the first FACT must cite (the leading figure and its enterprise).
   * When it does not, null: then only UNCERTAINTY may be said (missing evidence yields no conclusion, AC001).
   */
  conclusion: readonly string[] | null;
  /** Figures two of MyFarm's own calculations disagree on (R003); empty when they agree. */
  conflicts?: readonly string[];
}

/** Every problem with an answer, each once, in a stable order; an empty list means it may be shown. */
export function answerProblems(answer: Answer, rules: AnswerRules): AnswerProblem[] {
  const problems = new Set<AnswerProblem>();
  const figures = new Set(rules.figureRefs), known = new Set([...rules.figureRefs, ...rules.labelRefs, PERIOD_REF]), conflicts = new Set(rules.conflicts ?? []);
  if (answer.statements.length === 0) problems.add("EMPTY");
  if (answer.statements.length > MAX_STATEMENTS) problems.add("TOO_LONG");
  for (const statement of answer.statements) {
    if (!statement.text.trim()) problems.add("EMPTY");
    if (statement.text.length > MAX_STATEMENT_LENGTH || statement.refs.length > MAX_REFS) problems.add("TOO_LONG");
    const cited = new Set(statement.refs);
    if (statement.refs.some(ref => !known.has(ref))) problems.add("UNKNOWN_REF");
    const used = [...statement.text.matchAll(PLACEHOLDER)].map(match => match[1]);
    if (used.some(ref => !known.has(ref))) problems.add("UNKNOWN_REF");
    if (used.some(ref => ref !== PERIOD_REF && !cited.has(ref))) problems.add("PLACEHOLDER_NOT_CITED");
    const words = statement.text.replace(PLACEHOLDER, "");
    if (/[{}]/.test(words)) problems.add("BAD_BRACES");
    // Any digit in any script: figures, dates and counts only ever come from placeholders.
    // Spelled amounts too ("one million", "twenty percent"); small words like "one" stay usable in plain sentences.
    if (/\p{Nd}|\p{No}|%/u.test(words) || /\b(hundreds?|thousands?|millions?|billions?|trillions?|percent|per\s+cent|lakhs?|crores?)\b/i.test(words)) problems.add("DIGIT_IN_TEXT");
    if (/https?:|www\.|\b[a-z0-9-]+\.(com|org|net|ug|io)\b/i.test(words)) problems.add("LINK_IN_TEXT");
    const citesFigure = statement.refs.some(ref => figures.has(ref));
    if ((statement.kind === "FACT" || statement.kind === "INFERENCE") && !citesFigure) problems.add("CLAIM_WITHOUT_FIGURE");
    if (rules.conclusion === null && statement.kind !== "UNCERTAINTY") problems.add("CLAIM_WITHOUT_EVIDENCE");
    if (statement.kind !== "FACT" && CERTAINTY_WORDS.test(words)) problems.add("UNSAFE_CERTAINTY");
    if (statement.kind === "FACT" && (FUTURE_WORDS.test(words) || CERTAINTY_WORDS.test(words))) problems.add("FUTURE_AS_FACT");
    if (statement.kind !== "UNCERTAINTY" && AGRONOMY_WORDS.test(words)) problems.add("AGRONOMY_NOT_UNCERTAIN");
    if (statement.kind !== "UNCERTAINTY" && statement.refs.some(ref => conflicts.has(ref))) problems.add("CONFLICT_STATED_AS_FACT");
  }
  // Contradictory sources (R003): when MyFarm's own checks disagree, the answer must say so, citing what disagrees.
  if (conflicts.size && !answer.statements.some(statement => statement.kind === "UNCERTAINTY" && statement.refs.some(ref => conflicts.has(ref)))) problems.add("CONFLICT_NOT_DISCLOSED");
  if (rules.conclusion !== null) {
    const first = answer.statements.find(statement => statement.kind === "FACT");
    if (!first || rules.conclusion.some(ref => !first.refs.includes(ref))) problems.add("CONCLUSION_NOT_CITED");
  }
  const order: AnswerProblem[] = ["EMPTY", "TOO_LONG", "DIGIT_IN_TEXT", "LINK_IN_TEXT", "UNKNOWN_REF", "PLACEHOLDER_NOT_CITED", "BAD_BRACES", "CLAIM_WITHOUT_FIGURE", "CLAIM_WITHOUT_EVIDENCE", "CONCLUSION_NOT_CITED", "UNSAFE_CERTAINTY", "FUTURE_AS_FACT", "AGRONOMY_NOT_UNCERTAIN", "CONFLICT_STATED_AS_FACT", "CONFLICT_NOT_DISCLOSED"];
  return order.filter(problem => problems.has(problem));
}

/** A statement split into words and the values that fill its placeholders; the screen formats each value. */
export type AnswerPart = { type: "TEXT"; text: string } | { type: "REF"; ref: string };
export interface ShownStatement { kind: StatementKind; parts: AnswerPart[]; refs: string[] }

/** Splits a checked answer for display. Only call it on an answer with no problems. */
export function answerParts(answer: Answer): ShownStatement[] {
  return answer.statements.map(statement => {
    const parts: AnswerPart[] = [];
    let at = 0;
    for (const match of statement.text.matchAll(PLACEHOLDER)) {
      if (match.index > at) parts.push({ type: "TEXT", text: statement.text.slice(at, match.index) });
      parts.push({ type: "REF", ref: match[1] });
      at = match.index + match[0].length;
    }
    if (at < statement.text.length) parts.push({ type: "TEXT", text: statement.text.slice(at) });
    return { kind: statement.kind, parts, refs: statement.refs };
  });
}
