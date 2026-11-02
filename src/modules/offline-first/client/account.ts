/** The last account signed in on this phone. A browser cannot check a session offline (D-P07-003). */
const KEY = "myfarm.offline.account";

export function currentOfflineAccount(): string | null {
  try { return window.localStorage.getItem(KEY); } catch { return null; }
}
export function setOfflineAccount(accountId: string): void {
  try { window.localStorage.setItem(KEY, accountId); } catch { /* The storage panel reports blocked storage. */ }
}
export function clearOfflineAccount(): void {
  try { window.localStorage.removeItem(KEY); } catch { /* Nothing to clear when storage is blocked. */ }
}
