"use client";
import { useState } from "react";
import { Field } from "@/components/farmer-registry/field";
import { languageLabels } from "@/components/farmer-registry/labels";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { voiceInputResultSchema, type VoiceCapabilities } from "@/modules/voice-experience/contracts/input";
import type { FeedExpenseIntent } from "@/modules/voice-experience/contracts/voice";
import { VERBATIM_SOURCE_FEED_EXAMPLE } from "@/modules/voice-experience/domain/examples";
const labels = { ...languageLabels, sw: "Swahili" };

export function VoiceInputOptions({ farmId, capabilities, online, suggest }: { farmId: string; capabilities: VoiceCapabilities; online: boolean; suggest: (intent: FeedExpenseIntent) => void }) {
  const [language, setLanguage] = useState("en"), [text, setText] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function fill() {
    if (!navigator.onLine || busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/v1/farms/" + farmId + "/voice/intent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ language, text }) });
      if (!response.ok) { setMessage(response.status === 401 || response.status === 403 ? "Sign in and check your access to this farm before continuing." : "The words could not be filled in. Enter the details below instead."); return; }
      const result = voiceInputResultSchema.parse(await response.json());
      if (result.kind === "SUGGESTION") { suggest(result.intent); setMessage("The amount and currency are filled in. Choose the category and date, and check the total before reviewing."); }
      else setMessage("These words cannot be filled in automatically. Enter or correct the expense details below instead.");
    } catch { setMessage("Connection interrupted. Your words are still here. You can enter the expense details below."); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="voice-input-title" className="space-y-4 rounded-2xl border border-border bg-white p-5">
    <h2 id="voice-input-title" className="text-xl font-semibold">Use text instead of speech</h2>
    <Field id="voiceLanguage" label="Speech language" hint="This does not translate the interface. No speech language is enabled until its accuracy is reviewed.">{aria => <Select {...aria} disabled={busy} value={language} onChange={event => { setLanguage(event.target.value); setMessage(""); }}>
      {capabilities.languages.map(item => <option key={item.language} value={item.language}>{labels[item.language]}</option>)}
    </Select>}</Field>
    <p role="status">Microphone entry is unavailable on this page. No recording is made. You can type the details below.</p>
    <Button type="button" variant="outline" disabled>Speech unavailable — use text</Button>
    <p className="text-sm leading-6">The example below can fill in a total. Other wording may need manual entry. No expense is saved by filling in these fields.</p>
    <Field id="voiceWords" label="Expense words" hint="Do not include names or phone numbers. These words are not kept.">{aria => <textarea {...aria} className="w-full rounded-xl border border-border bg-white px-4 py-3 text-base" rows={3} maxLength={500} value={text} disabled={busy} onChange={event => setText(event.target.value)} />}</Field>
    <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" disabled={busy} onClick={() => { setText(VERBATIM_SOURCE_FEED_EXAMPLE); setMessage(""); }}>Use example</Button>
      <Button type="button" disabled={busy || !online || !text.trim()} onClick={() => void fill()}>{busy ? "Checking words…" : "Fill from words"}</Button></div>
    {message && <p role="status" className="text-sm leading-6">{message}</p>}
  </section>;
}
