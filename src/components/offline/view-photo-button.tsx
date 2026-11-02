"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Asks for a short-lived link only when the farmer wants it, so each view is audited and no link is kept in the page. */
export function ViewPhotoButton({ farmId, photoId, label }: { farmId: string; photoId: string; label: string }) {
  const [opening, setOpening] = useState(false), [failed, setFailed] = useState(false);
  async function open() {
    setOpening(true); setFailed(false);
    try {
      const response = await fetch("/api/v1/farms/" + farmId + "/photos/" + photoId + "/view", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: crypto.randomUUID() }) });
      if (!response.ok) throw new Error("Unavailable");
      const { url } = await response.json() as { url: string };
      window.location.assign(url);
    } catch { setFailed(true); }
    setOpening(false);
  }
  return <div><Button variant="outline" disabled={opening} onClick={() => void open()}>{opening ? "Opening…" : label}</Button>{failed && <p role="alert" className="field-error mt-2">This photo could not be opened. Check your connection and try again.</p>}</div>;
}
