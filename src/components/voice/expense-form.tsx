"use client";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { z } from "zod";
import { TransactionForm, type CatalogOption, type LinkChoices } from "@/components/accounting/transaction-form";
import { useProductionSubmit } from "@/components/production/use-production-submit";
import { recordExpenseSchema } from "@/modules/farm-accounting/contracts/accounting";
import { voiceDraftViewSchema, voiceExpenseReceiptSchema, voiceDraftOutcomeSchema, type VoiceDraftView, type VoiceExpenseReceipt, type VoiceDraftOutcome } from "@/modules/voice-experience/contracts/drafts";
import { Button } from "@/components/ui/button";
import { DraftReview } from "./draft-review";
import { VoiceInputOptions } from "./input-options";
import { VOICE_LANGUAGES, type VoiceCapabilities } from "@/modules/voice-experience/contracts/input";
import type { FeedExpenseIntent } from "@/modules/voice-experience/contracts/voice";

const noop = async () => undefined;
const failure = (status: number) => status === 401 ? "Your sign-in has expired. Sign in again before saving." : status === 403 ? "Your access to this farm has changed. Nothing else can be saved here." : status === 429 ? "Too many requests. Wait a minute and try again." : status === 409 ? "This review changed or expired. Review the details again." : "Check the details and try again. They are still here.";

