"use client";
import { signOutAction } from "@/app/sign-in/actions";
import { Button } from "@/components/ui/button";
import { clearOfflineAccount, currentOfflineAccount } from "@/modules/offline-first/client/account";
import { clearCachedData, localDatabase } from "@/modules/offline-first/client/local-database";

/** D-P07-003: cached farm data goes with the session. Unsent entries stay, hidden until this account signs in again. */
function forgetCachedData() {
  const account = currentOfflineAccount();
  clearOfflineAccount();
  if (account) clearCachedData(localDatabase(account)).catch(() => undefined);
}
export function SignOutForm({ className }: { className?: string }) {
  return <form action={signOutAction} onSubmit={forgetCachedData} className={className}><Button variant="outline">Sign out</Button></form>;
}
