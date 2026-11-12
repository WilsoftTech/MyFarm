"use client";
import { useState, useTransition } from "react";
import type { CommandSubmit } from "@/modules/engineering-foundation/contracts/command-result";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ProductionFormFeedback } from "@/components/production/form-feedback";
import { useProductionSubmit } from "@/components/production/use-production-submit";

export interface SeasonChoice { seasonId: string; label: string; closed: boolean }
const MAX = 500;
const textarea = "w-full rounded-xl border border-border bg-white px-4 py-3 text-base";

/**
 * The question box (MYF-P11-R001). The season is chosen here, never read from the question. The question is sent as
 * typed, so the box asks for no names or phone numbers (D-P11-003, D-P11-006). A retry keeps its request ID.
 */
export function AskForm({ seasons, defaultSeason, submit }: { seasons: SeasonChoice[]; defaultSeason: string; submit: CommandSubmit }) {
  const [saving, startTransition] = useTransition();
  const [question, setQuestion] = useState("");
  const [seasonId, setSeasonId] = useState(defaultSeason);
  const [problem, setProblem] = useState("");
  const { initialRequestId, online, ready, message, save } = useProductionSubmit(submit);
  return <form aria-label="Ask about this farm" aria-busy={saving} className="space-y-4 rounded-2xl border border-border bg-white p-5"
    onSubmit={event => {
      event.preventDefault();
      const text = question.trim();
      if (!text || text.length > MAX) { setProblem("Write your question, up to " + MAX + " letters."); document.getElementById("assistantQuestion")?.focus(); return; }
      setProblem("");
      startTransition(() => save({ requestId: initialRequestId, question: text, view: { seasonId } }));
    }}>
    <div>
      <label htmlFor="assistantQuestion" className="field-label">Your question</label>
      <p id="assistantQuestionHint" className="mb-2 text-sm leading-6 text-foreground/80">For example: which enterprise made me the most money? Do not type names or phone numbers: the question is kept with the answer.</p>
      <textarea id="assistantQuestion" name="question" rows={3} maxLength={MAX} className={textarea} value={question} onChange={event => setQuestion(event.target.value)}
        aria-describedby={"assistantQuestionHint" + (problem ? " assistantQuestionError" : "")} aria-invalid={problem ? true : undefined} />
      {problem && <p id="assistantQuestionError" role="alert" className="field-error">{problem}</p>}
    </div>
    <div>
      <label htmlFor="assistantSeason" className="field-label">Which records</label>
      <Select id="assistantSeason" name="seasonId" value={seasonId} onChange={event => setSeasonId(event.target.value)}>
        {seasons.map(season => <option key={season.seasonId} value={season.seasonId}>Season {season.label}{season.closed ? " (closed)" : ""}</option>)}
        <option value="all">All records</option>
      </Select>
    </div>
    <ProductionFormFeedback online={online} saving={saving} message={message} />
    <Button type="submit" disabled={!ready || !online || saving} className="w-full sm:w-auto">{saving ? "Working it out…" : "Ask"}</Button>
  </form>;
}
