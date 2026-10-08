import { beforeEach, it, expect, vi } from "vitest";
const getUser = vi.hoisted(() => vi.fn());
const getClaims = vi.hoisted(() => vi.fn());
const queryRaw = vi.hoisted(() => vi.fn());
vi.mock("@/modules/engineering-foundation/infrastructure/environment", () => ({ authConfiguration: () => ({ url: "https://example.test", key: "publishable" }) }));
vi.mock("@/modules/engineering-foundation/infrastructure/supabase", () => ({ supabaseServer: async () => ({ auth: { getUser, getClaims } }) }));
vi.mock("@/modules/engineering-foundation/infrastructure/database", () => ({ database: () => ({ $queryRaw: queryRaw }) }));
import { sessions } from "@/modules/engineering-foundation/infrastructure/sessions";
beforeEach(() => {
getUser.mockReset(); getClaims.mockReset(); queryRaw.mockReset();
getClaims.mockResolvedValue({ data: { claims: { sub: "subject", session_id: "f2a111e3-e4b5-432a-8f81-d0918de9bb80" } }, error: null });
queryRaw.mockResolvedValue([{ active: true }]);
});
it("uses auth-server verified user identity", async () => { getUser.mockResolvedValue({ data: { user: { id: "subject" } }, error: null }); expect(await sessions.currentIdentity()).toEqual({ authSubject: "subject" }); expect(getUser).toHaveBeenCalledOnce(); });
it.each([400,401,403])("denies invalid/expired/revoked provider session (%s)", async status => { getUser.mockResolvedValue({ data: { user: null }, error: { status } }); expect(await sessions.currentIdentity()).toBeNull(); });
it("provider outage fails closed as unavailable", async () => { getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } }); await expect(sessions.currentIdentity()).rejects.toMatchObject({ code: "UNAVAILABLE" }); });
it("denies a signed token whose session was revoked or expired", async () => {
getUser.mockResolvedValue({ data: { user: { id: "subject" } }, error: null });
queryRaw.mockResolvedValue([{ active: false }]);
expect(await sessions.currentIdentity()).toBeNull();
});
it.each([
{ sub: "subject" },
{ sub: "subject", session_id: "invalid" },
{ sub: "other", session_id: "f2a111e3-e4b5-432a-8f81-d0918de9bb80" },
])("denies missing or mismatched session claims", async claims => {
getUser.mockResolvedValue({ data: { user: { id: "subject" } }, error: null });
getClaims.mockResolvedValue({ data: { claims }, error: null });
expect(await sessions.currentIdentity()).toBeNull(); expect(queryRaw).not.toHaveBeenCalled();
});
it("fails closed when session verification database is unavailable", async () => {
getUser.mockResolvedValue({ data: { user: { id: "subject" } }, error: null });
queryRaw.mockRejectedValue(new Error("private connection detail"));
await expect(sessions.currentIdentity()).rejects.toMatchObject({ code: "UNAVAILABLE" });
});
