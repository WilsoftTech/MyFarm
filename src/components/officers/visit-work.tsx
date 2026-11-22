"use client";
import { useEffect, useState } from "react";
import type { VisitView } from "@/modules/extension-officers/contracts/work";
import { queueOfficer } from "@/modules/extension-officers/client/work";
import { localDatabase } from "@/modules/offline-first/client/local-database";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Field } from "../farmer-registry/field";
import { PrepareRegistration } from "./registration";

export interface VisitContext { accountId: string; scope: string; farmId: string; assignmentId: string }
export function VisitForm({ context }: { context: VisitContext }) {
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  return <form className="space-y-4" onSubmit={event => {
    event.preventDefault(); const form = event.currentTarget, fields = new FormData(form); setBusy(true);
    void (async () => {
      const requestId = crypto.randomUUID(), value = (key: string) => String(fields.get(key) ?? "").trim();
      const result = await queueOfficer(localDatabase(context.accountId), { operation: "OFFICER_RECORD_VISIT", organizationId: context.scope, farmId: context.farmId, payload: { requestId, assignmentId: context.assignmentId, scheduledOn: value("date"), status: fields.get("completed") ? "COMPLETED" : "PLANNED", observations: value("observations"), recommendation: value("recommendation"), ...(value("latitude") || value("longitude") ? { latitude: value("latitude"), longitude: value("longitude") } : {}), ...(value("followDate") ? { followUp: { dueOn: value("followDate"), notes: value("followNotes") } } : {}), ...(value("problem") ? { problem: value("problem") } : {}) } });
      setMessage(result.message);
      const photo = fields.get("photo");
      if (result.saved && photo instanceof File && photo.size > 0) {
        const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await photo.arrayBuffer())), b => b.toString(16).padStart(2, "0")).join("");
        const attached = await queueOfficer(localDatabase(context.accountId), { operation: "OFFICER_ATTACH_PHOTO", organizationId: context.scope, farmId: context.farmId, payload: { requestId: crypto.randomUUID(), visitId: requestId, sha256, byteSize: photo.size, contentType: photo.type } }, photo, result.mutationId);
        setMessage(attached.saved ? "Visit and photo saved on this phone. Waiting to send." : "Visit saved. Photo was not saved: " + attached.message);
      }
      if (result.saved) form.reset();
    })().catch(() => setMessage("Could not save. Keep your details and try again.")).finally(() => setBusy(false));
  }}><h2 className="text-xl font-semibold">Record a visit</h2>
    <Field id="visit-date" label="Visit date">{aria => <Input {...aria} name="date" type="date" required />}</Field>
    <label className="flex min-h-12 items-center gap-3"><input name="completed" type="checkbox" className="size-5" />Visit completed</label>
    <Field id="visit-observations" label="Observations">{aria => <textarea {...aria} name="observations" maxLength={2000} className="min-h-24 w-full rounded-xl border p-3" />}</Field>
    <Field id="visit-advice" label="Recommendations">{aria => <textarea {...aria} name="recommendation" maxLength={2000} className="min-h-24 w-full rounded-xl border p-3" />}</Field>
    <details className="rounded-xl border p-4"><summary>Optional GPS</summary><p>Leave both empty if you do not want to record a precise location.</p>{["latitude", "longitude"].map(key => <Field key={key} id={"visit-" + key} label={key === "latitude" ? "Latitude" : "Longitude"}>{aria => <Input {...aria} name={key} inputMode="decimal" />}</Field>)}</details>
    <Field id="follow-date" label="Follow-up date" optional>{aria => <Input {...aria} name="followDate" type="date" />}</Field>
    <Field id="follow-notes" label="Follow-up notes" optional>{aria => <Input {...aria} name="followNotes" maxLength={1000} />}</Field>
    <Field id="visit-problem" label="Flag a problem" optional hint="Leave empty unless you want to flag an unresolved issue.">{aria => <Input {...aria} name="problem" maxLength={1000} />}</Field>
    <Field id="new-visit-photo" label="Visit photo" optional hint="Private PNG, JPEG or WebP, at most 2 MB.">{aria => <Input {...aria} name="photo" type="file" accept="image/png,image/jpeg,image/webp" />}</Field>
    <Button disabled={busy} type="submit">Save visit on this phone</Button>{message && <p role="status">{message}</p>}
  </form>;
}
function VisitItem({ row, context }: { row: VisitView; context: VisitContext }) {
  const [message, setMessage] = useState("");
  async function finish(kind: "FOLLOW_UP" | "PROBLEM", id: string, version: number) {
    const result = await queueOfficer(localDatabase(context.accountId), { operation: kind === "FOLLOW_UP" ? "OFFICER_FINISH_FOLLOW_UP" : "OFFICER_RESOLVE_PROBLEM", organizationId: context.scope, farmId: context.farmId, recordId: id, payload: { requestId: crypto.randomUUID(), expectedVersion: version } }); setMessage(result.message);
  }
  async function photo(file: File) {
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())), b => b.toString(16).padStart(2, "0")).join("");
    const result = await queueOfficer(localDatabase(context.accountId), { operation: "OFFICER_ATTACH_PHOTO", organizationId: context.scope, farmId: context.farmId, payload: { requestId: crypto.randomUUID(), visitId: row.visitId, sha256, byteSize: file.size, contentType: file.type } }, file); setMessage(result.message);
  }
  async function view(photoId: string) {
    try { const response = await fetch(`/api/v1/farms/${context.farmId}/officer-photos/${photoId}/view?scope=${context.scope}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: crypto.randomUUID() }) }); if (!response.ok) throw new Error(); const result: { url: string } = await response.json(); window.location.assign(result.url); }
    catch { setMessage("Could not open the photo. Connect and check your access."); }
  }
  return <li className="space-y-3 rounded-xl border p-4"><h3 className="font-semibold">{row.scheduledOn} · {row.status === "COMPLETED" ? "Completed" : "Planned"}</h3><p className="whitespace-pre-wrap">{row.observations}</p><p className="whitespace-pre-wrap">{row.recommendation}</p>{row.latitude && <p>GPS: {row.latitude}, {row.longitude}</p>}
    {row.followUps.map(item => <div key={item.id}><p>Follow-up {item.dueOn}: {item.notes} · {item.status}</p>{item.status === "OPEN" && <Button variant="outline" onClick={() => void finish("FOLLOW_UP", item.id, item.version)}>Complete follow-up</Button>}</div>)}
    {row.problems.map(item => <div key={item.id}><p>Problem: {item.description} · {item.resolved ? "Resolved" : "Open"}</p>{!item.resolved && <Button variant="outline" onClick={() => void finish("PROBLEM", item.id, item.version)}>Resolve problem</Button>}</div>)}
    <Field id={"photo-" + row.visitId} label="Private visit photo" hint="PNG, JPEG or WebP, at most 2 MB.">{aria => <Input {...aria} type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { const file = event.target.files?.[0]; if (file) void photo(file).catch(() => setMessage("Could not save this photo.")); }} />}</Field>
    {row.photos.length > 0 && <p>Latest 50 visit photos</p>}{row.photos.map(item => <Button key={item.id} variant="outline" onClick={() => void view(item.id)}>Open visit photo</Button>)}{message && <p role="status">{message}</p>}
  </li>;
}
export function VisitWork({ context, rows }: { context: VisitContext; rows: VisitView[] }) {
  return <div className="space-y-6"><h1 className="text-3xl font-bold">Assigned farm visits</h1><p>Access is checked when sending. Saving on this phone does not confirm server access.</p><a href="/offline" className="underline">Open sync center and offline work</a><VisitForm context={context} /><h2 className="text-xl font-semibold">Latest 50 visits</h2><ul className="space-y-4">{rows.map(row => <VisitItem key={row.visitId} row={row} context={context} />)}</ul><a className="underline" href={`?scope=${context.scope}&farmId=${context.farmId}&assignmentId=${context.assignmentId}`}>Reload visits after sending</a></div>;
}
export function OfficerOfflinePanel({ accountId }: { accountId: string }) {
  const [contexts, setContexts] = useState<(VisitContext & { name: string; asOf: string })[]>([]), [selected, setSelected] = useState(""), [scope, setScope] = useState("");
  useEffect(() => { void localDatabase(accountId).meta.get("officer:scope").then(row => setScope(row?.value ?? "")).catch(() => undefined); }, [accountId]);
  useEffect(() => { void localDatabase(accountId).meta.get("officer:farms").then(row => { if (row) { const value: unknown = JSON.parse(row.value); if (Array.isArray(value)) setContexts(value.filter((item): item is VisitContext & { name: string; asOf: string } => typeof item === "object" && item !== null && ["accountId", "scope", "farmId", "assignmentId", "name", "asOf"].every(key => typeof item[key] === "string") && item.accountId === accountId)); } }).catch(() => undefined); }, [accountId]);
  if (!contexts.length) return scope ? <details className="rounded-xl border p-5"><summary>Prepare registration offline</summary><PrepareRegistration accountId={accountId} scope={scope} /></details> : null;
  const context = contexts.find(row => row.assignmentId === selected) ?? contexts[0];
  return <section className="space-y-4 rounded-xl border p-5"><h2 className="text-xl font-semibold">Officer visits offline</h2><label htmlFor="officer-farm">Saved assigned farm</label><select id="officer-farm" className="min-h-12 w-full rounded-xl border p-3" value={context.assignmentId} onChange={event => setSelected(event.target.value)}>{contexts.map(row => <option key={row.assignmentId} value={row.assignmentId}>{row.name}</option>)}</select><p>Saved {context.asOf}. Access may have changed. Blocked entries remain on this phone.</p><VisitForm key={context.assignmentId} context={context} /><details><summary>Prepare registration offline</summary><PrepareRegistration accountId={accountId} scope={context.scope} /></details></section>;
}
