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
  | "CONCLUSION_NOT_CITED";

/** What an answer may cite, and what it must say when it answers. */
export interface AnswerRules {
  /** Figure refs (F1...) and enterprise refs (E1...) the evidence holds. */
  figureRefs: readonly string[];
  enterpriseRefs: readonly string[];
  /**
   * When the evidence allows a conclusion, the refs the first FACT must cite (the leading figure and its enterprise).
   * When it does not, null: then only UNCERTAINTY may be said (missing evidence yields no conclusion, AC001).
   */
  conclusion: readonly string[] | null;
}

/** Every problem with an answer, each once, in a stable order; an empty list means it may be shown. */
export function answerProblems(answer: Answer, rules: AnswerRules): AnswerProblem[] {
  const problems = new Set<AnswerProblem>();
  const figures = new Set(rules.figureRefs), known = new Set([...rules.figureRefs, ...rules.enterpriseRefs, PERIOD_REF]);
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
  }
  if (rules.conclusion !== null) {
    const first = answer.statements.find(statement => statement.kind === "FACT");
    if (!first || rules.conclusion.some(ref => !first.refs.includes(ref))) problems.add("CONCLUSION_NOT_CITED");
  }
  const order: AnswerProblem[] = ["EMPTY", "TOO_LONG", "DIGIT_IN_TEXT", "LINK_IN_TEXT", "UNKNOWN_REF", "PLACEHOLDER_NOT_CITED", "BAD_BRACES", "CLAIM_WITHOUT_FIGURE", "CLAIM_WITHOUT_EVIDENCE", "CONCLUSION_NOT_CITED"];
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
