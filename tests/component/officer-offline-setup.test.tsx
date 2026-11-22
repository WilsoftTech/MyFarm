import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfficerOfflineSetup } from "@/components/officers/offline-setup";
import { accountGeneration, clearOfflineAccount, currentOfflineAccount, setOfflineAccount } from "@/modules/offline-first/client/account";

const cache = vi.hoisted(() => new Map<string, string>());
vi.mock("@/modules/offline-first/client/local-database", () => ({
  localDatabase: () => ({ meta: {
    put: async (row: { key: string; value: string }) => { cache.set(row.key, row.value); },
    bulkDelete: async (keys: string[]) => { keys.forEach(key => cache.delete(key)); },
  } }),
}));
afterEach(() => { clearOfflineAccount(); cache.clear(); });

describe("Officer offline account changes", () => {
  it("keeps saved assignments when an officer signs in after a farmer", async () => {
    setOfflineAccount("previous-farmer", accountGeneration());
    render(<OfficerOfflineSetup accountId="officer" scope="organization" asOf="2026-11-22T08:00:00Z" farms={[{
      assignmentId: "assignment", farmId: "farm", farmerId: "farmer", tenantId: "tenant", name: "Assigned farm", district: "Rukungiri", version: 1, permissions: ["DASHBOARD", "VISITS"],
    }]} />);
    await waitFor(() => expect(cache.get("officer:farms")).toContain("Assigned farm"));
    expect(currentOfflineAccount()).toBe("officer");
    expect(cache.get("officer:scope")).toBe("organization");
  });
  it("does not restore the account or assignments after sign-out", async () => {
    render(<OfficerOfflineSetup accountId="officer" scope="organization" asOf="2026-11-22T08:00:00Z" farms={[]} />);
    clearOfflineAccount();
    await Promise.resolve();
    expect(currentOfflineAccount()).toBeNull();
    expect(cache.size).toBe(0);
  });
});
