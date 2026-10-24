"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import type { CommandSubmit } from "@/modules/engineering-foundation/contracts/command-result";

function subscribe(listener: () => void) {
  window.addEventListener("online", listener); window.addEventListener("offline", listener);
  return () => { window.removeEventListener("online", listener); window.removeEventListener("offline", listener); };
}
const onlineSnapshot = () => navigator.onLine;
const serverSnapshot = () => true;
const subscribeReady = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

/** The ID survives an interrupted response; editing the normalized payload starts a new intent. */
export function useProductionSubmit(submit: CommandSubmit) {
  const [initialRequestId] = useState(() => crypto.randomUUID());
  const [message, setMessage] = useState("");
  const last = useRef<{ payload: string; requestId: string } | null>(null);
  const online = useSyncExternalStore(subscribe, onlineSnapshot, serverSnapshot);
  const ready = useSyncExternalStore(subscribeReady, clientReady, serverReady);
  async function save(data: { requestId: string } & Record<string, unknown>) {
    setMessage("");
    if (!navigator.onLine) return;
    const { requestId, ...fields } = data;
    const payload = JSON.stringify(fields);
    if (!last.current || last.current.payload !== payload) last.current = { payload, requestId: last.current ? crypto.randomUUID() : requestId };
    try {
      const result = await submit({ ...fields, requestId: last.current.requestId });
      if (result && !result.ok) setMessage(result.message);
    } catch { setMessage("Connection interrupted. Your details are still here. Reconnect and try again."); }
  }
  return { initialRequestId, message, online, ready, save };
}
