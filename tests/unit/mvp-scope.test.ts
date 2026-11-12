import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * MYF-P08-R004 / L gate: the MVP ends before field testing, with no AI, marketplace, payments or lending (Phases
 * 10-23). Each later phase removes its own names here only once the owner authorizes it. This guard fails if a later phase's capability arrives in code or dependencies before its phase is
 * authorized. "payments" alone is allowed: it is the Phase 4 settlement of sales and purchases, not a payment provider.
 */
// Phase 11 (AI assistant) was authorized on 2026-11-12 (D-P11-001), so its names are allowed; its provider packages
// and secrets stay forbidden until the owner chooses a provider (D-P11-002: a fake explains answers until then).
const later = /^(voice|marketplace|market|buyers?|listings?|wallets?|mobile-money|momo|mpesa|loans?|lending|credit|financing|insurance|billing|subscriptions?|checkout)$/i;
const laterPackages = /^(openai|@anthropic-ai\/.+|@google\/(generative-ai|genai)|langchain|@langchain\/.+|ai|@ai-sdk\/.+|stripe|@stripe\/.+|paystack.*|flutterwave.*|@flutterwave\/.+|mtn-momo.*|africastalking|twilio)$/;
const laterSecrets = /process\.env\.(OPENAI|ANTHROPIC|GEMINI|STRIPE|PAYSTACK|FLUTTERWAVE|MOMO|MPESA|TWILIO|AFRICASTALKING)\w*/;

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? [path, ...walk(path)] : [path];
  });
}
const source = walk("src").filter(path => !path.includes(join("src", "generated")));
const segments = (path: string) => path.split(/[\\/]/).map(part => part.replace(/^\(|\)$|^\[|\]$/g, "").replace(/\.(tsx?|mjs)$/, ""));

describe("MVP scope: later-phase capabilities are absent (MYF-P08-R004)", () => {
  it("no route, module or component for AI, voice, markets, wallets, lending or billing", () => {
    expect(source.filter(path => segments(path).some(part => later.test(part)))).toEqual([]);
  });
  it("no AI, payment-provider or messaging package is installed", () => {
    const manifest = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const installed = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
    expect(installed.filter(name => laterPackages.test(name))).toEqual([]);
  });
  it("no code reads a provider secret for those services", () => {
    expect(source.filter(path => /\.(tsx?|mjs)$/.test(path) && laterSecrets.test(readFileSync(path, "utf8")))).toEqual([]);
  });
  it("the guard itself recognises later-phase names and leaves Phase 4 payments alone", () => {
    expect(["wallet", "marketplace", "loans", "voice", "billing"].every(name => later.test(name))).toBe(true);
    expect(["ai", "assistant", "ai-assistant"].some(name => later.test(name))).toBe(false);
    expect(["payments", "payment-methods", "accounting", "activities"].some(name => later.test(name))).toBe(false);
    expect(["openai", "@anthropic-ai/sdk", "stripe", "@langchain/core"].every(name => laterPackages.test(name))).toBe(true);
  });
});
