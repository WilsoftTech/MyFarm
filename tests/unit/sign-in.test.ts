import { describe, it, expect, vi } from "vitest";
import { signIn } from "@/modules/engineering-foundation/application/sign-in";
describe("credential boundary", () => {
it.each([{ email: "bad", password: "x" }, { email: "a@example.com", password: "" }, { email: "a@example.com", password: "x", role: "ADMIN" }])("rejects invalid/extra fields without contacting auth", async input => {
const credentials = { signIn: vi.fn(async () => true) };
expect((await signIn(input, credentials)).ok).toBe(false); expect(credentials.signIn).not.toHaveBeenCalled();
});
it("passes validated credentials only", async () => { expect(await signIn({ email: "a@example.com", password: "secret" }, { signIn: async () => true })).toEqual({ ok: true }); });
it("does not leak provider errors", async () => {
expect(await signIn({ email: "a@example.com", password: "secret" }, { signIn: async () => { throw new Error("secret-token/database-url"); } })).toEqual({ ok: false, message: "Sign-in is unavailable. Please try again later." });
});
});
