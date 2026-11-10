import { vi } from "vitest";
// Server actions read request headers for the proxy's request-limit flag (D-P09-014). Unit tests run outside a
// request, so they see no headers, the same as a request the proxy let through.
vi.mock("next/headers", async original => ({ ...(await original<typeof import("next/headers")>()), headers: vi.fn(async () => new Headers()) }));
