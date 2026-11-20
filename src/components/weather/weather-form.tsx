"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { SCENARIOS, weatherDisplaySchema, weatherReviewDisplaySchema, weatherReceiptSchema, type WeatherConfirmation } from "@/modules/weather-intelligence/contracts/service";

type Choice = { id: string; label: string };
type Report = z.output<typeof weatherDisplaySchema>;
type Review = z.output<typeof weatherReviewDisplaySchema>;
type Receipt = z.output<typeof weatherReceiptSchema>;
const field = "mt-1 min-h-12 w-full rounded-xl border border-border bg-background p-3";
const scenarioLabels = { RAIN: "Rain and spraying", PLANTING: "Planting window", IRRIGATION: "Irrigation", EXTREME: "Extreme weather", NONE: "No signals", UNAVAILABLE: "Provider unavailable" };
export function WeatherForm({ farmId, activities, crops, initialActivityId = "" }: { farmId: string; activities: Choice[]; crops: Choice[]; initialActivityId?: string }) {
  const [report, setReport] = useState<Report | null>(null), [review, setReview] = useState<Review | null>(null), [receipt, setReceipt] = useState<Receipt | null>(null);
  const [consent, setConsent] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState("");
  const [retry, setRetry] = useState<WeatherConfirmation | null>(null), [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!report?.forecast) return;
    const timer = setTimeout(() => setExpired(true), Math.max(0, Date.parse(report.forecast.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [report]);
  const clear = (name?: string) => { if (!retry) { setReview(null); if (name !== "newDueOn") { setReport(null); setExpired(false); } setReceipt(null); setConsent(false); setError(""); } };
  async function post(path: string, body: object): Promise<unknown> {
    if (!navigator.onLine) throw new Error("You are offline. Reconnect before checking or changing work. Nothing is queued.");
    const response = await fetch(`/api/v1/farms/${farmId}/weather/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(response.status === 409 ? "This review changed or expired. Check the activity and review again." : response.status === 403 ? "Your access or selected records changed. Check your farm access." : response.status === 401 ? "Your session ended. Sign in again before changing work." : response.status === 400 ? "Check your selections and dates. Choose a crop before entering a stage." : response.status === 429 ? "Too many checks. Wait a minute, then try again." : "The check could not finish. Reconnect and try again.");
    return response.json();
  }
  async function check(form: HTMLFormElement, reviewing: boolean) {
    const data = new FormData(form); const input = { scenario: data.get("scenario"), activityId: data.get("activityId") || null, cycleId: data.get("cycleId") || null, stage: data.get("stage") || null };
    setPending(true); setError(""); setConsent(false); setReview(null); setReceipt(null); setExpired(false);
    try {
      if (reviewing) { const next = weatherReviewDisplaySchema.parse(await post("review", { input, newDueOn: data.get("newDueOn") })); setReview(next); setReport(next.report); }
      else setReport(weatherDisplaySchema.parse(await post("check", input)));
    } catch (e) { setReport(null); setError(e instanceof z.ZodError ? "The response could not be checked. Reconnect and retry this step." : e instanceof Error ? e.message : "The check could not finish."); }
    finally { setPending(false); }
  }
  async function confirm() {
    if (!review) return;
    const body: WeatherConfirmation = retry ?? { ...review.confirmation, requestId: crypto.randomUUID(), confirmed: true };
    setRetry(body); setPending(true); setError("");
    try { const saved = weatherReceiptSchema.parse(await post("confirm", body)); setReceipt(saved); setReview(null); setReport(null); setRetry(null); setConsent(false); }
    catch (e) { setError(e instanceof z.ZodError ? "The response could not be checked. Retry this same confirmation or open the activity to check its saved date." : e instanceof Error ? e.message : "Response interrupted. Retry this same confirmation."); }
    finally { setPending(false); }
  }
  return <div className="max-w-2xl space-y-5">
    <p className="rounded-xl border border-border p-4"><strong>Test forecasts only.</strong> This page uses made-up weather signals. It does not provide live weather or agronomic advice. Confirming a date change changes real planned work.</p>
    <form onSubmit={event => { event.preventDefault(); void check(event.currentTarget, false); }} onChange={event => clear(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement ? event.target.name : undefined)} className="space-y-4">
      <fieldset disabled={pending || !!retry} className="min-w-0 space-y-4">
        <div><label htmlFor="weatherScenario">Test scenario</label><select id="weatherScenario" name="scenario" className={field}>{SCENARIOS.map(value => <option key={value} value={value}>{scenarioLabels[value]}</option>)}</select></div>
        <div><label htmlFor="weatherActivity">Planned activity</label><select id="weatherActivity" name="activityId" defaultValue={initialActivityId} className={field}><option value="">No activity selected</option>{activities.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</select></div>
        <div><label htmlFor="weatherCrop">Crop cycle (optional)</label><select id="weatherCrop" name="cycleId" className={field}><option value="">No crop selected</option>{crops.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</select></div>
        <label className="block">Crop stage you observed (optional)<input name="stage" maxLength={120} className={field} /><span className="text-sm">Choose a crop before entering a stage. A stage is never guessed.</span></label>
        <Button type="submit">Check test forecast</Button>
        <label className="block">New activity date<input name="newDueOn" type="date" className={field} /></label>
        <Button type="button" variant="outline" disabled={!report || expired || report.activity?.status !== "TEST_NOTICE" || report.recurring} onClick={event => { if (event.currentTarget.form) void check(event.currentTarget.form, true); }}>Review date change</Button>
      </fieldset>
    </form>
    <p className="text-sm">Choices show up to 50 records at a time. Use the choice-page links below for more. Recurring work stays in the series workflow.</p>
    {pending && <p role="status">Checking…</p>}
    {error && <p role="alert" className="break-words">{error}</p>}
    {report && <section aria-label="Test forecast results" className="space-y-3">
      <h2 className="text-xl font-semibold">Test forecast results</h2><p>Approximate place: {report.district || "Not available"}. {report.crop ? `Crop: ${report.crop}. Stage: ${report.stage ?? "Not supplied"}.` : "Crop not supplied."}</p>
      <p>Checked: {report.checkedAt}</p>
      {report.forecast ? <p>Source: synthetic test fixture. Issued: {report.forecast.issuedAt}. Window: {report.forecast.validFrom} to {report.forecast.validTo}. Expires: {report.forecast.expiresAt}.</p> : <p>No current forecast is available.</p>}
      {expired && <p role="status">This test forecast expired. Check again before reviewing a change.</p>}
      {report.activity && <div className="rounded-xl border border-border p-4"><h3 className="font-semibold">{report.activity.activity.label} on {report.activity.activity.dueOn}</h3><p>{report.activity.message}</p>{report.activity.limitations.length > 0 && <p>Context limits: {report.activity.limitations.join(", ").toLowerCase().replaceAll("_", " ")}</p>}</div>}
      <ul className="space-y-3">{report.notices.map(notice => <li key={notice.key} className="rounded-xl border border-border p-3">{notice.message}</li>)}</ul>
    </section>}
    {review && <section aria-label="Date change review" className="space-y-3 rounded-xl border border-border p-4"><h2 className="text-xl font-semibold">Check this date change</h2>
      <p>{review.report.activity?.activity.label}: {review.confirmation.oldDueOn} → {review.confirmation.newDueOn} (Africa/Kampala). No other task details change.</p>
      <p>For: {[review.report.taskContext?.enterprise, review.report.taskContext?.plot].filter(Boolean).join(", ") || "The whole farm"}.</p>
      <label className="flex min-h-12 items-start gap-3"><input type="checkbox" checked={consent} disabled={pending || !!retry || expired} onChange={e => setConsent(e.target.checked)} className="mt-1 size-5" />I reviewed these exact dates and understand the forecast is made up.</label>
      <Button disabled={pending || (!retry && (!consent || expired))} onClick={() => void confirm()}>{pending ? "Confirming date change…" : retry ? "Retry this confirmation" : "Confirm date change"}</Button>
      {!retry && <Button variant="outline" onClick={() => { setReview(null); setConsent(false); }}>Discard review</Button>}
      {retry && <Link className="block min-h-12 py-3 underline" href={`/farms/${farmId}/activities/${retry.input.activityId}`}>Open activity to check its saved date</Link>}
    </section>}
    {receipt && <section className="space-y-2"><p role="status">Activity date changed.</p><h2 className="text-xl font-semibold">Date change saved</h2><p>{receipt.oldDueOn} → {receipt.newDueOn}. Receipt: {receipt.receiptId}</p><Link className="inline-block min-h-12 py-3 underline" href={`/farms/${farmId}/activities/${receipt.activityId}`}>Open saved activity</Link></section>}
    <Link className="inline-block min-h-12 py-3 underline" href={`/farms/${farmId}/activities`}>Open planned work</Link>
  </div>;
}
