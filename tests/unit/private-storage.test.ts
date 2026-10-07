import { it, expect, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { privateStorage } from "@/modules/engineering-foundation/infrastructure/private-storage";
const tenant = "11111111-1111-4111-8111-111111111111", object = "22222222-2222-4222-8222-222222222222";
it("adapter requests a short scoped private URL, never public URL", async () => {
const client = createClient("https://example.test", "publishable");
const createSignedUrl = vi.fn(async () => ({ data: { signedUrl: "https://example.test/private" }, error: null }));
const from = vi.spyOn(client.storage, "from").mockReturnValue({ createSignedUrl } as unknown as ReturnType<typeof client.storage.from>);
expect(await privateStorage(client, "myfarm-private").signedRead({ actorId: object, organizationId: tenant, role: "FARMER" }, object)).toBe("https://example.test/private");
expect(from).toHaveBeenCalledWith("myfarm-private"); expect(createSignedUrl).toHaveBeenCalledWith(tenant + "/" + object, 60);
});
it("missing file/provider denial cannot return a grant", async () => {
const client = createClient("https://example.test", "publishable");
vi.spyOn(client.storage, "from").mockReturnValue({ createSignedUrl: async () => ({ data: null, error: new Error("secret provider detail") }) } as unknown as ReturnType<typeof client.storage.from>);
await expect(privateStorage(client, "myfarm-private").signedRead({ actorId: object, organizationId: tenant, role: "FARMER" }, object)).rejects.toMatchObject({ code: "UNAVAILABLE" });
});
