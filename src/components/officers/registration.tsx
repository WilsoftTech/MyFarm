"use client";
import { useState } from "react";
import { FarmerProfileForm } from "@/components/farmer-registry/farmer-profile-form";
import { FarmForm } from "@/components/farmer-registry/farm-form";
import { farmerProfileSchema, farmSchema } from "@/modules/farmer-registry/contracts/registry";
import type { RegistrationDraftView, RegistrationReview } from "@/modules/extension-officers/contracts/work";
import { localDatabase } from "@/modules/offline-first/client/local-database";
import { queueOfficer } from "@/modules/extension-officers/client/work";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Field } from "../farmer-registry/field";

const details = (input: unknown) => Object.fromEntries(Object.entries(typeof input === "object" && input !== null ? input : {}).filter(([key]) => key !== "requestId"));
export function PrepareRegistration({ accountId, scope }: { accountId: string; scope: string }) {
  const [target, setTarget] = useState(""), [profile, setProfile] = useState<RegistrationReview["profile"] | null>(null), [message, setMessage] = useState(""), [requestId] = useState(() => crypto.randomUUID());
  return <section className="space-y-6"><h1 className="text-3xl font-bold">Prepare farmer registration</h1><p>The farmer must already have their own login. Ask them to share their account ID from their workspace. Preparing this draft creates no farmer, farm or access grant. They review and accept within 7 days after MyFarm receives it.</p>
    <Field id="target-account" label="Farmer account ID">{aria => <Input {...aria} value={target} onChange={event => setTarget(event.target.value)} />}</Field>
    {!profile ? <FarmerProfileForm submitLabel="Continue to farm details" submit={async input => { setProfile(farmerProfileSchema.parse(details(input))); return undefined; }} /> : <><h2 className="text-xl font-semibold">Farm details</h2><Button variant="outline" onClick={() => setProfile(null)}>Review farmer details</Button><FarmForm submitLabel="Save draft for farmer review" submit={async input => {
      const result = await queueOfficer(localDatabase(accountId), { operation: "OFFICER_PREPARE_REGISTRATION", organizationId: scope, payload: { requestId, targetUserId: target, review: { profile, farm: farmSchema.parse(details(input)) } } });
      setMessage(result.message); return result.saved ? undefined : { ok: false, message: result.message };
    }} /></>}
    {message && <div role="status"><p>{message}</p><p>After sending, share this review path directly with the farmer: <a className="break-all underline" href={`/registration-review/${requestId}`}>/registration-review/{requestId}</a></p><a className="underline" href="/offline">Open sync center</a></div>}
  </section>;
}
const labels: Record<string, string> = { name: "Name", phone: "Phone", alternativePhone: "Alternative phone", district: "District", subcounty: "Subcounty", village: "Village", preferredLanguage: "Preferred language", mainActivities: "Activities", ownershipType: "Land arrangement", approximateAcreage: "Approximate acres", primaryActivity: "Main activity", latitude: "Latitude", longitude: "Longitude" };
export function RegistrationReview({ view }: { view: RegistrationDraftView }) {
  const [confirmed, setConfirmed] = useState(false), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  async function act(accept: boolean) {
    setBusy(true);
    try { const response = await fetch(`/api/v1/agent/registrations/${view.draftId}${accept ? "/accept" : ""}`, { method: accept ? "POST" : "DELETE", headers: { "content-type": "application/json" }, ...(accept ? { body: JSON.stringify({ expectedVersion: view.version, payloadHash: view.payloadHash, confirmed }) } : {}) });
      if (!response.ok) { setMessage("Could not complete this request. The draft may have expired or access changed. Reload to review again."); return; }
      if (accept) { const result: { farmId: string } = await response.json(); window.location.assign("/farms/" + result.farmId); }
      else window.location.assign("/workspace");
    } catch { setMessage("Connection interrupted. Keep this page and retry to recover the same result."); } finally { setBusy(false); }
  }
  if (view.acceptedFarmId) return <section><h1 className="text-3xl font-bold">Registration accepted</h1><a className="underline" href={`/farms/${view.acceptedFarmId}`}>Open your farm</a></section>;
  return <section className="space-y-6"><h1 className="text-3xl font-bold">Review registration</h1><p>Review every detail. Accepting creates your farmer profile and farm and lets the officer see the dashboard, record visits and manage follow-ups. You can revoke their access from the farm’s officer page. Review ends {view.expiresAt}.</p><p className="break-all">Officer account ID: {view.officerAccountId}</p>
    {view.review && Object.entries(view.review).map(([section, fields]) => <section key={section}><h2 className="text-xl font-semibold">{section === "profile" ? "Farmer details" : "Farm details"}</h2><dl className="mt-3 space-y-2">{Object.entries(fields).map(([key, value]) => <div key={key}><dt className="font-semibold">{labels[key] ?? key}</dt><dd className="break-words">{Array.isArray(value) ? value.join(", ") : String(value || "Not provided")}</dd></div>)}</dl></section>)}
    {view.canAccept && <><label className="flex min-h-12 items-center gap-3"><input type="checkbox" className="size-5" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I have reviewed these details and agree to create my records and grant this officer access.</label><Button disabled={!confirmed || busy} onClick={() => void act(true)}>Accept registration</Button></>}
    <Button variant="outline" disabled={busy} onClick={() => void act(false)}>Discard this draft</Button>{message && <p role="alert">{message}</p>}
  </section>;
}
