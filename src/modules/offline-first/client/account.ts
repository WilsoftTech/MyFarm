/** The last account signed in on this phone. A browser cannot check a session offline (D-P07-003). */
const KEY = "myfarm.offline.account";
let generation = 0;

export function currentOfflineAccount(): string | null {
  try { return window.localStorage.getItem(KEY); } catch { return null; }
}
/** Taken before asking the server who is signed in, so an answer that arrives after a sign-out is ignored. */
export function accountGeneration(): number { return generation; }
export function setOfflineAccount(accountId: string, startedAt: number): boolean {
  if (startedAt !== generation) return false;
  try { window.localStorage.setItem(KEY, accountId); } catch { /* The storage panel reports blocked storage. */ }
  return true;
}
export function clearOfflineAccount(): void {
  generation += 1;
  try { window.localStorage.removeItem(KEY); } catch { /* Nothing to clear when storage is blocked. */ }
}