export function VoiceExpenseForm({ farmId, farmName, categories, paymentMethods, links, outcome, capabilities = { schemaVersion: 1, retainsAudio: false, languages: VOICE_LANGUAGES.map(language => ({ language, speechAvailable: false, textAvailable: true })) } }: { farmId: string; farmName: string; categories: CatalogOption[]; paymentMethods: CatalogOption[]; links?: LinkChoices; capabilities?: VoiceCapabilities; outcome?: VoiceDraftOutcome }) {
  const { online } = useProductionSubmit(noop);
  const resumed = outcome?.status === "PENDING" ? outcome.draft : null;
  const [draft, setDraft] = useState<VoiceDraftView | null>(resumed), [reviewing, setReviewing] = useState(!!resumed);
  const [seed, setSeed] = useState<Partial<z.input<typeof recordExpenseSchema>>>(resumed?.review.command ?? {}), [bags, setBags] = useState<number | null>(resumed?.review.bags ?? null);
  const entryValues = useRef<Partial<z.input<typeof recordExpenseSchema>>>({});
  const trackEntry = useCallback((values: Partial<z.input<typeof recordExpenseSchema>>) => { entryValues.current = values; }, []);
  const [formKey, setFormKey] = useState(0), [receipt, setReceipt] = useState<VoiceExpenseReceipt | null>(outcome?.status === "COMPLETED" ? outcome.receipt : null);
  const [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [problem, setProblem] = useState(outcome?.status === "EXPIRED" ? "This review has expired. Enter the details for a new review." : "");
  const sending = useRef(false);
  const base = "/api/v1/farms/" + farmId + "/voice/drafts";
  async function recover(current: VoiceDraftView): Promise<VoiceDraftOutcome> {
    const response = await fetch(base + "/" + current.draftId + "/status", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not check review outcome");
    const result = voiceDraftOutcomeSchema.parse(await response.json());
    if (result.status === "COMPLETED") {
      if (result.receipt.draftId !== current.draftId) throw new Error("Wrong receipt");
      setReceipt(result.receipt); setProblem("This review was already saved. Your edits were not posted. Open the saved expense before correcting it.");
    } else if (result.status === "PENDING") {
      if (result.draft.draftId !== current.draftId || result.draft.farmId !== farmId) throw new Error("Wrong review");
      setDraft(result.draft);
      setSeed(result.draft.review.command); setBags(result.draft.review.bags); setFormKey(key => key + 1);
    }
    return result;
  }
  async function review(input: unknown) {
    if (!navigator.onLine) return { ok: false as const, message: "Reconnect to review this expense. Your details are still here." };
    const command = recordExpenseSchema.parse(input);
    const review = { schemaVersion: 1, kind: "EXPENSE", command: { ...command, ...(draft ? { requestId: draft.review.command.requestId } : {}) }, bags };
    try {
      const response = await fetch(base + (draft ? "/" + draft.draftId : ""), { method: draft ? "PATCH" : "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ review, ...(draft ? { version: draft.version } : {}) }) });
      if (!response.ok) {
        if (response.status === 409) {
          if (draft) {
            const result = await recover(draft);
            if (result.status === "COMPLETED") return;
            if (result.status === "PENDING") return { ok: false as const, message: "This review changed in another window. Your details are still here. Review them again before confirming." };
          }
          setDraft(null); setSeed({ ...command, requestId: crypto.randomUUID() });
          setProblem("The old review expired or changed. Your details are here; select Review expense to start a new review.");
        }
        return { ok: false as const, message: failure(response.status) };
      }
      const result = z.object({ draft: voiceDraftViewSchema }).strict().parse(await response.json());
      if (result.draft.farmId !== farmId) throw new Error("Wrong farm");
      setDraft(result.draft); setSeed(result.draft.review.command); setReviewing(true); setProblem("");
      remember(result.draft.draftId);
      requestAnimationFrame(() => document.getElementById("voice-review-title")?.focus());
    } catch { return { ok: false as const, message: "Connection interrupted. Your details are still here. Retry the same review." }; }
  }
  async function confirm() {
    if (!draft || sending.current || !navigator.onLine) return;
    if (!uncertain && Date.parse(draft.expiresAt) <= Date.now()) { setProblem("This review has expired. Review the details again."); return; }
    sending.current = true; setBusy(true); setProblem("");
    try {
      const response = await fetch(base + "/" + draft.draftId + "/confirm", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmed: true, requestId: draft.review.command.requestId, version: draft.version, payloadHash: draft.payloadHash }) });
      if (!response.ok) {
        if (response.status === 409) {
          try {
            const result = await recover(draft); setUncertain(false);
            if (result.status === "COMPLETED") return;
            setProblem(result.status === "EXPIRED" ? "This review has expired. Review the details again." : "This review changed in another window. Check the updated details before confirming.");
            return;
          } catch { setUncertain(true); setProblem("The outcome could not be checked. Retry this confirmation or refresh this page before entering another expense."); return; }
        }
        // A 5xx response can follow an interrupted commit. Keep the original grant until its result is known.
        setUncertain(response.status >= 500); setProblem(failure(response.status)); return;
      }
      const result = z.object({ receipt: voiceExpenseReceiptSchema }).strict().parse(await response.json());
      if (result.receipt.draftId !== draft.draftId || result.receipt.payloadHash !== draft.payloadHash || result.receipt.version !== draft.version) throw new Error("Wrong receipt");
      setReceipt(result.receipt); setUncertain(false);
    } catch { setUncertain(true); setProblem("Connection interrupted. Retry this confirmation to find out whether it was saved."); }
    finally { sending.current = false; setBusy(false); }
  }
  function remember(id?: string) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("draft", id); else url.searchParams.delete("draft");
    window.history.replaceState(null, "", url);
  }
  function discard() { remember(); entryValues.current = {}; setDraft(null); setSeed({}); setBags(null); setReviewing(false); setProblem(""); setFormKey(key => key + 1); }
  function suggest(intent: FeedExpenseIntent) {
    setSeed(current => ({ ...current, ...entryValues.current, requestId: draft?.review.command.requestId ?? crypto.randomUUID(), amount: intent.totalAmount, currency: intent.currency }));
    setBags(intent.bags);
  }
  if (receipt) return <section aria-live="polite" className="space-y-4 rounded-2xl border border-border bg-white p-5"><h2 className="text-2xl font-semibold">Expense saved</h2><p>This expense was recorded once. Keep the record below for your reference.</p>{problem && <p role="status">{problem}</p>}
    <Link className="inline-flex min-h-12 items-center underline" href={"/farms/" + farmId + "/accounting/records/" + receipt.recordId}>Open saved expense</Link></section>;
  const linkLabels = draft ? (["enterprise", "season", "plot", "batch"] as const).flatMap(kind => draft.labels[kind] ? [kind + ": " + draft.labels[kind]] : []) : [];
  // A saved review can reference an authorized choice beyond the initial page.
  const editLinks = links && draft ? { ...links, pages: { ...links.pages } } : links;
  if (editLinks && draft) {
    for (const [page, field, label] of [["enterprises", "enterpriseId", "enterprise"], ["seasons", "seasonId", "season"], ["plots", "plotId", "plot"], ["batches", "batchId", "batch"]] as const) {
      const id = draft.review.command[field], name = draft.labels[label], current = editLinks.pages[page];
      if (id && name && !current.items.some(item => item.id === id)) editLinks.pages[page] = { ...current, items: [...current.items, { id, label: name }] };
    }
  }
  return <div className="max-w-3xl space-y-5">
    <p>Speech entry is not available yet. Type the details instead, then check this farm, the total and the date before you confirm. No audio is recorded.</p>
    {!online && <p role="status" className="rounded-xl bg-muted p-4">You are offline. Your details stay here while this page is open. Reconnect to review or confirm. You can also use <a className="underline" href="/offline">Offline work</a> to record an expense on this phone.</p>}
    {problem && <p role="alert" className="field-error">{problem}</p>}
    {reviewing && draft ? <DraftReview key={draft.payloadHash} draft={draft} farmName={farmName} category={draft.labels.category}
      paidBy={draft.labels.paymentMethod ?? "Not recorded"} links={linkLabels} online={online} busy={busy} uncertain={uncertain} confirm={confirm}
      edit={() => { setReviewing(false); setFormKey(key => key + 1); setProblem(""); }} discard={discard} />
      : <><VoiceInputOptions farmId={farmId} capabilities={capabilities} online={online} suggest={suggest} /><div className="rounded-2xl border border-border bg-white p-5"><TransactionForm key={formKey} kind="EXPENSE" categories={categories} paymentMethods={paymentMethods} links={editLinks} initialValues={seed} onDraftChange={trackEntry} submitLabel="Review expense" submit={review} /></div>
        <Button type="button" variant="outline" onClick={discard}>Clear details</Button></>}
  </div>;
}
