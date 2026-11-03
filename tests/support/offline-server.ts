import { spawn, type ChildProcess } from "node:child_process";

/** A dedicated app server a test can really stop, because Playwright's offline emulation also blocks service worker navigations. */
export function offlineServer(port: number) {
  const url = new URL(process.env.TEST_DATABASE_URL ?? "");
  url.searchParams.set("options", "-c role=myfarm_runtime");
  let child: ChildProcess | null = null;
  const baseURL = "http://127.0.0.1:" + port;
  return {
    baseURL,
    async start() {
      child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { stdio: "ignore",
        env: { ...process.env, DATABASE_URL: url.toString(), NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3211", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-publishable-key" } });
      for (let i = 0; i < 120; i++) {
        try { if ((await fetch(baseURL + "/api/health")).ok) return; } catch { /* Still starting. */ }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      throw new Error("Offline test server did not start");
    },
    async stop() {
      const running = child;
      child = null;
      if (!running) return;
      // SIGKILL, as Windows always does: on Linux, next start's SIGTERM shutdown waits for connections an open page still holds.
      if (running.exitCode === null && running.signalCode === null) await new Promise<void>(resolve => { running.once("exit", () => resolve()); running.kill("SIGKILL"); });
      for (let i = 0; i < 40; i++) {
        try { await fetch(baseURL + "/api/health"); } catch { return; }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    },
  };
}
