"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/components/accounting/labels";
import type { VoiceDraftView } from "@/modules/voice-experience/contracts/drafts";

export function DraftReview({ draft, farmName, category, paidBy, links, online, busy, uncertain, confirm, edit, discard }: {
  draft: VoiceDraftView; farmName: string; category: string; paidBy: string; links: string[]; online: boolean;
  busy: boolean; uncertain: boolean; confirm: () => Promise<void>; edit: () => void; discard: () => void;
}) {
  const [agreed, setAgreed] = useState(false), [expired, setExpired] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setExpired(true), Math.max(0, Date.parse(draft.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [draft.expiresAt]);
  const command = draft.review.command;
  return <section aria-labelledby="voice-review-title" className="space-y-5 rounded-2xl border border-border bg-white p-5 sm:p-6">
    <h2 id="voice-review-title" tabIndex={-1} className="text-2xl font-semibold">Check this expense</h2>
    <p>No expense has been saved until you confirm. Check every detail below.</p>
    <dl className="grid gap-4 sm:grid-cols-2">
      <div><dt className="text-sm">Farm</dt><dd className="font-semibold">{farmName}</dd></div>
      <div><dt className="text-sm">Total paid</dt><dd className="text-xl font-bold">{formatMoney(command.amount, command.currency)}</dd></div>
      <div><dt className="text-sm">Date paid</dt><dd>{command.occurredOn}</dd></div>
      <div><dt className="text-sm">Category</dt><dd>{category}</dd></div>
      <div><dt className="text-sm">Paid to</dt><dd>{command.counterparty ?? "Not recorded"}</dd></div>
      <div><dt className="text-sm">How it was paid</dt><dd>{paidBy}</dd></div>
    </dl>
    <p>{links.length ? links.join("; ") : "Not linked to an enterprise, season, plot or poultry batch."}</p>
    {draft.review.bags !== null && <p>{draft.review.bags} bags are a description only. No weight is assumed and no stock will be added. The amount above is the total.</p>}
    <p className="text-sm">This review expires at {new Date(draft.expiresAt).toLocaleTimeString("en-GB")}. Editing requires a new review.</p>
    {expired && !uncertain && <p role="alert">This review has expired. Review the details again before saving.</p>}
    {uncertain && <p role="status">The response was interrupted. This expense may already be saved. Retry the same confirmation to check; do not enter it again.</p>}
    <label className="flex min-h-12 items-start gap-3"><input type="checkbox" className="mt-1 size-5 shrink-0" checked={agreed} disabled={busy || !online} onChange={event => setAgreed(event.target.checked)} />
      <span>I checked this farm, total, currency and date and want to save this expense.</span></label>
    <div className="flex flex-wrap gap-3">
      <Button type="button" disabled={busy || !online || !agreed || (expired && !uncertain)} onClick={() => void confirm()}>{busy ? "Checking…" : uncertain ? "Retry this confirmation" : "Confirm expense"}</Button>
      <Button type="button" variant="outline" disabled={busy || uncertain} onClick={edit}>{expired ? "Review again" : "Edit details"}</Button>
      <Button type="button" variant="outline" disabled={busy || uncertain} onClick={discard}>Discard review</Button>
    </div>
  </section>;
}
