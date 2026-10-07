import { it, expect, vi } from "vitest";
import { serializeLog } from "@/modules/engineering-foundation/infrastructure/logging";
import { failureResponse } from "@/modules/engineering-foundation/infrastructure/http";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
it("drops arbitrary secret fields and malformed error codes", () => {
const input = { event: "request_failed" as const, requestId: "request-id", code: "postgresql://password", password: "private", authorization: "Bearer secret", email: "farmer@example.com" };
const output = serializeLog(input);
expect(JSON.parse(output)).toEqual({ event: "request_failed", requestId: "request-id", code: "UNKNOWN" });
expect(output).not.toMatch(/password|Bearer|farmer|postgresql/);
});
it.each([["UNAUTHENTICATED",401],["FORBIDDEN",403],["INVALID_INPUT",400],["UNAVAILABLE",503],["CONFLICT",409]] as const)("maps %s safely", async (code, status) => {
const logger = vi.spyOn(console, "error").mockImplementation(() => {});
const response = failureResponse(new FoundationError(code), "request-id");
expect(response.status).toBe(status); expect(response.headers.get("cache-control")).toBe("no-store");
expect(await response.json()).toEqual({ error: code, requestId: "request-id" }); logger.mockRestore();
});
it("does not expose raw exception messages", async () => {
const logger = vi.spyOn(console, "error").mockImplementation(() => {});
const response = failureResponse(new Error("database password: secret"), "request-id");
expect(await response.text()).not.toContain("secret"); expect(logger.mock.calls.flat().join(" ")).not.toContain("secret"); logger.mockRestore();
});
