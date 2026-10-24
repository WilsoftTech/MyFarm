export function ProductionFormFeedback({ online, saving, message }: { online: boolean; saving: boolean; message: string }) {
  return <>
    <p className="text-sm leading-6 text-foreground/75">You need a connection to save. Keep this page open to keep unsaved details.</p>
    {!online && <p role="status" className="rounded-xl bg-muted p-4">You are offline. Your details are still here. Reconnect to save.</p>}
    {saving && <p role="status">Saving…</p>}
    {message && <p role="alert" className="field-error">{message}</p>}
  </>;
}
