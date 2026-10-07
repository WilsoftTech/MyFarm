import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
const directory = "docs/reports/evidence/phase-01-2026-10-08";
mkdirSync(directory, { recursive: true });
const commands = [["lint","npm run lint"],["typecheck","npm run typecheck"],["tests","npm test"],["boundaries","npm run check:boundaries"],["build","npm run build"]];
const results = [];
for (const [name, command] of commands) {
const start = new Date().toISOString();
const result = spawnSync(process.platform === "win32" ? process.env.ComSpec : "npm", process.platform === "win32" ? ["/d", "/s", "/c", command] : command.split(" ").slice(1), { encoding: "utf8", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });
const output = (result.stdout ?? "") + (result.stderr ?? "");
writeFileSync(directory + "/" + name + ".log", "$ " + command + "\n" + output);
const record = { command, startedAt: start, exitCode: result.status, signal: result.signal };
results.push(record); console.log(JSON.stringify(record)); if (result.status !== 0) console.log(output);
}
writeFileSync(directory + "/checks.json", JSON.stringify(results, null, 2));
if (results.some(r => r.exitCode !== 0)) process.exitCode = 1;
