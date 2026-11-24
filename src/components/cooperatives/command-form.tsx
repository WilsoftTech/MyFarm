"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { procurementTotal } from "@/modules/cooperatives/domain/operations";
import { createCooperativeSchema, operationCommandSchema, relationshipCommandSchema } from "@/modules/cooperatives/contracts/cooperative";
export interface Field { name: string; label: string; type?: "text" | "date" | "checkbox"; options?: { value: string; label: string }[]; optional?: boolean; initial?: string }
const messages: Record<string, string> = { FORBIDDEN: "Your access has changed. Reload to check your access. Your details are still here.", CONFLICT: "These details conflict with the current records. Reload and review before making a new request.", INVALID_INPUT: "Check quantities, dates and other details. Your details are still here.", RATE_LIMITED: "Too many attempts. Wait a minute, then retry the same review.", UNAUTHENTICATED: "Your session has ended. Sign in again, then retry." };
/** A reviewed request remains identical through uncertain network failures. No success before commit. */
interface CommandFormProps {
  actorId: string; title: string; endpoint: string; fixed?: Record<string, string | number | boolean | null>; fields?: Field[]; destination?: string; notice?: string;
}
export function CommandForm(props: CommandFormProps) {
  return <ReviewedCommandForm key={JSON.stringify([props.actorId, props.endpoint, props.title, props.fixed ?? {}])} {...props} />;
}
function ReviewedCommandForm({ actorId, title, endpoint, fixed = {}, fields = [], destination, notice }: CommandFormProps) {
  const prefix = useId(), router = useRouter(), form = useRef<HTMLFormElement>(null);
  const [review, setReview] = useState<Record<string, string | number | boolean | null> | null>(null);
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [offline, setOffline] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const recoveryKey = "myfarm:cooperative-review:v1:" + JSON.stringify([actorId, endpoint, title, fixed]);
  useEffect(() => {
    function restore() {
      try {
        const saved: unknown = JSON.parse(sessionStorage.getItem(recoveryKey) ?? "null");
        if (!saved || typeof saved !== "object" || !("review" in saved) || !("submitted" in saved)) return;
        const parsed = endpoint === "/api/v1/cooperatives" ? createCooperativeSchema.safeParse(saved.review) : endpoint.endsWith("/relationships") ? relationshipCommandSchema.safeParse(saved.review) : operationCommandSchema.safeParse(saved.review);
        if (parsed.success) { setReview(parsed.data); setUncertain(saved.submitted === true); setMessage("Recovered this tab’s exact review. Retry it to recover any saved result."); }
      } catch { /* A browser may deny session storage; saves check persistence before sending. */ }
    }
    restore();
  }, [recoveryKey, endpoint]);
  function retain(candidate: Record<string, string | number | boolean | null>, submitted: boolean): boolean {
    try { sessionStorage.setItem(recoveryKey, JSON.stringify({ review: candidate, submitted })); return true; }
    catch { setMessage("This browser cannot keep the review for safe retry. Nothing new was sent. Enable tab storage before saving."); return false; }
  }
  useEffect(() => { const update = () => setOffline(!navigator.onLine); update(); window.addEventListener("online", update); window.addEventListener("offline", update); return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); }; }, []);
  function prepare(data: FormData) {
    const values: Record<string, string | number | boolean | null> = { ...fixed };
    for (const field of fields) values[field.name] = field.type === "checkbox" ? data.get(field.name) === "on" : String(data.get(field.name) ?? "").trim();
    if (values.type === "PROCURE" && !values.harvestId) values.harvestId = null;
    if (!values.type) values.organizationId = crypto.randomUUID();
    if (values.type === "PROCURE") {
      try { procurementTotal(String(values.quantity), String(values.unitPrice), String(values.unit)); }
      catch { setMessage("Check the quantity and price. Eggs and birds must be whole numbers, and the total must be greater than zero."); return; }
    }
    const candidate = { ...values, requestId: crypto.randomUUID(), confirmed: true };
    if (!retain(candidate, false)) return;
    setReview(candidate); setUncertain(false); setMessage("");
  }
  async function save() {
    if (!review || busy || offline) return;
    if (!retain(review, true)) return;
    setBusy(true); setMessage("");
    setUncertain(true);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(review) });
      if (!response.ok) {
        const result: unknown = await response.json();
        const code = result && typeof result === "object" && "error" in result && typeof result.error === "string" ? result.error : "UNAVAILABLE";
        if (!uncertain && code in messages) { retain(review, false); setUncertain(false); }
        setMessage(messages[code] ?? "Unable to confirm the save. Keep this review and retry; the same request cannot create a duplicate."); return;
      }
      try { sessionStorage.removeItem(recoveryKey); } catch { /* A retained old request still replays safely. */ }
      setMessage("Saved and confirmed by MyFarm."); setReview(null); setUncertain(false); form.current?.reset();
      if (destination) router.push(destination);
      else if (!fixed.type) router.push("/cooperatives/" + String(review.organizationId));
      router.refresh();
    } catch { setMessage("Connection interrupted. Your review is still here. Retry this same review to recover the saved result without a duplicate."); }
    finally { setBusy(false); }
  }
  return <section className="mt-5 rounded-xl border border-border p-4"><h3 className="text-lg font-semibold">{title}</h3>{notice && <p className="mt-2 text-sm leading-6">{notice}</p>}
    <p className="mt-2 text-sm">Online confirmation required. Reviewed details are kept in this tab for retry through a reload. Closing the tab or clearing browser storage can lose them.</p>
    {offline && <p role="status" className="mt-3">You are offline. Reconnect before confirming. Unreviewed details are not saved on this device.</p>}
    <form ref={form} onSubmit={event => { event.preventDefault(); prepare(new FormData(event.currentTarget)); }} className="mt-4 space-y-4">
      <fieldset disabled={busy || review !== null} className="space-y-4">{fields.map(field => <div key={field.name}>
        <label htmlFor={prefix + field.name} className="mb-2 block font-medium">{field.label}{field.optional ? " (optional)" : ""}</label>
        {field.options ? <select id={prefix + field.name} name={field.name} required={!field.optional} defaultValue={field.initial ?? ""} className="min-h-12 w-full rounded-xl border bg-background p-3"><option value="">Choose</option>{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          : <Input id={prefix + field.name} name={field.name} type={field.type ?? "text"} defaultValue={field.initial} required={!field.optional && field.type !== "checkbox"} maxLength={field.type === "date" || field.type === "checkbox" ? undefined : 500} />}
      </div>)}<Button type="submit" disabled={offline}>Review details</Button></fieldset>
      {review && <div className="rounded-xl bg-muted p-4"><h4 className="font-semibold">Confirm this exact review</h4><dl className="mt-3 space-y-2">{fields.map(field => <div key={field.name}><dt className="font-medium">{field.label}</dt><dd className="break-words">{typeof review[field.name] === "boolean" ? review[field.name] ? "Yes" : "No" : field.options?.find(option => option.value === review[field.name])?.label ?? String(review[field.name] ?? "Not provided")}</dd></div>)}</dl>
        {review.type === "PROCURE" && <p className="mt-3 font-semibold">Total: {String(review.currency)} {procurementTotal(String(review.quantity), String(review.unitPrice), String(review.unit))}</p>}
        {uncertain && <p className="mt-3">Recover this review’s result before making changes.</p>}
        <div className="mt-4 flex flex-wrap gap-3"><Button type="button" onClick={save} disabled={busy || offline}>{busy ? "Saving…" : "Confirm and save"}</Button><Button type="button" variant="outline" disabled={busy || uncertain} onClick={() => { try { sessionStorage.removeItem(recoveryKey); } catch { return; } setReview(null); setMessage(""); }}>Change details</Button></div>
      </div>}
      {message && <p role="status" aria-live="polite" className="leading-6">{message}</p>}
    </form>
  </section>;
}
