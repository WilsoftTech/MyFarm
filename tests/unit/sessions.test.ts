import { beforeEach, it, expect, vi } from "vitest";
const getUser = vi.hoisted(() => vi.fn());
vi.mock("@/modules/engineering-foundation/infrastructure/environment", () => ({ authConfiguration: () => ({ url: "https://example.test", key: "publishable" }) }));
vi.mock("@/modules/engineering-foundation/infrastructure/supabase", () => ({ supabaseServer: async () => ({ auth: { getUser } }) }));
import { sessions } from "@/modules/engineering-foundation/infrastructure/sessions";
beforeEach(() => getUser.mockReset());
it("uses auth-server verified user identity", async () => { getUser.mockResolvedValue({ data: { user: { id: "subject" } }, error: null }); expect(await sessions.currentIdentity()).toEqual({ authSubject: "subject" }); expect(getUser).toHaveBeenCalledOnce(); });
it.each([400,401,403])("denies invalid/expired/revoked provider session (%s)", async status => { getUser.mockResolvedValue({ data: { user: null }, error: { status } }); expect(await sessions.currentIdentity()).toBeNull(); });
it("provider outage fails closed as unavailable", async () => { getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } }); await expect(sessions.currentIdentity()).rejects.toMatchObject({ code: "UNAVAILABLE" }); });
