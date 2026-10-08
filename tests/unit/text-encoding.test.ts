import { it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
// UTF-8 text decoded as Windows-1252 and re-saved, e.g. U+00B7 becomes U+00C2 U+00B7 and U+2026 becomes U+00E2 U+20AC U+00A6.
const mojibake = /\u00C2[\u00A0-\u00BF]|\u00E2[\u0080-\u00BF\u20AC\u2020\u201A-\u201E\u2122]|\u00C3[\u0080-\u00BF\u2013-\u2122]/;
function sources(dir: string): string[] {
return readdirSync(dir, { withFileTypes: true }).flatMap(item => {
if (item.name === "generated") return [];
const file = path.join(dir, item.name);
return item.isDirectory() ? sources(file) : /\.(tsx?|css|mjs)$/.test(item.name) ? [file] : [];
});
}
it("user-facing source text is not double-encoded UTF-8", () => {
const files = [...sources("src"), ...sources("tests")];
expect(files.length).toBeGreaterThan(0);
const corrupted = files.filter(file => readFileSync(file, "utf8").split("\n").some(line => mojibake.test(line)));
expect(corrupted).toEqual([]);
});
