import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)), "server-only": fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)) };
export default defineConfig({ test: { projects: [
{ resolve: { alias }, test: { name: "unit", environment: "node", include: ["tests/unit/**/*.test.ts"] } },
{ resolve: { alias }, test: { name: "component", environment: "jsdom", setupFiles: ["tests/setup.ts"], include: ["tests/component/**/*.test.tsx"] } },
{ resolve: { alias }, test: { name: "integration", environment: "node", include: ["tests/integration/**/*.test.ts"], fileParallelism: false } },
] } });
