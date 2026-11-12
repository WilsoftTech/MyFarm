import type { ShownAnswer } from "@/modules/ai-assistant/domain/exchange";
import type { AssistantExchange } from "@/modules/ai-assistant/contracts/assistant";
import type { CommandSubmit } from "@/modules/engineering-foundation/contracts/command-result";
import { basisText, kindLabels, periodText, valueText } from "./labels";
import { DeleteQuestionForm } from "./delete-form";

const when = (iso: string) => iso.slice(0, 16).replace("T", " ") + " UTC";

/** One answer: each statement with its kind, then where its figures came from (R002 provenance, R003 labels). */
export function AnswerView({ answer }: { answer: ShownAnswer }) {
  const source = answer.provenance;
  return <div className="mt-4 rounded-xl bg-muted/40 p-4">
    {source?.currency && <p className="text-sm font-semibold">{source.currency}</p>}
    <ul className="space-y-3">
      {answer.statements.map((statement, index) => <li key={index} className="leading-7">
        <span className={"mr-2 inline-block rounded-full px-3 py-0.5 text-sm font-semibold " + (statement.kind === "FACT" ? "bg-foreground text-background" : statement.kind === "UNCERTAINTY" ? "border border-foreground" : "bg-muted")}>{kindLabels[statement.kind]}</span>
        <span>{statement.parts.map((part, at) => part.type === "TEXT" ? <span key={at}>{part.text}</span> : <strong key={at}>{valueText(answer.values[part.ref])}</strong>)}</span>
      </li>)}
    </ul>
    {source && <p className="mt-4 text-sm leading-6 text-foreground/80">
      Worked out by MyFarm from this farm&apos;s records{source.period ? ": " + periodText(source.period) : ", each alert over its own period"}{source.basis ? ", " + basisText[source.basis] : ""}. Calculated <time dateTime={source.asOf}>{when(source.asOf)}</time>; ask again for the latest figures.
    </p>}
    <p className="mt-1 text-sm text-foreground/80">{answer.source === "EXPLAINER" ? "Worded by the assistant and checked by MyFarm." : "Worded by MyFarm."}</p>
  </div>;
}

export function QuestionCard({ exchange, remove }: { exchange: AssistantExchange; remove: CommandSubmit }) {
  const headingId = "question-" + exchange.questionId;
  return <li id={headingId + "-item"}><article aria-labelledby={headingId} className="rounded-2xl border border-border bg-white p-5">
    <p className="text-sm text-foreground/80">You asked on <time dateTime={exchange.askedAt}>{when(exchange.askedAt)}</time></p>
    <h3 id={headingId} className="mt-1 break-words text-lg font-semibold">{exchange.question}</h3>
    {exchange.answers.map((answer, index) => <AnswerView key={index} answer={answer} />)}
    <p className="mt-4 text-sm text-foreground/80">Kept until <time dateTime={exchange.keptUntil}>{exchange.keptUntil.slice(0, 10)}</time>, then deleted.</p>
    <DeleteQuestionForm question={exchange.question} submit={remove} />
  </article></li>;
}
